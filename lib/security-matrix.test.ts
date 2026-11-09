import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import * as audit from "../scripts/phase20-audit-check.mjs";

// Structure checks for the Phase 20 security matrix (20-10). The matrix is evidence; this file keeps it honest:
// no empty matrix, no silent `open`, no unresolved high without a blocker, every medium in the release ledger.

const V13 = ".planning/milestones/v1.3-phases";
const phaseDir = `${V13}/PORTIA-20-security-accessibility-i-priemka-reliza`;
/** The frozen matrix records some sources by their pre-archive path; they are read from the v1.3 archive. */
const archived = (recorded: string) => recorded.replace(/^\.planning\/phases\/(?=PORTIA-(?:1[5-9]|20)-)/, `${V13}/`);
const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const matrixText = () => read(`${phaseDir}/20-SECURITY-MATRIX.md`);

/** Phase 21 successor of the matrix: migration coverage and freshness are checked against it (21-07). The v1.3 matrix above stays frozen history. */
const phase21Dir = ".planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal";
const currentMatrixText = () => read(`${phase21Dir}/21-SECURITY-MATRIX.md`);

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
  const problems = matrixProblems(markdown, (path) => existsSync(new URL(`../${archived(path)}`, import.meta.url)));
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

/* ------------------------------------------------------------------ route coverage (20-26) */

const root = new URL("..", import.meta.url);

/** Stdout lines of a git command in the repository root. A non-zero git exit throws: a failing git must never read as an empty list. */
function gitLines(args: string[]): string[] {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout.split("\n").map((line) => line.trim().replace(/\\/g, "/")).filter(Boolean);
}

const routesHeading = "Маршруты API (охват)";
const unwrap = (cell: string) => cell.replace(/`/g, "").trim();

/** Compare the "Маршруты API (охват)" table with the tracked route files; an empty list means full coverage. */
export function routeCoverageProblems(markdown: string, trackedRoutes: string[]): string[] {
  const rows = tableRows(section(markdown, routesHeading)).map((cells) => unwrap(cells[0]));
  if (rows.length === 0) return ["route coverage table is empty or missing"];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row)) problems.push(`duplicate route row: ${row}`);
    seen.add(row);
    if (!trackedRoutes.includes(row)) problems.push(`unknown route row: ${row}`);
  }
  for (const route of trackedRoutes) if (!seen.has(route)) problems.push(`missing route row: ${route}`);
  return problems;
}

const trackedRoutes = () => gitLines(["ls-files", "app/api"]).filter((path) => path.endsWith("/route.ts"));

const routeFixture = [
  "## Маршруты API (охват)", "| Маршрут | Методы |", "|---|---|",
  "| `app/api/a/route.ts` | GET |", "| `app/api/content/notes/route.ts` | GET, PUT |", "",
].join("\n");
const fixtureRoutes = ["app/api/a/route.ts", "app/api/content/notes/route.ts"];

test("route coverage: the real matrix has exactly one row per tracked app/api route", () => {
  const routes = trackedRoutes();
  assert.ok(routes.length >= 11, `expected at least 11 tracked routes, git lists ${routes.length}`);
  assert.ok(!routes.includes("app/api/content/notes/route.ts"), "the notes route was removed in 20-33");
  assert.deepEqual(routeCoverageProblems(matrixText(), routes), []);
});

test("route coverage: git failing is an error, not an empty route list", () => {
  assert.throws(() => gitLines(["ls-files", "--definitely-not-a-flag"]), /failed/);
});

test("route coverage fixture: a complete table is accepted", () => {
  assert.deepEqual(routeCoverageProblems(routeFixture, fixtureRoutes), []);
});

test("route coverage fixture: a matrix without the notes route row is rejected", () => {
  const without = routeFixture.replace("| `app/api/content/notes/route.ts` | GET, PUT |\n", "");
  assert.notEqual(without, routeFixture);
  assert.deepEqual(routeCoverageProblems(without, fixtureRoutes), ["missing route row: app/api/content/notes/route.ts"]);
});

test("route coverage fixture: a row for a route that does not exist, a duplicate row or a missing table is rejected", () => {
  const aRow = "| `app/api/a/route.ts` | GET |";
  assert.deepEqual(routeCoverageProblems(routeFixture.replace(aRow, `${aRow}\n| \`app/api/ghost/route.ts\` | GET |`), fixtureRoutes), ["unknown route row: app/api/ghost/route.ts"]);
  assert.deepEqual(routeCoverageProblems(routeFixture.replace(aRow, `${aRow}\n${aRow}`), fixtureRoutes), ["duplicate route row: app/api/a/route.ts"]);
  assert.deepEqual(routeCoverageProblems("", fixtureRoutes), ["route coverage table is empty or missing"]);
});

