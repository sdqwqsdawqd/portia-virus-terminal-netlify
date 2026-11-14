import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

test("Phase 23 apply record: owner order, pinned hashes, cache reload, closure ON checks; the agent applied nothing", () => {
  const record = read("23-MIGRATION-APPLY.md");
  assert.ok(record.includes("Агент не применил ничего"), "intro must say the agent applied nothing");
  assert.ok(!/\bPASS\b/.test(record), "the record must never claim PASS");
  assert.ok(!record.includes("sb_secret_") && !record.includes("sb_publishable_"), "no key prefixes in the record");
  for (const heading of [
    "Что изменится на сайте", "Перед началом", "Порядок применения", "Проверка до применения", "Как применить", "Секрет подписи заявок",
    "Перезагрузка кэша схемы", "Проверки после применения", "Проверка сайта после применения", "Откат и выключение закрытия",
    "Закреплённый sha256", "Статус", "Ревью", "Что доказано офлайн",
  ]) assert.ok(section(record, heading).trim().length > 0, `${heading} must not be empty`);

  // Order equals the tracked migrations after Phase 16 (20261101000200): a future migration without a record update fails here.
  const versions = tracked("supabase/migrations", ".sql").map((path) => /(\d{14})_/.exec(path)?.[1] ?? "").filter((version) => version > "20261101000200").sort();
  assert.ok(versions.length >= 8);
  const listed = section(record, "Порядок применения").split("\n").map((line) => /^\d+\. `(\d{14})_[a-z0-9_]+\.sql`/.exec(line)?.[1]).filter((version): version is string => Boolean(version));
  assert.deepEqual(listed, versions);

  // Frozen hashes: recorded value, pin in the parity test and the LF-normalised file must agree.
  const parity = readFileSync(new URL("./portia-canonical-parity.test.ts", import.meta.url), "utf8");
  const hashes = section(record, "Закреплённый sha256");
  for (const file of ["20261113000000_portia_access_promotion.sql", "20261114000000_portia_access_closure_default_on.sql"]) {
    const recorded = new RegExp(`${file}: ([0-9a-f]{64})`).exec(hashes)?.[1];
    const pinned = new RegExp(`"${file}": "([0-9a-f]{64})"`).exec(parity)?.[1];
    const actual = createHash("sha256").update(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n")).digest("hex");
    assert.ok(recorded && pinned, file);
    assert.equal(recorded, pinned, `${file}: record differs from the pin`);
    assert.equal(recorded, actual, `${file}: record differs from the file`);
  }

  // Cache reload: the closure migration ends with the notify and the record repeats it.
  const lastLine = readFileSync(new URL("../supabase/migrations/20261114000000_portia_access_closure_default_on.sql", import.meta.url), "utf8")
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean).pop();
  assert.equal(lastLine, "notify pgrst, 'reload schema';");
  assert.ok(section(record, "Перезагрузка кэша схемы").includes("notify pgrst, 'reload schema';"));

  // Owner checks: counts come from the golden fingerprint.
  const golden = JSON.parse(readFileSync(new URL("../supabase/fingerprint/expected/portia.fingerprint.json", import.meta.url), "utf8")) as { sections: { functions: Record<string, unknown> } };
  const keys = Object.keys(golden.sections.functions);
  const accessCount = keys.filter((key) => key.startsWith("public.portia_access_")).length;
  const promotionCount = keys.filter((key) => /^public\.portia_promo_secure_/.test(key) || /^public\.portia_promo_participant_key\(/.test(key) || /^public\.portia_promo_test_proof_valid\(/.test(key)).length;
  const checks = section(record, "Проверки после применения");
  for (const needle of ["select public.portia_access_closure_enabled();", "has_function_privilege", "PGRST202",
    "portia_access_journal", "portia_access_people", "portia_access_requests", "portia_access_secrets", "portia_access_settings",
    `ожидается ${accessCount}`, `ожидается ${promotionCount}`]) assert.ok(checks.includes(needle), `checks must contain ${needle}`);
  assert.ok(section(record, "Секрет подписи заявок").includes("length(v) >= 32"));

  // Status: one row per ordered migration, production always waits for the owner.
  const status = rows(record, "Статус");
  assert.deepEqual(status.map((row) => /(\d{14})_/.exec(row[0])?.[1]), versions);
  for (const row of status) assert.match(row[2], /ОЖИДАЕТ ВЛАДЕЛЬЦА/, row[0]);
});
