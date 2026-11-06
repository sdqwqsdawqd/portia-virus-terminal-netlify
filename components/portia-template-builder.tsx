"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClassificationField, DossierTabs, EditorGroup, Field } from "@/components/portia-editor-dossier";
import {
  ActiveFormatContext,
  FloatingTextFormatPanel,
  FormattedTextarea,
  findFormatField,
  joinFormatTarget,
  type EditorPreviewSurface,
  type FormatTarget,
} from "@/components/portia-editor-rich-text";
import type { DossierTab } from "@/lib/editor-changes";
import { portiaTextKey, type RichTextDocument, type Virus } from "@/lib/portia-content";
import {
  addTemplateMutation,
  editTemplateText,
  editTemplateVirus,
  emptyTemplateDossier,
  hasTemplateDossierContent,
  removeTemplateMutation,
  templateDossierSnapshotKey,
  templateVirusId,
  type TemplateDossier,
} from "@/lib/portia-template-dossier";
import {
  createTemplateDossierHtml,
  createTemplateDossierPng,
  downloadTemplateBlob,
  isTemplatePngTooLargeError,
  templateExportError,
  templateFileName,
  templatePngFileName,
  templatePngTooLargeError,
} from "@/lib/portia-template-export";

type ExportPhase = "idle" | "preparing" | "error" | "too-large" | "done";
type ExportFormat = "png" | "html";

// The status line must be on screen for a moment even though building the file is instant.
const preparingMinimumMs = 400;

// The editor says "Текст и GIF можно использовать вместе"; a template is self-contained, so pictures are added as files only (D-24).
const textHint = "Картинки по ссылке в тексте шаблона не загружаются: добавьте изображение файлом.";

/**
 * Participant-only "Создать шаблон" builder (D-52, D-23, D-24). The form is the site editor's virus card made of the editor's own
 * shared components (tabs, groups, fields, formatted text and the format panel) without the scientist records. The draft is a
 * TemplateDossier kept in React state; every edit goes through the model's functions, so nothing here can reach the site, the
 * archive, an upload or browser storage. The finished work leaves only as a downloaded HTML or PNG file.
 */
export function PortiaTemplateBuilder({ onClose }: { onClose: () => void }) {
  const [dossier, setDossier] = useState<TemplateDossier>(() => emptyTemplateDossier());
  const [dossierTab, setDossierTab] = useState<DossierTab>("main");
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
  const exportingRef = useRef(false);
  const idPrefix = useId();

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (confirmClose) stayRef.current?.focus(); }, [confirmClose]);

  const virus = dossier.virus;
  const hasContent = hasTemplateDossierContent(dossier);
  const dirty = hasContent && templateDossierSnapshotKey(dossier) !== exportedKey;
  const busy = phase === "preparing";

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
  const removeMutation = (index: number) => {
    // A delete shifts the later mutations' index keys, so it closes the format panel.
    closeFormatter();
    change((current) => removeTemplateMutation(current, index));
  };

  const runExport = async (format: ExportFormat) => {
    if (exportingRef.current || !hasContent) return;
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
        <div className="template-form" aria-label="Поля шаблона" role="group">
          <div className="global-format-launch">
            <button
              type="button"
              disabled={!formatTarget}
              aria-label={formatTarget ? `Оформление текста: ${formatTarget.title}` : "Сначала выберите текстовое поле"}
              aria-expanded={formatterOpen}
              title={formatTarget ? `Оформление: ${formatTarget.title}` : "Сначала выберите текстовое поле"}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                // Phone: the field loses focus once per opening so the keyboard leaves.
                if (!formatterOpen && formatTarget && window.matchMedia("(max-width: 900px)").matches) findFormatField(formatTarget.key)?.blur();
                setFormatterOpen((current) => !current);
              }}
            >
              <span aria-hidden="true">✎</span>
              <strong>{formatTarget ? "ОФОРМЛЕНИЕ" : "ВЫБЕРИТЕ ТЕКСТ"}</strong>
              {formatTarget && <em>{formatTarget.title}</em>}
            </button>
            <small>{formatTarget ? "Выделите текст в активном поле или поставьте курсор в слово, чтобы оформить его." : "Одна кнопка форматирования работает со всеми большими текстовыми полями."}</small>
          </div>

          <div className="editor-form virus-editor-form">
            <DossierTabs active={dossierTab} changed={[]} onSelect={selectDossierTab} tabs={["main", "text", "mutations"]} />
            {dossierTab === "main" && <EditorGroup title="Основные данные">
              <Field label="Название"><input value={virus.name} maxLength={120} autoComplete="off" onChange={(event) => updateVirus((next) => { next.name = event.target.value; })} /></Field>
              <Field label="Код"><input value={virus.code} maxLength={40} autoComplete="off" onChange={(event) => updateVirus((next) => { next.code = event.target.value; })} /></Field>
              <Field label="Статус"><input value={virus.status} maxLength={80} autoComplete="off" onChange={(event) => updateVirus((next) => { next.status = event.target.value; })} /></Field>
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
                </div>
              ))}
              <button className="secondary-control" type="button" onClick={() => change(addTemplateMutation)}>+ ДОБАВИТЬ МУТАЦИЮ</button>
            </EditorGroup>}
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
      </div>
      </ActiveFormatContext.Provider>
      {formatterOpen && formatTarget && createPortal(<FloatingTextFormatPanel key={formatTarget.key} target={formatTarget} previewSurface={previewSurface} onPreviewSurface={setPreviewSurface} onUpdate={setFormatTarget} onBatch={(_id, run) => run()} onClose={() => setFormatterOpen(false)} positionStorageKey={null} />, document.getElementById("desktop") ?? document.body)}
    </div>
  </div>;
}
