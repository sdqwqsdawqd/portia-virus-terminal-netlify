import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatLaunchLabels, nameContainsVisibleText, visibleLaunchText } from "./format-launch.ts";

const titles = ["Внешние характеристики", "Мутация 1: ПОВЕДЕНИЕ", "Очень длинное название текстового поля, которое на телефоне обрезается многоточием"];

test("the empty state: the name starts the visible text «выберите текст» (WCAG 2.5.3)", () => {
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

test("the old field name, which dropped the visible title, is caught by the check", () => {
  assert.equal(nameContainsVisibleText("Оформление текста: Внешние характеристики", "ОФОРМЛЕНИЕ Внешние характеристики"), false);
});

test("the template builder uses the shared launch button; the editor's own launch code is not part of this change", () => {
  const builder = readFileSync(new URL("../components/portia-template-builder.tsx", import.meta.url), "utf8");
  assert.match(builder, /<FormatLaunchButton\b/);
  assert.doesNotMatch(builder, /aria-label=\{formatTarget \?/);
  const shared = readFileSync(new URL("../components/portia-editor-rich-text.tsx", import.meta.url), "utf8");
  assert.match(shared, /formatLaunchLabels\(target \? target\.title : null\)/);
  assert.match(shared, /aria-label=\{labels\.accessibleName\}/);
});
