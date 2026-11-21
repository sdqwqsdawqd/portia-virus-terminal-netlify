"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ordinaryPromotionTransitions, promotionTitles, qualificationPromotionTransitions } from "@/lib/portia-promotion";
import { requestForActiveQueue } from "@/lib/portia-promotion-editor-state";
import { validateQuestionDraft } from "@/lib/portia-promotion-reviewer";
import { builderDraftPayload, draftFromItem, qualificationTestQuotas, type BuilderDraft } from "@/lib/portia-qualification-builder";
import { QUALIFICATION_RULES_MAX_LENGTH, qualificationPreStartLines } from "@/lib/portia-qualification-rules";
import { PROMO_NEW_TASK_TEXT, promoMoveId, promoNewQuestion, promoNextOrder, promoOrderChanges, promoQuestionEdit, type LiveTarget, type PromoQuestionType } from "@/lib/live-edit";
import { EditorActionBar } from "@/components/portia-editor-tab-shell";
import { OrderDragHandle } from "@/components/portia-editor-dossier";
import { LiveCommitText, LiveModeToggle, liveCopy } from "@/components/portia-editor-live";
import { LiveEditContext, type LiveEditApi } from "@/components/portia-live-edit";
import { CandidateCardHeader, CandidatePrestart, CandidateQuestion, CandidateRules, CandidateTasks, type QualificationQuestion } from "@/components/portia-promotion";
import { PortiaQualificationQuestionDialog } from "@/components/portia-qualification-question-dialog";
import { PortiaPromotionOrdinaryEditor } from "./portia-promotion-ordinary-editor";
import { PortiaPromotionQualificationEditor } from "./portia-promotion-qualification-editor";

type Branch = "requests" | "tasks" | "qualification";
type Kind = "ordinary" | "qualification";
type ReviewerAnswer = { answerId: string; questionId: string; questionText: string; questionType: "single" | "multiple" | "free-text"; options: string[]; answer: string | string[]; correct: boolean | null };
type ReviewerRequest = { requestId: string; nickname: string; nicknameKey: string; titleId: string; targetTitleId: string; status: string; claimed: boolean; assignedToMe: boolean; createdAt: string; attemptId?: string | null; attemptStatus?: string | null; retakeAt?: string | null; technicalFailure?: string | null; answers?: ReviewerAnswer[] };
type CleanupRow = { requestId: string; kind: Kind; status: string; nickname: string; deleteAt: string; due: boolean };
type ReviewerState = { ordinary: ReviewerRequest[]; qualification: ReviewerRequest[]; serverNow?: string; cleanupPreview?: CleanupRow[] };
type BankItem = { id: string; text: string; active: boolean; sortOrder: number; type?: "single" | "multiple" | "free-text"; options?: Array<{ text: string }> | string[]; answerKey?: unknown };
type Bank = { id: string; targetTitleId?: string; transitionId?: string; version: string; rulesText?: string; requiredCount?: number; quotas?: { single: number; multiple: number; freeText: number }; items: BankItem[] };
type BankState = { taskBanks: Bank[]; qualificationBanks: Bank[] };
export type ConfirmIntent = { title: string; body: string; confirmLabel: string; cancelLabel: string; run: () => void; opener?: HTMLElement | null };
const emptyQueue: ReviewerState = { ordinary: [], qualification: [] };
const emptyBanks: BankState = { taskBanks: [], qualificationBanks: [] };
const titleLabels = new Map<string, string>(promotionTitles.map((title) => [title.id, title.label]));
const requestStatusLabels: Record<string, string> = {
  pending: "Новый",
  claimed: "В работе",
  assigned: "Задания выданы",
  "awaiting-sheet-change": "Ожидает изменения звания",
  approved: "Допущен к проверке",
  testing: "Проходит проверку",
  grading: "Ожидает оценки",
  passed: "Проверка пройдена",
  failed: "Проверка не пройдена",
  rejected: "Отклонён",
  closed: "Закрыт",
};
const titleLabel = (id: string) => titleLabels.get(id) ?? id;
const requestStatusLabel = (status: string) => requestStatusLabels[status] ?? status;

async function responseBody(response: Response) { try { return await response.json() as Record<string, unknown>; } catch { return {}; } }
// Access revocation is a 403 without a command code; per-command 403s (command-failed, delete-forbidden) carry one.
const isDenied = (response: Response, body: Record<string, unknown>) => response.status === 403 && typeof body.code !== "string";
const errorText = (body: Record<string, unknown>, fallback: string) => body.code === "pending-database" ? "Серверная часть раздела не обновлена." : typeof body.error === "string" ? body.error : fallback;
type LoadStatus = "loading" | "ready" | "error";
const skeleton = <div className="promotion-skeleton" aria-busy="true" aria-label="Загрузка"><span /><span /><span /></div>;

function PromotionConfirmDialog({ intent, onCancel, onConfirm }: { intent: ConfirmIntent; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmButtonRef.current?.focus();
    const opener = intent.opener;
    return () => { opener?.focus(); };
  }, [intent]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
    if (event.key !== "Tab") return;
    const focusableElements = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    if (!focusableElements.length) return;
    const first = focusableElements[0]; const last = focusableElements.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="promotion-confirm-backdrop" role="presentation"><section ref={dialogRef} className="promotion-confirm" role="alertdialog" aria-modal="true" aria-labelledby="promotion-confirm-title" aria-describedby="promotion-confirm-description" onKeyDown={onKeyDown}><h3 id="promotion-confirm-title">{intent.title}</h3><p id="promotion-confirm-description">{intent.body}</p><div><button type="button" onClick={onCancel}>{intent.cancelLabel}</button><button ref={confirmButtonRef} className="danger-control" type="button" onClick={onConfirm}>{intent.confirmLabel}</button></div></section></div>;
}

