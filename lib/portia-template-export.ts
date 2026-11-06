/**
 * Local-only export of the participant's "Шаблон досье" draft (Phase 20, D-23/D-24).
 *
 * The draft is a small text model of its own: it deliberately has no classification, scientist log or
 * archive identity, so an archive `Virus` record can never flow into it. Nothing here touches the network.
 *
 * Local images (D-24) live only in memory as a validated data URL. Both exports (standalone HTML and PNG) are built from the
 * same bounded model and never reference an external URL.
 */

import type { TemplateDossier, TemplateRun } from "./portia-template-dossier.ts";

export type TemplateFieldKey =
  | "name"
  | "code"
  | "status"
  | "external"
  | "health"
  | "speed"
  | "abilities"
  | "physiology"
  | "mutationName"
  | "mutationDescription";

export type TemplateDraft = Readonly<Record<TemplateFieldKey, string>>;

export type TemplateField = Readonly<{
  key: TemplateFieldKey;
  label: string;
  multiline: boolean;
  maxLength: number;
}>;

export type TemplateSection = Readonly<{
  index: string;
  title: string;
  /** Section 01 is the card header (code, name, status); the others follow the dossier sections. */
  keys: readonly TemplateFieldKey[];
}>;

export const templateFields: readonly TemplateField[] = [
  { key: "name", label: "Название вируса", multiline: false, maxLength: 120 },
  { key: "code", label: "Код записи", multiline: false, maxLength: 40 },
  { key: "status", label: "Статус", multiline: false, maxLength: 80 },
  { key: "external", label: "Внешние характеристики", multiline: true, maxLength: 4000 },
  { key: "health", label: "Здоровье", multiline: false, maxLength: 200 },
  { key: "speed", label: "Скорость", multiline: false, maxLength: 200 },
  { key: "abilities", label: "Способности", multiline: true, maxLength: 1000 },
  { key: "physiology", label: "Физиология", multiline: true, maxLength: 4000 },
  { key: "mutationName", label: "Название мутации", multiline: false, maxLength: 120 },
  { key: "mutationDescription", label: "Описание мутации", multiline: true, maxLength: 2000 },
];

export const templateSections: readonly TemplateSection[] = [
  { index: "02", title: "ВНЕШНИЕ ХАРАКТЕРИСТИКИ", keys: ["external"] },
  { index: "03", title: "ХАРАКТЕРИСТИКИ С PPU", keys: ["health", "speed", "abilities"] },
  { index: "04", title: "ФИЗИОЛОГИЯ", keys: ["physiology"] },
  { index: "05", title: "МУТАЦИИ ВИРУСА", keys: ["mutationName", "mutationDescription"] },
];

export const emptyTemplateText = "Не заполнено";
export const templateFileName = "shablon-dosye.html";
export const templatePngFileName = "shablon-dosye.png";
export const templateDefaultTitle = "Шаблон досье";

/* ---------------------------------------------------------------- local image (D-24) */

export const templateImageMaxBytes = 5 * 1024 * 1024;
export const templateImageMaxSide = 4096;
export const templateImageMaxPixels = 12_000_000;
export const templateImageAccept = "image/png,image/jpeg,image/webp";
export const templateImageOpenError = "Не удалось открыть изображение. Выберите другой файл.";
export const templateExportError = "Не удалось подготовить файл. Повторите скачивание.";
export const templatePngTooLargeError = "Карточка слишком длинная для PNG, лишнее не обрезается. Сократите текст или скачайте HTML.";
/** Display box shared by the preview, HTML and PNG so the three agree. */
export const templateImageDisplayMaxHeight = 520;

export type TemplateImageMime = "image/png" | "image/jpeg" | "image/webp";

/** A validated local image. `dataUrl` is the only place the bytes live; nothing is uploaded or stored. */
export type TemplateImage = Readonly<{
  name: string;
  mime: TemplateImageMime;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}>;

