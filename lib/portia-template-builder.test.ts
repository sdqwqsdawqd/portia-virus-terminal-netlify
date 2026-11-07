import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

// 20-39 (D-52, D-23, D-24): the template builder is made of the editor's own shared components, keeps its draft in the 20-38
// model and has no way to write to the site. Everything here reads sources; nothing renders and nothing touches a network.
// GSD_PROHIB_SUBJECT=<path> swaps the builder for another file in the import, token, tab and storage checks (fail-first).

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const read = (relative: string) => lf(readFileSync(path.join(root, relative), "utf8"));

const builderPath = "components/portia-template-builder.tsx";
const subjectOverride = process.env.GSD_PROHIB_SUBJECT;
const subjectFile = subjectOverride ? path.resolve(process.cwd(), subjectOverride) : path.join(root, builderPath);
const subjectSource = () => lf(readFileSync(subjectFile, "utf8"));

/* ---------------------------------------------------------------- source helpers */

// Short failure output: the sources are long, so a failed pattern reports only the message and the pattern.
function expectMatch(text: string, pattern: RegExp, message?: string) { assert.ok(pattern.test(text), message ?? `expected ${pattern}`); }
function expectNoMatch(text: string, pattern: RegExp, message?: string) { assert.ok(!pattern.test(text), message ?? `unexpected ${pattern}`); }

/** Removes comments while leaving string and template literals alone. */
function stripComments(source: string) {
  let out = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      out += char;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") { out += source[index]; index += 1; }
        out += source[index] ?? "";
        index += 1;
      }
      out += quote;
      index += 1;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

