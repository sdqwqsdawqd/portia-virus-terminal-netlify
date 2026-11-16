import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formatLaunchLabels, nameContainsVisibleText, visibleLaunchText } from "./format-launch.ts";

const titles = ["Внешние характеристики", "Мутация 1: ПОВЕДЕНИЕ", "Очень длинное название текстового поля, которое на телефоне обрезается многоточием"];

test("the empty state: the name starts with the visible text «выберите текст» (WCAG 2.5.3)", () => {
  const labels = formatLaunchLabels(null);
  assert.equal(visibleLaunchText(labels), "ВЫБЕРИТЕ ТЕКСТ");
  assert.ok(nameContainsVisibleText(labels.accessibleName, visibleLaunchText(labels)), labels.accessibleName);
  assert.ok(labels.accessibleName.toLowerCase().startsWith("выберите текст"));
});

test("every field state: the name contains the whole visible text and starts with the visible label", () => {
  for (const title of titles) {
    const labels = formatLaunchLabels(title);
    const visible = visibleLaunchText(labels);
    assert.equal(visible, `ОФОРМЛЕНИЕ ${title}`);
    assert.ok(nameContainsVisibleText(labels.accessibleName, visible), `${labels.accessibleName} must contain ${visible}`);
    assert.ok(labels.accessibleName.toLowerCase().startsWith(labels.visibleLabel.toLowerCase()));
  }
});

test("whole words count: a longer word does not hold the visible one, and the old names are caught", () => {
  assert.equal(nameContainsVisibleText("Сначала выберите текстовое поле", "ВЫБЕРИТЕ ТЕКСТ"), false, "«текстовое» is not «текст» (axe compares words); this was the B8 mismatch");
  assert.equal(nameContainsVisibleText("Выберите текст: сначала выберите текстовое поле", "ВЫБЕРИТЕ ТЕКСТ"), true);
  assert.equal(nameContainsVisibleText("Оформление поля: Внешние", "ОФОРМЛЕНИЕ Внешние"), false, "the words must be contiguous");
});

test("the old field name, which dropped the visible title, is caught by the check", () => {
  assert.equal(nameContainsVisibleText("Оформление текста: Внешние характеристики", "ОФОРМЛЕНИЕ Внешние характеристики"), false);
});

test("D-57 (20-37): the template builder uses the shared launch button", () => {
  const builder = readFileSync(new URL("../components/portia-template-builder.tsx", import.meta.url), "utf8");
  assert.match(builder, /<FormatLaunchButton\b/);
  assert.doesNotMatch(builder, /aria-label=\{formatTarget \?/);
  const shared = readFileSync(new URL("../components/portia-editor-rich-text.tsx", import.meta.url), "utf8");
  assert.match(shared, /formatLaunchLabels\(target \? target\.title : null\)/);
  assert.match(shared, /aria-label=\{labels\.accessibleName\}/);
});

// Охрана файла редактора: реестр одобренных правок (D-64).
//
// D-57 (20-37) — одобренное владельцем исключение из правила 20-39 («portia-editor.tsx не меняется»), ограниченное кнопкой запуска формата.
// D-62 (20-50) — одобренный владельцем перенос «+ ДОБАВИТЬ РАЗДЕЛ» во вкладке «Информация» наверх, к вкладкам разделов (как в «Справочнике»).
// D-63 (20-53) — выбор видимой части картинки: в строках `<ImageEditorField` разрешены три атрибута кадра `framing`, `framingBox`, `onFramingChange`
// (stripFramingAttributes). Это правка файла-кандидата, а не образца: атрибуты вырезаются из ТЕКУЩЕГО файла перед сравнением с образцом.
// D-64: в components/portia-editor.tsx разрешены ТОЛЬКО правки этого реестра. Любая другая правка роняет тест.
//
// Охрана берёт образец файла редактора из истории git (`git show <коммит>:components/portia-editor.tsx`),
// поэтому ей нужен ПОЛНЫЙ клон, не shallow: в shallow-клоне коммита-образца нет. Clean-checkout (20-13) обязан клонировать
// с историей. Если git недоступен, клон shallow или коммита нет, тест ПАДАЕТ с понятным сообщением (git fetch --unshallow);
// он никогда не пропускается и не проходит молча.
//
// Одобренные правки components/portia-editor.tsx после 20-39:
//   1. 449c756 — key={index} у recommendation-preview-item (ошибка React «unique key», о которой сообщил владелец). Уже в образце.
//   2. D-57 — кнопка «ОФОРМЛЕНИЕ» стала общим FormatLaunchButton (applyLaunchButtonHunk).
//   3. D-62 — во вкладке «Информация» блок SectionAddBar перед SectionTabs «Разделы информации», нижней кнопки раздела нет (applyInfoAddSectionHunk).
//   4. D-63 — атрибуты кадра `framing`, `framingBox`, `onFramingChange` в строках `<ImageEditorField` (stripFramingAttributes).
//   5. PORTIA-22 (USR-01, USR-09) — вкладка «Пользователи»: импорт, EditorTab, счётчик, historyTab, строка вкладки
//      (applyUsersTabHunk); русских строк нет (D-58). Источник одобрения: ROADMAP Phase 22, success criterion 1.
//   6. PORTIA-24 (24-07; LVL-02, LVL-06, LVL-07) — общий выбор уровня LevelPicker у вируса, записей учёных и «Устава», новая карточка без записей, новая запись уровня 1
//      (applyLevelPickerHunk); русских строк в файле не добавлено, строки выбора лежат в lib/level-copy.ts. Источник одобрения: 24-CONTEXT D-13, D-14, D-16 и план 24-07.
//   7. PORTIA-24-08 (24-08; LVL-02, LVL-03, LVL-08) — выбор уровня у разделов, подразделов и карточек «Информации» и «Справочника» с иерархией и строкой автоподъёма
//      (applyLevelHierarchyHunk), защита от копии «для зрителя» (contentIncomplete) и строка saveNotice; русские строки лежат в lib/level-copy.ts. Источник одобрения: 24-CONTEXT D-05, D-16, D-17 и план 24-08.
//   8. PORTIA-25 (25-02; SEC-05, D-13, D-14) — «Сменить адрес картинки» у выбора уровня: хук useImageRewrite (components/portia-image-rewrite.tsx), вызов после подъёма уровня и после сохранения
//      (applyImageRewriteHunk); русских строк в файле не добавлено, строки лежат в lib/level-copy.ts, запросы — в lib/media-rewrite-client.ts. Источник одобрения: 25-CONTEXT D-13, D-14 и план 25-02.
//   9. PORTIA-26 (26-06; UI-04, D-12, D-13, D-21) — панель действий из шва вместо чипа; русские строки лежат в шве
//      components/portia-editor-tab-shell.tsx (applyTabShellHunk); PORTIA-26-06b — классы «список — деталь» (etab-body/etab-list/etab-detail)
//      рядом с прежними, aria-current у выбранной строки и пустая деталь из шва (applyTabBodiesHunk). Источник одобрения: 26-CONTEXT D-12, D-13, D-21 и план 26-06.
//  10. PORTIA-26-07 (26-07; UI-04, D-13a, A2) — «Справочник»: «+ ДОБАВИТЬ РАЗДЕЛ» и вкладки разделов в слоте nav панели, aria-current и прокрутка
//      текущего раздела, тело — оглавление слева и активный раздел справа (applySectionNavHunk). Источник одобрения: 26-CONTEXT D-12, D-13, D-21 и план 26-07.
// D-58 запрещает в этом файле правки подсказок и текстов: набор русских строк файла равен набору образца после одобренных правок.
// Любая будущая одобренная правка файла обязана расширить реестр: новый коммит-образец или новая разрешённая замена здесь, иначе тест упадёт.
const SAMPLE_COMMIT = "449c756200b3db32f9cfaf4b3ca36b47822b395b";
const EDITOR_PATH = "components/portia-editor.tsx";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const RICH_TEXT_IMPORT_FROM = "@/components/portia-editor-rich-text";
const LAUNCH_BUTTON_LINE = "<FormatLaunchButton target={formatTarget} open={formatterOpen} onToggle={() => setFormatterOpen((current) => !current)} />";
// D-62: нижняя кнопка раздела вкладки «Информация», которую правка убирает (одна строка образца, без отступа).
const INFO_BOTTOM_ADD_SECTION_LINE = '<button className="secondary-control" type="button" onClick={() => { const id = makeId("info"); changeDraft((next) => next.infoSections.push({ id, title: "НОВЫЙ РАЗДЕЛ", body: "", subsections: [] })); setSelectedInfoSection(id); setOpen([id], true); }}>+ ДОБАВИТЬ РАЗДЕЛ</button>';
// D-62: вкладки «Информация»; блок SectionAddBar встаёт непосредственно перед этой строкой.
const INFO_TABS_LINE_START = '<SectionTabs label="Разделы информации"';
// D-62: вставляемый блок, побайтно (отступы относительные: первая и последняя строки стоят на отступе SectionTabs).
const INFO_ADD_SECTION_BLOCK: readonly string[] = [
  "<SectionAddBar onCreate={(title) => {",
  '  const id = makeId("info");',
  '  changeDraft((next) => { next.infoSections.push({ id, title: title || "НОВЫЙ РАЗДЕЛ", body: "", subsections: [] }); });',
  "  setSelectedInfoSection(id);",
  "  setOpen([id], true);",
  "  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#card-${id} > .nested-editor-body input`)?.focus());",
  "}} />",
];

function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/** Падает (не пропускает), если образца нет в истории: shallow-клон, нет git или нет коммита. */
function readSampleEditor(): string {
  const short = SAMPLE_COMMIT.slice(0, 7);
  const fix = "run git fetch --unshallow (the clone must have full history)";
  let shallow: string;
  try {
    shallow = git(["rev-parse", "--is-shallow-repository"]).trim();
  } catch (error) {
    assert.fail(`D-57 guard needs full git history: git is unavailable or this is not a git checkout (${(error as Error).message}); ${fix}`);
  }
  assert.notEqual(shallow, "true", `D-57 guard needs full git history: commit ${short} may be missing because the clone is shallow; ${fix}`);
  try {
    git(["cat-file", "-e", `${SAMPLE_COMMIT}^{commit}`]);
  } catch {
    assert.fail(`D-57 guard needs full git history: commit ${SAMPLE_COMMIT} is missing (shallow clone or git unavailable); ${fix}`);
  }
  try {
    return toLf(git(["show", `${SAMPLE_COMMIT}:${EDITOR_PATH}`]));
  } catch (error) {
    assert.fail(`D-57 guard cannot read ${EDITOR_PATH} at ${short}: ${(error as Error).message}`);
  }
}

/** Образец + разрешённая замена D-57: встроенный блок кнопки запуска -> строка FormatLaunchButton и имя в импорте. */
function applyLaunchButtonHunk(sample: string): string {
  const lines = sample.split("\n");
  const starts = lines.flatMap((line, index) => (line.trim() === '<div className="global-format-launch">' ? [index] : []));
  assert.equal(starts.length, 1, "the sample holds exactly one inline launch button block");
  const start = starts[0];
  const indent = /^[ \t]*/.exec(lines[start])![0];
  let end = -1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === `${indent}</div>`) { end = index; break; }
  }
  assert.ok(end > start, "the inline launch button block has a closing </div> at its own indent");
  lines.splice(start, end - start + 1, `${indent}${LAUNCH_BUTTON_LINE}`);
  let replaced = 0;
  const next = lines.map((line) => {
    if (!line.startsWith("import {") || !line.includes(`from "${RICH_TEXT_IMPORT_FROM}"`)) return line;
    replaced += 1;
    assert.ok(line.includes("FloatingTextFormatPanel, FormattedTextarea,"), "the sample import keeps its expected shape");
    return line.replace("FloatingTextFormatPanel, FormattedTextarea,", "FloatingTextFormatPanel, FormatLaunchButton, FormattedTextarea,");
  });
  assert.equal(replaced, 1, "exactly one import from the rich text module");
  return next.join("\n");
}