function moveButtonTab(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
  const buttons = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? [])];
  const current = buttons.indexOf(event.currentTarget); if (current < 0 || !buttons.length) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].focus(); buttons[next].click();
}

const technicalFailureLabels: Record<string, string> = { timeout: "Истекло общее время теста", hidden: "Участник скрыл вкладку на ПК", blur: "Окно потеряло фокус на ПК", "page-exit": "Участник покинул страницу", offline: "Прервано соединение" };
const answerText = (answer: ReviewerAnswer) => Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer || "Ответ отсутствует";

function QualificationGrading({ row, busy, onCommand, onConfirm }: { row: ReviewerRequest; busy: boolean; onCommand: (action: string, extra?: Record<string, unknown>) => Promise<void>; onConfirm: (value: ConfirmIntent) => void }) {
  const [retakeDays, setRetakeDays] = useState(2); const answers = row.answers ?? []; const graded = answers.filter((answer) => typeof answer.correct === "boolean"); const percent = graded.length === answers.length && answers.length > 0 ? Math.round(graded.filter((answer) => answer.correct).length / answers.length * 100) : null; const technicalFailure = row.technicalFailure ? technicalFailureLabels[row.technicalFailure] ?? "Техническое завершение попытки" : "";
  const outcomeReason = answers.length === 0 ? "Ответов пока нет." : percent === null ? "Отметьте все ответы" : "";
  const outcomeBlocked = busy || percent === null;
  const askOutcome = (passed: boolean, opener: HTMLElement) => {
    if (outcomeBlocked) return;
    onConfirm({ title: `Подтвердите итог: ${passed ? "Проверка пройдена" : "Проверка не пройдена"}`, body: `Итог необратим и сохраняется отдельно от расчётного процента (${percent}%).${passed ? "" : ` Срок пересдачи: ${retakeDays} дн.`}`, confirmLabel: "Подтвердить итог", cancelLabel: "Не подтверждать", opener, run: () => void onCommand("finalize-attempt", { attemptId: row.attemptId, passed, percent, retakeDays }) });
  };
  if (!row.attemptId) return <div className="promotion-test-warning"><strong>ТЕСТ ЕЩЁ НЕ СОБРАН</strong><p>Соберите и подтвердите неизменяемый набор во вкладке «Квалификация».</p></div>;
  return <section className="promotion-grading-workspace"><header><div><span>ПРОВЕРКА ОТВЕТОВ</span><h3>{row.attemptStatus === "grading" ? "Ожидает решения" : "Текущая попытка"}</h3></div>{percent !== null && <strong>{percent}%</strong>}</header>{technicalFailure && <div className="promotion-technical-failure"><strong>АВТОМАТИЧЕСКИЙ ПРОВАЛ</strong><p>{technicalFailure}</p><button disabled={busy} onClick={() => void onCommand("override-failure", { attemptId: row.attemptId })}>ОТМЕНИТЬ АВТОПРОВАЛ</button></div>}{answers.length ? <div className="promotion-grade-answers">{answers.map((answer, index) => <article key={answer.answerId}><div className="promotion-grade-copy"><span>ВОПРОС {index + 1}</span><h4>{answer.questionText}</h4><p>{answerText(answer)}</p></div><div className="promotion-grade-controls" role="group" aria-label={`Оценка ответа ${index + 1}`}><button className={answer.correct === true ? "active correct" : ""} type="button" disabled={busy} aria-label={`Ответ верен, вопрос ${index + 1}`} aria-pressed={answer.correct === true} onClick={() => void onCommand("grade-answer", { answerId: answer.answerId, correct: true })}><span aria-hidden="true">✓</span> <span className="promotion-grade-label">Верно</span></button><button className={answer.correct === false ? "active incorrect" : ""} type="button" disabled={busy} aria-label={`Ответ неверен, вопрос ${index + 1}`} aria-pressed={answer.correct === false} onClick={() => void onCommand("grade-answer", { answerId: answer.answerId, correct: false })}><span aria-hidden="true">✗</span> <span className="promotion-grade-label">Неверно</span></button></div></article>)}</div> : <p className="promotion-cleanup-hint">Ответы появятся после прохождения теста.</p>}<div className="promotion-final-decision"><div><span>РАСЧЁТНЫЙ ПРОЦЕНТ</span><strong>{percent === null ? "—" : `${percent}%`}</strong></div><label>Срок пересдачи, дней (0 — без ожидания)<input type="number" min={0} max={365} value={retakeDays} onChange={(event) => setRetakeDays(Math.max(0, Math.min(365, Number(event.target.value) || 0)))} /></label><div className="promotion-final-actions"><button className="primary-control" type="button" aria-disabled={outcomeBlocked} aria-describedby={outcomeReason ? "promotion-outcome-reason" : undefined} onClick={(event) => askOutcome(true, event.currentTarget)}>Проверка пройдена</button><button className="danger-control" type="button" aria-disabled={outcomeBlocked} aria-describedby={outcomeReason ? "promotion-outcome-reason" : undefined} onClick={(event) => askOutcome(false, event.currentTarget)}>Проверка не пройдена</button></div>{outcomeReason && <p className="promotion-bank-reason" id="promotion-outcome-reason">{outcomeReason}</p>}</div>{row.retakeAt && <button className="promotion-release-retake" disabled={busy} onClick={(event) => onConfirm({ title: `Открыть пересдачу: ${row.nickname}`, body: "Срок ожидания будет снят досрочно.", confirmLabel: "Открыть пересдачу", cancelLabel: "Не открывать", run: () => void onCommand("release-retake", { attemptId: row.attemptId }), opener: event.currentTarget })}>ОТКРЫТЬ ПЕРЕСДАЧУ ДОСРОЧНО</button>}</section>;
}