const importPattern = /\b(?:import|export)\b[^;'"`]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;
const importsOf = (code: string) => [...code.matchAll(importPattern)].map((match) => match[1] ?? match[2]);

/** The named imports of one module: `import { A, type B } from "module"` gives ["A", "B"]. */
function namedImports(code: string, moduleName: string) {
  const names: string[] = [];
  for (const match of code.matchAll(/\bimport\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    if (match[2] !== moduleName) continue;
    for (const part of match[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names.sort();
}

/* ---------------------------------------------------------------- the import graph */

const allowedPackages = new Set(["react", "react-dom"]);
const forbiddenModules = [
  /^components\/portia-editor\.tsx$/,
  /^components\/portia-desktop/,
  /^components\/portia-promotion/,
  /^lib\/image-upload\.ts$/,
  /^lib\/editor-access\.ts$/,
  /^lib\/request-json\.ts$/,
  /^lib\/portia-cdn\.ts$/,
  /^lib\/editor-save-status\.ts$/,
  /^lib\/supabase/,
];

function resolveModule(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return `missing:${base}`;
}

type Graph = { files: Map<string, string>; forbidden: string[]; packages: string[]; missing: string[] };

function importGraph(entry: string): Graph {
  const graph: Graph = { files: new Map(), forbidden: [], packages: [], missing: [] };
  const visit = (file: string) => {
    if (graph.files.has(file)) return;
    const code = stripComments(lf(readFileSync(file, "utf8")));
    graph.files.set(file, code);
    for (const specifier of importsOf(code)) {
      const resolved = resolveModule(file, specifier);
      if (resolved === null) {
        if (!allowedPackages.has(specifier)) graph.packages.push(`${specifier} <- ${path.relative(root, file)}`);
        continue;
      }
      if (resolved.startsWith("missing:")) { graph.missing.push(`${specifier} <- ${path.relative(root, file)}`); continue; }
      const relative = path.relative(root, resolved).split(path.sep).join("/");
      if (forbiddenModules.some((pattern) => pattern.test(relative))) { graph.forbidden.push(`${relative} <- ${path.relative(root, file)}`); continue; }
      visit(resolved);
    }
  };
  visit(entry);
  return graph;
}

const forbiddenTokens = ["fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "indexedDB", "supabase"] as const;
const storageTokens = ["localStorage", "sessionStorage"] as const;

function ioTokens(code: string) {
  const found: string[] = [];
  for (const token of forbiddenTokens) if (new RegExp(`\\b${token}\\b`, "i").test(code)) found.push(`token ${token}`);
  if (/["'`]\/api\//.test(code)) found.push("route /api/");
  if (/\bnavigator\s*\.\s*sendBeacon\b/.test(code)) found.push("token sendBeacon");
  return found;
}

test("the builder's import graph holds no site, desktop, promotion, upload, access, network or Supabase module", () => {
  const graph = importGraph(subjectFile);
  assert.deepEqual(graph.forbidden, []);
  assert.deepEqual(graph.packages, [], "only react and react-dom may come from outside the project");
  assert.deepEqual(graph.missing, []);
  const names = [...graph.files.keys()].map((file) => path.relative(root, file).split(path.sep).join("/"));
  assert.ok(names.length >= 1, "the subject itself is in the graph");
  if (!subjectOverride) {
    for (const required of ["components/portia-editor-dossier.tsx", "components/portia-editor-rich-text.tsx", "lib/portia-template-dossier.ts", "lib/portia-template-export.ts"]) {
      assert.ok(names.includes(required), `${required} is in the graph`);
    }
  }
});

test("no file of the graph calls the network, names a route of the site's API or touches browser storage outside the panel position", () => {
  const graph = importGraph(subjectFile);
  const violations: string[] = [];
  for (const [file, code] of graph.files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    for (const found of ioTokens(code)) violations.push(`${relative}: ${found}`);
    if (/\bimport\s*\(/.test(code) || /\brequire\s*\(/.test(code)) violations.push(`${relative}: dynamic import or require`);
    for (const token of storageTokens) {
      if (relative === "components/portia-editor-rich-text.tsx" && file !== subjectFile) continue;
      if (new RegExp(`\\b${token}\\b`).test(code)) violations.push(`${relative}: token ${token}`);
    }
  }
  assert.deepEqual(violations, []);
});

/* ---------------------------------------------------------------- storage of the format panel */

/** localStorage lives only in the two panel-position helpers, and each of them returns before it when the storage key is null. */
function panelStorageProblems(source: string) {
  const code = stripComments(source);
  const problems: string[] = [];
  const mentions = [...code.matchAll(/\b(?:localStorage|sessionStorage)\b/g)].length;
  const guarded = [...code.matchAll(/function (?:readPanelOffset|writePanelOffset)\(storageKey: string \| null[^)]*\)[^{]*\{\s*if \(storageKey === null\) return[^;]*;[^}]*?\blocalStorage\b/g)].length;
  if (mentions !== 2 || guarded !== 2) problems.push(`storage is used ${mentions} times, ${guarded} of them behind the null-key guard`);
  if (/\bsessionStorage\b/.test(code)) problems.push("sessionStorage");
  if (/formatPanelStorageKey\)/.test(code.replace(/function (?:readPanelOffset|writePanelOffset)[\s\S]*?\n}/g, ""))) {
    // The default key may be mentioned only as the default of the property.
    problems.push("the editor's panel key is read outside the position property");
  }
  return problems;
}

test("the format panel reads and writes its position only for a non-null positionStorageKey (T-20-73)", () => {
  assert.deepEqual(panelStorageProblems(read("components/portia-editor-rich-text.tsx")), []);
  const source = stripComments(read("components/portia-editor-rich-text.tsx"));
  expectMatch(source, /positionStorageKey\?: string \| null/);
  expectMatch(source, /positionStorageKey === undefined \? formatPanelStorageKey : positionStorageKey/, "the default is the editor's own key");
  assert.deepEqual(panelStorageProblems(`const a = localStorage.getItem("x");`), ["storage is used 1 times, 0 of them behind the null-key guard"]);
});

test("the builder passes positionStorageKey null and owns no browser storage", () => {
  const code = stripComments(subjectSource());
  const panel = /<FloatingTextFormatPanel\b[\s\S]*?\/>/.exec(code)?.[0] ?? "";
  assert.ok(panel.length > 0, "the builder renders the format panel");
  expectMatch(panel, /\bpositionStorageKey=\{null\}/, "the panel does not use the editor's position key");
  for (const token of storageTokens) expectNoMatch(code, new RegExp(`\\b${token}\\b`), token);
});

/* ---------------------------------------------------------------- the same components as the editor */

const editorImports = (moduleName: string) => namedImports(stripComments(read("components/portia-editor.tsx")), moduleName);

test("the builder imports the editor's own form components from the editor's modules and not the image field", () => {
  const code = stripComments(subjectSource());
  const dossier = namedImports(code, "@/components/portia-editor-dossier");
  const richText = namedImports(code, "@/components/portia-editor-rich-text");
  for (const name of ["DossierTabs", "EditorGroup", "Field", "ClassificationField"]) {
    assert.ok(dossier.includes(name), `${name} comes from @/components/portia-editor-dossier`);
    assert.ok(editorImports("@/components/portia-editor-dossier").includes(name), `the editor imports ${name} from the same module`);
  }
  for (const name of ["FormattedTextarea", "FloatingTextFormatPanel", "ActiveFormatContext"]) {
    assert.ok(richText.includes(name), `${name} comes from @/components/portia-editor-rich-text`);
    assert.ok(editorImports("@/components/portia-editor-rich-text").includes(name), `the editor imports ${name} from the same module`);
  }
  assert.ok(!dossier.includes("ImageEditorField"), "ImageEditorField has a link field and an upload; the builder has its own local slot");
  assert.ok(!/\bImageEditorField\b/.test(code));
});

test("the builder has no scientist records tab", () => {
  const code = stripComments(subjectSource());
  expectNoMatch(code, /Записи учёных|scientistLogs|ЗАПИСЬ\b/);
  const tabs = /<DossierTabs\b[^>]*?\btabs=\{(\[[^\]]*\])\}/.exec(code)?.[1];
  assert.ok(tabs, "DossierTabs gets an explicit list of tabs");
  assert.deepEqual(JSON.parse(tabs.replace(/'/g, '"')), ["main", "text", "mutations"]);
});

const sliceStart = '<DossierTabs active={dossierTab}';
const sliceEnd = '{dossierTab === "logs"';

function formSlice(source: string) {
  const start = source.indexOf(sliceStart);
  const end = source.indexOf(sliceEnd, start);
  assert.ok(start >= 0 && end > start, "the live card form is found in the editor source");
  return source.slice(start, end);
}

function builderSlice(source: string) {
  const start = source.indexOf('<DossierTabs');
  assert.ok(start >= 0, "the builder renders DossierTabs");
  return source.slice(start);
}

/** The ordered features of a card form that must be the same in the editor and in the builder. */
function formFeatures(slice: string) {
  const groups = [...slice.matchAll(/\{dossierTab === "(\w+)" && <EditorGroup title="([^"]+)"/g)].map((match) => `${match[1]}: ${match[2]}`);
  const labels = [...slice.matchAll(/<(?:Field|FormattedTextarea|ClassificationField)\b[^>]*?(?<![-\w])label="([^"]+)"/g)].map((match) => match[1]);
  const areas = [...slice.matchAll(/<FormattedTextarea\b[^>]*?\barea="(\w+)"/g)].map((match) => match[1]);
  const classification = [...slice.matchAll(/\["(danger|spread|transmission|escapeRisk|mind|appearance|behavior)", "([^"]+)"\]/g)].map((match) => `${match[1]}=${match[2]}`);
  const ppu = [...slice.matchAll(/\{ health: "([^"]+)", speed: "([^"]+)", abilities: "([^"]+)" \}/g)].map((match) => `${match[1]}|${match[2]}|${match[3]}`);
  return { groups, labels, areas, classification, ppu };
}

test("the builder's form has the live editor card's groups, labels, text areas, classification and PPU captions in the same order", () => {
  const live = formFeatures(formSlice(read("components/portia-editor.tsx")));
  const mine = formFeatures(builderSlice(stripComments(subjectSource())));
  assert.ok(live.groups.length === 5 && live.labels.length === 7 && live.areas.length === 4 && live.classification.length === 7 && live.ppu.length === 1, "the live slice is read as expected");
  assert.deepEqual(mine.groups, live.groups);
  assert.deepEqual(mine.labels, live.labels);
  assert.deepEqual(mine.areas, live.areas);
  assert.deepEqual(mine.classification, live.classification);
  assert.deepEqual(mine.ppu, live.ppu);
});

function functionText(source: string, name: string) {
  const start = source.search(new RegExp(`(?:export )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} is found`);
  const end = source.indexOf("\n}\n", start);
  assert.ok(end > start);
  return source.slice(start, end + 2).replace(/^export /, "").replace(/\s+/g, " ").trim();
}

test("joinFormatTarget exported for the builder equals the editor's own function", () => {
  assert.equal(functionText(read("components/portia-editor-rich-text.tsx"), "joinFormatTarget"), functionText(read("components/portia-editor.tsx"), "joinFormatTarget"));
  expectMatch(read("components/portia-editor-rich-text.tsx"), /export function joinFormatTarget\(/);
});

test("the shared components only gained optional properties and keep their defaults", () => {
  const dossier = read("components/portia-editor-dossier.tsx");
  expectMatch(dossier, /export function DossierTabs\(\{ active, changed, onSelect, tabs \}/);
  expectMatch(dossier, /tabs\?: readonly DossierTab\[\]/);
  expectMatch(dossier, /dossierTabs\.filter\(\(\[id\]\) => !tabs \|\| tabs\.includes\(id\)\)/, "no list means all four tabs");
  const rich = read("components/portia-editor-rich-text.tsx");
  expectMatch(rich, /hint\?: string/);
  // D-56 (20-37): the default hint of the shared field is one short phrase, in the editor and in the builder alike.
  expectMatch(rich, /\{hint \?\? "Текст и GIF можно сочетать\."\}/, "the default hint is the editor's text");
  expectMatch(rich, /aria-labelledby=\{labelId\}/);
  expectMatch(rich, /<span id=\{labelId\}>\{label\}<\/span>/);
});

test("Promotion renders the builder with nothing but onClose", () => {
  const promotion = read("components/portia-promotion.tsx");
  const uses = [...promotion.matchAll(/<PortiaTemplateBuilder\b([^>]*)\/>/g)].map((match) => match[1].trim());
  assert.deepEqual(uses, ["onClose={closeTemplate}"]);
});

test("the builder keeps its draft in the 20-38 model and changes it only through the model's functions", () => {
  const code = stripComments(subjectSource());
  expectMatch(code, /emptyTemplateDossier/);
  for (const name of ["editTemplateVirus", "editTemplateText", "addTemplateMutation", "removeTemplateMutation"]) expectMatch(code, new RegExp(`\\b${name}\\b`), name);
  expectMatch(code, /templateDossierSnapshotKey/);
  expectMatch(code, /templateCardDocument/); // D-55 (20-37): the file is made from the rendered card, not from a document of its own
});

/* ---------------------------------------------------------------- D-55 (20-37): the preview is the archive card */

const cardPath = "components/portia-virus-card.tsx";

test("D-55 (20-37): the public dossier and the builder's preview render the same VirusCardBody", () => {
  const code = stripComments(subjectSource());
  assert.ok(namedImports(code, "@/components/portia-virus-card").includes("VirusCardBody"), "the builder imports VirusCardBody from the shared card module");
  expectMatch(code, /<VirusCardBody\b/, "the builder renders <VirusCardBody");
  const dossier = stripComments(read("components/portia-desktop-dossier.tsx"));
  expectMatch(dossier, /<VirusCardBody\b/, "VirusRecord renders <VirusCardBody");
  expectMatch(dossier, /export function VirusRecord\(/);
  const card = stripComments(read(cardPath));
  expectMatch(card, /export function VirusCardBody\(/);
  for (const exported of ["FormattedText", "DossierSection", "classificationLevel"]) {
    expectMatch(card, new RegExp(`export function ${exported}\\(`), `${exported} is exported by the card module`);
  }
});

test("D-55 (20-37): the builder has no markup of its own for the preview", () => {
  const code = stripComments(subjectSource());
  for (const name of ["template-preview", "template-class-grid", "template-class-cell", "template-kicker", "template-mutation"]) {
    expectNoMatch(code, new RegExp(name), `the builder source holds no ${name}`);
  }
  expectMatch(code, /"record-view template-card-preview/, "the preview is the archive's record-view");
  expectMatch(code, /label="Предпросмотр шаблона"/);
});

test("D-55 (20-37): the card module imports only react, the content types, the icons and the media splitter", () => {
  const code = stripComments(read(cardPath));
  assert.deepEqual(importsOf(code).sort(), ["@/components/portia-icons", "@/lib/portia-content", "@/lib/rich-text-media", "react"]);
  assert.deepEqual(ioTokens(code), []);
});

test("D-55 (20-37): the builder keeps links as text and draws pictures only from the model's local slots", () => {
  const code = stripComments(subjectSource());
  expectMatch(code, /\bembedMedia=\{false\}/, "links to pictures in the text stay text");
  expectMatch(code, /\bemptyText=\{emptyTemplateText\}/);
  expectNoMatch(code, /\binfectedImage\b/, "the record's own picture address is never read");
  expectNoMatch(code, /\bmutation\.image\b|\.mutations\[[^\]]*\]\??\.image\b/, "a mutation's picture address is never read");
  expectMatch(code, /\bdossier\.images\b|\bimages\.mutations\b/, "the pictures come from the model's slots");
  expectMatch(code, /isLocalTemplateImage\(/, "a slot is checked before it is drawn");
});

test("D-55 (20-43): the builder shows the form or the card through a view switch with aria-pressed and keeps the form mounted", () => {
  const code = stripComments(subjectSource());
  expectMatch(code, /aria-pressed=\{view === "fields"\}/);
  expectMatch(code, /aria-pressed=\{view === "preview"\}/);
  expectMatch(code, /className="template-form"[^>]*\bhidden=\{view !== "fields"\}/, "the form stays mounted and is only hidden");
  expectMatch(code, /\{view === "preview" && <TemplatePreview\b/, "the card is drawn only in its own view");
  expectMatch(code, /closeFormatter\(\);\s*setView\(next\)/, "a view change closes the format panel as a tab change does");
  const toolbar = /<div ref=\{toolbarRef\} className="template-toolbar">[\s\S]*?<div className="template-form"/.exec(code)?.[0] ?? "";
  expectMatch(toolbar, /Скачать PNG/, "the download buttons sit outside the form, so both views have them");
  expectMatch(toolbar, /Скачать HTML/);
  expectMatch(toolbar, /role="status"/, "the status line is outside the form too");
});

/* ---------------------------------------------------------------- D-55 (20-37): the files are the same card (20-44) */

test("D-55 (20-37): the HTML and the PNG are made from the card the builder renders, through one component", () => {
  const code = stripComments(subjectSource());
  const names = namedImports(code, "@/lib/portia-template-export");
  for (const name of ["templateCardCss", "templateCardDocument", "templateCardSvg", "templateExportViolations", "renderTemplateCardPng"]) {
    assert.ok(names.includes(name), `the builder imports ${name}`);
  }
  for (const gone of ["createTemplateDossierHtml", "createTemplateDossierPng", "layoutTemplateDossierCard", "wrapTemplateRuns"]) {
    expectNoMatch(code, new RegExp(`\\b${gone}\\b`), `${gone} is gone from the builder`);
  }
  assert.equal((code.match(/<VirusCardBody\b/g) ?? []).length, 1, "one card markup for the preview and the export frame");
  assert.ok((code.match(/<TemplateCard\b/g) ?? []).length >= 2, "the preview and the export frame both render <TemplateCard");
  expectMatch(code, /className="template-export-frame"[^>]*\baria-hidden\b|\baria-hidden\b[^>]*className="template-export-frame"/, "the export frame is hidden from assistive technology");
  expectMatch(code, /\binert\b/);
  expectMatch(code, /template-export-card/, "the frame's card carries the export class");
  expectMatch(code, /document\.styleSheets/, "the card's rules are read from the site's style sheets");
  expectMatch(code, /XMLSerializer/, "the PNG takes the card's markup as XHTML");
});

test("D-55 (20-37): the builder checks the closed policy before every download and removes the frame afterwards", () => {
  const code = stripComments(subjectSource());
  const start = code.indexOf("const runExport");
  assert.ok(start > 0, "runExport exists");
  const body = code.slice(start, code.indexOf("const dismissConfirm", start));
  expectMatch(body, /templateExportViolations\(/, "runExport checks the policy");
  const downloads = [...body.matchAll(/downloadTemplateBlob\(/g)].map((match) => match.index ?? 0);
  assert.ok(downloads.length >= 1, "runExport downloads");
  for (const at of downloads) {
    assert.ok(body.slice(0, at).includes("templateExportViolations("), "the policy runs before the download");
  }
  expectMatch(body, /setExportSource\(null\)/, "the frame is removed after the export, also on failure");
  expectMatch(body, /templateExportError/, "a violation ends in the export error, not in a file");
});

/* ---------------------------------------------------------------- guard self-check */

test("the guards recognise a violating source (guard self-check)", () => {
  const bad = stripComments(`import { x } from "@/components/portia-editor";\nawait fetch("/api/content");\nsessionStorage.setItem("a", "b");`);
  assert.deepEqual(ioTokens(bad).sort(), ["route /api/", "token fetch"]);
  assert.deepEqual(ioTokens(stripComments(`// fetch\n/* supabase */ const note = "plain";`)), []);
  assert.deepEqual(namedImports(`import { A, type B as C } from "m";\nimport type { D } from "m";`, "m"), ["A", "B", "D"]);
});