/** Разрешённая замена D-62: нижняя кнопка раздела «Информации» уходит, блок SectionAddBar встаёт перед SectionTabs «Разделы информации». */
function applyInfoAddSectionHunk(text: string): string {
  const lines = text.split("\n");
  const bottom = lines.flatMap((line, index) => (line.trim() === INFO_BOTTOM_ADD_SECTION_LINE ? [index] : []));
  assert.equal(bottom.length, 1, "the file holds exactly one bottom add-section button of the «Информация» tab");
  const tabs = lines.flatMap((line, index) => (line.trim().startsWith(INFO_TABS_LINE_START) ? [index] : []));
  assert.equal(tabs.length, 1, "the file holds exactly one SectionTabs of the «Информация» tab");
  assert.ok(bottom[0] > tabs[0], "the bottom add-section button stands below the section tabs");
  const indent = /^[ \t]*/.exec(lines[tabs[0]])![0];
  // Сначала нижняя строка (она ниже вкладок), затем вставка: индекс вкладок не сдвигается.
  lines.splice(bottom[0], 1);
  lines.splice(tabs[0], 0, ...INFO_ADD_SECTION_BLOCK.map((line) => `${indent}${line}`));
  return lines.join("\n");
}

function replaceOnce(text: string, from: string, to: string, label: string): string {
  assert.equal(text.split(from).length - 1, 1, `${label}: exactly one approved anchor`);
  return text.replace(from, to);
}

/** PORTIA-22: шесть побайтных правок оболочки вкладки «Пользователи» (USR-01, USR-09). */
function applyUsersTabHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { AppDeniedPanel } from "@/components/portia-desktop-states";',
    'import { AppDeniedPanel } from "@/components/portia-desktop-states";\nimport { UsersTab, UsersTabCount, useUsersPendingCount } from "@/components/portia-users-tab";',
    "users import",
  );
  next = replaceOnce(
    next,
    'type EditorTab = "viruses" | "info" | "guide" | "broadcasts" | "recycle" | "search" | "assistant" | "employees" | "promo" | "access";',
    'type EditorTab = "viruses" | "info" | "guide" | "broadcasts" | "recycle" | "search" | "assistant" | "employees" | "users" | "promo" | "access";',
    "EditorTab users member",
  );
  next = replaceOnce(
    next,
    '  const tab: EditorTab = stripTabs.some(([id]) => id === pickedTab) ? pickedTab : stripTabs[0]?.[0] ?? pickedTab;',
    '  const tab: EditorTab = stripTabs.some(([id]) => id === pickedTab) ? pickedTab : stripTabs[0]?.[0] ?? pickedTab;\n  const usersPending = useUsersPendingCount({ enabled: openTabs.includes("users"), visible: active && !minimized, tabActive: tab === "users" });',
    "users pending hook",
  );
  next = replaceOnce(
    next,
    '{label}{unsaved && <i className="tab-dot" aria-hidden="true" />}',
    '{label}{id === "users" && <UsersTabCount count={usersPending.count} />}{unsaved && <i className="tab-dot" aria-hidden="true" />}',
    "users tab count",
  );
  next = replaceOnce(
    next,
    '    const historyTab = tab !== "employees" && tab !== "promo" && tab !== "access";',
    '    const historyTab = tab !== "employees" && tab !== "users" && tab !== "promo" && tab !== "access";',
    "users history exclusion",
  );
  return replaceOnce(
    next,
    '      {tab === "employees" && <EmployeeProfilesEditor onSaved={onEmployeeSaved} onRemoved={onEmployeeRemoved} uploadState={uploadState} uploadMessage={uploadMessage} onUpload={uploadImage} onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}',
    '      {tab === "employees" && <EmployeeProfilesEditor onSaved={onEmployeeSaved} onRemoved={onEmployeeRemoved} uploadState={uploadState} uploadMessage={uploadMessage} onUpload={uploadImage} onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}\n\n      {tab === "users" && openTabs.includes("users") && <UsersTab visible={active && !minimized} canManageEditors={canManageEditors} onPendingCount={usersPending.report} />}',
    "users tab body",
  );
}

