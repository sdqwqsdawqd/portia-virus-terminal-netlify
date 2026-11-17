"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import {
  QUALIFICATION_OPTION_MAX,
  QUALIFICATION_OPTION_MIN,
  addOptionRow,
  builderDraftError,
  removeOptionRow,
  setOptionText,
  switchDraftType,
  toggleOptionCorrect,
  type BuilderDraft,
  type BuilderType,
} from "@/lib/portia-qualification-builder";

const typeButtons: ReadonlyArray<readonly [BuilderType, string]> = [["single", "ОДИН ОТВЕТ"], ["multiple", "НЕСКОЛЬКО"], ["free-text", "СВОБОДНЫЙ"]];
const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Controlled question builder: the parent owns the draft. Opened by «+ ВОПРОС» or «ИЗМЕНИТЬ», closed by Escape or «ОТМЕНА». */
export function PortiaQualificationQuestionDialog({ editing, transitionLabel, draft, busy, serverError, opener, onChange, onSave, onCancel }: {
  editing: boolean;
  transitionLabel: string;
  draft: BuilderDraft;
  busy: boolean;
  serverError: string;
  opener: HTMLElement | null;
  onChange: (next: BuilderDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  useEffect(() => {
    textRef.current?.focus();
    return () => { opener?.focus(); };
  }, [opener]);

  const error = builderDraftError(draft);
  const touched = draft.text.trim() !== "" || draft.sample.trim() !== "" || draft.options.some((option) => option.text.trim() !== "");
  const free = draft.type === "free-text";
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
    if (event.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])];
    if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="promotion-confirm-backdrop promotion-question-dialog-backdrop" role="presentation">
    <section ref={dialogRef} className="promotion-question-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <header><span className="promotion-eyebrow">{transitionLabel}</span><h3 id={titleId}>{editing ? "ИЗМЕНИТЬ ВОПРОС" : "НОВЫЙ ВОПРОС"}</h3></header>
      <div className="promotion-question-types" role="group" aria-label="Тип вопроса">
        {typeButtons.map(([value, label]) => <button key={value} type="button" className="secondary-control" aria-pressed={draft.type === value} onClick={() => onChange(switchDraftType(draft, value))}>{label}</button>)}
      </div>
      <label className="promotion-dialog-field">Текст вопроса<textarea ref={textRef} rows={3} value={draft.text} maxLength={4000} placeholder="Напишите вопрос полностью" onChange={(event) => onChange({ ...draft, text: event.target.value })} /></label>
      {free
        ? <label className="promotion-dialog-field">Образец ответа для проверяющего<textarea rows={3} value={draft.sample} maxLength={4000} placeholder="Как выглядит верный ответ" onChange={(event) => onChange({ ...draft, sample: event.target.value })} /></label>
        : <>
          <p className="promotion-dialog-hint" id={hintId}>Отметьте правильный ответ слева от варианта.</p>
          <fieldset className="promotion-answer-options" aria-describedby={hintId}>
            <legend>Варианты ответа · {draft.options.length} из {QUALIFICATION_OPTION_MAX}</legend>
            {draft.options.map((option, index) => <div className="promotion-option-row" key={index}>
              <input type={draft.type === "single" ? "radio" : "checkbox"} name={draft.type === "single" ? `${id}-correct` : undefined} checked={option.correct} aria-label={`Правильный ответ: вариант ${index + 1}`} onChange={() => onChange(toggleOptionCorrect(draft, index))} />
              <input type="text" value={option.text} maxLength={1000} placeholder={`Вариант ${index + 1}`} aria-label={`Вариант ${index + 1}`} onChange={(event) => onChange(setOptionText(draft, index, event.target.value))} />
              <button type="button" className="secondary-control" aria-label={`Удалить вариант ${index + 1}`} disabled={draft.options.length <= QUALIFICATION_OPTION_MIN} onClick={() => onChange(removeOptionRow(draft, index))}>✕</button>
            </div>)}
            <button type="button" className="secondary-control promotion-add-option" disabled={draft.options.length >= QUALIFICATION_OPTION_MAX} onClick={() => onChange(addOptionRow(draft))}>+ ВАРИАНТ</button>
          </fieldset>
        </>}
      {error && touched && <p className="promotion-disabled-reason" id={errorId}>{error}</p>}
      {serverError && <p className="promotion-command-state error" role="alert">{serverError}</p>}
      <footer>
        <button className="secondary-control" type="button" onClick={onCancel}>ОТМЕНА</button>
        <button className="primary-control" type="button" disabled={busy || Boolean(error)} aria-describedby={error && touched ? errorId : undefined} onClick={onSave}>{editing ? "СОХРАНИТЬ ВОПРОС" : "ДОБАВИТЬ ВОПРОС"}</button>
      </footer>
    </section>
  </div>;
}
