import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";

// Offline guard for Phase 16: supabase/migrations/ is the only deployable schema history.
// Legacy supabase/*.sql files are frozen fixtures read by other text tests.

const root = new URL("../supabase/", import.meta.url);
// EOL-normalised so core.autocrlf on Windows cannot cause false failures.
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const frozenLegacyHashes: Record<string, string> = {
  "portia_setup.sql": "601ceb2bd5fb49d03e4c6adaf306242dd793a45105d31bb8c9fd563bd0886330",
  "phase12_apply.sql": "02ce17b12a98abce5ddb09df6e6c44b96018580c6c0d208ce7b0be1afb43ac47",
  "phase14_apply.sql": "0d9b7343aab22dc4a492af79c8abe018852bc40cd5864ea83d0ac96e1ef0a616",
};

// Forward-only: never edit a pinned entry; a schema change is a NEW migration plus a NEW line here.
const migrationHashes: Record<string, string> = {
  "20261101000000_portia_baseline.sql": "1d4a27a3a6933e88f8048623d2aa454c6c7a37dc15bf6c05ca8440be7fd284be",
  "20261101000100_portia_explicit_grants.sql": "d6588aeafe9d2aa407734a115b9b6916f815ffe54cab65f9686f3f01d2cac954",
  "20261101000200_portia_drop_legacy_promo_overloads.sql": "b19caa7841b843c923ac4eb240da88a5627efa1a1375190bca93eef85eaac403",
  "20261104000000_portia_rename_virus_classes.sql": "0037b9303c9524920af5dc810e1d0efacdbc038dcfe535b50535b032c816a98c",
  "20261104000100_portia_editor_notes.sql": "e1866a5bf9e1095955384c8643e6d16d23864349822724a404e9d8433b3aa5fd",
  "20261106000000_portia_drop_editor_notes.sql": "7940895f2a37f3df8d0124c8c39e058473730210c68eeba20641c0b72d61864b",
  // Phase 21 migration: FROZEN by plan 21-07 (see 21-MIGRATION-APPLY.md, "Закреплённый sha256"). It was applied nowhere
  // before the freeze, and the owner runs it after the three older unapplied migrations. Any later change needs a new
  // forward-only migration with its own version; this pin must not be re-pinned.
  "20261109000000_portia_access_foundation.sql": "a2c69408a3e4ac3ce99c231bda5b267f7734a235778df5c8da6786ff82334f7e",
  // Phase 22 migration: FROZEN by plan 22-09 (see 22-MIGRATION-APPLY.md). Any later schema change
  // needs a new forward-only migration with its own version; this pin must not be re-pinned.
  "20261110000000_portia_users_tab.sql": "75e9b89d08eb9893dac2bf9fe0f082be5e9ed9ae640dd38f4373535963d70c60",
  "20261112000000_portia_access_decision_mark.sql": "f1b124918f9a7708aab5c914410b81dbbcd3873e94ada0450016128ba07d6948",
  "20261113000000_portia_access_promotion.sql": "59877c13f4fadf56d9274fc5ccbf5978c285d882c0a65811da32a0ec08343e81",
  // Phase 23 migration (23-10, owner decision 2026-11-14 3a: closure ON by default).
  // FROZEN by plan 23-11 (see 23-MIGRATION-APPLY.md, «Закреплённый sha256») after supabase-rls-reviewer round 2; any later
  // change needs a new forward-only migration; this pin must not be re-pinned.
  "20261114000000_portia_access_closure_default_on.sql": "44c07e2f76baccf06017852fdf50843bae6fc005d889715cc898b4fbdc4c47b4",
  // Phase 25 expand migration (plan 25-01): server-signed reads, additive. Pinned the day it was written; the owner applies it
  // by hand after review (25-OWNER-CHECKLIST.md). Any later change needs a new forward-only migration.
  "20261115000000_portia_server_read_expand.sql": "df9b5f552acbb377a55b6c4643244db2553dd6f930ec1e25069be364b8bea5b3",
  // Phase 25 contract migration (plan 25-04): removes the anonymous read of content and employees and the media listing. Pinned the day
  // it was written; the owner applies it by hand only after the server-read code is live (D-06, 25-OWNER-CHECKLIST.md).
  "20261115000100_portia_closure_contract.sql": "98599c12c4d0bc9cea40211cdbc28aa6466c84f267f3fbe3b74321b883777cd7",
  // Quick 261117-px5: rules text per qualification transition and a candidate-started check. Pinned the day it was written;
  // applied nowhere, the owner applies it by hand (ОЖИДАЕТ ВЛАДЕЛЬЦА). Any later change needs a new forward-only migration,
  // unless the independent review requires a fix before it is applied anywhere (then re-pin in that fix commit).
  "20261117000000_portia_qualification_rules.sql": "eb885d7d4b1a1c15bff18ccc2ae2b716fcc50dbef2908e03f49053de9d4ab3cb",
  // Quick 261118: the owner may decide a row filed with their own nickname (self guard skips the owner). Pinned the day it was written;
  // applied nowhere, the owner applies it by hand (ОЖИДАЕТ ВЛАДЕЛЬЦА).
  "20261118000000_portia_owner_self_decision.sql": "cadb1475fd4b1f32412231a54b7de5a43cf3d378ac475ed4f6e18b8ce48972cc",
};

const baselineName = "20261101000000_portia_baseline.sql";

