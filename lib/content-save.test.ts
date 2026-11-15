import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// The route is checked from its source, comments stripped and line endings folded to LF.
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const withoutComments = (text: string) => lf(text).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const routeSource = withoutComments(readFileSync(new URL("../app/api/content/route.ts", import.meta.url), "utf8"));
const putBody = routeSource.slice(routeSource.indexOf("export async function PUT"));

test("LVL-08 / D-17 PUT: prepareContentSave стоит после normalizePortiaContent и до closedSectionsOf, отказ до чтения и записи", () => {
  const normalize = putBody.indexOf("normalizePortiaContent(body.content)");
  const prepare = putBody.indexOf("prepareContentSave(normalized, body.content)");
  const closed = putBody.indexOf("closedSectionsOf(");
  assert.ok(normalize >= 0 && prepare >= 0 && closed >= 0);
  assert.ok(normalize < prepare && prepare < closed);
  assert.ok(prepare < putBody.indexOf('.from("portia_content")'), "refused before any read or write of the row");
  assert.ok(prepare < putBody.indexOf("purgeCacheTag("), "refused before the cache purge");
  assert.match(putBody, /prepared\.kind === "refuse"/);
  const refuse = putBody.slice(putBody.indexOf('prepared.kind === "refuse"'));
  assert.ok(refuse.slice(0, refuse.indexOf(";\n")).includes("noStoreHeaders"), "the refusal carries no-store");
});

test("D-17 PUT пишет поднятый контент и отвечает levelsRaised; прежний контракт на месте", () => {
  assert.match(putBody, /payload: prepared\.content/);
  assert.doesNotMatch(putBody, /payload: normalized/);
  assert.match(putBody, /levelsRaised: prepared\.levelsRaised/);
  assert.match(putBody, /code: refusal\.code, sections: refusal\.sections/);
  assert.match(putBody, /contentRefusal\(baseline, normalized, access\.openTabs\)/, "the closed-section check still compares the editor's own intent");
  assert.match(putBody, /purgeCacheTag\(contentCacheTag\)/);
  assert.match(putBody, /\.eq\("revision", baseRevision\)/, "the same CAS by revision");
  assert.match(putBody, /status: 409/);
});

test("EDGE LVL-06/concurrency: сохранение без записей учёных идёт тем же CAS и не трогает записи учёных", () => {
  const content = fullContent();
  const result = prepareContentSave(content);
  assert.equal(result.kind, "save");
  if (result.kind !== "save") return;
  assert.deepEqual(result.content.viruses.map((virus) => virus.scientistLogs.length), content.viruses.map((virus) => virus.scientistLogs.length));
});

// RLS24-04 (review round 1, L-3): `redaction: null` is normalized to "no marker", so the normalized copy alone cannot tell a
// viewer copy from a full one. The submitted body is checked for the key itself.
test("L-3: ключ redaction в присланном теле (даже null или пустой) — копия зрителя, отказ 422 viewer-copy", () => {
  const normalized = fullContent();
  for (const marker of [null, {}, { level: 1 }, "x", 0, false]) {
    const result = prepareContentSave(normalized, { ...normalized, redaction: marker });
    assert.deepEqual(result, { kind: "refuse", status: 422, body: { error: levelCopy.putRefused, code: "viewer-copy" } }, JSON.stringify(marker));
  }
  assert.equal(prepareContentSave(normalized, { ...normalized }).kind, "save", "a full copy without the key is saved");
  assert.equal(prepareContentSave(normalized).kind, "save", "no submitted body given: only the normalized shape is judged");
  assert.equal(prepareContentSave(normalized, "not an object").kind, "save");
  assert.equal(prepareContentSave(normalized, null).kind, "save");
});
