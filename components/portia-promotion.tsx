"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { parseRetakeLedger, updateRetakeLedger, type RetakeLedger, type RetakeNotification } from "@/lib/portia-promotion-notifications";
import { promotionAvailabilityText } from "@/lib/portia-promotion";
import { QUALIFICATION_HEARTBEAT_MS } from "@/lib/portia-qualification";
import { statusPollOutcome } from "@/lib/portia-promotion-poll";

type RequestKind = "ordinary" | "qualification";
type SubmitPhase = "idle" | "submitting" | "error" | "success";
type SubmitFeedback = { phase: SubmitPhase; message: string };
type Eligibility =
  | { status: "eligible"; targetTitleId: string | null }
  | { status: "cooldown"; availableAt: string; remainingMs: number }
  | { status: "qualification-required" }
  | { status: "awaiting-sheet-change" }
  | { status: "special-task"; targetTitleId: string }
  | { status: "not-listed" };
type PublicTask = { id: string; text: string; sortOrder: number };
type ActiveState = { status: string; targetTitleId: string | null; attemptId?: string; availableAt?: string; percent?: number; tasks?: PublicTask[] } | null;
type PublicResult = { kind: RequestKind; outcome: string; createdAt: string };
type QualificationQuestion = { id: string; type: "single" | "multiple" | "free-text"; text: string; options: string[]; index: number; total: number };
type QualificationTest = { attemptId: string; status: string; clientMode: "desktop" | "phone"; deadlineAt: string | null; question: QualificationQuestion | null; result?: "passed" | "failed"; percent?: number };
type PromotionStatus = { nickname: string; promotionRecord: null; workflowAvailable: false } | {
  nickname: string;
  promotionRecord: { currentTitle: { id: string; label: string }; nextTitle: { id: string; label: string } | null };
  currentTitle: { id: string; label: string };
  nextTitle: { id: string; label: string } | null;
  ordinary: { eligibility: Eligibility; active: ActiveState };
  qualification: { eligibility: Eligibility; active: ActiveState };
  results: PublicResult[];
};

const statusPollMs = 5_000;
const terminalRecheckMs = 5_000;
const retakeLedgerStorageKey = "portia.promotion.retake-ledger.v1";
const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Moscow" });

function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "по решению проверяющего";
  return `${dateTime.format(new Date(value))} МСК`;
}

const desktopModeWarning = "Не переключайте вкладку и окно: потеря фокуса завершит попытку как проваленную.";
const phoneModeWarning = "Можно переключаться между приложениями. Попытка завершится при потере связи или по истечении времени.";

/** A submit counts as accepted only when the server answered with the created request id. */
function createdRequest(value: unknown) {
  return !!value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).requestId === "string";
}

function publicError(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : fallback;
}

