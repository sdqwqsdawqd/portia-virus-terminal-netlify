import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/portia-promotion-editor.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");

test("promotion editor mounts only through the granted trusted tab", () => {
  assert.ok(shell.includes('"promo"'));
  assert.ok(shell.includes('tab === "promo" && openTabs.includes("promo")'));
  assert.ok(shell.includes("<PromotionEditor visible={active && !minimized}"));
});

test("promotion editor keeps requests, tasks and qualification as separate branches", () => {
  for (const label of ["ЗАПРОСЫ", "ЗАДАНИЯ", "КВАЛИФИКАЦИЯ"]) assert.ok(source.includes(label), label);
  assert.ok(source.includes("promotion-editor-branches"));
  assert.ok(source.includes("ordinaryCount"));
  assert.ok(source.includes("qualificationCount"));
});

test("promotion editor polls only while visible and preserves its selected request", () => {
  assert.ok(source.includes("if (!visible || document.visibilityState !== \"visible\") return"));
  assert.ok(source.includes("setSelectedRequestId((current)"));
  assert.ok(source.includes("Запрос уже взят другим проверяющим."));
});

test("claim is the gate for mutations and cleanup stays an unobtrusive hint", () => {
  assert.ok(source.includes("ВЗЯТЬ ЗАПРОС"));
  assert.ok(source.includes("assignedToMe"));
  assert.ok(source.includes("ОТКЛОНИТЬ"));
  assert.ok(source.includes("Незавершённые данные удаляются через 3 дня."));
});

test("bank workspace exposes preview replacement and immutable confirmation", () => {
  for (const label of ["ПЕРЕСОБРАТЬ", "ЗАМЕНИТЬ", "ПОДТВЕРДИТЬ НАБОР", "Недостаточно активных элементов"]) assert.ok(source.includes(label), label);
  assert.ok(source.includes("PromotionConfirmDialog"));
  assert.ok(source.includes("save-task-item"));
  assert.ok(source.includes("save-question"));
  assert.ok(source.includes("free-text"));
  assert.ok(source.includes("replaceId"));
});

test("promotion reviewer layout has desktop workbench and phone sequential view", () => {
  assert.match(styles, /\.promotion-editor-workbench\s*\{/);
  assert.match(styles, /grid-template-columns:\s*280px minmax\(0,\s*1fr\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.promotion-editor-workbench/);
});
