import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// D-56 (20-37): every hint of the interface is shortened or removed, and the register in 20-HINTS-INVENTORY.md says which and why.
// D-58: components/portia-editor.tsx keeps its hints ("оставлено: D-58"); the shared editor components are shortened like every other file.
// This test reads the register and the sources and fails when the two disagree; the long-text search below is reproducible by anyone.

const root = fileURLToPath(new URL("..", import.meta.url));
const registryPath = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-HINTS-INVENTORY.md";
const editorFile = "components/portia-editor.tsx";

const shortened = "сокращено";
const removed = "убрано";
const editorKept = "оставлено: D-58";
const decisions = [
  shortened,
  removed,
  "оставлено: уже коротко",
  "оставлено: ошибка или состояние",
  "оставлено: предупреждение безопасности",
  "оставлено: подтверждение необратимого действия",
  "оставлено: содержимое",
  editorKept,
];
// The word limits of the rules: a shortened hint, a text kept because it is already short, a warning or confirmation, an error or state.
const shortLimit = 8;
const alreadyShortLimit = 8;
const warningLimit = 12;
const stateLimit = 12;
// A text this long (with Cyrillic) is an explanation until the register says otherwise.
const longTextWords = 7;
const ownerPhrases = ["локальный черновик", "не запись архива", "не запись в архив"];

// Files whose register rows are applied: the old text must be gone and the new one present. Task 1 of 20-46 starts with the builder and the launch
// button, Task 2 adds the desktop, Promotion, the editors' shared components and the login page, Task 3 closes the list.
const appliedFiles = [
  "components/portia-template-builder.tsx",
  "lib/format-launch.ts",
];

export type HintRow = {
  id: string;
  file: string;
  where: string;
  was: string;
  now: string;
  decision: string;
  tests: string;
  line: number;
};

export type SourceEnv = {
  /** Every source file the old text must be gone from: components, app pages without app/api, lib modules without tests. */
  sourcePaths: () => string[];
  /** The files searched for long explanations: components/*.tsx and app/**\/page.tsx. */
  hintPaths: () => string[];
  read: (path: string) => string;
};

export const norm = (text: string) => text.replace(/\s+/g, " ").trim();
const stripTags = (text: string) => text.replace(/<[^>]*>/g, " ");
export const wordCount = (text: string) => stripTags(text).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
const hasCyrillic = (text: string) => /[Ѐ-ӿ]/.test(text);

export function parseRegistry(markdown: string): HintRow[] {
  const rows: HintRow[] = [];
  markdown.split("\n").forEach((text, index) => {
    if (!text.startsWith("| h-")) return;
    const cells = text.slice(2, text.endsWith(" |") ? -2 : undefined).split(" | ").map((cell) => cell.trim());
    assert.equal(cells.length, 7, `register line ${index + 1}: seven columns expected, got ${cells.length}`);
    const [id, file, where, was, now, decision, tests] = cells;
    rows.push({ id, file, where, was, now, decision, tests, line: index + 1 });
  });
  return rows;
}

/** Cyrillic texts of at least `minWords` words in a TSX file: JSX text, string literals and the parts of template literals. */
export function longTexts(path: string, source: string, minWords = longTextWords) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    if (text !== null) {
      const clean = norm(text);
      if (hasCyrillic(clean) && wordCount(clean) >= minWords) found.push({ line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: clean });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const overlaps = (a: string, b: string) => a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));

