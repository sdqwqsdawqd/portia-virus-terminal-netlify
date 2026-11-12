"use client";

import dynamic from "next/dynamic";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { GateDecision } from "@/lib/access-gate";
import type { AccessOrigin } from "@/lib/access-levels";
import { defaultPortiaContent } from "@/lib/portia-content";
import { isValidNickname } from "@/lib/nickname";

const PortiaDesktop = dynamic(() => import("@/components/portia-desktop").then((mod) => mod.PortiaDesktop), { ssr: false });

type View = { kind: "checking" } | { kind: "error" } | { kind: "decision"; decision: GateDecision };

export function PortiaAccessGate() {
  const [view, setView] = useState<View>({ kind: "checking" });
  const epoch = useRef(0);
  const approved = useRef(false);
  const [nickname, setNickname] = useState("");
  const [origin, setOrigin] = useState<AccessOrigin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ nickname: false, origin: false });
  const [cardOpen, setCardOpen] = useState(true);
  const statusRef = useRef<HTMLDivElement>(null);

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
      const result = await response.json() as { code?: string; error?: string };
      if (!response.ok) {
        const messages: Record<string, string> = {
          "device-busy": "Ник этого устройства связан с другой записью. Попросите проверяющего сбросить привязку.",
          cooldown: "Повторная заявка пока недоступна. Попробуйте позже.",
          throttled: "Слишком много попыток. Попробуйте позже.",
        };
        throw new Error(messages[result.code ?? ""] ?? result.error ?? "Не удалось отправить заявку. Проверьте соединение и повторите.");
      }
      await refresh();
      window.requestAnimationFrame(() => statusRef.current?.focus());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось отправить заявку. Проверьте соединение и повторите.");
    } finally {
      setSubmitting(false);
    }
  };

  const decision = view.kind === "decision" ? view.decision : null;
  const desktop = decision !== null && (decision.mode === "open" || decision.allowed);
  const state = decision?.state;
  const pending = state?.state === "pending";
  const approvedState = state?.state === "approved";
  const statusText = pending ? "Заявка отправлена. Ожидайте решения проверяющего."
    : approvedState ? "Доступ подтверждён. Открываем рабочий стол."
    : state?.state === "rejected" ? "Заявка отклонена. Обратитесь к проверяющему."
    : state?.state === "revoked" ? "Доступ отозван. Обратитесь к проверяющему."
    : null;
  const showForm = state?.state === "none" || state?.state === "rejected" || state?.state === "revoked";
  const showCard = !desktop || cardOpen;

  return <>
    {desktop && <PortiaDesktop initialContent={defaultPortiaContent} />}
    {desktop && !showCard && <button type="button" className="access-reopen" onClick={() => setCardOpen(true)}>ПОДАТЬ ЗАЯВКУ</button>}
    {showCard && <main className={desktop ? "access-gate access-gate-open" : "access-gate"}>
      <section className="access-card" aria-labelledby="access-title">
        {desktop && <button type="button" className="access-close" onClick={() => setCardOpen(false)} aria-label="Закрыть заявку">×</button>}
        <span className="access-eyebrow">PORTIA // ДОСТУП</span>
        <h1 id="access-title">{view.kind === "checking" ? "Проверяем доступ…" : "Заявка на доступ"}</h1>
        {view.kind === "checking" && <p className="access-loading" role="status">Проверяем доступ<span className="access-dots" aria-hidden="true">…</span></p>}
        {view.kind === "error" && <div ref={statusRef} tabIndex={-1} role="alert"><p>Не удалось проверить доступ. Повторите проверку; содержимое сайта пока недоступно.</p><button type="button" onClick={() => void refresh()}>ПОВТОРИТЬ ПРОВЕРКУ</button></div>}
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
