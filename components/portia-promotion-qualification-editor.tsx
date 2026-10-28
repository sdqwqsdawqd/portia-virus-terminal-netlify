"use client";

import { useEffect, useMemo, useState } from "react";
import { qualificationPromotionTransitions } from "@/lib/portia-promotion";

type QuestionType = "single" | "multiple" | "free-text";
type RequestRow = { requestId: string; nickname: string; targetTitleId: string; status: string; assignedToMe: boolean };
type Item = { id: string; text: string; active: boolean; sortOrder: number; type?: QuestionType; options?: Array<{ text: string }> | string[]; answerKey?: unknown };
type Quotas = { single: number; multiple: number; freeText: number };
type Bank = { id: string; transitionId?: string; version: string; quotas?: Quotas; items: Item[] };
type Preview = { preview: string; items: Item[]; expiresAt: string; version: string };
type Post = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
const emptyQuotas: Quotas = { single: 1, multiple: 0, freeText: 0 };
const questionTypeLabels: Record<QuestionType, string> = {
  single: "Один вариант",
  multiple: "Несколько вариантов",
  "free-text": "Свободный ответ",
};

const optionText = (options: Item["options"]) => (options ?? []).map((option) => typeof option === "string" ? option : option.text);
function answerDraft(item: Item) {
  return item.type === "free-text" ? String(item.answerKey ?? "") : Array.isArray(item.answerKey) ? item.answerKey.join(",") : String(item.answerKey ?? 0);
}

