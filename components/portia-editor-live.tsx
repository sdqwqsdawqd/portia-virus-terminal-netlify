"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { GuideApp } from "@/components/portia-desktop-documents";
import { InfoArticle } from "@/components/portia-desktop-info";
import { ConfirmDialog, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";
import { FormattedTextarea, findFormatField, type FormatTarget } from "@/components/portia-editor-rich-text";
import { LiveEditContext, type LiveEditApi } from "@/components/portia-live-edit";
import { EmbeddedMediaStrip, FormattedText } from "@/components/portia-virus-card";
import type { BroadcastTab } from "@/lib/broadcasts";
import type { ImageFraming } from "@/lib/image-framing";
import {
  applyLiveAdd, applyLiveCards, applyLiveFraming, applyLiveImage, applyLiveMove, applyLiveRemove, applyLiveText, liveAddKinds, liveAppForTab, liveContainerFull, liveRemovedKeys, liveTextKey,
  type LiveAddKind, type LiveApp, type LiveCardsTarget, type LiveContainer, type LiveImageTarget, type LiveList, type LiveRemovable, type LiveTarget,
} from "@/lib/live-edit";
import { parseYoutubeId } from "@/lib/portia-content-normalize";
import { findGuide, findInfo, type PortiaContent, type RichTextDocument } from "@/lib/portia-content";

// LIVE-01..05 (26.1-10): the seam of the live editing mode. The editor shows the visitor's own app on the draft; here lives everything that edits it.
// The visitor's components ask components/portia-live-edit.tsx for these tools; they exist only inside the provider that LiveSurface sets.
// The seam keeps no content of its own: every change of the draft goes through the bridge the editor hands over (changeDraft, changeFormattedText),
// so «Сохранить», «Отменить» and the undo steps are the editor's own, and switching the mode off or on loses nothing (LIVE-03).
// All Russian texts of the mode are in liveCopy (D-58), each short (D-56).

export const liveCopy = {
  toggle: "ЖИВОЙ РЕЖИМ",
  untitled: "Без названия",
  addLabel: "Добавить:",
  addGroup: "Добавить элемент",
  kinds: { section: "Раздел", card: "Карточку", heading: "Заголовок", text: "Текст", table: "Таблицу", photo: "Фото", video: "Видео", callout: "Врезку", cards: "Карточки", row: "Строку" } satisfies Record<LiveAddKind, string>,
  cover: "Обложку",
  coverLabel: "Обложка",
  full: "Больше нельзя",
  targets: {
    "guide-section-title": "Название раздела",
    "guide-card-title": "Название карточки",
    "guide-heading": "Заголовок",
    "guide-callout-label": "Подпись врезки",
    "guide-photo-caption": "Подпись фото",
    "guide-table-key": "Название строки",
    "guide-table-value": "Значение строки",
    "guide-video-url": "Ссылка на видео",
    "guide-block-text": "Текст",
    "info-section-title": "Название раздела",
    "info-section-body": "Текст раздела",
  } satisfies Record<LiveTarget["kind"], string>,
  placeholders: {
    "guide-section-title": "Название раздела",
    "guide-card-title": "Название карточки",
    "guide-heading": "Заголовок",
    "guide-callout-label": "Подпись",
    "guide-photo-caption": "Подпись к фото",
    "guide-table-key": "Название",
    "guide-table-value": "Значение",
    "guide-video-url": "Ссылка на видео",
    "guide-block-text": "Нажмите, чтобы написать",
    "info-section-title": "Название раздела",
    "info-section-body": "Нажмите, чтобы написать",
  } satisfies Record<LiveTarget["kind"], string>,
  infoIndex: "Разделы информации",
  infoSubsections: (count: number) => `Подразделов: ${count}`,
  infoEmpty: "Разделов пока нет",
  richEmpty: "Нажмите, чтобы написать",
  lists: { "guide-sections": "раздел", "guide-cards": "карточка", "guide-blocks": "блок" } satisfies Record<LiveList["kind"], string>,
  removeLabel: "Удалить",
  removeTitle: "Удалить?",
  removeText: (label: string) => `Удалить вместе с содержимым: ${label}.`,
  removeConfirm: "УДАЛИТЬ",
  removeCancel: "ОТМЕНА",
  removeNames: { "guide-section": "раздел", "guide-card": "карточку", "guide-block": "блок", "guide-table-row": "строку" } satisfies Record<LiveRemovable["kind"], string>,
  imageAdd: "Добавить фото",
  sectionPhoto: "Фото раздела",
  imageReplace: "Заменить",
  imageRemove: "Убрать фото",
  imageHint: "Видимая часть настраивается ниже",
  done: "Готово",
  videoLabel: "Ссылка на YouTube",
  videoPlaceholder: "https://www.youtube.com/watch?v=…",
  videoOk: "Видео распознано",
  videoNeed: "Нужна ссылка на YouTube",
  cardsPick: "Выбрать карточки",
  cardsGroup: "Карточки блока",
  cardsFull: "Выбрано 24",
} as const;

/** Everything the editor hands the live mode: the draft and the ways to change it, the format panel, the upload, and the choices the tabs keep. */
export type LiveEditorBridge = {
  draft: PortiaContent;
  changeDraft: (updater: (next: PortiaContent) => void) => void;
  changeFormattedText: (key: string, value: string, document: RichTextDocument, write: (next: PortiaContent, value: string) => void) => void;
  activateFormatter: (target: FormatTarget) => void;
  closeFormatterFor: (...keys: string[]) => void;
  uploadImage: (file: File, onUploaded: (url: string) => void) => Promise<void>;
  uploadState: "idle" | "uploading" | "error";
  uploadMessage: string;
  guideSection: string;
  setGuideSection: (id: string) => void;
  infoSection: string;
  setInfoSection: (id: string) => void;
  virusId: string;
  setVirusId: (id: string) => void;
  recycledVirusId: string;
  setRecycledVirusId: (id: string) => void;
  recycleFileId: string;
  setRecycleFileId: (id: string) => void;
  broadcastTab: BroadcastTab;
  setBroadcastTab: (tab: BroadcastTab) => void;
};

/** LIVE-01: the live mode of the open tab. `toggle` is the button for the action bar, null on a tab without a live mode. */
export function useLiveMode(tab: string, onSwitch?: () => void): { on: boolean; toggle: ReactNode } {
  const [enabled, setEnabled] = useState<string[]>([]);
  const app = liveAppForTab(tab);
  const on = app !== null && enabled.includes(tab);
  const toggle = app === null ? null : <LiveModeToggle on={on} onToggle={() => {
    onSwitch?.();
    setEnabled((current) => (current.includes(tab) ? current.filter((id) => id !== tab) : [...current, tab]));
  }} />;
  return { on, toggle };
}

export function LiveModeToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button type="button" className="secondary-control live-toggle" aria-pressed={on} onClick={onToggle}>{liveCopy.toggle}</button>;
}

