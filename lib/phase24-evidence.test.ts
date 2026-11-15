import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

// Phase 24 evidence stays consistent: the RLS review, the security matrix and the browser evidence agree with each other,
// and nothing that is BLOCKED (live roles, Postgres/RLS, staging, production, CDN, devices) is written down as a pass.

const base = new URL("../.planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, base), "utf8").replace(/\r\n/g, "\n");
const review = read("24-RLS-REVIEW.md");
const matrix = read("24-SECURITY-MATRIX.md");
const browser = read("24-BROWSER-EVIDENCE.md");

function section(source: string, heading: string) {
  const start = source.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `${heading} section missing`);
  return source.slice(start + heading.length + 3).split(/\n## /, 1)[0];
}

function tableRows(text: string) {
  return text.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("|---")).slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function tracked(path: string, suffix: string) {
  const result = spawnSync("git", ["ls-files", path], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split(/\r?\n/).filter((name) => name.endsWith(suffix));
}

// The matrix of Phase 24 is frozen history: migrations after this version are covered by the current matrix of Phase 25
// (plan 25-10), not by this check.
const FROZEN_HISTORY_UP_TO = "20261114000000";
const frozenMigrations = () => tracked("supabase/migrations", ".sql").filter((path) => (/(\d{14})_/.exec(path)?.[1] ?? "") <= FROZEN_HISTORY_UP_TO);

test("Phase 24 reviewer identifies a committed scope with no open critical or high finding", () => {
  assert.match(review, /Reviewer: `supabase-rls-reviewer`/);
  const commit = /Reviewed commit: `([0-9a-f]{40})`/.exec(review)?.[1];
  assert.ok(commit);
  assert.ok(matrix.split("\n").slice(0, 8).join("\n").includes(`Проверяемый commit: \`${commit}\``), "the matrix commit must equal the reviewed commit");
  assert.match(review, /Open critical: \*\*0\*\*\. Open high: \*\*0\*\*/);
  assert.ok(!/Open (?:critical|high): \*\*[1-9]/.test(review));
  for (const path of ["app/api/content/route.ts", "lib/level-redact.ts", "lib/content-response.ts", "lib/content-save.ts"]) {
    assert.ok(review.includes(path), `review scope must name ${path}`);
  }
  // The last round recorded in the review is the one on the reviewed commit, and it left nothing open.
  const rounds = [...review.matchAll(/^## Round (\d+) \(24-11\)[^\n]*\n\nRound commit: `([0-9a-f]{40})`/gm)];
  assert.ok(rounds.length >= 1, "the review must record at least one round");
  assert.equal(rounds[rounds.length - 1][2], commit, "the last round commit must be the reviewed commit");
  const outcomes = [...review.matchAll(/Итог раунда: открытых critical (\d+), открытых high (\d+)/g)];
  assert.equal(outcomes.length, rounds.length, "every round must record its outcome");
  for (const [, critical, high] of outcomes) assert.equal(`${critical}/${high}`, "0/0");
});

test("Phase 24 review findings are all dispositioned; no open finding hides behind a fixed label", () => {
  const findings = tableRows(section(review, "Findings and fixes"));
  assert.ok(findings.length >= 9);
  const ids = findings.map((row) => row[0]);
  assert.deepEqual(ids, ids.map((_, index) => `RLS24-${String(index + 1).padStart(2, "0")}`));
  for (const [id, severity, , disposition] of findings) {
    assert.ok(["low", "low (docs)", "low (info)", "medium"].includes(severity), `${id}: severity ${severity}`);
    assert.match(disposition, /^(fixed in `[0-9a-f]{7}`|accepted|release-ledger)/, `${id}: disposition`);
    assert.ok(!/Ждёт подтверждения/.test(disposition), `${id}: still waiting for a round`);
  }
});

test("Phase 24 matrix covers each tracked route and migration exactly once and the new modules", () => {
  const routeRows = matrix.split("\n").filter((line) => /^\| `app\/api\/[^`]+\/route\.ts`/.test(line)).map((line) => /`([^`]+)`/.exec(line)?.[1]);
  const migrationRows = matrix.split("\n").filter((line) => /^\| `supabase\/migrations\/[^`]+\.sql`/.test(line)).map((line) => /`([^`]+)`/.exec(line)?.[1]);
  assert.deepEqual([...routeRows].sort(), tracked("app/api", "/route.ts").sort());
  assert.deepEqual([...migrationRows].sort(), frozenMigrations().sort());
  assert.equal(new Set(routeRows).size, routeRows.length);
  assert.equal(new Set(migrationRows).size, migrationRows.length);
  const covered = section(matrix, "Охват файлов").split("\n").map((line) => /^-\s+`([^`]+)`/.exec(line.trim())?.[1]).filter((path): path is string => Boolean(path));
  for (const path of [
    "lib/level-redact.ts", "lib/content-response.ts", "lib/content-save.ts", "lib/access-viewer.ts",
    "lib/level-placeholders.ts", "lib/level-hierarchy.ts", "lib/embedded-documents.ts",
  ]) assert.ok(covered.includes(path), `the matrix must cover ${path}`);
  const content = matrix.split("\n").find((line) => line.startsWith("| `app/api/content/route.ts`"));
  assert.ok(content);
  for (const needle of ["GET, PUT", "access-required", "viewer-copy", "noStoreHeaders"]) assert.ok(content.includes(needle), `content route row: ${needle}`);
});

test("Phase 24 matrix keeps the direct anon read as a transferred risk and every live lane BLOCKED", () => {
  const findings = section(matrix, "Phase 24 security findings");
  const transfer = tableRows(findings).find((row) => row[0].startsWith("SEC-01"));
  assert.ok(transfer, "the anon read of portia_content must be recorded");
  assert.equal(transfer[2], "transfer");
  assert.ok(transfer[3].includes("Phase 25") && transfer[3].includes("не PASS"));
  assert.match(findings, /RLS24-08 \| low \| release-ledger/);
  const lanes = tableRows(section(matrix, "Phase 24 environment"));
  assert.ok(lanes.length >= 5);
  for (const [lane, verdict] of lanes) {
    if (/Static content/.test(lane)) assert.equal(verdict, "PASS-local", lane);
    else if (/Browser backstop/.test(lane)) assert.equal(verdict, "PASS-local (mocked API)", lane);
    else assert.equal(verdict, "BLOCKED", lane);
  }
});

test("Phase 24 browser evidence: backstop rows are PASS-local (mocked API) or BLOCKED, never a bare PASS", () => {
  const rows = tableRows(browser.split("\n").filter((line) => line.startsWith("|")).join("\n"));
  const wanted = ["S1 overflow", "S3 long-text", "S4 overflow", "S6 populated"];
  assert.deepEqual(rows.map((row) => row[0]), wanted);
  for (const [item, status, command, exit, utc] of rows) {
    assert.match(status, /^(PASS-local \(mocked API\)|BLOCKED \()/, item);
    assert.ok(command && utc, item);
    if (status.startsWith("PASS-local")) assert.equal(exit, "0", item);
  }
  assert.ok(!/\|\s*PASS\s*\|/.test(browser), "no bare PASS cell");
  const notProven = section(browser, "Не доказано здесь");
  for (const lane of ["живые роли", "Postgres/RLS", "staging и production", "Netlify CDN", "физические устройства"]) {
    assert.ok(new RegExp(`BLOCKED: .*${lane}`).test(notProven), `${lane} must be listed as BLOCKED`);
  }
  assert.ok(!/\bPASS\b(?!-local)[^\n]*(Postgres|staging|production|устройств)/i.test(notProven), "the unproven lanes never carry a PASS");
});

test("Phase 24 local check: unit, tsc and lint exited 0 with no failed test; no live lane is recorded as a pass", () => {
  const local = read("24-LOCAL-CHECK.md");
  const rows = tableRows(section(local, "Команды"));
  assert.equal(rows.length, 5);
  for (const [command, exit, outcome, utc] of rows) {
    assert.ok(command && outcome, command);
    assert.equal(exit, "0", command);
    assert.match(utc, /^2026-11-15 \d\d:\d\d:\d\d/, command);
  }
  const unit = rows.find((row) => row[0].includes("lib/*.test.ts"));
  assert.ok(unit);
  const counts = /tests (\d+), pass (\d+), fail (\d+), skipped (\d+)/.exec(unit[2]);
  assert.ok(counts);
  assert.ok(Number(counts[1]) > 2000);
  assert.equal(Number(counts[1]), Number(counts[2]) + Number(counts[4]));
  assert.equal(Number(counts[3]), 0);
  assert.ok(rows.some((row) => row[0].includes("tsc --noEmit") && row[2].startsWith("0 ошибок")));
  assert.ok(rows.some((row) => row[0].includes("eslint") && /\(0 errors, \d+ warnings\)/.test(row[2])));
  assert.ok(rows.some((row) => row[0].includes("--verify-promotion")));
  assert.ok(!rows.some((row) => /visual-manifest\.mjs --verify(?!-)/.test(row[0])), "the default --verify mode must never be run");
  assert.match(local, /all checks passed .*\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC/);
  assert.match(local, /Прогон самого `run\.sh` не засчитан/);
  for (const line of local.split("\n")) {
    if (/Postgres|staging|production|устройств/i.test(line)) assert.ok(!/\bPASS\b/.test(line), `no PASS beside a live lane: ${line}`);
  }
  for (const lane of ["живые роли", "Postgres/RLS", "staging и production", "Netlify CDN", "физические устройства"]) {
    assert.ok(new RegExp(`BLOCKED: .*${lane}`).test(section(local, "BLOCKED")), `${lane} must be BLOCKED`);
  }
});
