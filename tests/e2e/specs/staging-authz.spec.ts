import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { APIResponse, Browser, BrowserContext, TestInfo } from "@playwright/test";
import { EditorPage } from "../pages/editor.page";
import { expect, test, type StagingRun, type StagingSession } from "../fixtures/test";
import type { ActorRole } from "../fixtures/actors";

// Role x API matrix, revoke without re-login and HTTP revision CAS against the isolated project (plan 16-13).
// Expectations come from the `api` section of expected-authz.json (derived from the route code), never from observation.

type Cell = { status: number; body?: Record<string, unknown> };
type ApiRoute = { key: string; method: string; path: string; source: string; cells: Record<string, Cell> };
type ApiMatrix = { routes: ApiRoute[]; cas: { parallel: number; rounds: number } };
const api = (JSON.parse(readFileSync(new URL("../fixtures/data/expected-authz.json", import.meta.url), "utf8")) as { api: ApiMatrix }).api;
const route = (key: string) => {
  const found = api.routes.find((item) => item.key === key);
  if (!found) throw new Error(`api-route-missing:${key}`);
  return found;
};

const roles = ["visitor", "participant", "editor", "promo-reviewer", "owner"] as const satisfies readonly ActorRole[];
const fallbackBase = "http://127.0.0.1:3000";
// 1x1 transparent PNG.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function adminOf(stagingRun: StagingRun) {
  const live = stagingRun.live;
  if (!live) throw new Error("safe target unavailable");
  return createClient(live.url, live.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sessionOrSkip(stagingRun: StagingRun, role: Exclude<ActorRole, "visitor">, baseURL: string, testInfo: TestInfo, label?: string) {
  const outcome = await stagingRun.session(role, baseURL, label);
  testInfo.skip("blocked" in outcome, "blocked" in outcome ? `BLOCKED: ${outcome.blocked}` : undefined);
  if (!("session" in outcome)) throw new Error("unreachable");
  return outcome.session;
}

async function contextFor(browser: Browser, baseURL: string, session?: StagingSession) {
  return browser.newContext({ baseURL, locale: "ru-RU", storageState: session ? { cookies: session.cookies, origins: [] } : undefined });
}

type ContentRow = { id: string; payload: unknown; revision: number; updated_at: string; updated_by: string | null };

// Records portia_content "main" before a mutating test and puts it back (or removes the row) afterwards.
async function withContentRestored<T>(stagingRun: StagingRun, work: () => Promise<T>): Promise<T> {
  const admin = adminOf(stagingRun);
  const before = await admin.from("portia_content").select("*").eq("id", "main").maybeSingle<ContentRow>();
  expect(before.error, "snapshot portia_content").toBeNull();
  try {
    return await work();
  } finally {
    const restored = before.data
      ? await admin.from("portia_content").update({
          payload: before.data.payload, revision: before.data.revision, updated_at: before.data.updated_at, updated_by: before.data.updated_by,
        }).eq("id", "main")
      : await admin.from("portia_content").delete().eq("id", "main");
    expect(restored.error, "restore portia_content").toBeNull();
    const after = await admin.from("portia_content").select("revision").eq("id", "main").maybeSingle<{ revision: number }>();
    expect(after.data?.revision ?? 0, "content restored to its original revision").toBe(before.data?.revision ?? 0);
  }
}

async function storedRevision(stagingRun: StagingRun) {
  const { data, error } = await adminOf(stagingRun).from("portia_content").select("revision").eq("id", "main").maybeSingle<{ revision: number }>();
  expect(error, "read revision").toBeNull();
  return data?.revision ?? 0;
}

async function currentContent(context: BrowserContext) {
  const response = await context.request.get("/api/content");
  expect(response.status()).toBe(200);
  return (await response.json()) as { content: unknown; revision: number };
}

const labelOf = (role: string, key: string) => `${role} ${key}`;

async function expectCell(response: APIResponse, cell: Cell, label: string, derived: Record<string, unknown> = {}) {
  expect(response.status(), `${label} status`).toBe(cell.status);
  for (const [field, value] of Object.entries(cell.body ?? {})) {
    expect(derived[field], `${label} ${field}`).toEqual(value);
  }
}

for (const role of roles) {
  test(`[STAB-SEC-01] ${role} API results match the api section of expected-authz.json`, async ({ browser, stagingRun, baseURL }, testInfo) => {
    const base = baseURL ?? fallbackBase;
    const session = role === "visitor" ? undefined : await sessionOrSkip(stagingRun, role, base, testInfo);
    if (role === "visitor") {
      stagingRun.touch();
      testInfo.skip(!stagingRun.live, "BLOCKED: safe target unavailable");
    }
    const context = await contextFor(browser, base, session);
    const uploaded: string[] = [];
    try {
      await withContentRestored(stagingRun, async () => {
        const get = (path: string) => context.request.get(path);

        const access = await get("/api/access");
        const accessJson = (await access.json()) as { canEdit: boolean; canManageEditors: boolean; openTabs: string[] };
        await expectCell(access, route("access-get").cells[role], labelOf(role, "access-get"), {
          canEdit: accessJson.canEdit,
          canManageEditors: accessJson.canManageEditors,
          promoOpen: accessJson.openTabs.includes("promo"),
        });

        const before = await currentContent(context);
        const put = await context.request.put("/api/content", { data: { content: before.content, revision: before.revision } });
        const putJson = (await put.json()) as { ok?: boolean; revision?: number };
        await expectCell(put, route("content-put").cells[role], labelOf(role, "content-put"), {
          ok: putJson.ok,
          revisionAdvanced: putJson.revision === before.revision + 1,
        });

        const editors = await get("/api/editors");
        const editorsJson = (await editors.json()) as { editors?: unknown };
        await expectCell(editors, route("editors-get").cells[role], labelOf(role, "editors-get"), { editorsIsArray: Array.isArray(editorsJson.editors) });

        const email = stagingRun.run ? stagingRun.run.emailOf(`api-${role}`) : "portia-live-none@example.invalid";
        const added = await context.request.post("/api/editors", { data: { email } });
        const addedJson = (await added.json()) as { editor?: { email?: string } };
        await expectCell(added, route("editors-post").cells[role], labelOf(role, "editors-post"), { emailMatches: addedJson.editor?.email === email });

        const removed = await context.request.delete(`/api/editors?email=${encodeURIComponent(email)}`);
        const removedJson = (await removed.json()) as { ok?: boolean };
        await expectCell(removed, route("editors-delete").cells[role], labelOf(role, "editors-delete"), { ok: removedJson.ok });

        const upload = await context.request.post("/api/uploads", { multipart: { file: { name: "probe.png", mimeType: "image/png", buffer: png } } });
        const uploadJson = (await upload.json()) as { url?: string };
        if (typeof uploadJson.url === "string") uploaded.push(uploadJson.url);
        await expectCell(upload, route("uploads-post").cells[role], labelOf(role, "uploads-post"), { urlIsString: typeof uploadJson.url === "string" });

        const reviewer = await get("/api/promotion/reviewer");
        const reviewerJson = (await reviewer.json()) as { sourceStatus?: unknown };
        await expectCell(reviewer, route("promotion-reviewer-get").cells[role], labelOf(role, "promotion-reviewer-get"), {
          sourceStatusIsString: typeof reviewerJson.sourceStatus === "string",
        });
      });
    } finally {
      await context.close();
      // The route writes to recycle/<uuid>, outside the run prefix, so the object is removed here.
      if (uploaded.length) {
        const paths = uploaded.map((url) => decodeURIComponent(new URL(url).pathname.split("/portia-media/")[1] ?? "")).filter(Boolean);
        const removed = await adminOf(stagingRun).storage.from("portia-media").remove(paths);
        expect(removed.error, "remove uploaded probe objects").toBeNull();
      }
    }
  });
}

test("[STAB-SEC-01] editor revoke applies to the open session without re-login", async ({ browser, stagingRun, baseURL }, testInfo) => {
  const base = baseURL ?? fallbackBase;
  const editorSession = await sessionOrSkip(stagingRun, "editor", base, testInfo, "editor-revoke");
  const ownerSession = await sessionOrSkip(stagingRun, "owner", base, testInfo);
  const editorContext = await contextFor(browser, base, editorSession);
  const ownerContext = await contextFor(browser, base, ownerSession);
  try {
    await withContentRestored(stagingRun, async () => {
      const page = await editorContext.newPage();
      const editor = new EditorPage(page);
      await editor.desktop.goto();
      await editor.openSettings();
      await expect(editor.openEditor).toBeEnabled();
      await editor.openEditor.click();
      await expect(editor.editorNavigation()).toBeVisible();

      const before = await currentContent(editorContext);
      expect((await editorContext.request.put("/api/content", { data: { content: before.content, revision: before.revision } })).status()).toBe(200);

      const revoked = await ownerContext.request.delete(`/api/editors?email=${encodeURIComponent(editorSession.email)}`);
      expect(revoked.status()).toBe(200);

      // Same cookies, no sign-in: the server decides again on every request.
      const access = (await (await editorContext.request.get("/api/access")).json()) as { canEdit: boolean };
      expect(access.canEdit).toBe(false);
      const after = await currentContent(editorContext);
      expect((await editorContext.request.put("/api/content", { data: { content: after.content, revision: after.revision } })).status()).toBe(403);

      await page.reload();
      await editor.openSettings();
      await expect(editor.openEditor).toBeDisabled();
    });
  } finally {
    await editorContext.close();
    await ownerContext.close();
  }
});

test("[STAB-SEC-01] promo revoke applies to the open reviewer session without re-login", async ({ browser, stagingRun, baseURL }, testInfo) => {
  const base = baseURL ?? fallbackBase;
  const reviewerSession = await sessionOrSkip(stagingRun, "promo-reviewer", base, testInfo, "promo-revoke");
  const ownerSession = await sessionOrSkip(stagingRun, "owner", base, testInfo);
  const reviewerContext = await contextFor(browser, base, reviewerSession);
  const ownerContext = await contextFor(browser, base, ownerSession);
  try {
    expect((await reviewerContext.request.get("/api/promotion/reviewer")).status()).toBe(200);

    const revoked = await ownerContext.request.patch("/api/editors", { data: { email: reviewerSession.email, grantedTabs: [] } });
    expect(revoked.status()).toBe(200);

    const access = (await (await reviewerContext.request.get("/api/access")).json()) as { canEdit: boolean; openTabs: string[] };
    expect(access.openTabs.includes("promo")).toBe(false);
    expect((await reviewerContext.request.get("/api/promotion/reviewer")).status()).toBe(403);
  } finally {
    await reviewerContext.close();
    await ownerContext.close();
  }
});

test("[STAB-REL-04] concurrent PUT /api/content with one baseRevision yields exactly one 200 per round", async ({ browser, stagingRun, baseURL }, testInfo) => {
  const base = baseURL ?? fallbackBase;
  const editorSession = await sessionOrSkip(stagingRun, "editor", base, testInfo, "editor-cas");
  const ownerSession = await sessionOrSkip(stagingRun, "owner", base, testInfo);
  const contexts = [await contextFor(browser, base, editorSession), await contextFor(browser, base, ownerSession)];
  try {
    await withContentRestored(stagingRun, async () => {
      const { parallel, rounds } = api.cas;
      for (let round = 1; round <= rounds; round += 1) {
        const snapshot = await currentContent(contexts[0]);
        const baseRevision = await storedRevision(stagingRun);
        const statuses = await Promise.all(
          Array.from({ length: parallel }, async (_, index) =>
            (await contexts[index % contexts.length].request.put("/api/content", { data: { content: snapshot.content, revision: baseRevision } })).status()),
        );
        const ok = statuses.filter((status) => status === 200).length;
        const conflicts = statuses.filter((status) => status === 409).length;
        expect({ round, ok, conflicts, other: statuses.length - ok - conflicts }, `round ${round} statuses ${statuses.join(",")}`).toEqual({
          round, ok: 1, conflicts: parallel - 1, other: 0,
        });
        expect(await storedRevision(stagingRun), `round ${round} final revision`).toBe(baseRevision + 1);
      }
    });
  } finally {
    for (const context of contexts) await context.close();
  }
});
