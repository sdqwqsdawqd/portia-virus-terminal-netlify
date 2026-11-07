"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ClassificationField, DossierTabs, EditorGroup, Field } from "@/components/portia-editor-dossier";
import {
  ActiveFormatContext,
  FloatingTextFormatPanel,
  FormattedTextarea,
  FormatLaunchButton,
  joinFormatTarget,
  type EditorPreviewSurface,
  type FormatTarget,
} from "@/components/portia-editor-rich-text";
import type { DossierTab } from "@/lib/editor-changes";
import { portiaTextKey, type PortiaContent, type RichTextDocument, type Virus } from "@/lib/portia-content";
import { VirusCardBody, type VirusCardSlot } from "@/components/portia-virus-card";
import {
  addTemplateMutation,
  editTemplateText,
  editTemplateVirus,
  emptyTemplateDossier,
  hasTemplateDossierContent,
  isLocalTemplateImage,
  removeTemplateMutation,
  setTemplateImage,
  templateDossierSnapshotKey,
  templateFieldRuns,
  templateVirusId,
  type TemplateDossier,
} from "@/lib/portia-template-dossier";
import {
  createTemplateDossierHtml,
  createTemplateDossierPng,
  decodeLocalTemplateImage,
  downloadTemplateBlob,
  emptyTemplateText,
  isTemplatePngTooLargeError,
  mutationCaption,
  photoCaption,
  templateExportError,
  templateFileName,
  templateImageAccept,
  templateImageOpenError,
  templatePngFileName,
  templatePngTooLargeError,
  type TemplateImage,
} from "@/lib/portia-template-export";

type ExportPhase = "idle" | "preparing" | "error" | "too-large" | "done";
// The builder shows the form or the card, never both: the card takes the full width and the form stays compact (D-55).
type BuilderView = "fields" | "preview";
type ExportFormat = "png" | "html";

// The status line must be on screen for a moment even though building the file is instant.
const preparingMinimumMs = 400;

// The editor says "Текст и GIF можно использовать вместе"; a template is self-contained, so pictures are added as files only (D-24).
const textHint = "Картинки по ссылке в тексте шаблона не загружаются: добавьте изображение файлом.";

type ImageSlot = "infected" | number;
const slotKey = (slot: ImageSlot) => (slot === "infected" ? "infected" : `mutation:${slot}`);

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`);

/**
 * A picture slot in the place and with the markup of the editor's ImageEditorField, but local only: there is no address field,
 * no upload and no GIF (D-24). A refused file shows an error and changes neither the text nor the previous picture.
 */
function TemplateImageField({ label, placement, image, error, busy, onFile, onRemove }: {
  label: string;
  placement: "dossier" | "mutation";
  image: TemplateImage | null;
  error: boolean;
  busy: boolean;
  onFile: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const titleId = useId();
  const actionId = useId();
  const hint = image
    ? `Выбрано: ${image.name}, ${image.width}×${image.height}, ${sizeLabel(image.bytes)}. Файл не покидает это устройство.`
    : "PNG, JPEG или WebP до 5 МБ. Файл остаётся на этом устройстве.";
  return <div className={`editor-field wide image-editor-field image-placement-${placement}`}>
    <span id={titleId}>{label}</span>
    <label className="editor-dropzone" aria-disabled={busy || undefined} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); onFile(event.dataTransfer.files?.[0]); }}>
      <input className="sr-only" type="file" accept={templateImageAccept} disabled={busy} aria-labelledby={`${titleId} ${actionId}`} data-testid="template-image-input" onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <strong id={actionId}>ВЫБРАТЬ ФАЙЛ С КОМПЬЮТЕРА</strong>
      <small>или перетащите изображение сюда · PNG, JPEG, WebP · до 5 МБ</small>
    </label>
    <small className="editor-media-hint">{hint}</small>
    {error && <span className="editor-media-error" role="alert">{templateImageOpenError}</span>}
    {image && <figure className={`editor-image-preview ${placement}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image cannot optimise it */}
      <img src={image.dataUrl} alt={`Предпросмотр: ${label}`} />
    </figure>}
    {image && <button type="button" className="secondary-control" disabled={busy} onClick={onRemove}>Убрать изображение</button>}
  </div>;
}

