import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AccessStoreError, accessRpc, type AccessRpcClient } from "./access-store.ts";
import * as accessStoreModule from "./access-store.ts";
import * as usersApiModule from "./users-api.ts";
import { handleUsersGet, mapAccessError, type UsersApiDeps, type UsersApiResult } from "./users-api.ts";
import * as usersModelModule from "./users-model.ts";
import { loadUsersRoster, resetUsersRosterCache, tableMarkFor } from "./users-roster.ts";

type UsersPostModule = {
  handleUsersPost?: (deps: UsersApiDeps, body: Record<string, unknown>) => Promise<UsersApiResult>;
  parseUsersPostRequest?: (request: Request) => Promise<{ result?: UsersApiResult; body?: Record<string, unknown> }>;
};

const postModule = usersApiModule as typeof usersApiModule & UsersPostModule;
type HistoryEntry = { type: string; at: string; actor: string | null; details: Record<string, unknown> };
const historyStore = accessStoreModule as typeof accessStoreModule & {
  accessHistory?: (client: AccessRpcClient, input: { nicknameKey: string }) => Promise<HistoryEntry[]>;
};
const historyModel = usersModelModule as typeof usersModelModule & {
  parseUsersHistory?: (value: unknown) => HistoryEntry[];
};

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
const historyEntry = { ...event, details: { level: 2, origin: "sheet", deviceAdded: true } };
const person = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  nickname: "Ada_1",
  nicknameKey: "ada_1",
  origin: "outside",
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
const markedList = (overrides: Record<string, unknown> = {}) => ({
  ...list(),
  roster: "ok",
  pending: { total: 1, rows: [{ ...row, tableMark: "no" }] },
  people: { total: 1, rows: [{ ...person, tableMark: "no" }] },
  closed: { total: 1, rows: [{ ...closed, tableMark: "no" }] },
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
    loadRoster: async () => ({ status: "ok", roster: [] }),
    now: () => new Date("2026-11-11T00:00:00.000Z"),
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
  assert.deepEqual(result.body, { list: markedList() });
  assert.deepEqual(fixture.calls, [{ fn: accessRpc.list, args: { p_query: "", p_limit: 50 } }]);
});

test("list query is trimmed and lower-cased", async () => {
  const fixture = dependencies();
  await handleUsersGet(fixture.deps, new URLSearchParams("view=list&q=%20QLoxz%20"));
  assert.deepEqual(fixture.calls[0].args, { p_query: "qloxz", p_limit: 50 });
});

