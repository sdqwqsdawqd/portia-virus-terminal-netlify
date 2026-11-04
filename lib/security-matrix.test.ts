import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import * as audit from "../scripts/phase20-audit-check.mjs";

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

/* ------------------------------------------------------------------ dependency audit evidence (Task 2) */

const COMMIT = "a".repeat(40);
const finding = (id: string, severity = "moderate", pkg = "minimatch") => ({ id, package: pkg, severity });
const auditReport = (over: Record<string, unknown> = {}) => ({
  schema: audit.SCHEMA,
  commit: COMMIT,
  lockfileSha256: "lock",
  packageJsonSha256: "pkg",
  audits: {
    production: { command: "npm.cmd audit --omit=dev --json", exitCode: 0, findings: [] as ReturnType<typeof finding>[] },
    full: { command: "npm.cmd audit --json", exitCode: 1, findings: [finding("GHSA-aaaa-bbbb-cccc"), finding("via:eslint", "moderate", "eslint")] },
  },
  ...over,
});
const dispositionMarkdown = (rows: string[], commit = COMMIT) => [
  "# 20 — Dependency audit", "", `Commit: ${commit}`, "", "## Dev disposition", "",
  "| ID | Package | Severity | Disposition | Rationale | Owner |", "|---|---|---|---|---|---|", ...rows, "", "## Lockfile ledger", "",
].join("\n");
const row = (id: string, pkg: string, severity = "moderate", disposition = "accepted", rationale = "dev-only", owner = "owner") =>
  `| ${id} | ${pkg} | ${severity} | ${disposition} | ${rationale} | ${owner} |`;
const goodRows = [row("GHSA-aaaa-bbbb-cccc", "minimatch"), row("via:eslint", "eslint")];
const current = { isAncestor: () => true, lockfileSha256: "lock", packageJsonSha256: "pkg" };
const auditProblems = (report: unknown, markdown: string, now = current) => audit.verifyAuditReport({ report, markdown, current: now });
const withFull = (findings: ReturnType<typeof finding>[], exitCode = 1) => {
  const base = auditReport();
  return { ...base, audits: { ...base.audits, full: { ...base.audits.full, findings, exitCode } } };
};

test("the real audit evidence verifies: both audits on one commit, production clean, one disposition per dev advisory", () => {
  const out: string[] = [];
  const err: string[] = [];
  const code = audit.main(["--verify"], { out: (text: string) => out.push(text), err: (text: string) => err.push(text) });
  assert.equal(code, 0, err.join(""));
  const report = JSON.parse(read(`${phaseDir}/20-DEPENDENCY-AUDIT.json`));
  assert.equal(report.audits.production.findings.length, 0);
  assert.equal(report.audits.production.exitCode, 0);
  assert.ok(report.audits.full.findings.length > 0, "the full audit result must be stored, not summarised");
  assert.match(report.commit, /^[0-9a-f]{40}$/);
});

test("audit fixture: a complete, current report with one disposition per dev advisory is accepted", () => {
  assert.deepEqual(auditProblems(auditReport(), dispositionMarkdown(goodRows)), []);
});

test("audit fixture: a dev advisory without a disposition is rejected", () => {
  const problems = auditProblems(auditReport(), dispositionMarkdown([goodRows[0]]));
  assert.ok(problems.some((problem) => problem.includes("via:eslint: dev advisory has no disposition")), problems.join("; "));
});

test("audit fixture: a duplicated disposition is rejected", () => {
  const problems = auditProblems(auditReport(), dispositionMarkdown([...goodRows, row("via:eslint", "eslint", "moderate", "fixed")]));
  assert.ok(problems.some((problem) => problem.includes("via:eslint: 2 dispositions")), problems.join("; "));
});

test("audit fixture: a disposition for an advisory that the report does not list is rejected", () => {
  const problems = auditProblems(auditReport(), dispositionMarkdown([...goodRows, row("GHSA-zzzz-zzzz-zzzz", "left-pad")]));
  assert.ok(problems.some((problem) => problem.includes("GHSA-zzzz-zzzz-zzzz: disposition for an advisory that is not in the json report")), problems.join("; "));
});

test("audit fixture: a stale report is rejected (commit not an ancestor, lockfile or manifest changed, markdown from another commit)", () => {
  assert.ok(auditProblems(auditReport(), dispositionMarkdown(goodRows), { ...current, isAncestor: () => false }).some((problem) => problem.includes("stale report: commit")));
  assert.ok(auditProblems(auditReport(), dispositionMarkdown(goodRows), { ...current, lockfileSha256: "other" }).some((problem) => problem.includes("package-lock.json changed")));
  assert.ok(auditProblems(auditReport(), dispositionMarkdown(goodRows), { ...current, packageJsonSha256: "other" }).some((problem) => problem.includes("package.json changed")));
  assert.ok(auditProblems(auditReport(), dispositionMarkdown(goodRows, "b".repeat(40))).some((problem) => problem.includes("stale markdown")));
  assert.ok(auditProblems(auditReport(), dispositionMarkdown(goodRows).replace(/^Commit:.*$/m, "")).some((problem) => problem.includes("no `Commit:` line")));
});

