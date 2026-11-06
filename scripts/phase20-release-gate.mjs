import * as nodeFs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Phase 20 release gate runner (20-30, prepares 20-13). Fail-closed: a gate is PASS only with proof.
//   --plan                              prints the gate catalogue, runs nothing;
//   --self-check                        clean worktree of HEAD -> node-version + tree-clean -> receipt -> evidence table -> worktree removed;
//   --run --commit <sha> [--only a,b]   runs the gates in a clean temporary git worktree of that commit;
//   --verify-evidence [--evidence <p>]  fail-closed check of 20-RELEASE-EVIDENCE.md (written by 20-13 Task 2).
// Statuses: PASS | FAIL | BLOCKED | SKIPPED. Flaky, a retry, a skip and BLOCKED are never PASS.
// No environment file is read. Only variable NAMES of a fixed list and their presence reach the report, never values.
// Nothing here runs git clean, git reset --hard or git stash; only the worktree this run created is removed.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const PHASE_DIR = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza";
export const EVIDENCE_MD = `${PHASE_DIR}/20-RELEASE-EVIDENCE.md`;
export const WAIVERS_MD = `${PHASE_DIR}/20-PLAYWRIGHT-WAIVERS.md`;
export const MATRIX_MD = `${PHASE_DIR}/20-SECURITY-MATRIX.md`;
export const RELEASE_DIR = "test-results/release-gate";
export const WORKTREE_PREFIX = "portia-release-";
export const SCHEMA = "phase20-release-gate/1";
export const STATUSES = Object.freeze(["PASS", "FAIL", "BLOCKED", "SKIPPED"]);
export const VERDICTS = Object.freeze(["PASS", "PASS-WITH-OWNER-WAIVERS", "FAIL", "BLOCKED"]);
const VERDICT_RANK = { FAIL: 0, BLOCKED: 1, "PASS-WITH-OWNER-WAIVERS": 2, PASS: 3 };
const PLAYWRIGHT_RESULTS = "test-results/playwright/results.json";

