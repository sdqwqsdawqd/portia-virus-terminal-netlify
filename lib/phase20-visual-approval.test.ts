import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

// Phase 20-11: fail-closed validation of the owner visual-approval ledger (20-VISUAL-APPROVAL.md).
// Default mode checks structure: every required surface/state/hash row exists and no row is approved without owner, date and exact hash.
// PORTIA_REQUIRE_APPROVAL=1 (Task 2 gate) additionally requires a positive verdict on every captured candidate and an answer to every owner question.
// Phase 20-29: the ledger frontmatter names the commit the candidates were captured on (candidates_commit); it must be a full
// 40-hex hash that exists in this repository and is an ancestor of HEAD, so a hash can be traced to the code it describes.

const root = path.resolve(import.meta.dirname, "..");
const ledgerPath = path.join(
  root,
  ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md",
);

const devices = ["pc", "phone"] as const;
const classKeys = ["lucidium", "transitium", "oblivium", "stabilar", "impulsar", "infernar", "isomorph", "polymorph", "xenomorph"] as const;

// Base ids that must exist for each device in `devices`.
const requiredBoth = [
  "spider-accent-default",
  "spider-accent-custom-dark",
  "spider-accent-custom-light",
  "spider-off",
  "spider-rest-sharp",
  "flasks-full",
  "flasks-off",
  "flasks-accent-default",
  "flasks-accent-custom-dark",
  "flasks-accent-custom-light",
  "empty-flask-news-default",
  "empty-flask-info",
  "empty-microscope-guide-default",
  "promotion-participant-gate-empty",
  "promotion-participant-cards",
  "promotion-reviewer-queue",
  // D-52 (20-38, 20-39): the template builder frames of 20-37.
  "template-builder-main",
  "template-builder-text",
  "template-builder-mutations",
  "template-builder-preview",
  ...classKeys.map((key) => `class-icon-${key}`),
];
// Info phone runs on two phone projects.
const requiredPhoneOnly = ["info-phone-open:phone", "info-phone-open:phone-webkit", "info-phone-article:phone", "info-phone-article:phone-webkit"];
const requiredQuestions = [
  "q-spider-shape",
  "q-spider-dark-legibility",
  "q-flasks-durations",
  "q-flasks-phone-crop",
  "q-class-transitium-faint",
  "q-class-phone-crop",
  "q-contrast-d10",
  "q-rel-08",
];
export const requiredIds = [...requiredBoth.flatMap((base) => devices.map((device) => `${base}:${device}`)), ...requiredPhoneOnly];

const statuses = new Set(["CANDIDATE", "BLOCKED (DATA)", "BLOCKED (ENV)", "BLOCKED (CAPTURE)"]);
const hex64 = /^[0-9a-f]{64}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export type LedgerRow = {
  id: string; surface: string; state: string; device: string; status: string;
  candidate: string; candidateSha: string; old: string; oldSha: string; note: string;
  verdict: string; date: string; approvedHash: string;
};
export type QuestionRow = { id: string; question: string; source: string; answer: string; date: string };

const unwrap = (cell: string) => cell.replace(/^`|`$/g, "").trim();

export function parseLedger(text: string): { rows: LedgerRow[]; questions: QuestionRow[] } {
  const rows: LedgerRow[] = [];
  const questions: QuestionRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim());
    if (cells[0] === "ID" || /^-+$/.test(cells[0])) continue;
    if (cells.length === 13) {
      rows.push({
        id: cells[0], surface: cells[1], state: cells[2], device: cells[3], status: cells[4],
        candidate: unwrap(cells[5]), candidateSha: cells[6], old: unwrap(cells[7]), oldSha: cells[8], note: cells[9],
        verdict: cells[10], date: cells[11], approvedHash: cells[12],
      });
    } else if (cells.length === 5 && cells[0].startsWith("q-")) {
      questions.push({ id: cells[0], question: cells[1], source: cells[2], answer: cells[3], date: cells[4] });
    }
  }
  return { rows, questions };
}

// Runs git and reports the exit code; status null means git itself could not run.
export type GitRunner = (args: string[]) => { status: number | null; error?: string; stdout?: string };

export function ledgerFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields: Record<string, string> = {};
  if (!match) return fields;
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (pair) fields[pair[1]] = pair[2].trim();
  }
  return fields;
}

