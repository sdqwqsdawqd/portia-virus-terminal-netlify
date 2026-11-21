/**
 * Local-only export of the participant's "Шаблон досье" (Phase 20, D-23, D-24, D-52, D-55).
 *
 * The draft is a TemplateDossier (lib/portia-template-dossier.ts): the shape of a site editor virus card without scientist logs,
 * so an archive record can never flow into it. Nothing here touches the network.
 *
 * D-55: the downloaded HTML and PNG are the archive's own card. The builder draws the card once (the shared VirusCardBody), hands this
 * module the card's markup and the card's own style rules, and this module makes the two files from them: a single HTML page and the
 * raster of the same page (SVG with a foreignObject, drawn on a canvas). There is no second layout of the card here.
 *
 * Local images (D-24) live only in memory as a validated data URL and reach the files only as `<img src="data:image/...">`. Every file
 * is checked by the closed policy (`templateExportViolations`) before it leaves, and never references an external address.
 */

export const emptyTemplateText = "Не заполнено";
/** The old fixed file name stem: used when the virus has no usable name (OWN-12). */
export const templateFileStem = "shablon-dosye";
export const templateFileName = `${templateFileStem}.html`;
export const templateDefaultTitle = "Шаблон досье";

const templateFileNameMaxLength = 80;
// Path separators and the characters Windows forbids, the C0/C1 controls, the combining acute accent (U+0301) and the invisible direction marks.
const templateFileNameForbidden = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f́​-‏‪-‮⁦-⁩﻿]/g;
const templateFileNameReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?=\.|$)/i;

/**
 * OWN-12 (owner 2026-11-21, item 24): the downloaded «Шаблон» is named after the virus, `{name}.html` or `{name}.png`.
 * The name is user input that reaches the `download` attribute, so path separators and forbidden characters are removed, edge spaces and
 * trailing dots are trimmed, Cyrillic stays, the length is cut at 80 characters (never inside a surrogate pair) and a reserved Windows name
 * gets a «_». A name with nothing usable left falls back to the old `shablon-dosye`.
 */
export function templateDownloadName(virusName: string, extension: "html" | "png"): string {
  // Leading dots go too: once the separators are gone «../x» must not turn into a hidden or dot-only name.
  const trim = (text: string) => text.replace(/^[\s.]+|[\s.]+$/gu, "");
  const cleaned = trim(virusName.replace(templateFileNameForbidden, ""));
  const cut = trim(Array.from(cleaned).slice(0, templateFileNameMaxLength).join(""));
  const stem = cut === "" ? templateFileStem : cut.replace(templateFileNameReserved, "$1_");
  return `${stem}.${extension}`;
}

/* ---------------------------------------------------------------- local image (D-24) */

export const templateImageMaxBytes = 5 * 1024 * 1024;
export const templateImageMaxSide = 4096;
export const templateImageMaxPixels = 12_000_000;
export const templateImageAccept = "image/png,image/jpeg,image/webp";
export const templateImageOpenError = "Не удалось открыть изображение. Выберите другой файл.";
export const templateExportError = "Не удалось подготовить файл. Повторите скачивание.";
export const templatePngTooLargeError = "Карточка слишком длинная для PNG, лишнее не обрезается. Сократите текст или скачайте HTML.";

export type TemplateImageMime = "image/png" | "image/jpeg" | "image/webp";

/** A validated local image. `dataUrl` is the only place the bytes live; nothing is uploaded or stored. */
import type { ImageFraming } from "./image-framing.ts";

