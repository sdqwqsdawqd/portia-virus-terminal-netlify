/**
 * Local-only export of the participant's "Шаблон досье" draft (Phase 20, D-23/D-24).
 *
 * The draft is a small text model of its own: it deliberately has no classification, scientist log or
 * archive identity, so an archive `Virus` record can never flow into it. Nothing here touches the network.
 */

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
export const templateDefaultTitle = "Шаблон досье";

export function emptyTemplateDraft(): TemplateDraft {
  return Object.freeze(Object.fromEntries(templateFields.map((field) => [field.key, ""])) as Record<TemplateFieldKey, string>);
}

/** True when the participant typed at least one visible character; an empty draft is never exported as a success. */
export function hasTemplateText(draft: TemplateDraft) {
  return templateFields.some((field) => draft[field.key].trim() !== "");
}

/** A stable value used to tell whether the current text already left the device as a file. */
export function templateSnapshotKey(draft: TemplateDraft) {
  return JSON.stringify(templateFields.map((field) => draft[field.key]));
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
footer{margin-top:32px;padding-top:12px;border-top:1px solid #bdb8a6;font:11px/1.4 ui-monospace,Consolas,monospace;color:#4a5a56}
`.trim();

/**
 * Builds a self-contained HTML document. Every typed value is escaped, the CSS is inline, there is no script and the
 * embedded CSP forbids any request, so the file opens offline and cannot load anything from a server.
 */
export function createStandaloneHtml(draft: TemplateDraft) {
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
    sections,
    `<footer>${escapeTemplateHtml(templateDefaultTitle)} / PORTIA / локальный черновик участника, не запись архива</footer></main>`,
    "</body></html>",
  ].join("");
}

/** Starts a browser download of `html` and releases the object URL afterwards. */
export function downloadTemplateBlob(
  html: string,
  fileName: string = templateFileName,
  environment: { document: Document; URL: typeof URL; setTimeout: typeof setTimeout } = { document, URL, setTimeout },
) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
