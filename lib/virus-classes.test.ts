import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { classificationOptions, legacyClassificationNames } from "./portia-content.ts";
import { portiaContentFixture } from "./testing/portia-content-fixture.ts";

const ACUTE = "\u0301";
// Accented names appear only in the text of the «Классификация» section (D-37).
const accentedNames = [
  `Люци${ACUTE}диум`, `Транзи${ACUTE}тиум`, `Обли${ACUTE}виум`,
  `Стабила${ACUTE}р`, `Импульса${ACUTE}р`, `Инферна${ACUTE}р`,
  `Изомо${ACUTE}рф`, `Полимо${ACUTE}рф`, `Ксеномо${ACUTE}рф`,
];

function classificationBody() {
  const section = portiaContentFixture.infoSections.find((item) => item.id === "classification");
  assert.ok(section, "classification section exists");
  return section.body;
}

function count(text: string, part: string) {
  return text.split(part).length - 1;
}

test("D-38 the classification text keeps the intro and the first three scales", () => {
  const body = classificationBody();
  assert.ok(body.startsWith("Всем вирусам присваивается по три класса."));
  for (const heading of ["ОСНОВНАЯ ЛИНЕЙКА", "РИСК РАСПРОСТРАНЕНИЯ", "УГРОЗА И РИСК ПОБЕГА"]) assert.ok(body.includes(heading), heading);
  assert.equal(count(body, "ДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА"), 1);
});

test("D-38 the owner block follows the additional scale heading (D-49)", () => {
  const body = classificationBody();
  const head = "ДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА\n\nРАЗУМ\n\n";
  const at = body.indexOf(head);
  assert.ok(at >= 0, "owner block starts under the heading");
  assert.ok(body.slice(at + head.length).startsWith(`Люци${ACUTE}диум — Вирусы класса Люци${ACUTE}диум`));
  for (const heading of ["РАЗУМ", "ПОВЕДЕНИЯ И АГРЕССИЯ", "ВНЕШНИЙ ВИД И ФИЗИЧЕСКИЕ ИЗМЕНЕНИЯ"]) assert.ok(body.includes(`\n\n${heading}\n\n`), heading);
});

test("D-38 each of the nine names carries the accent mark and appears twice in the owner block", () => {
  const body = classificationBody();
  const block = body.slice(body.indexOf("ДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА"));
  for (const name of accentedNames) assert.equal(count(block, name), 2, name);
});

test("D-38 the extra emotion line joins the Impulsar paragraph with a single line break", () => {
  const body = classificationBody();
  assert.ok(body.includes("и периодических вспышках раздражительности.\nили утрата эмпатии, радости или какой-либо конкретной эмоции.\n\n"));
});

test("D-38 the old names and Nyktea are gone from the text", () => {
  const body = classificationBody();
  for (const old of Object.keys(legacyClassificationNames)) assert.ok(!body.includes(old), old);
  assert.ok(!body.includes("Нюктея"));
});