// LIVE-01..04 (26.1-16): the live mode of «Повышения». The candidate's own components (rules, questions, tasks) are drawn on the data of the banks, and their texts are edited in place.
// The data is not in the shared draft of the editor but in the banks of the server, so every edit is one command of the ordinary tabs (save-qualification-rules, save-question, save-task-item, delete-*),
// written when the place is left; Escape cancels the edit. The state line is the one of the ordinary tabs. Only this seam provides the context; the candidate's window never does.
type LiveKind = "ordinary" | "qualification";
type LiveCommand = { phase: "idle" | "saving" | "saved" | "error"; message: string };
type LiveRowChange = { id: string; sortOrder: number };
type PostBank = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;

const optionTexts = (options: BankItem["options"]) => (options ?? []).map((option) => (typeof option === "string" ? option : option.text));

/** What a candidate gets of a question: the number, the text, the variants. Never the answer. */
function candidateQuestionOf(item: BankItem, index: number, total: number): QualificationQuestion {
  return { id: item.id, type: item.type ?? "free-text", text: item.text, options: optionTexts(item.options), index, total };
}

const shortName = (text: string) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

/** The order of the rows of a live list: a move shows at once, and the commands go out when the moves stop (one drag is many moves). */
function useLiveOrder<T extends { id: string; sortOrder: number }>(items: T[], persist: (changes: LiveRowChange[]) => Promise<unknown>) {
  const [pending, setPending] = useState<string[] | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef({ items, persist });
  useEffect(() => { latest.current = { items, persist }; });
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const order = pending !== null && pending.length === items.length && pending.every((id) => items.some((item) => item.id === id)) ? pending : null;
  const shown = order ? order.flatMap((id) => items.filter((item) => item.id === id)) : items;
  const move = (from: number, to: number) => {
    const next = promoMoveId(order ?? items.map((item) => item.id), from, to);
    setPending(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const now = latest.current;
      void now.persist(promoOrderChanges(now.items, next)).finally(() => setPending(null));
    }, 450);
  };
  return { shown, move };
}

