"use client";

import type { FormEvent, Ref } from "react";
import type { AccessGateLayout } from "@/lib/access-gate-view";
import type { AccessOrigin } from "@/lib/access-levels";

// The card of the visitor's gate, apart from the gate (26.1-19). The editor's live «Доступ» draws these same screens, and the import graph of the editor's seam must not carry the gate itself
// (its device caches, session and desktop): this file holds only the markup, as types and React.

/** What the request form shows: the typed values and the errors. The gate owns them; the live preview of the editor hands a fixed sample. */
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
   * the submit button locked with this short note under it, and the editor-login link shown but not followed. The screen makes no request and touches no storage either way: every action is handed in.
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
      <a href="/owner-login" aria-disabled={preview ? true : undefined} onClick={preview ? (event) => event.preventDefault() : undefined}>ВХОД ДЛЯ РЕДАКТОРА</a>
    </section>
  );
}