export function candidatesCommitProblems(commit: string | undefined, git?: GitRunner): string[] {
  if (!commit) return ["candidates_commit: required field is missing from the ledger frontmatter"];
  if (!/^[0-9a-f]{40}$/.test(commit)) return [`candidates_commit: "${commit}" is not a full 40-hex commit hash`];
  if (!git) return [];
  const exists = git(["cat-file", "-e", `${commit}^{commit}`]);
  if (exists.status === null) return [`candidates_commit: git could not run: ${exists.error ?? "unknown error"}`];
  if (exists.status !== 0) return [`candidates_commit: ${commit} is not a commit in this repository (git cat-file exit ${exists.status})`];
  const ancestor = git(["merge-base", "--is-ancestor", commit, "HEAD"]);
  if (ancestor.status === null) return [`candidates_commit: git could not run: ${ancestor.error ?? "unknown error"}`];
  if (ancestor.status === 1) return [`candidates_commit: ${commit} is not an ancestor of HEAD`];
  if (ancestor.status !== 0) return [`candidates_commit: git merge-base failed with exit ${ancestor.status}`];
  return [];
}

const rejectedIds = ["spider-accent-custom-dark:pc", "spider-accent-custom-dark:phone", "class-icon-transitium:pc", "class-icon-transitium:phone"];

export function candidatesSetProblems(commit: string | undefined, set: string | undefined): string[] {
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) return [];
  return set === `phase20-refresh-${commit.slice(0, 12)}` ? [] : ["candidates_set does not match candidates_commit"];
}

// 20-37: rows rejected by the owner on 2026-11-06 (spider and flasks). spider-off is not here: its frame has no spider, so a redraw may leave its bytes unchanged.
export const rejectedIdsRound12 = [
  "spider-accent-default", "spider-accent-custom-dark", "spider-accent-custom-light", "spider-full-walk", "spider-motion-off", "spider-rest-sharp", "spider-rest-sharp-off",
  "flasks-full", "flasks-off", "flasks-reduced", "flasks-accent-default", "flasks-accent-custom-dark", "flasks-accent-custom-light",
].flatMap((base) => devices.map((device) => `${base}:${device}`));

