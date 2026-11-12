import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { classificationOptions, portiaTextKey, type PortiaContent, type RichTextDocument } from "./portia-content.ts";
import { removeMutation } from "./editor-items.ts";
import {
  addTemplateMutation,
  editTemplateText,
  editTemplateVirus,
  emptyTemplateDossier,
  hasTemplateDossierContent,
  removeTemplateMutation,
  safeTemplateRunStyle,
  setTemplateImage,
  setTemplateImageFraming,
  templateDossierSnapshotKey,
  templateFieldRuns,
  templateRunBackground,
  templateVirusId,
  type TemplateDossier,
} from "./portia-template-dossier.ts";
import {
  downloadTemplateBlob,
  renderTemplateCardPng,
  templateCardCss,
  templateCardDocument,
  templateCardSvg,
  templateCardWidth,
  type PngEnvironment,
  type TemplateImage,
} from "./portia-template-export.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const editorSource = () => readFileSync(path.join(here, "..", "components", "portia-editor.tsx"), "utf8");

const externalKey = portiaTextKey.virus(templateVirusId, "external");
const dangerDoc: RichTextDocument = { runs: [{ text: "Опасно", style: { color: "#B43632", fontWeight: 600 } }, { text: " для всех" }] };
const dangerText = "Опасно для всех";

function editExternal(dossier: TemplateDossier) {
  return editTemplateText(dossier, externalKey, dangerText, dangerDoc, (next, text) => { next.virus.external = text; });
}

/* ---------------------------------------------------------------- model */

test("an empty template has the editor card shape with no scientist logs and no image addresses", () => {
  const dossier = emptyTemplateDossier();
  assert.equal(templateVirusId, "template");
  assert.equal(dossier.virus.id, "template");
  assert.deepEqual(dossier.virus.scientistLogs, []);
  assert.deepEqual(dossier.virus.mutations, []);
  assert.equal(dossier.virus.infectedImage, "");
  for (const value of [dossier.virus.code, dossier.virus.name, dossier.virus.status, dossier.virus.external, dossier.virus.ppu.health, dossier.virus.ppu.speed, dossier.virus.ppu.abilities, dossier.virus.physiology]) {
    assert.equal(value, "");
  }
  assert.deepEqual(dossier.formattedText, {});
  assert.deepEqual(dossier.images, { infected: null, mutations: [] });
});