// D-39: the nine class icons, checked on the source of components/portia-icons.tsx (TSX is not imported here).
const iconsSource = readFileSync(new URL("../components/portia-icons.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const newKeys = [
  "class-lucidium", "class-transitium", "class-oblivium",
  "class-stabilar", "class-impulsar", "class-infernar",
  "class-isomorph", "class-polymorph", "class-xenomorph",
];
const oldKeys = [
  "class-rubedo", "class-albedo", "class-nigredo",
  "class-fobus", "class-areus", "class-selenus",
  "class-nyktea", "class-morfea", "class-dedalea",
];

function between(start: string, end: string) {
  const from = iconsSource.indexOf(start);
  const to = iconsSource.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} .. ${end}`);
  return iconsSource.slice(from, to);
}

const iconPathsBlock = between("const iconPaths:", "// The badge for each canonical term");
const iconMapBlock = between("export const classificationIcon", "// Content values are editor input");
const typeBlock = between("export type PortiaIconName", "// Classification badges");

function entryIn(block: string, key: string) {
  const quoted = key.includes("-") ? `"${key}":` : `${key}:`;
  const start = block.indexOf(`\n  ${quoted}`);
  assert.ok(start >= 0, `${key} is drawn`);
  const rest = block.slice(start + quoted.length + 3);
  const next = rest.search(/\n  ("[a-z-]+"|[a-z]+):/);
  return next < 0 ? rest : rest.slice(0, next);
}

function drawing(key: string) {
  return entryIn(iconPathsBlock, key);
}

test("D-39 the nine new icon keys exist in the type, the drawings and the class map; the old nine are gone", () => {
  for (const key of newKeys) {
    assert.ok(typeBlock.includes(`"${key}"`), `${key} in PortiaIconName`);
    assert.equal(count(iconPathsBlock, `"${key}":`), 1, `${key} drawn once`);
    assert.equal(count(iconMapBlock, `"${key}"`), 1, `${key} mapped once`);
  }
  for (const key of oldKeys) assert.ok(!iconsSource.includes(key), `${key} removed`);
});

test("D-39 the nine drawings are pairwise different and use no colour beyond currentColor", () => {
  const drawings = newKeys.map(drawing);
  assert.equal(new Set(drawings.map((item) => item.replace(/\s+/g, ""))).size, newKeys.length);
  for (const [index, item] of drawings.entries()) {
    assert.ok(item.length > 20, `${newKeys[index]} has a drawing`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(item),`${newKeys[index]} has no hex colour`);
    const fills = [...item.matchAll(/fill="([^"]*)"/g)].map((match) => match[1]);
    assert.ok(fills.every((fill) => fill === "currentColor" || fill === "none"), `${newKeys[index]} fills ${fills.join(",")}`);
  }
});

test("G2 Transitium right brain has the left brain's opacity and keeps its dashed contour", () => {
  const transitium = drawing("class-transitium");
  assert.doesNotMatch(transitium, /opacity\s*=/, "both right-hand groups are fully opaque");
  assert.match(transitium, /strokeDasharray="2 2\.4"/, "the right contour remains dashed");
  assert.doesNotMatch(drawing("class-lucidium"), /strokeDasharray/, "Lucidium remains solid");
  assert.match(drawing("class-oblivium"), /strokeDasharray/, "Oblivium remains dashed throughout");
});

test("D-39 every new class name from classificationOptions maps to one of the new icons", () => {
  for (const axis of ["mind", "behavior", "appearance"] as const) {
    for (const option of classificationOptions[axis]) {
      const match = new RegExp(`"${option.value}": "(class-[a-z]+)"`).exec(iconMapBlock);
      assert.ok(match, `${option.value} has an icon`);
      assert.ok(newKeys.includes(match[1]), `${option.value} -> ${match[1]}`);
    }
  }
});

test("D-39 every static path of the icon file is complete: command argument counts are whole", () => {
  const counts: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const paths = [...iconsSource.matchAll(/\bd="([^"$]*)"/g)].map((match) => match[1]);
  assert.ok(paths.length > 40, "paths found");
  for (const d of paths) {
    for (const [, command, args] of d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)) {
      const size = counts[command.toLowerCase()];
      assert.notEqual(size, undefined, `${command} in ${d}`);
      const numbers = (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).length;
      if (size === 0) assert.equal(numbers, 0, d);
      else assert.ok(numbers >= size && numbers % size === 0, `${command}${args} (${numbers} numbers) in ${d}`);
    }
  }
});

// PORTIA-26-12 (UI-07): the classification signs are the owner's round-5 drawing, recorded in 26-ICON-DECISION.md
// («Геометрия (источник для 26-12)»). The file is the only source of the drawing: each <symbol id="s-<name>"> becomes the entry
// "class-<name>" verbatim, only the attribute names change to JSX. PortiaIcon sets stroke on the root <svg>, while the symbol's
// filled group had no stroke, so the filled group says stroke="none" to keep the filled shapes at their drawn size.
const decisionSource = readFileSync(new URL("../.planning/phases/PORTIA-26-edinyy-stil-sayta/26-ICON-DECISION.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function decisionSymbols() {
  const from = decisionSource.indexOf("## Геометрия (источник для 26-12)");
  assert.ok(from >= 0, "26-ICON-DECISION.md has the geometry section");
  const open = decisionSource.indexOf("```svg\n", from);
  const close = decisionSource.indexOf("\n```", open + 7);
  assert.ok(open > from && close > open, "the geometry section holds one svg block");
  const symbols = new Map<string, string>();
  for (const line of decisionSource.slice(open + 7, close).split("\n")) {
    const match = /^<symbol id="s-([a-z]+)" viewBox="0 0 24 24">(.*)<\/symbol>$/.exec(line);
    assert.ok(match, `every line of the svg block is one 24x24 symbol: ${line.slice(0, 60)}`);
    assert.ok(!symbols.has(match[1]), `s-${match[1]} appears once`);
    symbols.set(match[1], match[2]);
  }
  return symbols;
}

