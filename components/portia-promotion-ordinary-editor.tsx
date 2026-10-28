"use client";

import { useEffect, useMemo, useState } from "react";
import { ordinaryPromotionTransitions } from "@/lib/portia-promotion";

type RequestRow = { requestId: string; nickname: string; targetTitleId: string; status: string; assignedToMe: boolean };
type Item = { id: string; text: string; active: boolean; sortOrder: number };
type Bank = { id: string; targetTitleId?: string; version: string; requiredCount?: number; items: Item[] };
type Preview = { preview: string; items: Item[]; expiresAt: string; version: string };
type Post = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;

export function PortiaPromotionOrdinaryEditor({ banks, requests, busy, post, refreshQueue }: {
  banks: Bank[]; requests: RequestRow[]; busy: boolean; post: Post; refreshQueue: () => Promise<void>;
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
  const transition = ordinaryPromotionTransitions.find((item) => item.targetTitleId === targetTitleId) ?? ordinaryPromotionTransitions[0];
  const bank = banks.find((item) => item.targetTitleId === transition.targetTitleId) ?? null;
  const matchingRequests = useMemo(() => requests.filter((row) => row.assignedToMe && (row.status === "claimed" || row.status === "assigned") && row.targetTitleId === transition.targetTitleId), [requests, transition.targetTitleId]);

  const requiredCount = requiredCounts[transition.targetTitleId] ?? bank?.requiredCount ?? 1;
  const currentPreview = preview?.version === bank?.version ? preview : null;
  const selectedRequestId = matchingRequests.some((row) => row.requestId === requestId) ? requestId : matchingRequests[0]?.requestId ?? "";
  useEffect(() => { const query = window.matchMedia("(max-width: 900px)"); const update = () => setIsPhone(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);

  const saveBank = async () => { await post({ action: "save-task-bank", targetTitleId: transition.targetTitleId, requiredCount }); };
  const saveItem = async () => {
    if (!bank || !draft.trim()) return;
    const current = bank.items.find((item) => item.id === editingId);
    const result = await post({ action: "save-task-item", bankId: bank.id, ...(current ? { itemId: current.id } : {}), text: draft, active: current?.active ?? true, sortOrder: current?.sortOrder ?? bank.items.length });
    if (result) { setDraft(""); setEditingId(""); }
  };
  const mutateItem = async (item: Item, patch: Partial<Item>) => post({ action: "save-task-item", bankId: bank!.id, itemId: item.id, text: patch.text ?? item.text, active: patch.active ?? item.active, sortOrder: patch.sortOrder ?? item.sortOrder });
  const reorder = async (index: number, delta: -1 | 1) => {
    if (!bank) return; const other = bank.items[index + delta]; const item = bank.items[index]; if (!other) return;
    await mutateItem(item, { sortOrder: other.sortOrder }); await mutateItem(other, { sortOrder: item.sortOrder });
  };
  const remove = async (item: Item) => {
    if (!bank || !window.confirm(`Удалить задание «${item.text}» без возможности восстановления?`)) return;
    await post({ action: "delete-task-item", bankId: bank.id, itemId: item.id });
  };
  const buildPreview = async (replaceId = "", random = false) => {
    if (!bank) return;
    const result = await post({ action: "preview", kind: "ordinary", bankId: bank.id, ...(!random && !replaceId && manualIds.length ? { manualIds } : {}), ...(replaceId && currentPreview ? { replaceId, preview: currentPreview.preview } : {}) });
    if (result?.preview && Array.isArray(result.items)) { setPreview({ ...(result as unknown as Omit<Preview, "version">), version: bank.version }); if (isPhone) setBankView("preview"); }
  };
  const confirmPreview = async () => {
    if (!bank || !currentPreview || !selectedRequestId || !window.confirm("Подтвердить этот неизменяемый набор заданий для выбранного запроса?")) return;
    const result = await post({ action: "confirm", kind: "ordinary", bankId: bank.id, requestId: selectedRequestId, preview: currentPreview.preview });
    if (result) { setPreview(null); setManualIds([]); await refreshQueue(); }
  };
  const activeCount = bank?.items.filter((item) => item.active).length ?? 0;
  const disabledReason = !bank ? "Сначала сохраните количество заданий для этого перехода." : activeCount < (bank.requiredCount ?? 1) ? `Недостаточно активных заданий: ${activeCount} из ${bank.requiredCount ?? 1}.` : !matchingRequests.length ? "Нет взятого вами запроса для этого звания." : "";

  return <div className="promotion-bank-layout promotion-ordinary-editor">
    {(!isPhone || bankView === "list") && <aside className="promotion-bank-list">{ordinaryPromotionTransitions.map((item) => <button key={item.targetTitleId} type="button" className={item.targetTitleId === transition.targetTitleId ? "active" : ""} onClick={() => { setTargetTitleId(item.targetTitleId); setPreview(null); setManualIds([]); if (isPhone) setBankView("editor"); }}><strong>{item.label}</strong><span>{banks.find((candidate) => candidate.targetTitleId === item.targetTitleId)?.items.filter((entry) => entry.active).length ?? 0} активных</span></button>)}</aside>}
    {(!isPhone || bankView === "editor") && <section className="promotion-bank-editor">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("list")}>← НАЗАД К БАНКАМ</button>}<header><div><span>ОБЫЧНЫЕ ЗАДАНИЯ</span><h2>{transition.label}</h2></div><span>{bank ? `ВЕРСИЯ ${bank.version}` : "БАНК НЕ СОЗДАН"}</span></header>
      <div className="promotion-bank-settings"><label>Заданий в наборе<input type="number" min={1} max={50} value={requiredCount} onChange={(event) => setRequiredCounts((current) => ({ ...current, [transition.targetTitleId]: Math.max(1, Math.min(50, Number(event.target.value) || 1)) }))} /></label><button type="button" disabled={busy} onClick={() => void saveBank()}>СОХРАНИТЬ КОЛИЧЕСТВО</button></div>
      <label>{editingId ? "Редактировать задание" : "Новое задание"}<textarea value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} /></label><button type="button" disabled={busy || !bank || !draft.trim()} onClick={() => void saveItem()}>{editingId ? "СОХРАНИТЬ ЗАДАНИЕ" : "ДОБАВИТЬ ЗАДАНИЕ"}</button>
      <div className="promotion-bank-items">{bank?.items.map((item, index) => <article key={item.id}><label><input type="checkbox" checked={manualIds.includes(item.id)} disabled={!item.active} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.text}</span></label><div><button type="button" disabled={busy || index === 0} onClick={() => void reorder(index, -1)}>↑</button><button type="button" disabled={busy || index === bank.items.length - 1} onClick={() => void reorder(index, 1)}>↓</button><button type="button" onClick={() => { setEditingId(item.id); setDraft(item.text); }}>ИЗМЕНИТЬ</button><button type="button" disabled={busy} onClick={() => void mutateItem(item, { active: !item.active })}>{item.active ? "ВЫКЛЮЧИТЬ" : "ВКЛЮЧИТЬ"}</button><button className="danger-control" type="button" disabled={busy} onClick={() => void remove(item)}>УДАЛИТЬ</button></div></article>)}</div>
      <div className="promotion-preview-actions"><button type="button" disabled={busy || Boolean(disabledReason)} title={disabledReason} onClick={() => void buildPreview()}>СОБРАТЬ ВРУЧНУЮ</button><button type="button" disabled={busy || Boolean(disabledReason)} title={disabledReason} onClick={() => void buildPreview("", true)}>СОБРАТЬ СЛУЧАЙНО</button>{currentPreview && <button type="button" onClick={() => void buildPreview("", true)}>ПЕРЕСОБРАТЬ</button>}</div>{disabledReason && <p className="promotion-disabled-reason">{disabledReason}</p>}
    </section>}
    {(!isPhone || bankView === "preview") && <aside className="promotion-preview">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setBankView("editor")}>← НАЗАД К РЕДАКТОРУ</button>}{currentPreview ? <><header><h3>ТОЧНЫЙ НАБОР</h3><span>{currentPreview.items.length}</span></header><ol>{currentPreview.items.map((item) => <li key={item.id}>{item.text}<button type="button" onClick={() => void buildPreview(item.id)}>ЗАМЕНИТЬ</button></li>)}</ol><label>Подходящий запрос<select value={selectedRequestId} onChange={(event) => setRequestId(event.target.value)}><option value="">Выберите запрос</option>{matchingRequests.map((row) => <option key={row.requestId} value={row.requestId}>{row.nickname}</option>)}</select></label><button className="primary-control" type="button" disabled={busy || !selectedRequestId} onClick={() => void confirmPreview()}>ПОДТВЕРДИТЬ НАБОР</button></> : <div className="promotion-empty"><strong>ПРЕДПРОСМОТР НЕ СОБРАН</strong><p>{disabledReason || "Выберите задания вручную или соберите случайный набор."}</p></div>}</aside>}
  </div>;
}
