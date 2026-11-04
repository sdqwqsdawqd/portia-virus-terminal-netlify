"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { changedDossierTabs, changedSections, deniedSections, editorSections, revertSections, sectionLabels, type DossierTab, type EditorSection } from "@/lib/editor-changes";
import { draftEdits, employeeRequestFailure, partialSave, rebaseDecision, SaveConflictError, SectionClosedError, saveStatusText, type DraftEdit, type SaveStatus } from "@/lib/editor-save-status";
import { closedMessage, closedSectionsOf, openTabIds, tabRegistry, type TabDef } from "@/lib/editor-tabs";
import { shortcutOf } from "@/lib/editor-shortcuts";
import { columnMajor } from "@/lib/editor-columns";
import { MAX_NOTE_LENGTH, NOTES_TABS, changedNotesTabs, normalizeNotesMap, pruneNotes, rebaseNotes, type NotesByTab, type NotesMap, type NotesTab } from "@/lib/editor-notes";
import { uploadRefusal } from "@/lib/image-upload";
import { dropFields, mergeFragments, removeFragmentAt } from "@/lib/format-fragments";
import { historyReducer, initHistory, type EditorHistory, type HistoryAction } from "@/lib/editor-history";
import { broadcastTabOf, categoryChange, questDateError, type BroadcastTab } from "@/lib/broadcasts";
import { addBroadcast, makeId, moveGuideCard, removeBroadcast, removeGuideBlock, removeGuideCard, removeGuideSection, removeInfoBlock, removeInfoSection, removeInfoSubsection, removeMutation, removeRecycleFile, removeRecycledVirus, updateById } from "@/lib/editor-items";
import {
  findGuide,
  findInfo,
  portiaTextKey,
  scientistLogPlainText,
  type Broadcast,
  type GuideBlock,
  type PortiaContent,
  type RecycleFile,
  type RichTextDocument,
  type RichTextStyle,
  type Virus,
} from "@/lib/portia-content";
import { parseYoutubeId } from "@/lib/portia-content-normalize";
import { MAX_BLOCKS, MAX_SCIENTIST_LOGS, MAX_SUBSECTIONS, MAX_TABLE_ROWS, bodyTooLargeMessage, contentBodyBytes, limitStatus, limitText, oversizeFields, oversizeMessage } from "@/lib/content-limits";
import { compactRuns, expandStyles } from "@/lib/rich-text-style";
import { acceptsEditorList, changedDetails, changedFields, employeeRatings, profileChanged, profileOf, settleDraft, type EmployeeProfile, type PortiaEmployee } from "@/lib/portia-employees";
import { ActiveFormatContext, FloatingTextFormatPanel, FormattedTextarea, findFormatField, replaceRichText, type EditorPreviewSurface, type FormatTarget } from "@/components/portia-editor-rich-text";
import { PromotionEditor } from "@/components/portia-promotion-editor";
import { AppDeniedPanel } from "@/components/portia-desktop-states";
import { accessCheckFailedText } from "@/lib/app-state";
import { ArchivedVirusEditor, ClassificationField, ConfirmDialog, DossierTabs, EditorGroup, Field, ImageEditorField, OrderDragHandle } from "@/components/portia-editor-dossier";

type EditorTab = "viruses" | "info" | "guide" | "broadcasts" | "recycle" | "search" | "assistant" | "employees" | "promo" | "access";

type Props = {
  content: PortiaContent;
  // The revision content was read or saved at.
  revision: number;
  saveState: "idle" | "saving" | "saved" | "error" | "conflict";
  canManageEditors: boolean;
  // Ids of the registry tabs the owner left open for this editor (GET /api/access); the owner gets all of them.
  openTabs: readonly string[];
  active: boolean;
  // STAB-APP-09: the rights check failed. The body shows «Доступ закрыт»; the draft stays in memory and nothing is saved until the check passes again (owner items 4 and 7).
  accessFailed: boolean;
  // True while the window manager has the editor window minimized; the format panel is hidden then and comes back on restore (D-06).
  minimized: boolean;
  onDirtyChange: (dirty: boolean) => void;
  // Bumped by the window manager each time × is pressed while the editor reports unsaved edits.
  closeRequest: number;
  onCloseApproved: () => void;
  // Resolves with the saved revision.
  onSave: (content: PortiaContent, baseRevision: number) => Promise<number>;
  onEmployeeSaved: (employee: PortiaEmployee) => void;
  onEmployeeRemoved: (id: string) => void;
  // The server's reason for the last refused save (D-12); empty when there is none.
  saveError: string;
};
const infoBlockHeads = {
  text: { label: "текст", title: "ТЕКСТ" },
  table: { label: "таблица", title: "ТАБЛИЦА: ПРИЗНАК — ЗНАЧЕНИЕ" },
  photo: { label: "фото", title: "ФОТО" },
  video: { label: "видео", title: "ВИДЕО YOUTUBE" },
} as const;

const guideBlockHeads = {
  heading: { label: "заголовок", title: "ЗАГОЛОВОК" },
  text: { label: "текст", title: "ТЕКСТ" },
  table: { label: "таблица", title: "ТАБЛИЦА" },
  photo: { label: "фото", title: "ФОТО" },
  video: { label: "видео", title: "ВИДЕО" },
  callout: { label: "врезка", title: "ВРЕЗКА" },
} as const;

const clone = (content: PortiaContent) => JSON.parse(JSON.stringify(content)) as PortiaContent;
const editorReducer = (state: EditorHistory<PortiaContent>, action: HistoryAction<PortiaContent>) => historyReducer(state, action, clone);
const initEditorHistory = (value: PortiaContent) => initHistory(value, clone);

const editKeys = new WeakMap<Element, number>();
let editKeyCounter = 0;

// Edits made while one text field (or the format panel) has focus share a key, so the reducer folds them into word-sized undo steps.
function editKeyFor(element: Element | null): string | null {
  // One drag is one undo step: the reducer folds every drag:<id> change into the first (D-11).
  const dragging = document.querySelector<HTMLElement>('.order-drag-handle[data-dragging="true"]');
  if (dragging) return `drag:${dragging.dataset.dragId}`;
  if (!element) return null;
  const isTextEntry = (element instanceof HTMLElement && element.isContentEditable)
    || element instanceof HTMLTextAreaElement
    || (element instanceof HTMLInputElement && !["checkbox", "radio", "file", "button", "submit", "reset"].includes(element.type));
  const keyed = element.closest(".floating-text-format") ?? (isTextEntry ? element : null);
  if (!keyed) return null;
  let id = editKeys.get(keyed);
  if (id === undefined) {
    id = ++editKeyCounter;
    editKeys.set(keyed, id);
  }
  return `field:${id}`;
}

function moveArrayItem<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
}

// Table rows are located by block id, then by their current index inside the same changeDraft call.
function editTableRows(content: PortiaContent, subsectionId: string, blockId: string, edit: (rows: { id: string; key: string; value: string }[]) => void) {
  const block = findInfo(content.infoSections, subsectionId)?.subsection?.blocks.find((item) => item.id === blockId);
  if (block?.type === "table") edit(block.rows);
}

// Guide blocks are found by card id and block id, so an upload that ends after a reorder or delete still writes the right block (T-13-09).
function findGuideBlock(content: PortiaContent, cardId: string, blockId: string) {
  return findGuide(content.guideSections, cardId)?.card?.blocks.find((item) => item.id === blockId);
}

const guideNo = (index: number) => String(index + 1).padStart(2, "0");
const firstLine = (value: string) => value.split("\n").map((line) => line.trim()).find(Boolean);
const guideBlockTitle = (block: GuideBlock) => (block.type === "heading" || block.type === "text" ? firstLine(block.text) : block.type === "callout" ? firstLine(block.label) ?? firstLine(block.text) : undefined);

function editGuideTableRows(content: PortiaContent, cardId: string, blockId: string, edit: (rows: { id: string; key: string; value: string }[]) => void) {
  const block = findGuideBlock(content, cardId, blockId);
  if (block?.type === "table") edit(block.rows);
}

function recycleKeys(content: PortiaContent) {
  const valid = new Set([
    ...content.recycleFiles.map((file) => `file:${file.id}`),
    ...(content.recycledViruses ?? []).map((virus) => `virus:${virus.id}`),
  ]);
  return [...new Set([
    ...(content.recycleOrder ?? []).filter((key) => valid.has(key)),
    ...content.recycleFiles.map((file) => `file:${file.id}`),
    ...(content.recycledViruses ?? []).map((virus) => `virus:${virus.id}`),
  ])];
}

function reorderRichTextLines(text: string, document: RichTextDocument | undefined, from: number, to: number) {
  const sourceStyles = (document?.runs ?? []).flatMap((run) => Array.from({ length: run.text.length }, () => run.style ?? {}));
  while (sourceStyles.length < text.length) sourceStyles.push({});
  const lines = text.split("\n");
  let offset = 0;
  const parts = lines.map((line) => {
    const part = { text: line, styles: sourceStyles.slice(offset, offset + line.length) };
    offset += line.length + 1;
    return part;
  });
  moveArrayItem(parts, from, to);
  const nextText = parts.map((part) => part.text).join("\n");
  const nextStyles = parts.flatMap((part, index) => index < parts.length - 1 ? [...part.styles, {}] : part.styles);
  return { text: nextText, document: compactRuns(nextText, nextStyles) };
}

// Two table columns swap, so a header ≡ is dropped on the other header (or moved with ArrowLeft/ArrowRight) instead of sorting live.
function ColumnSwapHandle({ label, onSwap }: { label: string; onSwap: () => void }) {
  const otherCell = (button: HTMLElement, x: number, y: number) => {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-column]") ?? null;
    return cell && cell !== button.closest("[data-column]") && cell.closest(".info-table-head") === button.closest(".info-table-head") ? cell : null;
  };
  const clear = (button: HTMLElement) => {
    delete button.dataset.dragging;
    button.closest(".info-table-head")?.querySelectorAll("[data-drop-target]").forEach((cell) => cell.removeAttribute("data-drop-target"));
  };
  return <button
    className="order-drag-handle column-swap-handle"
    type="button"
    aria-label={`Переставить столбец «${label}»`}
    aria-keyshortcuts="ArrowLeft ArrowRight"
    onPointerDown={(event) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      // "column", not "true": editKeyFor folds only row drags into one step, and a column swap is a single change on drop.
      event.currentTarget.dataset.dragging = "column";
    }}
    onPointerMove={(event) => {
      const button = event.currentTarget;
      if (!button.dataset.dragging) return;
      const cell = otherCell(button, event.clientX, event.clientY);
      button.closest(".info-table-head")?.querySelectorAll("[data-column]").forEach((item) => item.toggleAttribute("data-drop-target", item === cell));
    }}
    onPointerUp={(event) => {
      const button = event.currentTarget;
      const dropped = button.dataset.dragging && otherCell(button, event.clientX, event.clientY);
      clear(button);
      if (dropped) onSwap();
    }}
    onPointerCancel={(event) => clear(event.currentTarget)}
    onLostPointerCapture={(event) => clear(event.currentTarget)}
    onKeyDown={(event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      onSwap();
    }}
  ><span aria-hidden="true">≡</span></button>;
}

function normalizePhraseLines(lines: string[], document: RichTextDocument | undefined, fallback: string) {
  const sourceText = lines.join("\n");
  const sourceDocument = document?.runs?.length
    ? replaceRichText(document, sourceText)
    : { runs: [{ text: sourceText }] };
  const sourceStyles = expandStyles(sourceDocument);
  const normalizedLines: string[] = [];
  const normalizedStyles: RichTextStyle[] = [];
  let offset = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed) {
      if (normalizedLines.length) normalizedStyles.push({});
      const leadingWhitespace = line.length - line.trimStart().length;
      normalizedLines.push(trimmed);
      normalizedStyles.push(...sourceStyles.slice(offset + leadingWhitespace, offset + leadingWhitespace + trimmed.length));
    }
    offset += line.length + (index < lines.length - 1 ? 1 : 0);
  });

  if (!normalizedLines.length) return { lines: [fallback], document: { runs: [{ text: fallback }] } as RichTextDocument };
  const normalizedText = normalizedLines.join("\n");
  return { lines: normalizedLines, document: compactRuns(normalizedText, normalizedStyles) };
}

// On a phone the list and the record swap places; bring the new half to the top (read after the next render).
function revealOnPhone(ref: React.RefObject<HTMLElement | null>) {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  window.requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start" }));
}

// D-01/D-05: a card is one header row (handle, one toggle button, actions); the body is hidden, not unmounted, so rich fields keep their DOM and aria-controls always points at an element.
function CollapsibleCard({ id, label, title, open, onToggle, sortIndex, handle, actions, cardProps, children }: {
  id: string; label: string; title?: string; open: boolean; onToggle: () => void; sortIndex?: number;
  handle?: ReactNode; actions?: ReactNode; cardProps?: Record<string, string>; children: ReactNode;
}) {
  const bodyId = useId();
  const name = title || label;
  return (
    <div className="nested-editor-card" id={`card-${id}`} data-sort-index={sortIndex} data-open={open || undefined} {...cardProps}>
      <div className="nested-editor-head">
        {handle}
        <button type="button" className="nested-editor-toggle" aria-expanded={open} aria-controls={bodyId} aria-label={`${open ? "Свернуть" : "Развернуть"} раздел «${name}»`} onClick={onToggle}>
          <strong>{label}</strong>
          {title ? <span className="nested-editor-title" title={title}>{title}</span> : null}
          <span className="nested-editor-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        {actions}
      </div>
      <div className="nested-editor-body" id={bodyId} hidden={!open}>{children}</div>
    </div>
  );
}

// D-40/D-41: section cards run top to bottom in columns of five. Each card keeps its source index in data-sort-index, so ordering, undo and the stored order are unchanged; a card that crosses a column boundary remounts.
function SectionColumns<T>({ items, render }: { items: readonly T[]; render: (item: T, index: number) => ReactNode }) {
  return (
    <div className="editor-section-columns" data-sort-columns>
      {columnMajor(items).map((column, columnIndex) => (
        <div className="editor-section-column" data-sort-column key={columnIndex}>
          {column.map(({ item, index }) => render(item, index))}
        </div>
      ))}
    </div>
  );
}

// A section moved across a column boundary remounts its handle; keep keyboard focus on it so ArrowUp/ArrowDown can continue (D-42).
function sectionHandle(id: string) {
  return document.getElementById(`card-${id}`)?.querySelector<HTMLElement>(":scope > .nested-editor-head .order-drag-handle") ?? null;
}
function keepSectionHandleFocus(id: string) {
  const had = sectionHandle(id) === document.activeElement;
  return () => { if (had) requestAnimationFrame(() => sectionHandle(id)?.focus()); };
}

// D-41/D-47: the editor note of a section lives in the private store behind /api/content/notes, never in the content draft.
type NotesStatus = "loading" | "ready" | "unavailable" | "none";
type NotesState = { status: NotesStatus; baseline: NotesByTab; draft: NotesByTab; revisions: Partial<Record<NotesTab, number>> };
type NotesNotice = { tab: NotesTab; kind: "conflict" | "error" };
const noteHint = "Видна только редакторам с доступом к этой вкладке. На сайте и в публичных данных её нет.";
const notesUnavailableText = "Заметки временно недоступны.";
const notesConflictText = "Заметки этой вкладки изменил другой редактор. Загрузите их и повторите.";
const notesSaveFailedText = "Не удалось сохранить заметки. Заметка осталась в черновике.";

type NotesAnswer = { kind: "ok"; notes: NotesByTab; revisions: Partial<Record<NotesTab, number>> } | { kind: "none" } | { kind: "unavailable" };

async function fetchNotes(signal?: AbortSignal): Promise<NotesAnswer> {
  try {
    const response = await fetch("/api/content/notes", { cache: "no-store", signal });
    if (response.status === 401 || response.status === 403) return { kind: "none" };
    if (!response.ok) return { kind: "unavailable" };
    const body = (await response.json()) as { notes?: Record<string, unknown>; revisions?: Record<string, unknown> };
    const notes: NotesByTab = {};
    const revisions: Partial<Record<NotesTab, number>> = {};
    for (const tab of NOTES_TABS) {
      if (!body.notes || !Object.hasOwn(body.notes, tab)) continue;
      notes[tab] = normalizeNotesMap(body.notes[tab]);
      const revision = body.revisions?.[tab];
      revisions[tab] = typeof revision === "number" && Number.isInteger(revision) && revision >= 0 ? revision : 0;
    }
    return { kind: "ok", notes, revisions };
  } catch {
    return { kind: "unavailable" };
  }
}

// The sections and cards a tab's notes may still refer to; null means the tab keeps every key it has.
function liveNoteIds(tab: NotesTab, content: PortiaContent): string[] | null {
  return tab === "guide" ? content.guideSections.map((section) => section.id) : null;
}

// The draft as the server will store it (trimmed, empty notes dropped), so a trailing space is not an unsaved change.
const normalizedNotes = (value: NotesByTab): NotesByTab => Object.fromEntries(NOTES_TABS.map((tab) => [tab, normalizeNotesMap(value[tab])]));

function EditorNoteField({ value, status, onChange }: { value: string; status: NotesStatus; onChange: (text: string) => void }) {
  const hintId = useId();
  const off = status !== "ready";
  return (
    <div className="editor-note-field">
      <Field label="Заметка для редактора">
        <input maxLength={MAX_NOTE_LENGTH} value={off ? "" : value} disabled={off} aria-describedby={hintId} onChange={(event) => onChange(event.target.value)} />
      </Field>
      <p id={hintId} className="editor-note-hint">{status === "unavailable" ? notesUnavailableText : noteHint}</p>
    </div>
  );
}

// D-41: the add-section button stays at the top of the tab and opens a small form for the title and the editor note.
function SectionAddBar({ status, onCreate }: { status: NotesStatus; onCreate: (title: string, note: string) => void }) {
  const formId = useId();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const off = status !== "ready";
  useEffect(() => { if (open) titleField.current?.focus(); }, [open]);
  const close = (refocus: boolean) => {
    setOpen(false);
    setTitle("");
    setNote("");
    if (refocus) requestAnimationFrame(() => opener.current?.focus());
  };
  return (
    <div className="editor-section-addbar">
      <button ref={opener} type="button" className="secondary-control" aria-expanded={open} aria-controls={formId} onClick={() => (open ? close(true) : setOpen(true))}>+ ДОБАВИТЬ РАЗДЕЛ</button>
      <form id={formId} className="editor-section-create" hidden={!open}
        onSubmit={(event) => { event.preventDefault(); onCreate(title.trim(), off ? "" : note.trim()); close(false); }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); } }}>
        <Field label="Заголовок раздела"><input ref={titleField} maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="Заметка для редактора"><input maxLength={MAX_NOTE_LENGTH} value={off ? "" : note} disabled={off} aria-describedby={hintId} onChange={(event) => setNote(event.target.value)} /></Field>
        <p id={hintId} className="editor-note-hint">{status === "unavailable" ? notesUnavailableText : noteHint}</p>
        <div className="editor-section-create-actions">
          <button type="submit" className="primary-control">Создать раздел</button>
          <button type="button" className="secondary-control" onClick={() => close(true)}>Отмена</button>
        </div>
      </form>
    </div>
  );
}

type TocItem = { id: string; label: string; depth: 0 | 1 };

