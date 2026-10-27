"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type RequestKind = "ordinary" | "qualification";
type Eligibility =
  | { status: "eligible"; targetTitleId: string | null }
  | { status: "cooldown"; availableAt: string; remainingMs: number }
  | { status: "qualification-required" }
  | { status: "awaiting-sheet-change" }
  | { status: "special-task"; targetTitleId: string }
  | { status: "not-listed" };
type PublicTask = { id: string; text: string; sortOrder: number };
type ActiveState = { status: string; targetTitleId: string | null; availableAt?: string; tasks?: PublicTask[] } | null;
type PublicResult = { kind: RequestKind; outcome: string; createdAt: string };
type PromotionStatus = {
  nickname: string;
  currentTitle: { id: string; label: string };
  nextTitle: { id: string; label: string } | null;
  ordinary: { eligibility: Eligibility; active: ActiveState };
  qualification: { eligibility: Eligibility; active: ActiveState };
  results: PublicResult[];
};

const statusPollMs = 15_000;
const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" });

function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "по решению проверяющего";
  return dateTime.format(new Date(value));
}

function publicError(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : fallback;
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
    <header><span className="promotion-eyebrow">PORTIA // КАДРОВЫЙ КОНТУР</span><h1>ПРОВЕРИТЬ ПОВЫШЕНИЕ</h1><p>Узнайте доступность повышения, состояние заданий и квалификационной проверки.</p></header>
    <form onSubmit={onSubmit}>
      <label htmlFor="promotion-nickname">Ник в таблице PORTIA</label>
      <input id="promotion-nickname" value={nickname} onChange={(event) => onNickname(event.target.value)} maxLength={64} autoComplete="off" spellCheck={false} placeholder="Например, Portia_User" disabled={busy} />
      <p className="promotion-binding-note">Первая заявка закрепит этот ник за устройством. Сменить его сможет проверяющий.</p>
      {error && <p className="promotion-error" role="alert">{error}</p>}
      <button className="promotion-action" type="submit" disabled={busy || !nickname.trim()}>{busy ? "ПРОВЕРЯЕМ…" : "ПРОВЕРИТЬ НИК"}</button>
    </form>
  </div>;
}

function activeCopy(kind: RequestKind, active: NonNullable<ActiveState>) {
  if (active.status === "pending") return kind === "ordinary" ? "Заявка на задания отправлена." : "Запрос на квалификацию отправлен.";
  if (active.status === "claimed") return "Проверяющий уже взял запрос в работу.";
  if (active.status === "assigned") return "Задания назначены. Выполните их и ожидайте решения проверяющего.";
  if (active.status === "awaiting-sheet-change" || active.status === "approved") return "Ожидается изменение звания в таблице.";
  if (active.status === "testing") return "Квалификационная проверка начата.";
  if (active.status === "grading") return "Ответы переданы проверяющему.";
  if (active.status === "passed") return "Квалификационная проверка пройдена.";
  if (active.status === "failed") return `Повторная проверка доступна ${formatDate(active.availableAt)}.`;
  return "Состояние запроса обновляется.";
}

function eligibilityCopy(kind: RequestKind, eligibility: Eligibility) {
  if (eligibility.status === "cooldown") return `Доступно после ${formatDate(eligibility.availableAt)}.`;
  if (eligibility.status === "awaiting-sheet-change") return "Ожидается изменение звания в таблице.";
  if (eligibility.status === "special-task") return "Особое задание для звания «Эксперт вирусолог» выдаёт проверяющий.";
  if (eligibility.status === "qualification-required") return kind === "ordinary"
    ? "Сначала необходимо пройти квалификацию для текущего звания."
    : "Для текущего звания квалификационная проверка не требуется.";
  if (eligibility.status === "eligible") return kind === "ordinary" ? "Можно запросить задания для следующего звания." : "Можно запросить квалификационную проверку.";
  return "Повышение сейчас недоступно.";
}

function PromotionStatusCard({ kind, active, eligibility, busy, stale, onRequest }: {
  kind: RequestKind;
  active: ActiveState;
  eligibility: Eligibility;
  busy: boolean;
  stale: boolean;
  onRequest: (kind: RequestKind) => void;
}) {
  const ordinary = kind === "ordinary";
  const canRequest = !active && (eligibility.status === "eligible" || (ordinary && eligibility.status === "special-task"));
  const tasks = active?.tasks?.slice().sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  return <section className={`promotion-card ${ordinary ? "promotion-ordinary-card" : "promotion-qualification-card"}`}>
    <header><span className="promotion-flow-icon" aria-hidden="true">{ordinary ? "▤" : "◇"}</span><div><span className="promotion-eyebrow">{ordinary ? "ОБЫЧНОЕ ПОВЫШЕНИЕ" : "КВАЛИФИКАЦИЯ"}</span><h2>{ordinary ? "Задания на повышение" : "Проверка знаний"}</h2></div></header>
    <p className="promotion-status-copy">{active ? activeCopy(kind, active) : eligibilityCopy(kind, eligibility)}</p>
    {tasks.length > 0 && <div className="promotion-tasks"><h3>Назначенные задания</h3><ol className="promotion-task-list">{tasks.map((task) => <li key={task.id}><span>{String(task.sortOrder).padStart(2, "0")}</span><p>{task.text}</p></li>)}</ol></div>}
    {canRequest && <button className="promotion-action" type="button" disabled={busy || stale} onClick={() => onRequest(kind)}>{ordinary ? "ПОДАТЬ ЗАЯВКУ НА ЗАДАНИЯ" : "ЗАПРОСИТЬ КВАЛИФИКАЦИЮ"}</button>}
  </section>;
}