const rejectedRounds = {
  11: { heading: /^## 11\. [^\r\n]+\r?\n/m, ids: rejectedIds },
  12: { heading: /^## 12\. [^\r\n]+\r?\n/m, ids: rejectedIdsRound12 },
} as const;

// Section 11 (20-33, 2026-11-05); the signature is kept for the existing tests.
export function rejectedFixProblems(text: string, rows: LedgerRow[], captureCommit: string | undefined, git?: GitRunner): string[] {
  return rejectedRoundProblems(text, rows, captureCommit, 11, git);
}

// One round of owner rejections: a ledger section "## <round>." with a table of rejected sha256, the owner's request and the fix commit.
// The candidate must not re-present the rejected bytes and must be captured after the fix commit.
export function rejectedRoundProblems(text: string, rows: LedgerRow[], captureCommit: string | undefined, round: keyof typeof rejectedRounds, git?: GitRunner): string[] {
  const { heading, ids } = rejectedRounds[round];
  const section = text.split(heading)[1]?.split(/^## /m)[0];
  if (!section) return [`section ${round}: rejected frames and fix commits are missing`];
  const errors: string[] = [];
  const fixes = new Map<string, { sha: string; commit: string }>();
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim().replace(/^`|`$/g, ""));
    if (cells.length !== 4 || !ids.includes(cells[0])) continue;
    if (fixes.has(cells[0])) errors.push(`${cells[0]}: duplicate rejected frame`);
    fixes.set(cells[0], { sha: cells[1], commit: cells[3] });
  }
  for (const id of ids) {
    const fix = fixes.get(id);
    if (!fix) { errors.push(`${id}: rejected frame is missing from section ${round}`); continue; }
    const row = rows.find((candidate) => candidate.id === id);
    if (!/^[0-9a-f]{64}$/.test(fix.sha)) errors.push(`${id}: rejected sha256 is malformed`);
    if (row?.candidateSha === fix.sha) errors.push(`${id}: re-presents the rejected frame`);
    if (!/^[0-9a-f]{40}$/.test(fix.commit)) { errors.push(`${id}: fix commit is not a full 40-hex hash`); continue; }
    if (!git || !captureCommit || !/^[0-9a-f]{40}$/.test(captureCommit)) continue;
    const exists = git(["cat-file", "-e", `${fix.commit}^{commit}`]);
    if (exists.status !== 0) { errors.push(`${id}: fix commit could not be verified (${exists.status ?? exists.error ?? "git unavailable"})`); continue; }
    const ancestor = git(["merge-base", "--is-ancestor", fix.commit, captureCommit]);
    if (ancestor.status !== 0) errors.push(`${id}: captured before the fix (${ancestor.status ?? ancestor.error ?? "git unavailable"})`);
  }
  return errors;
}

export function candidateMembershipProblems(rows: LedgerRow[], set: string | undefined): string[] {
  if (!set) return ["candidates_set is missing"];
  const prefix = `tests/e2e/visual-candidates/.runs/${set}/`;
  return rows.filter((row) => row.status === "CANDIDATE" && !row.candidate.startsWith(prefix))
    .map((row) => `${row.id}: captured outside candidates_set`);
}

// Files changed between the candidate commit and HEAD, limited to the product directories. A non-zero git exit is an error, not an empty list.
export function changedSinceCommit(commit: string, git: GitRunner): string[] {
  const result = git(["diff", "--name-only", commit, "HEAD", "--", "app", "components", "public", "lib"]);
  if (result.status === null) throw new Error(`git could not run: ${result.error ?? "unknown error"}`);
  if (result.status !== 0) throw new Error(`git diff --name-only ${commit} HEAD failed with exit ${result.status}`);
  return (result.stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

const productPrefixes = ["app/", "components/", "public/", "lib/"];
const isTestFile = (file: string) => /\.test\.(ts|tsx|mjs|js)$/.test(file);

// T-20-43: a candidate hash describes the code at candidates_commit. Product code (app, components, public, non-test lib) changed
// since then makes the candidates stale, so the owner cannot approve an out-of-date hash.
export function staleCandidateProblems(commit: string, deps: { changedSince: (commit: string) => string[] }): string[] {
  let changed: string[];
  try {
    changed = deps.changedSince(commit);
  } catch (error) {
    return [`stale candidates: could not compare with ${commit}: ${error instanceof Error ? error.message : String(error)}`];
  }
  return changed
    .filter((file) => productPrefixes.some((prefix) => file.startsWith(prefix)) && !isTestFile(file))
    .map((file) => `stale candidates: ${file} changed since ${commit}`);
}

type Options = {
  requireApproval?: boolean;
  requireSetMembership?: boolean;
  // Checks candidates_commit against the repository. Without it only the field shape is checked.
  git?: GitRunner;
  // Product files changed since candidates_commit; in the strict mode (requireApproval) any such file makes the candidates stale.
  changedSince?: (commit: string) => string[];
  // File checks run only for files that exist on this machine (the candidate directory is gitignored). Approval mode makes absence an error.
  fileSha?: (relativePath: string) => string | null;
};

export function validateLedger(text: string, options: Options = {}): string[] {
  const errors: string[] = [];
  const { rows, questions } = parseLedger(text);
  const byId = new Map<string, LedgerRow>();
  for (const row of rows) {
    if (byId.has(row.id)) errors.push(`${row.id}: duplicate row`);
    byId.set(row.id, row);
  }
  for (const id of requiredIds) if (!byId.has(id)) errors.push(`${id}: required row is missing`);
  for (const id of requiredQuestions) if (!questions.some((q) => q.id === id)) errors.push(`${id}: required owner question is missing`);

  const frontmatter = ledgerFrontmatter(text);
  const candidatesCommit = frontmatter.candidates_commit;
  errors.push(...candidatesCommitProblems(candidatesCommit, options.git));
  errors.push(...candidatesSetProblems(candidatesCommit, frontmatter.candidates_set));
  errors.push(...rejectedFixProblems(text, rows, candidatesCommit, options.git));
  errors.push(...rejectedRoundProblems(text, rows, candidatesCommit, 12, options.git));
  if (options.requireSetMembership) errors.push(...candidateMembershipProblems(rows, frontmatter.candidates_set));
  if (options.requireApproval && options.changedSince && /^[0-9a-f]{40}$/.test(candidatesCommit ?? "")) {
    errors.push(...staleCandidateProblems(candidatesCommit, { changedSince: options.changedSince }));
  }

  const fileSha = options.fileSha;
  for (const row of rows) {
    if (!statuses.has(row.status)) { errors.push(`${row.id}: unknown status "${row.status}"`); continue; }
    const blocked = row.status.startsWith("BLOCKED");
    if (blocked) {
      if (row.verdict !== "BLOCKED") errors.push(`${row.id}: a ${row.status} row must keep the verdict BLOCKED, got "${row.verdict}"`);
      if (!row.note) errors.push(`${row.id}: a BLOCKED row must say why`);
      continue;
    }
    if (!row.candidate || row.candidate === "-") errors.push(`${row.id}: candidate file is missing`);
    if (!hex64.test(row.candidateSha)) errors.push(`${row.id}: candidate sha256 is missing or malformed`);
    if (row.old && row.old !== "-" && !hex64.test(row.oldSha)) errors.push(`${row.id}: old reference has no sha256`);
    if (fileSha) {
      for (const [file, sha, label] of [[row.candidate, row.candidateSha, "candidate"], [row.old, row.oldSha, "old reference"]] as const) {
        if (!file || file === "-") continue;
        const actual = fileSha(file);
        if (actual === null) { if (options.requireApproval) errors.push(`${row.id}: ${label} file ${file} is not on disk`); }
        else if (actual !== sha) errors.push(`${row.id}: ${label} sha256 does not match ${file}`);
      }
    }
    if (row.verdict === "ОЖИДАЕТ") {
      if (options.requireApproval) errors.push(`${row.id}: owner verdict is still pending`);
      continue;
    }
    if (row.verdict === "принято") {
      if (!isoDate.test(row.date)) errors.push(`${row.id}: approved without an ISO date`);
      if (row.approvedHash !== row.candidateSha) errors.push(`${row.id}: approved hash is not the exact candidate sha256`);
      continue;
    }
    if (/^исправить:\s*\S/.test(row.verdict)) {
      if (options.requireApproval) errors.push(`${row.id}: owner asked for a fix: ${row.verdict}`);
      continue;
    }
    errors.push(`${row.id}: verdict must be "принято" or "исправить: <что>", got "${row.verdict}"`);
  }
  for (const q of questions) {
    if (q.answer === "ОЖИДАЕТ" || !q.answer || q.answer === "-") {
      if (options.requireApproval) errors.push(`${q.id}: owner answer is missing`);
    } else if (!isoDate.test(q.date)) errors.push(`${q.id}: answered without an ISO date`);
  }
  return errors;
}

const fileSha = (relativePath: string): string | null => {
  const full = path.join(root, relativePath);
  return existsSync(full) ? createHash("sha256").update(readFileSync(full)).digest("hex") : null;
};

const realGit: GitRunner = (args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { status: result.status, error: result.error?.message, stdout: result.stdout ?? "" };
};

const ledger = readFileSync(ledgerPath, "utf8");
const rowLine = (text: string, id: string) => text.split(/\r?\n/).find((line) => line.startsWith(`| ${id} |`))!;
const editRow = (text: string, id: string, edit: (cells: string[]) => void) => {
  const line = rowLine(text, id);
  const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
  edit(cells);
  return text.replace(line, `| ${cells.join(" | ")} |`);
};
const dropRow = (text: string, id: string) => text.split(/\r?\n/).filter((line) => !line.startsWith(`| ${id} |`)).join("\n");

describe("20-33 recapture guard", () => {
  const fixes = `\n## 11. Исправления по вердикту владельца 2026-11-05 (20-32, 20-33)\n\n| Строка | Отклонённый hash | Просьба владельца | Коммит исправления |\n| --- | --- | --- | --- |\n${rejectedIds.map((id) =>
    // A synthetic rejected hash: the real row may be BLOCKED (DATA) with no hash of its own on a target without the data.
    `| ${id} | ${"e".repeat(64)} | исправить | ${id.startsWith("spider-") ? "4fa4dd6b01495081da7730c93b0b2868aab8daf2" : "19d5bc28425127ea784dbaf7ac01098f85df5006"} |`,
  ).join("\n")}\n`;

  test("the real ledger lists four rejected frames in section 11", () => {
    const withoutSection = ledger.split(/^## 11\./m)[0];
    assert.ok(rejectedFixProblems(withoutSection, parseLedger(ledger).rows, ledgerFrontmatter(ledger).candidates_commit).some((error) => error.includes("section 11")));
    assert.deepEqual(rejectedFixProblems(ledger, parseLedger(ledger).rows, ledgerFrontmatter(ledger).candidates_commit), []);
    const oldRows = parseLedger(ledger).rows.map((row) => row.id === rejectedIds[0] ? { ...row, candidateSha: "c1abfadbaa755e38db6091897d0a2b08371753785ff65036318a3beb82bb8051" } : row);
    assert.ok(rejectedFixProblems(ledger, oldRows, ledgerFrontmatter(ledger).candidates_commit).some((error) => error.includes("re-presents the rejected frame")));
  });

  test("the rejected bytes cannot be presented again; git errors and pre-fix capture fail closed", () => {
    let fixture = `${ledger.split(/^## 11\./m)[0]}${fixes}`;
    for (const id of rejectedIds) fixture = editRow(fixture, id, (cells) => { cells[6] = "f".repeat(64); });
    const rows = parseLedger(fixture).rows;
    const capture = "346316129101a934c26f9305e6aeb03f75b5f458";
    assert.deepEqual(rejectedFixProblems(fixture, rows, capture, () => ({ status: 0 })), []);
    assert.ok(rejectedFixProblems(fixture, rows, capture, () => ({ status: 1 })).some((error) => error.includes("could not be verified")));
    assert.ok(rejectedFixProblems(fixture, rows, capture, (args) => ({ status: args[0] === "merge-base" ? 1 : 0 })).some((error) => error.includes("captured before the fix")));
  });

  test("set name follows the capture commit and membership is strict only when requested", () => {
    const commit = "346316129101a934c26f9305e6aeb03f75b5f458";
    assert.deepEqual(candidatesSetProblems(commit, "phase20-refresh-346316129101"), []);
    assert.ok(candidatesSetProblems(commit, "phase20-refresh-old").length);
    const rows = parseLedger(ledger).rows;
    assert.ok(candidateMembershipProblems(rows, "phase20-refresh-346316129101").some((error) => error.includes("captured outside candidates_set")));
    assert.ok(!validateLedger(`${ledger.split(/^## 11\./m)[0]}${fixes}`, { requireSetMembership: false }).some((error) => error.includes("captured outside candidates_set")));
  });
});

describe("20-37 recapture guard", () => {
  const rejected = rejectedIdsRound12;
  const spiderFix = "d7d917e466e77e43ea0fa7ae126c86810acd7b19";
  const flaskFix = "abddc8cc6efcf6aeb695fcfdc5800b51c1cffe4f";
  const header = "\n## 12. Исправления по вердикту владельца 2026-11-06 (20-35, 20-36, 20-37)\n\n| Строка | Отклонённый hash | Просьба владельца | Коммит исправления |\n| --- | --- | --- | --- |\n";
  const table = (ids: string[], hash = "d".repeat(64)) => `${header}${ids.map((id) => `| ${id} | ${hash} | исправить: тест | ${id.startsWith("spider-") ? spiderFix : flaskFix} |`).join("\n")}\n`;
  const withSection = (ids = rejected, hash?: string) => `${ledger.split(/^## 12\./m)[0]}${table(ids, hash)}`;
  const capture = "346316129101a934c26f9305e6aeb03f75b5f458";
  const rows = parseLedger(ledger).rows;

  test("section 12 lists 26 rejected frames and the real ledger has it", () => {
    assert.equal(rejected.length, 26);
    assert.ok(rejectedRoundProblems(ledger.split(/^## 12\./m)[0], rows, capture, 12).some((error) => error.includes("section 12: rejected frames and fix commits are missing")));
    assert.deepEqual(rejectedRoundProblems(withSection(), rows, capture, 12), []);
    assert.equal((ledger.match(/^## 12\. /gm) ?? []).length, 1);
    assert.deepEqual(rejectedRoundProblems(ledger, rows, ledgerFrontmatter(ledger).candidates_commit, 12), []);
  });

  test("a row missing from section 12 is an error; spider-off is not required there", () => {
    for (const id of ["spider-accent-default:pc", "flasks-reduced:phone", "spider-rest-sharp-off:phone"]) {
      assert.ok(rejectedRoundProblems(withSection(rejected.filter((candidate) => candidate !== id)), rows, capture, 12).some((error) => error === `${id}: rejected frame is missing from section 12`), id);
    }
    assert.ok(!rejected.some((id) => id.startsWith("spider-off:")));
    assert.deepEqual(rejectedRoundProblems(withSection(), rows, capture, 12).filter((error) => error.startsWith("spider-off")), []);
  });

  test("the rejected bytes cannot be presented again (a candidate with the rejected sha256 fails)", () => {
    const same = rows.find((row) => row.id === "flasks-full:pc")!;
    const errors = rejectedRoundProblems(withSection(rejected, same.candidateSha), rows, capture, 12);
    assert.ok(errors.some((error) => error === "flasks-full:pc: re-presents the rejected frame"));
    assert.ok(rejectedRoundProblems(withSection(rejected, "xyz"), rows, capture, 12).some((error) => error.includes("rejected sha256 is malformed")));
  });

  test("fix commit: malformed, unverifiable, captured before the fix, git not runnable all fail closed", () => {
    const fixture = withSection();
    assert.deepEqual(rejectedRoundProblems(fixture, rows, capture, 12, () => ({ status: 0 })), []);
    assert.ok(rejectedRoundProblems(fixture, rows, capture, 12, () => ({ status: 1 })).some((error) => error.includes("could not be verified")));
    assert.ok(rejectedRoundProblems(fixture, rows, capture, 12, () => ({ status: 128 })).some((error) => error.includes("could not be verified")));
    assert.ok(rejectedRoundProblems(fixture, rows, capture, 12, (args) => ({ status: args[0] === "merge-base" ? 1 : 0 })).some((error) => error.includes("captured before the fix")));
    assert.ok(rejectedRoundProblems(fixture, rows, capture, 12, (args) => ({ status: args[0] === "merge-base" ? null : 0, error: "spawn git ENOENT" })).some((error) => error.includes("captured before the fix")));
    assert.ok(rejectedRoundProblems(fixture, rows, capture, 12, () => ({ status: null, error: "spawn git ENOENT" })).some((error) => error.includes("could not be verified")));
    assert.ok(rejectedRoundProblems(fixture.replaceAll(spiderFix, "abc123"), rows, capture, 12).some((error) => error.includes("fix commit is not a full 40-hex hash")));
  });

  test("validateLedger runs both rounds: section 11 is unchanged, section 12 is added", () => {
    const fixture = withSection(rejected.slice(1));
    assert.ok(validateLedger(fixture).some((error) => error === "spider-accent-default:pc: rejected frame is missing from section 12"));
    assert.ok(validateLedger(ledger.split(/^## 12\./m)[0]).some((error) => error.includes("section 12: rejected frames and fix commits are missing")));
    assert.ok(!validateLedger(fixture).some((error) => error.includes("section 11")));
    assert.ok(validateLedger(ledger.split(/^## 11\./m)[0]).some((error) => error.includes("section 11: rejected frames and fix commits are missing")));
  });
});

describe("20-VISUAL-APPROVAL ledger structure (fail-closed)", () => {
  test("the committed ledger is structurally complete", () => {
    const errors = validateLedger(ledger, { fileSha, git: realGit });
    assert.deepEqual(errors, []);
  });

  test("candidates_commit is required, a full 40-hex hash, an existing commit and an ancestor of HEAD", () => {
    const commit = ledgerFrontmatter(ledger).candidates_commit;
    assert.match(commit, /^[0-9a-f]{40}$/);
    const without = ledger.replace(/^candidates_commit:.*\r?\n/m, "");
    assert.ok(validateLedger(without).some((error) => error.startsWith("candidates_commit: required field is missing")));
    for (const bad of [commit.slice(0, 12), commit.toUpperCase(), `${commit.slice(0, 39)}g`, ""]) {
      const broken = ledger.replace(/^candidates_commit:.*$/m, `candidates_commit: ${bad}`);
      assert.ok(validateLedger(broken).some((error) => error.startsWith("candidates_commit:")), `"${bad}" accepted`);
    }
    // A well-formed hash that is no commit of this repository: the real git must refuse it.
    const unknown = ledger.replace(/^candidates_commit:.*$/m, `candidates_commit: ${"0".repeat(40)}`);
    assert.ok(validateLedger(unknown, { git: realGit }).some((error) => error.includes("is not a commit in this repository")));
  });

  test("a non-zero git exit code is a check error, never a pass (cat-file, merge-base 1, merge-base 128, git not runnable)", () => {
    const commit = ledgerFrontmatter(ledger).candidates_commit;
    const run = (overrides: Record<string, number | null>): GitRunner => (args) => ({ status: args[0] in overrides ? overrides[args[0]] : 0, error: "spawn git ENOENT" });
    assert.deepEqual(candidatesCommitProblems(commit, run({})), []);
    assert.ok(candidatesCommitProblems(commit, run({ "cat-file": 128 }))[0].includes("is not a commit"));
    assert.ok(candidatesCommitProblems(commit, run({ "merge-base": 1 }))[0].includes("not an ancestor of HEAD"));
    assert.ok(candidatesCommitProblems(commit, run({ "merge-base": 128 }))[0].includes("merge-base failed with exit 128"));
    assert.ok(candidatesCommitProblems(commit, run({ "cat-file": null }))[0].includes("git could not run"));
    assert.ok(candidatesCommitProblems(commit, run({ "merge-base": null }))[0].includes("git could not run"));
  });

  test("every required surface has an address on PC and phone (spider, flasks, drawings, Promotion, icons, info phone)", () => {
    const { rows } = parseLedger(ledger);
    const ids = new Set(rows.map((row) => row.id));
    for (const id of requiredIds) assert.ok(ids.has(id), `${id} is missing`);
    assert.ok(requiredIds.length >= 54);
  });

  test("D-26/D-27: dropping any spider accent, the spider-off row or spider-rest-sharp fails, on each device", () => {
    for (const base of ["spider-accent-default", "spider-accent-custom-dark", "spider-accent-custom-light", "spider-off", "spider-rest-sharp"]) {
      for (const device of devices) {
        const id = `${base}:${device}`;
        const errors = validateLedger(dropRow(ledger, id));
        assert.ok(errors.some((error) => error.startsWith(`${id}: required row is missing`)), `${id} not enforced`);
      }
    }
  });

  test("D-39: dropping any of the nine class-icon rows fails, on each device", () => {
    for (const key of classKeys) {
      for (const device of devices) {
        const id = `class-icon-${key}:${device}`;
        const errors = validateLedger(dropRow(ledger, id));
        assert.ok(errors.some((error) => error.startsWith(`${id}: required row is missing`)), `${id} not enforced`);
      }
    }
    assert.ok((ledger.match(/class-icon-/g) ?? []).length >= 9);
  });

  test("a missing sha256 on a captured candidate fails", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status === "CANDIDATE")!;
    const broken = editRow(ledger, row.id, (cells) => { cells[6] = "-"; });
    assert.ok(validateLedger(broken).some((error) => error.includes("candidate sha256 is missing")));
  });

  test("a tampered sha256 is caught against the file on disk", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status === "CANDIDATE" && fileSha(r.candidate) !== null);
    if (!row) return; // candidates are gitignored; nothing on disk to compare on this machine
    const broken = editRow(ledger, row.id, (cells) => { cells[6] = "0".repeat(64); });
    assert.ok(validateLedger(broken, { fileSha }).some((error) => error.includes("does not match")));
  });

  test("approval needs an ISO date and the exact candidate hash", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status === "CANDIDATE")!;
    const pending = new RegExp(`^\\| ${row.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|.*$`, "m");
    const line = ledger.match(pending)![0];
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    const approve = (date: string, hash: string) => {
      const next = [...cells];
      next[10] = "принято"; next[11] = date; next[12] = hash;
      return ledger.replace(line, `| ${next.join(" | ")} |`);
    };
    assert.deepEqual(validateLedger(approve("2026-11-05", row.candidateSha)), []);
    assert.ok(validateLedger(approve("-", row.candidateSha)).some((error) => error.includes("ISO date")));
    assert.ok(validateLedger(approve("2026-11-05", "-")).some((error) => error.includes("exact candidate sha256")));
    assert.ok(validateLedger(approve("2026-11-05", "f".repeat(64))).some((error) => error.includes("exact candidate sha256")));
  });

  test("a BLOCKED row cannot be turned into an approval", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status.startsWith("BLOCKED"))!;
    assert.ok(row, "ledger must keep at least one BLOCKED row");
    const line = ledger.match(new RegExp(`^\\| ${row.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|.*$`, "m"))![0];
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    cells[10] = "принято"; cells[11] = "2026-11-05"; cells[12] = "a".repeat(64);
    const approved = ledger.replace(line, `| ${cells.join(" | ")} |`);
    assert.ok(validateLedger(approved).some((error) => error.startsWith(`${row.id}: a ${row.status} row must keep the verdict BLOCKED`)));
  });

  test("the committed ledger approves nothing before the owner decides", () => {
    if (process.env.PORTIA_REQUIRE_APPROVAL === "1") return; // verdicts are expected in the Task 2 gate
    const { rows, questions } = parseLedger(ledger);
    assert.ok(rows.every((row) => row.verdict === "ОЖИДАЕТ" || row.verdict === "BLOCKED" || row.verdict === "принято" || /^исправить:/.test(row.verdict)));
    assert.ok(questions.length >= requiredQuestions.length);
  });

  test("approval mode fails closed on pending rows and passes on a fully approved fixture", () => {
    const pendingErrors = validateLedger(ledger, { requireApproval: true });
    assert.ok(pendingErrors.length > 0 || process.env.PORTIA_REQUIRE_APPROVAL === "1");

    const approvedFixture = ledger
      .split(/\r?\n/)
      .map((line) => {
        if (!line.startsWith("| ")) return line;
        const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
        if (cells.length === 13 && cells[4] === "CANDIDATE") { cells[10] = "принято"; cells[11] = "2026-11-05"; cells[12] = cells[6]; return `| ${cells.join(" | ")} |`; }
        if (cells.length === 5 && cells[0].startsWith("q-")) { cells[3] = "решено"; cells[4] = "2026-11-05"; return `| ${cells.join(" | ")} |`; }
        return line;
      })
      .join("\n");
    assert.deepEqual(validateLedger(approvedFixture, { requireApproval: true }), []);

    const oneRejected = approvedFixture.replace("| принято |", "| исправить: глаза крупнее |");
    assert.ok(validateLedger(oneRejected, { requireApproval: true }).some((error) => error.includes("asked for a fix")));
  });
});

describe("stale candidates (20-29, T-20-43): product code changed after candidates_commit", () => {
  const H = ledgerFrontmatter(ledger).candidates_commit;

  test("nothing changed since the candidate commit gives no problem", () => {
    assert.deepEqual(staleCandidateProblems(H, { changedSince: () => [] }), []);
  });

  test("a changed component is a stale candidates problem naming the file and the commit", () => {
    assert.deepEqual(staleCandidateProblems(H, { changedSince: () => ["components/portia-desktop.tsx"] }), [
      `stale candidates: components/portia-desktop.tsx changed since ${H}`,
    ]);
  });

  test("lib/*.test.ts and everything outside app, components, public, lib are not counted", () => {
    const changed = ["lib/phase20-visual-approval.test.ts", "lib/other.test.ts", "tests/e2e/specs/a.ts", ".planning/STATE.md", "scripts/x.mjs", "package.json"];
    assert.deepEqual(staleCandidateProblems(H, { changedSince: () => changed }), []);
    const mixed = staleCandidateProblems(H, { changedSince: () => [...changed, "app/portia.css", "public/a.png", "lib/editor-notes.ts"] });
    assert.deepEqual(mixed, [
      `stale candidates: app/portia.css changed since ${H}`,
      `stale candidates: public/a.png changed since ${H}`,
      `stale candidates: lib/editor-notes.ts changed since ${H}`,
    ]);
  });

  test("a failing comparison (git diff exits non-zero or throws) is an error, never an empty list", () => {
    const failed = staleCandidateProblems(H, { changedSince: () => { throw new Error("git diff exited with 128"); } });
    assert.equal(failed.length, 1);
    assert.ok(failed[0].startsWith("stale candidates: could not compare with"));
    const git: GitRunner = () => ({ status: 128, error: undefined, stdout: "" });
    assert.throws(() => changedSinceCommit(H, git), /git diff .* exit 128/);
    const spawnFailed: GitRunner = () => ({ status: null, error: "spawn git ENOENT", stdout: "" });
    assert.throws(() => changedSinceCommit(H, spawnFailed), /could not run/);
    const ok: GitRunner = () => ({ status: 0, stdout: "app/portia.css\nlib/a.test.ts\r\ncomponents/x.tsx\n" });
    assert.deepEqual(changedSinceCommit(H, ok), ["app/portia.css", "lib/a.test.ts", "components/x.tsx"]);
  });

  test("the real comparison asks git for app components public lib only", () => {
    const calls: string[][] = [];
    changedSinceCommit(H, (args) => { calls.push(args); return { status: 0, stdout: "" }; });
    assert.deepEqual(calls, [["diff", "--name-only", H, "HEAD", "--", "app", "components", "public", "lib"]]);
  });

  test("strict mode (requireApproval) rejects a stale fixture; the ordinary mode does not", () => {
    const stale = { changedSince: () => ["components/portia-desktop.tsx"] };
    const strict = validateLedger(ledger, { requireApproval: true, ...stale });
    assert.ok(strict.some((error) => error.startsWith("stale candidates: components/portia-desktop.tsx changed since")));
    const ordinary = validateLedger(ledger, stale);
    assert.ok(!ordinary.some((error) => error.startsWith("stale candidates")));
  });

  test("the real ledger against the real repository: diagnostic by default, an error in the strict mode", (t) => {
    const problems = staleCandidateProblems(H, { changedSince: (commit) => changedSinceCommit(commit, realGit) });
    if (process.env.PORTIA_REQUIRE_APPROVAL === "1") assert.deepEqual(problems, []);
    else if (problems.length) t.diagnostic(`stale candidates (${problems.length}): ${problems.join("; ")}`);
    else t.diagnostic("candidates are fresh: no product code changed since candidates_commit");
  });
});

describe("Task 2 gate: owner verdicts (PORTIA_REQUIRE_APPROVAL=1)", () => {
  test("every captured candidate has an exact positive owner verdict and every owner question an answer", { skip: process.env.PORTIA_REQUIRE_APPROVAL !== "1" ? "run with PORTIA_REQUIRE_APPROVAL=1 after the owner fills the ledger" : false }, () => {
    assert.deepEqual(validateLedger(ledger, { requireApproval: true, requireSetMembership: true, fileSha, git: realGit, changedSince: (commit) => changedSinceCommit(commit, realGit) }), []);
  });
});
