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

// D-57 (20-37): одобренное владельцем исключение из правила 20-39 («portia-editor.tsx не меняется»), ограниченное кнопкой запуска формата.
//
// Охрана ниже берёт образец файла редактора из истории git (`git show <коммит>:components/portia-editor.tsx`),
// поэтому ей нужен ПОЛНЫЙ клон, не shallow: в shallow-клоне коммита-образца нет. Clean-checkout (20-13) обязан клонировать
// с историей. Если git недоступен, клон shallow или коммита нет, тест ПАДАЕТ с понятным сообщением (git fetch --unshallow);
// он никогда не пропускается и не проходит молча.
//
// Одобренные правки components/portia-editor.tsx после 20-39:
//   1. 449c756 — key={index} у recommendation-preview-item (ошибка React «unique key», о которой сообщил владелец). Уже в образце.
//   2. D-57 — кнопка «ОФОРМЛЕНИЕ» стала общим FormatLaunchButton. Это единственная замена, которую делает охрана (applyLaunchButtonHunk).
// D-58 запрещает в этом файле правки подсказок. Любая будущая одобренная правка файла обязана расширить охрану:
// новый коммит-образец или новая разрешённая замена здесь, иначе тест упадёт.
const SAMPLE_COMMIT = "449c756200b3db32f9cfaf4b3ca36b47822b395b";
const EDITOR_PATH = "components/portia-editor.tsx";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const RICH_TEXT_IMPORT_FROM = "@/components/portia-editor-rich-text";
const LAUNCH_BUTTON_LINE = "<FormatLaunchButton target={formatTarget} open={formatterOpen} onToggle={() => setFormatterOpen((current) => !current)} />";

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

/** Образец + единственная разрешённая замена: встроенный блок кнопки запуска -> строка FormatLaunchButton и имя в импорте. */
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

function firstDifference(expected: string, actual: string): string | null {
  if (expected === actual) return null;
  const left = expected.split("\n");
  const right = actual.split("\n");
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return `line ${index + 1}: expected ${JSON.stringify(left[index])}, got ${JSON.stringify(right[index])}`;
  }
  return "files differ";
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

test("D-57: portia-editor.tsx differs from 449c756 only by the launch button hunk", () => {
  const sample = readSampleEditor();
  const expected = applyLaunchButtonHunk(sample);
  const actual = currentEditor();
  assert.equal(firstDifference(expected, actual), null, "components/portia-editor.tsx may differ from the sample only by the launch button hunk; extend the guard for any new approved edit");
});

test("D-57: the guard notices any other edit, a missing hunk and an unreadable sample", () => {
  const sample = readSampleEditor();
  const expected = applyLaunchButtonHunk(sample);
  const lines = expected.split("\n");
  const touched = lines.slice();
  touched[touched.length - 2] = `${touched[touched.length - 2]} // stray edit`;
  assert.notEqual(firstDifference(expected, touched.join("\n")), null, "one extra changed line is a difference");
  assert.notEqual(firstDifference(expected, `${expected}\n`), null, "an extra trailing line is a difference");
  assert.throws(() => applyLaunchButtonHunk(expected), /exactly one inline launch button block/, "a file without the inline block cannot be turned into the expected one");
});
