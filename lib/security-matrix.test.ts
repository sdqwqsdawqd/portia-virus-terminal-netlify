import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// Structure checks for the Phase 20 security matrix (20-10). The matrix is evidence; this file keeps it honest:
// no empty matrix, no silent `open`, no unresolved high without a blocker, every medium in the release ledger.

const phaseDir = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza";
const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const matrixText = () => read(`${phaseDir}/20-SECURITY-MATRIX.md`);

/** Text of a `## heading` block, up to the next `## ` heading. Empty string when the heading is missing. */
function section(markdown: string, heading: string) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith("## ") && line.slice(3).trim().startsWith(heading));
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/** Data rows of the first table in the text: header and separator are skipped, cells are trimmed. */
function tableRows(text: string) {
  const lines = text.split("\n").filter((line) => line.trimStart().startsWith("|"));
  return lines.slice(2).map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
}

type Finding = {
  id: string; severity: string; area: string; source: string; evidence: string; status: string; fix: string; owner: string;
};

const severities = new Set(["critical", "high", "medium", "low", "info"]);
const statuses = new Set(["fixed", "release-ledger", "recorded", "reassessed", "blocker"]);
const areas = ["auth", "api", "rls", "headers", "csp", "uploads", "secrets", "dependencies"];

function findingsOf(markdown: string): Finding[] {
  return tableRows(section(markdown, "Находки")).map(([id, severity, area, source, evidence, status, fix, owner]) => ({
    id, severity, area, source, evidence, status, fix, owner,
  }));
}

const idsOf = (text: string) => tableRows(text).map((row) => row[0]);