test("a new template classification equals the classification of a new editor virus and uses known values", () => {
  const source = editorSource();
  const block = /const blankVirus = \(\): Virus => \(\{[\s\S]*?classification: \{([\s\S]*?)\}/.exec(source);
  assert.ok(block, "blankVirus is found in the editor source");
  const fromEditor = Object.fromEntries([...block[1].matchAll(/(\w+):\s*"([^"]*)"/g)].map((match) => [match[1], match[2]]));
  assert.equal(Object.keys(fromEditor).length, 7);
  const { classification } = emptyTemplateDossier().virus;
  assert.deepEqual(classification, fromEditor);
  for (const [axis, value] of Object.entries(classification)) {
    const options = classificationOptions[axis as keyof typeof classificationOptions] as readonly { value: string }[];
    assert.ok(options.some((option) => option.value === value), `${axis}=${value} is a known option`);
  }
});

test("two empty templates share nothing", () => {
  const a = emptyTemplateDossier();
  const b = emptyTemplateDossier();
  assert.notEqual(a, b);
  assert.notEqual(a.virus, b.virus);
  assert.notEqual(a.virus.classification, b.virus.classification);
  assert.notEqual(a.images.mutations, b.images.mutations);
  a.virus.name = "changed";
  assert.equal(b.virus.name, "");
});

test("a text edit returns a new draft with the plain text and the formatting document, and leaves the input alone", () => {
  const before = emptyTemplateDossier();
  const snapshot = structuredClone(before);
  const after = editExternal(before);
  assert.notEqual(after, before);
  assert.deepEqual(before, snapshot);
  assert.equal(after.virus.external, dangerText);
  assert.deepEqual(after.formattedText[externalKey], dangerDoc);
  assert.equal(after.virus.id, "template");
});

test("an edit under a key outside the template namespace is ignored", () => {
  const before = emptyTemplateDossier();
  for (const key of [portiaTextKey.virus("virus-real-1", "external"), portiaTextKey.broadcast("x"), "virus:template", "virustemplate:external"]) {
    const after = editTemplateText(before, key, "text", { runs: [{ text: "text" }] }, (next, text) => { next.virus.external = text; });
    assert.deepEqual(after, before, key);
    assert.equal(after.virus.external, "");
  }
});

/* ---------------------------------------------------------------- fragment style */

test("a fragment style keeps only values the site normalizer accepts", () => {
  assert.deepEqual(safeTemplateRunStyle({ color: "#B43632" }), { color: "#b43632" });
  for (const bad of ["red", "url(x)", "#12345", "#1234567", "rgb(1,2,3)", "#b43632;background:url(//x)", 5, null]) {
    assert.deepEqual(safeTemplateRunStyle({ color: bad }), {}, String(bad));
    assert.deepEqual(safeTemplateRunStyle({ backgroundColor: bad }), {}, String(bad));
  }
  assert.deepEqual(safeTemplateRunStyle({ fontWeight: 450 }), {});
  assert.deepEqual(safeTemplateRunStyle({ fontWeight: "700" }), {});
  assert.deepEqual(safeTemplateRunStyle({ fontWeight: 900 }), { fontWeight: 900 });
  assert.deepEqual(safeTemplateRunStyle({ fontSize: 300 }), { fontSize: 48 });
  assert.deepEqual(safeTemplateRunStyle({ fontSize: 3 }), { fontSize: 10 });
  assert.deepEqual(safeTemplateRunStyle({ fontSize: 12.6 }), { fontSize: 13 });
  assert.deepEqual(safeTemplateRunStyle({ fontSize: Number.NaN }), {});
  assert.deepEqual(safeTemplateRunStyle({ fontSize: "20px" }), {});
  assert.deepEqual(safeTemplateRunStyle({ backgroundOpacity: 3 }), { backgroundOpacity: 1 });
  assert.deepEqual(safeTemplateRunStyle({ backgroundOpacity: -2 }), { backgroundOpacity: 0 });
  assert.deepEqual(safeTemplateRunStyle({ backgroundOpacity: 0.25 }), { backgroundOpacity: 0.25 });
  assert.deepEqual(safeTemplateRunStyle({ color: "#112233", unknown: "x", "font-family": "evil", fontFamily: "evil" }), { color: "#112233" });
  for (const notAnObject of [null, undefined, "color:red", 7, ["color"]]) assert.deepEqual(safeTemplateRunStyle(notAnObject), {});
});

test("a fragment background is an rgba value built from a hex colour and its opacity", () => {
  assert.equal(templateRunBackground({ backgroundColor: "#102030", backgroundOpacity: 0.5 }), "rgba(16,32,48,0.5)");
  assert.equal(templateRunBackground({ backgroundColor: "#102030" }), "rgba(16,32,48,1)");
  assert.equal(templateRunBackground({ backgroundOpacity: 0.5 }), undefined);
  assert.equal(templateRunBackground({}), undefined);
});

test("field runs follow the stored document only while its text equals the field text", () => {
  const dossier = editExternal(emptyTemplateDossier());
  assert.deepEqual(templateFieldRuns(dossier, externalKey, dangerText), [
    { text: "Опасно", style: { color: "#b43632", fontWeight: 600 } },
    { text: " для всех" },
  ]);
  assert.deepEqual(templateFieldRuns(dossier, externalKey, "другой текст"), [{ text: "другой текст" }]);
  assert.deepEqual(templateFieldRuns(dossier, portiaTextKey.virus(templateVirusId, "physiology"), "без оформления"), [{ text: "без оформления" }]);
  const hostile = emptyTemplateDossier();
  hostile.formattedText[externalKey] = { runs: [{ text: "ab", style: { color: "red", fontSize: 300, fontWeight: 450 } as never }, { text: "cd" }] };
  assert.deepEqual(templateFieldRuns(hostile, externalKey, "abcd"), [{ text: "ab", style: { fontSize: 48 } }, { text: "cd" }]);
  hostile.formattedText[externalKey] = { runs: "not-an-array" } as never;
  assert.deepEqual(templateFieldRuns(hostile, externalKey, "abcd"), [{ text: "abcd" }]);
});

/* ---------------------------------------------------------------- no network, no storage */

const trapNames = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB"] as const;

async function withIoTraps<T>(body: () => Promise<T> | T): Promise<{ result: T; hits: string[] }> {
  const hits: string[] = [];
  const scope = globalThis as unknown as Record<string, unknown>;
  const saved = trapNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  for (const name of trapNames) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() { hits.push(name); throw new Error(`${name} must not be used`); },
      set() { hits.push(`${name}=`); },
    });
  }
  const createdNavigator = scope.navigator === undefined;
  if (createdNavigator) Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: {} });
  const navigatorObject = scope.navigator as Record<string, unknown>;
  const hadBeacon = Object.getOwnPropertyDescriptor(navigatorObject, "sendBeacon");
  Object.defineProperty(navigatorObject, "sendBeacon", { configurable: true, writable: true, value: () => { hits.push("sendBeacon"); return false; } });
  try {
    return { result: await body(), hits };
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor === undefined) delete scope[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
    if (hadBeacon) Object.defineProperty(navigatorObject, "sendBeacon", hadBeacon);
    else delete navigatorObject.sendBeacon;
    if (createdNavigator) delete scope.navigator;
  }
}

