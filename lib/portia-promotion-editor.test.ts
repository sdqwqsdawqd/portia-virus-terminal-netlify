import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/portia-promotion-editor.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../components/portia-promotion-editor-main.tsx", import.meta.url), "utf8");
const ordinary = readFileSync(new URL("../components/portia-promotion-ordinary-editor.tsx", import.meta.url), "utf8");
const qualification = readFileSync(new URL("../components/portia-promotion-qualification-editor.tsx", import.meta.url), "utf8");
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

test("owner/admin can reset a binding by exact nickname while selected reset keeps its existing guard", () => {
  assert.ok(source.includes("promotion-device-reset"));
  assert.ok(source.includes('maxLength={64}'));
  assert.ok(source.includes("СБРОСИТЬ ПРИВЯЗКУ ПО НИКУ"));
  assert.ok(source.includes("{canManageEditors && <form"));
  assert.ok(source.includes('{canManageEditors && <button type="button" onClick={() => void reviewerCommand("reset-device"'));
});

test("bank workspace exposes preview replacement and immutable confirmation", () => {
  const editors = ordinary + qualification;
  for (const label of ["ПЕРЕСОБРАТЬ", "ЗАМЕНИТЬ", "ПОДТВЕРДИТЬ НАБОР", "Недостаточно активных"]) assert.ok(editors.includes(label), label);
  assert.ok(main.includes("PortiaPromotionOrdinaryEditor"));
  assert.ok(main.includes("PortiaPromotionQualificationEditor"));
  assert.ok(ordinary.includes("save-task-item"));
  assert.ok(qualification.includes("save-question"));
  assert.ok(qualification.includes("free-text"));
  assert.ok(editors.includes("replaceId"));
});

test("request rejection and owner deletion use explicit irreversible confirmations", () => {
  assert.ok(main.includes('reviewerCommand("reject"'));
  assert.ok(main.includes('reviewerCommand("delete-request"'));
  assert.ok(main.includes("УДАЛИТЬ ЗАЯВКУ"));
  assert.ok(main.includes("без возможности восстановления"));
  assert.ok(main.includes("Привязка устройства останется активной"));
  assert.match(main, /action === "reject" \|\| action === "delete-request"[\s\S]*setSelectedRequestId\(""\)/);
});

test("promotion reviewer layout has desktop workbench and phone sequential view", () => {
  assert.match(styles, /\.promotion-editor-workbench\s*\{/);
  assert.match(styles, /grid-template-columns:\s*280px minmax\(0,\s*1fr\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.promotion-editor-workbench/);
});
