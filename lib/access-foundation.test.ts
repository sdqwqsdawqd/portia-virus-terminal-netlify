import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { isValidNickname, nicknameKey, NICKNAME_PATTERN, parseNicknameInput, sameNickname } from "./nickname.ts";
import {
  ACCESS_COOKIE,
  accessIpBucket,
  accessTokenDigest,
  buildAccessCookie,
  createAccessToken,
  readAccessToken,
} from "./access-session.ts";
import { deviceTokenDigest } from "./portia-device-binding.ts";
import {
  AccessStoreError,
  accessRpc,
  decideAccessRequest,
  resolveAccess,
  submitAccessRequest,
  type AccessRpcClient,
} from "./access-store.ts";

// Offline contract tests for the Phase 21 access foundation (21-01). No database is available here: the SQL is
// checked as text, and Postgres/RLS behaviour stays BLOCKED until an isolated staging run.

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationPath = join(repoRoot, "supabase", "migrations", "20261109000000_portia_access_foundation.sql");
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const serviceRole = "service_role";

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

const nicknameSamples: string[] = [
  "Qloxz", "qloxz", "abc", "a".repeat(20), "A_b_C", "___", "ab", "a".repeat(21), "Ql oxz", "Ql-oxz",
  "Qлoxz", "Qlo‍xz", " Qloxz", "Qloxz ", "", "Qloxz\n", "Åberg", "abı",
];

test("ACC-04 nickname rule accepts the Roblox shape and rejects everything else", () => {
  for (const ok of ["Qloxz", "qloxz", "abc", "a".repeat(20), "A_b_C", "___"]) assert.equal(isValidNickname(ok), true, ok);
  const bad = ["ab", "a".repeat(21), "Ql oxz", "Ql-oxz", "Qлoxz", "Qlo‍xz", " Qloxz", "Qloxz ", "", "Qloxz\n"];
  for (const value of bad) assert.equal(isValidNickname(value), false, JSON.stringify(value));
  for (const value of [null, undefined, 42, {}]) assert.equal(isValidNickname(value), false);
});

test("ACC-04 Qloxz and qloxz are one key; parseNicknameInput trims but the rule does not", () => {
  assert.equal(nicknameKey("Qloxz"), "qloxz");
  assert.equal(nicknameKey("qloxz"), "qloxz");
  assert.equal(nicknameKey("ab"), null);
  assert.equal(sameNickname("Qloxz", "qLOXZ"), true);
  assert.equal(sameNickname("Qloxz", "Qloxy"), false);
  assert.equal(sameNickname("ab", "ab"), false);
  assert.deepEqual(parseNicknameInput(" Qloxz "), { nickname: "Qloxz", key: "qloxz" });
  assert.equal(parseNicknameInput("Ql oxz"), null);
  assert.equal(parseNicknameInput(7), null);
});

test("ACC-04 parity: the SQL nickname rule carries the identical regex literal under collate C", () => {
  const { header, body } = functionParts("portia_access_nickname_key");
  const literal = body.match(/~ '([^']+)'/)?.[1];
  assert.ok(literal, "regex literal not found in portia_access_nickname_key");
  assert.equal(literal, NICKNAME_PATTERN.source);
  assert.ok(body.includes('collate "C"'));
  assert.ok(!header.includes("security definer"), "the key function must not be security definer");
  const sqlRule = new RegExp(literal);
  for (const sample of nicknameSamples) {
    assert.equal(sqlRule.test(sample), isValidNickname(sample), `TS and SQL disagree on ${JSON.stringify(sample)}`);
  }
});

test("access token digest is HMAC-labelled access: and apart from the promotion device digest", () => {
  const token = "A".repeat(43);
  const secret = "s".repeat(32);
  const digest = accessTokenDigest(token, secret);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.notEqual(digest, deviceTokenDigest(token, secret));
  assert.equal(digest, accessTokenDigest(token, secret));
  assert.throws(() => accessTokenDigest("A".repeat(42), secret), /Invalid access token/);
  assert.throws(() => accessTokenDigest(token, "short"), /at least 32/);
});