/** LIVE-02: the visitor's own view of the tab's app on the draft, inside the provider of the live tools. */
export function LiveSurface({ tab, bridge }: { tab: string; bridge: LiveEditorBridge }) {
  const app = liveAppForTab(tab);
  if (app === "guide") return <GuideSurface bridge={bridge} />;
  if (app === "info") return <InfoSurface bridge={bridge} />;
  return null;
}

function GuideSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const [openCardId, setOpenCardId] = useState("");
  return <div className="live-surface" data-live-app="guide">
    <LiveEditContext.Provider value={createLiveApi("guide", bridge)}>
      <GuideApp sections={bridge.draft.guideSections} formattedText={bridge.draft.formattedText} openCardId={openCardId} onOpenCard={setOpenCardId} />
    </LiveEditContext.Provider>
  </div>;
}

const noNext = () => undefined;
const indexNumber = (index: number) => String(index + 1).padStart(2, "0");

/** «Информация» as the visitor sees it: the table of contents on the left, the article on the right (InfoArticle, the visitor's own component, inside the provider). */
function InfoSurface({ bridge }: { bridge: LiveEditorBridge }) {
  const [picked, setPicked] = useState(bridge.infoSection);
  const sections = bridge.draft.infoSections;
  // What is shown: the picked article, else the section the editor has open, else the first section; a vanished id (a removed section) falls through.
  const entry = findInfo(sections, picked) ?? findInfo(sections, bridge.infoSection) ?? (sections[0] ? { section: sections[0], subsection: null } : null);
  const select = (id: string, sectionId: string) => { setPicked(id); bridge.setInfoSection(sectionId); };
  return <div className="live-surface" data-live-app="info">
    <LiveEditContext.Provider value={createLiveApi("info", bridge)}>
      <div className="info-library">
        <nav className="info-index" aria-label={liveCopy.infoIndex} id="info-sections-list">
          {sections.map((section, index) => {
            const open = section.id === entry?.section.id;
            const count = section.subsections.length;
            return <div key={section.id}>
              <button type="button" className={`${open && !entry?.subsection ? "active" : ""}${count ? " has-subsections" : ""}`} data-info-id={section.id} aria-expanded={count ? open : undefined} onClick={() => select(section.id, section.id)}>
                <small>{indexNumber(index)}</small><span>{section.title || liveCopy.untitled}</span>{count ? <em className="info-sub-marker" aria-label={liveCopy.infoSubsections(count)}>{open ? "▾" : "▸"} {count}</em> : null}
              </button>
              {open && count ? <div className="info-subsections">{section.subsections.map((sub, subIndex) => <button key={sub.id} type="button" className={sub.id === entry?.subsection?.id ? "active" : ""} data-info-id={sub.id} title={sub.title || liveCopy.untitled} onClick={() => select(sub.id, section.id)}>
                <small>{indexNumber(index)}.{subIndex + 1}</small><span>{sub.title || liveCopy.untitled}</span>
              </button>)}</div> : null}
            </div>;
          })}
        </nav>
        <article className="info-document">
          {entry ? <InfoArticle key={entry.subsection?.id ?? entry.section.id} section={entry.section} subsection={entry.subsection} formattedText={bridge.draft.formattedText} phone={false} next={null} onNext={noNext} /> : <p className="guide-section-empty">{liveCopy.infoEmpty}</p>}
        </article>
      </div>
    </LiveEditContext.Provider>
  </div>;
}

