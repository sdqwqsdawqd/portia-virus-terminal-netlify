"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CustomColorPicker } from "@/components/custom-color-picker";
import { mergeFragments, pickCurrentRange, removeFragmentAt, type FormatFragment } from "@/lib/format-fragments";
import { TYPING_PAUSE_MS } from "@/lib/editor-history";
import { makeId } from "@/lib/editor-items";
import { formatLaunchLabels } from "@/lib/format-launch";
import type { RichTextDocument, RichTextStyle } from "@/lib/portia-content";
import { applyRichTextStyle, fieldSelectionStep, rangeHasStyle, rangeIsPlain, removeRichTextStyleKeys, replaceRichTextRuns, resetRichTextStyle, resolveRange, richTextStyleAt, stylePresets, togglePreset, type FieldSelectionEvent, type FieldSelectionState } from "@/lib/rich-text-style";
import { clampPanelOffset, initialPanelOffset, parsePanelOffset, type PanelOffset } from "@/lib/panel-position";

export type FormatTarget = {
  key: string;
  title: string;
  value: string;
  document: RichTextDocument;
  selection: { start: number; end: number } | null;
  area: DisplayArea;
  onCommit: (value: string, document: RichTextDocument) => void;
  // EDIT-06: the pointer or key gesture that made this target decides whether fragments are kept, extended or cleared (D-13, D-14).
  gesture: { id: number; additive: boolean };
  // The fragments other than the current selection, and the targets of the other fields that hold them. A target made by a field has neither.
  fragments: FormatFragment[];
  peers: Record<string, FormatTarget>;
};

let gestureCounter = 0;

// Phase 10 D-21: Ctrl everywhere, Cmd on a Mac, never the Windows key.
const addsFragment = (event: { ctrlKey: boolean; metaKey: boolean }) => event.ctrlKey || (event.metaKey && /^(Mac|iPhone|iPad|iPod)/.test(navigator.platform));

export type EditorPreviewSurface = "light" | "dark";

// Site area whose font the field mirrors; paired in the shared font block in app/portia.css.
type DisplayArea = "lead" | "metric" | "mutation" | "scientist" | "info" | "broadcast" | "trash" | "caption" | "search" | "assistant";

// The surface each field opens on is its site place's own (D-09, D-17); an explicit БЕЛЫЙ/ЧЁРНЫЙ choice overrides it until the next tab switch.
const nativeSurface: Record<DisplayArea, EditorPreviewSurface> = { lead: "light", metric: "light", mutation: "light", scientist: "light", trash: "light", info: "dark", broadcast: "dark", caption: "dark", search: "dark", assistant: "dark" };

export const ActiveFormatContext = createContext<{ key: string | null; surface: EditorPreviewSurface | null; phonePanelOpen: boolean }>({ key: null, surface: null, phonePanelOpen: false });

const textColorPalette = [
  { value: "#0b7568", label: "Portia" },
  { value: "#167a4d", label: "Зелёный" },
  { value: "#a06f00", label: "Янтарный" },
  { value: "#b43632", label: "Красный" },
  { value: "#316e9b", label: "Синий" },
];

// D-06 / D-07 base text colours; oklch is the source of truth (D-17). «Основной» shows this and stores no colour.
const baseInk = { dark: "oklch(.79 calc(.02 * var(--accent-chroma)) var(--accent-hue))", light: "oklch(.237 calc(.015 * var(--accent-chroma)) var(--accent-hue))" };

const backgroundColorPalette = [
  { value: "#f0d66a", label: "Жёлтый" },
  { value: "#9adfce", label: "Мятный" },
  { value: "#a9cae1", label: "Голубой" },
  { value: "#e8aaa6", label: "Розовый" },
  { value: "#b8c0bd", label: "Серый" },
  { value: "#26312f", label: "Тёмный" },
];

// OWN-05: the typing rule lives in lib/rich-text-style.ts; the export stays because portia-editor.tsx imports it.
export function replaceRichText(document: RichTextDocument, nextText: string) {
  return replaceRichTextRuns(document, nextText);
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

// null when the document has no range in this field: a lost selection must not look like a caret at 0 (D-05).
// Firefox keeps every range of a Ctrl selection (Chromium keeps one), so all ranges inside the field are read and pickCurrentRange chooses the new one.
function rootRanges(root: HTMLElement) {
  const selection = window.getSelection();
  const found: { start: number; end: number }[] = [];
  for (let index = 0; selection && index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) continue;
    const beforeStart = range.cloneRange();
    beforeStart.selectNodeContents(root);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = range.cloneRange();
    beforeEnd.selectNodeContents(root);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    found.push({ start: beforeStart.toString().length, end: beforeEnd.toString().length });
  }
  return found;
}

