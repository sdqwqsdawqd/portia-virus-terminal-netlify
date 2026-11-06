import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { portiaTextKey, type RichTextDocument } from "./portia-content.ts";
import { addTemplateMutation, editTemplateText, editTemplateVirus, emptyTemplateDossier, setTemplateImage, templateVirusId, type TemplateDossier } from "./portia-template-dossier.ts";
import {
  createTemplateDossierHtml,
  createTemplateDossierPng,
  decodeLocalTemplateImage,
  downloadTemplateBlob,
  emptyTemplateText,
  escapeTemplateHtml,
  imageSizeWithinBounds,
  isTemplateImageError,
  isTemplatePngTooLargeError,
  layoutTemplateDossierCard,
  pngMaxHeight,
  pngPadding,
  pngWidth,
  sniffImageMime,
  templateImageMaxBytes,
  wrapTemplateRuns,
  wrapTemplateText,
  type LocalImageFile,
  type PngEnvironment,
  type TemplateImage,
} from "./portia-template-export.ts";

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpegSignature = [0xff, 0xd8, 0xff, 0xe0];
const webpSignature = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function fileOf(bytes: readonly number[], type: string, name = "photo.png", sizeOverride?: number): LocalImageFile {
  const data = Uint8Array.from(bytes);
  return { name, type, size: sizeOverride ?? data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
}

const okImage = (width = 40, height = 20) => async () => ({ width, height });

// 10 px per character keeps the fake measurement deterministic.
const measure = (text: string) => Array.from(text).length * 10;

test("escapeTemplateHtml neutralises markup and quotes", () => {
  assert.equal(escapeTemplateHtml(`<img src=x onerror="a()"> & 'b'`), "&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;");
});

test("signature sniffing accepts png, jpeg and webp and rejects text, svg and truncated headers", () => {
  assert.equal(sniffImageMime(Uint8Array.from(pngSignature)), "image/png");
  assert.equal(sniffImageMime(Uint8Array.from(jpegSignature)), "image/jpeg");
  assert.equal(sniffImageMime(Uint8Array.from(webpSignature)), "image/webp");
  assert.equal(sniffImageMime(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(sniffImageMime(new TextEncoder().encode("not an image")), null);
  assert.equal(sniffImageMime(Uint8Array.from(pngSignature.slice(0, 4))), null);
  assert.equal(sniffImageMime(new Uint8Array()), null);
});

test("pixel bounds reject zero, huge and oversized decoded images", () => {
  assert.equal(imageSizeWithinBounds(1, 1), true);
  assert.equal(imageSizeWithinBounds(4096, 2900), true);
  assert.equal(imageSizeWithinBounds(0, 10), false);
  assert.equal(imageSizeWithinBounds(4097, 10), false);
  assert.equal(imageSizeWithinBounds(4096, 4096), false);
  assert.equal(imageSizeWithinBounds(10.5, 10), false);
});

test("a valid local image decodes to a data URL with the sniffed type and decoded size", async () => {
  const image = await decodeLocalTemplateImage(fileOf([...pngSignature, 1, 2, 3], "image/png"), { loadImage: okImage(64, 32) });
  assert.equal(image.mime, "image/png");
  assert.ok(image.dataUrl.startsWith("data:image/png;base64,"));
  assert.equal(image.width, 64);
  assert.equal(image.height, 32);
  assert.equal(image.bytes, pngSignature.length + 3);
});

test("an unsupported, mislabelled, empty, oversized or undecodable image is refused before it reaches the draft", async () => {
  let decodes = 0;
  const environment = { loadImage: async () => { decodes += 1; return { width: 10, height: 10 }; } };
  const refused = async (file: LocalImageFile, env = environment) => {
    await assert.rejects(decodeLocalTemplateImage(file, env), (error) => isTemplateImageError(error));
  };
  await refused(fileOf([...new TextEncoder().encode("hello")], "image/png"));
  await refused(fileOf([...pngSignature], "text/plain"));
  await refused(fileOf([...pngSignature], "image/svg+xml"));
  await refused(fileOf([...jpegSignature], "image/png"));
  await refused(fileOf([], "image/png"));
  await refused(fileOf([...pngSignature], "image/png", "big.png", templateImageMaxBytes + 1));
  assert.equal(decodes, 0, "nothing is decoded until the type, size and signature checks pass");
  await refused(fileOf([...pngSignature], "image/png"), { loadImage: async () => { throw new Error("corrupt"); } });
  await refused(fileOf([...pngSignature], "image/png"), { loadImage: okImage(5000, 10) });
  await refused(fileOf([...pngSignature], "image/png"), { loadImage: okImage(4096, 4096) });
});

test("wrapping keeps every word, preserves blank lines and splits an over-wide word by characters", () => {
  const text = "один два три\n\nчетыре";
  const lines = wrapTemplateText(text, 90, "16px x", measure);
  assert.deepEqual(lines, ["один два", "три", "", "четыре"]);
  const long = "x".repeat(25);
  const split = wrapTemplateText(long, 100, "16px x", measure);
  assert.equal(split.join(""), long);
  assert.ok(split.every((line) => measure(line) <= 100));
});

type Call = { name: string; args: unknown[] };

function fakePngEnvironment(options: { toBlob?: "ok" | "null" | "throw" | "empty"; contextNull?: boolean } = {}) {
  const calls: Call[] = [];
  const sizes: Array<[number, number]> = [];
  const loadedSources: string[] = [];
  const environment: PngEnvironment = {
    createCanvas: (width, height) => {
      sizes.push([width, height]);
      const context = {
        font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textBaseline: "",
        fillRect: (...args: unknown[]) => { calls.push({ name: "fillRect", args }); },
        strokeRect: (...args: unknown[]) => { calls.push({ name: "strokeRect", args }); },
        fillText: (...args: unknown[]) => { calls.push({ name: "fillText", args }); },
        drawImage: (...args: unknown[]) => { calls.push({ name: "drawImage", args }); },
        measureText: (text: string) => ({ width: measure(text) }),
      };
      return {
        width, height,
        getContext: () => (options.contextNull ? null : context),
        toBlob: (callback: (blob: Blob | null) => void) => {
          if (options.toBlob === "throw") throw new Error("SecurityError");
          if (options.toBlob === "null") callback(null);
          else if (options.toBlob === "empty") callback(new Blob([], { type: "image/png" }));
          else callback(new Blob(["png-bytes"], { type: "image/png" }));
        },
      };
    },
    loadImage: async (src) => { loadedSources.push(src); return { width: 800, height: 400 }; },
  };
  return { environment, calls, sizes, loadedSources };
}

test("a download of a Blob or HTML text releases its object URL, also when the click fails", () => {
  const revoked: string[] = [];
  const timers: Array<() => void> = [];
  const anchor = { href: "", download: "", rel: "", style: { display: "" }, click: () => {}, remove: () => {} };
  const environment = {
    document: { createElement: () => anchor, body: { append: () => {} } } as unknown as Document,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: (url: string) => { revoked.push(url); } } as unknown as typeof URL,
    setTimeout: ((callback: () => void) => { timers.push(callback); return 0; }) as unknown as typeof setTimeout,
  };
  downloadTemplateBlob(new Blob(["x"], { type: "image/png" }), "a.png", environment);
  assert.equal(anchor.download, "a.png");
  assert.deepEqual(revoked, []);
  timers[0]();
  assert.deepEqual(revoked, ["blob:test"]);

  anchor.click = () => { throw new Error("blocked"); };
  assert.throws(() => downloadTemplateBlob("<p>x</p>", "a.html", environment), /blocked/);
  assert.deepEqual(revoked, ["blob:test", "blob:test"]);
});

/* ---------------------------------------------------------------- dossier model export (20-38, D-52) */

const externalKey = portiaTextKey.virus(templateVirusId, "external");
const dangerDoc: RichTextDocument = { runs: [{ text: "Опасно", style: { color: "#B43632", fontWeight: 600 } }, { text: " для всех" }] };
const dangerText = "Опасно для всех";
const dangerDossier = (): TemplateDossier => editTemplateText(emptyTemplateDossier(), externalKey, dangerText, dangerDoc, (next, text) => { next.virus.external = text; });

// Width follows the font size, so a larger fragment is measurably wider.
const sizeMeasure = (text: string, font: string) => Array.from(text).length * Number(/(\d+)px/.exec(font)?.[1] ?? 16) * 0.5;
const pieceText = (line: { pieces: readonly { text: string }[] }) => line.pieces.map((piece) => piece.text).join("");

test("dossier HTML shows a styled fragment, an honest empty marker and a closed content policy", () => {
  const html = createTemplateDossierHtml(dangerDossier());
  assert.ok(html.includes(`<span style="color:#b43632;font-weight:600">Опасно</span>`));
  assert.ok(html.includes(" для всех"));
  assert.ok(html.includes(emptyTemplateText));
  assert.ok(html.includes("ВНЕШНИЕ ХАРАКТЕРИСТИКИ"));
  assert.ok(html.includes("default-src 'none'; style-src 'unsafe-inline'; img-src data:"));
  for (const forbidden of ["<script", "<link", "url(", "http:", "https:", "undefined"]) assert.ok(!html.includes(forbidden), forbidden);
});

test("dossier HTML escapes typed markup and refuses style values outside the allow-list", () => {
  const dossier = editTemplateText(
    emptyTemplateDossier(), externalKey, `<b onmouseover="x()">два</b>`,
    { runs: [{ text: `<b onmouseover="x()">два</b>`, style: { color: "#b43632;background:url(//evil.example/p)", fontSize: 9999, fontWeight: 450, backgroundColor: "red" } as never }] },
    (next, text) => { next.virus.external = text; },
  );
  dossier.virus.name = "<script>alert(1)</script>";
  const html = createTemplateDossierHtml(dossier);
  assert.ok(html.includes("&lt;b onmouseover=&quot;x()&quot;&gt;два&lt;/b&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.deepEqual([...html.matchAll(/ style="([^"]*)"/g)].map((match) => match[1]), ["font-size:48px"], "only the in-range size survives as a fragment style");
  for (const forbidden of ["<script", "<b ", "url(", "evil", "font-weight:450"]) assert.ok(!html.includes(forbidden), forbidden);
});

test("wrapping across fragments keeps every character, blank lines and the fragment fonts", () => {
  const measureTen = (text: string) => Array.from(text).length * 10;
  const lines = wrapTemplateRuns([{ text: "один два", style: { fontWeight: 700 } }, { text: " три\n\nчетыре" }], 90, measureTen);
  assert.deepEqual(lines.map(pieceText), ["один два", "три", "", "четыре"]);
  assert.ok(lines[0].pieces[0].font.includes(" 700 "));
  assert.ok(!lines[1].pieces[0].font.includes(" 700 "));
  assert.deepEqual(lines[2].pieces, []);
  assert.ok(lines.every((line) => line.height >= 25));
});

test("wrapping breaks an over-wide word by characters and never drops a visible character", () => {
  const long = "x".repeat(25);
  const lines = wrapTemplateRuns([{ text: long.slice(0, 10), style: { color: "#112233" } }, { text: long.slice(10) }], 100, (text) => Array.from(text).length * 10);
  assert.equal(lines.map(pieceText).join(""), long);
  for (const line of lines) assert.ok(line.pieces.reduce((total, piece) => total + piece.width, 0) <= 100);
  assert.ok(lines.length >= 3);
});

test("a larger fragment raises the line height and the width is measured with the fragment font", () => {
  const lines = wrapTemplateRuns([{ text: "мелко " }, { text: "крупно", style: { fontSize: 40 } }], 1000, sizeMeasure);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].height >= 40, `line height ${lines[0].height} grows with the biggest font`);
  const [small, big] = lines[0].pieces;
  assert.equal(small.width, sizeMeasure("мелко ", small.font));
  assert.equal(big.width, sizeMeasure("крупно", big.font));
  assert.ok(big.font.includes("40px"));
  const plain = wrapTemplateRuns([{ text: "мелко" }], 1000, sizeMeasure);
  assert.equal(plain[0].height, 25);
});

test("the dossier card layout draws a styled fragment in its colour and weight inside a 1000 px page", () => {
  const layout = layoutTemplateDossierCard(dangerDossier(), sizeMeasure);
  assert.equal(layout.width, pngWidth);
  assert.ok(layout.height <= pngMaxHeight);
  const texts = layout.ops.filter((op) => op.kind === "text");
  const danger = texts.find((op) => op.text === "Опасно");
  assert.ok(danger && danger.fill === "#b43632" && danger.font.includes(" 600 "), "styled fragment keeps colour and weight");
  const rest = texts.find((op) => op.text.includes("для всех"));
  assert.ok(rest && rest.fill === "#1b2523" && !rest.font.includes(" 600 "), "the rest keeps the body text style");
  assert.ok(danger.x < rest.x, "the second fragment follows the first on the same line");
  assert.equal(danger.y, rest.y);
  for (const op of layout.ops) {
    assert.ok(op.x >= 0 && op.y >= 0 && op.y <= layout.height, "every operation starts inside the canvas");
    if (op.kind !== "text") assert.ok(op.x + op.width <= layout.width && op.y + op.height <= layout.height);
  }
});

test("dossier PNG draws the styled fragment with its own fill and returns a png blob", async () => {
  const drawn: Array<{ text: string; fill: string; font: string }> = [];
  const environment: PngEnvironment = {
    createCanvas: (width, height) => {
      const context = {
        font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textBaseline: "",
        fillRect: () => {}, strokeRect: () => {}, drawImage: () => {},
        fillText(text: string) { drawn.push({ text, fill: this.fillStyle, font: this.font }); },
        measureText: (text: string) => ({ width: sizeMeasure(text, "16px x") }),
      };
      return { width, height, getContext: () => context, toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(["png-bytes"], { type: "image/png" })) };
    },
    loadImage: async () => ({ width: 1, height: 1 }),
  };
  const blob = await createTemplateDossierPng(dangerDossier(), environment);
  assert.equal(blob.type, "image/png");
  assert.ok(blob.size > 0);
  const danger = drawn.find((item) => item.text === "Опасно");
  assert.ok(danger && danger.fill === "#b43632" && danger.font.includes(" 600 "));
  assert.ok(drawn.some((item) => item.text.includes("для всех") && item.fill === "#1b2523"));
});

