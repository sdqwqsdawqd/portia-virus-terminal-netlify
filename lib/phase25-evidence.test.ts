import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

// Phase 25 owner record: the text of the checklist is checked against the repository (order, pinned hashes, statuses).
// Nothing here runs against a live system: staging, production, CDN, storage and anonymous-read checks stay BLOCKED /
// awaiting the owner, and no document of the phase may write any of them down as passed.

const base = new URL("../.planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, base), "utf8").replace(/\r\n/g, "\n");
const root = new URL("..", import.meta.url);

// Body of the "## heading" section (up to the next "## "); a "### " sub-heading does not end it.
function section(source: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^## ${escaped}[ \\t]*$`, "m").exec(source);
  assert.ok(start, `${heading} section missing`);
  const rest = source.slice(start.index + start[0].length);
  return rest.split(/\n## /, 1)[0];
}

// Table rows without the separator line and without a header row (the first cell names the column).
function tableRows(text: string, headerCells: string[]) {
  return text.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("|---"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => !headerCells.includes(cells[0]));
}

function tracked(path: string, suffix: string) {
  const result = spawnSync("git", ["ls-files", path], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split(/\r?\n/).filter((name) => name.endsWith(suffix));
}

const sha = (path: string) => createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n")).digest("hex");

const versionOf = (text: string) => /(\d{14})_/.exec(text)?.[1] ?? "";
const EXPAND = "20261115000000_portia_server_read_expand.sql";
const CONTRACT = "20261115000100_portia_closure_contract.sql";
const EMERGENCY = "supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql";

const checklist = read("25-OWNER-CHECKLIST.md");

test("Phase 25 owner checklist: the agent applied nothing, no PASS, no key prefixes, every section is filled", () => {
  assert.ok(checklist.includes("Агент не применил ничего"), "the intro must say the agent applied nothing");
  assert.match(checklist, /при первой ошибке остановитесь/);
  assert.ok(!/\bPASS\b/.test(checklist), "the checklist must never claim PASS");
  assert.ok(!checklist.includes("sb_secret_") && !checklist.includes("sb_publishable_"), "no key prefixes in the checklist");
  assert.ok(!checklist.includes("eyJ"), "no JWT in the checklist");
  for (const heading of [
    "Что изменится на сайте", "Перед началом", "Порядок применения", "Пошаговое включение", "Как применить", "Секрет подписи заявок и чтения",
    "Перезагрузка кэша схемы", "Проверки после применения", "Проверка сайта после применения", "Откат", "Закреплённый sha256", "Статус",
    "Ревью", "Что доказано офлайн", "Известные ограничения",
  ]) assert.ok(section(checklist, heading).trim().length > 0, `${heading} must not be empty`);
});

test("Phase 25 owner checklist: apply order equals the tracked migrations after Phase 16, the emergency file is not in it", () => {
  const versions = tracked("supabase/migrations", ".sql").map(versionOf).filter((version) => version > "20261101000200").sort();
  assert.ok(versions.length >= 10);
  const listed = section(checklist, "Порядок применения").split("\n")
    .map((line) => /^\d+\. `(\d{14})_[a-z0-9_]+\.sql`/.exec(line)?.[1]).filter((version): version is string => Boolean(version));
  assert.deepEqual(listed, versions, "a migration without a checklist entry (or an extra entry)");
  assert.deepEqual(listed.slice(-2), ["20261115000000", "20261115000100"], "expand, then contract, last");
  assert.ok(!section(checklist, "Порядок применения").split("\n").some((line) => /^\d+\. /.test(line) && line.includes("emergency")), "the emergency file is not part of the order");
  assert.ok(tracked("supabase/migrations", ".sql").every((path) => !path.includes("emergency")));
});

test("Phase 25 owner checklist: pinned sha256 of expand and contract equal the pin of the parity test and the file; the emergency file equals the file", () => {
  const parity = readFileSync(new URL("./portia-canonical-parity.test.ts", import.meta.url), "utf8");
  const hashes = section(checklist, "Закреплённый sha256");
  for (const file of [EXPAND, CONTRACT]) {
    const recorded = new RegExp(`${file}: ([0-9a-f]{64})`).exec(hashes)?.[1];
    const pinned = new RegExp(`"${file}": "([0-9a-f]{64})"`).exec(parity)?.[1];
    assert.ok(recorded && pinned, file);
    assert.equal(recorded, pinned, `${file}: record differs from the pin`);
    assert.equal(recorded, sha(`supabase/migrations/${file}`), `${file}: record differs from the file`);
  }
  const name = EMERGENCY.split("/").pop() as string;
  const emergency = new RegExp(`${name}: ([0-9a-f]{64})`).exec(hashes)?.[1];
  assert.ok(emergency, name);
  assert.equal(emergency, sha(EMERGENCY), `${name}: record differs from the file`);
  assert.ok(!parity.includes(name), "the emergency file is pinned in the checklist only, not in the migration pins");
});

test("Phase 25 owner checklist: one status row per migration and for the emergency file; staging BLOCKED, production waits for the owner", () => {
  const versions = tracked("supabase/migrations", ".sql").map(versionOf).filter((version) => version > "20261101000200").sort();
  const rows = tableRows(section(checklist, "Статус"), ["Файл", "Проверка"]);
  const fileRows = rows.filter((row) => row[0].includes(".sql"));
  const emergencyRow = fileRows.filter((row) => row[0].includes("emergency_restore_anon_read"));
  assert.equal(emergencyRow.length, 1, "one row for the emergency file");
  const migrationRows = fileRows.filter((row) => !row[0].includes("emergency_restore_anon_read"));
  assert.deepEqual(migrationRows.map((row) => versionOf(row[0])), versions);
  for (const row of migrationRows) {
    assert.match(row[1], /^BLOCKED \(ENV\)/, row[0]);
    assert.match(row[2], /ОЖИДАЕТ ВЛАДЕЛЬЦА/, row[0]);
  }
  assert.match(emergencyRow[0][1], /^BLOCKED \(ENV\)/);
  assert.match(emergencyRow[0][2], /не применять без аварии/);
});