export class GateError extends Error {
  constructor(code, detail = "") {
    super(`[PORTIA_RELEASE_GATE:${code}]${detail ? ` ${detail}` : ""}`);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Environment: fixed list of names, presence only.

export const MUTATION_ENV = Object.freeze([
  "PORTIA_E2E_MUTATION_CONFIRM",
  "PORTIA_E2E_TARGET_ENVIRONMENT",
  "PORTIA_E2E_TARGET_ID",
  "PORTIA_E2E_SUPABASE_URL",
  "PORTIA_E2E_PRODUCTION_PROJECT_IDS",
  "PORTIA_E2E_ISOLATED_PROJECT_IDS",
]);
// Each inner list is one requirement: any one of the names satisfies it (publishable key falls back to the legacy anon key).
const PUBLIC_ENV = Object.freeze([
  ["NEXT_PUBLIC_SUPABASE_URL"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["PORTIA_PROMOTION_DEVICE_SECRET"],
]);
export const ENV_NAMES = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PORTIA_PROMOTION_DEVICE_SECRET",
  "PORTIA_E2E_BASE_URL",
  ...MUTATION_ENV,
]);

/** Names and a presence flag. The value never leaves this function. */
export function envPresence(names, env) {
  return names.map((name) => ({ name, present: typeof env?.[name] === "string" && env[name].trim() !== "" }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Gate catalogue (mirrors 20-13). Commands are Windows-first (`npm.cmd`); `exec` maps npm.cmd to npm elsewhere.

const PLAYWRIGHT_FLAGS = ["--retries=0", "--fail-on-flaky-tests", "--trace=retain-on-first-failure"];
const playwrightStep = (script, extra, outputName) => ({ file: "npm.cmd", args: ["run", script, "--", ...PLAYWRIGHT_FLAGS, ...extra], playwright: true, outputName });
const npmStep = (...args) => ({ file: "npm.cmd", args });
const nodeStep = (...args) => ({ file: "node", args });

function displayStep(gateId, step, index) {
  const parts = [step.file, ...step.args];
  if (step.playwright) parts.push("--output", `<артефакты>/${step.outputName ?? `${gateId}-${index + 1}`}`);
  return parts.join(" ");
}

function defineGate(definition) {
  const command = definition.steps.map((step, index) => displayStep(definition.id, step, index)).join(" ; ");
  return Object.freeze({ requires: {}, ...definition, command });
}

const NEEDS_INSTALL = ["npm-ci"];

export const GATES = Object.freeze([
  defineGate({ id: "node-version", title: "Node 22.13.x", kind: "command", steps: [nodeStep("--version")], check: "node-version" }),
  defineGate({ id: "tree-clean", title: "Чистый worktree записанного commit", kind: "command", steps: [{ file: "git", args: ["status", "--porcelain"] }], check: "tree-clean" }),
  defineGate({ id: "npm-ci", title: "npm ci по committed lockfile", kind: "command", steps: [npmStep("ci")], network: true }),
  defineGate({ id: "unit", title: "Unit tests", kind: "command", steps: [npmStep("test")], counts: "node-test", requires: { gates: NEEDS_INSTALL } }),
  defineGate({ id: "typecheck", title: "TypeScript", kind: "command", steps: [npmStep("exec", "tsc", "--", "--noEmit")], requires: { gates: NEEDS_INSTALL } }),
  defineGate({ id: "build", title: "Production build", kind: "command", steps: [npmStep("run", "build")], envMarkers: true, requires: { gates: NEEDS_INSTALL } }),
  defineGate({ id: "lint", title: "Full lint в clean checkout", kind: "command", steps: [npmStep("run", "lint")], requires: { gates: NEEDS_INSTALL } }),
  defineGate({ id: "audit-prod", title: "Production dependency audit", kind: "command", steps: [npmStep("audit", "--omit=dev")], check: "audit-prod", network: true }),
  defineGate({ id: "audit-evidence", title: "Evidence аудита зависимостей (20-10)", kind: "command", steps: [nodeStep("scripts/phase20-audit-check.mjs", "--verify")] }),
  defineGate({
    id: "visual-manifest",
    title: "Visual manifest: тест и --verify-promotion (не --verify)",
    kind: "command",
    steps: [
      { ...nodeStep("--experimental-strip-types", "--test", "lib/phase15-visual-manifest.test.ts"), nodeTest: true },
      nodeStep("scripts/phase15-visual-manifest.mjs", "--verify-promotion"),
    ],
    counts: "node-test",
    requires: { gates: NEEDS_INSTALL },
  }),
  defineGate({
    id: "e2e-full",
    title: "Playwright, retries=0, без @phase20",
    kind: "playwright",
    steps: [playwrightStep("test:e2e", ["--grep-invert", "@phase20"], "e2e")],
    counts: "playwright",
    strictSkips: true,
    envMarkers: true,
    requires: { gates: NEEDS_INSTALL, env: PUBLIC_ENV },
  }),
  defineGate({
    id: "visual-approved",
    title: "Прежние одобренные эталоны (без @phase20)",
    kind: "playwright",
    steps: [
      playwrightStep("test:e2e:visual", ["--grep-invert", "@phase20"]),
      playwrightStep("test:e2e", ["--project=chromium-phone", "--project=webkit-phone", "--project=firefox-desktop", "tests/e2e/visual", "--grep-invert", "@phase20"]),
    ],
    counts: "playwright",
    strictSkips: true,
    envMarkers: true,
    requires: { gates: NEEDS_INSTALL, env: PUBLIC_ENV },
  }),
  defineGate({
    id: "visual-phase20",
    title: "@phase20 эталоны (20-12)",
    kind: "playwright",
    steps: [playwrightStep("test:e2e", ["--project=chromium-desktop", "--project=chromium-phone", "tests/e2e/visual/phase20.spec.ts"])],
    counts: "playwright",
    strictSkips: true,
    envMarkers: true,
    requires: {
      gates: NEEDS_INSTALL,
      env: PUBLIC_ENV,
      files: [{ path: "tests/e2e/visual/phase20.spec.ts", kind: "OWNER", reason: "нет одобренных эталонов 20-12" }],
    },
  }),
  defineGate({
    id: "mutation-attest",
    title: "Аттестация изолированного staging (preflight:mutation)",
    kind: "command",
    steps: [npmStep("run", "test:e2e:preflight:mutation")],
    requires: { gates: NEEDS_INSTALL, env: MUTATION_ENV.map((name) => [name]) },
  }),
  defineGate({
    id: "e2e-mutation",
    title: "Mutation lane и редактор D-40..D-42, D-47",
    kind: "playwright",
    steps: [
      playwrightStep("test:e2e:mutation", [], "e2e-mutation"),
      playwrightStep("test:e2e:mutation", ["tests/e2e/specs/editor-layout.spec.ts"]),
    ],
    counts: "playwright",
    strictSkips: true,
    envMarkers: true,
    requires: { gates: ["mutation-attest"], env: [...PUBLIC_ENV, ...MUTATION_ENV.map((name) => [name])] },
  }),
  defineGate({
    id: "staging-live",
    title: "Live-тесты isolated staging",
    kind: "command",
    steps: [npmStep("run", "test:staging-live")],
    counts: "node-test",
    strictSkips: true,
    requires: { gates: ["mutation-attest"] },
  }),
]);

const GATE_BY_ID = new Map(GATES.map((gate) => [gate.id, gate]));

// ---------------------------------------------------------------------------------------------------------------------
// Markdown helpers.

const normalizeText = (text) => String(text ?? "").replace(/\r\n/g, "\n");
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const stripTicks = (text) => String(text ?? "").replace(/`/g, "").trim();
const tableCell = (text) => String(text ?? "").replace(/\|/g, "¦").replace(/\n/g, " ");

/** The table under the first `## <prefix>…` heading: header cells and body rows, or null when the section is absent. */
export function sectionTable(markdown, prefix) {
  const lines = normalizeText(markdown).split("\n");
  const start = lines.findIndex((line) => /^##\s/.test(line) && line.replace(/^##\s+/, "").trim().startsWith(prefix));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const block = (end === -1 ? rest : rest.slice(0, end)).filter((line) => line.trimStart().startsWith("|"));
  if (block.length === 0) return { header: [], rows: [] };
  return { header: cells(block[0]), rows: block.slice(2).map(cells) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Waivers (20-PLAYWRIGHT-WAIVERS.md).

/** Rows of the registry: id, test cell, project cell, class, owner verdict, date, accepted. */
export function readWaivers(markdown) {
  const table = sectionTable(markdown, "Реестр");
  if (!table) return [];
  const column = (name) => table.header.findIndex((cell) => cell.toLowerCase().startsWith(name.toLowerCase()));
  const index = { id: column("ID"), test: column("Спек и тест"), project: column("Проект"), klass: column("Класс"), verdict: column("Вердикт владельца"), date: column("Дата") };
  if (Object.values(index).some((position) => position === -1)) return [];
  return table.rows
    .filter((row) => /^PW-\d+$/.test(stripTicks(row[index.id] ?? "")))
    .map((row) => {
      const klass = stripTicks(row[index.klass]).toLowerCase();
      const verdict = row[index.verdict] ?? "";
      const date = row[index.date] ?? "";
      const accepted = klass === "waiver"
        && /принято/i.test(verdict)
        && !/не\s+принято/i.test(verdict)
        && /\d{4}-\d{2}-\d{2}/.test(`${verdict} ${date}`);
      return { id: stripTicks(row[index.id]), test: row[index.test] ?? "", project: row[index.project] ?? "", klass, verdict, date, accepted };
    });
}

/** Titles quoted as «…» in a registry cell (several are separated by commas; a trailing ellipsis marks a shortened title). */
function waiverTitles(cell) {
  const start = cell.indexOf("«");
  const end = cell.lastIndexOf("»");
  if (start === -1 || end <= start) return [];
  return cell
    .slice(start + 1, end)
    .split(/»\s*,\s*«/)
    .map((title) => title.replace(/…$/, "").trim().toLowerCase())
    .filter(Boolean);
}

function waiverMatches(waiver, test) {
  const title = String(test.title ?? "").toLowerCase();
  const file = path.basename(String(test.file ?? "")).toLowerCase();
  if (!file || !waiver.test.toLowerCase().includes(file)) return false;
  if (!waiverTitles(waiver.test).some((candidate) => title.startsWith(candidate))) return false;
  const project = waiver.project.trim();
  return project === "" || project === "-" || project.toLowerCase().includes(String(test.project ?? "").toLowerCase());
}

// ---------------------------------------------------------------------------------------------------------------------
// Playwright JSON report -> gate classification.

const BLOCKED_ANNOTATION = /^\s*BLOCKED\b/;
const BLOCKED_KIND = /^\s*BLOCKED\s*\(([A-Z][A-Z/ ]*)\)/;

function* walkSpecs(suites, inheritedFile = "") {
  for (const suite of suites ?? []) {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) yield { spec, file: spec.file ?? file };
    yield* walkSpecs(suite.suites, file);
  }
}

/**
 * Classifies a Playwright JSON report. Flaky and any retry are FAIL, `unexpected` is FAIL, a skip annotated BLOCKED is BLOCKED,
 * any other skip is SKIPPED, an empty report is FAIL. A failing test is "waived" only by a registry row of class `waiver`
 * that carries the owner's «принято» and a date; fixed and expected-fault rows never excuse a failure.
 * @returns {any}
 */
export function classifyPlaywright(report, waivers = []) {
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0, blocked: 0 };
  const failures = [];
  const blockedKinds = new Set();
  if (!report || typeof report !== "object") return { status: "FAIL", counts, failures, blockedKinds: [], waived: false, reasons: ["Playwright report is missing or not an object"] };
  const reasons = [];
  if (Array.isArray(report.errors) && report.errors.length > 0) reasons.push(`report has ${report.errors.length} global error(s)`);

  for (const { spec, file } of walkSpecs(report.suites)) {
    for (const test of spec.tests ?? []) {
      const project = test.projectName ?? "";
      const id = `${file}${spec.line ? `:${spec.line}` : ""} [${project}] ${spec.title}`;
      const results = Array.isArray(test.results) ? test.results : [];
      const retried = results.some((result) => Number(result?.retry ?? 0) > 0);
      const info = { id, title: spec.title, file, project };
      if (test.status === "flaky" || retried) {
        counts.flaky += 1;
        failures.push({ ...info, kind: "flaky" });
      } else if (test.status === "unexpected") {
        counts.failed += 1;
        failures.push({ ...info, kind: "unexpected" });
      } else if (test.status === "skipped") {
        const blocking = (test.annotations ?? []).map((annotation) => String(annotation?.description ?? "")).filter((text) => BLOCKED_ANNOTATION.test(text));
        counts.skipped += 1;
        if (blocking.length > 0) {
          counts.blocked += 1;
          for (const text of blocking) blockedKinds.add(text.match(BLOCKED_KIND)?.[1]?.trim() ?? "");
        }
      } else if (test.status === "expected") {
        counts.passed += 1;
      } else {
        counts.failed += 1;
        failures.push({ ...info, kind: `unknown-status:${String(test.status)}` });
      }
    }
  }

  const registry = Array.isArray(waivers) ? waivers : [];
  for (const failure of failures) {
    const waiver = registry.find((row) => row.klass === "waiver" && waiverMatches(row, failure));
    failure.waiver = waiver ? waiver.id : null;
    failure.waived = Boolean(waiver?.accepted);
  }
  const stats = report.stats ?? {};
  if (Number(stats.unexpected ?? 0) > 0 && counts.failed === 0) reasons.push(`stats report ${stats.unexpected} unexpected test(s) that the suites do not show`);
  if (Number(stats.flaky ?? 0) > 0 && counts.flaky === 0) reasons.push(`stats report ${stats.flaky} flaky test(s) that the suites do not show`);
  const total = counts.passed + counts.failed + counts.flaky + counts.skipped;
  if (total === 0) reasons.push("empty report: no test ran");

  const kinds = [...blockedKinds].filter(Boolean).sort();
  let status = "PASS";
  if (counts.failed + counts.flaky > 0 || reasons.length > 0) status = "FAIL";
  else if (counts.blocked > 0) status = "BLOCKED";
  else if (counts.skipped > 0) status = "SKIPPED";
  const waived = status === "FAIL" && reasons.length === 0 && failures.length > 0 && failures.every((failure) => failure.waived);
  return { status, counts, failures, blockedKinds: kinds, waived, first: failures[0]?.id ?? null, reasons };
}

// ---------------------------------------------------------------------------------------------------------------------
// Aggregate.

/**
 * PASS only if every gate PASS. Any FAIL -> FAIL; SKIPPED is not evidence -> FAIL; otherwise BLOCKED. A waived FAIL (owner accepted)
 * gives PASS-WITH-OWNER-WAIVERS. With `options.playwright` and `options.waivers` the registry itself is judged: a waiver row without
 * the owner's «принято» and date is FAIL even when no test failed in this run.
 * @returns {{ verdict: string, reasons: string[] }}
 */
export function aggregate(results, options = {}) {
  const reasons = [];
  if (!Array.isArray(results) || results.length === 0) return { verdict: "FAIL", reasons: ["no gate results"] };
  const byId = new Map(results.map((result) => [result.id, result]));
  const required = options.required ?? results.map((result) => result.id);
  let failed = false;
  let blocked = false;
  let waivedFails = 0;
  for (const id of required) {
    const result = byId.get(id);
    if (!result) { failed = true; reasons.push(`${id}: no result recorded`); continue; }
    if (!STATUSES.includes(result.status)) { failed = true; reasons.push(`${id}: unknown status "${result.status}"`); continue; }
    if (result.status === "FAIL") {
      if (result.waived) { waivedFails += 1; reasons.push(`${id}: FAIL waived by the owner`); } else { failed = true; reasons.push(`${id}: FAIL${result.reason ? ` - ${result.reason}` : ""}`); }
    } else if (result.status === "SKIPPED") {
      failed = true;
      reasons.push(`${id}: SKIPPED is not evidence`);
    } else if (result.status === "BLOCKED") {
      blocked = true;
      reasons.push(`${id}: BLOCKED${result.blockedKind ? ` (${result.blockedKind})` : ""}${result.reason ? ` - ${result.reason}` : ""}`);
    }
  }
  let acceptedWaivers = 0;
  if (options.playwright) {
    if (!Array.isArray(options.waivers)) {
      failed = true;
      reasons.push("waiver registry is missing: the Playwright gates cannot be judged");
    } else {
      for (const waiver of options.waivers.filter((row) => row.klass === "waiver")) {
        if (waiver.accepted) { acceptedWaivers += 1; reasons.push(`${waiver.id}: owner waiver accepted`); } else { failed = true; reasons.push(`${waiver.id}: waiver has no owner verdict («принято» and a date)`); }
      }
    }
  }
  if (failed) return { verdict: "FAIL", reasons };
  if (blocked) return { verdict: "BLOCKED", reasons };
  if (waivedFails > 0 || acceptedWaivers > 0) return { verdict: "PASS-WITH-OWNER-WAIVERS", reasons };
  return { verdict: "PASS", reasons };
}

// ---------------------------------------------------------------------------------------------------------------------
// Temporary worktree.

const samePath = (left, right) => {
  const normalize = (value) => path.resolve(value).replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? normalize(left).toLowerCase() === normalize(right).toLowerCase() : normalize(left) === normalize(right);
};

/** True only for a direct child of the temp directory whose name starts with the release prefix. */
export function isReleaseWorktreePath(candidate, tmpdir) {
  if (typeof candidate !== "string" || candidate === "") return false;
  const resolved = path.resolve(candidate);
  return path.basename(resolved).startsWith(WORKTREE_PREFIX) && samePath(path.dirname(resolved), tmpdir);
}

/** `git worktree add --detach <tmp>/portia-release-<commit12>-<stamp> <sha>`. A non-zero git exit throws. */
export function createWorktree(commit, deps) {
  const resolved = deps.git(["rev-parse", "--verify", `${commit}^{commit}`]);
  const sha = String(resolved.stdout ?? "").trim();
  if (resolved.status !== 0 || !/^[0-9a-f]{40}$/.test(sha)) throw new GateError("commit-unresolved", `${commit}: ${String(resolved.stderr ?? "").trim()}`);
  const stamp = deps.stamp();
  const target = path.join(deps.tmpdir, `${WORKTREE_PREFIX}${sha.slice(0, 12)}-${stamp}`);
  const added = deps.git(["worktree", "add", "--detach", target, sha]);
  if (added.status !== 0) throw new GateError("worktree-add-failed", String(added.stderr ?? "").trim());
  return { path: target, commit: sha, stamp };
}

/** Removes only a worktree this runner could have created (direct child of the temp dir, `portia-release-` prefix). */
export function removeWorktree(target, deps) {
  if (!isReleaseWorktreePath(target, deps.tmpdir)) throw new GateError("worktree-remove-refused", `${String(target)} is not a ${WORKTREE_PREFIX}* directory directly inside the temp directory`);
  const removed = deps.git(["worktree", "remove", "--force", target]);
  if (removed.status !== 0) throw new GateError("worktree-remove-failed", String(removed.stderr ?? "").trim());
  const listing = deps.git(["worktree", "list", "--porcelain"]);
  if (listing.status !== 0) throw new GateError("worktree-list-failed", String(listing.stderr ?? "").trim());
  if (String(listing.stdout ?? "").includes(path.basename(target))) throw new GateError("worktree-still-listed", path.basename(target));
  if (deps.fs.existsSync(target)) throw new GateError("worktree-dir-remains", path.basename(target));
}

// ---------------------------------------------------------------------------------------------------------------------
// Running one gate.

const PRIORITY = { FAIL: 3, BLOCKED: 2, SKIPPED: 1, PASS: 0 };
const NETWORK_FAILURE = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EPERM.*fetch|network (?:error|request)|getaddrinfo|audit endpoint returned an error/i;
const ENV_FAILURE = /Supabase environment variables are not configured|\[PORTIA_E2E_PREFLIGHT:(?:missing-environment|public-url-shape|public-key-shape)\]/;

/** `# pass 12` (TAP) or `ℹ pass 12` (spec reporter). */
export function parseNodeTest(output) {
  const read = (name) => {
    const match = String(output ?? "").match(new RegExp(`^(?:#|ℹ)\\s*${name}\\s+(\\d+)\\s*$`, "mi"));
    return match ? Number(match[1]) : null;
  };
  const passed = read("pass");
  if (passed === null) return null;
  return { passed, failed: (read("fail") ?? 0) + (read("cancelled") ?? 0), skipped: read("skipped") ?? 0, flaky: 0, blocked: 0 };
}

const clip = (text, length = 300) => {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}...` : flat;
};

function evaluateStep(gate, step, run, context) {
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const code = run.status;
  const base = { status: "PASS", reason: "", detail: "", counts: null, blockedKind: "", waived: false, waivedBy: [], first: null };
  if (run.error) return { ...base, status: "FAIL", reason: `could not run: ${clip(run.error.message ?? run.error)}` };
  if (code !== 0) {
    if (gate.envMarkers && ENV_FAILURE.test(output)) return { ...base, status: "BLOCKED", blockedKind: "ENV", reason: "required environment variables are missing" };
    if (gate.network && NETWORK_FAILURE.test(output)) return { ...base, status: "BLOCKED", blockedKind: "ENV", reason: "network unavailable" };
  }
  if (step.playwright) {
    const resultsFile = path.join(context.worktree, PLAYWRIGHT_RESULTS);
    let report = null;
    let problem = "";
    if (!context.deps.fs.existsSync(resultsFile)) problem = "Playwright wrote no results.json";
    else {
      try {
        const text = context.deps.fs.readFileSync(resultsFile, "utf8");
        context.deps.fs.writeFileSync(path.join(context.artifactsDir, `${gate.id}-${context.stepNumber}-results.json`), text);
        report = JSON.parse(text);
      } catch { problem = "Playwright results.json is not valid JSON"; }
    }
    if (!report) return { ...base, status: "FAIL", reason: problem };
    const classified = classifyPlaywright(report, context.waivers ?? []);
    let status = classified.status;
    let reason = classified.reasons.join("; ");
    if (status === "FAIL" && !reason) reason = `${classified.counts.failed} failed, ${classified.counts.flaky} flaky/retried; first: ${classified.first}`;
    if (status === "BLOCKED") reason = `${classified.counts.blocked} test(s) skipped as BLOCKED`;
    if (status === "SKIPPED") reason = `${classified.counts.skipped} test(s) skipped without BLOCKED`;
    let waived = classified.waived;
    if (code !== 0 && status === "PASS") { status = "FAIL"; reason = `exit code ${code} although the report shows no failure`; waived = false; }
    else if (code !== 0 && status !== "FAIL") { status = "FAIL"; reason = `exit code ${code}; ${reason}`; waived = false; }
    return {
      ...base,
      status,
      reason,
      counts: classified.counts,
      blockedKind: status === "BLOCKED" ? classified.blockedKinds.join("/") : "",
      waived,
      waivedBy: waived ? [...new Set(classified.failures.map((failure) => failure.waiver))] : [],
      first: classified.first,
    };
  }
  if (code !== 0) return { ...base, status: "FAIL", reason: `exit code ${code}: ${clip(output.trim().split("\n").slice(-3).join(" "))}` };
  if (gate.check === "node-version") {
    const version = String(run.stdout ?? "").trim();
    return /^v22\.13\.\d+$/.test(version) ? { ...base, detail: version } : { ...base, status: "FAIL", detail: version, reason: `node ${version || "unknown"} (expected 22.13.x)` };
  }
  if (gate.check === "tree-clean") {
    const dirty = String(run.stdout ?? "").trim();
    return dirty === "" ? base : { ...base, status: "FAIL", reason: `worktree is not clean: ${clip(dirty.split("\n").slice(0, 5).join("; "))}` };
  }
  if (gate.check === "audit-prod") {
    return /found 0 vulnerabilities/.test(output) ? base : { ...base, status: "FAIL", reason: "exit 0 but no `found 0 vulnerabilities` line" };
  }
  if (gate.counts === "node-test" && (step.nodeTest || !gate.steps.some((other) => other.nodeTest))) {
    const counts = parseNodeTest(output);
    if (!counts) return { ...base, status: "FAIL", reason: "test summary (# pass / # fail) not found in the output" };
    if (counts.failed > 0) return { ...base, status: "FAIL", counts, reason: `${counts.failed} failed or cancelled` };
    if (counts.passed === 0) return { ...base, status: "FAIL", counts, reason: "# pass 0" };
    if (gate.strictSkips && counts.skipped > 0) return { ...base, status: "SKIPPED", counts, reason: `${counts.skipped} skipped: a skipped live test is not a pass` };
    return { ...base, counts };
  }
  return base;
}

/**
 * Runs one gate inside the worktree. Preconditions first (missing file, env name, dependency gate -> BLOCKED), then every step.
 * @returns {any}
 */
export function runGate(gate, context) {
  const { deps, worktree, artifactsDir, results } = context;
  const result = { id: gate.id, title: gate.title, command: gate.command, status: "PASS", blockedKind: "", exitCode: null, reason: "", counts: null, artifacts: [], waived: false, waivedBy: [], first: null, detail: "" };
  const blocked = (kind, reason) => ({ ...result, status: "BLOCKED", blockedKind: kind, reason });

  for (const file of gate.requires.files ?? []) {
    if (!deps.fs.existsSync(path.join(worktree, file.path))) return blocked(file.kind, `${file.reason} (${file.path} is absent in the checked commit)`);
  }
  const missingEnv = (gate.requires.env ?? []).filter((alternatives) => !envPresence(alternatives, deps.env).some((entry) => entry.present));
  if (missingEnv.length > 0) return blocked("ENV", `missing environment variable(s): ${missingEnv.map((alternatives) => alternatives.join(" or ")).join(", ")}`);
  for (const id of gate.requires.gates ?? []) {
    const dependency = results.find((entry) => entry.id === id);
    const kind = id === "mutation-attest" ? "ENV" : "DEP";
    if (!dependency) return blocked(kind, `${id} was not run in this invocation`);
    if (dependency.status !== "PASS") return blocked(kind, `${id} is ${dependency.status}`);
  }

  const evaluated = [];
  gate.steps.forEach((step, index) => {
    const stepNumber = index + 1;
    const args = step.playwright ? [...step.args, "--output", path.join(artifactsDir, step.outputName ?? `${gate.id}-${stepNumber}`)] : step.args;
    if (step.playwright) deps.fs.rmSync(path.join(worktree, PLAYWRIGHT_RESULTS), { force: true });
    const run = deps.exec(step.file, args, { cwd: worktree, env: deps.env, timeoutMs: step.playwright ? 90 * 60_000 : 30 * 60_000 });
    const logName = `${gate.id}-${stepNumber}.log`;
    deps.fs.writeFileSync(path.join(artifactsDir, logName), `$ ${displayStep(gate.id, step, index)}\n# exit ${run.status}\n${run.stdout ?? ""}\n${run.stderr ?? ""}\n`);
    result.artifacts.push(logName);
    if (step.playwright) {
      result.artifacts.push(`${gate.id}-${stepNumber}-results.json`);
      result.artifacts.push(`${step.outputName ?? `${gate.id}-${stepNumber}`}/`);
    }
    const verdict = evaluateStep(gate, step, run, { ...context, stepNumber });
    evaluated.push({ ...verdict, exit: run.status });
  });

  let worst = evaluated[0];
  for (const step of evaluated) if (PRIORITY[step.status] > PRIORITY[worst.status]) worst = step;
  result.status = worst.status;
  result.reason = worst.reason;
  result.first = evaluated.find((step) => step.first)?.first ?? null;
  result.detail = evaluated.find((step) => step.detail)?.detail ?? "";
  result.exitCode = evaluated.find((step) => step.exit !== 0)?.exit ?? evaluated[evaluated.length - 1].exit;
  result.blockedKind = worst.status === "BLOCKED" ? worst.blockedKind : "";
  const withCounts = evaluated.filter((step) => step.counts);
  if (withCounts.length > 0) {
    result.counts = withCounts.reduce((sum, step) => ({ passed: sum.passed + step.counts.passed, failed: sum.failed + step.counts.failed, flaky: sum.flaky + step.counts.flaky, skipped: sum.skipped + step.counts.skipped, blocked: sum.blocked + step.counts.blocked }), { passed: 0, failed: 0, flaky: 0, skipped: 0, blocked: 0 });
  }
  const failing = evaluated.filter((step) => step.status === "FAIL");
  result.waived = failing.length > 0 && failing.every((step) => step.waived);
  result.waivedBy = [...new Set(failing.flatMap((step) => step.waivedBy))];
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Evidence: rendering and verification.

export function renderStatus(result) {
  if (result.status === "FAIL" && result.waived) return `FAIL (waived${result.waivedBy?.length ? `: ${result.waivedBy.join(", ")}` : ""})`;
  if (result.status === "BLOCKED") return `BLOCKED${result.blockedKind ? ` (${result.blockedKind})` : ""}`;
  return result.status;
}

const renderCounts = (counts) => (counts ? `${counts.passed}/${counts.failed}/${counts.skipped}/${counts.flaky}` : "-");

/**
 * Markdown for a run: header, gate table, environment names, verdict. `run.d33` / `run.decisions` (rows of the 20-13 protocol)
 * are rendered only when given. Environment VALUES never appear: `run.env` carries names and a presence flag.
 */
export function renderEvidence(run) {
  const lines = [
    "# 20-RELEASE-EVIDENCE: прогон релизного гейта",
    "",
    `Commit: \`${run.commit}\``,
    `Node: ${run.node}`,
    `Режим: ${run.partial ? `partial (${(run.only ?? []).join(", ")})` : "full"}`,
    `Начало: ${run.startedAt}`,
    `Каталог артефактов: \`${run.artifactsDir}\``,
    "",
    "## Гейты",
    "",
    "| Gate | Команда | Exit | Статус | Passed/Failed/Skipped/Flaky | Артефакты |",
    "|---|---|---|---|---|---|",
  ];
  for (const result of run.results) {
    lines.push(`| ${result.id} | \`${tableCell(result.command)}\` | ${result.exitCode ?? "-"} | ${tableCell(renderStatus(result))} | ${renderCounts(result.counts)} | ${tableCell((result.artifacts ?? []).join(", ") || "-")} |`);
  }
  const notes = run.results.filter((result) => result.reason);
  if (notes.length > 0) {
    lines.push("", "Причины:", "");
    for (const result of notes) lines.push(`- ${result.id}: ${tableCell(result.reason)}`);
  }
  if (Array.isArray(run.d33)) {
    lines.push("", "## Перенесённые находки 19-REVIEW (D-33)", "", "| ID | Статус | Коммит | Тест | Примечание |", "|---|---|---|---|---|");
    for (const row of run.d33) lines.push(`| ${tableCell(row.id)} | ${tableCell(row.status)} | ${tableCell(row.commit ?? "-")} | ${tableCell(row.test ?? "-")} | ${tableCell(row.note ?? "-")} |`);
  }
  if (Array.isArray(run.decisions)) {
    lines.push("", "## Решения D-35..D-45", "", "| Решение | Статус | Доказательство |", "|---|---|---|");
    for (const row of run.decisions) lines.push(`| ${tableCell(row.id)} | ${tableCell(row.status)} | ${tableCell(row.evidence ?? "-")} |`);
  }
  lines.push("", "## Окружение (только имена)", "", "| Переменная | Задана |", "|---|---|");
  for (const entry of run.env ?? []) lines.push(`| ${entry.name} | ${entry.present ? "да" : "нет"} |`);
  lines.push("", "## Итог", "", `Итог: ${run.verdict}`, "");
  for (const reason of run.reasons ?? []) lines.push(`- ${tableCell(reason)}`);
  return `${lines.join("\n")}\n`;
}

const statusToken = (cell) => String(cell ?? "").trim().match(/^(PASS|FAIL|BLOCKED|SKIPPED)\b/)?.[1] ?? null;

function parseCounts(cell) {
  const match = String(cell ?? "").trim().match(/^(\d+)\/(\d+)\/(\d+)\/(\d+)$/);
  return match ? { passed: Number(match[1]), failed: Number(match[2]), skipped: Number(match[3]), flaky: Number(match[4]) } : null;
}

/** Rows of the `## Гейты` table as results; `errors` lists every violation. */
function readGateRows(markdown, requireAll) {
  const errors = [];
  const table = sectionTable(markdown, "Гейты");
  if (!table) return { errors: ["gate table (section «Гейты») is missing"], rows: [] };
  const rows = [];
  const seen = new Set();
  for (const cellsOfRow of table.rows) {
    const id = stripTicks(cellsOfRow[0] ?? "");
    const gate = GATE_BY_ID.get(id);
    if (!gate) { errors.push(`${id || "(empty)"}: unknown gate id`); continue; }
    if (seen.has(id)) { errors.push(`${id}: gate row appears more than once`); continue; }
    seen.add(id);
    const exit = String(cellsOfRow[2] ?? "").trim();
    const status = statusToken(cellsOfRow[3]);
    const counts = parseCounts(cellsOfRow[4]);
    if (!status) { errors.push(`${id}: unknown status "${cellsOfRow[3] ?? ""}"`); continue; }
    const waived = status === "FAIL" && /waived/i.test(cellsOfRow[3] ?? "");
    if (status === "PASS") {
      if (exit !== "0") errors.push(`${id}: PASS row has exit "${exit}", expected 0`);
      if (gate.counts) {
        if (!counts) errors.push(`${id}: PASS row has no Passed/Failed/Skipped/Flaky counts`);
        else {
          if (counts.passed === 0) errors.push(`${id}: PASS row has 0 passed tests`);
          if (counts.failed > 0) errors.push(`${id}: PASS row has ${counts.failed} failed test(s)`);
          if (counts.flaky > 0) errors.push(`${id}: PASS row has ${counts.flaky} flaky/retried test(s)`);
          if (gate.strictSkips && counts.skipped > 0) errors.push(`${id}: PASS row has ${counts.skipped} skipped test(s), a skip is not a pass`);
        }
      }
    }
    rows.push({ id, status, waived, exitCode: exit, counts });
  }
  if (requireAll) for (const gate of GATES) if (!seen.has(gate.id)) errors.push(`${gate.id}: gate row is missing`);
  return { errors, rows };
}

/** Fail-closed check of the gate table alone. Returns the list of problems. */
export function verifyGateTable(markdown, options = {}) {
  return readGateRows(markdown, options.requireAll ?? false).errors;
}

export const DECISION_ROWS = Object.freeze(["D-36(б) staging", "D-36(б) production", "D-47 staging", "D-47 production", "T-20-31", "D-43/D-44/D-37", "D-40..D-42", "D-39/D-45"]);
export const D33_ROWS = Object.freeze(["WR-03", "WR-05", "IN-01", "IN-02", "IN-03", "IN-04", "IN-05"]);
const normalizeLabel = (text) => stripTicks(text).replace(/\s+/g, "").toLowerCase();
const OWNER_PENDING = /^ОЖИДАЕТ ВЛАДЕЛЬЦА/;
const OWNER_APPLIED = /^ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ \d{4}-\d{2}-\d{2}/;

/** Release blockers of the security matrix (section «Блокеры релиза (D-12)»): ids of rows other than «нет»; null when the section is absent. */
export function matrixBlockers(matrixMarkdown) {
  const table = sectionTable(matrixMarkdown ?? "", "Блокеры релиза");
  if (!table) return null;
  return table.rows.map((row) => stripTicks(row[0] ?? "")).filter((id) => id !== "" && id.toLowerCase() !== "нет");
}

/**
 * Every problem in 20-RELEASE-EVIDENCE.md. deps = { commitExists(sha) => boolean, matrix: string | null }.
 * Checks: commit, Node, gates, D-33 table, «Решения D-35..D-45», production rows, verdict versus gates and matrix blockers.
 */
export function verifyEvidence(markdown, deps = {}) {
  const errors = [];
  const text = normalizeText(markdown);
  if (text.trim() === "") return ["evidence is empty"];

  const commit = text.match(/^Commit:\s*`?([0-9A-Za-z]+)`?\s*$/m)?.[1];
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) errors.push("commit is missing or not a full 40-hex sha");
  else if (typeof deps.commitExists === "function" && !deps.commitExists(commit)) errors.push(`commit ${commit.slice(0, 12)} does not exist in this repository`);
  if (!/^Node:\s*v22\.13\.\d+\s*$/m.test(text)) errors.push("Node line is missing or is not 22.13.x");
  const mode = text.match(/^Режим:\s*(\S+)/m)?.[1];
  if (mode !== "full") errors.push(`run mode is "${mode ?? "missing"}": only a full run (every gate) is release evidence`);

  const gates = readGateRows(text, true);
  errors.push(...gates.errors);

  const d33 = sectionTable(text, "Перенесённые находки 19-REVIEW (D-33)");
  if (!d33) errors.push("table «Перенесённые находки 19-REVIEW (D-33)» is missing");
  else {
    const byId = new Map(d33.rows.map((row) => [normalizeLabel(row[0] ?? ""), row]));
    for (const id of D33_ROWS) {
      const row = byId.get(normalizeLabel(id));
      if (!row) { errors.push(`${id}: D-33 row is missing`); continue; }
      const status = stripTicks(row[1] ?? "");
      if (!/^(fixed|disposition)\b/i.test(status)) errors.push(`${id}: D-33 status "${status || "(empty)"}" must be fixed or disposition, not open`);
    }
  }

  const decisions = sectionTable(text, "Решения D-35..D-45");
  if (!decisions) errors.push("table «Решения D-35..D-45» is missing");
  else {
    const byId = new Map(decisions.rows.map((row) => [normalizeLabel(row[0] ?? ""), row]));
    for (const id of DECISION_ROWS) {
      const row = byId.get(normalizeLabel(id));
      if (!row) { errors.push(`${id}: decision row is missing`); continue; }
      const status = String(row[1] ?? "").trim();
      if (status === "" || status === "-" || /^open\b/i.test(status)) { errors.push(`${id}: decision status is empty or open`); continue; }
      if (/production/i.test(id)) {
        if (!OWNER_PENDING.test(status) && !OWNER_APPLIED.test(status)) {
          errors.push(`${id}: production row is an owner action; status must be «ОЖИДАЕТ ВЛАДЕЛЬЦА» or «ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ ГГГГ-ММ-ДД», got "${status}"`);
        }
        if (row.some((cell) => /(?<!не\s)(?<!not\s)\bPASS\b/i.test(cell))) errors.push(`${id}: production row is an owner action and must not contain PASS`);
      }
    }
  }

  const stated = text.match(/^Итог:\s*(\S+)/m)?.[1];
  if (!stated || !VERDICTS.includes(stated)) errors.push(`verdict line «Итог:» is missing or unknown ("${stated ?? ""}")`);
  else {
    const rows = gates.rows;
    if (rows.length > 0) {
      const computed = aggregate(rows.map((row) => ({ id: row.id, status: row.status, waived: row.waived }))).verdict;
      if (VERDICT_RANK[stated] > VERDICT_RANK[computed]) errors.push(`verdict ${stated} is stronger than the gate table allows (${computed})`);
      if (stated.startsWith("PASS") && rows.some((row) => row.status === "SKIPPED")) errors.push("verdict PASS with a SKIPPED mandatory gate");
    }
    if (stated.startsWith("PASS")) {
      const blockers = matrixBlockers(deps.matrix ?? null);
      if (blockers === null) errors.push("security matrix section «Блокеры релиза (D-12)» is unreadable: verdict PASS cannot be confirmed");
      else if (blockers.length > 0) errors.push(`unresolved high blocker(s) in the security matrix (${blockers.join(", ")}) forbid verdict ${stated}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------------
// Orchestration.

/** @returns {any} */
function defaultDeps() {
  const git = (args, options = {}) => {
    const result = spawnSync("git", args, { cwd: options.cwd ?? ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };
  const exec = (file, args, options) => {
    const win = process.platform === "win32";
    const isNpm = file === "npm.cmd";
    const executable = isNpm && !win ? "npm" : file;
    let result;
    if (isNpm && win) {
      // A .cmd file needs a shell on Windows. The arguments come from the fixed catalogue plus our own output path.
      for (const arg of args) if (/["%\r\n]/.test(arg)) throw new GateError("unsafe-argument", "an argument contains a quote, percent sign or newline");
      const line = [executable, ...args.map((arg) => (/[\s&()^|<>]/.test(arg) ? `"${arg}"` : arg))].join(" ");
      result = spawnSync(line, { cwd: options.cwd, env: options.env, encoding: "utf8", shell: true, maxBuffer: 512 * 1024 * 1024, timeout: options.timeoutMs, windowsHide: true });
    } else {
      result = spawnSync(executable, args, { cwd: options.cwd, env: options.env, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, timeout: options.timeoutMs, windowsHide: true });
    }
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error ?? null };
  };
  return {
    fs: nodeFs,
    git,
    exec,
    root: ROOT,
    env: process.env,
    tmpdir: os.tmpdir(),
    now: () => new Date().toISOString(),
    stamp: () => new Date().toISOString().replace(/[-:]/g, "").replace(".", ""),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  };
}

/**
 * One run of the chosen gates in a temporary clean worktree of `commit`.
 * @param {any} deps
 * @param {{ commit: string, only?: string[] | null }} options
 * @returns {any}
 */
export function runRelease(deps, options) {
  if (deps.env.PORTIA_E2E_TARGET_ENVIRONMENT === "production") throw new GateError("production-target", "PORTIA_E2E_TARGET_ENVIRONMENT is production; the release gate never runs against production");
  const only = options.only && options.only.length > 0 ? options.only : null;
  if (only) for (const id of only) if (!GATE_BY_ID.has(id)) throw new GateError("unknown-gate", id);
  if (typeof options.commit !== "string" || options.commit === "" || /^-|\s/.test(options.commit)) throw new GateError("bad-commit", "pass a sha or ref after --commit");
  const selected = GATES.filter((gate) => !only || only.includes(gate.id));
  const startedAt = deps.now();

  const created = createWorktree(options.commit, deps);
  const shortCommit = created.commit.slice(0, 12);
  const artifactsRelative = `${RELEASE_DIR}/${shortCommit}-${created.stamp}`;
  const artifactsDir = path.join(deps.root, RELEASE_DIR, `${shortCommit}-${created.stamp}`);
  let run = null;
  let failure = null;
  let removeError = null;
  try {
    deps.fs.mkdirSync(path.join(deps.root, RELEASE_DIR), { recursive: true });
    deps.fs.mkdirSync(artifactsDir); // not recursive: an existing directory is an error, runs are never mixed
    const includesPlaywright = selected.some((gate) => gate.kind === "playwright");
    let waivers = null;
    if (includesPlaywright) {
      const waiverFile = path.join(created.path, WAIVERS_MD);
      waivers = deps.fs.existsSync(waiverFile) ? readWaivers(deps.fs.readFileSync(waiverFile, "utf8")) : null;
    }
    const results = [];
    for (const gate of selected) results.push(runGate(gate, { deps, worktree: created.path, artifactsDir, results, waivers }));

    const treeClean = results.find((result) => result.id === "tree-clean");
    if (treeClean && treeClean.status === "PASS" && selected.some((gate) => gate.id !== "node-version" && gate.id !== "tree-clean")) {
      const after = deps.git(["status", "--porcelain"], { cwd: created.path });
      if (after.status !== 0 || String(after.stdout).trim() !== "") {
        treeClean.status = "FAIL";
        treeClean.reason = `worktree changed during the gates: ${clip(String(after.stdout).split("\n").slice(0, 5).join("; ") || after.stderr)}`;
      }
    }
    const verdict = aggregate(results, { playwright: includesPlaywright, waivers });
    const nodeVersion = results.find((result) => result.id === "node-version")?.detail || process.version;
    run = {
      schema: SCHEMA,
      commit: created.commit,
      node: nodeVersion,
      startedAt,
      finishedAt: deps.now(),
      partial: Boolean(only),
      only: only ?? [],
      artifactsDir: artifactsRelative,
      results,
      verdict: verdict.verdict,
      reasons: verdict.reasons,
      env: envPresence(ENV_NAMES, deps.env),
    };
    deps.fs.writeFileSync(path.join(artifactsDir, "receipt.json"), `${JSON.stringify(run, null, 2)}\n`);
    deps.fs.writeFileSync(path.join(artifactsDir, "gates.md"), renderEvidence(run));
  } catch (error) {
    failure = error;
  } finally {
    try { removeWorktree(created.path, deps); } catch (error) { removeError = error; }
  }
  if (failure) throw failure;
  if (removeError) throw removeError;
  return run;
}

function option(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function printPlan(deps) {
  deps.out(`${GATES.length} gates (nothing is run):\n`);
  for (const gate of GATES) {
    deps.out(`${gate.id}\t${gate.title}\n  ${gate.command}\n`);
    const needs = [
      ...(gate.requires.gates ?? []).map((id) => `gate ${id}`),
      ...(gate.requires.env ?? []).map((alternatives) => `env ${alternatives.join("|")}`),
      ...(gate.requires.files ?? []).map((file) => `file ${file.path}`),
    ];
    if (needs.length > 0) deps.out(`  requires: ${needs.join(", ")}\n`);
  }
  return 0;
}

function selfCheck(deps) {
  const run = runRelease(deps, { commit: "HEAD", only: ["node-version", "tree-clean"] });
  const problems = verifyGateTable(renderEvidence(run), { requireAll: false });
  if (run.verdict !== "PASS" || problems.length > 0) {
    deps.err(`self-check failed (${run.verdict}): ${[...run.reasons.filter((reason) => !/owner waiver/.test(reason)), ...problems].join("; ")}\n`);
    return 1;
  }
  deps.out(`self-check ok ${run.commit.slice(0, 12)}\n`);
  return 0;
}

function verifyEvidenceMode(deps, argv) {
  const evidencePath = option(argv, "--evidence") ?? path.join(deps.root, EVIDENCE_MD);
  if (!deps.fs.existsSync(evidencePath)) {
    deps.err("20-RELEASE-EVIDENCE.md not found\n");
    return 1;
  }
  const matrixPath = path.join(deps.root, MATRIX_MD);
  const errors = verifyEvidence(deps.fs.readFileSync(evidencePath, "utf8"), {
    matrix: deps.fs.existsSync(matrixPath) ? deps.fs.readFileSync(matrixPath, "utf8") : null,
    commitExists: (sha) => deps.git(["cat-file", "-e", `${sha}^{commit}`]).status === 0,
  });
  // Extension point (20-15): --verify-lineage, --verify-docs and --verify-reconciliation attach here without touching the checks above.
  for (const extra of deps.extraEvidenceVerifiers ?? []) errors.push(...extra(deps));
  if (errors.length > 0) {
    deps.err(`${errors.map((error) => `[PORTIA_RELEASE_GATE:verify-failed] ${error}`).join("\n")}\n`);
    return 1;
  }
  deps.out("release evidence verified\n");
  return 0;
}

/**
 * @param {string[]} [argv]
 * @param {any} [overrides]
 */
export function main(argv = process.argv.slice(2), overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const mode = argv[0];
  try {
    if (mode === "--plan") return printPlan(deps);
    if (mode === "--self-check") return selfCheck(deps);
    if (mode === "--verify-evidence") return verifyEvidenceMode(deps, argv);
    if (mode === "--run") {
      const commit = option(argv, "--commit");
      if (!commit) {
        deps.err("usage: node scripts/phase20-release-gate.mjs --run --commit <sha> [--only id,id]\n");
        return 2;
      }
      const only = option(argv, "--only")?.split(",").map((id) => id.trim()).filter(Boolean) ?? null;
      const run = runRelease(deps, { commit, only });
      deps.out(`${run.partial ? "partial " : ""}run ${run.commit.slice(0, 12)}: ${run.verdict}\n`);
      for (const result of run.results) deps.out(`  ${result.id}\t${renderStatus(result)}\texit ${result.exitCode ?? "-"}\t${result.reason}\n`);
      deps.out(`artifacts: ${run.artifactsDir}\n`);
      return run.verdict === "PASS" || run.verdict === "PASS-WITH-OWNER-WAIVERS" ? 0 : 1;
    }
    deps.err("usage: node scripts/phase20-release-gate.mjs --plan | --self-check | --run --commit <sha> [--only id,id] | --verify-evidence [--evidence <path>]\n");
    return 2;
  } catch (error) {
    deps.err(`${error instanceof GateError ? error.message : `[PORTIA_RELEASE_GATE:unexpected] ${error instanceof Error ? error.message : "unknown"}`}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
