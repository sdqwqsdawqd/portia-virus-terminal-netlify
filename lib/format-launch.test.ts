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
//      текущего раздела, тело — оглавление слева и активный раздел справа (applySectionNavHunk); PORTIA-26-07b — то же для «Информации»
//      (смысл D-62 сохранён: «+ ДОБАВИТЬ РАЗДЕЛ» перед вкладками разделов, нижней кнопки нет) и «Сводки» («Новости»/«Квесты» с aria-current и плашкой
//      счётчика) (applyInfoBroadcastNavHunk); PORTIA-26-07c — своя панель «Сотрудников» (кнопка сохранения профиля и статус переехали в неё),
//      классы etab-* и aria-current у выбранного сотрудника (applyEmployeesBarHunk). Источник одобрения: 26-CONTEXT D-12, D-13, D-21 и план 26-07.
//  11. PORTIA-26-13 (26-13; UI-10, WCAG 2.5.3, D-21) — имя кнопки раскрытия карточки строит cardToggleName (имя содержит видимый «{метка} {название}»),
//      между <strong> и названием пробельный узел {" "} (applyCardToggleNameHunk); русские строки имени лежат в lib/card-toggle-name.ts. Источник одобрения: 26-CONTEXT D-11, D-21 и план 26-13.
//  12. PORTIA-26-R01 (код-ревью 26, WR-01; UI-04, D-13b, D-21) — общий черновик виден и сохраняется на вкладках вне вкладок черновика:
//      кнопки и причины панели стали константами draftActions/draftMessages, EditorDraftBarContext.Provider оборачивает «Сотрудников», «Пользователей», «Повышение» и «Доступ»
//      (applyReviewDraftBarHunk); русских строк в файле не добавлено, подпись строки лежит в шве. Источник одобрения: 26-REVIEW WR-01 и поручение владельца исправить все предупреждения.
//  13. PORTIA-26-R05 (код-ревью 26, WR-05; UI-04, D-13b, D-21) — скрытая строка статуса (sr-only, живая область) остаётся только на вкладках не из черновика: на вкладках черновика
//      статус панели и есть единственная живая область (applyReviewLiveRegionHunk); русских строк не добавлено. Источник одобрения: 26-REVIEW WR-05 и поручение владельца исправить все предупреждения.
//  14. PORTIA-26-G05 (26-18; UI-04, D-13a, D-21) — вкладки разделов «Справочника» и «Информации» (общий SectionTabs) несут ручку OrderDragHandle, как подразделы;
//      кнопки-стрелки порядка «←/→» после вкладок убраны вместе с их надписями (applySectionDragHunk); русских строк не добавлено: надпись ручки берёт литерал «раздел»,
//      который в файле уже есть. Источник одобрения: 26-UAT gap 5 (2026-11-16, владелец: «перетаскивание пропало») и план 26-18.
//  15. PORTIA-26-G04 (26-18; UI-04, UI-06, D-21) — активный раздел «Справочника» и «Информации» стоит в обёртке div.editor-section-single (на все колонки формы),
//      а не в колонке сетки SectionColumns по 340px: открывающая строка и закрытие `)} />` -> `))}</div>` у обоих списков (applySectionWidthHunk); тело карточки раздела не тронуто;
//      русских строк не добавлено. Источник одобрения: 26-UAT gap 4 (2026-11-16, владелец: «пипец как мало места») и план 26-18.
//  16. PORTIA-26-G10 (26-18; UI-04, D-21) — вкладка вирусов: кнопка «ПЕРЕМЕСТИТЬ В КОРЗИНУ» переехала из низа формы в верхнюю строку записи div.virus-editor-head
//      рядом с вкладками досье (applyRecycleButtonHunk); разметка кнопки и обработчик те же, русская надпись переносится, а не добавляется (набор строк D-58 тот же).
//      Источник одобрения: 26-UAT gap 10 (2026-11-16, владелец: кнопка «в странном месте») и план 26-18.
//  17. PORTIA-26.1-EMP (26.1-02; OWN-07, D-21) — «Сотрудники»: функция EmployeeProfilesEditor с detailsOf переехала в шов components/portia-editor-employees.tsx
//      (черновики по id, один вопрос только при закрытии окна); в редакторе остались импорт шва, хранилище useEmployeeDraftStore() рядом с employeeDirty,
//      проп drafts у вызова вкладки и сброс хранилища, когда владелец закрыл раздел (applyEmployeesSeamHunk); русских строк не добавлено, строки функции переехали вместе с ней
//      (D-58 берёт ожидаемый набор из образца после этой правки). Источник одобрения: 26.1-OWNER-REQUEST OWN-07 (2026-11-20, «правка нескольких биографий подряд без обязательного сохранения») и план 26.1-02.
//  18. PORTIA-26.1-EMP2 (26.1-02 Task 2; OWN-07, D-21) — вопрос о несохранённых сотрудниках задаётся только при закрытии окна: уход с вкладки «Сотрудники» ничего не спрашивает,
//      состояние ожидающей вкладки leaveTo и её ветка убраны; при закрытии с несохранёнными черновиками с другой вкладки редактор сам переходит на «Сотрудники», где шов задаёт вопрос
//      (applyEmployeesCloseHunk); русских строк не добавлено (вопрос и его кнопки лежат в шве). Источник одобрения: 26.1-OWNER-REQUEST OWN-07 («Сохранить?» только при закрытии) и план 26.1-02.
//  19. PORTIA-26.1-HOLD (26.1-08; OWN-09, D-21) — столбцы таблицы переставляются удержанием заголовка, ручки ≡ нет: функция ColumnSwapHandle (с комментарием над ней) переехала в шов
//      components/portia-editor-dossier.tsx, редактор только импортирует её оттуда (applyColumnSwapSeamHunk); вызовы в TableBlockEditor не менялись, русская подпись «Переставить столбец…»
//      переехала вместе с функцией (D-58 берёт ожидаемый набор из образца после этой правки). Источник одобрения: 26.1-OWNER-REQUEST OWN-09 (2026-11-20, «убрать ручки везде») и план 26.1-08.
//  20. PORTIA-26.1-TABS (26.1-09 Task 1; OWN-10, D-21) — карточки раздела «Справочника» — вкладки-полоски слева направо, как разделы; под ними только выбранная карточка, новая карточка
//      выбирается сразу, переход из оглавления выбирает вкладку (applyGuideCardTabsHunk): импорт шва components/portia-editor-card-tabs.tsx, хук useCardTabSelection, строка CardTabs
//      перед списком карточек и фильтр map по выбранной карточке; русских строк не добавлено (подписи вкладок лежат в шве, cardTabsCopy). Источник одобрения: 26.1-OWNER-REQUEST OWN-10
//      (2026-11-20, «карточки внутри раздела — вкладками, слева направо, как разделы») и план 26.1-09.
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