/** PORTIA-24 (24-07): the shared LevelPicker in the editor, byte-exact edits of the sample (D-13, D-14, D-16, O-2). The Russian texts of the picker live in lib/level-copy.ts, not here. */
function applyLevelPickerHunk(text: string): string {
  let next = replaceOnce(text, "  findGuide,\n", "  LEVELED_APP_IDS,\n  findGuide,\n", "leveled app ids import");
  next = replaceOnce(
    next,
    'import { PromotionEditor } from "@/components/portia-promotion-editor";',
    'import { PromotionEditor } from "@/components/portia-promotion-editor";\nimport { LevelPicker } from "@/components/portia-level-picker";\nimport { levelCopy } from "@/lib/level-copy";',
    "level picker imports",
  );
  next = replaceOnce(
    next,
    '  scientistLogs: [\n    { id: makeId("log"), title: "ЗАПИСЬ 01", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""] },\n    { id: makeId("log"), title: "ЗАПИСЬ 02", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 4, content: [""] },\n  ],\n',
    "  scientistLogs: [],\n",
    "blank virus without records (D-14)",
  );
  const virusName = '<Field label="Название"><input value={selectedVirus.name} onChange={(event) => updateVirus((virus) => { virus.name = event.target.value; })} /></Field>';
  next = replaceOnce(
    next,
    virusName,
    `${virusName}\n                <LevelPicker name={\`level-virus-\${selectedVirus.id}\`} value={selectedVirus.level} onChange={(level) => updateVirus((virus) => { virus.level = level; })} />`,
    "virus level picker",
  );
  next = replaceOnce(
    next,
    '{selectedVirus.scientistLogs.length === 0 && <div className="editor-empty compact-empty">Записей учёных пока нет.</div>}',
    '{selectedVirus.scientistLogs.length === 0 && <p className="editor-guidance">{levelCopy.logsEmptyEditor}</p>}',
    "empty records line",
  );
  next = replaceOnce(
    next,
    '<Field label="Уровень доступа записи"><select value={log.lockedLevel} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].lockedLevel = Number(event.target.value); })}><option value={2}>II — доступна</option><option value={3}>III — заблокирована</option><option value={4}>IV — заблокирована</option></select></Field>',
    '<LevelPicker name={`level-log-${log.id}`} value={log.lockedLevel} onChange={(level) => updateVirus((virus) => { virus.scientistLogs[index].lockedLevel = level; })} />',
    "record level picker",
  );
  next = replaceOnce(next, 'lockedLevel: 3, content: [""], richContent', 'lockedLevel: 1, content: [""], richContent', "new record at level 1 (D-13)");
  return replaceOnce(
    next,
    '        <div className="editor-form flat-editor-form editor-card-columns">\n          <p className="editor-guidance">Каждый блок становится',
    '        <div className="editor-form flat-editor-form editor-card-columns">\n' +
      "          <EditorGroup title={levelCopy.appsGroup}>\n" +
      "            {LEVELED_APP_IDS.map((id) => <LevelPicker key={id} name={`level-app-${id}`} caption={levelCopy.appLabels[id]} value={draft.appLevels?.[id]} onChange={(level) => changeDraft((next) => { next.appLevels = { ...(next.appLevels ?? {}), [id]: level }; })} />)}\n" +
      "          </EditorGroup>\n" +
      '          <p className="editor-guidance">Каждый блок становится',
    "apps level group (O-2)",
  );
}

