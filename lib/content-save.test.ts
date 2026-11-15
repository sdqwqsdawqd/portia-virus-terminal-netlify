import test from "node:test";
import assert from "node:assert/strict";
import { prepareContentSave } from "./content-save.ts";
import { levelCopy } from "./level-copy.ts";
import { normalizeContentRedaction } from "./level-placeholders.ts";
import { defaultPortiaContent, type InfoSection, type PortiaContent } from "./portia-content.ts";

const fullContent = (): PortiaContent => structuredClone(defaultPortiaContent);

const withInfoSection = (content: PortiaContent, level: 1 | 3, subLevel: 1 | 3): PortiaContent => {
  const section: InfoSection = {
    id: "sec-d17",
    title: "Раздел",
    body: "",
    level,
    subsections: [{ id: "sub-d17", title: "Подраздел", blocks: [], level: subLevel }],
  };
  return { ...content, infoSections: [section, ...content.infoSections] };
};

test("LVL-08 копия «для зрителя» с redaction отклоняется 422 и кодом viewer-copy", () => {
  const content: PortiaContent = { ...fullContent(), redaction: normalizeContentRedaction({ level: 1 }) };
  const result = prepareContentSave(content);
  assert.deepEqual(result, { kind: "refuse", status: 422, body: { error: levelCopy.putRefused, code: "viewer-copy" } });
});

test("LVL-08 запись учёного с withheld в recycledViruses отклоняется", () => {
  const content = fullContent();
  const virus = structuredClone(content.viruses[0]);
  virus.scientistLogs = [{ id: "log-w", title: "t", scientist: "s", lockedLevel: 3, content: [], withheld: true }];
  const result = prepareContentSave({ ...content, recycledViruses: [virus] });
  assert.equal(result.kind, "refuse");
  if (result.kind === "refuse") {
    assert.equal(result.status, 422);
    assert.equal(result.body.code, "viewer-copy");
  }
});

test("EDGE LVL-08/idempotency: повторная отправка той же копии зрителя каждый раз отказ, вход не мутирует", () => {
  const content: PortiaContent = { ...fullContent(), redaction: normalizeContentRedaction({ level: 2 }) };
  const snapshot = structuredClone(content);
  const first = prepareContentSave(content);
  const second = prepareContentSave(content);
  assert.deepEqual(first, second);
  assert.equal(first.kind, "refuse");
  assert.deepEqual(content, snapshot, "the input is not changed");
});

test("D-17 подраздел ниже раздела поднимается до уровня раздела, вход не изменён", () => {
  const content = withInfoSection(fullContent(), 3, 1);
  const snapshot = structuredClone(content);
  const result = prepareContentSave(content);
  assert.equal(result.kind, "save");
  if (result.kind !== "save") return;
  assert.equal(result.levelsRaised, 1);
  assert.equal(result.content.infoSections[0].subsections[0].level, 3);
  assert.deepEqual(content, snapshot, "the input is not changed");
  assert.notEqual(result.content, content);
});

test("D-17 полный контент без нарушений даёт levelsRaised 0 и равный контент", () => {
  const content = withInfoSection(fullContent(), 3, 3);
  const result = prepareContentSave(content);
  assert.equal(result.kind, "save");
  if (result.kind !== "save") return;
  assert.equal(result.levelsRaised, 0);
  assert.deepEqual(result.content, content);
});

test("EDGE LVL-06/concurrency: сохранение без записей учёных идёт тем же CAS и не трогает записи учёных", () => {
  const content = fullContent();
  const result = prepareContentSave(content);
  assert.equal(result.kind, "save");
  if (result.kind !== "save") return;
  assert.deepEqual(result.content.viruses.map((virus) => virus.scientistLogs.length), content.viruses.map((virus) => virus.scientistLogs.length));
});
