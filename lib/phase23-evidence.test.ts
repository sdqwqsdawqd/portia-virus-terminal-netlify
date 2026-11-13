import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const base = new URL("../.planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, base), "utf8").replace(/\r\n/g, "\n");
const evidence = read("23-LIVE-EVIDENCE.md");
const review = read("23-RLS-REVIEW.md");
const matrix = read("23-SECURITY-MATRIX.md");
const output = read("23-LOCAL-CHECK.txt");

function section(source: string, heading: string) {
  const start = source.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `${heading} section missing`);
  const rest = source.slice(start + heading.length + 3);
  return rest.split(/\n## /, 1)[0];
}

function rows(source: string, heading: string) {
  return section(source, heading).split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("|---"))
    .slice(1).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function tracked(path: string, suffix: string) {
  const result = spawnSync("git", ["ls-files", path], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split(/\r?\n/).filter((name) => name.endsWith(suffix));
}

test("Phase 23 reviewer identifies a committed scope with no open critical or high finding", () => {
  assert.match(review, /Reviewer: `supabase-rls-reviewer`/);
  const commit = /Reviewed commit: `([0-9a-f]{40})`/.exec(review)?.[1];
  assert.ok(commit);
  assert.ok(matrix.includes(`Проверяемый commit: \`${commit}\``));
  assert.match(review, /Open critical: \*\*0\*\*\. Open high: \*\*0\*\*/);
  assert.ok(!/Open (?:critical|high): \*\*[1-9]/.test(review));
  for (const path of ["20261113000000_portia_access_promotion.sql", "app/api/access/editor-request/route.ts", "app/api/promotion/{status,requests,test}/route.ts"]) assert.ok(review.includes(path), path);
});

test("Phase 23 local PASS entries have exact commands, zero exits, UTC time and output references", () => {
  const commands = rows(evidence, "Local commands");
  assert.equal(commands.length, 6);
  for (const [lane, command, node, utc, exit, reference, verdict] of commands) {
    assert.ok(lane && command && reference.includes("23-LOCAL-CHECK.txt"), lane);
    assert.equal(node, "22.13.1", lane);
    assert.match(utc, /^2026-11-13 \d\d:\d\d:\d\d$/, lane);
    assert.equal(exit, "0", lane);
    assert.equal(verdict, "PASS-local", lane);
  }
  assert.match(output, /Exit: 0/);
  const unit = /# tests (\d+)\n# pass (\d+)\n# fail (\d+)\n# skipped (\d+)/.exec(output);
  assert.ok(unit);
  assert.ok(Number(unit[1]) > 1800);
  assert.equal(Number(unit[1]), Number(unit[2]) + Number(unit[4]));
  assert.equal(Number(unit[3]), 0);
  assert.match(output, /Verified 65 exact owner-approved snapshot bytes/);
  assert.ok(!evidence.includes("scripts/phase15-visual-manifest.mjs --verify |"));
});

test("Phase 23 ledger covers twelve requirements, 37 UI states and 36 edge cases without upgrading backstops", () => {
  const requirements = rows(evidence, "Requirement coverage");
  const expected = ["ACC-01", "ACC-02", "ACC-03", "ACC-05", "ACC-06", "ACC-07", "ACC-08", "PROM-01", "PROM-02", "PROM-03", "PROM-04", "PROM-05"];
  assert.deepEqual(requirements.map((row) => row[0]), expected);
  for (const [id, summary, source, local, live] of requirements) {
    assert.ok(summary.endsWith("-SUMMARY.md") && source.includes(".test.ts"), id);
    assert.equal(local, "LOCAL-CHECK", id);
    assert.match(live, /BLOCKED/, id);
  }
  const ui = rows(evidence, "UI considerations");
  assert.equal(ui.length, 37);
  assert.equal(ui.filter((row) => row[2].endsWith("backstop") && row[4] === "BLOCKED-browser").length, 3);
  assert.equal(ui.filter((row) => row[2].endsWith("explicit") && row[4] === "LOCAL-CHECK").length, 34);
  const edges = rows(evidence, "Edge considerations");
  assert.equal(edges.length, 36);
  assert.equal(edges.filter((row) => row[1].endsWith("backstop") && row[3] === "BLOCKED-live").length, 4);
  assert.equal(edges.filter((row) => row[1].endsWith("explicit") && row[3] === "LOCAL-CHECK").length, 32);
});

test("Phase 23 matrix covers each tracked route and migration exactly once; all live lanes stay blocked", () => {
  const routeRows = matrix.split("\n").filter((line) => /^\| `app\/api\/[^`]+\/route\.ts`/.test(line)).map((line) => /`([^`]+)`/.exec(line)?.[1]);
  const migrationRows = matrix.split("\n").filter((line) => /^\| `supabase\/migrations\/[^`]+\.sql`/.test(line)).map((line) => /`([^`]+)`/.exec(line)?.[1]);
  assert.deepEqual([...routeRows].sort(), tracked("app/api", "/route.ts").sort());
  assert.deepEqual([...migrationRows].sort(), tracked("supabase/migrations", ".sql").sort());
  assert.equal(new Set(routeRows).size, routeRows.length);
  assert.equal(new Set(migrationRows).size, migrationRows.length);
  for (const [lane, verdict] of rows(evidence, "Live boundaries")) {
    assert.ok(lane);
    assert.equal(verdict, "BLOCKED", lane);
  }
  assert.match(evidence, /Build is BLOCKED/);
  assert.match(matrix, /RLS23-04 \| medium \| release-ledger/);
});
