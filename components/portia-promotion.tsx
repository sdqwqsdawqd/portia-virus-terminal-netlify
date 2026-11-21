"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { useLiveEdit } from "@/components/portia-live-edit";
import { parseRetakeLedger, updateRetakeLedger, type RetakeLedger, type RetakeNotification } from "@/lib/portia-promotion-notifications";
import { promotionAvailabilityText } from "@/lib/portia-promotion";
import { QUALIFICATION_HEARTBEAT_MS } from "@/lib/portia-qualification";
import { qualificationPreStartLines } from "@/lib/portia-qualification-rules";
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
export type PublicTask = { id: string; text: string; sortOrder: number };
type ActiveState = { status: string; targetTitleId: string | null; attemptId?: string; availableAt?: string; percent?: number; tasks?: PublicTask[] } | null;
type PublicResult = { kind: RequestKind; outcome: string; createdAt: string };
export type QualificationQuestion = { id: string; type: "single" | "multiple" | "free-text"; text: string; options: string[]; index: number; total: number };
type QualificationTest = { attemptId: string; status: string; clientMode: "desktop" | "phone"; deadlineAt: string | null; question: QualificationQuestion | null; result?: "passed" | "failed"; percent?: number; questionCount?: number; rulesText?: string };
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
const phoneModeWarning = "Можно переключаться между приложениями.";

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

// 26.1-16: the three parts of the candidate's view that the editor's live mode draws too. The window of the candidate draws them as they were; inside the live mode of «Повышения»
// useLiveEdit("promo") answers, and the places of the data of the banks (rules, questions, variants, tasks) become places to edit. The texts around them are the code of the site and stay as they are.

/** The head of a card of the window: the icon, the kind, the title and, when the window has one, the badge of the step. */
export function CandidateCardHeader({ kind, step }: { kind: RequestKind; step?: { tone: string; label: string } }) {
  const ordinary = kind === "ordinary";
  return <header><span className="promotion-flow-icon" aria-hidden="true">{ordinary ? "▤" : "◇"}</span><div><span className="promotion-eyebrow">{ordinary ? "ОБЫЧНОЕ ПОВЫШЕНИЕ" : "КВАЛИФИКАЦИЯ"}</span><h2>{ordinary ? "Задания на повышение" : "Проверка знаний"}</h2></div>{step && <span className={`promotion-step-badge ${step.tone}`}>{step.label}</span>}</header>;
}

/** The screen before the check: the fixed lines of the site, then what the caller puts under them (the rules, the start). */
export function CandidatePrestart({ lines, children }: { lines: ReturnType<typeof qualificationPreStartLines>; children?: ReactNode }) {
  return <section className="promotion-qualification-prestart">
    <span className="promotion-eyebrow">ПРАВИЛА ПРОВЕРКИ</span>
    <h3>ПРОВЕРКА ГОТОВА К НАЧАЛУ</h3>
    <ul className="promotion-prestart-lines">{lines.map((line) => <li key={line.id} className={line.current ? "is-current" : undefined}>{line.text}{line.current ? " — ваше устройство" : ""}</li>)}</ul>
    {children}
  </section>;
}

/** The rules of the reviewer on the screen before the check. */
export function CandidateRules({ text }: { text: string }) {
  const live = useLiveEdit("promo");
  return <div className="promotion-prestart-rules"><h4>ПРАВИЛА ПРОВЕРЯЮЩЕГО</h4><p>{live ? live.text({ kind: "promo-rules" }, text, { multiline: true }) : text}</p></div>;
}

type CandidateAnswer = string | number | number[];

