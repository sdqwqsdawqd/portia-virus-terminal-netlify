import { basename } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { test as base, expect, type Browser } from "@playwright/test";
import { loadPromotionAccessRoster } from "../../../lib/portia-promotion-sheet.ts";
import {
  actorAvailability,
  type ActorAvailability,
  type ActorRole,
} from "./actors";
import {
  assertDiagnosticsClean,
  DiagnosticLedger,
  installDiagnostics,
} from "./diagnostics";
import {
  assertNoOwnApiFulfilled,
  ExternalRouteLedger,
  installExternalRoutes,
} from "./external-routes";
import { deterministicContract, installDeterminism } from "./determinism";
import { probeSession, type VerifiedSession } from "./session-probe.ts";
import {
  buildReceipt,
  createRun,
  requireStagingLiveTarget,
  writeReceipt,
  type Run,
  type StagingLiveTarget,
  type SuiteStatus,
} from "./staging-harness.ts";
import { MutationTargetBlockedError } from "./target-guard.ts";

type PrivilegedRole = Exclude<ActorRole, "visitor">;
type Cookie = Awaited<ReturnType<Awaited<ReturnType<Browser["newContext"]>>["cookies"]>>[number];

export type StagingSession = Readonly<{
  role: PrivilegedRole;
  label: string;
  email: string;
  proof: VerifiedSession;
  cookies: Cookie[];
  cookieHeader: string;
}>;

// A role lane that cannot be proven (no safe env, probe refused) is BLOCKED with the reason; it is never a pass.
export type SessionOutcome = { session: StagingSession } | { blocked: string };

export type StagingRun = {
  /** Present only with a safe isolated target; assertions must not use run.admin for behavior (Pitfall 12). */
  readonly run: Run | undefined;
  readonly live: StagingLiveTarget | undefined;
  session(role: PrivilegedRole, baseURL: string, label?: string): Promise<SessionOutcome>;
  touch(): void;
};

type PortiaFixtures = {
  actorRole: ActorRole;
  actor: ActorAvailability;
  diagnostics: DiagnosticLedger;
  externalRoutes: ExternalRouteLedger;
  determinism: typeof deterministicContract;
  stagingOutcome: void;
};

type PortiaWorkerFixtures = { stagingRun: StagingRun };

const sessionCookiePrefix = "sb-";
const decodeCookieValue = (value: string) =>
  value.startsWith("base64-") ? Buffer.from(value.slice("base64-".length), "base64url").toString("utf8") : value;