/* ---------------------------------------------------------------- preview of the card, sections 01-05 */

/**
 * The formatting of every card field, each fragment passed through the model's style filter (colour and background as hex only, size and
 * weight from a short list). The shared card draws these documents exactly as the archive draws the stored ones.
 */
function cardFormattedText(dossier: TemplateDossier): PortiaContent["formattedText"] {
  const { virus } = dossier;
  const formattedText: PortiaContent["formattedText"] = {};
  const put = (key: string, text: string) => { formattedText[key] = { runs: templateFieldRuns(dossier, key, text) }; };
  put(portiaTextKey.virus(templateVirusId, "external"), virus.external);
  put(portiaTextKey.virus(templateVirusId, "ppu-health"), virus.ppu.health);
  put(portiaTextKey.virus(templateVirusId, "ppu-speed"), virus.ppu.speed);
  put(portiaTextKey.virus(templateVirusId, "ppu-abilities"), virus.ppu.abilities);
  put(portiaTextKey.virus(templateVirusId, "physiology"), virus.physiology);
  virus.mutations.forEach((mutation, index) => put(portiaTextKey.mutation(templateVirusId, index), mutation.description));
  return formattedText;
}

/** One picture place of the card, in the archive's markup (figure.subject-media with its caption) but from a local slot only. */
function templateMedia(images: TemplateDossier["images"], slot: VirusCardSlot): ReactNode {
  const image = slot.kind === "infected" ? images.infected : images.mutations[slot.index] ?? null;
  if (!isLocalTemplateImage(image)) {
    // The archive's empty place without its logo: the logo is loaded from the site and a template stays self-contained.
    return <figure className="subject-media media-empty"><div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>{slot.label}</small></div></figure>;
  }
  const alt = slot.kind === "infected" ? photoCaption : slot.alt.trim() === "" ? mutationCaption : slot.alt;
  return <figure className="subject-media">
    <span className="portia-image is-loaded">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image cannot optimise it */}
      <img src={image.dataUrl} alt={alt} width={image.width} height={image.height} />
    </span>
    <figcaption>{slot.label}</figcaption>
  </figure>;
}

/** The template as the archive's own card (D-55): the same VirusCardBody as the public dossier, fed by the model's draft only. */
function TemplatePreview({ dossier }: { dossier: TemplateDossier }) {
  const code = dossier.virus.code.trim();
  return <article className="record-view template-card-preview" aria-label="Предпросмотр шаблона">
    <VirusCardBody
      virus={dossier.virus}
      formattedText={cardFormattedText(dossier)}
      media={(slot) => templateMedia(dossier.images, slot)}
      embedMedia={false}
      emptyText={emptyTemplateText}
      footer={["PORTIA / SCIENCE REPORTS", code === "" ? "ШАБЛОН" : `ШАБЛОН ${code}`]}
    />
  </article>;
}

/**
 * Participant-only "Создать шаблон" builder (D-52, D-23, D-24). The form is the site editor's virus card made of the editor's own
 * shared components (tabs, groups, fields, formatted text and the format panel) without the scientist records. The draft is a
 * TemplateDossier kept in React state; every edit goes through the model's functions, so nothing here can reach the site, the
 * archive, an upload or browser storage. The finished work leaves only as a downloaded HTML or PNG file.
 */
