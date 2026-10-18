"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { changedDossierTabs, changedSections, dossierTabs, editorSections, sectionLabels, type DossierTab } from "@/lib/editor-changes";
import { shortcutOf } from "@/lib/editor-shortcuts";
import { historyReducer, initHistory, type EditorHistory, type HistoryAction } from "@/lib/editor-history";
import { removeBroadcast, removeInfoSection, removeMutation, updateById } from "@/lib/editor-items";
import {
  classificationOptions,
  portiaTextKey,
  scientistLogPlainText,
  type Broadcast,
  type PortiaContent,
  type RecycleFile,
  type RichTextDocument,
  type RichTextStyle,
  type Virus,
} from "@/lib/portia-content";
import { employeeRatings, profileChanged, profileOf, type EmployeeProfile, type PortiaEmployee } from "@/lib/portia-employees";

type EditorTab = "viruses" | "info" | "broadcasts" | "recycle" | "search" | "assistant" | "employees" | "access";

type Props = {
  content: PortiaContent;
  // The revision content was read or saved at.
  revision: number;
  saveState: "idle" | "saving" | "saved" | "error" | "conflict";
  canManageEditors: boolean;
  active: boolean;
  onDirtyChange: (dirty: boolean) => void;
  // Bumped by the window manager each time × is pressed while the editor reports unsaved edits.
  closeRequest: number;
  onCloseApproved: () => void;
  // Resolves with the saved revision.
  onSave: (content: PortiaContent, baseRevision: number) => Promise<number>;
  onEmployeeSaved: (employee: PortiaEmployee) => void;
};

type FormatTarget = {
  key: string;
  title: string;
  value: string;
  document: RichTextDocument;
  selection: { start: number; end: number };
  onCommit: (value: string, document: RichTextDocument) => void;
};

type EditorPreviewSurface = "light" | "dark";
// Site area whose font the field mirrors; paired in the shared font block in app/portia.css.
type DisplayArea = "lead" | "metric" | "mutation" | "scientist" | "info" | "broadcast" | "trash" | "caption" | "search" | "assistant";
type ImagePlacement = "dossier" | "mutation" | "recycle";

const ActiveFormatContext = createContext<{ key: string | null; surface: EditorPreviewSurface; phonePanelOpen: boolean }>({ key: null, surface: "light", phonePanelOpen: false });

function mediaUrlFromText(value: string) {
  const trimmed = value.trim();
  const markdown = trimmed.match(/^!\[[^\]]*\]\((https:\/\/[^\s)]+)\)$/i);
  const plain = trimmed.match(/https:\/\/[^\s<>"']+/i);
  const extracted = (markdown?.[1] ?? plain?.[0] ?? (trimmed.startsWith("/") ? trimmed : "")).replace(/[),.;]+$/, "");
  if (!extracted) return trimmed;

  try {
    const url = new URL(extracted, window.location.origin);
    if ((url.hostname === "giphy.com" || url.hostname === "www.giphy.com") && url.pathname.startsWith("/gifs/")) {
      const id = url.pathname.split("/").filter(Boolean).at(-1)?.split("-").at(-1);
      if (id && /^[a-z0-9]+$/i.test(id)) return `https://media.giphy.com/media/${id}/giphy.gif`;
    }
  } catch {}

  return extracted;
}

const textColorPalette = [
  { value: "#252827", label: "Графит" },
  { value: "#d4e0dd", label: "Светлый" },
  { value: "#0b7568", label: "Portia" },
  { value: "#167a4d", label: "Зелёный" },
  { value: "#a06f00", label: "Янтарный" },
  { value: "#b43632", label: "Красный" },
  { value: "#316e9b", label: "Синий" },
];

const backgroundColorPalette = [
  { value: "#f0d66a", label: "Жёлтый" },
  { value: "#9adfce", label: "Мятный" },
  { value: "#a9cae1", label: "Голубой" },
  { value: "#e8aaa6", label: "Розовый" },
  { value: "#b8c0bd", label: "Серый" },
  { value: "#26312f", label: "Тёмный" },
];

const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

function OrderDragHandle({ index, onMove, label }: { index: number; onMove: (from: number, to: number) => void; label: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const indexRef = useRef(index);
  const onMoveRef = useRef(onMove);
  const holdTimer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  useEffect(() => { indexRef.current = index; onMoveRef.current = onMove; });
  const placed = useRef<{ index: number; top: number } | null>(null);
  // Per-handle FLIP: every row whose index changed slides itself, so the dragged row and its displaced neighbours all animate.
  useLayoutEffect(() => {
    const row = button.current?.closest<HTMLElement>("[data-sort-index]");
    if (!row || row.offsetParent === null) { placed.current = null; return; }
    const top = row.offsetTop;
    const previous = placed.current;
    placed.current = { index, top };
    if (!previous || previous.index === index || previous.top === top) return;
    // Mirrors the CSS motion switch, which cannot clamp Web Animations started from script.
    const motion = document.documentElement.dataset.motion;
    if (motion === undefined ? matchMedia("(prefers-reduced-motion: reduce)").matches : motion !== "full") return;
    const easing = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
    row.animate([{ transform: `translateY(${previous.top - top}px)` }, { transform: "none" }], { duration: 160, easing });
  });

  const stop = (event?: React.PointerEvent<HTMLButtonElement>) => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    holdTimer.current = null;
    frame.current = null;
    active.current = false;
    if (button.current) {
      delete button.current.dataset.dragging;
      delete button.current.dataset.dragId;
    }
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  // A row swaps only once the pointer crosses its vertical middle, so rows of unequal height do not flip back and forth.
  const moveTo = (x: number, y: number) => {
    const row = document.elementsFromPoint(x, y)
      .map((element) => element.closest<HTMLElement>("[data-sort-index]"))
      .find(Boolean);
    const target = Number(row?.dataset.sortIndex);
    if (!row || !Number.isInteger(target) || target === indexRef.current) return;
    const { top, height } = row.getBoundingClientRect();
    const middle = top + height / 2;
    if (target > indexRef.current ? y < middle : y > middle) return;
    onMoveRef.current(indexRef.current, target);
    indexRef.current = target;
  };

  // A stuck drag marker would fold every later edit into one undo step, so the drag also ends on unmount, on lost
  // window focus, and on a release anywhere: once pointer capture is lost the handle may never see its pointerup.
  // Tracking lives on window too, because a downward swap re-inserts the dragged row and drops pointer capture (03-REVIEW IN-05).
  useEffect(() => {
    const onBlur = () => stop();
    const onRelease = (event: PointerEvent) => { if (event.isPrimary) stop(); };
    const onTrack = (event: PointerEvent) => {
      if (!event.isPrimary || holdTimer.current === null) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      if (active.current) moveTo(event.clientX, event.clientY);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointermove", onTrack);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointermove", onTrack);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      stop();
    };
  }, []);

  // Near the edge of whatever scrolls (the editor, or the page on phones) the list keeps moving under a still finger.
  const autoscroll = () => {
    const editor = button.current?.closest<HTMLElement>(".content-editor") ?? null;
    const scrolls = editor !== null && editor.scrollHeight > editor.clientHeight && /auto|scroll/.test(getComputedStyle(editor).overflowY);
    const scroller: { scrollBy: (x: number, y: number) => void } = scrolls ? editor : window;
    // 56px: sticky system bar; 44px: taskbar (window mode only).
    const { top, bottom } = scrolls ? editor.getBoundingClientRect() : { top: 56, bottom: window.innerHeight - 44 };
    const { x, y } = pointer.current;
    const direction = y < top + 48 ? -1 : y > bottom - 48 ? 1 : 0;
    if (direction) {
      scroller.scrollBy(0, direction * 8);
      moveTo(x, y);
    }
    frame.current = requestAnimationFrame(autoscroll);
  };

  return <button
    ref={button}
    className="order-drag-handle"
    type="button"
    aria-label={`Изменить порядок: ${label}`}
    aria-keyshortcuts="ArrowUp ArrowDown"
    onPointerDown={(event) => {
      // A second finger or a right-click must not start a drag or orphan the first one's timer and frame loop.
      if (!event.isPrimary || event.button !== 0) return;
      stop();
      const target = event.currentTarget;
      pointer.current = { x: event.clientX, y: event.clientY };
      target.setPointerCapture(event.pointerId);
      holdTimer.current = window.setTimeout(() => {
        active.current = true;
        target.dataset.dragging = "true";
        target.dataset.dragId = makeId("drag");
        frame.current = requestAnimationFrame(autoscroll);
      }, 170);
    }}
    onPointerUp={stop}
    onPointerCancel={stop}
    onKeyDown={(event) => {
      const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!step) return;
      event.preventDefault();
      onMove(index, index + step);
    }}
  ><span aria-hidden="true">≡</span></button>;
}

const emptyRichTextStyle: RichTextStyle = {};