// D-03: a compact table of contents for a long list (5 or more entries). It owns only its list state and the entry in view; what a jump does is the caller's.
// The row lists (viruses, Корзина) pass no onAll, since nothing in them folds.
function EditorToc({ items, onJump, onAll }: { items: TocItem[]; onJump: (id: string) => void; onAll?: (open: boolean) => void }) {
  const listId = useId();
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState("");
  const idsKey = items.map((item) => item.id).join("\n");
  // The first entry in list order that sits in the band below the TOC is the one in view.
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split("\n");
    const seen = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) { if (entry.isIntersecting) seen.add(entry.target.id); else seen.delete(entry.target.id); }
      setActive(ids.find((id) => seen.has(`card-${id}`)) ?? "");
    }, { rootMargin: "-80px 0px -60% 0px" });
    for (const id of ids) { const element = document.getElementById(`card-${id}`); if (element) observer.observe(element); }
    return () => observer.disconnect();
  }, [idsKey]);
  if (items.length < 5) return null;
  return (
    <nav className="editor-toc" aria-label="Оглавление">
      <div className="editor-toc-bar">
        <button type="button" aria-expanded={listOpen} aria-controls={listId} onClick={() => setListOpen((value) => !value)}>ОГЛАВЛЕНИЕ ▾</button>
        {onAll && <button type="button" onClick={() => onAll(false)}>СВЕРНУТЬ ВСЕ</button>}
        {onAll && <button type="button" onClick={() => onAll(true)}>РАЗВЕРНУТЬ ВСЕ</button>}
      </div>
      <ol id={listId} hidden={!listOpen}>
        {items.map((item) => (
          <li key={item.id} data-depth={item.depth}>
            <button type="button" title={item.label} aria-current={active === item.id ? "location" : undefined} onClick={() => { setListOpen(false); onJump(item.id); }}>{item.label}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// EDIT-06: what a field activation makes of the target before it. A plain gesture starts over (D-14); an additive one keeps the fragments and,
// on its first activation, turns the previous non-empty selection into one (D-13). A collapsed caret in an additive gesture drops the fragment it lands in.
function joinFormatTarget(prev: FormatTarget | null, target: FormatTarget): FormatTarget {
  if (!target.gesture.additive || !prev) return target;
  let fragments = prev.fragments;
  let peers = prev.peers;
  if (prev.gesture.id !== target.gesture.id) {
    const length = prev.document.runs.reduce((sum, run) => sum + run.text.length, 0);
    const clamp = (value: number) => Math.max(0, Math.min(length, value));
    const selection = prev.selection;
    const picked = selection && selection.start !== selection.end ? [{ key: prev.key, from: clamp(selection.start), to: clamp(selection.end) }] : [];
    fragments = [...prev.fragments, ...picked];
    peers = { ...prev.peers, [prev.key]: { ...prev, fragments: [], peers: {} } };
  }
  fragments = mergeFragments(fragments);
  const caret = target.selection;
  if (caret && caret.start === caret.end) fragments = removeFragmentAt(fragments, target.key, caret.start);
  const kept: Record<string, FormatTarget> = {};
  for (const fragment of fragments) if (fragment.key !== target.key && peers[fragment.key]) kept[fragment.key] = peers[fragment.key];
  return { ...target, fragments, peers: kept };
}

const blankVirus = (): Virus => ({
  id: makeId("virus"),
  code: "VIR-",
  name: "НОВЫЙ ВИРУС",
  status: "НАБЛЮДЕНИЕ",
  infectedImage: "",
  external: "",
  ppu: { health: "", speed: "", abilities: "" },
  physiology: "",
  mutations: [],
  classification: {
    danger: "Гефест",
    spread: "Номос",
    transmission: "Контактно-бытовой",
    escapeRisk: "Предупреждение",
    mind: "Транзитиум",
    appearance: "Изоморф",
    behavior: "Стабилар",
  },
  scientistLogs: [
    { id: makeId("log"), title: "ЗАПИСЬ 01", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""] },
    { id: makeId("log"), title: "ЗАПИСЬ 02", scientist: "ИМЯ УЧЁНОГО", lockedLevel: 4, content: [""] },
  ],
});

const blankRecycleFile = (): RecycleFile => ({
  id: makeId("file"),
  name: "НОВЫЙ_ФАЙЛ.txt",
  location: "C:\\PORTIA\\RECYCLE_BIN",
  kind: "text",
  content: "",
  image: "",
  virusId: "",
});

export function PortiaEditor({ accessFailed, content, revision, saveState, canManageEditors, openTabs, active, minimized, onDirtyChange, closeRequest, onCloseApproved, onSave, onEmployeeSaved, onEmployeeRemoved, saveError }: Props) {
  const [history, dispatch] = useReducer(editorReducer, content, initEditorHistory);
  // The revision the draft's baseline came from; a stale draft then gets the 409 instead of overwriting newer content (uat-03-owner-broadcast-vanishes).
  const baseRevision = useRef(revision);
  const draft = history.present;
  const changed = useMemo(() => changedSections(history.baseline, history.present), [history.baseline, history.present]);
  // Invisible limits only warn (D-16); a body the server would refuse blocks the save with its reason (D-23).
  const oversize = useMemo(() => oversizeFields(draft), [draft]);
  const bodyBytes = useMemo(() => contentBodyBytes(draft), [draft]);
  const bodyMessage = bodyTooLargeMessage(bodyBytes);
  // D-18: a quest that ends before it starts is flagged and blocks the save; the editor never rewrites its dates.
  const badQuest = draft.broadcasts.find(questDateError);
  const dateMessage = badQuest ? `ИСПРАВЬТЕ ДАТЫ КВЕСТА: «${badQuest.title || "БЕЗ НАЗВАНИЯ"}»` : "";
  const saveBlocked = bodyMessage !== "" || badQuest !== undefined;
  // D-47: the private editor notes, loaded once from /api/content/notes. They are not part of the content draft and not of its undo history.
  const [notes, setNotes] = useState<NotesState>({ status: "loading", baseline: {}, draft: {}, revisions: {} });
  const [notesNotice, setNotesNotice] = useState<NotesNotice | null>(null);
  const notesChanged = notes.status === "ready"
    ? changedNotesTabs(normalizedNotes(notes.baseline), normalizedNotes(notes.draft)).filter((tab) => canManageEditors || openTabs.includes(tab))
    : [];
  const dirty = changed.length > 0 || notesChanged.length > 0;
  const [pickedTab, setTab] = useState<EditorTab>("viruses");
  // Derived at render, not by an effect: a closed pick shows the first open tab (D-14, D-17).
  const stripTabs = ([
    ...tabRegistry.filter((entry) => openTabs.includes(entry.id)).map((entry) => [entry.id, entry.label]),
    ...(canManageEditors ? [["access", "Доступ"]] : []),
  ]) as [EditorTab, string][];
  const noTabs = stripTabs.length === 0;
  // The owner has every section; for an editor the sections outside the open list are closed (D-14).
  const closedKey = canManageEditors ? "" : closedSectionsOf(openTabs).join(",");
  const closedSections = (closedKey ? closedKey.split(",") : []) as EditorSection[];
  const employeesClosed = !canManageEditors && !openTabs.includes("employees");
  // Closed sections are never shown; a D-13 move still counts in `dirty`.
  const shownChanged = [...changed, ...notesChanged.filter((tab) => !changed.includes(tab))].filter((section) => !closedSections.includes(section));
  const [closureNotice, setClosureNotice] = useState("");
  // D-09: the revision the refused save was based on; the panel shows while the draft is dirty and the 409 is the last answer. Null once the user chose.
  const [conflictBase, setConflictBase] = useState<number | null>(null);
  // D-09: the user's own values from before «Загрузить их версию», kept beside the server's version until closed or saved.
  const [theirEdits, setTheirEdits] = useState<DraftEdit[]>([]);
  const [copiedEdit, setCopiedEdit] = useState("");
  // D-10: the sections the server refused in the last save and the N of M it reported; both stay until the next edit or a save that takes everything.
  const [refusedSections, setRefusedSections] = useState<EditorSection[]>([]);
  const [partialResult, setPartialResult] = useState<{ saved: number; total: number; sections: EditorSection[] } | null>(null);
  // The first refused section gets the focus once the partial result is rendered.
  const focusRequest = useRef<EditorSection | null>(null);
  const errorIdBase = useId();
  const tab: EditorTab = stripTabs.some(([id]) => id === pickedTab) ? pickedTab : stripTabs[0]?.[0] ?? pickedTab;
  const [selectedVirusId, setSelectedVirusId] = useState(content.viruses[0]?.id ?? "");
  const [selectedRecycleFileId, setSelectedRecycleFileId] = useState(content.recycleFiles[0]?.id ?? "");
  // The Recycle selection is one of two ids; the other stays "" (the render and the row highlight rely on it).
  const [selectedRecycledVirusId, setSelectedRecycledVirusId] = useState(content.recycleFiles.length ? "" : content.recycledViruses?.[0]?.id ?? "");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [dialog, setDialog] = useState<"discard" | "recycle" | "delete" | "delete-file" | null>(null);
  // A request made before this mount is not replayed; the dialog shows while a newer one is unanswered.
  const [handledCloseRequest, setHandledCloseRequest] = useState(closeRequest);
  const closeAsked = closeRequest !== handledCloseRequest;
  const [employeeDirty, setEmployeeDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<EditorTab | null>(null);
  const leaving = employeeDirty && (leaveTo !== null || closeAsked);
  const [formatTarget, setFormatTarget] = useState<FormatTarget | null>(null);
  const [formatterOpen, setFormatterOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const [dossierTab, setDossierTab] = useState<DossierTab>("main");
  const [broadcastEditorTab, setBroadcastEditorTab] = useState<BroadcastTab>("news");
  // A new or moved card is focused once it is in the DOM; focus scrolls it into view (G-03.2-2a).
  const revealBroadcast = useRef<{ id: string; field: "title" | "type" | "endsAt" } | null>(null);
  const [revealTick, setRevealTick] = useState(0);
  const [previewSurface, setPreviewSurface] = useState<EditorPreviewSurface | null>(null);
  // At 900px and below a list + form layout shows either the list or the open record (D-01, D-02).
  // D-01: which cards are open. Component state only, never stored, so every visit starts collapsed.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const isOpen = (id: string) => expanded.has(id);
  const setOpen = (ids: string[], open: boolean) => setExpanded((current) => {
    const next = new Set(current);
    for (const id of ids) { if (open) next.add(id); else next.delete(id); }
    return next;
  });
  const [recordOpen, setRecordOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const toggleCard = (id: string) => {
    const open = isOpen(id);
    const body = document.getElementById(`card-${id}`)?.querySelector(":scope > .nested-editor-body");
    if (open) dropFormatFields((key) => !!body?.contains(findFormatField(key)));
    setOpen([id], !open);
  };
  const showRecord = (open: boolean) => {
    setRecordOpen(open);
    revealOnPhone(layoutRef);
  };

  // Falls back to the first record when the selected one is gone from `next`.
  // An empty Recycle id is the unselected half of the pair and stays empty.
  const repairSelections = (next: PortiaContent) => {
    setSelectedVirusId((current) => (next.viruses.some((virus) => virus.id === current) ? current : next.viruses[0]?.id ?? ""));
    setSelectedRecycleFileId((current) => (current === "" || next.recycleFiles.some((file) => file.id === current) ? current : next.recycleFiles[0]?.id ?? ""));
    setSelectedRecycledVirusId((current) => (current === "" || next.recycledViruses?.some((virus) => virus.id === current) ? current : next.recycledViruses?.[0]?.id ?? ""));
  };

  // D-11: the timer below fires after render, so it reads the latest history and tab from here.
  const syncRef = useRef({ history, tab });
  useEffect(() => { syncRef.current = { history, tab }; });
  // D-11: a newer stored copy overlaps the unsaved edits or the open section; the draft stays as typed and the save resolves it.
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      if (!dirty) {
        dispatch({ type: "sync", content });
        baseRevision.current = revision;
        repairSelections(content);
        setStale(false);
        return;
      }
      // D-11: with unsaved edits a background update never replaces the draft. Sections nobody edited here follow the server; the section of the open tab (a field may be under the cursor) and the edited ones keep the draft.
      if (revision <= baseRevision.current) return;
      const { history: live, tab: shown } = syncRef.current;
      const decision = rebaseDecision(live.baseline, live.present, content, editorSections.filter((section) => section === shown));
      if (decision.kind === "conflict") {
        setStale(true);
        return;
      }
      baseRevision.current = revision;
      setStale(false);
      if (decision.kind === "none") return;
      const theirs = changedSections(live.baseline, content);
      dispatch({ type: "rebase", baseline: content, source: content, project: (entry) => revertSections(content, entry, theirs) });
      repairSelections(decision.present);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [content, dirty, revision, tab]);

  // D-15, D-16: when the owner closes a section, its unsaved edits go back to the stored copy, in the history too, so Ctrl+Z cannot bring them back.
  const closureRef = useRef({ history, employeeDirty });
  useEffect(() => { closureRef.current = { history, employeeDirty }; });
  const shutRef = useRef<string[]>([]);
  useEffect(() => {
    const closed = (closedKey ? closedKey.split(",") : []) as EditorSection[];
    const shut = [...closed, ...(employeesClosed ? ["employees"] : [])];
    const added = shut.filter((id) => !shutRef.current.includes(id));
    shutRef.current = shut;
    if (!shut.length) return;
    // Read now: the employee editor unmounts with its tab and reports clean before the timer fires.
    const wasEmployeeDirty = closureRef.current.employeeDirty;
    const timer = window.setTimeout(() => {
      const { baseline, present } = closureRef.current.history;
      const lost: string[] = deniedSections(baseline, present, closed);
      if (wasEmployeeDirty && added.includes("employees")) lost.push("employees");
      if (closed.length) dispatch({ type: "restrict", project: (content) => revertSections(baseline, content, closed) });
      if (!added.length) return;
      setFormatTarget(null);
      setFormatterOpen(false);
      setRecordOpen(false);
      setPreviewSurface(null);
      setLeaveTo(null);
      if (!lost.length) return;
      const names = lost.map((id) => `«${id === "employees" ? "Сотрудники" : sectionLabels[id as EditorSection]}»`);
      setClosureNotice(lost.length === 1
        ? `Владелец закрыл раздел ${names[0]}, несохранённые правки в нём сброшены`
        : `Владелец закрыл разделы ${names.join(", ")}, несохранённые правки в них сброшены`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [closedKey, employeesClosed]);

  const selectedVirusIndex = useMemo(
    () => draft.viruses.findIndex((virus) => virus.id === selectedVirusId),
    [draft.viruses, selectedVirusId],
  );
  const selectedVirus = selectedVirusIndex >= 0 ? draft.viruses[selectedVirusIndex] : null;
  const orderedRecycleKeys = useMemo(() => recycleKeys(draft), [draft]);
  // When neither Recycle id resolves (the last record of a kind was deleted, restored, undone or synced away),
  // show the first record in list order instead of "Корзина пуста" beside a full list.
  const recycleKeyShown = draft.recycleFiles.some((file) => file.id === selectedRecycleFileId)
    ? `file:${selectedRecycleFileId}`
    : (draft.recycledViruses ?? []).some((virus) => virus.id === selectedRecycledVirusId) ? `virus:${selectedRecycledVirusId}` : orderedRecycleKeys[0] ?? "";
  const shownRecycleFileId = recycleKeyShown.startsWith("file:") ? recycleKeyShown.slice("file:".length) : "";
  const shownRecycledVirusId = recycleKeyShown.startsWith("virus:") ? recycleKeyShown.slice("virus:".length) : "";
  const selectedRecycleFileIndex = useMemo(
    () => draft.recycleFiles.findIndex((file) => file.id === shownRecycleFileId),
    [draft.recycleFiles, shownRecycleFileId],
  );
  const selectedRecycleFile = selectedRecycleFileIndex >= 0 ? draft.recycleFiles[selectedRecycleFileIndex] : null;
  const selectedRecycledVirusIndex = useMemo(
    () => (draft.recycledViruses ?? []).findIndex((virus) => virus.id === shownRecycledVirusId),
    [draft.recycledViruses, shownRecycledVirusId],
  );
  const selectedRecycledVirus = selectedRecycledVirusIndex >= 0 ? draft.recycledViruses[selectedRecycledVirusIndex] : null;
  const liveVirusId = selectedVirus?.id;
  const liveDossierChanged = useMemo(() => liveVirusId ? changedDossierTabs(history.baseline, draft, liveVirusId) : [], [history.baseline, draft, liveVirusId]);
  const archivedVirusId = selectedRecycledVirus?.id;
  const archivedDossierChanged = useMemo(() => archivedVirusId ? changedDossierTabs(history.baseline, draft, archivedVirusId) : [], [history.baseline, draft, archivedVirusId]);

  // Counted at dispatch, not after commit, so a save can tell synchronously whether the draft changed while it ran.
  const editCount = useRef(0);
  // D-16: while the panel applies one control to several fields every change carries its batch:<id> key, so they are one undo step.
  const batchKey = useRef<string | null>(null);
  const changeDraft = (updater: (next: PortiaContent) => void) => {
    editCount.current += 1;
    setPartialResult(null);
    dispatch({ type: "change", updater, key: batchKey.current ?? editKeyFor(document.activeElement), now: Date.now() });
  };
  const runBatch = (id: string, run: () => void) => {
    batchKey.current = id;
    try { run(); } finally { batchKey.current = null; }
  };

  // D-47: notes are read once when the editor opens; a 503 (store missing or down) disables only the note fields, a 403 means this account has none.
  useEffect(() => {
    const controller = new AbortController();
    void fetchNotes(controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      if (answer.kind === "ok") setNotes({ status: "ready", baseline: answer.notes, draft: structuredClone(answer.notes), revisions: answer.revisions });
      else setNotes((previous) => ({ ...previous, status: answer.kind === "none" ? "none" : "unavailable" }));
    });
    return () => controller.abort();
  }, []);
  const noteOf = (tab: NotesTab, id: string) => notes.draft[tab]?.[id] ?? "";
  const setNote = (tab: NotesTab, id: string, text: string) => setNotes((previous) => {
    const map: NotesMap = { ...previous.draft[tab] };
    if (text) map[id] = text; else delete map[id];
    return { ...previous, draft: { ...previous.draft, [tab]: map } };
  });
  const dropNote = (tab: NotesTab, id: string) => setNotes((previous) => {
    if (!previous.draft[tab] || !(id in previous.draft[tab])) return previous;
    const map: NotesMap = { ...previous.draft[tab] };
    delete map[id];
    return { ...previous, draft: { ...previous.draft, [tab]: map } };
  });
  // «Загрузить заметки» after a 409: the other editor's notes come in, this editor's own unsaved changes stay on top of them.
  const reloadNotes = async () => {
    const answer = await fetchNotes();
    if (answer.kind !== "ok") { setNotesNotice((current) => ({ tab: current?.tab ?? "guide", kind: "error" })); return; }
    setNotes((previous) => {
      const baseline: NotesByTab = { ...previous.baseline };
      const draft: NotesByTab = { ...previous.draft };
      for (const tab of NOTES_TABS) {
        const server = answer.notes[tab];
        if (!server) continue;
        draft[tab] = rebaseNotes(normalizeNotesMap(previous.baseline[tab]), normalizeNotesMap(previous.draft[tab]), server);
        baseline[tab] = server;
      }
      return { status: "ready", baseline, draft, revisions: { ...previous.revisions, ...answer.revisions } };
    });
    setNotesNotice(null);
  };
  // PUT /api/content/notes for each changed tab. Resolves true when every changed tab is stored; a failed tab keeps its draft and shows its own message.
  const persistNotes = async (from: PortiaContent, skip: readonly EditorSection[] = []): Promise<boolean> => {
    let ok = true;
    for (const tab of notesChanged) {
      if (skip.includes(tab)) { ok = false; continue; }
      const live = liveNoteIds(tab, from);
      const sent = normalizeNotesMap(live ? pruneNotes(notes.draft[tab] ?? {}, live) : notes.draft[tab]);
      try {
        const response = await fetch("/api/content/notes", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ tab, notes: sent, revision: notes.revisions[tab] ?? 0 }) });
        if (response.ok) {
          const saved = (await response.json().catch(() => ({}))) as { revision?: unknown };
          const revision = typeof saved.revision === "number" ? saved.revision : (notes.revisions[tab] ?? 0) + 1;
          setNotes((previous) => ({
            ...previous,
            baseline: { ...previous.baseline, [tab]: sent },
            draft: { ...previous.draft, [tab]: live ? pruneNotes(previous.draft[tab] ?? {}, live) : previous.draft[tab] },
            revisions: { ...previous.revisions, [tab]: revision },
          }));
          setNotesNotice((current) => (current?.tab === tab ? null : current));
        } else {
          ok = false;
          setNotesNotice({ tab, kind: response.status === 409 ? "conflict" : "error" });
        }
      } catch {
        ok = false;
        setNotesNotice({ tab, kind: "error" });
      }
    }
    return ok;
  };

  const step = (kind: "undo" | "redo") => {
    const target = kind === "undo" ? history.past.at(-1) : history.future[0];
    if (!target) return;
    // The open format panel holds the pre-step document; a stale panel would write old text back.
    setFormatTarget(null);
    setFormatterOpen(false);
    repairSelections(target);
    // CONT-05: an undo/redo that moves a card between news and quests takes the editor to that card.
    const change = categoryChange(draft.broadcasts, target.broadcasts);
    if (change) revealCard(change.id, "type", change.tab);
    editCount.current += 1;
    setPartialResult(null);
    dispatch({ type: kind });
  };

  // Both run after the PORTIA confirm dialog (never window.confirm: embedded browsers answer it "no" unseen).
  const moveSelectedVirusToRecycle = () => {
    if (!selectedVirus) return;
    const nextId = draft.viruses.find((virus) => virus.id !== selectedVirus.id)?.id ?? "";
    // The panel's stored commit targets this virus, which is about to leave the list.
    setFormatTarget(null);
    setFormatterOpen(false);
    changeDraft((next) => {
      const recycled = next.viruses.find((virus) => virus.id === selectedVirus.id);
      if (!recycled) return;
      next.recycledViruses ??= [];
      next.recycledViruses.push(recycled);
      next.viruses = next.viruses.filter((virus) => virus.id !== selectedVirus.id);
      next.recycleOrder = [...recycleKeys(next).filter((key) => key !== `virus:${recycled.id}`), `virus:${recycled.id}`];
    });
    setSelectedVirusId(nextId);
    setSelectedRecycledVirusId(selectedVirus.id);
    setSelectedRecycleFileId("");
    showRecord(false);
  };

  const deleteSelectedRecycledVirus = () => {
    if (!selectedRecycledVirus) return;
    const nextId = draft.recycledViruses.find((virus) => virus.id !== selectedRecycledVirus.id)?.id ?? "";
    // The panel's stored commit targets this virus, which is about to be deleted.
    setFormatTarget(null);
    setFormatterOpen(false);
    changeDraft((next) => { removeRecycledVirus(next, selectedRecycledVirus.id); next.recycleOrder = recycleKeys(next); });
    setSelectedRecycledVirusId(nextId);
    showRecord(false);
  };

  const deleteSelectedRecycleFile = () => {
    if (!selectedRecycleFile) return;
    const nextId = draft.recycleFiles.find((file) => file.id !== selectedRecycleFile.id)?.id ?? "";
    setFormatTarget(null);
    setFormatterOpen(false);
    changeDraft((next) => { removeRecycleFile(next, selectedRecycleFile.id); next.recycleOrder = recycleKeys(next); });
    setSelectedRecycleFileId(nextId);
    showRecord(false);
  };

  // By id, not index: an upload that finishes after a reorder, or the open format panel's stored commit, would otherwise write into another record.
  const updateVirus = (updater: (virus: Virus) => void) => {
    const id = selectedVirus?.id;
    if (!id) return;
    changeDraft((next) => updateById(next.viruses, id, updater));
  };

  const updateRecycleFile = (updater: (file: RecycleFile) => void) => {
    const id = selectedRecycleFile?.id;
    if (!id) return;
    changeDraft((next) => updateById(next.recycleFiles, id, updater));
  };

  const updateRecycledVirus = (updater: (virus: Virus) => void) => {
    const id = selectedRecycledVirus?.id;
    if (!id) return;
    changeDraft((next) => updateById(next.recycledViruses ?? [], id, updater));
  };

  const changeFormattedText = (
    key: string,
    value: string,
    document: RichTextDocument,
    updatePlainText: (next: PortiaContent, value: string) => void,
  ) => changeDraft((next) => {
    updatePlainText(next, value);
    next.formattedText[key] = document;
  });

  const activateFormatter = (target: FormatTarget) => setFormatTarget((prev) => joinFormatTarget(prev, target));
  // A gone field (deleted, folded) closes the panel when it is the main target and leaves the multi-selection otherwise, with its fragments (CR-01, WR-02).
  // The updater is functional so several calls in one handler chain.
  const dropFormatFields = (gone: (key: string) => boolean) => {
    if (formatTarget && gone(formatTarget.key)) setFormatterOpen(false);
    setFormatTarget((prev) => prev && dropFields(prev, gone));
  };
  // The panel's stored commit for a deleted item would write its formatting back; peers too (CR-01).
  const closeFormatterFor = (...keys: string[]) => dropFormatFields((key) => keys.includes(key));

  // The format panel keeps a target in the tab being hidden; leaving it open could write old text back (Pitfall 7).
  const selectDossierTab = (id: DossierTab) => {
    setDossierTab(id);
    setFormatTarget(null);
    setFormatterOpen(false);
  };

  const shownBroadcasts = draft.broadcasts.filter((item) => broadcastTabOf(item.type) === broadcastEditorTab);

  // D-03: every TOC ends in this one scroll. Smooth only when the house motion switch is on; scroll-margin-top keeps the card clear of the sticky TOC.
  const jumpToCard = (id: string) => requestAnimationFrame(() => document.getElementById(`card-${id}`)?.scrollIntoView({ block: "start", behavior: document.documentElement.dataset.motion === "full" ? "smooth" : "auto" }));
  // Folding everything also drops a format target that sat in a card body (Pitfall 7), peers too (WR-02).
  const setAllOpen = (ids: string[], open: boolean) => {
    if (!open) dropFormatFields((key) => !!findFormatField(key)?.closest(".nested-editor-body"));
    setOpen(ids, open);
  };
  const infoTocItems: TocItem[] = draft.infoSections.flatMap((section) => [
    { id: section.id, label: section.title || "БЕЗ НАЗВАНИЯ", depth: 0 as const },
    ...section.subsections.map((subsection) => ({ id: subsection.id, label: subsection.title || "БЕЗ НАЗВАНИЯ", depth: 1 as const })),
  ]);
  const infoCardIds = draft.infoSections.flatMap((section) => [section.id, ...section.subsections.flatMap((subsection) => [subsection.id, ...subsection.blocks.map((block) => block.id)])]);
  const jumpInfo = (id: string) => {
    const found = findInfo(draft.infoSections, id);
    setOpen(found ? [found.section.id, id] : [id], true);
    jumpToCard(id);
  };
  const writeGuideBlock = (cardId: string, blockId: string, write: (block: GuideBlock) => void) => changeDraft((next) => {
    const block = findGuideBlock(next, cardId, blockId);
    if (block) write(block);
  });
  const guideTocItems: TocItem[] = draft.guideSections.flatMap((section) => [
    { id: section.id, label: section.title || "БЕЗ НАЗВАНИЯ", depth: 0 as const },
    ...section.cards.map((card) => ({ id: card.id, label: card.title || "БЕЗ НАЗВАНИЯ", depth: 1 as const })),
  ]);
  const guideCardIds = draft.guideSections.flatMap((section) => [section.id, ...section.cards.flatMap((card) => [card.id, ...card.blocks.map((block) => block.id)])]);
  const jumpGuide = (id: string) => {
    const found = findGuide(draft.guideSections, id);
    setOpen(found ? [found.section.id, id] : [id], true);
    jumpToCard(id);
  };
  const addGuideBlock = (cardId: string, make: (id: string) => GuideBlock) => {
    const id = makeId("block");
    changeDraft((next) => { findGuide(next.guideSections, cardId)?.card?.blocks.push(make(id)); });
    setOpen([id], true);
  };
  const broadcastTocItems: TocItem[] = shownBroadcasts.map((broadcast) => ({ id: broadcast.id, label: broadcast.title || "БЕЗ НАЗВАНИЯ", depth: 0 }));
  // The row button and its TOC entry share these two handlers, so the TOC never duplicates selection logic.
  const openVirus = (id: string) => { setSelectedVirusId(id); showRecord(true); };
  const openRecycleEntry = (key: string) => {
    const id = key.slice(key.indexOf(":") + 1);
    if (key.startsWith("virus:")) { setSelectedRecycledVirusId(id); setSelectedRecycleFileId(""); }
    else { setSelectedRecycleFileId(id); setSelectedRecycledVirusId(""); }
    showRecord(true);
  };
  const virusTocItems: TocItem[] = draft.viruses.map((virus) => ({ id: virus.id, label: virus.name || "БЕЗ НАЗВАНИЯ", depth: 0 }));
  // The same filter the rows use: a key whose record is gone has no row and no entry.
  const recycleTocItems: TocItem[] = orderedRecycleKeys.flatMap((key) => {
    const id = key.slice(key.indexOf(":") + 1);
    const record = key.startsWith("virus:") ? draft.recycledViruses.find((item) => item.id === id) : draft.recycleFiles.find((item) => item.id === id);
    return record ? [{ id: key, label: record.name || "БЕЗ ИМЕНИ", depth: 0 as const }] : [];
  });
  // Same reason as selectDossierTab: the panel's target may sit in a card of the category being hidden (T-03.2-20).
  const selectBroadcastTab = (id: BroadcastTab) => {
    setBroadcastEditorTab(id);
    setFormatTarget(null);
    setFormatterOpen(false);
  };

  useEffect(() => {
    const target = revealBroadcast.current;
    if (!target || tab !== "broadcasts") return;
    const card = document.querySelector(`[data-broadcast-id="${CSS.escape(target.id)}"]`);
    const selector = target.field === "title" ? "[data-broadcast-title]" : target.field === "endsAt" ? "[data-broadcast-ends]" : "[data-broadcast-type]";
    const field = card?.querySelector<HTMLElement>(selector);
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: "nearest", behavior: document.documentElement.dataset.motion === "full" ? "smooth" : "auto" });
    revealBroadcast.current = null;
  }, [draft.broadcasts, broadcastEditorTab, tab, revealTick]);

  // Brings the editor to one card's field from anywhere (D-18, CONT-05).
  const revealCard = (id: string, field: "title" | "type" | "endsAt", cardTab: BroadcastTab) => {
    revealBroadcast.current = { id, field };
    setOpen([id], true);
    selectBroadcastTab(cardTab);
    if (tab !== "broadcasts") showTab("broadcasts");
    // revealTick re-runs the effect when the tab and sub-tab are already right.
    setRevealTick((value) => value + 1);
  };

  const showTab = (id: EditorTab) => {
    setTab(id);
    setClosureNotice("");
    setRecordOpen(false);
    setPreviewSurface(null);
    setFormatTarget(null);
    setFormatterOpen(false);
  };
  // An unsaved employee draft is asked about before leaving the tab (D-02).
  const switchTab = (id: EditorTab) => {
    if (tab === "employees" && id !== "employees" && employeeDirty) setLeaveTo(id);
    else showTab(id);
  };
  // The answer of the employee question: continue the pending tab switch or window close, or drop it.
  const onEmployeeLeave = (ok: boolean) => {
    if (ok) setEmployeeDirty(false);
    if (leaveTo !== null) {
      setLeaveTo(null);
      if (ok) showTab(leaveTo);
    } else if (closeAsked) {
      // With dirty content the «Закрыть редактор?» dialog follows by itself.
      if (!ok || !dirty) setHandledCloseRequest(closeRequest);
      if (ok && !dirty) onCloseApproved();
    }
  };

  const uploadImage = async (file: File, onUploaded: (url: string) => void) => {
    if (uploadState === "uploading") return;
    setUploadState("uploading");
    setUploadMessage("");
    // A refusal never calls onUploaded, so the field and the draft keep their value (D-16).
    const refuse = (message: string) => { setUploadMessage(message); setUploadState("error"); };
    let response: Response;
    try {
      const body = new FormData();
      body.set("file", file);
      response = await fetch("/api/uploads", { method: "POST", body });
    } catch {
      refuse(uploadRefusal.network);
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      refuse(typeof payload.error === "string" ? payload.error : uploadRefusal.server);
      return;
    }
    onUploaded(payload.url);
    setUploadState("idle");
  };

  // Read after an awaited save, when the closure that started it is renders old.
  const latest = useRef({ closeAsked, onCloseApproved });
  useEffect(() => { latest.current = { closeAsked, onCloseApproved }; });
  // Set synchronously when a save starts, so a second click in the same frame cannot send a second request before saveState reaches this component (idempotency).
  const inflight = useRef(false);

  // Resolves true only when nothing is left unsaved: the draft was clean, or the save succeeded and nothing was typed meanwhile.
  // mode "replace" is «Заменить своей» (D-09): the user's sections go over the latest server copy under its revision.
  const save = async (mode: "mine" | "replace" = "mine"): Promise<boolean> => {
    if (!dirty) return true;
    // STAB-APP-09: no save on a stale answer about the rights; the draft stays where it is.
    if (accessFailed) return false;
    // D-23: the server would answer 413; the savebar already shows why.
    if (saveBlocked) return false;
    if (saveState === "saving" || inflight.current) return false;
    inflight.current = true;
    // Only the private notes changed: nothing goes to /api/content, so no revision moves and no conflict can come from it.
    if (changed.length === 0) {
      try { return await persistNotes(draft); } finally { inflight.current = false; }
    }
    if (mode === "replace") baseRevision.current = revision;
    // The reducer compares this very object after the request to tell whether the owner kept typing meanwhile.
    const savedFrom = draft;
    const editsBefore = editCount.current;
    try {
      const normalized = clone(draft);
      normalized.searchRecommendations = normalized.searchRecommendations.map((value) => value.trim()).filter(Boolean);
      normalized.assistantAdvice = normalized.assistantAdvice.map((value) => value.trim()).filter(Boolean);
      normalized.assistantOffendedPhrases = (normalized.assistantOffendedPhrases ?? [normalized.assistantOffendedPhrase])
        .map((value) => value.trim()).filter(Boolean);
      if (!normalized.assistantOffendedPhrases.length) normalized.assistantOffendedPhrases = ["Я обиделась. Дайте мне немного времени."];
      normalized.assistantOffendedPhrase = normalized.assistantOffendedPhrases[0];
      normalized.assistantPatienceVariants = (normalized.assistantPatienceVariants ?? [normalized.assistantPatienceSeconds])
        .map((value) => Math.min(60, Math.max(1, Math.round(Number(value) || 3))));
      if (!normalized.assistantPatienceVariants.length) normalized.assistantPatienceVariants = [3];
      normalized.assistantPatienceSeconds = normalized.assistantPatienceVariants[0];
      const idlePhrases = normalizePhraseLines(
        normalized.assistantIdlePhrases,
        normalized.formattedText[portiaTextKey.assistantIdle],
        "Вы давно ничего не делали. Я всё ещё здесь.",
      );
      normalized.assistantIdlePhrases = idlePhrases.lines;
      normalized.formattedText[portiaTextKey.assistantIdle] = idlePhrases.document;
      const activityPhrases = normalizePhraseLines(
        normalized.assistantActivityPhrases,
        normalized.formattedText[portiaTextKey.assistantActivity],
        "Вижу, работа идёт. Продолжайте в том же духе.",
      );
      normalized.assistantActivityPhrases = activityPhrases.lines;
      normalized.formattedText[portiaTextKey.assistantActivity] = activityPhrases.document;
      normalized.assistantAutoIntervalSeconds = Math.min(3600, Math.max(1, Math.round(Number(normalized.assistantAutoIntervalSeconds) || 60)));
      normalized.assistantAutoMinSeconds = Math.min(3600, Math.max(1, Math.round(Number(normalized.assistantAutoMinSeconds) || 45)));
      normalized.assistantAutoMaxSeconds = Math.min(3600, Math.max(1, Math.round(Number(normalized.assistantAutoMaxSeconds) || 120)));
      if (normalized.assistantAutoMinSeconds > normalized.assistantAutoMaxSeconds) {
        [normalized.assistantAutoMinSeconds, normalized.assistantAutoMaxSeconds] = [normalized.assistantAutoMaxSeconds, normalized.assistantAutoMinSeconds];
      }
      normalized.viruses.forEach((virus) => { virus.scientistLogs = virus.scientistLogs.slice(0, MAX_SCIENTIST_LOGS); });
      // Closed sections go exactly as stored, so the normalization above can never look like an edit of them (RESEARCH P4).
      // Replacing: the sections the user did not touch come from the latest server copy, so only the user's own sections overwrite theirs (T-19-26: closed ones follow the server too).
      const serverBase = mode === "replace" ? content : history.baseline;
      const taken = mode === "replace" ? editorSections.filter((section) => !changed.includes(section)) : [];
      const reverted = [...new Set([...taken, ...closedSections])];
      const wanted = reverted.length ? revertSections(serverBase, normalized, reverted) : normalized;
      let outgoing = wanted;
      // D-10: sections the server refuses stay drafts; the rest is sent once more without them.
      let refused: EditorSection[] = [];
      try {
        baseRevision.current = await onSave(outgoing, baseRevision.current);
      } catch (error) {
        if (!(error instanceof SectionClosedError)) throw error;
        refused = error.refusedSections.filter((section) => changed.includes(section));
        if (!refused.length || !partialSave(changed, refused).send.length) throw error;
        outgoing = revertSections(serverBase, wanted, refused);
        baseRevision.current = await onSave(outgoing, baseRevision.current);
      }
      const clean = editCount.current === editsBefore && refused.length === 0;
      setClosureNotice("");
      setConflictBase(null);
      setStale(false);
      setTheirEdits([]);
      setRefusedSections(refused);
      if (refused.length) {
        const result = partialSave(changed, refused);
        setPartialResult({ saved: result.saved, total: result.total, sections: result.send });
        const first = editorSections.find((section) => refused.includes(section)) ?? null;
        focusRequest.current = first;
        if (first && stripTabs.some(([id]) => id === first)) setTab(first);
      } else setPartialResult(null);
      // A draft typed during the request follows the server copy for the sections this save took from it, except where the user typed meanwhile.
      const rebase = taken.length ? (latest: PortiaContent) => {
        const typed = changedSections(savedFrom, latest);
        return revertSections(outgoing, latest, taken.filter((section) => !typed.includes(section)));
      } : undefined;
      // The refused sections stay in the draft: when nothing was typed meanwhile the draft becomes the full copy, not the reduced one that was stored.
      dispatch({ type: "saved", normalized: outgoing, savedFrom, keep: refused.length ? wanted : undefined, rebase });
      // D-47: the notes follow the content, so a note never refers to a section the server does not have yet.
      const notesSaved = await persistNotes(savedFrom, refused);
      return clean && notesSaved;
    } catch (error) {
      // Keep the local draft marked as changed so a temporary network error
      // can never discard the owner's work.
      if (error instanceof SaveConflictError) setConflictBase(baseRevision.current);
      return false;
    } finally {
      inflight.current = false;
    }
  };

  // D-10: after a partial save the first refused section's tab takes the focus (its error text is linked from the tab).
  useEffect(() => {
    const section = focusRequest.current;
    if (!section) return;
    focusRequest.current = null;
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab-id="${section}"]`)?.focus();
  });

  // D-09 «Загрузить их версию»: the form shows the server's copy and the user's values stay in «Ваши правки».
  const loadTheirVersion = () => {
    setTheirEdits(draftEdits(history.baseline, history.present));
    setConflictBase(null);
    setStale(false);
    baseRevision.current = revision;
    repairSelections(content);
    dispatch({ type: "sync", content });
  };
  const copyEdit = (edit: DraftEdit) => {
    try {
      void navigator.clipboard?.writeText(edit.value).then(() => setCopiedEdit(edit.path), () => {});
    } catch {}
  };

  // save and step are new functions every render; the listeners read the latest pair through a ref instead of re-subscribing.
  const actionsRef = useRef({ save, step });
  useEffect(() => { actionsRef.current = { save, step }; });

  // Window-level shortcuts only while this window is the active, non-minimized one and no dialog is open (D-10, D-11).
  useEffect(() => {
    if (!active || dialog || closeAsked || accessFailed) return;
    // Сотрудники and Доступ are saved separately; their fields keep the browser's native undo.
    const historyTab = tab !== "employees" && tab !== "promo" && tab !== "access";
    const onKeyDown = (event: KeyboardEvent) => {
      const action = shortcutOf(event);
      if (!action) return;
      if (action !== "save" && !historyTab) return;
      // Save is always taken, even when clean, so the browser's «Сохранить страницу» never opens.
      event.preventDefault();
      if (action === "save") void actionsRef.current.save();
      else actionsRef.current.step(action);
    };
    // Phone keyboards and the Edit menu undo through beforeinput and never fire keydown.
    const onBeforeInput = (event: InputEvent) => {
      if (!historyTab || (event.inputType !== "historyUndo" && event.inputType !== "historyRedo")) return;
      event.preventDefault();
      actionsRef.current.step(event.inputType === "historyUndo" ? "undo" : "redo");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeinput", onBeforeInput);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeinput", onBeforeInput);
    };
  }, [active, dialog, closeAsked, accessFailed, tab]);

  // The desktop asks on × only while this is true, so a dirty employee draft counts too (D-02).
  useEffect(() => { onDirtyChange(dirty || employeeDirty); }, [dirty, employeeDirty, onDirtyChange]);

  // The tab strip scrolls sideways on a phone; keep the active tab in view (a no-op where the strip fits).
  useEffect(() => {
    const strip = tabsRef.current;
    const activeTab = strip?.querySelector<HTMLElement>("button.active");
    if (!strip || !activeTab) return;
    const stripBox = strip.getBoundingClientRect();
    const tabBox = activeTab.getBoundingClientRect();
    strip.scrollLeft += (tabBox.left + tabBox.width / 2) - (stripBox.left + stripBox.width / 2);
  }, [tab]);

  // Reload or leaving the page with unsaved edits: the browser shows its own fixed warning text (D-12).
  // The cleanup also runs when the editor unmounts on close, so a closed editor never blocks leaving.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!popoverOpen) return;
    const away = (event: PointerEvent) => { if (!chipRef.current?.contains(event.target as Node)) setPopoverOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [popoverOpen]);

  // Only a save starts a new saveState, so after ОТМЕНИТЬ or undo back to clean the conflict text would sit over a current editor.
  const conflict = saveState === "conflict" && dirty && conflictBase !== null;
  const refusedShown = refusedSections.filter((section) => changed.includes(section));
  // The chip stays while anything is unsaved, so a compact chip never hides unsaved work (D-09).
  const chipVisible = dirty || saveState === "saving" || saveState === "saved";
  // Derived reset: the popover only lists unsaved sections, so it closes when the draft is clean.
  if (popoverOpen && !dirty) setPopoverOpen(false);
  // A blocked, failed or conflicting save turns the chip red, so a compact chip never hides a failed save (D-10).
  const alarm = dirty && (saveBlocked || saveState === "error" || conflict || refusedShown.length > 0);
  const chipLabel = saveState === "saving" ? saveStatusText("saving")
    : dirty ? `Не сохранено разделов: ${shownChanged.length}${alarm ? (saveBlocked ? ", сохранение невозможно" : ", ошибка сохранения") : ""}`
    : saveStatusText("saved");
  const chipText = saveState === "saving" ? "…" : dirty ? `${alarm ? "!" : ""}${shownChanged.length}` : "✓";
  // UI E3: «Сохранено» only once the server answered (saveState "saved") and nothing was typed since; the text of a failure is the server's reason beside the status.
  const partial = partialResult !== null && dirty ? partialResult : null;
  const status: SaveStatus = saveState === "saving" ? "saving"
    : conflict ? "conflict"
    : saveState === "error" ? "error"
    : partial ? "partial"
    : saveState === "saved" && !dirty ? "saved"
    : dirty ? "dirty"
    : "clean";
  const statusText = saveStatusText(status, partial ?? undefined);

  const header = (
    <header className="editor-header">
      <div>
        <span className="eyebrow">УПРАВЛЕНИЕ СОДЕРЖИМЫМ</span>
        <h1>Редактор PORTIA</h1>
        <p>Изменения сохраняются в общей базе!</p>
      </div>
    </header>
  );
  // STAB-APP-09 fail-closed: whatever the last answer said, no section is shown while the rights are unchecked. The editor stays mounted, so the content draft survives until the check passes or the window closes.
  if (accessFailed) {
    return (
      <div className="content-editor">
        {header}
        <AppDeniedPanel detail={accessCheckFailedText} />
        {closeAsked && (
          <ConfirmDialog
            title="Закрыть редактор?"
            text={`Не сохранено: ${shownChanged.map((id) => sectionLabels[id]).join(", ")}. Права не проверены, сохранить сейчас нельзя.`}
            actions={[
              { label: "НЕ СОХРАНЯТЬ", tone: "danger", onClick: () => { setHandledCloseRequest(closeRequest); onCloseApproved(); } },
              { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setHandledCloseRequest(closeRequest) },
            ]}
            onCancel={() => setHandledCloseRequest(closeRequest)}
          />
        )}
      </div>
    );
  }
  // D-17: the window stays; nothing of the sections is rendered.
  if (noTabs) return <div className="content-editor">{header}<div className="editor-empty">Владелец пока не открыл вам ни одного раздела</div></div>;

  return (
    <ActiveFormatContext.Provider value={{ key: formatTarget?.key ?? null, surface: previewSurface, phonePanelOpen: formatterOpen && window.matchMedia("(max-width: 900px)").matches }}>
    <div className="content-editor">
      {header}

      <nav className="editor-tabs" aria-label="Разделы редактора" ref={tabsRef}>
        {stripTabs.map(([id, label]) => {
          const unsaved = shownChanged.some((section) => section === id);
          const failed = refusedShown.some((section) => section === id);
          const savedNow = partial?.sections.some((section) => section === id) ?? false;
          return (
            <button key={id} type="button" data-tab-id={id} data-save-error={failed || undefined} className={tab === id ? "active" : ""} aria-describedby={failed ? `${errorIdBase}-${id}` : undefined} aria-label={failed ? `${label}, не сохранено` : unsaved ? `${label}, есть несохранённые правки` : savedNow ? `${label}, сохранено` : undefined} onClick={() => switchTab(id)}>
              {label}{unsaved && <i className="tab-dot" aria-hidden="true" />}{savedNow && !unsaved && <i className="tab-saved" aria-hidden="true">✓</i>}
            </button>
          );
        })}
      </nav>
      {refusedShown.map((section) => <p key={section} id={`${errorIdBase}-${section}`} className="editor-section-error" role="alert">{closedMessage([section])} Правки остались в черновике.</p>)}
      {closureNotice && <p className="editor-guidance" role="status">{closureNotice}</p>}
      {stale && dirty && !conflict && (
        <div className="editor-stale-banner" role="status">
          <strong>Запись изменили</strong>
          <span>Показаны ваши правки. Конфликт решится при сохранении.</span>
        </div>
      )}
      {conflict && <ConflictPanel ready={revision !== conflictBase} onLoadTheirs={loadTheirVersion} onReplace={() => void save("replace")} />}
      {theirEdits.length > 0 && (
        <details className="editor-their-edits">
          <summary>Ваши правки ({theirEdits.length})</summary>
          <ul>
            {theirEdits.map((edit) => (
              <li key={edit.path}>
                <span className="editor-their-edit-label">{edit.label}</span>
                <pre className="editor-their-edit-value">{edit.value}</pre>
                <button type="button" className="secondary-control" onClick={() => copyEdit(edit)}>{copiedEdit === edit.path ? "Скопировано" : "Копировать"}</button>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-control" onClick={() => setTheirEdits([])}>Закрыть</button>
        </details>
      )}

      <div className="global-format-launch">
        <button
          type="button"
          disabled={!formatTarget}
          aria-label={formatTarget ? `Оформление текста: ${formatTarget.title}` : "Сначала выберите текстовое поле"}
          aria-expanded={formatterOpen}
          title={formatTarget ? `Оформление: ${formatTarget.title}` : "Сначала выберите текстовое поле"}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            // Phone: the field loses focus once per opening so the keyboard leaves (D-06).
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

      {tab === "viruses" && (
        <div className="virus-editor-layout" ref={layoutRef} data-mobile-view={recordOpen && selectedVirus ? "record" : "list"}>
          <button type="button" className="secondary-control editor-back-to-list" onClick={() => showRecord(false)}>← К списку</button>
          <aside className="editor-record-list">
            <EditorToc items={virusTocItems} onJump={(id) => { openVirus(id); jumpToCard(id); }} />
            {draft.viruses.map((virus, index) => (
              <div className="editor-record-row" id={`card-${virus.id}`} data-sort-index={index} key={virus.id}>
                <OrderDragHandle index={index} label={virus.name || "вирус"} onMove={(from, to) => { setFormatTarget(null); setFormatterOpen(false); changeDraft((next) => moveArrayItem(next.viruses, from, to)); }} />
                <button type="button" className={virus.id === selectedVirusId ? "active" : ""} onClick={() => openVirus(virus.id)}>
                  <strong title={virus.name || "БЕЗ НАЗВАНИЯ"}>{virus.name || "БЕЗ НАЗВАНИЯ"}</strong><small title={virus.code || "БЕЗ КОДА"}>{virus.code || "БЕЗ КОДА"}</small>
                </button>
              </div>
            ))}
            <button className="add-record" type="button" onClick={() => {
              const virus = blankVirus();
              changeDraft((next) => next.viruses.push(virus));
              setSelectedVirusId(virus.id);
              showRecord(true);
            }}>+ ДОБАВИТЬ ВИРУС</button>
          </aside>

          {selectedVirus ? (
            <div className="editor-form virus-editor-form">
              <DossierTabs active={dossierTab} changed={liveDossierChanged} onSelect={selectDossierTab} />
              {dossierTab === "main" && <EditorGroup title="Основные данные">
                <Field label="Название"><input value={selectedVirus.name} onChange={(event) => updateVirus((virus) => { virus.name = event.target.value; })} /></Field>
                <Field label="Код"><input value={selectedVirus.code} onChange={(event) => updateVirus((virus) => { virus.code = event.target.value; })} /></Field>
                <Field label="Статус"><input value={selectedVirus.status} onChange={(event) => updateVirus((virus) => { virus.status = event.target.value; })} /></Field>
                <ImageEditorField label="Фото или GIF после заражения" value={selectedVirus.infectedImage} placement="dossier" maxHint="На странице: максимум 540 × 620 px" uploadState={uploadState} uploadMessage={uploadMessage} onChange={(value) => updateVirus((virus) => { virus.infectedImage = value; })} onUpload={(file) => uploadImage(file, (url) => updateVirus((virus) => { virus.infectedImage = url; }))} />
              </EditorGroup>}

              {dossierTab === "text" && <EditorGroup title="Описание">
                <FormattedTextarea area="lead" label="Внешние характеристики" value={selectedVirus.external} document={draft.formattedText[portiaTextKey.virus(selectedVirus.id, "external")]} formatKey={portiaTextKey.virus(selectedVirus.id, "external")} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.virus(selectedVirus.id, "external"), value, document, (next, text) => updateById(next.viruses, selectedVirus.id, (virus) => { virus.external = text; }))} />
                <FormattedTextarea area="lead" label="Физиологические характеристики" value={selectedVirus.physiology} document={draft.formattedText[portiaTextKey.virus(selectedVirus.id, "physiology")]} formatKey={portiaTextKey.virus(selectedVirus.id, "physiology")} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.virus(selectedVirus.id, "physiology"), value, document, (next, text) => updateById(next.viruses, selectedVirus.id, (virus) => { virus.physiology = text; }))} />
              </EditorGroup>}

              {dossierTab === "text" && <EditorGroup title="Характеристики PPU">
                {(["health", "speed", "abilities"] as const).map((key) => (
                  <FormattedTextarea area="metric" key={key} label={{ health: "Здоровье", speed: "Скорость", abilities: "Способности" }[key]} value={selectedVirus.ppu[key]} document={draft.formattedText[portiaTextKey.virus(selectedVirus.id, `ppu-${key}`)]} formatKey={portiaTextKey.virus(selectedVirus.id, `ppu-${key}`)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.virus(selectedVirus.id, `ppu-${key}`), value, document, (next, text) => updateById(next.viruses, selectedVirus.id, (virus) => { virus.ppu[key] = text; }))} />
                ))}
              </EditorGroup>}

              {dossierTab === "main" && <EditorGroup title="Классификация">
                {([
                  ["danger", "Общий уровень опасности"], ["spread", "Распространение"], ["transmission", "Способ распространения"],
                  ["escapeRisk", "Угроза и риск побега"], ["mind", "Разум"], ["appearance", "Вид / внешность"], ["behavior", "Поведение"],
                ] as [keyof Virus["classification"], string][]).map(([key, label]) => (
                  <ClassificationField key={key} label={label} classificationKey={key} value={selectedVirus.classification[key]} onChange={(value) => updateVirus((virus) => { virus.classification[key] = value; })} />
                ))}
              </EditorGroup>}

              {dossierTab === "mutations" && <EditorGroup title="Мутации" stack>
                {/* A delete shifts the later mutations' index keys, so it closes the format panel. shortcut: mutations have no id, so delete is blocked while an upload runs; an undo mid-upload can still shift its index — give Mutation an id if that matters. */}
                {selectedVirus.mutations.map((mutation, index) => (
                  <div className="nested-editor-card" key={index}>
                    <div className="nested-editor-head"><strong>МУТАЦИЯ {String(index + 1).padStart(2, "0")}</strong><button type="button" disabled={uploadState === "uploading"} onClick={() => { setFormatTarget(null); setFormatterOpen(false); changeDraft((next) => updateById(next.viruses, selectedVirus.id, (virus) => removeMutation(next, virus, index))); }}>Удалить</button></div>
                    <Field label="Название"><input value={mutation.name} onChange={(event) => updateVirus((virus) => { virus.mutations[index].name = event.target.value; })} /></Field>
                    <FormattedTextarea area="mutation" label="Описание" value={mutation.description} document={draft.formattedText[portiaTextKey.mutation(selectedVirus.id, index)]} formatKey={portiaTextKey.mutation(selectedVirus.id, index)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.mutation(selectedVirus.id, index), value, document, (next, text) => updateById(next.viruses, selectedVirus.id, (virus) => { const item = virus.mutations[index]; if (item) item.description = text; }))} />
                    <ImageEditorField label="Изображение или GIF мутации" value={mutation.image} placement="mutation" maxHint="На странице: максимум 420 × 360 px" uploadState={uploadState} uploadMessage={uploadMessage} onChange={(value) => updateVirus((virus) => { virus.mutations[index].image = value; })} onUpload={(file) => uploadImage(file, (url) => updateVirus((virus) => { const item = virus.mutations[index]; if (item) item.image = url; }))} />
                  </div>
                ))}
                <button className="secondary-control" type="button" onClick={() => updateVirus((virus) => virus.mutations.push({ name: "НОВАЯ МУТАЦИЯ", description: "", image: "" }))}>+ ДОБАВИТЬ МУТАЦИЮ</button>
              </EditorGroup>}

              {dossierTab === "logs" && <EditorGroup title="Записи учёных" stack>
                <p className="editor-guidance">Можно оставить досье без записей или добавить до пяти. Если текст не выделен, оформление применяется ко всей записи.</p>
                {selectedVirus.scientistLogs.length === 0 && <div className="editor-empty compact-empty">Записей учёных пока нет.</div>}
                {selectedVirus.scientistLogs.map((log, index) => (
                  <div className="nested-editor-card" key={log.id}>
                    <div className="nested-editor-head"><strong>ЗАПИСЬ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => updateVirus((virus) => { virus.scientistLogs.splice(index, 1); })}>Удалить</button></div>
                    <Field label="Название"><input value={log.title} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].title = event.target.value; })} /></Field>
                    <Field label="Псевдоним учёного"><input value={log.scientist} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].scientist = event.target.value; })} /></Field>
                    <Field label="Уровень доступа записи"><select value={log.lockedLevel} onChange={(event) => updateVirus((virus) => { virus.scientistLogs[index].lockedLevel = Number(event.target.value); })}><option value={2}>II — доступна</option><option value={3}>III — заблокирована</option><option value={4}>IV — заблокирована</option></select></Field>
                    <FormattedTextarea area="scientist" label="Текст записи" value={scientistLogPlainText(log)} document={log.richContent} formatKey={`scientist:${log.id}`} onActivate={activateFormatter} onChange={(value, document) => updateVirus((virus) => { virus.scientistLogs[index].content = value.split(/\n\s*\n/); virus.scientistLogs[index].richContent = document; })} />
                  </div>
                ))}
                <div className="scientist-log-actions"><button className="secondary-control" type="button" disabled={selectedVirus.scientistLogs.length >= MAX_SCIENTIST_LOGS} onClick={() => updateVirus((virus) => virus.scientistLogs.push({ id: makeId("log"), title: `ЗАПИСЬ ${String(virus.scientistLogs.length + 1).padStart(2, "0")}`, scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""], richContent: { runs: [{ text: "" }] } }))}>+ ДОБАВИТЬ ЗАПИСЬ</button><span>{selectedVirus.scientistLogs.length} / {MAX_SCIENTIST_LOGS}</span></div>
              </EditorGroup>}

              <button className="danger-control" type="button" onClick={() => setDialog("recycle")}>ПЕРЕМЕСТИТЬ В КОРЗИНУ</button>
            </div>
          ) : <div className="editor-empty">Добавьте первую запись вируса.</div>}
        </div>
      )}

      {tab === "info" && (
        <div className="editor-form flat-editor-form editor-card-columns">
          <p className="editor-guidance">Каждый блок становится отдельным разделом приложения «Информация». Раздел может содержать подразделы, собранные из блоков в любом порядке.</p>
          <EditorToc items={infoTocItems} onJump={jumpInfo} onAll={(open) => setAllOpen(infoCardIds, open)} />
          {draft.infoSections.length === 0 && <div className="editor-empty">Разделов пока нет. Добавьте первый раздел кнопкой «+ ДОБАВИТЬ РАЗДЕЛ».</div>}
          <SectionColumns items={draft.infoSections} render={(section, index) => (
            <CollapsibleCard key={section.id} id={section.id} sortIndex={index} label={`РАЗДЕЛ ${String(index + 1).padStart(2, "0")}`} title={section.title} open={isOpen(section.id)} onToggle={() => toggleCard(section.id)}
              handle={<OrderDragHandle index={index} label={section.title || "раздел"} itemId={section.id} onMove={(from, to) => { const refocus = keepSectionHandleFocus(section.id); changeDraft((next) => moveArrayItem(next.infoSections, from, to)); refocus(); }} />}
              actions={<div className="nested-editor-actions"><button type="button" onClick={() => { closeFormatterFor(portiaTextKey.info(section.id), ...section.subsections.flatMap((sub) => sub.blocks.map((block) => portiaTextKey.infoBlock(block.id)))); changeDraft((next) => removeInfoSection(next, section.id)); }}>Удалить</button></div>}>
              <Field label="Заголовок"><input value={section.title} onChange={(event) => changeDraft((next) => updateById(next.infoSections, section.id, (item) => { item.title = event.target.value; }))} /></Field>
              <FormattedTextarea area="info" label="Текст" tall value={section.body} document={draft.formattedText[portiaTextKey.info(section.id)]} formatKey={portiaTextKey.info(section.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.info(section.id), value, document, (next, text) => updateById(next.infoSections, section.id, (item) => { item.body = text; }))} />
              <div className="info-subsection-list">
                {section.subsections.map((subsection, subIndex) => (
                  <CollapsibleCard key={subsection.id} id={subsection.id} sortIndex={subIndex} label={`ПОДРАЗДЕЛ ${String(subIndex + 1).padStart(2, "0")}`} title={subsection.title} open={isOpen(subsection.id)} onToggle={() => toggleCard(subsection.id)}
                    handle={<OrderDragHandle index={subIndex} label={subsection.title || "подраздел"} onMove={(from, to) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.section; if (target) moveArrayItem(target.subsections, from, to); })} />}
                    actions={<div className="nested-editor-actions"><button type="button" onClick={() => { subsection.blocks.forEach((block) => closeFormatterFor(portiaTextKey.infoBlock(block.id))); changeDraft((next) => removeInfoSubsection(next, section.id, subsection.id)); }}>Удалить</button></div>}>
                    <Field label="Заголовок подраздела"><input maxLength={300} value={subsection.title} onChange={(event) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) target.title = event.target.value; })} /></Field>
                    <div className="info-block-list">
                      {subsection.blocks.map((block, blockIndex) => (
                        <CollapsibleCard key={block.id} id={block.id} sortIndex={blockIndex} label={infoBlockHeads[block.type].title} title={block.type === "text" ? block.text.split("\n").map((line) => line.trim()).find(Boolean) : undefined} open={isOpen(block.id)} onToggle={() => toggleCard(block.id)}
                          handle={<OrderDragHandle index={blockIndex} label={infoBlockHeads[block.type].label} onMove={(from, to) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) moveArrayItem(target.blocks, from, to); })} />}
                          actions={<div className="nested-editor-actions"><button type="button" onClick={() => { closeFormatterFor(portiaTextKey.infoBlock(block.id)); changeDraft((next) => removeInfoBlock(next, subsection.id, block.id)); }} disabled={block.type === "photo" && uploadState === "uploading"}>Удалить</button></div>}>
                          {block.type === "text" && <FormattedTextarea area="info" label="Текст" tall value={block.text} document={draft.formattedText[portiaTextKey.infoBlock(block.id)]} formatKey={portiaTextKey.infoBlock(block.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.infoBlock(block.id), value, document, (next, text) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) updateById(target.blocks, block.id, (item) => { if (item.type === "text") item.text = text; }); })} />}
                          {block.type === "video" && <YoutubeField videoId={block.videoId} onChange={(videoId) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) updateById(target.blocks, block.id, (item) => { if (item.type === "video") item.videoId = videoId; }); })} />}
                          {block.type === "photo" && <ImageEditorField label="Фото" value={block.url} placement="guide" maxHint="На странице: до 820 px в ширину" uploadState={uploadState} uploadMessage={uploadMessage} onChange={(value) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) updateById(target.blocks, block.id, (item) => { if (item.type === "photo") item.url = value; }); })} onUpload={(file) => uploadImage(file, (url) => changeDraft((next) => { const target = findInfo(next.infoSections, subsection.id)?.subsection; if (target) updateById(target.blocks, block.id, (item) => { if (item.type === "photo") item.url = url; }); }))} />}
                          {block.type === "table" && <TableBlockEditor blockId={block.id} rows={block.rows} onEdit={(edit) => changeDraft((next) => editTableRows(next, subsection.id, block.id, edit))} />}
                        </CollapsibleCard>
                      ))}
                    </div>
                    <div className="scientist-log-actions">
                      <div className="limit-buttons">
                        <button className="secondary-control limit-add" type="button" disabled={subsection.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${subsection.id}`} onClick={() => { const id = makeId("block"); changeDraft((next) => { findInfo(next.infoSections, subsection.id)?.subsection?.blocks.push({ id, type: "text", text: "" }); }); setOpen([id], true); }}>+ ТЕКСТ</button>
                        <button className="secondary-control limit-add" type="button" disabled={subsection.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${subsection.id}`} onClick={() => { const id = makeId("block"); changeDraft((next) => { findInfo(next.infoSections, subsection.id)?.subsection?.blocks.push({ id, type: "table", rows: [{ id: makeId("row"), key: "", value: "" }] }); }); setOpen([id], true); }}>+ ТАБЛИЦА</button>
                        <button className="secondary-control limit-add" type="button" disabled={subsection.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${subsection.id}`} onClick={() => { const id = makeId("block"); changeDraft((next) => { findInfo(next.infoSections, subsection.id)?.subsection?.blocks.push({ id, type: "video", videoId: "" }); }); setOpen([id], true); }}>+ ВИДЕО</button>
                        <button className="secondary-control limit-add" type="button" disabled={subsection.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${subsection.id}`} onClick={() => { const id = makeId("block"); changeDraft((next) => { findInfo(next.infoSections, subsection.id)?.subsection?.blocks.push({ id, type: "photo", url: "" }); }); setOpen([id], true); }}>+ ФОТО</button>
                      </div>
                      <LimitNote id={`limit-blocks-${subsection.id}`} count={subsection.blocks.length} max={MAX_BLOCKS} />
                    </div>
                  </CollapsibleCard>
                ))}
              </div>
              <div className="scientist-log-actions">
                <button className="secondary-control limit-add" type="button" disabled={section.subsections.length >= MAX_SUBSECTIONS} aria-describedby={`limit-subsections-${section.id}`} onClick={() => { const id = makeId("info"); changeDraft((next) => { updateById(next.infoSections, section.id, (item) => { item.subsections.push({ id, title: "НОВЫЙ ПОДРАЗДЕЛ", blocks: [] }); }); }); setOpen([id], true); }}>+ ПОДРАЗДЕЛ</button>
                <LimitNote id={`limit-subsections-${section.id}`} count={section.subsections.length} max={MAX_SUBSECTIONS} />
              </div>
            </CollapsibleCard>
          )} />
          <button className="secondary-control" type="button" onClick={() => { const id = makeId("info"); changeDraft((next) => next.infoSections.push({ id, title: "НОВЫЙ РАЗДЕЛ", body: "", subsections: [] })); setOpen([id], true); }}>+ ДОБАВИТЬ РАЗДЕЛ</button>
        </div>
      )}

      {tab === "guide" && (
        <div className="editor-form flat-editor-form editor-card-columns">
          <p className="editor-guidance">Справочник на рабочем столе состоит из разделов, в разделах лежат карточки-плитки. Нажатие на плитку открывает страницу карточки из блоков в любом порядке. Подразделы раздела — его карточки-плитки. Заметку раздела видят только редакторы с доступом к вкладке.</p>
          <SectionAddBar status={notes.status} onCreate={(title, note) => {
            const id = makeId("guide");
            changeDraft((next) => { next.guideSections.push({ id, title: title || "НОВЫЙ РАЗДЕЛ", photo: "", cards: [] }); });
            if (note) setNote("guide", id, note);
            setOpen([id], true);
            requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`#card-${id} > .nested-editor-body input`)?.focus());
          }} />
          {notesNotice?.tab === "guide" && (
            <div className="editor-note-notice" role="alert">
              <span>{notesNotice.kind === "conflict" ? notesConflictText : notesSaveFailedText}</span>
              {notesNotice.kind === "conflict" && <button type="button" className="secondary-control" onClick={() => void reloadNotes()}>Загрузить заметки</button>}
            </div>
          )}
          <EditorToc items={guideTocItems} onJump={jumpGuide} onAll={(open) => setAllOpen(guideCardIds, open)} />
          {draft.guideSections.length === 0 && <div className="editor-empty">Разделов пока нет. Добавьте первый раздел кнопкой «+ ДОБАВИТЬ РАЗДЕЛ».</div>}
          <SectionColumns items={draft.guideSections} render={(section, index) => (
            <CollapsibleCard key={section.id} id={section.id} sortIndex={index} label={`РАЗДЕЛ ${guideNo(index)}`} title={section.title} open={isOpen(section.id)} onToggle={() => toggleCard(section.id)} cardProps={{ "data-drop-group": section.id }}
              handle={<OrderDragHandle index={index} label={section.title || "раздел"} itemId={section.id} onMove={(from, to) => { const refocus = keepSectionHandleFocus(section.id); changeDraft((next) => moveArrayItem(next.guideSections, from, to)); refocus(); }} />}
              actions={<div className="nested-editor-actions"><button type="button" aria-label={`Удалить раздел «${section.title || "Без названия"}» вместе с карточками`} onClick={() => { closeFormatterFor(...section.cards.flatMap((card) => card.blocks.map((block) => portiaTextKey.guideBlock(block.id)))); changeDraft((next) => removeGuideSection(next, section.id)); dropNote("guide", section.id); }}>Удалить</button></div>}>
              <Field label="Заголовок раздела"><input maxLength={300} value={section.title} onChange={(event) => changeDraft((next) => updateById(next.guideSections, section.id, (item) => { item.title = event.target.value; }))} /></Field>
              <EditorNoteField value={noteOf("guide", section.id)} status={notes.status} onChange={(text) => setNote("guide", section.id, text)} />
              <ImageEditorField label="Фото раздела" value={section.photo} placement="guide" maxHint="За заголовком раздела: низкая полоса во всю ширину" removeLabel="Убрать фото" uploadState={uploadState} uploadMessage={uploadMessage}
                onChange={(value) => changeDraft((next) => updateById(next.guideSections, section.id, (item) => { item.photo = value; }))}
                onUpload={(file) => uploadImage(file, (url) => changeDraft((next) => updateById(next.guideSections, section.id, (item) => { item.photo = url; })))} />
              <div className="info-subsection-list" data-sort-group="guide-cards" data-group-id={section.id}>
                {section.cards.length === 0 && <div className="editor-empty compact-empty">В разделе нет карточек. Добавьте первую кнопкой «+ ДОБАВИТЬ КАРТОЧКУ».</div>}
                {section.cards.map((card, cardIndex) => (
                  <CollapsibleCard key={card.id} id={card.id} sortIndex={cardIndex} label={`КАРТОЧКА ${guideNo(cardIndex)}`} title={card.title} open={isOpen(card.id)} onToggle={() => toggleCard(card.id)}
                    handle={<OrderDragHandle index={cardIndex} label={card.title || "карточка"} itemId={card.id} onMoveAcross={(groupId, toIndex) => changeDraft((next) => moveGuideCard(next, card.id, groupId, toIndex))}
                      onMove={(from, to) => {
                      // Keyboard only: ArrowUp on the first card or ArrowDown on the last goes to the neighbouring section (D-11); pointer drags never pass an out-of-range target.
                      const neighbour = to < 0 ? draft.guideSections[index - 1] : to >= section.cards.length ? draft.guideSections[index + 1] : undefined;
                      if (!neighbour) { changeDraft((next) => { const target = findGuide(next.guideSections, section.id)?.section; if (target) moveArrayItem(target.cards, from, to); }); return; }
                      changeDraft((next) => moveGuideCard(next, card.id, neighbour.id, to < 0 ? Number.MAX_SAFE_INTEGER : 0));
                      setOpen([neighbour.id], true);
                      requestAnimationFrame(() => document.getElementById(`card-${card.id}`)?.querySelector<HTMLElement>(":scope > .nested-editor-head .order-drag-handle")?.focus());
                    }} />}
                    actions={<div className="nested-editor-actions"><button type="button" aria-label={`Удалить карточку «${card.title || "Без названия"}»`} onClick={() => { closeFormatterFor(...card.blocks.map((block) => portiaTextKey.guideBlock(block.id))); changeDraft((next) => removeGuideCard(next, card.id)); }}>Удалить</button></div>}>
                    <Field label="Заголовок карточки"><input maxLength={300} value={card.title} onChange={(event) => changeDraft((next) => { const target = findGuide(next.guideSections, card.id)?.card; if (target) target.title = event.target.value; })} /></Field>
                    <ImageEditorField label="Обложка" value={card.cover} placement="guide" maxHint="На плитке: 4:3, края обрезаются" removeLabel="Убрать обложку" uploadState={uploadState} uploadMessage={uploadMessage}
                      onChange={(value) => changeDraft((next) => { const target = findGuide(next.guideSections, card.id)?.card; if (target) target.cover = value; })}
                      onUpload={(file) => uploadImage(file, (url) => changeDraft((next) => { const target = findGuide(next.guideSections, card.id)?.card; if (target) target.cover = url; }))} />
                    <div className="info-block-list">
                      {card.blocks.map((block, blockIndex) => (
                        <CollapsibleCard key={block.id} id={block.id} sortIndex={blockIndex} label={guideBlockHeads[block.type].title} title={guideBlockTitle(block)} open={isOpen(block.id)} onToggle={() => toggleCard(block.id)}
                          handle={<OrderDragHandle index={blockIndex} label={guideBlockHeads[block.type].label} onMove={(from, to) => changeDraft((next) => { const target = findGuide(next.guideSections, card.id)?.card; if (target) moveArrayItem(target.blocks, from, to); })} />}
                          actions={<div className="nested-editor-actions"><button type="button" onClick={() => { closeFormatterFor(portiaTextKey.guideBlock(block.id)); changeDraft((next) => removeGuideBlock(next, card.id, block.id)); }} disabled={block.type === "photo" && uploadState === "uploading"}>Удалить</button></div>}>
                          {block.type === "heading" && <Field label="Заголовок"><input maxLength={300} value={block.text} onChange={(event) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === "heading") item.text = event.target.value; })} /></Field>}
                          {block.type === "text" && <FormattedTextarea area="info" label="Текст" tall value={block.text} document={draft.formattedText[portiaTextKey.guideBlock(block.id)]} formatKey={portiaTextKey.guideBlock(block.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.guideBlock(block.id), value, document, (next, text) => { const target = findGuideBlock(next, card.id, block.id); if (target?.type === "text") target.text = text; })} />}
                          {block.type === "table" && <TableBlockEditor blockId={block.id} rows={block.rows} onEdit={(edit) => changeDraft((next) => editGuideTableRows(next, card.id, block.id, edit))} />}
                          {block.type === "photo" && (
                            <>
                              <ImageEditorField label="Фото" value={block.url} placement="guide" maxHint="На странице: во всю ширину, до 820 px" uploadState={uploadState} uploadMessage={uploadMessage}
                                onChange={(value) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === "photo") item.url = value; })}
                                onUpload={(file) => uploadImage(file, (url) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === "photo") item.url = url; }))} />
                              <Field label="Подпись"><input maxLength={300} value={block.caption} onChange={(event) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === "photo") item.caption = event.target.value; })} /></Field>
                            </>
                          )}
                          {block.type === "video" && <YoutubeField videoId={block.videoId} onChange={(videoId) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === "video") item.videoId = videoId; })} />}
                          {block.type === "callout" && (
                            <>
                              <Field label="Подпись врезки"><input maxLength={300} value={block.label} onChange={(event) => writeGuideBlock(card.id, block.id, (item) => { if (item.type === "callout") item.label = event.target.value; })} /></Field>
                              <FormattedTextarea area="info" label="Текст врезки" tall value={block.text} document={draft.formattedText[portiaTextKey.guideBlock(block.id)]} formatKey={portiaTextKey.guideBlock(block.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.guideBlock(block.id), value, document, (next, text) => { const target = findGuideBlock(next, card.id, block.id); if (target?.type === "callout") target.text = text; })} />
                            </>
                          )}
                        </CollapsibleCard>
                      ))}
                    </div>
                    <div className="scientist-log-actions">
                      <div className="limit-buttons">
                        <button className="secondary-control limit-add" type="button" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: "heading", text: "" }))}>+ ЗАГОЛОВОК</button>
                        <button className="secondary-control limit-add" type="button" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: "text", text: "" }))}>+ ТЕКСТ</button>
                        <button className="secondary-control limit-add" type="button" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: "table", rows: [{ id: makeId("row"), key: "", value: "" }] }))}>+ ТАБЛИЦА</button>
                        <button className="secondary-control limit-add" type="button" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: "photo", url: "", caption: "" }))}>+ ФОТО</button>
                        <button className="secondary-control limit-add" type="button" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: "video", videoId: "" }))}>+ ВИДЕО</button>
                        <button className="secondary-control limit-add" type="button" disabled={card.blocks.length >= MAX_BLOCKS} aria-describedby={`limit-blocks-${card.id}`} onClick={() => addGuideBlock(card.id, (id) => ({ id, type: "callout", label: "", text: "" }))}>+ ВРЕЗКА</button>
                      </div>
                      <LimitNote id={`limit-blocks-${card.id}`} count={card.blocks.length} max={MAX_BLOCKS} />
                    </div>
                  </CollapsibleCard>
                ))}
              </div>
              <div className="scientist-log-actions">
                <button className="secondary-control limit-add" type="button" disabled={section.cards.length >= MAX_SUBSECTIONS} aria-describedby={`limit-cards-${section.id}`} onClick={() => { const id = makeId("card"); changeDraft((next) => { updateById(next.guideSections, section.id, (item) => { item.cards.push({ id, title: "НОВАЯ КАРТОЧКА", cover: "", blocks: [] }); }); }); setOpen([id], true); }}>+ ДОБАВИТЬ КАРТОЧКУ</button>
                <LimitNote id={`limit-cards-${section.id}`} count={section.cards.length} max={MAX_SUBSECTIONS} />
              </div>
            </CollapsibleCard>
          )} />
        </div>
      )}

      {tab === "broadcasts" && (
        <div className="editor-form flat-editor-form editor-card-columns">
          <p className="editor-guidance">Публикуйте новости, еженедельные квесты и задачи. Выключенные записи сохраняются как черновики.</p>
          <nav className="editor-tabs dossier-tabs" aria-label="Разделы сводки">
            {([["news", "Новости"], ["quests", "Квесты"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={broadcastEditorTab === id ? "active" : ""} aria-pressed={broadcastEditorTab === id} onClick={() => selectBroadcastTab(id)}>
                {label} {draft.broadcasts.filter((item) => broadcastTabOf(item.type) === id).length}
              </button>
            ))}
          </nav>
          <EditorToc items={broadcastTocItems} onJump={(id) => { setOpen([id], true); jumpToCard(id); }} onAll={(open) => setAllOpen(broadcastTocItems.map((item) => item.id), open)} />
          <button className="secondary-control" type="button" onClick={() => {
            const id = makeId("broadcast");
            revealBroadcast.current = { id, field: "title" };
            setOpen([id], true);
            setFormatTarget(null);
            setFormatterOpen(false);
            changeDraft((next) => addBroadcast(next, id, broadcastEditorTab === "news" ? "news" : "quest"));
          }}>{broadcastEditorTab === "news" ? "+ НОВАЯ НОВОСТЬ" : "+ НОВЫЙ КВЕСТ"}</button>
          {shownBroadcasts.length === 0 && <div className="editor-empty">{broadcastEditorTab === "news" ? "Новостей пока нет." : "Квестов и задач пока нет."}</div>}
          {shownBroadcasts.map((broadcast, index) => (
            <CollapsibleCard key={broadcast.id} id={broadcast.id} label={`${broadcast.type === "news" ? "НОВОСТЬ" : broadcast.type === "quest" ? "КВЕСТ" : "ЗАДАЧА"} ${String(index + 1).padStart(2, "0")}`} title={broadcast.title} open={isOpen(broadcast.id)} onToggle={() => toggleCard(broadcast.id)} cardProps={{ "data-broadcast-id": broadcast.id }}
              actions={<div className="nested-editor-actions"><button type="button" onClick={() => { closeFormatterFor(portiaTextKey.broadcast(broadcast.id)); changeDraft((next) => removeBroadcast(next, broadcast.id)); }}>Удалить</button></div>}>
              <Field label="Тип"><select data-broadcast-type value={broadcast.type} onChange={(event) => {
                const type = event.target.value as Broadcast["type"];
                changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => {
                  item.type = type;
                  // D-19: switching back does not restore it; undo restores the whole previous card.
                  if (type !== "news") item.important = false;
                }));
                // A card that changes category would vanish from this list, so the view follows it.
                if (broadcastTabOf(type) !== broadcastEditorTab) {
                  revealBroadcast.current = { id: broadcast.id, field: "type" };
                  setOpen([broadcast.id], true);
                  selectBroadcastTab(broadcastTabOf(type));
                }
              }}><option value="quest">Еженедельный квест</option><option value="task">Задача</option><option value="news">Новость</option></select></Field>
              <Field label="Заголовок"><input data-broadcast-title value={broadcast.title} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.title = event.target.value; }))} /></Field>
              <FormattedTextarea area="broadcast" label="Текст" tall value={broadcast.body} document={draft.formattedText[portiaTextKey.broadcast(broadcast.id)]} formatKey={portiaTextKey.broadcast(broadcast.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.broadcast(broadcast.id), value, document, (next, text) => updateById(next.broadcasts, broadcast.id, (item) => { item.body = text; }))} />
              {broadcast.type === "quest" && (
                <>
                  <Field label="Дата начала"><input type="date" value={broadcast.startsAt} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.startsAt = event.target.value; }))} /></Field>
                  <Field label="Дата окончания" error={questDateError(broadcast) ? "Окончание раньше начала" : undefined} errorId={`ends-error-${broadcast.id}`}><input type="date" data-broadcast-ends aria-invalid={questDateError(broadcast) || undefined} aria-describedby={questDateError(broadcast) ? `ends-error-${broadcast.id}` : undefined} value={broadcast.endsAt} min={broadcast.startsAt || undefined} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.endsAt = event.target.value; }))} /></Field>
                  <Field label="Условия" wide><textarea value={broadcast.conditions} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.conditions = event.target.value; }))} /></Field>
                </>
              )}
              <label className="publish-toggle"><input type="checkbox" checked={broadcast.published} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.published = event.target.checked; }))} /><span>Показывать посетителям</span></label>
              {broadcast.type === "news" && <label className="publish-toggle"><input type="checkbox" checked={broadcast.important} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.important = event.target.checked; }))} /><span>Важная новость — выделить и закрепить сверху</span></label>}
            </CollapsibleCard>
          ))}
        </div>
      )}

      {tab === "recycle" && (
        <div className="virus-editor-layout recycle-editor-layout" ref={layoutRef} data-mobile-view={recordOpen && (selectedRecycledVirus || selectedRecycleFile) ? "record" : "list"}>
          <button type="button" className="secondary-control editor-back-to-list" onClick={() => showRecord(false)}>← К списку</button>
          <aside className="editor-record-list">
            <EditorToc items={recycleTocItems} onJump={(key) => { openRecycleEntry(key); jumpToCard(key); }} />
            {orderedRecycleKeys.map((key, index) => {
              const isVirus = key.startsWith("virus:");
              const id = key.slice(key.indexOf(":") + 1);
              const virus = isVirus ? draft.recycledViruses.find((item) => item.id === id) : null;
              const file = !isVirus ? draft.recycleFiles.find((item) => item.id === id) : null;
              if (!virus && !file) return null;
              const title = virus?.name || file?.name || "БЕЗ ИМЕНИ";
              const kindText = virus ? "ВИРУС В КОРЗИНЕ" : file!.kind === "virus" ? "ФАЙЛ ВИРУСА" : file!.kind === "image" ? "ИЗОБРАЖЕНИЕ" : "ТЕКСТОВЫЙ ФАЙЛ";
              return <div className="editor-record-row" id={`card-${key}`} data-sort-index={index} key={key}>
                <OrderDragHandle index={index} label={title} onMove={(from, to) => changeDraft((next) => { const order = recycleKeys(next); moveArrayItem(order, from, to); next.recycleOrder = order; })} />
                <button type="button" className={(virus ? virus.id === shownRecycledVirusId : file!.id === shownRecycleFileId) ? "active" : ""} onClick={() => openRecycleEntry(key)}>
                  <strong title={title}>{title}</strong><small title={kindText}>{kindText}</small>
                </button>
              </div>;
            })}
            <button className="add-record" type="button" onClick={() => {
              const file = blankRecycleFile();
              changeDraft((next) => { next.recycleFiles.push(file); next.recycleOrder = [...recycleKeys(next).filter((key) => key !== `file:${file.id}`), `file:${file.id}`]; });
              setSelectedRecycleFileId(file.id);
              setSelectedRecycledVirusId("");
              showRecord(true);
            }}>+ ДОБАВИТЬ ФАЙЛ</button>
            <button className="add-record" type="button" onClick={() => {
              const virus = blankVirus();
              changeDraft((next) => { next.recycledViruses ??= []; next.recycledViruses.push(virus); next.recycleOrder = [...recycleKeys(next).filter((key) => key !== `virus:${virus.id}`), `virus:${virus.id}`]; });
              setSelectedRecycledVirusId(virus.id);
              setSelectedRecycleFileId("");
              showRecord(true);
            }}>+ НАПИСАТЬ ВИРУС</button>
          </aside>

          {selectedRecycledVirus ? (
            <ArchivedVirusEditor
              virus={selectedRecycledVirus}
              dossierChanged={archivedDossierChanged}
              uploadState={uploadState} uploadMessage={uploadMessage}
              onUpload={uploadImage}
              onChange={updateRecycledVirus}
              // Index-keyed formatting shifts on delete, so the target is cleared as in the live list.
              onRemoveMutation={(index) => { setFormatTarget(null); setFormatterOpen(false); changeDraft((next) => updateById(next.recycledViruses ?? [], selectedRecycledVirus.id, (virus) => removeMutation(next, virus, index))); }}
              // No confirm(): embedded browsers may answer it "no" without showing it, and a restore only
              // changes the unsaved draft and can be undone by moving the virus back.
              onRestore={() => {
                changeDraft((next) => {
                  const restored = next.recycledViruses.find((virus) => virus.id === selectedRecycledVirus.id);
                  if (!restored) return;
                  next.viruses.push(restored);
                  next.recycledViruses = next.recycledViruses.filter((virus) => virus.id !== restored.id);
                  next.recycleOrder = recycleKeys(next);
                });
                setSelectedVirusId(selectedRecycledVirus.id);
                setSelectedRecycledVirusId("");
                switchTab("viruses");
                showRecord(true);
              }}
              onDelete={() => setDialog("delete")}
              restoreBlocked={closedSections.includes("viruses")}
            />
          ) : selectedRecycleFile ? (
            <div className="editor-form">
              <p className="editor-guidance">Посетители могут только открыть файл. Создание, изменение и удаление доступны здесь владельцу.</p>
              <EditorGroup title="Свойства файла">
                <Field label="Имя файла"><input value={selectedRecycleFile.name} onChange={(event) => updateRecycleFile((file) => { file.name = event.target.value; })} /></Field>
                <Field label="Исходное расположение"><input value={selectedRecycleFile.location} onChange={(event) => updateRecycleFile((file) => { file.location = event.target.value; })} /></Field>
                <Field label="Тип файла">
                  <select value={selectedRecycleFile.kind} onChange={(event) => updateRecycleFile((file) => { file.kind = event.target.value as RecycleFile["kind"]; })}>
                    <option value="virus">Файл вируса</option>
                    <option value="text">Текстовый документ</option>
                    <option value="image">Фотография</option>
                  </select>
                </Field>
                {selectedRecycleFile.kind === "virus" && (
                  <Field label="Связанный вирус">
                    <select value={selectedRecycleFile.virusId} onChange={(event) => updateRecycleFile((file) => { file.virusId = event.target.value; })}>
                      <option value="">Без связи</option>
                      {draft.viruses.map((virus) => <option key={virus.id} value={virus.id}>{virus.name} / {virus.code}</option>)}
                    </select>
                  </Field>
                )}
              </EditorGroup>

              {selectedRecycleFile.kind === "image" && (
                <EditorGroup title="Фотография" stack>
                  <ImageEditorField label="Фотография или GIF" value={selectedRecycleFile.image} placement="recycle" maxHint="На странице: максимум 800 × 720 px" uploadState={uploadState} uploadMessage={uploadMessage} onChange={(value) => updateRecycleFile((file) => { file.image = value; })} onUpload={(upload) => uploadImage(upload, (url) => updateRecycleFile((file) => {
                    file.image = url;
                    if (!file.name || file.name === "НОВЫЙ_ФАЙЛ.txt") file.name = upload.name;
                  }))} />
                </EditorGroup>
              )}

              <EditorGroup title={selectedRecycleFile.kind === "image" ? "Подпись" : selectedRecycleFile.kind === "virus" ? "Дополнительный текст" : "Содержимое"} stack>
                <FormattedTextarea area={selectedRecycleFile.kind === "image" ? "caption" : "trash"} label={selectedRecycleFile.kind === "image" ? "Описание фотографии" : "Текст файла"} tall value={selectedRecycleFile.content} document={draft.formattedText[portiaTextKey.recycle(selectedRecycleFile.id)]} formatKey={portiaTextKey.recycle(selectedRecycleFile.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.recycle(selectedRecycleFile.id), value, document, (next, text) => updateById(next.recycleFiles, selectedRecycleFile.id, (file) => { file.content = text; }))} />
              </EditorGroup>

              <button className="danger-control" type="button" onClick={() => setDialog("delete-file")}>УДАЛИТЬ ЭТОТ ФАЙЛ</button>
            </div>
          ) : <div className="editor-empty">Корзина пуста. Добавьте файл или создайте полную запись вируса.</div>}
        </div>
      )}

      {tab === "search" && (
        <div className="editor-form flat-editor-form compact-editor">
          <p className="editor-guidance">Каждая строка станет ненавязчивой рекомендацией под строкой глобального поиска.</p>
          <FormattedTextarea area="search" label="Рекомендации" tall value={draft.searchRecommendations.join("\n")} document={draft.formattedText[portiaTextKey.searchRecommendations]} formatKey={portiaTextKey.searchRecommendations} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.searchRecommendations, value, document, (next, text) => { next.searchRecommendations = text.split("\n"); })} />
          <div className="recommendation-order-list" aria-label="Порядок рекомендаций">
            {draft.searchRecommendations.map((recommendation, index) => <div className="recommendation-order-row" data-sort-index={index} key={`${recommendation}:${draft.searchRecommendations.slice(0, index).filter((item) => item === recommendation).length}`}><OrderDragHandle index={index} label={recommendation || "рекомендация"} onMove={(from, to) => changeDraft((next) => {
              const currentText = next.searchRecommendations.join("\n");
              const reordered = reorderRichTextLines(currentText, next.formattedText[portiaTextKey.searchRecommendations], from, to);
              next.searchRecommendations = reordered.text.split("\n");
              next.formattedText[portiaTextKey.searchRecommendations] = reordered.document;
            })} /><span title={recommendation}><small>{String(index + 1).padStart(2, "0")}</small>{recommendation || "ПУСТАЯ СТРОКА"}</span></div>)}
          </div>
        </div>
      )}

      {tab === "assistant" && (
        <div className="editor-form flat-editor-form assistant-editor">
          <p className="editor-guidance">Каждая строка — отдельный совет. В одной строке можно совместить текст и GIF.</p>
          <div className="assistant-switches">
            <label className="publish-toggle"><input type="checkbox" checked={draft.assistantIdleEnabled} onChange={(event) => changeDraft((next) => { next.assistantIdleEnabled = event.target.checked; })} /><span>Фразы при долгом бездействии</span></label>
            <label className="publish-toggle"><input type="checkbox" checked={draft.assistantActivityEnabled} onChange={(event) => changeDraft((next) => { next.assistantActivityEnabled = event.target.checked; })} /><span>Фразы во время активности</span></label>
          </div>
          <FormattedTextarea area="assistant" label="Советы помощника" tall value={draft.assistantAdvice.join("\n")} document={draft.formattedText[portiaTextKey.assistantAdvice]} formatKey={portiaTextKey.assistantAdvice} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.assistantAdvice, value, document, (next, text) => { next.assistantAdvice = text.split("\n"); })} />
          <FormattedTextarea area="assistant" label="Фразы после исчерпания терпения — по одной на строку" tall value={(draft.assistantOffendedPhrases ?? [draft.assistantOffendedPhrase]).join("\n")} document={draft.formattedText[portiaTextKey.assistantOffended]} formatKey={portiaTextKey.assistantOffended} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.assistantOffended, value, document, (next, text) => { next.assistantOffendedPhrases = text.split("\n"); next.assistantOffendedPhrase = next.assistantOffendedPhrases.find((item) => item.trim()) ?? ""; })} />
          <Field label="Варианты терпения в секундах — через запятую">
            <input value={(draft.assistantPatienceVariants ?? [draft.assistantPatienceSeconds]).join(", ")} onChange={(event) => changeDraft((next) => {
              next.assistantPatienceVariants = event.target.value.split(/[,;\s]+/).map(Number).filter((value) => Number.isFinite(value) && value > 0);
              next.assistantPatienceSeconds = next.assistantPatienceVariants[0] ?? 3;
            })} placeholder="Например: 3, 5, 8" />
          </Field>
          <FormattedTextarea area="assistant" label="Фразы при долгом бездействии — по одной на строку" tall value={draft.assistantIdlePhrases.join("\n")} document={draft.formattedText[portiaTextKey.assistantIdle]} formatKey={portiaTextKey.assistantIdle} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.assistantIdle, value, document, (next, text) => { next.assistantIdlePhrases = text.split("\n"); })} />
          <FormattedTextarea area="assistant" label="Фразы во время активности — по одной на строку" tall value={draft.assistantActivityPhrases.join("\n")} document={draft.formattedText[portiaTextKey.assistantActivity]} formatKey={portiaTextKey.assistantActivity} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.assistantActivity, value, document, (next, text) => { next.assistantActivityPhrases = text.split("\n"); })} />
          <Field label="Когда автоматически показывать фразы">
            <select value={draft.assistantAutoTimingMode} onChange={(event) => changeDraft((next) => { next.assistantAutoTimingMode = event.target.value as PortiaContent["assistantAutoTimingMode"]; })}>
              <option value="fixed">Через одинаковое время</option>
              <option value="random">Через случайное время</option>
            </select>
          </Field>
          {draft.assistantAutoTimingMode === "fixed" ? (
            <Field label="Интервал между фразами, секунд">
              <input type="number" min="1" max="3600" step="1" value={draft.assistantAutoIntervalSeconds} onChange={(event) => changeDraft((next) => { next.assistantAutoIntervalSeconds = Number(event.target.value); })} />
            </Field>
          ) : (
            <div className="editor-field-grid">
              <Field label="Минимум, секунд"><input type="number" min="1" max="3600" step="1" value={draft.assistantAutoMinSeconds} onChange={(event) => changeDraft((next) => { next.assistantAutoMinSeconds = Number(event.target.value); })} /></Field>
              <Field label="Максимум, секунд"><input type="number" min="1" max="3600" step="1" value={draft.assistantAutoMaxSeconds} onChange={(event) => changeDraft((next) => { next.assistantAutoMaxSeconds = Number(event.target.value); })} /></Field>
            </div>
          )}
          <p className="editor-guidance">Если за выбранный промежуток пользователь ничего не делал, Вивьян выберет фразу бездействия. Если он нажимал, печатал, прокручивал страницу или двигал указатель — фразу активности</p>
        </div>
      )}

      {tab === "employees" && <EmployeeProfilesEditor onSaved={onEmployeeSaved} onRemoved={onEmployeeRemoved} uploadState={uploadState} uploadMessage={uploadMessage} onUpload={uploadImage} onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}

      {tab === "promo" && openTabs.includes("promo") && <PromotionEditor visible={active && !minimized} canManageEditors={canManageEditors} />}

      {tab === "access" && canManageEditors && <EditorAccessManager />}
      {formatterOpen && formatTarget && !minimized && createPortal(<FloatingTextFormatPanel key={formatTarget.key} target={formatTarget} previewSurface={previewSurface} onPreviewSurface={setPreviewSurface} onUpdate={setFormatTarget} onBatch={runBatch} onClose={() => setFormatterOpen(false)} />, document.getElementById("desktop") ?? document.body)}
      <p className="sr-only" role="status" aria-live="polite">{`${statusText}${dirty ? `${status === "dirty" ? ":" : ". Не сохранено:"} ${shownChanged.map((id) => sectionLabels[id]).join(", ")}` : ""}`}</p>
      {chipVisible && (
        <div
          className="editor-save-chip"
          data-dirty={dirty || undefined}
          data-blocked={alarm || undefined}
          ref={chipRef}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !popoverOpen) return;
            event.preventDefault();
            event.stopPropagation();
            setPopoverOpen(false);
            chipRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
          }}
        >
          <button type="button" aria-label={chipLabel} title={`Не сохранено: ${shownChanged.length}`} aria-expanded={popoverOpen} aria-haspopup="dialog" aria-controls={popoverId} onClick={() => setPopoverOpen((open) => !open)}>{chipText}</button>
          {popoverOpen && dirty && (
            <div className="editor-save-popover" id={popoverId} role="dialog" aria-label="Несохранённые изменения">
              <strong>НЕ СОХРАНЕНО</strong>
              <ul>{shownChanged.map((id) => <li key={id} title={sectionLabels[id]}>{sectionLabels[id]}</li>)}</ul>
              {statusText && <span className={`editor-save-status ${status}`}>{statusText}</span>}
              {status === "error" && saveError && <span className="editor-save-reason">{saveError}</span>}
              {oversize.length > 0 && <span className="editor-save-reason">{oversizeMessage(oversize)}</span>}
              {bodyMessage && <span className="editor-save-status error">{bodyMessage}</span>}
              {badQuest && <button type="button" className="editor-save-fix" onClick={() => { setPopoverOpen(false); revealCard(badQuest.id, "endsAt", "quests"); }}>{dateMessage}</button>}
              <div className="editor-save-actions">
                <button type="button" className="secondary-control editor-undo-step" aria-label="Отменить последнее действие" disabled={!history.past.length} onClick={() => step("undo")}>↶</button>
                <button type="button" className="secondary-control" disabled={!dirty} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") setDialog("discard"); }}>ОТМЕНИТЬ</button>
                <button type="button" className="primary-control" disabled={!dirty || saveBlocked} aria-disabled={saveState === "saving" || undefined} onClick={() => { if (saveState !== "saving") void save(); }}>СОХРАНИТЬ</button>
              </div>
            </div>
          )}
        </div>
      )}
      {dialog === "discard" && (
        <ConfirmDialog
          title="Отменить несохранённые правки?"
          text={`Черновик вернётся к последнему сохранённому состоянию. Не сохранено: ${shownChanged.map((id) => sectionLabels[id]).join(", ")}`}
          actions={[
            {
              label: "ВЕРНУТЬ СОХРАНЁННОЕ",
              tone: "danger",
              onClick: () => {
                setDialog(null);
                setFormatTarget(null);
                setFormatterOpen(false);
                repairSelections(history.baseline);
                dispatch({ type: "discard" });
                setNotes((previous) => ({ ...previous, draft: structuredClone(previous.baseline) }));
                setNotesNotice(null);
              },
            },
            { label: "НЕ ОТМЕНЯТЬ", tone: "secondary", autoFocus: true, onClick: () => setDialog(null) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "recycle" && selectedVirus && (
        <ConfirmDialog
          title="ПЕРЕМЕСТИТЬ В КОРЗИНУ"
          text={`Переместить «${selectedVirus.name}» в Корзину? В основной базе вирус исчезнет, но его можно будет редактировать и восстановить из Корзины.`}
          actions={[
            { label: "ПЕРЕМЕСТИТЬ", tone: "danger", onClick: () => { setDialog(null); moveSelectedVirusToRecycle(); } },
            { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setDialog(null) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && selectedRecycledVirus && (
        <ConfirmDialog
          title="УДАЛИТЬ НАВСЕГДА"
          text={`Удалить «${selectedRecycledVirus.name}» вместе с оформлением? Запись будет удалена навсегда, её не восстановить.`}
          actions={[
            { label: "УДАЛИТЬ НАВСЕГДА", tone: "danger", onClick: () => { setDialog(null); deleteSelectedRecycledVirus(); } },
            { label: "Не удалять", tone: "secondary", autoFocus: true, onClick: () => setDialog(null) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete-file" && selectedRecycleFile && (
        <ConfirmDialog
          title="УДАЛИТЬ НАВСЕГДА"
          text={`Удалить «${selectedRecycleFile.name}» вместе с оформлением? Запись будет удалена навсегда, её не восстановить.`}
          actions={[
            { label: "УДАЛИТЬ НАВСЕГДА", tone: "danger", onClick: () => { setDialog(null); deleteSelectedRecycleFile(); } },
            { label: "Не удалять", tone: "secondary", autoFocus: true, onClick: () => setDialog(null) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}
      {closeAsked && !employeeDirty && (
        <ConfirmDialog
          title="Закрыть редактор?"
          text={`Не сохранено: ${shownChanged.map((id) => sectionLabels[id]).join(", ")}${saveBlocked ? ` ${bodyMessage || dateMessage}` : ""}`}
          actions={[
            {
              label: "СОХРАНИТЬ",
              tone: "primary",
              // The modal stays up during the request, so nothing can be typed that the close would lose.
              // Closes only if the save left nothing unsaved and the close was not cancelled meanwhile;
              // otherwise the window stays and the bar shows the unsaved edits, ОШИБКА or the conflict.
              disabled: saveState === "saving" || saveBlocked,
              onClick: () => {
                void save().then((clean) => {
                  if (!latest.current.closeAsked) return;
                  setHandledCloseRequest(closeRequest);
                  if (clean) latest.current.onCloseApproved();
                });
              },
            },
            // A sent PUT cannot be cancelled; closing during it would still save, and a failure would go unseen.
            { label: "НЕ СОХРАНЯТЬ", tone: "danger", disabled: saveState === "saving", onClick:() => { setHandledCloseRequest(closeRequest); onCloseApproved(); } },
            { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setHandledCloseRequest(closeRequest) },
          ]}
          onCancel={() => setHandledCloseRequest(closeRequest)}
        />
      )}
    </div>
    </ActiveFormatContext.Provider>
  );
}

// D-09: not a modal and not a toast; the choice between the two labelled buttons is the explicit decision (owner item 5, variant A: no extra confirmation window).
function ConflictPanel({ ready, onLoadTheirs, onReplace }: { ready: boolean; onLoadTheirs: () => void; onReplace: () => void }) {
  const noteId = useId();
  return (
    <section className="editor-conflict-panel" role="alert">
      <h2>Запись изменили до вас</h2>
      <p>Ваши правки не потеряны. Выберите, какую версию оставить.</p>
      <div className="editor-conflict-actions">
        <button type="button" className="primary-control" aria-disabled={!ready || undefined} onClick={() => { if (ready) onLoadTheirs(); }}>Загрузить их версию</button>
        <button type="button" className="danger-control" aria-describedby={noteId} aria-disabled={!ready || undefined} onClick={() => { if (ready) onReplace(); }}>Заменить своей</button>
      </div>
      <p id={noteId}>Их изменения будут перезаписаны.</p>
      {!ready && <p>Загружаем их версию…</p>}
    </section>
  );
}

const detailsOf = (employee: PortiaEmployee) => ({ title: employee.title, rank: employee.rank, callsign: employee.callsign });

function EmployeeProfilesEditor({ onSaved, onRemoved, uploadState, uploadMessage, onUpload, onDirtyChange, leaving, onLeave }: {
  onSaved: (employee: PortiaEmployee) => void;
  onRemoved: (id: string) => void;
  uploadState: "idle" | "uploading" | "error";
  uploadMessage?: string;
  onUpload: (file: File, onUploaded: (url: string) => void) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** The editor wants to leave this tab or close; the unsaved draft has to be answered first. */
  leaving: boolean;
  onLeave: (ok: boolean) => void;
}) {
  const [employees, setEmployees] = useState<PortiaEmployee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<EmployeeProfile | null>(null);
  const [ratingsPending, setRatingsPending] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // Loading the list and saving a card are separate: a load error replaces the tab, a save error stays on the save line.
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recordOpen, setRecordOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);
  // The add form has its own state: the profile draft and its unsaved-edits guard stay untouched.
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ nickname: "", title: "", rank: "", callsign: "" });
  const [addState, setAddState] = useState<"idle" | "adding">("idle");
  const [addError, setAddError] = useState("");
  const [deleteAsked, setDeleteAsked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Title, rank and callsign of a person outside the sheet; sheet employees take them from the sheet.
  const [details, setDetails] = useState({ title: "", rank: "", callsign: "" });
  const [detailsPending, setDetailsPending] = useState(false);
  const selected = employees.find((employee) => employee.id === selectedId) ?? employees[0] ?? null;
  // An upload that finishes after another employee was opened must not land on that employee's draft.
  const selectedIdRef = useRef("");
  // The latest draft, read right after a save answer to see whether anything was typed meanwhile (D-04).
  const draftRef = useRef(draft);
  const detailsRef = useRef(details);
  useEffect(() => { selectedIdRef.current = selected?.id ?? ""; draftRef.current = draft; detailsRef.current = details; });
  const detailsChanged = Boolean(selected?.source === "manual" && (details.title !== selected.title || details.rank !== selected.rank || details.callsign !== selected.callsign));
  const dirty = Boolean(selected && draft && (profileChanged(profileOf(selected), draft) || detailsChanged));
  // Read after an awaited save: a cancelled question must not continue into the switch (D-02).
  const asking = pendingEmployeeId !== null || leaving;
  const askingRef = useRef(asking);
  useEffect(() => { askingRef.current = asking; });
  // The «СОХРАНЕНО» timer lives in a ref so a later save and an unmount can cancel it (D-06).
  const savedTimer = useRef<number | null>(null);
  useEffect(() => () => { if (savedTimer.current !== null) window.clearTimeout(savedTimer.current); }, []);
  // An employee clicked during a save, acted on once the answer is in (D-05).
  const queuedEmployeeIdRef = useRef<string | null>(null);
  // WR-05: the running save and add requests; a second Ctrl+S or form submit during one joins it instead of sending again.
  const saveInflight = useRef<Promise<boolean> | null>(null);
  const addInflight = useRef(false);

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  // Unmounting (tab left after the answer) must not leave the editor believing a draft is still dirty.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // Reload with an unsaved employee draft: the browser's own warning, as for the content (D-12).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    let active = true;
    const fail = (text: string) => {
      if (!active) return;
      setLoadError(text);
      setLoadState("error");
    };
    void (async () => {
      try {
        // The editor-only path is never CDN-cached; the public one can serve an old copy even to a no-store request (D-10).
        let response: Response;
        try {
          response = await fetch("/api/employees/editor", { credentials: "same-origin", cache: "no-store" });
        } catch {
          fail(employeeRequestFailure({ transport: true, action: "load" }));
          return;
        }
        const payload = await response.json().catch(() => ({})) as { employees?: PortiaEmployee[]; profilesRead?: boolean; error?: string };
        if (!response.ok) {
          fail(employeeRequestFailure({ transport: false, status: response.status, payloadError: payload.error, action: "load" }));
          return;
        }
        if (!active) return;
        // Blank profiles must not become drafts: saving one would erase the stored biography and photo (D-09).
        if (!acceptsEditorList(payload)) {
          fail("Профили сотрудников не загрузились, сохранять сейчас нельзя. Повторите через минуту.");
          return;
        }
        const next = payload.employees;
        const first = next[0];
        setEmployees(next);
        setSelectedId(first?.id ?? "");
        setDraft(first ? profileOf(first) : null);
        setDetails(first ? detailsOf(first) : { title: "", rank: "", callsign: "" });
        setLoadState("ready");
      } catch {
        fail("Не удалось загрузить сотрудников.");
      }
    })();
    return () => { active = false; };
  }, [loadAttempt]);
  // In place, without a page reload: other tabs' unsaved edits live in the parent and stay.
  const retryLoad = () => { setLoadState("loading"); setLoadAttempt((attempt) => attempt + 1); };

  // Synchronous, no await: the dialog's save().then reads askingRef right after the answer (A4). An open dialog decides itself.
  const resolveQueued = (clean: boolean) => {
    const queued = queuedEmployeeIdRef.current;
    queuedEmployeeIdRef.current = null;
    if (queued === null || askingRef.current) return;
    const next = employees.find((employee) => employee.id === queued);
    if (!next) return;
    if (clean) openEmployee(next);
    else setPendingEmployeeId(queued);
  };

  // A second Ctrl+S or click while the PATCH runs gets the same answer and sends nothing (WR-05).
  const save = (): Promise<boolean> => {
    if (saveInflight.current) return saveInflight.current;
    const run = (async () => {
      try {
        return await sendSave();
      } finally {
        saveInflight.current = null;
      }
    })();
    saveInflight.current = run;
    return run;
  };

  // Resolves true only when the profile is saved; a failure leaves the error text on the current employee.
  const sendSave = async (): Promise<boolean> => {
    if (!selected || !draft) return false;
    // Only what the editor changed goes out; an empty body would still create a bare row for a never-saved sheet employee (D-11).
    const changes = changedFields(profileOf(selected), draft);
    const detailChanges = selected.source === "manual" ? changedDetails(detailsOf(selected), details) : {};
    if (!Object.keys(changes).length && !Object.keys(detailChanges).length) return true;
    const sentId = selected.id;
    const sentProfile = draft;
    const sentDetails = details;
    // An earlier «СОХРАНЕНО» timer must not flip this save back to idle (03.1-WR-06).
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = null;
    setState("saving");
    setRatingsPending(false);
    setDetailsPending(false);
    setErrorMessage("");
    const failed = (text: string) => {
      setErrorMessage(text);
      setState("error");
      resolveQueued(false);
      return false;
    };
    let response: Response;
    try {
      response = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, nickname: selected.nickname, changes, ...(Object.keys(detailChanges).length ? { details: detailChanges } : {}) }),
      });
    } catch {
      return failed(employeeRequestFailure({ transport: true, action: "save" }));
    }
    const payload = await response.json().catch(() => ({})) as { employee?: Partial<PortiaEmployee> & { id: string }; ratingsPending?: boolean; detailsPending?: boolean; error?: string };
    if (!response.ok || !payload.employee) {
      return failed(employeeRequestFailure({ transport: false, status: response.status, payloadError: payload.error, action: "save" }));
    }
    try {
      // The answer is the stored profile only; the card keeps its avatar, nickname, source and sheet title (D-07).
      const merged: PortiaEmployee = { ...selected, ...payload.employee };
      setEmployees((current) => current.map((employee) => employee.id === merged.id ? merged : employee));
      onSaved(merged);
      // The answer settles only the fields not typed since sending, and only on the employee it was sent for (D-04, D-05).
      const stillOpen = selectedIdRef.current === sentId;
      if (stillOpen) {
        setDraft((draftNow) => draftNow && settleDraft(sentProfile, draftNow, profileOf(merged)));
        // When the database refused the details, the typed values stay as an unsaved edit.
        if (!payload.detailsPending) setDetails((detailsNow) => settleDraft(sentDetails, detailsNow, detailsOf(merged)));
        setRatingsPending(Boolean(payload.ratingsPending));
        setDetailsPending(Boolean(payload.detailsPending));
      }
      setState("saved");
      savedTimer.current = window.setTimeout(() => setState("idle"), 4000);
      // A draft typed during the save stays dirty and unsaved; no automatic second save (D-04). No await from here to the return (A4).
      const typedMeanwhile = stillOpen && (Object.keys(changedFields(sentProfile, draftRef.current ?? sentProfile)).length > 0 || Object.keys(changedDetails(sentDetails, detailsRef.current)).length > 0);
      resolveQueued(!typedMeanwhile);
      return !typedMeanwhile;
    } catch {
      return failed("Не удалось сохранить профиль.");
    }
  };

  // A person outside the sheet, by Roblox nickname; an open selection and its draft stay as they are.
  const addEmployee = async () => {
    // A second submit during the POST sends nothing (WR-05).
    if (addInflight.current) return;
    addInflight.current = true;
    setAddState("adding");
    setAddError("");
    try {
      let response: Response;
      try {
        response = await fetch("/api/employees", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(addDraft),
        });
      } catch {
        setAddError(employeeRequestFailure({ transport: true, action: "add" }));
        return;
      }
      const payload = await response.json().catch(() => ({})) as { employee?: PortiaEmployee; error?: string };
      if (!response.ok || !payload.employee) {
        setAddError(employeeRequestFailure({ transport: false, status: response.status, payloadError: payload.error, action: "add" }));
        return;
      }
      setEmployees((current) => [...current, payload.employee!]);
      onSaved(payload.employee);
      setAddDraft({ nickname: "", title: "", rank: "", callsign: "" });
      setAddOpen(false);
      // The list was empty (or the last person was removed): nothing is open yet, so open the new person.
      if (!draft) openEmployee(payload.employee);
    } catch {
      setAddError("Не удалось добавить сотрудника.");
    } finally {
      addInflight.current = false;
      setAddState("idle");
    }
  };

  if (loadState === "loading") return <div className="editor-empty">Загрузка сотрудников…</div>;
  if (loadState === "error") return <div className="editor-empty" role="alert"><p>{loadError}</p>{loadError.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}<button type="button" className="secondary-control" onClick={retryLoad}>ПОВТОРИТЬ</button></div>;

  const openEmployee = (employee: PortiaEmployee) => {
    setSelectedId(employee.id);
    setDraft(profileOf(employee));
    setDetails(detailsOf(employee));
    setRatingsPending(false);
    setDetailsPending(false);
    setState("idle");
    setRecordOpen(true);
    revealOnPhone(layoutRef);
  };
  // Unsaved edits are asked about before another employee replaces the draft (D-02).
  const chooseEmployee = (employee: PortiaEmployee) => {
    // A sent PATCH cannot be cancelled: remember the click and act after the answer, which is matched by id (D-05). Clicking the open employee forgets it.
    if (state === "saving" && selected) {
      if (employee.id === selected.id) { queuedEmployeeIdRef.current = null; setRecordOpen(true); revealOnPhone(layoutRef); }
      else queuedEmployeeIdRef.current = employee.id;
      return;
    }
    if (!dirty) return openEmployee(employee);
    // The same employee: only show the record, the edits stay.
    if (employee.id === selected?.id) { setRecordOpen(true); revealOnPhone(layoutRef); return; }
    setPendingEmployeeId(employee.id);
  };
  // After the answer: to the pending employee, or out of the tab / the window (the draft is dropped when not saved).
  const continueLeave = (saved = false) => {
    const next = employees.find((employee) => employee.id === pendingEmployeeId);
    setPendingEmployeeId(null);
    if (next) openEmployee(next);
    else {
      // After a save the draft already holds the saved profile; `selected` is the pre-save copy.
      if (!saved && selected) { setDraft(profileOf(selected)); setDetails(detailsOf(selected)); }
      onLeave(true);
    }
  };
  const cancelLeave = () => {
    setPendingEmployeeId(null);
    if (leaving) onLeave(false);
  };

  // Only reached for a manual employee (the button renders for no one else); the server refuses a sheet employee too.
  const removeSelected = async () => {
    if (!selected) return;
    setDeleting(true);
    setErrorMessage("");
    const failed = (text: string) => {
      setErrorMessage(text);
      setState("error");
      setDeleteAsked(false);
      setDeleting(false);
    };
    let response: Response;
    try {
      response = await fetch("/api/employees", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
    } catch {
      failed(employeeRequestFailure({ transport: true, action: "remove" }));
      return;
    }
    const payload = await response.json().catch(() => ({})) as { id?: string; error?: string; code?: string };
    if (!response.ok) {
      // A sheet employee is refused with 403 and its own text; that is not an expired session.
      const sheetRefusal = response.status === 403 && payload.code === "sheet-employee";
      failed(employeeRequestFailure({ transport: false, status: sheetRefusal ? undefined : response.status, payloadError: payload.error, action: "remove" }));
      return;
    }
    try {
      const index = employees.findIndex((employee) => employee.id === selected.id);
      const next = employees[index + 1] ?? employees[index - 1];
      setEmployees(employees.filter((employee) => employee.id !== selected.id));
      onRemoved(selected.id);
      setDeleteAsked(false);
      if (next) openEmployee(next);
      else { setDraft(null); setRecordOpen(false); }
    } catch {
      failed("Не удалось удалить сотрудника.");
      return;
    }
    setDeleting(false);
  };

  // «СОХРАНЕНО» never shows over a draft that is dirty again.
  const saveStatus = state === "saved" && dirty ? "idle" : state;
  const preview = selected && draft ? draft.photoUrl || selected.robloxAvatarUrl : "";
  return <div className="virus-editor-layout employee-editor-layout" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>
    <button type="button" className="secondary-control editor-back-to-list" onClick={() => { setRecordOpen(false); revealOnPhone(layoutRef); }}>← К списку</button>
    <aside className="editor-record-list">
      {employees.map((employee) => <button key={employee.id} type="button" className={employee.id === selected?.id ? "active" : ""} onClick={() => chooseEmployee(employee)}><strong>{employee.nickname}</strong>{employee.source === "manual" && <small className="manual-mark">ВНЕ ТАБЛИЦЫ</small>}<small>{[employee.callsign, employee.title, employee.rank].filter(Boolean).join(" · ")}</small></button>)}
      <button className="add-record" type="button" aria-expanded={addOpen} onClick={() => setAddOpen((open) => !open)}>+ ВНЕ ТАБЛИЦЫ</button>
      {addOpen && <form className="employee-add-form" onSubmit={(event) => { event.preventDefault(); void addEmployee(); }}>
        <Field label="Ник Roblox"><input value={addDraft.nickname} required maxLength={20} autoCapitalize="none" spellCheck={false} onChange={(event) => setAddDraft((current) => ({ ...current, nickname: event.target.value }))} /></Field>
        <Field label="Звание"><input value={addDraft.title} maxLength={64} onChange={(event) => setAddDraft((current) => ({ ...current, title: event.target.value }))} /></Field>
        <Field label="Ранг"><input value={addDraft.rank} maxLength={64} onChange={(event) => setAddDraft((current) => ({ ...current, rank: event.target.value }))} /></Field>
        <Field label="Позывной"><input value={addDraft.callsign} maxLength={64} onChange={(event) => setAddDraft((current) => ({ ...current, callsign: event.target.value }))} /></Field>
        {addError && <p className="employee-add-error" role="alert">{addError}</p>}
        <button className="primary-control" type="submit" disabled={addState === "adding" || !addDraft.nickname.trim()}>{addState === "adding" ? "ДОБАВЛЕНИЕ…" : "ДОБАВИТЬ"}</button>
      </form>}
    </aside>
    <div className="editor-form employee-profile-editor">
      {selected && draft ? <>
      <p className="editor-guidance">Поля из Google Таблицы обновляются автоматически. Здесь редакторы могут менять фотографию, оценки и биографию. Людей вне таблицы добавляют по нику Roblox; их звание, ранг и позывной можно менять здесь.</p>
      <div className="employee-editor-summary">
        <figure>{preview ? <img src={preview} alt={`Аватар ${selected.nickname}`} referrerPolicy="no-referrer" /> : <img src="/assets/portia-logo.png" alt="" />}</figure>
        <div><span className="eyebrow">{selected.title || "БЕЗ ЗВАНИЯ"}</span><h2>{selected.nickname}</h2><p>{[selected.callsign || "без позывного", selected.rank || "ранг не указан"].join(" · ")}</p></div>
      </div>
      <EditorGroup title="Профиль сотрудника">
        {selected.source === "manual" && <>
          <Field label="Звание"><input value={details.title} maxLength={64} onChange={(event) => setDetails((current) => ({ ...current, title: event.target.value }))} /></Field>
          <Field label="Ранг"><input value={details.rank} maxLength={64} onChange={(event) => setDetails((current) => ({ ...current, rank: event.target.value }))} /></Field>
          <Field label="Позывной"><input value={details.callsign} maxLength={64} onChange={(event) => setDetails((current) => ({ ...current, callsign: event.target.value }))} /></Field>
        </>}
        {employeeRatings.map(({ key, label }) => <Field key={key} label={`${label} — от 1 до 10`}><select value={draft[key] ?? ""} onChange={(event) => setDraft((current) => current && ({ ...current, [key]: event.target.value === "" ? null : Number(event.target.value) }))}><option value="">—</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>)}
        <ImageEditorField label="Фото сотрудника" value={draft.photoUrl} placement="employee" maxHint="Пусто — используется аватар Roblox" uploadState={uploadState} uploadMessage={uploadMessage} onChange={(value) => setDraft((current) => current && ({ ...current, photoUrl: value }))} onUpload={(file) => { const startedFor = selected.id; onUpload(file, (url) => { if (selectedIdRef.current === startedFor) setDraft((current) => current && ({ ...current, photoUrl: url })); }); }} />
        <Field label="Биография" wide><textarea className="tall-textarea" value={draft.biography} onChange={(event) => setDraft((current) => current && ({ ...current, biography: event.target.value }))} /></Field>
      </EditorGroup>
      {ratingsPending && <p className="editor-guidance" role="status">Сохранено без новых оценок ({employeeRatings.map((rating) => rating.label).join(", ")}): база данных ещё не обновлена.</p>}
      {detailsPending && <p className="editor-guidance" role="status">Профиль сохранён, но звание, ранг и позывной — нет: база данных ещё не обновлена.</p>}
      {selected.source === "manual" && <button type="button" className="danger-control employee-remove" disabled={state === "saving" || deleting} onClick={() => setDeleteAsked(true)}>УДАЛИТЬ СОТРУДНИКА</button>}
      <div className="employee-editor-save"><span className={`editor-save-status ${saveStatus}`}>{saveStatus === "saving" ? saveStatusText("saving") : saveStatus === "saved" ? saveStatusText("saved") : state === "error" ? errorMessage : "ТОЛЬКО ДЛЯ РЕДАКТОРОВ"}</span>{state === "error" && errorMessage.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}<button className="primary-control" type="button" disabled={state === "saving"} onClick={() => void save()}>СОХРАНИТЬ ПРОФИЛЬ</button></div>
      </> : <div className="editor-empty">Сотрудников пока нет. Добавьте человека вне таблицы кнопкой «+ ВНЕ ТАБЛИЦЫ».</div>}
    </div>
    {deleteAsked && selected?.source === "manual" && (
      <ConfirmDialog
        title="Удалить сотрудника?"
        text={`${selected.nickname} будет убран из списка. Фото, оценки и биография останутся в базе и вернутся, если добавить этот ник снова.`}
        actions={[
          { label: "УДАЛИТЬ", tone: "danger", disabled: deleting, onClick: () => void removeSelected() },
          { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setDeleteAsked(false) },
        ]}
        onCancel={() => setDeleteAsked(false)}
      />
    )}
    {asking && selected && (
      <ConfirmDialog
        title="Несохранённые правки сотрудника"
        text={`${selected.nickname}: изменения не сохранены.`}
        actions={[
          {
            label: "СОХРАНИТЬ",
            tone: "primary",
            disabled: state === "saving",
            onClick: () => {
              void save().then((saved) => {
                if (!askingRef.current) return;
                if (saved) continueLeave(true);
                else cancelLeave();
              });
            },
          },
          { label: "НЕ СОХРАНЯТЬ", tone: "danger", disabled: state === "saving", onClick: () => continueLeave() },
          { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: cancelLeave },
        ]}
        onCancel={cancelLeave}
      />
    )}
  </div>;
}

type TabLists = { closedTabs: string[]; grantedTabs: string[] };
type EditorAccount = { email: string; created_at: string } & TabLists;
type RowNote = { error: boolean; text: string };

function EditorAccessManager() {
  const [editors, setEditors] = useState<EditorAccount[]>([]);
  // IN-03: the editor whose access is about to be revoked; the revoke runs only after the dialog is confirmed.
  const [revokeAsked, setRevokeAsked] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");
  const [tabsEnforced, setTabsEnforced] = useState(false);
  const [notes, setNotes] = useState<Record<string, RowNote>>({});
  const confirmed = useRef(new Map<string, TabLists>());
  const noteTimers = useRef(new Map<string, number>());
  // Per row: what the owner wants saved last, and whether a PATCH is in flight (at most one, T-12-27).
  const wanted = useRef(new Map<string, TabLists>());
  const busy = useRef(new Set<string>());

  useEffect(() => {
    const timers = noteTimers.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const setNote = (editorEmail: string, note: RowNote | null) => {
    window.clearTimeout(noteTimers.current.get(editorEmail));
    setNotes((current) => {
      const rest = { ...current };
      delete rest[editorEmail];
      return note ? { ...rest, [editorEmail]: note } : rest;
    });
    if (note && !note.error) noteTimers.current.set(editorEmail, window.setTimeout(() => setNote(editorEmail, null), 1800));
  };

  // Every call ends in idle or error, never stuck in loading or saving (D-09 #9).
  const loadEditors = async (keepMessage = false) => {
    setState("loading");
    try {
      const response = await fetch("/api/editors", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setState("error");
        setMessage(payload.error ?? "Не удалось загрузить список.");
        return;
      }
      const payload = await response.json() as { editors?: Partial<EditorAccount>[]; tabsEnforced?: boolean };
      const loaded = (payload.editors ?? []).map((item) => ({ ...item, email: item.email ?? "", created_at: item.created_at ?? "", closedTabs: item.closedTabs ?? [], grantedTabs: item.grantedTabs ?? [] }));
      // A row with a request in flight keeps its local lists: a reload must not undo a click.
      loaded.filter((item) => !busy.current.has(item.email)).forEach((item) => { const lists = { closedTabs: item.closedTabs, grantedTabs: item.grantedTabs }; confirmed.current.set(item.email, lists); wanted.current.set(item.email, lists); });
      setEditors((current) => loaded.map((item) => busy.current.has(item.email) ? current.find((row) => row.email === item.email) ?? item : item));
      setTabsEnforced(payload.tabsEnforced === true);
      setState("idle");
      if (!keepMessage) setMessage("");
    } catch {
      setState("error");
      setMessage("Нет связи с сервером. Попробуйте ещё раз.");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEditors(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const addEditor = async () => {
    setState("saving");
    try {
      const response = await fetch("/api/editors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setState("error");
        setMessage(payload.error ?? "Не удалось выдать доступ.");
        return;
      }
      setEmail("");
      setMessage("Доступ выдан. Теперь человек может создать аккаунт на странице входа.");
      setState("idle");
      await loadEditors(true);
    } catch {
      setState("error");
      setMessage("Нет связи с сервером, доступ не выдан. Попробуйте ещё раз.");
    }
  };

  const removeEditor = async (editorEmail: string) => {
    setState("saving");
    try {
      const response = await fetch(`/api/editors?email=${encodeURIComponent(editorEmail)}`, { method: "DELETE", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setState("error");
        setMessage(payload.error ?? "Не удалось отозвать доступ.");
        return;
      }
      setEditors((current) => current.filter((item) => item.email !== editorEmail));
      confirmed.current.delete(editorEmail);
      wanted.current.delete(editorEmail);
      setMessage("Доступ отозван.");
      setState("idle");
    } catch {
      setState("error");
      setMessage("Нет связи с сервером. Попробуйте ещё раз.");
    }
  };

  const sameLists = (a: TabLists, b: TabLists) => JSON.stringify(a) === JSON.stringify(b);
  const patchRow = (editorEmail: string, lists: TabLists) => setEditors((current) => current.map((item) => item.email === editorEmail ? { ...item, ...lists } : item));

  // Sends the row's latest wanted lists, one request at a time; if the owner clicked meanwhile, sends once more.
  const flushRow = async (editorEmail: string) => {
    if (busy.current.has(editorEmail)) return;
    busy.current.add(editorEmail);
    const rollback = (text: string) => {
      const back = confirmed.current.get(editorEmail) ?? { closedTabs: [], grantedTabs: [] };
      wanted.current.set(editorEmail, back);
      patchRow(editorEmail, back);
      setNote(editorEmail, { error: true, text });
    };
    try {
      for (;;) {
        const sent = wanted.current.get(editorEmail);
        const stored = confirmed.current.get(editorEmail);
        if (!sent || (stored && sameLists(sent, stored))) return;
        const response = await fetch("/api/editors", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: editorEmail, ...sent }), signal: AbortSignal.timeout(15_000) });
        const payload = await response.json().catch(() => ({})) as { error?: string; editor?: Partial<TabLists> };
        if (!response.ok) { rollback(payload.error ?? "Не удалось сохранить."); return; }
        const answered = { closedTabs: payload.editor?.closedTabs ?? sent.closedTabs, grantedTabs: payload.editor?.grantedTabs ?? sent.grantedTabs };
        confirmed.current.set(editorEmail, answered);
        if (wanted.current.get(editorEmail) === sent) { setNote(editorEmail, { error: false, text: "Сохранено" }); return; }
      }
    } catch {
      rollback("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      busy.current.delete(editorEmail);
    }
  };

  // One click saves the full lists on its own (D-02); an error puts the row back to what the server last confirmed.
  const toggleTab = (editor: EditorAccount, tab: TabDef) => {
    const base = wanted.current.get(editor.email) ?? editor;
    const key = tab.kind === "trusted" ? "grantedTabs" : "closedTabs";
    const list = base[key].includes(tab.id) ? base[key].filter((id) => id !== tab.id) : [...base[key], tab.id];
    const next: TabLists = { closedTabs: base.closedTabs, grantedTabs: base.grantedTabs, [key]: tabRegistry.filter((entry) => list.includes(entry.id)).map((entry) => entry.id) };
    wanted.current.set(editor.email, next);
    patchRow(editor.email, next);
    setNote(editor.email, null);
    void flushRow(editor.email);
  };

  return <div className="editor-form flat-editor-form access-editor">
    <div className="access-editor-intro"><span className="eyebrow">ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА</span><h2>Аккаунты редакторов</h2><p>Укажите email человека, которому разрешено менять сайт. Затем он откроет страницу входа, создаст собственный аккаунт с этим email и войдёт со своим паролем.</p></div>
    <div className="access-editor-add"><label className="editor-field"><span>Email нового редактора</span><input type="email" value={email} placeholder="name@example.com" onChange={(event) => setEmail(event.target.value)} /></label><button className="primary-control" type="button" disabled={!email.trim() || state === "saving"} onClick={() => void addEditor()}>ВЫДАТЬ ДОСТУП</button></div>
    {message && <div className={`access-editor-message ${state}`}>{message}</div>}
    <div className="access-editor-list">
      {state === "loading" && <div className="editor-empty compact-empty">Загрузка списка…</div>}
      {state !== "loading" && editors.length === 0 && <div className="editor-empty compact-empty">Дополнительных редакторов пока нет.</div>}
      {editors.map((editor) => {
        const open = openTabIds(editor.closedTabs, editor.grantedTabs);
        const note = notes[editor.email];
        return <div key={editor.email}><div><strong>{editor.email}</strong><small>ДОСТУП К РЕДАКТОРУ</small>
          <div className="access-tab-chips" role="group" aria-label={`Вкладки ${editor.email}`}>
            {tabRegistry.map((tab) => <button key={tab.id} type="button" className="access-tab-chip" aria-pressed={open.includes(tab.id)} disabled={!tabsEnforced} onClick={() => toggleTab(editor, tab)}>{open.includes(tab.id) ? `✓ ${tab.label}` : tab.label}</button>)}
          </div>
          {note && <span className={`access-tab-note${note.error ? " is-error" : ""}`} role="status">{note.text}</span>}
        </div><button type="button" disabled={state === "saving"} onClick={() => setRevokeAsked(editor.email)}>ОТОЗВАТЬ</button></div>;
      })}
      {!tabsEnforced && editors.length > 0 && <p className="editor-guidance">Вкладки по редакторам заработают после применения SQL</p>}
    </div>
    {revokeAsked !== null && (
      <ConfirmDialog
        title="Отозвать доступ?"
        text={`${revokeAsked} потеряет доступ к редактору. Вернуть его можно только новой выдачей доступа.`}
        actions={[
          { label: "ОТОЗВАТЬ", tone: "danger", disabled: state === "saving", onClick: () => { const target = revokeAsked; setRevokeAsked(null); void removeEditor(target); } },
          { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setRevokeAsked(null) },
        ]}
        onCancel={() => setRevokeAsked(null)}
      />
    )}
  </div>;
}

// Always in the DOM so the change to «МАКСИМУМ» is announced (UI-SPEC).
function LimitNote({ id, count, max }: { id: string; count: number; max: number }) {
  return <span id={id} aria-live="polite" className={limitStatus(count, max) === "full" ? "limit-note is-full" : "limit-note"}>{limitText(count, max)}</span>;
}

// One table editor for «Информация» and «Справочник»: onEdit applies one edit to this block's rows, so a column swap is one change and one undo step (D-19).
function TableBlockEditor({ blockId, rows, onEdit }: { blockId: string; rows: { id: string; key: string; value: string }[]; onEdit: (edit: (rows: { id: string; key: string; value: string }[]) => void) => void }) {
  const swapColumns = () => onEdit((items) => items.forEach((row) => { [row.key, row.value] = [row.value, row.key]; }));
  return (
    <>
      {rows.length === 0 && <div className="editor-empty compact-empty">Строк пока нет. Добавьте первую кнопкой «+ СТРОКА».</div>}
      {rows.length > 0 && (
        <div className="info-table-head">
          <div data-column="key"><ColumnSwapHandle label="Признак" onSwap={swapColumns} /><span>Признак</span></div>
          <div data-column="value"><ColumnSwapHandle label="Значение" onSwap={swapColumns} /><span>Значение</span></div>
          <span className="info-table-head-pad" aria-hidden="true">Удалить строку</span>
        </div>
      )}
      {rows.map((row, rowIndex) => (
        <div className="info-table-row" data-sort-index={rowIndex} key={row.id}>
          <OrderDragHandle index={rowIndex} label={`строка ${rowIndex + 1}`} onMove={(from, to) => onEdit((items) => moveArrayItem(items, from, to))} />
          <Field label="Признак"><input maxLength={500} value={row.key} onChange={(event) => onEdit((items) => { if (items[rowIndex]) items[rowIndex].key = event.target.value; })} /></Field>
          <Field label="Значение"><input maxLength={500} value={row.value} onChange={(event) => onEdit((items) => { if (items[rowIndex]) items[rowIndex].value = event.target.value; })} /></Field>
          <button type="button" onClick={() => onEdit((items) => { items.splice(rowIndex, 1); })}>Удалить строку</button>
        </div>
      ))}
      <div className="scientist-log-actions">
        <button className="secondary-control limit-add" type="button" disabled={rows.length >= MAX_TABLE_ROWS} aria-describedby={`limit-rows-${blockId}`} onClick={() => onEdit((items) => { items.push({ id: makeId("row"), key: "", value: "" }); })}>+ СТРОКА</button>
        <LimitNote id={`limit-rows-${blockId}`} count={rows.length} max={MAX_TABLE_ROWS} />
      </div>
    </>
  );
}

// Typed text lives here; the stored id is the source of truth, so undo/redo shows the stored video without an effect.
function YoutubeField({ videoId, onChange }: { videoId: string; onChange: (videoId: string) => void }) {
  const [typed, setTyped] = useState("");
  const shown = parseYoutubeId(typed) === videoId ? typed : videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
  return <label className="editor-field wide">
    <span>Ссылка на YouTube</span>
    <input value={shown} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://www.youtube.com/watch?v=… или https://youtu.be/…" onChange={(event) => { setTyped(event.target.value); onChange(parseYoutubeId(event.target.value)); }} />
    <small className="editor-media-hint">{videoId ? "Видео распознано" : shown ? "Нужна ссылка на YouTube: youtube.com/watch?v=… или youtu.be/…" : "Принимаются только ссылки YouTube."}</small>
  </label>;
}
