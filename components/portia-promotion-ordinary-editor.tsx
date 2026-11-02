"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ordinaryPromotionTransitions } from "@/lib/portia-promotion";
import { taskBankLimitError } from "@/lib/portia-promotion-reviewer";
import type { ConfirmIntent } from "./portia-promotion-editor-main";

type RequestRow = { requestId: string; nickname: string; targetTitleId: string; status: string; assignedToMe: boolean };
type Item = { id: string; text: string; active: boolean; sortOrder: number };
type Bank = { id: string; targetTitleId?: string; version: string; requiredCount?: number; items: Item[] };
type Preview = { preview: string; items: Item[]; expiresAt: string; version: string };
type Post = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
type CommandState = { phase: "idle" | "saving" | "saved" | "error"; message: string };

export function PortiaPromotionOrdinaryEditor({ banks, requests, busy, post, refreshQueue, requestConfirm }: {
  banks: Bank[]; requests: RequestRow[]; busy: boolean; post: Post; refreshQueue: () => Promise<void>; requestConfirm: (intent: ConfirmIntent) => void;
}) {
  const [targetTitleId, setTargetTitleId] = useState(ordinaryPromotionTransitions[0].targetTitleId);
  const [requiredCounts, setRequiredCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState("");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [requestId, setRequestId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  const [bankView, setBankView] = useState<"list" | "editor" | "preview">("list");
  const [previewStale, setPreviewStale] = useState(false);
  const [commandState, setCommandState] = useState<CommandState>({ phase: "idle", message: "" });
  const savingRef = useRef(false);
  const transition = ordinaryPromotionTransitions.find((item) => item.targetTitleId === targetTitleId) ?? ordinaryPromotionTransitions[0];
  const bank = banks.find((item) => item.targetTitleId === transition.targetTitleId) ?? null;
  const matchingRequests = useMemo(() => requests.filter((row) => row.assignedToMe && (row.status === "claimed" || row.status === "assigned") && row.targetTitleId === transition.targetTitleId), [requests, transition.targetTitleId]);

  const requiredCount = requiredCounts[transition.targetTitleId] ?? bank?.requiredCount ?? 1;
  const currentPreview = preview?.version === bank?.version ? preview : null;
  const selectedRequestId = matchingRequests.some((row) => row.requestId === requestId) ? requestId : matchingRequests[0]?.requestId ?? "";
  const activeCount = bank?.items.filter((item) => item.active).length ?? 0;
  const countError = taskBankLimitError(requiredCount, activeCount, Boolean(bank));
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
    if (countError) { setCommandState({ phase: "error", message: `Количество не сохранено. ${countError}` }); return; }
    const submittedCount = requiredCount;
    const result = await settleMutation({ action: "save-task-bank", targetTitleId: transition.targetTitleId, requiredCount: submittedCount }, "Количество сохранено и подтверждено сервером.");
    if (!result?.state) return;
    setRequiredCounts((current) => { if (current[transition.targetTitleId] !== submittedCount) return current; const next = { ...current }; delete next[transition.targetTitleId]; return next; });
  };
  const saveItem = async () => {
    if (!bank || !draft.trim()) return;
    const current = bank.items.find((item) => item.id === editingId);
    const submittedDraft = draft;
    const submittedEditingId = editingId;
    const result = await settleMutation({ action: "save-task-item", bankId: bank.id, ...(current ? { itemId: current.id } : {}), text: submittedDraft, active: current?.active ?? true, sortOrder: current?.sortOrder ?? bank.items.length }, current ? "Задание обновлено." : "Задание добавлено.");
    if (result) {
      setDraft((current) => current === submittedDraft ? "" : current);
      setEditingId((currentId) => currentId === submittedEditingId ? "" : currentId);
    }
  };
  const mutateItem = async (item: Item, patch: Partial<Item>) => settleMutation({ action: "save-task-item", bankId: bank!.id, itemId: item.id, text: patch.text ?? item.text, active: patch.active ?? item.active, sortOrder: patch.sortOrder ?? item.sortOrder }, "Задание обновлено.");
  const reorder = async (index: number, delta: -1 | 1) => {
    if (!bank) return; const other = bank.items[index + delta]; const item = bank.items[index]; if (!other) return;
    await mutateItem(item, { sortOrder: other.sortOrder }); await mutateItem(other, { sortOrder: item.sortOrder });
  };
  const remove = (item: Item, opener: HTMLElement) => {
    if (!bank) return;
    requestConfirm({ title: "Удалить задание", body: `Задание «${item.text}» будет удалено без возможности восстановления.`, confirmLabel: "Удалить задание", cancelLabel: "Оставить задание", opener, run: () => void settleMutation({ action: "delete-task-item", bankId: bank.id, itemId: item.id }, "Задание удалено.") });
  };
  const buildPreview = async (replaceId = "", random = false) => {
    if (!bank) return;
    const result = await post({ action: "preview", kind: "ordinary", bankId: bank.id, ...(!random && !replaceId && manualIds.length ? { manualIds } : {}), ...(replaceId && currentPreview ? { replaceId, preview: currentPreview.preview } : {}) });
    if (result?.preview && Array.isArray(result.items) && typeof result.version === "string") { setPreview({ ...(result as unknown as Preview), version: result.version }); setPreviewStale(false); if (isPhone) setBankView("preview"); }
  };
  const confirmPreview = async () => {
    if (!bank || !currentPreview || !selectedRequestId) return;
    const result = await post({ action: "confirm", kind: "ordinary", bankId: bank.id, requestId: selectedRequestId, preview: currentPreview.preview });
    if (result) { setPreview(null); setManualIds([]); await refreshQueue(); }
  };
  const previewPoolError = bank ? taskBankLimitError(bank?.requiredCount ?? 1, activeCount, true) : null;
  const disabledReason = !bank ? "Сначала сохраните количество заданий для этого перехода." : previewPoolError ? previewPoolError : !matchingRequests.length ? "Нет взятого вами запроса для этого звания." : "";
  const buildGuarded = (run: () => Promise<void>) => () => { if (!busy && !disabledReason) void run(); };

  return <div className="promotion-bank-layout promotion-ordinary-editor">
    {(!isPhone || bankView === "list") && <aside className="promotion-bank-list">{ordinaryPromotionTransitions.map((item) => <button key={item.targetTitleId} type="button" className={item.targetTitleId === transition.targetTitleId ? "active" : ""} onClick={() => { setTargetTitleId(item.targetTitleId); setPreview(null); setPreviewStale(false); setManualIds([]); if (isPhone) setBankView("editor"); }}><strong>{item.label}</strong><span>{banks.find((candidate) => candidate.targetTitleId === item.targetTitleId)?.items.filter((entry) => entry.active).length ?? 0} активных</span></button>)}</aside>}
    {(!isPhone || bankView === "editor") && <section className="promotion-bank-editor">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← НАЗАД К БАНКАМ</button>}<header><div><span>ОБЫЧНЫЕ ЗАДАНИЯ</span><h2>{transition.label}</h2></div><span>{bank ? `ВЕРСИЯ ${bank.version}` : "БАНК НЕ СОЗДАН"}</span></header>
      <div className="promotion-bank-settings"><label>Заданий в наборе<input type="number" min={1} max={50} value={requiredCount} onChange={(event) => setRequiredCounts((current) => ({ ...current, [transition.targetTitleId]: Math.max(1, Math.min(50, Number(event.target.value) || 1)) }))} /></label><button className="primary-control" type="button" disabled={busy || Boolean(countError)} title={countError ?? undefined} onClick={() => void saveBank()}>СОХРАНИТЬ КОЛИЧЕСТВО</button></div>
      {commandState.message && <p className={`promotion-command-state ${commandState.phase}`} role="status">{commandState.message}</p>}
      <label>{editingId ? "Редактировать задание" : "Новое задание"}<textarea value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} /></label><button className="primary-control" type="button" disabled={busy || !bank || !draft.trim()} onClick={() => void saveItem()}>{editingId ? "СОХРАНИТЬ ЗАДАНИЕ" : "ДОБАВИТЬ ЗАДАНИЕ"}</button>
      <div className="promotion-bank-items">{bank?.items.map((item, index) => <article key={item.id}><label><input type="checkbox" checked={manualIds.includes(item.id)} disabled={!item.active} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.text}</span></label><div><button className="secondary-control" aria-label="Переместить выше" type="button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}>↑</button><button className="secondary-control" aria-label="Переместить ниже" type="button" disabled={busy || index === bank.items.length - 1} onClick={() => void reorder(index, 1)}>↓</button><button className="secondary-control" type="button" onClick={() => { setEditingId(item.id); setDraft(item.text); }}>ИЗМЕНИТЬ</button><button className="secondary-control" type="button" disabled={busy} onClick={() => void mutateItem(item, { active: !item.active })}>{item.active ? "ВЫКЛЮЧИТЬ" : "ВКЛЮЧИТЬ"}</button><button className="danger-control" type="button" disabled={busy} onClick={(event) => remove(item, event.currentTarget)}>УДАЛИТЬ</button></div></article>)}</div>
      <div className="promotion-preview-actions"><button className="secondary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} aria-describedby={disabledReason ? "promotion-bank-reason" : undefined} onClick={buildGuarded(() => buildPreview())}>СОБРАТЬ ВРУЧНУЮ</button><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy} aria-describedby={disabledReason ? "promotion-bank-reason" : undefined} onClick={buildGuarded(() => buildPreview("", true))}>СОБРАТЬ СЛУЧАЙНО</button>{currentPreview && <button className="secondary-control" type="button" onClick={() => void buildPreview("", true)}>ПЕРЕСОБРАТЬ</button>}</div>{previewStale && !currentPreview && <p className="promotion-command-state error" role="status">Набор изменился — пересоберите превью</p>}{disabledReason && <p className="promotion-bank-reason" id="promotion-bank-reason">{disabledReason}</p>}
    </section>}
    {(!isPhone || bankView === "preview") && <aside className="promotion-preview">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("editor")}>← НАЗАД К РЕДАКТОРУ</button>}{currentPreview ? <><header><h3>ТОЧНЫЙ НАБОР</h3><span>{currentPreview.items.length}</span></header><ol>{currentPreview.items.map((item) => <li key={item.id}>{item.text}<button type="button" onClick={() => void buildPreview(item.id)}>ЗАМЕНИТЬ</button></li>)}</ol><label>Подходящий запрос<select value={selectedRequestId} onChange={(event) => setRequestId(event.target.value)}><option value="">Выберите запрос</option>{matchingRequests.map((row) => <option key={row.requestId} value={row.requestId}>{row.nickname}</option>)}</select></label><button className="primary-control" type="button" aria-disabled={Boolean(disabledReason) || busy || !selectedRequestId} aria-describedby={disabledReason ? "promotion-confirm-reason" : undefined} onClick={(event) => !disabledReason && !busy && selectedRequestId && requestConfirm({ title: "Подтвердить неизменяемый набор", body: "Участник получит именно эти задания в указанном порядке.", confirmLabel: "Подтвердить набор", cancelLabel: "Не подтверждать", opener: event.currentTarget, run: () => void confirmPreview() })}>ПОДТВЕРДИТЬ НАБОР</button>{disabledReason && <p className="promotion-bank-reason" id="promotion-confirm-reason">{disabledReason}</p>}</> : <div className="promotion-empty"><strong>ПРЕДПРОСМОТР НЕ СОБРАН</strong><p>{disabledReason || "Выберите задания вручную или соберите случайный набор."}</p></div>}</aside>}
  </div>;
}
