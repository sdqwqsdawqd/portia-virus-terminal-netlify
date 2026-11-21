"use client";

import dynamic from "next/dynamic";
import { type FormEvent, type Ref, useCallback, useEffect, useId, useRef, useState } from "react";
import type { GateDecision } from "@/lib/access-gate";
import { accessGateLayout, accessSubmitFailure, claimApprovedNotice, type AccessGateLayout, type AccessGateView, type AccessSubmitFailure } from "@/lib/access-gate-view";
import type { AccessOrigin } from "@/lib/access-levels";
import { cacheIdentityOf, shouldClearDeviceCaches, viewerKey, viewerOf, viewerPersonOf } from "@/lib/access-viewer";
import { clearDeviceContentCaches, identityChanged, purgeLegacyDeviceCaches } from "@/lib/device-cache";
import { emptyPortiaContent } from "@/lib/portia-content";
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
  // SEC-04: who the device was for at the previous gate answer (viewer key and person). null until the first answer.
  const previousIdentity = useRef<string | null>(null);
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
      // D-21: closed and not allowed (never approved, rejected, revoked) leaves no copy of the content on the device.
      if (shouldClearDeviceCaches(decision)) clearDeviceContentCaches(() => window.localStorage);
      // SEC-04 (D-16): any change of person or level since the previous answer (approved to rejected or revoked, a level up or
      // down, an editor leaving) wipes both copies, so the desktop never meets a copy of another identity. The first answer wipes
      // nothing: there is nothing to compare, and a copy of another identity is dropped by the desktop's load-time check.
      const identity = cacheIdentityOf(decision);
      if (identityChanged(previousIdentity.current, identity)) clearDeviceContentCaches(() => window.localStorage);
      previousIdentity.current = identity;
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
    // T-25-28: the copies taken before the closure (v1) are deleted once, whatever the decision turns out to be.
    purgeLegacyDeviceCaches(() => window.localStorage);
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
  // The desktop got 401 access-required from /api/content: ask the gate now instead of at the next 5 s poll.
  const onAccessLost = useCallback(() => { void refresh(); }, [refresh]);
  const viewer = view.kind === "decision" ? viewerOf(view.decision) : null;

  const layout = accessGateLayout(view, cardOpen);
  const { desktop, showCard } = layout;

  return <>
    {desktop && <PortiaDesktop initialContent={emptyPortiaContent} viewerKey={viewerKey(viewer)} viewerPerson={view.kind === "decision" ? viewerPersonOf(view.decision) : ""} viewerLevel={viewer?.level ?? null} onAccessLost={onAccessLost} />}
    {noticeOpen && layout.approvedNotice && <AccessApprovedToast onDismiss={dismissNotice} />}
    {layout.showReopen && <button type="button" className="access-reopen" onClick={() => setCardOpen(true)}>ПОДАТЬ ЗАЯВКУ</button>}
    {showCard && <main className={desktop ? "access-gate access-gate-open" : "access-gate"}>
      <AccessGateScreen
        layout={layout}
        checking={view.kind === "checking"}
        form={{ nickname, origin, submitting, formError, fieldErrors }}
        statusRef={statusRef}
        onNickname={(value) => { setNickname(value); setFieldErrors((old) => ({ ...old, nickname: false })); }}
        onOrigin={(value) => { setOrigin(value); setFieldErrors((old) => ({ ...old, origin: false })); }}
        onSubmit={submit}
        onRetry={() => void refresh()}
        onClose={() => setCardOpen(false)}
      />
    </main>}
  </>;
}

/** What the request form shows: the typed values and the errors. The gate owns them; the live preview of the editor (26.1-19) hands a fixed sample. */
export type AccessGateFormState = {
  nickname: string;
  origin: AccessOrigin | null;
  submitting: boolean;
  formError: string;
  fieldErrors: { nickname: boolean; origin: boolean };
};

export type AccessGateScreenProps = {
  layout: AccessGateLayout;
  checking: boolean;
  form: AccessGateFormState;
  onNickname: (value: string) => void;
  onOrigin: (value: AccessOrigin) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
  /** The close button of the card over the open desktop (the gate passes it; absent, there is none). */
  onClose?: () => void;
  statusRef?: Ref<HTMLDivElement>;
  /**
   * The live preview of the editor (26.1-19, owner 2026-11-21, item 13): the same screen, its ids prefixed so they never meet the gate's own,
   * and the submit button locked with this short note under it. The screen makes no request and touches no storage either way: every action is handed in.
   */
  preview?: { note: string };
};

