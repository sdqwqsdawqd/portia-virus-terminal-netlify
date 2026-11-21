import assert from "node:assert/strict";
import test from "node:test";
import {
  QUALIFICATION_OPTION_MAX,
  QUALIFICATION_OPTION_MIN,
  addOptionRow,
  builderDraftError,
  builderDraftPayload,
  draftFromItem,
  emptyBuilderDraft,
  QUALIFICATION_TEST_MAX,
  pickAutoQualificationSet,
  qualificationSetMessages,
  qualificationSetProblem,
  qualificationTestQuotas,
  qualificationTestSummary,
  removeOptionRow,
  switchDraftType,
  toggleOptionCorrect,
  type BuilderDraft,
} from "./portia-qualification-builder.ts";
import { validateQuestionDraft } from "./portia-promotion-reviewer.ts";

const rows = (...items: Array<[string, boolean]>) => items.map(([text, correct]) => ({ text, correct }));
const draft = (patch: Partial<BuilderDraft>): BuilderDraft => ({ ...emptyBuilderDraft(), ...patch });

test("a new draft is a single question with two empty unmarked rows", () => {
  assert.deepEqual(emptyBuilderDraft(), { type: "single", text: "", options: rows(["", false], ["", false]), sample: "" });
  assert.equal(QUALIFICATION_OPTION_MIN, 2);
  assert.equal(QUALIFICATION_OPTION_MAX, 8);
});

test("an existing item opens in the builder with its correct marks", () => {
  const single = draftFromItem({ type: "single", text: "Q", options: [{ text: "A" }, { text: "B" }, { text: "C" }], answerKey: 1 });
  assert.deepEqual(single.options, rows(["A", false], ["B", true], ["C", false]));
  const multiple = draftFromItem({ type: "multiple", text: "Q", options: ["A", "B", "C"], answerKey: [0, 2] });
  assert.deepEqual(multiple.options.map((option) => option.correct), [true, false, true]);
  const free = draftFromItem({ type: "free-text", text: "Q", answerKey: "образец" });
  assert.equal(free.type, "free-text");
  assert.equal(free.sample, "образец");
  assert.equal(draftFromItem({ text: "Q", answerKey: "x" }).type, "free-text");
});

test("switching the type keeps what can be kept", () => {
  const multiple = draft({ type: "multiple", options: rows(["A", true], ["B", true], ["C", false]) });
  assert.deepEqual(switchDraftType(multiple, "single").options.map((option) => option.correct), [true, false, false]);
  const single = draft({ type: "single", options: rows(["A", false], ["B", true]) });
  assert.deepEqual(switchDraftType(single, "multiple").options.map((option) => option.correct), [false, true]);
  const there = switchDraftType(multiple, "free-text");
  assert.equal(there.type, "free-text");
  assert.deepEqual(there.options.map((option) => option.text), ["A", "B", "C"]);
  assert.deepEqual(switchDraftType(there, "multiple").options, multiple.options);
});

test("a single type is exclusive and a multiple type toggles", () => {
  const single = draft({ options: rows(["A", true], ["B", false]) });
  assert.deepEqual(toggleOptionCorrect(single, 1).options.map((option) => option.correct), [false, true]);
  const multiple = draft({ type: "multiple", options: rows(["A", true], ["B", false]) });
  assert.deepEqual(toggleOptionCorrect(multiple, 1).options.map((option) => option.correct), [true, true]);
  assert.deepEqual(toggleOptionCorrect(multiple, 0).options.map((option) => option.correct), [false, false]);
});

test("the option rows stay between 2 and 8", () => {
  let value = emptyBuilderDraft();
  for (let step = 0; step < 10; step += 1) value = addOptionRow(value);
  assert.equal(value.options.length, 8);
  for (let step = 0; step < 10; step += 1) value = removeOptionRow(value, 0);
  assert.equal(value.options.length, 2);
});

test("every unsaveable draft says why, in words", () => {
  assert.equal(builderDraftError(draft({ text: "  " })), "Напишите текст вопроса.");
  assert.equal(builderDraftError(draft({ text: "Q", options: rows(["A", true], ["", false]) })), "Заполните или удалите пустой вариант 2.");
  assert.equal(builderDraftError(draft({ text: "Q", options: rows(["A", true], ["A ", false]) })), "Варианты не должны повторяться.");
  assert.equal(builderDraftError(draft({ text: "Q", options: rows(["A", false], ["B", false]) })), "Отметьте правильный вариант.");
  assert.equal(builderDraftError(draft({ type: "multiple", text: "Q", options: rows(["A", false], ["B", false]) })), "Отметьте хотя бы один правильный вариант.");
  const nine = Array.from({ length: 9 }, (_, index) => ({ text: `V${index}`, correct: index === 0 }));
  assert.equal(builderDraftError(draft({ text: "Q", options: nine })), "Нужно от 2 до 8 вариантов.");
  assert.equal(builderDraftError(draft({ text: "Q", options: rows(["A", true]) })), "Нужно от 2 до 8 вариантов.");
  assert.equal(builderDraftError(draft({ type: "free-text", text: "Q", sample: " " })), "Напишите образец ответа для проверяющего.");
  assert.equal(builderDraftError(draft({ text: "Q", options: rows(["A", true], ["B", false]) })), null);
  assert.equal(builderDraftError(draft({ type: "free-text", text: "Q", sample: "Образец" })), null);
});

