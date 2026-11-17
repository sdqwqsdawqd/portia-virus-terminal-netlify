import assert from "node:assert/strict";
import test from "node:test";
import {
  QUALIFICATION_RULES_MAX_LENGTH,
  qualificationPreStartLines,
  qualificationRulesSaveFailure,
  qualificationRulesText,
} from "./portia-qualification-rules.ts";

test("rules text is normalised, bounded and tolerant of empty values", () => {
  assert.equal(QUALIFICATION_RULES_MAX_LENGTH, 4000);
  assert.equal(qualificationRulesText("  Правило\r\nдва  "), "Правило\nдва");
  assert.equal(qualificationRulesText(""), "");
  assert.equal(qualificationRulesText("a".repeat(4000)), "a".repeat(4000));
  assert.equal(qualificationRulesText("a".repeat(4001)), null);
  for (const value of [null, undefined, 5, {}, [], true]) assert.equal(qualificationRulesText(value), null);
});

test("pre-start lines state the fixed supervision for a desktop candidate", () => {
  const lines = qualificationPreStartLines({ clientMode: "desktop", questionCount: 5 });
  assert.deepEqual(lines.map((line) => line.id), ["timer", "questions", "answers", "desktop", "phone", "timeout"]);
  assert.ok(lines.find((line) => line.id === "questions")?.text.includes("Вопросов: 5"));
  const timer = lines.find((line) => line.id === "timer")?.text ?? "";
  assert.ok(timer.includes("15 минут") && timer.includes("НАЧАТЬ ПРОВЕРКУ"));
  assert.ok(lines.find((line) => line.id === "answers")?.text.includes("изменить нельзя"));
  assert.equal(lines.find((line) => line.id === "desktop")?.current, true);
  assert.equal(lines.find((line) => line.id === "phone")?.current, false);
  assert.ok(lines.find((line) => line.id === "timeout")?.text.includes("проверяющему"));
});

test("only the phone line is current for a phone, neither for an unknown device", () => {
  const phone = qualificationPreStartLines({ clientMode: "phone", questionCount: 3 });
  assert.equal(phone.find((line) => line.id === "desktop")?.current, false);
  assert.equal(phone.find((line) => line.id === "phone")?.current, true);
  const unknown = qualificationPreStartLines({ clientMode: null, questionCount: null });
  assert.ok(unknown.every((line) => line.current === false));
  assert.ok(unknown.some((line) => line.id === "desktop") && unknown.some((line) => line.id === "phone"));
  assert.ok(unknown.every((line) => !/\d/.test(line.text.replace("15 минут", ""))));
  assert.ok(unknown.find((line) => line.id === "questions")?.text.includes("по одному"));
});

test("a rules save against a database without the migration is refused with a clear status", () => {
  for (const code of ["42883", "PGRST202", "42703"]) {
    const failure = qualificationRulesSaveFailure(code);
    assert.equal(failure.status, 503);
    assert.equal(failure.code, "pending-database");
    assert.ok(failure.error.includes("база ещё не обновлена"));
    assert.ok(failure.error.includes("Квоты и вопросы сохраняются"));
  }
  for (const code of ["P0001", "23514", undefined]) {
    const failure = qualificationRulesSaveFailure(code);
    assert.equal(failure.status, 400);
    assert.equal(failure.code, "rules-write-failed");
  }
});
