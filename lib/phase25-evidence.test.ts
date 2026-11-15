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

// Steps of "Пошаговое включение": every "### Шаг N." heading with its body, in document order.
function steps() {
  const body = section(checklist, "Пошаговое включение");
  return body.split(/\n(?=### Шаг \d+\. )/).filter((block) => /^\s*### Шаг \d+\. /.test(block)).map((block) => {
    const text = block.trim();
    return { heading: text.split("\n")[0], text };
  });
}
const OFF = "update public.portia_access_settings set closure_enabled = false, updated_at = now(), updated_by = coalesce(updated_by, gen_random_uuid()) where id = 'main';";
const ON = OFF.replace("closure_enabled = false", "closure_enabled = true");
const stepIndex = (predicate: (step: { heading: string; text: string }) => boolean, label: string) => {
  const found = steps().findIndex(predicate);
  assert.ok(found >= 0, `step missing: ${label}`);
  return found;
};
const byHeading = (needle: string) => stepIndex((step) => step.heading.includes(needle), needle);
// The step that applies a file is the first one that names it (a step may apply several files).
const byFirstMention = (needle: string) => stepIndex((step) => step.text.includes(needle), needle);

test("Phase 25 owner checklist: the closure operators and the step order (D-05, D-06, D-20)", () => {
  const list = steps();
  assert.ok(list.length >= 12, "the steps must be written out");
  const foundation = byFirstMention("20261109000000_");
  const fileFive = byFirstMention("20261110000000_");
  const off = stepIndex((step) => step.text.includes(OFF), "the switch-off operator");
  const on = stepIndex((step) => step.text.includes(ON), "the switch-on operator");
  assert.ok(foundation < off && off < fileFive, "the switch-off goes right after file 4 and before file 5");
  assert.ok(list[off].text.includes("updated_by"), "the step explains why updated_by is set (D-02)");
  const expand = byFirstMention("20261115000000_");
  const deploy = byHeading("Выложить код Phase 25");
  const siteCheck = byHeading("Проверить сайт на новом коде");
  const bulk = byHeading("Массовое одобрение");
  const editorLogin = byHeading("Проверка входа редактора");
  const contract = byFirstMention("20261115000100_");
  const purge = stepIndex((step) => step.text.includes("api.netlify.com/api/v1/purge"), "the CDN purge");
  assert.ok(expand < deploy && deploy < siteCheck, "expand, then deploy, then the site check");
  assert.ok(siteCheck < contract && bulk < contract && editorLogin < contract, "the contract goes after the deploy, the site check, the bulk approval and the editor login (D-06)");
  assert.ok(editorLogin < on, "the closure turns on only after the editor login check");
  assert.ok(contract < on, "the closure turns on after the contract, as the separate last switch (D-05)");
  assert.ok(on < purge, "the CDN purge comes after the closure is on");
  for (const tag of ["portia-content", "portia-employees"]) assert.ok(list[purge].text.includes(tag), tag);
  for (const name of ["NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID", "Clear cache and deploy site"]) assert.ok(list[purge].text.includes(name), name);
  // A file step applies one file through psql, in one transaction.
  for (const file of ["20261109000000_", "20261110000000_", "20261115000000_", "20261115000100_"]) {
    const step = list[byFirstMention(file)].text;
    assert.ok(step.includes("psql") && step.includes("--single-transaction") && step.includes("ON_ERROR_STOP=1"), `${file}: psql, one transaction`);
  }
  // No new button or route (D-20): the operators are SQL for the owner's own SQL editor.
  assert.ok(list[off].text.includes("SQL"), "the operator is SQL");
});

test("Phase 25 owner checklist: db push appears only in a warning not to use it (D-06)", () => {
  const lines = checklist.split("\n").filter((line) => /db push/i.test(line));
  assert.ok(lines.length >= 1, "the warning is written down");
  for (const line of lines) assert.match(line, /не использ|запрещ/i, `db push mentioned without a prohibition: ${line}`);
  assert.match(section(checklist, "Перед началом"), /db push/);
});

