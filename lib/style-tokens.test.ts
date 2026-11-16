import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const repoRoot = new URL("../", import.meta.url);
const portiaCssRaw = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");
const promoCssRaw = readFileSync(new URL("../app/portia-promotion-editor.css", import.meta.url), "utf8");
const globalsCssRaw = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const directionRecord = readFileSync(
  new URL(
    "../.planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-STYLE-DIRECTION.md",
    import.meta.url,
  ),
  "utf8",
);

const PORTIA_RADIUS_DECLARATIONS = 131;
// Phase 26 restyle changes these on purpose and updates them in the same commit.
const PROMO_RADIUS_DECLARATIONS = 6;

// Phase 26 (UI-02): direction C roles (22-STYLE-DIRECTION.md, column C), in the order the block declares them.
const TOKEN_NAMES = [
  "--radius-window",
  "--radius-dialog",
  "--radius-card",
  "--radius-control",
  "--radius-field",
  "--radius-tab",
  "--radius-plaque",
  "--radius-round",
  "--tap-target",
  "--control-height",
  "--control-height-compact",
  "--field-max",
  "--card-min",
] as const;

const ROLE_VALUES: Record<(typeof TOKEN_NAMES)[number], string> = {
  "--radius-window": "10px",
  "--radius-dialog": "10px",
  "--radius-card": "7px",
  "--radius-control": "0",
  "--radius-field": "0",
  "--radius-tab": "0",
  "--radius-plaque": "999px",
  "--radius-round": "50%",
  "--tap-target": "44px",
  "--control-height": "40px",
  "--control-height-compact": "32px",
  "--field-max": "640px",
  "--card-min": "360px",
};

function lf(text: string) {
  return text.replace(/\r\n/g, "\n");
}

function withoutComments(text: string) {
  return lf(text).replace(/\/\*[\s\S]*?\*\//g, "");
}

function declarationCount(text: string) {
  return (withoutComments(text).match(/border-radius\s*:/g) ?? []).length;
}

export function stripMarkedBlocks(css: string) {
  const lines = lf(css).split("\n");
  const kept: string[] = [];
  let skipping: "tokens" | "users" | "access" | null = null;
  for (const line of lines) {
    if (!skipping && line.includes("style-tokens:start")) skipping = "tokens";
    if (!skipping && line.startsWith("/* users-tab:start")) skipping = "users";
    if (!skipping && line.startsWith("/* access-levels:start")) skipping = "access";
    if (!skipping) kept.push(line);
    if (skipping === "tokens" && line.includes("style-tokens:end")) skipping = null;
    if (skipping === "users" && line === "/* users-tab:end */") skipping = null;
    if (skipping === "access" && line === "/* access-levels:end */") skipping = null;
  }
  assert.equal(skipping, null, "a marked block is not closed");
  return kept.join("\n");
}

export function ruleRadius(css: string, selectorStart: string) {
  for (const match of withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[1].trim().startsWith(selectorStart)) continue;
    return match[2].match(/border-radius\s*:\s*([^;]+);/)?.[1].trim() ?? "0";
  }
  assert.fail(`selector not found: ${selectorStart}`);
}

