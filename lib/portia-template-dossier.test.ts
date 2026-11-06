import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { classificationOptions, portiaTextKey, type RichTextDocument } from "./portia-content.ts";
import {
  editTemplateText,
  emptyTemplateDossier,
  safeTemplateRunStyle,
  templateFieldRuns,
  templateRunBackground,
  templateVirusId,
  type TemplateDossier,
} from "./portia-template-dossier.ts";
import {
  createTemplateDossierHtml,
  createTemplateDossierPng,
  downloadTemplateBlob,
  type PngEnvironment,
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
      const context = {
        font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textBaseline: "",
        fillRect: () => {}, strokeRect: () => {}, fillText: () => {}, drawImage: () => {},
        measureText: (text: string) => ({ width: Array.from(text).length * 8 }),
      };
      return { width, height, getContext: () => context, toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(["png-bytes"], { type: "image/png" })) };
    },
    loadImage: async (src) => { loaded.push(src); return { width: 10, height: 10 }; },
  };
  return { environment, loaded };
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
    const html = createTemplateDossierHtml(edited);
    const png = await createTemplateDossierPng(edited, fakeCanvasEnvironment().environment);
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
const allowedImports = new Set(["./portia-content.ts", "./editor-items.ts", "./portia-template-dossier.ts", "./portia-template-export.ts"]);

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