export type TemplateImage = Readonly<{
  name: string;
  mime: TemplateImageMime;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  framing?: ImageFraming;
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

export function isTemplateExportError(error: unknown): error is Error {
  return error instanceof Error && error.name === "TemplateExportError";
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

export function escapeTemplateHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type TemplateDownloadEnvironment = { document: Document; URL: typeof URL; setTimeout: typeof setTimeout };

/**
 * The window's own functions, wrapped so that none of them is ever called as a method of this object (D-61): a native Window function such as
 * setTimeout throws a TypeError ("Illegal invocation", "does not implement interface Window") when its `this` is any other object.
 */
function windowDownloadEnvironment(): TemplateDownloadEnvironment {
  return {
    document,
    URL,
    setTimeout: ((handler: TimerHandler, timeout?: number) => window.setTimeout(handler, timeout)) as typeof setTimeout,
  };
}

/**
 * Starts a browser download of `content` (HTML text or a Blob) and releases the object URL afterwards.
 *
 * D-61: it throws only while the file has NOT been handed to the browser (the anchor could not be built or clicked). Once `anchor.click()` has
 * returned the file is the browser's, and nothing that follows (removing the anchor, scheduling the release of the link) may throw out of here,
 * so the caller's "downloaded" status always matches what happened.
 */
export function downloadTemplateBlob(
  content: string | Blob,
  fileName: string = templateFileName,
  environment: TemplateDownloadEnvironment = windowDownloadEnvironment(),
) {
  const blob = typeof content === "string" ? new Blob([content], { type: "text/html;charset=utf-8" }) : content;
  const url = environment.URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = environment.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    environment.document.body.append(anchor);
    anchor.click();
  } catch (error) {
    try { anchor?.remove(); } catch { /* the failure that matters is the one being rethrown */ }
    environment.URL.revokeObjectURL(url);
    throw error;
  }
  // From here on the file is with the browser: cleanup failures are swallowed.
  try { anchor.remove(); } catch { /* a stray hidden anchor is harmless */ }
  const release = () => { try { environment.URL.revokeObjectURL(url); } catch { /* nothing left to release */ } };
  try {
    // Revoking in the same tick can cancel the download in some browsers. The function is read off the environment and called on its own:
    // as a method of that object a native setTimeout throws (D-61).
    const schedule = environment.setTimeout;
    schedule(release, 10_000);
  } catch {
    // No timer: releasing now is the fallback, and the download has already started.
    release();
  }
}

/* ---------------------------------------------------------------- captions shared with the preview */

export const photoCaption = "Фото после заражения";
export const mutationCaption = "Скриншот мутации";

/* ---------------------------------------------------------------- the card's own CSS (D-55) */

/** A rule as a browser reports it for the site's style sheets: the selector list, the declaration block and the @media / @container wrapper. */
export type TemplateCssRule = Readonly<{ selector: string; declarations: string; wrapper?: string }>;

// The classes of the archive card (components/portia-virus-card.tsx) and of the builder's frame around it. A rule reaches the file only
// when every class in every one of its selectors is on this list, so nothing of the desktop, the windows or the editor is carried over.
const cardClasses: ReadonlySet<string> = new Set([
  "record-view", "record-body", "record-header", "record-code", "record-status", "record-document", "record-hero", "record-footer",
  "classification-panel", "classification-grid", "class-cell", "class-badge",
  // OWN-03: the routes of transmission of the card (components/portia-virus-card.tsx) travel into the file with their look.
  "route-list", "route-item", "route-description", "is-still",
  "danger", "spread", "escape", "transmission", "mind", "appearance", "behavior", "level-1", "level-2", "level-3",
  "section-kicker", "dossier-section", "lead-copy", "metric-grid", "mutation-grid", "mutation-card", "mutation-index", "mutation-copy",
  "subject-media", "media-empty", "portia-image", "is-loaded", "is-fill", "formatted-content", "formatted-empty",
  "template-card-preview", "template-export-card", "template-export",
]);

const cardTags: ReadonlySet<string> = new Set([
  "div", "span", "strong", "small", "em", "p", "h2", "h3", "h4", "section", "header", "footer", "article", "figure", "figcaption", "img", "svg", "path",
]);

function selectorAllowed(selector: string) {
  if (selector === "" || /[#[\]*\\@{}();"'`<&|=^$!%?,]/.test(selector)) return false;
  // Only the pseudo-elements and structural pseudo-classes the card's rules use; any state (:hover, :focus) or function (:not) is refused.
  const plain = selector.replace(/::?(?:before|after)(?![\w-])/g, "").replace(/:(?:first-child|last-child|first-of-type|last-of-type|only-child|empty)(?![\w-])/g, "");
  if (plain.includes(":")) return false;
  const compounds = plain.split(/\s*[>+~]\s*|\s+/).filter((part) => part !== "");
  let classes = 0;
  for (const compound of compounds) {
    const match = /^([a-z][a-z0-9]*)?((?:\.[A-Za-z_][\w-]*)*)$/.exec(compound);
    if (match === null) return false;
    if (match[1] !== undefined && !cardTags.has(match[1])) return false;
    for (const name of match[2].split(".")) {
      if (name === "") continue;
      if (!cardClasses.has(name)) return false;
      classes += 1;
    }
  }
  return compounds.length > 0 && classes > 0;
}

// Anything that can load a resource, run something or leave the style block.
const unsafeCssValue = /url\(|image-set\(|src\(|expression\(|@|\\|<|>|\{|\}|https?:|javascript:|\/\*|[\u0000-\u001f]/i;

function splitDeclarations(text: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const char of text) {
    if (quote !== "") {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (char === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function cleanDeclaration(raw: string) {
  const colon = raw.indexOf(":");
  if (colon <= 0) return null;
  const property = raw.slice(0, colon).trim();
  if (!/^(?:--[A-Za-z0-9_-]+|-?[a-z][a-z-]*)$/.test(property)) return null;
  // The card's own @keyframes stay behind, so an animation would leave elements in its first frame.
  if (/^(?:-webkit-)?animation/i.test(property)) return null;
  const value = raw.slice(colon + 1).trim();
  if (value === "" || unsafeCssValue.test(value)) return null;
  return `${property}:${value}`;
}

function cleanWrapper(wrapper: string | undefined) {
  if (wrapper === undefined) return "";
  const normal = wrapper.replace(/\s+/g, " ").trim();
  return /^@(?:media|container) [A-Za-z0-9 :().,>=%-]+$/.test(normal) && !/url/i.test(normal) ? normal : null;
}

type CardRule = Readonly<{ selectors: readonly string[]; declarations: readonly string[]; wrapper: string }>;

function cardRules(rules: readonly TemplateCssRule[]): CardRule[] {
  const kept: CardRule[] = [];
  for (const rule of rules) {
    const selectors = rule.selector.split(",").map((selector) => selector.replace(/\s+/g, " ").trim());
    if (selectors.length === 0 || !selectors.every(selectorAllowed)) continue;
    const wrapper = cleanWrapper(rule.wrapper);
    if (wrapper === null) continue;
    const declarations = splitDeclarations(rule.declarations).map(cleanDeclaration).filter((declaration): declaration is string => declaration !== null);
    if (declarations.length > 0) kept.push({ selectors, declarations, wrapper });
  }
  return kept;
}

/** The variable names the card's rules read, so the caller can pass their computed values to `templateCardCss`. */
export function templateCardVariableNames(rules: readonly TemplateCssRule[]): string[] {
  const names = new Set<string>();
  for (const rule of cardRules(rules)) {
    for (const declaration of rule.declarations) {
      for (const match of declaration.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) names.add(match[1]);
    }
  }
  return [...names].sort();
}

/**
 * The card's style rules for the file: a `:root` block with the given (computed) variable values, then the rules whose selectors
 * name only the card's classes, each in its own @media / @container wrapper. Rules for fonts, imports, anything with url(), and
 * animations are never written, so the file loads nothing.
 */
export function templateCardCss(rules: readonly TemplateCssRule[], variables: Readonly<Record<string, string>>): string {
  const root = Object.keys(variables)
    .filter((name) => /^--[A-Za-z0-9_-]+$/.test(name))
    .sort()
    .map((name) => [name, variables[name].trim()] as const)
    .filter(([, value]) => value !== "" && !unsafeCssValue.test(value) && !value.includes(";"))
    .map(([name, value]) => `${name}:${value}`);
  const body = cardRules(rules).map((rule) => {
    const block = `${rule.selectors.join(",")}{${rule.declarations.join(";")}}`;
    return rule.wrapper === "" ? block : `${rule.wrapper}{${block}}`;
  });
  return [`:root{${root.join(";")}}`, ...body].join("\n");
}

/* ---------------------------------------------------------------- the files */

export const templateCardWidth = 1060;

// Base of the page: the site's own `* { box-sizing }`, the paper and the ink, and the document face, nothing else.
const baseCss = "*,*::before,*::after{box-sizing:border-box}html{background:var(--paper,#f3f0e6)}.template-export{margin:0;background:var(--paper,#f3f0e6);color:var(--ink,#1b2523);font:16px/1.55 var(--doc,system-ui,\"Segoe UI\",Roboto,Arial,sans-serif)}";

/**
 * A typed address stays readable text but is no address in the file: outside the tags `http:` and `url(` get a character reference
 * for one character. Attributes and tags are never touched, so a real address in an attribute is still found by the policy.
 */
export function neutralizeTemplateText(markup: string) {
  return markup
    .split(/(<[^>]*>)/)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(/(https?):/gi, "$1&#58;").replace(/url\(/gi, "url&#40;")))
    .join("");
}

/** The single-file page: the card's markup, its CSS, a closed content policy (no network at all, data images only). */
export function templateCardDocument(markup: string, css: string, title: string) {
  return [
    "<!doctype html>",
    "<html lang=\"ru\"><head><meta charset=\"utf-8\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${neutralizeTemplateText(escapeTemplateHtml(title.trim() === "" ? templateDefaultTitle : title.trim()))}</title>`,
    `<style>${baseCss}${css}</style></head>`,
    `<body class="template-export">${neutralizeTemplateText(markup)}</body></html>`,
  ].join("");
}

/** The same card as an SVG with a foreignObject, the source of the PNG. `markup` is XHTML (an XMLSerializer result). */
export function templateCardSvg(markup: string, css: string, width: number, height: number) {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const style = `${baseCss}${css}`.replace(/&/g, "&amp;");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="template-export">`,
    `<style>${style}</style>${neutralizeTemplateText(markup)}</div></foreignObject></svg>`,
  ].join("");
}

/* ---------------------------------------------------------------- the closed policy of D-23 / D-24 */

const dataImageSource = /^"data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}"$/;

/**
 * One check over a finished file: no external address, script, link, css url(), event handler, reference attribute, embedded content,
 * scientist section, and no image but a data URL of the allowed types. `svg` mode (the source of the PNG) allows exactly the two
 * namespace addresses of an SVG with XHTML inside it, written as xmlns attributes, and nothing else.
 */
export function templateExportViolations(content: string, mode: "html" | "svg" = "html"): string[] {
  const text = mode === "svg"
    ? content.split("xmlns=\"http://www.w3.org/2000/svg\"").join("").split("xmlns=\"http://www.w3.org/1999/xhtml\"").join("")
    : content;
  const found: string[] = [];
  if (/https?:/i.test(text)) found.push("external address");
  if (/<script/i.test(text)) found.push("script");
  if (/<link/i.test(text)) found.push("link");
  if (/url\(/i.test(text)) found.push("css url");
  if (/<[^>]*\son[a-z]+\s*=/i.test(text)) found.push("event handler");
  if (/<[^>]*\s(?:href|xlink:href|action|formaction|poster|srcset|ping|data)\s*=/i.test(text)) found.push("reference attribute");
  if (/<(?:iframe|frame|object|embed|base|form|image|use|audio|video|source)(?![\w-])/i.test(text)) found.push("embedded content");
  if (text.includes("ЗАПИСИ УЧЁНЫХ")) found.push("scientist records section");
  for (const tag of text.match(/<img(?![\w-])[^>]*>/gi) ?? []) {
    const sources = [...tag.matchAll(/\s([A-Za-z:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g)].filter((attribute) => /^(?:src|srcset|href|xlink:href)$/i.test(attribute[1]));
    const allowed = sources.length === 1 && sources[0][1].toLowerCase() === "src" && dataImageSource.test(sources[0][2]);
    if (!allowed) found.push(`image outside data:image/png|jpeg|webp: ${tag.slice(0, 40)}`);
  }
  return found;
}

export function assertTemplateExportClean(content: string, mode: "html" | "svg" = "html") {
  if (templateExportViolations(content, mode).length > 0) throw namedError("TemplateExportError", templateExportError);
}

/* ---------------------------------------------------------------- PNG: the raster of the same card */

export const pngMaxHeight = 8000;
const pngPaper = "#f3f0e6";

type CanvasContext = {
  fillStyle: string;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  drawImage: (image: never, x: number, y: number, width: number, height: number) => void;
};

type CanvasLike = {
  width: number;
  height: number;
  getContext: (type: "2d") => CanvasContext | null;
  toBlob: (callback: (blob: Blob | null) => void, type?: string) => void;
};

export type PngEnvironment = Readonly<{
  createCanvas: (width: number, height: number) => CanvasLike;
  /** Loads the SVG source and returns something the canvas can draw. */
  loadImage: (src: string) => Promise<unknown>;
}>;

const browserPngEnvironment = (): PngEnvironment => ({
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as CanvasLike;
  },
  loadImage: async (src) => {
    const image = await loadBrowserImage(src);
    try {
      await image.decode();
    } catch {
      // The load event already succeeded; a decode that cannot be awaited is not a failure.
    }
    return image;
  },
});

/**
 * Draws the card's SVG on a canvas (scale 2 while the canvas stays within 8000 px, else 1) and encodes it as PNG. Only the assembled
 * SVG is loaded, as a data URL, after the closed policy has passed it. A card taller than 8000 px is refused, never cropped.
 */
export async function renderTemplateCardPng(svg: string, height: number, environment: PngEnvironment = browserPngEnvironment()): Promise<Blob> {
  if (!Number.isFinite(height) || height < 1) throw namedError("TemplateExportError", templateExportError);
  const pixels = Math.ceil(height);
  const scale = pixels * 2 <= pngMaxHeight ? 2 : pixels <= pngMaxHeight ? 1 : 0;
  if (scale === 0) throw namedError("TemplatePngTooLargeError", `card height ${pixels} exceeds ${pngMaxHeight}`);
  assertTemplateExportClean(svg, "svg");
  const image = await environment.loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const width = templateCardWidth * scale;
  const canvasHeight = pixels * scale;
  const canvas = environment.createCanvas(width, canvasHeight);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2d canvas is not available");
  context.fillStyle = pngPaper;
  context.fillRect(0, 0, width, canvasHeight);
  context.drawImage(image as never, 0, 0, width, canvasHeight);
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((value) => (value !== null && value.size > 0 ? resolve(value) : reject(new Error("PNG encoding failed"))), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}