export function PortiaPromotionQualificationEditor({ banks, requests, busy, post, refreshQueue }: {
  banks: Bank[]; requests: RequestRow[]; busy: boolean; post: Post; refreshQueue: () => Promise<void>;
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
  const transition = qualificationPromotionTransitions.find((item) => item.transitionId === transitionId) ?? qualificationPromotionTransitions[0];
  const bank = banks.find((item) => item.transitionId === transition.transitionId) ?? null;
  const matchingRequests = useMemo(() => requests.filter((row) => row.assignedToMe && row.status === "claimed" && row.targetTitleId === transition.transitionId), [requests, transition.transitionId]);

  const quotas = quotaDrafts[transition.transitionId] ?? bank?.quotas ?? emptyQuotas;
  const currentPreview = preview?.version === bank?.version ? preview : null;
  const selectedRequestId = matchingRequests.some((row) => row.requestId === requestId) ? requestId : matchingRequests[0]?.requestId ?? "";
  useEffect(() => { const query = window.matchMedia("(max-width: 900px)"); const update = () => setIsPhone(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);

  const saveBank = async () => { await post({ action: "save-qualification-bank", transitionId: transition.transitionId, quotas }); };
  const questionPayload = () => {
    if (type === "free-text") return { type, text, answer };
    const values = options.split("\n").map((value) => value.trim()).filter(Boolean);
    const indices = answer.split(",").map((value) => Number(value.trim())).filter(Number.isInteger);
    return { type, text, options: values, answer: type === "single" ? indices[0] ?? 0 : indices };
  };
  const saveQuestion = async () => {
    if (!bank || !text.trim()) return; const current = bank.items.find((item) => item.id === editingId);
    const result = await post({ action: "save-question", bankId: bank.id, ...(current ? { questionId: current.id } : {}), question: questionPayload(), active: current?.active ?? true, sortOrder: current?.sortOrder ?? bank.items.length });
    if (result) { setEditingId(""); setText(""); setType("single"); setOptions("Вариант 1\nВариант 2"); setAnswer("0"); }
  };
  const edit = (item: Item) => { setEditingId(item.id); setType(item.type ?? "free-text"); setText(item.text); setOptions(optionText(item.options).join("\n")); setAnswer(answerDraft(item)); };
  const mutate = async (item: Item, patch: Partial<Item>) => post({ action: "save-question", bankId: bank!.id, questionId: item.id, question: { ...(item.type === "free-text" ? { type: "free-text", text: item.text, answer: String(item.answerKey ?? "Ответ") } : { type: item.type ?? "single", text: item.text, options: optionText(item.options), answer: item.answerKey ?? 0 }) }, active: patch.active ?? item.active, sortOrder: patch.sortOrder ?? item.sortOrder });
  const reorder = async (index: number, delta: -1 | 1) => { if (!bank) return; const item = bank.items[index]; const other = bank.items[index + delta]; if (!other) return; await mutate(item, { sortOrder: other.sortOrder }); await mutate(other, { sortOrder: item.sortOrder }); };
  const remove = async (item: Item) => { if (bank && window.confirm(`Удалить вопрос «${item.text}» без возможности восстановления?`)) await post({ action: "delete-question", bankId: bank.id, questionId: item.id }); };
  const buildPreview = async (replaceId = "", random = false) => {
    if (!bank) return; const result = await post({ action: "preview", kind: "qualification", bankId: bank.id, ...(!random && !replaceId && manualIds.length ? { manualIds } : {}), ...(replaceId && currentPreview ? { replaceId, preview: currentPreview.preview } : {}) });
    if (result?.preview && Array.isArray(result.items)) { setPreview({ ...(result as unknown as Omit<Preview, "version">), version: bank.version }); if (isPhone) setBankView("preview"); }
  };
  const confirmPreview = async () => {
    if (!bank || !currentPreview || !selectedRequestId || !window.confirm("Подтвердить этот неизменяемый тест для выбранного запроса?")) return;
    const result = await post({ action: "confirm", kind: "qualification", bankId: bank.id, requestId: selectedRequestId, preview: currentPreview.preview });
    if (result) { setPreview(null); setManualIds([]); await refreshQueue(); }
  };
  const shortages = (["single", "multiple", "freeText"] as const).filter((quotaType) => (bank?.items.filter((item) => item.active && item.type === (quotaType === "freeText" ? "free-text" : quotaType)).length ?? 0) < (bank?.quotas?.[quotaType] ?? quotas[quotaType]));
  const disabledReason = !bank ? "Сначала сохраните квоты для этого перехода." : shortages.length ? `Недостаточно активных вопросов для квот: ${shortages.join(", ")}.` : !matchingRequests.length ? "Нет взятого вами квалификационного запроса для этого перехода." : "";

  return <div className="promotion-bank-layout promotion-qualification-editor">
    {(!isPhone || bankView === "list") && <aside className="promotion-bank-list">{qualificationPromotionTransitions.map((item) => <button key={item.transitionId} type="button" className={item.transitionId === transition.transitionId ? "active" : ""} onClick={() => { setTransitionId(item.transitionId); setPreview(null); setManualIds([]); if (isPhone) setBankView("editor"); }}><strong>{item.label}</strong><span>{banks.find((candidate) => candidate.transitionId === item.transitionId)?.items.filter((entry) => entry.active).length ?? 0} активных</span></button>)}</aside>}
    {(!isPhone || bankView === "editor") && <section className="promotion-bank-editor">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← НАЗАД К БАНКАМ</button>}<header><div><span>КВАЛИФИКАЦИОННЫЕ ВОПРОСЫ</span><h2>{transition.label}</h2></div><span>{bank ? `ВЕРСИЯ ${bank.version}` : "БАНК НЕ СОЗДАН"}</span></header>
      <div className="promotion-bank-settings promotion-quota-settings">{([['single','Один ответ'],['multiple','Несколько'],['freeText','Свободный текст']] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min={0} max={100} value={quotas[key]} onChange={(event) => setQuotaDrafts((current) => ({ ...current, [transition.transitionId]: { ...quotas, [key]: Math.max(0, Math.min(100, Number(event.target.value) || 0)) } }))} /></label>)}<button type="button" disabled={busy || Object.values(quotas).reduce((sum, value) => sum + value, 0) < 1} onClick={() => void saveBank()}>СОХРАНИТЬ КВОТЫ</button></div>
      <label>Тип вопроса<select value={type} onChange={(event) => setType(event.target.value as QuestionType)}><option value="single">Один вариант</option><option value="multiple">Несколько вариантов</option><option value="free-text">Свободный ответ</option></select></label><label>Текст вопроса<textarea value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} /></label>{type !== "free-text" && <label>Варианты, по одному в строке<textarea value={options} onChange={(event) => setOptions(event.target.value)} /></label>}<label>{type === "free-text" ? "Ключ ответа" : type === "single" ? "Индекс правильного варианта (с 0)" : "Индексы правильных вариантов через запятую"}<input value={answer} onChange={(event) => setAnswer(event.target.value)} /></label><button type="button" disabled={busy || !bank || !text.trim()} onClick={() => void saveQuestion()}>{editingId ? "СОХРАНИТЬ ВОПРОС" : "ДОБАВИТЬ ВОПРОС"}</button>
      <div className="promotion-bank-items">{bank?.items.map((item, index) => <article key={item.id}><label><input type="checkbox" checked={manualIds.includes(item.id)} disabled={!item.active} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span><b>{questionTypeLabels[item.type ?? "free-text"]}</b> {item.text}</span></label><div><button type="button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}>↑</button><button type="button" disabled={busy || index === bank.items.length - 1} onClick={() => void reorder(index, 1)}>↓</button><button type="button" onClick={() => edit(item)}>ИЗМЕНИТЬ</button><button type="button" disabled={busy} onClick={() => void mutate(item, { active: !item.active })}>{item.active ? "ВЫКЛЮЧИТЬ" : "ВКЛЮЧИТЬ"}</button><button className="danger-control" type="button" disabled={busy} onClick={() => void remove(item)}>УДАЛИТЬ</button></div></article>)}</div>
      <div className="promotion-preview-actions"><button type="button" disabled={busy || Boolean(disabledReason)} title={disabledReason} onClick={() => void buildPreview()}>СОБРАТЬ ВРУЧНУЮ</button><button type="button" disabled={busy || Boolean(disabledReason)} title={disabledReason} onClick={() => void buildPreview("", true)}>СОБРАТЬ СЛУЧАЙНО</button>{currentPreview && <button type="button" onClick={() => void buildPreview("", true)}>ПЕРЕСОБРАТЬ</button>}</div>{disabledReason && <p className="promotion-disabled-reason">{disabledReason}</p>}
    </section>}
    {(!isPhone || bankView === "preview") && <aside className="promotion-preview">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("editor")}>← НАЗАД К РЕДАКТОРУ</button>}{currentPreview ? <><header><h3>ТОЧНЫЙ ТЕСТ</h3><span>{currentPreview.items.length}</span></header><ol>{currentPreview.items.map((item) => <li key={item.id}><b>{questionTypeLabels[item.type ?? "free-text"]}</b> {item.text}<button type="button" onClick={() => void buildPreview(item.id)}>ЗАМЕНИТЬ</button></li>)}</ol><label>Подходящий запрос<select value={selectedRequestId} onChange={(event) => setRequestId(event.target.value)}><option value="">Выберите запрос</option>{matchingRequests.map((row) => <option key={row.requestId} value={row.requestId}>{row.nickname}</option>)}</select></label><button className="primary-control" type="button" disabled={busy || !selectedRequestId} onClick={() => void confirmPreview()}>ПОДТВЕРДИТЬ НАБОР</button></> : <div className="promotion-empty"><strong>ПРЕДПРОСМОТР НЕ СОБРАН</strong><p>{disabledReason || "Выберите вопросы вручную или соберите случайный тест."}</p></div>}</aside>}
  </div>;
}
