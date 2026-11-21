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

test("reset-device accepts the exact normalized keys used by the promotion roster", () => {
  for (const [nicknameKey, expected] of [
    ["__portia_live_mw0rbyf6_72424cdc_p-ordinary", "__portia_live_mw0rbyf6_72424cdc_p-ordinary"],
    ["Ёжик Учёный", "ёжик учёный"],
    ["ＡＢＣ", "abc"],
  ]) {
    assert.deepEqual(parsePromotionReviewerCommand({ action: "reset-device", nicknameKey }), { action: "reset-device", nicknameKey: expected });
  }
});

test("reset-device rejects empty, overlong and control-character keys", () => {
  for (const nicknameKey of ["", "   ", "x".repeat(65), "a\u0007b", "a\u007fb"]) {
    assert.equal(parsePromotionReviewerCommand({ action: "reset-device", nicknameKey }), null);
  }
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
  assert.equal(taskBankLimitError(3, 2, true), "В банке недостаточно активных вопросов: нужно 3, есть 2.");
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
  assert.match(route, /Response\.json\(\{ preview, expiresAt: new Date\(expiresAt\)\.toISOString\(\), version: bank\.version, items, activeCount: bank\.items\.filter\(\(item\) => item\.active\)\.length \}/);
  assert.ok(route.includes("selectTaskPreview"));
  assert.ok(route.includes("selectQualificationPreview"));
  assert.ok(!route.includes('code: "insufficient-pool"'), "bank settings must save before the pool is filled");
});

test("task bank blocks exactly one short of required, including empty and all-disabled banks", () => {
  assert.equal(taskBankLimitError(3, 3, true), null);
  assert.equal(taskBankLimitError(3, 2, true), "В банке недостаточно активных вопросов: нужно 3, есть 2.");
  const disabledOnly = [{ id: "a", text: "A", active: false, sortOrder: 0, updatedAt: "2026-10-27T00:00:00Z" }];
  assert.equal(taskBankLimitError(1, 0, true), "В банке недостаточно активных вопросов: нужно 1, есть 0.");
  assert.throws(() => selectTaskPreview(disabledOnly, 1, { random: () => 0 }), /insufficient/i);
  assert.throws(() => selectTaskPreview([], 1, { random: () => 0 }), /insufficient/i);
});

test("task preview order is stable: sortOrder, then id, with no duplicates", () => {
  const stamp = "2026-10-27T00:00:00Z";
  const items = [
    { id: "z", text: "Z", active: true, sortOrder: 1, updatedAt: stamp },
    { id: "b", text: "B", active: true, sortOrder: 1, updatedAt: stamp },
    { id: "m", text: "M", active: true, sortOrder: 0, updatedAt: stamp },
    { id: "off", text: "Off", active: false, sortOrder: 0, updatedAt: stamp },
  ];
  for (const input of [items, [...items].reverse()]) {
    assert.deepEqual(selectTaskPreview(input, 3, { random: () => 0 }).map((item) => item.id), ["m", "b", "z"]);
    assert.deepEqual(selectTaskPreview(input, 2, { random: () => 0 }).map((item) => item.id), ["m", "b"]);
  }
  const picked = selectTaskPreview(items, 3, { random: () => 0.99 }).map((item) => item.id);
  assert.equal(new Set(picked).size, picked.length);
  assert.deepEqual(picked, ["m", "b", "z"]);
});

test("qualification quotas of zero need no questions of that type and all-zero quotas block", () => {
  const pools = { single: 1, multiple: 0, freeText: 0 };
  assert.equal(qualificationBankLimitError({ single: 1, multiple: 0, freeText: 0 }, pools, true), null);
  assert.ok(qualificationBankLimitError({ single: 0, multiple: 0, freeText: 0 }, pools, true));
  assert.deepEqual(selectQualificationPreview(questions, { single: 0, multiple: 0, freeText: 1 }, { random: () => 0 }).map((item) => item.id), ["f1"]);
});

test("question text length counts code points like Postgres length()", () => {
  const draft = (text: string) => validateQuestionDraft({ type: "free-text", text, answer: "ok" });
  assert.ok(draft("😀".repeat(4000)));
  assert.equal(draft("😀".repeat(4001)), null);
  assert.ok(draft("a".repeat(4000)));
  assert.equal(draft("a".repeat(4001)), null);
  assert.equal(validateQuestionDraft({ type: "single", text: "Q", options: ["😀".repeat(1001), "B"], answer: 0 }), null);
});

/* ------------------------------------------------------------------ 97d7abb: saving counts and quotas without a pool check (20-26) */
// 97d7abb (quick 261104-lkn) removed the 409 "insufficient-pool" on save-task-bank / save-qualification-bank so that a bank can be
// configured before its pool is filled. STAB-PROM-05 (an insufficient bank blocks confirmation) must still hold through the preview,
// the version-bound preview token and the SQL confirm. These tests describe that, they do not restore the save-time check.

const baselineSql = () => readFileSync(new URL("../supabase/migrations/20261101000000_portia_baseline.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const bankRouteSource = () => readFileSync(new URL("../app/api/promotion/banks/route.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
/** One SQL function body of the baseline, from its create statement to the closing `end; $$;`. */
function sqlFunction(sql: string, name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `${name} is missing from the baseline`);
  const end = sql.indexOf("end; $$;", start);
  assert.notEqual(end, -1, `${name} has no closing`);
  return sql.slice(start, end);
}

test("97d7abb: a task bank whose active pool is smaller than the saved count gives no preview, random or manual", () => {
  const twoActive = taskItems.filter((item) => item.active).slice(0, 2);
  assert.equal(twoActive.length, 2);
  assert.throws(() => selectTaskPreview(twoActive, 3, { random: () => 0 }), /insufficient/i);
  assert.throws(() => selectTaskPreview(taskItems, 4, { random: () => 0 }), /insufficient/i);
  // A hand-picked set cannot pad the shortage: wrong length, an inactive row and a duplicate are all refused.
  assert.throws(() => selectTaskPreview(twoActive, 3, { manualIds: ["a", "c"] }), /invalid-count/);
  assert.throws(() => selectTaskPreview(taskItems, 2, { manualIds: ["a", "b"] }), /inactive-selection/);
  assert.throws(() => selectTaskPreview(twoActive, 2, { manualIds: ["a", "a"] }), /duplicate/);
});

test("97d7abb: a qualification quota larger than the active pool of any one type gives no preview", () => {
  assert.throws(() => selectQualificationPreview(questions, { single: 3, multiple: 0, freeText: 0 }, { random: () => 0 }), /insufficient/i);
  assert.throws(() => selectQualificationPreview(questions, { single: 1, multiple: 2, freeText: 0 }, { random: () => 0 }), /insufficient/i);
  // f2 is inactive, so a single active free-text row cannot cover a quota of two.
  assert.throws(() => selectQualificationPreview(questions, { single: 0, multiple: 0, freeText: 2 }, { random: () => 0 }), /insufficient/i);
  assert.throws(() => selectQualificationPreview(questions, { single: 1, multiple: 1, freeText: 1 }, { manualIds: ["s1", "s2", "m1"] }), /invalid-count|invalid-quota/);
  assert.equal(selectQualificationPreview(questions, { single: 2, multiple: 1, freeText: 1 }, { random: () => 0 }).length, 4);
});

test("97d7abb: the bank route turns an insufficient pool into 409 at preview and confirms only a version-bound token of active items", () => {
  const route = bankRouteSource();
  // Saving stays unchecked on purpose (owner intent), so the limit helpers are not used by the route any more.
  assert.ok(!route.includes("taskBankLimitError") && !route.includes("qualificationBankLimitError"));
  // Preview: the throw from selectTaskPreview / selectQualificationPreview is a 409 with the shortage text, never a token.
  assert.match(route, /reason\.includes\("insufficient"\) \? "Недостаточно активных элементов\." : [^\n]*\{ status: 409/);
  const previewAt = route.indexOf('body.action === "preview"');
  const selectAt = route.indexOf("selectTaskPreview(bank.items");
  const tokenAt = route.indexOf("createPreviewToken(");
  assert.ok(previewAt !== -1 && selectAt > previewAt && tokenAt > selectAt, "the token is created only after the pool-checked selection");
  // Confirm: the token must verify against the CURRENT bank.version and every id must be an active item of that bank.
  const confirm = route.slice(route.indexOf("const token = typeof body.preview"));
  assert.match(confirm, /verifyPreviewToken\(token, \{ kind, bankId, version: bank\.version, now: Date\.now\(\) \}, secret\)/);
  assert.match(confirm, /bank\.items\.find\(\(item\) => item\.id === id && item\.active\)/);
  assert.match(confirm, /selected\.length !== ids\.length\) return Response\.json\([^\n]*code: "stale-preview" \}, \{ status: 409/);
  assert.match(confirm, /p_bank_version: bank\.version/);
});

test("97d7abb: static SQL read, confirm compares the item count with required_count or the quota total and the bank version", () => {
  const sql = baselineSql();
  const assignment = sqlFunction(sql, "portia_promo_confirm_assignment");
  assert.match(assignment, /jsonb_array_length\(p_items\) <> required_count_value then raise exception 'stale-or-mismatched-bank'/);
  assert.match(assignment, /md5\(b\.updated_at::text \|\| coalesce\(\(select max\(i\.updated_at\)::text from public\.portia_promo_task_items i where i\.bank_id = b\.id\), ''\)\) = p_bank_version/);
  assert.match(assignment, /source\.bank_id = p_bank_id and source\.active/);
  assert.match(assignment, /count\(\*\) from public\.portia_promo_assignment_items ai[^;]*<> jsonb_array_length\(p_items\)/);
  const confirmTest = sqlFunction(sql, "portia_promo_confirm_test");
  assert.match(confirmTest, /select b\.single_count \+ b\.multiple_count \+ b\.free_text_count into quota_total/);
  assert.match(confirmTest, /jsonb_array_length\(p_questions\) <> quota_total then raise exception 'stale-or-mismatched-bank'/);
  assert.match(confirmTest, /md5\(b\.updated_at::text \|\| coalesce\(\(select max\(q\.updated_at\)::text from public\.portia_promo_qualification_questions q where q\.bank_id = b\.id\), ''\)\) = p_bank_version/);
  assert.match(confirmTest, /source\.bank_id = p_bank_id and source\.active/);
  assert.match(confirmTest, /count\(\*\) from public\.portia_promo_attempt_questions aq[^;]*<> jsonb_array_length\(p_questions\)/);
});

test("97d7abb: static SQL read, every bank save and item change moves the version that the preview token is bound to", () => {
  const sql = baselineSql();
  const command = sqlFunction(sql, "portia_promo_bank_command");
  const branch = (from: string, to: string) => command.slice(command.indexOf(from), command.indexOf(to));
  // Changing the saved count or quotas rewrites updated_at, which is part of the version, so a preview built before the change goes stale.
  assert.match(branch("p_action = 'save-task-bank'", "p_action = 'save-task-item'"), /on conflict \(target_title_id\) do update set required_count = excluded\.required_count, updated_at = now\(\)/);
  assert.match(branch("p_action = 'save-qualification-bank'", "p_action = 'save-question'"), /free_text_count = excluded\.free_text_count, updated_at = now\(\)/);
  assert.match(branch("p_action = 'save-task-item'", "p_action = 'delete-task-item'"), /update public\.portia_promo_task_banks set updated_at = now\(\) where id = bank_id_value/);
  assert.match(branch("p_action = 'delete-task-item'", "p_action = 'save-qualification-bank'"), /update public\.portia_promo_task_banks set updated_at = now\(\) where id = bank_id_value/);
  // The version the state endpoint hands out is the same expression the confirm functions check.
  const state = sqlFunction(sql, "portia_promo_bank_state");
  assert.ok(state.includes("md5(b.updated_at::text || coalesce((select max(i.updated_at)::text from public.portia_promo_task_items i where i.bank_id = b.id), ''))"));
  assert.ok(state.includes("md5(b.updated_at::text || coalesce((select max(q.updated_at)::text from public.portia_promo_qualification_questions q where q.bank_id = b.id), ''))"));
});

test("97d7abb: a preview built while the bank was sufficient stops verifying once the saved count or quota changes the version", () => {
  const secret = "97d7abb-preview-secret-with-at-least-32-characters";
  const token = createPreviewToken({ kind: "ordinary", bankId: "bank", version: "version-with-count-2", ids: ["a", "c"], expiresAt: 10_000 }, secret);
  assert.deepEqual(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "version-with-count-2", now: 1 }, secret), ["a", "c"]);
  assert.equal(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "version-with-count-3", now: 1 }, secret), null);
  assert.equal(verifyPreviewToken(token, { kind: "qualification", bankId: "bank", version: "version-with-count-2", now: 1 }, secret), null);
  assert.equal(verifyPreviewToken(token, { kind: "ordinary", bankId: "bank", version: "version-with-count-2", now: 10_001 }, secret), null);
});