export type LocalImageFile = Readonly<{
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

const imageMimes: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

function namedError(name: string, message: string) {
  return Object.assign(new Error(message), { name });
}

export function isTemplateImageError(error: unknown): error is Error {
  return error instanceof Error && error.name === "TemplateImageError";
}

export function isTemplatePngTooLargeError(error: unknown): error is Error {
  return error instanceof Error && error.name === "TemplatePngTooLargeError";
}

/** The format named by the first bytes, independent of the file name and the declared type. */
export function sniffImageMime(bytes: Uint8Array): TemplateImageMime | null {
  const startsWith = (signature: readonly number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function imageSizeWithinBounds(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height)
    && width >= 1 && height >= 1
    && width <= templateImageMaxSide && height <= templateImageMaxSide
    && width * height <= templateImageMaxPixels;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: TemplateImageMime) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

type ImageSource = { width: number; height: number };

function loadBrowserImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => (image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve(image) : reject(new Error("image has no size")));
    image.onerror = () => reject(new Error("image decode failed"));
    image.src = src;
  });
}

/**
 * Checks a chosen file in order: size, declared type, signature, then decoding and decoded pixel bounds. Any failure throws a
 * `TemplateImageError`; the caller keeps the text draft untouched.
 */
export async function decodeLocalTemplateImage(
  file: LocalImageFile,
  environment: { loadImage: (src: string) => Promise<ImageSource> } = {
    loadImage: async (src) => {
      const image = await loadBrowserImage(src);
      return { width: image.naturalWidth, height: image.naturalHeight };
    },
  },
): Promise<TemplateImage> {
  const fail = (reason: string) => namedError("TemplateImageError", reason);
  if (!(file.size > 0) || file.size > templateImageMaxBytes) throw fail("size");
  if (!imageMimes.includes(file.type)) throw fail("type");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > templateImageMaxBytes) throw fail("size");
  const mime = sniffImageMime(bytes);
  if (mime === null || mime !== file.type) throw fail("signature");
  const dataUrl = bytesToDataUrl(bytes, mime);
  let decoded: ImageSource;
  try {
    decoded = await environment.loadImage(dataUrl);
  } catch {
    throw fail("decode");
  }
  if (!imageSizeWithinBounds(decoded.width, decoded.height)) throw fail("pixels");
  return Object.freeze({ name: file.name.trim().slice(0, 80) || "image", mime, dataUrl, width: decoded.width, height: decoded.height, bytes: bytes.length });
}

export function fitTemplateImage(image: Pick<TemplateImage, "width" | "height">, maxWidth: number, maxHeight = templateImageDisplayMaxHeight) {
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  return { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) };
}

/* ---------------------------------------------------------------- draft helpers */

export function emptyTemplateDraft(): TemplateDraft {
  return Object.freeze(Object.fromEntries(templateFields.map((field) => [field.key, ""])) as Record<TemplateFieldKey, string>);
}

/** True when the participant typed at least one visible character; an empty draft is never exported as a success. */
export function hasTemplateText(draft: TemplateDraft) {
  return templateFields.some((field) => draft[field.key].trim() !== "");
}

/** Something the participant actually provided: text or an image. An export of neither is never reported as a success. */
export function hasTemplateContent(draft: TemplateDraft, image: TemplateImage | null) {
  return image !== null || hasTemplateText(draft);
}

/** A stable value used to tell whether the current text and image already left the device as a file. */
export function templateSnapshotKey(draft: TemplateDraft, image: TemplateImage | null = null) {
  const imageKey = image === null ? null : [image.name, image.bytes, image.width, image.height, image.dataUrl.length, image.dataUrl.slice(-48)];
  return JSON.stringify([templateFields.map((field) => draft[field.key]), imageKey]);
}

export function escapeTemplateHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const fieldLabel = (key: TemplateFieldKey) => templateFields.find((field) => field.key === key)?.label ?? key;

function valueHtml(value: string) {
  return value.trim() === ""
    ? `<span class="empty">${emptyTemplateText}</span>`
    : escapeTemplateHtml(value);
}

