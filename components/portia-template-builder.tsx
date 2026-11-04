"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  createStandaloneHtml,
  downloadTemplateBlob,
  emptyTemplateDraft,
  emptyTemplateText,
  hasTemplateText,
  templateFields,
  templateSections,
  templateSnapshotKey,
  type TemplateDraft,
  type TemplateFieldKey,
} from "@/lib/portia-template-export";

type ExportPhase = "idle" | "preparing" | "error" | "done";

const exportError = "Не удалось подготовить файл. Повторите скачивание.";
// The status line must be on screen for a moment even though building the file is instant.
const preparingMinimumMs = 400;

const fieldByKey = new Map(templateFields.map((field) => [field.key, field]));

function PreviewValue({ value }: { value: string }) {
  return value.trim() === ""
    ? <span className="template-empty">{emptyTemplateText}</span>
    : <>{value}</>;
}

/**
 * Participant-only "Создать шаблон" builder (D-23/D-24). It owns a restricted text draft in React state only:
 * no archive record, no classification or scientist log, no network request, no storage.
 */
export function PortiaTemplateBuilder({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<TemplateDraft>(() => emptyTemplateDraft());
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const exportingRef = useRef(false);
  const idPrefix = useId();

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (confirmClose) stayRef.current?.focus(); }, [confirmClose]);

  const hasText = hasTemplateText(draft);
  const dirty = hasText && templateSnapshotKey(draft) !== exportedKey;
  const preparing = phase === "preparing";

  const update = (key: TemplateFieldKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // A new edit makes a previous "done"/"error" status stale, but never clears the typed text.
    setPhase((current) => (current === "preparing" ? current : "idle"));
  };

  const download = async () => {
    if (exportingRef.current || !hasText) return;
    exportingRef.current = true;
    // The file is built from this snapshot, so edits made while it is being prepared never mix versions.
    const snapshot = draft;
    const snapshotKey = templateSnapshotKey(snapshot);
    setPhase("preparing");
    setConfirmClose(false);
    try {
      const [html] = await Promise.all([
        Promise.resolve().then(() => createStandaloneHtml(snapshot)),
        new Promise<void>((resolve) => window.setTimeout(resolve, preparingMinimumMs)),
      ]);
      downloadTemplateBlob(html);
      setExportedKey(snapshotKey);
      setPhase("done");
    } catch {
      setPhase("error");
    } finally {
      exportingRef.current = false;
    }
  };

  const requestClose = () => {
    if (preparing) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const status = preparing
    ? "Готовим файл…"
    : phase === "done" ? "Файл скачан на устройство. Отправьте его проверяющему вне сайта." : "";

  return <div
    className="template-builder promotion-app"
    onKeyDown={(event) => { if (event.key === "Escape" && confirmClose) { event.stopPropagation(); setConfirmClose(false); } }}
  >
    <div className="template-shell">
      <header className="template-header">
        <div>
          <span className="promotion-eyebrow">ПОВЫШЕНИЕ // ЗАДАНИЕ</span>
          <h1 ref={headingRef} tabIndex={-1}>Шаблон досье</h1>
        </div>
        <button type="button" className="promotion-action template-back" onClick={requestClose} disabled={preparing}>Вернуться к повышению</button>
      </header>
      <p className="template-note">Работа скачивается на ваше устройство. Отправьте файл проверяющему вне сайта. Текст хранится только в этом сеансе и не отправляется на сервер.</p>

      {confirmClose && <section className="template-confirm" role="alertdialog" aria-labelledby={`${idPrefix}-confirm-title`} aria-describedby={`${idPrefix}-confirm-text`}>
        <strong id={`${idPrefix}-confirm-title`}>Черновик ещё не скачан</strong>
        <p id={`${idPrefix}-confirm-text`}>Текст хранится только в этом сеансе. Если вернуться сейчас, набранное будет потеряно. Данные на сервер не отправляются.</p>
        <div className="template-confirm-actions">
          <button ref={stayRef} type="button" className="promotion-action" onClick={() => setConfirmClose(false)}>Остаться и скачать</button>
          <button type="button" className="promotion-action template-discard" onClick={onClose}>Вернуться без скачивания</button>
        </div>
      </section>}

      <div className="template-grid">
        <form className="template-form" onSubmit={(event) => { event.preventDefault(); void download(); }} aria-label="Поля шаблона">
          {templateFields.map((field) => {
            const id = `${idPrefix}-${field.key}`;
            const value = draft[field.key];
            return <div className="template-field" key={field.key}>
              <label htmlFor={id}>{field.label}</label>
              {field.multiline
                ? <textarea id={id} value={value} rows={3} maxLength={field.maxLength} onChange={(event) => update(field.key, event.target.value)} />
                : <input id={id} value={value} maxLength={field.maxLength} autoComplete="off" spellCheck={false} onChange={(event) => update(field.key, event.target.value)} />}
            </div>;
          })}
          <div className="template-actions">
            <button type="submit" className="promotion-action" disabled={!hasText || preparing} aria-describedby={`${idPrefix}-hint`}>Скачать HTML</button>
            {phase === "error" && <button type="submit" className="promotion-action" disabled={preparing}>Повторить скачивание</button>}
          </div>
          <p id={`${idPrefix}-hint`} className="template-hint">
            {hasText ? (dirty ? "Текущий текст ещё не скачан." : "Текущий текст уже скачан.") : "Введите текст хотя бы в одно поле, чтобы скачать файл."}
          </p>
          <p className="template-status" role="status" aria-live="polite">{status}</p>
          {phase === "error" && <p className="promotion-error" role="alert">{exportError}</p>}
        </form>

        <article className="template-preview" aria-label="Предпросмотр шаблона">
          <header>
            <div><span className="template-code"><PreviewValue value={draft.code} /></span><h2><PreviewValue value={draft.name} /></h2></div>
            <div className="template-status-badge"><PreviewValue value={draft.status} /></div>
          </header>
          {templateSections.map((section) => <section key={section.index} className="template-section">
            <div className="template-kicker"><span>{section.index}</span>{section.title}</div>
            <dl>
              {section.keys.map((key) => <div key={key}>
                <dt>{fieldByKey.get(key)?.label}</dt>
                <dd><PreviewValue value={draft[key]} /></dd>
              </div>)}
            </dl>
          </section>)}
          <footer>Шаблон досье / PORTIA / локальный черновик, не запись архива</footer>
        </article>
      </div>
    </div>
  </div>;
}