// @supabase/ssr stores the session in `sb-<ref>-auth-token`, split into `.0`, `.1`... when large.
export function accessTokenFromCookies(cookies: readonly { name: string; value: string }[]) {
  const parts = cookies
    .filter((cookie) => cookie.name.startsWith(sessionCookiePrefix) && /-auth-token(\.\d+)?$/u.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  if (parts.length === 0) throw new Error("session-cookie-missing");
  const session = JSON.parse(decodeCookieValue(parts.map((part) => part.value).join(""))) as { access_token?: string };
  if (!session.access_token) throw new Error("session-token-missing");
  return session.access_token;
}

const header = (cookies: readonly { name: string; value: string }[]) =>
  cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

async function uiLogin(browser: Browser, baseURL: string, credentials: { email: string; password: string }) {
  const context = await browser.newContext({ baseURL, locale: "ru-RU" });
  try {
    const page = await context.newPage();
    await page.goto("/owner-login");
    await page.locator('input[name="email"]').fill(credentials.email);
    await page.locator('input[name="password"]').fill(credentials.password);
    await page.getByRole("button", { name: "ВОЙТИ", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/owner-login" && url.search !== "");
    if (new URL(page.url()).pathname !== "/") throw new Error("ui-login-rejected");
    return (await context.storageState()).cookies;
  } finally {
    await context.close();
  }
}

// /owner-login signs a non-editor out on purpose (ownerLogin -> denied), so a participant has no UI sign-in.
// Its cookie is produced by the same @supabase/ssr serializer the server uses, from a harness sign-in.
async function participantCookies(live: StagingLiveTarget, run: Run, label: string, baseURL: string) {
  const { data } = await run.client(label).auth.getSession();
  if (!data.session) throw new Error("participant-session-missing");
  const jar = new Map<string, string>();
  const ssr = createServerClient(live.url, live.publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const set = await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  if (set.error) throw new Error("participant-cookie-failed");
  const host = new URL(baseURL).hostname;
  return [...jar].map(([name, value]) => ({
    name, value, domain: host, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const,
  })) as Cookie[];
}

const rank: Record<SuiteStatus, number> = { PASS: 0, SKIP: 1, BLOCKED: 2, FAIL: 3 };

export const test = base.extend<PortiaFixtures, PortiaWorkerFixtures>({
  stagingRun: [
    async ({ browser }, fixtureUse) => {
      let live: StagingLiveTarget | undefined;
      try {
        live = requireStagingLiveTarget();
      } catch (error) {
        if (!(error instanceof MutationTargetBlockedError)) throw error;
      }
      let run: Run | undefined;
      const sessions = new Map<string, Promise<SessionOutcome>>();
      const suites: Record<string, SuiteStatus> = {};
      const state = { touched: false };

      const handle: StagingRun & { suites: Record<string, SuiteStatus>; state: typeof state } = {
        get run() {
          return run;
        },
        live,
        suites,
        state,
        touch: () => {
          state.touched = true;
        },
        session(role, baseURL, label = role) {
          state.touched = true;
          if (!live) return Promise.resolve({ blocked: "safe target unavailable" });
          const key = `${role}:${label}`;
          const cached = sessions.get(key);
          if (cached) return cached;
          const created = (async (): Promise<SessionOutcome> => {
            run ??= createRun(live);
            const grants = role === "editor" ? {} : role === "promo-reviewer" ? { grantedTabs: ["promo"] } : undefined;
            if (role === "owner") await run.createOwnerFixture();
            else await run.createIdentity(label, grants);
            const credentials = run.credentials(role === "owner" ? "owner" : label);
            const cookies = role === "participant"
              ? await participantCookies(live, run, label, baseURL)
              : await uiLogin(browser, baseURL, credentials);
            let participant: { nickname: string } | undefined;
            if (role === "participant") {
              const roster = await loadPromotionAccessRoster();
              if (roster.status !== "ok" || roster.roster.length === 0) return { blocked: "promotion roster source unavailable (external sheet)" };
              participant = { nickname: roster.roster[0].nickname };
            }
            try {
              const proof = await probeSession({
                role, target: live.target, baseURL, cookieHeader: header(cookies), accessToken: accessTokenFromCookies(cookies), participant,
              });
              return { session: { role, label, email: credentials.email, proof, cookies, cookieHeader: header(cookies) } };
            } catch (error) {
              if (error instanceof MutationTargetBlockedError) return { blocked: error.message };
              throw error;
            }
          })();
          sessions.set(key, created);
          return created;
        },
      };

      await fixtureUse(handle);

      if (!run) return;
      let cleanupError: unknown;
      try {
        await run.cleanup();
      } catch (error) {
        cleanupError = error;
      }
      const receipt = await buildReceipt(run, suites);
      writeReceipt(receipt, run.secrets(), "playwright");
      if (cleanupError) throw cleanupError;
    },
    { scope: "worker" },
  ],
  actorRole: ["visitor", { option: true }],
  actor: async ({ actorRole, stagingRun, baseURL, context }, fixtureUse, testInfo) => {
    let actor: ActorAvailability;
    if (actorRole === "visitor") {
      actor = actorAvailability(actorRole);
    } else {
      const outcome = await stagingRun.session(actorRole, baseURL ?? "http://127.0.0.1:3000");
      if ("session" in outcome) {
        await context.addCookies(outcome.session.cookies);
        actor = actorAvailability(actorRole, process.env, outcome.session.proof);
      } else {
        // Without a minted proof actorAvailability fails closed; the probe reason is kept for the skip message.
        const blocked = actorAvailability(actorRole);
        actor = blocked.status === "BLOCKED" ? { ...blocked, reason: `${blocked.reason}; ${outcome.blocked}` } : blocked;
      }
    }
    testInfo.skip(
      actor.status === "BLOCKED",
      actor.status === "BLOCKED" ? `BLOCKED: ${actor.reason}` : undefined,
    );
    await fixtureUse(actor);
  },
  // Receipt suite per spec file: FAIL beats BLOCKED beats SKIP beats PASS. A skip is never counted as a pass.
  stagingOutcome: [
    async ({ stagingRun }, fixtureUse, testInfo) => {
      const handle = stagingRun as StagingRun & { suites: Record<string, SuiteStatus>; state: { touched: boolean } };
      handle.state.touched = false;
      await fixtureUse();
      if (!handle.state.touched || !handle.run) return;
      const status: SuiteStatus =
        testInfo.status === "passed" ? "PASS" : testInfo.status === "skipped" ? "SKIP" : "FAIL";
      const key = basename(testInfo.file).replace(/[^a-z0-9-]/giu, "-").toLowerCase();
      const previous = handle.suites[key];
      if (!previous || rank[status] > rank[previous]) handle.suites[key] = status;
    },
    { auto: true },
  ],
  determinism: [
    async ({ page }, use) => {
      await installDeterminism(page);
      await use(deterministicContract);
    },
    { auto: true },
  ],
  externalRoutes: [
    async ({ page }, use) => {
      const ledger = new ExternalRouteLedger();
      await installExternalRoutes(page, ledger);
      await use(ledger);
      assertNoOwnApiFulfilled(ledger.entries);
    },
    { auto: true },
  ],
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const ledger = new DiagnosticLedger();
      await installDiagnostics(page, ledger);
      await use(ledger);
      await assertDiagnosticsClean(ledger.entries, testInfo, "portia-diagnostics", ledger.expectedFaults);
    },
    { auto: true },
  ],
});

export { expect };
