import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { qualificationGrade, qualificationPublicProjection, qualificationTransition, validateQualificationAnswer, type QualificationAttempt } from "./portia-qualification.ts";

const questions = [
  { id: "q1", type: "single" as const, text: "Один?", options: ["A", "B"], answerKey: 1 },
  { id: "q2", type: "multiple" as const, text: "Несколько?", options: ["A", "B", "C"], answerKey: [0, 2] },
  { id: "q3", type: "free-text" as const, text: "Текст?", options: [], answerKey: "Ответ" },
];
const prepared: QualificationAttempt = { id: "attempt", status: "prepared", clientMode: "desktop", questions, answers: [], startedAt: null, deadlineAt: null, technicalFailure: null, finalDecision: null };
const at = (value: string) => new Date(value);

test("qualification starts once with one server-authoritative 15 minute deadline", () => {
  const active = qualificationTransition(prepared, { type: "start", clientMode: "desktop" }, at("2026-10-27T12:00:00Z"));
  assert.equal(active.status, "active");
  assert.equal(active.startedAt, "2026-10-27T12:00:00.000Z");
  assert.equal(active.deadlineAt, "2026-10-27T12:15:00.000Z");
  assert.strictEqual(qualificationTransition(active, { type: "start", clientMode: "phone" }, at("2026-10-27T12:01:00Z")), active);
});

test("qualification answers are typed, forward-only and idempotent by nonce", () => {
  assert.equal(validateQualificationAnswer(questions[0], 1), true);
  assert.equal(validateQualificationAnswer(questions[0], [1]), false);
  assert.equal(validateQualificationAnswer(questions[1], [2, 0]), true);
  assert.equal(validateQualificationAnswer(questions[1], [0, 0]), false);
  assert.equal(validateQualificationAnswer(questions[2], "  ответ  "), true);
  let state = qualificationTransition(prepared, { type: "start", clientMode: "desktop" }, at("2026-10-27T12:00:00Z"));
  state = qualificationTransition(state, { type: "answer", questionId: "q1", answer: 1, nonce: "nonce-1" }, at("2026-10-27T12:01:00Z"));
  assert.equal(state.answers.length, 1);
  assert.strictEqual(qualificationTransition(state, { type: "answer", questionId: "q1", answer: 1, nonce: "nonce-1" }, at("2026-10-27T12:02:00Z")), state);
  assert.throws(() => qualificationTransition(state, { type: "answer", questionId: "q3", answer: "Ответ", nonce: "nonce-2" }, at("2026-10-27T12:02:00Z")), /out-of-order/);
});

test("qualification public projection exposes only the current question", () => {
  const active = qualificationTransition(prepared, { type: "start", clientMode: "phone" }, at("2026-10-27T12:00:00Z"));
  const projection = qualificationPublicProjection(active, at("2026-10-27T12:01:00Z"));
  assert.deepEqual(projection.question, { id: "q1", type: "single", text: "Один?", options: ["A", "B"], index: 0, total: 3 });
  const serialized = JSON.stringify(projection);
  for (const forbidden of ["answerKey", "questions", "technicalFailure", "reviewerCorrect"]) assert.ok(!serialized.includes(forbidden), forbidden);
  assert.ok(!serialized.includes("Несколько?"), "future question leaked");
});

test("qualification deadline and technical signals fail once with the first reason retained", () => {
  const active = qualificationTransition(prepared, { type: "start", clientMode: "desktop" }, at("2026-10-27T12:00:00Z"));
  const timedOut = qualificationTransition(active, { type: "answer", questionId: "q1", answer: 1, nonce: "late" }, at("2026-10-27T12:15:00Z"));
  assert.equal(timedOut.status, "auto-failed");
  assert.equal(timedOut.technicalFailure, "timeout");
  assert.strictEqual(qualificationTransition(timedOut, { type: "technical-failure", reason: "offline" }, at("2026-10-27T12:16:00Z")), timedOut);
  const hidden = qualificationTransition(active, { type: "technical-failure", reason: "hidden" }, at("2026-10-27T12:02:00Z"));
  assert.equal(hidden.technicalFailure, "hidden");
});

test("qualification grading derives percentage but final pass or fail stays explicit", () => {
  const answers = [{ questionId: "q1", nonce: "n1", value: 1 }, { questionId: "q2", nonce: "n2", value: [0] }, { questionId: "q3", nonce: "n3", value: "Ответ" }];
  const grade = qualificationGrade(questions, answers, { q1: true, q2: false, q3: true });
  assert.equal(grade.percent, 67);
  assert.deepEqual(grade.items.map((item) => item.correct), [true, false, true]);
  assert.equal("passed" in grade, false);
});

test("qualification API contracts never return keys or future snapshots", () => {
  const route = readFileSync(new URL("../app/api/promotion/test/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes('dynamic = "force-dynamic"'));
  assert.ok(route.includes("deadlineAt"));
  assert.ok(route.includes("portia_promo_current_test"));
  assert.ok(route.includes("portia_promo_answer_question"));
  assert.ok(route.includes("portia_promo_fail_attempt"));
  assert.doesNotMatch(route, /select\("\*"\)/);
});