test("Phase 25 owner checklist: rollback signs stand next to the switch-on step, two rollback levels (D-08, D-10)", () => {
  const on = steps()[stepIndex((step) => step.text.includes(ON), "the switch-on operator")].text;
  for (const sign of ["редактор не может войти", "экран заявки", "дольше 5 минут"]) assert.ok(on.includes(sign), `rollback sign missing next to the switch-on: ${sign}`);
  const rollback = section(checklist, "Откат");
  const quick = rollback.indexOf("Быстрый откат");
  const emergency = rollback.indexOf("Аварийный откат");
  assert.ok(quick >= 0 && emergency > quick, "quick, then emergency");
  assert.ok(rollback.slice(quick, emergency).includes(OFF), "the quick rollback is the switch-off operator");
  const emergencyText = rollback.slice(emergency);
  const publish = emergencyText.indexOf("Publish deploy");
  const file = emergencyText.indexOf(EMERGENCY);
  assert.ok(publish >= 0 && file > publish, "the previous deploy is published first, then the emergency file");
  assert.ok(emergencyText.includes("--single-transaction") && emergencyText.includes("ON_ERROR_STOP=1"), "psql, one transaction");
  assert.match(emergencyText, /анонимное прямое чтение/);
});

test("Phase 25 owner checklist: after-apply checks are read-only and every live check is BLOCKED / awaiting the owner (D-18)", () => {
  const marker = "BLOCKED (staging) / ОЖИДАЕТ ВЛАДЕЛЬЦА";
  for (const heading of ["Проверки после применения", "Проверка сайта после применения"]) {
    const text = section(checklist, heading);
    assert.ok(!/\b(update|insert|delete from|drop|alter|truncate|grant|revoke)\b/i.test(text), `${heading}: read-only`);
    const items = text.split(/\n(?=\d+\. )/).filter((item) => /^\d+\. /.test(item));
    assert.ok(items.length >= 4, `${heading}: numbered checks`);
    for (const item of items) assert.ok(item.includes(marker), `${heading}: a check without the status: ${item.slice(0, 60)}`);
  }
  const text = section(checklist, "Проверки после применения") + section(checklist, "Проверка сайта после применения");
  for (const needle of ["/rest/v1/portia_content", "/rest/v1/portia_employee_profiles", "/rest/v1/portia_manual_employees", "portia-media", "Cache-Control",
    "Netlify-CDN-Cache-Control", "Netlify-Cache-Tag", "Cache-Status", "Set-Cookie", "portia_content_read", "portia_employees_read", "404"]) {
    assert.ok(text.includes(needle), `checks must contain ${needle}`);
  }
  const live = tableRows(section(checklist, "Статус"), ["Файл", "Проверка"]).filter((row) => !row[0].includes(".sql"));
  assert.ok(live.length >= 6, "the status table lists the live checks");
  for (const row of live) {
    assert.match(row[1], /^BLOCKED/, row[0]);
    assert.match(row[2], /ОЖИДАЕТ ВЛАДЕЛЬЦА/, row[0]);
  }
});

test("Phase 25 owner checklist: secrets by name only, no values (D-07)", () => {
  const before = section(checklist, "Перед началом");
  for (const name of ["PORTIA_PROMOTION_DEVICE_SECRET", "PORTIA_ACCESS_SUBMIT_SECRET", "NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID"]) assert.ok(before.includes(name), name);
  assert.ok(section(checklist, "Секрет подписи заявок и чтения").includes("length(v) >= 32"));
  assert.ok(!/Bearer [A-Za-z0-9_-]{20,}/.test(checklist), "no token value");
});

