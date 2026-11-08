import * as nodeFs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Phase 20 release gate runner (20-30, prepares 20-13). Fail-closed: a gate is PASS only with proof.
//   --plan                              prints the gate catalogue, runs nothing;
//   --self-check                        clean worktree of HEAD -> node-version + tree-clean -> receipt -> evidence table -> worktree removed;
//   --run --commit <sha> [--only a,b] [--npm-cli <path>]   runs the gates in a clean temporary git worktree of that commit;
//   --verify-evidence [--evidence <p>]  fail-closed check of 20-RELEASE-EVIDENCE.md (written by 20-13 Task 2).
// D-68 (20-13): visual acceptance is the owner's overall verdict from 20-58-SUMMARY.md plus the 20-12 baselines on fixed data. The three
// offline gates (ui-contract-offline, visual-approved, visual-phase20) start the production server of the checkout under
// tests/e2e/harness/offline-supabase.cjs and are labelled «offline D-68»; they say nothing about real data.
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
export const BASELINES_JSON = "tests/e2e/visual/phase20-baselines.json";
export const OWNER_SUMMARY_MD = `${PHASE_DIR}/20-58-SUMMARY.md`;
export const OFFLINE_HARNESS = "tests/e2e/harness/offline-supabase.cjs";
export const OFFLINE_FLAG = "PORTIA_E2E_OFFLINE_SUPABASE";
export const OFFLINE_PORT = 3100;
export const OFFLINE_BASE_URL = `http://127.0.0.1:${OFFLINE_PORT}`;
export const OFFLINE_MODE = "offline D-68";
export const VISUAL_SECTION = "Визуальная приёмка владельца (D-68)";
export const VISUAL_ROWS = Object.freeze(["Общий вердикт", "Эталоны 20-12", "Код продукта"]);
export const VISUAL_GATES = Object.freeze(["ui-contract-offline", "visual-approved", "visual-phase20", "visual-manifest"]);

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
// Offline gates call the Playwright CLI of the checkout directly: `npm run` and `npx` are unreliable here (20-54) and the
// webServer of playwright.config.ts would build with the real environment. The runner owns the server (see runGate).
const offlineStep = (extra, outputName, { snapshots = false } = {}) => ({
  file: "node",
  args: ["node_modules/@playwright/test/cli.js", "test", ...PLAYWRIGHT_FLAGS, ...(snapshots ? ["--update-snapshots=none"] : []), ...extra],
  playwright: true,
  outputName,
});
const OFFLINE_FILES = [{ path: OFFLINE_HARNESS, kind: "ENV", reason: "нет обвязки офлайн-режима D-68" }];
const nodeStep = (...args) => ({ file: "node", args });

const NPM_FILE = "npm.cmd";
export const NPM_PATH_SOURCE = "PATH npm.cmd";
const isNpmStep = (step) => step.file === NPM_FILE;

// D-69 (G5): the npm of a release run must be explicit and recorded; a PATH wrapper outside the repository is not reproducible.
// With `--npm-cli <npm-cli.js>` an npm step is `<Node of the runner> <npm-cli.js> <args>` (no shell, no PATH); without it `npm.cmd` from PATH.
function invocation(file, args, npmCli) {
  return file === NPM_FILE && npmCli ? { file: process.execPath, args: [npmCli, ...args] } : { file, args };
}

function displayStep(gateId, step, index, npmCli = null) {
  const parts = isNpmStep(step) && npmCli ? ["node", npmCli, ...step.args] : [step.file, ...step.args];
  if (step.playwright) parts.push("--output", `<артефакты>/${step.outputName ?? `${gateId}-${index + 1}`}`);
  return parts.join(" ");
}

const commandOf = (gate, npmCli = null) => gate.steps.map((step, index) => displayStep(gate.id, step, index, npmCli)).join(" ; ");

function defineGate(definition) {
  return Object.freeze({ requires: {}, ...definition, command: commandOf(definition) });
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
    dataMode: "цель",
    counts: "playwright",
    strictSkips: true,
    projectSkips: true,
    envMarkers: true,
    requires: { gates: NEEDS_INSTALL, env: PUBLIC_ENV },
  }),
  defineGate({
    id: "ui-contract-offline",
    title: "Функциональные проверки D-68 п. 4 на фиксированных данных (20-58)",
    kind: "playwright",
    offline: true,
    projectSkips: true,
    steps: [
      offlineStep(["--project=chromium-desktop", "--project=chromium-phone", "tests/e2e/specs/template-builder.spec.ts", "tests/e2e/specs/accessibility.spec.ts", "-g", "STAB-TMPL-01|template builder"], "ui-contract-1"),
      offlineStep(["--project=chromium-desktop", "--project=chromium-dpr125", "--project=firefox-desktop", "--project=chromium-phone", "--project=webkit-phone", "tests/e2e/specs/template-builder.spec.ts", "-g", "D-61|D-65"], "ui-contract-2"),
      offlineStep(["--project=chromium-desktop", "--project=chromium-phone", "tests/e2e/specs/editor-ui-contract.spec.ts", "tests/e2e/specs/image-framing.spec.ts"], "ui-contract-3"),
      offlineStep(["--project=firefox-desktop", "--project=webkit-phone", "tests/e2e/specs/editor-ui-contract.spec.ts", "-g", "D-66 touch|D-66 dialog|D-67 «Справочник» section photo"], "ui-contract-4"),
    ],
    counts: "playwright",
    requires: { gates: NEEDS_INSTALL, files: OFFLINE_FILES },
  }),
  defineGate({
    id: "visual-approved",
    title: "Прежние эталоны (без @phase20) на фиксированных данных",
    kind: "playwright",
    offline: true,
    steps: [
      offlineStep(["--project=chromium-desktop", "--project=chromium-dpr125", "tests/e2e/visual", "--grep-invert", "@phase20"], "visual-approved-1", { snapshots: true }),
      offlineStep(["--project=chromium-phone", "--project=webkit-phone", "--project=firefox-desktop", "tests/e2e/visual", "--grep-invert", "@phase20"], "visual-approved-2", { snapshots: true }),
    ],
    counts: "playwright",
    strictSkips: true,
    projectSkips: true,
    requires: { gates: NEEDS_INSTALL, files: OFFLINE_FILES },
  }),
  defineGate({
    id: "visual-phase20",
    title: "@phase20 эталоны (20-12) на фиксированных данных",
    kind: "playwright",
    offline: true,
    steps: [offlineStep(["--project=chromium-desktop", "--project=chromium-phone", "tests/e2e/visual/phase20.spec.ts"], "visual-phase20-1", { snapshots: true })],
    counts: "playwright",
    strictSkips: true,
    projectSkips: true,
    requires: {
      gates: NEEDS_INSTALL,
      files: [{ path: "tests/e2e/visual/phase20.spec.ts", kind: "OWNER", reason: "нет одобренных эталонов 20-12" }, ...OFFLINE_FILES],
    },
  }),
  defineGate({
    id: "mutation-attest",
    title: "Аттестация изолированного staging (preflight:mutation)",
    kind: "command",
    steps: [npmStep("run", "test:e2e:preflight:mutation")],
    dataMode: "staging",
    requires: { gates: NEEDS_INSTALL, env: MUTATION_ENV.map((name) => [name]) },
  }),
  defineGate({
    id: "e2e-mutation",
    title: "Mutation lane и редактор D-40..D-42, D-47",
    kind: "playwright",
    dataMode: "staging",
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
    dataMode: "staging",
    counts: "node-test",
    strictSkips: true,
    requires: { gates: ["mutation-attest"] },
  }),
]);

const GATE_BY_ID = new Map(GATES.map((gate) => [gate.id, gate]));

/** Data mode of a gate for the «Данные» column: `offline D-68` for the three offline gates, otherwise `цель`, `staging` or `-`. */
export function dataModeOf(id) {
  const gate = GATE_BY_ID.get(id);
  if (!gate) return "-";
  return gate.offline ? OFFLINE_MODE : gate.dataMode ?? "-";
}

// ---------------------------------------------------------------------------------------------------------------------
// Offline environment (D-68). Names are removed by pattern; no value is ever printed.

const privilegedName = new RegExp(["service", "role"].join("_"), "i");

/** Environment of the Playwright process of an offline gate: no mutation, staging, privileged or real public names, plus the invented values. */
export function offlineChildEnv(base, offlineValues) {
  const env = {};
  for (const [name, value] of Object.entries(base ?? {})) {
    if (MUTATION_ENV.includes(name) || privilegedName.test(name)) continue;
    if (/^PORTIA_STAGING_/.test(name) || /^PORTIA_PROMO_LIVE_/.test(name) || /^NEXT_PUBLIC_SUPABASE_/.test(name)) continue;
    if (name === "PORTIA_PROMOTION_DEVICE_SECRET" || name === "NODE_OPTIONS" || name === OFFLINE_FLAG || name === "PORTIA_E2E_BASE_URL") continue;
    env[name] = value;
  }
  return { ...env, ...offlineValues, PORTIA_E2E_ALLOW_HTTP: "1", PORTIA_E2E_BASE_URL: OFFLINE_BASE_URL };
}

/** The harness is preloaded into the server process only. */
export function offlineServerEnv(childEnv, harnessPath) {
  const normalized = String(harnessPath).replace(/\\/g, "/");
  return { ...childEnv, NODE_OPTIONS: `--require=${/\s/.test(normalized) ? `"${normalized}"` : normalized}`, [OFFLINE_FLAG]: "1" };
}

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

// ---------------------------------------------------------------------------------------------------------------------
// D-69 (G4): a skip by a project condition. The rule works on the level of the gate run (visual-approved has two steps) and the condition
// must be proven by the spec source: a skip by data (`test.skip(!before, ...)`) can carry a text that names a project and still not be one.

export const SPEC_ROOT = "tests/e2e";

/** Same-length copy of `source` with comments and the inside of strings and template text blanked; the code of `${...}` stays. */
function maskSource(source) {
  const out = source.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i += 1) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  const quoted = (start) => {
    let i = start + 1;
    while (i < source.length && source[i] !== source[start] && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
    blank(start + 1, i);
    return source[i] === source[start] ? i + 1 : i;
  };
  const template = (start) => {
    let i = start + 1;
    while (i < source.length && source[i] !== "`") {
      if (source[i] === "\\") { blank(i, i + 2); i += 2; continue; }
      if (source[i] === "$" && source[i + 1] === "{") { i = code(i + 2, true); continue; }
      blank(i, i + 1);
      i += 1;
    }
    return i + 1;
  };
  const code = (start, untilBrace) => {
    let i = start;
    let depth = 0;
    while (i < source.length) {
      const c = source[i];
      const next = source[i + 1];
      if (c === "/" && next === "/") { let end = source.indexOf("\n", i); if (end === -1) end = source.length; blank(i, end); i = end; continue; }
      if (c === "/" && next === "*") { let end = source.indexOf("*/", i + 2); end = end === -1 ? source.length : end + 2; blank(i, end); i = end; continue; }
      if (c === '"' || c === "'") { i = quoted(i); continue; }
      if (c === "`") { i = template(i); continue; }
      if (untilBrace) {
        if (c === "{") depth += 1;
        else if (c === "}") { if (depth === 0) return i + 1; depth -= 1; }
      }
      i += 1;
    }
    return i;
  };
  code(0, false);
  return out.join("");
}

/** Tokens of a condition: strings as `{ str }`, names as `{ id }`, the rest as literal text; null for anything outside the closed alphabet. */
function tokenizeCondition(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (/^\s/.test(rest)) { i += 1; continue; }
    const operator = rest.match(/^(===|!==|==|!=|&&|\|\||[!().])/);
    if (operator) { tokens.push(operator[1]); i += operator[1].length; continue; }
    const string = rest.match(/^"([^"\\\n]*)"|^'([^'\\\n]*)'/);
    if (string) { tokens.push({ str: string[1] ?? string[2] }); i += string[0].length; continue; }
    const name = rest.match(/^[A-Za-z_$][\w$]*/);
    if (name) { tokens.push({ id: name[0] }); i += name[0].length; continue; }
    return null;
  }
  return tokens;
}

const STRING_LITERAL = `(?:"[^"\\\\\\n]*"|'[^'\\\\\\n]*')`;
const LIST_LITERAL = new RegExp(`^(?:new\\s+Set\\s*\\(\\s*)?\\[\\s*(?:${STRING_LITERAL}(?:\\s*,\\s*${STRING_LITERAL})*\\s*,?\\s*)?\\]\\s*\\)?(?:\\s+as\\s+const)?$`);

/** The text of an expression from `start` to the first `;` outside brackets (masked source); null when there is none within reach. */
function expressionEnd(masked, start) {
  let depth = 0;
  for (let i = start; i < masked.length && i < start + 600; i += 1) {
    const c = masked[i];
    if ("([{".includes(c)) depth += 1;
    else if (")]}".includes(c)) depth -= 1;
    else if (c === ";" && depth === 0) return i;
  }
  return null;
}

/** Names the file defines that a project condition may use: parameterless arrow functions, lists of plain strings, and the fixtures. */
function projectDefinitions(source, masked) {
  const functions = new Map();
  const lists = new Set();
  for (const match of masked.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(\s*\)\s*=>\s*/g)) {
    const start = match.index + match[0].length;
    const end = expressionEnd(masked, start);
    if (end !== null) functions.set(match[1], source.slice(start, end));
  }
  for (const match of masked.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*/g)) {
    const start = match.index + match[0].length;
    const end = expressionEnd(masked, start);
    if (end !== null && LIST_LITERAL.test(source.slice(start, end).trim())) lists.add(match[1]);
  }
  const fixtures = new Set(["isMobile", "hasTouch"].filter((name) => !new RegExp(`\\b(?:const|let|var)\\s+${name}\\b|\\b(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b`).test(masked)));
  return { functions, lists, fixtures };
}

