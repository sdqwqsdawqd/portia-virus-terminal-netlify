"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { qualificationPromotionTransitions } from "@/lib/portia-promotion";
import { validateQuestionDraft } from "@/lib/portia-promotion-reviewer";
import { QUALIFICATION_TEST_MAX, builderDraftPayload, draftFromItem, emptyBuilderDraft, qualificationSetMessages, qualificationSetProblem, qualificationTestQuotas, qualificationTestSummary, type BuilderDraft } from "@/lib/portia-qualification-builder";
import { QUALIFICATION_RULES_MAX_LENGTH } from "@/lib/portia-qualification-rules";
import { PortiaQualificationQuestionDialog } from "./portia-qualification-question-dialog";
import type { ConfirmIntent } from "./portia-promotion-editor-main";

type QuestionType = "single" | "multiple" | "free-text";
type RequestRow = { requestId: string; nickname: string; targetTitleId: string; status: string; assignedToMe: boolean };
type Item = { id: string; text: string; active: boolean; sortOrder: number; type?: QuestionType; options?: Array<{ text: string }> | string[]; answerKey?: unknown };
type Bank = { id: string; transitionId?: string; version: string; rulesText?: string; items: Item[] };
type Preview = { preview: string; items: Item[]; expiresAt: string; version: string; activeCount?: number };
type Post = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
type CommandState = { phase: "idle" | "saving" | "saved" | "error"; message: string };
type QuestionDialog = { mode: "new"; opener: HTMLElement | null } | { mode: "edit"; itemId: string; draft: BuilderDraft; opener: HTMLElement | null };
const questionTypeLabels: Record<QuestionType, string> = {
  single: "Один вариант",
  multiple: "Несколько вариантов",
  "free-text": "Свободный ответ",
};

const questionBadgeLabels: Record<QuestionType, string> = { single: "ОДИН", multiple: "НЕСКОЛЬКО", "free-text": "СВОБОДНЫЙ" };
const optionText = (options: Item["options"]) => (options ?? []).map((option) => typeof option === "string" ? option : option.text);