function selectionOffsets(root: HTMLElement, known: { start: number; end: number }[] = []) {
  return pickCurrentRange(rootRanges(root), known);
}

// Firefox drops the caret at offset 0 of a field when a Ctrl press lands in it while another field holds the selection, so a Ctrl+drag
// would start at the start of the field. After the press has been handled, put a lone caret back under the pointer (a no-op where the browser got it right).
function pinCaretUnderPointer(editor: HTMLElement, x: number, y: number) {
  const at = window.document.caretPositionFromPoint?.(x, y);
  if (!at || !editor.contains(at.offsetNode)) return;
  window.setTimeout(() => {
    const selection = window.getSelection();
    if (selection?.rangeCount === 1 && selection.isCollapsed && !(selection.anchorNode === at.offsetNode && selection.anchorOffset === at.offset)) selection.collapse(at.offsetNode, at.offset);
  }, 0);
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

// Never writes into an unfocused field: a phone would raise native selection handles, and an unfocused field has no stored selection anyway (cleared on blur).
function restoreSelection(root: HTMLElement, offsets: { start: number; end: number }) {
  if (window.document.activeElement !== root) return;
  const range = rangeFromOffsets(root, offsets);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

// D-16: the batch of a panel control. The id is kept while the same control fires again within the typing pause (a slider or colour board drag).
function nextBatch(last: { control: string; id: string; at: number } | null, control: string) {
  const at = Date.now();
  const id = last && last.control === control && at - last.at <= TYPING_PAUSE_MS ? last.id : `batch:${makeId("batch")}`;
  return { control, id, at };
}

export function findFormatField(key: string) {
  return window.document.querySelector<HTMLElement>(`[data-format-key="${CSS.escape(key)}"]`);
}

export function FormattedTextarea({ label, area, value, document, formatKey, onChange, onActivate, tall = false, hint }: {
  label: string;
  area: DisplayArea;
  value: string;
  document?: RichTextDocument;
  formatKey: string;
  onChange: (value: string, document: RichTextDocument) => void;
  onActivate: (target: FormatTarget) => void;
  tall?: boolean;
  // Optional line under the field; without it the editor's own hint is shown.
  hint?: string;
}) {
  const labelId = useId();
  const activeFormat = useContext(ActiveFormatContext);
  const editorRef = useRef<HTMLDivElement>(null);
  // Selection policy of this field: own input opens on pointer / key down and closes after release or blur (CR-01, D-05).
  const selectionRef = useRef<FieldSelectionState>({ stored: null, ownUntil: 0 });
  const localDocumentSignatureRef = useRef<string | null>(null);
  const sourceDocument = document?.runs?.length ? document : { runs: [{ text: value }] };
  const currentDocument = sourceDocument.runs.map((run) => run.text).join("") === value
    ? sourceDocument
    : replaceRichText(sourceDocument, value);
  const documentSignature = JSON.stringify(currentDocument);

  const track = (event: FieldSelectionEvent) => { selectionRef.current = fieldSelectionStep(selectionRef.current, event); };
  // EDIT-06: every pointer press or editing key starts a gesture; only a Ctrl/Cmd press on a PC is additive (D-12, D-13).
  // known: the ranges the browser already held when an additive press began (Firefox keeps them next to the new one).
  const gestureRef = useRef({ id: 0, additive: false });
  const knownRef = useRef<{ start: number; end: number }[]>([]);
  const startGesture = (additive: boolean, editor?: HTMLElement) => { gestureRef.current = { id: ++gestureCounter, additive }; knownRef.current = additive && editor ? rootRanges(editor) : []; };

  const activate = (editor: HTMLDivElement, nextValue = value, nextDocument = currentDocument) => {
    track({ type: "read", at: Date.now(), incoming: selectionOffsets(editor, knownRef.current), guarded: activeFormat.phonePanelOpen });
    onActivate({ key: formatKey, title: label, value: nextValue, document: nextDocument, selection: selectionRef.current.stored, area, onCommit: onChange, gesture: gestureRef.current, fragments: [], peers: {} });
  };

  const editorSelection = (editor: HTMLElement, text: string) =>
    selectionOffsets(editor) ?? selectionRef.current.stored ?? { start: text.length, end: text.length };

  const commitEditorValue = (
    editor: HTMLDivElement,
    nextValue: string,
    selection: { start: number; end: number },
  ) => {
    // Every text change, also one made with Ctrl/Cmd held or from the context menu, ends an additive gesture, so the activation below clears the fragments (WR-01, D-14).
    startGesture(false);
    const nextDocument = replaceRichText(currentDocument, nextValue);
    selectionRef.current = { ...selectionRef.current, stored: selection };
    renderRichTextEditor(editor, nextDocument);
    localDocumentSignatureRef.current = JSON.stringify(nextDocument);
    restoreSelection(editor, selection);
    onChange(nextValue, nextDocument);
    onActivate({ key: formatKey, title: label, value: nextValue, document: nextDocument, selection, area, onCommit: onChange, gesture: gestureRef.current, fragments: [], peers: {} });
  };

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || localDocumentSignatureRef.current === documentSignature) return;
    renderRichTextEditor(editor, currentDocument);
    localDocumentSignatureRef.current = documentSignature;
    if (selectionRef.current.stored) restoreSelection(editor, selectionRef.current.stored);
  }, [currentDocument, documentSignature]);

  return <div className="editor-field wide formatted-text-field">
    <div className="formatted-text-field-head"><span id={labelId}>{label}</span></div>
    <div
      ref={editorRef}
      data-area={area}
      data-format-key={formatKey}
      className={`formatted-rich-input${tall ? " tall" : ""} preview-${activeFormat.surface ?? nativeSurface[area]}${activeFormat.key === formatKey ? " is-editor-active" : ""}`}
      contentEditable
      inputMode={activeFormat.phonePanelOpen ? "none" : undefined}
      suppressContentEditableWarning
      role="textbox"
      aria-labelledby={labelId}
      aria-multiline="true"
      spellCheck
      onPointerDown={(event) => {
        track({ type: "down" });
        if (event.isPrimary) {
          const additive = addsFragment(event) && !window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
          startGesture(additive, event.currentTarget);
          if (additive) pinCaretUnderPointer(event.currentTarget, event.clientX, event.clientY);
        }
      }}
      onPointerUp={() => track({ type: "up", at: Date.now() })}
      onPointerCancel={() => track({ type: "up", at: Date.now() })}
      onBlur={() => { track({ type: "blur" }); startGesture(false); }}
      onFocus={(event) => activate(event.currentTarget)}
      onSelect={(event) => activate(event.currentTarget)}
      onMouseUp={(event) => activate(event.currentTarget)}
      onKeyDown={(event) => {
        track({ type: "down" });
        if (!["Control", "Meta", "Shift", "Alt"].includes(event.key) && !event.ctrlKey && !event.metaKey) startGesture(false);
        if (event.key !== "Enter") return;
        event.preventDefault();
        const editor = event.currentTarget;
        const text = currentDocument.runs.map((run) => run.text).join("");
        const selection = editorSelection(editor, text);
        const nextValue = `${text.slice(0, selection.start)}\n${text.slice(selection.end)}`;
        const caret = { start: selection.start + 1, end: selection.start + 1 };
        commitEditorValue(editor, nextValue, caret);
      }}
      onKeyUp={(event) => {
        track({ type: "up", at: Date.now() });
        if (event.key !== "Enter") activate(event.currentTarget);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const editor = event.currentTarget;
        const text = currentDocument.runs.map((run) => run.text).join("");
        const selection = editorSelection(editor, text);
        const pastedText = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
        const nextValue = `${text.slice(0, selection.start)}${pastedText}${text.slice(selection.end)}`;
        const caretPosition = selection.start + pastedText.length;
        commitEditorValue(editor, nextValue, { start: caretPosition, end: caretPosition });
      }}
      onInput={(event) => {
        const nextValue = editorPlainText(event.currentTarget);
        const selection = editorSelection(event.currentTarget, nextValue);
        commitEditorValue(event.currentTarget, nextValue, selection);
      }}
    />
    <small className="formatted-text-field-hint">{hint ?? "Текст и GIF можно сочетать."}</small>
  </div>;
}