/** The checks of the register against the sources; returns the problems, one string each. */
export function validateRegistry(rows: HintRow[], env: SourceEnv, applied: string[]): string[] {
  const errors: string[] = [];
  const sources = new Map<string, string>();
  const source = (path: string) => {
    let text = sources.get(path);
    if (text === undefined) { text = norm(env.read(path)); sources.set(path, text); }
    return text;
  };
  const allSources = env.sourcePaths();

  const ids = new Set<string>();
  for (const row of rows) {
    const label = `${row.id} (${row.file})`;
    if (ids.has(row.id)) errors.push(`${label}: duplicate id`);
    ids.add(row.id);
    if (!decisions.includes(row.decision)) { errors.push(`${label}: unknown decision «${row.decision}»`); continue; }
    if (row.file === editorFile && row.decision !== editorKept) errors.push(`${label}: the editor file keeps its hints (D-58), the decision must be «${editorKept}», got «${row.decision}»`);
    if (row.file !== editorFile && row.decision === editorKept) errors.push(`${label}: «${editorKept}» is for the editor file only`);

    const wasWords = wordCount(row.was);
    if (row.decision === shortened) {
      if (row.now === "—" || row.now === "") errors.push(`${label}: a shortened hint needs the new text`);
      else if (wordCount(row.now) > shortLimit) errors.push(`${label}: the new text has ${wordCount(row.now)} words, the limit is ${shortLimit}`);
    } else if (row.decision === removed) {
      if (row.now !== "—") errors.push(`${label}: a removed hint has «—» in the «Стало» column`);
    } else if (row.decision === "оставлено: уже коротко") {
      if (wasWords > alreadyShortLimit) errors.push(`${label}: kept as short but has ${wasWords} words (limit ${alreadyShortLimit})`);
    } else if (row.decision === "оставлено: предупреждение безопасности" || row.decision === "оставлено: подтверждение необратимого действия") {
      if (wasWords > warningLimit) errors.push(`${label}: a warning or confirmation has ${wasWords} words (limit ${warningLimit})`);
    } else if (row.decision === "оставлено: ошибка или состояние") {
      if (wasWords > stateLimit) errors.push(`${label}: an error or state has ${wasWords} words (limit ${stateLimit})`);
    }

    let own: string;
    try { own = source(row.file); } catch { errors.push(`${label}: the file does not exist`); continue; }
    const was = norm(row.was);
    const isApplied = applied.includes(row.file);
    const changes = row.decision === shortened || row.decision === removed;
    if (changes && isApplied) {
      const left = allSources.filter((path) => source(path).includes(was));
      if (left.length > 0) errors.push(`${label}: the old text is still in the sources (${left.join(", ")}): «${was}»`);
      if (row.decision === shortened && !own.includes(norm(row.now))) errors.push(`${label}: the new text is not in ${row.file}: «${row.now}»`);
    } else if (!own.includes(was)) {
      errors.push(`${label}: the «Было» text is not in ${row.file}${changes ? " (not applied yet, so it must still be there)" : ""}: «${was}»`);
    }
  }

  for (const phrase of ownerPhrases) {
    for (const path of allSources) {
      if (source(path).toLowerCase().includes(phrase)) errors.push(`${path}: the owner's sample phrase «${phrase}» is still there`);
    }
  }

  const registered = new Set(rows.map((row) => row.file));
  for (const file of applied) if (!registered.has(file)) errors.push(`${file}: listed as applied but has no register rows`);

  // The long-text search: every explanation of 7 words and more is in the register, as kept (any «оставлено»), as the new text of a shortened
  // hint, or - while its file is not applied yet - as the old text of a hint that is going to change.
  for (const path of env.hintPaths()) {
    const own = rows.filter((row) => row.file === path);
    const isApplied = applied.includes(path);
    for (const hit of longTexts(path, env.read(path))) {
      const recorded = own.some((row) => {
        const kept = row.decision.startsWith("оставлено");
        const text = norm(kept || !isApplied ? row.was : row.now);
        if (overlaps(text, hit.text)) return true;
        return !isApplied && !kept ? overlaps(norm(row.was), hit.text) : false;
      });
      if (!recorded) errors.push(`${path}:${hit.line}: a long explanation is not in the register: «${hit.text}»`);
    }
  }
  return errors;
}

function walk(dir: string, accept: (path: string) => boolean, skip: (path: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(`${root}${dir}`)) {
    const path = `${dir}/${entry}`;
    if (skip(path)) continue;
    if (statSync(`${root}${path}`).isDirectory()) out.push(...walk(path, accept, skip));
    else if (accept(path)) out.push(path);
  }
  return out;
}

