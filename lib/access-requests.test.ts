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
import { ACCESS_SUBMIT_MAX_AGE_SECONDS, ACCESS_SUBMIT_MAX_AHEAD_SECONDS, accessSubmitMessage } from "./access-session.ts";

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
  assert.deepEqual(ACCESS_REQUEST_LIMITS, { cooldownMinutes: 60, perNicknamePerDay: 3, perIpBucketPerDay: 10, maxPending: 200, maxNewPerMinute: 20 });
  assert.equal(ACCESS_REQUEST_LIMITS.cooldownMinutes, 60);
  assert.ok(body.includes("interval '1 hour'"), "pause is interval '1 hour' (60 minutes)");
  assert.ok(body.includes("interval '24 hours'"), "daily caps count the last 24 hours");
  const cap = (variable: string) => Number(body.match(new RegExp(`${variable} >= (\\d+)`))?.[1]);
  assert.equal(cap("recent_by_nickname"), ACCESS_REQUEST_LIMITS.perNicknamePerDay);
  assert.equal(cap("recent_by_bucket"), ACCESS_REQUEST_LIMITS.perIpBucketPerDay);
  assert.equal(cap("pending_total"), ACCESS_REQUEST_LIMITS.maxPending);
  assert.equal(cap("new_last_minute"), ACCESS_REQUEST_LIMITS.maxNewPerMinute);
  assert.ok(body.includes("interval '1 minute'"), "the global rate counts the last minute");
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
    ["approved", "cooldown", "created", "device-busy", "invalid", "pending", "throttled", "unauthorized", "unavailable"],
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

const submitInput = { nickname: "Qloxz", origin: "sheet" as const, tokenHash: "a".repeat(64), ipBucket: "b".repeat(32), submitSecret: "q".repeat(40), issuedAt: 1_762_650_000 };

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

// ---- RLS21-01: server-signed submit (owner decision 1a, 2026-11-09) ----

