import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PromotionAccessResult, PromotionRosterResult } from "./portia-promotion-sheet.ts";
import {
  createPromotionApiDependencies,
  promotionStatus,
  promotionProjectionFromRpc,
  submitPromotionRequest,
  type PromotionApiDependencies,
  type PromotionWorkflowProjection,
} from "./portia-promotion-api.ts";

const secret = "test-secret-that-is-long-enough-for-device-binding";
const accessRoster: PromotionAccessResult = { status: "ok", roster: [{ nickname: "Alice", nicknameKey: "alice" }] };
const roster: PromotionRosterResult = { status: "ok", roster: [{
  nickname: "Alice",
  nicknameKey: "alice",
  title: "Академик",
  titleId: "academic",
  nextTitle: "Стажёр",
  nextTitleId: "trainee",
  antiSpeedrun: "доступно",
  promotedAt: "2026-10-01T00:00:00.000Z",
}] };
const emptyProjection: PromotionWorkflowProjection = {
  binding: "allowed",
  ordinary: null,
  qualification: null,
  qualificationPassed: false,
  awaitingTitleId: null,
  results: [],
};

function dependencies(overrides: Partial<PromotionApiDependencies> = {}) {
  const calls = { resolve: 0, status: 0, submit: 0, submitInputs: [] as unknown[] };
  const deps: PromotionApiDependencies = {
    now: () => new Date("2026-10-27T00:00:00.000Z"),
    secret,
    createToken: () => "B".repeat(43),
    loadAccessRoster: async () => accessRoster,
    loadRoster: async () => roster,
    resolveDevice: async () => { calls.resolve += 1; return { status: "ok", nicknameKey: "alice" }; },
    workflowStatus: async () => { calls.status += 1; return { status: "ok", projection: emptyProjection }; },
    submitRequest: async (input) => { calls.submit += 1; calls.submitInputs.push(input); return { status: "created", requestId: "request-1" }; },
    ...overrides,
  };
  return { deps, calls };
}

test("promotion status distinguishes access outage, nickname absence, and promotion-roster outage", async () => {
  const unavailable = dependencies({ loadAccessRoster: async () => ({ status: "unavailable", reason: "network" }) });
  assert.equal((await promotionStatus({ nickname: "Alice", token: null }, unavailable.deps)).status, 503);
  const missing = dependencies({ loadAccessRoster: async () => ({ status: "ok", roster: [] }) });
  assert.equal((await promotionStatus({ nickname: "Alice", token: null }, missing.deps)).status, 404);
  assert.equal(missing.calls.status, 0);
  const promotionOutage = dependencies({ loadRoster: async () => ({ status: "unavailable", reason: "network" }) });
  const outage = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, promotionOutage.deps);
  assert.equal(outage.status, 503);
  assert.equal(outage.body.code, "promotion-sheet-unavailable");
});

test("status restores the bound nickname from the exact HttpOnly device token", async () => {
  const { deps, calls } = dependencies();
  const result = await promotionStatus({ nickname: "", token: "B".repeat(43), headers: new Headers() }, deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.nickname, "Alice");
  assert.equal(result.setCookie, undefined);
  assert.equal(calls.resolve, 1);
});

test("the first valid access lookup stays read-only and returns only a safe projection", async () => {
  let statusTokenHash: string | null | undefined;
  const { deps } = dependencies({ workflowStatus: async (input) => {
    statusTokenHash = input.tokenHash;
    return { status: "ok", projection: {
      ...emptyProjection,
      binding: "unbound",
      results: [{ kind: "ordinary", outcome: "approved", createdAt: "2026-10-20T00:00:00.000Z" }],
    } };
  } });
  const result = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, deps);
  assert.equal(result.status, 200);
  assert.equal(result.setCookie, undefined);
  assert.equal(statusTokenHash, null);
  assert.equal(result.body.nickname, "Alice");
  const serialized = JSON.stringify(result.body);
  for (const forbidden of ["answerKey", "reviewerId", "internalNote", "riskBucket", "tokenHash", "ipBucket"]) {
    assert.ok(!serialized.includes(forbidden), forbidden);
  }
});

