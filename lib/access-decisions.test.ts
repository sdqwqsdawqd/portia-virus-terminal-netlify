import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { AccessStoreError, accessRpc, revokeAccess, setAccessLevel, type AccessRpcClient } from "./access-store.ts";

// Offline contract tests for the Phase 21 decision rules (21-03, USR-05 / D-02 / D-07 / D-09).
// No database is available here: the SQL is checked as text, and Postgres/RLS behaviour stays BLOCKED until an
// isolated staging run (plan 21-07).

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationPath = join(repoRoot, "supabase", "migrations", "20261109000000_portia_access_foundation.sql");
const raw = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
// Comment-stripped text so a rule mentioned only in a header comment cannot satisfy a contract.
const sql = raw.replace(/--[^\n]*/g, "");

function functionParts(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is missing from the migration`);
  const bodyStart = sql.indexOf("as $$", start);
  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);
  assert.ok(bodyStart > start && bodyEnd > bodyStart, `${name}: cannot find its $$ body`);
  return { header: sql.slice(start, bodyStart), body: sql.slice(bodyStart + 5, bodyEnd), start };
}

function parameterNames(name: string) {
  const match = sql.match(new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`));
  assert.ok(match, `${name}: one-line signature not found`);
  return match[1].split(",").map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
}

