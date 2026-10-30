import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { release } from "node:os";
import path from "node:path";
import type { Browser, Locator, Page, TestInfo } from "@playwright/test";
import type { deterministicContract } from "../fixtures/determinism";

type Determinism = typeof deterministicContract;

export type CandidateContext = Readonly<{
  page: Page;
  browser: Browser;
  testInfo: TestInfo;
  determinism: Determinism;
}>;

export type CandidateSpec = Readonly<{
  id: string;
  requirement: "STAB-BASE-03" | "STAB-BASE-04";
  surface: string;
  actor: string;
  state: string;
  intendedSnapshot: string;
  mask?: Locator[];
  animations?: "allow" | "disabled";
}>;

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: process.cwd(),
  encoding: "utf8",
}).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${sourceCommit.slice(0, 12)}`;
const runRoot = path.resolve("tests/e2e/visual-candidates/.runs", setId);
const dirtyLedgerPath = path.resolve(".planning/phases/PORTIA-15-baseline/evidence/15-DIRTY-OWNERSHIP.md");
const dirtyLedgerId = `sha256:${createHash("sha256").update(readFileSync(dirtyLedgerPath)).digest("hex")}`;
const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
  devDependencies: Record<string, string>;
};

function assertCandidateDestination(candidatePath: string) {
  const normalized = candidatePath.replaceAll("\\", "/").toLowerCase();
  if (!normalized.includes("/visual-candidates/.runs/")) throw new Error("[PORTIA_CANDIDATE_DESTINATION_REQUIRED]");
  if (normalized.includes("__screenshots__") || normalized.includes("/approved/")) {
    throw new Error("[PORTIA_APPROVED_DESTINATION_REFUSED]");
  }
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

async function browserEnvironment(context: CandidateContext) {
  const viewport = context.page.viewportSize();
  const runtime = await context.page.evaluate(() => ({
    dpr: window.devicePixelRatio,
    locale: navigator.language,
    settings: JSON.parse(window.localStorage.getItem("portia-desktop-settings-v1") ?? "{}") as unknown,
    motion: document.documentElement.dataset.motion ?? "unset",
    spider: document.documentElement.dataset.spider ?? "unset",
  }));
  return {
    sourceCommit,
    dirtyLedgerId,
    fixtureRevision: context.determinism.revision,
    seed: context.determinism.seed,
    fixedTime: context.determinism.now,
    tool: `@playwright/test@${packageJson.devDependencies["@playwright/test"]}`,
    browser: `${context.browser.browserType().name()}@${context.browser.version()}`,
    project: context.testInfo.project.name,
    os: `${process.platform}-${release()}`,
    viewport,
    dpr: runtime.dpr,
    locale: runtime.locale,
    timezone: "Europe/Moscow",
    colorScheme: "dark",
    settings: runtime.settings,
    resolvedMotion: runtime.motion,
    resolvedSpider: runtime.spider,
  };
}

export async function waitForCandidateReadiness(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const localImages = [...document.images].filter((image) => {
      try {
        return new URL(image.currentSrc || image.src, location.href).origin === location.origin;
      } catch {
        return false;
      }
    });
    await Promise.all(localImages.map((image) => image.decode().catch(() => undefined)));
  });
}

export async function captureCandidate(context: CandidateContext, spec: CandidateSpec) {
  await waitForCandidateReadiness(context.page);
  mkdirSync(runRoot, { recursive: true });
  const stem = `${safeId(spec.id)}--${safeId(context.testInfo.project.name)}`;
  const pngPath = path.join(runRoot, `${stem}.png`);
  assertCandidateDestination(pngPath);
  await context.page.screenshot({
    path: pngPath,
    animations: spec.animations ?? "disabled",
    caret: "hide",
    mask: spec.mask,
  });
  const sha256 = createHash("sha256").update(readFileSync(pngPath)).digest("hex");
  const row = {
    schema: "portia-phase15-visual-candidate-v1",
    setId,
    status: "CAPTURED",
    requirement: spec.requirement,
    surface: spec.surface,
    actor: spec.actor,
    state: spec.state,
    candidateFile: path.relative(process.cwd(), pngPath).replaceAll("\\", "/"),
    intendedSnapshot: spec.intendedSnapshot,
    sha256,
    ...(await browserEnvironment(context)),
  };
  writeFileSync(path.join(runRoot, `${stem}.candidate.json`), `${JSON.stringify(row, null, 2)}\n`);
  return row;
}

export async function recordBlockedCandidate(
  context: CandidateContext,
  spec: Omit<CandidateSpec, "mask" | "animations">,
  reason: string,
) {
  mkdirSync(runRoot, { recursive: true });
  const stem = `${safeId(spec.id)}--${safeId(context.testInfo.project.name)}`;
  const row = {
    schema: "portia-phase15-visual-candidate-v1",
    setId,
    status: "BLOCKED",
    requirement: spec.requirement,
    surface: spec.surface,
    actor: spec.actor,
    state: spec.state,
    intendedSnapshot: spec.intendedSnapshot,
    reason,
    ...(await browserEnvironment(context)),
  };
  writeFileSync(path.join(runRoot, `${stem}.blocked.json`), `${JSON.stringify(row, null, 2)}\n`);
  return row;
}
