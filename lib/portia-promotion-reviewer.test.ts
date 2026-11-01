import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parsePromotionBankCommand,
  parsePromotionReviewerCommand,
  promotionReviewerDecision,
  promotionReviewerSourcePolicy,
  promotionCleanupPreview,
  qualificationBankLimitError,
  replacePreviewItem,
  selectQualificationPreview,
  selectTaskPreview,
  taskBankLimitError,
  validateQuestionDraft,
} from "./portia-promotion-reviewer.ts";
import { createPreviewToken, verifyPreviewToken } from "./portia-promotion-preview-token.ts";

test("promotion reviewer boundary fails closed and requires the trusted promo tab", () => {
  assert.equal(promotionReviewerDecision(false, null), "forbidden");
  assert.equal(promotionReviewerDecision(true, { canEdit: false, canManageEditors: false, openTabs: [], tabsEnforced: true, unavailable: true }), "unavailable");
  assert.equal(promotionReviewerDecision(true, { canEdit: true, canManageEditors: false, openTabs: ["employees"], tabsEnforced: true }), "forbidden");
  assert.equal(promotionReviewerDecision(true, { canEdit: true, canManageEditors: false, openTabs: ["promo"], tabsEnforced: true }), "allowed");
});

test("sheet outage preserves claims while still allowing request recovery and removal", () => {
  for (const action of ["release", "force-release", "reject", "delete-request"] as const) {
    assert.equal(promotionReviewerSourcePolicy(action, "unavailable"), "allow", action);
    assert.equal(promotionReviewerSourcePolicy(action, "invalid-source"), "allow", action);
  }
  for (const action of ["claim", "approve-task", "finalize-attempt"] as const) {
    assert.equal(promotionReviewerSourcePolicy(action, "unavailable"), "block", action);
    assert.equal(promotionReviewerSourcePolicy(action, "invalid-source"), "block", action);
  }
  assert.equal(promotionReviewerSourcePolicy("finalize-attempt", "ok"), "allow");
});

test("cleanup preview is bounded and uses server-derived three-day dates", () => {
  const state = { ordinary: [{ requestId: "one", status: "rejected", updatedAt: "2026-10-20T00:00:00Z", nickname: "Alice" }], qualification: [
    { requestId: "two", status: "failed", updatedAt: "2026-10-27T00:00:00Z", nickname: "Bob" },
    { requestId: "active", status: "claimed", updatedAt: "2026-10-01T00:00:00Z", nickname: "Carol" },
  ] };
  assert.deepEqual(promotionCleanupPreview(state, new Date("2026-10-28T00:00:00Z")), [
    { requestId: "one", kind: "ordinary", status: "rejected", nickname: "Alice", deleteAt: "2026-10-23T00:00:00.000Z", due: true },
    { requestId: "two", kind: "qualification", status: "failed", nickname: "Bob", deleteAt: "2026-10-30T00:00:00.000Z", due: false },
  ]);
});