/* ---------------------------------------------------------------- all card sections (Task 2) */

const pngImage: TemplateImage = Object.freeze({ name: "a.png", mime: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=", width: 3000, height: 3000, bytes: 8 });
const jpegImage: TemplateImage = Object.freeze({ name: "b.jpg", mime: "image/jpeg", dataUrl: "data:image/jpeg;base64,/9j/4AAQ", width: 400, height: 200, bytes: 6 });

function fullDossier(): TemplateDossier {
  let dossier = emptyTemplateDossier();
  dossier = editTemplateVirus(dossier, (virus) => {
    virus.code = "VIR-77";
    virus.name = "Тестовый вирус";
    virus.status = "НАБЛЮДЕНИЕ";
    virus.classification.danger = "Протей";
    virus.classification.transmission = "Половой";
  });
  const set = (key: string, text: string, style: object | undefined, apply: (next: TemplateDossier, value: string) => void) => {
    dossier = editTemplateText(dossier, key, text, { runs: [{ text, ...(style ? { style } : {}) }] }, apply);
  };
  set(portiaTextKey.virus(templateVirusId, "external"), "Внешний вид", { color: "#b43632", fontWeight: 700 }, (next, text) => { next.virus.external = text; });
  set(portiaTextKey.virus(templateVirusId, "ppu-health"), "Здоровье 100", { backgroundColor: "#102030", backgroundOpacity: 0.5 }, (next, text) => { next.virus.ppu.health = text; });
  set(portiaTextKey.virus(templateVirusId, "ppu-speed"), "Скорость 3", undefined, (next, text) => { next.virus.ppu.speed = text; });
  set(portiaTextKey.virus(templateVirusId, "ppu-abilities"), "Способности ", { fontSize: 20 }, (next, text) => { next.virus.ppu.abilities = text; });
  set(portiaTextKey.virus(templateVirusId, "physiology"), "Физиология", { color: "#2e6f64" }, (next, text) => { next.virus.physiology = text; });
  dossier = addTemplateMutation(addTemplateMutation(dossier));
  dossier = editTemplateVirus(dossier, (virus) => { virus.mutations[0].name = "Первая мутация"; });
  set(portiaTextKey.mutation(templateVirusId, 0), "Описание первой", { color: "#112233" }, (next, text) => { next.virus.mutations[0].description = text; });
  dossier = setTemplateImage(dossier, "infected", pngImage);
  dossier = setTemplateImage(dossier, 0, jpegImage);
  return dossier;
}

test("dossier HTML has sections 01-05 in order with the site's labels and no scientist records", () => {
  const html = createTemplateDossierHtml(fullDossier());
  const positions = ["01 КЛАССИФИКАЦИЯ", "02 ВНЕШНИЕ ХАРАКТЕРИСТИКИ", "03 ХАРАКТЕРИСТИКИ С PPU", "04 ФИЗИОЛОГИЯ", "05 МУТАЦИИ ВИРУСА"].map((title) => html.indexOf(title));
  assert.ok(positions.every((position) => position >= 0), "every section is present");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "sections keep the site's order");
  for (const label of ["Общий уровень опасности", "Распространение", "Угроза и риск побега", "Способ распространения", "Разум", "Вид / внешность", "Поведение", "ЗДОРОВЬЕ", "СКОРОСТЬ", "СПОСОБНОСТИ", "M-01", "M-02", "Первая мутация", "Протей", "Половой"]) {
    assert.ok(html.includes(escapeTemplateHtml(label)), label);
  }
  assert.ok(html.includes("УРОВЕНЬ 2"), "Протей is level 2");
  assert.ok(!html.includes("ЗАПИСИ УЧЁНЫХ"));
  assert.ok(!/LOG-\d/.test(html));
  assert.ok(html.includes(`<span style="color:#112233">Описание первой</span>`));
  assert.ok(html.includes(`style="background-color:rgba(16,32,48,0.5)"`));
  assert.ok(html.includes(`style="font-size:20px"`));
  assert.ok(html.includes(emptyTemplateText), "the second mutation has no name or description");
});

test("dossier HTML embeds exactly the filled image slots and never reads an address from the record", () => {
  const dossier = fullDossier();
  dossier.virus.infectedImage = "https://evil.example/a.png";
  dossier.virus.mutations[1].image = "https://evil.example/m.png";
  const html = createTemplateDossierHtml(dossier);
  assert.equal((html.match(/<img/g) ?? []).length, 2);
  assert.ok(html.includes(`src="${pngImage.dataUrl}"`) && html.includes(`src="${jpegImage.dataUrl}"`));
  assert.ok(!html.includes("evil.example"));
  assert.equal((createTemplateDossierHtml(emptyTemplateDossier()).match(/<img/g) ?? []).length, 0);
});

/** One check over a finished export document: the closed content policy of D-23/D-24. */
function exportViolations(html: string) {
  const found: string[] = [];
  if (/https?:/i.test(html)) found.push("external address");
  if (/<script/i.test(html)) found.push("script");
  if (/<link/i.test(html)) found.push("link");
  if (/url\(/i.test(html)) found.push("css url");
  if (/<[^>]*\son[a-z]+\s*=/i.test(html)) found.push("event handler");
  if (html.includes("ЗАПИСИ УЧЁНЫХ")) found.push("scientist records section");
  for (const image of html.match(/<img[^>]*>/gi) ?? []) {
    if (!/^<img src="data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}"/.test(image)) found.push(`image outside data:image/png|jpeg|webp: ${image.slice(0, 40)}`);
  }
  return found;
}

function hostileDossier(): TemplateDossier {
  const dossier = emptyTemplateDossier();
  dossier.virus.name = `<img src=x onerror="a()">`;
  dossier.virus.code = `"><script>alert(1)</script>`;
  dossier.virus.external = `<link rel=stylesheet href=//evil.example/x.css>`;
  dossier.virus.classification.danger = `<script>x</script>`;
  dossier.virus.infectedImage = "https://evil.example/a.png";
  dossier.virus.mutations.push({ name: `<b onmouseover="x()">`, description: `<script>y</script>`, image: "https://evil.example/m.png" });
  dossier.virus.scientistLogs.push({ id: "log-1", title: "ЗАПИСИ УЧЁНЫХ", scientist: "X", lockedLevel: 1, content: ["секрет"] });
  dossier.images.infected = { ...pngImage, dataUrl: "https://evil.example/x.png" };
  dossier.images.mutations = [{ ...jpegImage, dataUrl: `data:image/jpeg;base64,AAAA" onerror="x` }];
  dossier.formattedText[portiaTextKey.virus(templateVirusId, "external")] = {
    runs: [{ text: dossier.virus.external, style: { color: "#b43632;background:url(//evil.example/p)", fontSize: 9999 } as never }],
  };
  return dossier;
}

test("the export stays inside the closed policy: no address, script, link, url(), handler, foreign image or scientist section", () => {
  const subject = process.env.GSD_PROHIB_SUBJECT;
  const html = subject ? readFileSync(path.resolve(process.cwd(), subject), "utf8") : createTemplateDossierHtml(hostileDossier());
  assert.deepEqual(exportViolations(html), []);
  if (!subject) {
    assert.deepEqual(exportViolations(createTemplateDossierHtml(fullDossier())), []);
    assert.deepEqual(exportViolations(createTemplateDossierHtml(emptyTemplateDossier())), []);
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "typed markup is escaped, not dropped");
  }
});

test("the closed-policy check recognises a violating document (check self-check)", () => {
  const found = exportViolations(`<body onload="a()"><img src="https://x.example/a.png"><section>ЗАПИСИ УЧЁНЫХ</section><script>1</script><link href=a><i style="background:url(a)"></i></body>`);
  for (const expected of ["external address", "script", "link", "css url", "event handler", "scientist records section"]) assert.ok(found.includes(expected), expected);
  assert.ok(found.some((entry) => entry.startsWith("image outside")));
});

type DrawnText = { text: string; fill: string; font: string };

function recordingPngEnvironment(options: { measureOf?: (text: string) => number } = {}) {
  const texts: DrawnText[] = [];
  const rects: Array<{ x: number; y: number; width: number; height: number; fill: string }> = [];
  const images: Array<{ x: number; y: number; width: number; height: number }> = [];
  const loaded: string[] = [];
  const environment: PngEnvironment = {
    createCanvas: (width, height) => {
      const context = {
        font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textBaseline: "",
        fillRect(x: number, y: number, rectWidth: number, rectHeight: number) { rects.push({ x, y, width: rectWidth, height: rectHeight, fill: this.fillStyle }); },
        strokeRect: () => {},
        fillText(text: string) { texts.push({ text, fill: this.fillStyle, font: this.font }); },
        drawImage: (_image: never, x: number, y: number, imageWidth: number, imageHeight: number) => { images.push({ x, y, width: imageWidth, height: imageHeight }); },
        measureText: (text: string) => ({ width: (options.measureOf ?? ((value: string) => Array.from(value).length * 8))(text) }),
      };
      return { width, height, getContext: () => context, toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(["png-bytes"], { type: "image/png" })) };
    },
    loadImage: async (src) => { loaded.push(src); return { width: 100, height: 100 }; },
  };
  return { environment, texts, rects, images, loaded };
}