// PORTIA-26-07b (UI-04, D-13a, D-62): the section tabs line and the TOC line of «Информация», byte for byte.
const INFO_TABS_LINE = '<SectionTabs label="Разделы информации" sections={draft.infoSections} activeId={activeInfoSection} onSelect={setSelectedInfoSection} onMove={(from, to) => changeDraft((next) => moveArrayItem(next.infoSections, from, to))} />';
const INFO_TOC_LINE = "<EditorToc items={infoTocItems} onJump={jumpInfo} onAll={(open) => setAllOpen(infoCardIds, open)} />";
const BROADCAST_TOC_LINE = "<EditorToc items={broadcastTocItems} onJump={(id) => { openBroadcast(id); jumpToCard(id); }} onAll={(open) => setAllOpen(broadcastTocItems.map((item) => item.id), open)} />";
// The «Сводка» group nav before and after: aria-pressed gives way to aria-current, the count becomes a plaque after the label.
const BROADCAST_NAV_BLOCK: readonly string[] = [
  '<nav className="editor-tabs dossier-tabs" aria-label="Разделы сводки">',
  '  {([["news", "Новости"], ["quests", "Квесты"]] as const).map(([id, label]) => (',
  '    <button key={id} type="button" className={broadcastEditorTab === id ? "active" : ""} aria-pressed={broadcastEditorTab === id} onClick={() => selectBroadcastTab(id)}>',
  "      {label} {draft.broadcasts.filter((item) => broadcastTabOf(item.type) === id).length}",
  "    </button>",
  "  ))}",
  "</nav>",
];
const BROADCAST_NAV_SLOT: readonly string[] = [
  '<nav className="editor-tabs dossier-tabs" aria-label="Разделы сводки">',
  '  {([["news", "Новости"], ["quests", "Квесты"]] as const).map(([id, label]) => (',
  '    <button key={id} type="button" className={broadcastEditorTab === id ? "active" : ""} aria-current={broadcastEditorTab === id ? "true" : undefined} onClick={() => selectBroadcastTab(id)}>',
  '      {label} <span className="tab-count">{draft.broadcasts.filter((item) => broadcastTabOf(item.type) === id).length}</span>',
  "    </button>",
  "  ))}",
  "</nav>",
];

/** PORTIA-26-07b (26-07 Task 2; UI-04, D-13a, D-62, A2): «Информация» and «Сводка» switch sections in the nav slot of the bar; their bodies are the TOC on the left and the old form on the right. No Russian text is added. */
function applyInfoBroadcastNavHunk(text: string): string {
  const infoNav = [...INFO_ADD_SECTION_BLOCK, INFO_TABS_LINE];
  let next = replaceOnce(
    text,
    "          </> : undefined}\n          actions={<>\n",
    `          </> : tab === "info" ? <>\n${indented(infoNav, "            ")}\n          </> : tab === "broadcasts" ? (\n${indented(BROADCAST_NAV_SLOT, "            ")}\n          ) : undefined}\n          actions={<>\n`,
    "info and broadcast nav slot",
  );
  // «Информация»: list = the TOC when it shows, detail = the old form; the add bar and the tabs leave the body (D-62 keeps its meaning in the nav).
  next = replaceOnce(
    next,
    '      {tab === "info" && (\n        <div className="editor-form flat-editor-form editor-card-columns">\n',
    `      {tab === "info" && (\n        <EditorTabBody list={infoTocItems.length >= 5 && ${INFO_TOC_LINE}} detail={\n        <div className="editor-form flat-editor-form editor-card-columns">\n`,
    "info body open",
  );
  next = replaceOnce(next, `${indented(infoNav, "          ")}\n          ${INFO_TOC_LINE}\n`, "", "info nav out of the body");
  next = replaceOnce(
    next,
    '          )} />\n        </div>\n      )}\n\n      {tab === "guide" && (',
    '          )} />\n        </div>\n        } />\n      )}\n\n      {tab === "guide" && (',
    "info body close",
  );
  // «Сводка»: the same body; the group nav leaves it.
  next = replaceOnce(
    next,
    '      {tab === "broadcasts" && (\n        <div className="editor-form flat-editor-form editor-card-columns">\n',
    `      {tab === "broadcasts" && (\n        <EditorTabBody list={broadcastTocItems.length >= 5 && ${BROADCAST_TOC_LINE}} detail={\n        <div className="editor-form flat-editor-form editor-card-columns">\n`,
    "broadcast body open",
  );
  next = replaceOnce(next, `${indented(BROADCAST_NAV_BLOCK, "          ")}\n          ${BROADCAST_TOC_LINE}\n`, "", "broadcast nav out of the body");
  return replaceOnce(
    next,
    '          <div className="broadcast-entry-list">{shownBroadcasts.map(renderBroadcastCard)}</div>\n        </div>\n      )}\n',
    '          <div className="broadcast-entry-list">{shownBroadcasts.map(renderBroadcastCard)}</div>\n        </div>\n        } />\n      )}\n',
    "broadcast body close",
  );
}

// PORTIA-26-07c (UI-04, D-12): the save line under the employee profile, byte for byte; its status and buttons move into the bar.
const EMPLOYEE_SAVE_LINE = '      <div className="employee-editor-save"><span className={`editor-save-status ${saveStatus}`}>{saveStatus === "saving" ? saveStatusText("saving") : saveStatus === "saved" ? saveStatusText("saved") : state === "error" ? errorMessage : "ТОЛЬКО ДЛЯ РЕДАКТОРОВ"}</span>{state === "error" && errorMessage.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}<button className="primary-control" type="button" disabled={state === "saving"} onClick={() => void save()}>СОХРАНИТЬ ПРОФИЛЬ</button></div>\n';
const EMPLOYEE_BAR: readonly string[] = [
  "  return <>",
  "    <EditorActionBar",
  '      label={tabRegistry.find((entry) => entry.id === "employees")?.label ?? ""}',
  '      statusText={selected && draft ? (saveStatus === "saving" ? saveStatusText("saving") : saveStatus === "saved" ? saveStatusText("saved") : state === "error" ? errorMessage : "ТОЛЬКО ДЛЯ РЕДАКТОРОВ") : ""}',
  "      tone={saveStatus}",
  '      actions={selected && draft ? <>{state === "error" && errorMessage.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}<button className="primary-control" type="button" disabled={state === "saving"} onClick={() => void save()}>СОХРАНИТЬ ПРОФИЛЬ</button></> : undefined}',
  "    />",
];

/** PORTIA-26-07c (26-07 Task 3; UI-04, D-12): «Сотрудники» get their own action bar (the profile save and its status), the list/detail classes and the current row. No Russian text is added. */
function applyEmployeesBarHunk(text: string): string {
  let next = replaceOnce(
    text,
    '  return <div className="virus-editor-layout employee-editor-layout" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>\n',
    `${EMPLOYEE_BAR.join("\n")}\n    <div className="virus-editor-layout employee-editor-layout etab-body" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>\n`,
    "employee bar and body",
  );
  next = replaceOnce(
    next,
    '    <aside className="editor-record-list">\n      {employees.map((employee) => <button key={employee.id} type="button" className={employee.id === selected?.id ? "active" : ""} onClick={() => chooseEmployee(employee)}>',
    '    <aside className="editor-record-list etab-list">\n      {employees.map((employee) => <button key={employee.id} type="button" className={employee.id === selected?.id ? "active" : ""} aria-current={employee.id === selected?.id ? "true" : undefined} onClick={() => chooseEmployee(employee)}>',
    "employee list and current row",
  );
  next = replaceOnce(next, '    <div className="editor-form employee-profile-editor">\n', '    <div className="editor-form employee-profile-editor etab-detail">\n', "employee detail");
  next = replaceOnce(next, EMPLOYEE_SAVE_LINE, "", "employee save line into the bar");
  return replaceOnce(next, "  </div>;\n}\n\ntype TabLists", "  </div>\n  </>;\n}\n\ntype TabLists", "employee fragment close");
}