/** PORTIA-24 (24-08): the level picker with the hierarchy in «Информация» and «Справочник» (LVL-03, D-16, D-17). The Russian texts live in lib/level-copy.ts, not here. */
function applyLevelHierarchyHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { levelCopy } from "@/lib/level-copy";',
    'import { levelCopy } from "@/lib/level-copy";\nimport { effectiveLevel, raiseChildren } from "@/lib/level-hierarchy";',
    "level hierarchy import",
  );
  next = replaceOnce(
    next,
    '  const [selectedGuideSection, setSelectedGuideSection] = useState("");\n',
    '  const [selectedGuideSection, setSelectedGuideSection] = useState("");\n' +
      "  // D-17: the line under a parent's level group after its raise lifted children; it lasts until the next level change or another section.\n" +
      "  const [raisedNotice, setRaisedNotice] = useState<{ parentId: string; text: string } | null>(null);\n",
    "raised notice state",
  );
  next = replaceOnce(
    next,
    "  const infoTocItems: TocItem[] = draft.infoSections.filter(",
    "  // Derived reset, like the popover below: another section has no use for the line of the one left.\n" +
      "  if (raisedNotice && raisedNotice.parentId !== activeInfoSection && raisedNotice.parentId !== activeGuideSection) setRaisedNotice(null);\n" +
      "  const infoTocItems: TocItem[] = draft.infoSections.filter(",
    "raised notice derived reset",
  );
  const infoTitle = '              <Field label="Заголовок"><input value={section.title} onChange={(event) => changeDraft((next) => updateById(next.infoSections, section.id, (item) => { item.title = event.target.value; }))} /></Field>\n';
  next = replaceOnce(
    next,
    infoTitle,
    `${infoTitle}` +
      "              <LevelPicker name={`level-info-${section.id}`} value={section.level} notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined} onChange={(level) => {\n" +
      "                const raised = section.subsections.filter((child) => effectiveLevel(child.level, 1) < level).length;\n" +
      "                changeDraft((next) => updateById(next.infoSections, section.id, (item) => { item.level = level; raiseChildren(item.subsections, level); }));\n" +
      "                setRaisedNotice(raised > 0 ? { parentId: section.id, text: levelCopy.raisedSubsections(level, raised) } : null);\n" +
      "              }} />\n",
    "info section level picker",
  );
  const subTitle = '                    <Field label="Заголовок подраздела"><input maxLength={300} value={subsection.title} onChange={(event) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) target.title = event.target.value; })} /></Field>\n';
  next = replaceOnce(
    next,
    subTitle,
    `${subTitle}` +
      "                    <LevelPicker name={`level-sub-${subsection.id}`} min={effectiveLevel(section.level, 1)} value={subsection.level} onChange={(level) => { changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) target.level = level; }); setRaisedNotice(null); }} />\n",
    "info subsection level picker",
  );
  const guideTitle = '              <Field label="Заголовок раздела"><input maxLength={300} value={section.title} onChange={(event) => changeDraft((next) => updateById(next.guideSections, section.id, (item) => { item.title = event.target.value; }))} /></Field>\n';
  next = replaceOnce(
    next,
    guideTitle,
    `${guideTitle}` +
      "              <LevelPicker name={`level-guide-${section.id}`} value={section.level} notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined} onChange={(level) => {\n" +
      "                const raised = section.cards.filter((child) => effectiveLevel(child.level, 1) < level).length;\n" +
      "                changeDraft((next) => updateById(next.guideSections, section.id, (item) => { item.level = level; raiseChildren(item.cards, level); }));\n" +
      "                setRaisedNotice(raised > 0 ? { parentId: section.id, text: levelCopy.raisedCards(level, raised) } : null);\n" +
      "              }} />\n",
    "guide section level picker",
  );
  const cardTitle = '                    <Field label="Заголовок карточки"><input maxLength={300} value={card.title} onChange={(event) => changeDraft((next) => { const target = findGuide(next.guideSections, card.id)?.card; if (target) target.title = event.target.value; })} /></Field>\n';
  next = replaceOnce(
    next,
    cardTitle,
    `${cardTitle}` +
      "                    <LevelPicker name={`level-card-${card.id}`} min={effectiveLevel(section.level, 1)} value={card.level} onChange={(level) => { changeDraft((next) => { const target = findGuide(next.guideSections, card.id)?.card; if (target) target.level = level; }); setRaisedNotice(null); }} />\n",
    "guide card level picker",
  );
  // LVL-08, D-05: the viewer-shaped copy guard (no sync, no save, a block instead of the forms) and the saveNotice line (D-17).
  next = replaceOnce(
    next,
    "  saveError: string;\n};",
    "  saveError: string;\n" +
      "  // LVL-08, D-05: the content handed to the editor is the viewer-shaped copy. No sync, no rebase and no save until a full copy arrives; the draft stays.\n" +
      "  contentIncomplete?: boolean;\n" +
      "  // D-17: the desktop's line after the server lifted levels on save; shown in the save status area.\n" +
      "  saveNotice?: string;\n};",
    "incomplete and notice props",
  );
  next = replaceOnce(next, ", saveError }: Props) {", ", saveError, contentIncomplete, saveNotice }: Props) {", "incomplete and notice destructuring");
  next = replaceOnce(
    next,
    "    const syncTimer = window.setTimeout(() => {\n      if (!dirty) {",
    "    const syncTimer = window.setTimeout(() => {\n" +
      "      // LVL-08, D-05: a viewer-shaped copy is neither the base nor the draft; the next full copy syncs by the rules below.\n" +
      "      if (contentIncomplete) return;\n" +
      "      if (!dirty) {",
    "sync skips an incomplete copy",
  );
  next = replaceOnce(next, "  }, [content, dirty, revision, tab]);", "  }, [content, contentIncomplete, dirty, revision, tab]);", "sync dependencies");
  next = replaceOnce(
    next,
    "    if (accessFailed) return false;\n    // D-23",
    "    // LVL-08, D-05: the same for a copy with hidden records stubbed out; saving it would erase them.\n    if (accessFailed || contentIncomplete) return false;\n    // D-23",
    "save refuses an incomplete copy",
  );
  next = replaceOnce(
    next,
    "  // D-17: the window stays; nothing of the sections is rendered.\n",
    "  // LVL-08, D-05: a viewer-shaped copy shows no forms and nothing to save; the draft stays in memory until the full copy comes.\n" +
      "  if (contentIncomplete) {\n" +
      "    return (\n" +
      '      <div className="content-editor">\n' +
      "        {header}\n" +
      '        <div className="empty-state app-fatal-panel">\n' +
      '          <div className="app-state-reason" role="alert"><strong>{levelCopy.editorIncomplete.heading}</strong><span>{levelCopy.editorIncomplete.body}</span></div>\n' +
      "        </div>\n" +
      "        {closeAsked && (\n" +
      "          <ConfirmDialog\n" +
      '            title="Закрыть редактор?"\n' +
      '            text={`Не сохранено: ${shownChanged.map((id) => sectionLabels[id]).join(", ")}. ${levelCopy.editorIncomplete.heading}`}\n' +
      "            actions={[\n" +
      '              { label: "НЕ СОХРАНЯТЬ", tone: "danger", onClick: () => { setHandledCloseRequest(closeRequest); onCloseApproved(); } },\n' +
      '              { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setHandledCloseRequest(closeRequest) },\n' +
      "            ]}\n" +
      "            onCancel={() => setHandledCloseRequest(closeRequest)}\n" +
      "          />\n" +
      "        )}\n" +
      "      </div>\n" +
      "    );\n" +
      "  }\n" +
      "  // D-17: the window stays; nothing of the sections is rendered.\n",
    "incomplete copy block",
  );
  next = replaceOnce(
    next,
    'const chipVisible = dirty || saveState === "saving" || saveState === "saved";',
    'const chipVisible = dirty || saveState === "saving" || saveState === "saved" || !!saveNotice;',
    "chip shows with a notice",
  );
  return replaceOnce(
    next,
    "          <button type=\"button\" aria-label={chipLabel} title={`Не сохранено:",
    "          {saveNotice && <span className=\"editor-save-status saved\" role=\"status\">{saveNotice}</span>}\n          <button type=\"button\" aria-label={chipLabel} title={`Не сохранено:",
    "save notice line",
  );
}

/** PORTIA-25 (25-02; SEC-05, D-13, D-14): «change the address of a picture» beside the level picker. The requests live in lib/media-rewrite-client.ts and the button in components/portia-image-rewrite.tsx; the editor file only calls them and holds no new Russian text. */
function applyImageRewriteHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { effectiveLevel, raiseChildren } from "@/lib/level-hierarchy";',
    'import { effectiveLevel, raiseChildren } from "@/lib/level-hierarchy";\nimport { useImageRewrite } from "@/components/portia-image-rewrite";',
    "image rewrite import",
  );
  next = replaceOnce(
    next,
    "    try { run(); } finally { batchKey.current = null; }\n  };\n",
    "    try { run(); } finally { batchKey.current = null; }\n  };\n" +
      "  // Phase 25, D-13 / D-14: «change the address of a picture» after a level is raised; the requests live in lib/media-rewrite-client.ts.\n" +
      "  const rewrite = useImageRewrite(changeDraft);\n",
    "image rewrite hook",
  );
  next = replaceOnce(
    next,
    "<LevelPicker name={`level-virus-${selectedVirus.id}`} value={selectedVirus.level} onChange={(level) => updateVirus((virus) => { virus.level = level; })} />",
    "<LevelPicker name={`level-virus-${selectedVirus.id}`} value={selectedVirus.level} action={rewrite.action(`virus:${selectedVirus.id}`)} onChange={(level) => { rewrite.raised(`virus:${selectedVirus.id}`, \"virus\", selectedVirus.id, selectedVirus, effectiveLevel(selectedVirus.level, 1), level); updateVirus((virus) => { virus.level = level; }); }} />",
    "virus level picker offer",
  );
  // Task 2: the same offer beside the level pickers of the «Информация» and «Справочник» records; a section includes the pictures of its children.
  next = replaceOnce(
    next,
    "value={section.level} notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined} onChange={(level) => {\n                const raised = section.subsections.filter(",
    "value={section.level} notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined} action={rewrite.action(`info:${section.id}`)} onChange={(level) => {\n                rewrite.raised(`info:${section.id}`, \"info-section\", section.id, section, effectiveLevel(section.level, 1), level);\n                const raised = section.subsections.filter(",
    "info section offer",
  );
  next = replaceOnce(
    next,
    "min={effectiveLevel(section.level, 1)} value={subsection.level} onChange={(level) => { changeDraft(",
    "min={effectiveLevel(section.level, 1)} value={subsection.level} action={rewrite.action(`info:${subsection.id}`)} onChange={(level) => { rewrite.raised(`info:${subsection.id}`, \"info-subsection\", subsection.id, subsection, effectiveLevel(subsection.level, effectiveLevel(section.level, 1)), level); changeDraft(",
    "info subsection offer",
  );
  next = replaceOnce(
    next,
    "value={section.level} notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined} onChange={(level) => {\n                const raised = section.cards.filter(",
    "value={section.level} notice={raisedNotice?.parentId === section.id ? raisedNotice.text : undefined} action={rewrite.action(`guide:${section.id}`)} onChange={(level) => {\n                rewrite.raised(`guide:${section.id}`, \"guide-section\", section.id, section, effectiveLevel(section.level, 1), level);\n                const raised = section.cards.filter(",
    "guide section offer",
  );
  next = replaceOnce(
    next,
    "min={effectiveLevel(section.level, 1)} value={card.level} onChange={(level) => { changeDraft(",
    "min={effectiveLevel(section.level, 1)} value={card.level} action={rewrite.action(`guide:${card.id}`)} onChange={(level) => { rewrite.raised(`guide:${card.id}`, \"guide-card\", card.id, card, effectiveLevel(card.level, effectiveLevel(section.level, 1)), level); changeDraft(",
    "guide card offer",
  );
  return replaceOnce(
    next,
    '      dispatch({ type: "saved", normalized: outgoing, savedFrom, keep: refused.length ? wanted : undefined, rebase });\n',
    '      dispatch({ type: "saved", normalized: outgoing, savedFrom, keep: refused.length ? wanted : undefined, rebase });\n' +
      "      // D-13: only now that the server stored the record may the replaced files go; the server checks the references again.\n" +
      "      void rewrite.retire(outgoing);\n",
    "image retire after save",
  );
}