test("Phase 25 release notes: what changed, known limits (D-11, D-15) and what is not verified", () => {
  const notes = read("25-RELEASE-NOTES.md");
  assert.ok(!/\bPASS\b/.test(notes), "the notes never claim PASS");
  assert.ok(!notes.includes("sb_secret_") && !notes.includes("sb_publishable_") && !notes.includes("eyJ"));
  for (const heading of ["Что изменилось", "Известные ограничения", "Не проверено"]) assert.ok(section(notes, heading).trim().length > 0, heading);
  const limits = section(notes, "Известные ограничения");
  assert.match(limits, /сохранённая ссылка на картинку продолжает открываться у человека, потерявшего доступ/);
  assert.match(limits, /пока редактор не сменит адрес/);
  assert.match(limits, /уже скачанные копии/);
  assert.match(limits, /до года/);
  assert.match(limits, /копия, оставшаяся без ссылки после отмены, остаётся в бакете/);
  assert.match(limits, /SEC-07/);
  const unverified = section(notes, "Не проверено");
  for (const lane of ["staging", "production", "CDN", "хранилищ", "анонимн"]) assert.ok(unverified.includes(lane), `not-verified section names ${lane}`);
  assert.ok(section(checklist, "Известные ограничения").includes("сохранённая ссылка на картинку продолжает открываться"), "the checklist repeats the main limit");
});

// Plan 25-10, Task 1: the browser evidence of SEC-04 is a record of a run on a local build with every /api/** answer replaced. A row is
// PASS-local (mocked API) only with the exit code 0 of the spec command; a bare PASS and any live lane written as passed are refused.
test("browser evidence: eight SEC-04 rows, each PASS-local (mocked API) with exit code 0 of the access-levels spec or BLOCKED (ENV)", () => {
  const evidence = read("25-BROWSER-EVIDENCE.md");
  const required = ["SEC-04 rejected-open", "SEC-04 revoked-open", "SEC-04 revoked-closed", "SEC-04 level-down", "SEC-04 editor-logout", "SEC-04 legacy-v1", "SEC-04 other-person", "D-09 pending-open"];
  const rows = tableRows(evidence, ["Пункт"]);
  assert.deepEqual(rows.map((row) => row[0]), required, "one row per scenario, in this order");
  const spec = readFileSync(new URL("../tests/e2e/specs/access-levels.spec.ts", import.meta.url), "utf8");
  const final = /^Итоговый прогон: `([^`]+)` — код выхода (\d+), (\d+) passed/m.exec(evidence);
  const passRows = rows.filter((row) => row[1] === "PASS-local (mocked API)");
  if (passRows.length > 0) {
    assert.ok(final, "the final run line is missing");
    assert.ok(final[1].includes("access-levels.spec.ts"), "the final run is the access-levels spec");
    assert.equal(final[2], "0", "PASS-local rows need an exit code 0 of the final run");
    assert.ok(Number(final[3]) >= required.length, "fewer passed tests than scenarios");
  }
  for (const row of rows) {
    assert.ok(row.length === 6, `${row[0]}: six cells`);
    assert.ok(spec.includes(`test("${row[0]}`), `${row[0]}: no such test in the spec`);
    assert.notEqual(row[1], "PASS", `${row[0]}: a bare PASS`);
    if (row[1] === "PASS-local (mocked API)") {
      assert.equal(row[3], "0", `${row[0]}: PASS-local needs exit code 0`);
      assert.ok(row[2].includes("access-levels.spec.ts"), `${row[0]}: the command must name the spec`);
    } else {
      assert.match(row[1], /^BLOCKED \(ENV: .+\)$/, `${row[0]}: neither PASS-local nor BLOCKED (ENV: ...)`);
    }
  }
  // The spec keeps the key names in lib/device-cache.ts, aborts every unknown own path and checks that none was aborted.
  assert.ok(/route\.abort\(/.test(spec) && /LEGACY_CACHE_KEYS/.test(spec));
  assert.ok(!/last-success-v1/.test(spec), "the old key names live only in lib/device-cache.ts");
  const unproven = section(evidence, "Не доказано здесь");
  for (const lane of ["Postgres/RLS", "staging", "CDN", "физические устройства"]) assert.ok(unproven.includes(lane), `not-proven section names ${lane}`);
  for (const line of unproven.split("\n").filter((entry) => entry.startsWith("- "))) assert.match(line, /^- BLOCKED/, line);
});