/** One question of the check as the candidate sees it: the number, the text, the variants by type or the field of a free answer. The live mode shows the same, with nothing to answer. */
export function CandidateQuestion({ question, index, total, answer = "", onAnswer, headingRef }: {
  question: QualificationQuestion;
  index: number;
  total: number;
  answer?: CandidateAnswer;
  onAnswer?: (value: CandidateAnswer) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const live = useLiveEdit("promo");
  const selected = Array.isArray(answer) ? answer : [];
  const choose = (value: CandidateAnswer) => onAnswer?.(value);
  const variant = (option: string, at: number) => live ? live.text({ kind: "promo-question-option", questionId: question.id, index: at }, option) : option;
  return <>
    <div className="promotion-question-progress">ВОПРОС {index + 1} ИЗ {total}</div>
    <div className="promotion-question">
      <h3 ref={headingRef} tabIndex={-1}>{live ? live.text({ kind: "promo-question-text", questionId: question.id }, question.text) : question.text}</h3>
      {question.type === "single" && <fieldset><legend>Выберите один вариант</legend>{question.options.map((option, at) => <label key={at}><input type="radio" name={`question-${question.id}`} checked={answer === at} disabled={Boolean(live)} onChange={() => choose(at)} /><span>{variant(option, at)}</span></label>)}</fieldset>}
      {question.type === "multiple" && <fieldset><legend>Выберите один или несколько вариантов</legend>{question.options.map((option, at) => <label key={at}><input type="checkbox" checked={selected.includes(at)} disabled={Boolean(live)} onChange={(event) => choose(event.target.checked ? [...selected, at] : selected.filter((item) => item !== at))} /><span>{variant(option, at)}</span></label>)}</fieldset>}
      {question.type === "free-text" && <label className="promotion-free-answer">Ваш ответ<textarea value={typeof answer === "string" ? answer : ""} maxLength={4000} disabled={Boolean(live)} onChange={(event) => choose(event.target.value)} /><span>{typeof answer === "string" ? answer.length : 0} / 4000</span></label>}
    </div>
  </>;
}

/** The ordinary tasks handed to the candidate. `rowTools` is the live mode's: a slot in each row (the order, the switch, the removal); the candidate's window passes none. */
export function CandidateTasks({ tasks, rowTools }: { tasks: PublicTask[]; rowTools?: (task: PublicTask, index: number) => ReactNode }) {
  const live = useLiveEdit("promo");
  if (!tasks.length && !live) return null;
  return <div className="promotion-tasks"><h3>Назначенные задания</h3><ol className="promotion-task-list">{tasks.map((task, index) => <li key={task.id} {...(rowTools ? { "data-sort-index": index } : {})}><span>{String(task.sortOrder).padStart(2, "0")}</span><div><p>{live ? live.text({ kind: "promo-task-text", taskId: task.id }, task.text, { multiline: true }) : task.text}</p>{rowTools?.(task, index)}</div></li>)}</ol></div>;
}

function QualificationRunner({ attemptId, visible, onLockChange, onFinished }: { attemptId: string; visible: boolean; onLockChange: (locked: boolean) => void; onFinished: () => void }) {
  const [test, setTest] = useState<QualificationTest | null>(null);
  const [answer, setAnswer] = useState<string | number | number[]>("");
  const [busy, setBusy] = useState(true);
  // Before the candidate presses «НАЧАТЬ ПРОВЕРКУ» nothing runs: no start request, no timer, no heartbeat, no failure listener, no lock.
  const [fallback, setFallback] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const startingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [terminal, setTerminal] = useState<"timeout" | "offline" | "hidden" | "blur" | "page-exit" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announcedRef = useRef(new Set<number>());
  const finishedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const qualificationLocked = !terminal && test?.status === "active";
  useEffect(() => {
    onLockChange(qualificationLocked);
    return () => onLockChange(false);
  }, [onLockChange, qualificationLocked]);

  useEffect(() => {
    if (!test || test.status === "active" || test.status === "prepared" || finishedRef.current) return;
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

  // The mount only READS the attempt (GET). A reload during a running test resumes it through this projection; nothing is started here.
  const [loadNonce, setLoadNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/promotion/test?attemptId=${encodeURIComponent(attemptId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (cancelled) return;
        // A refused read (404 for a phone before the database update) shows the fixed lines only: nothing was started, nothing was handed over.
        if (response.ok && acceptProjection(body)) setLoadFailed(false);
        else setFallback(true);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [acceptProjection, attemptId, loadNonce]);

  const retryLoad = () => { setLoadFailed(false); setBusy(true); setLoadNonce((value) => value + 1); };

  // The ONLY start request of the runner: pressed by the candidate. A failed start never fails the attempt.
  const startTest = async () => {
    if (startingRef.current) return;
    startingRef.current = true; setStarting(true); setStartError("");
    try {
      const response = await fetch("/api/promotion/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ action: "start", attemptId }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !acceptProjection(body)) setStartError(publicError(body, "Не удалось начать проверку. Попробуйте ещё раз."));
      else setFallback(false);
    } catch { setStartError("Не удалось начать проверку. Попробуйте ещё раз."); }
    finally { startingRef.current = false; setStarting(false); }
  };

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

  if (terminal) return <section className="promotion-qualification-terminal" role="alert"><span aria-hidden="true">×</span><h3>{terminal === "timeout" ? "ВРЕМЯ ИСТЕКЛО" : "ПОПЫТКА ЗАВЕРШЕНА"}</h3><p>{terminal === "timeout" ? "Время истекло. Проверка передана проверяющему." : terminal === "offline" ? "Соединение прервано. Попытка передана проверяющему." : "Выход из проверки. Попытка передана проверяющему."}</p></section>;
  if (busy && !test) return <div className="promotion-test-loading" role="status">Загружаем проверку…</div>;
  if (!test && loadFailed) return <section className="promotion-qualification-terminal" role="alert"><h3>ПРОВЕРКА НЕДОСТУПНА</h3><p>Не удалось загрузить проверку. Она не начата.</p><button className="promotion-action" type="button" onClick={retryLoad}>ПОВТОРИТЬ</button></section>;
  if (test?.status === "prepared" || (!test && fallback)) {
    const mode = test?.clientMode === "desktop" || test?.clientMode === "phone" ? test.clientMode : null;
    const lines = qualificationPreStartLines({ clientMode: mode, questionCount: typeof test?.questionCount === "number" ? test.questionCount : null });
    const rules = typeof test?.rulesText === "string" ? test.rulesText : "";
    return <CandidatePrestart lines={lines}>
      {rules && <CandidateRules text={rules} />}
      {startError && <p className="promotion-error" role="alert">{startError}</p>}
      <button className="promotion-action" type="button" disabled={starting} onClick={() => void startTest()}>{starting ? "НАЧИНАЕМ…" : "НАЧАТЬ ПРОВЕРКУ"}</button>
    </CandidatePrestart>;
  }
  if (!test) return <section className="promotion-qualification-terminal"><h3>ПРОВЕРКА НЕДОСТУПНА</h3><p>Обновите состояние позже.</p></section>;
  if (test.result || test.status === "passed" || test.status === "failed") return <section className={`promotion-qualification-result ${test.result ?? test.status}`}><span className="promotion-eyebrow">ИТОГ КВАЛИФИКАЦИИ</span><h3>{(test.result ?? test.status) === "passed" ? "ПРОВЕРКА ПРОЙДЕНА" : "ПРОВЕРКА НЕ ПРОЙДЕНА"}</h3>{Number.isInteger(test.percent) && <p>Процент: <strong>{test.percent}%</strong></p>}<p>Подробности ответов участнику не показываются.</p></section>;
  if (test.status === "submitted" || !test.question) return <section className="promotion-qualification-result"><span className="promotion-eyebrow">ОЖИДАНИЕ РЕШЕНИЯ</span><h3>ОТВЕТЫ ПЕРЕДАНЫ</h3></section>;

  const timer = minuteSecond(test.deadlineAt, now);
  const question = test.question;
  const selected = Array.isArray(answer) ? answer : [];
  const valid = question.type === "free-text" ? typeof answer === "string" && answer.trim().length > 0 : question.type === "single" ? Number.isInteger(answer) : selected.length > 0;
  return <section className="promotion-qualification-runner">
    <p className="promotion-mode-warning">{test.clientMode === "phone" ? phoneModeWarning : desktopModeWarning}</p>
    <div className={`promotion-test-timer ${timer.remaining <= 60_000 ? "danger" : timer.remaining <= 180_000 ? "warning" : ""}`}><span>ОСТАЛОСЬ</span><strong>{timer.label}</strong></div>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <CandidateQuestion question={question} index={question.index} total={question.total} answer={answer} onAnswer={setAnswer} headingRef={headingRef} />
    <button className="promotion-action" type="button" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "ОТПРАВЛЯЕМ…" : "ОТПРАВИТЬ И ДАЛЬШЕ"}</button>
  </section>;
}

export function PromotionIdentityGate({ nickname, busy, error, editor, accessState, onNickname, onSubmit }: {
  nickname: string;
  busy: boolean;
  error: string;
  editor: boolean;
  accessState: string;
  onNickname: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="promotion-gate">
    <div className="promotion-gate-mark" aria-hidden="true">↑</div>
    <header><span className="promotion-eyebrow">PORTIA // ПОВЫШЕНИЕ</span><h1>ПРОВЕРИТЬ ПОВЫШЕНИЕ</h1></header>
    {editor ? <form onSubmit={onSubmit}>
      <p className="promotion-binding-note">Для участия подайте собственную заявку по нику из таблицы. Редакторские инструменты доступны отдельно.</p>
      <label htmlFor="promotion-nickname">Ваш ник Roblox в таблице</label>
      <input id="promotion-nickname" value={nickname} onChange={(event) => onNickname(event.target.value)} maxLength={20} autoComplete="off" spellCheck={false} placeholder="Введите свой ник Roblox" disabled={busy} />
      <button className="promotion-action" type="submit" disabled={busy || !nickname.trim()}>{busy ? "ОТПРАВЛЯЕМ…" : "ПОДАТЬ СВОЮ ЗАЯВКУ"}</button>
    </form> : <p className="promotion-binding-note">Для участия нужна одобренная заявка с этого устройства. Подайте её на главной странице.</p>}
    {accessState === "pending" && <p className="promotion-next-note" role="status">Заявка ожидает решения. После одобрения здесь появятся карточки повышения.</p>}
    {accessState === "rejected" && <p className="promotion-next-note">Заявка отклонена. Обратитесь к проверяющему или подайте новую после окончания ограничения.</p>}
    {accessState === "revoked" && <p className="promotion-next-note">Доступ отозван. Обратитесь к проверяющему.</p>}
    {error && <p className="promotion-error" role="alert">{error}</p>}
  </div>;
}

function activeCopy(kind: RequestKind, active: NonNullable<ActiveState>) {
  if (active.status === "pending") return kind === "ordinary"
    ? "Заявка на задания отправлена в очередь и ещё не взята проверяющим."
    : "Запрос на квалификацию отправлен в очередь и ещё не взят проверяющим.";
  if (active.status === "claimed") return "Проверяющий уже взял запрос в работу.";
  if (active.status === "assigned") return "Задания назначены. Выполните их и ожидайте решения проверяющего.";
  if (active.status === "awaiting-sheet-change" || active.status === "approved") return "Ожидается изменение звания в таблице.";
  if (active.status === "testing") return "Квалификационная проверка выдана. Правила и ход проверки — ниже.";
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

/** The one action a participant can take right now on a card: a request that is allowed and not already running. */
const canRequestOn = (kind: RequestKind, active: ActiveState, eligibility: Eligibility) =>
  !active && (eligibility.status === "eligible" || (kind === "ordinary" && eligibility.status === "special-task"));

function PromotionStatusCard({ kind, active, eligibility, busy, stale, next, feedback, feedbackRef, onRequest, visible, onQualificationLockChange, onQualificationFinished }: {
  kind: RequestKind;
  active: ActiveState;
  eligibility: Eligibility;
  busy: boolean;
  stale: boolean;
  next: boolean;
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
  // The state is always written out, never carried by colour alone (D-17/D-20).
  const step = active ? { tone: "running", label: "В ПРОЦЕССЕ" } : canRequest ? { tone: "available", label: "ДОСТУПНО СЕЙЧАС" } : { tone: "waiting", label: "ПОКА НЕДОСТУПНО" };
  return <section className={`promotion-card ${ordinary ? "promotion-ordinary-card" : "promotion-qualification-card"}`} data-next={next ? "true" : undefined}>
    <CandidateCardHeader kind={kind} step={step} />
    {!active && !canRequest && <span className="promotion-reason-label">Почему сейчас нельзя</span>}
    <p className="promotion-status-copy">{active ? activeCopy(kind, active) : eligibilityCopy(kind, eligibility)}</p>
    {feedback.phase !== "idle" && <p ref={feedbackRef} tabIndex={-1} role={feedback.phase === "error" ? "alert" : "status"} className={`promotion-submit-feedback ${feedback.phase}`}>{feedback.message}</p>}
    {!ordinary && active && !active.attemptId && (active.status === "claimed" || active.status === "approved") && <div className="promotion-test-warning"><strong>15 МИНУТ ПОСЛЕ НАЧАЛА</strong><p>Когда проверяющий подтвердит набор вопросов, здесь появятся правила и кнопка «НАЧАТЬ ПРОВЕРКУ». 15 минут пойдут только после её нажатия.</p><p className="promotion-mode-warning">ПК. {desktopModeWarning}</p><p className="promotion-mode-warning">Телефон. {phoneModeWarning}</p></div>}
    {!ordinary && active?.attemptId && <QualificationRunner attemptId={active.attemptId} visible={visible !== false} onLockChange={onQualificationLockChange ?? (() => undefined)} onFinished={onQualificationFinished ?? (() => undefined)} />}
    <CandidateTasks tasks={tasks} />
    {canRequest && <button className="promotion-action" type="button" disabled={busy || stale} onClick={() => onRequest(kind)}>{busy ? "ОТПРАВЛЯЕМ…" : ordinary ? "ПОДАТЬ ЗАЯВКУ НА ЗАДАНИЯ" : "ЗАПРОСИТЬ КВАЛИФИКАЦИЮ"}</button>}
    {canRequest && stale && <p className="promotion-next-note">Отправка недоступна, пока состояние не обновится.</p>}
  </section>;
}

const outcomeLabels: Record<string, string> = {
  approved: "Задания зачтены", passed: "Проверка пройдена", failed: "Проверка не пройдена",
  rejected: "Заявка отклонена", "technical-failure": "Попытка завершена", "retake-released": "Повторная проверка открыта",
};

export function PortiaPromotion({ visible, onRetakeReady, onQualificationLockChange, onOpenTemplate }: { visible: boolean; onRetakeReady?: (notification: RetakeNotification) => void; onQualificationLockChange?: (locked: boolean) => void; onOpenTemplate?: () => void }) {
  const [nickname, setNickname] = useState("");
  const [checkedNickname, setCheckedNickname] = useState("");
  const [editor, setEditor] = useState(false);
  const [accessState, setAccessState] = useState("none");
  const [status, setStatus] = useState<PromotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
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

  const loadStatus = useCallback(async (_value: string, explicit = false, restore = false) => {
    if (explicit) setBusy(true);
    try {
      const response = await fetch("/api/promotion/status", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 403 && body && typeof body === "object" && "code" in body && body.code === "access-required") {
          const refusal = body as { editor?: unknown; accessState?: unknown };
          setEditor(refusal.editor === true);
          setAccessState(typeof refusal.accessState === "string" ? refusal.accessState : "none");
          setStatus(null);
          setStale(false);
          return;
        }
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
      setAccessState("approved");
      setError("");
      setStale(false);
      if (explicit) requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      if (status) { setStale(true); setError(""); }
      else setError("Система повышения временно недоступна. Попробуйте позже.");
    } finally {
      setLoading(false);
      if (explicit) setBusy(false);
    }
  }, [status]);

  useEffect(() => {
    if (!visible || checkedNickname || document.visibilityState !== "visible") return;
    queueMicrotask(() => { setCheckedNickname("checked"); void loadStatus("", false, true); });
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
    setBusy(true);
    setError("");
    void fetch("/api/access/editor-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: value }) })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) { setError(publicError(body, "Заявку не удалось отправить.")); return; }
        await loadStatus("", true);
      })
      .catch(() => setError("Заявку не удалось отправить. Повторите позже."))
      .finally(() => setBusy(false));
  };

  const requestPromotion = async (kind: RequestKind) => {
    if (!status || status.promotionRecord === null || stale || submittingRef.current.has(kind)) return;
    submittingRef.current.add(kind);
    setSubmitState((current) => ({ ...current, [kind]: { phase: "submitting", message: "Отправляем заявку…" } }));
    try {
      const response = await fetch("/api/promotion/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const body: unknown = await response.json();
      if (!response.ok || !createdRequest(body)) {
        setSubmitState((current) => ({ ...current, [kind]: { phase: "error", message: publicError(body, "Заявку не удалось отправить.") } }));
        requestAnimationFrame(() => submitFeedbackRefs.current[kind]?.focus());
        return;
      }
      setSubmitState((current) => ({ ...current, [kind]: {
        phase: "success",
        message: kind === "ordinary"
          ? "Заявка на задания отправлена в очередь."
          : "Запрос на квалификацию отправлен в очередь.",
      } }));
      requestAnimationFrame(() => submitFeedbackRefs.current[kind]?.focus());
      await loadStatus(checkedNickname);
    } catch {
      setStale(true);
      setSubmitState((current) => ({ ...current, [kind]: { phase: "error", message: "Заявку не удалось отправить. Повторите позже." } }));
      requestAnimationFrame(() => submitFeedbackRefs.current[kind]?.focus());
    } finally { submittingRef.current.delete(kind); }
  };

  const refreshAfterQualification = useCallback(() => {
    if (checkedNickname) void loadStatus(checkedNickname);
  }, [checkedNickname, loadStatus]);

  const nextKind: RequestKind | null = status && status.promotionRecord !== null
    ? (status.ordinary.eligibility.status === "qualification-required" ? (["qualification", "ordinary"] as const) : (["ordinary", "qualification"] as const))
      .find((kind) => canRequestOn(kind, status[kind].active, status[kind].eligibility)) ?? null
    : null;

  if (!status) return <div className="promotion-app">{loading
    ? <div className="promotion-gate" role="status"><p>Проверяем доступ к повышению…</p></div>
    : <PromotionIdentityGate nickname={nickname} busy={busy} error={error} editor={editor} accessState={accessState} onNickname={setNickname} onSubmit={checkNickname} />}</div>;

  if (status.promotionRecord === null) return <div className="promotion-app"><div className="promotion-shell" aria-live="polite">
    <header className="promotion-identity"><div><span className="promotion-eyebrow">УЧАСТНИК</span><h1 ref={headingRef} tabIndex={-1}>{status.nickname}</h1></div></header>
    <section className="promotion-empty promotion-no-record"><strong>Запись о повышении пока не заведена</strong><p>Обратитесь к проверяющему, чтобы он добавил ваше звание в таблицу повышений.</p></section>
  </div></div>;

  return <>
  <div className="promotion-app">
    <div className="promotion-shell" aria-live="polite">
      <header className="promotion-identity">
        <div><span className="promotion-eyebrow">УЧАСТНИК</span><h1 ref={headingRef} tabIndex={-1}>{status.nickname}</h1></div>
        <dl><div><dt>ТЕКУЩЕЕ ЗВАНИЕ</dt><dd>{status.currentTitle.label}</dd></div><div><dt>СЛЕДУЮЩЕЕ</dt><dd>{status.nextTitle?.label ?? "Высшее звание"}</dd></div></dl>
      </header>
      {stale && <div className="promotion-stale"><strong>Состояние временно не обновляется</strong><span>Показаны последние данные. Действия отключены.</span></div>}
      {error && <p className="promotion-error" role="alert">{error}</p>}
      <section className="promotion-template-entry" aria-label="Конструктор шаблона">
        {/* Owner 2026-11-18: the builder is its own app «Шаблон» now (open to everyone, also without access to «Повышение»); this only opens it. */}
        <button className="promotion-action" type="button" onClick={() => onOpenTemplate?.()}>Открыть «Шаблон»</button>
        <p>Шаблон не засчитывает задание сам по себе.</p>
      </section>
      <div className="promotion-flow-list">
        {status.ordinary.eligibility.status === "qualification-required" && <PromotionStatusCard kind="qualification" active={status.qualification.active} eligibility={status.qualification.eligibility} busy={submitState.qualification.phase === "submitting"} stale={stale} next={nextKind === "qualification"} feedback={submitState.qualification} feedbackRef={(node) => { submitFeedbackRefs.current.qualification = node; }} onRequest={requestPromotion} visible={visible} onQualificationLockChange={onQualificationLockChange} onQualificationFinished={refreshAfterQualification} />}
        <PromotionStatusCard kind="ordinary" active={status.ordinary.active} eligibility={status.ordinary.eligibility} busy={submitState.ordinary.phase === "submitting"} stale={stale} next={nextKind === "ordinary"} feedback={submitState.ordinary} feedbackRef={(node) => { submitFeedbackRefs.current.ordinary = node; }} onRequest={requestPromotion} />
        {status.ordinary.eligibility.status !== "qualification-required" && <PromotionStatusCard kind="qualification" active={status.qualification.active} eligibility={status.qualification.eligibility} busy={submitState.qualification.phase === "submitting"} stale={stale} next={nextKind === "qualification"} feedback={submitState.qualification} feedbackRef={(node) => { submitFeedbackRefs.current.qualification = node; }} onRequest={requestPromotion} visible={visible} onQualificationLockChange={onQualificationLockChange} onQualificationFinished={refreshAfterQualification} />}
      </div>
      <p className="promotion-cleanup-hint">Хранятся три последних результата.</p>
      {status.results.length === 0 && <p className="promotion-history-empty">Завершённых повышений пока нет. Статус текущей заявки показан в карточке выше.</p>}
      {status.results.length > 0 && <details className="promotion-history"><summary>Последние результаты <span>{Math.min(status.results.length, 3)}</span></summary><ul>{status.results.slice(0, 3).map((result, index) => <li key={`${result.createdAt}-${index}`}><span>{result.kind === "ordinary" ? "ЗАДАНИЯ" : "КВАЛИФИКАЦИЯ"}</span><strong>{outcomeLabels[result.outcome] ?? "Результат обновлён"}</strong><time dateTime={result.createdAt}>{formatDate(result.createdAt)}</time></li>)}</ul></details>}
    </div>
  </div>
  </>;
}