/** The tools of the live mode of `app`, over the editor's bridge. */
export function createLiveApi(app: LiveApp, bridge: LiveEditorBridge): LiveEditApi {
  return {
    app,
    text: (target, value, options) => <LiveText bridge={bridge} target={target} value={value} className={options?.className} />,
    rich: (target, props) => <LiveRich bridge={bridge} target={target} text={props.text} document={props.document} className={props.className} />,
    image: (target, props) => <LiveImage bridge={bridge} target={target} value={props.value} framing={props.framing}>{props.children}</LiveImage>,
    video: (target, videoId) => <LiveVideo bridge={bridge} target={target} videoId={videoId} />,
    cards: (target, cardIds) => <LiveCardsPicker bridge={bridge} target={target} cardIds={cardIds} />,
    addBar: (container) => <LiveAddBar bridge={bridge} container={container} />,
    order: (list, index, title) => ({
      rowProps: { "data-sort-index": index },
      handle: <OrderDragHandle index={index} label={title || liveCopy.lists[list.kind]} onMove={(from, to) => bridge.changeDraft((next) => { applyLiveMove(next, list, from, to); })} />,
    }),
    remove: (item, title) => <LiveRemove bridge={bridge} item={item} title={title} />,
  };
}

// T-26.1-22: only textContent is read, a paste is plain text, and what reaches the draft is a string, never markup. The server normalises it again.
function insertPlainText(text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = window.document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// A browser without "plaintext-only" (older Firefox) gets plain contentEditable; only textContent is read and a paste is plain either way.
let plaintextOnly: boolean | null = null;
function editableMode(): "plaintext-only" | "true" {
  if (plaintextOnly === null) {
    const probe = window.document.createElement("span");
    probe.contentEditable = "plaintext-only";
    plaintextOnly = probe.contentEditable === "plaintext-only";
  }
  return plaintextOnly ? "plaintext-only" : "true";
}

/** A plain text in place: the visitor's own element (its class), made editable. Enter does not break the line. */
export function LiveText({ bridge, target, value, className }: { bridge: LiveEditorBridge; target: LiveTarget; value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // The element holds its own text while it is typed in; the draft's value is written back only when it differs (an undo, a cut to the limit).
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || element.textContent === value) return;
    element.textContent = value;
    if (window.document.activeElement === element) {
      const range = window.document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  });
  const commit = (raw: string) => bridge.changeDraft((next) => { applyLiveText(next, target, raw.replace(/[\r\n]+/g, " ")); });
  return <span
    ref={ref}
    className={`live-editable${className ? ` ${className}` : ""}`}
    contentEditable={editableMode()}
    suppressContentEditableWarning
    role="textbox"
    aria-label={liveCopy.targets[target.kind]}
    data-placeholder={liveCopy.placeholders[target.kind]}
    spellCheck
    onInput={(event) => commit(event.currentTarget.textContent ?? "")}
    onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
    onPaste={(event) => {
      event.preventDefault();
      insertPlainText(event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " "));
      commit(event.currentTarget.textContent ?? "");
    }}
  />;
}

