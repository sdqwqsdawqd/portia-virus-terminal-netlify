import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { qualificationPublicProjection, qualificationTransition, type QualificationAttempt } from "./portia-qualification.ts";

const participant = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");
const reviewer = readFileSync(new URL("../components/portia-promotion-editor-main.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");
const api = readFileSync(new URL("./portia-promotion-api.ts", import.meta.url), "utf8");
const setup = readFileSync(new URL("../supabase/portia_setup.sql", import.meta.url), "utf8");

test("qualification UI exposes only the safe attempt handle and current-question endpoint", () => {
  assert.match(api, /attemptId\?: string/);
  assert.match(setup, /'attemptId', a\.id/);
  assert.ok(participant.includes("/api/promotion/test?attemptId="));
  assert.ok(!participant.includes("answerKey"));
  assert.ok(!participant.includes("futureQuestions"));
});

test("qualification UI renders a server-derived single-question 15-minute runner", () => {
  assert.ok(participant.includes("promotion-qualification-runner"));
  assert.ok(participant.includes("ОТПРАВИТЬ И ДАЛЬШЕ"));
  assert.ok(participant.includes("ВОПРОС"));
  assert.match(participant, /Date\.parse\(.*deadlineAt/);
  assert.ok(participant.includes("5 минут"));
  assert.ok(participant.includes("3 минуты"));
  assert.ok(participant.includes("1 минута"));
});

test("qualification UI fails closed on desktop focus and every connection loss", () => {
  for (const event of ["visibilitychange", "blur", "pagehide", "offline"]) assert.ok(participant.includes(event), event);
  assert.ok(participant.includes('clientMode === "desktop"'));
  assert.ok(participant.includes("promotion-qualification-terminal"));
  assert.ok(participant.includes("Соединение прервано. Попытка завершена и передана проверяющему."));
});

test("qualification runner starts once, heartbeats within the lease and cleans every interval", () => {
  assert.match(participant, /QUALIFICATION_HEARTBEAT_MS/);
  assert.match(participant, /action:\s*"start"/);
  assert.match(participant, /action:\s*"heartbeat"/);
  assert.match(participant, /setInterval\([\s\S]*QUALIFICATION_HEARTBEAT_MS/);
  assert.match(participant, /clearInterval/);
  assert.match(participant, /terminalRecheckMs/);
});

test("qualification answers carry the expected index and conflicts replace local state", () => {
  assert.match(participant, /expectedQuestionIndex:\s*test\.question\.index/);
  assert.match(participant, /body\.code === "answer-conflict"[\s\S]*acceptProjection\(body\)/);
});

test("qualification UI supports every answer type without backward navigation", () => {
  assert.ok(participant.includes('type="radio"'));
  assert.ok(participant.includes('type="checkbox"'));
  assert.ok(participant.includes("<textarea"));
  assert.ok(!participant.includes("ПРЕДЫДУЩИЙ ВОПРОС"));
});

test("qualification UI gives reviewers grading and an explicit independent final decision", () => {
  assert.ok(reviewer.includes("promotion-grading-workspace"));
  assert.ok(reviewer.includes("grade-answer"));
  assert.ok(reviewer.includes(">Верно<"));
  assert.ok(reviewer.includes(">Неверно<"));
  assert.ok(reviewer.includes(">Проверка пройдена<"));
  assert.ok(reviewer.includes(">Проверка не пройдена<"));
  assert.ok(reviewer.includes("ОТМЕНИТЬ АВТОПРОВАЛ"));
});

test("qualification UI keeps participant result private and reviewer retake controls explicit", () => {
  assert.ok(participant.includes("promotion-qualification-result"));
  assert.ok(participant.includes("Процент"));
  assert.ok(!participant.includes("Ваш неверный ответ"));
  assert.ok(reviewer.includes("retakeDays"));
  assert.ok(reviewer.includes("release-retake"));
  assert.ok(reviewer.includes("ОТКРЫТЬ ПЕРЕСДАЧУ ДОСРОЧНО"));
});

test("qualification runner and grading workspace have sticky responsive reduced-motion styles", () => {
  assert.match(styles, /\.promotion-test-timer\s*\{[^}]*position:\s*sticky/);
  assert.match(styles, /\.promotion-grading-workspace\s*\{/);
  assert.match(styles, /@media \(max-width:\s*520px\)[\s\S]*\.promotion-question/);
  assert.match(styles, /html:is\(\[data-motion="reduced"\], \[data-motion="off"\]\)[^\n]*\.promotion-qualification-runner/);
});

test("an active qualification locks the desktop to one immovable promotion window and refreshes immediately after completion", () => {
  const desktop = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");
  assert.ok(participant.includes("onQualificationLockChange"));
  assert.ok(participant.includes("onQualificationFinished"));
  assert.ok(desktop.includes("qualification-focus-backdrop"));
  assert.ok(desktop.includes('locked={qualificationLocked}'));
  assert.ok(desktop.includes('if (qualificationLocked && appId !== "promotion") return;'));
  assert.match(styles, /\.app-window\.promotion-window\.is-modal-locked\s*\{[^}]*z-index:\s*990\s*!important/);
  assert.match(styles, /\.qualification-focus-backdrop\s*\{[^}]*pointer-events:\s*auto/);
});

const draft: QualificationAttempt = {
  id: "attempt", status: "prepared", clientMode: "desktop", startedAt: null, deadlineAt: null, technicalFailure: null, finalDecision: null,
  questions: [
    { id: "q1", type: "single", text: "Первый?", options: ["A", "B"], answerKey: 1 },
    { id: "q2", type: "free-text", text: "Второй?", options: [], answerKey: "секрет" },
  ],
  answers: [],
};

test("a reload gets the same server deadline back and the timer counts down from it, not from mount time", () => {
  const started = qualificationTransition(draft, { type: "start", clientMode: "desktop" }, new Date("2026-11-02T10:00:00Z"));
  const afterReload = qualificationTransition(started, { type: "start", clientMode: "desktop" }, new Date("2026-11-02T10:07:00Z"));
  assert.equal(qualificationPublicProjection(afterReload, new Date("2026-11-02T10:07:00Z")).deadlineAt, "2026-11-02T10:15:00.000Z");
  assert.match(participant, /Date\.parse\(test\.deadlineAt\) - current/);
  assert.match(participant, /Date\.parse\(deadlineAt\) - now/);
  assert.doesNotMatch(participant, /15 \* 60|900_?000|new Date\(Date\.now\(\) \+/);
});

test("timeout ends the attempt exactly once and later signals cannot replace the first reason", () => {
  assert.equal(participant.split('setTerminal("timeout")').length - 1, 1);
  assert.match(participant, /if \(test\?\.status !== "active" \|\| terminal\) return;\s*const tick/);
  assert.match(participant, /setTerminal\(\(current\) => current \?\? reason\)/);
  assert.match(participant, /\[\[300_000, "Осталось 5 минут"\], \[180_000, "Осталось 3 минуты"\], \[60_000, "Осталась 1 минута"\]\]/);
  assert.match(participant, /!announcedRef\.current\.has\(threshold\)/);
});

test("the participant projection never carries keys, reviewer marks, other questions or the answers given", () => {
  let state = qualificationTransition(draft, { type: "start", clientMode: "phone" }, new Date("2026-11-02T10:00:00Z"));
  state = qualificationTransition(state, { type: "answer", questionId: "q1", answer: 1, nonce: "n1" }, new Date("2026-11-02T10:01:00Z"));
  state = { ...state, answers: state.answers.map((answer) => ({ ...answer, reviewerCorrect: true })) };
  const projection = qualificationPublicProjection(state, new Date("2026-11-02T10:02:00Z"));
  assert.deepEqual(projection.question, { id: "q2", type: "free-text", text: "Второй?", options: [], index: 1, total: 2 });
  const text = JSON.stringify(projection);
  for (const forbidden of ["answerKey", "секрет", "reviewerCorrect", "reviewer", "Первый?", "notes", "answers", "nonce"]) assert.ok(!text.includes(forbidden), forbidden);
  const reviewed = qualificationPublicProjection({ ...state, status: "reviewed", finalDecision: "passed" }, new Date("2026-11-02T10:20:00Z"));
  assert.equal(reviewed.question, null);
  assert.equal(reviewed.result, "passed");
  assert.ok(!JSON.stringify(reviewed).includes("answerKey"));
});