// PORTIA-26-06 (UI-04, D-12, D-13b): the floating save chip of the sample after PORTIA-24-08, removed whole (byte-exact).
const SAVE_CHIP_BLOCK: readonly string[] = [
  "      {chipVisible && (",
  "        <div",
  "          className=\"editor-save-chip\"",
  "          data-dirty={dirty || undefined}",
  "          data-blocked={alarm || undefined}",
  "          ref={chipRef}",
  "          onKeyDown={(event) => {",
  "            if (event.key !== \"Escape\" || !popoverOpen) return;",
  "            event.preventDefault();",
  "            event.stopPropagation();",
  "            setPopoverOpen(false);",
  "            chipRef.current?.querySelector<HTMLButtonElement>(\":scope > button\")?.focus();",
  "          }}",
  "        >",
  "          {saveNotice && <span className=\"editor-save-status saved\" role=\"status\">{saveNotice}</span>}",
  "          <button type=\"button\" aria-label={chipLabel} title={`Не сохранено: ${shownChanged.length}`} aria-expanded={popoverOpen} aria-haspopup=\"dialog\" aria-controls={popoverId} onClick={() => setPopoverOpen((open) => !open)}>{chipText}</button>",
  "          {popoverOpen && dirty && (",
  "            <div className=\"editor-save-popover\" id={popoverId} role=\"dialog\" aria-label=\"Несохранённые изменения\">",
  "              <strong>НЕ СОХРАНЕНО</strong>",
  "              <ul>{shownChanged.map((id) => <li key={id} title={sectionLabels[id]}>{sectionLabels[id]}</li>)}</ul>",
  "              {statusText && <span className={`editor-save-status ${status}`}>{statusText}</span>}",
  "              {status === \"error\" && saveError && <span className=\"editor-save-reason\">{saveError}</span>}",
  "              {oversize.length > 0 && <span className=\"editor-save-reason\">{oversizeMessage(oversize)}</span>}",
  "              {bodyMessage && <span className=\"editor-save-status error\">{bodyMessage}</span>}",
  "              {badQuest && <button type=\"button\" className=\"editor-save-fix\" onClick={() => { setPopoverOpen(false); revealCard(badQuest.id, \"endsAt\", \"quests\"); }}>{dateMessage}</button>}",
  "              <div className=\"editor-save-actions\">",
  "                <button type=\"button\" className=\"secondary-control editor-undo-step\" aria-label=\"Отменить последнее действие\" disabled={!history.past.length} onClick={() => step(\"undo\")}>↶</button>",
  "                <button type=\"button\" className=\"secondary-control\" disabled={!dirty} aria-disabled={saveState === \"saving\" || undefined} onClick={() => { if (saveState !== \"saving\") setDialog(\"discard\"); }}>ОТМЕНИТЬ</button>",
  "                <button type=\"button\" className=\"primary-control\" disabled={!dirty || saveBlocked} aria-disabled={saveState === \"saving\" || undefined} onClick={() => { if (saveState !== \"saving\") void save(); }}>СОХРАНИТЬ</button>",
  "              </div>",
  "            </div>",
  "          )}",
  "        </div>",
  "      )}",
];
// PORTIA-26-06: the derived values of the chip (visibility, popover reset, alarm, label, text) give way to one comment line.
const SAVE_CHIP_VALUES: readonly string[] = [
  "  // The chip stays while anything is unsaved, so a compact chip never hides unsaved work (D-09).",
  "  const chipVisible = dirty || saveState === \"saving\" || saveState === \"saved\" || !!saveNotice;",
  "  // Derived reset: the popover only lists unsaved sections, so it closes when the draft is clean.",
  "  if (popoverOpen && !dirty) setPopoverOpen(false);",
  "  // A blocked, failed or conflicting save turns the chip red, so a compact chip never hides a failed save (D-10).",
  "  const alarm = dirty && (saveBlocked || saveState === \"error\" || conflict || refusedShown.length > 0);",
  "  const chipLabel = saveState === \"saving\" ? saveStatusText(\"saving\")",
  "    : dirty ? `Не сохранено разделов: ${shownChanged.length}${alarm ? (saveBlocked ? \", сохранение невозможно\" : \", ошибка сохранения\") : \"\"}`",
  "    : saveStatusText(\"saved\");",
  "  const chipText = saveState === \"saving\" ? \"…\" : dirty ? `${alarm ? \"!\" : \"\"}${shownChanged.length}` : \"✓\";",
];
// PORTIA-26-06: the action bar under the tab strip; the three buttons are the chip's, byte for byte, and the reasons of its popover are lines under the bar.
const TAB_SHELL_BAR: readonly string[] = [
  "      {editorSections.some((section) => section === tab) && (",
  "        <EditorActionBar",
  "          label={sectionLabels[tab as EditorSection]}",
  "          statusText={statusText}",
  "          tone={status}",
  "          unsavedCount={dirty ? shownChanged.length : 0}",
  "          notice={saveNotice}",
  "          actions={<>",
  "            <button type=\"button\" className=\"secondary-control editor-undo-step\" aria-label=\"Отменить последнее действие\" disabled={!history.past.length} onClick={() => step(\"undo\")}>↶</button>",
  "            <button type=\"button\" className=\"secondary-control\" disabled={!dirty} aria-disabled={saveState === \"saving\" || undefined} onClick={() => { if (saveState !== \"saving\") setDialog(\"discard\"); }}>ОТМЕНИТЬ</button>",
  "            <button type=\"button\" className=\"primary-control\" disabled={!dirty || saveBlocked} aria-disabled={saveState === \"saving\" || undefined} onClick={() => { if (saveState !== \"saving\") void save(); }}>СОХРАНИТЬ</button>",
  "          </>}",
  "          messages={dirty ? [",
  "            status === \"error\" && saveError,",
  "            oversize.length > 0 && oversizeMessage(oversize),",
  "            bodyMessage,",
  "            badQuest && <button type=\"button\" className=\"editor-save-fix\" onClick={() => revealCard(badQuest.id, \"endsAt\", \"quests\")}>{dateMessage}</button>,",
  "          ] : []}",
  "        />",
  "      )}",
];

