import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BLOCK_TEXT, MAX_CONDITIONS, MAX_CONTENT_BODY_BYTES, MAX_FORMATTED_KEYS, MAX_RICH_RUNS, MAX_RUN_CHARS, bodyTooLargeMessage, contentBodyBytes, limitStatus, limitText, oversizeFields, oversizeMessage, utf8Bytes } from "./content-limits.ts";
import { defaultPortiaContent, portiaTextKey, type PortiaContent } from "./portia-content.ts";

const draft = (): PortiaContent => {
  const content = structuredClone(defaultPortiaContent);
  content.formattedText = {};
  content.broadcasts = [{ id: "bc", type: "news", title: "Сводка", body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }];
  content.infoSections = [{ id: "s1", title: "Раздел", body: "", subsections: [{ id: "u1", title: "Подраздел", blocks: [{ id: "b1", type: "text", text: "" }] }] }];
  return content;
};
const manyRuns = { runs: Array.from({ length: MAX_RICH_RUNS + 1 }, () => ({ text: "a" })) };

test("limitStatus is free under 80%, counter from 80% and full at the limit", () => {
  assert.equal(limitStatus(0, 500), "free");
  assert.equal(limitStatus(399, 500), "free");
  assert.equal(limitStatus(400, 500), "counter");
  assert.equal(limitStatus(499, 500), "counter");
  assert.equal(limitStatus(500, 500), "full");
  assert.equal(limitStatus(501, 500), "full");
  assert.equal(limitStatus(239, 300), "free");
  assert.equal(limitStatus(240, 300), "counter");
  assert.equal(limitStatus(119, 150), "free");
  assert.equal(limitStatus(120, 150), "counter");
});

test("limitText reads nothing, n / max, or МАКСИМУМ max", () => {
  assert.equal(limitText(10, 500), "");
  assert.equal(limitText(400, 500), "400 / 500");
  assert.equal(limitText(500, 500), "МАКСИМУМ 500");
});

test("oversizeFields names fields in editor order", () => {
  assert.deepEqual(oversizeFields(draft()), []);
  const content = draft();
  const virusId = content.viruses[0].id;
  content.broadcasts[0].conditions = "x".repeat(MAX_CONDITIONS + 1);
  content.formattedText[portiaTextKey.virus(virusId, "external")] = manyRuns;
  assert.deepEqual(oversizeFields(content), [`ВИРУС «${content.viruses[0].name}»`, "СВОДКА «Сводка»"]);
  const guide = draft();
  (guide.infoSections[0].subsections[0].blocks[0] as { text: string }).text = "x".repeat(MAX_BLOCK_TEXT + 1);
  guide.formattedText[portiaTextKey.info("s1")] = { runs: [{ text: "x".repeat(MAX_RUN_CHARS + 1) }] };
  assert.deepEqual(oversizeFields(guide), ["РАЗДЕЛ «Раздел»", "ПОДРАЗДЕЛ «Подраздел»"]);
  const keys = draft();
  keys.formattedText[portiaTextKey.searchRecommendations] = manyRuns;
  keys.formattedText[portiaTextKey.assistantIdle] = manyRuns;
  for (let i = 0; i < MAX_FORMATTED_KEYS; i += 1) keys.formattedText[`broadcast:z${i}:body`] = { runs: [] };
  assert.deepEqual(oversizeFields(keys), ["РЕКОМЕНДАЦИИ", "ПОМОЩНИК", "ОФОРМЛЕНИЕ ТЕКСТОВ"]);
});

test("oversizeMessage names one field or the first and the rest count", () => {
  assert.equal(oversizeMessage([]), "");
  assert.equal(oversizeMessage(["ВИРУС «A»"]), "ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: ВИРУС «A». СОХРАНЯЕТСЯ ЦЕЛИКОМ.");
  assert.equal(oversizeMessage(["ВИРУС «A»", "СВОДКА «B»", "ФАЙЛ «C»"]), "ТЕКСТ ОЧЕНЬ БОЛЬШОЙ: ВИРУС «A» И ЕЩЁ 2. СОХРАНЯЕТСЯ ЦЕЛИКОМ.");
});

test("contentBodyBytes is an upper bound of the request body", () => {
  const content = structuredClone(defaultPortiaContent);
  assert.ok(contentBodyBytes(content) >= utf8Bytes(JSON.stringify({ content, revision: 12 })));
  const cyrillic = structuredClone(defaultPortiaContent);
  cyrillic.assistantOffendedPhrase = "я".repeat(1000);
  assert.ok(contentBodyBytes(cyrillic) - contentBodyBytes(content) >= 2000 - utf8Bytes(content.assistantOffendedPhrase));
});

test("bodyTooLargeMessage is empty within the limit and names megabytes above it", () => {
  assert.equal(bodyTooLargeMessage(MAX_CONTENT_BODY_BYTES), "");
  assert.equal(bodyTooLargeMessage(5_200_000), "СЛИШКОМ МНОГО ДАННЫХ: 5.2 МБ ИЗ 5.0. СОКРАТИТЕ ТЕКСТ, ЧТОБЫ СОХРАНИТЬ.");
});