test("promotion reviewer commands accept only typed bounded payloads", () => {
  assert.deepEqual(parsePromotionReviewerCommand({ action: "claim", kind: "ordinary", requestId: "550e8400-e29b-41d4-a716-446655440000" }), {
    action: "claim", kind: "ordinary", requestId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assert.equal(parsePromotionReviewerCommand({ action: "claim", kind: "ordinary", requestId: "x" }), null);
  assert.equal(parsePromotionReviewerCommand({ action: "release", kind: "other", requestId: "550e8400-e29b-41d4-a716-446655440000" }), null);
  assert.equal(parsePromotionReviewerCommand({ action: "reject", kind: "ordinary", requestId: "550e8400-e29b-41d4-a716-446655440000", note: "x".repeat(2001) }), null);
  assert.deepEqual(parsePromotionReviewerCommand({ action: "delete-request", kind: "qualification", requestId: "550e8400-e29b-41d4-a716-446655440000" }), { action: "delete-request", kind: "qualification", requestId: "550e8400-e29b-41d4-a716-446655440000" });
  assert.deepEqual(parsePromotionReviewerCommand({ action: "grade-answer", answerId: "550e8400-e29b-41d4-a716-446655440000", correct: true }), { action: "grade-answer", answerId: "550e8400-e29b-41d4-a716-446655440000", correct: true });
  assert.deepEqual(parsePromotionReviewerCommand({ action: "finalize-attempt", attemptId: "550e8400-e29b-41d4-a716-446655440000", passed: false, percent: 70 }), { action: "finalize-attempt", attemptId: "550e8400-e29b-41d4-a716-446655440000", passed: false, percent: 70, retakeDays: 2 });
  assert.equal(parsePromotionReviewerCommand({ action: "finalize-attempt", attemptId: "550e8400-e29b-41d4-a716-446655440000", passed: false, percent: 101 }), null);
  assert.deepEqual(parsePromotionReviewerCommand({ action: "reset-device", nicknameKey: " Alice_1 " }), { action: "reset-device", nicknameKey: "alice_1" });
  assert.equal(parsePromotionReviewerCommand({ action: "reset-device", nicknameKey: "x".repeat(65) }), null);
});

test("bank commands accept only canonical ranks, UUID-scoped items, and bounded quotas", () => {
  const bankId = "550e8400-e29b-41d4-a716-446655440000";
  const itemId = "550e8400-e29b-41d4-a716-446655440001";
  assert.deepEqual(parsePromotionBankCommand({ action: "save-task-bank", targetTitleId: "trainee", requiredCount: 3 }), { action: "save-task-bank", targetTitleId: "trainee", requiredCount: 3 });
  assert.equal(parsePromotionBankCommand({ action: "save-task-bank", targetTitleId: "trainee", requiredCount: 0 }), null);
  assert.ok(parsePromotionBankCommand({ action: "save-task-bank", targetTitleId: "trainee", requiredCount: 50 }));
  assert.equal(parsePromotionBankCommand({ action: "save-task-bank", targetTitleId: "trainee", requiredCount: 51 }), null);
  assert.equal(parsePromotionBankCommand({ action: "save-task-bank", targetTitleId: "Академик", requiredCount: 3 }), null);
  assert.deepEqual(parsePromotionBankCommand({ action: "save-qualification-bank", transitionId: "assistant", quotas: { single: 1, multiple: 1, freeText: 1 } }), { action: "save-qualification-bank", transitionId: "assistant", quotas: { single: 1, multiple: 1, freeText: 1 } });
  assert.ok(parsePromotionBankCommand({ action: "save-qualification-bank", transitionId: "assistant", quotas: { single: 100, multiple: 0, freeText: 0 } }));
  assert.equal(parsePromotionBankCommand({ action: "save-qualification-bank", transitionId: "assistant", quotas: { single: 101, multiple: 0, freeText: 0 } }), null);
  assert.equal(parsePromotionBankCommand({ action: "save-qualification-bank", transitionId: "researcher", quotas: { single: 0, multiple: 0, freeText: 0 } }), null);
  assert.ok(parsePromotionBankCommand({ action: "save-task-item", bankId, itemId, text: "Задание", active: true, sortOrder: 2 }));
  assert.equal(parsePromotionBankCommand({ action: "delete-task-item", bankId, itemId: "not-a-uuid" }), null);
  assert.equal(parsePromotionBankCommand({ action: "save-task-item", bankId, text: "Задание", active: true, sortOrder: 10_001 }), null);
});

test("bank count limits report the exact authoritative pool shortage", () => {
  assert.equal(taskBankLimitError(2, 2, true), null);
  assert.equal(taskBankLimitError(3, 2, true), "Нужно 3, активно 2.");
  assert.equal(taskBankLimitError(1, 0, false), null, "initial bank creation must remain possible");

  const pools = { single: 2, multiple: 1, freeText: 0 };
  assert.equal(qualificationBankLimitError({ single: 2, multiple: 1, freeText: 0 }, pools, true), null);
  assert.equal(
    qualificationBankLimitError({ single: 2, multiple: 2, freeText: 1 }, pools, true),
    "Не хватает вопросов: несколько вариантов — нужно 2, активно 1; свободный ответ — нужно 1, активно 0.",
  );
  assert.equal(qualificationBankLimitError({ single: 1, multiple: 0, freeText: 0 }, pools, false), null);
});

const taskItems = [
  { id: "a", text: "A", active: true, sortOrder: 0, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "b", text: "B", active: false, sortOrder: 1, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "c", text: "C", active: true, sortOrder: 2, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "d", text: "D", active: true, sortOrder: 3, updatedAt: "2026-10-27T00:00:00Z" },
];

test("task preview excludes inactive rows, has no duplicates and preserves manual order", () => {
  assert.deepEqual(selectTaskPreview(taskItems, 2, { manualIds: ["d", "a"] }).map((item) => item.id), ["d", "a"]);
  assert.deepEqual(selectTaskPreview(taskItems, 2, { random: () => 0 }).map((item) => item.id), ["a", "c"]);
  assert.throws(() => selectTaskPreview(taskItems, 2, { manualIds: ["a", "a"] }), /duplicate/i);
  assert.throws(() => selectTaskPreview(taskItems, 4, { random: () => 0 }), /insufficient/i);
});

const questions = [
  { id: "s1", text: "S1", type: "single" as const, active: true, sortOrder: 0, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "s2", text: "S2", type: "single" as const, active: true, sortOrder: 1, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "m1", text: "M1", type: "multiple" as const, active: true, sortOrder: 2, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "f1", text: "F1", type: "free-text" as const, active: true, sortOrder: 3, updatedAt: "2026-10-27T00:00:00Z" },
  { id: "f2", text: "F2", type: "free-text" as const, active: false, sortOrder: 4, updatedAt: "2026-10-27T00:00:00Z" },
];

test("qualification preview enforces per-type quotas and manual order", () => {
  const quotas = { single: 1, multiple: 1, freeText: 1 };
  assert.deepEqual(selectQualificationPreview(questions, quotas, { manualIds: ["f1", "m1", "s2"] }).map((item) => item.id), ["f1", "m1", "s2"]);
  assert.deepEqual(selectQualificationPreview(questions, quotas, { random: () => 0 }).map((item) => item.id), ["s1", "m1", "f1"]);
  assert.throws(() => selectQualificationPreview(questions, { single: 1, multiple: 1, freeText: 2 }, { random: () => 0 }), /insufficient/i);
});

test("single preview replacement preserves order, uniqueness and qualification type", () => {
  assert.deepEqual(replacePreviewItem(taskItems, ["a", "c"], "a", "ordinary", () => 0).map((item) => item.id), ["d", "c"]);
  assert.deepEqual(replacePreviewItem(questions, ["s1", "m1", "f1"], "s1", "qualification", () => 0).map((item) => item.id), ["s2", "m1", "f1"]);
  assert.throws(() => replacePreviewItem(questions, ["s1", "s2"], "s1", "qualification", () => 0), /insufficient-replacement/);
  assert.throws(() => replacePreviewItem(taskItems, ["a", "missing"], "a", "ordinary", () => 0), /stale-preview/);
});

test("question drafts keep answer shapes type-safe", () => {
  assert.ok(validateQuestionDraft({ type: "single", text: "Q", options: ["A", "B"], answer: 1 }));
  assert.ok(validateQuestionDraft({ type: "multiple", text: "Q", options: ["A", "B"], answer: [0, 1] }));
  assert.ok(validateQuestionDraft({ type: "free-text", text: "Q", answer: "text" }));
  assert.equal(validateQuestionDraft({ type: "single", text: "Q", options: ["A"], answer: [0] }), null);
  assert.equal(validateQuestionDraft({ type: "multiple", text: "Q", options: ["A", "B"], answer: [0, 0] }), null);
});

test("preview tokens expire and reject stale or tampered bank versions", () => {
  const secret = "reviewer-preview-secret-with-at-least-32-characters";
  const token = createPreviewToken({ kind: "ordinary", bankId: "bank", version: "v1", ids: ["a", "c"], expiresAt: 1000 }, secret);
  assert.deepEqual(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "v1", now: 999 }, secret), ["a", "c"]);
  assert.equal(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "v2", now: 999 }, secret), null);
  assert.equal(verifyPreviewToken(`${token}x`, { kind: "ordinary", bankId: "bank", version: "v1", now: 999 }, secret), null);
  assert.equal(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "v1", now: 1001 }, secret), null);
});