function PromotionLiveSurface({ kind, banks, busy, post, requestConfirm }: { kind: LiveKind; banks: BankState; busy: boolean; post: PostBank; requestConfirm: (intent: ConfirmIntent) => void }) {
  const [transitionId, setTransitionId] = useState<string>(qualificationPromotionTransitions[0].transitionId);
  const [targetTitleId, setTargetTitleId] = useState<string>(ordinaryPromotionTransitions[0].targetTitleId);
  const [command, setCommand] = useState<LiveCommand>({ phase: "idle", message: "" });
  const [dialog, setDialog] = useState<{ itemId: string; draft: BuilderDraft; opener: HTMLElement | null } | null>(null);
  const savingRef = useRef(false);
  const qualification = kind === "qualification";
  const transition = qualificationPromotionTransitions.find((item) => item.transitionId === transitionId) ?? qualificationPromotionTransitions[0];
  const ordinary = ordinaryPromotionTransitions.find((item) => item.targetTitleId === targetTitleId) ?? ordinaryPromotionTransitions[0];
  const bank = (qualification ? banks.qualificationBanks.find((item) => item.transitionId === transition.transitionId) : banks.taskBanks.find((item) => item.targetTitleId === ordinary.targetTitleId)) ?? null;
  const items = bank?.items ?? [];
  const refuse = (message: string) => setCommand({ phase: "error", message });

  // One command at a time (T-26.1-40): a second one does not start while one is saving. A list of commands (a changed order) runs as one.
  const runCommands = async (payloads: Record<string, unknown>[], message: string) => {
    if (savingRef.current || payloads.length === 0) return null;
    savingRef.current = true;
    setCommand({ phase: "saving", message: liveCopy.promo.saving });
    try {
      let last: Record<string, unknown> | null = null;
      for (const payload of payloads) {
        last = await post(payload);
        if (!last?.state) { refuse(liveCopy.promo.notSaved); return null; }
      }
      setCommand({ phase: "saved", message });
      return last;
    } finally {
      savingRef.current = false;
    }
  };
  const run = (payload: Record<string, unknown>, message: string) => runCommands([payload], message);

  const taskBody = (bankId: string, item: BankItem, patch: { text?: string; active?: boolean; sortOrder?: number }) => ({ action: "save-task-item", bankId, itemId: item.id, text: patch.text ?? item.text, active: patch.active ?? item.active, sortOrder: patch.sortOrder ?? item.sortOrder });

  const commitText = async (target: LiveTarget, raw: string) => {
    if (!bank) return;
    if (target.kind === "promo-rules") { await run({ action: "save-qualification-rules", transitionId: transition.transitionId, rulesText: raw }, "Правила сохранены."); return; }
    if (target.kind === "promo-task-text") {
      const task = items.find((entry) => entry.id === target.taskId);
      if (!task) return;
      if (!raw.trim()) { refuse(liveCopy.promo.refusedTask); return; }
      await run(taskBody(bank.id, task, { text: raw }), "Задание обновлено.");
      return;
    }
    if (target.kind !== "promo-question-text" && target.kind !== "promo-question-option") return;
    const question = items.find((entry) => entry.id === target.questionId);
    if (!question) return;
    const body = promoQuestionEdit(question, target.kind === "promo-question-text" ? { text: raw } : { option: target.index, text: raw }, validateQuestionDraft);
    if (!body) { refuse(liveCopy.promo.refused); return; }
    await run({ action: "save-question", bankId: bank.id, questionId: question.id, ...body }, "Вопрос обновлён.");
  };

  const rulesAvailable = Boolean(bank) && typeof bank?.rulesText === "string";
  const rulesReason = !bank ? liveCopy.promo.rulesNoBank : !rulesAvailable ? liveCopy.promo.rulesNoMigration : "";
  const api: LiveEditApi = {
    app: "promo",
    text: (target, value, options) => target.kind === "promo-rules" && !rulesAvailable
      ? <span className="promo-live-readonly">{value}</span>
      : <LiveCommitText value={value} label={liveCopy.targets[target.kind]} placeholder={liveCopy.placeholders[target.kind]} multiline={options?.multiline} maxLength={target.kind === "promo-rules" ? QUALIFICATION_RULES_MAX_LENGTH : undefined} onCommit={(raw) => commitText(target, raw)} />,
    // the view of the candidate has only plain places; the rest of the tools of the live mode are not asked for here
    rich: () => null,
    image: () => null,
    video: () => null,
    cards: () => null,
    addBar: () => null,
    order: (_list, index) => ({ rowProps: { "data-sort-index": index }, handle: null }),
    date: () => null,
    flag: () => null,
    choice: () => null,
    remove: () => null,
  };

  const persistOrder = (changes: LiveRowChange[]) => {
    if (!bank) return Promise.resolve(null);
    const payloads = changes.flatMap((change): Record<string, unknown>[] => {
      const item = items.find((entry) => entry.id === change.id);
      if (!item) return [];
      if (!qualification) return [taskBody(bank.id, item, { sortOrder: change.sortOrder })];
      const body = promoQuestionEdit(item, { sortOrder: change.sortOrder }, validateQuestionDraft);
      return body ? [{ action: "save-question", bankId: bank.id, questionId: item.id, ...body }] : [];
    });
    return runCommands(payloads, liveCopy.promo.orderSaved);
  };
  const ordering = useLiveOrder(items, persistOrder);

  const switchItem = (item: BankItem) => {
    if (!bank) return;
    if (!qualification) { void run(taskBody(bank.id, item, { active: !item.active }), "Задание обновлено."); return; }
    const body = promoQuestionEdit(item, { active: !item.active }, validateQuestionDraft);
    if (!body) { refuse(liveCopy.promo.refused); return; }
    void run({ action: "save-question", bankId: bank.id, questionId: item.id, ...body }, "Вопрос обновлён.");
  };
  const removeItem = (item: BankItem, opener: HTMLElement) => {
    if (!bank) return;
    if (qualification) {
      requestConfirm({ title: "Удалить вопрос", body: `Удалить вопрос «${item.text}»? Это нельзя отменить.`, confirmLabel: "Удалить вопрос", cancelLabel: "Оставить вопрос", opener, run: () => void run({ action: "delete-question", bankId: bank.id, questionId: item.id }, "Вопрос удалён.") });
      return;
    }
    requestConfirm({ title: "Удалить задание", body: `Задание «${item.text}» будет удалено без возможности восстановления.`, confirmLabel: "Удалить задание", cancelLabel: "Оставить задание", opener, run: () => void run({ action: "delete-task-item", bankId: bank.id, itemId: item.id }, "Задание удалено.") });
  };
  // The first question of a transition creates its bank (as in the ordinary tab, OWN-08); the first task creates the bank of the title with one task in the set.
  const addQuestion = async (type: PromoQuestionType) => {
    let bankId = bank?.id ?? null;
    if (!bankId) {
      const created = await run({ action: "save-qualification-bank", transitionId: transition.transitionId, quotas: qualificationTestQuotas([{ type, active: true }]) }, "Банк перехода создан.");
      bankId = (created?.state as { qualificationBanks?: Bank[] } | undefined)?.qualificationBanks?.find((item) => item.transitionId === transition.transitionId)?.id ?? null;
      if (!bankId) { if (created) refuse(liveCopy.promo.bankError); return; }
    }
    await run({ action: "save-question", bankId, question: promoNewQuestion(type), active: true, sortOrder: promoNextOrder(items) }, "Вопрос добавлен.");
  };
  const addTask = async () => {
    let bankId = bank?.id ?? null;
    if (!bankId) {
      const created = await run({ action: "save-task-bank", targetTitleId: ordinary.targetTitleId, requiredCount: 1 }, "Банк заданий создан.");
      bankId = (created?.state as { taskBanks?: Bank[] } | undefined)?.taskBanks?.find((item) => item.targetTitleId === ordinary.targetTitleId)?.id ?? null;
      if (!bankId) { if (created) refuse(liveCopy.promo.bankError); return; }
    }
    await run({ action: "save-task-item", bankId, text: PROMO_NEW_TASK_TEXT, active: true, sortOrder: promoNextOrder(items) }, "Задание добавлено.");
  };
  // The correct answer and the type are not in the view of the candidate: they are edited in the dialog of the ordinary tab.
  const saveAnswer = async () => {
    if (!dialog || !bank) return;
    const item = items.find((entry) => entry.id === dialog.itemId);
    const question = validateQuestionDraft(builderDraftPayload(dialog.draft));
    if (!item) { setDialog(null); return; }
    if (!question) { refuse(liveCopy.promo.answerError); return; }
    const result = await run({ action: "save-question", bankId: bank.id, questionId: item.id, question, active: item.active, sortOrder: item.sortOrder }, "Вопрос обновлён.");
    if (result) setDialog(null);
  };

  const rowTools = (item: BankItem, index: number) => <div className="promo-live-tools live-tools">
    <OrderDragHandle index={index} label={shortName(item.text)} onMove={ordering.move} />
    {!item.active && <em className="live-draft-badge">{liveCopy.promo.off}</em>}
    <button type="button" className="secondary-control live-button" disabled={busy} onClick={() => switchItem(item)}>{item.active ? liveCopy.promo.switchOff : liveCopy.promo.switchOn}</button>
    {qualification && <button type="button" className="secondary-control live-button" disabled={busy} onClick={(event) => { setCommand({ phase: "idle", message: "" }); setDialog({ itemId: item.id, draft: draftFromItem(item), opener: event.currentTarget }); }}>{liveCopy.promo.answer}</button>}
    <button type="button" className="danger-control live-button live-remove" disabled={busy} aria-label={`${qualification ? liveCopy.promo.removeQuestion : liveCopy.promo.removeTask}: ${shortName(item.text)}`} onClick={(event) => removeItem(item, event.currentTarget)}>×</button>
  </div>;

  const transitionButton = (title: string, label: string, active: boolean, pick: () => void) => <button key={title} type="button" className={active ? "active" : ""} aria-current={active ? "true" : undefined} onKeyDown={moveButtonTab} onClick={() => { pick(); setCommand({ phase: "idle", message: "" }); }}>{label}</button>;
  return <div className="promo-live" data-live-app="promo" data-branch={kind}>
    <nav className="promotion-bank-workflow-tabs promo-live-nav" aria-label={liveCopy.promo.transition}>
      {qualification
        ? qualificationPromotionTransitions.map((item) => transitionButton(item.transitionId, item.label, item.transitionId === transition.transitionId, () => setTransitionId(item.transitionId)))
        : ordinaryPromotionTransitions.map((item) => transitionButton(item.targetTitleId, item.label, item.targetTitleId === ordinary.targetTitleId, () => setTargetTitleId(item.targetTitleId)))}
    </nav>
    {command.message && !dialog && <p className={`promotion-command-state ${command.phase}`} role="status">{command.message}</p>}
    <LiveEditContext.Provider value={api}>
      {qualification
        ? <section className="promotion-card promotion-qualification-card">
          <CandidateCardHeader kind="qualification" />
          <CandidatePrestart lines={qualificationPreStartLines({ clientMode: null, questionCount: items.filter((item) => item.active).length })}>
            <CandidateRules text={bank?.rulesText ?? ""} />
            {rulesReason && <p className="promotion-disabled-reason">{rulesReason}</p>}
          </CandidatePrestart>
          <div className="promotion-qualification-runner">
            <div className="promo-live-list">
              {ordering.shown.map((item, index) => <div key={item.id} className="promo-live-row" data-sort-index={index} data-inactive={item.active ? undefined : "true"}>
                {rowTools(item, index)}
                <CandidateQuestion question={candidateQuestionOf(item, index, ordering.shown.length)} index={index} total={ordering.shown.length} />
              </div>)}
              {items.length === 0 && <p className="promo-live-empty">{liveCopy.promo.questionsEmpty}</p>}
            </div>
          </div>
          <div className="live-add-bar live-tools" role="toolbar" aria-label={liveCopy.addGroup}>
            <span className="live-add-label">{liveCopy.promo.addQuestionLabel}</span>
            {(["single", "multiple", "free-text"] as const).map((type) => <button key={type} type="button" className="secondary-control live-button" disabled={busy} onClick={() => void addQuestion(type)}>{liveCopy.promo.addQuestion[type]}</button>)}
          </div>
        </section>
        : <section className="promotion-card promotion-ordinary-card">
          <CandidateCardHeader kind="ordinary" />
          <CandidateTasks tasks={ordering.shown.map((item, index) => ({ id: item.id, text: item.text, sortOrder: index + 1 }))} rowTools={(_task, index) => ordering.shown[index] ? rowTools(ordering.shown[index], index) : null} />
          {items.length === 0 && <p className="promo-live-empty">{liveCopy.promo.tasksEmpty}</p>}
          <div className="live-add-bar live-tools" role="toolbar" aria-label={liveCopy.addGroup}>
            <span className="live-add-label">{liveCopy.addLabel}</span>
            <button type="button" className="secondary-control live-button" disabled={busy} onClick={() => void addTask()}>{liveCopy.promo.addTask}</button>
          </div>
        </section>}
    </LiveEditContext.Provider>
    {dialog && <PortiaQualificationQuestionDialog editing transitionLabel={transition.label} draft={dialog.draft} busy={busy} serverError={command.phase === "error" ? command.message : ""} opener={dialog.opener} onChange={(draft) => setDialog({ ...dialog, draft })} onSave={() => void saveAnswer()} onCancel={() => { setDialog(null); setCommand({ phase: "idle", message: "" }); }} />}
  </div>;
}

