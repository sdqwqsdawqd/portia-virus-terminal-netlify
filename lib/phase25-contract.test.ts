import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Text contract of the Phase 25 contract migration (plan 25-04, SEC-01 / SEC-05, D-06, D-11, D-12, D-03).
// Reads SQL text only. Running it on Postgres/Storage is BLOCKED until an isolated staging project proves it; the owner applies
// the file by hand after the server-read code is deployed and checked (25-OWNER-CHECKLIST.md). Nothing here talks to a database.
//
// The golden fingerprint (supabase/fingerprint/expected/portia.fingerprint.json) was edited for this migration OFFLINE: the
// three "Public can read ..." policies and "Public can read PORTIA media" became the editor policies and the three tables lost
// "anon:SELECT" in their ACL. That is derived from this migration text and is NOT captured on staging.

const name = "20261115000100_portia_closure_contract.sql";
const dir = new URL("../supabase/migrations/", import.meta.url);
const path = new URL(name, dir);
const text = existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/gu, "\n") : "";
const lines = text.split("\n");
const isComment = (line: string) => line.trim() === "" || line.trim().startsWith("--");
const code = lines.filter((line) => !isComment(line)).join("\n");
const lineOf = (needle: string) => lines.findIndex((line) => line === needle) + 1;

const tables = [
  { table: "portia_content", old: "Public can read PORTIA content", editors: "Editors can read PORTIA content" },
  { table: "portia_employee_profiles", old: "Public can read PORTIA employee profiles", editors: "Editors can read PORTIA employee profiles" },
  { table: "portia_manual_employees", old: "Public can read PORTIA manual employees", editors: "Editors can read PORTIA manual employees" },
];

test("the contract file exists, is named like a migration and sorts after the expand migration", () => {
  assert.ok(existsSync(path), `${name} is missing`);
  assert.match(name, /^\d{14}_portia_[a-z0-9_]+\.sql$/u);
  assert.ok(name.slice(0, 14) > "20261115000000");
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  // Later quick tasks may add newer migrations; no other Phase 25 migration may sort after the contract.
  assert.equal(files.filter((file) => file.startsWith("20261115")).pop(), name, "the contract is the last Phase 25 migration");
});

test("the first executable statement is the guard DO block (D-06), before any revoke or drop policy", () => {
  const firstCode = lines.findIndex((line) => !isComment(line));
  assert.equal(lines[firstCode], "do $$");
  const end = lines.findIndex((line, index) => index > firstCode && line === "end; $$;");
  assert.ok(end > firstCode, "the guard block is closed");
  const guard = lines.slice(firstCode, end + 1).join("\n");
  assert.match(guard, /to_regprocedure\('public\.portia_content_read\(bigint, text\)'\)/u);
  assert.match(guard, /to_regprocedure\('public\.portia_employees_read\(bigint, text\)'\)/u);
  assert.match(guard, /name = 'submit'/u);
  assert.match(guard, /length\(secret\) >= 32/u);
  assert.match(guard, /raise exception/u);
  const firstChange = lines.findIndex((line) => /^(revoke|drop policy|create policy|grant)\b/u.test(line));
  assert.ok(firstChange > end, "no revoke / drop / create policy before the guard block ends");
});

test("exactly three single-line anon select revokes, one per table, each below the guard", () => {
  const guardEnd = lineOf("end; $$;");
  const revokes = lines.filter((line) => /^revoke\b/u.test(line));
  assert.deepEqual(
    revokes,
    tables.map(({ table }) => `revoke select on table public.${table} from anon;`),
  );
  for (const { table } of tables) assert.ok(lineOf(`revoke select on table public.${table} from anon;`) > guardEnd, table);
});

test("each table swaps the public read policy for an editor read policy", () => {
  for (const { table, old, editors } of tables) {
    assert.ok(text.includes(`drop policy if exists "${old}" on public.${table};`), `${table}: drop ${old}`);
    const block = new RegExp(
      `create policy "${editors}"\\non public\\.${table} for select\\nto authenticated\\nusing \\(\\(select public\\.portia_can_edit\\(\\)\\)\\);`,
      "u",
    );
    assert.match(text, block, `${table}: ${editors}`);
  }
});

test("storage: the broad read policy goes, an editor-only one scoped to the bucket takes its place (SEC-05, D-11)", () => {
  assert.ok(text.includes('drop policy if exists "Public can read PORTIA media" on storage.objects;'));
  assert.match(
    text,
    /create policy "Editors can read PORTIA media"\non storage\.objects for select\nto authenticated\nusing \(bucket_id = 'portia-media' and \(select public\.portia_can_edit\(\)\)\);/u,
  );
  assert.equal((text.match(/create policy "Editors can read PORTIA media"/gu) ?? []).length, 1);
});

test("nothing else: no anon grant or policy, no write policy, no bucket change, no service role, no transaction wrapper", () => {
  const policies = [...code.matchAll(/create policy "([^"]+)"[\s\S]*?;/gu)];
  assert.equal(policies.length, 4, "three table policies and one storage policy");
  for (const [policy, policyName] of policies) {
    assert.match(policyName, /^Editors can read PORTIA /u);
    assert.match(policy, /\bfor select\b/u);
    assert.match(policy, /\bto authenticated\b/u);
    assert.doesNotMatch(policy, /\banon\b/u, policyName);
  }
  assert.doesNotMatch(code, /^grant\b/mu, "the contract grants nothing");
  assert.doesNotMatch(code, /\bto anon\b/u);
  assert.doesNotMatch(code, /for (insert|update|delete|all)\b/u);
  assert.doesNotMatch(code, /storage\.buckets/u);
  assert.doesNotMatch(code, /service_role/u);
  assert.doesNotMatch(code, /\bauth\./u);
  assert.doesNotMatch(code, /portia_access_closure_enabled/u);
  assert.doesNotMatch(code, /^(begin|commit);/mu);
  assert.doesNotMatch(code, /^(drop table|truncate|delete from)\b/mu);
});

test("the last non-empty line reloads the PostgREST schema cache", () => {
  const nonEmpty = lines.filter((line) => line.trim() !== "");
  assert.equal(nonEmpty[nonEmpty.length - 1], "notify pgrst, 'reload schema';");
});

test("the header says when to apply it and how to roll it back", () => {
  assert.match(lines.slice(0, 8).join("\n"), /Apply ONLY after the server-read code is deployed and checked \(D-06\)/u);
  assert.match(text, /supabase\/emergency\/20261115000200_portia_emergency_restore_anon_read\.sql/u);
});