function fakeCanvasEnvironment() {
  const loaded: string[] = [];
  const environment: PngEnvironment = {
    createCanvas: (width, height) => {
      const context = { fillStyle: "", fillRect: () => {}, drawImage: () => {} };
      return { width, height, getContext: () => context, toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(["png-bytes"], { type: "image/png" })) };
    },
    loadImage: async (src) => { loaded.push(src); return {}; },
  };
  return { environment, loaded };
}

/** The same two files the builder makes from the card: a page and a PNG raster of the same markup (D-55, 20-44). */
async function exportBoth(dossier: TemplateDossier, environment: PngEnvironment) {
  const markup = `<article class="record-view"><span class="formatted-content">${dossier.virus.external}</span></article>`;
  const css = templateCardCss([{ selector: ".record-view", declarations: "color: var(--ink)" }], { "--ink": "#1b2523" });
  const html = templateCardDocument(markup, css, dossier.virus.name.trim() || "Шаблон досье");
  const svg = templateCardSvg(markup.replace("<article", `<article xmlns="http://www.w3.org/1999/xhtml"`), css, templateCardWidth, 900);
  return { html, png: await renderTemplateCardPng(svg, 900, environment) };
}

test("the whole path from edit to HTML, PNG and download makes no request and touches no browser storage", async () => {
  const downloads: string[] = [];
  const anchor = { href: "", download: "", rel: "", style: { display: "" }, click: () => { downloads.push(anchor.download); }, remove: () => {} };
  const downloadEnvironment = {
    document: { createElement: () => anchor, body: { append: () => {} } } as unknown as Document,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} } as unknown as typeof URL,
    setTimeout: (() => 0) as unknown as typeof setTimeout,
  };
  const { result, hits } = await withIoTraps(async () => {
    const edited = editExternal(emptyTemplateDossier());
    const { html, png } = await exportBoth(edited, fakeCanvasEnvironment().environment);
    downloadTemplateBlob(html, "a.html", downloadEnvironment);
    downloadTemplateBlob(png, "a.png", downloadEnvironment);
    return { html, png };
  });
  assert.deepEqual(hits, []);
  assert.ok(result.html.includes("Опасно"));
  assert.ok(result.png.size > 0);
  assert.deepEqual(downloads, ["a.html", "a.png"]);
  assert.equal(typeof globalThis.fetch, "function", "the real fetch is restored after the traps");
});