/** True when the whole condition is built only from the closed list of project signs (see projectConditionSkips). */
function isProjectCondition(text, definitions, depth = 0) {
  const tokens = tokenizeCondition(text);
  if (!tokens || tokens.length === 0) return false;
  let pos = 0;
  const at = (offset = 0) => tokens[pos + offset];
  const isId = (name, offset = 0) => at(offset)?.id === name;
  const isStr = (offset = 0) => typeof at(offset)?.str === "string";
  const nameRef = () => {
    if (isId("testInfo") && at(1) === "." && isId("project", 2) && at(3) === "." && isId("name", 4)) { pos += 5; return true; }
    if (isId("test") && at(1) === "." && isId("info", 2) && at(3) === "(" && at(4) === ")" && at(5) === "." && isId("project", 6) && at(7) === "." && isId("name", 8)) { pos += 9; return true; }
    return false;
  };
  const atom = () => {
    if (nameRef()) {
      if (["===", "!==", "==", "!="].includes(at()) && isStr(1)) { pos += 2; return true; }
      if (at() === "." && ["endsWith", "startsWith", "includes"].includes(at(1)?.id) && at(2) === "(" && isStr(3) && at(4) === ")") { pos += 5; return true; }
      return false;
    }
    const name = at()?.id;
    if (!name) return false;
    if (at(1) === "(" && at(2) === ")") {
      pos += 3;
      const body = definitions.functions.get(name);
      return body !== undefined && depth < 4 && isProjectCondition(body, definitions, depth + 1);
    }
    if (at(1) === "." && ["has", "includes"].includes(at(2)?.id) && at(3) === "(") {
      pos += 4;
      if (!nameRef() || at() !== ")") return false;
      pos += 1;
      return definitions.lists.has(name);
    }
    if (at(1) === undefined || ["&&", "||", ")"].includes(at(1))) {
      pos += 1;
      return definitions.fixtures.has(name);
    }
    return false;
  };
  const unary = () => {
    if (at() === "!") { pos += 1; return unary(); }
    if (at() === "(") { pos += 1; if (!or() || at() !== ")") return false; pos += 1; return true; }
    return atom();
  };
  const and = () => { if (!unary()) return false; while (at() === "&&") { pos += 1; if (!unary()) return false; } return true; };
  const or = () => { if (!and()) return false; while (at() === "||") { pos += 1; if (!and()) return false; } return true; };
  return or() && pos === tokens.length;
}

/** The text of a literal reason: a quoted string or a template (kept with its `${...}`); null for anything else. */
function reasonTemplate(argument) {
  const quoted = argument.match(/^"((?:[^"\\\n]|\\.)*)"$/) ?? argument.match(/^'((?:[^'\\\n]|\\.)*)'$/);
  if (quoted) return quoted[1].replace(/\\(.)/g, "$1");
  const template = argument.match(/^`([\s\S]*)`$/);
  return template ? template[1] : null;
}

/**
 * The reasons of the `test.skip(<condition>, <reason>)` calls of a spec whose condition is built only from project signs:
 * `testInfo.project.name` / `test.info().project.name` compared with a string (=== !== == !=) or with `.endsWith` / `.startsWith` / `.includes`
 * of a string, `isMobile`, `hasTouch` (the Playwright fixtures), a parameterless arrow function of the same file with such a body,
 * `.has` / `.includes` of the project name on a constant of the same file made of plain strings, joined by `!`, `&&`, `||` and brackets.
 * A reason is returned as written; `${...}` marks a substitution. Anything else (data, `true`, unknown names) proves nothing.
 */