/** PORTIA-26-06 (26-06; UI-04, D-12, D-13b, D-21): the action bar from the tab shell replaces the floating save chip. No Russian text is added: the bar's own texts live in components/portia-editor-tab-shell.tsx. */
function applyTabShellHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { ArchivedVirusEditor, ClassificationField, ConfirmDialog, DossierTabs, EditorGroup, Field, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";\n',
    'import { ArchivedVirusEditor, ClassificationField, ConfirmDialog, DossierTabs, EditorGroup, Field, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";\n' +
      'import { EditorActionBar } from "@/components/portia-editor-tab-shell";\n',
    "tab shell import",
  );
  next = replaceOnce(
    next,
    "  const [popoverOpen, setPopoverOpen] = useState(false);\n  const chipRef = useRef<HTMLDivElement>(null);\n  const popoverId = useId();\n",
    "",
    "chip state",
  );
  next = replaceOnce(
    next,
    "  useEffect(() => {\n" +
      "    if (!popoverOpen) return;\n" +
      "    const away = (event: PointerEvent) => { if (!chipRef.current?.contains(event.target as Node)) setPopoverOpen(false); };\n" +
      '    document.addEventListener("pointerdown", away);\n' +
      '    return () => document.removeEventListener("pointerdown", away);\n' +
      "  }, [popoverOpen]);\n\n",
    "",
    "chip popover effect",
  );
  next = replaceOnce(
    next,
    `${SAVE_CHIP_VALUES.join("\n")}\n`,
    "  // Phase 26 (26-06, D-13b): the floating save chip is retired; the action bar of the draft tabs shows the status, the reasons and the buttons.\n",
    "chip values",
  );
  next = replaceOnce(next, "        })}\n      </nav>\n      {refusedShown.map(", `        })}\n      </nav>\n${TAB_SHELL_BAR.join("\n")}\n      {refusedShown.map(`, "action bar under the tab strip");
  return replaceOnce(next, `${SAVE_CHIP_BLOCK.join("\n")}\n`, "", "chip block");
}

/** PORTIA-26-06b (26-06 Task 2; UI-04, D-12): list/detail classes beside the old ones, the current row, the empty detail of the seam. No Russian text is added. */
function applyTabBodiesHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { EditorActionBar } from "@/components/portia-editor-tab-shell";',
    'import { EditorActionBar, EditorEmptyDetail } from "@/components/portia-editor-tab-shell";',
    "empty detail import",
  );
  // «База вирусов»: body, list, current row, detail and the empty detail when no row is picked.
  next = replaceOnce(
    next,
    '        <div className="virus-editor-layout" ref={layoutRef} data-mobile-view={recordOpen && selectedVirus ? "record" : "list"}>\n',
    '        <div className="virus-editor-layout etab-body" ref={layoutRef} data-mobile-view={recordOpen && selectedVirus ? "record" : "list"}>\n',
    "virus body",
  );
  next = replaceOnce(
    next,
    '          <aside className="editor-record-list">\n            <EditorToc items={virusTocItems}',
    '          <aside className="editor-record-list etab-list">\n            <EditorToc items={virusTocItems}',
    "virus list",
  );
  next = replaceOnce(
    next,
    '<button type="button" className={virus.id === selectedVirusId ? "active" : ""} onClick={() => openVirus(virus.id)}>',
    '<button type="button" className={virus.id === selectedVirusId ? "active" : ""} aria-current={virus.id === selectedVirusId ? "true" : undefined} onClick={() => openVirus(virus.id)}>',
    "virus current row",
  );
  next = replaceOnce(next, '<div className="editor-form virus-editor-form">', '<div className="editor-form virus-editor-form etab-detail">', "virus detail");
  next = replaceOnce(
    next,
    ') : <div className="editor-empty">Добавьте первую запись вируса.</div>}',
    ') : draft.viruses.length ? <EditorEmptyDetail /> : <div className="editor-empty">Добавьте первую запись вируса.</div>}',
    "virus empty detail",
  );
  // «Корзина»: body, list, current row and the file form as the detail (the archived virus is the detail in portia-editor-dossier.tsx).
  next = replaceOnce(next, '<div className="virus-editor-layout recycle-editor-layout" ref={layoutRef}', '<div className="virus-editor-layout recycle-editor-layout etab-body" ref={layoutRef}', "recycle body");
  next = replaceOnce(
    next,
    '          <aside className="editor-record-list">\n            <EditorToc items={recycleTocItems}',
    '          <aside className="editor-record-list etab-list">\n            <EditorToc items={recycleTocItems}',
    "recycle list",
  );
  next = replaceOnce(
    next,
    '<button type="button" className={(virus ? virus.id === shownRecycledVirusId : file!.id === shownRecycleFileId) ? "active" : ""} onClick={() => openRecycleEntry(key)}>',
    '<button type="button" className={(virus ? virus.id === shownRecycledVirusId : file!.id === shownRecycleFileId) ? "active" : ""} aria-current={(virus ? virus.id === shownRecycledVirusId : file!.id === shownRecycleFileId) ? "true" : undefined} onClick={() => openRecycleEntry(key)}>',
    "recycle current row",
  );
  next = replaceOnce(
    next,
    '            <div className="editor-form">\n              <p className="editor-guidance">Посетители могут',
    '            <div className="editor-form etab-detail">\n              <p className="editor-guidance">Посетители могут',
    "recycle file detail",
  );
  // «Рекомендации», «Помощник», «Доступ»: only the detail pane.
  next = replaceOnce(
    next,
    '        <div className="editor-form flat-editor-form">\n          <p className="editor-guidance">Введите варианты',
    '        <div className="editor-form flat-editor-form etab-detail">\n          <p className="editor-guidance">Введите варианты',
    "search detail",
  );
  next = replaceOnce(next, '<div className="editor-form flat-editor-form assistant-editor">', '<div className="editor-form flat-editor-form assistant-editor etab-detail">', "assistant detail");
  return replaceOnce(next, 'return <div className="editor-form flat-editor-form access-editor">', 'return <div className="editor-form flat-editor-form access-editor etab-detail">', "access detail");
}

// PORTIA-26-07 (UI-04, D-13a): the add-section bar and the section tabs of «Справочник», byte for byte; indents are relative (the body had them at 10 spaces, the nav slot at 12).
const GUIDE_NAV_BLOCK: readonly string[] = [
  "<SectionAddBar onCreate={(title) => {",
  '  const id = makeId("guide");',
  '  changeDraft((next) => { next.guideSections.push({ id, title: title || "НОВЫЙ РАЗДЕЛ", photo: "", cards: [] }); });',
  "  setSelectedGuideSection(id);",
  "  setOpen([id], true);",
  "  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#card-${id} > .nested-editor-body input`)?.focus());",
  "}} />",
  '<SectionTabs label="Разделы справочника" sections={draft.guideSections} activeId={activeGuideSection} onSelect={setSelectedGuideSection} onMove={(from, to) => changeDraft((next) => moveArrayItem(next.guideSections, from, to))} />',
];
const GUIDE_TOC_LINE = "<EditorToc items={guideTocItems} onJump={jumpGuide} onAll={(open) => setAllOpen(guideCardIds, open)} />";

function indented(lines: readonly string[], indent: string): string {
  return lines.map((line) => `${indent}${line}`).join("\n");
}