/** PORTIA-26-13 (26-13 Task 1; UI-10, WCAG 2.5.3, D-21): the toggle of CollapsibleCard is named by cardToggleName (the name holds the visible «{label} {title}»), a whitespace node separates the label and the title. No Russian text is added: the name's strings live in lib/card-toggle-name.ts. */
function applyCardToggleNameHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { ArchivedVirusEditor, ClassificationField, ConfirmDialog, DossierTabs, EditorGroup, Field, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";\n',
    'import { ArchivedVirusEditor, ClassificationField, ConfirmDialog, DossierTabs, EditorGroup, Field, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";\nimport { cardToggleName } from "@/lib/card-toggle-name";\n',
    "card toggle name import",
  );
  next = replaceOnce(next, "  const bodyId = useId();\n  const name = title || label;\n", "  const bodyId = useId();\n", "card toggle old name rule");
  next = replaceOnce(
    next,
    ' aria-label={`${open ? "Свернуть" : "Развернуть"} раздел «${name}»`} onClick={onToggle}>\n          <strong>{label}</strong>\n',
    ' aria-label={cardToggleName(open, label, title)} onClick={onToggle}>\n          <strong>{label}</strong>{" "}\n',
    "card toggle name and space",
  );
  return next;
}

/**
 * PORTIA-26-R01 (review WR-01; UI-04, D-13b, D-21): the shared draft stays visible and savable on the tabs outside the draft tabs.
 * The buttons and the reasons of the draft bar become two constants used by that bar and by EditorDraftBarContext; the provider wraps the
 * tabs without a draft bar of their own. No Russian text is added: the label of the row lives in components/portia-editor-tab-shell.tsx.
 */
function applyReviewDraftBarHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { EditorActionBar, EditorEmptyDetail, EditorTabBody } from "@/components/portia-editor-tab-shell";',
    'import { EditorActionBar, EditorDraftBar, EditorDraftBarContext, EditorEmptyDetail, EditorTabBody, type EditorDraftBarState } from "@/components/portia-editor-tab-shell";',
    "draft bar import",
  );
  next = replaceOnce(
    next,
    "  const statusText = saveStatusText(status, partial ?? undefined);\n",
    [
      "  const statusText = saveStatusText(status, partial ?? undefined);",
      "  // Review WR-01: the draft is shared by every tab. The draft tabs have the bar below; on any other tab the same buttons and reasons go through EditorDraftBarContext into that tab's bar.",
      "  const draftActions = <>",
      '    <button type="button" className="secondary-control editor-undo-step" aria-label="Отменить последнее действие" disabled={!history.past.length} onClick={() => step("undo")}>↶</button>',
      '    <button type="button" className="secondary-control" disabled={!dirty} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") setDialog("discard"); }}>ОТМЕНИТЬ</button>',
      '    <button type="button" className="primary-control" disabled={!dirty || saveBlocked} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") void save(); }}>СОХРАНИТЬ</button>',
      "  </>;",
      "  const draftMessages = dirty ? [",
      "    status === \"error\" && saveError,",
      "    oversize.length > 0 && oversizeMessage(oversize),",
      "    bodyMessage,",
      '    badQuest && <button type="button" className="editor-save-fix" onClick={() => revealCard(badQuest.id, "endsAt", "quests")}>{dateMessage}</button>,',
      "  ] : [];",
      "  const draftBar: EditorDraftBarState | null = !editorSections.some((section) => section === tab) && (dirty || saveState !== \"idle\")",
      "    ? { statusText, tone: status, unsavedCount: dirty ? shownChanged.length : 0, notice: saveNotice, actions: draftActions, messages: draftMessages }",
      "    : null;",
      "",
    ].join("\n"),
    "draft bar constants",
  );
  next = replaceOnce(
    next,
    `${TAB_SHELL_BAR.slice(7, 18).join("\n")}\n`,
    "          actions={draftActions}\n          messages={draftMessages}\n",
    "draft bar actions and reasons",
  );
  return replaceOnce(
    next,
    [
      '      {tab === "employees" && <EmployeeProfilesEditor onSaved={onEmployeeSaved} onRemoved={onEmployeeRemoved} uploadState={uploadState} uploadMessage={uploadMessage} onUpload={uploadImage} onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}',
      "",
      '      {tab === "users" && openTabs.includes("users") && <UsersTab visible={active && !minimized} canManageEditors={canManageEditors} onPendingCount={usersPending.report} />}',
      "",
      '      {tab === "promo" && openTabs.includes("promo") && <PromotionEditor visible={active && !minimized} canManageEditors={canManageEditors} />}',
      "",
      '      {tab === "access" && canManageEditors && <EditorAccessManager />}',
      "",
    ].join("\n"),
    [
      "      <EditorDraftBarContext.Provider value={draftBar}>",
      '        {tab === "employees" && <EmployeeProfilesEditor onSaved={onEmployeeSaved} onRemoved={onEmployeeRemoved} uploadState={uploadState} uploadMessage={uploadMessage} onUpload={uploadImage} onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}',
      "",
      '        {tab === "users" && openTabs.includes("users") && <UsersTab visible={active && !minimized} canManageEditors={canManageEditors} onPendingCount={usersPending.report} />}',
      "",
      '        {tab === "promo" && openTabs.includes("promo") && <PromotionEditor visible={active && !minimized} canManageEditors={canManageEditors} />}',
      "",
      '        {tab === "access" && canManageEditors && <EditorDraftBar />}',
      "      </EditorDraftBarContext.Provider>",
      "",
      '      {tab === "access" && canManageEditors && <EditorAccessManager />}',
      "",
    ].join("\n"),
    "draft bar provider",
  );
}

/**
 * PORTIA-26-R05 (review WR-05; UI-04, D-13b, D-21): one live region announces the save status. The hidden status line stays only on the tabs whose bar
 * does not carry the status as the live region (the draft tabs' bar does). No Russian text is added: the line is the sample's own, byte for byte, inside the condition.
 */