const standaloneCss = `
*{box-sizing:border-box}
body{margin:0;padding:24px;background:#e9e5d8;color:#1b2523;font:16px/1.55 system-ui,"Segoe UI",Roboto,Arial,sans-serif}
.card{max-width:820px;margin:0 auto;padding:32px;background:#f6f3ea;border:1px solid #bdb8a6;border-radius:6px}
header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:2px solid #1b2523}
.code{display:block;font:700 12px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.08em;color:#4a5a56}
h1{margin:4px 0 0;font-size:28px;line-height:1.15;overflow-wrap:anywhere}
.status{font:700 12px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.06em;overflow-wrap:anywhere}
section{margin-top:24px}
h2{margin:0 0 8px;font:700 12px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.08em;color:#2e6f64}
dl{margin:0;display:grid;gap:12px}
dt{font:700 11px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:#4a5a56}
dd{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.empty{color:#7a7a6e;font-style:italic}
.photo{margin:16px 0 0}
.photo img{display:block;max-width:100%;max-height:520px;width:auto;height:auto;object-fit:contain;border:1px solid #bdb8a6}
footer{margin-top:32px;padding-top:12px;border-top:1px solid #bdb8a6;font:11px/1.4 ui-monospace,Consolas,monospace;color:#4a5a56}
`.trim();

/**
 * Builds a self-contained HTML document. Every typed value is escaped, the CSS is inline, there is no script and the
 * embedded CSP forbids any request except `data:` images, so the file opens offline and cannot load anything from a server.
 * A chosen image is embedded as its validated data URL (the MIME comes from the signature allow-list, never from user text).
 */
export function createStandaloneHtml(draft: TemplateDraft, image: TemplateImage | null = null) {
  const title = draft.name.trim() === "" ? templateDefaultTitle : escapeTemplateHtml(draft.name.trim());
  const sections = templateSections.map((section) => {
    const rows = section.keys
      .map((key) => `<div><dt>${escapeTemplateHtml(fieldLabel(key))}</dt><dd>${valueHtml(draft[key])}</dd></div>`)
      .join("");
    return `<section><h2>${section.index} ${escapeTemplateHtml(section.title)}</h2><dl>${rows}</dl></section>`;
  }).join("");
  return [
    "<!doctype html>",
    `<html lang="ru"><head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${title}</title><style>${standaloneCss}</style></head><body>`,
    `<main class="card"><header><div><span class="code">${valueHtml(draft.code)}</span><h1>${draft.name.trim() === "" ? `<span class="empty">${emptyTemplateText}</span>` : title}</h1></div>`,
    `<div class="status">${valueHtml(draft.status)}</div></header>`,
    image === null ? "" : `<figure class="photo"><img src="${image.dataUrl}" alt="Изображение, выбранное участником"></figure>`,
    sections,
    `<footer>${escapeTemplateHtml(templateDefaultTitle)} / PORTIA / локальный черновик участника, не запись архива</footer></main>`,
    "</body></html>",
  ].join("");
}

/** Starts a browser download of `content` (HTML text or a Blob) and releases the object URL afterwards. */
export function downloadTemplateBlob(
  content: string | Blob,
  fileName: string = templateFileName,
  environment: { document: Document; URL: typeof URL; setTimeout: typeof setTimeout } = { document, URL, setTimeout },
) {
  const blob = typeof content === "string" ? new Blob([content], { type: "text/html;charset=utf-8" }) : content;
  const url = environment.URL.createObjectURL(blob);
  try {
    const anchor = environment.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    environment.document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    environment.URL.revokeObjectURL(url);
    throw error;
  }
  // Revoking in the same tick can cancel the download in some browsers.
  environment.setTimeout(() => environment.URL.revokeObjectURL(url), 10_000);
}

/* ---------------------------------------------------------------- PNG export */

export const pngWidth = 1000;
export const pngPadding = 40;
export const pngMaxHeight = 8000;

type Measure = (text: string, font: string) => number;

export type PngOp =
  | Readonly<{ kind: "rect"; x: number; y: number; width: number; height: number; fill?: string; stroke?: string }>
  | Readonly<{ kind: "text"; x: number; y: number; text: string; font: string; fill: string }>
  | Readonly<{ kind: "image"; x: number; y: number; width: number; height: number }>;