/**
 * LIVE-05: a formatted text at rest is the visitor's own FormattedText (its GIFs play); pressed, it is the editor's field with the format panel,
 * and under the field the strip of the same GIFs, so a GIF keeps playing while its link is typed. Leaving the field goes back to rest.
 */
export function LiveRich({ bridge, target, text, document, className }: { bridge: LiveEditorBridge; target: LiveTarget; text: string; document?: RichTextDocument; className?: string }) {
  const [editing, setEditing] = useState(false);
  const key = liveTextKey(target);
  useEffect(() => { if (editing) findFormatField(key)?.focus(); }, [editing, key]);
  if (!editing) {
    return <div
      className="live-rich live-editable"
      role="button"
      tabIndex={0}
      aria-label={liveCopy.targets[target.kind]}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditing(true); } }}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setEditing(true); }}
    ><FormattedText className={className} text={text} document={document} emptyText={liveCopy.richEmpty} /></div>;
  }
  return <div
    className="live-rich-edit"
    onBlur={(event) => {
      const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      // The format panel and the field's own parts keep the field open.
      if (next && (event.currentTarget.contains(next) || next.closest(".floating-text-format"))) return;
      setEditing(false);
    }}
  >
    <FormattedTextarea
      area="info"
      label={liveCopy.targets[target.kind]}
      tall
      value={text}
      document={document}
      formatKey={key}
      onActivate={bridge.activateFormatter}
      onChange={(value, nextDocument) => bridge.changeFormattedText(key, value, nextDocument, (next, written) => { applyLiveText(next, target, written); })}
    />
    <EmbeddedMediaStrip text={text} eager />
  </div>;
}

/** A small popover over a place: closes with Escape, with «Готово» and with a press outside. */
function LivePopover({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.parentElement?.contains(event.target)) onClose(); };
    window.document.addEventListener("pointerdown", outside);
    return () => window.document.removeEventListener("pointerdown", outside);
  }, [onClose]);
  return <div ref={ref} className="live-popover" role="group" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    {children}
    <button type="button" className="secondary-control live-popover-done" onClick={onClose}>{liveCopy.done}</button>
  </div>;
}

const frameBoxOf = { "guide-section-photo": "band", "guide-card-cover": "tile", "guide-photo-url": "free" } as const;

