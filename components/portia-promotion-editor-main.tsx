"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { promotionTitles } from "@/lib/portia-promotion";
import { requestForActiveQueue } from "@/lib/portia-promotion-editor-state";
import { PortiaPromotionOrdinaryEditor } from "./portia-promotion-ordinary-editor";
import { PortiaPromotionQualificationEditor } from "./portia-promotion-qualification-editor";

type Branch = "requests" | "tasks" | "qualification";
type Kind = "ordinary" | "qualification";
type ReviewerAnswer = { answerId: string; questionId: string; questionText: string; questionType: "single" | "multiple" | "free-text"; options: string[]; answer: string | string[]; correct: boolean | null };
type ReviewerRequest = { requestId: string; nickname: string; nicknameKey: string; titleId: string; targetTitleId: string; status: string; claimed: boolean; assignedToMe: boolean; createdAt: string; attemptId?: string | null; attemptStatus?: string | null; retakeAt?: string | null; technicalFailure?: string | null; answers?: ReviewerAnswer[] };
type CleanupRow = { requestId: string; kind: Kind; status: string; nickname: string; deleteAt: string; due: boolean };
type ReviewerState = { ordinary: ReviewerRequest[]; qualification: ReviewerRequest[]; serverNow?: string; cleanupPreview?: CleanupRow[] };
type BankItem = { id: string; text: string; active: boolean; sortOrder: number; type?: "single" | "multiple" | "free-text"; options?: Array<{ text: string }> | string[]; answerKey?: unknown };
type Bank = { id: string; targetTitleId?: string; transitionId?: string; version: string; requiredCount?: number; quotas?: { single: number; multiple: number; freeText: number }; items: BankItem[] };
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