test("owner 2026-11-20, OWN-08: the qualification preview is built from the active or marked questions, not from the bank quotas, and a set outside 1..100 is a 422", () => {
  const route = bankRouteSource();
  const preview = route.slice(route.indexOf('body.action === "preview"'), route.indexOf("const token = typeof body.preview"));
  assert.ok(preview.includes("pickAutoQualificationSet(questions, Math.random)"));
  assert.ok(preview.includes("qualificationTestQuotas(questions, picked)"));
  assert.ok(!preview.includes("bank.quotas"), "the stored quotas are not used by the preview");
  // The size is judged before the selection, and the answer is a 422 with its own code, not the version conflict.
  assert.ok(preview.indexOf("qualificationSetProblem(picked.length)") !== -1 && preview.indexOf("qualificationSetProblem(picked.length)") < preview.indexOf("selectQualificationPreview(questions"));
  const helper = route.slice(route.indexOf("const setProblemResponse"), route.indexOf("export async function GET"));
  assert.ok(helper.includes("status: 422") && !helper.includes("Банк изменился") && !helper.includes("409"));
  assert.ok(helper.includes("qualificationSetMessages.empty") && helper.includes("qualificationSetMessages.tooLarge"));
  assert.ok(route.indexOf("requirePromotionReviewer(supabase)", route.indexOf("export async function POST")) < route.indexOf("const body = parseJsonObject", route.indexOf("export async function POST")));
});