test("dossier PNG draws every visible character, the fragment background, bounded images and only slot data URLs", async () => {
  const dossier = fullDossier();
  const fake = recordingPngEnvironment();
  const blob = await createTemplateDossierPng(dossier, fake.environment);
  assert.ok(blob.size > 0);
  const drawn = fake.texts.map((item) => item.text).join("");
  const visible = (value: string) => Array.from(value.replace(/\s/g, ""));
  for (const field of ["VIR-77", "Тестовый вирус", "НАБЛЮДЕНИЕ", "Внешний вид", "Здоровье 100", "Скорость 3", "Способности", "Физиология", "Первая мутация", "Описание первой", "Протей", "Половой", "УРОВЕНЬ 2", "M-01", "M-02", "КЛАССИФИКАЦИЯ", "МУТАЦИИ ВИРУСА"]) {
    for (const character of visible(field)) assert.ok(drawn.includes(character), `${character} of ${field}`);
    assert.ok(drawn.replace(/\s/g, "").includes(field.replace(/\s/g, "")), field);
  }
  assert.ok(!drawn.includes("ЗАПИСИ УЧЁНЫХ"));
  assert.ok(fake.rects.some((rect) => rect.fill === "rgba(16,32,48,0.5)"), "the fragment with a background gets a rectangle");
  assert.equal(fake.images.length, 2);
  for (const image of fake.images) assert.ok(image.width <= pngWidth && image.height <= 520 && image.width >= 1);
  assert.deepEqual([...fake.loaded].sort(), [jpegImage.dataUrl, pngImage.dataUrl].sort());
  assert.ok(fake.texts.some((item) => item.text === "Внешний вид" && item.fill === "#b43632" && item.font.includes(" 700 ")));
});

