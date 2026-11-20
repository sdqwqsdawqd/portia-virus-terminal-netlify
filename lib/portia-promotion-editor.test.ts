import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { qualificationGrade } from "./portia-qualification.ts";

const main = readFileSync(new URL("../components/portia-promotion-editor-main.tsx", import.meta.url), "utf8");
const ordinary = readFileSync(new URL("../components/portia-promotion-ordinary-editor.tsx", import.meta.url), "utf8");
const qualificationEditor = readFileSync(new URL("../components/portia-promotion-qualification-editor.tsx", import.meta.url), "utf8");
const questionDialog = readFileSync(new URL("../components/portia-qualification-question-dialog.tsx", import.meta.url), "utf8");
// Quick 261117-px5: the question form moved into a dialog; the pins that are about the form read the dialog together with the editor.
const qualification = qualificationEditor + questionDialog;
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

test("request badges count every request visible in the queue, not pending rows only", () => {
  assert.ok(main.includes("const ordinaryCount = queue.ordinary.length"));
  assert.ok(main.includes("const qualificationCount = queue.qualification.length"));
  assert.doesNotMatch(main, /\.filter\(\(row\) => row\.status === "pending"\)\.length/);
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
  // D-56 (20-37): the retention rule is no longer retold under the request; the list label stays.
  assert.ok(!main.includes("Незавершённые данные удаляются через 3 дня."));
});

test("owner/admin can reset a binding by exact nickname while selected reset keeps its existing guard", () => {
  assert.ok(main.includes("promotion-device-reset"));
  assert.ok(main.includes('maxLength={64}'));
  assert.ok(main.includes("disabled={!resetNickname.trim()}>СБРОСИТЬ ПРИВЯЗКУ</button>"));
  assert.ok(main.includes("{canManageEditors && <form"));
  assert.ok(main.includes('reviewerCommand("reset-device"'));
});

test("bank workspace exposes preview replacement and immutable confirmation", () => {
  const editors = ordinary + qualification;
  for (const label of ["ПЕРЕСОБРАТЬ", "ЗАМЕНИТЬ", "ПОДТВЕРДИТЬ НАБОР"]) assert.ok(editors.includes(label), label);
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
  assert.ok(qualification.includes("delete next[transitionKey]"));
  assert.ok(ordinary.includes("result?.state"));
  assert.ok(qualification.includes("result?.state"));
  assert.ok((ordinary + qualification).includes('role="status"'));
});

test("preview blockers explain exact active pool shortages", () => {
  assert.ok(ordinary.includes("taskBankLimitError"));
  // owner 2026-11-20, OWN-08: quotas removed; the qualification editor counts the active questions itself.
  assert.ok(qualification.includes("qualificationTestQuotas"));
  assert.ok(!qualification.includes("qualificationBankLimitError"));
  assert.ok(ordinary.includes("bank?.requiredCount"));
  assert.ok(!qualification.includes("bank?.quotas"));
});

test("item editors prevent duplicate writes and preserve text typed during save", () => {
  for (const editor of [ordinary, qualification]) {
    assert.ok(editor.includes("useRef"));
    assert.ok(editor.includes("savingRef.current"));
    assert.ok(editor.includes("setCommandState"));
  }
  assert.ok(ordinary.includes("current === submittedDraft"));
  assert.ok(qualification.includes("draft === submittedDraft"));
  assert.ok(qualification.includes("validateQuestionDraft"));
  assert.ok(qualification.includes("Проверьте варианты и правильный ответ"));
});

test("qualification questions select correct answers beside their options without zero-based index fields", () => {
  assert.ok(qualification.includes('className="promotion-answer-options"'));
  assert.ok(qualification.includes('type={draft.type === "single" ? "radio" : "checkbox"}'));
  assert.ok(qualification.includes("Правильный ответ: вариант"));
  assert.ok(qualification.includes("Правильный ответ"));
  assert.doesNotMatch(qualification, /Индекс(?:ы)? правильн/);
});

