// Source-level tests of the editor's level control (Phase 24, plan 24-07): the shared LevelPicker and the places the two editors
// use it. The browser (44px plates, the hint on a phone), the live roles and the physical devices stay BLOCKED until plan 24-11
// proves them; nothing here claims them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lf } from "./component-source.ts";
import { levelCopy } from "./level-copy.ts";

const root = new URL("../", import.meta.url);

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const source = (path: string) => stripComments(lf(readFileSync(new URL(path, root), "utf8")));

const picker = source("components/portia-level-picker.tsx");
const css = lf(readFileSync(new URL("app/portia.css", root), "utf8"));
const accessBlock = css.match(/^\/\* access-levels:start[\s\S]*?^\/\* access-levels:end \*\/$/m)?.[0] ?? "";

test("D-16 LevelPicker is one fieldset with a legend and native radios taken from the scale", () => {
  assert.ok(picker.includes("export function LevelPicker"));
  assert.ok(picker.includes('<fieldset className="access-level-picker"'));
  assert.ok(picker.includes("<legend>{levelCopy.pickerLegend}</legend>"));
  assert.ok(picker.includes("ACCESS_LEVELS.map("), "the plates must come from the scale, not from hard-coded numbers");
  assert.ok(picker.includes('type="radio"'));
  assert.ok(picker.includes("name={name}"), "one shared name per group");
  assert.equal((picker.match(/type="radio"/g) ?? []).length, 1, "exactly one radio template, repeated by the scale");
  assert.ok(!/\b[1-5]\s*,\s*[1-5]\s*,\s*[1-5]/.test(picker), "no literal list of levels");
  assert.equal(levelCopy.pickerLegend, "Нужен допуск");
  assert.equal(levelCopy.pickerOption(3), "Допуск 3");
});

test("D-17 plates below the minimum are disabled and say why, visibly and to assistive technology", () => {
  assert.ok(picker.includes("disabled={level < min}"));
  assert.ok(picker.includes("aria-label={levelCopy.pickerOption(level)}"));
  assert.ok(picker.includes("levelCopy.parentTitle(min)"));
  assert.ok(picker.includes("levelCopy.parentHint(min)"));
  assert.equal((picker.match(/aria-describedby/g) ?? []).length, 1);
  assert.ok(picker.includes("aria-describedby={min > 1 ? hintId : undefined}"), "described only when there is a minimum");
  assert.ok(picker.includes("{min > 1 ? <p className=\"access-level-hint\" id={hintId}>"), "the hint is drawn only when there is a minimum");
  assert.equal(levelCopy.parentHint(3), "Не ниже раздела: 3");
  assert.equal(levelCopy.parentTitle(3), "не ниже раздела: 3");
});

test("S3 empty: the shown value is the effective one, never an empty choice", () => {
  assert.ok(picker.includes("Math.max(requiredLevelOf(value), min)"));
  assert.ok(picker.includes("checked={shown === level}"));
});