test("dossier PNG never loads an address that was written around the edit functions", async () => {
  const fake = recordingPngEnvironment();
  await createTemplateDossierPng(hostileDossier(), fake.environment);
  assert.deepEqual(fake.loaded, []);
  assert.deepEqual(fake.images, []);
});

test("a dossier card taller than the canvas limit is refused instead of cropped", async () => {
  const tall = emptyTemplateDossier();
  tall.virus.external = "a\n".repeat(1999);
  tall.virus.physiology = "a\n".repeat(1999);
  assert.throws(() => layoutTemplateDossierCard(tall, measure), (error) => isTemplatePngTooLargeError(error));
  const fake = recordingPngEnvironment();
  await assert.rejects(createTemplateDossierPng(tall, fake.environment), (error) => isTemplatePngTooLargeError(error));
  assert.deepEqual(fake.texts, []);
});

test("the dossier layout keeps every operation inside the page and scales images into the page width", () => {
  const layout = layoutTemplateDossierCard(fullDossier(), sizeMeasure);
  assert.equal(layout.width, pngWidth);
  assert.ok(layout.height <= pngMaxHeight);
  const images = layout.ops.filter((op) => op.kind === "image");
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.ok(image.kind === "image" && image.width <= pngWidth - pngPadding * 2 && image.height <= 520 && image.slot !== undefined);
    assert.equal(image.x, pngPadding);
  }
  for (const op of layout.ops) {
    assert.ok(op.x >= 0 && op.y >= 0 && op.y <= layout.height);
    if (op.kind !== "text") assert.ok(op.x + op.width <= layout.width && op.y + op.height <= layout.height);
  }
});