export type PngLayout = Readonly<{ width: number; height: number; ops: readonly PngOp[] }>;

const pngPalette = { paper: "#f6f3ea", border: "#bdb8a6", ink: "#1b2523", soft: "#4a5a56", accent: "#2e6f64", empty: "#7a7a6e" };
const sansFont = (size: number, weight = 400, style = "normal") => `${style} ${weight} ${size}px "Segoe UI", system-ui, Roboto, Arial, sans-serif`;
const monoFont = (size: number) => `700 ${size}px ui-monospace, Consolas, monospace`;

/** Greedy word wrap that keeps blank lines and breaks a word wider than the line by characters. Nothing is dropped. */
export function wrapTemplateText(text: string, maxWidth: number, font: string, measure: Measure) {
  const fits = (value: string) => measure(value.trimEnd(), font) <= maxWidth;
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.match(/\S+\s*|\s+/g) ?? []) {
      if (current !== "" && !fits(current + word)) {
        lines.push(current.trimEnd());
        current = "";
      }
      current += word;
      if (fits(current)) continue;
      // A single word wider than the line: split it by characters.
      let piece = "";
      for (const char of Array.from(current)) {
        if (piece !== "" && !fits(piece + char)) {
          lines.push(piece);
          piece = char;
        } else {
          piece += char;
        }
      }
      current = piece;
    }
    lines.push(current.trimEnd());
  }
  return lines;
}

/**
 * Lays out the whole card on a fixed-width page and measures the real height before anything is encoded. If the card does not
 * fit the bounded canvas it throws instead of silently cropping.
 */
export function layoutTemplateCard(
  draft: TemplateDraft,
  image: Pick<TemplateImage, "width" | "height"> | null,
  measure: Measure,
): PngLayout {
  const contentWidth = pngWidth - pngPadding * 2;
  const ops: PngOp[] = [];
  let y = pngPadding;
  const text = (value: string, font: string, fill: string, lineHeight: number) => {
    if (value.trim() === "") {
      ops.push({ kind: "text", x: pngPadding, y, text: emptyTemplateText, font: sansFont(16, 400, "italic"), fill: pngPalette.empty });
      y += lineHeight;
      return;
    }
    for (const line of wrapTemplateText(value, contentWidth, font, measure)) {
      if (line !== "") ops.push({ kind: "text", x: pngPadding, y, text: line, font, fill });
      y += lineHeight;
      // Stop measuring once the card can no longer fit; the check below reports the overflow.
      if (y > pngMaxHeight * 4) break;
    }
  };

  text(draft.code, monoFont(12), pngPalette.soft, 18);
  y += 4;
  text(draft.name, sansFont(28, 700), pngPalette.ink, 34);
  y += 6;
  text(draft.status, monoFont(12), pngPalette.ink, 18);
  y += 12;
  ops.push({ kind: "rect", x: pngPadding, y, width: contentWidth, height: 2, fill: pngPalette.ink });
  y += 2;

  if (image !== null) {
    y += 16;
    const box = fitTemplateImage(image, contentWidth);
    ops.push({ kind: "image", x: pngPadding, y, width: box.width, height: box.height });
    // The 1px frame sits just outside the image so it never covers the picture's edge pixels.
    ops.push({ kind: "rect", x: pngPadding - 1, y: y - 1, width: box.width + 2, height: box.height + 2, stroke: pngPalette.border });
    y += box.height;
  }

  for (const section of templateSections) {
    y += 24;
    ops.push({ kind: "text", x: pngPadding, y, text: `${section.index} ${section.title}`, font: monoFont(12), fill: pngPalette.accent });
    y += 26;
    for (const key of section.keys) {
      ops.push({ kind: "text", x: pngPadding, y, text: fieldLabel(key), font: monoFont(11), fill: pngPalette.soft });
      y += 18;
      text(draft[key], sansFont(16), pngPalette.ink, 25);
      y += 12;
    }
    y -= 12;
  }

  y += 32;
  ops.push({ kind: "rect", x: pngPadding, y, width: contentWidth, height: 1, fill: pngPalette.border });
  y += 12;
  ops.push({
    kind: "text",
    x: pngPadding,
    y,
    text: `${templateDefaultTitle} / PORTIA / локальный черновик участника, не запись архива`,
    font: monoFont(11),
    fill: pngPalette.soft,
  });
  y += 16 + pngPadding;

  if (y > pngMaxHeight) throw namedError("TemplatePngTooLargeError", `card height ${y} exceeds ${pngMaxHeight}`);
  return { width: pngWidth, height: y, ops };
}