function rootBody(css: string) {
  return lf(css).match(/^:root\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
}

function declarations(text: string) {
  return new Map([...withoutComments(text).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

function sourceFiles(directory: "app" | "components") {
  const root = new URL(`../${directory}/`, import.meta.url);
  const files: string[] = [];
  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if ([".css", ".ts", ".tsx"].includes(extname(entry.name))) files.push(child);
    }
  };
  walk(root.pathname.replace(/^\/(?:[A-Za-z]:)/, (drive) => drive.slice(1)));
  return files;
}

test("UI-01: radius counts, root count and stylesheet order stay pinned", () => {
  assert.equal(declarationCount(portiaCssRaw), PORTIA_RADIUS_DECLARATIONS);
  assert.equal(declarationCount(promoCssRaw), PROMO_RADIUS_DECLARATIONS);
  assert.equal(declarationCount(globalsCssRaw), 0);
  assert.equal((lf(portiaCssRaw).match(/^:root\s*\{/gm) ?? []).length, 2);
  assert.deepEqual(
    [...layoutSource.matchAll(/import "\.\/([\w-]+\.css)";/g)].map((match) => match[1]),
    ["globals.css", "portia.css", "portia-promotion-editor.css"],
  );
});

test("UI-02: role tokens hold direction C values and the three tracer consumers read them", () => {
  const css = lf(portiaCssRaw);
  const firstRoot = rootBody(css);
  const assistant = firstRoot.indexOf('  --assistant-font: "Segoe UI", Arial, sans-serif;');
  const start = firstRoot.indexOf("style-tokens:start");
  const end = firstRoot.indexOf("style-tokens:end");
  assert.ok(start > assistant, "style token markers are missing after --assistant-font");
  assert.ok(end > start, "style token end marker is missing");

  const block = firstRoot.slice(start, end);
  const tokens = declarations(block);
  assert.deepEqual([...tokens.keys()], TOKEN_NAMES);
  for (const name of TOKEN_NAMES) assert.equal(tokens.get(name), ROLE_VALUES[name], name);
  assert.doesNotMatch(block, /--radius-\d|--radius-pill/, "numeric radius primitives and the pill primitive are gone");

  assert.equal(ruleRadius(css, ".app-window"), "var(--radius-window)");
  assert.equal(ruleRadius(css, ".portia-dialog"), "var(--radius-dialog)");
  assert.equal(ruleRadius(css, ".editor-field input"), "var(--radius-field)");
});

test("UI-02: marked additions keep their blocks free of radius, animation and colour changes", () => {
  const css = lf(portiaCssRaw);
  // Phase 26 (UI-02): the guard is the radius grammar (see the grammar test); the byte-shape hash is retired.

  const tokenBlock = css.match(/^.*style-tokens:start[\s\S]*?^.*style-tokens:end.*$/m)?.[0] ?? "";
  assert.ok(tokenBlock, "style token block is missing");
  assert.doesNotMatch(tokenBlock, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted\s*:/);

  const accessBlock = css.match(/^\/\* access-levels:start[\s\S]*?^\/\* access-levels:end \*\/$/m)?.[0] ?? "";
  assert.ok(accessBlock, "the access-levels block is missing");
  assert.equal(css.match(/^\/\* access-levels:start/gm)?.length, 1, "the access-levels block must be one");
  assert.doesNotMatch(accessBlock, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted\s*:|#[0-9a-fA-F]{3,8}\b/);

  const usersStart = css.search(/^\/\* users-tab:start/m);
  if (usersStart >= 0) assert.ok(css.indexOf("/* access-levels:end */") < usersStart, "users-tab must stay the last block of the file");
  if (usersStart >= 0) {
    const usersBlock = css.slice(usersStart);
    assert.match(usersBlock, /^\/\* users-tab:start[\s\S]*\/\* users-tab:end \*\/\n?$/);
    assert.doesNotMatch(usersBlock, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted\s*:/);
  }

  const lfCount = (portiaCssRaw.match(/\n/g) ?? []).length;
  const crlfCount = (portiaCssRaw.match(/\r\n/g) ?? []).length;
  assert.ok(crlfCount === 0 || crlfCount === lfCount, "app/portia.css has mixed line endings");
});

test("UI-02: role tokens are read by the stylesheet and no source sets an inline borderRadius", () => {
  assert.ok(withoutComments(portiaCssRaw).includes("var(--radius-window)"), "app/portia.css never reads --radius-window");
  for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
    if (extname(file) === ".css") continue;
    assert.doesNotMatch(readFileSync(file, "utf8"), /borderRadius/, file.replace(repoRoot.pathname, ""));
  }
});

test("UI-01: the direction record presents A/B/C as text and carries no agent choice", () => {
  const record = lf(directionRecord);
  assert.deepEqual(
    [...record.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    ["Что меняется в Phase 26", "Три направления", "Таблица значений", "Вопрос владельцу", "Статус"],
  );

  const tableSection = record.match(/^## Таблица значений\n([\s\S]*?)^## Вопрос владельцу/m)?.[1] ?? "";
  const tableLines = tableSection.split("\n").filter((line) => line.startsWith("|"));
  assert.equal(tableLines[0], "| Семейство элементов | Сейчас (селектор) | A | B | C |");
  const dataRows = tableLines.slice(2).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  assert.equal(dataRows.length, 7);
  for (const row of dataRows) assert.equal(row.length, 5);

  const nowByFamily = new Map(dataRows.map((row) => [row[0], row[1]]));
  assert.match(nowByFamily.get("Окно приложения") ?? "", /--radius-window/);
  assert.match(nowByFamily.get("Диалог \/ подтверждение") ?? "", /--radius-dialog/);
  assert.match(nowByFamily.get("Поля") ?? "", /--radius-field/);

  assert.doesNotMatch(record, /\bPASS\b/);
  assert.doesNotMatch(record, /\bрекоменд[а-яё-]*\b/iu);
  const blocked = record.includes("BLOCKED (решение владельца): буква не выбрана.");
  const choices = [...record.matchAll(/Выбрано:\s*([ABC])\b/g)];
  assert.ok((blocked && choices.length === 0) || (!blocked && choices.length === 1));
  if (choices.length === 1) {
    assert.match(record, /\b\d{4}-\d{2}-\d{2}\b/);
    assert.match(record, /(?<![\p{L}\p{N}_])владелец(?![\p{L}\p{N}_])/iu);
  }
});