function grantedRoles(name: string) {
  const roles = new Set<string>();
  for (const match of sql.matchAll(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to ([^;]+);`, "g"))) {
    for (const role of match[1].split(",")) roles.add(role.trim());
  }
  return roles;
}

function firstStatement(body: string) {
  return body.split("begin\n")[1].split("\n")[0].trim();
}

const gateLine = "if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;";
const guardCall = /perform public\.portia_access_target_guard\(/;
const journalInsert = /insert into public\.portia_access_journal[^;]*;/g;

test("USR-05 the target guard is internal, not security definer, and refuses self and owner rows", () => {
  const { header, body } = functionParts("portia_access_target_guard");
  assert.ok(!header.includes("security definer"), "the guard runs inside the definer functions and must not be security definer");
  assert.ok(header.includes("set search_path = ''"));
  assert.ok(/returns void/.test(header) && /language plpgsql/.test(header) && /\bstable\b/.test(header));
  assert.ok(body.includes("raise exception 'self-decision'"));
  assert.ok(body.includes("raise exception 'owner-protected'"));
  assert.match(body, /p_requested_by = auth\.uid\(\)/, "self by request account link");
  assert.match(body, /account_id = auth\.uid\(\)/, "self by person account link");
  assert.ok(body.includes("public.portia_owner_email()") && body.includes("auth.users"), "owner rows are found by the owner's confirmed email account");
  assert.ok(body.includes("not public.portia_is_owner()"), "the owner may change owner rows (they are self rows for the owner)");
  assert.deepEqual([...grantedRoles("portia_access_target_guard")], ["service_role"], "no API role can call the guard");
});

test("USR-05 decide, set_level and revoke call the target guard before they change anything", () => {
  for (const name of ["portia_access_decide", "portia_access_set_level", "portia_access_revoke"]) {
    const { body } = functionParts(name);
    const guard = body.search(guardCall);
    assert.ok(guard >= 0, `${name}: no call to portia_access_target_guard`);
    const firstWrite = body.search(/update public\.|insert into public\./);
    assert.ok(firstWrite > guard, `${name}: the guard must run before the first update or insert`);
  }
  const decide = functionParts("portia_access_decide").body;
  assert.ok(decide.indexOf("'already-decided'") < decide.search(guardCall), "a repeat decision answers already-decided before the guard");
  assert.ok(decide.search(guardCall) < decide.indexOf("if p_decision = 'reject' then"), "reject is guarded too");
});

test("USR-05 the gate with 'forbidden' is the first statement of decide, set_level and revoke", () => {
  for (const name of ["portia_access_decide", "portia_access_set_level", "portia_access_revoke"]) {
    assert.equal(firstStatement(functionParts(name).body), gateLine, name);
    assert.ok(functionParts(name).header.includes("security definer"), `${name} is security definer`);
  }
});

test("USR-05 no level above the decider's own, in decide and in set_level", () => {
  const decide = functionParts("portia_access_decide").body;
  assert.match(decide, /if new_level > caller_level then raise exception 'level-above-own'; end if;/);
  const setLevel = functionParts("portia_access_set_level").body;
  assert.match(setLevel, /if p_level > caller_level then raise exception 'level-above-own'; end if;/);
  assert.ok(setLevel.includes("raise exception 'invalid-level'"));
  assert.ok(setLevel.indexOf("'invalid-level'") < setLevel.indexOf("'level-above-own'"), "range is checked before the ceiling");
});

test("D-02 set_level is optimistic: stale when the expected level differs, no journal row when unchanged", () => {
  const { body } = functionParts("portia_access_set_level");
  assert.deepEqual(parameterNames("portia_access_set_level"), ["p_person_id", "p_level", "p_expected_level"]);
  assert.match(body, /p_expected_level is distinct from/);
  assert.match(body, /'code', 'stale', 'level'/);
  assert.match(body, /'code', 'not-found'/);
  assert.match(body, /'code', 'not-active'/);
  assert.ok(body.indexOf("'stale'") < body.indexOf("'unchanged'"), "stale is decided before unchanged");
  assert.ok(body.indexOf("'unchanged'") < body.search(/update public\./), "unchanged returns before any write");
  assert.ok(body.includes("pg_advisory_xact_lock") && body.includes("'access:nickname:'"), "the nickname advisory lock serialises with decide");
  assert.match(body, /updated_at = now\(\)/);
  assert.match(body, /updated_by = auth\.uid\(\)/);
});

test("D-02 revoke flips the person and every approved request in one function body", () => {
  const { body } = functionParts("portia_access_revoke");
  assert.deepEqual(parameterNames("portia_access_revoke"), ["p_person_id"]);
  assert.match(body, /'code', 'already-revoked'/);
  assert.match(body, /'code', 'not-found'/);
  assert.match(body, /update public\.portia_access_people\s+set status = 'revoked'/);
  const requests = body.match(/update public\.portia_access_requests[^;]*;/)?.[0] ?? "";
  assert.ok(requests, "revoke must update the requests of the person");
  assert.match(requests, /set status = 'revoked'/);
  assert.match(requests, /decided_at = now\(\)/);
  assert.match(requests, /decided_by = auth\.uid\(\)/);
  assert.match(requests, /person_id = /);
  assert.match(requests, /status = 'approved'/);
  assert.ok(body.includes("pg_advisory_xact_lock") && body.includes("'access:nickname:'"));
});

test("D-07 every decision branch appends exactly one journal row with its event type", () => {
  const decide = functionParts("portia_access_decide").body;
  const decideInserts = [...decide.matchAll(journalInsert)].map((match) => match[0]);
  assert.equal(decideInserts.length, 2, "decide: one insert per branch");
  assert.equal(decideInserts.filter((text) => text.includes("'approve'")).length, 1);
  assert.equal(decideInserts.filter((text) => text.includes("'reject'")).length, 1);
  const expected: Record<string, string> = { portia_access_set_level: "'level-change'", portia_access_revoke: "'revoke'" };
  for (const [name, eventType] of Object.entries(expected)) {
    const inserts = [...functionParts(name).body.matchAll(journalInsert)].map((match) => match[0]);
    assert.equal(inserts.length, 1, `${name}: exactly one journal insert`);
    assert.ok(inserts[0].includes(eventType), `${name}: event ${eventType}`);
  }
  const levelChange = functionParts("portia_access_set_level").body.match(journalInsert)?.[0] ?? "";
  assert.ok(levelChange.includes("'from'") && levelChange.includes("'to'"), "level-change details carry from and to");
});

test("D-07 the journal cannot be updated or deleted: BEFORE UPDATE OR DELETE trigger raises journal-append-only", () => {
  const { header, body } = functionParts("portia_access_journal_append_only");
  assert.ok(/returns trigger/.test(header) && /language plpgsql/.test(header));
  assert.ok(header.includes("set search_path = ''"));
  assert.ok(body.includes("raise exception 'journal-append-only'"));
  assert.deepEqual([...grantedRoles("portia_access_journal_append_only")], ["service_role"]);
  const drop = sql.indexOf("drop trigger if exists portia_access_journal_append_only on public.portia_access_journal;");
  const create = sql.indexOf(
    "create trigger portia_access_journal_append_only before update or delete on public.portia_access_journal for each row execute function public.portia_access_journal_append_only();",
  );
  assert.ok(drop >= 0 && create > drop, "idempotent trigger install (drop if exists, then create)");
  assert.ok(create > sql.indexOf("create table if not exists public.portia_access_journal"), "trigger comes after the table");
  assert.ok(!/create\s+policy/i.test(sql) && sql.includes("revoke all on table public.portia_access_journal from public, anon, authenticated;"));
});

test("USR-05 grants: set_level and revoke reach authenticated, never anon; anon keeps only submit, resolve and the closure read", () => {
  for (const name of ["portia_access_set_level", "portia_access_revoke"]) {
    const roles = grantedRoles(name);
    assert.ok(roles.has("authenticated"), `${name}: authenticated`);
    assert.ok(!roles.has("anon"), `${name}: not anon`);
    const { start } = functionParts(name);
    const revoke = sql.indexOf(`revoke all on function public.${name}(`, start);
    const grant = sql.indexOf(`grant execute on function public.${name}(`, start);
    assert.ok(revoke > 0 && grant > revoke, `${name}: revoke all before grant`);
  }
  const anonFunctions = [...sql.matchAll(/grant execute on function public\.(portia_access_\w+)\([^)]*\) to ([^;]+);/g)]
    .filter((match) => match[2].split(",").map((role) => role.trim()).includes("anon"))
    .map((match) => match[1])
    .sort();
  assert.deepEqual(anonFunctions, ["portia_access_closure_enabled", "portia_access_resolve", "portia_access_submit_request"]);
});

test("D-09 re-approval after revocation starts at the type default, not at the old level", () => {
  const { body } = functionParts("portia_access_decide");
  assert.match(body, /new_level := coalesce\(p_level, case when req\.origin = 'sheet' then 2 else 1 end\)::smallint;/);
  const revived = body.match(/update public\.portia_access_people\s+set status = 'active'[^;]*;/)?.[0] ?? "";
  assert.match(revived, /level = new_level/);
  assert.ok(!/level = person\.level/.test(revived));
  assert.match(body, /previous_level := person\.level;/);
});

test("RLS21-04 / D-09 re-approval gives a fresh account link: set from this request, never kept by coalesce", () => {
  const { body } = functionParts("portia_access_decide");
  const revived = body.match(/update public\.portia_access_people\s+set status = 'active'[^;]*;/)?.[0] ?? "";
  assert.ok(revived.length > 0, "the re-approval update exists");
  assert.match(revived, /account_id = account_for_person/, "the link is replaced by the link derived from this request");
  assert.ok(!/coalesce\s*\(\s*person\.account_id/.test(body), "a stranger's old link must not survive a re-approval");
  // The link of another person's row must not block the person's own re-approval: the lookup excludes this nick's row.
  const lookup = body.match(/select case[\s\S]*?into account_for_person;/)?.[0] ?? "";
  assert.match(lookup, /p\.account_id = req\.requested_by/);
  assert.match(lookup, /p\.nickname_key <> req\.nickname_key/, "only a link held by a different nickname blocks the new link");
  assert.match(sql, /create table if not exists public\.portia_access_people[\s\S]*?constraint portia_access_people_account_unique unique \(account_id\)/);
  assert.match(raw, /link is not proof of nickname ownership/i, "the migration states that the account link is not an ownership proof");
});

type Call = { fn: string; args: Record<string, unknown> | undefined };

function stubClient(replies: Record<string, unknown>, calls: Call[] = []): AccessRpcClient {
  return {
    rpc(fn, args) {
      calls.push({ fn, args });
      const reply = replies[fn];
      if (reply instanceof Error) return Promise.resolve({ data: null, error: { message: reply.message } });
      return Promise.resolve({ data: reply, error: null });
    },
  };
}

const personId = "11111111-1111-4111-8111-111111111111";

test("USR-05 setAccessLevel sends exactly the SQL parameter names and maps every reply code", async () => {
  const calls: Call[] = [];
  const replies = { [accessRpc.setLevel]: { code: "updated", level: 3 } as unknown };
  const client = stubClient(replies, calls);
  assert.equal(accessRpc.setLevel, "portia_access_set_level");
  assert.deepEqual(await setAccessLevel(client, { personId, level: 3, expectedLevel: 2 }), { code: "updated", level: 3 });
  assert.deepEqual(calls[0].args, { p_person_id: personId, p_level: 3, p_expected_level: 2 });
  assert.deepEqual(Object.keys(calls[0].args ?? {}).sort(), parameterNames("portia_access_set_level").sort());

  replies[accessRpc.setLevel] = { code: "unchanged", level: 3 };
  assert.deepEqual(await setAccessLevel(client, { personId, level: 3, expectedLevel: 3 }), { code: "unchanged", level: 3 });
  replies[accessRpc.setLevel] = { code: "stale", level: 4 };
  assert.deepEqual(await setAccessLevel(client, { personId, level: 3, expectedLevel: 2 }), { code: "stale", level: 4 });
  replies[accessRpc.setLevel] = { code: "not-found" };
  assert.deepEqual(await setAccessLevel(client, { personId, level: 3, expectedLevel: 2 }), { code: "not-found" });
  replies[accessRpc.setLevel] = { code: "not-active" };
  assert.deepEqual(await setAccessLevel(client, { personId, level: 3, expectedLevel: 2 }), { code: "not-active" });
});

test("USR-05 revokeAccess sends exactly the SQL parameter names and maps every reply code", async () => {
  const calls: Call[] = [];
  const replies = { [accessRpc.revoke]: { code: "revoked" } as unknown };
  const client = stubClient(replies, calls);
  assert.equal(accessRpc.revoke, "portia_access_revoke");
  assert.deepEqual(await revokeAccess(client, { personId }), { code: "revoked" });
  assert.deepEqual(calls[0].args, { p_person_id: personId });
  assert.deepEqual(Object.keys(calls[0].args ?? {}).sort(), parameterNames("portia_access_revoke").sort());
  replies[accessRpc.revoke] = { code: "already-revoked" };
  assert.deepEqual(await revokeAccess(client, { personId }), { code: "already-revoked" });
  replies[accessRpc.revoke] = { code: "not-found" };
  assert.deepEqual(await revokeAccess(client, { personId }), { code: "not-found" });
});

test("USR-05 rule errors from SQL become AccessStoreError carrying the SQL message as code", async () => {
  for (const message of ["self-decision", "owner-protected", "level-above-own", "forbidden", "invalid-level"]) {
    await assert.rejects(
      () => setAccessLevel(stubClient({ [accessRpc.setLevel]: new Error(message) }), { personId, level: 3, expectedLevel: 2 }),
      (error) => error instanceof AccessStoreError && error.code === message,
      message,
    );
    await assert.rejects(
      () => revokeAccess(stubClient({ [accessRpc.revoke]: new Error(message) }), { personId }),
      (error) => error instanceof AccessStoreError && error.code === message,
      message,
    );
  }
});

test("USR-05 the wrappers fail closed on unknown replies", async () => {
  const unexpected = (error: unknown) => error instanceof AccessStoreError && error.code === "unexpected-reply";
  const input = { personId, level: 3 as const, expectedLevel: 2 as const };
  await assert.rejects(() => setAccessLevel(stubClient({ [accessRpc.setLevel]: { code: "surprise" } }), input), unexpected);
  await assert.rejects(() => setAccessLevel(stubClient({ [accessRpc.setLevel]: { code: "updated", level: 9 } }), input), unexpected);
  await assert.rejects(() => setAccessLevel(stubClient({ [accessRpc.setLevel]: { code: "stale" } }), input), unexpected);
  await assert.rejects(() => setAccessLevel(stubClient({ [accessRpc.setLevel]: "updated" }), input), unexpected);
  await assert.rejects(() => revokeAccess(stubClient({ [accessRpc.revoke]: { code: "surprise" } }), { personId }), unexpected);
  await assert.rejects(() => revokeAccess(stubClient({ [accessRpc.revoke]: null }), { personId }), unexpected);
});
