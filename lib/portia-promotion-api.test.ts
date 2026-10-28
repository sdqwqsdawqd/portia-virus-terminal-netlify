import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PromotionAccessResult, PromotionRosterResult } from "./portia-promotion-sheet.ts";
import {
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
  const calls = { bind: 0, resolve: 0, status: 0, submit: 0, attempts: [] as boolean[] };
  const deps: PromotionApiDependencies = {
    now: () => new Date("2026-10-27T00:00:00.000Z"),
    secret,
    createToken: () => "B".repeat(43),
    loadAccessRoster: async () => accessRoster,
    loadRoster: async () => roster,
    bindDevice: async () => { calls.bind += 1; return { status: "ok" }; },
    resolveDevice: async () => { calls.resolve += 1; return { status: "ok", nicknameKey: "alice" }; },
    workflowStatus: async () => { calls.status += 1; return { status: "ok", projection: emptyProjection }; },
    submitRequest: async () => { calls.submit += 1; return { status: "created", requestId: "request-1" }; },
    registerAttempt: async ({ success }) => { calls.attempts.push(success); return { status: "ok", blockedUntil: success ? null : "2026-10-27T00:05:00.000Z" }; },
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
  assert.equal(missing.calls.bind, 0);
  const promotionOutage = dependencies({ loadRoster: async () => ({ status: "unavailable", reason: "network" }) });
  const outage = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, promotionOutage.deps);
  assert.equal(outage.status, 503);
  assert.equal(outage.body.code, "promotion-sheet-unavailable");
  assert.equal(promotionOutage.calls.bind, 1);
});

test("status restores the bound nickname from the exact HttpOnly device token", async () => {
  const { deps, calls } = dependencies();
  const result = await promotionStatus({ nickname: "", token: "B".repeat(43), headers: new Headers() }, deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.nickname, "Alice");
  assert.equal(result.setCookie, undefined);
  assert.equal(calls.resolve, 1);
});

test("the first valid access lookup binds and returns only a safe projection", async () => {
  const { deps } = dependencies({ workflowStatus: async () => ({ status: "ok", projection: {
    ...emptyProjection,
    results: [{ kind: "ordinary", outcome: "approved", createdAt: "2026-10-20T00:00:00.000Z" }],
  } }) });
  const result = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, deps);
  assert.equal(result.status, 200);
  assert.match(result.setCookie ?? "", /HttpOnly.*Secure.*SameSite=Lax/);
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
  assert.equal(calls.bind, 1);
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
  });
  const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: "A".repeat(43), headers: new Headers() }, deps);
  assert.equal(result.status, 423);
  assert.equal(result.body.code, "device-wait");
  assert.equal(result.body.blockedUntil, "2026-10-27T00:05:00.000Z");
  assert.ok(!JSON.stringify(result.body).toLocaleLowerCase("en-US").includes("alice"));
  assert.deepEqual(calls.attempts, [false]);
  assert.equal(calls.submit, 0);
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

test("an accepted request requires the lookup binding, resets its attempt bucket and never sets a cookie", async () => {
  const { deps, calls } = dependencies();
  const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: "B".repeat(43), headers: new Headers() }, deps);
  assert.equal(result.status, 201);
  assert.equal(result.body.requestId, "request-1");
  assert.equal(result.setCookie, undefined);
  assert.equal(calls.submit, 1);
  assert.deepEqual(calls.attempts, [true]);
});

test("database absence becomes pending-database and never fakes success", async () => {
  const status = dependencies({ workflowStatus: async () => ({ status: "unavailable" }) });
  const statusResult = await promotionStatus({ nickname: "Alice", token: null, headers: new Headers() }, status.deps);
  assert.equal(statusResult.status, 503);
  assert.equal(statusResult.body.code, "pending-database");
  const submit = dependencies({ submitRequest: async () => ({ status: "unavailable" }) });
  const submitResult = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: "B".repeat(43), headers: new Headers() }, submit.deps);
  assert.equal(submitResult.status, 503);
  assert.equal(submitResult.setCookie, undefined);
});

test("public promotion routes are dynamic, no-store and never select wildcard rows", () => {
  for (const path of ["status", "requests"]) {
    const route = readFileSync(new URL(`../app/api/promotion/${path}/route.ts`, import.meta.url), "utf8");
    assert.ok(route.includes('dynamic = "force-dynamic"'), path);
    assert.ok(route.includes("noStoreHeaders"), path);
    assert.ok(!route.includes('select("*")'), path);
    if (path === "status") assert.ok(route.includes("Set-Cookie"), "lookup must persist the binding cookie");
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