test("invalid list queries fail without an RPC call", async () => {
  for (const query of ["a b", "%", "a".repeat(21), "K"] ) {
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

test("view=history returns five validated entries and sends the SQL signature argument", async () => {
  const fixture = dependencies({ reply: { entries: [historyEntry] } });
  const result = await handleUsersGet(fixture.deps, new URLSearchParams("view=history&key=qloxz"));
  assert.deepEqual(result, { status: 200, body: { entries: [historyEntry] } });
  assert.deepEqual(fixture.calls, [{ fn: "portia_access_history", args: { p_nickname_key: "qloxz" } }]);
  assert.equal(typeof historyStore.accessHistory, "function");
  assert.equal((accessRpc as Record<string, string>).history, "portia_access_history");

  const sql = readFileSync(new URL("../supabase/migrations/20261110000000_portia_users_tab.sql", import.meta.url), "utf8");
  const signature = /create or replace function public\.portia_access_history\(([^)]*)\)/u.exec(sql)?.[1] ?? "";
  assert.match(signature, /\bp_nickname_key\b/u);
});

test("history parser rejects overflow, unknown keys and event-incompatible details", () => {
  assert.equal(typeof historyModel.parseUsersHistory, "function");
  const parse = historyModel.parseUsersHistory as NonNullable<typeof historyModel.parseUsersHistory>;
  assert.deepEqual(parse({ entries: [historyEntry] }), [historyEntry]);
  const invalidReplies = [
    { entries: Array.from({ length: 6 }, () => historyEntry) },
    { entries: [{ ...historyEntry, details: { ...historyEntry.details, raw: "secret" } }] },
    { entries: [{ ...historyEntry, type: "other" }] },
    { entries: [{ ...historyEntry, at: "not-a-date" }] },
    { entries: [{ ...historyEntry, actor: 7 }] },
    { entries: [{ ...historyEntry, details: { level: "2", origin: "sheet", deviceAdded: true } }] },
    { entries: [{ ...historyEntry, type: "level-change", details: { from: 2 } }] },
  ];
  for (const reply of invalidReplies) assert.throws(() => parse(reply), { name: "UsersReplyError" });
});

test("invalid history keys fail before the RPC and a closed users tab stays denied", async () => {
  for (const key of ["QLoxz", "a b", "a".repeat(21), ""]) {
    const fixture = dependencies();
    assert.deepEqual(await handleUsersGet(fixture.deps, new URLSearchParams({ view: "history", key })), {
      status: 400,
      body: { code: "invalid-key" },
    });
    assert.equal(fixture.calls.length, 0);
  }
  const closedTab = dependencies({ access: { canEdit: true, canManageEditors: false, openTabs: [] } });
  const deniedHistory = await handleUsersGet(closedTab.deps, new URLSearchParams("view=history&key=qloxz"));
  assert.equal(deniedHistory.status, 403);
  assert.equal("code" in deniedHistory.body, false);
  assert.equal(closedTab.calls.length, 0);
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

test("USR-07 already-decided is a 200 result code and is never retried", async () => {
  assert.equal(typeof postModule.handleUsersPost, "function", "handleUsersPost must exist");
  const fixture = dependencies({ reply: { code: "already-decided", status: "approved" } });
  const result = await postModule.handleUsersPost?.(fixture.deps, {
    action: "approve",
    requestId: row.id,
    level: 2,
  });
  assert.deepEqual(result, { status: 200, body: { code: "already-decided", status: "approved" } });
  assert.deepEqual(fixture.calls, [{ fn: accessRpc.decide, args: { p_request_id: row.id, p_decision: "approve", p_level: 2 } }]);
});

test("approve validates the optional level and sends null for an existing person", async () => {
  assert.equal(typeof postModule.handleUsersPost, "function", "handleUsersPost must exist");
  const withoutLevel = dependencies({ reply: { code: "approved", personId: person.id, level: 4 } });
  assert.deepEqual(await postModule.handleUsersPost?.(withoutLevel.deps, { action: "approve", requestId: row.id }), {
    status: 200,
    body: { code: "approved", personId: person.id, level: 4 },
  });
  assert.deepEqual(withoutLevel.calls[0], { fn: accessRpc.decide, args: { p_request_id: row.id, p_decision: "approve", p_level: null } });

  for (const level of [0, 6, "2"]) {
    const invalid = dependencies();
    assert.deepEqual(await postModule.handleUsersPost?.(invalid.deps, { action: "approve", requestId: row.id, level }), {
      status: 400,
      body: { code: "invalid-level" },
    });
    assert.equal(invalid.calls.length, 0);
  }
});

test("decision POST rejects malformed bodies and maps database guards", async () => {
  assert.equal(typeof postModule.handleUsersPost, "function", "handleUsersPost must exist");
  for (const body of [
    { action: "approve", requestId: "not-a-uuid", level: 2 },
    { action: "approve", requestId: row.id, level: 2, nicknameKey: row.nicknameKey },
    { action: "other", requestId: row.id },
  ]) {
    const invalid = dependencies();
    const result = await postModule.handleUsersPost?.(invalid.deps, body);
    assert.equal(result?.status, 400);
    assert.equal(invalid.calls.length, 0);
  }

  const self = dependencies({ rpcError: { message: "self-decision" } });
  assert.deepEqual(await postModule.handleUsersPost?.(self.deps, { action: "reject", requestId: row.id }), { status: 409, body: { code: "self" } });
  const owner = dependencies({ rpcError: { message: "owner-protected" } });
  assert.deepEqual(await postModule.handleUsersPost?.(owner.deps, { action: "reject", requestId: row.id }), { status: 409, body: { code: "owner" } });
  const separate = dependencies({ rpcError: { message: "level-change-separate" } });
  assert.deepEqual(await postModule.handleUsersPost?.(separate.deps, { action: "approve", requestId: row.id, level: 2 }), { status: 409, body: { code: "level-change-separate" } });
});

test("decision POST checks the users-tab gate before any RPC", async () => {
  assert.equal(typeof postModule.handleUsersPost, "function", "handleUsersPost must exist");
  const fixture = dependencies({ access: { canEdit: true, canManageEditors: false, openTabs: [] } });
  const result = await postModule.handleUsersPost?.(fixture.deps, { action: "reject", requestId: row.id });
  assert.equal(result?.status, 403);
  assert.equal(result && "code" in result.body, false);
  assert.equal(fixture.calls.length, 0);
});

test("POST request parsing requires JSON and a plain object", async () => {
  assert.equal(typeof postModule.parseUsersPostRequest, "function", "parseUsersPostRequest must exist");
  const plain = await postModule.parseUsersPostRequest?.(new Request("http://local/api/users", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }));
  assert.deepEqual(plain, { result: { status: 415, body: { code: "json-required" } } });
  const smuggled = await postModule.parseUsersPostRequest?.(new Request("http://local/api/users", { method: "POST", headers: { "content-type": "text/plain;x=application/json" }, body: "{}" }));
  assert.deepEqual(smuggled, { result: { status: 415, body: { code: "json-required" } } });
  const broken = await postModule.parseUsersPostRequest?.(new Request("http://local/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }));
  assert.deepEqual(broken, { result: { status: 400, body: { code: "invalid-body" } } });
  const valid = await postModule.parseUsersPostRequest?.(new Request("http://local/api/users", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ action: "reject", requestId: row.id }) }));
  assert.deepEqual(valid, { body: { action: "reject", requestId: row.id } });
  const oversized = await postModule.parseUsersPostRequest?.(new Request("http://local/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ padding: "x".repeat(16_384) }) }));
  assert.deepEqual(oversized, { result: { status: 413, body: { code: "body-too-large" } } });
});

test("POST route checks auth and access before reading the request body", () => {
  const route = readFileSync(new URL("../app/api/users/route.ts", import.meta.url), "utf8");
  const post = route.split("export async function POST(request: Request)")[1];
  assert.ok(post.indexOf("getEditorAccess") < post.indexOf("parseUsersPostRequest(request)"));
});

test("set-level sends the expected level and preserves database result codes", async () => {
  assert.equal(typeof postModule.handleUsersPost, "function");
  for (const reply of [
    { code: "updated", level: 4 },
    { code: "unchanged", level: 3 },
    { code: "stale", level: 2 },
    { code: "not-found" },
    { code: "not-active" },
  ]) {
    const fixture = dependencies({ reply });
    assert.deepEqual(await postModule.handleUsersPost?.(fixture.deps, {
      action: "set-level",
      personId: person.id,
      level: 4,
      expectedLevel: 3,
    }), { status: 200, body: reply });
    assert.deepEqual(fixture.calls[0], { fn: accessRpc.setLevel, args: { p_person_id: person.id, p_level: 4, p_expected_level: 3 } });
  }
  const invalid = dependencies();
  assert.deepEqual(await postModule.handleUsersPost?.(invalid.deps, { action: "set-level", personId: person.id, level: 4 }), {
    status: 400,
    body: { code: "invalid-level" },
  });
  assert.equal(invalid.calls.length, 0);
});

test("revoke and owner clear-cooldown dispatch only their Phase 21 RPCs", async () => {
  assert.equal(typeof postModule.handleUsersPost, "function");
  for (const reply of [{ code: "revoked" }, { code: "already-revoked" }, { code: "not-found" }]) {
    const fixture = dependencies({ reply });
    assert.deepEqual(await postModule.handleUsersPost?.(fixture.deps, { action: "revoke", personId: person.id }), { status: 200, body: reply });
    assert.deepEqual(fixture.calls[0], { fn: accessRpc.revoke, args: { p_person_id: person.id } });
  }
  const editor = dependencies();
  assert.deepEqual(await postModule.handleUsersPost?.(editor.deps, { action: "clear-cooldown", nicknameKey: closed.nicknameKey }), {
    status: 403,
    body: { code: "owner-only" },
  });
  assert.equal(editor.calls.length, 0);
  for (const reply of [{ code: "cleared" }, { code: "no-cooldown" }, { code: "invalid" }]) {
    const owner = dependencies({ access: { canEdit: true, canManageEditors: true, openTabs: ["users"] }, reply });
    assert.deepEqual(await postModule.handleUsersPost?.(owner.deps, { action: "clear-cooldown", nicknameKey: closed.nicknameKey }), { status: 200, body: reply });
    assert.deepEqual(owner.calls[0], { fn: accessRpc.clearCooldown, args: { p_nickname_key: closed.nicknameKey } });
  }
});

test("D-10 list marks stay unknown when the roster is degraded and failures are not cached", async () => {
  let rosterCalls = 0;
  const fixture = dependencies({
    loadRoster: async () => {
      rosterCalls += 1;
      return { status: "unavailable" as const, reason: "network" as const };
    },
  } as Partial<UsersApiDeps>);
  const result = await handleUsersGet(fixture.deps, new URLSearchParams("view=list"));
  assert.equal((result.body.list as Record<string, unknown>).roster, "degraded");
  assert.deepEqual(result, {
    status: 200,
    body: {
      list: {
        ...list(),
        roster: "degraded",
        pending: { total: 1, rows: [{ ...row, tableMark: "unknown" }] },
        people: { total: 1, rows: [{ ...person, tableMark: "unknown" }] },
        closed: { total: 1, rows: [{ ...closed, tableMark: "unknown" }] },
      },
    },
  });
  assert.equal(rosterCalls, 1);
});

test("D-11 bulk approval is owner-only and re-checks a fresh roster before deciding", async () => {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  let rosterCalls = 0;
  const deps = {
    access: { canEdit: true, canManageEditors: true, openTabs: ["users"] },
    client: { rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === accessRpc.bulkCandidates) return { data: { candidates: [{ id: row.id, nickname: row.nickname, nicknameKey: row.nicknameKey }] }, error: null };
      return { data: { code: "approved", personId: person.id, level: 2 }, error: null };
    } },
    loadRoster: async () => {
      rosterCalls += 1;
      return { status: "ok" as const, roster: [{ nickname: row.nickname, nicknameKey: row.nicknameKey }] };
    },
    now: () => new Date("2026-11-11T00:00:00.000Z"),
  } as UsersApiDeps;
  assert.deepEqual(await postModule.handleUsersPost?.(deps, {
    action: "approve",
    requestId: row.id,
    level: 2,
    bulk: true,
  }), { status: 200, body: { code: "approved", personId: person.id, level: 2, tableMark: "yes" } });
  assert.equal(rosterCalls, 1);
  assert.deepEqual(calls.map((call) => call.fn), [accessRpc.bulkCandidates, accessRpc.decide]);
});

test("roster cache keeps only healthy strict nickname keys and ttl 0 always reloads", async () => {
  resetUsersRosterCache();
  let calls = 0;
  let at = 0;
  const load = async () => {
    calls += 1;
    return {
      status: "ok" as const,
      roster: [
        { nickname: "QLoxz", nicknameKey: "legacy-key" },
        { nickname: "bad nickname", nicknameKey: "bad nickname" },
      ],
    };
  };
  const first = await loadUsersRoster({ load, now: () => new Date(at), ttlMs: 20_000 });
  assert.equal(first.status, "ok");
  assert.deepEqual(first.status === "ok" ? [...first.keys] : [], ["qloxz"]);
  assert.equal(tableMarkFor("qloxz", first), "yes");
  assert.equal(tableMarkFor("ada_1", first), "no");

  at = 19_999;
  await loadUsersRoster({ load, now: () => new Date(at), ttlMs: 20_000 });
  assert.equal(calls, 1);
  at = 20_000;
  await loadUsersRoster({ load, now: () => new Date(at), ttlMs: 20_000 });
  assert.equal(calls, 2);
  await loadUsersRoster({ load, now: () => new Date(at), ttlMs: 0 });
  assert.equal(calls, 3);
});

test("D-10 roster failures and throws are degraded, unknown and never cached", async () => {
  resetUsersRosterCache();
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls === 1) return { status: "unavailable" as const, reason: "network" as const };
    if (calls === 2) throw new Error("sheet down");
    return { status: "ok" as const, roster: [{ nickname: "QLoxz", nicknameKey: "qloxz" }] };
  };
  const first = await loadUsersRoster({ load });
  const second = await loadUsersRoster({ load });
  const third = await loadUsersRoster({ load });
  assert.deepEqual(first, { status: "degraded" });
  assert.deepEqual(second, { status: "degraded" });
  assert.equal(tableMarkFor("qloxz", first), "unknown");
  assert.equal(third.status, "ok");
  assert.equal(calls, 3);
});