test("audit fixture: a production advisory or a failing production audit is rejected", () => {
  const base = auditReport();
  const withProduction = { ...base, audits: { ...base.audits, production: { ...base.audits.production, exitCode: 1, findings: [finding("GHSA-prod-prod-prod", "high", "next")] } } };
  const problems = auditProblems(withProduction, dispositionMarkdown([...goodRows]));
  assert.ok(problems.some((problem) => problem.includes("production audit has 1 finding(s)")), problems.join("; "));
  assert.ok(problems.some((problem) => problem.includes("production audit exit code is 1")), problems.join("; "));
});

test("audit fixture: a missing audit, a wrong command or a missing report is rejected", () => {
  const base = auditReport();
  const noFull = { ...base, audits: { production: base.audits.production } };
  assert.ok(auditProblems(noFull, dispositionMarkdown(goodRows)).some((problem) => problem.includes("full audit is missing")));
  const wrongCommand = { ...base, audits: { ...base.audits, full: { ...base.audits.full, command: "npm.cmd audit --omit=dev --json" } } };
  assert.ok(auditProblems(wrongCommand, dispositionMarkdown(goodRows)).some((problem) => problem.includes("full audit command is not the exact npm audit command")));
  assert.deepEqual(auditProblems(null, dispositionMarkdown(goodRows)), ["audit report json is missing or not an object"]);
  assert.deepEqual(auditProblems(base, ""), ["audit report markdown is missing or empty"]);
});

test("audit fixture: a high dev advisory is never masked and blocks unless fixed or reassessed with D-12 evidence", () => {
  const report = withFull([finding("GHSA-high-high-high", "high", "brace-expansion")]);
  const accepted = auditProblems(report, dispositionMarkdown([row("GHSA-high-high-high", "brace-expansion", "high", "accepted")]));
  assert.ok(accepted.some((problem) => problem.includes("unresolved high advisory blocks the release")), accepted.join("; "));
  const blocker = auditProblems(report, dispositionMarkdown([row("GHSA-high-high-high", "brace-expansion", "high", "blocker")]));
  assert.ok(blocker.some((problem) => problem.includes("unresolved high advisory blocks the release")), blocker.join("; "));
  const bareReassess = auditProblems(report, dispositionMarkdown([row("GHSA-high-high-high", "brace-expansion", "high", "reassessed", "lower in practice")]));
  assert.ok(bareReassess.some((problem) => problem.includes("needs an evidence-based D-12 rationale")), bareReassess.join("; "));
  assert.deepEqual(auditProblems(report, dispositionMarkdown([row("GHSA-high-high-high", "brace-expansion", "high", "fixed", "lockfile 1234567")])), []);
  assert.deepEqual(auditProblems(report, dispositionMarkdown([row("GHSA-high-high-high", "brace-expansion", "high", "reassessed", "D-12: not reachable, test X")])), []);
  // The markdown cannot relabel a high advisory as moderate.
  const masked = auditProblems(report, dispositionMarkdown([row("GHSA-high-high-high", "brace-expansion", "moderate", "accepted")]));
  assert.ok(masked.some((problem) => problem.includes('markdown severity "moderate" differs from audit severity "high"')), masked.join("; "));
});

test("audit fixture: an unknown disposition, an empty rationale or an empty owner is rejected", () => {
  const problems = auditProblems(auditReport(), dispositionMarkdown([row("GHSA-aaaa-bbbb-cccc", "minimatch", "moderate", "ignore", "", ""), goodRows[1]]));
  assert.ok(problems.some((problem) => problem.includes('disposition "ignore" is not one of')));
  assert.ok(problems.some((problem) => problem.includes("empty rationale")));
  assert.ok(problems.some((problem) => problem.includes("empty owner")));
});

test("audit: --verify fails closed when a report file is missing", () => {
  const err: string[] = [];
  const code = audit.main(["--verify"], {
    fs: { existsSync: () => false, readFileSync: () => { throw new Error("must not read"); } },
    git: () => ({ status: 0, stdout: COMMIT }),
    out: () => {}, err: (text: string) => err.push(text),
  });
  assert.equal(code, 1);
  assert.match(err.join(""), /missing-report/);
  assert.equal(audit.main([], { out: () => {}, err: () => {} }), 2);
});

test("normalizeAudit: own advisory keeps its GHSA id, propagated packages get via ids and a direct-dependency path", () => {
  const sample = {
    vulnerabilities: {
      eslint: { name: "eslint", severity: "moderate", isDirect: true, via: ["minimatch"], effects: [], nodes: ["node_modules/eslint"], range: ">=1", fixAvailable: { name: "eslint", version: "4.0.0", isSemVerMajor: true } },
      minimatch: {
        name: "minimatch", severity: "moderate", isDirect: false, effects: ["eslint"], nodes: ["node_modules/minimatch"], range: "<11.0.1", fixAvailable: false,
        via: [{ source: 1244012, name: "minimatch", title: "ReDoS", url: "https://github.com/advisories/GHSA-g3hv-75wg-m249", severity: "moderate", range: "<11.0.1", cwe: ["CWE-405"] }],
      },
    },
  };
  const findings = audit.normalizeAudit(sample);
  assert.deepEqual(findings.map((item: { id: string }) => item.id), ["via:eslint", "GHSA-g3hv-75wg-m249"]);
  assert.equal(findings[1].path, "eslint > minimatch");
  assert.equal(findings[0].fix, "eslint@4.0.0 (semver-major)");
  assert.deepEqual(audit.normalizeAudit({ vulnerabilities: {} }), []);
  assert.throws(() => audit.normalizeAudit({ error: { code: "ENOTFOUND" } }), /audit-error/);
});
