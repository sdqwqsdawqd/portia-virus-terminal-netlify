import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accessRpc, listAccess, type AccessRpcClient } from "./access-store.ts";

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
