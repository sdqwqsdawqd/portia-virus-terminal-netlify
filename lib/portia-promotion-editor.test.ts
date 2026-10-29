import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  for (const label of ["ЗАПРОСЫ", "ЗАДАНИЯ", "КВАЛИФИКАЦИЯ"]) assert.ok(main.includes(label), label);
  assert.ok(main.includes("promotion-editor-branches"));
  assert.ok(main.includes("ordinaryCount"));
  assert.ok(main.includes("qualificationCount"));
});

test("promotion editor polls only while visible and preserves its selected request", () => {
  assert.ok(main.includes("if (!visible || document.visibilityState !== \"visible\") return"));
  assert.ok(main.includes("setSelectedRequestId((current)"));
  assert.ok(main.includes("Запрос уже взят другим проверяющим."));
});

test("claim is the gate for mutations and cleanup stays an unobtrusive hint", () => {
  assert.ok(main.includes("ВЗЯТЬ ЗАПРОС"));
  assert.ok(main.includes("assignedToMe"));
  assert.ok(main.includes("ОТКЛОНИТЬ"));
  assert.ok(main.includes("Незавершённые данные удаляются через 3 дня."));
});

test("owner/admin can reset a binding by exact nickname while selected reset keeps its existing guard", () => {
  assert.ok(main.includes("promotion-device-reset"));
  assert.ok(main.includes('maxLength={64}'));
  assert.ok(main.includes("СБРОСИТЬ ПРИВЯЗКУ ПО НИКУ"));
  assert.ok(main.includes("{canManageEditors && <form"));
  assert.ok(main.includes('reviewerCommand("reset-device"'));
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

test("bank settings keep drafts until an authoritative save settles", () => {
  assert.ok(ordinary.includes('setCommandState({ phase: "saving"'));
  assert.ok(qualification.includes('setCommandState({ phase: "saving"'));
  assert.ok(ordinary.includes("delete next[transition.targetTitleId]"));
  assert.ok(qualification.includes("delete next[transition.transitionId]"));
  assert.ok(ordinary.includes("result?.state"));
  assert.ok(qualification.includes("result?.state"));
  assert.ok((ordinary + qualification).includes('role="status"'));
});

test("preview blockers explain exact active pool shortages", () => {
  assert.ok(ordinary.includes("taskBankLimitError"));
  assert.ok(qualification.includes("qualificationBankLimitError"));
  assert.ok(ordinary.includes("bank?.requiredCount"));
  assert.ok(qualification.includes("bank?.quotas"));
});

test("item editors prevent duplicate writes and preserve text typed during save", () => {
  for (const editor of [ordinary, qualification]) {
    assert.ok(editor.includes("useRef"));
    assert.ok(editor.includes("savingRef.current"));
    assert.ok(editor.includes("setCommandState"));
  }
  assert.ok(ordinary.includes("current === submittedDraft"));
  assert.ok(qualification.includes("current === submittedText"));
  assert.ok(qualification.includes("validateQuestionDraft"));
  assert.ok(qualification.includes("Проверьте варианты и правильный ответ"));
});

test("bank actions use the established control hierarchy and announce results", () => {
  const editors = ordinary + qualification;
  assert.ok(editors.includes('className="primary-control"'));
  assert.ok(editors.includes('className="secondary-control"'));
  assert.ok(editors.includes('className="danger-control"'));
  assert.ok(editors.includes('role="status"'));
  assert.ok(main.includes('<p className="promotion-editor-message" role="status">'));
  assert.match(styles, /\.promotion-command-state\s*\{/);
  assert.match(styles, /\.promotion-command-state\.error\s*\{/);
});

test("every successful item mutation invalidates the local preview", () => {
  assert.ok(ordinary.includes("settleMutation"));
  assert.ok(qualification.includes("settleMutation"));
  assert.ok(ordinary.includes("setPreview(null)"));
  assert.ok(qualification.includes("setPreview(null)"));
});

test("editors bind previews to the version returned by the server", () => {
  for (const editor of [ordinary, qualification]) {
    assert.ok(editor.includes('typeof result.version === "string"'));
    assert.ok(editor.includes("version: result.version"));
  }
  const route = readFileSync(new URL("../app/api/promotion/banks/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("replacePreviewItem"));
  assert.ok(route.includes('code: "stale-preview"'));
  assert.ok(route.includes("new Set(ids).size !== ids.length"));
});

test("request rejection and owner deletion use explicit irreversible confirmations", () => {
  assert.ok(main.includes('reviewerCommand("reject"'));
  assert.ok(main.includes('reviewerCommand("delete-request"'));
  assert.ok(main.includes("УДАЛИТЬ ЗАЯВКУ"));
  assert.ok(main.includes("без возможности восстановления"));
  assert.ok(main.includes("Привязка устройства останется активной"));
  assert.match(main, /action === "reject" \|\| action === "delete-request"[\s\S]*setSelectedRequestId\(""\)/);
});

test("all destructive actions share one focus-managed confirmation dialog", () => {
  const actualEditors = main + ordinary + qualification;
  assert.doesNotMatch(actualEditors, /window\.confirm/);
  assert.ok(main.includes("confirmButtonRef"));
  assert.ok(main.includes("focusableElements"));
  assert.ok(main.includes('event.key === "Escape"'));
  assert.ok(main.includes("opener?.focus()"));
  assert.ok(ordinary.includes("requestConfirm"));
  assert.ok(qualification.includes("requestConfirm"));
});

test("actual branch and queue controls expose button-tab semantics and arrow navigation", () => {
  assert.ok(main.includes('aria-label="Разделы повышения"'));
  assert.ok(main.includes('aria-label="Типы запросов"'));
  assert.ok(main.includes("aria-pressed={branch === id}"));
  assert.ok(main.includes('aria-pressed={kind === "ordinary"}'));
  assert.ok(main.includes("moveButtonTab"));
  assert.ok(main.includes('event.key === "ArrowRight"'));
  assert.ok(main.includes('"ArrowLeft"'));
});

test("promotion reviewer layout has desktop workbench and phone sequential view", () => {
  assert.match(styles, /\.promotion-editor-workbench\s*\{/);
  assert.match(styles, /grid-template-columns:\s*280px minmax\(0,\s*1fr\)/);
  assert.ok(main.includes('requestView === "queue"'));
  assert.ok(main.includes('requestView === "detail"'));
  assert.ok(main.includes("promotion-phone-back"));
  for (const editor of [ordinary, qualification]) {
    assert.ok(editor.includes('bankView === "list"'));
    assert.ok(editor.includes('bankView === "editor"'));
    assert.ok(editor.includes('bankView === "preview"'));
    assert.ok(editor.includes("promotion-phone-back"));
  }
});

test("actual request workspace exposes contractual empty and cleanup states", () => {
  assert.ok(main.includes("НОВЫХ ЗАПРОСОВ НЕТ"));
  assert.ok(main.includes("Оставьте вкладку открытой — список обновится автоматически."));
  assert.ok(main.includes("cleanupPreview"));
  assert.ok(main.includes("promotion-cleanup-disclosure"));
  assert.ok(main.includes("Дата удаления"));
});

test("reviewer style contract keeps readable labels and forty-pixel controls", () => {
  const promotionStyles = styles.slice(styles.indexOf("/* Promotion is a standalone"));
  assert.match(promotionStyles, /\.promotion-device-reset label[^\{]*\{[^}]*font:\s*700 11px/);
  assert.match(promotionStyles, /\.promotion-device-reset input[^\{]*\{[^}]*min-height:\s*40px/);
  assert.match(promotionStyles, /\.promotion-bank-settings input[^\{]*\{[^}]*min-height:\s*40px/);
  assert.match(promotionStyles, /\.promotion-request-list em[^\{]*\{[^}]*font:\s*700 11px/);
  assert.match(promotionStyles, /\.promotion-grade-controls button[^\{]*\{[^}]*font:\s*700 11px/);
});
