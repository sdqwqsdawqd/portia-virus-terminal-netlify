"use client";

import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { pickCurrentRange, type FormatFragment } from "@/lib/format-fragments";
import type { RichTextDocument } from "@/lib/portia-content";
import { compactRuns, expandStyles, fieldSelectionStep, type FieldSelectionEvent, type FieldSelectionState } from "@/lib/rich-text-style";

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
export type DisplayArea = "lead" | "metric" | "mutation" | "scientist" | "info" | "broadcast" | "trash" | "caption" | "search" | "assistant";

// The surface each field opens on is its site place's own (D-09, D-17); an explicit БЕЛЫЙ/ЧЁРНЫЙ choice overrides it until the next tab switch.
export const nativeSurface: Record<DisplayArea, EditorPreviewSurface> = { lead: "light", metric: "light", mutation: "light", scientist: "light", trash: "light", info: "dark", broadcast: "dark", caption: "dark", search: "dark", assistant: "dark" };

export const ActiveFormatContext = createContext<{ key: string | null; surface: EditorPreviewSurface | null; phonePanelOpen: boolean }>({ key: null, surface: null, phonePanelOpen: false });

export function replaceRichText(document: RichTextDocument, nextText: string) {
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
export function rangeFromOffsets(root: HTMLElement, offsets: { start: number; end: number }): Range {
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
export function restoreSelection(root: HTMLElement, offsets: { start: number; end: number }) {
  if (window.document.activeElement !== root) return;
  const range = rangeFromOffsets(root, offsets);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function FormattedTextarea({ label, area, value, document, formatKey, onChange, onActivate, tall = false }: {
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
    <div className="formatted-text-field-head"><span>{label}</span></div>
    <div
      ref={editorRef}
      data-area={area}
      data-format-key={formatKey}
      className={`formatted-rich-input${tall ? " tall" : ""} preview-${activeFormat.surface ?? nativeSurface[area]}${activeFormat.key === formatKey ? " is-editor-active" : ""}`}
      contentEditable
      inputMode={activeFormat.phonePanelOpen ? "none" : undefined}
      suppressContentEditableWarning
      role="textbox"
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
    <small className="formatted-text-field-hint">Текст и GIF можно использовать вместе. Не добавляйте лишних элементов.</small>
  </div>;
}