/** PORTIA-26-07 (26-07 Task 1; UI-04, D-13a, A2): «Справочник» switches sections in the nav slot of the bar; its body is the TOC on the left and the active section on the right. No Russian text is added. */
function applySectionNavHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { EditorActionBar, EditorEmptyDetail } from "@/components/portia-editor-tab-shell";',
    'import { EditorActionBar, EditorEmptyDetail, EditorTabBody } from "@/components/portia-editor-tab-shell";',
    "tab body import",
  );
  // SectionTabs: the current section is aria-current and is scrolled into view when it changes.
  next = replaceOnce(
    next,
    "  const activeIndex = sections.findIndex((section) => section.id === activeId);\n  return <div className=\"editor-section-tabs\">\n    <nav aria-label={label}>\n",
    "  const activeIndex = sections.findIndex((section) => section.id === activeId);\n" +
      "  const navRef = useRef<HTMLElement>(null);\n" +
      "  // D-13a: the current section stays in view of the bar's nav when it changes; instant unless the house motion switch is on.\n" +
      "  useEffect(() => {\n" +
      "    navRef.current?.querySelector<HTMLElement>('[aria-current=\"true\"]')?.scrollIntoView({ block: \"nearest\", inline: \"nearest\", behavior: document.documentElement.dataset.motion === \"full\" ? \"smooth\" : \"auto\" });\n" +
      "  }, [activeId]);\n" +
      "  return <div className=\"editor-section-tabs\">\n    <nav aria-label={label} ref={navRef}>\n",
    "section tabs ref and scroll",
  );
  next = replaceOnce(next, 'type="button" aria-pressed={section.id === activeId} onClick={() => onSelect(section.id)}>', 'type="button" aria-current={section.id === activeId ? "true" : undefined} onClick={() => onSelect(section.id)}>', "section tabs current");
  // The bar: the nav slot of «Справочник».
  next = replaceOnce(
    next,
    "          notice={saveNotice}\n          actions={<>\n",
    `          notice={saveNotice}\n          nav={tab === "guide" ? <>\n${indented(GUIDE_NAV_BLOCK, "            ")}\n          </> : undefined}\n          actions={<>\n`,
    "guide nav slot",
  );
  // The body: list = the TOC when it shows, detail = the old form.
  next = replaceOnce(
    next,
    '      {tab === "guide" && (\n        <div className="editor-form flat-editor-form editor-card-columns">\n',
    `      {tab === "guide" && (\n        <EditorTabBody list={guideTocItems.length >= 5 && ${GUIDE_TOC_LINE}} detail={\n        <div className="editor-form flat-editor-form editor-card-columns">\n`,
    "guide body open",
  );
  next = replaceOnce(next, `${indented(GUIDE_NAV_BLOCK, "          ")}\n          ${GUIDE_TOC_LINE}\n`, "", "guide nav out of the body");
  return replaceOnce(
    next,
    '          )} />\n        </div>\n      )}\n\n      {tab === "broadcasts" && (',
    '          )} />\n        </div>\n        } />\n      )}\n\n      {tab === "broadcasts" && (',
    "guide body close",
  );
}

const FRAMING_ATTRIBUTE = /\s(framing|framingBox|onFramingChange)=/;

/** Конец значения атрибута JSX, которое начинается в `start`: строка в кавычках или выражение `{…}` (скобки сбалансированы, строки и шаблоны пропускаются). */
function attributeValueEnd(line: string, start: number): number {
  const opener = line[start];
  if (opener === '"' || opener === "'") {
    const close = line.indexOf(opener, start + 1);
    assert.ok(close > start, "an attribute string is closed on the same line");
    return close + 1;
  }
  assert.equal(opener, "{", "an attribute value is a string or an expression");
  let depth = 0;
  for (let index = start; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' || char === "'" || char === "`") {
      let cursor = index + 1;
      while (cursor < line.length && line[cursor] !== char) cursor += line[cursor] === "\\" ? 2 : 1;
      index = cursor;
    } else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return assert.fail("an attribute expression is closed on the same line");
}

/** D-63: из строк, где стоит `<ImageEditorField`, убираются атрибуты кадра (вместе с одним пробелом перед ними). Остальные строки не трогаются. */
function stripFramingAttributes(text: string): string {
  return text.split("\n").map((line) => {
    if (!line.includes("<ImageEditorField")) return line;
    let result = line;
    for (let match = FRAMING_ATTRIBUTE.exec(result); match; match = FRAMING_ATTRIBUTE.exec(result)) {
      const valueStart = match.index + match[0].length;
      result = result.slice(0, match.index) + result.slice(attributeValueEnd(result, valueStart));
    }
    return result;
  }).join("\n");
}

/** Реестр одобренных правок (D-64): `apply` — порядок применения к образцу; `normalizeActual` — что вырезается из текущего файла перед сравнением. */
const approvedEditorEdits: readonly { id: string; apply: (text: string) => string; normalizeActual?: (text: string) => string }[] = [
  { id: "D-57", apply: applyLaunchButtonHunk },
  { id: "D-62", apply: applyInfoAddSectionHunk },
  { id: "D-63", apply: (text) => text, normalizeActual: stripFramingAttributes },
  { id: "PORTIA-24", apply: applyLevelPickerHunk },
  { id: "PORTIA-24-08", apply: applyLevelHierarchyHunk },
  { id: "PORTIA-22", apply: applyUsersTabHunk },
  { id: "PORTIA-25", apply: applyImageRewriteHunk },
  { id: "PORTIA-26-06", apply: applyTabShellHunk },
  { id: "PORTIA-26-06b", apply: applyTabBodiesHunk },
  { id: "PORTIA-26-07", apply: applySectionNavHunk },
];

function expectedEditor(sample: string): string {
  return approvedEditorEdits.reduce((text, edit) => edit.apply(text), sample);
}

/** Текущий файл так, как его видит охрана: без одобренных вставок, которые образцом не являются. */
function guardedActual(actual: string): string {
  return approvedEditorEdits.reduce((text, edit) => (edit.normalizeActual ? edit.normalizeActual(text) : text), actual);
}

/** D-58: русские строки в кавычках и тексты JSX (без комментариев), как множество. */
function russianTexts(code: string): Set<string> {
  const source = stripComments(code);
  const found = new Set<string>();
  const cyrillic = /[А-Яа-яЁё]/;
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    if (cyrillic.test(value)) found.add(value);
  }
  for (const match of source.matchAll(/>([^<>{}\n]*[А-Яа-яЁё][^<>{}\n]*)</g)) found.add(match[1].trim());
  return found;
}

function firstDifference(expected: string, actual: string): string | null {
  if (expected === actual) return null;
  const left = expected.split("\n");
  const right = actual.split("\n");
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return `line ${index + 1}: expected ${JSON.stringify(left[index])}, got ${JSON.stringify(right[index])}`;
  }
  return "files differ";
}

function textSetDifference(expected: Set<string>, actual: Set<string>): string | null {
  const added = [...actual].filter((text) => !expected.has(text));
  const missing = [...expected].filter((text) => !actual.has(text));
  if (added.length === 0 && missing.length === 0) return null;
  return `added ${JSON.stringify(added)}, missing ${JSON.stringify(missing)}`;
}

function currentEditor(): string {
  return toLf(readFileSync(new URL(`../${EDITOR_PATH}`, import.meta.url), "utf8"));
}

test("D-57: the editor renders the shared launch button", () => {
  const editor = currentEditor();
  const code = stripComments(editor);
  assert.match(code, /<FormatLaunchButton target=\{formatTarget\} open=\{formatterOpen\}/);
  assert.doesNotMatch(code, /className="global-format-launch"/);
  assert.doesNotMatch(code, /Оформление текста: /);
  assert.doesNotMatch(code, /aria-label=\{formatTarget \?/);
  const imported = /import\s*\{([^}]*)\}\s*from\s*"@\/components\/portia-editor-rich-text"/.exec(code)?.[1] ?? "";
  assert.ok(imported.split(",").map((name) => name.trim()).includes("FormatLaunchButton"), "FormatLaunchButton comes from the rich text module");
});

test("D-62: the «Информация» tab starts with the add-section bar and has no add-section button below the columns", () => {
  const code = stripComments(currentEditor());
  const start = code.indexOf('{tab === "info" && (');
  const end = code.indexOf('{tab === "guide" && (');
  assert.ok(start > 0 && end > start, "the «Информация» tab block is found");
  const info = code.slice(start, end);
  const bar = info.indexOf("<SectionAddBar");
  const tabs = info.indexOf(INFO_TABS_LINE_START);
  assert.ok(bar >= 0 && tabs > bar, "SectionAddBar stands above the section tabs");
  assert.equal(info.split("+ ДОБАВИТЬ РАЗДЕЛ</button>").length - 1, 0, "no add-section button below the columns");
  assert.ok(info.includes("+ ПОДРАЗДЕЛ</button>"), "the add-subsection button stays at the bottom of the section card");
});

test("D-64: portia-editor.tsx differs from 449c756 only by the approved edits (D-57 launch button, D-62 «Информация» add-section, D-63 frame attributes)", () => {
  const sample = readSampleEditor();
  const expected = expectedEditor(sample);
  const actual = guardedActual(currentEditor());
  assert.equal(firstDifference(expected, actual), null, "components/portia-editor.tsx may differ from the sample only by the approved edits (D-57, D-62, D-63); extend the registry for any new approved edit");
});

test("D-58: the set of Russian texts of the editor file equals the sample's after the approved edits", () => {
  const sample = readSampleEditor();
  const expected = russianTexts(expectedEditor(sample));
  assert.ok(expected.size > 100, `the sample holds many Russian texts (${expected.size})`);
  assert.equal(textSetDifference(expected, russianTexts(currentEditor())), null, "D-58 forbids changing hints and texts in the editor file");
});

test("D-64: the guard notices any other edit, a missing hunk, a changed text and an unreadable sample", () => {
  const sample = readSampleEditor();
  const expected = expectedEditor(sample);
  const lines = expected.split("\n");
  const touched = lines.slice();
  touched[touched.length - 2] = `${touched[touched.length - 2]} // stray edit`;
  assert.notEqual(firstDifference(expected, touched.join("\n")), null, "one extra changed line is a difference");
  assert.notEqual(firstDifference(expected, `${expected}\n`), null, "an extra trailing line is a difference");
  assert.throws(() => applyLaunchButtonHunk(expected), /exactly one inline launch button block/, "a file without the inline block cannot be turned into the expected one");
  assert.throws(() => applyInfoAddSectionHunk(expected), /exactly one bottom add-section button/, "a file without the bottom button cannot be turned into the expected one");
  // Без правки D-62 (только D-57) файл отличается от ожидаемого.
  assert.notEqual(firstDifference(expected, applyLaunchButtonHunk(sample)), null, "a file without the D-62 hunk is a difference");
  const withoutUsers = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-22").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutUsers), null, "a file without the PORTIA-22 hunk is a difference");
  const withoutLevels = approvedEditorEdits.filter((edit) => !edit.id.startsWith("PORTIA-24") && edit.id !== "PORTIA-25" && !edit.id.startsWith("PORTIA-26")).reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutLevels), null, "a file without the PORTIA-24 hunk is a difference");
  const withoutHierarchy = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-24-08" && edit.id !== "PORTIA-25" && !edit.id.startsWith("PORTIA-26")).reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutHierarchy), null, "a file without the PORTIA-24-08 hunk is a difference");
  const withoutRewrite = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-25").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutRewrite), null, "a file without the PORTIA-25 hunk is a difference");
  const withoutTabShell = approvedEditorEdits.filter((edit) => !edit.id.startsWith("PORTIA-26")).reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutTabShell), null, "a file without the PORTIA-26-06 hunk is a difference");
  assert.throws(() => applyTabShellHunk(expected), /exactly one approved anchor/, "the tab shell hunk cannot be applied twice");
  const withoutTabBodies = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-06b" && !edit.id.startsWith("PORTIA-26-07")).reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutTabBodies), null, "a file without the PORTIA-26-06b hunk is a difference");
  assert.throws(() => applyTabBodiesHunk(expected), /exactly one approved anchor/, "the tab bodies hunk cannot be applied twice");
  const withoutSectionNav = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-07").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutSectionNav), null, "a file without the PORTIA-26-07 hunk is a difference");
  assert.throws(() => applySectionNavHunk(expected), /exactly one approved anchor/, "the section nav hunk cannot be applied twice");
  // Изменённая подсказка (D-58) ловится по набору русских строк.
  const hint = "Каждый блок становится отдельным разделом приложения «Информация».";
  assert.ok(expected.includes(hint), "the fixture hint is in the sample");
  const reworded = expected.replace(hint, "Каждый блок становится отдельным разделом.");
  assert.notEqual(textSetDifference(russianTexts(expected), russianTexts(reworded)), null, "a changed hint changes the set of Russian texts");
  const extra = expected.replace("<SectionAddBar onCreate", '<p className="editor-guidance">Новая подсказка.</p><SectionAddBar onCreate');
  assert.notEqual(textSetDifference(russianTexts(expected), russianTexts(extra)), null, "an added text changes the set of Russian texts");
});

