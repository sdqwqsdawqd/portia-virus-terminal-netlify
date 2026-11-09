import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  ACCESS_REQUEST_LIMITS,
  AccessStoreError,
  accessRpc,
  clearAccessCooldown,
  submitAccessRequest,
  type AccessRpcClient,
} from "./access-store.ts";

// Offline contract tests for the repeat-request rules (21-03, D-06 / T-21-16 / T-21-17 / T-21-18).
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

const journalInsert = /insert into public\.portia_access_journal[^;]*;/g;

test("D-06 the SQL literals in submit equal ACCESS_REQUEST_LIMITS", () => {
  const { body } = functionParts("portia_access_submit_request");
  assert.deepEqual(ACCESS_REQUEST_LIMITS, { cooldownMinutes: 60, perNicknamePerDay: 3, perIpBucketPerDay: 10, maxPending: 200 });
  assert.equal(ACCESS_REQUEST_LIMITS.cooldownMinutes, 60);
  assert.ok(body.includes("interval '1 hour'"), "pause is interval '1 hour' (60 minutes)");
  assert.ok(body.includes("interval '24 hours'"), "daily caps count the last 24 hours");
  const cap = (variable: string) => Number(body.match(new RegExp(`${variable} >= (\\d+)`))?.[1]);
  assert.equal(cap("recent_by_nickname"), ACCESS_REQUEST_LIMITS.perNicknamePerDay);
  assert.equal(cap("recent_by_bucket"), ACCESS_REQUEST_LIMITS.perIpBucketPerDay);
  assert.equal(cap("pending_total"), ACCESS_REQUEST_LIMITS.maxPending);
  const resolve = functionParts("portia_access_resolve").body;
  assert.ok(resolve.includes("interval '1 hour'") && !/interval '\d+ (minutes?|hours?)'/.test(resolve.replaceAll("interval '1 hour'", "")),
    "resolve uses the same pause literal and no other");
});

test("D-06 submit checks run in order: own device, caps, pending elsewhere, pause, insert", () => {
  const { body } = functionParts("portia_access_submit_request");
  const at = (needle: string) => {
    const index = body.indexOf(needle);
    assert.ok(index >= 0, `submit body lacks ${needle}`);
    return index;
  };
  const deviceBusy = at("'device-busy'");
  const throttled = at("'throttled'");
  const unavailable = at("'unavailable'");
  const cooldown = at("'cooldown'");
  const insert = at("insert into public.portia_access_requests");
  assert.ok(deviceBusy < throttled, "own-device answers come before the caps");
  assert.ok(throttled < unavailable, "caps come before the pending-elsewhere reply");
  assert.ok(unavailable < cooldown, "pending-elsewhere comes before the pause");
  assert.ok(cooldown < insert, "the pause comes before the insert");
  assert.ok(body.lastIndexOf("'unavailable'") > cooldown, "a pause held by another device answers unavailable, not cooldown");
});

test("D-06 the pause is an uncleared rejected or revoked request decided within the last hour", () => {
  const { body } = functionParts("portia_access_submit_request");
  assert.match(body, /status in \('rejected', 'revoked'\)/);
  assert.match(body, /cooldown_cleared_at is null/);
  assert.match(body, /decided_at > now\(\) - interval '1 hour'/);
  assert.match(body, /decided_at \+ interval '1 hour'/, "retryAt = decided_at + 1 hour");
  assert.match(body, /'code', 'cooldown', 'retryAt'/);
  assert.ok(body.includes("token_hash = p_token_hash"), "only the requesting device sees the pause");
});

test("D-06 caps use only access rows under the queue lock and never touch Promotion buckets", () => {
  const { body } = functionParts("portia_access_submit_request");
  assert.ok(!body.includes("portia_promo_"), "separate namespace from Promotion");
  assert.ok(body.includes("'access:queue'"), "the global advisory lock makes the 200-pending count exact");
  assert.ok(body.indexOf("'access:queue'") < body.indexOf("'throttled'"));
  assert.match(body, /select count\(\*\) into recent_by_nickname[\s\S]*?nickname_key = normalized_key/);
  assert.match(body, /select count\(\*\) into recent_by_bucket[\s\S]*?ip_bucket = p_ip_bucket/);
  assert.match(body, /select count\(\*\) into pending_total[\s\S]*?status = 'pending'/);
});