test("portia_setup.sql has exactly one begin; and one commit; line", () => {
  const lines = read("portia_setup.sql").split("\n");
  assert.equal(lines.filter((l) => l === "begin;").length, 1);
  assert.equal(lines.filter((l) => l === "commit;").length, 1);
});

test("baseline migration equals portia_setup.sql without the begin;/commit; wrapper", () => {
  assert.ok(existsSync(new URL(`migrations/${baselineName}`, root)), "baseline migration is missing");
  const lines = read("portia_setup.sql").split("\n");
  lines.splice(lines.lastIndexOf("commit;"), 1);
  lines.splice(lines.indexOf("begin;"), 1);
  assert.equal(read(`migrations/${baselineName}`), lines.join("\n"));
});

test("legacy supabase/*.sql files are frozen", () => {
  for (const [name, hash] of Object.entries(frozenLegacyHashes)) {
    assert.equal(
      sha(read(name)),
      hash,
      `${name} changed: it is frozen - make schema changes only with a new forward-only migration in supabase/migrations/`,
    );
  }
});

test("migrations are forward-only, pinned, ordered and carry no transaction wrapper", () => {
  const files = readdirSync(new URL("migrations/", root)).filter((f) => !f.startsWith("."));
  const versions = files.map((f) => {
    assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/, `bad migration file name: ${f}`);
    return f.slice(0, 14);
  });
  assert.deepEqual(versions, [...versions].sort(), "migration versions must sort ascending");
  assert.equal(new Set(versions).size, versions.length, "migration versions must be unique");
  assert.deepEqual([...files].sort(), Object.keys(migrationHashes).sort(), "new migration without a pinned hash (or a pinned file is missing)");
  for (const f of files) {
    const text = read(`migrations/${f}`);
    assert.equal(sha(text), migrationHashes[f], `${f} changed after it was pinned: add a new forward-only migration instead`);
    assert.ok(!/^(begin|commit);$/m.test(text), `${f}: the CLI owns the transaction, remove begin;/commit;`);
  }
});

test("L0 upgrade fixture is the pre-phase12 portia_setup.sql from commit 8508d71", () => {
  const text = read("upgrade-fixtures/L0_pre_phase12_portia_setup.sql");
  assert.equal(text.split("\n").length - 1, 269);
  assert.equal(sha(text), "016da4b0d1e4e6a1dd87506e0d28c5d1c896630aa52a1a9d2aa6cc413527cc97");
});

// The bank-less overloads let a promo reviewer supply their own tasks/answer keys (dropped in 000200).
test("no migration re-creates the bank-less confirm_assignment/confirm_test overloads", () => {
  for (const f of readdirSync(new URL("migrations/", root))) {
    assert.doesNotMatch(
      read(`migrations/${f}`),
      /create\s+(or\s+replace\s+)?function\s+public\.portia_promo_confirm_(assignment|test)\(\s*p_request_id\s+uuid\s*,\s*p_(items|questions)\s+jsonb/i,
      f,
    );
  }
});

test("every migration is a PORTIA migration (teardown clears the journal by the portia_ name prefix)", () => {
  for (const f of readdirSync(new URL("migrations/", root))) {
    assert.match(f, /^\d{14}_portia_[a-z0-9_]+\.sql$/, `${f}: migration names must start with portia_ after the version`);
  }
});

test("teardown is scoped to PORTIA objects only", () => {
  const raw = read("teardown/portia_teardown.sql");
  assert.match(raw.split("\n")[0], /^-- ISOLATED TEST PROJECT ONLY/);
  const sql = raw.replace(/^\s*--.*$/gm, "").toLowerCase();
  for (const banned of ["drop schema", "truncate", "drop owned", "reassign owned", "storage.buckets", "cascade"]) {
    assert.ok(!sql.includes(banned), `teardown must not contain "${banned}"`);
  }
  assert.ok(!/\bauth\./.test(sql), "teardown must not touch auth.*");
  assert.ok(!/\bstorage\.objects\s+(set|where)|delete\s+from\s+storage/.test(sql), "teardown must not mutate storage rows");
  const drops = sql.match(/drop\s+(table|function|policy)[^;\n]*/g) ?? [];
  assert.ok(drops.length > 0);
  const dynamicLoopScoped = sql.includes("nspname = 'public'") && sql.includes("like 'portia\\_%'");
  for (const d of drops) {
    // shortcut: dynamic drops (format string / aggregated list) are trusted to the filtered queries asserted here; upgrade if they multiply.
    assert.ok(/portia/.test(d) || (/%|'\s*\|\|/.test(d) && dynamicLoopScoped), `unscoped drop in teardown: ${d}`);
  }
  // Journal rows only by the portia_ prefix; pg_cron only when no foreign job exists.
  assert.ok(sql.includes("left(name, 7) = 'portia_'"));
  assert.match(sql, /not exists \(select 1 from cron\.job where jobname is distinct from 'portia-promo-cleanup'\)/);
});

test("teardown fails closed: the teardown_ok guard is the first statement after begin", () => {
  const sql = read("teardown/portia_teardown.sql").replace(/^\s*--.*$/gm, "");
  const afterBegin = sql.slice(sql.indexOf("begin;") + "begin;".length).trimStart();
  assert.match(afterBegin, /^do \$\$\s+begin\s+if coalesce\(current_setting\('portia\.teardown_ok', true\), ''\) <> 'yes' then\s+raise exception/);
});