test("promotion reviewer routes use server access and RPCs, never browser openTabs or wildcard selects", () => {
  for (const path of ["reviewer", "banks"]) {
    const route = readFileSync(new URL(`../app/api/promotion/${path}/route.ts`, import.meta.url), "utf8");
    assert.ok(route.includes("requirePromotionReviewer"), path);
    assert.ok(route.includes(".rpc("), path);
    assert.ok(!route.includes('select("*")'), path);
    assert.ok(!route.includes("body.openTabs"), path);
  }
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.ok(proxy.includes('"/api/promotion/reviewer/:path*"'));
  assert.ok(proxy.includes('"/api/promotion/banks/:path*"'));
  const reviewer = readFileSync(new URL("../app/api/promotion/reviewer/route.ts", import.meta.url), "utf8");
  assert.ok(reviewer.includes('code: "binding-not-found"'));
  assert.match(reviewer, /command\.action === "reset-device" \|\| command\.action === "delete-request"[\s\S]*!auth\.access\.canManageEditors/);
});

test("bank route settles commands only with an authoritative state and returns preview version", () => {
  const route = readFileSync(new URL("../app/api/promotion/banks/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("authoritative-state-unavailable"));
  assert.match(route, /Response\.json\(\{ preview, expiresAt: new Date\(expiresAt\)\.toISOString\(\), version: bank\.version, items \}/);
  assert.ok(route.includes("taskBankLimitError"));
  assert.ok(route.includes("qualificationBankLimitError"));
});