export function PromotionEditorMain({ visible, canManageEditors }: { visible: boolean; canManageEditors: boolean }) {
  const [branch, setBranch] = useState<Branch>("requests"); const [kind, setKind] = useState<Kind>("ordinary"); const [queue, setQueue] = useState<ReviewerState>(emptyQueue); const [banks, setBanks] = useState<BankState>(emptyBanks); const [selectedRequestId, setSelectedRequestId] = useState(""); const [note, setNote] = useState({ text: "", ok: false }); const message = note.text; const setMessage = useCallback((text: string, ok = false) => setNote({ text, ok }), []); const [busy, setBusy] = useState(false); const [resetNickname, setResetNickname] = useState(""); const [confirm, setConfirm] = useState<ConfirmIntent | null>(null); const [isPhone, setIsPhone] = useState(false); const [requestView, setRequestView] = useState<"queue" | "detail">("queue"); const [denied, setDenied] = useState(false); const [conflict, setConflict] = useState(false); const [queueStatus, setQueueStatus] = useState<LoadStatus>("loading"); const [banksStatus, setBanksStatus] = useState<LoadStatus>("loading");
  const [live, setLive] = useState(false);
  const queueRequestEpoch = useRef(0);
  const applyQueue = useCallback((next: ReviewerState) => { setQueue(next); setSelectedRequestId((current) => { const all = [...(next.ordinary ?? []), ...(next.qualification ?? [])]; return all.some((row) => row.requestId === current) ? current : all[0]?.requestId ?? ""; }); }, []);
  const deny = useCallback(() => { setConflict(false); setDenied(true); setQueue(emptyQueue); setBanks(emptyBanks); setSelectedRequestId(""); setMessage(""); setConfirm(null); }, [setMessage]);
  const loadQueue = useCallback(async () => {
    const requestEpoch = ++queueRequestEpoch.current;
    try {
      const response = await fetch("/api/promotion/reviewer", { cache: "no-store" }); const body = await responseBody(response);
      if (requestEpoch !== queueRequestEpoch.current) return;
      if (isDenied(response, body)) return deny();
      if (!response.ok) { setQueueStatus((status) => status === "ready" ? status : "error"); return setMessage(errorText(body, "Очередь временно недоступна.")); }
      setDenied(false); applyQueue(body as unknown as ReviewerState); setQueueStatus("ready"); setMessage(""); setConflict(false);
    } catch { if (requestEpoch !== queueRequestEpoch.current) return; setQueueStatus((status) => status === "ready" ? status : "error"); setMessage("Нет связи с сервером. Очередь не обновлена."); }
  }, [applyQueue, deny, setMessage]);
  const loadBanks = useCallback(async () => {
    try {
      const response = await fetch("/api/promotion/banks", { cache: "no-store" }); const body = await responseBody(response);
      if (isDenied(response, body)) return deny();
      if (!response.ok) { setBanksStatus((status) => status === "ready" ? status : "error"); return setMessage(errorText(body, "Банки временно недоступны.")); }
      setDenied(false); setBanks(body as unknown as BankState); setBanksStatus("ready");
    } catch { setBanksStatus((status) => status === "ready" ? status : "error"); setMessage("Нет связи с сервером. Банки не загружены."); }
  }, [deny, setMessage]);
  useEffect(() => { if (!visible || document.visibilityState !== "visible") return; queueMicrotask(() => void loadQueue()); const poll = () => { if (document.visibilityState === "visible") void loadQueue(); }; const timer = window.setInterval(poll, 10_000); document.addEventListener("visibilitychange", poll); return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); }; }, [loadQueue, visible]);
  useEffect(() => { if (visible && branch !== "requests") queueMicrotask(() => void loadBanks()); }, [branch, loadBanks, visible]);
  useEffect(() => { const query = window.matchMedia("(max-width: 900px)"); const update = () => setIsPhone(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  const ordinaryCount = queue.ordinary.length; const qualificationCount = queue.qualification.length; const rows = kind === "ordinary" ? queue.ordinary : queue.qualification; const selected = requestForActiveQueue(rows, selectedRequestId);
  const reviewerCommand = async (action: string, row: ReviewerRequest, extra: Record<string, unknown> = {}) => { queueRequestEpoch.current += 1; setBusy(true); setMessage(""); try { const response = await fetch("/api/promotion/reviewer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, kind: queue.ordinary.includes(row) ? "ordinary" : "qualification", requestId: row.requestId, ...extra }) }); const body = await responseBody(response); queueRequestEpoch.current += 1; if (isDenied(response, body)) return deny(); if (body.state && typeof body.state === "object") applyQueue(body.state as unknown as ReviewerState); if (!response.ok) { setConflict(response.status === 409); setMessage(errorText(body, action === "claim" ? "Запрос уже взят другим проверяющим." : action === "reject" ? "Запрос не отклонён. Обновите очередь." : "Команда не выполнена.")); return; } if (action === "reject" || action === "delete-request") { setSelectedRequestId(""); setMessage(action === "reject" ? "Запрос отклонён и удалён из активной очереди." : "Запрос удалён.", true); } } catch { setMessage("Нет связи с сервером. Изменение не применено."); } finally { setBusy(false); } };
  const resetDevice = async (nicknameKey: string) => { setBusy(true); try { const response = await fetch("/api/promotion/reviewer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset-device", nicknameKey }) }); const body = await responseBody(response); if (isDenied(response, body)) return deny(); if (!response.ok) return setMessage(errorText(body, "Привязку не удалось сбросить.")); setResetNickname(""); setMessage(`Привязка ${nicknameKey} сброшена.`, true); } finally { setBusy(false); } };
  const postBank = async (payload: Record<string, unknown>) => { setBusy(true); setMessage(""); try { const response = await fetch("/api/promotion/banks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await responseBody(response); if (isDenied(response, body)) { deny(); return null; } if (body.state && typeof body.state === "object") setBanks(body.state as unknown as BankState); if (!response.ok) { setConflict(response.status === 409); setMessage(errorText(body, "Не удалось сохранить изменения.")); return null; } return body; } catch { setMessage("Нет связи с сервером. Черновик сохранён в форме."); return null; } finally { setBusy(false); } };
  const irreversible = "Запрос и связанные данные будут удалены без восстановления.";
  // quick 261117-bi1 (R2): one form, two places — the branch strip on a PC, the request toolbar on a phone.
  const deviceReset = <>{canManageEditors && <form className="promotion-device-reset" onSubmit={(event) => { event.preventDefault(); const key = resetNickname.trim(); const opener = event.nativeEvent.submitter as HTMLElement | null; if (key) setConfirm({ title: `Сбросить привязку: ${key}`, body: "Участник сможет привязать новое устройство.", confirmLabel: "Сбросить привязку", cancelLabel: "Не сбрасывать", run: () => void resetDevice(key), opener }); }}><label><span className="sr-only">Точный ник для отзыва привязки</span><input value={resetNickname} maxLength={64} placeholder="Ник для сброса привязки" onChange={(event) => setResetNickname(event.target.value)} /></label><button disabled={!resetNickname.trim()}>СБРОСИТЬ ПРИВЯЗКУ</button></form>}</>;
  if (denied) return <div className="promotion-editor"><div className="empty-state" role="alert"><strong>Доступ закрыт</strong></div></div>;
  return <div className="promotion-editor">
    <EditorActionBar label="Разделы повышения" nav={<nav className="promotion-editor-branches" aria-label="Разделы повышения">{([['requests','ЗАПРОСЫ',ordinaryCount + qualificationCount],['tasks','ЗАДАНИЯ',banks.taskBanks.length],['qualification','КВАЛИФИКАЦИЯ',qualificationCount]] as const).map(([id,label,count]) => <button key={id} type="button" className={branch === id ? "active" : ""} aria-current={branch === id ? "true" : undefined} aria-label={`${label}: ${count}`} onKeyDown={moveButtonTab} onClick={() => { setBranch(id); if (id === "requests") { setKind("ordinary"); setSelectedRequestId(""); } setRequestView("queue"); }}>{label}<span className="tab-count" aria-hidden="true">{count}</span></button>)}{!isPhone && deviceReset}</nav>} statusText={message} tone={message ? (note.ok ? "saved" : "error") : ""} actions={<LiveModeToggle on={live} onToggle={() => setLive((current) => !current)} />} />
    {message && conflict && <div className="promotion-editor-conflict"><p>Данные изменились. Ваш ввод сохранён.</p><div><button type="button" onClick={() => void (branch === "requests" ? loadQueue() : Promise.all([loadQueue(), loadBanks()]))}>Загрузить их версию</button><button type="button" onClick={() => { setConflict(false); setMessage(""); }}>Оставить мой ввод</button></div></div>}
    {branch === "requests" ? <>
      <div className="promotion-requests-toolbar">
      <div className="promotion-queue-filters" role="group" aria-label="Типы запросов"><button type="button" className={kind === "ordinary" ? "active" : ""} aria-pressed={kind === "ordinary"} aria-label={`Обычное повышение: ${ordinaryCount}`} onKeyDown={moveButtonTab} onClick={() => { setKind("ordinary"); setSelectedRequestId(""); setRequestView("queue"); }}>ОБЫЧНОЕ ПОВЫШЕНИЕ <span aria-hidden="true">{ordinaryCount}</span></button><button type="button" className={kind === "qualification" ? "active" : ""} aria-pressed={kind === "qualification"} aria-label={`Квалификация: ${qualificationCount}`} onKeyDown={moveButtonTab} onClick={() => { setKind("qualification"); setSelectedRequestId(""); setRequestView("queue"); }}>КВАЛИФИКАЦИЯ <span aria-hidden="true">{qualificationCount}</span></button></div>
      {isPhone && deviceReset}
      </div>
      {(queue.cleanupPreview?.length ?? 0) > 0 && <details className="promotion-cleanup-disclosure"><summary>Незавершённые данные удаляются через 3 дня <span>{queue.cleanupPreview?.length}</span></summary><div>{queue.cleanupPreview?.map((row) => <article key={`${row.kind}:${row.requestId}`}><strong>{row.nickname}</strong><span>{row.kind === "ordinary" ? "Обычное повышение" : "Квалификация"} · {requestStatusLabel(row.status)}</span><time dateTime={row.deleteAt}>Дата удаления: {new Date(row.deleteAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" })} МСК</time></article>)}</div></details>}
      <div className="promotion-editor-workbench etab-body">
        {(!isPhone || requestView === "queue") && <aside className="promotion-request-list etab-list">{queueStatus === "loading" && skeleton}{rows.map((row) => <button key={row.requestId} className={selected?.requestId === row.requestId ? "active" : ""} onClick={() => { setSelectedRequestId(row.requestId); if (isPhone) setRequestView("detail"); }}><strong>{row.nickname}</strong><span>{titleLabel(row.titleId)} → {titleLabel(row.targetTitleId)}</span><em>{row.claimed ? "В РАБОТЕ" : requestStatusLabel(row.status).toUpperCase()}</em></button>)}{rows.length === 0 && queueStatus === "ready" && <div className="promotion-empty"><strong>НОВЫХ ЗАПРОСОВ НЕТ</strong></div>}{rows.length === 0 && queueStatus === "error" && <div className="promotion-empty"><strong>ОЧЕРЕДЬ НЕ ЗАГРУЖЕНА</strong><p>Список обновится автоматически, когда связь восстановится.</p><button type="button" onClick={() => void loadQueue()}>Повторить загрузку</button></div>}</aside>}
        {(!isPhone || requestView === "detail") && <article className="promotion-request-detail etab-detail">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setRequestView("queue")}>← НАЗАД К ЗАПРОСАМ</button>}{selected ? <><header><div><span>{queue.ordinary.includes(selected) ? "ОБЫЧНОЕ ПОВЫШЕНИЕ" : "КВАЛИФИКАЦИЯ"}</span><h2>{selected.nickname}</h2></div><b>{selected.claimed ? selected.assignedToMe ? "В РАБОТЕ У ВАС" : "ЗАНЯТ" : "НОВЫЙ"}</b></header><dl><div><dt>ПЕРЕХОД</dt><dd>{titleLabel(selected.titleId)} → {titleLabel(selected.targetTitleId)}</dd></div><div><dt>СОСТОЯНИЕ</dt><dd>{requestStatusLabel(selected.status)}</dd></div></dl>{queue.qualification.includes(selected) && selected.claimed && <QualificationGrading row={selected} busy={busy} onCommand={(action, extra) => reviewerCommand(action, selected, extra)} onConfirm={setConfirm} />}<div className="promotion-request-actions">{!selected.claimed && <button className="primary-control" onClick={() => void reviewerCommand("claim", selected)}>ВЗЯТЬ ЗАПРОС</button>}{selected.assignedToMe && <><button onClick={() => void reviewerCommand("release", selected)}>ОСВОБОДИТЬ</button>{queue.ordinary.includes(selected) && selected.status === "assigned" && <button onClick={(event) => setConfirm({ title: `Зачесть задания: ${selected.nickname}`, body: "Звание затем меняется в таблице.", confirmLabel: "Зачесть задания", cancelLabel: "Не зачитывать", run: () => void reviewerCommand("approve-task", selected), opener: event.currentTarget })}>ЗАЧЕСТЬ ЗАДАНИЯ</button>}<button className="danger-control" onClick={(event) => setConfirm({ title: `Отклонить и удалить: ${selected.nickname}`, body: irreversible, confirmLabel: "Отклонить запрос", cancelLabel: "Не отклонять", run: () => void reviewerCommand("reject", selected, { note: "" }), opener: event.currentTarget })}>ОТКЛОНИТЬ</button></>}{canManageEditors && selected.claimed && !selected.assignedToMe && <button onClick={(event) => setConfirm({ title: `Снять claim: ${selected.nickname}`, body: "Запрос вернётся в очередь.", confirmLabel: "Снять claim", cancelLabel: "Не снимать", run: () => void reviewerCommand("force-release", selected), opener: event.currentTarget })}>ПРИНУДИТЕЛЬНО ОСВОБОДИТЬ</button>}{canManageEditors && <button className="danger-control" onClick={(event) => setConfirm({ title: `Удалить запрос: ${selected.nickname}`, body: irreversible, confirmLabel: "Удалить запрос", cancelLabel: "Не удалять", run: () => void reviewerCommand("delete-request", selected), opener: event.currentTarget })}>УДАЛИТЬ ЗАЯВКУ</button>}{canManageEditors && <button onClick={(event) => setConfirm({ title: `Сбросить привязку: ${selected.nickname}`, body: "После сброса участник сможет закрепить новое устройство.", confirmLabel: "Сбросить привязку", cancelLabel: "Не сбрасывать", run: () => void reviewerCommand("reset-device", selected, { nicknameKey: selected.nicknameKey }), opener: event.currentTarget })}>СБРОСИТЬ ПРИВЯЗКУ</button>}</div></> : <div className="promotion-empty">Выберите запрос.</div>}</article>}
      </div>
    </> : banksStatus !== "ready" ? (banksStatus === "loading" ? skeleton : <div className="promotion-empty"><strong>БАНКИ НЕ ЗАГРУЖЕНЫ</strong><button type="button" onClick={() => void loadBanks()}>Повторить загрузку</button></div>) : live ? <PromotionLiveSurface kind={branch === "tasks" ? "ordinary" : "qualification"} banks={banks} busy={busy} post={postBank} requestConfirm={setConfirm} /> : branch === "tasks" ? <PortiaPromotionOrdinaryEditor banks={banks.taskBanks} requests={queue.ordinary} busy={busy} post={postBank} refreshQueue={loadQueue} requestConfirm={setConfirm} /> : <PortiaPromotionQualificationEditor banks={banks.qualificationBanks} requests={queue.qualification} busy={busy} post={postBank} refreshQueue={loadQueue} requestConfirm={setConfirm} />}
    {confirm && <PromotionConfirmDialog intent={confirm} onCancel={() => setConfirm(null)} onConfirm={() => { const run = confirm.run; setConfirm(null); run(); }} />}
  </div>;
}