/* ------------------------------------------------------------------ migration coverage and matrix freshness (20-26) */

const migrationsHeading = "Миграции (охват)";

/** Compare the "Миграции (охват)" table with the tracked supabase/migrations files; an empty list means full coverage. */
export function migrationCoverageProblems(markdown: string, trackedMigrations: string[]): string[] {
  const rows = tableRows(section(markdown, migrationsHeading)).map((cells) => unwrap(cells[0]));
  if (rows.length === 0) return ["migration coverage table is empty or missing"];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row)) problems.push(`duplicate migration row: ${row}`);
    seen.add(row);
    if (!trackedMigrations.includes(row)) problems.push(`unknown migration row: ${row}`);
  }
  for (const migration of trackedMigrations) if (!seen.has(migration)) problems.push(`missing migration row: ${migration}`);
  return problems;
}

const trackedMigrations = () => gitLines(["ls-files", "supabase/migrations"]).filter((path) => path.endsWith(".sql"));

const migrationFixture = [
  "## Миграции (охват)", "| Миграция | Назначение |", "|---|---|",
  "| `supabase/migrations/1_a.sql` | a |", "| `supabase/migrations/2_b.sql` | b |", "",
].join("\n");
const fixtureMigrations = ["supabase/migrations/1_a.sql", "supabase/migrations/2_b.sql"];

test("migration coverage: the real matrix has exactly one row per tracked supabase migration", () => {
  const migrations = trackedMigrations();
  assert.ok(migrations.length >= 5, `expected at least 5 tracked migrations, git lists ${migrations.length}`);
  assert.deepEqual(migrationCoverageProblems(currentMatrixText(), migrations), []);
});

test("migration coverage: the migrations after 20261101 are not recorded as applied on production by the agent", () => {
  const rows = tableRows(section(currentMatrixText(), migrationsHeading));
  for (const name of ["20261104000000_portia_rename_virus_classes.sql", "20261104000100_portia_editor_notes.sql", "20261106000000_portia_drop_editor_notes.sql", "20261109000000_portia_access_foundation.sql"]) {
    const cells = rows.find((cells) => cells[0].includes(name));
    assert.ok(cells, name);
    assert.match(cells[5], /ОЖИДАЕТ ВЛАДЕЛЬЦА/, `${name}: production column`);
    assert.ok(!/\bPASS\b/.test(cells[5]), `${name}: production is never an agent PASS`);
  }
  const phase21 = rows.find((cells) => cells[0].includes("20261109000000_portia_access_foundation.sql"));
  assert.ok(phase21);
  assert.match(phase21[4], /BLOCKED/, "Phase 21 migration: staging is BLOCKED, it was never run");
  assert.ok(!/\bPASS\b/.test(phase21[4]), "Phase 21 migration: staging is never an agent PASS");
});

test("migration coverage fixture: a complete table is accepted, a missing, unknown or duplicated row is rejected", () => {
  assert.deepEqual(migrationCoverageProblems(migrationFixture, fixtureMigrations), []);
  const rowB = "| `supabase/migrations/2_b.sql` | b |";
  assert.deepEqual(migrationCoverageProblems(migrationFixture.replace(`${rowB}\n`, ""), fixtureMigrations), ["missing migration row: supabase/migrations/2_b.sql"]);
  assert.deepEqual(migrationCoverageProblems(migrationFixture.replace(rowB, `${rowB}\n| \`supabase/migrations/3_c.sql\` | c |`), fixtureMigrations), ["unknown migration row: supabase/migrations/3_c.sql"]);
  assert.deepEqual(migrationCoverageProblems(migrationFixture.replace(rowB, `${rowB}\n${rowB}`), fixtureMigrations), ["duplicate migration row: supabase/migrations/2_b.sql"]);
  assert.deepEqual(migrationCoverageProblems("", fixtureMigrations), ["migration coverage table is empty or missing"]);
});

