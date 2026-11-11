import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accessRpc, bulkCandidates, listAccess, type AccessRpcClient } from "./access-store.ts";

const sql = readFileSync(new URL("../supabase/migrations/20261110000000_portia_users_tab.sql", import.meta.url), "utf8").replace(/\r\n/gu, "\n");

function maskEmailReference(email: string | null) {
  if (email === null || !email.includes("@")) return null;
  const [local, ...domainParts] = email.split("@");
  const domain = domainParts.join("@");
  return local.length <= 2
    ? `${local.slice(0, 1)}•••@${domain}`
    : `${local.slice(0, 1)}•••${local.slice(-1)}@${domain}`;
}

test("users migration is forward-only and follows the Phase 21 apply order", () => {
  assert.doesNotMatch(sql, /^(begin|commit);$/mu);
  assert.ok(sql.indexOf("20261109000000_portia_access_foundation.sql") < sql.indexOf("then this file"));
});

test("portia_access_list is a stable definer with an empty search path and the users gate first", () => {
  const definition = sql.split("create or replace function public.portia_access_list")[1];
  assert.match(definition, /returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/u);
  const body = definition.split("as $$")[1].split("$$;")[0];
  assert.equal(body.split("begin\n")[1].split("\n")[0].trim(), "if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;");
});

test("nickname search uses strpos rather than wildcard matching and clamps the row limit to 50", () => {
  assert.match(sql, /strpos\(/u);
  assert.doesNotMatch(sql, /\b(?:like|ilike)\b/iu);
  assert.match(sql, /least\(greatest\(coalesce\(p_limit, 50\), 0\), 50\)/u);
});

test("access list is revoked before grants and is executable only by authenticated and the privileged API role", () => {
  const revoke = sql.indexOf("revoke all on function public.portia_access_list(text, integer) from public, anon, authenticated;");
  const authenticated = sql.indexOf("grant execute on function public.portia_access_list(text, integer) to authenticated;");
  const privileged = sql.indexOf("grant execute on function public.portia_access_list(text, integer) to service_role;");
  assert.ok(revoke > 0 && revoke < authenticated && authenticated < privileged);
  assert.doesNotMatch(sql, /grant execute on function public\.portia_access_list\(text, integer\) to anon;/u);
});

test("email masking is internal and matches the D-05 reference table", () => {
  assert.deepEqual(
    ["qloxz@gmail.com", "ab@x.ru", "a@x.ru", "abc@x.ru", "", null, "no-at-sign"].map(maskEmailReference),
    ["q•••z@gmail.com", "a•••@x.ru", "a•••@x.ru", "a•••c@x.ru", null, null, null],
  );
  const definition = sql.split("create or replace function public.portia_access_mask_email(p_email text)")[1];
  assert.ok(definition, "mask helper must be present");
  assert.match(definition, /language sql\s+immutable\s+set search_path = ''/u);
  assert.doesNotMatch(definition.split("as $$")[0], /security definer/u);
  const body = definition.split("as $$")[1].split("$$;")[0];
  assert.match(body, /strpos\(p_email, '@'\) = 0/u);
  assert.match(body, /length\([^)]*local[^)]*\) <= 2/u);
  assert.match(body, /left\([^,]+, 1\)[\s\S]*'•••'[\s\S]*right\([^,]+, 1\)/u);
  const revoke = sql.indexOf("revoke all on function public.portia_access_mask_email(text) from public, anon, authenticated;");
  const grant = sql.indexOf("grant execute on function public.portia_access_mask_email(text) to service_role;");
  assert.ok(revoke > 0 && revoke < grant);
  assert.doesNotMatch(sql, /grant execute on function public\.portia_access_mask_email\(text\) to (?:anon|authenticated);/u);
});