export function projectConditionSkips(sourceText) {
  const source = String(sourceText ?? "");
  const masked = maskSource(source);
  const definitions = projectDefinitions(source, masked);
  const reasons = [];
  for (const match of masked.matchAll(/(?<![\w$.])test\.skip\s*\(/g)) {
    const open = match.index + match[0].length;
    const args = [];
    let depth = 0;
    let from = open;
    let closed = false;
    let i = open;
    for (; i < masked.length; i += 1) {
      const c = masked[i];
      if ("([{".includes(c)) depth += 1;
      else if (")]}".includes(c)) {
        if (depth === 0) { closed = c === ")"; break; }
        depth -= 1;
      } else if (c === "," && depth === 0) { args.push(source.slice(from, i).trim()); from = i + 1; }
    }
    if (!closed) continue;
    const last = source.slice(from, i).trim();
    if (last !== "") args.push(last);
    if (args.length !== 2) continue;
    const reason = reasonTemplate(args[1]);
    if (reason !== null && isProjectCondition(args[0], definitions)) reasons.push(reason);
  }
  return reasons;
}

/** True when `description` is the text of the proven `template` (a `${...}` stands for any text; a bare substitution proves nothing). */
export function reasonMatches(template, description) {
  let pattern = "";
  let literal = false;
  for (let i = 0; i < template.length; i += 1) {
    if (template[i] === "$" && template[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < template.length && depth > 0) {
        if (template[i] === "{") depth += 1;
        else if (template[i] === "}") depth -= 1;
        i += 1;
      }
      i -= 1;
      pattern += "[\\s\\S]+";
    } else {
      if (/\S/.test(template[i])) literal = true;
      pattern += template[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return literal && new RegExp(`^${pattern}$`).test(String(description ?? ""));
}

/** Tests that passed without a retry: `file|title` to the set of projects. Flaky, retried and every other status are not in it. */
export function passedTests(report) {
  const passed = new Map();
  for (const { spec, file } of walkSpecs(report?.suites)) {
    for (const test of spec.tests ?? []) {
      const retried = (Array.isArray(test.results) ? test.results : []).some((result) => Number(result?.retry ?? 0) > 0);
      if (test.status !== "expected" || retried) continue;
      const key = `${file}|${spec.title}`;
      if (!passed.has(key)) passed.set(key, new Set());
      passed.get(key).add(test.projectName ?? "");
    }
  }
  return passed;
}

/** The union of the passes of several reports (the steps of one gate run). */
export function mergePassed(maps) {
  const merged = new Map();
  for (const map of maps) for (const [key, projects] of map) merged.set(key, new Set([...(merged.get(key) ?? []), ...projects]));
  return merged;
}

/** File to proven reasons for every spec that has a skipped, non-BLOCKED test in any of the reports. `readSource(file)` returns text or null. */
export function projectSkipProofs(reports, readSource) {
  const files = new Set();
  for (const report of reports) {
    for (const { spec, file } of walkSpecs(report?.suites)) {
      for (const test of spec.tests ?? []) {
        if (test.status === "skipped" && !(test.annotations ?? []).some((annotation) => BLOCKED_ANNOTATION.test(String(annotation?.description ?? "")))) files.add(file);
      }
    }
  }
  const proofs = new Map();
  for (const file of files) {
    let text = null;
    try { text = readSource(file); } catch { text = null; }
    if (typeof text === "string") proofs.set(file, projectConditionSkips(text));
  }
  return proofs;
}

/** A skip by project: the annotation text is the reason of a proven call in this file, and the test passed on ANOTHER project without a retry. */
function skippedByProject({ passed, proofs, file, title, project, annotations }) {
  const others = passed.get(`${file}|${title}`);
  if (!others || ![...others].some((other) => other !== project)) return false;
  const reasons = proofs?.get(file);
  if (!reasons || reasons.length === 0) return false;
  const texts = (annotations ?? []).filter((annotation) => annotation?.type === "skip").map((annotation) => String(annotation?.description ?? ""));
  return texts.length > 0 && texts.every((text) => reasons.some((reason) => reasonMatches(reason, text)));
}

/**
 * Classifies a Playwright JSON report. Flaky and any retry are FAIL, `unexpected` is FAIL, a skip annotated BLOCKED is BLOCKED,
 * any other skip is SKIPPED, an empty report is FAIL. A failing test is "waived" only by a registry row of class `waiver`
 * that carries the owner's «принято» and a date; fixed and expected-fault rows never excuse a failure.
 * @returns {any}
 */
export function classifyPlaywright(report, waivers = [], options = {}) {
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0, blocked: 0 };
  const failures = [];
  const blockedKinds = new Set();
  let projectSkipped = 0;
  if (!report || typeof report !== "object") return { status: "FAIL", counts, failures, blockedKinds: [], waived: false, projectSkipped, reasons: ["Playwright report is missing or not an object"] };
  const reasons = [];
  if (Array.isArray(report.errors) && report.errors.length > 0) reasons.push(`report has ${report.errors.length} global error(s)`);

  // D-69 (G4), extends the 20-13 rule: a skip by a project condition is accepted when the spec source proves the condition (options.skipProofs)
  // and the same test passed without a retry on ANOTHER project anywhere in the gate run (options.passed; by default this report only).
  // Gate level because visual-approved has two steps; source proof because a skip by data can carry a text that names a project.
  const passed = options.projectSkips ? options.passed ?? passedTests(report) : null;

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
        } else if (passed && skippedByProject({ passed, proofs: options.skipProofs, file, title: spec.title, project, annotations: test.annotations })) {
          projectSkipped += 1;
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
  else if (counts.skipped - projectSkipped > 0) status = "SKIPPED";
  const waived = status === "FAIL" && reasons.length === 0 && failures.length > 0 && failures.every((failure) => failure.waived);
  return { status, counts, failures, blockedKinds: kinds, waived, first: failures[0]?.id ?? null, projectSkipped, reasons };
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

/** Reads (and copies into the artifacts) the report a Playwright step just wrote; the next step overwrites it. */
function readPlaywrightReport(gate, context, stepNumber) {
  const resultsFile = path.join(context.worktree, PLAYWRIGHT_RESULTS);
  if (!context.deps.fs.existsSync(resultsFile)) return { report: null, problem: "Playwright wrote no results.json" };
  try {
    const text = context.deps.fs.readFileSync(resultsFile, "utf8");
    context.deps.fs.writeFileSync(path.join(context.artifactsDir, `${gate.id}-${stepNumber}-results.json`), text);
    return { report: JSON.parse(text), problem: "" };
  } catch {
    return { report: null, problem: "Playwright results.json is not valid JSON" };
  }
}

/** Passes and proven reasons over ALL steps of a gate that has the project-skip rule; `{}` for every other gate. */
function gateWideSkipEvidence(gate, executed, context) {
  if (!gate.projectSkips) return {};
  const reports = executed.map((item) => item.prepared?.report).filter(Boolean);
  const readSource = (file) => {
    const target = path.join(context.worktree, SPEC_ROOT, String(file).replace(/\\/g, "/"));
    return context.deps.fs.existsSync(target) ? context.deps.fs.readFileSync(target, "utf8") : null;
  };
  return { passed: mergePassed(reports.map(passedTests)), skipProofs: projectSkipProofs(reports, readSource) };
}

function evaluateStep(gate, step, run, context, prepared = null) {
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const code = run.status;
  const base = { status: "PASS", reason: "", detail: "", counts: null, blockedKind: "", waived: false, waivedBy: [], first: null };
  if (run.error) return { ...base, status: "FAIL", reason: `could not run: ${clip(run.error.message ?? run.error)}` };
  if (code !== 0) {
    if (gate.envMarkers && ENV_FAILURE.test(output)) return { ...base, status: "BLOCKED", blockedKind: "ENV", reason: "required environment variables are missing" };
    if (gate.network && NETWORK_FAILURE.test(output)) return { ...base, status: "BLOCKED", blockedKind: "ENV", reason: "network unavailable" };
  }
  if (step.playwright) {
    const { report, problem } = prepared ?? readPlaywrightReport(gate, context, context.stepNumber);
    if (!report) return { ...base, status: "FAIL", reason: problem };
    const classified = classifyPlaywright(report, context.waivers ?? [], { projectSkips: Boolean(gate.projectSkips), passed: context.passed, skipProofs: context.skipProofs });
    let status = classified.status;
    let reason = classified.reasons.join("; ");
    if (status === "FAIL" && !reason) reason = `${classified.counts.failed} failed, ${classified.counts.flaky} flaky/retried; first: ${classified.first}`;
    if (status === "BLOCKED") reason = `${classified.counts.blocked} test(s) skipped as BLOCKED`;
    if (status === "SKIPPED") reason = `${classified.counts.skipped} test(s) skipped without BLOCKED`;
    if (status === "PASS" && classified.projectSkipped > 0) reason = `${classified.projectSkipped} skip(s) by project condition; each such test passed on another project in this gate run`;
    let waived = classified.waived;
    if (code !== 0 && status === "PASS") { status = "FAIL"; reason = `exit code ${code} although the report shows no failure`; waived = false; }
    else if (code !== 0 && status !== "FAIL") { status = "FAIL"; reason = `exit code ${code}; ${reason}`; waived = false; }
    return {
      ...base,
      status,
      reason,
      counts: classified.counts,
      projectSkipped: classified.projectSkipped,
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
  const { npmCli = null } = context;
  const result = { id: gate.id, title: gate.title, command: npmCli ? commandOf(gate, npmCli) : gate.command, dataMode: dataModeOf(gate.id), status: "PASS", blockedKind: "", exitCode: null, reason: "", counts: null, artifacts: [], waived: false, waivedBy: [], first: null, detail: "" };
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

  // D-68: an offline gate brings its own server (production build of the checkout under the harness) and its own invented values.
  let offline = null;
  if (gate.offline) {
    const harnessPath = path.join(worktree, OFFLINE_HARNESS);
    let values;
    try {
      values = deps.loadOfflineEnv(harnessPath);
    } catch (error) {
      return blocked("ENV", `offline harness could not be loaded: ${clip(error?.message ?? error)}`);
    }
    const childEnv = offlineChildEnv(deps.env, values);
    const server = deps.startServer({ worktree, env: offlineServerEnv(childEnv, harnessPath), buildEnv: childEnv, artifactsDir, gateId: gate.id });
    if (!server?.ok) return blocked("ENV", `offline server did not answer on 127.0.0.1:${OFFLINE_PORT}: ${server?.reason ?? "no reason given"}`);
    offline = { env: childEnv, server };
  }

  // Every step is run (and its report read) first; the steps are classified afterwards, together, so that a skip in one step can be
  // explained by a pass in another step of the same gate run (D-69, G4).
  const executed = [];
  let stopProblem = "";
  try {
    gate.steps.forEach((step, index) => {
      const stepNumber = index + 1;
      const args = step.playwright ? [...step.args, "--output", path.join(artifactsDir, step.outputName ?? `${gate.id}-${stepNumber}`)] : step.args;
      if (step.playwright) deps.fs.rmSync(path.join(worktree, PLAYWRIGHT_RESULTS), { force: true });
      const call = invocation(step.file, args, npmCli);
      const run = deps.exec(call.file, call.args, { cwd: worktree, env: offline ? offline.env : deps.env, timeoutMs: step.playwright ? 90 * 60_000 : 30 * 60_000 });
      const logName = `${gate.id}-${stepNumber}.log`;
      deps.fs.writeFileSync(path.join(artifactsDir, logName), `$ ${displayStep(gate.id, step, index, npmCli)}\n# exit ${run.status}\n${run.stdout ?? ""}\n${run.stderr ?? ""}\n`);
      result.artifacts.push(logName);
      if (step.playwright) {
        result.artifacts.push(`${gate.id}-${stepNumber}-results.json`);
        result.artifacts.push(`${step.outputName ?? `${gate.id}-${stepNumber}`}/`);
      }
      executed.push({ step, stepNumber, run, prepared: step.playwright && !run.error ? readPlaywrightReport(gate, context, stepNumber) : null });
    });
  } finally {
    if (offline) {
      const stopped = deps.stopServer(offline.server);
      if (!stopped?.stopped) stopProblem = `the offline server (pid ${offline.server.pid ?? "?"}) could not be stopped`;
    }
  }
  const skipEvidence = gateWideSkipEvidence(gate, executed, context);
  const evaluated = executed.map((item) => ({ ...evaluateStep(gate, item.step, item.run, { ...context, ...skipEvidence, stepNumber: item.stepNumber }, item.prepared), exit: item.run.status }));

  let worst = evaluated[0];
  for (const step of evaluated) if (PRIORITY[step.status] > PRIORITY[worst.status]) worst = step;
  result.status = worst.status;
  result.reason = worst.status === "PASS" ? evaluated.map((step) => step.reason).filter(Boolean).join("; ") : worst.reason;
  result.first = evaluated.find((step) => step.first)?.first ?? null;
  result.detail = evaluated.find((step) => step.detail)?.detail ?? "";
  result.exitCode = evaluated.find((step) => step.exit !== 0)?.exit ?? evaluated[evaluated.length - 1].exit;
  result.blockedKind = worst.status === "BLOCKED" ? worst.blockedKind : "";
  const withCounts = evaluated.filter((step) => step.counts);
  if (withCounts.length > 0) {
    result.counts = withCounts.reduce((sum, step) => ({ passed: sum.passed + step.counts.passed, failed: sum.failed + step.counts.failed, flaky: sum.flaky + step.counts.flaky, skipped: sum.skipped + step.counts.skipped, blocked: sum.blocked + step.counts.blocked }), { passed: 0, failed: 0, flaky: 0, skipped: 0, blocked: 0 });
  }
  result.projectSkipped = evaluated.reduce((sum, step) => sum + (step.projectSkipped ?? 0), 0);
  const failing = evaluated.filter((step) => step.status === "FAIL");
  result.waived = failing.length > 0 && failing.every((step) => step.waived);
  result.waivedBy = [...new Set(failing.flatMap((step) => step.waivedBy))];
  if (stopProblem) {
    result.status = "FAIL";
    result.blockedKind = "";
    result.waived = false;
    result.waivedBy = [];
    result.reason = [stopProblem, result.reason].filter(Boolean).join("; ");
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Evidence: rendering and verification.

export function renderStatus(result) {
  if (result.status === "FAIL" && result.waived) return `FAIL (waived${result.waivedBy?.length ? `: ${result.waivedBy.join(", ")}` : ""})`;
  if (result.status === "BLOCKED") return `BLOCKED${result.blockedKind ? ` (${result.blockedKind})` : ""}`;
  return result.status;
}

/** `npm: <x.y.z> (<source>)`, or `npm: неизвестно (<source>): <error>` when the version could not be measured. */
function npmLine(npm) {
  const source = tableCell(npm.source ?? NPM_PATH_SOURCE);
  if (npm.version) return `npm: ${npm.version} (${source})`;
  const error = String(npm.error ?? "").replace(/\s+/g, " ").trim();
  return `npm: неизвестно (${source})${error ? `: ${error}` : ""}`;
}

/** `passed/failed/skipped/flaky`, plus ` (по проекту N)` when N skips are explained by a project condition (D-69, G4). */
const renderCounts = (counts, projectSkipped = 0) => (counts ? `${counts.passed}/${counts.failed}/${counts.skipped}/${counts.flaky}${projectSkipped > 0 ? ` (по проекту ${projectSkipped})` : ""}` : "-");

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
    ...(run.npm ? [npmLine(run.npm)] : []),
    `Режим: ${run.partial ? `partial (${(run.only ?? []).join(", ")})` : "full"}`,
    `Начало: ${run.startedAt}`,
    `Каталог артефактов: \`${run.artifactsDir}\``,
    "",
    "## Гейты",
    "",
    "| Gate | Команда | Exit | Статус | Passed/Failed/Skipped/Flaky | Артефакты | Данные |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const result of run.results) {
    lines.push(`| ${result.id} | \`${tableCell(result.command)}\` | ${result.exitCode ?? "-"} | ${tableCell(renderStatus(result))} | ${renderCounts(result.counts, result.projectSkipped)} | ${tableCell((result.artifacts ?? []).join(", ") || "-")} | ${tableCell(result.dataMode ?? dataModeOf(result.id))} |`);
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
  if (Array.isArray(run.visual)) {
    lines.push("", `## ${VISUAL_SECTION}`, "", "| Пункт | Статус | Доказательство |", "|---|---|---|");
    for (const row of run.visual) lines.push(`| ${tableCell(row.id)} | ${tableCell(row.status)} | ${tableCell(row.evidence ?? "-")} |`);
  }
  lines.push("", "## Окружение (только имена)", "", "| Переменная | Задана |", "|---|---|");
  for (const entry of run.env ?? []) lines.push(`| ${entry.name} | ${entry.present ? "да" : "нет"} |`);
  lines.push("", "## Итог", "", `Итог: ${run.verdict}`, "");
  for (const reason of run.reasons ?? []) lines.push(`- ${tableCell(reason)}`);
  return `${lines.join("\n")}\n`;
}

const statusToken = (cell) => String(cell ?? "").trim().match(/^(PASS|FAIL|BLOCKED|SKIPPED)\b/)?.[1] ?? null;

/** `10/0/3/0` or `10/0/3/0 (по проекту 3)`; the older form without the suffix reads as zero skips by project. */
function parseCounts(cell) {
  const match = String(cell ?? "").trim().match(/^(\d+)\/(\d+)\/(\d+)\/(\d+)(?:\s+\(по проекту (\d+)\))?$/);
  return match ? { passed: Number(match[1]), failed: Number(match[2]), skipped: Number(match[3]), flaky: Number(match[4]), projectSkipped: Number(match[5] ?? 0) } : null;
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
    if (counts && counts.projectSkipped > 0) {
      if (!gate.projectSkips) errors.push(`${id}: counts carry «по проекту ${counts.projectSkipped}» but the gate has no project-skip rule (D-69), every skip counts`);
      else if (counts.projectSkipped > counts.skipped) errors.push(`${id}: «по проекту ${counts.projectSkipped}» is larger than the skipped count ${counts.skipped}`);
    }
    if (status === "PASS") {
      if (exit !== "0") errors.push(`${id}: PASS row has exit "${exit}", expected 0`);
      if (gate.counts) {
        if (!counts) errors.push(`${id}: PASS row has no Passed/Failed/Skipped/Flaky counts`);
        else {
          if (counts.passed === 0) errors.push(`${id}: PASS row has 0 passed tests`);
          if (counts.failed > 0) errors.push(`${id}: PASS row has ${counts.failed} failed test(s)`);
          if (counts.flaky > 0) errors.push(`${id}: PASS row has ${counts.flaky} flaky/retried test(s)`);
          const unexplained = counts.skipped - (gate.projectSkips ? counts.projectSkipped : 0);
          if (gate.strictSkips && unexplained > 0) errors.push(`${id}: PASS row has ${unexplained} skipped test(s), a skip is not a pass`);
        }
      }
    }
    if (gate.offline) {
      const mode = String(cellsOfRow[6] ?? "").trim();
      if (mode !== OFFLINE_MODE) errors.push(`${id}: offline gate row must carry the data mode «${OFFLINE_MODE}», got "${mode || "(none)"}"`);
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

// ---------------------------------------------------------------------------------------------------------------------
// D-68: visual acceptance = the owner's overall verdict (20-58-SUMMARY.md) + the 20-12 baselines + unchanged product code.

/** `owner_verdict`, `owner_verdict_date`, `owner_verdict_commit` from the frontmatter of 20-58-SUMMARY.md; null without frontmatter. */
export function readOwnerVerdict(markdown) {
  const front = normalizeText(markdown).match(/^---\n([\s\S]*?)\n---/);
  if (!front) return null;
  const read = (name) => front[1].match(new RegExp(`^${name}:[ \\t]*(.*?)[ \\t]*$`, "m"))?.[1]?.replace(/^["']|["']$/g, "") ?? "";
  return { verdict: read("owner_verdict"), date: read("owner_verdict_date"), commit: read("owner_verdict_commit") };
}

const OWNER_WAITING = "ОЖИДАЕТ ВЛАДЕЛЬЦА";
const OWNER_SUMMARY_NAME = path.posix.basename(OWNER_SUMMARY_MD);

/**
 * The effective owner verdict: the last valid link of the chain that starts at 20-58-SUMMARY.md and continues with the summaries of
 * later plans of this phase that carry `owner_verdict_renews`. Returns { verdict, date, commit, source, chainError, baseCommit } or
 * null when 20-58-SUMMARY.md cannot be read. Without links the result is the 20-58 verdict, so nothing changes until an owner renews it.
 * D-68: a view is accepted only by the word of the owner, this function reads it and never writes it.
 * D-69: a change of the product code after the verdict needs a new word of the owner; the orchestrator records it as a link, the agent does not.
 * deps = { fs: { existsSync, readFileSync, readdirSync }, git(args), root }; `root` overrides deps.root (the worktree of a release commit).
 */
export function readEffectiveOwnerVerdict(deps, root = deps.root) {
  const readText = (relative) => {
    try {
      const target = path.join(root, relative);
      return deps.fs.existsSync(target) ? String(deps.fs.readFileSync(target, "utf8")) : null;
    } catch { return null; }
  };
  const baseText = readText(OWNER_SUMMARY_MD);
  const base = baseText === null ? null : readOwnerVerdict(baseText);
  if (!base) return null;
  let current = { ...base, source: OWNER_SUMMARY_NAME, chainError: "", baseCommit: base.commit };

  let names = [];
  try { names = deps.fs.readdirSync(path.join(root, PHASE_DIR)).map(String); } catch { names = []; }
  const links = names
    .map((name) => ({ name, plan: Number(name.match(/^20-(\d+)-SUMMARY\.md$/)?.[1] ?? Number.NaN) }))
    .filter((entry) => Number.isInteger(entry.plan) && entry.plan > 58)
    .sort((a, b) => a.plan - b.plan);

  for (const { name } of links) {
    const text = readText(`${PHASE_DIR}/${name}`);
    const front = text === null ? null : normalizeText(text).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? null;
    if (front === null || !/^owner_verdict(?:_date|_commit|_renews)?:/m.test(front)) continue; // not a link: a summary without owner fields
    const read = (field) => front.match(new RegExp(`^${field}:[ \\t]*(.*?)[ \\t]*$`, "m"))?.[1]?.replace(/^["']|["']$/g, "") ?? "";
    const link = { verdict: read("owner_verdict"), date: read("owner_verdict_date"), commit: read("owner_verdict_commit"), renews: read("owner_verdict_renews") };
    const problem = (() => {
      if (!link.renews) return "нет owner_verdict_renews";
      if (!link.verdict) return "нет owner_verdict";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(link.date)) return "нет даты ГГГГ-ММ-ДД";
      if (!/^[0-9a-f]{40}$/.test(link.commit)) return "owner_verdict_commit не 40 hex";
      if (link.renews !== current.commit) return `owner_verdict_renews ${link.renews.slice(0, 12)} не равен коммиту предыдущего звена ${String(current.commit).slice(0, 12)}`;
      if (link.commit === current.commit) return "коммит звена совпадает с коммитом предыдущего звена";
      if (current.date && link.date < current.date) return `дата ${link.date} раньше даты предыдущего звена ${current.date}`;
      if (deps.git(["cat-file", "-e", `${link.commit}^{commit}`]).status !== 0) return `коммита ${link.commit.slice(0, 12)} нет в репозитории`;
      if (deps.git(["merge-base", "--is-ancestor", current.commit, link.commit]).status !== 0) return `коммит ${link.commit.slice(0, 12)} не потомок коммита предыдущего звена`;
      return "";
    })();
    if (problem) {
      // The chain stops at the first break: later links are not used and the verdict is the one that waits for the owner.
      return { verdict: "", date: "", commit: current.commit, source: current.source, chainError: `цепочка вердиктов нарушена: ${name}: ${problem}`, baseCommit: base.commit };
    }
    current = { verdict: link.verdict, date: link.date, commit: link.commit, source: name, chainError: "", baseCommit: base.commit };
  }
  return current;
}

/** The status text of the «Общий вердикт» row. It is built only from a verdict that was read; the agent decides nothing. */
export function ownerStatusText(owner) {
  if (!owner || !owner.verdict || !/^\d{4}-\d{2}-\d{2}$/.test(owner.date)) return OWNER_WAITING;
  if (owner.verdict === "accepted") return `ПРИНЯТО ВЛАДЕЛЬЦЕМ ${owner.date}`;
  if (/^(fixes-requested|fix|rejected)$/.test(owner.verdict)) return `ИСПРАВИТЬ (владелец) ${owner.date}`;
  return OWNER_WAITING;
}

/** Non-test files of app, components, public and lib that differ between the two commits; null when git fails or `from` is empty. */
export function productCodeChanges(deps, from, to) {
  if (!from || !to) return null;
  const diff = deps.git(["diff", "--name-only", from, to, "--", "app", "components", "public", "lib"]);
  if (diff.status !== 0) return null;
  return String(diff.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !/\.test\./.test(line));
}

/** The three rows of «Визуальная приёмка владельца (D-68)». `baselines` = { commit, rows } or null, `changed` = file list or null. */
export function visualAcceptanceRows({ owner, baselines, changed, releaseCommit }) {
  const ownerCommit = owner?.commit ?? "";
  return [
    {
      id: "Общий вердикт",
      status: ownerStatusText(owner),
      evidence: owner
        ? `owner_verdict: ${owner.verdict || "нет"}; owner_verdict_date: ${owner.date || "-"}; owner_verdict_commit: ${ownerCommit || "-"}; источник: ${owner.source ?? OWNER_SUMMARY_NAME}${owner.chainError ? `; ${owner.chainError}` : ""}`
        : `${OWNER_SUMMARY_NAME} не прочитан`,
    },
    {
      id: "Эталоны 20-12",
      status: baselines ? `${baselines.rows} строк реестра` : "BLOCKED (ENV): реестр не прочитан",
      evidence: `${BASELINES_JSON}; коммит вердикта реестра: ${baselines?.commit || "-"}`,
    },
    {
      id: "Код продукта",
      status: changed === null || changed === undefined ? "BLOCKED (ENV): git diff не выполнен" : changed.length === 0 ? "НЕ ИЗМЕНЁН" : `ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: ${changed.join(", ")}`,
      evidence: `git diff --name-only ${ownerCommit ? ownerCommit.slice(0, 12) : "<owner_verdict_commit>"} ${String(releaseCommit ?? "").slice(0, 12)} -- app components public lib (без *.test.*)`,
    },
  ];
}

/** Caps the run verdict by the visual acceptance: no owner «принято», changed product code or a red visual gate never gives PASS. */
export function applyVisualAcceptance(verdict, rows, results = null) {
  const status = (id) => String(rows.find((row) => row.id === id)?.status ?? "");
  const verdictStatus = status("Общий вердикт");
  const codeStatus = status("Код продукта");
  const reasons = [];
  let cap = "PASS";
  if (verdictStatus.startsWith("ИСПРАВИТЬ")) { cap = "FAIL"; reasons.push(`Общий вердикт: ${verdictStatus}`); }
  else if (!verdictStatus.startsWith("ПРИНЯТО ВЛАДЕЛЬЦЕМ")) { cap = "BLOCKED"; reasons.push(`Общий вердикт: ${verdictStatus || OWNER_WAITING} (D-68)`); }
  if (codeStatus.startsWith("ИЗМЕНЁН")) { cap = "FAIL"; reasons.push(`Код продукта: ${codeStatus}`); }
  else if (codeStatus !== "НЕ ИЗМЕНЁН" && cap === "PASS") { cap = "BLOCKED"; reasons.push(`Код продукта: ${codeStatus || "не определён"}`); }
  if (results && cap === "PASS") {
    const red = VISUAL_GATES.filter((id) => results.some((row) => row.id === id && row.status !== "PASS"));
    if (red.length > 0 && verdict.startsWith("PASS")) { cap = "FAIL"; reasons.push(`визуальные гейты не PASS: ${red.join(", ")}`); }
  }
  if (VERDICT_RANK[cap] < VERDICT_RANK[verdict]) return { verdict: cap, reasons };
  return { verdict, reasons: [] };
}

/** Rows of the visual section for a release commit, read from that commit's worktree (commit-bound). */
function computeVisualRows(deps, created) {
  let owner = null;
  let baselines = null;
  try {
    // The chain is read from the worktree of the release commit (commit-bound), the git checks run against the shared repository.
    owner = readEffectiveOwnerVerdict(deps, created.path);
  } catch { owner = null; }
  try {
    const registerPath = path.join(created.path, BASELINES_JSON);
    if (deps.fs.existsSync(registerPath)) {
      const register = JSON.parse(deps.fs.readFileSync(registerPath, "utf8"));
      baselines = { commit: String(register?.ownerVerdict?.commit ?? ""), rows: Array.isArray(register?.rows) ? register.rows.length : 0 };
    }
  } catch { baselines = null; }
  const changed = owner?.commit ? productCodeChanges(deps, owner.commit, created.commit) : null;
  return visualAcceptanceRows({ owner, baselines, changed, releaseCommit: created.commit });
}

const OWNER_STATUS_FORMS = "«ПРИНЯТО ВЛАДЕЛЬЦЕМ ГГГГ-ММ-ДД», «ИСПРАВИТЬ (владелец) ГГГГ-ММ-ДД» or «ОЖИДАЕТ ВЛАДЕЛЬЦА»";

/** Problems of the visual section; `info.stated` is the verdict word of the protocol, `info.gateRows` its parsed gate rows. */
function verifyVisualSection(text, deps, info) {
  const errors = [];
  const visual = sectionTable(text, VISUAL_SECTION);
  if (!visual) return { errors: [`table «${VISUAL_SECTION}» is missing`], verdictOk: false, codeOk: false };
  const byId = new Map(visual.rows.map((row) => [normalizeLabel(row[0] ?? ""), row]));
  const row = (id) => byId.get(normalizeLabel(id));
  for (const id of VISUAL_ROWS) if (!row(id)) errors.push(`${id}: visual acceptance row is missing`);

  const hasSummary = typeof deps.ownerSummary === "string" && deps.ownerSummary.trim() !== "";
  const baseOwner = hasSummary ? readOwnerVerdict(deps.ownerSummary) ?? { verdict: "", date: "", commit: "" } : null;
  // D-69: the verdict and the product code follow the effective link of the chain; the baselines stay with 20-58.
  const owner = deps.effectiveOwner !== undefined ? deps.effectiveOwner : baseOwner;
  const ownerSource = owner?.source ?? OWNER_SUMMARY_NAME;
  const chainNote = owner?.chainError ? ` (${owner.chainError})` : "";
  const registerAuthority = baseOwner?.commit ?? owner?.baseCommit ?? owner?.commit ?? "";
  let verdictOk = false;
  let codeOk = false;

  const verdictRow = row("Общий вердикт");
  if (verdictRow) {
    const status = String(verdictRow[1] ?? "").trim();
    if (verdictRow.some((cell) => /(?<!не\s)(?<!not\s)\bPASS\b/i.test(cell))) errors.push("Общий вердикт: an owner verdict row must not contain PASS (it is the owner's word, never an agent result)");
    const accepted = status.match(/^ПРИНЯТО ВЛАДЕЛЬЦЕМ (\d{4}-\d{2}-\d{2})/);
    if (accepted) {
      if (!owner) errors.push(`Общий вердикт: row says ПРИНЯТО ВЛАДЕЛЬЦЕМ, but ${OWNER_SUMMARY_NAME} is unreadable`);
      else if (owner.verdict !== "accepted") errors.push(`Общий вердикт: row says ПРИНЯТО ВЛАДЕЛЬЦЕМ, but ${ownerSource} has owner_verdict "${owner.verdict}"${chainNote}`);
      else if (owner.date !== accepted[1]) errors.push(`Общий вердикт: date ${accepted[1]} differs from owner_verdict_date ${owner.date || "(none)"} in ${ownerSource}`);
      else verdictOk = true;
    } else if (!/^ИСПРАВИТЬ \(владелец\) \d{4}-\d{2}-\d{2}/.test(status) && !/^ОЖИДАЕТ ВЛАДЕЛЬЦА/.test(status)) {
      errors.push(`Общий вердикт: status must be ${OWNER_STATUS_FORMS}, got "${status || "(empty)"}"`);
    }
  }

  const registerRow = row("Эталоны 20-12");
  if (registerRow) {
    const hits = registerRow.join(" ").match(/\b[0-9a-f]{40}\b/g);
    if (!hits) errors.push("Эталоны 20-12: no verdict commit (40 hex) in the row");
    else {
      const ownerCommit = registerAuthority;
      for (const hit of new Set(hits)) if (ownerCommit && hit !== ownerCommit) errors.push(`Эталоны 20-12: commit ${hit.slice(0, 12)} differs from owner_verdict_commit ${ownerCommit.slice(0, 12)} of 20-58-SUMMARY.md`);
    }
    if (deps.baselinesCommit !== undefined) {
      if (!deps.baselinesCommit) errors.push(`Эталоны 20-12: register ${BASELINES_JSON} is unreadable or has no ownerVerdict.commit`);
      else if (registerAuthority && deps.baselinesCommit !== registerAuthority) errors.push(`Эталоны 20-12: register ${BASELINES_JSON} has ownerVerdict.commit ${deps.baselinesCommit.slice(0, 12)} but 20-58-SUMMARY.md has owner_verdict_commit ${registerAuthority.slice(0, 12)}`);
    }
  }

  const codeRow = row("Код продукта");
  if (codeRow) {
    const status = String(codeRow[1] ?? "").trim();
    const releaseCommit = text.match(/^Commit:\s*`?([0-9a-f]{40})`?\s*$/m)?.[1];
    const recompute = () => (typeof deps.productChanges === "function" && owner?.commit && releaseCommit ? deps.productChanges(owner.commit, releaseCommit) : undefined);
    if (status === "НЕ ИЗМЕНЁН") {
      const changed = recompute();
      if (changed === null) errors.push("Код продукта: claims НЕ ИЗМЕНЁН but the diff cannot be recomputed");
      else if (Array.isArray(changed) && changed.length > 0) errors.push(`Код продукта: claims НЕ ИЗМЕНЁН but ${changed.join(", ")} changed since owner_verdict_commit`);
      else codeOk = true;
    } else if (/^ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: \S/.test(status)) {
      const changed = recompute();
      if (Array.isArray(changed) && changed.length === 0) errors.push("Код продукта: claims ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА but the recomputed diff is empty");
    } else if (!/^BLOCKED/.test(status)) {
      errors.push(`Код продукта: status must be «НЕ ИЗМЕНЁН», «ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: <файлы>» or BLOCKED, got "${status || "(empty)"}"`);
    }
  }

  if (info.stated?.startsWith("PASS")) {
    if (!verdictOk) errors.push(`verdict ${info.stated} needs «Общий вердикт» = «ПРИНЯТО ВЛАДЕЛЬЦЕМ ГГГГ-ММ-ДД» matching ${ownerSource}${chainNote}`);
    if (!codeOk) errors.push(`verdict ${info.stated} needs «Код продукта» = «НЕ ИЗМЕНЁН»`);
    for (const id of VISUAL_GATES) {
      const gateRow = info.gateRows.find((candidate) => candidate.id === id);
      if (gateRow && (gateRow.status !== "PASS" || gateRow.waived)) errors.push(`verdict ${info.stated} needs ${id} = PASS (a waived or red visual gate is not acceptance)`);
    }
  }
  return { errors, verdictOk, codeOk };
}

/**
 * Every problem in 20-RELEASE-EVIDENCE.md. deps = { commitExists(sha) => boolean, matrix: string | null, ownerSummary: string | null,
 * baselinesCommit?: string | null, productChanges?(from, to) => string[] | null }.
 * Checks: commit, Node, gates and data modes, D-33 table, «Решения D-35..D-45», production rows, «Визуальная приёмка владельца (D-68)»,
 * verdict versus gates, matrix blockers and the owner's verdict.
 */
export function verifyEvidence(markdown, deps = {}) {
  const errors = [];
  const text = normalizeText(markdown);
  if (text.trim() === "") return ["evidence is empty"];

  const commit = text.match(/^Commit:\s*`?([0-9A-Za-z]+)`?\s*$/m)?.[1];
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) errors.push("commit is missing or not a full 40-hex sha");
  else if (typeof deps.commitExists === "function" && !deps.commitExists(commit)) errors.push(`commit ${commit.slice(0, 12)} does not exist in this repository`);
  if (!/^Node:\s*v22\.13\.\d+\s*$/m.test(text)) errors.push("Node line is missing or is not 22.13.x");
  // D-69 (G5): the npm that ran the gates is part of the evidence.
  const npmValue = text.match(/^npm:[ \t]*(.*?)[ \t]*$/m)?.[1];
  const npmSource = "(?:--npm-cli \\S.*|PATH npm\\.cmd)";
  let npmUnknown = false;
  if (npmValue === undefined) errors.push("npm line is missing: the npm that ran the gates must be recorded as «npm: <x.y.z> (<source>)» (D-69)");
  else if (new RegExp(`^\\d+\\.\\d+\\.\\d+ \\(${npmSource}\\)$`).test(npmValue)) npmUnknown = false;
  else if (new RegExp(`^неизвестно \\(${npmSource}\\)(?:: .*)?$`).test(npmValue)) npmUnknown = true;
  else errors.push(`npm line is malformed ("${npmValue}"): expected «npm: <x.y.z> (--npm-cli <path>)» or «npm: <x.y.z> (PATH npm.cmd)»`);
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
  errors.push(...verifyVisualSection(text, deps, { stated: stated && VERDICTS.includes(stated) ? stated : undefined, gateRows: gates.rows }).errors);
  if (!stated || !VERDICTS.includes(stated)) errors.push(`verdict line «Итог:» is missing or unknown ("${stated ?? ""}")`);
  else {
    if (npmUnknown && stated.startsWith("PASS")) errors.push(`npm line says the version is unknown: verdict ${stated} needs a measured npm version`);
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
// 20-15: lineage RC -> FRC, release verdict and phase closure under D-70.
// D-70 is an accepted risk of the owner, not an acceptance: no step and no device verdict becomes PASS because of it.
// The release verdict is never stronger than PASS-WITH-OWNER-WAIVERS and never stronger than the gates.

export const UAT_MD = `${PHASE_DIR}/20-UAT.md`;
export const CONTEXT_MD = `${PHASE_DIR}/20-CONTEXT.md`;
export const RECONCILIATION_MD = `${PHASE_DIR}/20-RECONCILIATION.md`;
export const RELEASE_REHEARSAL_SUMMARY_MD = `${PHASE_DIR}/20-63-SUMMARY.md`;
export const D70_VERDICT = "ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)";
/** Environment lanes whose BLOCKED status the owner accepted as debt under D-70; a BLOCKED gate outside this list blocks the closure. */
export const D70_DEBT_LANES = Object.freeze(["e2e-full", "mutation-attest", "e2e-mutation", "staging-live", "visual-phase20"]);
export const CLOSURE_WITH_DEBTS = "С ПРИНЯТЫМИ ДОЛГАМИ (D-70)";
const CLOSURE_BLOCKED = "ЗАБЛОКИРОВАНО";

const isD70 = (ownerAcceptance) => ownerAcceptance === "D-70" || ownerAcceptance === D70_VERDICT;

/**
 * The release verdict: the worst of the runner verdict and (under D-70) PASS-WITH-OWNER-WAIVERS. An unknown verdict is FAIL.
 * @param {any} runnerVerdict
 * @param {string | null} [ownerAcceptance]
 */
export function releaseVerdict(runnerVerdict, ownerAcceptance = null) {
  const known = VERDICTS.includes(runnerVerdict) ? runnerVerdict : "FAIL";
  if (!isD70(ownerAcceptance)) return known;
  return VERDICT_RANK[known] <= VERDICT_RANK["PASS-WITH-OWNER-WAIVERS"] ? known : "PASS-WITH-OWNER-WAIVERS";
}

/**
 * The closing line of the phase. «С ПРИНЯТЫМИ ДОЛГАМИ (D-70)» only without an unwaived FAIL gate, without a high, with an accepted effective
 * owner verdict, a correct D-70 ledger, a release verdict that is not PASS/FAIL, and with every BLOCKED gate among D70_DEBT_LANES.
 * results = [{ id, status, waived? }], owner = effective owner verdict or null, high = ids of matrix blockers, ledgerErrors = D-70 ledger errors.
 * @param {{ results?: any[], verdict?: any, high?: string[], owner?: any, ledgerErrors?: string[] }} [input]
 */
export function phaseClosure({ results = [], verdict, high = [], owner = null, ledgerErrors = [] } = {}) {
  const reasons = [];
  const failed = results.filter((row) => row.status === "FAIL" && !row.waived).map((row) => row.id);
  if (failed.length > 0) reasons.push(`FAIL-гейт без принятого waiver: ${failed.join(", ")}`);
  const outside = results.filter((row) => row.status === "BLOCKED" && !D70_DEBT_LANES.includes(row.id)).map((row) => row.id);
  if (outside.length > 0) reasons.push(`BLOCKED-гейт вне полос D-70: ${outside.join(", ")}`);
  const skipped = results.filter((row) => row.status === "SKIPPED").map((row) => row.id);
  if (skipped.length > 0) reasons.push(`SKIPPED-гейт: ${skipped.join(", ")}`);
  if (high.length > 0) reasons.push(`неразрешённый high (D-12): ${high.join(", ")}`);
  if (!owner || owner.verdict !== "accepted" || owner.chainError) reasons.push("действующий вердикт владельца не accepted (D-68)");
  if (ledgerErrors.length > 0) reasons.push(`журнал D-70 неверен: ${ledgerErrors[0]}`);
  if (verdict === "PASS") reasons.push("итог релиза PASS невозможен при принятом риске D-70");
  else if (verdict === "FAIL" || !VERDICTS.includes(verdict)) reasons.push(`итог релиза ${verdict ?? "не определён"}`);
  return reasons.length === 0 ? CLOSURE_WITH_DEBTS : `${CLOSURE_BLOCKED}: ${reasons.join("; ")}`;
}

const readRelative = (deps, relative) => {
  try {
    const target = path.join(deps.root, relative);
    return deps.fs.existsSync(target) ? String(deps.fs.readFileSync(target, "utf8")) : null;
  } catch { return null; }
};

const frontField = (markdown, name) =>
  normalizeText(markdown ?? "").match(/^---\n([\s\S]*?)\n---/)?.[1]?.match(new RegExp(`^${name}:[ \\t]*(.*?)[ \\t]*$`, "m"))?.[1]?.replace(/^["']|["']$/g, "") ?? "";

/**
 * Problems of the D-70 journal in 20-UAT.md. Returns { errors, recordCommit, candidate }.
 * The owner's words must repeat the line of D-70 in 20-CONTEXT.md; no step is PASS, no device verdict is PASS/FAIL or carries a commit.
 */
export function verifyD70Ledger(uat, context) {
  const errors = [];
  const text = normalizeText(uat ?? "");
  if (text.trim() === "") return { errors: ["20-UAT.md не прочитан"], recordCommit: "", candidate: "" };
  const candidate = frontField(text, "release_candidate_commit");
  if (!/^[0-9a-f]{40}$/.test(candidate)) errors.push("release_candidate_commit в начале файла не 40 hex");

  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^##\s+D-70:/.test(line));
  let recordCommit = "";
  if (start === -1) errors.push("нет раздела «D-70: принятие риска владельцем без UAT»");
  else {
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^##\s/.test(line));
    const section = (end === -1 ? rest : rest.slice(0, end)).join("\n");
    const words = section.match(/^- Слова владельца \(дословно\): «(.+)»\s*$/m)?.[1];
    if (!words) errors.push("слова владельца не записаны дословно в разделе D-70");
    else if (!normalizeText(context ?? "").includes(`«${words}»`)) errors.push("слова владельца не совпадают со строкой D-70 в 20-CONTEXT.md (перефразированы)");
    const answer = section.match(/^- Ответ владельца на варианты \(дословно\): «(.+)»\s*$/m)?.[1];
    if (answer !== "2") errors.push(`ответ владельца на варианты должен быть «2», записано «${answer ?? ""}»`);
    recordCommit = section.match(/^- Запись решения: .*?\bcommit ([0-9a-f]{40})\b/m)?.[1] ?? "";
    if (!recordCommit) errors.push("запись решения D-70 без commit (40 hex)");
    const release = section.match(/^- Release commit: ([0-9a-f]{40})\b/m)?.[1] ?? "";
    if (release && candidate && release !== candidate) errors.push(`Release commit раздела D-70 (${release.slice(0, 12)}) не равен release_candidate_commit (${candidate.slice(0, 12)})`);
  }

  for (const device of ["PC", "phone"]) {
    const verdict = text.match(new RegExp(`^Вердикт ${device}:[ \\t]*(.*?)[ \\t]*$`, "m"))?.[1];
    if (verdict === undefined) errors.push(`нет строки «Вердикт ${device}:»`);
    else if (verdict !== D70_VERDICT) errors.push(`вердикт ${device} «${verdict}» не равен «${D70_VERDICT}»: под D-70 нет ни PASS, ни FAIL, ни commit устройства (D-15 не применяется)`);
  }

  for (const [title, label] of [["Чек-лист PC", "PC"], ["Чек-лист phone", "phone"]]) {
    const table = sectionTable(text, title);
    if (!table) { errors.push(`нет таблицы «${title}»`); continue; }
    const statusAt = table.header.indexOf("Статус");
    const commitAt = table.header.indexOf("Commit");
    if (statusAt === -1 || commitAt === -1) { errors.push(`таблица «${title}» без колонок «Статус» и «Commit»`); continue; }
    for (const row of table.rows) {
      const id = stripTicks(row[0] ?? "");
      const status = String(row[statusAt] ?? "").trim();
      const commit = String(row[commitAt] ?? "").trim();
      if (/^PASS\b/.test(status)) errors.push(`шаг ${id} (${label}): статус PASS при D-70 (шаги не проходились)`);
      if (commit !== "-" && commit !== "") errors.push(`шаг ${id} (${label}): commit «${commit}» при D-70 (commit устройства нет)`);
    }
  }
  return { errors, recordCommit, candidate };
}

/** The deps of verifyEvidence, read from the repository (shared by --verify-evidence and the 20-15 modes). */
function evidenceDeps(deps) {
  const matrixPath = path.join(deps.root, MATRIX_MD);
  const summaryPath = path.join(deps.root, OWNER_SUMMARY_MD);
  const registerPath = path.join(deps.root, BASELINES_JSON);
  let baselinesCommit = null;
  try {
    if (deps.fs.existsSync(registerPath)) baselinesCommit = String(JSON.parse(deps.fs.readFileSync(registerPath, "utf8"))?.ownerVerdict?.commit ?? "") || null;
  } catch { baselinesCommit = null; }
  return {
    matrix: deps.fs.existsSync(matrixPath) ? deps.fs.readFileSync(matrixPath, "utf8") : null,
    ownerSummary: deps.fs.existsSync(summaryPath) ? deps.fs.readFileSync(summaryPath, "utf8") : null,
    effectiveOwner: readEffectiveOwnerVerdict(deps),
    baselinesCommit,
    productChanges: (from, to) => productCodeChanges(deps, from, to),
    commitExists: (sha) => deps.git(["cat-file", "-e", `${sha}^{commit}`]).status === 0,
  };
}

/** The three verdict lines of 20-RECONCILIATION.md: { runner, release, closure } (undefined when absent). */
export function readReconciliationVerdicts(markdown) {
  const text = normalizeText(markdown ?? "");
  const line = (label) => text.match(new RegExp(`^${label}:[ \\t]*(.+?)[ \\t]*$`, "m"))?.[1];
  return { runner: line("Итог раннера на FRC"), release: line("Итог релиза"), closure: line("Закрытие фазы") };
}

/**
 * --verify-lineage: RC -> FRC, the D-70 journal, the effective owner verdict, unchanged product code, the protocol of the FRC and the
 * verdict lines of 20-RECONCILIATION.md. Returns the list of problems. A git failure is a problem, never «unchanged».
 */
export function verifyLineage(deps) {
  const errors = [];
  const reconciliation = readRelative(deps, RECONCILIATION_MD);
  if (reconciliation === null) return ["20-RECONCILIATION.md не найден"];
  const frc = frontField(reconciliation, "final_release_commit");
  if (!/^[0-9a-f]{40}$/.test(frc)) return ["final_release_commit в 20-RECONCILIATION.md отсутствует или не 40 hex"];
  const short = (sha) => String(sha).slice(0, 12);

  const evidence = readRelative(deps, EVIDENCE_MD);
  let stated;
  let gateRows = [];
  if (evidence === null) errors.push("20-RELEASE-EVIDENCE.md не найден");
  else {
    const protocolCommit = normalizeText(evidence).match(/^Commit:\s*`?([0-9A-Za-z]+)`?\s*$/m)?.[1];
    if (protocolCommit !== frc) errors.push(`протокол: Commit ${short(protocolCommit ?? "нет")} не равен final_release_commit ${short(frc)}`);
    errors.push(...verifyEvidence(evidence, evidenceDeps(deps)).map((error) => `протокол: ${error}`));
    stated = normalizeText(evidence).match(/^Итог:\s*(\S+)/m)?.[1];
    gateRows = readGateRows(evidence, false).rows;
  }

  const uat = readRelative(deps, UAT_MD);
  const context = readRelative(deps, CONTEXT_MD);
  const ledger = verifyD70Ledger(uat, context);
  errors.push(...ledger.errors.map((error) => `20-UAT.md: ${error}`));

  const rehearsal = readRelative(deps, RELEASE_REHEARSAL_SUMMARY_MD);
  const candidate = frontField(rehearsal, "release_commit");
  if (!/^[0-9a-f]{40}$/.test(candidate)) errors.push("release_commit в 20-63-SUMMARY.md отсутствует или не 40 hex");
  else {
    if (ledger.candidate && ledger.candidate !== candidate) errors.push(`release_candidate_commit 20-UAT.md (${short(ledger.candidate)}) не равен release_commit 20-63-SUMMARY.md (${short(candidate)})`);
    const reconciled = frontField(reconciliation, "release_candidate_commit");
    if (reconciled !== candidate) errors.push(`release_candidate_commit 20-RECONCILIATION.md (${short(reconciled || "нет")}) не равен release_commit 20-63-SUMMARY.md (${short(candidate)})`);
    if (deps.git(["merge-base", "--is-ancestor", candidate, frc]).status !== 0) errors.push(`release_candidate_commit ${short(candidate)} не предок FRC ${short(frc)}`);
  }

  const owner = readEffectiveOwnerVerdict(deps);
  if (!owner) errors.push("20-58-SUMMARY.md не прочитан: действующий вердикт владельца неизвестен");
  else {
    if (owner.chainError) errors.push(owner.chainError);
    else if (owner.verdict !== "accepted") errors.push(`вердикт владельца (D-68) не accepted: "${owner.verdict || "нет"}" (${owner.source})`);
  }
  const evidenceSide = evidenceDeps(deps);
  if (!evidenceSide.baselinesCommit) errors.push(`реестр ${BASELINES_JSON} не прочитан или без ownerVerdict.commit`);
  else if (owner?.baseCommit && evidenceSide.baselinesCommit !== owner.baseCommit) errors.push(`реестр ${BASELINES_JSON}: ownerVerdict.commit ${short(evidenceSide.baselinesCommit)} не равен owner_verdict_commit 20-58-SUMMARY.md ${short(owner.baseCommit)}`);

  const unchanged = (from, label) => {
    if (!from) return;
    const changed = productCodeChanges(deps, from, frc);
    if (changed === null) errors.push(`git diff не выполнен (${label} ${short(from)}..FRC ${short(frc)}): изменения кода продукта неизвестны`);
    else if (changed.length > 0) errors.push(`код продукта изменён после ${label} (${short(from)}): ${changed.join(", ")}`);
  };
  unchanged(ledger.recordCommit, "записи D-70");
  if (owner?.commit) unchanged(owner.commit, "действующего вердикта");

  const blockers = matrixBlockers(readRelative(deps, MATRIX_MD));
  if (blockers === null) errors.push("20-SECURITY-MATRIX.md: раздел «Блокеры релиза (D-12)» не прочитан");
  else if (blockers.length > 0) errors.push(`неразрешённый high в матрице безопасности: ${blockers.join(", ")}`);

  const verdicts = readReconciliationVerdicts(reconciliation);
  const release = releaseVerdict(stated, "D-70");
  const closure = phaseClosure({ results: gateRows, verdict: release, high: blockers ?? [], owner, ledgerErrors: ledger.errors });
  if (verdicts.runner === undefined) errors.push("20-RECONCILIATION.md: нет строки «Итог раннера на FRC:»");
  else if (verdicts.runner !== stated) errors.push(`Итог раннера на FRC: ${verdicts.runner} не равен итогу протокола ${stated ?? "(нет)"}`);
  if (verdicts.release === undefined) errors.push("20-RECONCILIATION.md: нет строки «Итог релиза:»");
  else if (verdicts.release === "PASS") errors.push("Итог релиза: PASS невозможен при принятом риске владельца (D-70): не сильнее PASS-WITH-OWNER-WAIVERS");
  else if (verdicts.release !== release) errors.push(`Итог релиза: ${verdicts.release} не равен вычисленному ${release}`);
  if (verdicts.closure === undefined) errors.push("20-RECONCILIATION.md: нет строки «Закрытие фазы:»");
  else if (verdicts.closure !== closure) errors.push(`Закрытие фазы: ${verdicts.closure} не равно вычисленному: ${closure}`);
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------------
// 20-15 Task 2: --verify-docs. The register of accepted debts (D-70), release notes, requirement statuses and the decision rows.

export const REQUIREMENTS_MD = ".planning/REQUIREMENTS.md";
export const ROADMAP_MD = ".planning/ROADMAP.md";
export const RELEASE_NOTES_MD = `${PHASE_DIR}/20-RELEASE-NOTES.md`;
export const PHASE18_VERIFICATION_MD = ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-VERIFICATION.md";
export const PHASE19_VERIFICATION_MD = ".planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-VERIFICATION.md";
/** The four statuses a row of «Принятые долги (D-70)» may have; none of them is PASS or Complete. */
export const DEBT_STATUSES = Object.freeze(["Принятый долг (D-70)", "ОЖИДАЕТ ВЛАДЕЛЬЦА", "Отложено владельцем", "Вне D-70: решает владелец"]);
/** Phase 20 requirements that only the physical acceptance closed (D-70 (3)): they always have a register row. */
export const D70_MINIMUM_DEBTS = Object.freeze(["STAB-REL-05", "STAB-REL-06", "STAB-REL-07", "STAB-REL-08", "STAB-A11Y-01", "STAB-A11Y-02", "STAB-A11Y-03", "STAB-A11Y-04"]);
export const DEBT_TRACE_STATUS = "Accepted debt (D-70)";
export const DEBT_READING_MARK = "прочтение 20-CONTEXT.md D-70 (4)";
export const DEBT_PRODUCTION_ROWS = Object.freeze(["D-36(б) production", "D-47 production", "20261106000000"]);
export const DEBT_FRAMING_TODO = "todo 2026-11-08-template-builder-framing-dialog";
export const DEBT_SECTION = "Принятые долги (D-70)";
export const NOTES_D70_SECTION = "Приёмка владельцем без UAT (D-70)";
export const NOTES_D70_FIRST_SENTENCE = "Пошаговая приёмка на физических ПК и телефоне не проводилась.";
const DEVICE_SECTION = "Приёмка на устройствах: принятый риск владельца (D-70)";
const VISUAL_RECONCILIATION_SECTION = "Визуальная приёмка (D-68)";
const AGENT_PASS = /(?<!не\s)(?<!not\s)\b(?:PASS|Complete)\b/;

/** Checkboxes and traceability rows of REQUIREMENTS.md: { checked: Map(id -> bool), trace: Map(id -> { phase, status, line }) }. */
export function parseRequirements(markdown) {
  const checked = new Map();
  const trace = new Map();
  for (const line of normalizeText(markdown ?? "").split("\n")) {
    const box = /^- \[([ xX])\] \*\*(STAB-[A-Z0-9]+-\d+)\*\*/.exec(line);
    if (box) { checked.set(box[2], box[1] !== " "); continue; }
    const row = /^\|\s*(STAB-[A-Z0-9]+-\d+)\s*\|\s*Phase ([\d.]+)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (row) trace.set(row[1], { phase: row[2], status: row[3], line: line.trim() });
  }
  return { checked, trace };
}

/** The requirement IDs of the `**Requirements**:` line of the Phase 20 block of the roadmap. */
export function roadmapPhaseIds(roadmap, phase = 20) {
  const lines = normalizeText(roadmap ?? "").split("\n");
  const start = lines.findIndex((line) => new RegExp(`^### Phase ${phase}:`).test(line));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("### "));
  const line = (end === -1 ? rest : rest.slice(0, end)).find((candidate) => candidate.startsWith("**Requirements**:"));
  return line ? line.slice("**Requirements**:".length).split(",").map((id) => id.trim()).filter((id) => /^STAB-[A-Z0-9]+-\d+$/.test(id)) : [];
}

/** Number of `- truth:` items under a top-level key of a frontmatter. */
function frontmatterItems(markdown, key) {
  const front = normalizeText(markdown ?? "").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const lines = front.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) return 0;
  let count = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z_]+:/.test(line)) break;
    if (/^ {2}- truth:/.test(line)) count += 1;
  }
  return count;
}

/** The body of a `## <prefix>…` section (without the heading), or null. */
function sectionBody(markdown, prefix) {
  const lines = normalizeText(markdown ?? "").split("\n");
  const start = lines.findIndex((line) => /^##\s/.test(line) && line.replace(/^##\s+/, "").trim().startsWith(prefix));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/**
 * --verify-docs: the register «Принятые долги (D-70)» of 20-RECONCILIATION.md against REQUIREMENTS.md, ROADMAP.md, 18/19-VERIFICATION.md and the protocol of
 * the FRC; the final release notes; the sections for the device and visual acceptance; the STAB-VIS-03 / D-39 row. Returns the list of problems.
 */
export function verifyDocs(deps) {
  const errors = [];
  const short = (sha) => String(sha).slice(0, 12);
  const reconciliation = readRelative(deps, RECONCILIATION_MD);
  if (reconciliation === null) return ["20-RECONCILIATION.md не найден"];
  const frc = frontField(reconciliation, "final_release_commit");
  const planBase = frontField(reconciliation, "plan_base");
  const requirementsText = readRelative(deps, REQUIREMENTS_MD);
  const roadmapText = readRelative(deps, ROADMAP_MD);
  const evidence = readRelative(deps, EVIDENCE_MD);
  if (requirementsText === null) errors.push("REQUIREMENTS.md не найден");
  if (evidence === null) errors.push("20-RELEASE-EVIDENCE.md не найден");
  const requirements = parseRequirements(requirementsText);
  const phase20 = roadmapPhaseIds(roadmapText);
  if (phase20.length === 0) errors.push("ROADMAP.md: нет строки «**Requirements**» блока Phase 20");

  // The register.
  const table = sectionTable(reconciliation, DEBT_SECTION);
  const rows = new Map();
  if (!table) errors.push(`20-RECONCILIATION.md: нет раздела «${DEBT_SECTION}» (реестр принятых долгов)`);
  else {
    for (const row of table.rows) {
      const id = stripTicks(row[0] ?? "");
      if (id === "") continue;
      rows.set(id, row);
      const status = String(row[4] ?? "").trim();
      if (!DEBT_STATUSES.includes(status)) errors.push(`реестр: ${id}: статус «${status || "(пусто)"}» вне допустимых (${DEBT_STATUSES.join("; ")})`);
      if (AGENT_PASS.test(row.join(" "))) errors.push(`реестр: ${id}: строка содержит PASS или Complete (долг не доказательство)`);
    }
  }
  const need = (id, message) => { if (!rows.has(id)) errors.push(message); };

  for (const id of D70_MINIMUM_DEBTS) need(id, `реестр: ${id}: нет строки минимального набора D-70 (3)`);
  for (const id of rows.keys()) {
    const entry = requirements.trace.get(id);
    if (!entry || entry.phase !== "20") continue;
    if (requirements.checked.get(id) === true || entry.status === "Complete") errors.push(`${id}: требование реестра отмечено Complete или галочкой в REQUIREMENTS.md`);
    else if (entry.status !== DEBT_TRACE_STATUS) errors.push(`${id}: трассировка Phase 20 должна быть «${DEBT_TRACE_STATUS}», сейчас «${entry.status}»`);
  }
  for (const id of phase20) {
    const entry = requirements.trace.get(id);
    if (entry?.status === DEBT_TRACE_STATUS) need(id, `реестр: ${id}: «${DEBT_TRACE_STATUS}» в трассировке без строки реестра`);
  }
  for (const [id, entry] of requirements.trace) {
    if (entry.phase === "20" || entry.status === "Complete") continue;
    const open = `реестр: ${id} (Phase ${entry.phase}): нет строки открытого требования`;
    need(id, open);
    const row = rows.get(id);
    if (!row) continue;
    const expected = entry.phase === "18" || entry.phase === "19" ? DEBT_STATUSES[0] : DEBT_STATUSES[3];
    if (String(row[4] ?? "").trim() !== expected) errors.push(`реестр: ${id} (Phase ${entry.phase}): статус должен быть «${expected}»`);
    if ((entry.phase === "18" || entry.phase === "19") && !String(row[3] ?? "").includes(DEBT_READING_MARK)) errors.push(`реестр: ${id}: основание без пометки «${DEBT_READING_MARK}» (слова варианта 2 — слова оркестратора)`);
  }
  for (const [phase, file] of [["18", PHASE18_VERIFICATION_MD], ["19", PHASE19_VERIFICATION_MD]]) {
    const text = readRelative(deps, file);
    if (text === null) { errors.push(`${path.posix.basename(file)} не найден`); continue; }
    for (const [key, label] of [["gaps", "GAP"], ["behavior_unverified_items", "BU"]]) {
      for (let index = 1; index <= frontmatterItems(text, key); index += 1) need(`${phase}-VERIF-${label}-${index}`, `реестр: нет строки ${phase}-VERIF-${label}-${index} (${key} ${path.posix.basename(file)})`);
    }
  }
  need("CR-01", "реестр: нет строки CR-01 (Phase 19)");
  need("19-BLOCKED-DATA", "реестр: нет строки 19-BLOCKED-DATA (ячейки BLOCKED (DATA) фазы 19)");
  if (evidence !== null) {
    for (const row of readGateRows(evidence, false).rows) if (row.status === "BLOCKED") need(row.id, `реестр: нет строки: BLOCKED-гейт ${row.id} без реестра`);
  }
  for (const id of DEBT_PRODUCTION_ROWS) {
    const row = rows.get(id);
    if (!row) { errors.push(`реестр: нет строки ${id} (production-миграция владельца)`); continue; }
    if (String(row[4] ?? "").trim() !== "ОЖИДАЕТ ВЛАДЕЛЬЦА") errors.push(`реестр: ${id}: production-миграция — действие владельца, статус «ОЖИДАЕТ ВЛАДЕЛЬЦА» (даты применения владельцем нет), сейчас «${String(row[4] ?? "").trim()}»`);
  }
  const framing = [...rows.entries()].find(([id]) => id.startsWith(DEBT_FRAMING_TODO));
  if (!framing) errors.push(`реестр: нет строки ${DEBT_FRAMING_TODO}`);
  else if (String(framing[1][4] ?? "").trim() !== "Отложено владельцем") errors.push(`реестр: ${DEBT_FRAMING_TODO}: статус «Отложено владельцем»`);

  // Phase 15, 18 and 19 rows of REQUIREMENTS.md stay as at plan_base (D-34).
  if (/^[0-9a-f]{40}$/.test(planBase) && requirementsText !== null) {
    const base = deps.git(["show", `${planBase}:${REQUIREMENTS_MD}`]);
    if (base.status !== 0) errors.push(`REQUIREMENTS.md на plan_base ${short(planBase)} не прочитан`);
    else {
      const before = parseRequirements(base.stdout);
      for (const id of new Set([...before.trace.keys(), ...requirements.trace.keys()])) {
        const was = before.trace.get(id);
        const now = requirements.trace.get(id);
        const phase = (now ?? was)?.phase;
        if (phase === "20") continue;
        if (was?.line !== now?.line || before.checked.get(id) !== requirements.checked.get(id)) errors.push(`${id} (Phase ${phase}): строка REQUIREMENTS.md изменена относительно plan_base ${short(planBase)}`);
      }
    }
  } else errors.push("plan_base в 20-RECONCILIATION.md отсутствует или не 40 hex");

  // Release notes.
  const notes = readRelative(deps, RELEASE_NOTES_MD);
  if (notes === null) errors.push("20-RELEASE-NOTES.md не найден");
  else {
    const front = normalizeText(notes).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (!/^status:\s*final\s*$/m.test(front)) errors.push("20-RELEASE-NOTES.md: нужен status: final");
    if (frontField(notes, "release_commit") !== frc) errors.push(`20-RELEASE-NOTES.md: release_commit ${short(frontField(notes, "release_commit") || "нет")} не равен FRC ${short(frc)}`);
    const body = sectionBody(notes, NOTES_D70_SECTION);
    if (body === null) errors.push(`20-RELEASE-NOTES.md: нет раздела «${NOTES_D70_SECTION}»`);
    else if (!body.trim().startsWith(NOTES_D70_FIRST_SENTENCE)) errors.push(`20-RELEASE-NOTES.md: первое предложение раздела не «${NOTES_D70_FIRST_SENTENCE}»`);
    if (/^Вердикт (?:PC|phone):\s*PASS\b/m.test(normalizeText(notes))) errors.push("20-RELEASE-NOTES.md: вердикт устройства PASS в строке (приёмки не было)");
  }

  // The verdict lines and the device / visual sections of the reconciliation.
  const stated = evidence === null ? undefined : normalizeText(evidence).match(/^Итог:\s*(\S+)/m)?.[1];
  const release = releaseVerdict(stated, "D-70");
  const written = readReconciliationVerdicts(reconciliation).release;
  if (written !== undefined && VERDICT_RANK[written] !== undefined && VERDICT_RANK[written] > VERDICT_RANK[release]) errors.push(`Итог релиза: ${written} сильнее вычисленного ${release}`);

  const uat = readRelative(deps, UAT_MD);
  const words = normalizeText(uat ?? "").match(/^- Слова владельца \(дословно\): «(.+)»\s*$/m)?.[1];
  const device = sectionBody(reconciliation, DEVICE_SECTION);
  if (device === null) errors.push(`20-RECONCILIATION.md: нет раздела «${DEVICE_SECTION}»`);
  else {
    if (!words || !device.includes(`«${words}»`)) errors.push(`${DEVICE_SECTION}: слова владельца из 20-UAT.md не перенесены дословно`);
    if (!device.includes(D70_VERDICT)) errors.push(`${DEVICE_SECTION}: нет итога «${D70_VERDICT}»`);
    if (!device.includes("20-CONTEXT.md D-70")) errors.push(`${DEVICE_SECTION}: нет источника 20-CONTEXT.md D-70`);
    if (!device.includes("PORTIA_REQUIRE_UAT=1: красный")) errors.push(`${DEVICE_SECTION}: нет строки «PORTIA_REQUIRE_UAT=1: красный»`);
  }
  const owner = readEffectiveOwnerVerdict(deps);
  const visual = sectionBody(reconciliation, VISUAL_RECONCILIATION_SECTION);
  if (visual === null) errors.push(`20-RECONCILIATION.md: нет раздела «${VISUAL_RECONCILIATION_SECTION}»`);
  else if (!owner) errors.push(`${VISUAL_RECONCILIATION_SECTION}: 20-58-SUMMARY.md не прочитан`);
  else {
    const sourceText = readRelative(deps, `${PHASE_DIR}/${owner.source}`) ?? "";
    const quote = normalizeText(sourceText).match(/^> (.+)$/m)?.[1];
    if (!visual.includes(owner.commit)) errors.push(`${VISUAL_RECONCILIATION_SECTION}: нет owner_verdict_commit ${short(owner.commit)} действующего звена`);
    if (!visual.includes(owner.source)) errors.push(`${VISUAL_RECONCILIATION_SECTION}: нет ссылки на ${owner.source}`);
    if (!quote || !visual.includes(`«${quote}»`)) errors.push(`${VISUAL_RECONCILIATION_SECTION}: нет дословной цитаты владельца из ${owner.source}`);
  }

  // STAB-VIS-03 / D-39 and its sources.
  const vis03 = normalizeText(reconciliation).split("\n").find((line) => /^\|\s*STAB-VIS-03 \/ D-39\s*\|/.test(line));
  if (!vis03) errors.push("20-RECONCILIATION.md: нет строки STAB-VIS-03 / D-39");
  else if (!vis03.includes("20-58-SUMMARY.md") || !vis03.includes("20-12")) errors.push("строка STAB-VIS-03 / D-39 без ссылки на 20-58-SUMMARY.md и 20-12");
  for (const name of ["20-58-SUMMARY.md", "20-12-SUMMARY.md"]) if (readRelative(deps, `${PHASE_DIR}/${name}`) === null) errors.push(`${name}: источник строки STAB-VIS-03 / D-39 не найден`);
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------------
// 20-15 Task 3: --verify-reconciliation and --verify-independent.

export const RELEASE_SUMMARY_MD = `${PHASE_DIR}/20-RELEASE-SUMMARY.md`;
export const RELEASE_VERIFICATION_MD = `${PHASE_DIR}/20-RELEASE-VERIFICATION.md`;
export const DEPLOYED_EVIDENCE_MD = `${PHASE_DIR}/20-DEPLOYED-EVIDENCE.md`;
export const CLASS_MIGRATION_EVIDENCE_MD = `${PHASE_DIR}/20-CLASS-MIGRATION-EVIDENCE.md`;
export const EDITOR_NOTES_EVIDENCE_MD = `${PHASE_DIR}/20-EDITOR-NOTES-EVIDENCE.md`;
/** Lower bound of 20-NN-PLAN.md files (20-01 ... 20-58): protects against an empty or truncated listing. The real count is read from the files. */
export const MIN_PLAN_FILES = 58;
export const SELF_PLAN = 15;
export const SELF_ROW_NOTE = "SUMMARY создаётся после гейта; проверяется --verify-independent";
/** Paths that may change after the FRC: planning documents and the check modes of this plan. */
export const POST_FRC_PATHS = Object.freeze([".planning/", "scripts/phase20-release-gate.mjs", "lib/phase20-release-gate.test.ts"]);
const VERIFICATION_STATUSES = Object.freeze(["PASS", "FAIL", "BLOCKED", "Принятый долг (D-70)"]);

/** Numbers of the 20-NN-PLAN.md files of the phase directory, ascending; the list and every count derive from the files. */
export function listPlans(deps) {
  let names = [];
  try { names = deps.fs.readdirSync(path.join(deps.root, PHASE_DIR)).map(String); } catch { names = []; }
  return names.map((name) => Number(name.match(/^20-(\d+)-PLAN\.md$/)?.[1] ?? Number.NaN)).filter((plan) => Number.isInteger(plan)).sort((a, b) => a - b);
}

const planId = (plan) => `20-${String(plan).padStart(2, "0")}`;
const COMMIT_TOKEN = /\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/;

/**
 * --verify-reconciliation: lineage and docs checks, SUMMARY of every plan but 20-15, the crosswalk, release verification, deployed evidence,
 * the «Итог релиза» line in three documents and the files changed after the FRC. Returns the list of problems.
 */
export function verifyReconciliation(deps) {
  const errors = [...verifyLineage(deps), ...verifyDocs(deps)];
  const reconciliation = readRelative(deps, RECONCILIATION_MD);
  if (reconciliation === null) return errors;
  const frc = frontField(reconciliation, "final_release_commit");
  const short = (sha) => String(sha).slice(0, 12);
  const plans = listPlans(deps);
  if (plans.length < MIN_PLAN_FILES) errors.push(`перечислено меньше ${MIN_PLAN_FILES} файлов 20-NN-PLAN.md (${plans.length}): список пуст или усечён`);

  const crosswalkText = readRelative(deps, RELEASE_SUMMARY_MD);
  const crosswalk = new Map();
  if (crosswalkText === null) errors.push("20-RELEASE-SUMMARY.md не найден");
  else for (const line of normalizeText(crosswalkText).split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const row = cells(line);
    if (/^20-\d+$/.test(row[0] ?? "")) crosswalk.set(row[0], row);
  }

  for (const plan of plans) {
    const id = planId(plan);
    const row = crosswalk.get(id);
    if (crosswalkText !== null && !row) errors.push(`${id}: нет строки crosswalk в 20-RELEASE-SUMMARY.md`);
    if (plan === SELF_PLAN) {
      if (row && !row.join(" ").includes(SELF_ROW_NOTE)) errors.push(`${id}: строка crosswalk без пометки «${SELF_ROW_NOTE}»`);
      continue;
    }
    const name = `${id}-SUMMARY.md`;
    const text = readRelative(deps, `${PHASE_DIR}/${name}`);
    if (text === null) { errors.push(`${name}: SUMMARY отсутствует`); continue; }
    if (!/^status:\s*complete/m.test(normalizeText(text).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "")) errors.push(`${name}: status не complete`);
    if (!/^[0-9a-f]{7,40}$/.test(frontField(text, "plan_head_after")) && !COMMIT_TOKEN.test(text)) errors.push(`${name}: в SUMMARY нет commit`);
    if (row && !String(row[1] ?? "").includes(name)) errors.push(`${id}: строка crosswalk не называет ${name}`);
    if (row && !COMMIT_TOKEN.test(String(row[2] ?? ""))) errors.push(`${id}: в строке crosswalk нет commit`);
    if (plan === 14 && row && !row.join(" ").includes(D70_VERDICT)) errors.push(`${id}: строка crosswalk не содержит «${D70_VERDICT}»`);
  }

  // Release verification: a row per Phase 20 ID, consistent with REQUIREMENTS.md.
  const requirements = parseRequirements(readRelative(deps, REQUIREMENTS_MD));
  const verificationText = readRelative(deps, RELEASE_VERIFICATION_MD);
  if (verificationText === null) errors.push("20-RELEASE-VERIFICATION.md не найден");
  else {
    const byId = new Map();
    for (const line of normalizeText(verificationText).split("\n")) {
      if (!line.trimStart().startsWith("|")) continue;
      const row = cells(line);
      if (/^STAB-[A-Z0-9]+-\d+$/.test(row[0] ?? "")) byId.set(row[0], row);
    }
    for (const id of roadmapPhaseIds(readRelative(deps, ROADMAP_MD))) {
      const row = byId.get(id);
      if (!row) { errors.push(`${id}: нет строки в 20-RELEASE-VERIFICATION.md`); continue; }
      const status = String(row[1] ?? "").trim();
      const entry = requirements.trace.get(id);
      if (!VERIFICATION_STATUSES.includes(status)) errors.push(`${id}: статус «${status}» в 20-RELEASE-VERIFICATION.md вне ${VERIFICATION_STATUSES.join(", ")}`);
      else if (entry?.status === DEBT_TRACE_STATUS && status === "PASS") errors.push(`${id}: PASS у принятого долга в 20-RELEASE-VERIFICATION.md`);
      else if (entry?.status === DEBT_TRACE_STATUS && status !== "Принятый долг (D-70)") errors.push(`${id}: статус «${status}» в 20-RELEASE-VERIFICATION.md расходится с REQUIREMENTS.md (${DEBT_TRACE_STATUS})`);
      else if (entry?.status === "Complete" && status !== "PASS") errors.push(`${id}: статус «${status}» в 20-RELEASE-VERIFICATION.md расходится с REQUIREMENTS.md (Complete)`);
      else if (status === "Принятый долг (D-70)" && entry?.status !== DEBT_TRACE_STATUS) errors.push(`${id}: «Принятый долг (D-70)» в 20-RELEASE-VERIFICATION.md расходится с REQUIREMENTS.md (${entry?.status ?? "нет строки"})`);
      if (!String(row[3] ?? "").includes(frc)) errors.push(`${id}: в 20-RELEASE-VERIFICATION.md нет FRC ${short(frc)}`);
      if (String(row[2] ?? "").trim() === "") errors.push(`${id}: в 20-RELEASE-VERIFICATION.md нет источника`);
    }
    if (!normalizeText(verificationText).includes(`Приёмка на устройствах: ${D70_VERDICT}`)) errors.push(`20-RELEASE-VERIFICATION.md: нет строки «Приёмка на устройствах: ${D70_VERDICT}»`);
  }

  // «Итог релиза» is one and the same in three documents and never PASS.
  const expected = readReconciliationVerdicts(reconciliation).release;
  for (const [label, text] of [["20-RELEASE-SUMMARY.md", crosswalkText], ["20-RELEASE-VERIFICATION.md", verificationText]]) {
    if (text === null) continue;
    const value = normalizeText(text).match(/^Итог релиза:[ \t]*(.+?)[ \t]*$/m)?.[1];
    if (value === undefined) errors.push(`нет строки «Итог релиза:» в ${label}`);
    else if (value === "PASS") errors.push(`Итог релиза: PASS в ${label} невозможен при принятом риске владельца (D-70)`);
    else if (value !== expected) errors.push(`Итог релиза: ${value} в ${label} не равен 20-RECONCILIATION.md (${expected ?? "нет"})`);
  }

  // Deployed evidence: trusted metadata or an explicit BLOCKED.
  const deployed = readRelative(deps, DEPLOYED_EVIDENCE_MD);
  if (deployed === null) errors.push("20-DEPLOYED-EVIDENCE.md не найден");
  else {
    const body = normalizeText(deployed);
    const hasDeploy = /^Deploy ID:\s*\S+/m.test(body);
    const blocked = /^Статус:\s*BLOCKED\b/m.test(body);
    if (hasDeploy) {
      if (!/^Commit:\s*[0-9a-f]{7,40}\b/m.test(body) || !/^Источник:\s*\S/m.test(body)) errors.push("20-DEPLOYED-EVIDENCE.md: неподтверждённый deploy (нужны Commit и Источник доверенных метаданных)");
    } else if (!blocked) errors.push("20-DEPLOYED-EVIDENCE.md: неподтверждённый deploy (нет метаданных и нет явного BLOCKED)");
    if (blocked && /^Статус:\s*PASS\b/m.test(body)) errors.push("20-DEPLOYED-EVIDENCE.md: BLOCKED назван PASS");
  }

  for (const file of [UAT_MD, CLASS_MIGRATION_EVIDENCE_MD, EDITOR_NOTES_EVIDENCE_MD]) {
    if (readRelative(deps, file) === null) errors.push(`${path.posix.basename(file)}: источник сверки не найден`);
  }

  // After the FRC only planning documents and the check modes of this plan change.
  if (/^[0-9a-f]{40}$/.test(frc)) {
    const diff = deps.git(["diff", "--name-only", frc, "HEAD"]);
    if (diff.status !== 0) errors.push(`git diff FRC..HEAD не выполнен: изменения после ${short(frc)} неизвестны`);
    else for (const file of String(diff.stdout ?? "").split("\n").map((line) => line.trim()).filter(Boolean)) {
      if (!POST_FRC_PATHS.some((allowed) => (allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed))) errors.push(`после FRC ${short(frc)} изменён файл вне разрешённых путей: ${file}`);
    }
  }
  return errors;
}

/**
 * --verify-independent: the post-verifier gate. 20-15-SUMMARY.md and 20-VERIFICATION.md exist, the summary of every plan of the phase exists,
 * the FRC, the release verdict and the closure of 20-15-SUMMARY.md agree with the row of 20-15 and with 20-RECONCILIATION.md, and
 * `requirements-completed` holds no register debt. Returns the list of problems.
 */
export function verifyIndependent(deps) {
  const errors = [];
  const short = (sha) => String(sha).slice(0, 12);
  const reconciliation = readRelative(deps, RECONCILIATION_MD);
  if (reconciliation === null) return ["20-RECONCILIATION.md не найден"];
  const frc = frontField(reconciliation, "final_release_commit");
  const verdicts = readReconciliationVerdicts(reconciliation);
  for (const plan of listPlans(deps)) {
    const name = `${planId(plan)}-SUMMARY.md`;
    if (readRelative(deps, `${PHASE_DIR}/${name}`) === null) errors.push(`${name}: SUMMARY отсутствует`);
  }
  if (readRelative(deps, `${PHASE_DIR}/20-VERIFICATION.md`) === null) errors.push("20-VERIFICATION.md отсутствует (независимый verifier GSD не запускался)");
  const summary = readRelative(deps, `${PHASE_DIR}/20-15-SUMMARY.md`);
  if (summary === null) return [...errors, "20-15-SUMMARY.md отсутствует"];

  if (frontField(summary, "final_release_commit") !== frc) errors.push(`final_release_commit 20-15-SUMMARY.md (${short(frontField(summary, "final_release_commit") || "нет")}) не равен 20-RECONCILIATION.md (${short(frc)})`);
  if (frontField(summary, "release_verdict") !== verdicts.release) errors.push(`release_verdict 20-15-SUMMARY.md (${frontField(summary, "release_verdict") || "нет"}) не равен «Итог релиза» 20-RECONCILIATION.md (${verdicts.release ?? "нет"})`);
  if (frontField(summary, "phase_closure") !== verdicts.closure) errors.push(`phase_closure 20-15-SUMMARY.md (${frontField(summary, "phase_closure") || "нет"}) не равен «Закрытие фазы» 20-RECONCILIATION.md (${verdicts.closure ?? "нет"})`);

  const crosswalkText = readRelative(deps, RELEASE_SUMMARY_MD);
  const row = normalizeText(crosswalkText ?? "").split("\n").filter((line) => line.trimStart().startsWith("|")).map(cells).find((candidate) => candidate[0] === planId(SELF_PLAN));
  if (!row) errors.push("20-15: нет строки crosswalk в 20-RELEASE-SUMMARY.md");
  else if (!String(row[4] ?? "").includes(frc)) errors.push(`20-15: строка crosswalk не называет FRC ${short(frc)}`);
  const releaseLine = normalizeText(crosswalkText ?? "").match(/^Итог релиза:[ \t]*(.+?)[ \t]*$/m)?.[1];
  if (releaseLine !== undefined && frontField(summary, "release_verdict") !== releaseLine) errors.push(`release_verdict 20-15-SUMMARY.md не равен «Итог релиза» 20-RELEASE-SUMMARY.md (${releaseLine})`);

  const completed = frontField(summary, "requirements-completed").match(/STAB-[A-Z0-9]+-\d+/g) ?? [];
  const debt = new Set();
  const table = sectionTable(reconciliation, DEBT_SECTION);
  for (const registered of table?.rows ?? []) debt.add(stripTicks(registered[0] ?? ""));
  const requirements = parseRequirements(readRelative(deps, REQUIREMENTS_MD));
  for (const id of completed) {
    if (debt.has(id) || requirements.trace.get(id)?.status === DEBT_TRACE_STATUS) errors.push(`requirements-completed 20-15-SUMMARY.md содержит принятый долг ${id}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------------
// Orchestration.

// Offline server of a checkout (D-68). Synchronous on purpose: runGate is synchronous. The port is fixed (3100); a foreign listener is never taken over.

const PROBE_SCRIPT = [
  "const http = require('node:http');",
  "const url = process.argv[1];",
  "const deadline = Date.now() + Number(process.argv[2]);",
  "function once() {",
  "  const req = http.get(url, (res) => { res.resume(); process.exit(0); });",
  "  req.on('error', retry);",
  "  req.setTimeout(2000, () => req.destroy());",
  "}",
  "function retry() { if (Date.now() >= deadline) process.exit(1); setTimeout(once, 500); }",
  "once();",
].join("\n");

/** True when something answers HTTP at `url` within `timeoutMs`. */
function probeUrl(url, timeoutMs) {
  const run = spawnSync(process.execPath, ["-e", PROBE_SCRIPT, url, String(timeoutMs)], { timeout: timeoutMs + 10_000, windowsHide: true });
  return run.status === 0;
}

const builtWorktrees = new Set();

function startOfflineServer({ worktree, env, buildEnv, artifactsDir, gateId }) {
  if (probeUrl(OFFLINE_BASE_URL, 1500)) return { ok: false, reason: `${OFFLINE_BASE_URL} already answers; the runner does not take over a foreign server` };
  const nextBin = path.join(worktree, "node_modules", "next", "dist", "bin", "next");
  if (!builtWorktrees.has(worktree)) {
    const build = spawnSync(process.execPath, [nextBin, "build"], { cwd: worktree, env: buildEnv, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 20 * 60_000, windowsHide: true });
    nodeFs.writeFileSync(path.join(artifactsDir, "offline-build.log"), `$ next build (offline values)\n# exit ${build.status}\n${build.stdout ?? ""}\n${build.stderr ?? ""}\n`);
    if (build.status !== 0) return { ok: false, reason: `next build exited with ${build.status ?? build.error?.message ?? "no status"} (see offline-build.log)` };
    builtWorktrees.add(worktree);
  }
  const log = nodeFs.openSync(path.join(artifactsDir, `offline-server-${gateId}.log`), "a");
  let child;
  try {
    child = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(OFFLINE_PORT)], { cwd: worktree, env, detached: true, stdio: ["ignore", log, log], windowsHide: true });
  } finally {
    nodeFs.closeSync(log);
  }
  child.on("error", () => {});
  child.unref();
  if (!child.pid) return { ok: false, reason: "the server process did not start" };
  if (!probeUrl(OFFLINE_BASE_URL, 120_000)) {
    stopOfflineServer({ pid: child.pid });
    return { ok: false, reason: `no answer on ${OFFLINE_BASE_URL} within 120 s (see offline-server-${gateId}.log)`, pid: child.pid };
  }
  return { ok: true, pid: child.pid };
}

/** Stops the server this runner started, by its PID (and its tree on Windows), then proves the port is quiet. */
function stopOfflineServer(server) {
  const pid = server?.pid;
  if (!pid) return { stopped: true, pid: null };
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  else {
    try { process.kill(-pid, "SIGTERM"); } catch { try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ } }
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
  return { stopped: !probeUrl(OFFLINE_BASE_URL, 1500), pid };
}

/** OFFLINE_ENV of the harness file of the checkout. The harness installs itself only when the flag is set, so the flag is cleared while loading. */
function loadOfflineEnv(harnessPath) {
  const saved = process.env[OFFLINE_FLAG];
  delete process.env[OFFLINE_FLAG];
  try {
    return createRequire(harnessPath)(harnessPath).OFFLINE_ENV;
  } finally {
    if (saved !== undefined) process.env[OFFLINE_FLAG] = saved;
  }
}

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
    loadOfflineEnv,
    startServer: startOfflineServer,
    stopServer: stopOfflineServer,
    root: ROOT,
    env: process.env,
    tmpdir: os.tmpdir(),
    now: () => new Date().toISOString(),
    stamp: () => new Date().toISOString().replace(/[-:]/g, "").replace(".", ""),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  };
}

/** The absolute, slash-normalised path of an existing `npm-cli.js`; anything else is refused before a worktree is created. */
function validateNpmCli(value, deps) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "") throw new GateError("npm-cli-invalid", "--npm-cli needs the path of npm-cli.js");
  const resolved = path.resolve(raw);
  if (path.basename(resolved).toLowerCase() !== "npm-cli.js") throw new GateError("npm-cli-invalid", `${raw} is not an npm-cli.js file`);
  let isFile = false;
  try { isFile = deps.fs.existsSync(resolved) && deps.fs.statSync(resolved).isFile(); } catch { isFile = false; }
  if (!isFile) throw new GateError("npm-cli-invalid", `${raw} does not exist or is not a file`);
  return resolved.replace(/\\/g, "/");
}

/** `<npm> --version` once in the worktree, by the same invocation the gates use. An unmeasurable npm is recorded, not hidden. */
function measureNpm(deps, worktree, npmCli, needed) {
  const source = npmCli ? `--npm-cli ${npmCli}` : NPM_PATH_SOURCE;
  if (!needed) return { version: null, source, error: "no npm gate in this run" };
  const call = invocation(NPM_FILE, ["--version"], npmCli);
  let run;
  try {
    run = deps.exec(call.file, call.args, { cwd: worktree, env: deps.env, timeoutMs: 120_000 });
  } catch (error) {
    return { version: null, source, error: clip(error?.message ?? error) };
  }
  if (run.error) return { version: null, source, error: `could not run: ${clip(run.error.message ?? run.error)}` };
  const version = String(run.stdout ?? "").trim();
  if (run.status !== 0) return { version: null, source, error: `exit ${run.status}: ${clip(`${run.stderr ?? ""} ${run.stdout ?? ""}`)}` };
  if (!/^\d+\.\d+\.\d+$/.test(version)) return { version: null, source, error: `unexpected output of --version: ${clip(version)}` };
  return { version, source };
}

/**
 * One run of the chosen gates in a temporary clean worktree of `commit`.
 * @param {any} deps
 * @param {{ commit: string, only?: string[] | null, npmCli?: string | null }} options
 * @returns {any}
 */
export function runRelease(deps, options) {
  if (deps.env.PORTIA_E2E_TARGET_ENVIRONMENT === "production") throw new GateError("production-target", "PORTIA_E2E_TARGET_ENVIRONMENT is production; the release gate never runs against production");
  const only = options.only && options.only.length > 0 ? options.only : null;
  if (only) for (const id of only) if (!GATE_BY_ID.has(id)) throw new GateError("unknown-gate", id);
  if (typeof options.commit !== "string" || options.commit === "" || /^-|\s/.test(options.commit)) throw new GateError("bad-commit", "pass a sha or ref after --commit");
  const npmCli = options.npmCli === undefined || options.npmCli === null ? null : validateNpmCli(options.npmCli, deps);
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
    const npm = measureNpm(deps, created.path, npmCli, selected.some((gate) => gate.steps.some(isNpmStep)));
    for (const gate of selected) results.push(runGate(gate, { deps, worktree: created.path, artifactsDir, results, waivers, npmCli }));

    const treeClean = results.find((result) => result.id === "tree-clean");
    if (treeClean && treeClean.status === "PASS" && selected.some((gate) => gate.id !== "node-version" && gate.id !== "tree-clean")) {
      const after = deps.git(["status", "--porcelain"], { cwd: created.path });
      if (after.status !== 0 || String(after.stdout).trim() !== "") {
        treeClean.status = "FAIL";
        treeClean.reason = `worktree changed during the gates: ${clip(String(after.stdout).split("\n").slice(0, 5).join("; ") || after.stderr)}`;
      }
    }
    const verdict = aggregate(results, { playwright: includesPlaywright, waivers });
    // D-68: a full run is capped by the owner's overall verdict, the product code since that verdict and the visual gates.
    let visual = null;
    if (!only) {
      visual = computeVisualRows(deps, created);
      const capped = applyVisualAcceptance(verdict.verdict, visual, results);
      verdict.verdict = capped.verdict;
      verdict.reasons = [...verdict.reasons, ...capped.reasons];
    }
    const nodeVersion = results.find((result) => result.id === "node-version")?.detail || process.version;
    run = {
      schema: SCHEMA,
      commit: created.commit,
      node: nodeVersion,
      npm,
      startedAt,
      finishedAt: deps.now(),
      partial: Boolean(only),
      only: only ?? [],
      artifactsDir: artifactsRelative,
      results,
      visual,
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
  const errors = verifyEvidence(deps.fs.readFileSync(evidencePath, "utf8"), evidenceDeps(deps));
  // Extension point (20-15): --verify-lineage, --verify-docs and --verify-reconciliation attach here without touching the checks above.
  for (const extra of deps.extraEvidenceVerifiers ?? []) errors.push(...extra(deps));
  if (errors.length > 0) {
    deps.err(`${errors.map((error) => `[PORTIA_RELEASE_GATE:verify-failed] ${error}`).join("\n")}\n`);
    return 1;
  }
  deps.out("release evidence verified\n");
  return 0;
}

/** Runs a list-returning verifier of the 20-15 modes: exit 0 and a line when the list is empty, exit 1 and the reasons otherwise. */
function verifyListMode(deps, verifier, okLine) {
  const errors = verifier(deps);
  if (errors.length > 0) {
    deps.err(`${errors.map((error) => `[PORTIA_RELEASE_GATE:verify-failed] ${error}`).join("\n")}\n`);
    return 1;
  }
  deps.out(`${okLine}\n`);
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
    if (mode === "--verify-lineage") return verifyListMode(deps, verifyLineage, "lineage verified");
    if (mode === "--verify-docs") return verifyListMode(deps, verifyDocs, "docs verified");
    if (mode === "--verify-reconciliation") return verifyListMode(deps, verifyReconciliation, "reconciliation verified");
    if (mode === "--verify-independent") return verifyListMode(deps, verifyIndependent, "independent verification passed");
    if (mode === "--run") {
      const commit = option(argv, "--commit");
      if (!commit) {
        deps.err("usage: node scripts/phase20-release-gate.mjs --run --commit <sha> [--only id,id] [--npm-cli <path>]\n");
        return 2;
      }
      const only = option(argv, "--only")?.split(",").map((id) => id.trim()).filter(Boolean) ?? null;
      const npmCli = argv.includes("--npm-cli") ? option(argv, "--npm-cli") ?? "" : undefined;
      const run = runRelease(deps, { commit, only, npmCli });
      deps.out(`${run.partial ? "partial " : ""}run ${run.commit.slice(0, 12)}: ${run.verdict}\n`);
      for (const result of run.results) deps.out(`  ${result.id}\t${renderStatus(result)}\texit ${result.exitCode ?? "-"}\t${result.reason}\n`);
      deps.out(`artifacts: ${run.artifactsDir}\n`);
      return run.verdict === "PASS" || run.verdict === "PASS-WITH-OWNER-WAIVERS" ? 0 : 1;
    }
    deps.err("usage: node scripts/phase20-release-gate.mjs --plan | --self-check | --run --commit <sha> [--only id,id] [--npm-cli <path>] | --verify-evidence [--evidence <path>] | --verify-lineage | --verify-docs | --verify-reconciliation | --verify-independent\n");
    return 2;
  } catch (error) {
    deps.err(`${error instanceof GateError ? error.message : `[PORTIA_RELEASE_GATE:unexpected] ${error instanceof Error ? error.message : "unknown"}`}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