test("bank actions use the established control hierarchy and announce results", () => {
  const editors = ordinary + qualification;
  assert.ok(editors.includes('className="primary-control"'));
  assert.ok(editors.includes('className="secondary-control"'));
  assert.ok(editors.includes('className="danger-control"'));
  assert.ok(editors.includes('role="status"'));
  // Phase 26 (D-13b): the queue message is the status slot of the shared action bar (role="status", aria-live="polite").
  assert.match(main, /<EditorActionBar[\s\S]*?statusText=\{message\}/);
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
  assert.ok(main.includes("без восстановления"));
  // D-56 (20-37): the confirmation is one short phrase and keeps the irreversibility.
  assert.ok(main.includes("Запрос и связанные данные будут удалены без восстановления."));
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
  // Phase 26 (D-13a): a branch is a section of the tab, so the current one is aria-current (the 26-07 section tabs);
  // the request types are filters of one list, so they stay toggles with aria-pressed.
  assert.ok(main.includes('aria-current={branch === id ? "true" : undefined}'));
  assert.ok(!main.includes("aria-pressed={branch === id}"));
  assert.ok(main.includes('aria-pressed={kind === "ordinary"}'));
  assert.ok(main.includes('aria-pressed={kind === "qualification"}'));
  assert.ok(main.includes("moveButtonTab"));
  assert.ok(main.includes('event.key === "ArrowRight"'));
  assert.ok(main.includes('"ArrowLeft"'));
});