/**
 * The card of the visitor's gate by state: the check, the request form, the status of the request, the connection error. A pure move of the markup of
 * `PortiaAccessGate` (26.1-19): the requests, the device caches and the approval notice stay in the gate; this draws what the layout says and calls what it is given.
 */
export function AccessGateScreen({ layout, checking, form, onNickname, onOrigin, onSubmit, onRetry, onClose, statusRef, preview }: AccessGateScreenProps) {
  const { desktop, showForm } = layout;
  const prefix = preview ? "access-preview" : "access";
  const { fieldErrors } = form;
  const statusText = layout.status === "pending" ? "Заявка отправлена. Ожидайте решения проверяющего."
    : layout.status === "approved" ? "Доступ подтверждён. Открываем рабочий стол."
    : layout.status === "rejected" ? "Заявка отклонена. Обратитесь к проверяющему."
    : layout.status === "revoked" ? "Доступ отозван. Обратитесь к проверяющему."
    : null;

  return (
    <section className="access-card" aria-labelledby={`${prefix}-title`}>
      {desktop && onClose && <button type="button" className="access-close corner-close" onClick={onClose} aria-label="Закрыть заявку">×</button>}
      <span className="access-eyebrow">PORTIA // ДОСТУП</span>
      <h1 id={`${prefix}-title`}>{checking ? "Проверяем доступ…" : "Заявка на доступ"}</h1>
      {checking && <p className="access-loading" role="status">Проверяем доступ<span className="access-dots" aria-hidden="true">…</span></p>}
      {layout.showError && <div ref={statusRef} tabIndex={-1} role="alert"><p>Не удалось проверить доступ. Повторите проверку; содержимое сайта пока недоступно.</p><button type="button" onClick={onRetry}>ПОВТОРИТЬ ПРОВЕРКУ</button></div>}
      {statusText && <div ref={statusRef} tabIndex={-1} className="access-status" role="status">{statusText}</div>}
      {showForm && <form onSubmit={onSubmit} noValidate>
        <label className="access-label" htmlFor={`${prefix}-nickname`}>НИК ROBLOX</label>
        <input id={`${prefix}-nickname`} name="nickname" value={form.nickname} maxLength={20} autoComplete="nickname" aria-invalid={fieldErrors.nickname} aria-describedby={fieldErrors.nickname ? `${prefix}-nickname-error` : undefined} onChange={(event) => onNickname(event.target.value)} />
        {fieldErrors.nickname && <p id={`${prefix}-nickname-error`} className="access-error">Введите ник: 3–20 латинских букв, цифр или подчёркиваний.</p>}
        <fieldset aria-describedby={fieldErrors.origin ? `${prefix}-origin-error` : undefined}>
          <legend>КЕМ ВЫ ЯВЛЯЕТЕСЬ</legend>
          <label><input type="radio" name="origin" value="sheet" checked={form.origin === "sheet"} onChange={() => onOrigin("sheet")} /> Я из таблицы</label>
          <label><input type="radio" name="origin" value="outside" checked={form.origin === "outside"} onChange={() => onOrigin("outside")} /> Я не из таблицы</label>
        </fieldset>
        {fieldErrors.origin && <p id={`${prefix}-origin-error`} className="access-error">Выберите, кем вы являетесь.</p>}
        {form.formError && <p className="access-error" role="alert">{form.formError}</p>}
        <button type="submit" disabled={form.submitting || !!preview}>{form.submitting ? "ОТПРАВЛЯЕМ…" : "ОТПРАВИТЬ ЗАЯВКУ"}</button>
        {preview && <p className="access-preview-note">{preview.note}</p>}
      </form>}
      <a href="/owner-login">ВХОД ДЛЯ РЕДАКТОРА</a>
    </section>
  );
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
          <button type="button" className="quest-toast-close corner-close" aria-label="Закрыть уведомление" onClick={onDismiss}>×</button>
        </div>
        <h2 id={titleId}>Доступ подтверждён</h2>
        <p className="quest-toast-body">Заявка одобрена. Рабочий стол открыт на этом устройстве.</p>
      </div>
    </aside>
  );
}