test("owner 2026-11-20, OWN-08: confirm brings the stored counts to the confirmed set, in a fixed order, without touching the SQL", () => {
  const route = bankRouteSource();
  const confirm = route.slice(route.indexOf("const token = typeof body.preview"));
  const order = ["verifyPreviewToken(token", "new Set(ids).size !== ids.length", "item.id === id && item.active", "qualificationSetProblem(ids.length)", "syncQualificationCounts(supabase, bank, ids)", "portia_promo_confirm_test"].map((part) => confirm.indexOf(part));
  assert.ok(order.every((at) => at !== -1), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "token, duplicates, activity, size, sync, confirm");
  assert.ok(route.includes("OWN-08 (owner 2026-11-20)"));
  // The version of the reloaded bank is what the SQL checks.
  assert.match(confirm, /p_bank_version: confirmBank\.version, p_questions/);
  const sync = route.slice(route.indexOf("async function syncQualificationCounts"), route.indexOf("export async function GET"));
  assert.ok(sync.includes("parsePromotionBankCommand({ action: \"save-qualification-bank\", transitionId: bank.transitionId, quotas: wanted })"));
  assert.ok(sync.includes('"portia_promo_bank_command"') && sync.includes("bankState(supabase)"));
  assert.ok(sync.includes("fresh.items.some((item) => item.id === id && item.active)"), "activity is checked again after the reload");
  // An unparsable command is a program error (500), never the version conflict.
  const branch = confirm.slice(confirm.indexOf('if (kind === "qualification")'), confirm.indexOf("const rpc = kind"));
  assert.match(branch, /"program"\) return Response\.json\(\{ error: "Не удалось подтвердить набор\.", code: "confirm-failed" \}, \{ status: 500/);
  // «Банк изменился» appears in the qualification branch only after the sync call; the empty/too-large answers come before it and are 422.
  assert.ok(branch.indexOf("Банк изменился") > branch.indexOf("syncQualificationCounts("));
  assert.ok(branch.indexOf("setProblemResponse(problem)") !== -1 && branch.indexOf("setProblemResponse(problem)") < branch.indexOf("syncQualificationCounts("));
  const helper = route.slice(route.indexOf("const setProblemResponse"), route.indexOf("async function syncQualificationCounts"));
  assert.ok(helper.includes("status: 422") && !helper.includes("Банк изменился"));
  // Ordinary assignments keep their path; the route still starts with the reviewer check and the SQL is not part of this change.
  assert.ok(confirm.includes('"portia_promo_confirm_assignment", { p_request_id: requestId, p_bank_id: bankId, p_bank_version: bank.version'));
  assert.ok(route.slice(route.indexOf("export async function POST")).indexOf("requirePromotionReviewer(supabase)") < route.slice(route.indexOf("export async function POST")).indexOf("parseJsonObject"));
});

test("26.1 CR-01: a qualification confirm answers with the bank state, success or failure, and the client applies it so the next preview is shown", () => {
  const route = bankRouteSource();
  const main = readFileSync(new URL("../components/portia-promotion-editor-main.tsx", import.meta.url), "utf8");
  const qualificationEditor = readFileSync(new URL("../components/portia-promotion-qualification-editor.tsx", import.meta.url), "utf8");
  const confirm = route.slice(route.indexOf("const token = typeof body.preview"));
  // Success and the failure of the confirm RPC after the sync both carry the authoritative state.
  assert.match(confirm, /const afterConfirm = kind === "qualification" \? await stateField\(supabase\) : \{\};/);
  assert.match(confirm, /code: error\?\.code === "42883" \? "pending-database" : "confirm-conflict", \.\.\.afterConfirm \}/);
  assert.match(confirm, /\{ id: data, \.\.\.afterConfirm \}, \{ status: 201/);
  // A failure of the sync itself (the counts may be written already) carries it too; only the program error, where nothing was written, does not.
  const branch = confirm.slice(confirm.indexOf('if (kind === "qualification")'), confirm.indexOf("const rpc = kind"));
  assert.ok(branch.includes("const fresh = await stateField(supabase)") && branch.match(/\.\.\.fresh \}/g)!.length === 3);
  assert.ok(branch.indexOf('"program") return') < branch.indexOf("stateField(supabase)"));
  // The client: postBank applies body.state before it judges the status, and a failed confirm says that the set changed.
  const postBank = main.slice(main.indexOf("const postBank"), main.indexOf("const irreversible"));
  assert.ok(postBank.indexOf("setBanks(body.state") !== -1 && postBank.indexOf("setBanks(body.state") < postBank.indexOf("if (!response.ok)"));
  const confirmPreview = qualificationEditor.slice(qualificationEditor.indexOf("const confirmPreview"), qualificationEditor.indexOf("const previewPoolError"));
  assert.ok(confirmPreview.includes("if (!result) { setPreviewStale(true); return; }"));
  // The preview the server builds after the confirm is shown once the client holds the bank of the same version.
  assert.ok(qualificationEditor.includes("preview?.version === bank?.version ? preview : null"));
});