test("full access list masks actors and mirrors target guard predicates without redefining it", () => {
  assert.match(sql, /case\s+when public\.portia_is_owner\(\) then [\w.]+email\s+else public\.portia_access_mask_email\([\w.]+email\)/u);
  assert.match(sql, /requested_by\s*=\s*auth\.uid\(\)/u);
  assert.match(sql, /account_id\s*=\s*auth\.uid\(\)/u);
  assert.match(sql, /portia_owner_email\(\)/u);
  assert.match(sql, /status = 'active'[\s\S]*order by [\w.]+level desc, [\w.]+nickname_key asc/u);
  assert.match(sql, /order by j\.id desc\s+limit 1/u);
  assert.match(sql, /interval '1 hour'/u);
  assert.match(sql, /cooldown_cleared_at is null/u);
  assert.doesNotMatch(sql, /create or replace function public\.portia_access_target_guard/u);
});

test("listAccess sends SQL parameter names and the RPC constant is pinned", async () => {
  const signature = /create or replace function public\.portia_access_list\(([^)]*)\)/u.exec(sql)?.[1] ?? "";
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const client: AccessRpcClient = { rpc: async (fn, args) => {
    calls.push({ fn, args });
    return { data: {
      callerIsOwner: false,
      pendingTotalAll: 0,
      serverNow: "2026-11-10T00:00:00.000Z",
      pending: { total: 0, rows: [] },
      people: { total: 0, rows: [] },
      closed: { total: 0, rows: [] },
    }, error: null };
  } };
  await listAccess(client, { query: "qloxz", limit: 50 });
  assert.equal(calls.length, 1);
  const called = calls[0];
  assert.equal(accessRpc.list, "portia_access_list");
  assert.equal(called.fn, accessRpc.list);
  assert.deepEqual(Object.keys(called.args ?? {}), ["p_query", "p_limit"]);
  for (const name of Object.keys(called.args ?? {})) assert.match(signature, new RegExp(`\\b${name}\\b`, "u"));
});