export function PortiaTemplateBuilder({ onClose }: { onClose: () => void }) {
  const [dossier, setDossier] = useState<TemplateDossier>(() => emptyTemplateDossier());
  const [dossierTab, setDossierTab] = useState<DossierTab>("main");
  const [view, setView] = useState<BuilderView>("fields");
  const [formatTarget, setFormatTarget] = useState<FormatTarget | null>(null);
  const [formatterOpen, setFormatterOpen] = useState(false);
  const [previewSurface, setPreviewSurface] = useState<EditorPreviewSurface | null>(null);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [lastFormat, setLastFormat] = useState<ExportFormat>("html");
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const exportingRef = useRef(false);
  const readingRef = useRef(false);
  const [reading, setReading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const idPrefix = useId();

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (confirmClose) stayRef.current?.focus(); }, [confirmClose]);

  const virus = dossier.virus;
  const hasContent = hasTemplateDossierContent(dossier);
  const dirty = hasContent && templateDossierSnapshotKey(dossier) !== exportedKey;
  // Nothing may be downloaded, replaced, removed or left while a file is being read or built.
  const busy = phase === "preparing" || reading;

  // A new edit makes a previous "done" or "error" status stale, but never clears the typed text.
  const change = (updater: (current: TemplateDossier) => TemplateDossier) => {
    setDossier(updater);
    setPhase((current) => (current === "preparing" ? current : "idle"));
  };
  const updateVirus = (update: (next: Virus) => void) => change((current) => editTemplateVirus(current, update));
  const changeText = (key: string, value: string, document: RichTextDocument, apply: (next: TemplateDossier, text: string) => void) =>
    change((current) => editTemplateText(current, key, value, document, apply));

  const activateFormatter = (target: FormatTarget) => setFormatTarget((previous) => joinFormatTarget(previous, target));
  const closeFormatter = () => { setFormatTarget(null); setFormatterOpen(false); };
  // The format panel keeps a target in the tab being hidden; leaving it open could write old text back.
  const selectDossierTab = (id: DossierTab) => {
    if (id === "logs") return;
    setDossierTab(id);
    closeFormatter();
  };
  // The form stays mounted while the card is shown (the draft, the open tab and the typed text are kept); the format panel closes as on a tab change.
  const selectView = (next: BuilderView) => {
    if (next === view) return;
    closeFormatter();
    setView(next);
    requestAnimationFrame(() => toolbarRef.current?.scrollIntoView({ block: "nearest" }));
  };
  const removeMutation = (index: number) => {
    if (busy) return;
    // A delete shifts the later mutations' index keys, so it closes the format panel; the slot errors are tied to those indexes and go with it.
    closeFormatter();
    setImageErrors({});
    change((current) => removeTemplateMutation(current, index));
  };

  const chooseImage = async (slot: ImageSlot, file: File | undefined) => {
    if (!file || exportingRef.current || readingRef.current) return;
    const key = slotKey(slot);
    readingRef.current = true;
    setReading(true);
    setImageErrors((current) => ({ ...current, [key]: false }));
    try {
      const decoded = await decodeLocalTemplateImage(file);
      change((current) => setTemplateImage(current, slot, decoded));
    } catch {
      // The text and a previously accepted picture stay exactly as they were.
      setImageErrors((current) => ({ ...current, [key]: true }));
    } finally {
      readingRef.current = false;
      setReading(false);
    }
  };

  const removeImage = (slot: ImageSlot) => {
    if (busy) return;
    setImageErrors((current) => ({ ...current, [slotKey(slot)]: false }));
    change((current) => setTemplateImage(current, slot, null));
  };

  const runExport = async (format: ExportFormat) => {
    if (exportingRef.current || readingRef.current || !hasContent) return;
    exportingRef.current = true;
    // The file is built from this snapshot, so edits made while it is being prepared never mix versions.
    const snapshot = dossier;
    const snapshotKey = templateDossierSnapshotKey(snapshot);
    setLastFormat(format);
    setPhase("preparing");
    setConfirmClose(false);
    const minimumShown = new Promise<void>((resolve) => window.setTimeout(resolve, preparingMinimumMs));
    try {
      const content = await (format === "png"
        ? createTemplateDossierPng(snapshot)
        : Promise.resolve().then(() => createTemplateDossierHtml(snapshot)));
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
    if (dirty) {
      closeFormatter();
      setConfirmClose(true);
    } else onClose();
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
          <span className="promotion-eyebrow">{"ПОВЫШЕНИЕ // ЗАДАНИЕ"}</span>
          <h1 ref={headingRef} tabIndex={-1}>Шаблон досье</h1>
        </div>
        <button ref={backRef} type="button" className="promotion-action template-back" onClick={requestClose} disabled={busy}>Вернуться к повышению</button>
      </header>
      <p className="template-note">Работа скачивается на ваше устройство. Отправьте файл проверяющему вне сайта. Текст и изображения хранятся только в этом сеансе и не отправляются на сервер; сайт и архив шаблон не меняет.</p>

      {confirmClose && <section ref={confirmRef} onKeyDown={trapConfirmTab} className="template-confirm" role="alertdialog" aria-modal="true" aria-labelledby={`${idPrefix}-confirm-title`} aria-describedby={`${idPrefix}-confirm-text`}>
        <strong id={`${idPrefix}-confirm-title`}>Черновик ещё не скачан</strong>
        <p id={`${idPrefix}-confirm-text`}>Текст и изображения хранятся только в этом сеансе. Если вернуться сейчас, набранное будет потеряно. Данные на сервер не отправляются.</p>
        <div className="template-confirm-actions">
          <button ref={stayRef} type="button" className="promotion-action" onClick={dismissConfirm}>Остаться и скачать</button>
          <button type="button" className="promotion-action template-discard" onClick={onClose}>Вернуться без скачивания</button>
        </div>
      </section>}

      <ActiveFormatContext.Provider value={{ key: formatTarget?.key ?? null, surface: previewSurface, phonePanelOpen: formatterOpen && window.matchMedia("(max-width: 900px)").matches }}>
      <div className="template-grid" inert={confirmClose || undefined}>
        <div ref={toolbarRef} className="template-toolbar">
          <div className="template-view" role="group" aria-labelledby={`${idPrefix}-view`}>
            <span id={`${idPrefix}-view`}>Вид</span>
            <button type="button" aria-pressed={view === "fields"} onClick={() => selectView("fields")}>Поля</button>
            <button type="button" aria-pressed={view === "preview"} onClick={() => selectView("preview")}>Предпросмотр</button>
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
        </div>
        <div className="template-form" aria-label="Поля шаблона" role="group" hidden={view !== "fields"}>
          <FormatLaunchButton target={formatTarget} open={formatterOpen} onToggle={() => setFormatterOpen((current) => !current)} />

          <div className="editor-form virus-editor-form">
            <DossierTabs active={dossierTab} changed={[]} onSelect={selectDossierTab} tabs={["main", "text", "mutations"]} />
            {dossierTab === "main" && <EditorGroup title="Основные данные">
              <Field label="Название"><input value={virus.name} maxLength={120} autoComplete="off" onChange={(event) => updateVirus((next) => { next.name = event.target.value; })} /></Field>
              <Field label="Код"><input value={virus.code} maxLength={40} autoComplete="off" onChange={(event) => updateVirus((next) => { next.code = event.target.value; })} /></Field>
              <Field label="Статус"><input value={virus.status} maxLength={80} autoComplete="off" onChange={(event) => updateVirus((next) => { next.status = event.target.value; })} /></Field>
              <TemplateImageField label="Фото после заражения" placement="dossier" image={dossier.images.infected} error={imageErrors.infected === true} busy={busy} onFile={(file) => { void chooseImage("infected", file); }} onRemove={() => removeImage("infected")} />
            </EditorGroup>}

            {dossierTab === "text" && <EditorGroup title="Описание">
              <FormattedTextarea area="lead" label="Внешние характеристики" value={virus.external} document={dossier.formattedText[portiaTextKey.virus(templateVirusId, "external")]} formatKey={portiaTextKey.virus(templateVirusId, "external")} hint={textHint} onActivate={activateFormatter} onChange={(value, document) => changeText(portiaTextKey.virus(templateVirusId, "external"), value, document, (next, text) => { next.virus.external = text; })} />
              <FormattedTextarea area="lead" label="Физиологические характеристики" value={virus.physiology} document={dossier.formattedText[portiaTextKey.virus(templateVirusId, "physiology")]} formatKey={portiaTextKey.virus(templateVirusId, "physiology")} hint={textHint} onActivate={activateFormatter} onChange={(value, document) => changeText(portiaTextKey.virus(templateVirusId, "physiology"), value, document, (next, text) => { next.virus.physiology = text; })} />
            </EditorGroup>}

            {dossierTab === "text" && <EditorGroup title="Характеристики PPU">
              {(["health", "speed", "abilities"] as const).map((key) => (
                <FormattedTextarea area="metric" key={key} label={{ health: "Здоровье", speed: "Скорость", abilities: "Способности" }[key]} value={virus.ppu[key]} document={dossier.formattedText[portiaTextKey.virus(templateVirusId, `ppu-${key}`)]} formatKey={portiaTextKey.virus(templateVirusId, `ppu-${key}`)} hint={textHint} onActivate={activateFormatter} onChange={(value, document) => changeText(portiaTextKey.virus(templateVirusId, `ppu-${key}`), value, document, (next, text) => { next.virus.ppu[key] = text; })} />
              ))}
            </EditorGroup>}

            {dossierTab === "main" && <EditorGroup title="Классификация">
              {([
                ["danger", "Общий уровень опасности"], ["spread", "Распространение"], ["transmission", "Способ распространения"],
                ["escapeRisk", "Угроза и риск побега"], ["mind", "Разум"], ["appearance", "Вид / внешность"], ["behavior", "Поведение"],
              ] as [keyof Virus["classification"], string][]).map(([key, label]) => (
                <ClassificationField key={key} label={label} classificationKey={key} value={virus.classification[key]} onChange={(value) => updateVirus((next) => { next.classification[key] = value; })} />
              ))}
            </EditorGroup>}

            {dossierTab === "mutations" && <EditorGroup title="Мутации" stack>
              {virus.mutations.map((mutation, index) => (
                <div className="nested-editor-card" key={index}>
                  <div className="nested-editor-head"><strong>МУТАЦИЯ {String(index + 1).padStart(2, "0")}</strong><button type="button" disabled={busy} onClick={() => removeMutation(index)}>Удалить</button></div>
                  <Field label="Название"><input value={mutation.name} maxLength={120} autoComplete="off" onChange={(event) => updateVirus((next) => { const item = next.mutations[index]; if (item) item.name = event.target.value; })} /></Field>
                  <FormattedTextarea area="mutation" label="Описание" value={mutation.description} document={dossier.formattedText[portiaTextKey.mutation(templateVirusId, index)]} formatKey={portiaTextKey.mutation(templateVirusId, index)} hint={textHint} onActivate={activateFormatter} onChange={(value, document) => changeText(portiaTextKey.mutation(templateVirusId, index), value, document, (next, text) => { const item = next.virus.mutations[index]; if (item) item.description = text; })} />
                  <TemplateImageField label="Изображение мутации" placement="mutation" image={dossier.images.mutations[index] ?? null} error={imageErrors[slotKey(index)] === true} busy={busy} onFile={(file) => { void chooseImage(index, file); }} onRemove={() => removeImage(index)} />
                </div>
              ))}
              <button className="secondary-control" type="button" onClick={() => change(addTemplateMutation)}>+ ДОБАВИТЬ МУТАЦИЮ</button>
            </EditorGroup>}
          </div>

        </div>
        {view === "preview" && <TemplatePreview dossier={dossier} />}
      </div>
      </ActiveFormatContext.Provider>
      {formatterOpen && formatTarget && createPortal(<FloatingTextFormatPanel key={formatTarget.key} target={formatTarget} previewSurface={previewSurface} onPreviewSurface={setPreviewSurface} onUpdate={setFormatTarget} onBatch={(_id, run) => run()} onClose={() => setFormatterOpen(false)} positionStorageKey={null} />, document.getElementById("desktop") ?? document.body)}
    </div>
  </div>;
}