test("access cookie round-trips and rejects malformed tokens", () => {
  const token = createAccessToken(() => new Uint8Array(32).fill(9));
  assert.equal(token.length, 43);
  const cookie = buildAccessCookie(token);
  assert.ok(cookie.startsWith(`${ACCESS_COOKIE}=`));
  for (const flag of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"]) assert.ok(cookie.includes(flag), flag);
  assert.equal(readAccessToken(new Headers({ cookie: `other=1; ${cookie.split(";")[0]}` })), token);
  assert.equal(readAccessToken(new Headers()), null);
  assert.equal(readAccessToken(new Headers({ cookie: `${ACCESS_COOKIE}=short` })), null);
  assert.equal(readAccessToken(new Headers({ cookie: `${ACCESS_COOKIE}=%E0%A4%A` })), null);
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

test("tracer: nickname -> token -> digest -> submit -> editor approves without level -> own state", async () => {
  const calls: Call[] = [];
  const client = stubClient(
    {
      [accessRpc.submit]: { code: "created" },
      [accessRpc.decide]: { code: "approved", personId: "11111111-1111-4111-8111-111111111111", level: 2 },
      [accessRpc.resolve]: { state: "approved", nickname: "Qloxz", level: 2 },
    },
    calls,
  );
  const parsed = parseNicknameInput(" Qloxz ");
  assert.ok(parsed);
  const secret = "k".repeat(40);
  const token = createAccessToken(() => new Uint8Array(32).fill(7));
  const tokenHash = accessTokenDigest(token, secret);
  const ipBucket = accessIpBucket(new Headers({ "x-forwarded-for": "203.0.113.9" }), secret);

  assert.deepEqual(await submitAccessRequest(client, { nickname: parsed.nickname, origin: "sheet", tokenHash, ipBucket }), { code: "created" });
  const decided = await decideAccessRequest(client, { requestId: "22222222-2222-4222-8222-222222222222", decision: "approve" });
  assert.deepEqual(decided, { code: "approved", personId: "11111111-1111-4111-8111-111111111111", level: 2 });
  assert.deepEqual(await resolveAccess(client, tokenHash), { state: "approved", nickname: "Qloxz", level: 2 });

  assert.deepEqual(calls.map((call) => call.fn), ["portia_access_submit_request", "portia_access_decide", "portia_access_resolve"]);
  assert.deepEqual(calls[0].args, { p_nickname: "Qloxz", p_origin: "sheet", p_token_hash: tokenHash, p_ip_bucket: ipBucket });
  assert.equal(calls[1].args?.p_level, null, "approve without an explicit level sends null so the SQL default decides");
  assert.equal(JSON.stringify(calls).includes(token), false, "the raw token never reaches the RPC");
});

test("every RPC argument name equals a parameter of the one-line SQL signature", async () => {
  const calls: Call[] = [];
  const client = stubClient(
    {
      [accessRpc.submit]: { code: "pending" },
      [accessRpc.decide]: { code: "rejected" },
      [accessRpc.resolve]: { state: "none" },
    },
    calls,
  );
  const tokenHash = "a".repeat(64);
  await submitAccessRequest(client, { nickname: "Qloxz", origin: "outside", tokenHash, ipBucket: "b".repeat(32) });
  await decideAccessRequest(client, { requestId: "22222222-2222-4222-8222-222222222222", decision: "reject" });
  await resolveAccess(client, tokenHash);
  for (const call of calls) {
    assert.deepEqual(Object.keys(call.args ?? {}).sort(), parameterNames(call.fn).sort(), call.fn);
  }
});

test("grants: submit and resolve reach anon and authenticated, decide only authenticated", () => {
  for (const name of ["portia_access_submit_request", "portia_access_resolve"]) {
    const roles = grantedRoles(name);
    assert.ok(roles.has("anon") && roles.has("authenticated"), name);
  }
  const decide = grantedRoles("portia_access_decide");
  assert.deepEqual([...decide].filter((role) => role !== serviceRole).sort(), ["authenticated"]);
  for (const name of ["portia_access_nickname_key", "portia_access_caller_level"]) {
    assert.deepEqual([...grantedRoles(name)], [serviceRole], `${name} is for the privileged API role only`);
  }
});

test("the store fails closed on RPC errors and unknown replies", async () => {
  const tokenHash = "a".repeat(64);
  const submitInput = { nickname: "Qloxz", origin: "sheet" as const, tokenHash, ipBucket: "b".repeat(32) };
  const decideInput = { requestId: "22222222-2222-4222-8222-222222222222", decision: "approve" as const };

  await assert.rejects(
    () => decideAccessRequest(stubClient({ [accessRpc.decide]: new Error("forbidden") }), decideInput),
    (error) => error instanceof AccessStoreError && error.code === "forbidden",
  );
  const unexpected = (error: unknown) => error instanceof AccessStoreError && error.code === "unexpected-reply";
  await assert.rejects(() => submitAccessRequest(stubClient({ [accessRpc.submit]: { code: "surprise" } }), submitInput), unexpected);
  await assert.rejects(() => submitAccessRequest(stubClient({ [accessRpc.submit]: "created" }), submitInput), unexpected);
  await assert.rejects(() => resolveAccess(stubClient({ [accessRpc.resolve]: { state: "approved", nickname: "Qloxz", level: 9 } }), tokenHash), unexpected);
  await assert.rejects(() => resolveAccess(stubClient({ [accessRpc.resolve]: { state: "weird", nickname: "Qloxz" } }), tokenHash), unexpected);
  await assert.rejects(() => decideAccessRequest(stubClient({ [accessRpc.decide]: { code: "surprise" } }), decideInput), unexpected);
  await assert.rejects(() => decideAccessRequest(stubClient({ [accessRpc.decide]: { code: "approved", personId: "x", level: 0 } }), decideInput), unexpected);

  assert.deepEqual(
    await decideAccessRequest(stubClient({ [accessRpc.decide]: { code: "already-decided", status: "rejected" } }), decideInput),
    { code: "already-decided", status: "rejected" },
  );
  assert.deepEqual(
    await resolveAccess(stubClient({ [accessRpc.resolve]: { state: "rejected", nickname: "Qloxz", retryAt: null } }), tokenHash),
    { state: "rejected", nickname: "Qloxz", retryAt: null },
  );
});

test("SQL contract: every access function pins search_path and revokes before it grants", () => {
  const names = [...sql.matchAll(/create or replace function public\.(portia_access_\w+)\(/g)].map((match) => match[1]);
  assert.deepEqual(
    [...names].sort(),
    [
      "portia_access_caller_level",
      "portia_access_clear_cooldown",
      "portia_access_decide",
      "portia_access_journal_append_only",
      "portia_access_nickname_key",
      "portia_access_resolve",
      "portia_access_revoke",
      "portia_access_set_level",
      "portia_access_submit_request",
      "portia_access_target_guard",
    ],
  );
  for (const name of names) {
    const { header, start } = functionParts(name);
    assert.ok(header.includes("set search_path = ''"), `${name} must set search_path = ''`);
    const revoke = sql.indexOf(`revoke all on function public.${name}(`, start);
    const grant = sql.indexOf(`grant execute on function public.${name}(`, start);
    assert.ok(revoke > 0 && grant > 0, `${name} needs a revoke and a grant`);
    assert.ok(revoke < grant, `${name}: grant before revoke all`);
    assert.match(sql.slice(revoke, sql.indexOf(";", revoke)), /from public, anon, authenticated$/, `${name}: revoke must cover public, anon, authenticated`);
  }
  for (const name of ["portia_access_submit_request", "portia_access_resolve", "portia_access_decide", "portia_access_caller_level"]) {
    assert.ok(functionParts(name).header.includes("security definer"), `${name} must be security definer`);
  }
});

test("SQL contract: decide is gated, conditional, journaled and applies the type defaults", () => {
  const { body } = functionParts("portia_access_decide");
  const firstStatement = body.split("begin\n")[1].split("\n")[0].trim();
  assert.equal(firstStatement, "if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;");
  assert.ok(body.includes("caller_level := public.portia_access_caller_level();"));
  assert.match(body, /where id = req\.id and status = 'pending'/);
  assert.match(body, /'already-decided'/);
  assert.match(body, /when req\.origin = 'sheet' then 2 else 1 end/);
  const inserts = [...body.matchAll(/insert into public\.portia_access_journal[^;]*;/g)].map((match) => match[0]);
  assert.equal(inserts.length, 2, "one journal insert per branch");
  assert.ok(inserts.some((text) => text.includes("'approve'")) && inserts.some((text) => text.includes("'reject'")));
  assert.ok(!functionParts("portia_access_submit_request").body.includes("portia_access_settings"));
});

test("SQL contract: the three tables and the journal sequence are closed to API roles", () => {
  for (const table of ["portia_access_people", "portia_access_requests", "portia_access_journal"]) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`), `${table}: RLS`);
    assert.ok(sql.includes(`revoke all on table public.${table} from public, anon, authenticated;`), `${table}: revoke`);
    assert.ok(sql.includes(`grant all on table public.${table} to ${serviceRole};`), `${table}: privileged API role`);
  }
  assert.ok(sql.includes("revoke all on sequence public.portia_access_journal_id_seq from public, anon, authenticated;"));
  assert.ok(!/create\s+policy/i.test(sql), "no policies: RPC only");
  assert.ok(!/references\s+auth\./i.test(sql), "no foreign keys to auth.users");
  assert.ok(!/^(begin|commit);$/m.test(sql));
  assert.ok(existsSync(migrationPath));
});

test("visitor behaviour is unchanged: nothing under app/ or components/ uses the access modules or RPCs", () => {
  const files: string[] = [];
  for (const dir of ["app", "components"]) {
    const base = join(repoRoot, dir);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { recursive: true }) as string[]) {
      const full = join(base, entry);
      if (/\.(ts|tsx)$/.test(entry) && statSync(full).isFile()) files.push(full);
    }
  }
  assert.ok(files.length > 0, "expected to scan some app/components files");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /access-store|access-session|access-levels|\/nickname(\.ts)?["']/, `${file} imports an access module`);
    assert.ok(!text.includes("portia_access_"), `${file} references a portia_access_ RPC`);
  }
});
