import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { ACCESS_SUBMIT_MAX_AGE_SECONDS, ACCESS_SUBMIT_MAX_AHEAD_SECONDS, accessSubmitMessage } from "./access-session.ts";
import { readContentRow, serverReadMessage, serverReadRpc, ServerReadError, signServerRead } from "./server-read.ts";

// Offline contract of the server-signed reads (Phase 25, plan 25-01, SEC-01): the TypeScript side is pinned to the text of
// the expand migration. Postgres/RLS execution, PostgREST and the live roles are BLOCKED and are NOT proved here.

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationName = "20261115000000_portia_server_read_expand.sql";
const raw = readFileSync(join(repoRoot, "supabase", "migrations", migrationName), "utf8").replace(/\r\n/g, "\n");
// Comment-stripped text so a rule mentioned only in a header comment cannot satisfy a contract.
const sql = raw.replace(/--[^\n]*/g, "");

const SECRET = "s".repeat(40);
const NOW_MS = 1_700_000_123_456;
const NOW_S = 1_700_000_123;

function functionParts(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is missing from the migration`);
  const bodyStart = sql.indexOf("as $$", start);
  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);
  assert.ok(bodyStart > start && bodyEnd > bodyStart, `${name}: cannot find its $$ body`);
  return { header: sql.slice(start, bodyStart), body: sql.slice(bodyStart + 5, bodyEnd), start };
}

test("signServerRead: HMAC-SHA256 of the labelled message, one label per scope", () => {
  assert.equal(serverReadMessage("content", 1700000000), "content-read-v1|1700000000");
  assert.equal(serverReadMessage("employees", 1700000000), "employees-read-v1|1700000000");
  assert.equal(signServerRead("content", 1700000000, SECRET), createHmac("sha256", SECRET).update("content-read-v1|1700000000").digest("hex"));
  assert.equal(signServerRead("employees", 1700000000, SECRET), createHmac("sha256", SECRET).update("employees-read-v1|1700000000").digest("hex"));
  assert.notEqual(signServerRead("content", 1700000000, SECRET), signServerRead("employees", 1700000000, SECRET));
  assert.match(signServerRead("content", 1, SECRET), /^[0-9a-f]{64}$/);
});

test("signServerRead: a short secret or a bad time throws", () => {
  assert.throws(() => signServerRead("content", 1, "short"));
  assert.throws(() => signServerRead("content", 1, "s".repeat(31)));
  assert.doesNotThrow(() => signServerRead("content", 1, "s".repeat(32)));
  assert.throws(() => signServerRead("content", -1, SECRET));
  assert.throws(() => signServerRead("content", 1.5, SECRET));
});

test("domain separation: a read message is never an access-submit message, so one signature cannot open the other door", () => {
  const fields = {
    nickname: "Qloxz",
    origin: "outside" as const,
    tokenHash: "a".repeat(64),
    ipBucket: "b".repeat(32),
    issuedAt: 1700000000,
  };
  const submit = accessSubmitMessage(fields);
  for (const scope of ["content", "employees"] as const) {
    assert.notEqual(serverReadMessage(scope, fields.issuedAt), submit);
    assert.ok(!submit.startsWith(`${scope}-read-v1|`));
    assert.ok(!serverReadMessage(scope, fields.issuedAt).startsWith("access-submit-v1|"));
  }
  assert.notEqual(serverReadMessage("content", 1), serverReadMessage("employees", 1));
});

test("the RPC names are the ones the migration creates", () => {
  assert.deepEqual(serverReadRpc, { content: "portia_content_read", employees: "portia_employees_read" });
});

test("expand migration: additive file, no transaction wrapper, closure function untouched, last line reloads the schema", () => {
  assert.ok(!/^(begin|commit);$/m.test(sql));
  assert.ok(!sql.includes("portia_access_closure_enabled"));
  assert.ok(!/^\s*(drop|alter|truncate)\b/im.test(sql), "expand drops and alters nothing");
  assert.ok(!/^\s*create policy\b/im.test(sql), "expand adds no policy");
  const lines = raw.split("\n").filter((line) => line.trim() !== "");
  assert.equal(lines[lines.length - 1], "notify pgrst, 'reload schema';");
});

for (const [fn, scope] of [["portia_content_read", "content"], ["portia_employees_read", "employees"]] as const) {
  test(`${fn}: signed by the server (label, time window), editor passes without a signature, neutral refusal`, () => {
    const { header, body } = functionParts(fn);
    assert.match(header, new RegExp(`create or replace function public\\.${fn}\\(p_issued_at bigint, p_signature text\\)\\s+returns jsonb`));
    assert.match(header, /\bsecurity definer\b/);
    assert.match(header, /\bset search_path = ''/);
    assert.match(header, /\bstable\b/);
    assert.ok(body.includes(`'${scope}-read-v1|' ||`), `${fn}: message label`);
    assert.ok(body.includes("coalesce(p_issued_at::text, '')"));
    // The same window as the submit signature: the TypeScript constants and the SQL numbers cannot drift apart.
    assert.ok(body.includes(`p_issued_at < now_epoch - ${ACCESS_SUBMIT_MAX_AGE_SECONDS}`), "window back");
    assert.ok(body.includes(`p_issued_at > now_epoch + ${ACCESS_SUBMIT_MAX_AHEAD_SECONDS}`), "window ahead");
    assert.equal(ACCESS_SUBMIT_MAX_AGE_SECONDS, 300);
    assert.equal(ACCESS_SUBMIT_MAX_AHEAD_SECONDS, 60);
    // Only the 'submit' secret, and only after the editor check; the comparison goes through digests.
    assert.ok(body.includes("s.name = 'submit'"));
    const editorCheck = body.indexOf("if not public.portia_can_edit() then");
    assert.ok(editorCheck >= 0, "editor bypass");
    assert.ok(editorCheck < body.indexOf("select s.secret into signing_secret"), "the editor check comes before the secret is read");
    assert.ok(editorCheck < body.indexOf("is distinct from"), "the editor check comes before the signature comparison");
    assert.ok(body.includes("p_signature !~ '^[0-9a-f]{64}$'"));
    assert.ok(body.includes("length(signing_secret) < 32"));
    assert.ok(body.includes("extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256')"));
    assert.ok(body.includes("jsonb_build_object('code', 'unauthorized')"));
    // The data is built only after the refusal branch.
    assert.ok(body.indexOf("'unauthorized'") < body.indexOf("'ok'"), "refusal before the data");
  });

  test(`${fn}: revoke from public, anon and authenticated stands above both grants`, () => {
    const revoke = `revoke all on function public.${fn}(bigint, text) from public, anon, authenticated;`;
    const grantApi = `grant execute on function public.${fn}(bigint, text) to anon, authenticated;`;
    const grantPrivileged = `grant execute on function public.${fn}(bigint, text) to service_role;`;
    for (const statement of [revoke, grantApi, grantPrivileged]) assert.equal(sql.split(statement).length - 1, 1, statement);
    assert.ok(sql.indexOf(revoke) < sql.indexOf(grantApi));
    assert.ok(sql.indexOf(revoke) < sql.indexOf(grantPrivileged));
    assert.ok(functionParts(fn).start < sql.indexOf(revoke));
  });
}

test("portia_content_read answers the row of id main and null when there is none", () => {
  const { body } = functionParts("portia_content_read");
  assert.ok(body.includes("c.id = 'main'"));
  assert.ok(body.includes("jsonb_build_object('code', 'ok', 'row', null)"));
  assert.ok(body.includes("'payload', stored.payload, 'revision', stored.revision, 'updated_at', stored.updated_at"));
});

test("portia_employees_read: profiles without updated_by, manual employees by explicit columns in creation order", () => {
  const { body } = functionParts("portia_employees_read");
  assert.ok(body.includes("to_jsonb(p) - 'updated_by'"));
  assert.ok(body.includes("from public.portia_employee_profiles p"));
  assert.ok(body.includes("jsonb_build_object('employee_id', m.employee_id, 'nickname', m.nickname, 'title', m.title, 'rank', m.rank, 'callsign', m.callsign) order by m.created_at"));
  assert.ok(body.includes("from public.portia_manual_employees m"));
  assert.equal(body.split("'[]'::jsonb").length - 1, 2, "both lists fall back to an empty array");
  assert.ok(body.includes("jsonb_build_object('code', 'ok', 'profiles', profile_rows, 'manual', manual_rows)"));
});

type Call = { fn: string; args: Record<string, unknown> | undefined };

function fakeClient(reply: { data?: unknown; error?: { message: string } | null }, calls: Call[] = []) {
  return {
    calls,
    rpc(fn: string, args?: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null });
    },
  };
}

const forbiddenClient = {
  rpc() {
    throw new Error("this client must not be used");
  },
};

const stored = { payload: { site: "x" }, revision: 7, updated_at: "2026-11-15T10:00:00+00:00" };

test("readContentRow: a visitor is read by the public client with the server signature, the session client is untouched", async () => {
  const calls: Call[] = [];
  const anonymous = fakeClient({ data: { code: "ok", row: stored } }, calls);
  const row = await readContentRow({ editor: false, level: 2 }, { session: forbiddenClient, anonymous: () => anonymous }, { secret: () => SECRET, now: () => NOW_MS });
  assert.deepEqual(row, stored);
  assert.deepEqual(calls, [
    { fn: "portia_content_read", args: { p_issued_at: NOW_S, p_signature: signServerRead("content", NOW_S, SECRET) } },
  ]);
});

test("readContentRow: no stored row gives null", async () => {
  const row = await readContentRow({ editor: false, level: 1 }, { session: forbiddenClient, anonymous: () => fakeClient({ data: { code: "ok", row: null } }) }, { secret: () => SECRET, now: () => NOW_MS });
  assert.equal(row, null);
});

test("readContentRow: unauthorized from the function is a ServerReadError of kind unauthorized", async () => {
  await assert.rejects(
    readContentRow({ editor: false, level: 1 }, { session: forbiddenClient, anonymous: () => fakeClient({ data: { code: "unauthorized" } }) }, { secret: () => SECRET, now: () => NOW_MS }),
    (error: unknown) => error instanceof ServerReadError && error.kind === "unauthorized",
  );
});

test("readContentRow: a client error or a reply of an unknown shape is kind unavailable, with no text of the cause", async () => {
  const clients = (reply: Parameters<typeof fakeClient>[0]) => ({ session: forbiddenClient, anonymous: () => fakeClient(reply) });
  const options = { secret: () => SECRET, now: () => NOW_MS };
  const bad: Parameters<typeof fakeClient>[0][] = [
    { error: { message: `boom ${SECRET}` } },
    { data: null },
    { data: "ok" },
    { data: [] },
    { data: { code: "weird" } },
    { data: { code: "ok" } },
    { data: { code: "ok", row: 5 } },
    { data: { code: "ok", row: { payload: {}, revision: "7", updated_at: "x" } } },
    { data: { code: "ok", row: { payload: {}, revision: 7, updated_at: 3 } } },
  ];
  for (const reply of bad) {
    await assert.rejects(readContentRow({ editor: false, level: 1 }, clients(reply), options), (error: unknown) => {
      assert.ok(error instanceof ServerReadError, JSON.stringify(reply));
      assert.equal(error.kind, "unavailable");
      assert.ok(!error.message.includes(SECRET));
      return true;
    });
  }
});