test("RLS21-01 submit verifies a server HMAC before it takes any lock or reads any request row", () => {
  const { header, body } = functionParts("portia_access_submit_request");
  assert.deepEqual(parameterNames("portia_access_submit_request"), ["p_nickname", "p_origin", "p_token_hash", "p_ip_bucket", "p_issued_at", "p_signature"]);
  assert.match(header, /p_issued_at bigint, p_signature text/);
  assert.ok(header.includes("security definer") && header.includes("set search_path = ''"));
  const at = (needle: string) => {
    const index = body.indexOf(needle);
    assert.ok(index >= 0, `submit body lacks ${needle}`);
    return index;
  };
  const secretRead = at("from public.portia_access_secrets");
  const hmac = at("extensions.hmac(");
  const unauthorized = at("'unauthorized'");
  assert.ok(secretRead < hmac && hmac < unauthorized, "secret read, then HMAC, then the neutral refusal");
  assert.ok(unauthorized < at("'access:queue'"), "an unsigned caller never reaches the global advisory lock");
  assert.ok(unauthorized < at("from public.portia_access_requests"), "an unsigned caller never reads request rows");
  assert.match(body, /extensions\.hmac\([\s\S]*?,\s*signing_secret, 'sha256'\)/, "HMAC-SHA256 with the stored secret");
  assert.match(body, /encode\(extensions\.hmac\(/, "the expected signature is the lowercase hex digest");
  // Double-hash comparison: the comparison time does not depend on how many leading characters match.
  assert.match(body, /extensions\.digest\(p_signature, 'sha256'\)/);
  assert.match(body, /extensions\.digest\(expected_signature, 'sha256'\)/);
});

test("RLS21-01 the SQL signs the same message as the server module and uses the same time window", () => {
  const { body } = functionParts("portia_access_submit_request");
  const concat = body.match(/'access-submit-v1\|' \|\| [^;]*?::text/)?.[0];
  assert.ok(concat, "message concatenation not found");
  assert.equal(
    concat.replace(/\s+/g, " "),
    "'access-submit-v1|' || p_origin || '|' || p_nickname || '|' || p_token_hash || '|' || p_ip_bucket || '|' || p_issued_at::text",
  );
  const message = accessSubmitMessage({ nickname: "Qloxz", origin: "sheet", tokenHash: "a".repeat(64), ipBucket: "b".repeat(32), issuedAt: 7 });
  assert.equal(message, ["access-submit-v1", "sheet", "Qloxz", "a".repeat(64), "b".repeat(32), "7"].join("|"));
  assert.equal(ACCESS_SUBMIT_MAX_AGE_SECONDS, 300);
  assert.equal(ACCESS_SUBMIT_MAX_AHEAD_SECONDS, 60);
  assert.match(body, new RegExp(`p_issued_at < now_epoch - ${ACCESS_SUBMIT_MAX_AGE_SECONDS}`));
  assert.match(body, new RegExp(`p_issued_at > now_epoch \\+ ${ACCESS_SUBMIT_MAX_AHEAD_SECONDS}`));
  assert.match(body, /now_epoch bigint := floor\(extract\(epoch from now\(\)\)\)::bigint;/);
  // The nickname is validated before it is concatenated, so the pipe separator cannot be forged.
  assert.ok(body.indexOf("normalized_key is null") < body.indexOf("'access-submit-v1|'"));
});

test("RLS21-01 submit fails closed when the secret is absent, short or the signature is malformed", () => {
  const { body } = functionParts("portia_access_submit_request");
  assert.match(body, /select s\.secret into signing_secret\s+from public\.portia_access_secrets s\s+where s\.name = 'submit';/);
  assert.match(body, /signing_secret is null or length\(signing_secret\) < 32/);
  assert.match(body, /p_issued_at is null or p_signature is null or p_signature !~ '\^\[0-9a-f\]\{64\}\$'/);
  const refusal = body.match(/return jsonb_build_object\('code', 'unauthorized'\);/g) ?? [];
  assert.equal(refusal.length, 1, "one neutral refusal for every signature failure");
  // The refusal does not say which check failed and carries no data.
  assert.ok(!/raise exception/.test(body), "no exception text tells an attacker which check failed");
});

test("RLS21-01 the secret table is closed to every API role, holds no value in the migration and has no policy", () => {
  assert.match(
    sql,
    /create table if not exists public\.portia_access_secrets \(\s*name text primary key,\s*secret text not null,\s*updated_at timestamptz not null default now\(\),\s*constraint portia_access_secrets_name_check check \(name in \('submit'\)\),\s*constraint portia_access_secrets_secret_check check \(length\(secret\) >= 32\)\s*\);/,
  );
  assert.ok(sql.includes("alter table public.portia_access_secrets enable row level security;"));
  assert.ok(sql.includes("revoke all on table public.portia_access_secrets from public, anon, authenticated;"));
  const privileged = sql.match(/revoke all on table public\.portia_access_secrets from (service_role);/)?.[1];
  assert.equal(privileged, "service_role", "the privileged API role has no privilege either: only the definer function and the table owner read it");
  assert.doesNotMatch(sql, /grant [^;]* on table public\.portia_access_secrets\b/, "no grant on the secret table to anyone");
  assert.doesNotMatch(sql, /create\s+policy[^;]*portia_access_secrets/i);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.portia_access_secrets/i, "the migration carries no secret value; the owner inserts it at apply time");
  assert.doesNotMatch(sql, /update\s+public\.portia_access_secrets/i);
  for (const name of ["portia_access_resolve", "portia_access_closure_enabled", "portia_access_decide", "portia_access_set_level", "portia_access_revoke", "portia_access_clear_cooldown", "portia_access_set_closure"]) {
    assert.ok(!functionParts(name).body.includes("portia_access_secrets"), `${name} never touches the secret`);
  }
  assert.ok(/owner step/i.test(raw) && /portia_access_secrets/.test(raw.slice(0, raw.indexOf("create or replace function"))), "the header documents the owner step");
});

test("RLS21-01 the global rate limit runs under the queue lock and has an index for its count", () => {
  const { body } = functionParts("portia_access_submit_request");
  assert.match(body, /select count\(\*\) into new_last_minute from public\.portia_access_requests r\s+where r\.created_at > now\(\) - interval '1 minute';/);
  assert.match(body, /recent_by_nickname >= 3 or recent_by_bucket >= 10 or pending_total >= 200 or new_last_minute >= 20/);
  assert.ok(body.indexOf("'access:queue'") < body.indexOf("into new_last_minute"), "the count is exact under the global lock");
  assert.match(sql, /create index if not exists portia_access_requests_created_recent\s+on public\.portia_access_requests \(created_at desc\);/);
});

test("RLS21-01 submitAccessRequest signs with the server secret, sends the time and signature and maps unauthorized", async () => {
  const calls: Call[] = [];
  const client = stubClient({ [accessRpc.submit]: { code: "created" } }, calls);
  await submitAccessRequest(client, submitInput);
  const args = calls[0].args ?? {};
  assert.equal(args.p_issued_at, submitInput.issuedAt);
  assert.match(String(args.p_signature), /^[0-9a-f]{64}$/);
  assert.equal(Object.values(args).includes(submitInput.submitSecret), false);
  assert.deepEqual(await submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "unauthorized" } }), submitInput), { code: "unauthorized" });
  // Without an explicit time the store stamps the current second.
  const before = Math.floor(Date.now() / 1000);
  const stamped: Call[] = [];
  await submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "created" } }, stamped), { ...submitInput, issuedAt: undefined });
  const issued = Number(stamped[0].args?.p_issued_at);
  assert.ok(Number.isInteger(issued) && issued >= before && issued <= before + 5, `stamped ${issued}`);
  // A short secret fails before any RPC is made.
  const untouched: Call[] = [];
  await assert.rejects(() => submitAccessRequest(stubClient({}, untouched), { ...submitInput, submitSecret: "short" }), /at least 32/);
  assert.equal(untouched.length, 0);
});