type FreshnessDeps = {
  commitExists: (sha: string) => boolean;
  isAncestor: (sha: string) => boolean;
  changedSince: (commit: string, paths: string[]) => string[];
};

/** Paths listed as backticked bullets in "Охват файлов". */
function coveredPaths(markdown: string) {
  return section(markdown, "Охват файлов").split("\n").map((line) => /^-\s+`([^`]+)`/.exec(line.trim())?.[1]).filter((path): path is string => Boolean(path));
}

/** The matrix must describe HEAD: its commit exists, is an ancestor of HEAD, and no covered file changed after it. */
export function matrixFreshnessProblems(markdown: string, deps: FreshnessDeps): string[] {
  const header = markdown.split("\n").slice(0, 8).join("\n");
  const commit = /Проверяемый commit:\s*`([0-9a-f]{40})`/.exec(header)?.[1];
  if (!commit) return ["matrix header has no 40-hex «Проверяемый commit»"];
  const paths = coveredPaths(markdown);
  if (paths.length === 0) return ["«Охват файлов» is empty or missing"];
  if (!deps.commitExists(commit)) return [`stale matrix: commit ${commit} does not exist`];
  if (!deps.isAncestor(commit)) return [`stale matrix: commit ${commit} is not an ancestor of HEAD`];
  return deps.changedSince(commit, paths).map((file) => `stale matrix: ${file} changed since ${commit}`);
}

const realFreshnessDeps: FreshnessDeps = {
  commitExists: (sha) => spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root }).status === 0,
  isAncestor: (sha) => {
    const result = spawnSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: root, encoding: "utf8" });
    if (result.error || (result.status !== 0 && result.status !== 1)) throw new Error(`git merge-base failed: ${result.error?.message ?? result.stderr}`);
    return result.status === 0;
  },
  changedSince: (commit, paths) => gitLines(["diff", "--name-only", commit, "HEAD", "--", ...paths]),
};

const freshCommit = "c".repeat(40);
const freshnessFixture = [
  "# 20 — Security matrix", "", `Дата: 2026-11-04. Проверяемый commit: \`${freshCommit}\` (HEAD).`, "",
  "## Охват файлов", "", "- `app/api`", "- `proxy.ts`", "", "## Находки", "",
].join("\n");
const freshDeps = (over: Partial<FreshnessDeps> = {}): FreshnessDeps => ({ commitExists: () => true, isAncestor: () => true, changedSince: () => [], ...over });

test("matrix freshness: the real matrix commit is an ancestor of HEAD and no covered file changed after it", () => {
  assert.deepEqual(matrixFreshnessProblems(currentMatrixText(), realFreshnessDeps), []);
  const paths = coveredPaths(currentMatrixText());
  assert.ok(paths.length >= 16, `expected the covered paths, found ${paths.length}`);
  for (const path of paths) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `covered path does not exist: ${path}`);
  for (const path of ["lib/nickname.ts", "lib/access-session.ts", "lib/access-store.ts", "lib/access-levels.ts"]) {
    assert.ok(paths.includes(path), `the Phase 21 matrix must cover ${path}`);
  }
});

test("matrix freshness: git failing is an error, not a fresh matrix", () => {
  assert.throws(() => realFreshnessDeps.changedSince("not-a-commit", ["app/api"]), /failed/);
});

test("matrix freshness fixture: a current matrix is accepted", () => {
  assert.deepEqual(matrixFreshnessProblems(freshnessFixture, freshDeps()), []);
});