test("an admitted nickname without a promotion row gets a safe no-record status", async () => {
  const { deps, calls } = dependencies({ loadRoster: async () => ({ status: "ok", roster: [] }) });
  const result = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.nickname, "Alice");
  assert.equal(result.body.promotionRecord, null);
  assert.equal(calls.status, 0);
});

test("public projection admits only ordered immutable assignment text", () => {
  const projection = promotionProjectionFromRpc({
    binding: "allowed",
    ordinary: { status: "assigned", targetTitleId: "trainee", tasks: [
      { id: "task-2", text: "Второе", sortOrder: 2, answerKey: "private" },
      { id: "bad", text: 42, sortOrder: 1 },
      { id: "task-1", text: "Первое", sort_order: 1 },
    ] },
    qualification: null,
    results: [],
  });
  assert.deepEqual(projection?.ordinary?.tasks, [
    { id: "task-2", text: "Второе", sortOrder: 2 },
    { id: "task-1", text: "Первое", sortOrder: 1 },
  ]);
  assert.ok(!JSON.stringify(projection).includes("answerKey"));
});

test("a bound-device conflict is neutral and progressive without revealing the other nickname", async () => {
  const { deps, calls } = dependencies({
    workflowStatus: async () => ({ status: "ok", projection: { ...emptyProjection, binding: "denied" } }),
    submitRequest: async () => { calls.submit += 1; return { status: "device-denied", blockedUntil: "2026-10-27T00:05:00.000Z" }; },
  });
  const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: "A".repeat(43), headers: new Headers() }, deps);
  assert.equal(result.status, 423);
  assert.equal(result.body.code, "device-wait");
  assert.equal(result.body.blockedUntil, "2026-10-27T00:05:00.000Z");
  assert.ok(!JSON.stringify(result.body).toLocaleLowerCase("en-US").includes("alice"));
  assert.equal(calls.submit, 1);
});

test("an ineligible or active request writes nothing", async () => {
  const cooldownRoster: PromotionRosterResult = { status: "ok", roster: [{ ...roster.roster[0], promotedAt: "2026-10-26T00:00:00.000Z" }] };
  const cooldown = dependencies({ loadRoster: async () => cooldownRoster });
  assert.equal((await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: "B".repeat(43), headers: new Headers() }, cooldown.deps)).status, 409);
  assert.equal(cooldown.calls.submit, 0);

  const active = dependencies({ workflowStatus: async () => ({ status: "ok", projection: {
    ...emptyProjection, ordinary: { status: "pending", targetTitleId: "trainee" },
  } }) });
  assert.equal((await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: "B".repeat(43), headers: new Headers() }, active.deps)).status, 409);
  assert.equal(active.calls.submit, 0);
});

test("qualification retake waits until the server date and then permits a new request", async () => {
  const entry = { ...roster.roster[0], title: "Стажёр", titleId: "trainee" as const, nextTitle: "Лаборант", nextTitleId: "laboratory-assistant" as const, promotedAt: "2026-10-01T00:00:00.000Z" };
  const future = dependencies({
    loadRoster: async () => ({ status: "ok", roster: [entry] }),
    workflowStatus: async () => ({ status: "ok", projection: {
      ...emptyProjection, qualification: { status: "failed", targetTitleId: "laboratory-assistant", availableAt: "2026-10-28T00:00:00.000Z" },
    } }),
  });
  const waiting = await submitPromotionRequest({ nickname: "Alice", kind: "qualification", token: "B".repeat(43), headers: new Headers() }, future.deps);
  assert.equal(waiting.body.code, "retake-wait");
  assert.equal(future.calls.submit, 0);

  const ready = dependencies({
    loadRoster: async () => ({ status: "ok", roster: [entry] }),
    workflowStatus: async () => ({ status: "ok", projection: {
      ...emptyProjection, qualification: { status: "failed", targetTitleId: "laboratory-assistant", availableAt: "2026-10-26T00:00:00.000Z" },
    } }),
  });
  assert.equal((await submitPromotionRequest({ nickname: "Alice", kind: "qualification", token: "B".repeat(43), headers: new Headers() }, ready.deps)).status, 201);
  assert.equal(ready.calls.submit, 1);
});

