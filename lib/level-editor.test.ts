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
  assert.match(pickerCss, /\.access-level-option \{[^}]*width: 32px; height: 32px;/);
  assert.match(pickerCss, /@media \(max-width: 900px\) \{\s*\.access-level-option \{ width: 44px; height: 44px; \}/);
  assert.match(pickerCss, /\.access-level-options \{[^}]*flex-wrap: wrap; gap: 4px;/);
  assert.match(pickerCss, /\.access-level-picker \{[^}]*min-width: 0;/);
  assert.doesNotMatch(pickerCss, /border-radius|@keyframes|animation|transition|--muted|#[0-9a-fA-F]{3,8}\b/);
  assert.match(pickerCss, /input:focus-visible \+ \.access-level-digit \{ outline: 2px solid var\(--teal\); outline-offset: 2px; \}/);
  assert.match(pickerCss, /:has\(input:checked\) \{[^}]*border-color: var\(--teal-dim\); background: var\(--teal-soft\); box-shadow: inset 0 0 0 1px var\(--teal-dim\)/);
  assert.match(pickerCss, /:has\(input:disabled\) \{ opacity: \.4; cursor: not-allowed; \}/);
});

// UAT 2026-11-16 gap 6: the big row of five plates became one small «who sees it» button; the plates open behind it.
test("UAT 2026-11-16 gap 6: the picker is a small «who sees it» button with the plates behind it", () => {
  assert.equal(levelCopy.pickerSummary(1), "Видят все");
  assert.equal(levelCopy.pickerSummary(2), "Видят с допуска 2");
  assert.equal(levelCopy.pickerSummary(3), "Видят с допуска 3");
  assert.equal(levelCopy.pickerSummary(4), "Видят с допуска 4");
  assert.equal(levelCopy.pickerSummary(5), "Видят только допуск 5");
  // The summary is built from the same effective value as the checked plate (T-26-41).
  assert.ok(picker.includes("levelCopy.pickerSummary(shown)"));
  assert.ok(picker.includes("checked={shown === level}"));
  assert.ok(picker.includes("disabled={level < min}") && picker.includes("onChange={() => onChange(level)}"));
  assert.ok(/useState\(false\)/.test(picker), "closed by default");
  assert.ok(picker.includes('<button type="button" className="access-level-toggle"'));
  assert.ok(picker.includes("aria-expanded={open}") && picker.includes("aria-controls={optionsId}"));
  assert.ok(picker.includes("id={optionsId}") && picker.includes("hidden={!open}"));
  assert.ok(picker.includes("setOpen((current) => !current)"));
  assert.ok(picker.includes("event.detail > 0") && picker.includes("setOpen(false)"), "a pointer choice closes the plates, the arrows do not");
  assert.ok(picker.includes("onBlur=") && picker.includes("event.relatedTarget") && picker.includes(".contains("), "leaving the group closes the plates");
  // The legend stays the first child, the button comes after it, and the hint, the notice and the action stay outside the hidden block.
  assert.ok(picker.indexOf("<legend>") < picker.indexOf("access-level-toggle"));
  const hiddenStart = picker.indexOf("hidden={!open}");
  const optionsEnd = picker.indexOf("</div>", hiddenStart);
  assert.ok(picker.indexOf('className="access-level-hint"') > optionsEnd, "the minimum hint is visible while closed");
  assert.ok(picker.indexOf('role="status"') > optionsEnd && picker.indexOf("{action}") > optionsEnd);
  assert.ok(!/[А-Яа-яЁё]/.test(picker), "every Russian text comes from lib/level-copy.ts");
  const pickerCss = accessBlock.slice(accessBlock.indexOf("/* picker:"));
  assert.match(pickerCss, /\.access-level-picker \{[^}]*grid-column: auto;/);
  assert.doesNotMatch(pickerCss, /grid-column: 1 \/ -1/);
  assert.match(pickerCss, /\.access-level-toggle \{[^}]*min-height: 32px;[^}]*padding: 0 8px;[^}]*width: auto;[^}]*font: 700 11px/);
  assert.match(pickerCss, /\.access-level-options \{[^}]*margin-top: 4px;/);
  assert.match(pickerCss, /@media \(max-width: 900px\) \{[^}]*\.access-level-option \{ width: 44px; height: 44px; \}\s*\.access-level-toggle \{ min-height: var\(--tap-target\); \}/);
  assert.doesNotMatch(pickerCss, /border-radius|@keyframes|animation|transition|--muted|#[0-9a-fA-F]{3,8}/);
  assert.match(pickerCss, /\.access-level-options\[hidden\] \{ display: none; \}/);
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
  // The add button keeps its label and the limit. 26.1-26 (owner item 34): in the editor it ends the strip of the records, its label lives in the card tabs seam.
  assert.ok(source("components/portia-editor-card-tabs.tsx").includes('addLog: "+ ДОБАВИТЬ ЗАПИСЬ"'));
  assert.ok(editor.includes("label: cardTabsCopy.addLog") && editor.includes("scientistLogs.length >= MAX_SCIENTIST_LOGS"));
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

// ---- 24-08 Task 1: the hierarchy in the draft ----

test("LVL-02/D-16 the picker stands at the info section, the subsection, the guide section and the card", () => {
  assert.ok(count(editor, "<LevelPicker") >= 7, "3 places of 24-07 plus 4 of 24-08");
  for (const name of ["level-info-${section.id}", "level-sub-${subsection.id}", "level-guide-${section.id}", "level-card-${card.id}"]) {
    assert.ok(editor.includes(`name={\`${name}\`}`), `${name}: one group per record, named by its id`);
  }
  // Each picker follows the title field of its form.
  assert.match(editor, /<Field label="Заголовок"><input value=\{section\.title\}[^\n]*\n\s*<LevelPicker name=\{`level-info-/);
  assert.match(editor, /<Field label="Заголовок подраздела">[^\n]*\n\s*<LevelPicker name=\{`level-sub-/);
  assert.match(editor, /<Field label="Заголовок раздела">[^\n]*\n\s*<LevelPicker name=\{`level-guide-/);
  assert.match(editor, /<Field label="Заголовок карточки">[^\n]*\n\s*<LevelPicker name=\{`level-card-/);
  assert.ok(editor.includes('import { effectiveLevel, raiseChildren } from "@/lib/level-hierarchy"'));
});

test("LVL-03/D-17 a child cannot go below its section; the section lifts its children inside the draft change", () => {
  assert.ok(editor.includes("raiseChildren(item.subsections, level)"));
  assert.ok(editor.includes("raiseChildren(item.cards, level)"));
  assert.ok(count(editor, "min={effectiveLevel(") >= 2, "subsection and card read the section's level as their minimum");
  assert.ok(editor.includes("min={effectiveLevel(section.level, 1)} value={subsection.level}"));
  assert.ok(editor.includes("min={effectiveLevel(section.level, 1)} value={card.level}"));
  // The count is taken from the draft the user sees, before the change, with the same rule as raiseChildren.
  assert.ok(editor.includes("section.subsections.filter((child) => effectiveLevel(child.level, 1) < level).length"));
  assert.ok(editor.includes("section.cards.filter((child) => effectiveLevel(child.level, 1) < level).length"));
});

test("D-17 the lift is told under the section's group, and not when nobody changed", () => {
  assert.ok(editor.includes("levelCopy.raisedSubsections(level, raised)") && editor.includes("levelCopy.raisedCards(level, raised)"));
  assert.ok(editor.includes("setRaisedNotice(raised > 0 ? {"), "k = 0 clears the line instead of showing it");
  assert.ok(editor.includes("notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined}"), "the line belongs to its section");
  assert.equal(count(editor, "setRaisedNotice(null); }} />"), 2, "a change of a child's level clears the line");
  assert.ok(editor.includes("raisedNotice.parentId !== activeInfoSection && raisedNotice.parentId !== activeGuideSection) setRaisedNotice(null)"), "another section clears the line");
  assert.equal(levelCopy.raisedSubsections(3, 2), "Уровень подразделов поднят до 3: изменено 2.");
  assert.equal(levelCopy.raisedCards(4, 1), "Уровень карточек поднят до 4: изменено 1.");
});

test("D-18 the section tabs, the contents and the card heads carry no level label", () => {
  assert.ok(!/<SectionTabs[^\n]*level/i.test(editor));
  assert.ok(!/<EditorToc[^\n]*level/i.test(editor));
  assert.ok(!/<CollapsibleCard[^\n]*(?:\.level|levelCopy)/.test(editor));
});

test("A-5 the «Информация» and «Справочник» apps have no level of their own in the editor", () => {
  assert.ok(!editor.includes("appLevels?.info") && !editor.includes("appLevels?.guide"));
});

// ---- 24-08 Task 2: the viewer-shaped copy and the save notice ----

test("LVL-08/D-05 the props exist and are optional", () => {
  assert.ok(editor.includes("contentIncomplete?: boolean;"));
  assert.ok(editor.includes("saveNotice?: string;"));
  assert.ok(editor.includes("saveError, contentIncomplete, saveNotice }: Props)"));
});

test("LVL-08/EDGE the sync effect starts with the incomplete check, so such a copy is neither base nor draft nor rebase", () => {
  assert.match(editor, /window\.setTimeout\(\(\) => \{\s*if \(contentIncomplete\) return;\s*if \(!dirty\) \{/);
  assert.ok(editor.includes("}, [content, contentIncomplete, dirty, revision, tab]);"));
  // Both the sync and the rebase are inside that timer, after the check.
  const timer = editor.slice(editor.indexOf("if (contentIncomplete) return;"));
  assert.ok(timer.indexOf('dispatch({ type: "sync"') > 0 && timer.indexOf('dispatch({ type: "rebase"') > timer.indexOf('dispatch({ type: "sync"'));
  assert.ok(editor.indexOf("if (contentIncomplete) return;") < editor.indexOf('dispatch({ type: "sync"'));
});

test("LVL-08 save never sends an incomplete copy, and the access failure keeps its priority", () => {
  assert.ok(editor.includes("if (accessFailed || contentIncomplete) return false;"));
  const failed = editor.indexOf("if (accessFailed) {");
  const incomplete = editor.indexOf("if (contentIncomplete) {");
  assert.ok(failed > 0 && incomplete > failed, "the access panel is checked first");
  assert.ok(editor.indexOf("if (noTabs)") > incomplete, "the block replaces every form");
});

test("LVL-08/D-05 an incomplete copy shows one alert block and no save button", () => {
  const start = editor.indexOf("if (contentIncomplete) {");
  const block = editor.slice(start, editor.indexOf("if (noTabs)", start));
  assert.ok(block.includes('<div className="empty-state app-fatal-panel">'));
  assert.ok(block.includes('<div className="app-state-reason" role="alert"><strong>{levelCopy.editorIncomplete.heading}</strong><span>{levelCopy.editorIncomplete.body}</span></div>'));
  assert.ok(!block.includes("СОХРАНИТЬ") && !block.includes("save("), "nothing in the block saves");
  assert.ok(block.includes("{header}"));
  assert.ok(block.includes("closeAsked") && block.includes("levelCopy.editorIncomplete.heading}`"), "closing with unsaved edits still asks");
  assert.equal(levelCopy.editorIncomplete.heading, "Содержимое загружено не полностью.");
  assert.equal(levelCopy.editorIncomplete.body, "Сохранение отключено, чтобы не стереть скрытые записи. Обновите страницу.");
});

// Phase 26 (26-06, D-13b): the chip is retired; the notice is the status line of the action bar of the draft tabs.
test("D-17 the notice of the server's lift is the status line of the action bar, not hidden in a popover", () => {
  const bar = editor.indexOf("<EditorActionBar");
  const notice = editor.indexOf("notice={saveNotice}", bar);
  const end = editor.indexOf("/>", editor.indexOf("messages={", bar));
  assert.ok(bar > 0 && notice > bar && notice < end, "the editor hands the notice to the bar");
  const shell = lf(readFileSync(new URL("components/portia-editor-tab-shell.tsx", root), "utf8"));
  assert.match(shell, /const shown = notice \|\| statusText;/, "the notice takes the status slot");
  assert.match(shell, /className=\{`etab-status[^`]*`\} role="status" aria-live="polite"/, "the slot is a polite status line");
  assert.ok(!editor.includes("editor-save-popover"), "no popover is left to hide it");
});

// ---- Phase 25, 25-02: WR-02 and the action slot ----

test("WR-02 the legend is the first child of the fieldset, the caption follows it and the action slot is last", () => {
  const legend = picker.indexOf("<legend>{levelCopy.pickerLegend}</legend>");
  const caption = picker.indexOf('<strong className="access-level-caption">');
  const notice = picker.indexOf('<p className="access-level-notice" role="status">');
  const action = picker.indexOf("{action}");
  assert.ok(legend > -1 && caption > -1 && action > -1);
  const fieldsetStart = picker.indexOf('<fieldset className="access-level-picker"');
  const afterOpen = picker.slice(fieldsetStart).replace(/^<fieldset[^\n]*>\s*/, "");
  assert.ok(afterOpen.startsWith("<legend>"), "nothing stands between the opening <fieldset> and the <legend>");
  assert.ok(legend < caption, "the legend comes before the caption");
  assert.ok(caption < action && notice < action, "the action slot is drawn after the caption and the notice");
  assert.ok(picker.indexOf("</fieldset>") > action, "the action slot is inside the group");
  assert.ok(picker.includes("action?: ReactNode;"), "the slot is optional");
});

test("D-14 the offer stands beside the pickers of the virus, info and guide records and holds no Russian text of its own", () => {
  for (const key of ["virus:${selectedVirus.id}", "info:${section.id}", "info:${subsection.id}", "guide:${section.id}", "guide:${card.id}"]) {
    assert.ok(editor.includes("action={rewrite.action(`" + key + "`)}"), `${key}: an offer slot`);
    assert.ok(editor.includes("rewrite.raised(`" + key + "`"), `${key}: the raise starts the offer`);
  }
  for (const kind of ["virus", "info-section", "info-subsection", "guide-section", "guide-card"]) assert.ok(editor.includes(`"${kind}"`), kind);
  assert.equal(count(editor, "void rewrite.retire(outgoing);"), 1, "old files go only after a save");
  assert.ok(editor.indexOf('dispatch({ type: "saved"') < editor.indexOf("void rewrite.retire(outgoing);"));
  const hook = source("components/portia-image-rewrite.tsx");
  assert.ok(!/[А-Яа-яЁё]/.test(hook), "every text of the offer comes from lib/level-copy.ts");
  assert.ok(hook.includes("levelCopy.imageRewriteButton") && hook.includes('type="button"'));
  assert.ok(!hook.includes("fetch("), "the requests are in lib/media-rewrite-client.ts");
  assert.equal(levelCopy.imageRewriteButton, "Сменить адрес картинки");
  assert.equal(levelCopy.imageRewriteDone(2), "Адрес картинки сменён: 2. Старый файл удалится после сохранения.");
  assert.equal(levelCopy.imageRewriteExternal(1), "Внешние ссылки не меняются: 1.");
});