test("matrix freshness fixture: a covered file changed after the verified commit is a stale matrix", () => {
  const seen: string[][] = [];
  const problems = matrixFreshnessProblems(freshnessFixture, freshDeps({ changedSince: (_commit, paths) => { seen.push(paths); return ["app/api/promotion/banks/route.ts"]; } }));
  assert.deepEqual(problems, [`stale matrix: app/api/promotion/banks/route.ts changed since ${freshCommit}`]);
  assert.deepEqual(seen, [["app/api", "proxy.ts"]]);
});

test("matrix freshness fixture: a commit that is not an ancestor, does not exist, is missing or has no coverage list is rejected", () => {
  assert.deepEqual(matrixFreshnessProblems(freshnessFixture, freshDeps({ isAncestor: () => false })), [`stale matrix: commit ${freshCommit} is not an ancestor of HEAD`]);
  assert.deepEqual(matrixFreshnessProblems(freshnessFixture, freshDeps({ commitExists: () => false })), [`stale matrix: commit ${freshCommit} does not exist`]);
  assert.deepEqual(matrixFreshnessProblems(freshnessFixture.replace(freshCommit, "f25b885"), freshDeps()), ["matrix header has no 40-hex «Проверяемый commit»"]);
  assert.deepEqual(matrixFreshnessProblems(freshnessFixture.replace(/## Охват файлов[\s\S]*## Находки/, "## Находки"), freshDeps()), ["«Охват файлов» is empty or missing"]);
});

/* ------------------------------------------------------------------ Phase 21: matrix tie to the review and apply record (21-07) */

const accessMigration = "20261109000000_portia_access_foundation.sql";
const applyRecordText = () => read(`${phase21Dir}/21-MIGRATION-APPLY.md`);

test("Phase 21 matrix: the verified commit equals the final reviewed commit and the findings have no open or unresolved high", () => {
  const review = read(`${phase21Dir}/21-RLS-REVIEW.md`);
  const reviewed = /Итоговый проверенный commit:\s*([0-9a-f]{40})/.exec(review)?.[1];
  assert.ok(reviewed, "21-RLS-REVIEW.md must name the final reviewed commit");
  const matrix = currentMatrixText();
  assert.equal(/Проверяемый commit:\s*`([0-9a-f]{40})`/.exec(matrix.split("\n").slice(0, 8).join("\n"))?.[1], reviewed);
  const findings = tableRows(section(matrix, "Находки Phase 21"));
  assert.equal(findings.length, 16);
  for (const [id, severity, status] of findings) {
    assert.ok(["fixed", "accepted", "deferred"].includes(status), `${id}: status "${status}" (open is never allowed)`);
    if (severity === "high" || severity === "critical") assert.equal(status, "fixed", `${id}: a high finding must be fixed`);
  }
});

test("apply record: the four migrations appear in ascending order and the hash equals the pin and the file", () => {
  const record = applyRecordText();
  const order = section(record, "Порядок применения");
  const versions = ["20261104000000", "20261104000100", "20261106000000", "20261109000000"];
  const positions = versions.map((version) => order.indexOf(version));
  for (const [index, position] of positions.entries()) assert.ok(position >= 0, `${versions[index]} is missing from «Порядок применения»`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "the migrations must be listed in version order");

  const recorded = new RegExp(`${accessMigration}:\\s*([0-9a-f]{64})`).exec(section(record, "Закреплённый sha256"))?.[1];
  assert.ok(recorded, "«Закреплённый sha256» must carry the 64-hex hash");
  const pinned = new RegExp(`"${accessMigration}":\\s*"([0-9a-f]{64})"`).exec(readFileSync(new URL("./portia-canonical-parity.test.ts", import.meta.url), "utf8"))?.[1];
  assert.equal(recorded, pinned, "the record must equal the pin in lib/portia-canonical-parity.test.ts");
  const actual = createHash("sha256").update(read(`supabase/migrations/${accessMigration}`)).digest("hex");
  assert.equal(recorded, actual, "the record must equal the sha256 of the LF-normalised migration");
});

test("apply record: statuses are owner/BLOCKED and nothing is recorded as a pass", () => {
  const record = applyRecordText();
  const status = section(record, "Статус");
  assert.match(status, /ОЖИДАЕТ ВЛАДЕЛЬЦА/);
  assert.match(status, /BLOCKED/);
  assert.ok(!/\bPASS\b/i.test(status), "no PASS in «Статус»");
  assert.ok(!/\bPASS\b/.test(record), "no PASS anywhere in the apply record");
  for (const heading of ["Порядок применения", "Закреплённый sha256", "Статус", "Проверки после применения (владелец)", "Откат", "Решения D-01..D-10", "Принятые риски", "Ревью"]) {
    assert.ok(section(record, heading).trim().length > 0, `«${heading}» is missing or empty`);
  }
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

/* ------------------------------------------------------------------ carried-over 19-REVIEW findings, D-33 (Task 3) */

const d33Ids = ["WR-03", "WR-05", "IN-01", "IN-02", "IN-03", "IN-04", "IN-05"];
const d33Heading = "Перенесённые находки 19-REVIEW (D-33)";
const disposition19Path = `${V13}/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-REVIEW-DISPOSITION.md`;

type D33Env = { commitExists: (sha: string) => boolean; fileContains: (file: string, text: string) => boolean };
const backticks = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

/** Rows of the 19-REVIEW disposition table: id -> { status, note }. */
function disposition19Rows(markdown: string) {
  const rows = new Map<string, { status: string; note: string }[]>();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| ")) continue;
    const [id, , , status, note] = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    if (!/^(CR|WR|IN)-\d+$/.test(id)) continue;
    rows.set(id, [...(rows.get(id) ?? []), { status, note: note ?? "" }]);
  }
  return rows;
}

/** Every problem of the D-33 section and of its mirror in 19-REVIEW-DISPOSITION.md. */
export function d33Problems(matrix: string, disposition19: string, env: D33Env): string[] {
  const problems: string[] = [];
  const rows = tableRows(section(matrix, d33Heading));
  const byId = new Map<string, string[][]>();
  for (const cells of rows) byId.set(cells[0], [...(byId.get(cells[0]) ?? []), cells]);
  for (const id of d33Ids) {
    const count = byId.get(id)?.length ?? 0;
    if (count === 0) problems.push(`${id}: missing from the D-33 section`);
    if (count > 1) problems.push(`${id}: ${count} rows in the D-33 section, exactly one is required`);
  }
  for (const id of byId.keys()) if (!d33Ids.includes(id)) problems.push(`${id}: unexpected row in the D-33 section`);

  const mirror = disposition19Rows(disposition19);
  for (const id of d33Ids) {
    const cells = byId.get(id)?.[0];
    if (!cells) continue;
    const [, , , status, commitCell, testCell, rule, rationale] = cells;
    const commit = backticks(commitCell)[0] ?? "";
    if (status !== "fixed" && status !== "disposition") {
      problems.push(`${id}: status "${status}" must be fixed or disposition (open and phase-20 are not allowed)`);
    } else if (status === "fixed") {
      if (!/^[0-9a-f]{7,40}$/.test(commit) || !env.commitExists(commit)) problems.push(`${id}: fixed needs an existing fix commit, got "${commitCell}"`);
      const tokens = backticks(testCell);
      const file = tokens[0] ?? "";
      const names = tokens.slice(1).filter((token) => !token.startsWith("node "));
      const command = tokens.find((token) => token.startsWith("node "));
      if (!file.endsWith(".test.ts") || names.length === 0) problems.push(`${id}: fixed needs a test file and at least one test name`);
      else {
        for (const name of names) if (!env.fileContains(file, name)) problems.push(`${id}: test "${name}" is not in ${file}`);
        if (!command || !command.includes(file)) problems.push(`${id}: fixed needs the command that runs ${file}`);
      }
    } else {
      if (!/^D-(09|10|11|12)$/.test(rule)) problems.push(`${id}: disposition needs rule D-09..D-12, got "${rule}"`);
      if (!rationale || rationale.length < 40) problems.push(`${id}: disposition needs a reasoned explanation`);
    }

    const mirrored = mirror.get(id);
    if (!mirrored || mirrored.length !== 1) { problems.push(`${id}: ${mirrored?.length ?? 0} rows in 19-REVIEW-DISPOSITION.md, exactly one is required`); continue; }
    const { status: status19, note } = mirrored[0];
    if (status19 === "open" || status19 === "phase-20") problems.push(`${id}: 19-REVIEW-DISPOSITION.md still says ${status19}`);
    else if (status === "fixed" && (status19 !== "fixed" || !note.includes(commit))) problems.push(`${id}: 19-REVIEW-DISPOSITION.md must say fixed with commit ${commit}, got "${status19}"`);
    else if (status === "disposition" && (status19 !== "disposition-20" || !note.includes("20-SECURITY-MATRIX.md"))) problems.push(`${id}: 19-REVIEW-DISPOSITION.md must say disposition-20 and point to 20-SECURITY-MATRIX.md, got "${status19}"`);
  }
  return problems;
}

const realD33Env: D33Env = {
  commitExists: (sha) => spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: new URL("..", import.meta.url) }).status === 0,
  fileContains: (file, text) => existsSync(new URL(`../${file}`, import.meta.url)) && read(file).includes(text),
};
const fixtureEnv: D33Env = { commitExists: () => true, fileContains: () => true };

function d33Fixture() {
  const fixedRow = (id: string) => `| ${id} | Info | \`a.ts\` | fixed | \`abc1234\` | \`lib/x.test.ts\` :: \`name of ${id}\` ; \`node --experimental-strip-types --test lib/x.test.ts\` | — | fixed by test |`;
  const dispositionRow = (id: string) => `| ${id} | Info | \`a.ts\` | disposition | — | нет теста | D-09 | production is unavailable by project rules, so the fallback stays |`;
  const matrixRows = d33Ids.map((id) => (id === "IN-05" ? dispositionRow(id) : fixedRow(id)));
  const matrix = [`## ${d33Heading}`, "", "| ID | S | F | Статус | Коммит | Тест | Правило | Обоснование |", "|---|---|---|---|---|---|---|---|", ...matrixRows, ""].join("\n");
  const mirrorRows = d33Ids.map((id) => (id === "IN-05"
    ? `| ${id} | Info | a.ts | disposition-20 | see 20-SECURITY-MATRIX.md |`
    : `| ${id} | Info | a.ts | fixed | \`abc1234\` (20-17) |`));
  const disposition = ["| ID | Severity | Файл | Статус | Заметка |", "|----|----|----|----|----|", "| CR-01 | Critical | c.tsx | fixed | `14e04c6` |", ...mirrorRows, ""].join("\n");
  return { matrix, disposition, matrixRows, mirrorRows, fixedRow };
}

test("D-33: the real matrix has exactly one row per carried-over finding, each fixed with commit and test or a reasoned disposition", () => {
  const problems = d33Problems(matrixText(), read(disposition19Path), realD33Env);
  assert.deepEqual(problems, []);
  const rows = tableRows(section(matrixText(), d33Heading));
  assert.equal(rows.length, 7);
  assert.equal(rows.filter((cells) => cells[3] === "fixed").length, 6);
  assert.equal(rows.find((cells) => cells[0] === "IN-05")?.[3], "disposition");
});

test("D-33: 19-REVIEW-DISPOSITION.md has no open or phase-20 status for the seven findings and keeps other rows", () => {
  const mirror = disposition19Rows(read(disposition19Path));
  for (const id of d33Ids) {
    const status = mirror.get(id)?.[0].status;
    assert.ok(status === "fixed" || status === "disposition-20", `${id}: ${status}`);
  }
  for (const id of ["CR-01", "WR-01", "WR-02", "WR-04", "WR-06", "WR-07"]) assert.equal(mirror.get(id)?.[0].status, "fixed", id);
});

test("D-33 fixture: the well-formed pair is accepted", () => {
  const { matrix, disposition } = d33Fixture();
  assert.deepEqual(d33Problems(matrix, disposition, fixtureEnv), []);
});

test("D-33 fixture: a missing row is rejected", () => {
  const { matrix, disposition, matrixRows } = d33Fixture();
  const problems = d33Problems(matrix.replace(`${matrixRows[2]}\n`, ""), disposition, fixtureEnv);
  assert.ok(problems.some((problem) => problem.startsWith("IN-01: missing from the D-33 section")), problems.join("; "));
});

test("D-33 fixture: a duplicated row is rejected", () => {
  const { matrix, disposition, matrixRows } = d33Fixture();
  const problems = d33Problems(matrix.replace(matrixRows[0], `${matrixRows[0]}\n${matrixRows[0]}`), disposition, fixtureEnv);
  assert.ok(problems.some((problem) => problem.includes("WR-03: 2 rows in the D-33 section")), problems.join("; "));
});

test("D-33 fixture: an open or phase-20 row is rejected in the matrix and in 19-REVIEW-DISPOSITION.md", () => {
  const { matrix, disposition, matrixRows, mirrorRows } = d33Fixture();
  const openInMatrix = d33Problems(matrix.replace(matrixRows[1], matrixRows[1].replace("| fixed |", "| open |")), disposition, fixtureEnv);
  assert.ok(openInMatrix.some((problem) => problem.includes("WR-05") && problem.includes("open and phase-20 are not allowed")), openInMatrix.join("; "));
  for (const stale of ["open", "phase-20"]) {
    const problems = d33Problems(matrix, disposition.replace(mirrorRows[4], mirrorRows[4].replace("| fixed |", `| ${stale} |`)), fixtureEnv);
    assert.ok(problems.some((problem) => problem.includes(`IN-03: 19-REVIEW-DISPOSITION.md still says ${stale}`)), problems.join("; "));
  }
});

test("D-33 fixture: fixed without a test, without a command or without a real commit is rejected", () => {
  const { matrix, disposition, matrixRows } = d33Fixture();
  const noTest = matrixRows[0].replace(/\| `lib\/x\.test\.ts`[^|]*\|/, "| нет теста |");
  assert.ok(d33Problems(matrix.replace(matrixRows[0], noTest), disposition, fixtureEnv).some((problem) => problem.includes("WR-03: fixed needs a test file")));
  const noCommand = matrixRows[0].replace(" ; `node --experimental-strip-types --test lib/x.test.ts`", "");
  assert.ok(d33Problems(matrix.replace(matrixRows[0], noCommand), disposition, fixtureEnv).some((problem) => problem.includes("WR-03: fixed needs the command")));
  const unknownCommit = d33Problems(matrix, disposition, { ...fixtureEnv, commitExists: () => false });
  assert.ok(unknownCommit.some((problem) => problem.includes("WR-03: fixed needs an existing fix commit")));
  const unknownTest = d33Problems(matrix, disposition, { ...fixtureEnv, fileContains: () => false });
  assert.ok(unknownTest.some((problem) => problem.includes('WR-03: test "name of WR-03" is not in lib/x.test.ts')));
});

test("D-33 fixture: a disposition without a D-09..D-12 rule or a reason, or one mirrored as fixed, is rejected", () => {
  const { matrix, disposition, matrixRows, mirrorRows } = d33Fixture();
  const noRule = d33Problems(matrix.replace(matrixRows[6], matrixRows[6].replace("| D-09 |", "| — |")), disposition, fixtureEnv);
  assert.ok(noRule.some((problem) => problem.includes("IN-05: disposition needs rule D-09..D-12")), noRule.join("; "));
  const noReason = d33Problems(matrix.replace(matrixRows[6], matrixRows[6].replace(/\| production is unavailable[^|]*\|/, "| ok |")), disposition, fixtureEnv);
  assert.ok(noReason.some((problem) => problem.includes("IN-05: disposition needs a reasoned explanation")), noReason.join("; "));
  const mirroredFixed = d33Problems(matrix, disposition.replace(mirrorRows[6], mirrorRows[6].replace("disposition-20", "fixed")), fixtureEnv);
  assert.ok(mirroredFixed.some((problem) => problem.includes("IN-05: 19-REVIEW-DISPOSITION.md must say disposition-20")), mirroredFixed.join("; "));
  const missingMirror = d33Problems(matrix, disposition.replace(`${mirrorRows[3]}\n`, ""), fixtureEnv);
  assert.ok(missingMirror.some((problem) => problem.includes("IN-02: 0 rows in 19-REVIEW-DISPOSITION.md")), missingMirror.join("; "));
});
