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

// 26-12 (owner's round 5, 26-ICON-DECISION.md): the old G2 check pinned the dashed brain; the mind level now reads from the drawing
// on one base sign (a head profile): Lucidium a mind circle, Transitium a pupil in it, Oblivium a spiral instead of it. No dashes.
test("26-12 mind levels read from one head profile: a circle, then a pupil in it, then a spiral; nothing is dashed", () => {
  const head = 'd="M8 21.5V17.4A7.5 7.5 0 1 1 17.95 13.3L19.9 14.8L17.8 15.7L17 18.6L14.5 19.6V21.5"';
  const circle = 'd="M7.6 10.5A3.4 3.4 0 1 0 14.4 10.5A3.4 3.4 0 1 0 7.6 10.5Z"';
  const [lucidium, transitium, oblivium] = ["class-lucidium", "class-transitium", "class-oblivium"].map(drawing);
  for (const item of [lucidium, transitium, oblivium]) {
    assert.equal(count(item, head), 1, "each mind sign keeps the same head profile");
    assert.doesNotMatch(item, /strokeDasharray|opacity\s*=/, "levels are drawn, not dashed or faded");
  }
  assert.ok(lucidium.includes(circle) && !lucidium.includes('fill="currentColor"'), "Lucidium: an empty mind circle");
  assert.ok(transitium.includes(circle) && transitium.includes('<g fill="currentColor" stroke="none">'), "Transitium: a pupil in the circle");
  assert.ok(!oblivium.includes(circle), "Oblivium: a spiral replaces the circle");
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

// The 18 signs of the six axes (the owner added «Поведение и агрессия» to the five groups of D-05), in level order.
const classSignNames = [
  "hephaestus", "proteus", "apeiron",
  "nomos", "theseus", "abraxas",
  "warning", "risk", "esnov",
  "lucidium", "transitium", "oblivium",
  "stabilar", "impulsar", "infernar",
  "isomorph", "polymorph", "xenomorph",
];

test("26-12 all 18 class signs are the owner's round-5 drawing, verbatim, and the decision records exactly these 18", () => {
  const symbols = decisionSymbols();
  assert.deepEqual([...symbols.keys()].sort(), [...classSignNames].sort(), "26-ICON-DECISION.md records the 18 signs");
  const typed = [...typeBlock.matchAll(/"(class-[a-z]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(typed, classSignNames.map((name) => `class-${name}`).sort(), "PortiaIconName has the same 18 class keys");
  for (const name of classSignNames) assert.equal(drawing(`class-${name}`).trim(), symbolToJsx(symbols.get(name) ?? ""), `class-${name}`);
});

test("26-12 every class sign: line 1.5 with round caps, currentColor only, no dashes, no fading and no separate level mark", () => {
  for (const name of classSignNames) {
    const item = drawing(`class-${name}`);
    assert.ok(item.trim().startsWith('<><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">'), `class-${name} line group`);
    assert.doesNotMatch(item, /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/, `class-${name} has no colour beyond currentColor`);
    assert.doesNotMatch(item, /strokeDasharray|opacity\s*=|levelMark|\{[a-zA-Z]/, `class-${name} draws its level, no mark or shared helper`);
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
  // Owner 2026-11-18: one icon was added after the sample, «template» (the app «Шаблон»); every sampled icon stays byte for byte.
  assert.ok(kept.includes("route-droplet") && kept.includes("lock-closed") && kept.length === 20, `kept icons: ${kept.join(",")}`);
  for (const key of kept) assert.equal(drawing(key), entryIn(sampleIconPaths, key), `${key} is unchanged since ${ICON_SAMPLE_COMMIT.slice(0, 7)}`);
  for (const helper of ["const drop =", "const lockBody ="]) assert.equal(lineOf(iconsSource, helper), lineOf(sample, helper), helper);
  const typeOf = (source: string) => /export type PortiaIconName =[\s\S]*?;\n/.exec(source)?.[0];
  assert.equal(typeOf(iconsSource), typeOf(sample)?.replace('| "trash" | "editor"\n', '| "trash" | "editor" | "template"\n'), "PortiaIconName keeps every key (plus «template»)");
  assert.equal(iconMapBlock, sliceOf(sample, "export const classificationIcon", "// Content values are editor input"), "classificationIcon");
  assert.equal(sliceOf(iconsSource, "export function classificationIconFor", "\n}\n"), sliceOf(sample, "export function classificationIconFor", "\n}\n"), "classificationIconFor");
  assert.equal(sliceOf(iconsSource, "export function PortiaIcon(", "\n}\n"), sliceOf(sample, "export function PortiaIcon(", "\n}\n"), "PortiaIcon");
});