function applyReviewLiveRegionHunk(text: string): string {
  const line = '      <p className="sr-only" role="status" aria-live="polite">{`${statusText}${dirty ? `${status === "dirty" ? ":" : ". Не сохранено:"} ${shownChanged.map((id) => sectionLabels[id]).join(", ")}` : ""}`}</p>\n';
  return replaceOnce(
    text,
    line,
    [
      "      {/* Review WR-05: one live region for the save status. On the draft tabs it is the status of the bar; on the other tabs the draft row is not live and this hidden line is. */}",
      `      {!editorSections.some((section) => section === tab) && ${line.trimStart().trimEnd()}}`,
      "",
    ].join("\n"),
    "hidden live region",
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

/**
 * PORTIA-26-G05 (26-18 Task 1; UI-04, D-13a, D-21; UAT gap 5): every section tab carries the drag handle of the subsections and stands in a span with its source index,
 * a child of the nav, so the handle swaps tabs in the row. The arrow buttons after the nav leave with their labels. No Russian text is added: the handle's name
 * takes the literal «раздел» the file already holds.
 */
function applySectionDragHunk(text: string): string {
  const next = replaceOnce(
    text,
    "  const activeIndex = sections.findIndex((section) => section.id === activeId);\n  const navRef = useRef<HTMLElement>(null);\n",
    "  const navRef = useRef<HTMLElement>(null);\n",
    "section drag: active index out",
  );
  return replaceOnce(
    next,
    '      {sections.map((section) => <button key={section.id} type="button" aria-current={section.id === activeId ? "true" : undefined} onClick={() => onSelect(section.id)}>{section.title || "Без названия"}</button>)}\n' +
      "    </nav>\n" +
      '    {activeIndex >= 0 && <div className="editor-section-tab-order" aria-label="Порядок разделов">\n' +
      '      <button type="button" disabled={activeIndex === 0} onClick={() => onMove(activeIndex, activeIndex - 1)} aria-label="Переместить раздел левее">←</button>\n' +
      '      <button type="button" disabled={activeIndex === sections.length - 1} onClick={() => onMove(activeIndex, activeIndex + 1)} aria-label="Переместить раздел правее">→</button>\n' +
      "    </div>}\n",
    '      {sections.map((section, index) => <span key={section.id} className="editor-section-tab" data-sort-index={index}>\n' +
      '        <OrderDragHandle index={index} label={section.title || "раздел"} onMove={onMove} />\n' +
      '        <button type="button" aria-current={section.id === activeId ? "true" : undefined} onClick={() => onSelect(section.id)}>{section.title || "Без названия"}</button>\n' +
      "      </span>)}\n" +
      "    </nav>\n",
    "section drag: tabs with handles, arrows out",
  );
}

/**
 * PORTIA-26-G04 (26-18 Task 2; UI-04, UI-06, D-21; UAT gap 4): the active section of «Информация» and «Справочник» is one wrapper that spans the whole form, not a card in a 340px grid column.
 * Four replacements: the opening line and the closing line of each list, byte for byte; the body of the section card is not touched. No Russian text is added.
 */
function applySectionWidthHunk(text: string): string {
  let next = text;
  for (const [list, active] of [["infoSections", "activeInfoSection"], ["guideSections", "activeGuideSection"]] as const) {
    next = replaceOnce(
      next,
      `          <SectionColumns items={draft.${list}} render={(section, index) => section.id === ${active} && (\n`,
      `          <div className="editor-section-single">{draft.${list}.map((section, index) => section.id === ${active} && (\n`,
      `section width: ${list} open`,
    );
  }
  next = replaceOnce(
    next,
    "            </CollapsibleCard>\n          )} />\n        </div>\n        } />\n      )}\n\n      {tab === " + '"guide" && (',
    "            </CollapsibleCard>\n          ))}</div>\n        </div>\n        } />\n      )}\n\n      {tab === " + '"guide" && (',
    "section width: info close",
  );
  return replaceOnce(
    next,
    "            </CollapsibleCard>\n          )} />\n        </div>\n        } />\n      )}\n\n      {tab === " + '"broadcasts" && (',
    "            </CollapsibleCard>\n          ))}</div>\n        </div>\n        } />\n      )}\n\n      {tab === " + '"broadcasts" && (',
    "section width: guide close",
  );
}

/**
 * PORTIA-26-G10 (26-18 Task 3; UI-04, D-21; UAT gap 10): the recycle button of the virus tab moves from the bottom of the form into the head row beside the dossier tabs.
 * Two replacements, byte for byte; the button's markup and its handler are the same, and the confirmation dialog is not touched. No Russian text is added: the label moves.
 */
const RECYCLE_BUTTON_LINE = '<button className="danger-control" type="button" onClick={() => setDialog("recycle")}>ПЕРЕМЕСТИТЬ В КОРЗИНУ</button>';
const DOSSIER_TABS_LINE = "<DossierTabs active={dossierTab} changed={liveDossierChanged} onSelect={selectDossierTab} />";
function applyRecycleButtonHunk(text: string): string {
  const next = replaceOnce(
    text,
    `              ${DOSSIER_TABS_LINE}\n`,
    `              <div className="virus-editor-head">\n                ${DOSSIER_TABS_LINE}\n                ${RECYCLE_BUTTON_LINE}\n              </div>\n`,
    "recycle button: the head row",
  );
  return replaceOnce(next, `\n\n              ${RECYCLE_BUTTON_LINE}\n            </div>\n`, `\n            </div>\n`, "recycle button: the old place out");
}

// Сжатие картинки в браузере перед загрузкой (владелец, 2026-11-17): импорт и подготовленный файл в теле запроса.
function applyUploadCompressHunk(text: string): string {
  const next = replaceOnce(
    text,
    'import { uploadRefusal } from "@/lib/image-upload";\n',
    'import { compressImageForUpload } from "@/lib/image-compress";\nimport { uploadRefusal } from "@/lib/image-upload";\n',
    "upload compress: import",
  );
  return replaceOnce(
    next,
    '    let response: Response;\n    try {\n      const body = new FormData();\n      body.set("file", file);\n',
    '    // Shrinks the picture in the browser before sending; any failure inside sends the original file.\n    const prepared = await compressImageForUpload(file);\n    let response: Response;\n    try {\n      const body = new FormData();\n      body.set("file", prepared);\n',
    "upload compress: prepared file",
  );
}

// Владелец 2026-11-18: фото-блок «Справочника» кадрируется тем же окном «Видимая часть», что обложки и полосы (свободная рамка с ручками),
// вместо ползунков «Высота» и «Кадр по горизонтали / вертикали»; положение по умолчанию — слева. Блок «Карточки» (карточки внутри карточки). Замены байт в байт.
function applyGuidePhotoFramingHunk(text: string): string {
  let next = text;
  next = replaceOnce(next, "\nimport { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from \"react\";\n", "\nimport { ImageFramingEditor } from \"@/components/portia-image-framing\";\nimport { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from \"react\";\n", "guide photo framing and cards block 1");
  next = replaceOnce(next, "  callout: { label: \"\u0432\u0440\u0435\u0437\u043a\u0430\", title: \"\u0412\u0420\u0415\u0417\u041a\u0410\" },\n} as const;\n", "  callout: { label: \"\u0432\u0440\u0435\u0437\u043a\u0430\", title: \"\u0412\u0420\u0415\u0417\u041a\u0410\" },\n  cards: { label: \"\u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438\", title: \"\u041a\u0410\u0420\u0422\u041e\u0427\u041a\u0418\" },\n} as const;\n", "guide photo framing and cards block 2");
  next = replaceOnce(next, "const firstLine = (value: string) => value.split(\"\\n\").map((line) => line.trim()).find(Boolean);\nconst guideBlockTitle = (block: GuideBlock) => (block.type === \"heading\" || block.type === \"text\" ? firstLine(block.text) : block.type === \"callout\" ? firstLine(block.label) ?? firstLine(block.text) : undefined);\n\n", "const firstLine = (value: string) => value.split(\"\\n\").map((line) => line.trim()).find(Boolean);\nconst guideBlockTitle = (block: GuideBlock) => (block.type === \"heading\" || block.type === \"text\" ? firstLine(block.text) : block.type === \"callout\" ? firstLine(block.label) ?? firstLine(block.text) : block.type === \"cards\" && block.cardIds.length ? `${block.cardIds.length} \u0448\u0442.` : undefined);\n\n", "guide photo framing and cards block 3");
  next = replaceOnce(next, "\nfunction GuidePhotoLayoutEditor({ block, onChange }: {\n", "\n// Owner 2026-11-18: one standard for every picture \u2014 the photo block of a card is framed in the same window \u00ab\u0412\u0438\u0434\u0438\u043c\u0430\u044f \u0447\u0430\u0441\u0442\u044c\u00bb as covers and bands\n// (a free frame: its proportions are dragged by the handles), not by the old sliders \u00ab\u041a\u0430\u0434\u0440 \u043f\u043e \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u0438 / \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u0438\u00bb. Applying a frame drops the\n// old height and focus numbers of the block, so the site shows exactly what the window showed.\nfunction GuidePhotoLayoutEditor({ block, onChange }: {\n", "guide photo framing and cards block 4");
  next = replaceOnce(next, "  const width = block.width ?? 100;\n  const height = block.height ?? 0;\n  const align = block.align ?? \"center\";\n  const focusX = block.focusX ?? 50;\n  const focusY = block.focusY ?? 50;\n  return <div className=\"guide-photo-layout\">\n", "  const width = block.width ?? 100;\n  const align = block.align ?? \"left\";\n  return <div className=\"guide-photo-layout\">\n", "guide photo framing and cards block 5");
  next = replaceOnce(next, "  return <div className=\"guide-photo-layout\">\n    <strong>\u0420\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0438 \u0432\u0438\u0434\u0438\u043c\u0430\u044f \u0447\u0430\u0441\u0442\u044c \u0444\u043e\u0442\u043e</strong>\n    <div className=\"guide-photo-layout-controls\">\n", "  return <div className=\"guide-photo-layout\">\n    <strong>\u0420\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0444\u043e\u0442\u043e</strong>\n    <div className=\"guide-photo-layout-controls\">\n", "guide photo framing and cards block 6");
  next = replaceOnce(next, "      <label>\u0428\u0438\u0440\u0438\u043d\u0430: {width}%<input type=\"range\" min=\"40\" max=\"100\" step=\"5\" value={width} onChange={(event) => onChange((photo) => { photo.width = Number(event.target.value); })} /></label>\n      <label>\u0412\u044b\u0441\u043e\u0442\u0430: {height ? `${height} px` : \"\u043f\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044e\"}<input type=\"range\" min=\"0\" max=\"600\" step=\"20\" value={height} onChange={(event) => onChange((photo) => { photo.height = Number(event.target.value); })} /></label>\n      <label>\u041f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435<select value={align} onChange={(event) => onChange((photo) => { photo.align = event.target.value as \"left\" | \"center\" | \"right\"; })}><option value=\"left\">\u0421\u043b\u0435\u0432\u0430</option><option value=\"center\">\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443</option><option value=\"right\">\u0421\u043f\u0440\u0430\u0432\u0430</option></select></label>\n", "      <label>\u0428\u0438\u0440\u0438\u043d\u0430: {width}%<input type=\"range\" min=\"40\" max=\"100\" step=\"5\" value={width} onChange={(event) => onChange((photo) => { photo.width = Number(event.target.value); })} /></label>\n      <label>\u041f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435<select value={align} onChange={(event) => onChange((photo) => { photo.align = event.target.value as \"left\" | \"center\" | \"right\"; })}><option value=\"left\">\u0421\u043b\u0435\u0432\u0430</option><option value=\"center\">\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443</option><option value=\"right\">\u0421\u043f\u0440\u0430\u0432\u0430</option></select></label>\n", "guide photo framing and cards block 7");
  next = replaceOnce(next, "      <label>\u041f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435<select value={align} onChange={(event) => onChange((photo) => { photo.align = event.target.value as \"left\" | \"center\" | \"right\"; })}><option value=\"left\">\u0421\u043b\u0435\u0432\u0430</option><option value=\"center\">\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443</option><option value=\"right\">\u0421\u043f\u0440\u0430\u0432\u0430</option></select></label>\n      <label>\u041a\u0430\u0434\u0440 \u043f\u043e \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u0438: {focusX}%<input type=\"range\" min=\"0\" max=\"100\" step=\"5\" value={focusX} onChange={(event) => onChange((photo) => { photo.focusX = Number(event.target.value); })} /></label>\n      <label>\u041a\u0430\u0434\u0440 \u043f\u043e \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u0438: {focusY}%<input type=\"range\" min=\"0\" max=\"100\" step=\"5\" value={focusY} onChange={(event) => onChange((photo) => { photo.focusY = Number(event.target.value); })} /></label>\n    </div>\n", "      <label>\u041f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435<select value={align} onChange={(event) => onChange((photo) => { photo.align = event.target.value as \"left\" | \"center\" | \"right\"; })}><option value=\"left\">\u0421\u043b\u0435\u0432\u0430</option><option value=\"center\">\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443</option><option value=\"right\">\u0421\u043f\u0440\u0430\u0432\u0430</option></select></label>\n    </div>\n", "guide photo framing and cards block 8");
  next = replaceOnce(next, "    </div>\n    <div className={`guide-photo-layout-preview guide-photo-${align}`} style={{ width: `${width}%` }}>\n      {block.url ? <img src={block.url} alt=\"\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u0444\u043e\u0442\u043e\" loading=\"lazy\" style={{ width: \"100%\", height: height ? `${height}px` : \"auto\", objectPosition: `${focusX}% ${focusY}%` }} /> : <span>\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u043e\u0442\u043e, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442.</span>}\n    </div>\n  </div>;\n", "    </div>\n    {block.url && <ImageFramingEditor src={block.url} framing={block.framing} box=\"free\" label=\"\u0424\u043e\u0442\u043e\" onChange={(framing) => onChange((photo) => {\n      if (framing) photo.framing = framing; else delete photo.framing;\n      delete photo.height; delete photo.focusX; delete photo.focusY;\n    })} />}\n  </div>;\n}\n\n// Owner 2026-11-18: the block \u00ab\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438\u00bb \u2014 other cards of \u00ab\u0421\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a\u00bb shown inside this card. Picked from one list grouped by section, kept in the chosen order.\nfunction GuideCardsBlockEditor({ block, cardId, sections, onChange }: {\n  block: Extract<GuideBlock, { type: \"cards\" }>;\n  cardId: string;\n  sections: PortiaContent[\"guideSections\"];\n  onChange: (cardIds: string[]) => void;\n}) {\n  const titleOf = (id: string) => {\n    const found = findGuide(sections, id);\n    return found?.card ? `${found.card.title || \"\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f\"} \u00b7 ${found.section.title || \"\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f\"}` : \"\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430\";\n  };\n  return <div className=\"guide-cards-editor\">\n    {block.cardIds.length ? <ol className=\"guide-cards-editor-list\">\n      {block.cardIds.map((id, index) => <li key={id}>\n        <span>{titleOf(id)}</span>\n        <button type=\"button\" className=\"secondary-control\" aria-label={`\u0412\u044b\u0448\u0435: ${titleOf(id)}`} disabled={index === 0} onClick={() => { const next = [...block.cardIds]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>\u2191</button>\n        <button type=\"button\" className=\"secondary-control\" aria-label={`\u0423\u0431\u0440\u0430\u0442\u044c: ${titleOf(id)}`} onClick={() => onChange(block.cardIds.filter((item) => item !== id))}>\u00d7</button>\n      </li>)}\n    </ol> : <p className=\"guide-section-empty\">\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u0435\u0449\u0451 \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u044b</p>}\n    <label className=\"editor-field\">\n      <span>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443</span>\n      <select value=\"\" disabled={block.cardIds.length >= 24} onChange={(event) => { if (event.target.value) onChange([...block.cardIds, event.target.value]); }}>\n        <option value=\"\">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443\u2026</option>\n        {sections.map((section) => <optgroup key={section.id} label={section.title || \"\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f\"}>\n          {section.cards.filter((item) => item.id !== cardId && !block.cardIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.title || \"\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f\"}</option>)}\n        </optgroup>)}\n      </select>\n    </label>\n  </div>;\n", "guide photo framing and cards block 9");
  next = replaceOnce(next, "                            <>\n                              <ImageEditorField label=\"\u0424\u043e\u0442\u043e\" value={block.url} placement=\"guide\" maxHint=\"\u0420\u0430\u0437\u043c\u0435\u0440 \u0438 \u043a\u0430\u0434\u0440 \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u043d\u0438\u0436\u0435\" showPreview={false} uploadState={uploadState} uploadMessage={uploadMessage}\n                                onChange={(value) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === \"photo\") item.url = value; })}\n", "                            <>\n                              <ImageEditorField label=\"\u0424\u043e\u0442\u043e\" value={block.url} placement=\"guide\" maxHint=\"\u0420\u0430\u0437\u043c\u0435\u0440 \u0438 \u0432\u0438\u0434\u0438\u043c\u0430\u044f \u0447\u0430\u0441\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u043d\u0438\u0436\u0435\" showPreview={false} uploadState={uploadState} uploadMessage={uploadMessage}\n                                onChange={(value) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === \"photo\") item.url = value; })}\n", "guide photo framing and cards block 10");
  next = replaceOnce(next, "                          {block.type === \"video\" && <YoutubeField videoId={block.videoId} onChange={(videoId) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === \"video\") item.videoId = videoId; })} />}\n                          {block.type === \"callout\" && (\n", "                          {block.type === \"video\" && <YoutubeField videoId={block.videoId} onChange={(videoId) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === \"video\") item.videoId = videoId; })} />}\n                          {block.type === \"cards\" && <GuideCardsBlockEditor block={block} cardId={card.id} sections={draft.guideSections} onChange={(cardIds) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === \"cards\") item.cardIds = cardIds; })} />}\n                          {block.type === \"callout\" && (\n", "guide photo framing and cards block 11");
  next = replaceOnce(next, "                        <button className=\"secondary-control limit-add\" type=\"button\" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: \"callout\", label: \"\", text: \"\" }))}>+ \u0412\u0420\u0415\u0417\u041a\u0410</button>\n                      </div>\n", "                        <button className=\"secondary-control limit-add\" type=\"button\" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: \"callout\", label: \"\", text: \"\" }))}>+ \u0412\u0420\u0415\u0417\u041a\u0410</button>\n                        <button className=\"secondary-control limit-add\" type=\"button\" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: \"cards\", cardIds: [] }))}>+ \u041a\u0410\u0420\u0422\u041e\u0427\u041a\u0418</button>\n                      </div>\n", "guide photo framing and cards block 12");
  return next;
}

/**
 * PORTIA-26.1-EMP (26.1-02 Task 1; OWN-07, D-21): «Сотрудники» живут в шве components/portia-editor-employees.tsx.
 * Функция и её detailsOf вырезаются целиком по двум якорям — строке начала (const detailsOf) и строке `type TabLists =` (каждая ровно одна),
 * поэтому правка не зависит от содержимого функции и от соседних правок. Остальное — шесть замен байт в байт. Русских строк не добавлено.
 */
function applyEmployeesSeamHunk(text: string): string {
  const lines = text.split("\n");
  const starts = lines.flatMap((line, index) => (line.startsWith("const detailsOf = (employee: PortiaEmployee)") ? [index] : []));
  assert.equal(starts.length, 1, "employees seam: exactly one approved anchor for the start of the moved code");
  const ends = lines.flatMap((line, index) => (line.startsWith("type TabLists =") ? [index] : []));
  assert.equal(ends.length, 1, "employees seam: exactly one approved anchor for the end of the moved code");
  assert.ok(starts[0] < ends[0], "the moved code stands above type TabLists");
  lines.splice(starts[0], ends[0] - starts[0]);
  let next = lines.join("\n");
  next = replaceOnce(
    next,
    "import { draftEdits, employeeRequestFailure, partialSave,",
    "import { draftEdits, partialSave,",
    "employees seam: the failure text moved with the function",
  );
  next = replaceOnce(
    next,
    'import { acceptsEditorList, changedDetails, changedFields, employeeRatings, profileChanged, profileOf, settleDraft, type EmployeeProfile, type PortiaEmployee } from "@/lib/portia-employees";\n',
    'import { type PortiaEmployee } from "@/lib/portia-employees";\nimport { EmployeeProfilesEditor, useEmployeeDraftStore } from "@/components/portia-editor-employees";\n',
    "employees seam: imports",
  );
  next = replaceOnce(
    next,
    "  const [employeeDirty, setEmployeeDirty] = useState(false);\n",
    "  const [employeeDirty, setEmployeeDirty] = useState(false);\n  const employeeDrafts = useEmployeeDraftStore();\n",
    "employees seam: the draft store",
  );
  next = replaceOnce(
    next,
    "onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}",
    "onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} drafts={employeeDrafts} />}",
    "employees seam: the drafts prop",
  );
  next = replaceOnce(
    next,
    '      if (wasEmployeeDirty && added.includes("employees")) lost.push("employees");\n',
    '      if (wasEmployeeDirty && added.includes("employees")) lost.push("employees");\n      if (added.includes("employees")) { employeeDrafts.reset(); setEmployeeDirty(false); }\n',
    "employees seam: a closed section drops its drafts",
  );
  return replaceOnce(next, "  }, [closedKey, employeesClosed]);\n", "  }, [closedKey, employeesClosed, employeeDrafts]);\n", "employees seam: the effect depends on the store");
}

/**
 * PORTIA-26.1-EMP2 (26.1-02 Task 2; OWN-07, D-21): the employee question is asked only when the window closes. Leaving «Сотрудники» for another tab asks nothing
 * (the drafts live in the store), so the pending-tab state leaveTo and its branch go; a close with unsaved employee drafts from another tab switches to «Сотрудники»,
 * where the seam shows the question. Five replacements, byte for byte; no Russian text is added (the question is in components/portia-editor-employees.tsx).
 */
function applyEmployeesCloseHunk(text: string): string {
  let next = replaceOnce(text, "  const [leaveTo, setLeaveTo] = useState<EditorTab | null>(null);\n", "", "employees close: no pending tab");
  next = replaceOnce(next, "  const leaving = employeeDirty && (leaveTo !== null || closeAsked);\n", "  const leaving = employeeDirty && closeAsked;\n", "employees close: the question is for the close only");
  next = replaceOnce(next, "      setPreviewSurface(null);\n      setLeaveTo(null);\n", "      setPreviewSurface(null);\n", "employees close: a closed section has no pending tab");
  next = replaceOnce(
    next,
    [
      "  // An unsaved employee draft is asked about before leaving the tab (D-02).",
      "  const switchTab = (id: EditorTab) => {",
      '    if (tab === "employees" && id !== "employees" && employeeDirty) setLeaveTo(id);',
      "    else showTab(id);",
      "  };",
      "  // The answer of the employee question: continue the pending tab switch or window close, or drop it.",
      "  const onEmployeeLeave = (ok: boolean) => {",
      "    if (ok) setEmployeeDirty(false);",
      "    if (leaveTo !== null) {",
      "      setLeaveTo(null);",
      "      if (ok) showTab(leaveTo);",
      "    } else if (closeAsked) {",
      "",
    ].join("\n"),
    [
      "  // Employee drafts live in the store and survive leaving the tab: no question here (owner 2026-11-20, OWN-07).",
      "  const switchTab = (id: EditorTab) => showTab(id);",
      "  // The answer of the employee question, asked once when the window closes.",
      "  const onEmployeeLeave = (ok: boolean) => {",
      "    if (ok) setEmployeeDirty(false);",
      "    if (closeAsked) {",
      "",
    ].join("\n"),
    "employees close: switchTab and the answer",
  );
  return replaceOnce(
    next,
    "      if (ok && !dirty) onCloseApproved();\n    }\n  };\n",
    [
      "      if (ok && !dirty) onCloseApproved();",
      "    }",
      "  };",
      "  // A close with unsaved employee drafts asks its question on the tab of the employees; from another tab the editor goes there first.",
      "  useEffect(() => {",
      '    if (closeAsked && employeeDirty && tab !== "employees" && stripTabs.some(([id]) => id === "employees")) showTab("employees");',
      "  });",
      "",
    ].join("\n"),
    "employees close: go to the tab that asks",
  );
}

/**
 * PORTIA-26.1-HOLD (26.1-08; OWN-09, D-21): ColumnSwapHandle живёт в шве components/portia-editor-dossier.tsx (удержание заголовка столбца вместо ручки ≡).
 * Блок вырезается целиком по двум якорям — строке-комментарию «// Two table columns swap…» и строке `function normalizePhraseLines(` (каждая ровно одна);
 * имя добавляется в импорт из шва. Русских строк не добавлено, строки функции переехали вместе с ней.
 */
function applyColumnSwapSeamHunk(text: string): string {
  const lines = text.split("\n");
  const starts = lines.flatMap((line, index) => (line.startsWith("// Two table columns swap, so a header") ? [index] : []));
  assert.equal(starts.length, 1, "column swap seam: exactly one approved anchor for the start of the moved code");
  const ends = lines.flatMap((line, index) => (line.startsWith("function normalizePhraseLines(") ? [index] : []));
  assert.equal(ends.length, 1, "column swap seam: exactly one approved anchor for the end of the moved code");
  assert.ok(starts[0] < ends[0], "the moved code stands above normalizePhraseLines");
  lines.splice(starts[0], ends[0] - starts[0]);
  return replaceOnce(lines.join("\n"), "ClassificationField, ConfirmDialog, DossierTabs", "ClassificationField, ColumnSwapHandle, ConfirmDialog, DossierTabs", "column swap seam: import");
}

/**
 * PORTIA-26.1-TABS (26.1-09 Task 1; OWN-10, D-21): карточки раздела «Справочника» — вкладки-полоски (components/portia-editor-card-tabs.tsx), под ними только выбранная карточка.
 * Вставки: импорт шва, хук выбора рядом с флагом employeeDirty, выбор вкладки в jumpGuide, строка CardTabs перед списком карточек и фильтр map по выбранной карточке.
 * Русских строк не добавлено: подпись «Карточки раздела» и «Без названия» лежат в шве (cardTabsCopy).
 */
function applyGuideCardTabsHunk(text: string): string {
  let next = replaceOnce(
    text,
    'import { ImageFramingEditor } from "@/components/portia-image-framing";\n',
    'import { ImageFramingEditor } from "@/components/portia-image-framing";\nimport { CardTabs, cardTabsCopy, useCardTabSelection } from "@/components/portia-editor-card-tabs";\n',
    "guide card tabs: import",
  );
  next = replaceOnce(next, "  const [employeeDirty, setEmployeeDirty] = useState(false);\n", "  const [employeeDirty, setEmployeeDirty] = useState(false);\n  const cardTabs = useCardTabSelection();\n", "guide card tabs: the selection hook");
  next = replaceOnce(
    next,
    "  const jumpGuide = (id: string) => {\n    const found = findGuide(draft.guideSections, id);\n",
    "  const jumpGuide = (id: string) => {\n    const found = findGuide(draft.guideSections, id);\n    if (found?.card) cardTabs.select(found.section.id, id);\n",
    "guide card tabs: a jump to a card selects its tab",
  );
  return replaceOnce(
    next,
    [
      '              <div className="info-subsection-list" data-sort-group="guide-cards" data-group-id={section.id}>',
      '                {section.cards.length === 0 && <div className="editor-empty compact-empty">В разделе нет карточек. Добавьте первую кнопкой «+ ДОБАВИТЬ КАРТОЧКУ».</div>}',
      "                {section.cards.map((card, cardIndex) => (",
      "",
    ].join("\n"),
    [
      "              <CardTabs label={cardTabsCopy.cards} items={section.cards.map((card) => ({ id: card.id, title: card.title }))} activeId={cardTabs.active(section.id, section.cards.map((card) => card.id))}",
      "                onSelect={(id) => { closeFormatterFor(...section.cards.flatMap((card) => card.blocks.map((block) => portiaTextKey.guideBlock(block.id)))); cardTabs.select(section.id, id); setOpen([id], true); }}",
      "                onMove={(from, to) => changeDraft((next) => { const target = findGuide(next.guideSections, section.id)?.section; if (target) moveArrayItem(target.cards, from, to); })} />",
      '              <div className="info-subsection-list" data-sort-group="guide-cards" data-group-id={section.id}>',
      '                {section.cards.length === 0 && <div className="editor-empty compact-empty">В разделе нет карточек. Добавьте первую кнопкой «+ ДОБАВИТЬ КАРТОЧКУ».</div>}',
      "                {section.cards.map((card, cardIndex) => card.id === cardTabs.active(section.id, section.cards.map((item) => item.id)) && (",
      "",
    ].join("\n"),
    "guide card tabs: the strip and the selected card",
  );
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
  { id: "PORTIA-26-07b", apply: applyInfoBroadcastNavHunk },
  { id: "PORTIA-26-07c", apply: applyEmployeesBarHunk },
  { id: "PORTIA-26-13", apply: applyCardToggleNameHunk },
  { id: "PORTIA-26-R01", apply: applyReviewDraftBarHunk },
  { id: "PORTIA-26-R05", apply: applyReviewLiveRegionHunk },
  { id: "PORTIA-26-G05", apply: applySectionDragHunk },
  { id: "PORTIA-26-G04", apply: applySectionWidthHunk },
  { id: "PORTIA-26-G10", apply: applyRecycleButtonHunk },
  { id: "UPLOAD-COMPRESS", apply: applyUploadCompressHunk },
  { id: "GUIDE-PHOTO-FRAMING", apply: applyGuidePhotoFramingHunk },
  { id: "PORTIA-26.1-EMP", apply: applyEmployeesSeamHunk },
  { id: "PORTIA-26.1-EMP2", apply: applyEmployeesCloseHunk },
  { id: "PORTIA-26.1-HOLD", apply: applyColumnSwapSeamHunk },
  { id: "PORTIA-26.1-TABS", apply: applyGuideCardTabsHunk },
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

// Phase 26 (26-07, D-13a): the add-section bar and the section tabs of «Информация» moved together into the nav slot of the sticky action bar.
// The meaning of D-62 is unchanged: the add-section control stands before the section tabs, and there is no add-section button below the columns.
test("D-62: the «Информация» tab starts with the add-section bar and has no add-section button below the columns", () => {
  const code = stripComments(currentEditor());
  const navStart = code.indexOf(': tab === "info" ? <>');
  const navEnd = code.indexOf(': tab === "broadcasts" ? (', navStart);
  assert.ok(navStart > 0 && navEnd > navStart, "the «Информация» branch of the bar's nav slot is found");
  const nav = code.slice(navStart, navEnd);
  const bar = nav.indexOf("<SectionAddBar");
  const tabs = nav.indexOf(INFO_TABS_LINE_START);
  assert.ok(bar >= 0 && tabs > bar, "SectionAddBar stands above the section tabs");
  const start = code.indexOf('{tab === "info" && (');
  const end = code.indexOf('{tab === "guide" && (');
  assert.ok(start > 0 && end > start, "the «Информация» tab block is found");
  const info = code.slice(start, end);
  assert.ok(!info.includes("<SectionAddBar") && !info.includes(INFO_TABS_LINE_START), "the tab body holds neither the add bar nor the section tabs");
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
  const withoutUsers = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-22" && edit.id !== "PORTIA-26-R01").reduce((text, edit) => edit.apply(text), sample);
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
  const withoutTabBodies = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-06b" && edit.id !== "PORTIA-26-R01" && !edit.id.startsWith("PORTIA-26-07") && !edit.id.startsWith("PORTIA-26-G")).reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutTabBodies), null, "a file without the PORTIA-26-06b hunk is a difference");
  assert.throws(() => applyTabBodiesHunk(expected), /exactly one approved anchor/, "the tab bodies hunk cannot be applied twice");
  const withoutSectionNav = approvedEditorEdits.filter((edit) => !edit.id.startsWith("PORTIA-26-07") && edit.id !== "PORTIA-26-R01" && !edit.id.startsWith("PORTIA-26-G")).reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutSectionNav), null, "a file without the PORTIA-26-07 hunk is a difference");
  assert.throws(() => applySectionNavHunk(expected), /exactly one approved anchor/, "the section nav hunk cannot be applied twice");
  const withoutInfoBroadcastNav = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-07b" && edit.id !== "PORTIA-26-G04").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutInfoBroadcastNav), null, "a file without the PORTIA-26-07b hunk is a difference");
  assert.throws(() => applyInfoBroadcastNavHunk(expected), /exactly one approved anchor/, "the info and broadcast nav hunk cannot be applied twice");
  // 26.1-02: PORTIA-26.1-EMP cuts the whole function out, so the effect of the bar hunk shows only before that cut.
  const beforeEmployeesSeam = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26.1-EMP");
  const withoutEmployeesBar = beforeEmployeesSeam.filter((edit) => edit.id !== "PORTIA-26-07c").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(beforeEmployeesSeam.reduce((text, edit) => edit.apply(text), sample), withoutEmployeesBar), null, "a file without the PORTIA-26-07c hunk is a difference");
  assert.throws(() => applyEmployeesBarHunk(expected), /exactly one approved anchor/, "the employees bar hunk cannot be applied twice");
  const withoutCardToggleName = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-13").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutCardToggleName), null, "a file without the PORTIA-26-13 hunk is a difference");
  assert.throws(() => applyCardToggleNameHunk(expected), /exactly one approved anchor/, "the card toggle name hunk cannot be applied twice");
  const withoutReviewDraftBar = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-R01").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutReviewDraftBar), null, "a file without the PORTIA-26-R01 hunk is a difference");
  assert.throws(() => applyReviewDraftBarHunk(expected), /exactly one approved anchor/, "the review draft bar hunk cannot be applied twice");
  const withoutReviewLiveRegion = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-R05").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutReviewLiveRegion), null, "a file without the PORTIA-26-R05 hunk is a difference");
  assert.throws(() => applyReviewLiveRegionHunk(expected), /exactly one approved anchor/, "the review live region hunk cannot be applied twice");
  const withoutSectionDrag = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-G05").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutSectionDrag), null, "a file without the PORTIA-26-G05 hunk is a difference");
  assert.throws(() => applySectionDragHunk(expected), /exactly one approved anchor/, "the section drag hunk cannot be applied twice");
  const withoutSectionWidth = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-G04").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutSectionWidth), null, "a file without the PORTIA-26-G04 hunk is a difference");
  assert.throws(() => applySectionWidthHunk(expected), /exactly one approved anchor/, "the section width hunk cannot be applied twice");
  const withoutRecycleButton = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26-G10").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutRecycleButton), null, "a file without the PORTIA-26-G10 hunk is a difference");
  assert.throws(() => applyRecycleButtonHunk(expected), /exactly one approved anchor/, "the recycle button hunk cannot be applied twice");
  const withoutEmployeesSeam = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26.1-EMP").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutEmployeesSeam), null, "a file without the PORTIA-26.1-EMP hunk is a difference");
  assert.throws(() => applyEmployeesSeamHunk(expected), /exactly one approved anchor/, "the employees seam hunk cannot be applied twice");
  const withoutEmployeesClose = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26.1-EMP2").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutEmployeesClose), null, "a file without the PORTIA-26.1-EMP2 hunk is a difference");
  assert.throws(() => applyEmployeesCloseHunk(expected), /exactly one approved anchor/, "the employees close hunk cannot be applied twice");
  const withoutColumnSwapSeam = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26.1-HOLD").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutColumnSwapSeam), null, "a file without the PORTIA-26.1-HOLD hunk is a difference");
  assert.throws(() => applyColumnSwapSeamHunk(expected), /exactly one approved anchor/, "the column swap seam hunk cannot be applied twice");
  assert.ok(!expected.includes("function ColumnSwapHandle"), "the approved editor no longer holds ColumnSwapHandle");
  const withoutGuideCardTabs = approvedEditorEdits.filter((edit) => edit.id !== "PORTIA-26.1-TABS").reduce((text, edit) => edit.apply(text), sample);
  assert.notEqual(firstDifference(expected, withoutGuideCardTabs), null, "a file without the PORTIA-26.1-TABS hunk is a difference");
  assert.throws(() => applyGuideCardTabsHunk(expected), /exactly one approved anchor/, "the guide card tabs hunk cannot be applied twice");
  assert.ok(expected.includes("<CardTabs label={cardTabsCopy.cards}"), "the approved editor shows the card tabs of a «Справочник» section");
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
