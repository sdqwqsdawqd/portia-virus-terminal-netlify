import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { classificationOptions, defaultPortiaContent, legacyClassificationNames } from "./portia-content.ts";

const ACUTE = "\u0301";
// Accented names appear only in the text of the «Классификация» section (D-37).
const accentedNames = [
  `Люци${ACUTE}диум`, `Транзи${ACUTE}тиум`, `Обли${ACUTE}виум`,
  `Стабила${ACUTE}р`, `Импульса${ACUTE}р`, `Инферна${ACUTE}р`,
  `Изомо${ACUTE}рф`, `Полимо${ACUTE}рф`, `Ксеномо${ACUTE}рф`,
];

function classificationBody() {
  const section = defaultPortiaContent.infoSections.find((item) => item.id === "classification");
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

function drawing(key: string) {
  const start = iconPathsBlock.indexOf(`"${key}":`);
  assert.ok(start >= 0, `${key} is drawn`);
  const rest = iconPathsBlock.slice(start + key.length + 3);
  const next = rest.search(/\n  ("[a-z-]+"|[a-z]+):/);
  return next < 0 ? rest : rest.slice(0, next);
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