export function PromotionEditorMain({ visible, canManageEditors }: { visible: boolean; canManageEditors: boolean }) {
  const [branch, setBranch] = useState<Branch>("requests"); const [kind, setKind] = useState<Kind>("ordinary"); const [queue, setQueue] = useState<ReviewerState>(emptyQueue); const [banks, setBanks] = useState<BankState>(emptyBanks); const [selectedRequestId, setSelectedRequestId] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [resetNickname, setResetNickname] = useState(""); const [confirm, setConfirm] = useState<ConfirmIntent | null>(null); const [isPhone, setIsPhone] = useState(false); const [requestView, setRequestView] = useState<"queue" | "detail">("queue"); const [denied, setDenied] = useState(false); const [conflict, setConflict] = useState(false); const [queueStatus, setQueueStatus] = useState<LoadStatus>("loading"); const [banksStatus, setBanksStatus] = useState<LoadStatus>("loading");
  const queueRequestEpoch = useRef(0);
  const applyQueue = useCallback((next: ReviewerState) => { setQueue(next); setSelectedRequestId((current) => { const all = [...(next.ordinary ?? []), ...(next.qualification ?? [])]; return all.some((row) => row.requestId === current) ? current : all[0]?.requestId ?? ""; }); }, []);
  const deny = useCallback(() => { setConflict(false); setDenied(true); setQueue(emptyQueue); setBanks(emptyBanks); setSelectedRequestId(""); setMessage(""); setConfirm(null); }, []);
  const loadQueue = useCallback(async () => {
    const requestEpoch = ++queueRequestEpoch.current;
    try {
      const response = await fetch("/api/promotion/reviewer", { cache: "no-store" }); const body = await responseBody(response);
      if (requestEpoch !== queueRequestEpoch.current) return;
      if (isDenied(response, body)) return deny();
      if (!response.ok) { setQueueStatus((status) => status === "ready" ? status : "error"); return setMessage(errorText(body, "Очередь временно недоступна.")); }
      setDenied(false); applyQueue(body as unknown as ReviewerState); setQueueStatus("ready"); setMessage(""); setConflict(false);
    } catch { if (requestEpoch !== queueRequestEpoch.current) return; setQueueStatus((status) => status === "ready" ? status : "error"); setMessage("Нет связи с сервером. Очередь не обновлена."); }
  }, [applyQueue, deny]);
  const loadBanks = useCallback(async () => {
    try {
      const response = await fetch("/api/promotion/banks", { cache: "no-store" }); const body = await responseBody(response);
      if (isDenied(response, body)) return deny();
      if (!response.ok) { setBanksStatus((status) => status === "ready" ? status : "error"); return setMessage(errorText(body, "Банки временно недоступны.")); }
      setDenied(false); setBanks(body as unknown as BankState); setBanksStatus("ready");
    } catch { setBanksStatus((status) => status === "ready" ? status : "error"); setMessage("Нет связи с сервером. Банки не загружены."); }
  }, [deny]);
  useEffect(() => { if (!visible || document.visibilityState !== "visible") return; queueMicrotask(() => void loadQueue()); const poll = () => { if (document.visibilityState === "visible") void loadQueue(); }; const timer = window.setInterval(poll, 10_000); document.addEventListener("visibilitychange", poll); return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); }; }, [loadQueue, visible]);
  useEffect(() => { if (visible && branch !== "requests") queueMicrotask(() => void loadBanks()); }, [branch, loadBanks, visible]);
  useEffect(() => { const query = window.matchMedia("(max-width: 900px)"); const update = () => setIsPhone(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  const ordinaryCount = queue.ordinary.length; const qualificationCount = queue.qualification.length; const rows = kind === "ordinary" ? queue.ordinary : queue.qualification; const selected = requestForActiveQueue(rows, selectedRequestId);
  const reviewerCommand = async (action: string, row: ReviewerRequest, extra: Record<string, unknown> = {}) => { queueRequestEpoch.current += 1; setBusy(true); setMessage(""); try { const response = await fetch("/api/promotion/reviewer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, kind: queue.ordinary.includes(row) ? "ordinary" : "qualification", requestId: row.requestId, ...extra }) }); const body = await responseBody(response); queueRequestEpoch.current += 1; if (isDenied(response, body)) return deny(); if (body.state && typeof body.state === "object") applyQueue(body.state as unknown as ReviewerState); if (!response.ok) { setConflict(response.status === 409); setMessage(errorText(body, action === "claim" ? "Запрос уже взят другим проверяющим." : action === "reject" ? "Запрос не отклонён. Обновите очередь." : "Команда не выполнена.")); return; } if (action === "reject" || action === "delete-request") { setSelectedRequestId(""); setMessage(action === "reject" ? "Запрос отклонён и удалён из активной очереди." : "Запрос удалён."); } } catch { setMessage("Нет связи с сервером. Изменение не применено."); } finally { setBusy(false); } };
  const resetDevice = async (nicknameKey: string) => { setBusy(true); try { const response = await fetch("/api/promotion/reviewer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset-device", nicknameKey }) }); const body = await responseBody(response); if (isDenied(response, body)) return deny(); if (!response.ok) return setMessage(errorText(body, "Привязку не удалось сбросить.")); setResetNickname(""); setMessage(`Привязка ${nicknameKey} сброшена.`); } finally { setBusy(false); } };
  const postBank = async (payload: Record<string, unknown>) => { setBusy(true); setMessage(""); try { const response = await fetch("/api/promotion/banks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await responseBody(response); if (isDenied(response, body)) { deny(); return null; } if (!response.ok) { setConflict(response.status === 409); setMessage(errorText(body, "Не удалось сохранить изменения.")); return null; } if (body.state && typeof body.state === "object") setBanks(body.state as unknown as BankState); return body; } catch { setMessage("Нет связи с сервером. Черновик сохранён в форме."); return null; } finally { setBusy(false); } };
  const irreversible = "Запрос и связанные данные будут удалены без восстановления.";
  if (denied) return <div className="promotion-editor"><div className="empty-state" role="alert"><strong>Доступ закрыт</strong></div></div>;
  return <div className="promotion-editor">
    <nav className="promotion-editor-branches" aria-label="Разделы повышения">{([['requests','ЗАПРОСЫ',ordinaryCount + qualificationCount],['tasks','ЗАДАНИЯ',banks.taskBanks.length],['qualification','КВАЛИФИКАЦИЯ',qualificationCount]] as const).map(([id,label,count]) => <button key={id} type="button" className={branch === id ? "active" : ""} aria-pressed={branch === id} aria-label={`${label}: ${count}`} onKeyDown={moveButtonTab} onClick={() => { setBranch(id); if (id === "requests") { setKind("ordinary"); setSelectedRequestId(""); } setRequestView("queue"); }}>{label}<span aria-hidden="true">{count}</span></button>)}</nav>
    {message && <p className="promotion-editor-message" role="status">{message}</p>}
    {message && conflict && <div className="promotion-editor-conflict"><p>Данные изменились. Ваш ввод сохранён.</p><div><button type="button" onClick={() => void (branch === "requests" ? loadQueue() : Promise.all([loadQueue(), loadBanks()]))}>Загрузить их версию</button><button type="button" onClick={() => { setConflict(false); setMessage(""); }}>Оставить мой ввод</button></div></div>}
    {branch === "requests" ? <>
      <div className="promotion-requests-toolbar">
      <div className="promotion-queue-filters" role="group" aria-label="Типы запросов"><button type="button" className={kind === "ordinary" ? "active" : ""} aria-pressed={kind === "ordinary"} aria-label={`Обычное повышение: ${ordinaryCount}`} onKeyDown={moveButtonTab} onClick={() => { setKind("ordinary"); setSelectedRequestId(""); setRequestView("queue"); }}>ОБЫЧНОЕ ПОВЫШЕНИЕ <span aria-hidden="true">{ordinaryCount}</span></button><button type="button" className={kind === "qualification" ? "active" : ""} aria-pressed={kind === "qualification"} aria-label={`Квалификация: ${qualificationCount}`} onKeyDown={moveButtonTab} onClick={() => { setKind("qualification"); setSelectedRequestId(""); setRequestView("queue"); }}>КВАЛИФИКАЦИЯ <span aria-hidden="true">{qualificationCount}</span></button></div>
      {canManageEditors && <form className="promotion-device-reset" onSubmit={(event) => { event.preventDefault(); const key = resetNickname.trim(); const opener = event.nativeEvent.submitter as HTMLElement | null; if (key) setConfirm({ title: `Сбросить привязку: ${key}`, body: "Участник сможет привязать новое устройство.", confirmLabel: "Сбросить привязку", cancelLabel: "Не сбрасывать", run: () => void resetDevice(key), opener }); }}><label>Точный ник для отзыва привязки<input value={resetNickname} maxLength={64} onChange={(event) => setResetNickname(event.target.value)} /></label><button disabled={!resetNickname.trim()}>СБРОСИТЬ ПРИВЯЗКУ ПО НИКУ</button></form>}
      </div>
      {(queue.cleanupPreview?.length ?? 0) > 0 && <details className="promotion-cleanup-disclosure"><summary>Незавершённые данные удаляются через 3 дня <span>{queue.cleanupPreview?.length}</span></summary><div>{queue.cleanupPreview?.map((row) => <article key={`${row.kind}:${row.requestId}`}><strong>{row.nickname}</strong><span>{row.kind === "ordinary" ? "Обычное повышение" : "Квалификация"} · {requestStatusLabel(row.status)}</span><time dateTime={row.deleteAt}>Дата удаления: {new Date(row.deleteAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" })} МСК</time></article>)}</div></details>}
      <div className="promotion-editor-workbench">
        {(!isPhone || requestView === "queue") && <aside className="promotion-request-list">{queueStatus === "loading" && skeleton}{rows.map((row) => <button key={row.requestId} className={selected?.requestId === row.requestId ? "active" : ""} onClick={() => { setSelectedRequestId(row.requestId); if (isPhone) setRequestView("detail"); }}><strong>{row.nickname}</strong><span>{titleLabel(row.titleId)} → {titleLabel(row.targetTitleId)}</span><em>{row.claimed ? "В РАБОТЕ" : requestStatusLabel(row.status).toUpperCase()}</em></button>)}{rows.length === 0 && queueStatus === "ready" && <div className="promotion-empty"><strong>НОВЫХ ЗАПРОСОВ НЕТ</strong></div>}{rows.length === 0 && queueStatus === "error" && <div className="promotion-empty"><strong>ОЧЕРЕДЬ НЕ ЗАГРУЖЕНА</strong><p>Список обновится автоматически, когда связь восстановится.</p><button type="button" onClick={() => void loadQueue()}>Повторить загрузку</button></div>}</aside>}
        {(!isPhone || requestView === "detail") && <article className="promotion-request-detail">{isPhone && <button className="promotion-phone-back" type="button" onClick={() => setRequestView("queue")}>← НАЗАД К ЗАПРОСАМ</button>}{selected ? <><header><div><span>{queue.ordinary.includes(selected) ? "ОБЫЧНОЕ ПОВЫШЕНИЕ" : "КВАЛИФИКАЦИЯ"}</span><h2>{selected.nickname}</h2></div><b>{selected.claimed ? selected.assignedToMe ? "В РАБОТЕ У ВАС" : "ЗАНЯТ" : "НОВЫЙ"}</b></header><dl><div><dt>ПЕРЕХОД</dt><dd>{titleLabel(selected.titleId)} → {titleLabel(selected.targetTitleId)}</dd></div><div><dt>СОСТОЯНИЕ</dt><dd>{requestStatusLabel(selected.status)}</dd></div></dl>{queue.qualification.includes(selected) && selected.claimed && <QualificationGrading row={selected} busy={busy} onCommand={(action, extra) => reviewerCommand(action, selected, extra)} onConfirm={setConfirm} />}<div className="promotion-request-actions">{!selected.claimed && <button className="primary-control" onClick={() => void reviewerCommand("claim", selected)}>ВЗЯТЬ ЗАПРОС</button>}{selected.assignedToMe && <><button onClick={() => void reviewerCommand("release", selected)}>ОСВОБОДИТЬ</button>{queue.ordinary.includes(selected) && selected.status === "assigned" && <button onClick={(event) => setConfirm({ title: `Зачесть задания: ${selected.nickname}`, body: "Звание затем меняется в таблице.", confirmLabel: "Зачесть задания", cancelLabel: "Не зачитывать", run: () => void reviewerCommand("approve-task", selected), opener: event.currentTarget })}>ЗАЧЕСТЬ ЗАДАНИЯ</button>}<button className="danger-control" onClick={(event) => setConfirm({ title: `Отклонить и удалить: ${selected.nickname}`, body: irreversible, confirmLabel: "Отклонить запрос", cancelLabel: "Не отклонять", run: () => void reviewerCommand("reject", selected, { note: "" }), opener: event.currentTarget })}>ОТКЛОНИТЬ</button></>}{canManageEditors && selected.claimed && !selected.assignedToMe && <button onClick={(event) => setConfirm({ title: `Снять claim: ${selected.nickname}`, body: "Запрос вернётся в очередь.", confirmLabel: "Снять claim", cancelLabel: "Не снимать", run: () => void reviewerCommand("force-release", selected), opener: event.currentTarget })}>ПРИНУДИТЕЛЬНО ОСВОБОДИТЬ</button>}{canManageEditors && <button className="danger-control" onClick={(event) => setConfirm({ title: `Удалить запрос: ${selected.nickname}`, body: irreversible, confirmLabel: "Удалить запрос", cancelLabel: "Не удалять", run: () => void reviewerCommand("delete-request", selected), opener: event.currentTarget })}>УДАЛИТЬ ЗАЯВКУ</button>}{canManageEditors && <button onClick={(event) => setConfirm({ title: `Сбросить привязку: ${selected.nickname}`, body: "После сброса участник сможет закрепить новое устройство.", confirmLabel: "Сбросить привязку", cancelLabel: "Не сбрасывать", run: () => void reviewerCommand("reset-device", selected, { nicknameKey: selected.nicknameKey }), opener: event.currentTarget })}>СБРОСИТЬ ПРИВЯЗКУ</button>}</div></> : <div className="promotion-empty">Выберите запрос.</div>}</article>}
      </div>
    </> : banksStatus !== "ready" ? (banksStatus === "loading" ? skeleton : <div className="promotion-empty"><strong>БАНКИ НЕ ЗАГРУЖЕНЫ</strong><button type="button" onClick={() => void loadBanks()}>Повторить загрузку</button></div>) : branch === "tasks" ? <PortiaPromotionOrdinaryEditor banks={banks.taskBanks} requests={queue.ordinary} busy={busy} post={postBank} refreshQueue={loadQueue} requestConfirm={setConfirm} /> : <PortiaPromotionQualificationEditor banks={banks.qualificationBanks} requests={queue.qualification} busy={busy} post={postBank} refreshQueue={loadQueue} requestConfirm={setConfirm} />}
    {confirm && <PromotionConfirmDialog intent={confirm} onCancel={() => setConfirm(null)} onConfirm={() => { const run = confirm.run; setConfirm(null); run(); }} />}
  </div>;
}