const outcomeLabels: Record<string, string> = {
  approved: "Задания зачтены", passed: "Проверка пройдена", failed: "Проверка не пройдена",
  rejected: "Заявка отклонена", "technical-failure": "Попытка завершена", "retake-released": "Повторная проверка открыта",
};

export function PortiaPromotion({ visible }: { visible: boolean }) {
  const [nickname, setNickname] = useState("");
  const [checkedNickname, setCheckedNickname] = useState("");
  const [status, setStatus] = useState<PromotionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const loadStatus = useCallback(async (value: string, explicit = false) => {
    if (!value) return;
    if (explicit) setBusy(true);
    try {
      const response = await fetch(`/api/promotion/status?nickname=${encodeURIComponent(value)}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 503 && status) { setStale(true); setError(""); return; }
        setStatus(null);
        setError(publicError(body, "Не удалось проверить ник. Попробуйте позже."));
        return;
      }
      setStatus(body as PromotionStatus);
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
    if (!visible || document.visibilityState !== "visible") return;
    if (!checkedNickname) return;
    const poll = () => { if (document.visibilityState === "visible") void loadStatus(checkedNickname); };
    const timer = window.setInterval(poll, statusPollMs);
    document.addEventListener("visibilitychange", poll);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [checkedNickname, loadStatus, visible]);

  const checkNickname = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = nickname.trim();
    if (!value) return;
    setCheckedNickname(value);
    void loadStatus(value, true);
  };

  const requestPromotion = async (kind: RequestKind) => {
    if (!status || stale) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/promotion/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: checkedNickname, kind }) });
      const body: unknown = await response.json();
      if (!response.ok) { setError(publicError(body, "Заявку не удалось отправить.")); return; }
      await loadStatus(checkedNickname);
    } catch { setStale(true); setError("Заявку не удалось отправить. Проверьте соединение и повторите позже."); }
    finally { setBusy(false); }
  };

  if (!status) return <div className="promotion-app"><PromotionIdentityGate nickname={nickname} busy={busy} error={error} onNickname={setNickname} onSubmit={checkNickname} /></div>;

  return <div className="promotion-app">
    <div className="promotion-shell" aria-live="polite">
      <header className="promotion-identity">
        <div><span className="promotion-eyebrow">УЧАСТНИК</span><h1 ref={headingRef} tabIndex={-1}>{status.nickname}</h1></div>
        <dl><div><dt>ТЕКУЩЕЕ ЗВАНИЕ</dt><dd>{status.currentTitle.label}</dd></div><div><dt>СЛЕДУЮЩЕЕ</dt><dd>{status.nextTitle?.label ?? "Высшее звание"}</dd></div></dl>
      </header>
      {stale && <div className="promotion-stale"><strong>Состояние временно не обновляется</strong><span>Показаны последние безопасные данные. Действия отключены до восстановления связи.</span></div>}
      {error && <p className="promotion-error" role="alert">{error}</p>}
      <div className="promotion-flow-list">
        <PromotionStatusCard kind="ordinary" active={status.ordinary.active} eligibility={status.ordinary.eligibility} busy={busy} stale={stale} onRequest={requestPromotion} />
        <PromotionStatusCard kind="qualification" active={status.qualification.active} eligibility={status.qualification.eligibility} busy={busy} stale={stale} onRequest={requestPromotion} />
      </div>
      {status.results.length > 0 && <details className="promotion-history"><summary>Последние результаты <span>{Math.min(status.results.length, 3)}</span></summary><ul>{status.results.slice(0, 3).map((result, index) => <li key={`${result.createdAt}-${index}`}><span>{result.kind === "ordinary" ? "ЗАДАНИЯ" : "КВАЛИФИКАЦИЯ"}</span><strong>{outcomeLabels[result.outcome] ?? "Результат обновлён"}</strong><time dateTime={result.createdAt}>{formatDate(result.createdAt)}</time></li>)}</ul></details>}
    </div>
  </div>;
}