test("a valid draft becomes the payload the server validator accepts", () => {
  const single = builderDraftPayload(draft({ text: "Q", options: rows(["A", false], ["B", true]) }));
  assert.deepEqual(single, { type: "single", text: "Q", options: ["A", "B"], answer: 1 });
  assert.ok(validateQuestionDraft(single));
  const multiple = builderDraftPayload(draft({ type: "multiple", text: "Q", options: rows(["A", true], ["B", false], ["C", true]) }));
  assert.deepEqual(multiple, { type: "multiple", text: "Q", options: ["A", "B", "C"], answer: [0, 2] });
  assert.ok(validateQuestionDraft(multiple));
  const free = builderDraftPayload(draft({ type: "free-text", text: "Q", sample: "Образец" }));
  assert.deepEqual(free, { type: "free-text", text: "Q", answer: "Образец" });
  assert.ok(validateQuestionDraft(free));
  assert.equal(builderDraftPayload(draft({ text: "" })), null);
});

// owner 2026-11-20, OWN-08: quotas removed. The test is built from the active questions; the quota line became a composition line.
test("OWN-08: the test pools count the active questions by type, or only the marked active ones", () => {
  const items = [
    { id: "a", type: "single" as const, active: true },
    { id: "b", type: "single" as const, active: false },
    { id: "c", type: "free-text" as const, active: true },
  ];
  assert.deepEqual(qualificationTestQuotas(items), { single: 1, multiple: 0, freeText: 1 });
  assert.deepEqual(qualificationTestQuotas(items, ["a", "b"]), { single: 1, multiple: 0, freeText: 0 });
  assert.deepEqual(qualificationTestQuotas([{ id: "x", active: true }]), { single: 0, multiple: 0, freeText: 1 }, "a question without a type is free text, like in the editor");
  assert.deepEqual(qualificationTestQuotas(items, []), { single: 0, multiple: 0, freeText: 0 });
});

test("OWN-08: the composition line names the total and the types, or asks for a question", () => {
  const line = qualificationTestSummary({ single: 2, multiple: 1, freeText: 0 });
  assert.ok(line.includes("3"), line);
  assert.ok(line.includes("2 с одним ответом") && line.includes("1 с несколькими") && !line.includes("свободн"), line);
  assert.equal(qualificationTestSummary({ single: 0, multiple: 0, freeText: 0 }), "Добавьте хотя бы один активный вопрос.");
  assert.ok(qualificationTestSummary({ single: 1, multiple: 0, freeText: 0 }).startsWith("В тесте: 1 вопрос "));
  assert.ok(qualificationTestSummary({ single: 4, multiple: 0, freeText: 0 }).startsWith("В тесте: 4 вопроса "));
  assert.ok(qualificationTestSummary({ single: 5, multiple: 0, freeText: 0 }).startsWith("В тесте: 5 вопросов "));
  assert.ok(qualificationTestSummary({ single: 0, multiple: 0, freeText: 21 }).includes("21 свободный"));
  assert.ok(qualificationTestSummary({ single: 0, multiple: 0, freeText: 25 }).includes("25 свободных"));
});

test("OWN-08: the automatic set is every active question, never more than 100", () => {
  assert.equal(QUALIFICATION_TEST_MAX, 100);
  const five = ["a", "b", "c", "d", "e"].map((id, index) => ({ id, active: index % 2 === 0, sortOrder: index }));
  assert.deepEqual([...pickAutoQualificationSet(five, () => 0.5)].sort(), ["a", "c", "e"]);
  assert.deepEqual(pickAutoQualificationSet([{ id: "x", active: false }], Math.random), []);
  const many = Array.from({ length: 150 }, (_, index) => ({ id: `q${index}`, active: index < 140 || index % 2 === 0, sortOrder: index }));
  const activeIds = new Set(many.filter((item) => item.active).map((item) => item.id));
  const seeded = () => { let seed = 7; return () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; }; };
  const picked = pickAutoQualificationSet(many, seeded());
  assert.equal(picked.length, 100);
  assert.equal(new Set(picked).size, 100);
  assert.ok(picked.every((id) => activeIds.has(id)));
  assert.deepEqual(pickAutoQualificationSet(many, seeded()), picked, "the same random gives the same set");
});

test("OWN-08: a set outside 1..100 is an honest problem, never a bank version conflict", () => {
  assert.equal(qualificationSetProblem(0), "empty");
  assert.equal(qualificationSetProblem(1), null);
  assert.equal(qualificationSetProblem(100), null);
  assert.equal(qualificationSetProblem(101), "too-large");
  assert.deepEqual(qualificationSetMessages.empty, { code: "empty-set", text: "В наборе нет активных вопросов. Включите или добавьте вопрос." });
  assert.deepEqual(qualificationSetMessages.tooLarge, { code: "set-too-large", text: "В наборе больше 100 вопросов. Уберите лишние." });
  assert.equal(qualificationSetMessages.capped(130), "В тесте 100 из 130 активных вопросов (предел 100)");
  for (const text of [qualificationSetMessages.empty.text, qualificationSetMessages.tooLarge.text, qualificationSetMessages.capped(130)]) {
    assert.ok(!text.includes("Банк изменился"), text);
  }
});
