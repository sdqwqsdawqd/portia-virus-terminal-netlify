import assert from "node:assert/strict";
import test from "node:test";
import { portiaTextKey, type RichTextDocument } from "./portia-content.ts";
import { editTemplateText, emptyTemplateDossier, templateVirusId, type TemplateDossier } from "./portia-template-dossier.ts";
import {
  createStandaloneHtml,
  createTemplateDossierHtml,
  createTemplateDossierPng,
  createTemplatePng,
  decodeLocalTemplateImage,
  downloadTemplateBlob,
  emptyTemplateDraft,
  emptyTemplateText,
  escapeTemplateHtml,
  hasTemplateContent,
  hasTemplateText,
  imageSizeWithinBounds,
  isTemplateImageError,
  isTemplatePngTooLargeError,
  layoutTemplateCard,
  layoutTemplateDossierCard,
  pngMaxHeight,
  pngPadding,
  pngWidth,
  sniffImageMime,
  templateImageMaxBytes,
  templateSnapshotKey,
  wrapTemplateRuns,
  wrapTemplateText,
  type LocalImageFile,
  type PngEnvironment,
  type TemplateDraft,
  type TemplateImage,
} from "./portia-template-export.ts";

const withText = (patch: Partial<Record<keyof TemplateDraft, string>>): TemplateDraft => ({ ...emptyTemplateDraft(), ...patch });

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpegSignature = [0xff, 0xd8, 0xff, 0xe0];
const webpSignature = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function fileOf(bytes: readonly number[], type: string, name = "photo.png", sizeOverride?: number): LocalImageFile {
  const data = Uint8Array.from(bytes);
  return { name, type, size: sizeOverride ?? data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
}

const okImage = (width = 40, height = 20) => async () => ({ width, height });

const sampleImage: TemplateImage = Object.freeze({
  name: "photo.png", mime: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=", width: 800, height: 400, bytes: 8,
});

// 10 px per character keeps the fake measurement deterministic.
const measure = (text: string) => Array.from(text).length * 10;

test("escapeTemplateHtml neutralises markup and quotes", () => {
  assert.equal(escapeTemplateHtml(`<img src=x onerror="a()"> & 'b'`), "&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;");
});

test("standalone HTML escapes typed text and carries no script, link or external request", () => {
  const html = createStandaloneHtml(withText({
    name: `<script>alert(1)</script>`,
    external: `Line 1\n<b onmouseover="x()">два</b>`,
    mutationName: `"><img src=//evil.example/p.png>`,
  }));
  assert.ok(!/<script/i.test(html));
  assert.ok(!/<img/i.test(html));
  assert.ok(!/<b /i.test(html));
  assert.ok(!/<link/i.test(html));
  assert.ok(!/<[^>]*[ "'](?:src|href)=/i.test(html));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("default-src 'none'"));
});

test("a partial draft shows empty fields honestly instead of inventing values", () => {
  const html = createStandaloneHtml(withText({ name: "Вирус А" }));
  assert.ok(html.includes("Вирус А"));
  assert.ok(html.includes(emptyTemplateText));
  assert.ok(!html.includes("undefined"));
});

test("an empty draft has no text and is not exportable", () => {
  assert.equal(hasTemplateText(emptyTemplateDraft()), false);
  assert.equal(hasTemplateText(withText({ physiology: "   " })), false);
  assert.equal(hasTemplateText(withText({ physiology: "x" })), true);
  assert.equal(hasTemplateContent(emptyTemplateDraft(), null), false);
  assert.equal(hasTemplateContent(emptyTemplateDraft(), sampleImage), true);
});

test("the snapshot key changes with any edit or image so a stale download is not counted as saved", () => {
  const a = withText({ name: "A" });
  assert.equal(templateSnapshotKey(a), templateSnapshotKey({ ...a }));
  assert.notEqual(templateSnapshotKey(a), templateSnapshotKey({ ...a, name: "AB" }));
  assert.notEqual(templateSnapshotKey(a), templateSnapshotKey(a, sampleImage));
  assert.notEqual(templateSnapshotKey(a, sampleImage), templateSnapshotKey(a, { ...sampleImage, dataUrl: "data:image/png;base64,AAAAAAAAAAAA", bytes: 9 }));
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

test("standalone HTML embeds a local image as a data URL and names no external resource", () => {
  const html = createStandaloneHtml(withText({ name: "С картинкой" }), sampleImage);
  assert.ok(html.includes(`<img src="${sampleImage.dataUrl}"`));
  assert.equal((html.match(/<img/g) ?? []).length, 1);
  assert.ok(!/(?:src|href)=["']?(?:https?:)?\/\//i.test(html));
  assert.ok(!/url\(/i.test(html));
  assert.ok(!/<script|<link/i.test(html));
  assert.ok(html.includes("img-src data:"));
  assert.ok(html.includes("С картинкой"));
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

test("the layout draws all long text, scales the image into the page and stays inside the bounded height", () => {
  const paragraph = Array.from({ length: 60 }, (_, index) => `слово${index}`).join(" ");
  const draft = withText({ name: "Длинный", external: paragraph, physiology: paragraph });
  const layout = layoutTemplateCard(draft, { width: 3000, height: 3000 }, measure);
  assert.equal(layout.width, pngWidth);
  assert.ok(layout.height > 400 && layout.height <= pngMaxHeight);
  const drawn = layout.ops.flatMap((op) => (op.kind === "text" ? [op.text] : [])).join(" ");
  for (let index = 0; index < 60; index += 1) assert.ok(drawn.includes(`слово${index}`), `слово${index} is drawn`);
  const image = layout.ops.find((op) => op.kind === "image");
  assert.ok(image && image.kind === "image");
  assert.ok(image.width <= pngWidth - pngPadding * 2 && image.height <= 520);
  assert.equal(image.x, pngPadding);
  for (const op of layout.ops) assert.ok(op.y >= 0 && op.y <= layout.height, "every operation sits inside the canvas");
});

test("a card taller than the canvas limit is refused instead of cropped", () => {
  const draft = withText({ external: "a\n".repeat(1999), physiology: "a\n".repeat(1999) });
  assert.throws(() => layoutTemplateCard(draft, null, measure), (error) => isTemplatePngTooLargeError(error));
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

test("PNG export draws the image from its data URL and every text line, then returns a non-empty png blob", async () => {
  const fake = fakePngEnvironment();
  const draft = withText({ name: "Вирус", physiology: "alpha beta\ngamma" });
  const blob = await createTemplatePng(draft, sampleImage, fake.environment);
  assert.equal(blob.type, "image/png");
  assert.ok(blob.size > 0);
  assert.deepEqual(fake.loadedSources, [sampleImage.dataUrl]);
  assert.equal(fake.calls.filter((call) => call.name === "drawImage").length, 1);
  const lines = fake.calls.filter((call) => call.name === "fillText").map((call) => String(call.args[0]));
  for (const expected of ["Вирус", "alpha beta", "gamma", emptyTemplateText]) assert.ok(lines.includes(expected), `${expected} is drawn`);
  const [, finalSize] = fake.sizes;
  assert.equal(finalSize[0], pngWidth);
  assert.ok(finalSize[1] <= pngMaxHeight);
});

test("PNG export fails loudly when the encoder or canvas misbehaves", async () => {
  const draft = withText({ name: "Вирус" });
  await assert.rejects(createTemplatePng(draft, null, fakePngEnvironment({ toBlob: "null" }).environment), /PNG encoding failed/);
  await assert.rejects(createTemplatePng(draft, null, fakePngEnvironment({ toBlob: "empty" }).environment), /PNG encoding failed/);
  await assert.rejects(createTemplatePng(draft, null, fakePngEnvironment({ toBlob: "throw" }).environment), /SecurityError/);
  await assert.rejects(createTemplatePng(draft, null, fakePngEnvironment({ contextNull: true }).environment), /canvas/);
  const tooLong = fakePngEnvironment();
  await assert.rejects(
    createTemplatePng(withText({ external: "a\n".repeat(1999), physiology: "a\n".repeat(1999) }), null, tooLong.environment),
    (error) => isTemplatePngTooLargeError(error),
  );
  assert.equal(tooLong.calls.length, 0, "an over-long card draws nothing and encodes nothing");
});

test("PNG export never touches the network", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests += 1; throw new Error("network is off"); }) as typeof fetch;
  try {
    await createTemplatePng(withText({ name: "A" }), sampleImage, fakePngEnvironment().environment);
    await decodeLocalTemplateImage(fileOf(pngSignature, "image/png"), { loadImage: okImage() });
    createStandaloneHtml(withText({ name: "A" }), sampleImage);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(requests, 0);
});

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
  let dossier = editTemplateText(
    emptyTemplateDossier(), externalKey, `<b onmouseover="x()">два</b>`,
    { runs: [{ text: `<b onmouseover="x()">два</b>`, style: { color: "#b43632;background:url(//evil.example/p)", fontSize: 9999, fontWeight: 450, backgroundColor: "red" } as never }] },
    (next, text) => { next.virus.external = text; },
  );
  dossier = editTemplateText(dossier, portiaTextKey.virus(templateVirusId, "physiology"), "<script>alert(1)</script>", { runs: [{ text: "<script>alert(1)</script>" }] }, (next, text) => { next.virus.physiology = text; });
  const html = createTemplateDossierHtml(dossier);
  assert.ok(html.includes("&lt;b onmouseover=&quot;x()&quot;&gt;два&lt;/b&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes(`style="font-size:48px"`), "only the in-range size survives");
  for (const forbidden of ["<script", "<b ", "url(", "evil", "background:", "font-weight:450", "red"]) assert.ok(!html.includes(forbidden), forbidden);
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