function symbolToJsx(inner: string) {
  const jsx = inner
    .replaceAll("stroke-width=", "strokeWidth=")
    .replaceAll("stroke-linecap=", "strokeLinecap=")
    .replaceAll("stroke-linejoin=", "strokeLinejoin=")
    .replaceAll('<g fill="currentColor">', '<g fill="currentColor" stroke="none">')
    .replaceAll('"/>', '" />');
  assert.doesNotMatch(jsx, / [a-z]+-[a-z-]+=/, "no SVG attribute is left in dash-case");
  return `<>${jsx}</>,`;
}

test("26-12 the drawing starts only from the owner's recorded choice: one «Выбрано: » line in 26-ICON-DECISION.md", () => {
  assert.equal(decisionSource.split("\n").filter((line) => line.startsWith("Выбрано: ")).length, 1);
});

test("26-12 tracer: the three danger signs are the owner's round-5 drawing, verbatim", () => {
  const symbols = decisionSymbols();
  for (const name of ["hephaestus", "proteus", "apeiron"]) {
    const inner = symbols.get(name);
    assert.ok(inner, `s-${name} is recorded`);
    assert.equal(drawing(`class-${name}`).trim(), symbolToJsx(inner), `class-${name}`);
  }
});

// Everything except the class signs stays as it was at the sample commit (D-05; the owner's amendment in 26-ICON-DECISION.md
// keeps the byte check for route-*, lock-* and the other icons, the class map, its keys and the canonical terms).
// The guard reads the sample from git history, so it needs a full clone; it fails with a clear message instead of skipping.
const ICON_SAMPLE_COMMIT = "cf8038f42270cacd600eb347faaf36f1c52294ba";
const ICONS_PATH = "components/portia-icons.tsx";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function readSampleIcons(): string {
  const short = ICON_SAMPLE_COMMIT.slice(0, 7);
  const fix = "run git fetch --unshallow (the clone must have full history)";
  let shallow: string;
  try {
    shallow = git(["rev-parse", "--is-shallow-repository"]).trim();
  } catch (error) {
    assert.fail(`26-12 icon guard needs git history: git is unavailable or this is not a git checkout (${(error as Error).message}); ${fix}`);
  }
  assert.notEqual(shallow, "true", `26-12 icon guard needs full git history: commit ${short} may be missing because the clone is shallow; ${fix}`);
  try {
    return git(["show", `${ICON_SAMPLE_COMMIT}:${ICONS_PATH}`]).replace(/\r\n/g, "\n");
  } catch (error) {
    assert.fail(`26-12 icon guard: commit ${short} or ${ICONS_PATH} in it is missing (${(error as Error).message}); ${fix}`);
  }
}

function sliceOf(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} .. ${end}`);
  return source.slice(from, to);
}

function lineOf(source: string, start: string) {
  const line = source.split("\n").find((item) => item.startsWith(start));
  assert.ok(line, `${start} exists`);
  return line;
}

test("26-12 route-*, lock-* and all non-class icons, their helpers, the type, the class map and PortiaIcon equal ICON_SAMPLE_COMMIT byte for byte", () => {
  const sample = readSampleIcons();
  const sampleIconPaths = sliceOf(sample, "const iconPaths:", "// The badge for each canonical term");
  const keys = [...sampleIconPaths.matchAll(/\n  ("[a-z-]+"|[a-z]+):/g)].map((match) => match[1].replaceAll('"', ""));
  const kept = keys.filter((key) => !key.startsWith("class-"));
  assert.ok(kept.includes("route-droplet") && kept.includes("lock-closed") && kept.length === 20, `kept icons: ${kept.join(",")}`);
  for (const key of kept) assert.equal(drawing(key), entryIn(sampleIconPaths, key), `${key} is unchanged since ${ICON_SAMPLE_COMMIT.slice(0, 7)}`);
  for (const helper of ["const drop =", "const lockBody ="]) assert.equal(lineOf(iconsSource, helper), lineOf(sample, helper), helper);
  const typeOf = (source: string) => /export type PortiaIconName =[\s\S]*?;\n/.exec(source)?.[0];
  assert.equal(typeOf(iconsSource), typeOf(sample), "PortiaIconName keeps every key");
  assert.equal(iconMapBlock, sliceOf(sample, "export const classificationIcon", "// Content values are editor input"), "classificationIcon");
  assert.equal(sliceOf(iconsSource, "export function classificationIconFor", "\n}\n"), sliceOf(sample, "export function classificationIconFor", "\n}\n"), "classificationIconFor");
  assert.equal(sliceOf(iconsSource, "export function PortiaIcon(", "\n}\n"), sliceOf(sample, "export function PortiaIcon(", "\n}\n"), "PortiaIcon");
});