const realEnv: SourceEnv = {
  sourcePaths: () => [
    ...walk("components", (path) => path.endsWith(".tsx")),
    ...walk("app", (path) => path.endsWith(".tsx"), (path) => path === "app/api"),
    ...walk("lib", (path) => path.endsWith(".ts") && !path.endsWith(".test.ts") && !path.includes("/fixtures/"), (path) => path === "lib/fixtures"),
  ],
  hintPaths: () => [
    ...walk("components", (path) => path.endsWith(".tsx")),
    ...walk("app", (path) => path.endsWith("/page.tsx"), (path) => path === "app/api"),
  ],
  read: (path) => readFileSync(`${root}${path}`, "utf8"),
};

const registry = () => parseRegistry(readFileSync(`${root}${registryPath}`, "utf8"));

test("D-56 (20-37): the register has a row for every hint and the rows are well formed", () => {
  const rows = registry();
  assert.ok(rows.length >= 40, `the register has ${rows.length} rows, at least 40 expected`);
  assert.ok(rows.some((row) => row.file === editorFile && row.decision === editorKept), "the editor rows are recorded as «оставлено: D-58»");
});

test("D-56 (20-37): the register and the sources agree (old texts gone, new texts present, nothing unrecorded, no sample phrases)", () => {
  const errors = validateRegistry(registry(), realEnv, appliedFiles);
  assert.deepEqual(errors, [], `\n${errors.join("\n")}\n`);
});

test("D-58: every editor row keeps its text and no hint of the editor file is shortened or removed", () => {
  const rows = registry().filter((row) => row.file === editorFile);
  assert.ok(rows.length > 0);
  const source = norm(realEnv.read(editorFile));
  for (const row of rows) {
    assert.equal(row.decision, editorKept, `${row.id}: ${row.decision}`);
    assert.ok(source.includes(norm(row.was)), `${row.id}: the text is not in the editor file: «${row.was}»`);
  }
});

test("D-56 (20-37): the check catches a text that is still there, a too long new text, an editor edit and an unrecorded explanation", () => {
  const longOld = "Это длинный старый текст подсказки интерфейса";
  const fifteen = "один два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать тринадцать четырнадцать пятнадцать";
  const files = new Map<string, string>([
    ["components/a.tsx", `export const A = () => <p>${longOld}</p>;`],
    [editorFile, "export const E = () => <p>Подсказка редактора остаётся на месте как есть сейчас</p>;"],
    ["components/b.tsx", "export const B = () => <p>Новая неучтённая подсказка которой нет в реестре сейчас</p>;"],
  ]);
  const env: SourceEnv = {
    sourcePaths: () => [...files.keys()],
    hintPaths: () => [...files.keys()],
    read: (path) => files.get(path) ?? "",
  };
  const row = (id: string, file: string, was: string, now: string, decision: string): HintRow => ({ id, file, where: "x", was, now, decision, tests: "нет", line: 1 });
  const errors = validateRegistry([
    row("h-01", "components/a.tsx", longOld, fifteen, shortened),
    row("h-02", editorFile, "Подсказка редактора остаётся на месте как есть сейчас", "коротко", shortened),
  ], env, ["components/a.tsx"]);
  const text = errors.join("\n");
  assert.match(text, /h-01.*is still in the sources/, "an old text that is still in the code");
  assert.match(text, /h-01.*the new text has 15 words/, "a new text of 15 words");
  assert.match(text, /h-02.*the editor file keeps its hints/, "a shortened editor hint");
  assert.match(text, /components\/b\.tsx:1: a long explanation is not in the register/, "an explanation that is not in the register");
  assert.deepEqual(validateRegistry([], { ...env, sourcePaths: () => ["components/c.tsx"], hintPaths: () => [], read: () => "Здесь осталась фраза Локальный черновик в тексте" }, []), ["components/c.tsx: the owner's sample phrase «локальный черновик» is still there"]);
});

test("D-56 (20-37): the long-text search finds JSX text, strings and template parts of seven words and more", () => {
  const found = longTexts("x.tsx", [
    "export const a = <p>Раз два три четыре пять шесть семь восемь</p>;",
    "export const b = \"Раз два три четыре пять шесть семь\";",
    "export const c = `Раз два три четыре пять шесть семь ${1} конец`;",
    "export const d = <p>Раз два три четыре пять шесть</p>;",
    "export const e = \"one two three four five six seven eight\";",
  ].join("\n"));
  assert.deepEqual(found.map((hit) => hit.line), [1, 2, 3]);
});
