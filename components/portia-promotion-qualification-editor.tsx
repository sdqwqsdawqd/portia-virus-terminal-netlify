"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { qualificationPromotionTransitions } from "@/lib/portia-promotion";
import { qualificationBankLimitError, validateQuestionDraft } from "@/lib/portia-promotion-reviewer";
import type { ConfirmIntent } from "./portia-promotion-editor-main";

type QuestionType = "single" | "multiple" | "free-text";
type RequestRow = { requestId: string; nickname: string; targetTitleId: string; status: string; assignedToMe: boolean };
type Item = { id: string; text: string; active: boolean; sortOrder: number; type?: QuestionType; options?: Array<{ text: string }> | string[]; answerKey?: unknown };
type Quotas = { single: number; multiple: number; freeText: number };
type Bank = { id: string; transitionId?: string; version: string; quotas?: Quotas; items: Item[] };
type Preview = { preview: string; items: Item[]; expiresAt: string; version: string };
type Post = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
type CommandState = { phase: "idle" | "saving" | "saved" | "error"; message: string };
const emptyQuotas: Quotas = { single: 1, multiple: 0, freeText: 0 };
const questionTypeLabels: Record<QuestionType, string> = {
  single: "Один вариант",
  multiple: "Несколько вариантов",
  "free-text": "Свободный ответ",
};

const optionText = (options: Item["options"]) => (options ?? []).map((option) => typeof option === "string" ? option : option.text);
const optionDrafts = (value: string) => value.split("\n").map((option) => option.trim()).filter(Boolean);
const answerIndices = (value: string) => new Set(value.split(",").map((index) => index.trim()).filter(Boolean).map(Number).filter(Number.isInteger));
function answerDraft(item: Item) {
  return item.type === "free-text" ? String(item.answerKey ?? "") : Array.isArray(item.answerKey) ? item.answerKey.join(",") : String(item.answerKey ?? 0);
}

