"use client";

import dynamic from "next/dynamic";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import type { GateDecision } from "@/lib/access-gate";
import { accessGateLayout, accessSubmitFailure, claimApprovedNotice, type AccessGateView, type AccessSubmitFailure } from "@/lib/access-gate-view";
import type { AccessOrigin } from "@/lib/access-levels";
import { defaultPortiaContent } from "@/lib/portia-content";
import { isValidNickname } from "@/lib/nickname";

const PortiaDesktop = dynamic(() => import("@/components/portia-desktop").then((mod) => mod.PortiaDesktop), { ssr: false });

const generalSubmitFailure = "Не удалось отправить заявку. Проверьте соединение и повторите.";

function submitFailureText(failure: AccessSubmitFailure): string {
  switch (failure.kind) {
    case "device-busy": return "Ник этого устройства связан с другой записью. Попросите проверяющего сбросить привязку.";
    case "cooldown": return "Повторная заявка пока недоступна. Попробуйте позже.";
    case "throttled": return "Слишком много попыток. Попробуйте позже.";
    case "server": return failure.text;
    default: return generalSubmitFailure;
  }
}

export function PortiaAccessGate() {
  const [view, setView] = useState<AccessGateView>({ kind: "checking" });
  const epoch = useRef(0);
  const approved = useRef(false);
  const [nickname, setNickname] = useState("");
  const [origin, setOrigin] = useState<AccessOrigin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ nickname: false, origin: false });
  const [cardOpen, setCardOpen] = useState(true);
  const statusRef = useRef<HTMLDivElement>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const noticeClaimed = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++epoch.current;
    try {
      const response = await fetch("/api/access/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Status unavailable");
      const decision = await response.json() as GateDecision;
      if (current !== epoch.current) return;
      if (decision.mode !== "open" && decision.mode !== "closed") throw new Error("Invalid status");
      if (decision.mode === "closed" && decision.allowed) approved.current = true;
      setView({ kind: "decision", decision });
      // G-PORTIA-23-3-r2: the approval notice is claimed once per page (ref) and once per device (storage).
      if (!noticeClaimed.current && accessGateLayout({ kind: "decision", decision }, true).approvedNotice) {
        noticeClaimed.current = true;
        if (claimApprovedNotice(() => window.localStorage)) setNoticeOpen(true);
      }
    } catch {
      if (current === epoch.current && !approved.current) setView({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void refresh(); });
    const requestEpoch = epoch;
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onOnline = () => { void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      requestEpoch.current++;
    };
  }, [refresh]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const value = nickname.trim();
    const errors = { nickname: !isValidNickname(value), origin: origin === null };
    setFieldErrors(errors);
    if (errors.nickname || errors.origin) return;
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/access/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value, origin }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(submitFailureText(accessSubmitFailure(body)));
        return;
      }
      await refresh();
      window.requestAnimationFrame(() => statusRef.current?.focus());
    } catch {
      setFormError(generalSubmitFailure);
    } finally {
      setSubmitting(false);
    }
  };

  const dismissNotice = useCallback(() => setNoticeOpen(false), []);

  const layout = accessGateLayout(view, cardOpen);
  const { desktop, showCard, showForm } = layout;
  const statusText = layout.status === "pending" ? "Заявка отправлена. Ожидайте решения проверяющего."
    : layout.status === "approved" ? "Доступ подтверждён. Открываем рабочий стол."
    : layout.status === "rejected" ? "Заявка отклонена. Обратитесь к проверяющему."
    : layout.status === "revoked" ? "Доступ отозван. Обратитесь к проверяющему."
    : null;

  return <>
    {desktop && <PortiaDesktop initialContent={defaultPortiaContent} />}
    {noticeOpen && layout.approvedNotice && <AccessApprovedToast onDismiss={dismissNotice} />}
    {layout.showReopen && <button type="button" className="access-reopen" onClick={() => setCardOpen(true)}>ПОДАТЬ ЗАЯВКУ</button>}
    {showCard && <main className={desktop ? "access-gate access-gate-open" : "access-gate"}>
      <section className="access-card" aria-labelledby="access-title">
        {desktop && <button type="button" className="access-close" onClick={() => setCardOpen(false)} aria-label="Закрыть заявку">×</button>}
        <span className="access-eyebrow">PORTIA // ДОСТУП</span>
        <h1 id="access-title">{view.kind === "checking" ? "Проверяем доступ…" : "Заявка на доступ"}</h1>
        {view.kind === "checking" && <p className="access-loading" role="status">Проверяем доступ<span className="access-dots" aria-hidden="true">…</span></p>}
        {layout.showError && <div ref={statusRef} tabIndex={-1} role="alert"><p>Не удалось проверить доступ. Повторите проверку; содержимое сайта пока недоступно.</p><button type="button" onClick={() => void refresh()}>ПОВТОРИТЬ ПРОВЕРКУ</button></div>}
        {statusText && <div ref={statusRef} tabIndex={-1} className="access-status" role="status">{statusText}</div>}
        {showForm && <form onSubmit={submit} noValidate>
          <label className="access-label" htmlFor="access-nickname">НИК ROBLOX</label>
          <input id="access-nickname" name="nickname" value={nickname} maxLength={20} autoComplete="nickname" aria-invalid={fieldErrors.nickname} aria-describedby={fieldErrors.nickname ? "access-nickname-error" : undefined} onChange={(event) => { setNickname(event.target.value); setFieldErrors((old) => ({ ...old, nickname: false })); }} />
          {fieldErrors.nickname && <p id="access-nickname-error" className="access-error">Введите ник: 3–20 латинских букв, цифр или подчёркиваний.</p>}
          <fieldset aria-describedby={fieldErrors.origin ? "access-origin-error" : undefined}>
            <legend>КЕМ ВЫ ЯВЛЯЕТЕСЬ</legend>
            <label><input type="radio" name="origin" value="sheet" checked={origin === "sheet"} onChange={() => { setOrigin("sheet"); setFieldErrors((old) => ({ ...old, origin: false })); }} /> Я из таблицы</label>
            <label><input type="radio" name="origin" value="outside" checked={origin === "outside"} onChange={() => { setOrigin("outside"); setFieldErrors((old) => ({ ...old, origin: false })); }} /> Я не из таблицы</label>
          </fieldset>
          {fieldErrors.origin && <p id="access-origin-error" className="access-error">Выберите, кем вы являетесь.</p>}
          {formError && <p className="access-error" role="alert">{formError}</p>}
          <button type="submit" disabled={submitting}>{submitting ? "ОТПРАВЛЯЕМ…" : "ОТПРАВИТЬ ЗАЯВКУ"}</button>
        </form>}
        <a href="/owner-login">ВХОД ДЛЯ РЕДАКТОРА</a>
      </section>
    </main>}
  </>;
}

// Non-modal corner notice in the quest toast look (G-PORTIA-23-3-r2). It never takes focus, so Escape is heard on the
// document; handled keys, typing and modal dialogs keep their Escape. preventDefault keeps one Escape from also closing a
// quest notice opened later.
function AccessApprovedToast({ onDismiss }: { onDismiss: () => void }) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      if (window.document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onDismiss();
    };
    window.document.addEventListener("keydown", onKeyDown);
    return () => window.document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <aside className="portia-dialog quest-toast access-approved-toast" aria-labelledby={titleId}>
      <span role="status" className="sr-only">Доступ подтверждён.</span>
      <div>
        <div className="quest-toast-head">
          <span className="quest-toast-eyebrow">PORTIA // ДОСТУП</span>
          <button type="button" className="quest-toast-close" aria-label="Закрыть уведомление" onClick={onDismiss}>×</button>
        </div>
        <h2 id={titleId}>Доступ подтверждён</h2>
        <p className="quest-toast-body">Заявка одобрена. Рабочий стол открыт на этом устройстве.</p>
      </div>
    </aside>
  );
}