test("the traps really fire, so a silent path is evidence and not a broken harness", async () => {
  const { hits } = await withIoTraps(async () => {
    for (const read of [() => globalThis.fetch, () => globalThis.localStorage, () => globalThis.sessionStorage, () => globalThis.indexedDB]) {
      try { read(); } catch { /* the trap throws on purpose */ }
    }
    (globalThis as unknown as { navigator: { sendBeacon: (url: string) => boolean } }).navigator.sendBeacon("x");
  });
  assert.deepEqual(hits, ["fetch", "localStorage", "sessionStorage", "indexedDB", "sendBeacon"]);
});

/* ---------------------------------------------------------------- static guard on the module source */

const forbiddenTokens = [
  "fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB", "supabase",
] as const;
const allowedImports = new Set(["./portia-content.ts", "./editor-items.ts", "./portia-template-dossier.ts", "./portia-template-export.ts", "./image-framing.ts"]);

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

function ioViolations(source: string) {
  const code = stripComments(source);
  const found: string[] = [];
  for (const token of forbiddenTokens) {
    if (new RegExp(`\\b${token}\\b`, "i").test(code)) found.push(`token ${token}`);
  }
  if (/["'`]\/api\//.test(code)) found.push("route /api/");
  for (const match of code.matchAll(/\b(?:import|export)\b[^;'"`]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g)) {
    const specifier = match[1] ?? match[2];
    if (!allowedImports.has(specifier)) found.push(`import ${specifier}`);
  }
  if (/\bimport\s*\(/.test(code) || /\brequire\s*\(/.test(code)) found.push("dynamic import or require");
  return found;
}

function staticSubjects() {
  const override = process.env.GSD_PROHIB_SUBJECT;
  if (override) return [path.resolve(process.cwd(), override)];
  return ["portia-template-dossier.ts", "portia-template-export.ts"].map((file) => path.join(here, file));
}

test("the template modules import only their allowed neighbours and name no network or storage API", () => {
  for (const subject of staticSubjects()) {
    assert.deepEqual(ioViolations(readFileSync(subject, "utf8")), [], subject);
  }
});

test("the static guard recognises a violating source (guard self-check)", () => {
  const bad = `import { upload } from "@/lib/upload-image";\nawait fetch("/api/content", { method: "PUT" });\nsessionStorage.setItem("a", "b");`;
  const found = ioViolations(bad);
  assert.ok(found.includes("token fetch") && found.includes("token sessionStorage") && found.includes("import @/lib/upload-image") && found.includes("route /api/"));
  assert.deepEqual(ioViolations(`// fetch localStorage\n/* sendBeacon */ import type { Virus } from "./portia-content.ts";\nconst note = "plain";`), []);
});

/* ---------------------------------------------------------------- edits like the editor (Task 2) */

const tinyPng: TemplateImage = Object.freeze({ name: "a.png", mime: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=", width: 40, height: 20, bytes: 8 });
const tinyJpeg: TemplateImage = Object.freeze({ name: "b.jpg", mime: "image/jpeg", dataUrl: "data:image/jpeg;base64,/9j/4AAQ", width: 30, height: 30, bytes: 6 });

function describeMutation(dossier: TemplateDossier, index: number, name: string, description: string, color: string) {
  const named = editTemplateVirus(dossier, (virus) => { virus.mutations[index].name = name; });
  return editTemplateText(named, portiaTextKey.mutation(templateVirusId, index), description, { runs: [{ text: description, style: { color } }] }, (next, text) => { next.virus.mutations[index].description = text; });
}

function threeMutations(): TemplateDossier {
  let dossier = emptyTemplateDossier();
  for (let index = 0; index < 3; index += 1) dossier = addTemplateMutation(dossier);
  for (let index = 0; index < 3; index += 1) dossier = describeMutation(dossier, index, `M${index}`, `описание ${index}`, `#10203${index}`);
  dossier = editExternal(dossier);
  dossier = setTemplateImage(dossier, 0, tinyPng);
  dossier = setTemplateImage(dossier, 2, tinyJpeg);
  return dossier;
}

test("a new mutation equals the editor's new mutation and gets an empty image slot", () => {
  const match = /virus\.mutations\.push\((\{[^}]*НОВАЯ МУТАЦИЯ[^}]*\})\)/.exec(editorSource());
  assert.ok(match, "the add-mutation literal is found in the editor source");
  const fromEditor = Object.fromEntries([...match[1].matchAll(/(\w+):\s*"([^"]*)"/g)].map((pair) => [pair[1], pair[2]]));
  assert.deepEqual(fromEditor, { name: "НОВАЯ МУТАЦИЯ", description: "", image: "" });
  const before = emptyTemplateDossier();
  const snapshot = structuredClone(before);
  const after = addTemplateMutation(before);
  assert.deepEqual(before, snapshot);
  assert.notEqual(after, before);
  assert.deepEqual(after.virus.mutations, [fromEditor]);
  assert.deepEqual(after.images.mutations, [null]);
  assert.deepEqual(addTemplateMutation(after).images.mutations, [null, null]);
});

test("deleting a mutation shifts the descriptions' formatting exactly like the editor's removeMutation", () => {
  for (const index of [0, 1, 2]) {
    const before = threeMutations();
    const snapshot = structuredClone(before);
    const after = removeTemplateMutation(before, index);
    const content = { formattedText: structuredClone(before.formattedText) } as unknown as PortiaContent;
    const virus = structuredClone(before.virus);
    removeMutation(content, virus, index);
    assert.deepEqual(before, snapshot, `input is untouched (index ${index})`);
    assert.equal(after.virus.mutations.length, 2);
    assert.deepEqual(after.virus.mutations, virus.mutations, `mutations (index ${index})`);
    assert.deepEqual(after.formattedText, content.formattedText, `formattedText (index ${index})`);
    assert.deepEqual(after.images.mutations, before.images.mutations.filter((_, position) => position !== index), `image slots (index ${index})`);
    assert.ok(externalKey in after.formattedText, "other fields keep their formatting");
  }
  const middle = removeTemplateMutation(threeMutations(), 1);
  assert.equal(middle.virus.mutations[1].name, "M2");
  assert.deepEqual(middle.formattedText[portiaTextKey.mutation(templateVirusId, 1)], { runs: [{ text: "описание 2", style: { color: "#102032" } }] });
  assert.equal(portiaTextKey.mutation(templateVirusId, 2) in middle.formattedText, false);
});

test("deleting an unknown mutation changes nothing", () => {
  const dossier = threeMutations();
  for (const index of [-1, 3, 1.5, Number.NaN]) assert.equal(removeTemplateMutation(dossier, index), dossier, String(index));
});

test("a virus edit cannot change the id, add a scientist log, write an image address or change the mutation count", () => {
  const dossier = threeMutations();
  const edited = editTemplateVirus(dossier, (virus) => {
    virus.code = "VIR-7";
    virus.classification.mind = "Обливиум";
    virus.mutations[0].name = "Первая";
    virus.id = "virus-real-1";
    virus.infectedImage = "https://evil.example/a.png";
    virus.mutations[1].image = "https://evil.example/m.png";
    virus.scientistLogs.push({ id: "log-1", title: "ЗАПИСЬ 01", scientist: "X", lockedLevel: 3, content: [""] });
  });
  assert.notEqual(edited, dossier);
  assert.equal(edited.virus.code, "VIR-7");
  assert.equal(edited.virus.classification.mind, "Обливиум");
  assert.equal(edited.virus.mutations[0].name, "Первая");
  assert.equal(edited.virus.id, "template");
  assert.equal(edited.virus.infectedImage, "");
  assert.deepEqual(edited.virus.mutations.map((mutation) => mutation.image), ["", "", ""]);
  assert.deepEqual(edited.virus.scientistLogs, []);
  // The chosen behaviour for a count change: the whole edit is refused and the same draft comes back.
  assert.equal(editTemplateVirus(dossier, (virus) => { virus.mutations.push({ name: "x", description: "", image: "" }); }), dossier);
  assert.equal(editTemplateVirus(dossier, (virus) => { virus.mutations.length = 1; }), dossier);
  assert.equal(editTemplateText(dossier, externalKey, "x", dangerDoc, (next) => { next.virus.mutations.pop(); }), dossier);
  assert.equal(editTemplateText(dossier, externalKey, "x", dangerDoc, (next) => { next.formattedText["virus:real:external"] = dangerDoc; }).formattedText["virus:real:external"], undefined);
});

test("an image goes only into its own slot and only as a local data URL", () => {
  const dossier = threeMutations();
  const infected = setTemplateImage(dossier, "infected", tinyPng);
  assert.equal(infected.images.infected, tinyPng);
  assert.deepEqual(infected.images.mutations, dossier.images.mutations);
  const second = setTemplateImage(dossier, 1, tinyJpeg);
  assert.deepEqual(second.images.mutations, [tinyPng, tinyJpeg, tinyJpeg]);
  assert.equal(second.images.infected, null);
  assert.deepEqual(setTemplateImage(second, 1, null).images.mutations, [tinyPng, null, tinyJpeg]);
  assert.equal(dossier.images.mutations[1], null, "the input draft is untouched");
  const external = { ...tinyPng, dataUrl: "https://evil.example/a.png" };
  const svg = { ...tinyPng, mime: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" } as unknown as TemplateImage;
  const mismatched = { ...tinyPng, dataUrl: "data:image/jpeg;base64,/9j/4AAQ" };
  const withQuote = { ...tinyPng, dataUrl: "data:image/png;base64,AAAA\" onerror=\"x" };
  for (const bad of [external, svg, mismatched, withQuote]) assert.equal(setTemplateImage(dossier, "infected", bad), dossier);
  for (const slot of [-1, 3, 0.5]) assert.equal(setTemplateImage(dossier, slot, tinyPng), dossier, String(slot));
});

test("local image frames are normalized per slot and change the export snapshot", () => {
  const base = setTemplateImage(setTemplateImage(threeMutations(), "infected", tinyPng), 1, tinyJpeg);
  const initialKey = templateDossierSnapshotKey(base);
  const framed = setTemplateImageFraming(base, 1, { x: -20, y: 110, zoom: 999 });
  assert.deepEqual(framed.images.mutations[1]?.framing, { x: 0, y: 100, zoom: 300 });
  assert.equal(framed.images.infected?.framing, undefined);
  assert.notEqual(templateDossierSnapshotKey(framed), initialKey);
  const other = setTemplateImageFraming(framed, "infected", { x: 45.3, y: 61.6, zoom: 143.9 });
  assert.deepEqual(other.images.infected?.framing, { x: 45, y: 62, zoom: 144 });
  assert.deepEqual(other.images.mutations[1]?.framing, framed.images.mutations[1]?.framing);
  assert.equal(setTemplateImage(other, 1, tinyPng).images.mutations[1]?.framing, undefined);
  assert.equal(setTemplateImage(other, "infected", null).images.infected, null);
  assert.deepEqual(base.images.infected, tinyPng, "input remains unchanged");
});

test("content is detected for any typed character, class change, image or mutation, and not for an empty draft", () => {
  const empty = emptyTemplateDossier();
  assert.equal(hasTemplateDossierContent(empty), false);
  assert.equal(hasTemplateDossierContent(editTemplateVirus(empty, (virus) => { virus.physiology = "   "; })), false);
  const typed = (patch: (virus: TemplateDossier["virus"]) => void) => hasTemplateDossierContent(editTemplateVirus(empty, patch));
  assert.equal(typed((virus) => { virus.code = "V"; }), true);
  assert.equal(typed((virus) => { virus.ppu.speed = "1"; }), true);
  assert.equal(typed((virus) => { virus.classification.behavior = "Инфернар"; }), true);
  assert.equal(hasTemplateDossierContent(addTemplateMutation(empty)), true);
  assert.equal(hasTemplateDossierContent(setTemplateImage(empty, "infected", tinyPng)), true);
});

test("the snapshot key follows text, formatting, classification, mutations and images and equals itself for equal content", () => {
  const base = threeMutations();
  const key = templateDossierSnapshotKey(base);
  assert.equal(templateDossierSnapshotKey(structuredClone(base)), key);
  assert.equal(templateDossierSnapshotKey(emptyTemplateDossier()), templateDossierSnapshotKey(emptyTemplateDossier()));
  const changes: TemplateDossier[] = [
    editTemplateVirus(base, (virus) => { virus.name = "A"; }),
    editTemplateVirus(base, (virus) => { virus.classification.danger = "Апейрон"; }),
    editTemplateVirus(base, (virus) => { virus.mutations[1].name = "другая"; }),
    editTemplateText(base, externalKey, dangerText, { runs: [{ text: "Опасно", style: { color: "#B43633", fontWeight: 600 } }, { text: " для всех" }] }, (next, text) => { next.virus.external = text; }),
    editTemplateText(base, portiaTextKey.virus(templateVirusId, "physiology"), "ф", { runs: [{ text: "ф" }] }, (next, text) => { next.virus.physiology = text; }),
    addTemplateMutation(base),
    removeTemplateMutation(base, 0),
    setTemplateImage(base, 1, tinyPng),
    setTemplateImage(base, "infected", tinyJpeg),
    setTemplateImage(base, 0, null),
  ];
  const keys = new Set(changes.map(templateDossierSnapshotKey));
  assert.ok(!keys.has(key), "no change leaves the key as it was");
  assert.equal(keys.size, changes.length, "different changes give different keys");
});

test("a whole editing session with every edit function and both exports makes no request and uses no storage", async () => {
  const anchor = { href: "", download: "", rel: "", style: { display: "" }, click: () => {}, remove: () => {} };
  const downloadEnvironment = {
    document: { createElement: () => anchor, body: { append: () => {} } } as unknown as Document,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} } as unknown as typeof URL,
    setTimeout: (() => 0) as unknown as typeof setTimeout,
  };
  const fake = fakeCanvasEnvironment();
  const { result, hits } = await withIoTraps(async () => {
    let dossier = threeMutations();
    dossier = removeTemplateMutation(addTemplateMutation(dossier), 1);
    dossier = setTemplateImage(dossier, "infected", tinyPng);
    dossier = editTemplateVirus(dossier, (virus) => { virus.status = "НАБЛЮДЕНИЕ"; });
    const { html, png } = await exportBoth(dossier, fake.environment);
    downloadTemplateBlob(html, "a.html", downloadEnvironment);
    downloadTemplateBlob(png, "a.png", downloadEnvironment);
    return { key: templateDossierSnapshotKey(dossier), content: hasTemplateDossierContent(dossier) };
  });
  assert.deepEqual(hits, []);
  assert.equal(result.content, true);
  assert.ok(result.key.length > 0);
  assert.ok(fake.loaded.length === 1 && fake.loaded[0].startsWith("data:image/svg+xml"), "only the assembled SVG was loaded");
});