test("D-06 submit replies stay neutral: only own-device states are specific", () => {
  const { body } = functionParts("portia_access_submit_request");
  const codes = new Set([...body.matchAll(/'code', '([a-z-]+)'/g)].map((match) => match[1]));
  assert.deepEqual(
    [...codes].sort(),
    ["approved", "cooldown", "created", "device-busy", "invalid", "pending", "throttled", "unavailable"],
  );
  assert.ok(!/'level'|'nickname'|'status'|'person/.test(body.replace(/'access:nickname:'/g, "")), "no person data in any submit reply");
});

test("D-06 at most one pending request per nickname is a unique partial index", () => {
  assert.match(
    sql,
    /create unique index if not exists portia_access_one_pending_per_nickname\s+on public\.portia_access_requests \(nickname_key\) where status = 'pending';/,
  );
});

test("T-21-18 clear_cooldown: owner-only first statement, journaled once, not reachable by anon", () => {
  const { header, body } = functionParts("portia_access_clear_cooldown");
  assert.deepEqual(parameterNames("portia_access_clear_cooldown"), ["p_nickname_key"]);
  assert.ok(header.includes("security definer") && header.includes("set search_path = ''") && header.includes("volatile"));
  const first = body.split("begin\n")[1].split("\n")[0].trim();
  assert.equal(first, "if not public.portia_is_owner() then raise exception 'owner-required'; end if;");
  assert.match(body, /public\.portia_access_nickname_key\(p_nickname_key\) is distinct from p_nickname_key|public\.portia_access_nickname_key\(p_nickname_key\) = p_nickname_key/);
  assert.match(body, /'code', 'invalid'/);
  assert.match(body, /'access:nickname:'/);
  assert.match(body, /set cooldown_cleared_at = now\(\), cooldown_cleared_by = auth\.uid\(\)/);
  assert.match(body, /status in \('rejected', 'revoked'\)/);
  assert.match(body, /cooldown_cleared_at is null/);
  assert.match(body, /decided_at > now\(\) - interval '1 hour'/);
  assert.match(body, /'code', 'no-cooldown'/);
  const inserts = [...body.matchAll(journalInsert)].map((match) => match[0]);
  assert.equal(inserts.length, 1, "exactly one journal insert");
  assert.ok(inserts[0].includes("'cooldown-clear'") && inserts[0].includes("'count'"));
  assert.ok(body.indexOf("'no-cooldown'") < body.search(journalInsert), "nothing to clear writes no journal row");
  assert.match(body, /'code', 'cleared'/);
  const roles = grantedRoles("portia_access_clear_cooldown");
  assert.ok(roles.has("authenticated") && !roles.has("anon"));
  const revoke = sql.indexOf("revoke all on function public.portia_access_clear_cooldown(", functionParts("portia_access_clear_cooldown").start);
  const grant = sql.indexOf("grant execute on function public.portia_access_clear_cooldown(", revoke);
  assert.ok(revoke > 0 && grant > revoke, "revoke all before grant");
});

test("D-06 request cleanup policy: no automatic deletion and no new job in the migration", () => {
  assert.ok(!/\bdelete\s+from\b/i.test(sql), "no row is ever deleted by this migration's functions");
  assert.ok(!/cron\.schedule/i.test(sql.replace(/portia_access_fingerprint/g, "")), "no new scheduled job in Phase 21");
  assert.ok(/no automatic deletion/i.test(raw) && /200-pending cap/i.test(raw), "the policy is recorded in the migration header");
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

const submitInput = { nickname: "Qloxz", origin: "sheet" as const, tokenHash: "a".repeat(64), ipBucket: "b".repeat(32) };

test("D-06 submitAccessRequest maps cooldown with retryAt and throttled, and fails closed without retryAt", async () => {
  const retryAt = "2026-11-09T12:00:00+00:00";
  assert.deepEqual(
    await submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "cooldown", retryAt } }), submitInput),
    { code: "cooldown", retryAt },
  );
  assert.deepEqual(await submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "throttled" } }), submitInput), { code: "throttled" });
  assert.deepEqual(await submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "unavailable" } }), submitInput), { code: "unavailable" });
  const unexpected = (error: unknown) => error instanceof AccessStoreError && error.code === "unexpected-reply";
  await assert.rejects(() => submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "cooldown" } }), submitInput), unexpected);
  await assert.rejects(() => submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "cooldown", retryAt: 5 } }), submitInput), unexpected);
});

test("T-21-18 clearAccessCooldown sends p_nickname_key, maps the codes, and passes owner-required through", async () => {
  const calls: Call[] = [];
  const replies: Record<string, unknown> = { [accessRpc.clearCooldown]: { code: "cleared" } };
  const client = stubClient(replies, calls);
  assert.equal(accessRpc.clearCooldown, "portia_access_clear_cooldown");
  assert.deepEqual(await clearAccessCooldown(client, { nicknameKey: "qloxz" }), { code: "cleared" });
  assert.deepEqual(calls[0].args, { p_nickname_key: "qloxz" });
  assert.deepEqual(Object.keys(calls[0].args ?? {}).sort(), parameterNames("portia_access_clear_cooldown").sort());
  replies[accessRpc.clearCooldown] = { code: "no-cooldown" };
  assert.deepEqual(await clearAccessCooldown(client, { nicknameKey: "qloxz" }), { code: "no-cooldown" });
  replies[accessRpc.clearCooldown] = { code: "invalid" };
  assert.deepEqual(await clearAccessCooldown(client, { nicknameKey: "x" }), { code: "invalid" });
  replies[accessRpc.clearCooldown] = { code: "surprise" };
  await assert.rejects(
    () => clearAccessCooldown(client, { nicknameKey: "qloxz" }),
    (error) => error instanceof AccessStoreError && error.code === "unexpected-reply",
  );
  await assert.rejects(
    () => clearAccessCooldown(stubClient({ [accessRpc.clearCooldown]: new Error("owner-required") }), { nicknameKey: "qloxz" }),
    (error) => error instanceof AccessStoreError && error.code === "owner-required",
  );
});
