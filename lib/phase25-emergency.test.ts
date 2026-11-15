import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// The emergency file that gives the anonymous read back (plan 25-04, D-08). It is NOT a migration: the agent never applies it,
// the migration CLI must never see it, and the owner runs it by hand through psql only when reading through the server broke,
// together with a rollback to the previous deploy. Text checks only; running it on Postgres is BLOCKED (owner step).

const name = "20261115000200_portia_emergency_restore_anon_read.sql";
const emergencyDir = new URL("../supabase/emergency/", import.meta.url);
const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const path = new URL(name, emergencyDir);
const text = existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/gu, "\n") : "";
const lines = text.split("\n");
const code = lines.filter((line) => line.trim() !== "" && !line.trim().startsWith("--")).join("\n");

const tables = [
  { table: "portia_content", editors: "Editors can read PORTIA content", pub: "Public can read PORTIA content" },
  { table: "portia_employee_profiles", editors: "Editors can read PORTIA employee profiles", pub: "Public can read PORTIA employee profiles" },
  { table: "portia_manual_employees", editors: "Editors can read PORTIA manual employees", pub: "Public can read PORTIA manual employees" },
];

test("the file lives in supabase/emergency/, never in supabase/migrations/", () => {
  assert.ok(existsSync(path), `supabase/emergency/${name} is missing`);
  assert.equal(readdirSync(migrationsDir).filter((file) => /emergency/iu.test(file)).length, 0, "no emergency file among the migrations");
  assert.ok(!existsSync(new URL(name, migrationsDir)));
});

test("the first line is the do-not-apply marker, followed by the conditions of use", () => {
  assert.equal(lines[0], "-- НЕ ПРИМЕНЯТЬ БЕЗ АВАРИИ");
  const header = lines.slice(0, 6).join("\n");
  assert.match(header, /Только если сломалось чтение через сервер/u);
  assert.match(header, /сначала опубликовать предыдущий деплой Netlify/u);
  assert.match(header, /применяет владелец через psql одной транзакцией/u);
});

test("it gives each table the anonymous select grant and the public read policy back, verbatim from the baseline", () => {
  for (const { table, editors, pub } of tables) {
    assert.equal(lines.filter((line) => line === `grant select on table public.${table} to anon;`).length, 1, `${table}: grant`);
    assert.ok(text.includes(`drop policy if exists "${editors}" on public.${table};`), `${table}: drop editors policy`);
    assert.ok(text.includes(`drop policy if exists "${pub}" on public.${table};`), `${table}: drop before create`);
    assert.match(
      text,
      new RegExp(`create policy "${pub}"\\non public\\.${table} for select\\nto anon, authenticated\\nusing \\(true\\);`, "u"),
      `${table}: ${pub}`,
    );
  }
});

test("the storage listing comes back only as commented lines", () => {
  const block = lines.filter((line) => /Public can read PORTIA media|storage\.objects/u.test(line));
  assert.ok(block.length > 0, "the storage block is present");
  for (const line of block) assert.ok(line.startsWith("--"), `not commented: ${line}`);
  assert.doesNotMatch(code, /storage\.objects/u);
  assert.match(text, /^-- create policy "Public can read PORTIA media"$/mu);
});

test("nothing destructive, no transaction wrapper, ends with the schema cache reload", () => {
  assert.doesNotMatch(code, /^(begin|commit);/mu, "the owner opens the transaction in psql");
  assert.doesNotMatch(code, /service_role/u);
  assert.doesNotMatch(code, /\bauth\./u);
  assert.doesNotMatch(code, /\b(drop table|truncate|delete from)\b/u);
  assert.doesNotMatch(code, /portia_access_closure_enabled/u);
  const nonEmpty = lines.filter((line) => line.trim() !== "");
  assert.equal(nonEmpty[nonEmpty.length - 1], "notify pgrst, 'reload schema';");
});

test("it is not a migration: the migration hash pin does not list it", () => {
  const parity = readFileSync(new URL("../lib/portia-canonical-parity.test.ts", import.meta.url), "utf8");
  assert.ok(!parity.includes(name), "portia-canonical-parity pins migrations only");
});
