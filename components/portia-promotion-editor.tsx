"use client";

import { useCallback, useEffect, useState } from "react";

type Branch = "requests" | "tasks" | "qualification";
type Kind = "ordinary" | "qualification";
type ReviewerRequest = {
  requestId: string; nickname: string; nicknameKey: string; titleId: string; targetTitleId: string;
  status: string; claimed: boolean; assignedToMe: boolean; createdAt: string;
  attemptId?: string | null; attemptStatus?: string | null; retakeAt?: string | null; technicalFailure?: boolean;
};
type ReviewerState = { ordinary: ReviewerRequest[]; qualification: ReviewerRequest[]; serverNow?: string };
type BankItem = { id: string; text: string; active: boolean; sortOrder: number; type?: "single" | "multiple" | "free-text"; options?: Array<{ text: string }> | string[]; answerKey?: unknown };
type Bank = { id: string; targetTitleId?: string; transitionId?: string; version: string; requiredCount?: number; quotas?: { single: number; multiple: number; freeText: number }; items: BankItem[] };
type BankState = { taskBanks: Bank[]; qualificationBanks: Bank[] };
type Preview = { preview: string; items: BankItem[]; expiresAt: string };

const emptyQueue: ReviewerState = { ordinary: [], qualification: [] };
const emptyBanks: BankState = { taskBanks: [], qualificationBanks: [] };

async function responseBody(response: Response) {
  try { return await response.json() as Record<string, unknown>; } catch { return {}; }
}

function errorText(body: Record<string, unknown>, fallback: string) {
  return typeof body.error === "string" ? body.error : fallback;
}

