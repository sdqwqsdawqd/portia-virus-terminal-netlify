import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PromotionRosterResult } from "./portia-promotion-sheet.ts";
import {
  promotionStatus,
  submitPromotionRequest,
  type PromotionApiDependencies,
  type PromotionWorkflowProjection,
} from "./portia-promotion-api.ts";

const secret = "test-secret-that-is-long-enough-for-device-binding";
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
  binding: "unbound",
  ordinary: null,
  qualification: null,
  qualificationPassed: false,
  awaitingTitleId: null,
  results: [],
};

function dependencies(overrides: Partial<PromotionApiDependencies> = {}) {
  const calls = { status: 0, submit: 0, attempts: [] as boolean[] };
  const deps: PromotionApiDependencies = {
    now: () => new Date("2026-10-27T00:00:00.000Z"),
    secret,
    createToken: () => "B".repeat(43),
    loadRoster: async () => roster,
    workflowStatus: async () => { calls.status += 1; return { status: "ok", projection: emptyProjection }; },
    submitRequest: async () => { calls.submit += 1; return { status: "created", requestId: "request-1" }; },
    registerAttempt: async ({ success }) => { calls.attempts.push(success); return { status: "ok", blockedUntil: success ? null : "2026-10-27T00:05:00.000Z" }; },
    ...overrides,
  };
  return { deps, calls };
}

test("promotion status distinguishes sheet unavailable from nickname not listed", async () => {
  const unavailable = dependencies({ loadRoster: async () => ({ status: "unavailable", reason: "network" }) });
  assert.equal((await promotionStatus({ nickname: "Alice", token: null }, unavailable.deps)).status, 503);
  const missing = dependencies({ loadRoster: async () => ({ status: "ok", roster: [] }) });
  assert.equal((await promotionStatus({ nickname: "Alice", token: null }, missing.deps)).status, 404);
  assert.equal(missing.calls.status, 0);
});

test("a nickname lookup never creates a binding cookie and returns only a safe projection", async () => {
  const { deps } = dependencies({ workflowStatus: async () => ({ status: "ok", projection: {
    ...emptyProjection,
    results: [{ kind: "ordinary", outcome: "approved", createdAt: "2026-10-20T00:00:00.000Z" }],
  } }) });
  const result = await promotionStatus({ nickname: "Alice", token: null }, deps);
  assert.equal(result.status, 200);
  assert.equal(result.setCookie, undefined);
  assert.equal(result.body.nickname, "Alice");
  const serialized = JSON.stringify(result.body);
  for (const forbidden of ["answerKey", "reviewerId", "internalNote", "riskBucket", "tokenHash", "ipBucket"]) {
    assert.ok(!serialized.includes(forbidden), forbidden);
  }
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
  assert.equal((await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, cooldown.deps)).status, 409);
  assert.equal(cooldown.calls.submit, 0);

  const active = dependencies({ workflowStatus: async () => ({ status: "ok", projection: {
    ...emptyProjection, ordinary: { status: "pending", targetTitleId: "trainee" },
  } }) });
  assert.equal((await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, active.deps)).status, 409);
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
  const waiting = await submitPromotionRequest({ nickname: "Alice", kind: "qualification", token: null, headers: new Headers() }, future.deps);
  assert.equal(waiting.body.code, "retake-wait");
  assert.equal(future.calls.submit, 0);

  const ready = dependencies({
    loadRoster: async () => ({ status: "ok", roster: [entry] }),
    workflowStatus: async () => ({ status: "ok", projection: {
      ...emptyProjection, qualification: { status: "failed", targetTitleId: "laboratory-assistant", availableAt: "2026-10-26T00:00:00.000Z" },
    } }),
  });
  assert.equal((await submitPromotionRequest({ nickname: "Alice", kind: "qualification", token: null, headers: new Headers() }, ready.deps)).status, 201);
  assert.equal(ready.calls.submit, 1);
});

test("the first accepted request binds atomically, resets its attempt bucket and sets the cookie", async () => {
  const { deps, calls } = dependencies();
  const result = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, deps);
  assert.equal(result.status, 201);
  assert.equal(result.body.requestId, "request-1");
  assert.match(result.setCookie ?? "", /HttpOnly.*Secure.*SameSite=Lax/);
  assert.equal(calls.submit, 1);
  assert.deepEqual(calls.attempts, [true]);
});

test("database absence becomes pending-database and never fakes success", async () => {
  const status = dependencies({ workflowStatus: async () => ({ status: "unavailable" }) });
  const statusResult = await promotionStatus({ nickname: "Alice", token: null }, status.deps);
  assert.equal(statusResult.status, 503);
  assert.equal(statusResult.body.code, "pending-database");
  const submit = dependencies({ submitRequest: async () => ({ status: "unavailable" }) });
  const submitResult = await submitPromotionRequest({ nickname: "Alice", kind: "ordinary", token: null, headers: new Headers() }, submit.deps);
  assert.equal(submitResult.status, 503);
  assert.equal(submitResult.setCookie, undefined);
});

test("public promotion routes are dynamic, no-store and never select wildcard rows", () => {
  for (const path of ["status", "requests"]) {
    const route = readFileSync(new URL(`../app/api/promotion/${path}/route.ts`, import.meta.url), "utf8");
    assert.ok(route.includes('dynamic = "force-dynamic"'), path);
    assert.ok(route.includes("noStoreHeaders"), path);
    assert.ok(!route.includes('select("*")'), path);
    if (path === "status") assert.ok(!route.includes("Set-Cookie"), "lookup must not bind");
  }
});