test("bank workflow tabs mark the current step with aria-current; the banks are a list/detail body beside the old classes", () => {
  for (const [editor, layout] of [[ordinary, "promotion-ordinary-editor"], [qualification, "promotion-qualification-editor"]] as const) {
    // Phase 26 (D-13a): «1. СОЗДАТЬ …» / «2. ВЫДАТЬ …» switch the view of the tab, so the current one is aria-current.
    assert.ok(editor.includes('aria-current={mode === "create" ? "true" : undefined}'), `${layout}: create`);
    assert.ok(editor.includes('aria-current={mode === "issue" ? "true" : undefined}'), `${layout}: issue`);
    assert.ok(!editor.includes("aria-pressed={mode ==="), `${layout}: no aria-pressed on the workflow tabs`);
    // D-12: list on the left, editor or preview on the right; the phone keeps its list → editor/preview steps.
    assert.ok(editor.includes(`<div className="promotion-bank-layout ${layout} etab-body" data-mode={mode}>`), `${layout}: body`);
    assert.ok(editor.includes('{(!isPhone || bankView === "list") && <aside className="promotion-bank-list etab-list">'), `${layout}: list`);
    assert.ok(editor.includes('{(!isPhone || bankView === "editor") && <section className="promotion-bank-editor etab-detail">'), `${layout}: editor`);
    assert.ok(editor.includes('{(!isPhone || bankView === "preview") && <aside className="promotion-preview etab-detail">'), `${layout}: preview`);
    assert.ok(editor.includes("← НАЗАД К БАНКАМ"), `${layout}: phone back`);
  }
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
  // D-56 (20-37): the empty state has its title only; the hint under it is gone.
  assert.ok(!main.includes("Оставьте вкладку открытой"));
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

test("grade buttons carry a visible label, a question-numbered accessible name and aria-pressed", () => {
  assert.ok(main.includes('<span className="promotion-grade-label">Верно</span>'));
  assert.ok(main.includes('<span className="promotion-grade-label">Неверно</span>'));
  assert.ok(main.includes("`Ответ верен, вопрос ${index + 1}`"));
  assert.ok(main.includes("`Ответ неверен, вопрос ${index + 1}`"));
  assert.ok(main.includes("aria-pressed={answer.correct === true}"));
  assert.ok(main.includes("aria-pressed={answer.correct === false}"));
  assert.ok(main.includes("<span>ВОПРОС {index + 1}</span>"), "visible number must equal the aria-label number");
  assert.match(styles, /\.promotion-grade-label\s*\{[^}]*font:\s*700 11px\/1\.25/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.promotion-grade-controls button\s*\{[^}]*min-height:\s*44px/);
});

test("the final outcome is sent only after the labelled confirmation and never from the percent", () => {
  const finalize = [...main.matchAll(/"finalize-attempt"/g)];
  assert.equal(finalize.length, 1, "one finalize path, reachable only through the confirmation");
  for (const hit of finalize) assert.match(main.slice(Math.max(0, hit.index - 40), hit.index), /run: \(\) => void onCommand\($/);
  assert.ok(main.includes('confirmLabel: "Подтвердить итог"'));
  assert.ok(main.includes('cancelLabel: "Не подтверждать"'));
  assert.ok(main.includes("Подтвердите итог:"));
  assert.ok(main.includes("aria-disabled={outcomeBlocked}"));
  assert.ok(main.includes("Отметьте все ответы"));
  const result = qualificationGrade([{ id: "q1", type: "single", text: "Q", options: ["A"], answerKey: 0 }], [], { q1: true });
  for (const marks of [{} as Record<string, boolean>, { q1: true }]) {
    const graded = qualificationGrade([{ id: "q1", type: "single", text: "Q", options: ["A"], answerKey: 0 }], [], marks);
    assert.deepEqual(Object.keys(graded).sort(), ["items", "percent"]);
  }
  assert.equal(result.percent, 100);
  assert.equal(qualificationGrade([], [], {}).percent, 0);
});

test("confirmations name the action being declined and never use a generic cancel label", () => {
  const all = main + ordinary + qualification;
  assert.ok(main.includes("intent.cancelLabel"));
  assert.ok(main.includes("intent.confirmLabel"));
  assert.doesNotMatch(all, />\s*ОТМЕНИТЬ\s*</);
  assert.doesNotMatch(all, />\s*Отмена\s*</);
  assert.doesNotMatch(all, /ПОДТВЕРДИТЬ<\/button><\/div>/);
  for (const label of ["Удалить запрос", "Не удалять", "Снять claim", "Не снимать"]) assert.ok(main.includes(label), label);
  for (const label of ["Удалить вопрос", "Оставить вопрос", "Удалить вопрос «${item.text}»? Это нельзя отменить."]) assert.ok(qualification.includes(label), label);
  assert.equal([...(all.match(/requestConfirm\(\{|setConfirm\(\{|onConfirm\(\{/g) ?? [])].length, [...(all.match(/cancelLabel: "/g) ?? [])].length);
});

test("bank editors explain a blocked confirmation next to an aria-disabled button", () => {
  for (const editor of [ordinary, qualification]) {
    assert.ok(editor.includes('className="promotion-bank-reason"'));
    assert.ok(editor.includes('id="promotion-bank-reason"'));
    assert.ok(editor.includes('aria-describedby={disabledReason ? "promotion-bank-reason" : undefined}'));
    assert.ok(editor.includes("aria-disabled={Boolean(disabledReason) || busy}"));
    assert.doesNotMatch(editor, /title=\{disabledReason\}/);
  }
  assert.doesNotMatch(ordinary, /Недостаточно активных заданий\./);
});

test("any bank mutation shows the stale-preview banner until the set is rebuilt", () => {
  for (const editor of [ordinary, qualification]) {
    assert.ok(editor.includes("Набор изменился — пересоберите превью"));
    assert.ok(editor.includes("previewStale"));
    assert.ok(editor.includes("setPreviewStale(true)"));
    assert.ok(editor.includes("setPreviewStale(false)"));
  }
});

test("a save response never overwrites newer edits of counts and quotas", () => {
  assert.ok(ordinary.includes("submittedCount"));
  assert.ok(ordinary.includes("current[transition.targetTitleId] !== submittedCount"));
  // owner 2026-11-20, OWN-08: quotas removed - no quota draft, nothing to overwrite; the rules draft keeps the same guard.
  assert.ok(!qualification.includes("submittedQuotas") && !qualification.includes("quotaDrafts"));
  assert.ok(qualification.includes("current[transitionKey] !== submittedRules"));
});

test("a failed save keeps the typed draft and reports the network failure in Russian", () => {
  // D-56 (20-37): the failure text lost its «повторите попытку» tail.
  assert.ok(main.includes("Нет связи с сервером. Черновик сохранён в форме."));
  for (const editor of [ordinary, qualification]) {
    const afterFailure = editor.slice(editor.indexOf("if (!result?.state)"), editor.indexOf("setPreview(null);"));
    assert.ok(afterFailure.includes('phase: "error"'));
    assert.ok(afterFailure.includes("return null"));
  }
});

test("a 403 without an error code closes the workspace and drops loaded reviewer data", () => {
  assert.ok(main.includes("response.status === 403 && typeof body.code !== \"string\""));
  assert.ok(main.includes('role="alert"'));
  assert.ok(main.includes("Доступ закрыт"));
  const deny = main.slice(main.indexOf("const deny = "), main.indexOf("const deny = ") + 400);
  for (const reset of ["setQueue(emptyQueue)", "setBanks(emptyBanks)", 'setSelectedRequestId("")', "setDenied(true)"]) assert.ok(deny.includes(reset), reset);
  for (const loader of ["loadQueue", "loadBanks", "reviewerCommand", "postBank", "resetDevice"]) {
    const body = main.slice(main.indexOf(`const ${loader} = `), main.indexOf(`const ${loader} = `) + 900);
    assert.ok(body.includes("isDenied(response, body)"), loader);
  }
  assert.doesNotMatch(main, /Доступ закрыт[^"`]*(?:Вкладка|причин)/);
});

test("a missing server part is not shown as an empty queue", () => {
  assert.ok(main.includes('body.code === "pending-database"'));
  assert.ok(main.includes("Серверная часть раздела не обновлена."));
  assert.ok(main.includes('queueStatus === "loading"'));
  assert.ok(main.includes('queueStatus === "ready"'));
  assert.ok(main.includes('banksStatus !== "ready"'));
  assert.ok(main.includes("promotion-skeleton"));
  assert.ok(main.includes("НОВЫХ ЗАПРОСОВ НЕТ"));
  assert.ok(main.includes("ОЧЕРЕДЬ НЕ ЗАГРУЖЕНА"));
});

test("a failed attempt proposes a two-day retake that the reviewer can change, extend or drop", () => {
  assert.ok(main.includes("useState(2)"));
  assert.ok(main.includes("Срок пересдачи, дней (0 — без ожидания)"));
  assert.ok(main.includes("min={0} max={365}"));
  assert.ok(main.includes("ОТКРЫТЬ ПЕРЕСДАЧУ ДОСРОЧНО"));
  assert.ok(main.includes('"release-retake"'));
  assert.ok(main.includes("Срок пересдачи: ${retakeDays} дн."));
});

test("quick 261117-px5: questions are built in a dialog with one row per option and the old inline form is gone", () => {
  assert.ok(questionDialog.includes('role="dialog"'));
  assert.ok(questionDialog.includes('aria-modal="true"'));
  assert.ok(questionDialog.includes("aria-labelledby"));
  assert.ok(questionDialog.includes('event.key === "Escape"'));
  assert.ok(questionDialog.includes("opener?.focus()"));
  assert.ok(qualificationEditor.includes("+ ВОПРОС"));
  assert.ok(questionDialog.includes("+ ВАРИАНТ"));
  for (const label of ["ОДИН ОТВЕТ", "НЕСКОЛЬКО", "СВОБОДНЫЙ"]) assert.ok(questionDialog.includes(label), label);
  assert.ok(questionDialog.includes("aria-pressed={draft.type === value}"));
  assert.ok(questionDialog.includes("Образец ответа для проверяющего"));
  assert.ok(questionDialog.includes("Отметьте правильный ответ слева от варианта."));
  assert.ok(questionDialog.includes("Удалить вариант"));
  assert.ok(qualificationEditor.includes("PortiaQualificationQuestionDialog"));
  assert.ok(!qualificationEditor.includes("promotion-question-form-anchor"));
  assert.ok(!qualificationEditor.includes("по одному в строке"));
  assert.ok(!questionDialog.includes("<select"), "the type is chosen with segmented buttons, not a select");
  assert.match(styles, /\.promotion-question-dialog\s*\{[^}]*width:\s*min\(880px/);
  assert.match(styles, /\.promotion-question-types button\s*\{[^}]*flex:\s*0 0 auto/);
});

test("owner 2026-11-20, OWN-08: quotas removed - one composition line, no quota fields, no save-quotas button", () => {
  for (const gone of ["quotaDrafts", "promotion-quota-settings", "promotion-quota-summary", "qualificationQuotaSummary", "СОХРАНИТЬ КВОТЫ", "Сначала сохраните квоты", "quotasAreDraft"]) assert.ok(!qualificationEditor.includes(gone), gone);
  for (const label of [">Один ответ<", ">Несколько<", ">Свободный<"]) assert.ok(!qualificationEditor.includes(label), label);
  assert.ok(!/type="number"/.test(qualificationEditor), "no number field is left in the editor");
  assert.ok(qualificationEditor.includes("qualificationTestSummary(activePools)"));
  assert.ok(qualificationEditor.includes("Сначала добавьте вопрос."));
});

test("owner 2026-11-20, OWN-08: «+ ВОПРОС» works for a transition without a bank and the first question creates it", () => {
  assert.match(qualificationEditor, /<button className="primary-control" type="button" disabled=\{busy\} onClick=\{\(event\) => openNewQuestion\(event\.currentTarget\)\}>\+ ВОПРОС<\/button>/);
  const create = qualificationEditor.slice(qualificationEditor.indexOf("const bankIdForQuestion"), qualificationEditor.indexOf("const mutate = async"));
  assert.ok(create.includes('action: "save-qualification-bank"'));
  assert.ok(create.includes("qualificationTestQuotas([{ type: firstType, active: true }])"));
  assert.ok(create.includes("qualificationBanks"));
  // The bank is made first, then the question is saved into the bank the answer names.
  assert.ok(create.indexOf('"save-qualification-bank"') < create.indexOf('action: "save-question"'));
  assert.match(create, /action: "save-question", bankId,/);
  // A refused bank keeps the question in the dialog: the function returns before save-question and the dialog is closed only on a result.
  assert.ok(create.includes("if (!bankId) return;"));
});

test("owner 2026-11-20, OWN-08: the set is every active question, capped at 100 with a visible line", () => {
  assert.ok(qualificationEditor.includes("qualificationSetMessages.capped("));
  assert.ok(qualificationEditor.includes("QUALIFICATION_TEST_MAX"));
  assert.match(qualificationEditor, /className="promotion-command-state error" role="status">\{cappedLine\}/);
  assert.ok(qualificationEditor.includes("Отмечено: {selectedPool.length} из {QUALIFICATION_TEST_MAX}"));
  assert.ok(qualificationEditor.includes("СОБРАТЬ АВТОМАТИЧЕСКИ") && !qualificationEditor.includes("СОБРАТЬ СЛУЧАЙНО"));
  assert.ok(qualificationEditor.includes("qualificationSetProblem(selectedPool.length)"));
  assert.ok(qualificationEditor.includes("qualificationSetMessages.tooLarge.text") && qualificationEditor.includes("qualificationSetMessages.empty.text"));
  // The marked set is sent as the active marked ids only, so a question switched off after marking never reaches the server.
  assert.ok(qualificationEditor.includes("manualIds: selectedPool.map((item) => item.id)"));
});

test("quick 261117-px5: rules are saved with their own action, keep the open preview and refuse without the migration", () => {
  assert.ok(qualificationEditor.includes("save-qualification-rules"));
  assert.ok(qualificationEditor.includes("ПРАВИЛА ДЛЯ КАНДИДАТА"));
  assert.ok(qualificationEditor.includes("СОХРАНИТЬ ПРАВИЛА"));
  assert.ok(qualificationEditor.includes("keepPreview: true"));
  assert.ok(qualificationEditor.includes("Правила станут доступны после обновления базы — миграция ждёт владельца."));
  assert.ok(qualificationEditor.includes("Сначала добавьте вопрос."));
  assert.ok(qualificationEditor.includes("QUALIFICATION_RULES_MAX_LENGTH"));
  const route = readFileSync(new URL("../app/api/promotion/banks/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes('body.action === "save-qualification-rules"'));
  assert.ok(route.includes("portia_promo_save_qualification_rules"));
  assert.ok(route.includes("qualificationRulesSaveFailure(error.code)"));
  assert.ok(route.indexOf("save-qualification-rules") > route.indexOf("64 * 1024") && route.indexOf("save-qualification-rules") < route.indexOf("parsePromotionBankCommand(body)"));
  assert.match(route, /Response\.json\(\{ id: data, state: reloaded \}/);
});