export function PortiaPromotionQualificationEditor({ banks, requests, busy, post, refreshQueue, requestConfirm }: {
  banks: Bank[]; requests: RequestRow[]; busy: boolean; post: Post; refreshQueue: () => Promise<void>; requestConfirm: (intent: ConfirmIntent) => void;
}) {
  const [transitionId, setTransitionId] = useState(qualificationPromotionTransitions[0].transitionId);
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, Quotas>>({});
  const [editingId, setEditingId] = useState("");
  const [type, setType] = useState<QuestionType>("single");
  const [text, setText] = useState("");
  const [options, setOptions] = useState("Вариант 1\nВариант 2");
  const [answer, setAnswer] = useState("0");
  const [manualIds, setManualIds] = useState<string[]>([]);
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

  const quotas = quotaDrafts[transition.transitionId] ?? bank?.quotas ?? emptyQuotas;
  const quotasAreDraft = quotaDrafts[transition.transitionId] !== undefined;
  const currentPreview = preview?.version === bank?.version ? preview : null;
  const selectedRequestId = matchingRequests.some((row) => row.requestId === requestId) ? requestId : matchingRequests[0]?.requestId ?? "";
  const activePools: Quotas = {
    single: bank?.items.filter((item) => item.active && item.type === "single").length ?? 0,
    multiple: bank?.items.filter((item) => item.active && item.type === "multiple").length ?? 0,
    freeText: bank?.items.filter((item) => item.active && item.type === "free-text").length ?? 0,
  };
  const quotaError = qualificationBankLimitError(quotas, activePools, Boolean(bank));
  useEffect(() => { const query = window.matchMedia("(max-width: 900px)"); const update = () => setIsPhone(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);

  const settleMutation = async (payload: Record<string, unknown>, savedMessage: string) => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setCommandState({ phase: "saving", message: "Сохраняем изменения…" });
    try {
      const result = await post(payload);
      if (!result?.state) { setCommandState({ phase: "error", message: "Изменения не сохранены. Проверьте данные и повторите попытку." }); return null; }
      if (preview) setPreviewStale(true);
      setPreview(null);
      setCommandState({ phase: "saved", message: savedMessage });
      return result;
    } finally {
      savingRef.current = false;
    }
  };

  const saveBank = async () => {
    const submittedQuotas = quotas;
    const result = await settleMutation({ action: "save-qualification-bank", transitionId: transition.transitionId, quotas: submittedQuotas }, "Квоты сохранены и подтверждены сервером.");
    if (!result?.state) return;
    setQuotaDrafts((current) => { if (JSON.stringify(current[transition.transitionId]) !== JSON.stringify(submittedQuotas)) return current; const next = { ...current }; delete next[transition.transitionId]; return next; });
  };
  const questionPayload = () => {
    if (type === "free-text") return { type, text, answer };
    const values = optionDrafts(options);
    const indices = [...answerIndices(answer)];
    return { type, text, options: values, answer: type === "single" ? indices[0] ?? 0 : indices };
  };
  const changeQuestionType = (next: QuestionType) => { setType(next); setAnswer(next === "free-text" ? "" : "0"); };
  const toggleMultipleAnswer = (index: number, checked: boolean) => {
    const next = answerIndices(answer);
    if (checked) next.add(index); else next.delete(index);
    setAnswer([...next].sort((left, right) => left - right).join(","));
  };
  const saveQuestion = async () => {
    if (!bank) return;
    const question = validateQuestionDraft(questionPayload());
    if (!question) { setCommandState({ phase: "error", message: "Проверьте варианты и правильный ответ перед сохранением." }); return; }
    const current = bank.items.find((item) => item.id === editingId);
    const submittedEditingId = editingId;
    const submittedType = type;
    const submittedText = text;
    const submittedOptions = options;
    const submittedAnswer = answer;
    const result = await settleMutation({ action: "save-question", bankId: bank.id, ...(current ? { questionId: current.id } : {}), question, active: current?.active ?? true, sortOrder: current?.sortOrder ?? bank.items.length }, current ? "Вопрос обновлён." : "Вопрос добавлен.");
    if (result) {
      setEditingId((currentId) => currentId === submittedEditingId ? "" : currentId);
      setText((current) => current === submittedText ? "" : current);
      setType((current) => current === submittedType ? "single" : current);
      setOptions((current) => current === submittedOptions ? "Вариант 1\nВариант 2" : current);
      setAnswer((current) => current === submittedAnswer ? "0" : current);
    }
  };
  const edit = (item: Item) => { setEditingId(item.id); setType(item.type ?? "free-text"); setText(item.text); setOptions(optionText(item.options).join("\n")); setAnswer(answerDraft(item)); };
  const mutate = async (item: Item, patch: Partial<Item>) => settleMutation({ action: "save-question", bankId: bank!.id, questionId: item.id, question: { ...(item.type === "free-text" ? { type: "free-text", text: item.text, answer: String(item.answerKey ?? "Ответ") } : { type: item.type ?? "single", text: item.text, options: optionText(item.options), answer: item.answerKey ?? 0 }) }, active: patch.active ?? item.active, sortOrder: patch.sortOrder ?? item.sortOrder }, "Вопрос обновлён.");
  const reorder = async (index: number, delta: -1 | 1) => { if (!bank) return; const item = bank.items[index]; const other = bank.items[index + delta]; if (!other) return; await mutate(item, { sortOrder: other.sortOrder }); await mutate(other, { sortOrder: item.sortOrder }); };
  const remove = (item: Item, opener: HTMLElement) => { if (bank) requestConfirm({ title: "Удалить вопрос", body: "Вопрос будет удалён из банка. Это нельзя отменить.", confirmLabel: "Удалить вопрос", cancelLabel: "Оставить вопрос", opener, run: () => void settleMutation({ action: "delete-question", bankId: bank.id, questionId: item.id }, "Вопрос удалён.") }); };
  const buildPreview = async (replaceId = "", random = false) => {
    if (!bank) return; const result = await post({ action: "preview", kind: "qualification", bankId: bank.id, ...(!random && !replaceId && manualIds.length ? { manualIds } : {}), ...(replaceId && currentPreview ? { replaceId, preview: currentPreview.preview } : {}) });
    if (result?.preview && Array.isArray(result.items) && typeof result.version === "string") { setPreview({ ...(result as unknown as Preview), version: result.version }); setPreviewStale(false); if (isPhone) setBankView("preview"); }
  };
  const confirmPreview = async () => {
    if (!bank || !currentPreview || !selectedRequestId) return;
    const result = await post({ action: "confirm", kind: "qualification", bankId: bank.id, requestId: selectedRequestId, preview: currentPreview.preview });
    if (result) { setPreview(null); setManualIds([]); await refreshQueue(); }
  };
  const previewPoolError = bank ? qualificationBankLimitError(bank?.quotas ?? emptyQuotas, activePools, true) : null;
  const disabledReason = !bank ? "Сначала сохраните квоты для этого перехода." : quotasAreDraft ? "Сначала сохраните новые квоты вопросов." : previewPoolError ? previewPoolError : !matchingRequests.length ? "Нет взятого вами квалификационного запроса для этого перехода." : "";
  const buildGuarded = (run: () => Promise<void>) => () => { if (!busy && !disabledReason) void run(); };
  const questionError = validateQuestionDraft(questionPayload()) ? "" : "Проверьте варианты и правильный ответ.";
  const visibleOptions = optionDrafts(options);
  const selectedAnswers = answerIndices(answer);
  const selectedPool = bank?.items.filter((item) => item.active && manualIds.includes(item.id)) ?? [];
  const manualSelectionValid = Boolean(bank) && selectedPool.length === Object.values(bank?.quotas ?? emptyQuotas).reduce((sum, value) => sum + value, 0)
    && selectedPool.filter((item) => item.type === "single").length === (bank?.quotas?.single ?? 0)
    && selectedPool.filter((item) => item.type === "multiple").length === (bank?.quotas?.multiple ?? 0)
    && selectedPool.filter((item) => item.type === "free-text").length === (bank?.quotas?.freeText ?? 0);

  return <div className="promotion-bank-workflow"><nav className="promotion-bank-workflow-tabs" aria-label="Работа с квалификационными вопросами"><button type="button" className={mode === "create" ? "active" : ""} aria-pressed={mode === "create"} onClick={() => { setMode("create"); if (isPhone) setBankView("list"); }}>1. СОЗДАТЬ ВОПРОСЫ</button><button type="button" className={mode === "issue" ? "active" : ""} aria-pressed={mode === "issue"} onClick={() => { setMode("issue"); if (isPhone) setBankView("list"); }}>2. ВЫДАТЬ ПРОВЕРКУ</button></nav><p className="promotion-bank-workflow-hint">{mode === "create" ? "Выберите переход, сохраните квоты и добавьте вопросы каждого типа." : "Выберите переход, соберите точный набор по сохранённым квотам и подтвердите его для запроса."}</p><div className="promotion-bank-layout promotion-qualification-editor" data-mode={mode}>
    {(!isPhone || bankView === "list") && <aside className="promotion-bank-list">{qualificationPromotionTransitions.map((item) => <button key={item.transitionId} type="button" className={item.transitionId === transition.transitionId ? "active" : ""} onClick={() => { setTransitionId(item.transitionId); setPreview(null); setPreviewStale(false); setManualIds([]); if (isPhone) setBankView(mode === "create" ? "editor" : "preview"); }}><strong>{item.label}</strong><span>{banks.find((candidate) => candidate.transitionId === item.transitionId)?.items.filter((entry) => entry.active).length ?? 0} активных</span></button>)}</aside>}
    {(!isPhone || bankView === "editor") && <section className="promotion-bank-editor">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← НАЗАД К БАНКАМ</button>}<header><div><span>КВАЛИФИКАЦИОННЫЕ ВОПРОСЫ</span><h2>{transition.label}</h2></div><span>{bank ? `ВЕРСИЯ ${bank.version}` : "БАНК НЕ СОЗДАН"}</span></header>
      <div className="promotion-bank-settings promotion-quota-settings">{([['single','Один ответ'],['multiple','Несколько'],['freeText','Свободный текст']] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min={0} max={100} value={quotas[key]} onChange={(event) => setQuotaDrafts((current) => ({ ...current, [transition.transitionId]: { ...quotas, [key]: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } }))} /></label>)}<button className="primary-control" type="button" disabled={busy || Object.values(quotas).reduce((sum, value) => sum + value, 0) < 1} onClick={() => void saveBank()}>СОХРАНИТЬ КВОТЫ</button><span className="promotion-bank-capacity">Сохранено: {bank?.quotas ? Object.values(bank.quotas).reduce((sum, value) => sum + value, 0) : "—"} · Активных: {Object.values(activePools).reduce((sum, value) => sum + value, 0)}{quotaError ? ` · ${quotaError}` : ""}</span></div>
      {commandState.message && <p className={`promotion-command-state ${commandState.phase}`} role="status">{commandState.message}</p>}
      <label>Тип вопроса<select value={type} onChange={(event) => changeQuestionType(event.target.value as QuestionType)}><option value="single">Один вариант</option><option value="multiple">Несколько вариантов</option><option value="free-text">Свободный ответ</option></select></label><label>Текст вопроса<textarea value={text} maxLength={4000} placeholder="Напишите вопрос полностью" onChange={(event) => setText(event.target.value)} /></label>{type !== "free-text" && <label>Варианты, по одному в строке<textarea value={options} onChange={(event) => setOptions(event.target.value)} /></label>}{type === "free-text" ? <label>Правильный ответ<input value={answer} placeholder="Ответ для проверяющего" onChange={(event) => setAnswer(event.target.value)} /></label> : <fieldset className="promotion-answer-options"><legend>Правильный ответ</legend>{visibleOptions.map((option, index) => <label key={`${index}:${option}`}><input type={type === "single" ? "radio" : "checkbox"} name={type === "single" ? `qualification-answer-${transition.transitionId}` : undefined} checked={selectedAnswers.has(index)} onChange={(event) => type === "single" ? setAnswer(String(index)) : toggleMultipleAnswer(index, event.target.checked)} /><span><b>{index + 1}.</b>{option}</span></label>)}{visibleOptions.length === 0 && <p>Сначала добавьте варианты выше.</p>}</fieldset>}{questionError && text.trim() && <p className="promotion-disabled-reason">{questionError}</p>}<button className="primary-control" type="button" disabled={busy || !bank || Boolean(questionError)} onClick={() => void saveQuestion()}>{editingId ? "СОХРАНИТЬ ВОПРОС" : "ДОБАВИТЬ ВОПРОС"}</button>
      <div className="promotion-bank-items">{bank?.items.map((item, index) => <article key={item.id}><label><input type="checkbox" checked={manualIds.includes(item.id)} disabled={!item.active} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span><b>{questionTypeLabels[item.type ?? "free-text"]}</b> {item.text}</span></label><div><button className="secondary-control" aria-label="Переместить выше" type="button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}>↑</button><button className="secondary-control" aria-label="Переместить ниже" type="button" disabled={busy || index === bank.items.length - 1} onClick={() => void reorder(index, 1)}>↓</button><button className="secondary-control" type="button" onClick={() => edit(item)}>ИЗМЕНИТЬ</button><button className="secondary-control" type="button" disabled={busy} onClick={() => void mutate(item, { active: !item.active })}>{item.active ? "ВЫКЛЮЧИТЬ" : "ВКЛЮЧИТЬ"}</button><button className="danger-control" type="button" disabled={busy} onClick={(event) => remove(item, event.currentTarget)}>УДАЛИТЬ</button></div></article>)}</div>
      <div className="promotion-preview-actions"><button className="secondary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} aria-describedby={disabledReason ? "promotion-bank-reason" : undefined} onClick={buildGuarded(() => buildPreview())}>СОБРАТЬ ВРУЧНУЮ</button><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} aria-describedby={disabledReason ? "promotion-bank-reason" : undefined} onClick={buildGuarded(() => buildPreview("", true))}>СОБРАТЬ СЛУЧАЙНО</button>{currentPreview && <button className="secondary-control" type="button" onClick={() => void buildPreview("", true)}>ПЕРЕСОБРАТЬ</button>}</div>{previewStale && !currentPreview && <p className="promotion-command-state error" role="status">Набор изменился — пересоберите превью</p>}{disabledReason && <p className="promotion-bank-reason" id="promotion-bank-reason">{disabledReason}</p>}
    </section>}
    {(!isPhone || bankView === "preview") && <aside className="promotion-preview">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← К ПЕРЕХОДАМ</button>}<div className="promotion-issue-controls"><strong>Набор для {transition.label}: {Object.values(bank?.quotas ?? emptyQuotas).reduce((sum, value) => sum + value, 0)} вопросов</strong><p>Квоты: один ответ {bank?.quotas?.single ?? 0}, несколько {bank?.quotas?.multiple ?? 0}, свободный текст {bank?.quotas?.freeText ?? 0}. Выбрано вручную: {selectedPool.length}.</p><div className="promotion-manual-pool">{bank?.items.filter((item) => item.active).map((item, index) => <label key={item.id}><input type="checkbox" checked={manualIds.includes(item.id)} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{index + 1}. {questionTypeLabels[item.type ?? "free-text"]}: {item.text}</span></label>)}</div><div className="promotion-preview-actions"><button type="button" aria-disabled={Boolean(disabledReason) || busy || !manualSelectionValid} onClick={() => { if (!disabledReason && !busy && manualSelectionValid) void buildPreview(); }}>СОБРАТЬ ВРУЧНУЮ</button><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} onClick={buildGuarded(() => buildPreview("", true))}>СОБРАТЬ СЛУЧАЙНО</button></div>{disabledReason && <p className="promotion-bank-reason">{disabledReason}</p>}</div>{currentPreview ? <><header><h3>ТОЧНЫЙ ТЕСТ</h3><span>{currentPreview.items.length}</span></header><ol>{currentPreview.items.map((item) => <li key={item.id}><b>{questionTypeLabels[item.type ?? "free-text"]}</b> {item.text}<button type="button" onClick={() => void buildPreview(item.id)}>ЗАМЕНИТЬ</button></li>)}</ol><label>Подходящий запрос<select value={selectedRequestId} onChange={(event) => setRequestId(event.target.value)}><option value="">Выберите запрос</option>{matchingRequests.map((row) => <option key={row.requestId} value={row.requestId}>{row.nickname}</option>)}</select></label><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy || !selectedRequestId} aria-describedby={disabledReason ? "promotion-confirm-reason" : undefined} onClick={(event) => !disabledReason && !busy && selectedRequestId && requestConfirm({ title: "Подтвердить неизменяемый тест", body: "Участник получит именно эти вопросы в указанном порядке.", confirmLabel: "Подтвердить набор", cancelLabel: "Не подтверждать", opener: event.currentTarget, run: () => void confirmPreview() })}>ПОДТВЕРДИТЬ НАБОР</button>{disabledReason && <p className="promotion-bank-reason" id="promotion-confirm-reason">{disabledReason}</p>}</> : <div className="promotion-empty"><strong>ПРЕДПРОСМОТР НЕ СОБРАН</strong><p>{disabledReason || "Выберите вопросы вручную или соберите случайный тест."}</p></div>}</aside>}
  </div></div>;
}
