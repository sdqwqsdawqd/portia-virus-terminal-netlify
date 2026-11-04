"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  createStandaloneHtml,
  createTemplatePng,
  decodeLocalTemplateImage,
  downloadTemplateBlob,
  emptyTemplateDraft,
  emptyTemplateText,
  hasTemplateContent,
  isTemplatePngTooLargeError,
  templateExportError,
  templateFields,
  templateFileName,
  templateImageAccept,
  templateImageOpenError,
  templatePngFileName,
  templatePngTooLargeError,
  templateSections,
  templateSnapshotKey,
  type TemplateDraft,
  type TemplateFieldKey,
  type TemplateImage,
} from "@/lib/portia-template-export";

type ExportPhase = "idle" | "preparing" | "error" | "too-large" | "done";
type ExportFormat = "png" | "html";

// The status line must be on screen for a moment even though building the file is instant.
const preparingMinimumMs = 400;

const fieldByKey = new Map(templateFields.map((field) => [field.key, field]));

function PreviewValue({ value }: { value: string }) {
  return value.trim() === ""
    ? <span className="template-empty">{emptyTemplateText}</span>
    : <>{value}</>;
}

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`);

/**
 * Participant-only "Создать шаблон" builder (D-23/D-24). It owns a restricted draft (text plus one local image) in React
 * state only: no archive record, no classification or scientist log, no network request, no storage. The image is a
 * validated data URL kept in memory and embedded into the downloaded HTML / drawn into the downloaded PNG.
 */
export function PortiaTemplateBuilder({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<TemplateDraft>(() => emptyTemplateDraft());
  const [image, setImage] = useState<TemplateImage | null>(null);
  const [imageError, setImageError] = useState(false);
  const [reading, setReading] = useState(false);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [lastFormat, setLastFormat] = useState<ExportFormat>("html");
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportingRef = useRef(false);
  const readTokenRef = useRef(0);
  const idPrefix = useId();

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (confirmClose) stayRef.current?.focus(); }, [confirmClose]);

  const hasContent = hasTemplateContent(draft, image);
  const dirty = hasContent && templateSnapshotKey(draft, image) !== exportedKey;
  const preparing = phase === "preparing";
  // Nothing may be downloaded, replaced or left while a file is being read or built.
  const busy = preparing || reading;

  const update = (key: TemplateFieldKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // A new edit makes a previous "done"/"error" status stale, but never clears the typed text.
    setPhase((current) => (current === "preparing" ? current : "idle"));
  };

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || exportingRef.current) return;
    const token = readTokenRef.current + 1;
    readTokenRef.current = token;
    setReading(true);
    setImageError(false);
    try {
      const decoded = await decodeLocalTemplateImage(file);
      if (readTokenRef.current !== token) return;
      setImage(decoded);
      setPhase((current) => (current === "preparing" ? current : "idle"));
    } catch {
      // The text draft and a previously accepted image stay exactly as they were.
      if (readTokenRef.current === token) setImageError(true);
    } finally {
      if (readTokenRef.current === token) setReading(false);
    }
  };

  const removeImage = () => {
    if (busy) return;
    readTokenRef.current += 1;
    setImage(null);
    setImageError(false);
    setPhase((current) => (current === "preparing" ? current : "idle"));
  };

  const runExport = async (format: ExportFormat) => {
    if (exportingRef.current || reading || !hasContent) return;
    exportingRef.current = true;
    // The file is built from this snapshot, so edits made while it is being prepared never mix versions.
    const snapshot = draft;
    const snapshotImage = image;
    const snapshotKey = templateSnapshotKey(snapshot, snapshotImage);
    setLastFormat(format);
    setPhase("preparing");
    setConfirmClose(false);
    const minimumShown = new Promise<void>((resolve) => window.setTimeout(resolve, preparingMinimumMs));
    try {
      const content = await (format === "png"
        ? createTemplatePng(snapshot, snapshotImage)
        : Promise.resolve().then(() => createStandaloneHtml(snapshot, snapshotImage)));
      await minimumShown;
      downloadTemplateBlob(content, format === "png" ? templatePngFileName : templateFileName);
      setExportedKey(snapshotKey);
      setPhase("done");
    } catch (error) {
      // A failure also waits out the minimum, so the status is never skipped and the result is announced after it.
      await minimumShown;
      setPhase(isTemplatePngTooLargeError(error) ? "too-large" : "error");
    } finally {
      exportingRef.current = false;
    }
  };

  // The confirmation is modal inside this view: Tab and Shift+Tab cycle over its two buttons and leaving it puts the focus back on the control that opened it.
  const dismissConfirm = () => {
    setConfirmClose(false);
    requestAnimationFrame(() => backRef.current?.focus());
  };
  const trapConfirmTab = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(confirmRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !buttons.includes(active as HTMLElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !buttons.includes(active as HTMLElement))) { event.preventDefault(); first.focus(); }
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const status = busy
    ? "Готовим файл…"
    : phase === "done" ? "Файл скачан на устройство. Отправьте его проверяющему вне сайта." : "";

  return <div
    className="template-builder promotion-app"
    onKeyDown={(event) => { if (event.key === "Escape" && confirmClose) { event.stopPropagation(); dismissConfirm(); } }}
  >
    <div className="template-shell">
      <header className="template-header">
        <div>
          <span className="promotion-eyebrow">ПОВЫШЕНИЕ // ЗАДАНИЕ</span>
          <h1 ref={headingRef} tabIndex={-1}>Шаблон досье</h1>
        </div>
        <button ref={backRef} type="button" className="promotion-action template-back" onClick={requestClose} disabled={busy}>Вернуться к повышению</button>
      </header>
      <p className="template-note">Работа скачивается на ваше устройство. Отправьте файл проверяющему вне сайта. Текст и изображение хранятся только в этом сеансе и не отправляются на сервер.</p>

      {confirmClose && <section ref={confirmRef} onKeyDown={trapConfirmTab} className="template-confirm" role="alertdialog" aria-modal="true" aria-labelledby={`${idPrefix}-confirm-title`} aria-describedby={`${idPrefix}-confirm-text`}>
        <strong id={`${idPrefix}-confirm-title`}>Черновик ещё не скачан</strong>
        <p id={`${idPrefix}-confirm-text`}>Текст и изображение хранятся только в этом сеансе. Если вернуться сейчас, набранное будет потеряно. Данные на сервер не отправляются.</p>
        <div className="template-confirm-actions">
          <button ref={stayRef} type="button" className="promotion-action" onClick={dismissConfirm}>Остаться и скачать</button>
          <button type="button" className="promotion-action template-discard" onClick={onClose}>Вернуться без скачивания</button>
        </div>
      </section>}

      <div className="template-grid" inert={confirmClose || undefined}>
        <form className="template-form" onSubmit={(event) => event.preventDefault()} aria-label="Поля шаблона">
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

          <div className="template-field template-image-field">
            <span className="template-field-title" id={`${idPrefix}-image-title`}>Изображение</span>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={templateImageAccept}
              aria-labelledby={`${idPrefix}-image-title`}
              data-testid="template-image-input"
              onChange={(event) => { void chooseImage(event); }}
            />
            <div className="template-actions">
              <button type="button" className="promotion-action" disabled={busy} onClick={() => fileRef.current?.click()}>Добавить изображение</button>
              {image && <button type="button" className="promotion-action" disabled={busy} onClick={removeImage}>Убрать изображение</button>}
            </div>
            <p className="template-hint">
              {image
                ? `Выбрано: ${image.name}, ${image.width}×${image.height}, ${sizeLabel(image.bytes)}. Файл не покидает это устройство.`
                : "PNG, JPEG или WebP до 5 МБ. Файл остаётся на этом устройстве."}
            </p>
            {imageError && <p className="promotion-error" role="alert">{templateImageOpenError}</p>}
          </div>

          <div className="template-actions">
            <button type="button" className="promotion-action" disabled={!hasContent || busy} aria-describedby={`${idPrefix}-hint`} onClick={() => { void runExport("png"); }}>Скачать PNG</button>
            <button type="button" className="promotion-action" disabled={!hasContent || busy} aria-describedby={`${idPrefix}-hint`} onClick={() => { void runExport("html"); }}>Скачать HTML</button>
            {phase === "error" && <button type="button" className="promotion-action" disabled={busy} onClick={() => { void runExport(lastFormat); }}>Повторить скачивание</button>}
          </div>
          <p id={`${idPrefix}-hint`} className="template-hint">
            {hasContent ? (dirty ? "Текущий черновик ещё не скачан." : "Текущий черновик уже скачан.") : "Введите текст хотя бы в одно поле или добавьте изображение, чтобы скачать файл."}
          </p>
          <p className="template-status" role="status" aria-live="polite">{status}</p>
          {phase === "error" && <p className="promotion-error" role="alert">{templateExportError}</p>}
          {phase === "too-large" && <p className="promotion-error" role="alert">{templatePngTooLargeError}</p>}
        </form>

        <article className="template-preview" aria-label="Предпросмотр шаблона">
          <header>
            <div><span className="template-code"><PreviewValue value={draft.code} /></span><h2><PreviewValue value={draft.name} /></h2></div>
            <div className="template-status-badge"><PreviewValue value={draft.status} /></div>
          </header>
          {image && <figure className="template-figure">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image cannot optimise it */}
            <img src={image.dataUrl} alt="Изображение, выбранное участником" width={image.width} height={image.height} />
          </figure>}
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
