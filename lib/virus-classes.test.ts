import test from "node:test";
import assert from "node:assert/strict";
import { defaultPortiaContent, legacyClassificationNames } from "./portia-content.ts";

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