const IMAGE_FIELD_LINE = '<ImageEditorField label="Фото раздела" value={section.photo} placement="guide" maxHint="За заголовком" uploadState={uploadState} onChange={(value) => changeDraft((next) => { item.photo = value; })}';
const FRAMING_ATTRIBUTES_LINE = ' framing={section.photoFraming} framingBox="band" onFramingChange={(frame) => changeDraft((next) => updateById(next.guideSections, section.id, (item) => { if (frame) item.photoFraming = frame; else delete item.photoFraming; }))}';

test("D-63: the guard cuts the three frame attributes out of an ImageEditorField line and nothing else", () => {
  assert.equal(stripFramingAttributes(`${IMAGE_FIELD_LINE}${FRAMING_ATTRIBUTES_LINE} />`), `${IMAGE_FIELD_LINE} />`, "a framed line equals the plain line (nested braces, arrows and strings inside the attribute)");
  assert.equal(stripFramingAttributes(`${IMAGE_FIELD_LINE}${FRAMING_ATTRIBUTES_LINE}`), IMAGE_FIELD_LINE, "the attributes may end the line (a field that goes on in the next lines)");
  assert.equal(stripFramingAttributes(`${IMAGE_FIELD_LINE} framingBox="band" />`), `${IMAGE_FIELD_LINE} />`, "a string attribute is cut too");
  assert.equal(stripFramingAttributes(IMAGE_FIELD_LINE), IMAGE_FIELD_LINE, "a line without the attributes is untouched");
});

test("D-63: the guard notices a frame attribute outside an ImageEditorField line, a changed rest of the line and a new Russian text", () => {
  const plain = `<div>
  ${IMAGE_FIELD_LINE} />
</div>`;
  const stray = `<div framing={section.photoFraming}>
  ${IMAGE_FIELD_LINE} />
</div>`;
  assert.notEqual(firstDifference(plain, stripFramingAttributes(stray)), null, "an attribute on another element stays and is a difference");
  const nextLine = `<div>
  ${IMAGE_FIELD_LINE}
    framing={section.photoFraming} />
</div>`;
  assert.notEqual(firstDifference(plain, stripFramingAttributes(nextLine)), null, "an attribute on the next line of the field is a difference: it must stand on the line with the tag");
  const changed = `<div>
  ${IMAGE_FIELD_LINE.replace('maxHint="За заголовком"', 'maxHint="За заголовком раздела"')}${FRAMING_ATTRIBUTES_LINE} />
</div>`;
  assert.notEqual(firstDifference(plain, stripFramingAttributes(changed)), null, "a changed rest of the line is a difference even next to the frame attributes");
  const russian = `<div>
  ${IMAGE_FIELD_LINE}${FRAMING_ATTRIBUTES_LINE.replace("onFramingChange={(frame) =>", 'onFramingChange={(frame) => console.log("Новый текст") ||')} />
</div>`;
  assert.equal(firstDifference(plain, stripFramingAttributes(russian)), null, "the line check alone lets a text inside the attribute through …");
  assert.notEqual(textSetDifference(russianTexts(plain), russianTexts(russian)), null, "… and the D-58 set of Russian texts catches it");
});

test("D-63: the «Справочник» section photo field of the editor carries the frame attributes", () => {
  const lines = currentEditor().split("\n").filter((line) => line.includes("<ImageEditorField") && line.includes('label="Фото раздела"'));
  assert.equal(lines.length, 1, "one section photo field");
  assert.match(lines[0], /\sframing=\{section\.photoFraming\}/);
  assert.match(lines[0], /\sframingBox="band"/);
  assert.match(lines[0], /\sonFramingChange=\{/);
});