function sameStyle(left: RichTextStyle = {}, right: RichTextStyle = {}) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compactRuns(text: string, styles: RichTextStyle[]): RichTextDocument {
  if (!text) return { runs: [{ text: "" }] };
  const runs: RichTextDocument["runs"] = [];
  for (let index = 0; index < text.length; index += 1) {
    const style = styles[index] ?? emptyRichTextStyle;
    const previous = runs[runs.length - 1];
    if (previous && sameStyle(previous.style, style)) previous.text += text[index];
    else runs.push({ text: text[index], ...(Object.keys(style).length ? { style: { ...style } } : {}) });
  }
  return { runs };
}

function expandStyles(document: RichTextDocument) {
  const styles: RichTextStyle[] = [];
  document.runs.forEach((run) => {
    for (let index = 0; index < run.text.length; index += 1) styles.push({ ...(run.style ?? {}) });
  });
  return styles;
}

function replaceRichText(document: RichTextDocument, nextText: string) {
  const previousText = document.runs.map((run) => run.text).join("");
  const previousStyles = expandStyles(document);
  let prefix = 0;
  while (prefix < previousText.length && prefix < nextText.length && previousText[prefix] === nextText[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previousText.length - prefix &&
    suffix < nextText.length - prefix &&
    previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
  ) suffix += 1;
  const insertedLength = nextText.length - prefix - suffix;
  const inheritedStyle = previousStyles[Math.max(0, prefix - 1)] ?? previousStyles[prefix] ?? {};
  const styles = [
    ...previousStyles.slice(0, prefix),
    ...Array.from({ length: Math.max(0, insertedLength) }, () => ({ ...inheritedStyle })),
    ...previousStyles.slice(previousText.length - suffix),
  ];
  return compactRuns(nextText, styles);
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

function applyRichTextStyle(document: RichTextDocument, start: number, end: number, style: RichTextStyle) {
  const text = document.runs.map((run) => run.text).join("");
  const from = start === end ? 0 : Math.min(start, end);
  const to = start === end ? text.length : Math.max(start, end);
  const styles = expandStyles(document);
  for (let index = from; index < to; index += 1) styles[index] = { ...styles[index], ...style };
  return compactRuns(text, styles);
}

function resetRichTextStyle(document: RichTextDocument, start: number, end: number) {
  const text = document.runs.map((run) => run.text).join("");
  const from = start === end ? 0 : Math.min(start, end);
  const to = start === end ? text.length : Math.max(start, end);
  const styles = expandStyles(document);
  for (let index = from; index < to; index += 1) styles[index] = {};
  return compactRuns(text, styles);
}

function rgba(hex: string | undefined, opacity: number | undefined) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity ?? 1})`;
}

function renderRichTextEditor(root: HTMLElement, document: RichTextDocument) {
  const fragment = window.document.createDocumentFragment();
  const plainText = document.runs.map((run) => run.text).join("");
  document.runs.forEach((run) => {
    if (!run.text) return;
    const span = window.document.createElement("span");
    span.textContent = run.text;
    if (run.style?.color) span.style.color = run.style.color;
    if (run.style?.fontSize) span.style.fontSize = `${run.style.fontSize}px`;
    if (run.style?.fontWeight) span.style.fontWeight = String(run.style.fontWeight);
    const background = rgba(run.style?.backgroundColor, run.style?.backgroundOpacity);
    if (background) span.style.backgroundColor = background;
    fragment.append(span);
  });
  if (!plainText || plainText.endsWith("\n")) {
    const sentinel = window.document.createElement("br");
    sentinel.dataset.editorSentinel = "true";
    fragment.append(sentinel);
  }
  root.replaceChildren(fragment);
}

function editorPlainText(root: HTMLElement) {
  // Clearing the field natively leaves a bare <br>, which innerText reports as "\n".
  if (!root.textContent) return "";
  const text = root.innerText.replace(/\r/g, "").replace(/\u00a0/g, " ");
  return root.querySelector("[data-editor-sentinel]") && text.endsWith("\n") ? text.slice(0, -1) : text;
}

function richTextStyleAt(document: RichTextDocument, position: number) {
  const styles = expandStyles(document);
  return styles[Math.max(0, Math.min(styles.length - 1, position))] ?? {};
}

function selectionOffsets(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { start: 0, end: 0 };
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return { start: 0, end: 0 };
  const beforeStart = range.cloneRange();
  beforeStart.selectNodeContents(root);
  beforeStart.setEnd(range.startContainer, range.startOffset);
  const beforeEnd = range.cloneRange();
  beforeEnd.selectNodeContents(root);
  beforeEnd.setEnd(range.endContainer, range.endOffset);
  return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
}

// On a phone the list and the record swap places; bring the new half to the top (read after the next render).
function revealOnPhone(ref: React.RefObject<HTMLElement | null>) {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  window.requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start" }));
}

// Builds the Range for text offsets inside a rich-text field; used to restore the caret and to paint the phone highlight.
function rangeFromOffsets(root: HTMLElement, offsets: { start: number; end: number }): Range {
  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = window.document.createRange();
  // A caret right after a node's trailing "\n" belongs to the next line. Firefox and
  // Safari draw it on the previous line, so Enter seemed to need a second press.
  const fits = (offset: number, text: string, consumed: number) =>
    offset < consumed + text.length || (offset === consumed + text.length && !text.endsWith("\n"));
  let node = walker.nextNode();
  let consumed = 0;
  let startSet = false;
  while (node) {
    const text = node.textContent ?? "";
    if (!startSet && fits(offsets.start, text, consumed)) {
      range.setStart(node, Math.max(0, offsets.start - consumed));
      startSet = true;
    }
    if (fits(offsets.end, text, consumed)) {
      if (!startSet) range.setStart(node, 0);
      range.setEnd(node, Math.max(0, offsets.end - consumed));
      return range;
    }
    consumed += text.length;
    node = walker.nextNode();
  }
  const sentinel = root.querySelector("[data-editor-sentinel]");
  if (sentinel) {
    if (!startSet) range.setStartBefore(sentinel);
    range.setEndBefore(sentinel);
  } else if (startSet) {
    range.setEnd(root, root.childNodes.length);
  } else {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  return range;
}

function restoreSelection(root: HTMLElement, offsets: { start: number; end: number }) {
  if (window.document.activeElement !== root) return;
  const range = rangeFromOffsets(root, offsets);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function findFormatField(key: string) {
  return window.document.querySelector<HTMLElement>(`[data-format-key="${CSS.escape(key)}"]`);
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const chroma = value * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const match = value - chroma;
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsv(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#252827";
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const hue = delta === 0 ? 0
    : maximum === red ? 60 * (((green - blue) / delta) % 6)
      : maximum === green ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
  return { hue: (hue + 360) % 360, saturation: maximum === 0 ? 0 : delta / maximum, value: maximum };
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
    mind: "Альбедо",
    appearance: "Нюктея",
    behavior: "Фобус",
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

export function PortiaEditor({ content, revision, saveState, canManageEditors, active, onDirtyChange, closeRequest, onCloseApproved, onSave, onEmployeeSaved }: Props) {
  const [history, dispatch] = useReducer(editorReducer, content, initEditorHistory);
  // The revision the draft's baseline came from; a stale draft then gets the 409 instead of overwriting newer content (uat-03-owner-broadcast-vanishes).
  const baseRevision = useRef(revision);
  const draft = history.present;
  const changed = useMemo(() => changedSections(history.baseline, history.present), [history.baseline, history.present]);
  const dirty = changed.length > 0;
  const [tab, setTab] = useState<EditorTab>("viruses");
  const [selectedVirusId, setSelectedVirusId] = useState(content.viruses[0]?.id ?? "");
  const [selectedRecycleFileId, setSelectedRecycleFileId] = useState(content.recycleFiles[0]?.id ?? "");
  // The Recycle selection is one of two ids; the other stays "" (the render and the row highlight rely on it).
  const [selectedRecycledVirusId, setSelectedRecycledVirusId] = useState(content.recycleFiles.length ? "" : content.recycledViruses?.[0]?.id ?? "");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [dialog, setDialog] = useState<"discard" | "recycle" | "delete" | null>(null);
  // A request made before this mount is not replayed; the dialog shows while a newer one is unanswered.
  const [handledCloseRequest, setHandledCloseRequest] = useState(closeRequest);
  const closeAsked = closeRequest !== handledCloseRequest;
  const [employeeDirty, setEmployeeDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<EditorTab | null>(null);
  const leaving = employeeDirty && (leaveTo !== null || closeAsked);
  const [formatTarget, setFormatTarget] = useState<FormatTarget | null>(null);
  const [formatterOpen, setFormatterOpen] = useState(false);
  const [dossierTab, setDossierTab] = useState<DossierTab>("main");
  const [previewSurface, setPreviewSurface] = useState<EditorPreviewSurface>("light");
  // At 900px and below a list + form layout shows either the list or the open record (D-01, D-02).
  const [recordOpen, setRecordOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (dirty) return;
    const syncTimer = window.setTimeout(() => {
      dispatch({ type: "sync", content });
      baseRevision.current = revision;
      repairSelections(content);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [content, dirty, revision]);

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
  const changeDraft = (updater: (next: PortiaContent) => void) => {
    editCount.current += 1;
    dispatch({ type: "change", updater, key: editKeyFor(document.activeElement), now: Date.now() });
  };

  const step = (kind: "undo" | "redo") => {
    const target = kind === "undo" ? history.past.at(-1) : history.future[0];
    if (!target) return;
    // The open format panel holds the pre-step document; a stale panel would write old text back.
    setFormatTarget(null);
    setFormatterOpen(false);
    repairSelections(target);
    editCount.current += 1;
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
    changeDraft((next) => { next.recycledViruses = next.recycledViruses.filter((virus) => virus.id !== selectedRecycledVirus.id); next.recycleOrder = recycleKeys(next); });
    setSelectedRecycledVirusId(nextId);
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

  const activateFormatter = (target: FormatTarget) => setFormatTarget(target);
  // The panel's stored commit for a deleted item would write its formatting back.
  const closeFormatterFor = (key: string) => {
    if (formatTarget?.key !== key) return;
    setFormatTarget(null);
    setFormatterOpen(false);
  };

  // The format panel keeps a target in the tab being hidden; leaving it open could write old text back (Pitfall 7).
  const selectDossierTab = (id: DossierTab) => {
    setDossierTab(id);
    setFormatTarget(null);
    setFormatterOpen(false);
  };

  const showTab = (id: EditorTab) => {
    setTab(id);
    setRecordOpen(false);
    setPreviewSurface(id === "viruses" || id === "recycle" ? "light" : "dark");
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
    setUploadState("uploading");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "upload failed");
      onUploaded(payload.url);
      setUploadState("idle");
    } catch {
      setUploadState("error");
    }
  };

  // Read after an awaited save, when the closure that started it is renders old.
  const latest = useRef({ closeAsked, onCloseApproved });
  useEffect(() => { latest.current = { closeAsked, onCloseApproved }; });

  // Resolves true only when nothing is left unsaved: the draft was clean, or the save succeeded and nothing was typed meanwhile.
  const save = async (): Promise<boolean> => {
    if (!dirty) return true;
    if (saveState === "saving") return false;
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
      normalized.viruses.forEach((virus) => { virus.scientistLogs = virus.scientistLogs.slice(0, 5); });
      baseRevision.current = await onSave(normalized, baseRevision.current);
      const clean = editCount.current === editsBefore;
      dispatch({ type: "saved", normalized, savedFrom });
      return clean;
    } catch {
      // Keep the local draft marked as changed so a temporary network error
      // can never discard the owner's work.
      return false;
    }
  };

  // save and step are new functions every render; the listeners read the latest pair through a ref instead of re-subscribing.
  const actionsRef = useRef({ save, step });
  useEffect(() => { actionsRef.current = { save, step }; });

  // Window-level shortcuts only while this window is the active, non-minimized one and no dialog is open (D-10, D-11).
  useEffect(() => {
    if (!active || dialog || closeAsked) return;
    // Сотрудники and Доступ are saved separately; their fields keep the browser's native undo.
    const historyTab = tab !== "employees" && tab !== "access";
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
  }, [active, dialog, closeAsked, tab]);

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

  // Only a save starts a new saveState, so after ОТМЕНИТЬ or undo back to clean the conflict text would sit over a current editor.
  const conflict = saveState === "conflict" && dirty;
  // While the format panel is open the bar is its anchor, so it must not appear under the panel mid-session (D-01/D-02).
  const barVisible = dirty || saveState === "saving" || saveState === "saved" || formatterOpen;
  const statusText = saveState === "saving" ? "СОХРАНЕНИЕ…"
    : conflict ? "КТО-ТО СОХРАНИЛ РАНЬШЕ — СКОПИРУЙТЕ ПРАВКИ И ОБНОВИТЕ СТРАНИЦУ"
    : saveState === "error" ? "ОШИБКА"
    : saveState === "saved" && !dirty ? "СОХРАНЕНО"
    : "";

  return (
    <ActiveFormatContext.Provider value={{ key: formatTarget?.key ?? null, surface: previewSurface, phonePanelOpen: formatterOpen && window.matchMedia("(max-width: 900px)").matches }}>
    <div className="content-editor">
      <header className="editor-header">
        <div>
          <span className="eyebrow">УПРАВЛЕНИЕ СОДЕРЖИМЫМ</span>
          <h1>Редактор PORTIA</h1>
          <p>Изменения сохраняются в общей базе!</p>
        </div>
      </header>

      <nav className="editor-tabs" aria-label="Разделы редактора" ref={tabsRef}>
        {([
          ...editorSections.map((id) => [id, sectionLabels[id]]),
          ["employees", "Сотрудники"],
          ...(canManageEditors ? [["access", "Доступ"]] : []),
        ] as [EditorTab, string][]).map(([id, label]) => {
          const unsaved = changed.some((section) => section === id);
          return (
            <button key={id} type="button" className={tab === id ? "active" : ""} aria-label={unsaved ? `${label}, есть несохранённые правки` : undefined} onClick={() => switchTab(id)}>
              {label}{unsaved && <i className="tab-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

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
        <small>{formatTarget ? "Выделите текст в активном поле или оставьте курсор без выделения, чтобы изменить весь текст." : "Одна кнопка форматирования работает со всеми большими текстовыми полями."}</small>
      </div>

      {tab === "viruses" && (
        <div className="virus-editor-layout" ref={layoutRef} data-mobile-view={recordOpen && selectedVirus ? "record" : "list"}>
          <button type="button" className="secondary-control editor-back-to-list" onClick={() => showRecord(false)}>← К списку</button>
          <aside className="editor-record-list">
            {draft.viruses.map((virus, index) => (
              <div className="editor-record-row" data-sort-index={index} key={virus.id}>
                <OrderDragHandle index={index} label={virus.name || "вирус"} onMove={(from, to) => { setFormatTarget(null); setFormatterOpen(false); changeDraft((next) => moveArrayItem(next.viruses, from, to)); }} />
                <button type="button" className={virus.id === selectedVirusId ? "active" : ""} onClick={() => { setSelectedVirusId(virus.id); showRecord(true); }}>
                  <strong>{virus.name || "БЕЗ НАЗВАНИЯ"}</strong><small>{virus.code || "БЕЗ КОДА"}</small>
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
                <ImageEditorField label="Фото или GIF после заражения" value={selectedVirus.infectedImage} placement="dossier" maxHint="На странице: максимум 540 × 620 px" uploadState={uploadState} onChange={(value) => updateVirus((virus) => { virus.infectedImage = value; })} onUpload={(file) => uploadImage(file, (url) => updateVirus((virus) => { virus.infectedImage = url; }))} />
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
                    <ImageEditorField label="Изображение или GIF мутации" value={mutation.image} placement="mutation" maxHint="На странице: максимум 420 × 360 px" uploadState={uploadState} onChange={(value) => updateVirus((virus) => { virus.mutations[index].image = value; })} onUpload={(file) => uploadImage(file, (url) => updateVirus((virus) => { const item = virus.mutations[index]; if (item) item.image = url; }))} />
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
                <div className="scientist-log-actions"><button className="secondary-control" type="button" disabled={selectedVirus.scientistLogs.length >= 5} onClick={() => updateVirus((virus) => virus.scientistLogs.push({ id: makeId("log"), title: `ЗАПИСЬ ${String(virus.scientistLogs.length + 1).padStart(2, "0")}`, scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""], richContent: { runs: [{ text: "" }] } }))}>+ ДОБАВИТЬ ЗАПИСЬ</button><span>{selectedVirus.scientistLogs.length} / 5</span></div>
              </EditorGroup>}

              <button className="danger-control" type="button" onClick={() => setDialog("recycle")}>ПЕРЕМЕСТИТЬ В КОРЗИНУ</button>
            </div>
          ) : <div className="editor-empty">Добавьте первую запись вируса.</div>}
        </div>
      )}

      {tab === "info" && (
        <div className="editor-form flat-editor-form">
          <p className="editor-guidance">Каждый блок становится отдельным разделом приложения «Информация».</p>
          {draft.infoSections.map((section, index) => (
            <div className="nested-editor-card" data-sort-index={index} key={section.id}>
              <div className="nested-editor-head"><OrderDragHandle index={index} label={section.title || "раздел"} onMove={(from, to) => changeDraft((next) => moveArrayItem(next.infoSections, from, to))} /><strong>РАЗДЕЛ {String(index + 1).padStart(2, "0")}</strong><div className="nested-editor-actions"><button type="button" onClick={() => { closeFormatterFor(portiaTextKey.info(section.id)); changeDraft((next) => removeInfoSection(next, section.id)); }}>Удалить</button></div></div>
              <Field label="Заголовок"><input value={section.title} onChange={(event) => changeDraft((next) => updateById(next.infoSections, section.id, (item) => { item.title = event.target.value; }))} /></Field>
              <FormattedTextarea area="info" label="Текст" tall value={section.body} document={draft.formattedText[portiaTextKey.info(section.id)]} formatKey={portiaTextKey.info(section.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.info(section.id), value, document, (next, text) => updateById(next.infoSections, section.id, (item) => { item.body = text; }))} />
            </div>
          ))}
          <button className="secondary-control" type="button" onClick={() => changeDraft((next) => next.infoSections.push({ id: makeId("info"), title: "НОВЫЙ РАЗДЕЛ", body: "" }))}>+ ДОБАВИТЬ РАЗДЕЛ</button>
        </div>
      )}

      {tab === "broadcasts" && (
        <div className="editor-form flat-editor-form">
          <p className="editor-guidance">Публикуйте еженедельные квесты, задачи и новости. Отключённые сообщения сохраняются как черновики.</p>
          {draft.broadcasts.length === 0 && <div className="editor-empty">Сообщений пока нет. Создайте первое сообщение.</div>}
          {draft.broadcasts.map((broadcast, index) => (
            <div className="nested-editor-card" key={broadcast.id}>
              <div className="nested-editor-head"><strong>СООБЩЕНИЕ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => { closeFormatterFor(portiaTextKey.broadcast(broadcast.id)); changeDraft((next) => removeBroadcast(next, broadcast.id)); }}>Удалить</button></div>
              <Field label="Тип"><select value={broadcast.type} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.type = event.target.value as Broadcast["type"]; }))}><option value="quest">Еженедельный квест</option><option value="task">Задача</option><option value="news">Новость</option></select></Field>
              <Field label="Заголовок"><input value={broadcast.title} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.title = event.target.value; }))} /></Field>
              <FormattedTextarea area="broadcast" label="Текст" tall value={broadcast.body} document={draft.formattedText[portiaTextKey.broadcast(broadcast.id)]} formatKey={portiaTextKey.broadcast(broadcast.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.broadcast(broadcast.id), value, document, (next, text) => updateById(next.broadcasts, broadcast.id, (item) => { item.body = text; }))} />
              {broadcast.type === "quest" && (
                <>
                  <Field label="Дата начала"><input type="date" value={broadcast.startsAt} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.startsAt = event.target.value; }))} /></Field>
                  <Field label="Дата окончания"><input type="date" value={broadcast.endsAt} min={broadcast.startsAt || undefined} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.endsAt = event.target.value; }))} /></Field>
                  <Field label="Условия" wide><textarea value={broadcast.conditions} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.conditions = event.target.value; }))} /></Field>
                </>
              )}
              <label className="publish-toggle"><input type="checkbox" checked={broadcast.published} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.published = event.target.checked; }))} /><span>Показывать посетителям</span></label>
              {broadcast.type === "news" && <label className="publish-toggle"><input type="checkbox" checked={broadcast.important} onChange={(event) => changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.important = event.target.checked; }))} /><span>Важная новость — выделить и закрепить сверху</span></label>}
            </div>
          ))}
          <button className="secondary-control" type="button" onClick={() => changeDraft((next) => next.broadcasts.unshift({ id: makeId("broadcast"), type: "news", title: "", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" }))}>+ НОВОЕ СООБЩЕНИЕ</button>
        </div>
      )}

      {tab === "recycle" && (
        <div className="virus-editor-layout recycle-editor-layout" ref={layoutRef} data-mobile-view={recordOpen && (selectedRecycledVirus || selectedRecycleFile) ? "record" : "list"}>
          <button type="button" className="secondary-control editor-back-to-list" onClick={() => showRecord(false)}>← К списку</button>
          <aside className="editor-record-list">
            {orderedRecycleKeys.map((key, index) => {
              const isVirus = key.startsWith("virus:");
              const id = key.slice(key.indexOf(":") + 1);
              const virus = isVirus ? draft.recycledViruses.find((item) => item.id === id) : null;
              const file = !isVirus ? draft.recycleFiles.find((item) => item.id === id) : null;
              if (!virus && !file) return null;
              const title = virus?.name || file?.name || "БЕЗ ИМЕНИ";
              return <div className="editor-record-row" data-sort-index={index} key={key}>
                <OrderDragHandle index={index} label={title} onMove={(from, to) => changeDraft((next) => { const order = recycleKeys(next); moveArrayItem(order, from, to); next.recycleOrder = order; })} />
                <button type="button" className={(virus ? virus.id === shownRecycledVirusId : file!.id === shownRecycleFileId) ? "active" : ""} onClick={() => {
                  if (virus) { setSelectedRecycledVirusId(virus.id); setSelectedRecycleFileId(""); }
                  else { setSelectedRecycleFileId(file!.id); setSelectedRecycledVirusId(""); }
                  showRecord(true);
                }}>
                  <strong>{title}</strong><small>{virus ? "ВИРУС В КОРЗИНЕ" : file!.kind === "virus" ? "ФАЙЛ ВИРУСА" : file!.kind === "image" ? "ИЗОБРАЖЕНИЕ" : "ТЕКСТОВЫЙ ФАЙЛ"}</small>
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
              uploadState={uploadState}
              onUpload={uploadImage}
              onChange={updateRecycledVirus}
              onRemoveMutation={(index) => changeDraft((next) => updateById(next.recycledViruses ?? [], selectedRecycledVirus.id, (virus) => removeMutation(next, virus, index)))}
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
                  <ImageEditorField label="Фотография или GIF" value={selectedRecycleFile.image} placement="recycle" maxHint="На странице: максимум 800 × 720 px" uploadState={uploadState} onChange={(value) => updateRecycleFile((file) => { file.image = value; })} onUpload={(upload) => uploadImage(upload, (url) => updateRecycleFile((file) => {
                    file.image = url;
                    if (!file.name || file.name === "НОВЫЙ_ФАЙЛ.txt") file.name = upload.name;
                  }))} />
                </EditorGroup>
              )}

              <EditorGroup title={selectedRecycleFile.kind === "image" ? "Подпись" : selectedRecycleFile.kind === "virus" ? "Дополнительный текст" : "Содержимое"} stack>
                <FormattedTextarea area={selectedRecycleFile.kind === "image" ? "caption" : "trash"} label={selectedRecycleFile.kind === "image" ? "Описание фотографии" : "Текст файла"} tall value={selectedRecycleFile.content} document={draft.formattedText[portiaTextKey.recycle(selectedRecycleFile.id)]} formatKey={portiaTextKey.recycle(selectedRecycleFile.id)} onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(portiaTextKey.recycle(selectedRecycleFile.id), value, document, (next, text) => updateById(next.recycleFiles, selectedRecycleFile.id, (file) => { file.content = text; }))} />
              </EditorGroup>

              <button className="danger-control" type="button" onClick={() => {
                const nextId = draft.recycleFiles.find((file) => file.id !== selectedRecycleFile.id)?.id ?? "";
                changeDraft((next) => { next.recycleFiles = next.recycleFiles.filter((file) => file.id !== selectedRecycleFile.id); next.recycleOrder = recycleKeys(next); });
                setSelectedRecycleFileId(nextId);
                showRecord(false);
              }}>УДАЛИТЬ ЭТОТ ФАЙЛ</button>
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
            })} /><span><small>{String(index + 1).padStart(2, "0")}</small>{recommendation || "ПУСТАЯ СТРОКА"}</span></div>)}
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
          <p className="editor-guidance">Если за выбранный промежуток дружок пирожок ничего не делал, Вивьян выберет фразу бездействия. Если он нажимал, печатал, прокручивал страницу или двигал указатель — фразу активности</p>
        </div>
      )}

      {tab === "employees" && <EmployeeProfilesEditor onSaved={onEmployeeSaved} onDirtyChange={setEmployeeDirty} leaving={leaving} onLeave={onEmployeeLeave} />}

      {tab === "access" && canManageEditors && <EditorAccessManager />}
      {formatterOpen && formatTarget && <FloatingTextFormatPanel key={formatTarget.key} target={formatTarget} previewSurface={previewSurface} onPreviewSurface={setPreviewSurface} onUpdate={setFormatTarget} onClose={() => setFormatterOpen(false)} />}
      {barVisible && (
        <div className="editor-savebar" data-dirty={dirty || undefined}>
          <p role="status" aria-live="polite">
            {statusText && <span className={`editor-save-status ${saveState}`}>{statusText}</span>}
            {dirty && <span className="editor-savebar-sections">{`Не сохранено: ${changed.map((id) => sectionLabels[id]).join(", ")}`}</span>}
          </p>
          <div className="editor-savebar-actions">
            <button type="button" className="secondary-control editor-undo-step" aria-label="Отменить последнее действие" disabled={!history.past.length} onClick={() => step("undo")}>↶</button>
            <button type="button" className="secondary-control" disabled={!dirty || saveState === "saving"} onClick={() => setDialog("discard")}>ОТМЕНИТЬ</button>
            <button type="button" className="primary-control" disabled={!dirty || saveState === "saving"} onClick={() => void save()}>СОХРАНИТЬ</button>
          </div>
        </div>
      )}
      {dialog === "discard" && (
        <ConfirmDialog
          title="Отменить несохранённые правки?"
          text={`Черновик вернётся к последнему сохранённому состоянию. Не сохранено: ${changed.map((id) => sectionLabels[id]).join(", ")}`}
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
          text={`Удалить «${selectedRecycledVirus.name}» навсегда? Это действие нельзя отменить.`}
          actions={[
            { label: "УДАЛИТЬ НАВСЕГДА", tone: "danger", onClick: () => { setDialog(null); deleteSelectedRecycledVirus(); } },
            { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: () => setDialog(null) },
          ]}
          onCancel={() => setDialog(null)}
        />
      )}
      {closeAsked && !employeeDirty && (
        <ConfirmDialog
          title="Закрыть редактор?"
          text={`Не сохранено: ${changed.map((id) => sectionLabels[id]).join(", ")}`}
          actions={[
            {
              label: "СОХРАНИТЬ",
              tone: "primary",
              // The modal stays up during the request, so nothing can be typed that the close would lose.
              // Closes only if the save left nothing unsaved and the close was not cancelled meanwhile;
              // otherwise the window stays and the bar shows the unsaved edits, ОШИБКА or the conflict.
              disabled: saveState === "saving",
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

function EmployeeProfilesEditor({ onSaved, onDirtyChange, leaving, onLeave }: {
  onSaved: (employee: PortiaEmployee) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** The editor wants to leave this tab or close; the unsaved draft has to be answered first. */
  leaving: boolean;
  onLeave: (ok: boolean) => void;
}) {
  const [employees, setEmployees] = useState<PortiaEmployee[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<EmployeeProfile | null>(null);
  const [ratingsPending, setRatingsPending] = useState(false);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);
  const selected = employees.find((employee) => employee.id === selectedId) ?? employees[0] ?? null;
  const dirty = Boolean(selected && draft && profileChanged(profileOf(selected), draft));
  // Read after an awaited save: a cancelled question must not continue into the switch (D-02).
  const asking = pendingEmployeeId !== null || leaving;
  const askingRef = useRef(asking);
  useEffect(() => { askingRef.current = asking; });

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
    void fetch("/api/employees")
      .then(async (response) => {
        if (!response.ok) throw new Error("load failed");
        return response.json() as Promise<{ employees?: PortiaEmployee[] }>;
      })
      .then((payload) => {
        if (!active) return;
        const next = payload.employees ?? [];
        const first = next[0];
        setEmployees(next);
        setSelectedId(first?.id ?? "");
        if (first) setDraft(profileOf(first));
        setState("idle");
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  // Resolves true only when the profile is saved; a failure leaves the error text on the current employee.
  const save = async (): Promise<boolean> => {
    if (!selected || !draft) return false;
    setState("saving");
    setRatingsPending(false);
    setErrorMessage("");
    try {
      const response = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, changes: draft }),
      });
      const payload = await response.json() as { employee?: PortiaEmployee; ratingsPending?: boolean; error?: string };
      if (!response.ok || !payload.employee) {
        const message = response.status === 403
          ? "Сессия редактора истекла. Войдите в редактор снова."
          : payload.error || `Сервер отклонил сохранение (${response.status}).`;
        throw new Error(message);
      }
      setEmployees((current) => current.map((employee) => employee.id === payload.employee!.id ? payload.employee! : employee));
      onSaved(payload.employee);
      setDraft(profileOf(payload.employee));
      setRatingsPending(Boolean(payload.ratingsPending));
      setState("saved");
      window.setTimeout(() => setState("idle"), 1800);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить профиль.");
      setState("error");
      return false;
    }
  };

  if (state === "loading") return <div className="editor-empty">Загрузка сотрудников…</div>;
  if (!selected || !draft) return <div className="editor-empty">{state === "error" ? "Не удалось загрузить сотрудников из таблицы. Обновите страницу через минуту." : "В таблице пока нет сотрудников."}</div>;

  const openEmployee = (employee: PortiaEmployee) => {
    setSelectedId(employee.id);
    setDraft(profileOf(employee));
    setRatingsPending(false);
    setState("idle");
    setRecordOpen(true);
    revealOnPhone(layoutRef);
  };
  // Unsaved edits are asked about before another employee replaces the draft (D-02).
  const chooseEmployee = (employee: PortiaEmployee) => {
    if (!dirty) return openEmployee(employee);
    // The same employee: only show the record, the edits stay.
    if (employee.id === selected.id) { setRecordOpen(true); revealOnPhone(layoutRef); return; }
    // A sent PATCH cannot be cancelled; its answer would overwrite the next employee's draft.
    if (state !== "saving") setPendingEmployeeId(employee.id);
  };
  // After the answer: to the pending employee, or out of the tab / the window (the draft is dropped when not saved).
  const continueLeave = () => {
    const next = employees.find((employee) => employee.id === pendingEmployeeId);
    setPendingEmployeeId(null);
    if (next) openEmployee(next);
    else {
      setDraft(profileOf(selected));
      onLeave(true);
    }
  };
  const cancelLeave = () => {
    setPendingEmployeeId(null);
    if (leaving) onLeave(false);
  };

  const preview = draft.photoUrl || selected.robloxAvatarUrl;
  return <div className="virus-editor-layout employee-editor-layout" ref={layoutRef} data-mobile-view={recordOpen ? "record" : "list"}>
    <button type="button" className="secondary-control editor-back-to-list" onClick={() => { setRecordOpen(false); revealOnPhone(layoutRef); }}>← К списку</button>
    <aside className="editor-record-list">
      {employees.map((employee) => <button key={employee.id} type="button" className={employee.id === selected.id ? "active" : ""} onClick={() => chooseEmployee(employee)}><strong>{employee.nickname}</strong><small>{[employee.callsign, employee.title, employee.rank].filter(Boolean).join(" · ")}</small></button>)}
    </aside>
    <div className="editor-form employee-profile-editor">
      <p className="editor-guidance">Поля из Google Таблицы обновляются автоматически. Здесь редакторы могут менять фотографию, оценки и биографию.</p>
      <div className="employee-editor-summary">
        <figure>{preview ? <img src={preview} alt={`Аватар ${selected.nickname}`} referrerPolicy="no-referrer" /> : <img src="/assets/portia-logo.png" alt="" />}</figure>
        <div><span className="eyebrow">{selected.title || "БЕЗ ЗВАНИЯ"}</span><h2>{selected.nickname}</h2><p>{[selected.callsign || "без позывного", selected.rank || "ранг не указан"].join(" · ")}</p></div>
      </div>
      <EditorGroup title="Профиль сотрудника">
        {employeeRatings.map(({ key, label }) => <Field key={key} label={`${label} — от 1 до 10`}><select value={draft[key] ?? ""} onChange={(event) => setDraft((current) => current && ({ ...current, [key]: event.target.value === "" ? null : Number(event.target.value) }))}>{key !== "knowledgeRating" && <option value="">—</option>}{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>)}
        <Field label="Ссылка на фото"><input value={draft.photoUrl} onChange={(event) => setDraft((current) => current && ({ ...current, photoUrl: event.target.value }))} placeholder="Пусто — использовать аватар Roblox" /></Field>
        <Field label="Биография" wide><textarea className="tall-textarea" value={draft.biography} onChange={(event) => setDraft((current) => current && ({ ...current, biography: event.target.value }))} /></Field>
      </EditorGroup>
      {ratingsPending && <p className="editor-guidance" role="status">Сохранено без новых оценок ({employeeRatings.slice(1).map((rating) => rating.label).join(", ")}): база данных ещё не обновлена.</p>}
      <div className="employee-editor-save"><span className={`editor-save-status ${state}`}>{state === "saving" ? "СОХРАНЕНИЕ…" : state === "saved" ? "СОХРАНЕНО" : state === "error" ? errorMessage : "ТОЛЬКО ДЛЯ РЕДАКТОРОВ"}</span>{state === "error" && errorMessage.includes("Войдите") && <a className="secondary-control" href="/owner-login">ВОЙТИ СНОВА</a>}<button className="primary-control" type="button" disabled={state === "saving"} onClick={() => void save()}>СОХРАНИТЬ ПРОФИЛЬ</button></div>
    </div>
    {asking && (
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
                if (saved) continueLeave();
                else cancelLeave();
              });
            },
          },
          { label: "НЕ СОХРАНЯТЬ", tone: "danger", disabled: state === "saving", onClick: continueLeave },
          { label: "ОТМЕНА", tone: "secondary", autoFocus: true, onClick: cancelLeave },
        ]}
        onCancel={cancelLeave}
      />
    )}
  </div>;
}

function ArchivedVirusEditor({ virus, uploadState, onUpload, onChange, onRemoveMutation, onRestore, onDelete, dossierChanged }: {
  virus: Virus;
  uploadState: "idle" | "uploading" | "error";
  onUpload: (file: File, onUploaded: (url: string) => void) => void;
  onChange: (updater: (virus: Virus) => void) => void;
  onRemoveMutation: (index: number) => void;
  onRestore: () => void;
  onDelete: () => void;
  dossierChanged: DossierTab[];
}) {
  const [dossierTab, setDossierTab] = useState<DossierTab>("main");
  return <div className="editor-form virus-editor-form">
    <p className="editor-guidance">Это полная запись вируса в Корзине. Она не показывается в основной базе, но остаётся доступной посетителям в Корзине и может быть восстановлена.</p>
    <DossierTabs active={dossierTab} changed={dossierChanged} onSelect={setDossierTab} />
    {dossierTab === "main" && <EditorGroup title="Основные данные">
      <Field label="Название"><input value={virus.name} onChange={(event) => onChange((item) => { item.name = event.target.value; })} /></Field>
      <Field label="Код"><input value={virus.code} onChange={(event) => onChange((item) => { item.code = event.target.value; })} /></Field>
      <Field label="Статус"><input value={virus.status} onChange={(event) => onChange((item) => { item.status = event.target.value; })} /></Field>
      <ImageEditorField label="Фото или GIF после заражения" value={virus.infectedImage} placement="dossier" maxHint="На странице: максимум 540 × 620 px" uploadState={uploadState} onChange={(value) => onChange((item) => { item.infectedImage = value; })} onUpload={(file) => onUpload(file, (url) => onChange((item) => { item.infectedImage = url; }))} />
    </EditorGroup>}
    {dossierTab === "text" && <EditorGroup title="Описание" stack>
      <Field label="Внешние характеристики" wide><textarea value={virus.external} onChange={(event) => onChange((item) => { item.external = event.target.value; })} /></Field>
      <Field label="Физиологические характеристики" wide><textarea value={virus.physiology} onChange={(event) => onChange((item) => { item.physiology = event.target.value; })} /></Field>
    </EditorGroup>}
    {dossierTab === "text" && <EditorGroup title="Характеристики PPU" stack>
      {(["health", "speed", "abilities"] as const).map((key) => <Field key={key} label={{ health: "Здоровье", speed: "Скорость", abilities: "Способности" }[key]} wide><textarea value={virus.ppu[key]} onChange={(event) => onChange((item) => { item.ppu[key] = event.target.value; })} /></Field>)}
    </EditorGroup>}
    {dossierTab === "main" && <EditorGroup title="Классификация">
      {([
        ["danger", "Общий уровень опасности"], ["spread", "Распространение"], ["transmission", "Способ распространения"],
        ["escapeRisk", "Угроза и риск побега"], ["mind", "Разум"], ["appearance", "Вид / внешность"], ["behavior", "Поведение"],
      ] as [keyof Virus["classification"], string][]).map(([key, label]) => <ClassificationField key={key} label={label} classificationKey={key} value={virus.classification[key]} onChange={(value) => onChange((item) => { item.classification[key] = value; })} />)}
    </EditorGroup>}
    {dossierTab === "mutations" && <EditorGroup title="Мутации" stack>
      {virus.mutations.map((mutation, index) => <div className="nested-editor-card" key={`${virus.id}-mutation-${index}`}>
        <div className="nested-editor-head"><strong>МУТАЦИЯ {String(index + 1).padStart(2, "0")}</strong><button type="button" disabled={uploadState === "uploading"} onClick={() => onRemoveMutation(index)}>Удалить</button></div>
        <Field label="Название"><input value={mutation.name} onChange={(event) => onChange((item) => { item.mutations[index].name = event.target.value; })} /></Field>
        <Field label="Описание" wide><textarea value={mutation.description} onChange={(event) => onChange((item) => { item.mutations[index].description = event.target.value; })} /></Field>
        <ImageEditorField label="Изображение или GIF мутации" value={mutation.image} placement="mutation" maxHint="На странице: максимум 420 × 360 px" uploadState={uploadState} onChange={(value) => onChange((item) => { item.mutations[index].image = value; })} onUpload={(file) => onUpload(file, (url) => onChange((item) => { const target = item.mutations[index]; if (target) target.image = url; }))} />
      </div>)}
      <button className="secondary-control" type="button" onClick={() => onChange((item) => { item.mutations.push({ name: "НОВАЯ МУТАЦИЯ", description: "", image: "" }); })}>+ ДОБАВИТЬ МУТАЦИЮ</button>
    </EditorGroup>}
    {dossierTab === "logs" && <EditorGroup title="Записи учёных" stack>
      {virus.scientistLogs.map((log, index) => <div className="nested-editor-card" key={log.id}>
        <div className="nested-editor-head"><strong>ЗАПИСЬ {String(index + 1).padStart(2, "0")}</strong><button type="button" onClick={() => onChange((item) => { item.scientistLogs.splice(index, 1); })}>Удалить</button></div>
        <Field label="Название"><input value={log.title} onChange={(event) => onChange((item) => { item.scientistLogs[index].title = event.target.value; })} /></Field>
        <Field label="Псевдоним учёного"><input value={log.scientist} onChange={(event) => onChange((item) => { item.scientistLogs[index].scientist = event.target.value; })} /></Field>
        <Field label="Уровень доступа"><select value={log.lockedLevel} onChange={(event) => onChange((item) => { item.scientistLogs[index].lockedLevel = Number(event.target.value); })}><option value={2}>II — доступна</option><option value={3}>III — заблокирована</option><option value={4}>IV — заблокирована</option></select></Field>
        <Field label="Текст записи" wide><textarea value={scientistLogPlainText(log)} onChange={(event) => onChange((item) => { item.scientistLogs[index].content = event.target.value.split(/\n\s*\n/); item.scientistLogs[index].richContent = { runs: [{ text: event.target.value }] }; })} /></Field>
      </div>)}
      <button className="secondary-control" type="button" disabled={virus.scientistLogs.length >= 5} onClick={() => onChange((item) => { item.scientistLogs.push({ id: makeId("log"), title: `ЗАПИСЬ ${String(item.scientistLogs.length + 1).padStart(2, "0")}`, scientist: "ИМЯ УЧЁНОГО", lockedLevel: 3, content: [""] }); })}>+ ДОБАВИТЬ ЗАПИСЬ</button>
    </EditorGroup>}
    <div className="archive-virus-actions"><button className="secondary-control" type="button" onClick={onRestore}>ВОССТАНОВИТЬ В БАЗУ</button><button className="danger-control" type="button" onClick={onDelete}>УДАЛИТЬ НАВСЕГДА</button></div>
  </div>;
}

function DossierTabs({ active, changed, onSelect }: { active: DossierTab; changed: DossierTab[]; onSelect: (id: DossierTab) => void }) {
  return <nav className="editor-tabs dossier-tabs" aria-label="Разделы досье">
    {dossierTabs.map(([id, label]) => {
      const unsaved = changed.includes(id);
      return <button key={id} type="button" className={active === id ? "active" : ""} aria-label={unsaved ? `${label}, есть несохранённые правки` : undefined} onClick={() => onSelect(id)}>
        {label}{unsaved && <i className="tab-dot" aria-hidden="true" />}
      </button>;
    })}
  </nav>;
}

function ClassificationField({ label, classificationKey, value, onChange }: {
  label: string;
  classificationKey: keyof Virus["classification"];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = classificationOptions[classificationKey] as readonly { value: string; level?: number }[];
  const selected = options.find((option) => option.value === value);
  const level = selected?.level;

  return <label className="editor-field classification-editor-field">
    <span>{label}</span>
    <div className={`classification-select-wrap${level ? ` level-${level}` : ""}`}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const optionLevel = option.level;
          return <option key={option.value} value={option.value}>{optionLevel ? `${optionLevel} уровень — ` : ""}{option.value}</option>;
        })}
      </select>
      {level ? <strong>УРОВЕНЬ {level}</strong> : <strong className="neutral">МЕТОД</strong>}
    </div>
  </label>;
}

function FormattedTextarea({ label, area, value, document, formatKey, onChange, onActivate, tall = false }: {
  label: string;
  area: DisplayArea;
  value: string;
  document?: RichTextDocument;
  formatKey: string;
  onChange: (value: string, document: RichTextDocument) => void;
  onActivate: (target: FormatTarget) => void;
  tall?: boolean;
}) {
  const activeFormat = useContext(ActiveFormatContext);
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const localDocumentSignatureRef = useRef<string | null>(null);
  const sourceDocument = document?.runs?.length ? document : { runs: [{ text: value }] };
  const currentDocument = sourceDocument.runs.map((run) => run.text).join("") === value
    ? sourceDocument
    : replaceRichText(sourceDocument, value);
  const documentSignature = JSON.stringify(currentDocument);

  const activate = (editor: HTMLDivElement, nextValue = value, nextDocument = currentDocument) => {
    const selection = selectionOffsets(editor);
    selectionRef.current = selection;
    onActivate({ key: formatKey, title: label, value: nextValue, document: nextDocument, selection, onCommit: onChange });
  };

  const commitEditorValue = (
    editor: HTMLDivElement,
    nextValue: string,
    selection: { start: number; end: number },
  ) => {
    const nextDocument = replaceRichText(currentDocument, nextValue);
    selectionRef.current = selection;
    renderRichTextEditor(editor, nextDocument);
    localDocumentSignatureRef.current = JSON.stringify(nextDocument);
    restoreSelection(editor, selection);
    onChange(nextValue, nextDocument);
    onActivate({ key: formatKey, title: label, value: nextValue, document: nextDocument, selection, onCommit: onChange });
  };

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || localDocumentSignatureRef.current === documentSignature) return;
    renderRichTextEditor(editor, currentDocument);
    localDocumentSignatureRef.current = documentSignature;
    if (selectionRef.current) restoreSelection(editor, selectionRef.current);
  }, [currentDocument, documentSignature]);

  return <div className="editor-field wide formatted-text-field">
    <div className="formatted-text-field-head"><span>{label}</span><small></small></div>
    <div
      ref={editorRef}
      data-area={area}
      data-format-key={formatKey}
      className={`formatted-rich-input${tall ? " tall" : ""} preview-${activeFormat.surface}${activeFormat.key === formatKey ? " is-editor-active" : ""}`}
      contentEditable
      inputMode={activeFormat.phonePanelOpen ? "none" : undefined}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      spellCheck
      onFocus={(event) => activate(event.currentTarget)}
      onSelect={(event) => activate(event.currentTarget)}
      onMouseUp={(event) => activate(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const editor = event.currentTarget;
        const selection = selectionOffsets(editor);
        const text = currentDocument.runs.map((run) => run.text).join("");
        const nextValue = `${text.slice(0, selection.start)}\n${text.slice(selection.end)}`;
        const caret = { start: selection.start + 1, end: selection.start + 1 };
        commitEditorValue(editor, nextValue, caret);
      }}
      onKeyUp={(event) => {
        if (event.key !== "Enter") activate(event.currentTarget);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const editor = event.currentTarget;
        const selection = selectionOffsets(editor);
        const text = currentDocument.runs.map((run) => run.text).join("");
        const pastedText = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
        const nextValue = `${text.slice(0, selection.start)}${pastedText}${text.slice(selection.end)}`;
        const caretPosition = selection.start + pastedText.length;
        commitEditorValue(editor, nextValue, { start: caretPosition, end: caretPosition });
      }}
      onInput={(event) => {
        const nextValue = editorPlainText(event.currentTarget);
        const selection = selectionOffsets(event.currentTarget);
        commitEditorValue(event.currentTarget, nextValue, selection);
      }}
    />
    <small className="formatted-text-field-hint">Текст и GIF можно использовать вместе, не добавляй всякой фигни ок?</small>
  </div>;
}

function FloatingTextFormatPanel({ target, previewSurface, onPreviewSurface, onUpdate, onClose }: {
  target: FormatTarget;
  previewSurface: EditorPreviewSurface;
  onPreviewSurface: (surface: EditorPreviewSurface) => void;
  onUpdate: (target: FormatTarget) => void;
  onClose: () => void;
}) {
  const defaultTextColor = previewSurface === "dark" ? "#aebfba" : "#252827";
  const documentRef = useRef(target.document);
  const panelRef = useRef<HTMLElement>(null);
  // The readout and ✓ come from the committed document, so a click shows exactly what it applied and a repeat click is a no-op (D-02).
  const style = richTextStyleAt(target.document, target.selection.start);
  const color = style.color ?? defaultTextColor;
  const fontSize = style.fontSize ?? 17;
  const fontWeight = style.fontWeight ?? 400;
  const backgroundColor = style.backgroundColor ?? "#f0d66a";
  const backgroundOpacity = style.backgroundOpacity ?? 0;
  const [colorPicker, setColorPicker] = useState<"text" | "background" | null>(null);
  useEffect(() => { documentRef.current = target.document; }, [target.document]);

  const formatKey = target.key;
  const selectionStart = target.selection.start;
  const selectionEnd = target.selection.end;
  const formatDocument = target.document;
  // Phone: formatting is «either the keyboard or the panel» (D-05, D-06). ✎ takes focus from the field once and rich fields carry
  // inputMode none while the panel is open, so the owner can touch and select text and the panel stays (owner, UAT 12, reversing 03-03);
  // the stored selection is painted with the Custom Highlight API and kept above the panel.
  // formatDocument is a dependency because a style change re-renders the field's text nodes, which orphans the painted range.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const field = findFormatField(formatKey);
    const panel = panelRef.current;
    if (!field || !panel) return;
    const collapsed = selectionStart === selectionEnd;
    const range = rangeFromOffsets(field, { start: selectionStart, end: selectionEnd });
    const paints = !collapsed && typeof Highlight !== "undefined" && "highlights" in CSS;
    if (paints) CSS.highlights.set("portia-format", new Highlight(range));
    const keepVisible = () => {
      const rect = collapsed ? field.getBoundingClientRect() : range.getBoundingClientRect();
      const overlap = rect.bottom - (panel.getBoundingClientRect().top - 16);
      // 64 keeps the text under the 48px system bar.
      if (overlap > 0) window.scrollBy(0, Math.max(0, Math.min(overlap, rect.top - 64)));
    };
    const frame = window.requestAnimationFrame(keepVisible);
    window.visualViewport?.addEventListener("resize", keepVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", keepVisible);
      if (paints) CSS.highlights.delete("portia-format");
    };
  }, [formatKey, selectionStart, selectionEnd, formatDocument]);

  // On a phone, closing returns the caret to the field in the same tap so the keyboard can come back (iOS may still need one more tap);
  // flushSync commits the close first so the field has dropped inputMode none before it gets focus.
  const finish = () => {
    flushSync(onClose);
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const field = findFormatField(formatKey);
    if (!field) return;
    field.focus({ preventScroll: true });
    restoreSelection(field, { start: selectionStart, end: selectionEnd });
  };

  const selectionLabel = target.selection.start === target.selection.end
    ? "ВЕСЬ ТЕКСТ"
    : `${Math.abs(target.selection.end - target.selection.start)} ЗНАК.`;

  const commit = (document: RichTextDocument) => {
    documentRef.current = document;
    target.onCommit(target.value, document);
    onUpdate({ ...target, document });
  };

  const applyStyle = (style: RichTextStyle) => commit(applyRichTextStyle(
    documentRef.current,
    target.selection.start,
    target.selection.end,
    style,
  ));

  const reset = () => {
    commit(resetRichTextStyle(documentRef.current, target.selection.start, target.selection.end));
  };

  return <section ref={panelRef} className="floating-text-format" role="region" aria-label={`Форматирование: ${target.title}`}>
    <header>
      <div><span>РЕДАКТОР ОФОРМЛЕНИЯ</span><strong>{target.title}</strong></div>
      <small>{selectionLabel}</small>
      <button type="button" onClick={finish} aria-label="Закрыть редактор">×</button>
    </header>
    <div className="rich-text-toolbar" aria-label="Оформление текста">
      <div className="format-control preview-surface-control"><span>Фон предпросмотра</span><div className="format-choice-row"><button type="button" className={previewSurface === "light" ? "selected" : ""} onClick={() => onPreviewSurface("light")}>БЕЛЫЙ</button><button type="button" className={previewSurface === "dark" ? "selected" : ""} onClick={() => onPreviewSurface("dark")}>ЧЁРНЫЙ</button></div></div>
      <div className="format-control"><span className="format-control-title">Цвет текста <b><i style={{ backgroundColor: color }} />{color.toUpperCase()}</b></span><div className="format-swatches">{textColorPalette.map((item) => <button key={item.value} type="button" className={color.toLowerCase() === item.value ? "selected" : ""} title={item.label} aria-label={item.label} onClick={() => { setColorPicker(null); applyStyle({ color: item.value }); }}><i style={{ backgroundColor: item.value }} /></button>)}<button className="custom-color" type="button" title="Свой цвет" aria-label="Выбрать свой цвет текста" onClick={() => setColorPicker(colorPicker === "text" ? null : "text")}><span>+</span></button></div></div>
      <div className="format-control"><span>Размер</span><div className="format-choice-row">{[[13,"S"],[17,"M"],[22,"L"],[30,"XL"]].map(([size, label]) => <button key={size} type="button" className={fontSize === size ? "selected" : ""} onClick={() => { const value = Number(size); applyStyle({ fontSize: value }); }}>{label}</button>)}</div></div>
      <div className="format-control"><span>Толщина</span><div className="format-choice-row">{[[400,"ОБЫЧНЫЙ"],[600,"СРЕДНИЙ"],[800,"ЖИРНЫЙ"]].map(([weight, label]) => <button key={weight} type="button" className={fontWeight === weight ? "selected" : ""} onClick={() => { const value = Number(weight); applyStyle({ fontWeight: value }); }}>{label}</button>)}</div></div>
      <div className="format-control"><span className="format-control-title">Фон текста <b><i style={{ backgroundColor }} />{backgroundOpacity > 0 ? backgroundColor.toUpperCase() : "БЕЗ ФОНА"}</b></span><div className="format-swatches"><button type="button" className={`no-background${backgroundOpacity === 0 ? " selected" : ""}`} onClick={() => { setColorPicker(null); applyStyle({ backgroundOpacity: 0 }); }}>БЕЗ ФОНА</button>{backgroundColorPalette.map((item) => <button key={item.value} type="button" className={backgroundColor.toLowerCase() === item.value && backgroundOpacity > 0 ? "selected" : ""} title={item.label} aria-label={item.label} onClick={() => { const opacity = backgroundOpacity || .45; setColorPicker(null); applyStyle({ backgroundColor: item.value, backgroundOpacity: opacity }); }}><i style={{ backgroundColor: item.value }} /></button>)}<button className="custom-color" type="button" title="Свой фон" aria-label="Выбрать свой цвет фона" onClick={() => setColorPicker(colorPicker === "background" ? null : "background")}><span>+</span></button></div></div>
      <label className="format-control opacity-control"><span>Плотность фона: {Math.round(backgroundOpacity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={backgroundOpacity} onChange={(event) => { const opacity = Number(event.target.value); applyStyle({ backgroundColor, backgroundOpacity: opacity }); }} /></label>
      {colorPicker && <CustomColorPicker
        key={`${colorPicker}:${target.selection.start}:${target.selection.end}`}
        title={colorPicker === "text" ? "Свой цвет текста" : "Свой цвет фона"}
        color={colorPicker === "text" ? color : backgroundColor}
        onChange={(nextColor) => {
          if (colorPicker === "text") {
            applyStyle({ color: nextColor });
          } else {
            const opacity = backgroundOpacity || .45;
            applyStyle({ backgroundColor: nextColor, backgroundOpacity: opacity });
          }
        }}
        onClose={() => setColorPicker(null)}
      />}
    </div>
    <footer><p>Изменения применяются сразу. Без выделения меняется весь текст.</p><div><button type="button" className="reset-format" onClick={reset}>СБРОСИТЬ</button><button type="button" className="finish-format" onClick={finish}>ГОТОВО</button></div></footer>
  </section>;
}

function CustomColorPicker({ title, color, onChange, onClose }: {
  title: string;
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const initial = hexToHsv(color);
  const [hue, setHue] = useState(initial.hue);
  const [saturation, setSaturation] = useState(initial.saturation);
  const [value, setValue] = useState(initial.value);
  const [hex, setHex] = useState(color.toUpperCase());

  const choose = (nextHue: number, nextSaturation: number, nextValue: number) => {
    setHue(nextHue);
    setSaturation(nextSaturation);
    setValue(nextValue);
    const nextHex = hsvToHex(nextHue, nextSaturation, nextValue).toUpperCase();
    setHex(nextHex);
    onChange(nextHex);
  };

  const chooseFromBoard = (event: React.PointerEvent<HTMLDivElement>) => {
    const board = event.currentTarget;
    const rect = board.getBoundingClientRect();
    const nextSaturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextValue = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    choose(hue, nextSaturation, nextValue);
  };

  return <div className="custom-color-picker" role="group" aria-label={title}>
    <div className="custom-color-picker-head"><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Закрыть выбор цвета">×</button></div>
    <div
      className="custom-color-board"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))` }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); chooseFromBoard(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseFromBoard(event); }}
    >
      <i style={{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%` }} />
    </div>
    <label className="custom-hue"><span>ТОН</span><input type="range" min="0" max="359" value={Math.round(hue)} onChange={(event) => choose(Number(event.target.value), saturation, value)} /></label>
    <div className="custom-color-value">
      <i style={{ backgroundColor: hex }} />
      <label><span>HEX</span><input value={hex} maxLength={7} onChange={(event) => {
        const nextHex = event.target.value.toUpperCase();
        setHex(nextHex);
        if (/^#[0-9A-F]{6}$/.test(nextHex)) {
          const next = hexToHsv(nextHex);
          setHue(next.hue);
          setSaturation(next.saturation);
          setValue(next.value);
          onChange(nextHex);
        }
      }} /></label>
    </div>
  </div>;
}

type EditorAccount = { email: string; created_at: string };

function EditorAccessManager() {
  const [editors, setEditors] = useState<EditorAccount[]>([]);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

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
      const payload = await response.json() as { editors?: EditorAccount[] };
      setEditors(payload.editors ?? []);
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
      setMessage("Доступ отозван.");
      setState("idle");
    } catch {
      setState("error");
      setMessage("Нет связи с сервером. Попробуйте ещё раз.");
    }
  };

  return <div className="editor-form flat-editor-form access-editor">
    <div className="access-editor-intro"><span className="eyebrow">ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА</span><h2>Аккаунты редакторов</h2><p>Укажите email человека, которому разрешено менять сайт. Затем он откроет страницу входа, создаст собственный аккаунт с этим email и войдёт со своим паролем.</p></div>
    <div className="access-editor-add"><label className="editor-field"><span>Email нового редактора</span><input type="email" value={email} placeholder="name@example.com" onChange={(event) => setEmail(event.target.value)} /></label><button className="primary-control" type="button" disabled={!email.trim() || state === "saving"} onClick={() => void addEditor()}>ВЫДАТЬ ДОСТУП</button></div>
    {message && <div className={`access-editor-message ${state}`}>{message}</div>}
    <div className="access-editor-list">
      {state === "loading" && <div className="editor-empty compact-empty">Загрузка списка…</div>}
      {state !== "loading" && editors.length === 0 && <div className="editor-empty compact-empty">Дополнительных редакторов пока нет.</div>}
      {editors.map((editor) => <div key={editor.email}><div><strong>{editor.email}</strong><small>ДОСТУП К РЕДАКТОРУ</small></div><button type="button" onClick={() => void removeEditor(editor.email)}>ОТОЗВАТЬ</button></div>)}
    </div>
  </div>;
}

type ConfirmAction = { label: string; tone: "primary" | "secondary" | "danger"; onClick: () => void; autoFocus?: boolean; disabled?: boolean };

// A native modal dialog lives in the top layer: above the transformed editor window, the taskbar and the boot screen,
// with focus trapped and the page inert. Never use window.confirm for new prompts: embedded browsers answer it "no" unseen.
function ConfirmDialog({ title, text, actions, onCancel }: { title: string; text: string; actions: ConfirmAction[]; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // showModal focuses the first button; the safe action has to win instead.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="portia-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onClose={() => onCancel()}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div>
        <h2 id={titleId}>{title}</h2>
        <p id={textId}>{text}</p>
        <div className="portia-dialog-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className={`${action.tone}-control`} autoFocus={action.autoFocus} data-autofocus={action.autoFocus || undefined} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>
          ))}
        </div>
      </div>
    </dialog>
  );
}

function EditorGroup({ title, children, stack = false }: { title: string; children: React.ReactNode; stack?: boolean }) {
  return <section className={`editor-group${stack ? " stack" : ""}`}><h2>{title}</h2><div className="editor-field-grid">{children}</div></section>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`editor-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>;
}

function ImageEditorField({ label, value, placement, maxHint, uploadState = "idle", onChange, onUpload }: {
  label: string;
  value: string;
  placement: ImagePlacement;
  maxHint: string;
  uploadState?: "idle" | "uploading" | "error";
  onChange: (value: string) => void;
  onUpload?: (file: File) => void;
}) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState("");
  const previewFailed = Boolean(value) && failedPreviewUrl === value;

  const receiveFile = (file: File | undefined) => {
    if (file && onUpload) onUpload(file);
  };

  return <div className={`editor-field wide image-editor-field image-placement-${placement}`}>
    <span>{label}</span>
    <input value={value} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="Вставьте прямую HTTPS-ссылку на изображение или .gif" onChange={(event) => onChange(event.target.value)} onBlur={(event) => onChange(mediaUrlFromText(event.currentTarget.value))} onPaste={(event) => { const text = event.clipboardData.getData("text"); const url = mediaUrlFromText(text); if (url && url !== text) { event.preventDefault(); onChange(url); } }} />
    <small className="editor-media-hint">{maxHint}. GIF запускается автоматически. Для Tenor используйте ссылку с <b>media.tenor.com</b>, а не адрес страницы просмотра.</small>
    {onUpload && <label className="editor-dropzone" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); receiveFile(event.dataTransfer.files?.[0]); }}>
      <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { receiveFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <strong>ВЫБРАТЬ ФАЙЛ С КОМПЬЮТЕРА</strong>
      <small>или перетащите изображение сюда · PNG, JPG, WEBP, GIF · до 4 МБ</small>
    </label>}
    <span className={`editor-upload-status ${uploadState}`}>{uploadState === "uploading" ? "ЗАГРУЗКА…" : uploadState === "error" ? "НЕ УДАЛОСЬ ЗАГРУЗИТЬ" : ""}</span>
    {value && !previewFailed && <figure className={`editor-image-preview ${placement}`}><img src={value} alt={`Предпросмотр: ${label}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedPreviewUrl(value)} /></figure>}
    {value && previewFailed && <span className="editor-media-error">Не удалось открыть ссылку. Нужна прямая HTTPS-ссылка на файл изображения или GIF.</span>}
  </div>;
}
