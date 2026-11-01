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