/** Every structural problem of the matrix; an empty list means the matrix is acceptable. */
export function matrixProblems(markdown: string, sourceExists: (path: string) => boolean = () => true): string[] {
  const problems: string[] = [];
  const findings = findingsOf(markdown);
  if (findings.length === 0) return ["empty findings table"];

  const seen = new Set<string>();
  for (const finding of findings) {
    const label = finding.id || "(no id)";
    if (!finding.id) problems.push("finding without id");
    if (seen.has(finding.id)) problems.push(`${label}: duplicate id`);
    seen.add(finding.id);
    if (!severities.has(finding.severity)) problems.push(`${label}: unknown severity "${finding.severity}"`);
    if (!areas.includes(finding.area)) problems.push(`${label}: unknown area "${finding.area}"`);
    if (!statuses.has(finding.status)) problems.push(`${label}: status "${finding.status}" is not allowed (open is never allowed)`);
    for (const [name, value] of [["source", finding.source], ["evidence", finding.evidence], ["fix", finding.fix], ["owner", finding.owner]] as const) {
      if (!value) problems.push(`${label}: empty ${name}`);
    }
    const sourcePath = finding.source.replace(/`/g, "").replace(/:\d+(?:-\d+)?$/, "");
    if (sourcePath && !sourceExists(sourcePath)) problems.push(`${label}: source path does not exist: ${sourcePath}`);
  }

  const blockerIds = new Set(idsOf(section(markdown, "Блокеры релиза")));
  for (const finding of findings) {
    const high = finding.severity === "high" || finding.severity === "critical";
    if (high && finding.status !== "fixed" && finding.status !== "reassessed" && finding.status !== "blocker") {
      problems.push(`${finding.id}: unresolved ${finding.severity} without blocker`);
    }
    if (high && finding.status === "blocker" && !blockerIds.has(finding.id)) {
      problems.push(`${finding.id}: blocker is not listed in "Блокеры релиза"`);
    }
    if (high && finding.status === "reassessed" && !/D-12/.test(finding.fix)) {
      problems.push(`${finding.id}: reassessed ${finding.severity} needs an evidence-based D-12 note`);
    }
    if (finding.severity === "medium" && finding.status !== "release-ledger" && finding.status !== "fixed") {
      problems.push(`${finding.id}: medium finding must be fixed or recorded in the release ledger (D-09)`);
    }
  }

  const ledger = new Set(idsOf(section(markdown, "Релизный реестр")));
  const mediumIds = findings.filter((finding) => finding.severity === "medium" && finding.status === "release-ledger").map((finding) => finding.id);
  for (const id of mediumIds) if (!ledger.has(id)) problems.push(`${id}: missing from "Релизный реестр"`);
  for (const id of ledger) if (!findings.some((finding) => finding.id === id)) problems.push(`${id}: ledger row without a finding`);

  const covered = new Set(tableRows(section(markdown, "Покрытие по областям")).map((row) => row[0]));
  for (const area of areas) if (!covered.has(area)) problems.push(`area "${area}" has no coverage row`);
  return problems;
}

/** High and critical findings that block the release (D-12). */
export function blockingHighs(markdown: string) {
  return findingsOf(markdown).filter((finding) => (finding.severity === "high" || finding.severity === "critical") && finding.status === "blocker");
}

const goodMatrix = [
  "## Покрытие по областям", "| Область | Что | Метод | Результат |", "|---|---|---|---|",
  ...areas.map((area) => `| ${area} | x | y | PASS-local |`),
  "", "## Находки", "| ID | Severity | Area | Source | Reproduction / evidence | Status | Fix / acceptance | Owner |", "|---|---|---|---|---|---|---|---|",
  "| T-01 | medium | api | `lib/image-upload.ts:1` | evidence | release-ledger | accepted | owner |",
  "| T-02 | low | csp | `next.config.ts` | evidence | recorded | note | owner |",
  "", "## Релизный реестр (D-09)", "| ID | Что |", "|---|---|", "| T-01 | text |",
  "", "## Блокеры релиза (D-12)", "| ID | Severity | Блокирует |", "|---|---|---|", "| нет | нет | нет |", "",
].join("\n");

const withFinding = (row: string) => goodMatrix.replace("| T-02 |", `${row}\n| T-02 |`);

test("the real matrix is non-empty, structurally valid and every source path exists", () => {
  const markdown = matrixText();
  assert.ok(findingsOf(markdown).length >= 10, "deep review must record its findings");
  const problems = matrixProblems(markdown, (path) => existsSync(new URL(`../${path}`, import.meta.url)));
  assert.deepEqual(problems, []);
});

test("the real matrix covers auth, API, RLS, headers, CSP, uploads, secrets and dependencies", () => {
  const markdown = matrixText();
  const covered = new Set(tableRows(section(markdown, "Покрытие по областям")).map((row) => row[0]));
  for (const area of areas) assert.ok(covered.has(area), area);
  for (const finding of findingsOf(markdown)) {
    assert.ok(finding.evidence.length > 20, `${finding.id}: evidence is a reproduction or a source, not a label`);
  }
});

test("D-12: the release has no confirmed unfixed high finding", () => {
  const markdown = matrixText();
  assert.deepEqual(blockingHighs(markdown).map((finding) => finding.id), []);
  assert.ok(findingsOf(markdown).every((finding) => finding.severity !== "high" && finding.severity !== "critical" || finding.status === "fixed" || finding.status === "reassessed"));
});

test("D-09: every medium finding is in the release ledger and the ledger has no orphan rows", () => {
  const markdown = matrixText();
  const mediums = findingsOf(markdown).filter((finding) => finding.severity === "medium");
  assert.ok(mediums.length > 0);
  for (const finding of mediums) assert.ok(["release-ledger", "fixed"].includes(finding.status), finding.id);
});

test("fixture: the well-formed matrix is accepted", () => {
  assert.deepEqual(matrixProblems(goodMatrix), []);
});

test("fixture: an empty matrix is rejected", () => {
  assert.deepEqual(matrixProblems(""), ["empty findings table"]);
  assert.deepEqual(matrixProblems("## Находки\n| ID | Severity |\n|---|---|\n"), ["empty findings table"]);
});

test("fixture: an unresolved high without a blocker is rejected", () => {
  const problems = matrixProblems(withFinding("| T-03 | high | auth | `lib/image-upload.ts` | evidence | open | todo | owner |"));
  assert.ok(problems.some((problem) => problem.includes("T-03") && problem.includes("not allowed")), problems.join("; "));
  const recorded = matrixProblems(withFinding("| T-03 | high | auth | `lib/image-upload.ts` | evidence | recorded | todo | owner |"));
  assert.ok(recorded.some((problem) => problem.includes("T-03: unresolved high without blocker")), recorded.join("; "));
});

test("fixture: a high blocker must be listed in the blockers section and blocks the release", () => {
  const unlisted = withFinding("| T-03 | high | auth | `lib/image-upload.ts` | evidence | blocker | todo | owner |");
  assert.ok(matrixProblems(unlisted).some((problem) => problem.includes("T-03: blocker is not listed")));
  const listed = unlisted.replace("| нет | нет | нет |", "| T-03 | high | да |");
  assert.deepEqual(matrixProblems(listed), []);
  assert.deepEqual(blockingHighs(listed).map((finding) => finding.id), ["T-03"]);
});

test("fixture: a reassessed high needs an evidence-based D-12 note", () => {
  const bare = withFinding("| T-03 | high | auth | `lib/image-upload.ts` | evidence | reassessed | lowered | owner |");
  assert.ok(matrixProblems(bare).some((problem) => problem.includes("T-03: reassessed high needs")));
  const noted = withFinding("| T-03 | high | auth | `lib/image-upload.ts` | evidence | reassessed | D-12: replay in test X | owner |");
  assert.deepEqual(matrixProblems(noted), []);
});

test("fixture: duplicate id, unknown severity, unknown area and a missing source are rejected", () => {
  const duplicate = matrixProblems(withFinding("| T-02 | low | api | `lib/image-upload.ts` | evidence | recorded | note | owner |"));
  assert.ok(duplicate.some((problem) => problem.includes("T-02: duplicate id")));
  assert.ok(matrixProblems(withFinding("| T-03 | severe | api | `lib/image-upload.ts` | evidence | recorded | n | o |")).some((problem) => problem.includes("unknown severity")));
  assert.ok(matrixProblems(withFinding("| T-03 | low | network | `lib/image-upload.ts` | evidence | recorded | n | o |")).some((problem) => problem.includes("unknown area")));
  assert.ok(matrixProblems(goodMatrix, () => false).some((problem) => problem.includes("source path does not exist")));
});

test("fixture: a medium finding outside the release ledger and a ledger row without a finding are rejected", () => {
  const notRecorded = matrixProblems(withFinding("| T-03 | medium | api | `lib/image-upload.ts` | evidence | recorded | n | o |"));
  assert.ok(notRecorded.some((problem) => problem.includes("T-03: medium finding must be fixed or recorded")));
  const noLedger = matrixProblems(goodMatrix.replace("| T-01 | text |", "| T-09 | text |"));
  assert.ok(noLedger.some((problem) => problem.includes("T-01: missing from")));
  assert.ok(noLedger.some((problem) => problem.includes("T-09: ledger row without a finding")));
});

test("fixture: a matrix that omits an area is rejected", () => {
  const problems = matrixProblems(goodMatrix.replace("| secrets | x | y | PASS-local |\n", ""));
  assert.ok(problems.some((problem) => problem.includes('area "secrets" has no coverage row')));
});