test("an accepted first request creates the token once and sets its cookie only after admission", async () => {
  const { deps, calls } = dependencies();
  const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, deps);
  assert.equal(result.status, 201);
  assert.equal(result.body.requestId, "request-1");
  assert.match(result.setCookie ?? "", /HttpOnly.*Secure.*SameSite=Lax/);
  assert.equal(calls.submit, 1);
  assert.equal(calls.submitInputs.length, 1);
  assert.deepEqual(Object.keys(calls.submitInputs[0] as object).sort(), ["bucketKey", "ipBucket", "kind", "nickname", "nicknameKey", "riskBucket", "targetId", "titleId", "tokenHash"]);
  assert.equal((calls.submitInputs[0] as { tokenHash: string }).tokenHash.length, 64);
});

test("a rejected first submit never persists its generated token", async () => {
  for (const submitRequest of [
    async () => ({ status: "active" } as const),
    async () => ({ status: "device-denied", blockedUntil: "2026-10-27T00:05:00.000Z" } as const),
    async () => ({ status: "unavailable", reason: "database-error" } as const),
  ]) {
    const attempt = dependencies({ submitRequest });
    const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, attempt.deps);
    assert.equal(result.setCookie, undefined);
  }
});

test("database and rollout failures remain distinct safe API outcomes", async () => {
  const status = dependencies({ workflowStatus: async () => ({ status: "unavailable" }) });
  const statusResult = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, status.deps);
  assert.equal(statusResult.status, 503);
  assert.equal(statusResult.body.code, "pending-database");
  for (const [reason, code] of [
    ["rpc-missing", "promotion-rollout-incomplete"],
    ["database-error", "promotion-database-unavailable"],
    ["invalid-response", "promotion-contract-invalid"],
  ] as const) {
    const submit = dependencies({ submitRequest: async () => ({ status: "unavailable", reason }) });
    const submitResult = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, submit.deps);
    assert.equal(submitResult.status, 503);
    assert.equal(submitResult.body.code, code);
    assert.equal(submitResult.setCookie, undefined);
  }
});

test("Supabase submit adapter classifies missing RPC, database failure and malformed projection", async () => {
  const responses = [
    { data: null, error: { code: "PGRST202" } },
    { data: null, error: { code: "08006" } },
    { data: { code: "mystery" }, error: null },
  ];
  const supabase = { rpc: async () => responses.shift()! };
  const deps = createPromotionApiDependencies(supabase as never, secret);
  const input = {
    kind: "ordinary" as const,
    nickname: "Alice",
    nicknameKey: "alice",
    titleId: "academic" as const,
    targetId: "trainee" as const,
    tokenHash: "d".repeat(64),
    riskBucket: "risk",
    bucketKey: "bucket",
    ipBucket: "ip",
  };
  assert.deepEqual(await deps.submitRequest(input), { status: "unavailable", reason: "rpc-missing" });
  assert.deepEqual(await deps.submitRequest(input), { status: "unavailable", reason: "database-error" });
  assert.deepEqual(await deps.submitRequest(input), { status: "unavailable", reason: "invalid-response" });
});

test("invalid sheet identity fails closed as source-unavailable, never not-found", async () => {
  const invalid = dependencies({ loadRoster: async () => ({ status: "invalid-source", reason: "invalid-data" }) });
  const result = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, invalid.deps);
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "promotion-source-invalid");
});

test("public promotion routes are dynamic, no-store and never select wildcard rows", () => {
  for (const path of ["status", "requests"]) {
    const route = readFileSync(new URL(`../app/api/promotion/${path}/route.ts`, import.meta.url), "utf8");
    assert.ok(route.includes('dynamic = "force-dynamic"'), path);
    assert.ok(route.includes("noStoreHeaders"), path);
    assert.ok(!route.includes('select("*")'), path);
    if (path === "requests") assert.ok(route.includes("Set-Cookie"), "accepted submit must persist the binding cookie");
  }
});

