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