test("only the notice is a status region, and the picker has no key handler of its own", () => {
  assert.equal((picker.match(/role="status"/g) ?? []).length, 1);
  assert.ok(/\{notice \? <p className="access-level-notice" role="status">/.test(picker));
  assert.ok(!/onKey(?:Down|Up|Press)/.test(picker), "Tab and the arrows are native");
  assert.ok(!/tabIndex/.test(picker));
});

test("the picker CSS lives in the access-levels block, sharp, static and wrapping", () => {
  assert.ok(accessBlock, "the access-levels block is missing");
  const pickerCss = accessBlock.slice(accessBlock.indexOf("/* picker:"));
  assert.ok(pickerCss.length > 0 && pickerCss.includes(".access-level-option"), "the picker rules are outside the block");
  const before = css.slice(0, css.indexOf("/* access-levels:start"));
  assert.ok(!before.includes(".access-level-"), "no picker rule outside the access-levels block");
  assert.match(pickerCss, /\.access-level-option \{[^}]*width: 40px; height: 40px;/);
  assert.match(pickerCss, /@media \(max-width: 900px\) \{\s*\.access-level-option \{ width: 44px; height: 44px; \}/);
  assert.match(pickerCss, /\.access-level-options \{[^}]*flex-wrap: wrap; gap: 4px;/);
  assert.match(pickerCss, /\.access-level-picker \{[^}]*min-width: 0;/);
  assert.doesNotMatch(pickerCss, /border-radius|@keyframes|animation|transition|--muted|#[0-9a-fA-F]{3,8}\b/);
  assert.match(pickerCss, /input:focus-visible \+ \.access-level-digit \{ outline: 2px solid var\(--teal\); outline-offset: 2px; \}/);
  assert.match(pickerCss, /:has\(input:checked\) \{[^}]*border-color: var\(--teal-dim\); background: var\(--teal-soft\); box-shadow: inset 0 0 0 1px var\(--teal-dim\)/);
  assert.match(pickerCss, /:has\(input:disabled\) \{ opacity: \.4; cursor: not-allowed; \}/);
});

test("T-24-26 only the picker joined the allow-list of components that read the scale", () => {
  const foundation = lf(readFileSync(new URL("lib/access-foundation.test.ts", root), "utf8"));
  assert.ok(foundation.includes('"components/portia-level-picker.tsx"'));
  assert.match(foundation, /!allowed\.has\(path\)[\s\S]*access-store\|access-session\|access-levels/);
  assert.match(foundation, /doesNotMatch\(readFileSync\(join\(repoRoot, "components\/portia-editor\.tsx"\), "utf8"\), \/@\\\/lib\\\/\(\?:users-\|access-\)\/u\)/);
});

// ---- Task 2: the places in the two editors ----

const editor = source("components/portia-editor.tsx");
const dossier = source("components/portia-editor-dossier.tsx");
const count = (text: string, part: string) => text.split(part).length - 1;

test("LVL-07 the old three-way select of a record's level is gone from both editors", () => {
  for (const [name, text] of [["portia-editor.tsx", editor], ["portia-editor-dossier.tsx", dossier]] as const) {
    assert.ok(!text.includes("заблокирована"), `${name}: the old Roman-numeral options are still there`);
    assert.ok(!/II\s+—/.test(text), `${name}: the old II — option is still there`);
    assert.ok(!text.includes("<select value={log.lockedLevel}"), `${name}: the native list of a record's level is still there`);
    assert.ok(text.includes("virus.scientistLogs[index].lockedLevel = level") || text.includes("item.scientistLogs[index].lockedLevel = level"), `${name}: the picker does not write a record's level`);
    assert.ok(text.includes("lockedLevel: 1, content:"), `${name}: a new record must start at level 1`);
    assert.ok(!text.includes("lockedLevel: 3, content:"), `${name}: a new record still starts at level 3`);
  }
});

test("D-16 the picker stands at the virus, every record and the apps in the editor; at the virus and records in the trash editor", () => {
  assert.ok(count(editor, "<LevelPicker") >= 3);
  assert.ok(count(dossier, "<LevelPicker") >= 2);
  assert.ok(editor.includes('import { LevelPicker } from "@/components/portia-level-picker"'));
  assert.ok(dossier.includes('import { LevelPicker } from "@/components/portia-level-picker"'));
  assert.ok(editor.includes("name={`level-virus-${selectedVirus.id}`}"));
  assert.ok(editor.includes("name={`level-log-${log.id}`}"), "one group per record: the name comes from the record id");
  assert.ok(dossier.includes("name={`level-log-${log.id}`}") && dossier.includes("name={`level-virus-${virus.id}`}"));
  // The picker follows the title field in the main tab.
  assert.match(editor, /<Field label="Название"><input value=\{selectedVirus\.name\}[^\n]*\n\s*<LevelPicker name=\{`level-virus-/);
  assert.match(dossier, /<Field label="Название"><input value=\{virus\.name\}[^\n]*\n\s*<LevelPicker name=\{`level-virus-/);
  assert.ok(editor.includes("virus.level = level;") && dossier.includes("item.level = level;"));
});

test("O-1/O-2 the apps group walks LEVELED_APP_IDS and opens the info tab", () => {
  assert.ok(editor.includes("LEVELED_APP_IDS.map("));
  assert.ok(editor.includes("title={levelCopy.appsGroup}"));
  assert.ok(editor.includes("caption={levelCopy.appLabels[id]}"));
  assert.ok(editor.includes("next.appLevels = { ...(next.appLevels ?? {}), [id]: level }"));
  const group = editor.indexOf("title={levelCopy.appsGroup}");
  const hint = editor.indexOf("Каждый блок становится отдельным разделом приложения «Информация»");
  assert.ok(group > 0 && hint > group, "the group is the first element of the info form");
  assert.ok(editor.lastIndexOf('{tab === "info"', group) > 0 && editor.lastIndexOf('{tab === "info"', group) > editor.lastIndexOf('{tab === "', group - 1) - 1);
  assert.ok(!editor.includes("charter"), "the editor takes the app list from the content module, not from a literal");
});

test("D-14/LVL-06 a new virus has no scientist records, and an empty list says it can be saved", () => {
  const body = editor.match(/const blankVirus = \(\): Virus => \(\{[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.ok(body, "blankVirus is missing");
  assert.ok(body.includes("scientistLogs: [],"));
  assert.ok(!body.includes("ЗАПИСЬ 01") && !editor.includes("ЗАПИСЬ 01"));
  assert.ok(editor.includes('<p className="editor-guidance">{levelCopy.logsEmptyEditor}</p>'));
  assert.ok(dossier.includes('<p className="editor-guidance">{levelCopy.logsEmptyEditor}</p>'));
  assert.equal(levelCopy.logsEmptyEditor, "Записей учёных нет. Карточку можно сохранить без них.");
  // The add button keeps its label and the limit.
  assert.ok(editor.includes("+ ДОБАВИТЬ ЗАПИСЬ") && editor.includes("scientistLogs.length >= MAX_SCIENTIST_LOGS"));
  assert.ok(dossier.includes("+ ДОБАВИТЬ ЗАПИСЬ") && dossier.includes("scientistLogs.length >= MAX_SCIENTIST_LOGS"));
});

test("D-18 no level label in the editor lists", () => {
  assert.ok(!editor.includes("levelCopy.logLevel("));
  assert.ok(!editor.includes("levelCopy.archiveMeta("));
});

test("the template builder never shows the level control", () => {
  for (const path of ["components/portia-template-builder.tsx", "lib/portia-template-dossier.ts"]) {
    assert.ok(!lf(readFileSync(new URL(path, root), "utf8")).includes("LevelPicker"), `${path} must not use LevelPicker`);
  }
});

test("T-24-26 the editor still takes the scale only through the picker", () => {
  assert.doesNotMatch(editor, /@\/lib\/(?:users-|access-)/u);
  assert.doesNotMatch(dossier, /access-levels|access-store|access-session/u);
});
