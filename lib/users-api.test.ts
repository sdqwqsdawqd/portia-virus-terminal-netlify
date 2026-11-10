import assert from "node:assert/strict";
import test from "node:test";
import { AccessStoreError, accessRpc, type AccessRpcClient } from "./access-store.ts";
import { handleUsersGet, mapAccessError, type UsersApiDeps } from "./users-api.ts";

const row = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  nickname: "QLoxz",
  nicknameKey: "qloxz",
  origin: "sheet",
  createdAt: "2026-11-10T00:00:00.000Z",
  existingLevel: null,
  canDecide: true,
  reason: null,
};
const event = { type: "approve", at: "2026-11-10T00:01:00.000Z", actor: "q•••z@gmail.com" };
const person = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  nickname: "Ada_1",
  nicknameKey: "ada_1",
  origin: "manual",
  level: 3,
  approvedAt: "2026-11-10T00:01:00.000Z",
  canSetLevel: true,
  canRevoke: true,
  reason: null,
  lastEvent: event,
};
const closed = {
  nickname: "Bob_2",
  nicknameKey: "bob_2",
  status: "rejected",
  decidedAt: "2026-11-10T00:02:00.000Z",
  retryAt: "2026-11-10T01:02:00.000Z",
  lastEvent: { ...event, type: "reject" },
};
const list = (overrides: Record<string, unknown> = {}) => ({
  callerIsOwner: false,
  pendingTotalAll: 1,
  serverNow: "2026-11-10T00:00:00.000Z",
  pending: { total: 1, rows: [row] },
  people: { total: 1, rows: [person] },
  closed: { total: 1, rows: [closed] },
  ...overrides,
});

function dependencies(overrides: Partial<UsersApiDeps> & { reply?: unknown; rpcError?: { message: string; code?: string } } = {}) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const client: AccessRpcClient = { rpc: async (fn, args) => {
    calls.push({ fn, args });
    return { data: overrides.reply ?? list(), error: overrides.rpcError ?? null };
  } };
  const deps: UsersApiDeps = {
    access: { canEdit: true, canManageEditors: false, openTabs: ["users"] },
    client,
    ...overrides,
  };
  return { deps, calls };
}

test("not an editor and an editor without users get 403 without a code or RPC call", async () => {
  for (const access of [
    { canEdit: false, canManageEditors: false, openTabs: ["users"] },
    { canEdit: true, canManageEditors: false, openTabs: [] },
  ]) {
    const fixture = dependencies({ access });
    const result = await handleUsersGet(fixture.deps, new URLSearchParams());
    assert.equal(result.status, 403);
    assert.equal("code" in result.body, false);
    assert.equal(fixture.calls.length, 0);
  }
});

test("owner passes the same users tab gate", async () => {
  const fixture = dependencies({ access: { canEdit: true, canManageEditors: true, openTabs: ["users"] } });
  assert.equal((await handleUsersGet(fixture.deps, new URLSearchParams())).status, 200);
  assert.equal(fixture.calls.length, 1);
});

test("view=list parses rows and sends an empty query with limit 50", async () => {
  const fixture = dependencies();
  const result = await handleUsersGet(fixture.deps, new URLSearchParams("view=list"));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { list: list() });
  assert.deepEqual(fixture.calls, [{ fn: accessRpc.list, args: { p_query: "", p_limit: 50 } }]);
});

test("list query is trimmed and lower-cased", async () => {
  const fixture = dependencies();
  await handleUsersGet(fixture.deps, new URLSearchParams("view=list&q=%20QLoxz%20"));
  assert.deepEqual(fixture.calls[0].args, { p_query: "qloxz", p_limit: 50 });
});

test("invalid list queries fail without an RPC call", async () => {
  for (const query of ["a b", "%", "a".repeat(21)]) {
    const fixture = dependencies();
    const result = await handleUsersGet(fixture.deps, new URLSearchParams({ view: "list", q: query }));
    assert.deepEqual(result, { status: 400, body: { code: "invalid-query" } });
    assert.equal(fixture.calls.length, 0);
  }
});

test("view=count uses limit 0 and returns the unfiltered pending total", async () => {
  const fixture = dependencies();
  const result = await handleUsersGet(fixture.deps, new URLSearchParams("view=count"));
  assert.deepEqual(result, { status: 200, body: { pending: 1 } });
  assert.deepEqual(fixture.calls[0].args, { p_query: "", p_limit: 0 });
});

test("an unknown view returns invalid-view without an RPC call", async () => {
  const fixture = dependencies();
  assert.deepEqual(await handleUsersGet(fixture.deps, new URLSearchParams("view=other")), { status: 400, body: { code: "invalid-view" } });
  assert.equal(fixture.calls.length, 0);
});

test("RPC forbidden maps to a 403 without code and missing SQL maps to pending-database", async () => {
  const forbidden = dependencies({ rpcError: { message: "forbidden" } });
  const denied = await handleUsersGet(forbidden.deps, new URLSearchParams());
  assert.equal(denied.status, 403);
  assert.equal("code" in denied.body, false);
  const missing = dependencies({ rpcError: { message: "missing", code: "PGRST202" } });
  assert.deepEqual(await handleUsersGet(missing.deps, new URLSearchParams()), { status: 503, body: { code: "pending-database" } });
});

test("malformed replies fail closed as unexpected-reply", async () => {
  const badRows = Array.from({ length: 51 }, (_, index) => ({ ...row, id: `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}` }));
  const cases = [
    list({ pending: { total: 1, rows: [{ ...row, id: "bad" }] } }),
    list({ pending: { total: 1, rows: [{ ...row, nickname: "x" }] } }),
    list({ pending: { total: 1, rows: [{ ...row, nicknameKey: "wrong" }] } }),
    list({ pending: { total: 1, rows: [{ ...row, origin: "other" }] } }),
    list({ pendingTotalAll: -1 }),
    list({ pending: { total: 51, rows: badRows } }),
    list({ pending: { total: 0, rows: [row] } }),
    list({ pending: { total: 1, rows: [{ ...row, existingLevel: 6 }] } }),
    list({ pending: { total: 1, rows: [{ ...row, canDecide: "yes" }] } }),
    list({ pending: { total: 1, rows: [{ ...row, reason: "other" }] } }),
    list({ people: { total: 1, rows: [{ ...person, level: 0 }] } }),
    list({ people: { total: 1, rows: [{ ...person, canRevoke: null }] } }),
    list({ people: { total: 1, rows: [{ ...person, lastEvent: { ...event, type: "other" } }] } }),
    list({ closed: { total: 1, rows: [{ ...closed, status: "approved" }] } }),
    list({ closed: { total: 1, rows: [{ ...closed, retryAt: "not-a-date" }] } }),
    list({ closed: { total: 0, rows: [closed] } }),
  ];
  for (const reply of cases) {
    const fixture = dependencies({ reply });
    assert.deepEqual(await handleUsersGet(fixture.deps, new URLSearchParams()), { status: 502, body: { code: "unexpected-reply" } });
  }
});

test("AccessStoreError keeps SQL state", () => {
  const error = new AccessStoreError("missing", "42P01");
  assert.equal(error.sqlState, "42P01");
  assert.deepEqual(mapAccessError(error), { status: 503, body: { code: "pending-database" } });
});