/** The picture place of the visitor's page (`children`, drawn by the visitor's own PortiaImage, GIFs play) and the way to change its address and visible part. */
export function LiveImage({ bridge, target, value, framing, children, label, fieldLabel, compact = false }: { bridge: LiveEditorBridge; target: LiveImageTarget; value: string; framing?: ImageFraming; children?: ReactNode; label?: string; fieldLabel?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const write = (url: string) => bridge.changeDraft((next) => { applyLiveImage(next, target, url); });
  const tools = <div className={`live-tools live-image-tools${compact ? " is-compact" : ""}`}>
    <button type="button" className="secondary-control live-button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{label ?? (target.kind === "guide-section-photo" ? liveCopy.sectionPhoto : value ? liveCopy.imageReplace : liveCopy.imageAdd)}</button>
    {open && <LivePopover onClose={() => setOpen(false)}>
      <ImageEditorField
        label={fieldLabel ?? (value ? liveCopy.imageReplace : liveCopy.imageAdd)}
        value={value}
        placement="guide"
        maxHint={liveCopy.imageHint}
        removeLabel={liveCopy.imageRemove}
        uploadState={bridge.uploadState}
        uploadMessage={bridge.uploadMessage}
        framing={framing}
        framingBox={frameBoxOf[target.kind]}
        onFramingChange={(frame) => bridge.changeDraft((next) => { applyLiveFraming(next, target, frame); })}
        onChange={write}
        onUpload={(file) => { void bridge.uploadImage(file, write); }}
      />
    </LivePopover>}
  </div>;
  if (children === undefined) return tools;
  return <div className="live-image">{children}{tools}</div>;
}

/** The YouTube link of a video block: what is typed stays visible while it is not a link yet. */
export function LiveVideo({ bridge, target, videoId }: { bridge: LiveEditorBridge; target: LiveTarget; videoId: string }) {
  const [typed, setTyped] = useState("");
  const shown = typed && parseYoutubeId(typed) === videoId ? typed : videoId ? `https://www.youtube.com/watch?v=${videoId}` : typed;
  return <label className="live-video live-tools">
    <span>{liveCopy.videoLabel}</span>
    <input value={shown} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={liveCopy.videoPlaceholder} onChange={(event) => {
      setTyped(event.target.value);
      bridge.changeDraft((next) => { applyLiveText(next, target, event.target.value); });
    }} />
    <small>{videoId ? liveCopy.videoOk : shown ? liveCopy.videoNeed : ""}</small>
  </label>;
}

/** The cards of a block «Карточки»: one list of every card by section, ticked in the chosen order. */
export function LiveCardsPicker({ bridge, target, cardIds }: { bridge: LiveEditorBridge; target: LiveCardsTarget; cardIds: string[] }) {
  const [open, setOpen] = useState(false);
  const set = (next: string[]) => bridge.changeDraft((draft) => { applyLiveCards(draft, target, next); });
  const full = cardIds.length >= 24;
  return <div className="live-tools live-cards-tools">
    <button type="button" className="secondary-control live-button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{liveCopy.cardsPick}</button>
    {open && <LivePopover onClose={() => setOpen(false)}>
      <fieldset className="live-cards-list">
        <legend>{liveCopy.cardsGroup}</legend>
        {bridge.draft.guideSections.map((section) => <div key={section.id} className="live-cards-group">
          <strong>{section.title || liveCopy.untitled}</strong>
          {section.cards.filter((card) => card.id !== target.cardId).map((card) => {
            const checked = cardIds.includes(card.id);
            return <label key={card.id}>
              <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => set(checked ? cardIds.filter((id) => id !== card.id) : [...cardIds, card.id])} />
              <span>{card.title || liveCopy.untitled}</span>
            </label>;
          })}
        </div>)}
        {full && <small>{liveCopy.cardsFull}</small>}
      </fieldset>
    </LivePopover>}
  </div>;
}

/** The compact bar «Добавить: …» of a place; a card page also holds the way to its cover. */
export function LiveAddBar({ bridge, container }: { bridge: LiveEditorBridge; container: LiveContainer }) {
  const full = liveContainerFull(bridge.draft, container);
  const card = container.kind === "guide-card" ? findGuide(bridge.draft.guideSections, container.cardId)?.card : null;
  return <div className="live-add-bar live-tools" role="toolbar" aria-label={liveCopy.addGroup}>
    <span className="live-add-label">{liveCopy.addLabel}</span>
    {liveAddKinds(container).map((kind) => <button key={kind} type="button" className="secondary-control live-button" disabled={full} title={full ? liveCopy.full : undefined} onClick={() => { if (!full) bridge.changeDraft((next) => { applyLiveAdd(next, container, kind); }); }}>{liveCopy.kinds[kind]}</button>)}
    {container.kind === "guide-card" && card && <LiveImage bridge={bridge} target={{ kind: "guide-card-cover", cardId: card.id }} value={card.cover} framing={card.coverFraming} label={liveCopy.cover} fieldLabel={liveCopy.coverLabel} compact />}
  </div>;
}

/** The small remove button; the question comes first, and the formatting panel lets go of what is removed. */
export function LiveRemove({ bridge, item, title }: { bridge: LiveEditorBridge; item: LiveRemovable; title: string }) {
  const [asked, setAsked] = useState(false);
  const name = title ? `${liveCopy.removeNames[item.kind]} «${title}»` : liveCopy.removeNames[item.kind];
  return <span className="live-tools live-remove-wrap">
    <button type="button" className="live-remove" aria-label={`${liveCopy.removeLabel}: ${name}`} onClick={() => setAsked(true)}><span aria-hidden="true">×</span></button>
    {asked && <ConfirmDialog
      title={liveCopy.removeTitle}
      text={liveCopy.removeText(name)}
      onCancel={() => setAsked(false)}
      actions={[
        { label: liveCopy.removeConfirm, tone: "danger", onClick: () => {
          bridge.closeFormatterFor(...liveRemovedKeys(bridge.draft, item));
          bridge.changeDraft((next) => { applyLiveRemove(next, item); });
          setAsked(false);
        } },
        { label: liveCopy.removeCancel, tone: "secondary", autoFocus: true, onClick: () => setAsked(false) },
      ]}
    />}
  </span>;
}