/* ---------------------------------------------------------------- failure and network behaviour of the dossier PNG (20-39) */

test("dossier PNG fails loudly when the encoder or canvas misbehaves", async () => {
  const dossier = dangerDossier();
  await assert.rejects(createTemplateDossierPng(dossier, fakePngEnvironment({ toBlob: "null" }).environment), /PNG encoding failed/);
  await assert.rejects(createTemplateDossierPng(dossier, fakePngEnvironment({ toBlob: "empty" }).environment), /PNG encoding failed/);
  await assert.rejects(createTemplateDossierPng(dossier, fakePngEnvironment({ toBlob: "throw" }).environment), /SecurityError/);
  await assert.rejects(createTemplateDossierPng(dossier, fakePngEnvironment({ contextNull: true }).environment), /canvas/);
  const long = "a\n".repeat(1999);
  const tooLongDossier = editTemplateText(dossier, portiaTextKey.virus(templateVirusId, "physiology"), long, { runs: [{ text: long }] }, (next, text) => { next.virus.physiology = text; });
  const tooLong = fakePngEnvironment();
  await assert.rejects(createTemplateDossierPng(tooLongDossier, tooLong.environment), (error) => isTemplatePngTooLargeError(error));
  assert.equal(tooLong.calls.length, 0, "an over-long card draws nothing and encodes nothing");
});

test("the dossier exports and the image check never touch the network", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests += 1; throw new Error("network is off"); }) as typeof fetch;
  try {
    await createTemplateDossierPng(dangerDossier(), fakePngEnvironment().environment);
    await decodeLocalTemplateImage(fileOf(pngSignature, "image/png"), { loadImage: okImage() });
    createTemplateDossierHtml(dangerDossier());
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(requests, 0);
});