test("route reply parsers require marks, roster state and bounded bulk arrays", () => {
  const parseListReply = (usersModelModule as typeof usersModelModule & {
    parseUsersListReply: (value: unknown) => unknown;
    parseUsersBulk: (value: unknown) => unknown;
  }).parseUsersListReply;
  const parseBulk = (usersModelModule as typeof usersModelModule & {
    parseUsersBulk: (value: unknown) => unknown;
  }).parseUsersBulk;
  assert.deepEqual(parseListReply(markedList()), markedList());
  assert.throws(() => parseListReply(list()), { name: "UsersReplyError" });
  assert.throws(() => parseListReply(markedList({ pending: { total: 1, rows: [{ ...row, tableMark: "maybe" }] } })), { name: "UsersReplyError" });
  const bulk = { roster: "ok", eligible: [{ id: row.id, nickname: row.nickname }], excluded: [] };
  assert.deepEqual(parseBulk(bulk), bulk);
  assert.throws(() => parseBulk({ ...bulk, eligible: Array.from({ length: 201 }, () => bulk.eligible[0]) }), { name: "UsersReplyError" });
});

test("view=bulk is owner-only, uses all SQL candidates and separates eligible names", async () => {
  const editor = dependencies({ reply: { candidates: [] } });
  assert.deepEqual(await handleUsersGet(editor.deps, new URLSearchParams("view=bulk")), {
    status: 403,
    body: { code: "owner-only" },
  });
  assert.equal(editor.calls.length, 0);

  const other = { id: "323e4567-e89b-42d3-a456-426614174000", nickname: "Bob_2", nicknameKey: "bob_2" };
  const owner = dependencies({
    access: { canEdit: true, canManageEditors: true, openTabs: ["users"] },
    reply: { candidates: [{ id: row.id, nickname: row.nickname, nicknameKey: row.nicknameKey }, other] },
    loadRoster: async () => ({ status: "ok", roster: [{ nickname: row.nickname, nicknameKey: row.nicknameKey }] }),
  });
  assert.deepEqual(await handleUsersGet(owner.deps, new URLSearchParams("view=bulk")), {
    status: 200,
    body: {
      roster: "ok",
      eligible: [{ id: row.id, nickname: row.nickname }],
      excluded: [{ id: other.id, nickname: other.nickname }],
    },
  });
  assert.deepEqual(owner.calls, [{ fn: accessRpc.bulkCandidates, args: {} }]);
});