test("request admission has no preliminary binding or throttle mutation", () => {
  const source = readFileSync(new URL("./portia-promotion-api.ts", import.meta.url), "utf8");
  const submitStart = source.indexOf("export async function submitPromotionRequest");
  const submitEnd = source.indexOf("type RpcError", submitStart);
  const submit = source.slice(submitStart, submitEnd);
  assert.doesNotMatch(submit, /bindDevice|registerAttempt/);
  const adapterStart = source.indexOf("submitRequest: async");
  const adapterEnd = source.indexOf("\n    },", adapterStart) + 7;
  const adapter = source.slice(adapterStart, adapterEnd);
  for (const field of ["p_bucket_key", "p_ip_bucket", "p_risk_bucket"]) assert.ok(adapter.includes(field), field);
  assert.match(adapter, /data\.code === "throttled"/);
  assert.match(adapter, /data\.code === "device-denied"/);
});

test("the seven participant refusals carry pairwise distinct codes and texts, and only not-listed says the nickname is absent", async () => {
  const ask = (overrides: Partial<PromotionApiDependencies>, nickname = "Alice") =>
    submitPromotionRequest({ nickname, kind: "ordinary", token: null, headers: new Headers() }, dependencies(overrides).deps);
  const results = await Promise.all([
    ask({ loadAccessRoster: async () => ({ status: "ok", roster: [] }) }),
    ask({ loadAccessRoster: async () => ({ status: "unavailable", reason: "network" }) }),
    ask({ workflowStatus: async () => ({ status: "unavailable" }) }),
    ask({ submitRequest: async () => ({ status: "unavailable", reason: "rpc-missing" }) }),
    ask({ submitRequest: async () => ({ status: "unavailable", reason: "database-error" }) }),
    ask({ submitRequest: async () => ({ status: "unavailable", reason: "invalid-response" }) }),
    ask({}, "   "),
  ]);
  assert.deepEqual(results.map((result) => result.body.code), [
    "not-listed", "sheet-unavailable", "pending-database", "promotion-rollout-incomplete",
    "promotion-database-unavailable", "promotion-contract-invalid", "invalid-request",
  ]);
  assert.equal(new Set(results.map((result) => result.body.error)).size, 7);
  for (const result of results.slice(1)) assert.ok(!/не найден/i.test(String(result.body.error)), String(result.body.code));
});

test("validation precedes every lookup: blank and 65-character nicknames never reach a roster or the write path", async () => {
  for (const nickname of ["", "   ", "a".repeat(65)]) {
    const { deps, calls } = dependencies({
      loadAccessRoster: async () => { throw new Error("access roster must not be read"); },
      loadRoster: async () => { throw new Error("promotion roster must not be read"); },
    });
    const result = await submitPromotionRequest({ nickname, kind: "ordinary", token: null, headers: new Headers() }, deps);
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "invalid-request");
    assert.equal(calls.submit, 0);
    assert.equal(calls.status, 0);
  }
  // 64 characters is valid input; it is then absent from the access roster, so the refusal is not-listed, not invalid-request.
  assert.equal((await submitPromotionRequest({ nickname: "a".repeat(64), kind: "ordinary", token: null, headers: new Headers() }, dependencies().deps)).body.code, "not-listed");
});

test("check order is access roster, then promotion roster, then database: a sheet outage is never masked by a later stage", async () => {
  const order: string[] = [];
  const { deps, calls } = dependencies({
    loadAccessRoster: async () => { order.push("access"); return { status: "unavailable", reason: "network" }; },
    loadRoster: async () => { order.push("roster"); return roster; },
    workflowStatus: async () => { order.push("database"); return { status: "unavailable" }; },
  });
  const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, deps);
  assert.deepEqual(order, ["access"]);
  assert.equal(result.body.code, "sheet-unavailable");
  assert.equal(calls.submit, 0);
  const second: string[] = [];
  const later = dependencies({
    loadRoster: async () => { second.push("roster"); return { status: "unavailable", reason: "network" }; },
    workflowStatus: async () => { second.push("database"); return { status: "unavailable" }; },
  });
  const outage = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, later.deps);
  assert.deepEqual(second, ["roster"]);
  assert.equal(outage.body.code, "promotion-sheet-unavailable");
});
