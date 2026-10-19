import type { RichTextDocument, RichTextStyle } from "./portia-content.ts";

const emptyRichTextStyle: RichTextStyle = {};

// Key order must not matter: a toggle that re-adds keys would otherwise split one run in two.
function styleKey(style: RichTextStyle = {}) {
  return JSON.stringify(Object.entries(style).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Merges characters with equal styles back into runs; empty text becomes one empty run. */
export function compactRuns(text: string, styles: RichTextStyle[]): RichTextDocument {
  if (!text) return { runs: [{ text: "" }] };
  const runs: RichTextDocument["runs"] = [];
  for (let index = 0; index < text.length; index += 1) {
    const style = styles[index] ?? emptyRichTextStyle;
    const previous = runs[runs.length - 1];
    if (previous && styleKey(previous.style) === styleKey(style)) previous.text += text[index];
    else runs.push({ text: text[index], ...(Object.keys(style).length ? { style: { ...style } } : {}) });
  }
  return { runs };
}

/** One style object per character of the document text. */
export function expandStyles(document: RichTextDocument) {
  const styles: RichTextStyle[] = [];
  document.runs.forEach((run) => {
    for (let index = 0; index < run.text.length; index += 1) styles.push({ ...(run.style ?? {}) });
  });
  return styles;
}

/** Style of the character at `position` (clamped to the text); {} for empty text. */
export function richTextStyleAt(document: RichTextDocument, position: number) {
  const styles = expandStyles(document);
  return styles[Math.max(0, Math.min(styles.length - 1, position))] ?? {};
}

// Ordered, clamped [from, to) of two offsets in any order.
function orderedRange(text: string, start: number, end: number) {
  const clamp = (value: number) => Math.max(0, Math.min(text.length, value));
  return { from: Math.min(clamp(start), clamp(end)), to: Math.max(clamp(start), clamp(end)) };
}

const documentText = (document: RichTextDocument) => document.runs.map((run) => run.text).join("");

function mapRange(document: RichTextDocument, start: number, end: number, change: (style: RichTextStyle) => RichTextStyle) {
  const text = documentText(document);
  const { from, to } = orderedRange(text, start, end);
  if (from === to) return document;
  const styles = expandStyles(document);
  for (let index = from; index < to; index += 1) styles[index] = change(styles[index]);
  return compactRuns(text, styles);
}

/** Merges `style` into every character of [start, end). An empty range is a no-op (D-04). */
export function applyRichTextStyle(document: RichTextDocument, start: number, end: number, style: RichTextStyle) {
  return mapRange(document, start, end, (current) => ({ ...current, ...style }));
}

/** Clears all formatting of [start, end). An empty range is a no-op (D-04). */
export function resetRichTextStyle(document: RichTextDocument, start: number, end: number) {
  return mapRange(document, start, end, () => ({}));
}

// D-01 (owner amendment: no «Жирный», the manual weight covers it): «Обычный» is resetRichTextStyle, not a preset.
export const stylePresets = {
  heading: { fontSize: 22, fontWeight: 800 },
  important: { color: "#b43632", fontWeight: 600 },
} satisfies Record<string, RichTextStyle>;

const sameValue = (left: unknown, right: unknown) =>
  typeof left === "string" && typeof right === "string" ? left.toLowerCase() === right.toLowerCase() : left === right;

/** True when every character of [from, to) carries every property of `style`; false for an empty range. */
export function rangeHasStyle(document: RichTextDocument, from: number, to: number, style: RichTextStyle) {
  const text = documentText(document);
  const range = orderedRange(text, from, to);
  if (range.from === range.to) return false;
  const entries = Object.entries(style);
  return expandStyles(document)
    .slice(range.from, range.to)
    .every((current) => entries.every(([key, value]) => sameValue(current[key as keyof RichTextStyle], value)));
}

/** Deletes the given keys from every character of the range (deletes, never assigns undefined). */
export function removeRichTextStyleKeys(document: RichTextDocument, from: number, to: number, keys: (keyof RichTextStyle)[]) {
  return mapRange(document, from, to, (current) => {
    const next = { ...current };
    keys.forEach((key) => delete next[key]);
    return next;
  });
}

/** Word-like toggle (D-02): removes only the preset's own keys when the whole range carries it, else applies it. */
export function togglePreset(document: RichTextDocument, from: number, to: number, preset: RichTextStyle) {
  return rangeHasStyle(document, from, to, preset)
    ? removeRichTextStyleKeys(document, from, to, Object.keys(preset) as (keyof RichTextStyle)[])
    : applyRichTextStyle(document, from, to, preset);
}

// A regex, not Intl.Segmenter: the segmenter splits hyphenated words and differs between engines.
const wordPattern = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;

/** The word touching `position` (either edge counts as inside), or null between words. */
export function wordRangeAt(text: string, position: number) {
  const caret = Math.max(0, Math.min(text.length, position));
  for (const match of text.matchAll(wordPattern)) {
    const from = match.index;
    const to = from + match[0].length;
    if (from > caret) return null;
    if (caret <= to) return { from, to };
  }
  return null;
}

/** The range every panel control acts on (D-04): the ordered selection when non-empty, else the word under the caret, else null. */
export function resolveRange(text: string, selection: { start: number; end: number }) {
  const { from, to } = orderedRange(text, selection.start, selection.end);
  return from === to ? wordRangeAt(text, selection.start) : { from, to };
}

/** True when no character of [from, to) carries a style key; false for an empty range. */
export function rangeIsPlain(document: RichTextDocument, from: number, to: number) {
  const range = orderedRange(documentText(document), from, to);
  return range.from !== range.to && expandStyles(document).slice(range.from, range.to).every((current) => Object.keys(current).length === 0);
}