// EDIT-06: what a field activation makes of the target before it. A plain gesture starts over (D-14); an additive one keeps the fragments and,
// on its first activation, turns the previous non-empty selection into one (D-13). A collapsed caret in an additive gesture drops the fragment it lands in.
export function joinFormatTarget(prev: FormatTarget | null, target: FormatTarget): FormatTarget {
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

/** The one launch button of the format panel. Its accessible name holds the visible text (WCAG 2.5.3, lib/format-launch.ts). */
export function FormatLaunchButton({ target, open, onToggle }: { target: FormatTarget | null; open: boolean; onToggle: () => void }) {
  const labels = formatLaunchLabels(target ? target.title : null);
  return (
    <div className="global-format-launch">
      <button
        type="button"
        disabled={!target}
        aria-label={labels.accessibleName}
        aria-expanded={open}
        title={labels.tooltip}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          // Phone: the field loses focus once per opening so the keyboard leaves.
          if (!open && target && window.matchMedia("(max-width: 900px)").matches) findFormatField(target.key)?.blur();
          onToggle();
        }}
      >
        <span aria-hidden="true">✎</span>
        <strong>{labels.visibleLabel}</strong>
        {target && <em>{labels.visibleTitle}</em>}
      </button>
      <small>{labels.hint}</small>
    </div>
  );
}