test("single approval never accepts or queries a client-selected roster nickname", async () => {
  let rosterCalls = 0;
  const fixture = dependencies({
    reply: { code: "approved", personId: person.id, level: 2 },
    loadRoster: async () => {
      rosterCalls += 1;
      return { status: "invalid-source", reason: "invalid-data" };
    },
  });
  assert.deepEqual(await postModule.handleUsersPost?.(fixture.deps, {
    action: "approve",
    requestId: row.id,
    level: 2,
  }), { status: 200, body: { code: "approved", personId: person.id, level: 2 } });
  assert.equal(rosterCalls, 0);
  assert.deepEqual(fixture.calls.map((call) => call.fn), [accessRpc.decide]);
});

test("D-11 bulk refuses degraded, non-roster and no-longer-pending requests without deciding", async () => {
  const ownerAccess = { canEdit: true, canManageEditors: true, openTabs: ["users"] };
  const body = { action: "approve", requestId: row.id, level: 2, bulk: true };

  const degraded = dependencies({
    access: ownerAccess,
    loadRoster: async () => ({ status: "unavailable", reason: "network" }),
  });
  assert.deepEqual(await postModule.handleUsersPost?.(degraded.deps, body), {
    status: 503,
    body: { code: "roster-unavailable" },
  });
  assert.equal(degraded.calls.length, 0);

  const decided = dependencies({
    access: ownerAccess,
    reply: { candidates: [] },
    loadRoster: async () => ({ status: "ok", roster: [{ nickname: row.nickname, nicknameKey: row.nicknameKey }] }),
  });
  assert.deepEqual(await postModule.handleUsersPost?.(decided.deps, body), {
    status: 200,
    body: { code: "already-decided" },
  });
  assert.deepEqual(decided.calls.map((call) => call.fn), [accessRpc.bulkCandidates]);

  const excluded = dependencies({
    access: ownerAccess,
    reply: { candidates: [{ id: row.id, nickname: row.nickname, nicknameKey: row.nicknameKey }] },
    loadRoster: async () => ({ status: "ok", roster: [] }),
  });
  assert.deepEqual(await postModule.handleUsersPost?.(excluded.deps, body), {
    status: 409,
    body: { code: "not-in-table" },
  });
  assert.deepEqual(excluded.calls.map((call) => call.fn), [accessRpc.bulkCandidates]);
});
