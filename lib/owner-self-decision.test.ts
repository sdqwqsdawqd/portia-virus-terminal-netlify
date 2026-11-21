import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Quick 261118 (owner report 2026-11-18): a request the owner filed for their own nick stayed pending for ever — the self guard caught the owner
// and the owner guard kept every other editor away. The migration lets only the owner past the self guard. Offline text check; Postgres is BLOCKED.
const sql = readFileSync(new URL("../supabase/migrations/20261118000000_portia_owner_self_decision.sql", import.meta.url), "utf8").replace(/\r/g, "");

test("both self-decision raises of the guard skip only the owner; the owner-protected raise is unchanged", () => {
  const guard = sql.slice(sql.indexOf("create or replace function public.portia_access_target_guard"), sql.indexOf("revoke all on function public.portia_access_target_guard"));
  const raises = [...guard.matchAll(/raise exception '([a-z-]+)'/g)].map((match) => match[1]);
  assert.deepEqual(raises, ["self-decision", "self-decision", "owner-protected"]);
  const conditions = guard.split("raise exception 'self-decision'").slice(0, 2).map((part) => part.slice(part.lastIndexOf("  if ")));
  for (const condition of conditions) assert.match(condition, /^ {2}if not public\.portia_is_owner\(\) and /);
  assert.match(guard, /if not public\.portia_is_owner\(\) and exists \(\n\s+select 1 from auth\.users u/);
});

test("the list marks a row as the caller's own only for a caller who is not the owner", () => {
  const list = sql.slice(sql.indexOf("create or replace function public.portia_access_list"));
  const guards = [...list.matchAll(/\(not caller_is_owner and [\s\S]*?as self_guard/g)];
  assert.equal(guards.length, 2, "pending and people rows");
  assert.equal((list.match(/as self_guard/g) ?? []).length, 2);
});

test("grants stay as before: the guard for service_role only, the list for authenticated and service_role", () => {
  assert.match(sql, /revoke all on function public\.portia_access_target_guard\(text, uuid\) from public, anon, authenticated;\ngrant execute on function public\.portia_access_target_guard\(text, uuid\) to service_role;/);
  assert.match(sql, /grant execute on function public\.portia_access_list\(text, integer\) to authenticated;\ngrant execute on function public\.portia_access_list\(text, integer\) to service_role;/);
});