export function FloatingTextFormatPanel({ target, previewSurface, onPreviewSurface, onUpdate, onBatch, onClose, positionStorageKey }: {
  target: FormatTarget;
  previewSurface: EditorPreviewSurface | null;
  onPreviewSurface: (surface: EditorPreviewSurface) => void;
  onUpdate: (target: FormatTarget) => void;
  onBatch: (id: string, run: () => void) => void;
  onClose: () => void;
  // Where the PC panel remembers its place. Undefined keeps the editor's own key; null remembers nothing and never touches browser storage.
  positionStorageKey?: string | null;
}) {
  const storageKey = positionStorageKey === undefined ? formatPanelStorageKey : positionStorageKey;
  // Seeds the custom colour picker for text without a colour: baseInk at the default accent.
  const surface = previewSurface ?? nativeSurface[target.area];
  const defaultTextColor = surface === "dark" ? "#aebfba" : "#17211f";
  const documentRef = useRef(target.document);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; right: number; bottom: number; last: PanelOffset | null } | null>(null);
  // Every control acts on one range: the selection, else the word under the caret, else nothing (D-04).
  const text = target.document.runs.map((run) => run.text).join("");
  const range = resolveRange(text, target.selection);
  // EDIT-06: with fragments the controls act on all of them (the current non-empty selection included); a bare caret is not a fragment (planner decision 2).
  const multi = target.fragments.length > 0;
  const set = useMemo(() => {
    if (target.fragments.length === 0) return [];
    const selection = target.selection;
    const length = target.document.runs.reduce((sum, run) => sum + run.text.length, 0);
    const clamp = (value: number) => Math.max(0, Math.min(length, value));
    const picked = selection && selection.start !== selection.end ? [{ key: target.key, from: clamp(selection.start), to: clamp(selection.end) }] : [];
    return mergeFragments([...target.fragments, ...picked]).filter((fragment) => fragment.key === target.key || target.peers[fragment.key] !== undefined);
  }, [target]);
  const docFor = (key: string) => (key === target.key ? target.document : target.peers[key]?.document ?? target.document);
  // The readout comes from the committed document, so a click shows exactly what it applied. A repeat click on a manual control
  // re-applies the same value; the row styles toggle (D-02). Unstyled text marks no size or weight, because every area renders its own.
  const style = multi
    ? (set[0] ? richTextStyleAt(docFor(set[0].key), set[0].from) : {})
    : richTextStyleAt(target.document, range?.from ?? target.selection?.start ?? 0);
  const hasTarget = multi ? set.length > 0 : range !== null;
  const marked = (preset: RichTextStyle) => multi
    ? set.length > 0 && set.every((fragment) => rangeHasStyle(docFor(fragment.key), fragment.from, fragment.to, preset))
    : range !== null && rangeHasStyle(target.document, range.from, range.to, preset);
  const plainMarked = multi
    ? set.length > 0 && set.every((fragment) => rangeIsPlain(docFor(fragment.key), fragment.from, fragment.to))
    : range !== null && rangeIsPlain(target.document, range.from, range.to);
  const color = style.color ?? defaultTextColor;
  const { fontSize, fontWeight } = style;
  const backgroundColor = style.backgroundColor ?? "#f0d66a";
  const backgroundOpacity = style.backgroundOpacity ?? 0;
  const [colorPicker, setColorPicker] = useState<"text" | "background" | null>(null);
  // Phone only: one control group at a time under the style row (D-12); on a PC every group shows.
  const [tab, setTab] = useState<"color" | "size" | "background">("color");
  // Phone only: the sheet folds to a 44px strip so the text shows (D-08). The panel remounts on every opening, so a sheet opens expanded.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { documentRef.current = target.document; }, [target.document]);

  const formatKey = target.key;
  const paintFrom = range?.from;
  const paintTo = range?.to;
  const formatDocument = target.document;
  // The text the next style changes is painted with the Custom Highlight API at every width: on a phone it takes the keyboard's place
  // (D-05, D-06; ✎ takes focus from the field once and rich fields carry inputMode none, owner UAT 12), on a PC it keeps the target
  // visible when focus has gone to a panel input or the ✎ button. Only keeping it above the panel is phone-only.
  // formatDocument is a dependency because a style change re-renders the field's text nodes, which orphans the painted range.
  useEffect(() => {
    const field = findFormatField(formatKey);
    const panel = panelRef.current;
    if (!field || !panel) return;
    // Paint what the next style will change: every fragment, else the selection, else the word under the caret (D-04, D-05, D-17).
    const items = multi ? set : paintFrom !== undefined && paintTo !== undefined ? [{ key: formatKey, from: paintFrom, to: paintTo }] : [];
    const ranges = items.flatMap((item) => {
      const holder = findFormatField(item.key);
      return holder ? [rangeFromOffsets(holder, { start: item.from, end: item.to })] : [];
    });
    const painted = ranges[0] ?? null;
    const paints = ranges.length > 0 && typeof Highlight !== "undefined" && "highlights" in CSS;
    if (paints) CSS.highlights.set("portia-format", new Highlight(...ranges));
    const keepVisible = () => {
      const rect = painted ? painted.getBoundingClientRect() : field.getBoundingClientRect();
      const overlap = rect.bottom - (panel.getBoundingClientRect().top - 16);
      // 64 keeps the text under the 48px system bar.
      if (overlap > 0) window.scrollBy(0, Math.max(0, Math.min(overlap, rect.top - 64)));
    };
    const phone = window.matchMedia("(max-width: 900px)").matches;
    const frame = phone ? window.requestAnimationFrame(keepVisible) : 0;
    if (phone) window.visualViewport?.addEventListener("resize", keepVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", keepVisible);
      if (paints) CSS.highlights.delete("portia-format");
    };
  }, [formatKey, paintFrom, paintTo, formatDocument, collapsed, multi, set]);

  // On a phone, closing returns the caret to the field in the same tap so the keyboard can come back (iOS may still need one more tap);
  // flushSync commits the close first so the field has dropped inputMode none before it gets focus.
  const finish = () => {
    flushSync(onClose);
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const field = findFormatField(formatKey);
    // Nothing is known: a focused field would store the browser's caret at 0 as the next target.
    if (!field || !target.selection) return;
    field.focus({ preventScroll: true });
    restoreSelection(field, target.selection);
  };

  const word = range ? text.slice(range.from, range.to) : "";
  const selectionLabel = multi
    ? (set.length === 1 ? `${set[0].to - set[0].from} ЗНАК.` : "ВЫДЕЛИТЕ ТЕКСТ")
    : !range
      ? "ВЫДЕЛИТЕ ТЕКСТ"
      : target.selection?.start !== target.selection?.end
        ? `${range.to - range.from} ЗНАК.`
        : `СЛОВО: «${word.length > 12 ? `${word.slice(0, 12)}…` : word}»`;
  const clearFragments = () => onUpdate({ ...target, fragments: [], peers: {} });

  const commit = (document: RichTextDocument) => {
    documentRef.current = document;
    target.onCommit(target.value, document);
    onUpdate({ ...target, document });
  };

  // One path for every control. With fragments each field's document is folded over that field's ranges and committed once (D-13);
  // the offsets are the stored ones, so a DOM selection lost to a panel input changes nothing. applyRichTextStyle clamps stale offsets (T-11-13).
  // D-16: a fresh batch id per control interaction; the same control firing again within the typing pause (a slider or colour board drag) keeps its id.
  const lastBatch = useRef<{ control: string; id: string; at: number } | null>(null);
  const batchFor = (control: string) => {
    lastBatch.current = nextBatch(lastBatch.current, control);
    return lastBatch.current.id;
  };

  const applyOp = (control: string, op: (document: RichTextDocument, from: number, to: number) => RichTextDocument) => {
    if (!multi) {
      if (range) commit(op(documentRef.current, range.from, range.to));
      return;
    }
    onBatch(batchFor(control), () => {
      let currentDocument = documentRef.current;
      const nextPeers = { ...target.peers };
      for (const key of new Set(set.map((fragment) => fragment.key))) {
        const mine = set.filter((fragment) => fragment.key === key);
        if (key === target.key) {
          currentDocument = mine.reduce((doc, fragment) => op(doc, fragment.from, fragment.to), documentRef.current);
          documentRef.current = currentDocument;
          target.onCommit(target.value, currentDocument);
        } else {
          const peer = target.peers[key];
          const next = mine.reduce((doc, fragment) => op(doc, fragment.from, fragment.to), peer.document);
          nextPeers[key] = { ...peer, document: next };
          peer.onCommit(peer.value, next);
        }
      }
      onUpdate({ ...target, document: currentDocument, peers: nextPeers });
    });
  };

  const applyStyle = (control: string, style: RichTextStyle) => applyOp(control, (doc, from, to) => applyRichTextStyle(doc, from, to, style));

  // D-02: the preset leaves when every fragment already carries it, else it is applied to every fragment.
  const togglePresetStyle = (name: string, preset: RichTextStyle) => {
    const keys = Object.keys(preset) as (keyof RichTextStyle)[];
    if (!multi) applyOp(`preset:${name}`, (doc, from, to) => togglePreset(doc, from, to, preset));
    else if (marked(preset)) applyOp(`preset:${name}`, (doc, from, to) => removeRichTextStyleKeys(doc, from, to, keys));
    else applyOp(`preset:${name}`, (doc, from, to) => applyRichTextStyle(doc, from, to, preset));
  };

  // Restore the remembered place on mount and keep 64px of it on screen whenever the browser window changes size (D-07). The phone panel is docked by CSS.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const place = () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        panel.style.right = "";
        panel.style.bottom = "";
        return;
      }
      const saved = readPanelOffset(storageKey);
      // Nothing remembered (or storage unreadable): beside the editor window when it fits, else the default corner (D-07).
      const editor = document.querySelector(".editor-window")?.getBoundingClientRect() ?? null;
      paintPanelOffset(panel, saved ?? initialPanelOffset(editor, { width: panel.offsetWidth, height: panel.offsetHeight }, { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [storageKey]);

  // PC: the panel is a layer of the desktop and moves by its header anywhere on the screen (D-06, EDIT-04). The phone panel is docked.
  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel || window.matchMedia("(max-width: 900px)").matches) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      right: document.documentElement.clientWidth - rect.right, bottom: document.documentElement.clientHeight - rect.bottom, last: null,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel || drag.pointerId !== event.pointerId) return;
    drag.last = paintPanelOffset(panel, { right: drag.right - (event.clientX - drag.startX), bottom: drag.bottom - (event.clientY - drag.startY) });
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    // A blocked storage only means the place is not remembered.
    if (drag.last) writePanelOffset(storageKey, drag.last);
  };

  // Arrow keys move the panel from its header: 8px, Shift 32px (EDIT-04). Only when the header itself has focus, so buttons keep their keys.
  const keyMove = (event: React.KeyboardEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel || event.target !== event.currentTarget || window.matchMedia("(max-width: 900px)").matches) return;
    const step = event.shiftKey ? 32 : 8;
    const delta = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const next = paintPanelOffset(panel, { right: document.documentElement.clientWidth - rect.right + delta[0], bottom: document.documentElement.clientHeight - rect.bottom + delta[1] });
    writePanelOffset(storageKey, next);
  };

  // Esc leaves the panel for the text: the field with its selection back, else the ✎ button. The panel stays open.
  const leavePanel = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (multi) clearFragments();
    const field = findFormatField(formatKey);
    if (field && target.selection) {
      field.focus({ preventScroll: true });
      restoreSelection(field, target.selection);
    } else document.querySelector<HTMLElement>(".global-format-launch > button")?.focus();
  };

  // mousedown is the event whose default moves focus and clears the field's selection; pointerdown alone does not stop it in Chromium or WebKit (WR-04); inputs keep focus.
  const keepFieldFocus = (event: React.SyntheticEvent) => { if (!(event.target as HTMLElement).closest("input")) event.preventDefault(); };
  return <section ref={panelRef} className="floating-text-format" role="region" aria-label={`Форматирование: ${target.title}`} onPointerDown={keepFieldFocus} onMouseDown={keepFieldFocus} onKeyDown={leavePanel} data-collapsed={collapsed || undefined}>
    <header tabIndex={0} role="group" aria-label="Перемещение панели: стрелки, с Shift шагом 32 px" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={keyMove} onClick={(event) => { if (window.matchMedia("(max-width: 900px)").matches && !(event.target as HTMLElement).closest("button")) setCollapsed((value) => !value); }}>
      <div><span>РЕДАКТОР ОФОРМЛЕНИЯ</span><strong>{target.title}</strong></div>
      <small>
        {set.length >= 2
          ? <><span className="format-selection-count">ВЫБРАНО: <b>{set.length}</b></span><button type="button" className="format-reset-fragments" aria-label="Снять все выделенные фрагменты" onClick={clearFragments}>СБРОСИТЬ</button></>
          : selectionLabel}
      </small>
      <button type="button" data-sheet-toggle aria-expanded={!collapsed} aria-label={collapsed ? "Развернуть панель оформления" : "Свернуть панель оформления"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? "ОФОРМЛЕНИЕ ▴" : "▾"}</button>
      <button type="button" className="corner-close" onClick={finish} aria-label="Закрыть панель оформления">×</button>
    </header>
    <div className="format-presets format-choice-row" role="group" aria-label="Готовые стили">
      <button type="button" className={plainMarked ? "selected" : ""} aria-pressed={plainMarked} disabled={!hasTarget} onClick={() => applyOp("reset", resetRichTextStyle)}>Обычный</button>
      <button type="button" className={marked(stylePresets.heading) ? "selected" : ""} aria-pressed={marked(stylePresets.heading)} disabled={!hasTarget} onClick={() => togglePresetStyle("heading", stylePresets.heading)}>Заголовок</button>
      <button type="button" className={marked(stylePresets.important) ? "selected" : ""} aria-pressed={marked(stylePresets.important)} disabled={!hasTarget} onClick={() => togglePresetStyle("important", stylePresets.important)}>Важно</button>
    </div>
    <div className="format-tabs format-choice-row" role="tablist" aria-label="Группы оформления">
      {([["color", "Цвет"], ["size", "Размер"], ["background", "Фон"]] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "selected" : ""} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <div className="rich-text-toolbar" aria-label="Оформление текста" data-tab={tab}>
      {target.area === "assistant" && <p className="format-area-note">Цвет и размер фраз помощника не действуют.</p>}
      <div data-tab-group="background" className="format-control preview-surface-control"><span>Фон предпросмотра</span><div className="format-choice-row"><button type="button" className={surface === "light" ? "selected" : ""} onClick={() => onPreviewSurface("light")}>БЕЛЫЙ</button><button type="button" className={surface === "dark" ? "selected" : ""} onClick={() => onPreviewSurface("dark")}>ЧЁРНЫЙ</button></div></div>
      <div data-tab-group="color" className="format-control"><span className="format-control-title">Цвет текста <b><i style={{ backgroundColor: style.color ?? baseInk[surface] }} />{style.color ? style.color.toUpperCase() : "ОСНОВНОЙ"}</b></span><div className="format-swatches"><button type="button" disabled={!hasTarget} className={style.color ? "" : "selected"} title="Основной" aria-label="Основной" onClick={() => { setColorPicker(null); applyOp("colour-base", (doc, from, to) => removeRichTextStyleKeys(doc, from, to, ["color"])); }}><i style={{ backgroundColor: baseInk[surface] }} /></button>{textColorPalette.map((item) => <button key={item.value} type="button" disabled={!hasTarget} className={style.color?.toLowerCase() === item.value ? "selected" : ""} title={item.label} aria-label={item.label} onClick={() => { setColorPicker(null); applyStyle(`color:${item.value}`, { color: item.value }); }}><i style={{ backgroundColor: item.value }} /></button>)}<button className="custom-color" type="button" disabled={!hasTarget} title="Свой цвет" aria-label="Выбрать свой цвет текста" onClick={() => setColorPicker(colorPicker === "text" ? null : "text")}><span>+</span></button></div></div>
      <div data-tab-group="size" className="format-control"><span>Размер</span><div className="format-choice-row">{[[13,"S"],[17,"M"],[22,"L"],[30,"XL"]].map(([size, label]) => <button key={size} type="button" disabled={!hasTarget} className={fontSize === size ? "selected" : ""} onClick={() => { const value = Number(size); applyStyle(`size:${value}`, { fontSize: value }); }}>{label}</button>)}</div></div>
      <div data-tab-group="size" className="format-control"><span>Толщина</span><div className="format-choice-row">{[[400,"ОБЫЧНЫЙ"],[600,"СРЕДНИЙ"],[800,"ЖИРНЫЙ"]].map(([weight, label]) => <button key={weight} type="button" disabled={!hasTarget} className={fontWeight === weight ? "selected" : ""} onClick={() => { const value = Number(weight); applyStyle(`weight:${value}`, { fontWeight: value }); }}>{label}</button>)}</div></div>
      <div data-tab-group="background" className="format-control"><span className="format-control-title">Фон текста <b><i style={{ backgroundColor }} />{backgroundOpacity > 0 ? backgroundColor.toUpperCase() : "БЕЗ ФОНА"}</b></span><div className="format-swatches"><button type="button" disabled={!hasTarget} className={`no-background${backgroundOpacity === 0 ? " selected" : ""}`} onClick={() => { setColorPicker(null); applyStyle("no-background", { backgroundOpacity: 0 }); }}>БЕЗ ФОНА</button>{backgroundColorPalette.map((item) => <button key={item.value} type="button" disabled={!hasTarget} className={backgroundColor.toLowerCase() === item.value && backgroundOpacity > 0 ? "selected" : ""} title={item.label} aria-label={item.label} onClick={() => { const opacity = backgroundOpacity || .45; setColorPicker(null); applyStyle(`background:${item.value}`, { backgroundColor: item.value, backgroundOpacity: opacity }); }}><i style={{ backgroundColor: item.value }} /></button>)}<button className="custom-color" type="button" disabled={!hasTarget} title="Свой фон" aria-label="Выбрать свой цвет фона" onClick={() => setColorPicker(colorPicker === "background" ? null : "background")}><span>+</span></button></div></div>
      <label data-tab-group="background" className="format-control opacity-control"><span>Плотность фона: {Math.round(backgroundOpacity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={backgroundOpacity} disabled={!hasTarget} onChange={(event) => { const opacity = Number(event.target.value); applyStyle("density", { backgroundColor, backgroundOpacity: opacity }); }} /></label>
      {colorPicker && <CustomColorPicker
        key={`${colorPicker}:${target.selection?.start}:${target.selection?.end}`}
        group={colorPicker === "text" ? "color" : "background"}
        title={colorPicker === "text" ? "Свой цвет текста" : "Свой цвет фона"}
        color={colorPicker === "text" ? color : backgroundColor}
        onChange={(nextColor) => {
          if (colorPicker === "text") {
            applyStyle("picker:text", { color: nextColor });
          } else {
            const opacity = backgroundOpacity || .45;
            applyStyle("picker:background", { backgroundColor: nextColor, backgroundOpacity: opacity });
          }
        }}
        onClose={() => setColorPicker(null)}
      />}
    </div>
    <footer><div className="format-notes"><p>Без выделения — слово под курсором.</p><p className="format-multi-hint">Ctrl (Cmd) — добавить фрагмент. Esc — снять.</p></div><div><button type="button" className="finish-format" onClick={finish}>ГОТОВО</button></div></footer>
  </section>;
}

// Where the PC format panel was left, px from the viewport's right and bottom edges; read back on mount (D-07).
const formatPanelStorageKey = "portia-format-panel-v1";

// The only two places that touch browser storage. A null key means the caller wants nothing remembered (the template builder), so both return first.
function readPanelOffset(storageKey: string | null): PanelOffset | null {
  if (storageKey === null) return null;
  try { return parsePanelOffset(localStorage.getItem(storageKey)); } catch { return null; }
}

function writePanelOffset(storageKey: string | null, offset: PanelOffset) {
  if (storageKey === null) return;
  // A blocked storage only means the place is not remembered.
  try { localStorage.setItem(storageKey, JSON.stringify(offset)); } catch { /* ignore */ }
}

// Writes the clamped right/bottom straight on the panel (no React render per move) and returns what was painted.
function paintPanelOffset(panel: HTMLElement, offset: { right: number; bottom: number }) {
  const next = clampPanelOffset(offset, { width: panel.offsetWidth, height: panel.offsetHeight }, { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });
  panel.style.right = `${next.right}px`;
  panel.style.bottom = `${next.bottom}px`;
  return next;
}