test("26.1 WR-01: the request is verified as claimed by this reviewer for this transition before the counts are written, 42883 stays 503", () => {
  const route = bankRouteSource();
  const confirm = route.slice(route.indexOf("const token = typeof body.preview"));
  assert.ok(confirm.indexOf("qualificationRequestOwnership(supabase, requestId, bank.transitionId)") !== -1);
  assert.ok(confirm.indexOf("qualificationRequestOwnership(") < confirm.indexOf("syncQualificationCounts(supabase, bank, ids)"));
  const ownership = route.slice(route.indexOf("async function qualificationRequestOwnership"), route.indexOf("type SyncFailure"));
  assert.ok(ownership.includes('"portia_promo_reviewer_state"') && ownership.includes("row.assignedToMe === true") && ownership.includes('row.status === "claimed"') && ownership.includes("row.targetTitleId === transitionId"));
  // An unreadable reviewer state is «not updated yet» (503), a request that is not mine is a 409 before any write.
  assert.match(confirm, /ownership === "unavailable"\) return Response\.json\([^\n]*code: "pending-database" \}, \{ status: 503/);
  assert.match(confirm, /ownership === "not-owned"\) return Response\.json\([^\n]*code: "confirm-conflict" \}, \{ status: 409/);
  // A missing function in the sync is the 503 of the database that is not updated, not the «bank changed» conflict.
  assert.ok(route.includes('failure: error.code === "42883" ? "pending-database" : "stale"'));
  assert.match(confirm, /synced\.failure === "pending-database"\) return Response\.json\([^\n]*code: "pending-database"[^\n]*\{ status: 503/);
});

test("26.1 WR-02: the chosen questions are compared with what the preview showed after the reload, and a change is its own answer", () => {
  const route = bankRouteSource();
  const sync = route.slice(route.indexOf("async function syncQualificationCounts"), route.indexOf("export async function GET"));
  assert.ok(sync.includes("isDeepStrictEqual(bank.items.find((item) => item.id === id), fresh.items.find((item) => item.id === id))"));
  assert.ok(sync.includes('{ failure: "changed" }') && sync.indexOf("isDeepStrictEqual") > sync.indexOf("bankState(supabase)"));
  const confirm = route.slice(route.indexOf("const token = typeof body.preview"));
  assert.match(confirm, /synced\.failure === "changed"\s*\? Response\.json\(\{ error: "Вопросы набора изменились после предпросмотра\./);
});

test("26.1-17 L1: the body limit is checked on the raw text before the JSON is parsed, for every action, and the selection is bounded", () => {
  const route = bankRouteSource();
  const post = route.slice(route.indexOf("export async function POST"));
  const authAt = post.indexOf("requirePromotionReviewer(");
  const limitAt = post.indexOf("bankBodyTooLarge(");
  const parseAt = post.indexOf("parseJsonObject(");
  assert.ok(authAt !== -1 && limitAt > authAt && parseAt > limitAt, "permissions first, then the size, then the parse");
  assert.match(post, /bankBodyTooLarge\(text\)\) return Response\.json\(\{ error: "Данные слишком велики\." \}, \{ status: 413/);
  assert.ok(!route.includes("JSON.stringify(body).length"), "the late size check after the parse is replaced by the early one");
  assert.match(post, /manualIds === "invalid" \|\| replaceId\.length > 64\) return Response\.json\([^\n]*code: "invalid-selection" \}, \{ status: 400/);
  assert.match(post, /replaceId\.length > 64/);
});