function PromotionConfirmDialog({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="promotion-confirm-backdrop" role="presentation"><section className="promotion-confirm" role="alertdialog" aria-modal="true" aria-labelledby="promotion-confirm-title"><h3 id="promotion-confirm-title">{title}</h3><p>{body}</p><div><button type="button" onClick={onCancel}>ОТМЕНИТЬ</button><button className="danger-control" type="button" onClick={onConfirm}>ПОДТВЕРДИТЬ</button></div></section></div>;
}

export function PromotionEditor({ visible, canManageEditors }: { visible: boolean; canManageEditors: boolean }) {
  const [branch, setBranch] = useState<Branch>("requests");
  const [kind, setKind] = useState<Kind>("ordinary");
  const [queue, setQueue] = useState<ReviewerState>(emptyQueue);
  const [banks, setBanks] = useState<BankState>(emptyBanks);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newText, setNewText] = useState("");
  const [questionType, setQuestionType] = useState<"single" | "multiple" | "free-text">("single");
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null);

  const applyQueue = useCallback((next: ReviewerState) => {
    setQueue(next);
    setSelectedRequestId((current) => {
      const all = [...(next.ordinary ?? []), ...(next.qualification ?? [])];
      return all.some((row) => row.requestId === current) ? current : all[0]?.requestId ?? "";
    });
  }, []);

  const loadQueue = useCallback(async () => {
    const response = await fetch("/api/promotion/reviewer", { cache: "no-store" });
    const body = await responseBody(response);
    if (!response.ok) { setMessage(errorText(body, "Очередь временно недоступна.")); return; }
    applyQueue(body as unknown as ReviewerState); setMessage("");
  }, [applyQueue]);

  const loadBanks = useCallback(async () => {
    const response = await fetch("/api/promotion/banks", { cache: "no-store" });
    const body = await responseBody(response);
    if (!response.ok) { setMessage(errorText(body, "Банки временно недоступны.")); return; }
    const next = body as unknown as BankState; setBanks(next);
    setSelectedBankId((current) => [...next.taskBanks, ...next.qualificationBanks].some((bank) => bank.id === current) ? current : next.taskBanks[0]?.id ?? next.qualificationBanks[0]?.id ?? "");
  }, []);

  useEffect(() => {
    if (!visible || document.visibilityState !== "visible") return;
    queueMicrotask(() => void loadQueue());
    const poll = () => { if (document.visibilityState === "visible") void loadQueue(); };
    const timer = window.setInterval(poll, 10_000);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [loadQueue, visible]);
  useEffect(() => { if (visible && branch !== "requests") queueMicrotask(() => void loadBanks()); }, [branch, loadBanks, visible]);

  const ordinaryCount = queue.ordinary.filter((row) => row.status === "pending").length;
  const qualificationCount = queue.qualification.filter((row) => row.status === "pending").length;
  const rows = kind === "ordinary" ? queue.ordinary : queue.qualification;
  const selected = [...queue.ordinary, ...queue.qualification].find((row) => row.requestId === selectedRequestId) ?? null;
  const bankList = branch === "qualification" ? banks.qualificationBanks : banks.taskBanks;
  const selectedBank = bankList.find((bank) => bank.id === selectedBankId) ?? bankList[0] ?? null;
  const ownRequests = (branch === "qualification" ? queue.qualification : queue.ordinary).filter((row) => row.assignedToMe && (row.status === "claimed" || row.status === "assigned"));

  const reviewerCommand = async (action: string, row: ReviewerRequest, extra: Record<string, unknown> = {}) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/promotion/reviewer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, kind: queue.ordinary.includes(row) ? "ordinary" : "qualification", requestId: row.requestId, ...extra }) });
      const body = await responseBody(response);
      if (body.state && typeof body.state === "object") applyQueue(body.state as unknown as ReviewerState);
      if (!response.ok) setMessage(response.status === 409 ? "Запрос уже взят другим проверяющим." : errorText(body, "Команда не выполнена."));
    } finally { setBusy(false); }
  };

  const bankCommand = async (payload: Record<string, unknown>) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/promotion/banks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await responseBody(response);
      if (!response.ok) { setMessage(errorText(body, "Не удалось сохранить изменения.")); return false; }
      if (body.state) setBanks(body.state as unknown as BankState);
      return true;
    } finally { setBusy(false); }
  };

  const buildPreview = async (replaceId = "", rebuild = false) => {
    if (!selectedBank) return;
    setBusy(true); setMessage("");
    try {
      const useManual = !rebuild && !replaceId && manualIds.length > 0;
      const response = await fetch("/api/promotion/banks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", kind: branch === "qualification" ? "qualification" : "ordinary", bankId: selectedBank.id, ...(useManual ? { manualIds } : {}), ...(replaceId && preview ? { replaceId, preview: preview.preview } : {}) }) });
      const body = await responseBody(response);
      if (!response.ok) { setPreview(null); setMessage(errorText(body, "Недостаточно активных элементов: проверьте количество и квоты.")); return; }
      setPreview(body as unknown as Preview);
    } finally { setBusy(false); }
  };

  const confirmPreview = async () => {
    if (!preview || !selectedBank) return;
    const requestId = ownRequests.find((row) => row.requestId === selectedRequestId)?.requestId ?? ownRequests[0]?.requestId;
    if (!requestId) { setMessage("Сначала возьмите подходящий запрос в работу."); return; }
    const ok = await bankCommand({ action: "confirm", kind: branch === "qualification" ? "qualification" : "ordinary", bankId: selectedBank.id, requestId, preview: preview.preview });
    if (ok) { setPreview(null); setManualIds([]); await loadQueue(); }
  };

  const saveNewItem = async () => {
    if (!selectedBank || !newText.trim()) return;
    const ok = branch === "tasks"
      ? await bankCommand({ action: "save-task-item", bankId: selectedBank.id, text: newText, active: true, sortOrder: selectedBank.items.length })
      : await bankCommand({ action: "save-question", bankId: selectedBank.id, question: questionType === "free-text" ? { type: questionType, text: newText, answer: "Проверяет проверяющий" } : { type: questionType, text: newText, options: ["Вариант 1", "Вариант 2"], answer: questionType === "single" ? 0 : [0] }, active: true, sortOrder: selectedBank.items.length });
    if (ok) setNewText("");
  };

  return <div className="promotion-editor">
    <nav className="promotion-editor-branches" aria-label="Разделы повышения">{([['requests','ЗАПРОСЫ', ordinaryCount + qualificationCount], ['tasks','ЗАДАНИЯ', banks.taskBanks.length], ['qualification','КВАЛИФИКАЦИЯ', qualificationCount]] as const).map(([id,label,count]) => <button key={id} type="button" className={branch === id ? "active" : ""} aria-pressed={branch === id} onClick={() => { setBranch(id); setPreview(null); }}>{label}<span>{count}</span></button>)}</nav>
    {message && <p className="promotion-editor-message" role="status">{message}</p>}
    {branch === "requests" ? <>
      <div className="promotion-queue-filters"><button type="button" className={kind === "ordinary" ? "active" : ""} onClick={() => setKind("ordinary")}>ОБЫЧНОЕ ПОВЫШЕНИЕ <span>{ordinaryCount}</span></button><button type="button" className={kind === "qualification" ? "active" : ""} onClick={() => setKind("qualification")}>КВАЛИФИКАЦИЯ <span>{qualificationCount}</span></button></div>
      <div className="promotion-editor-workbench">
        <aside className="promotion-request-list">{rows.map((row) => <button key={row.requestId} type="button" className={selectedRequestId === row.requestId ? "active" : ""} onClick={() => setSelectedRequestId(row.requestId)}><strong>{row.nickname}</strong><span>{row.titleId} → {row.targetTitleId}</span><em>{row.claimed ? "В РАБОТЕ" : row.status.toUpperCase()}</em></button>)}{rows.length === 0 && <div className="promotion-empty"><strong>НОВЫХ ЗАПРОСОВ НЕТ</strong><p>Оставьте вкладку открытой — список обновится автоматически.</p></div>}</aside>
        <article className="promotion-request-detail">{selected ? <><header><div><span>{queue.ordinary.includes(selected) ? "ОБЫЧНОЕ ПОВЫШЕНИЕ" : "КВАЛИФИКАЦИЯ"}</span><h2>{selected.nickname}</h2></div><b>{selected.claimed ? selected.assignedToMe ? "В РАБОТЕ У ВАС" : "ЗАНЯТ" : "НОВЫЙ"}</b></header><dl><div><dt>ПЕРЕХОД</dt><dd>{selected.titleId} → {selected.targetTitleId}</dd></div><div><dt>СОСТОЯНИЕ</dt><dd>{selected.status}</dd></div></dl><p className="promotion-cleanup-hint">Незавершённые данные удаляются через 3 дня.</p><div className="promotion-request-actions">{!selected.claimed && <button className="primary-control" disabled={busy} type="button" onClick={() => void reviewerCommand("claim", selected)}>ВЗЯТЬ ЗАПРОС</button>}{selected.assignedToMe && <><button type="button" disabled={busy} onClick={() => void reviewerCommand("release", selected)}>ОСВОБОДИТЬ</button>{queue.ordinary.includes(selected) && selected.status === "assigned" && <button className="primary-control" type="button" onClick={() => setConfirm({ title: `Зачесть задания: ${selected.nickname}`, body: "После подтверждения участник будет ожидать изменения звания в таблице.", run: () => void reviewerCommand("approve-task", selected) })}>ЗАЧЕСТЬ ЗАДАНИЯ</button>}<button className="danger-control" type="button" onClick={() => setConfirm({ title: `Отклонить: ${selected.nickname}`, body: "Участник увидит нейтральное сообщение без внутренней причины.", run: () => void reviewerCommand("reject", selected, { note: "" }) })}>ОТКЛОНИТЬ</button></>}{canManageEditors && selected.claimed && !selected.assignedToMe && <button type="button" onClick={() => void reviewerCommand("force-release", selected)}>ПРИНУДИТЕЛЬНО ОСВОБОДИТЬ</button>}{canManageEditors && <button type="button" onClick={() => void reviewerCommand("reset-device", selected, { nicknameKey: selected.nicknameKey })}>СБРОСИТЬ ПРИВЯЗКУ</button>}</div></> : <div className="promotion-empty">Выберите запрос.</div>}</article>
      </div>
    </> : <div className="promotion-bank-layout">
      <aside className="promotion-bank-list">{bankList.map((bank) => <button key={bank.id} type="button" className={selectedBank?.id === bank.id ? "active" : ""} onClick={() => { setSelectedBankId(bank.id); setPreview(null); setManualIds([]); }}><strong>{bank.targetTitleId ?? bank.transitionId ?? "Банк"}</strong><span>{bank.items.filter((item) => item.active).length} активных</span></button>)}</aside>
      <section className="promotion-bank-editor">{selectedBank ? <><header><h2>{selectedBank.targetTitleId ?? selectedBank.transitionId}</h2><span>ВЕРСИЯ {selectedBank.version}</span></header>{branch === "qualification" && <label>Тип вопроса<select value={questionType} onChange={(event) => setQuestionType(event.target.value as typeof questionType)}><option value="single">Один вариант</option><option value="multiple">Несколько вариантов</option><option value="free-text">Свободный ответ</option></select></label>}<label>Новый {branch === "tasks" ? "текст задания" : "вопрос"}<textarea value={newText} onChange={(event) => setNewText(event.target.value)} /></label><button type="button" disabled={busy || !newText.trim()} onClick={() => void saveNewItem()}>ДОБАВИТЬ</button><div className="promotion-bank-items">{selectedBank.items.map((item, index) => <article key={item.id}><label><input type="checkbox" checked={manualIds.includes(item.id)} disabled={!item.active} onChange={(event) => setManualIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.text}</span></label><div><button type="button" aria-label="Переместить выше" disabled={index === 0}>↑</button><button type="button" aria-label="Переместить ниже" disabled={index === selectedBank.items.length - 1}>↓</button><button type="button" onClick={() => void bankCommand(branch === "tasks" ? { action: "save-task-item", bankId: selectedBank.id, itemId: item.id, text: item.text, active: !item.active, sortOrder: item.sortOrder } : { action: "save-question", bankId: selectedBank.id, questionId: item.id, question: { type: item.type ?? "free-text", text: item.text, ...(item.type === "free-text" ? { answer: String(item.answerKey ?? "Ответ") } : { options: (item.options ?? []).map((option) => typeof option === "string" ? option : option.text), answer: item.answerKey ?? 0 }) }, active: !item.active, sortOrder: item.sortOrder })}>{item.active ? "ВЫКЛЮЧИТЬ" : "ВКЛЮЧИТЬ"}</button></div></article>)}</div><div className="promotion-preview-actions"><button type="button" onClick={() => void buildPreview()}>СОБРАТЬ НАБОР</button>{preview && <button type="button" onClick={() => void buildPreview("", true)}>ПЕРЕСОБРАТЬ</button>}</div></> : <div className="promotion-empty">Банки ещё не созданы.</div>}</section>
      <aside className="promotion-preview">{preview ? <><header><h3>ТОЧНЫЙ НАБОР</h3><span>{preview.items.length}</span></header><ol>{preview.items.map((item) => <li key={item.id}><span>{item.text}</span><button type="button" onClick={() => void buildPreview(item.id)}>ЗАМЕНИТЬ</button></li>)}</ol><label>Запрос<select value={selectedRequestId} onChange={(event) => setSelectedRequestId(event.target.value)}><option value="">Выберите запрос</option>{ownRequests.map((row) => <option key={row.requestId} value={row.requestId}>{row.nickname}</option>)}</select></label><button className="primary-control" type="button" disabled={busy || !ownRequests.some((row) => row.requestId === selectedRequestId)} onClick={() => setConfirm({ title: "Подтвердить неизменяемый набор", body: "Участник получит именно эти элементы в указанном порядке.", run: () => void confirmPreview() })}>ПОДТВЕРДИТЬ НАБОР</button></> : <div className="promotion-empty"><strong>ПРЕДПРОСМОТР НЕ СОБРАН</strong><p>Недостаточно активных элементов — подтверждение будет отключено с объяснением.</p></div>}</aside>
    </div>}
    {confirm && <PromotionConfirmDialog title={confirm.title} body={confirm.body} onCancel={() => setConfirm(null)} onConfirm={() => { const run = confirm.run; setConfirm(null); run(); }} />}
  </div>;
}
