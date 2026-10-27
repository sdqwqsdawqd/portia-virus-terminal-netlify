import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const participant = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");
const reviewer = readFileSync(new URL("../components/portia-promotion-editor.tsx", import.meta.url), "utf8");
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

test("qualification UI supports every answer type without backward navigation", () => {
  assert.ok(participant.includes('type="radio"'));
  assert.ok(participant.includes('type="checkbox"'));
  assert.ok(participant.includes("<textarea"));
  assert.ok(!participant.includes("ПРЕДЫДУЩИЙ ВОПРОС"));
});

test("qualification UI gives reviewers grading and an explicit independent final decision", () => {
  assert.ok(reviewer.includes("promotion-grading-workspace"));
  assert.ok(reviewer.includes("grade-answer"));
  assert.ok(reviewer.includes("ВЕРНО"));
  assert.ok(reviewer.includes("НЕВЕРНО"));
  assert.ok(reviewer.includes("ЗАСЧИТАТЬ ПРОВЕРКУ"));
  assert.ok(reviewer.includes("НЕ ЗАСЧИТЫВАТЬ"));
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
  assert.match(styles, /html\[data-motion="reduce"\][^\n]*\.promotion-qualification-runner/);
});