test("history RPC is gated, validates nickname keys and exposes only whitelisted journal details", () => {
  const definition = sql.split("create or replace function public.portia_access_history(p_nickname_key text)")[1];
  assert.ok(definition, "history RPC must be present");
  assert.match(definition, /returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/u);
  const body = definition.split("as $$")[1].split("$$;")[0];
  assert.equal(body.split("begin\n")[1].split("\n")[0].trim(), "if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;");
  assert.match(body, /public\.portia_access_nickname_key\(p_nickname_key\) is distinct from p_nickname_key/u);
  assert.match(body, /order by j\.id desc\s+limit 5/u);
  assert.match(body, /case\s+when public\.portia_is_owner\(\) then [\w.]+email\s+else public\.portia_access_mask_email\([\w.]+email\)/u);
  assert.match(body, /jsonb_build_object\([\s\S]*'level'[\s\S]*'from'[\s\S]*'to'[\s\S]*'origin'[\s\S]*'deviceAdded'[\s\S]*'previousLevel'[\s\S]*'count'/u);
  assert.doesNotMatch(body, /'details'\s*,\s*j\.details/u, "raw details jsonb never leaves the RPC");

  const revoke = sql.indexOf("revoke all on function public.portia_access_history(text) from public, anon, authenticated;");
  const authenticated = sql.indexOf("grant execute on function public.portia_access_history(text) to authenticated;");
  const privileged = sql.indexOf("grant execute on function public.portia_access_history(text) to service_role;");
  assert.ok(revoke > 0 && revoke < authenticated && authenticated < privileged);
});

test("D-07 retention permits only rows older than the newest 20 for the same nickname", () => {
  const guard = sql.split("create or replace function public.portia_access_journal_append_only()")[1];
  assert.ok(guard, "the Phase 22 migration redefines the journal guard");
  assert.doesNotMatch(guard.split("as $$")[0], /security definer/u);
  const guardBody = guard.split("as $$")[1].split("$$;")[0];
  assert.match(guardBody, /tg_op = 'DELETE'/u);
  assert.match(guardBody, /nickname_key = old\.nickname_key[\s\S]*order by [\w.]+id desc[\s\S]*offset 19 limit 1/u);
  assert.match(guardBody, /old\.id < /u);
  assert.match(guardBody, /return old/u);
  assert.match(guardBody, /raise exception 'journal-append-only'/u);

  const prune = sql.split("create or replace function public.portia_access_journal_prune()")[1];
  assert.ok(prune, "bounded prune function must be present");
  assert.match(prune.split("as $$")[0], /security definer/u);
  const pruneBody = prune.split("as $$")[1].split("$$;")[0];
  assert.match(pruneBody, /delete from public\.portia_access_journal/u);
  assert.match(pruneBody, /nickname_key = new\.nickname_key[\s\S]*offset 19 limit 1/u);
  assert.match(pruneBody, /return null/u);
  assert.match(sql, /drop trigger if exists portia_access_journal_prune on public\.portia_access_journal;/u);
  assert.match(sql, /create trigger portia_access_journal_prune after insert on public\.portia_access_journal for each row execute function public\.portia_access_journal_prune\(\);/u);
});

test("Phase 22 history and retention do not widen journal table privileges or redefine decision RPCs", () => {
  const code = sql.replace(/--[^\n]*/gu, "");
  assert.doesNotMatch(code, /grant\s+(?:delete|update|truncate|trigger|all)[^;]*on (?:table )?public\.portia_access_journal/iu);
  assert.doesNotMatch(code, /create table/iu);
  for (const name of ["decide", "set_level", "revoke", "clear_cooldown", "target_guard"]) {
    assert.doesNotMatch(code, new RegExp(`create or replace function public\\.portia_access_${name}\\b`, "u"));
  }
  assert.doesNotMatch(code, /create trigger portia_access_journal_(?:append_only|no_truncate)\b/u);
});

test("USR-08 owner-only bulk candidates cover every pending sheet request", () => {
  const definition = sql.split("create or replace function public.portia_access_bulk_candidates()")[1];
  assert.ok(definition, "bulk candidate RPC must be present");
  assert.match(definition, /returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/u);
  const body = definition.split("as $$")[1].split("$$;")[0];
  assert.equal(
    body.split("begin\n")[1].split("\n")[0].trim(),
    "if not public.portia_is_owner() then raise exception 'owner-required'; end if;",
  );
  assert.match(body, /status = 'pending'/u);
  assert.match(body, /origin = 'sheet'/u);
  assert.match(body, /order by [\w.]+created_at asc/u);
  assert.doesNotMatch(body, /\blimit\s+(?:[1-9]\d?|1\d\d)\b/iu);

  const revoke = sql.indexOf("revoke all on function public.portia_access_bulk_candidates() from public, anon, authenticated;");
  const authenticated = sql.indexOf("grant execute on function public.portia_access_bulk_candidates() to authenticated;");
  const privileged = sql.indexOf("grant execute on function public.portia_access_bulk_candidates() to service_role;");
  assert.ok(revoke > 0 && revoke < authenticated && authenticated < privileged);
});

test("bulkCandidates sends no SQL arguments and rejects malformed or oversized replies", async () => {
  const signature = /create or replace function public\.portia_access_bulk_candidates\(([^)]*)\)/u.exec(sql)?.[1] ?? "missing";
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const valid = { id: "11111111-1111-4111-8111-111111111111", nickname: "Qloxz_1", nicknameKey: "qloxz_1" };
  const client: AccessRpcClient = { rpc: async (fn, args) => {
    calls.push({ fn, args });
    return { data: { candidates: [valid] }, error: null };
  } };
  assert.deepEqual(await bulkCandidates(client), [valid]);
  assert.equal(signature, "");
  assert.deepEqual(calls, [{ fn: accessRpc.bulkCandidates, args: {} }]);

  for (const candidates of [
    [{ ...valid, id: "not-a-uuid" }],
    [{ ...valid, nicknameKey: "different" }],
    Array.from({ length: 201 }, () => valid),
  ]) {
    const malformed: AccessRpcClient = { rpc: async () => ({ data: { candidates }, error: null }) };
    await assert.rejects(() => bulkCandidates(malformed), /unexpected-reply/u);
  }
});
