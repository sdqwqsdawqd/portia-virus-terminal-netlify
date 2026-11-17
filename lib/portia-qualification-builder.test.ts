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
  qualificationQuotaSummary,
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

test("the quota line says in one sentence whether the bank is enough", () => {
  assert.deepEqual(
    qualificationQuotaSummary({ single: 3, multiple: 1, freeText: 1 }, { single: 5, multiple: 2, freeText: 1 }, true),
    { ok: true, text: "В тесте: 3 с одним ответом · 1 с несколькими · 1 свободный — в банке хватает ✓" },
  );
  assert.deepEqual(
    qualificationQuotaSummary({ single: 5, multiple: 0, freeText: 0 }, { single: 5, multiple: 0, freeText: 0 }, true),
    { ok: true, text: "В тесте: 5 с одним ответом — в банке хватает ✓" },
  );
  assert.deepEqual(
    qualificationQuotaSummary({ single: 3, multiple: 1, freeText: 1 }, { single: 1, multiple: 1, freeText: 0 }, true),
    { ok: false, text: "В тесте: 3 с одним ответом · 1 с несколькими · 1 свободный — не хватает активных: 2 с одним ответом, 1 свободный" },
  );
  assert.deepEqual(
    qualificationQuotaSummary({ single: 0, multiple: 0, freeText: 0 }, { single: 4, multiple: 0, freeText: 0 }, true),
    { ok: false, text: "В тесте нет вопросов — задайте хотя бы один." },
  );
  const missing = qualificationQuotaSummary({ single: 2, multiple: 0, freeText: 0 }, { single: 0, multiple: 0, freeText: 0 }, false);
  assert.equal(missing.ok, true);
  assert.ok(missing.text.endsWith("— банк ещё не создан: сохраните квоты, затем добавьте вопросы."));
});

test("свободный agrees with the number", () => {
  const text = (freeText: number, available: number) => qualificationQuotaSummary({ single: 0, multiple: 0, freeText }, { single: 0, multiple: 0, freeText: available }, true).text;
  assert.ok(text(1, 9).startsWith("В тесте: 1 свободный"));
  assert.ok(text(21, 30).startsWith("В тесте: 21 свободный"));
  for (const count of [2, 5, 11, 12, 25]) assert.ok(text(count, 100).startsWith(`В тесте: ${count} свободных`), String(count));
  assert.ok(text(5, 0).endsWith("не хватает активных: 5 свободных"));
});