export function PortiaPromotionQualificationEditor({ banks, requests, busy, post, refreshQueue, requestConfirm }: {
  banks: Bank[]; requests: RequestRow[]; busy: boolean; post: Post; refreshQueue: () => Promise<void>; requestConfirm: (intent: ConfirmIntent) => void;
}) {
  const [transitionId, setTransitionId] = useState(qualificationPromotionTransitions[0].transitionId);
  const [questionSearch, setQuestionSearch] = useState("");
  const [newDraft, setNewDraft] = useState<BuilderDraft>(emptyBuilderDraft);
  const [dialog, setDialog] = useState<QuestionDialog | null>(null);
  const [rulesDrafts, setRulesDrafts] = useState<Record<string, string>>({});
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [manualTried, setManualTried] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  const [bankView, setBankView] = useState<"list" | "editor" | "preview">("list");
  const [mode, setMode] = useState<"create" | "issue">("create");
  const [previewStale, setPreviewStale] = useState(false);
  const [commandState, setCommandState] = useState<CommandState>({ phase: "idle", message: "" });
  const savingRef = useRef(false);
  const transition = qualificationPromotionTransitions.find((item) => item.transitionId === transitionId) ?? qualificationPromotionTransitions[0];
  const bank = banks.find((item) => item.transitionId === transition.transitionId) ?? null;
  const matchingRequests = useMemo(() => requests.filter((row) => row.assignedToMe && row.status === "claimed" && row.targetTitleId === transition.transitionId), [requests, transition.transitionId]);

  const currentPreview = preview?.version === bank?.version ? preview : null;
  const selectedRequestId = matchingRequests.some((row) => row.requestId === requestId) ? requestId : matchingRequests[0]?.requestId ?? "";
  // OWN-08 (owner 2026-11-20): no quotas. The test is every active question of the bank, or the marked ones.
  const activeItems = bank?.items.filter((item) => item.active) ?? [];
  const activeCount = activeItems.length;
  const activePools = qualificationTestQuotas(activeItems);
  const compositionLine = qualificationTestSummary(activePools);
  const selectedPool = activeItems.filter((item) => manualIds.includes(item.id));
  const manualProblem = qualificationSetProblem(selectedPool.length);
  const manualSelectionValid = Boolean(bank) && manualProblem === null;
  // Too many marked is said at once; nothing marked is said after the first press of the disabled button.
  const manualReason = manualProblem === "too-large" ? qualificationSetMessages.tooLarge.text : manualProblem === "empty" && manualTried ? qualificationSetMessages.empty.text : "";
  const rulesAvailable = Boolean(bank) && typeof bank?.rulesText === "string";
  const savedRules = bank?.rulesText ?? "";
  const rulesValue = rulesDrafts[transition.transitionId] ?? savedRules;
  const rulesReason = !bank ? "Сначала добавьте вопрос." : !rulesAvailable ? "Правила станут доступны после обновления базы — миграция ждёт владельца." : "";
  useEffect(() => { const query = window.matchMedia("(max-width: 900px)"); const update = () => setIsPhone(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);

  // keepPreview: the rules are not part of the frozen question set, so the bank version and an open preview stay valid.
  const settleMutation = async (payload: Record<string, unknown>, savedMessage: string, options: { keepPreview?: boolean } = {}) => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setCommandState({ phase: "saving", message: "Сохраняем изменения…" });
    try {
      const result = await post(payload);
      if (!result?.state) { setCommandState({ phase: "error", message: "Изменения не сохранены. Проверьте данные." }); return null; }
      if (!options.keepPreview) {
        if (preview) setPreviewStale(true);
        setPreview(null);
      }
      setCommandState({ phase: "saved", message: savedMessage });
      return result;
    } finally {
      savingRef.current = false;
    }
  };

  const saveRules = async () => {
    if (!bank || !rulesAvailable) return;
    const submittedRules = rulesValue;
    const transitionKey = transition.transitionId;
    const result = await settleMutation({ action: "save-qualification-rules", transitionId: transitionKey, rulesText: submittedRules }, "Правила сохранены.", { keepPreview: true });
    if (!result?.state) return;
    setRulesDrafts((current) => { if (current[transitionKey] !== submittedRules) return current; const next = { ...current }; delete next[transitionKey]; return next; });
  };
  const openNewQuestion = (opener: HTMLElement) => { setCommandState({ phase: "idle", message: "" }); setDialog({ mode: "new", opener }); };
  const edit = (item: Item, opener: HTMLElement) => { setCommandState({ phase: "idle", message: "" }); setDialog({ mode: "edit", itemId: item.id, draft: draftFromItem(item), opener }); };
  // Cancelling a new question keeps its draft for the next «+ ВОПРОС»; cancelling an edit discards it.
  const closeDialog = () => { setDialog(null); setCommandState({ phase: "idle", message: "" }); };
  const dialogDraft = dialog?.mode === "edit" ? dialog.draft : newDraft;
  const changeDialogDraft = (next: BuilderDraft) => { if (dialog?.mode === "edit") setDialog({ ...dialog, draft: next }); else setNewDraft(next); };
  // The first question of a transition creates its bank: the stored counts only satisfy the database, and the server brings them to the confirmed set (OWN-08).
  const bankIdForQuestion = async (firstType: BuilderDraft["type"]) => {
    if (bank) return bank.id;
    const result = await settleMutation({ action: "save-qualification-bank", transitionId: transition.transitionId, quotas: qualificationTestQuotas([{ type: firstType, active: true }]) }, "Банк перехода создан.");
    const created = (result?.state as { qualificationBanks?: Bank[] } | undefined)?.qualificationBanks?.find((item) => item.transitionId === transition.transitionId);
    if (result && !created) setCommandState({ phase: "error", message: "Банк не создан. Попробуйте ещё раз." });
    return created?.id ?? null;
  };
  const saveQuestion = async () => {
    if (!dialog) return;
    const question = validateQuestionDraft(builderDraftPayload(dialogDraft));
    if (!question) { setCommandState({ phase: "error", message: "Проверьте варианты и правильный ответ перед сохранением." }); return; }
    const current = dialog.mode === "edit" ? bank?.items.find((item) => item.id === dialog.itemId) : undefined;
    const submittedDraft = dialogDraft;
    const submittedMode = dialog.mode;
    const bankId = await bankIdForQuestion(question.type);
    if (!bankId) return;
    const result = await settleMutation({ action: "save-question", bankId, ...(current ? { questionId: current.id } : {}), question, active: current?.active ?? true, sortOrder: current?.sortOrder ?? bank?.items.length ?? 0 }, current ? "Вопрос обновлён." : "Вопрос добавлен.");
    if (result) {
      setDialog(null);
      if (submittedMode === "new") setNewDraft((draft) => draft === submittedDraft ? emptyBuilderDraft() : draft);
    }
  };
  const mutate = async (item: Item, patch: Partial<Item>) => settleMutation({ action: "save-question", bankId: bank!.id, questionId: item.id, question: { ...(item.type === "free-text" ? { type: "free-text", text: item.text, answer: String(item.answerKey ?? "Ответ") } : { type: item.type ?? "single", text: item.text, options: optionText(item.options), answer: item.answerKey ?? 0 }) }, active: patch.active ?? item.active, sortOrder: patch.sortOrder ?? item.sortOrder }, "Вопрос обновлён.");
  const reorder = async (index: number, delta: -1 | 1) => { if (!bank) return; const item = bank.items[index]; const other = bank.items[index + delta]; if (!other) return; const first = await mutate(item, { sortOrder: other.sortOrder }); if (!first) return; await mutate(other, { sortOrder: item.sortOrder }); };
  const remove = (item: Item, opener: HTMLElement) => { if (bank) requestConfirm({ title: "Удалить вопрос", body: `Удалить вопрос «${item.text}»? Это нельзя отменить.`, confirmLabel: "Удалить вопрос", cancelLabel: "Оставить вопрос", opener, run: () => void settleMutation({ action: "delete-question", bankId: bank.id, questionId: item.id }, "Вопрос удалён.") }); };
  const buildPreview = async (replaceId = "", random = false) => {
    if (!bank) return; const result = await post({ action: "preview", kind: "qualification", bankId: bank.id, ...(!random && !replaceId ? { manualIds: selectedPool.map((item) => item.id) } : {}), ...(replaceId && currentPreview ? { replaceId, preview: currentPreview.preview } : {}) });
    if (result?.preview && Array.isArray(result.items) && typeof result.version === "string") { setPreview({ ...(result as unknown as Preview), version: result.version }); setPreviewStale(false); if (isPhone) setBankView("preview"); }
  };
  const confirmPreview = async () => {
    if (!bank || !currentPreview || !selectedRequestId) return;
    const result = await post({ action: "confirm", kind: "qualification", bankId: bank.id, requestId: selectedRequestId, preview: currentPreview.preview });
    // CR-01 (26.1 review): the server moves the bank version while it confirms and answers with the bank state, success or not; postBank applies it.
    // A failed confirm leaves the old preview behind the new version, and the line «Набор изменился» says so instead of a silent empty pane.
    if (!result) { setPreviewStale(true); return; }
    setPreview(null); setManualIds([]); setManualTried(false); await refreshQueue();
  };
  const previewPoolError = bank && activeCount < 1 ? qualificationTestSummary(activePools) : null;
  const disabledReason = !bank ? "Сначала добавьте вопрос." : previewPoolError ? previewPoolError : !matchingRequests.length ? "Нет взятого вами квалификационного запроса для этого перехода." : "";
  const buildGuarded = (run: () => Promise<void>) => () => { if (!busy && !disabledReason) void run(); };
  const buildManual = () => { if (busy || disabledReason) return; if (!manualSelectionValid) { setManualTried(true); return; } void buildPreview(); };
  // More active questions than the limit: the automatic set takes 100 of them, and the line says so.
  const cappedLine = activeCount > QUALIFICATION_TEST_MAX ? qualificationSetMessages.capped(activeCount) : "";
  const previewCappedLine = currentPreview && (currentPreview.activeCount ?? activeCount) > QUALIFICATION_TEST_MAX && currentPreview.items.length === QUALIFICATION_TEST_MAX ? qualificationSetMessages.capped(currentPreview.activeCount ?? activeCount) : "";

  return <div className="promotion-bank-workflow"><nav className="promotion-bank-workflow-tabs" aria-label="Работа с квалификационными вопросами"><button type="button" className={mode === "create" ? "active" : ""} aria-current={mode === "create" ? "true" : undefined} onClick={() => { setMode("create"); if (isPhone) setBankView("list"); }}>1. СОЗДАТЬ ВОПРОСЫ</button><button type="button" className={mode === "issue" ? "active" : ""} aria-current={mode === "issue" ? "true" : undefined} onClick={() => { setMode("issue"); if (isPhone) setBankView("list"); }}>2. ВЫДАТЬ ПРОВЕРКУ</button></nav><p className="promotion-bank-workflow-hint">{mode === "create" ? "Выберите переход, добавьте вопросы." : "Выберите переход, соберите набор и подтвердите."}</p><div className="promotion-bank-layout promotion-qualification-editor etab-body" data-mode={mode}>
    {(!isPhone || bankView === "list") && <aside className="promotion-bank-list etab-list">{qualificationPromotionTransitions.map((item) => <button key={item.transitionId} type="button" className={item.transitionId === transition.transitionId ? "active" : ""} onClick={() => { setTransitionId(item.transitionId); setPreview(null); setPreviewStale(false); setManualIds([]); setManualTried(false); if (isPhone) setBankView(mode === "create" ? "editor" : "preview"); }}><strong>{item.label}</strong><span>{banks.find((candidate) => candidate.transitionId === item.transitionId)?.items.filter((entry) => entry.active).length ?? 0} активных</span></button>)}</aside>}
    {(!isPhone || bankView === "editor") && <section className="promotion-bank-editor etab-detail">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← НАЗАД К БАНКАМ</button>}<header><div><span>КВАЛИФИКАЦИОННЫЕ ВОПРОСЫ</span><h2>{transition.label}</h2></div><span>{bank ? `ВЕРСИЯ ${bank.version}` : "БАНК НЕ СОЗДАН"}</span></header>
      <p className={`promotion-command-state${activeCount < 1 ? " error" : ""}`} role="status">{compositionLine}</p>
      {cappedLine && <p className="promotion-command-state error" role="status">{cappedLine}</p>}
      <section className="promotion-rules-block" aria-labelledby="promotion-rules-title"><h3 id="promotion-rules-title">ПРАВИЛА ДЛЯ КАНДИДАТА</h3><textarea aria-label="Правила для кандидата" rows={4} value={rulesValue} maxLength={QUALIFICATION_RULES_MAX_LENGTH} disabled={!rulesAvailable} placeholder="Необязательно. Что кандидату нужно знать перед началом проверки." aria-describedby={rulesReason ? "promotion-rules-reason" : undefined} onChange={(event) => setRulesDrafts((current) => ({ ...current, [transition.transitionId]: event.target.value }))} /><div className="promotion-rules-meta"><span>{rulesValue.length} / {QUALIFICATION_RULES_MAX_LENGTH}</span><span>Строки про 15 минут и поведение на ПК и телефоне сайт показывает всегда.</span><button className="secondary-control" type="button" disabled={busy || !rulesAvailable || rulesValue === savedRules} onClick={() => void saveRules()}>СОХРАНИТЬ ПРАВИЛА</button></div>{rulesReason && <p className="promotion-disabled-reason" id="promotion-rules-reason">{rulesReason}</p>}</section>
      {commandState.message && !dialog && <p className={`promotion-command-state ${commandState.phase}`} role="status">{commandState.message}</p>}
      <div className="promotion-question-list-heading"><h3>ВОПРОСЫ В БАНКЕ · {bank?.items.length ?? 0}</h3><input type="search" value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Найти вопрос" aria-label="Найти вопрос в банке" /><button className="primary-control" type="button" disabled={busy} onClick={(event) => openNewQuestion(event.currentTarget)}>+ ВОПРОС</button></div>
      <div className="promotion-bank-items">{bank?.items.map((item, index) => ({ item, index })).filter(({ item }) => !questionSearch.trim() || `${item.text} ${questionTypeLabels[item.type ?? "free-text"]}`.toLocaleLowerCase("ru-RU").includes(questionSearch.trim().toLocaleLowerCase("ru-RU"))).map(({ item, index }) => <article key={item.id} className={item.active ? undefined : "is-inactive"}><label><input type="checkbox" checked={manualIds.includes(item.id)} disabled={!item.active} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span className="promotion-question-row-text"><b>{questionBadgeLabels[item.type ?? "free-text"]}</b><span>{item.text}</span>{item.type !== "free-text" && <small>{optionText(item.options).length} вар.</small>}</span></label><div><button className="secondary-control" aria-label="Переместить выше" type="button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}>↑</button><button className="secondary-control" aria-label="Переместить ниже" type="button" disabled={busy || index === bank.items.length - 1} onClick={() => void reorder(index, 1)}>↓</button><button className="secondary-control" type="button" onClick={(event) => edit(item, event.currentTarget)}>ИЗМЕНИТЬ</button><button className="secondary-control" type="button" disabled={busy} onClick={() => void mutate(item, { active: !item.active })}>{item.active ? "ВЫКЛЮЧИТЬ" : "ВКЛЮЧИТЬ"}</button><button className="danger-control" type="button" disabled={busy} onClick={(event) => remove(item, event.currentTarget)}>УДАЛИТЬ</button></div></article>)}</div>
      <div className="promotion-preview-actions"><button className="secondary-control" type="button" aria-disabled={Boolean(disabledReason) || busy || !manualSelectionValid} aria-describedby={disabledReason ? "promotion-bank-reason" : manualReason ? "promotion-manual-reason" : undefined} onClick={buildManual}>СОБРАТЬ ВРУЧНУЮ</button><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} aria-describedby={disabledReason ? "promotion-bank-reason" : undefined} onClick={buildGuarded(() => buildPreview("", true))}>СОБРАТЬ АВТОМАТИЧЕСКИ</button>{currentPreview && <button className="secondary-control" type="button" onClick={() => void buildPreview("", true)}>ПЕРЕСОБРАТЬ</button>}</div>{previewStale && !currentPreview && <p className="promotion-command-state error" role="status">Набор изменился — пересоберите превью</p>}{disabledReason ? <p className="promotion-bank-reason" id="promotion-bank-reason">{disabledReason}</p> : manualReason && <p className="promotion-bank-reason" id="promotion-manual-reason">{manualReason}</p>}
    </section>}
    {(!isPhone || bankView === "preview") && <aside className="promotion-preview etab-detail">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← К ПЕРЕХОДАМ</button>}<div className="promotion-issue-controls"><strong>Набор для {transition.label}</strong><p>{compositionLine}</p>{cappedLine && <p className="promotion-command-state error" role="status">{cappedLine}</p>}<p>Отмечено: {selectedPool.length} из {QUALIFICATION_TEST_MAX}</p><div className="promotion-manual-pool">{bank?.items.filter((item) => item.active).map((item, index) => <label key={item.id}><input type="checkbox" checked={manualIds.includes(item.id)} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{index + 1}. {questionTypeLabels[item.type ?? "free-text"]}: {item.text}</span></label>)}</div><div className="promotion-preview-actions"><button type="button" aria-disabled={Boolean(disabledReason) || busy || !manualSelectionValid} aria-describedby={manualReason ? "promotion-manual-reason-side" : undefined} onClick={buildManual}>СОБРАТЬ ВРУЧНУЮ</button><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} onClick={buildGuarded(() => buildPreview("", true))}>СОБРАТЬ АВТОМАТИЧЕСКИ</button></div>{disabledReason ? <p className="promotion-bank-reason">{disabledReason}</p> : manualReason && <p className="promotion-bank-reason" id="promotion-manual-reason-side">{manualReason}</p>}</div>{currentPreview ? <><header><h3>ТОЧНЫЙ ТЕСТ</h3><span>{currentPreview.items.length}</span></header>{previewCappedLine && <p className="promotion-command-state error" role="status">{previewCappedLine}</p>}<ol>{currentPreview.items.map((item) => <li key={item.id}><b>{questionTypeLabels[item.type ?? "free-text"]}</b> {item.text}<button type="button" onClick={() => void buildPreview(item.id)}>ЗАМЕНИТЬ</button></li>)}</ol><label>Подходящий запрос<select value={selectedRequestId} onChange={(event) => setRequestId(event.target.value)}><option value="">Выберите запрос</option>{matchingRequests.map((row) => <option key={row.requestId} value={row.requestId}>{row.nickname}</option>)}</select></label><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy || !selectedRequestId} aria-describedby={disabledReason ? "promotion-confirm-reason" : undefined} onClick={(event) => !disabledReason && !busy && selectedRequestId && requestConfirm({ title: "Подтвердить неизменяемый тест", body: "Участник получит эти вопросы в этом порядке.", confirmLabel: "Подтвердить набор", cancelLabel: "Не подтверждать", opener: event.currentTarget, run: () => void confirmPreview() })}>ПОДТВЕРДИТЬ НАБОР</button>{disabledReason && <p className="promotion-bank-reason" id="promotion-confirm-reason">{disabledReason}</p>}</> : <div className="promotion-empty"><strong>ПРЕДПРОСМОТР НЕ СОБРАН</strong><p>{disabledReason || "Выберите вопросы вручную или соберите тест автоматически."}</p></div>}</aside>}
  </div>{dialog && <PortiaQualificationQuestionDialog editing={dialog.mode === "edit"} transitionLabel={transition.label} draft={dialogDraft} busy={busy} serverError={commandState.phase === "error" ? commandState.message : ""} opener={dialog.opener} onChange={changeDialogDraft} onSave={() => void saveQuestion()} onCancel={closeDialog} />}</div>;
}
