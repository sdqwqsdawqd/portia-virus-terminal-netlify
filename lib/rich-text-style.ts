import type { RichTextDocument, RichTextStyle } from "./portia-content.ts";

// RED scaffold: moved helpers keep their old behaviour, new helpers are inert until GREEN.
const emptyRichTextStyle: RichTextStyle = {};

function sameStyle(left: RichTextStyle = {}, right: RichTextStyle = {}) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compactRuns(text: string, styles: RichTextStyle[]): RichTextDocument {
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

export function expandStyles(document: RichTextDocument) {
  const styles: RichTextStyle[] = [];
  document.runs.forEach((run) => {
    for (let index = 0; index < run.text.length; index += 1) styles.push({ ...(run.style ?? {}) });
  });
  return styles;
}

export function richTextStyleAt(document: RichTextDocument, position: number) {
  const styles = expandStyles(document);
  return styles[Math.max(0, Math.min(styles.length - 1, position))] ?? {};
}

export function applyRichTextStyle(document: RichTextDocument, start: number, end: number, style: RichTextStyle) {
  const text = document.runs.map((run) => run.text).join("");
  const from = start === end ? 0 : Math.min(start, end);
  const to = start === end ? text.length : Math.max(start, end);
  const styles = expandStyles(document);
  for (let index = from; index < to; index += 1) styles[index] = { ...styles[index], ...style };
  return compactRuns(text, styles);
}

export function resetRichTextStyle(document: RichTextDocument, start: number, end: number) {
  const text = document.runs.map((run) => run.text).join("");
  const from = start === end ? 0 : Math.min(start, end);
  const to = start === end ? text.length : Math.max(start, end);
  const styles = expandStyles(document);
  for (let index = from; index < to; index += 1) styles[index] = {};
  return compactRuns(text, styles);
}

export const stylePresets = {
  heading: {},
  bold: {},
  important: {},
} satisfies Record<string, RichTextStyle>;

export function rangeHasStyle(_document: RichTextDocument, _from: number, _to: number, _style: RichTextStyle) {
  return false;
}

export function removeRichTextStyleKeys(document: RichTextDocument, _from: number, _to: number, _keys: (keyof RichTextStyle)[]) {
  return document;
}

export function togglePreset(document: RichTextDocument, _from: number, _to: number, _preset: RichTextStyle) {
  return document;
}