type Ctx2D = {
  font: string;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  textBaseline: string;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  strokeRect: (x: number, y: number, width: number, height: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  drawImage: (image: never, x: number, y: number, width: number, height: number) => void;
  measureText: (text: string) => { width: number };
};

type CanvasLike = {
  width: number;
  height: number;
  getContext: (type: "2d") => Ctx2D | null;
  toBlob: (callback: (blob: Blob | null) => void, type?: string) => void;
};

export type PngEnvironment = Readonly<{
  createCanvas: (width: number, height: number) => CanvasLike;
  loadImage: (src: string) => Promise<ImageSource>;
}>;

const browserPngEnvironment = (): PngEnvironment => ({
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as CanvasLike;
  },
  loadImage: loadBrowserImage,
});

/**
 * Draws the card from the snapshot and encodes it as PNG. Rejects when the card is too long (TemplatePngTooLargeError), when
 * the canvas or encoder is unavailable, and when `toBlob` yields null or an empty blob, so an empty file is never handed out.
 */
export async function createTemplatePng(
  draft: TemplateDraft,
  image: TemplateImage | null,
  environment: PngEnvironment = browserPngEnvironment(),
): Promise<Blob> {
  const probe = environment.createCanvas(1, 1).getContext("2d");
  if (probe === null) throw new Error("2d canvas is not available");
  const layout = layoutTemplateCard(draft, image, (value, font) => {
    probe.font = font;
    return probe.measureText(value).width;
  });
  const loaded = image === null ? null : await environment.loadImage(image.dataUrl);
  const canvas = environment.createCanvas(layout.width, layout.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2d canvas is not available");
  context.fillStyle = pngPalette.paper;
  context.fillRect(0, 0, layout.width, layout.height);
  context.textBaseline = "top";
  for (const op of layout.ops) {
    if (op.kind === "rect") {
      if (op.fill !== undefined) {
        context.fillStyle = op.fill;
        context.fillRect(op.x, op.y, op.width, op.height);
      }
      if (op.stroke !== undefined) {
        context.strokeStyle = op.stroke;
        context.lineWidth = 1;
        context.strokeRect(op.x + 0.5, op.y + 0.5, op.width - 1, op.height - 1);
      }
    } else if (op.kind === "text") {
      context.font = op.font;
      context.fillStyle = op.fill;
      context.fillText(op.text, op.x, op.y);
    } else if (loaded !== null) {
      context.drawImage(loaded as never, op.x, op.y, op.width, op.height);
    }
  }
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((value) => (value !== null && value.size > 0 ? resolve(value) : reject(new Error("PNG encoding failed"))), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

/* ---------------------------------------------------------------- dossier model export (20-38, D-52) */

// RED-phase skeleton: deliberately wrong, replaced by the implementation in the next commit.
export type TemplateStyledPiece = Readonly<{ text: string; font: string; fill: string; background?: string; width: number }>;
export type TemplateWrappedLine = Readonly<{ pieces: readonly TemplateStyledPiece[]; height: number }>;

export function wrapTemplateRuns(_runs: readonly TemplateRun[], _maxWidth: number, _measure: (text: string, font: string) => number): TemplateWrappedLine[] {
  return [];
}

export function createTemplateDossierHtml(_dossier: TemplateDossier) {
  return "";
}

export function layoutTemplateDossierCard(_dossier: TemplateDossier, _measure: (text: string, font: string) => number): PngLayout {
  return { width: 0, height: 0, ops: [] };
}

export async function createTemplateDossierPng(_dossier: TemplateDossier, _environment?: PngEnvironment): Promise<Blob> {
  return new Blob([]);
}