function minuteSecond(deadlineAt: string | null, now: number) {
  const remaining = deadlineAt ? Math.max(0, Date.parse(deadlineAt) - now) : 0;
  const seconds = Math.ceil(remaining / 1000);
  return { remaining, label: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` };
}

function QualificationRunner({ attemptId, visible, onLockChange, onFinished }: { attemptId: string; visible: boolean; onLockChange: (locked: boolean) => void; onFinished: () => void }) {
  const [test, setTest] = useState<QualificationTest | null>(null);
  const [answer, setAnswer] = useState<string | number | number[]>("");
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [terminal, setTerminal] = useState<"timeout" | "offline" | "hidden" | "blur" | "page-exit" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announcedRef = useRef(new Set<number>());
  const finishedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const qualificationLocked = !terminal && (test === null || test.status === "active");
  useEffect(() => {
    onLockChange(qualificationLocked);
    return () => onLockChange(false);
  }, [onLockChange, qualificationLocked]);

  useEffect(() => {
    if (!test || test.status === "active" || finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  }, [onFinished, test]);

  const acceptProjection = useCallback((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const next = value as QualificationTest;
    if (next.attemptId !== attemptId || typeof next.status !== "string") return false;
    setTest(next); setAnswer(""); setTerminal(null);
    return true;
  }, [attemptId]);

  const reportFailure = useCallback((reason: "offline" | "hidden" | "blur" | "page-exit") => {
    setTerminal((current) => current ?? reason);
    setAnnouncement(reason === "offline" ? "Соединение прервано." : "Проверка завершена.");
    void fetch("/api/promotion/test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "failure", attemptId, reason }), keepalive: true,
    }).catch(() => undefined);
  }, [attemptId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/promotion/test", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ action: "start", attemptId }),
    }).then(async (response) => {
      const body: unknown = await response.json();
      if (!cancelled && (!response.ok || !acceptProjection(body))) setTerminal("offline");
    }).catch(() => { if (!cancelled) setTerminal("offline"); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [acceptProjection, attemptId]);

  useEffect(() => {
    if (test?.status !== "active" || terminal || !visible) return;
    let cancelled = false;
    const heartbeat = async () => {
      try {
        const response = await fetch("/api/promotion/test", {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
          body: JSON.stringify({ action: "heartbeat", attemptId }),
        });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error("heartbeat-failed");
        if (!cancelled && body && typeof body === "object" && !Array.isArray(body)
          && (body as QualificationTest).status !== "active") acceptProjection(body);
      } catch { if (!cancelled) reportFailure("offline"); }
    };
    const timer = window.setInterval(() => { void heartbeat(); }, QUALIFICATION_HEARTBEAT_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [acceptProjection, attemptId, reportFailure, terminal, test?.status, visible]);

  useEffect(() => {
    if (!terminal) return;
    let cancelled = false;
    const reconcile = async () => {
      try {
        const response = await fetch(`/api/promotion/test?attemptId=${encodeURIComponent(attemptId)}`, { cache: "no-store" });
        const body: unknown = await response.json();
        if (!cancelled && response.ok && body && typeof body === "object" && !Array.isArray(body)
          && (body as QualificationTest).status !== "active") acceptProjection(body);
      } catch { /* The server lease remains authoritative while the device is offline. */ }
    };
    void reconcile();
    const timer = window.setInterval(() => { void reconcile(); }, terminalRecheckMs);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [acceptProjection, attemptId, terminal]);

  useEffect(() => {
    if (test?.status !== "active" || terminal) return;
    const tick = () => {
      const current = Date.now(); setNow(current);
      const remaining = test.deadlineAt ? Date.parse(test.deadlineAt) - current : 0;
      for (const [threshold, copy] of [[300_000, "Осталось 5 минут"], [180_000, "Осталось 3 минуты"], [60_000, "Осталась 1 минута"]] as const) {
        if (remaining <= threshold && remaining > threshold - 1_500 && !announcedRef.current.has(threshold)) {
          announcedRef.current.add(threshold); setAnnouncement(copy);
        }
      }
      if (remaining <= 0) { setTerminal("timeout"); setAnnouncement("Время истекло."); }
    };
    tick(); const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [terminal, test]);

  useEffect(() => {
    if (test?.status !== "active" || terminal) return;
    const offline = () => reportFailure("offline");
    window.addEventListener("offline", offline);
    if (test.clientMode !== "desktop") return () => window.removeEventListener("offline", offline);
    const visibilitychange = () => { if (document.visibilityState === "hidden") reportFailure("hidden"); };
    const blur = () => reportFailure("blur");
    const pagehide = () => reportFailure("page-exit");
    document.addEventListener("visibilitychange", visibilitychange);
    window.addEventListener("blur", blur); window.addEventListener("pagehide", pagehide);
    return () => {
      window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", visibilitychange);
      window.removeEventListener("blur", blur); window.removeEventListener("pagehide", pagehide);
    };
  }, [reportFailure, terminal, test]);

  useEffect(() => {
    if (!visible && test?.status === "active" && test.clientMode === "desktop") queueMicrotask(() => reportFailure("hidden"));
  }, [reportFailure, test, visible]);

  useEffect(() => { if (test?.question) headingRef.current?.focus(); }, [test?.question]);

  const submit = async () => {
    if (!test?.question || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/promotion/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", attemptId, questionId: test.question.id, expectedQuestionIndex: test.question.index, answer, nonce: crypto.randomUUID() }),
      });
      const body = await response.json() as Record<string, unknown>;
      if (response.status === 409 && body.code === "answer-conflict" && acceptProjection(body)) return;
      if (!response.ok || !acceptProjection(body)) throw new Error("answer-rejected");
    } catch { reportFailure("offline"); } finally { setBusy(false); }
  };

  if (terminal) return <section className="promotion-qualification-terminal" role="alert"><span aria-hidden="true">×</span><h3>{terminal === "timeout" ? "ВРЕМЯ ИСТЕКЛО" : "ПОПЫТКА ЗАВЕРШЕНА"}</h3><p>{terminal === "timeout" ? "Время истекло. Проверка завершена и передана проверяющему." : terminal === "offline" ? "Соединение прервано. Попытка завершена и передана проверяющему." : "Зафиксирован выход из проверки на ПК. Попытка завершена и передана проверяющему."}</p></section>;
  if (busy && !test) return <div className="promotion-test-loading" role="status">Загружаем текущий вопрос…</div>;
  if (!test) return <section className="promotion-qualification-terminal"><h3>ПРОВЕРКА НЕДОСТУПНА</h3><p>Обновите состояние позже.</p></section>;
  if (test.result || test.status === "passed" || test.status === "failed") return <section className={`promotion-qualification-result ${test.result ?? test.status}`}><span className="promotion-eyebrow">ИТОГ КВАЛИФИКАЦИИ</span><h3>{(test.result ?? test.status) === "passed" ? "ПРОВЕРКА ПРОЙДЕНА" : "ПРОВЕРКА НЕ ПРОЙДЕНА"}</h3>{Number.isInteger(test.percent) && <p>Процент: <strong>{test.percent}%</strong></p>}<p>Подробности ответов участнику не показываются.</p></section>;
  if (test.status === "submitted" || !test.question) return <section className="promotion-qualification-result"><span className="promotion-eyebrow">ОЖИДАНИЕ РЕШЕНИЯ</span><h3>ОТВЕТЫ ПЕРЕДАНЫ</h3><p>Проверяющий оценит ответы и отдельно примет итоговое решение.</p></section>;

  const timer = minuteSecond(test.deadlineAt, now);
  const question = test.question;
  const selected = Array.isArray(answer) ? answer : [];
  const valid = question.type === "free-text" ? typeof answer === "string" && answer.trim().length > 0 : question.type === "single" ? Number.isInteger(answer) : selected.length > 0;
  return <section className="promotion-qualification-runner">
    <p className="promotion-mode-warning">{test.clientMode === "phone" ? phoneModeWarning : desktopModeWarning}</p>
    <div className={`promotion-test-timer ${timer.remaining <= 60_000 ? "danger" : timer.remaining <= 180_000 ? "warning" : ""}`}><span>ОСТАЛОСЬ</span><strong>{timer.label}</strong></div>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <div className="promotion-question-progress">ВОПРОС {question.index + 1} ИЗ {question.total}</div>
    <div className="promotion-question">
      <h3 ref={headingRef} tabIndex={-1}>{question.text}</h3>
      {question.type === "single" && <fieldset><legend>Выберите один вариант</legend>{question.options.map((option, index) => <label key={option}><input type="radio" name={`question-${question.id}`} checked={answer === index} onChange={() => setAnswer(index)} /><span>{option}</span></label>)}</fieldset>}
      {question.type === "multiple" && <fieldset><legend>Выберите один или несколько вариантов</legend>{question.options.map((option, index) => <label key={option}><input type="checkbox" checked={selected.includes(index)} onChange={(event) => setAnswer(event.target.checked ? [...selected, index] : selected.filter((item) => item !== index))} /><span>{option}</span></label>)}</fieldset>}
      {question.type === "free-text" && <label className="promotion-free-answer">Ваш ответ<textarea value={typeof answer === "string" ? answer : ""} maxLength={4000} onChange={(event) => setAnswer(event.target.value)} /><span>{typeof answer === "string" ? answer.length : 0} / 4000</span></label>}
    </div>
    <button className="promotion-action" type="button" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "ОТПРАВЛЯЕМ…" : "ОТПРАВИТЬ И ДАЛЬШЕ"}</button>
  </section>;
}

export function PromotionIdentityGate({ nickname, busy, error, onNickname, onSubmit }: {
  nickname: string;
  busy: boolean;
  error: string;
  onNickname: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="promotion-gate">
    <div className="promotion-gate-mark" aria-hidden="true">↑</div>
    <header><span className="promotion-eyebrow">PORTIA // ПОВЫШЕНИЕ</span><h1>ПРОВЕРИТЬ ПОВЫШЕНИЕ</h1><p>Узнайте доступность повышения, состояние заданий и квалификационной проверки.</p></header>
    <form onSubmit={onSubmit}>
      <label htmlFor="promotion-nickname">Ник Roblox, указанный в таблице</label>
      <input id="promotion-nickname" value={nickname} onChange={(event) => onNickname(event.target.value)} maxLength={64} autoComplete="off" spellCheck={false} placeholder="Введите ник Roblox из таблицы" disabled={busy} />
      {!error && <p className="promotion-binding-note">Первая заявка закрепит этот ник за устройством. Сменить его сможет проверяющий.</p>}
      {error && <p className="promotion-error" role="alert">{error}</p>}
      <button className="promotion-action" type="submit" disabled={busy || !nickname.trim()}>{busy ? "ПРОВЕРЯЕМ…" : "ПРОВЕРИТЬ НИК"}</button>
    </form>
  </div>;
}

function activeCopy(kind: RequestKind, active: NonNullable<ActiveState>) {
  if (active.status === "pending") return kind === "ordinary"
    ? "Заявка на задания отправлена в очередь и ещё не взята проверяющим."
    : "Запрос на квалификацию отправлен в очередь и ещё не взят проверяющим.";
  if (active.status === "claimed") return "Проверяющий уже взял запрос в работу.";
  if (active.status === "assigned") return "Задания назначены. Выполните их и ожидайте решения проверяющего.";
  if (active.status === "awaiting-sheet-change" || active.status === "approved") return "Ожидается изменение звания в таблице.";
  if (active.status === "testing") return "Квалификационная проверка начата.";
  if (active.status === "grading") return "Ответы переданы проверяющему.";
  if (active.status === "passed") return "Квалификация пройдена. Теперь отдельно запросите задания на повышение.";
  if (active.status === "failed") return promotionAvailabilityText(active.availableAt, new Date()) ?? "Повторная проверка будет доступна по решению проверяющего.";
  return "Состояние запроса обновляется.";
}

function eligibilityCopy(kind: RequestKind, eligibility: Eligibility) {
  if (eligibility.status === "cooldown") return promotionAvailabilityText(eligibility.availableAt, new Date()) ?? "Повышение сейчас недоступно.";
  if (eligibility.status === "awaiting-sheet-change") return "Ожидается изменение звания в таблице.";
  if (eligibility.status === "special-task") return "Особое задание для звания «Эксперт вирусолог» выдаёт проверяющий.";
  if (eligibility.status === "qualification-required") return kind === "ordinary"
    ? "Сначала необходимо пройти квалификацию для текущего звания."
    : "Для текущего звания квалификационная проверка не требуется.";
  if (eligibility.status === "eligible") return kind === "ordinary" ? "Можно запросить задания для следующего звания." : "Можно запросить квалификационную проверку.";
  return "Повышение сейчас недоступно.";
}

function PromotionStatusCard({ kind, active, eligibility, busy, stale, feedback, feedbackRef, onRequest, visible, onQualificationLockChange, onQualificationFinished }: {
  kind: RequestKind;
  active: ActiveState;
  eligibility: Eligibility;
  busy: boolean;
  stale: boolean;
  feedback: SubmitFeedback;
  feedbackRef: (node: HTMLParagraphElement | null) => void;
  onRequest: (kind: RequestKind) => void;
  visible?: boolean;
  onQualificationLockChange?: (locked: boolean) => void;
  onQualificationFinished?: () => void;
}) {
  const ordinary = kind === "ordinary";
  const canRequest = !active && (eligibility.status === "eligible" || (ordinary && eligibility.status === "special-task"));
  const tasks = active?.tasks?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  return <section className={`promotion-card ${ordinary ? "promotion-ordinary-card" : "promotion-qualification-card"}`}>
    <header><span className="promotion-flow-icon" aria-hidden="true">{ordinary ? "▤" : "◇"}</span><div><span className="promotion-eyebrow">{ordinary ? "ОБЫЧНОЕ ПОВЫШЕНИЕ" : "КВАЛИФИКАЦИЯ"}</span><h2>{ordinary ? "Задания на повышение" : "Проверка знаний"}</h2></div></header>
    <p className="promotion-status-copy">{active ? activeCopy(kind, active) : eligibilityCopy(kind, eligibility)}</p>
    {feedback.phase !== "idle" && <p ref={feedbackRef} tabIndex={-1} role={feedback.phase === "error" ? "alert" : "status"} className={`promotion-submit-feedback ${feedback.phase}`}>{feedback.message}</p>}
    {!ordinary && active && !active.attemptId && (active.status === "claimed" || active.status === "approved") && <div className="promotion-test-warning"><strong>15 МИНУТ ПОСЛЕ РАЗРЕШЕНИЯ</strong><p>После разрешения проверяющего начнутся 15 минут.</p><p className="promotion-mode-warning">ПК. {desktopModeWarning}</p><p className="promotion-mode-warning">Телефон. {phoneModeWarning}</p></div>}
    {!ordinary && active?.attemptId && <QualificationRunner attemptId={active.attemptId} visible={visible !== false} onLockChange={onQualificationLockChange ?? (() => undefined)} onFinished={onQualificationFinished ?? (() => undefined)} />}
    {tasks.length > 0 && <div className="promotion-tasks"><h3>Назначенные задания</h3><ol className="promotion-task-list">{tasks.map((task) => <li key={task.id}><span>{String(task.sortOrder).padStart(2, "0")}</span><p>{task.text}</p></li>)}</ol></div>}
    {canRequest && <button className="promotion-action" type="button" disabled={busy || stale} onClick={() => onRequest(kind)}>{busy ? "ОТПРАВЛЯЕМ…" : ordinary ? "ПОДАТЬ ЗАЯВКУ НА ЗАДАНИЯ" : "ЗАПРОСИТЬ КВАЛИФИКАЦИЮ"}</button>}
  </section>;
}

const outcomeLabels: Record<string, string> = {
  approved: "Задания зачтены", passed: "Проверка пройдена", failed: "Проверка не пройдена",
  rejected: "Заявка отклонена", "technical-failure": "Попытка завершена", "retake-released": "Повторная проверка открыта",
};

export function PortiaPromotion({ visible, onRetakeReady, onQualificationLockChange }: { visible: boolean; onRetakeReady?: (notification: RetakeNotification) => void; onQualificationLockChange?: (locked: boolean) => void }) {
  const [nickname, setNickname] = useState("");
  const [checkedNickname, setCheckedNickname] = useState("");
  const [status, setStatus] = useState<PromotionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [submitState, setSubmitState] = useState<Record<RequestKind, SubmitFeedback>>({
    ordinary: { phase: "idle", message: "" },
    qualification: { phase: "idle", message: "" },
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(new Set<RequestKind>());
  const submitFeedbackRefs = useRef<Record<RequestKind, HTMLParagraphElement | null>>({ ordinary: null, qualification: null });
  const retakeLedgerRef = useRef<RetakeLedger>([]);

  const loadStatus = useCallback(async (value: string, explicit = false, restore = false) => {
    if (!value && !restore) return;
    if (explicit) setBusy(true);
    try {
      const response = await fetch(value ? `/api/promotion/status?nickname=${encodeURIComponent(value)}` : "/api/promotion/status", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) {
        const outcome = statusPollOutcome({ httpStatus: response.status, hasStatus: Boolean(status), explicit, restore });
        if (outcome === "keep-stale") { setStale(true); setError(""); return; }
        if (outcome === "ignore") return;
        if (outcome === "reset") {
          setStatus(null);
          setError(publicError(body, "Не удалось проверить ник. Попробуйте позже."));
        }
        return;
      }
      const next = body as PromotionStatus;
      setStatus(next);
      if (restore && typeof next.nickname === "string") { setNickname(next.nickname); setCheckedNickname(next.nickname); }
      setError("");
      setStale(false);
      if (explicit) requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      if (status) { setStale(true); setError(""); }
      else setError("Система повышения временно недоступна. Попробуйте позже.");
    } finally {
      if (explicit) setBusy(false);
    }
  }, [status]);

  useEffect(() => {
    if (!visible || checkedNickname || document.visibilityState !== "visible") return;
    queueMicrotask(() => void loadStatus("", false, true));
  }, [checkedNickname, loadStatus, visible]);

  useEffect(() => {
    if (!visible || document.visibilityState !== "visible") return;
    if (!checkedNickname) return;
    const poll = () => { if (document.visibilityState === "visible") void loadStatus(checkedNickname); };
    const timer = window.setInterval(poll, statusPollMs);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [checkedNickname, loadStatus, visible]);

  useEffect(() => {
    const active = status?.promotionRecord === null ? null : status?.qualification.active;
    if (!status || active?.status !== "failed" || !active.attemptId || !active.availableAt) return;
    const evaluate = () => {
      let stored: RetakeLedger = [];
      try { stored = parseRetakeLedger(window.localStorage.getItem(retakeLedgerStorageKey)); } catch {}
      const merged = [...stored, ...retakeLedgerRef.current.filter((entry) => !stored.some((saved) => saved.id === entry.id))];
      const ready = Date.now() >= Date.parse(active.availableAt!);
      const next = updateRetakeLedger(merged, { nickname: status.nickname, attemptId: active.attemptId!, availableAt: active.availableAt! }, new Date(), visible && ready);
      retakeLedgerRef.current = next.ledger;
      try { window.localStorage.setItem(retakeLedgerStorageKey, JSON.stringify(next.ledger)); } catch {}
      if (next.notification) onRetakeReady?.(next.notification);
    };
    evaluate();
    const remaining = Date.parse(active.availableAt) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(evaluate, Math.min(remaining + 50, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [onRetakeReady, status, visible]);

  const checkNickname = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = nickname.trim();
    if (!value) return;
    setSubmitState({ ordinary: { phase: "idle", message: "" }, qualification: { phase: "idle", message: "" } });
    setCheckedNickname(value);
    void loadStatus(value, true);
  };

  const requestPromotion = async (kind: RequestKind) => {
    if (!status || status.promotionRecord === null || stale || submittingRef.current.has(kind)) return;
    submittingRef.current.add(kind);
    setSubmitState((current) => ({ ...current, [kind]: { phase: "submitting", message: "Отправляем заявку…" } }));
    try {
      const response = await fetch("/api/promotion/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: checkedNickname, kind }) });
      const body: unknown = await response.json();
      if (!response.ok || !createdRequest(body)) {
        setSubmitState((current) => ({ ...current, [kind]: { phase: "error", message: publicError(body, "Заявку не удалось отправить.") } }));
        requestAnimationFrame(() => submitFeedbackRefs.current[kind]?.focus());
        return;
      }
      setSubmitState((current) => ({ ...current, [kind]: {
        phase: "success",
        message: kind === "ordinary"
          ? "Заявка на задания отправлена в очередь. Проверяющий ещё не взял её в работу."
          : "Запрос на квалификацию отправлен в очередь. Проверяющий ещё не взял его в работу.",
      } }));
      requestAnimationFrame(() => submitFeedbackRefs.current[kind]?.focus());
      await loadStatus(checkedNickname);
    } catch {
      setStale(true);
      setSubmitState((current) => ({ ...current, [kind]: { phase: "error", message: "Заявку не удалось отправить. Проверьте соединение и повторите позже." } }));
      requestAnimationFrame(() => submitFeedbackRefs.current[kind]?.focus());
    } finally { submittingRef.current.delete(kind); }
  };

  const refreshAfterQualification = useCallback(() => {
    if (checkedNickname) void loadStatus(checkedNickname);
  }, [checkedNickname, loadStatus]);

  if (!status) return <div className="promotion-app"><PromotionIdentityGate nickname={nickname} busy={busy} error={error} onNickname={setNickname} onSubmit={checkNickname} /></div>;

  if (status.promotionRecord === null) return <div className="promotion-app"><div className="promotion-shell" aria-live="polite">
    <header className="promotion-identity"><div><span className="promotion-eyebrow">УЧАСТНИК</span><h1 ref={headingRef} tabIndex={-1}>{status.nickname}</h1></div></header>
    <section className="promotion-empty promotion-no-record"><strong>Запись о повышении пока не заведена</strong><p>Ник найден в основном составе PORTIA. Данные звания и действия появятся после добавления отдельной строки повышения.</p></section>
  </div></div>;

  return <div className="promotion-app">
    <div className="promotion-shell" aria-live="polite">
      <header className="promotion-identity">
        <div><span className="promotion-eyebrow">УЧАСТНИК</span><h1 ref={headingRef} tabIndex={-1}>{status.nickname}</h1></div>
        <dl><div><dt>ТЕКУЩЕЕ ЗВАНИЕ</dt><dd>{status.currentTitle.label}</dd></div><div><dt>СЛЕДУЮЩЕЕ</dt><dd>{status.nextTitle?.label ?? "Высшее звание"}</dd></div></dl>
      </header>
      {stale && <div className="promotion-stale"><strong>Состояние временно не обновляется</strong><span>Показаны последние безопасные данные. Действия отключены до восстановления связи.</span></div>}
      {error && <p className="promotion-error" role="alert">{error}</p>}
      <div className="promotion-flow-list">
        {status.ordinary.eligibility.status === "qualification-required" && <PromotionStatusCard kind="qualification" active={status.qualification.active} eligibility={status.qualification.eligibility} busy={submitState.qualification.phase === "submitting"} stale={stale} feedback={submitState.qualification} feedbackRef={(node) => { submitFeedbackRefs.current.qualification = node; }} onRequest={requestPromotion} visible={visible} onQualificationLockChange={onQualificationLockChange} onQualificationFinished={refreshAfterQualification} />}
        <PromotionStatusCard kind="ordinary" active={status.ordinary.active} eligibility={status.ordinary.eligibility} busy={submitState.ordinary.phase === "submitting"} stale={stale} feedback={submitState.ordinary} feedbackRef={(node) => { submitFeedbackRefs.current.ordinary = node; }} onRequest={requestPromotion} />
        {status.ordinary.eligibility.status !== "qualification-required" && <PromotionStatusCard kind="qualification" active={status.qualification.active} eligibility={status.qualification.eligibility} busy={submitState.qualification.phase === "submitting"} stale={stale} feedback={submitState.qualification} feedbackRef={(node) => { submitFeedbackRefs.current.qualification = node; }} onRequest={requestPromotion} visible={visible} onQualificationLockChange={onQualificationLockChange} onQualificationFinished={refreshAfterQualification} />}
      </div>
      <p className="promotion-cleanup-hint">Подробные данные проверки удаляются после закрытия. Хранятся три последних результата.</p>
      {status.results.length > 0 && <details className="promotion-history"><summary>Последние результаты <span>{Math.min(status.results.length, 3)}</span></summary><ul>{status.results.slice(0, 3).map((result, index) => <li key={`${result.createdAt}-${index}`}><span>{result.kind === "ordinary" ? "ЗАДАНИЯ" : "КВАЛИФИКАЦИЯ"}</span><strong>{outcomeLabels[result.outcome] ?? "Результат обновлён"}</strong><time dateTime={result.createdAt}>{formatDate(result.createdAt)}</time></li>)}</ul></details>}
    </div>
  </div>;
}
