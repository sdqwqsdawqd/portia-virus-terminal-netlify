// Offline contract of the honest wording of Phase 24 (SEC-07, D-02, D-11, D-19): the documents say that the direct links of the
// «Устав» and the «Таблица» stay open, and no text says they are closed. Reads files only; nothing is claimed about live checks.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SEC07 = "Ограничение «Устава» и «Таблицы» действует только на сайте. Прямые ссылки на эти документы остаются открытыми.";
const PROJECT = ".planning/PROJECT.md";
const NOTES = ".planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-RELEASE-NOTES.md";
const COPY = "lib/level-copy.ts";
const read = (path: string) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");

// A sentence that names a link and also says closed/protected claims what SEC-07 forbids.
function closedLinkClaims(text: string): string[] {
  return text.split(/[.\n]/).filter((sentence) => /ссылк/i.test(sentence) && /(?:закрыт|защищ)/i.test(sentence));
}

test("SEC-07: фраза совпадает посимвольно и в PROJECT.md (Known Limitations), и в релизной заметке", () => {
  for (const path of [PROJECT, NOTES]) assert.ok(read(path).includes(SEC07), path);
  const project = read(PROJECT);
  assert.ok(project.indexOf("## Known Limitations") < project.indexOf(SEC07) && project.indexOf(SEC07) < project.indexOf("## Key Decisions"), "the phrase sits in Known Limitations");
  const notes = read(NOTES);
  assert.ok(notes.indexOf("## Известные ограничения") < notes.indexOf(SEC07), "the phrase sits in the limitations of the note");
});

test("SEC-07/D-02: ни PROJECT.md, ни заметка, ни lib/level-copy.ts не утверждают, что ссылки закрыты или защищены", () => {
  for (const path of [PROJECT, NOTES, COPY]) assert.deepEqual(closedLinkClaims(read(path)), [], path);
  // The detector itself catches the forms it is for.
  for (const bad of ["Ссылка на Устав закрыта.", "Ссылки защищены уровнем.", "Закрытые ссылки больше не работают."]) assert.equal(closedLinkClaims(bad).length, 1, bad);
  assert.deepEqual(closedLinkClaims(SEC07), []);
});

test("D-11: PROJECT.md и заметка называют расширенный риск (запись уровня в Supabase, анонимное чтение до Phase 25) и не засчитывают его", () => {
  for (const path of [PROJECT, NOTES]) {
    const text = read(path);
    assert.ok(text.includes("прямо в Supabase"), path);
    assert.ok(text.includes("Phase 25") && text.includes("SEC-01"), path);
    assert.ok(text.includes("portia_content"), path);
  }
  assert.ok(read(PROJECT).includes("Свободный текст объявлений и фраз помощника не уровневый"));
  assert.ok(read(NOTES).includes("Свободный текст объявлений и фраз помощника не уровневый"));
});

test("D-19: решение записано в Key Decisions, «Просмотр как уровень N» остаётся в Future Requirements", () => {
  const project = read(PROJECT);
  const decisions = project.slice(project.indexOf("## Key Decisions"));
  assert.ok(/\| Phase 24 D-19: «Просмотр как уровень N»/.test(decisions));
  assert.ok(/Просмотр как уровень N/.test(read(".planning/REQUIREMENTS.md")));
});

test("релизная заметка не содержит слова PASS (живые проверки не проведены)", () => {
  const notes = read(NOTES);
  assert.ok(!/\bPASS\b/.test(notes));
  assert.ok(/BLOCKED/.test(notes));
});
