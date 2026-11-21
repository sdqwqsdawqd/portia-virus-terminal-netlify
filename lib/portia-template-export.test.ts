import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertTemplateExportClean,
  decodeLocalTemplateImage,
  downloadTemplateBlob,
  escapeTemplateHtml,
  imageSizeWithinBounds,
  isTemplateExportError,
  isTemplateImageError,
  isTemplatePngTooLargeError,
  neutralizeTemplateText,
  pngMaxHeight,
  renderTemplateCardPng,
  sniffImageMime,
  templateCardCss,
  templateCardDocument,
  templateCardSvg,
  templateCardVariableNames,
  templateCardWidth,
  templateDownloadName,
  templateExportViolations,
  templateImageMaxBytes,
  type LocalImageFile,
  type PngEnvironment,
  type TemplateCssRule,
} from "./portia-template-export.ts";

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpegSignature = [0xff, 0xd8, 0xff, 0xe0];
const webpSignature = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function fileOf(bytes: readonly number[], type: string, name = "photo.png", sizeOverride?: number): LocalImageFile {
  const data = Uint8Array.from(bytes);
  return { name, type, size: sizeOverride ?? data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
}

const okImage = (width = 40, height = 20) => async () => ({ width, height });

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

// D-61 (20-49): Firefox and WebKit throw a TypeError when a Window function (setTimeout) is called as a method of another object.
// After `anchor.click()` the file is already with the browser, so nothing that follows may throw out of the download.
function strictWindowFunction<T extends (...args: never[]) => unknown>(body: T): T {
  return function strictThis(this: unknown, ...args: Parameters<T>) {
    if (this !== undefined && this !== globalThis) throw new TypeError("'setTimeout' called on an object that does not implement interface Window.");
    return body(...args);
  } as unknown as T;
}

test("D-61 a download does not throw after the file was handed over, even if a Window function is called with a foreign this", () => {
  const revoked: string[] = [];
  const timers: Array<() => void> = [];
  let clicks = 0;
  let removed = 0;
  const anchor = { href: "", download: "", rel: "", style: { display: "" }, click: () => { clicks += 1; }, remove: () => { removed += 1; } };
  const environment = {
    document: { createElement: () => anchor, body: { append: () => {} } } as unknown as Document,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL: (url: string) => { revoked.push(url); } } as unknown as typeof URL,
    setTimeout: strictWindowFunction(((callback: () => void) => { timers.push(callback); return 0; }) as unknown as typeof setTimeout),
  };
  assert.doesNotThrow(() => downloadTemplateBlob("<p>x</p>", "a.html", environment));
  assert.equal(clicks, 1, "the file was handed to the browser");
  assert.equal(removed, 1, "the anchor is removed");
  assert.equal(revoked.length + timers.length >= 1, true, "the link is revoked now or scheduled");
  for (const timer of timers) timer();
  assert.deepEqual(revoked, ["blob:test"], "the object URL is released exactly once");

  // A timer that is not there at all, or one that throws for any other reason, still must not turn a handed-over file into an error.
  const noTimer = { ...environment, setTimeout: (() => { throw new Error("no timers"); }) as unknown as typeof setTimeout };
  revoked.length = 0;
  assert.doesNotThrow(() => downloadTemplateBlob("<p>x</p>", "b.html", noTimer));
  assert.deepEqual(revoked, ["blob:test"], "without a timer the link is revoked at once");

  // Cleanup that fails after the click (the anchor cannot be removed) does not undo the hand-over either.
  const stuckAnchor = { ...anchor, remove: () => { throw new Error("detached"); } };
  const stuck = { ...environment, document: { createElement: () => stuckAnchor, body: { append: () => {} } } as unknown as Document };
  assert.doesNotThrow(() => downloadTemplateBlob("<p>x</p>", "c.html", stuck));
});

/* ---------------------------------------------------------------- D-55 (20-44): the file is the archive card */

// The rules a browser reports for the site's style sheets: a selector, the declaration block and the @media / @container wrapper.
const siteRules: TemplateCssRule[] = [
  { selector: ".record-view", declarations: "min-width: 0; overflow-y: auto; color: var(--ink); background: var(--paper)" },
  { selector: ".class-cell.level-3 strong, .class-cell.level-3 small", declarations: "color: #b43632" },
  { selector: ".class-cell span", declarations: "min-height: 2.6em; font: 11px var(--sans); text-transform: uppercase" },
  { selector: ".class-cell", declarations: "background: url(/x.png); color: red; border: 1px solid var(--line)" },
  { selector: ".section-kicker::after", declarations: "content: \"\"; flex: 1; height: 1px; background: #c9c4b7" },
  { selector: ".record-body", declarations: "animation: fade-in 200ms ease-out; color: var(--ink)" },
  { selector: ".record-hero", declarations: "grid-template-columns: 1fr", wrapper: "@container (max-width: 840px)" },
  { selector: ".record-header", declarations: "position: relative; display: block", wrapper: "@media (max-width: 900px)" },
  // Everything below belongs to the site, not to the card, and must not reach the file.
  { selector: ".desktop", declarations: "color: red" },
  { selector: "body", declarations: "margin: 0" },
  { selector: "html[data-motion] .portia-image img", declarations: "transition: opacity 1s" },
  { selector: ".app-window .record-view", declarations: "color: blue" },
  { selector: ".record-view, .desktop", declarations: "color: green" },
  { selector: ".record-view:hover", declarations: "color: teal" },
  { selector: "[data-area] .record-view", declarations: "color: teal" },
  { selector: "#desktop .record-view", declarations: "color: teal" },
  { selector: ".content-fade", declarations: "animation: fade-in 200ms" },
  { selector: "@font-face", declarations: "font-family: x; src: url(https://fonts.example/a.woff2)" },
  { selector: "@import url(https://fonts.example/a.css)", declarations: "x: 1" },
  { selector: ".record-header", declarations: "display: none", wrapper: "@media url(https://evil.example/a)" },
  { selector: ".record-header", declarations: "display: none", wrapper: "@keyframes spin" },
  { selector: ".record-footer", declarations: "background: image-set(\"a.png\" 1x); border-top: 1px solid #c4beb0; color: expression(alert(1))" },
  { selector: ".record-code", declarations: "content: \"</style><script>alert(1)</script>\"; color: red" },
  { selector: ".record-code", declarations: "background: url(data:image/png;base64,AAAA)" },
];

const variables = {
  "--ink": "oklch(0.238 calc(0.013 * 1) 180.4)",
  "--paper": "#f3f0e6",
  "--line": "oklch(0.33 0.027 180.4)",
  "--sans": "\"IBM Plex Mono\", \"IBM Plex Mono Fallback\", Consolas, monospace",
};

test("templateCardCss keeps only the card's rules, in their @media / @container wrapper, and starts with :root", () => {
  const css = templateCardCss(siteRules, variables);
  assert.ok(css.startsWith(":root{"), css.slice(0, 40));
  assert.ok(css.includes(".record-view{min-width:0;overflow-y:auto;color:var(--ink);background:var(--paper)}"));
  assert.ok(css.includes(".class-cell.level-3 strong,.class-cell.level-3 small{color:#b43632}"));
  assert.ok(css.includes(".class-cell span{min-height:2.6em;font:11px var(--sans);text-transform:uppercase}"));
  assert.ok(css.includes(".section-kicker::after{content:\"\";flex:1;height:1px;background:#c9c4b7}"));
  assert.ok(css.includes("@container (max-width: 840px){.record-hero{grid-template-columns:1fr}}"));
  assert.ok(css.includes("@media (max-width: 900px){.record-header{position:relative;display:block}}"));
  assert.ok(css.includes(".record-footer{border-top:1px solid #c4beb0}"), "a declaration with image-set() or expression() is dropped, the rest stays");
});

test("templateCardCss drops foreign selectors, fonts, imports, url() declarations and animations", () => {
  const css = templateCardCss(siteRules, variables);
  for (const forbidden of ["url(", "http", "@font-face", "@import", ".desktop", "[data-area]", "#desktop", "html", ":hover", ".app-window", ".content-fade", "animation", "image-set", "expression", "</style", "<script", "@keyframes"]) {
    assert.ok(!css.includes(forbidden), forbidden);
  }
  assert.ok(css.includes(".class-cell{color:red;border:1px solid var(--line)}"), "the url() declaration goes, the other two stay");
  assert.ok(!css.includes("fade-in"));
  assert.ok(!/(^|[{},\s])body\s*\{/.test(css), "no rule for the site body");
  assert.ok(!css.includes("color:green") && !css.includes("color:blue") && !css.includes("color:teal"), "a rule with any foreign selector is dropped whole");
});

test("templateCardCss writes only the variables it is given, and only safe ones", () => {
  const css = templateCardCss([{ selector: ".record-view", declarations: "color: var(--ink)" }], {
    ...variables,
    "--evil": "url(https://evil.example/p)",
    "--break": "red;}body{display:none",
    "--brace": "{}",
    "bad name": "1",
    "--empty": "   ",
  });
  const root = /^:root\{([^}]*)\}/.exec(css);
  assert.ok(root, "starts with a :root block");
  const names = root[1].split(";").map((entry) => entry.split(":")[0]).filter(Boolean).sort();
  assert.deepEqual(names, ["--ink", "--line", "--paper", "--sans"]);
  assert.ok(!css.includes("evil") && !css.includes("display:none"));
  assert.ok(templateCardCss([], {}).startsWith(":root{}"));
});

test("templateCardVariableNames lists the variables the kept rules use", () => {
  assert.deepEqual(templateCardVariableNames(siteRules), ["--ink", "--line", "--paper", "--sans"]);
  assert.deepEqual(templateCardVariableNames([{ selector: ".desktop", declarations: "color: var(--secret)" }]), []);
});

const cleanMarkup = `<article class="record-view template-card-preview"><span class="formatted-content"><span style="color: rgb(180, 54, 50);">Опасно</span></span><img src="data:image/png;base64,iVBORw0KGgo=" alt="Фото" width="64" height="32"></article>`;

test("templateCardDocument is a closed single-file page with the card's CSS and an escaped title", () => {
  const css = templateCardCss(siteRules, variables);
  const html = templateCardDocument(cleanMarkup, css, `Вирус <b>"A"</b>`);
  assert.ok(html.startsWith("<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\">"));
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`));
  assert.ok(html.includes("<title>Вирус &lt;b&gt;&quot;A&quot;&lt;/b&gt;</title>"));
  assert.equal((html.match(/<style>/g) ?? []).length, 1);
  assert.ok(html.includes(`<body class="template-export">${cleanMarkup}</body>`));
  assert.ok(html.includes(css));
  assert.deepEqual(templateExportViolations(html), []);
});

test("templateCardSvg wraps the same markup in a foreignObject and allows only the two namespace addresses", () => {
  const css = templateCardCss(siteRules, variables);
  const xhtml = `<article xmlns="http://www.w3.org/1999/xhtml" class="record-view"><svg xmlns="http://www.w3.org/2000/svg" class="class-badge"><path d="M1 1"/></svg><img src="data:image/png;base64,iVBORw0KGgo=" alt="x"/></article>`;
  const svg = templateCardSvg(xhtml, css, templateCardWidth, 1234.2);
  assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="1235" viewBox="0 0 1060 1235">`));
  assert.ok(svg.includes(`<foreignObject x="0" y="0" width="1060" height="1235"><div xmlns="http://www.w3.org/1999/xhtml" class="template-export"><style>`));
  assert.ok(svg.includes(xhtml));
  assert.deepEqual(templateExportViolations(svg, "svg"), []);
  assert.ok(templateExportViolations(svg, "html").includes("external address"), "in a file the same namespace text is an address");
  assert.ok(templateExportViolations(svg.replace("http://www.w3.org/1999/xhtml", "http://evil.example/x"), "svg").includes("external address"));
  assert.ok(templateExportViolations(svg.replace("<path", `<image href="https://evil.example/a.png"/><path`), "svg").length > 0);
});

test("a typed address or url( in the card text stays visible but is not an address in the file", () => {
  const typed = `<p>see https://typed.example/a and HTTP://x.example and url(not-css)</p>`;
  assert.equal(neutralizeTemplateText(typed), `<p>see https&#58;//typed.example/a and HTTP&#58;//x.example and url&#40;not-css)</p>`);
  assert.equal(neutralizeTemplateText(`<a href="https://evil.example/">t</a>`), `<a href="https://evil.example/">t</a>`, "an attribute is never rewritten");
  const html = templateCardDocument(`<article class="record-view">${typed}</article>`, templateCardCss([], {}), "https://title.example");
  assert.deepEqual(templateExportViolations(html), []);
  assert.ok(html.includes("<title>https&#58;//title.example</title>"));
  const svg = templateCardSvg(`<article xmlns="http://www.w3.org/1999/xhtml">${typed}</article>`, templateCardCss([], {}), templateCardWidth, 200);
  assert.deepEqual(templateExportViolations(svg, "svg"), []);
});

/** The closed content policy of D-23/D-24 over a finished file, with the same list of rules as before. */
test("the policy names every kind of violation (check self-check)", () => {
  const found = templateExportViolations(`<body onload="a()"><img src="https://x.example/a.png"><section>ЗАПИСИ УЧЁНЫХ</section><script>1</script><link href=a><i style="background:url(a)"></i><a href="//evil.example">x</a><iframe src="a"></iframe></body>`);
  for (const expected of ["external address", "script", "link", "css url", "event handler", "scientist records section", "reference attribute", "embedded content"]) assert.ok(found.includes(expected), expected);
  assert.ok(found.some((entry) => entry.startsWith("image outside")));
  for (const image of [`<img src="data:image/svg+xml;base64,AAAA">`, `<img src="data:image/png;base64,AAAA" srcset="a 1x">`, `<img alt="x">`, `<img src=x>`, `<img src="data:image/png;base64,AA AA">`]) {
    assert.ok(templateExportViolations(image).some((entry) => entry.startsWith("image outside")), image);
  }
  for (const image of [`<img src="data:image/png;base64,iVBORw0KGgo=" alt="x" width="4" height="2">`, `<img src="data:image/jpeg;base64,/9j/4AAQ"/>`, `<img src="data:image/webp;base64,AAAA==" alt="">`]) {
    assert.deepEqual(templateExportViolations(image), [], image);
  }
});

function hostileDocument() {
  const css = templateCardCss([
    { selector: ".record-view", declarations: "background: url(https://evil.example/p); color: red" },
    { selector: "@font-face", declarations: "src: url(https://evil.example/f.woff2)" },
  ], { "--paper": "#fff", "--evil": "url(https://evil.example/v)" });
  const markup = `<article class="record-view"><img src="https://evil.example/a.png" alt="x"><script>alert(1)</script><link rel="stylesheet" href="//evil.example/x.css"><p onclick="a()">ЗАПИСИ УЧЁНЫХ</p><span>https://typed.example/text url(x) &lt;script&gt;</span></article>`;
  return { css, html: templateCardDocument(markup, css, `"><script>alert(1)</script>`) };
}

test("the export stays inside the closed policy: no address, script, link, url(), handler, foreign image or scientist section", () => {
  const subject = process.env.GSD_PROHIB_SUBJECT;
  if (subject) {
    assert.deepEqual(templateExportViolations(readFileSync(path.resolve(process.cwd(), subject), "utf8")), []);
    return;
  }
  const { css, html } = hostileDocument();
  assert.ok(!/url\(|https?:|@font-face/i.test(css), "the CSS carries nothing that loads");
  const found = templateExportViolations(html);
  for (const expected of ["script", "link", "event handler", "scientist records section", "external address", "reference attribute"]) assert.ok(found.includes(expected), expected);
  assert.ok(found.some((entry) => entry.startsWith("image outside")));
  assert.ok(!html.includes("<title>\"><script>"), "the title is escaped");
  assert.throws(() => assertTemplateExportClean(html, "html"), (error) => isTemplateExportError(error) && /Не удалось подготовить файл/.test((error as Error).message));
  assert.doesNotThrow(() => assertTemplateExportClean(templateCardDocument(cleanMarkup, templateCardCss(siteRules, variables), "Вирус"), "html"));
});

/* ---------------------------------------------------------------- PNG: the raster of the same card */

type Call = { name: string; args: unknown[] };

function fakeSvgEnvironment(options: { toBlob?: "ok" | "null" | "throw" | "empty"; contextNull?: boolean; loadFails?: boolean } = {}) {
  const calls: Call[] = [];
  const sizes: Array<[number, number]> = [];
  const loadedSources: string[] = [];
  const environment: PngEnvironment = {
    createCanvas: (width, height) => {
      sizes.push([width, height]);
      const context = {
        fillStyle: "",
        fillRect: (...args: unknown[]) => { calls.push({ name: "fillRect", args }); },
        drawImage: (...args: unknown[]) => { calls.push({ name: "drawImage", args }); },
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
    loadImage: async (src) => {
      if (options.loadFails) throw new Error("decode failed");
      loadedSources.push(src);
      return { rendered: true };
    },
  };
  return { environment, calls, sizes, loadedSources };
}

const cleanSvg = (height: number) => templateCardSvg(`<article xmlns="http://www.w3.org/1999/xhtml" class="record-view">Опасно</article>`, templateCardCss(siteRules, variables), templateCardWidth, height);

test("the PNG is the raster of the SVG: one source, scale 2 up to 4000 px, 1 up to 8000 px, a refusal beyond", async () => {
  const fake = fakeSvgEnvironment();
  const blob = await renderTemplateCardPng(cleanSvg(1500), 1500, fake.environment);
  assert.equal(blob.type, "image/png");
  assert.ok(blob.size > 0);
  assert.equal(fake.loadedSources.length, 1);
  assert.ok(fake.loadedSources[0].startsWith("data:image/svg+xml"));
  assert.deepEqual(fake.sizes, [[2120, 3000]]);
  assert.deepEqual(fake.calls.find((call) => call.name === "drawImage")?.args.slice(1), [0, 0, 2120, 3000]);

  for (const [height, expected] of [[4000, [2120, 8000]], [4001, [1060, 4001]], [pngMaxHeight, [1060, pngMaxHeight]]] as const) {
    const sized = fakeSvgEnvironment();
    await renderTemplateCardPng(cleanSvg(height), height, sized.environment);
    assert.deepEqual(sized.sizes, [expected], String(height));
  }
  const tall = fakeSvgEnvironment();
  await assert.rejects(renderTemplateCardPng(cleanSvg(pngMaxHeight + 1), pngMaxHeight + 1, tall.environment), (error) => isTemplatePngTooLargeError(error));
  assert.deepEqual(tall.sizes, [], "an over-long card draws nothing");
  assert.deepEqual(tall.loadedSources, []);
});

test("the PNG fails loudly when the encoder, the canvas or the decoding misbehaves, and never writes an empty file", async () => {
  const svg = cleanSvg(800);
  await assert.rejects(renderTemplateCardPng(svg, 800, fakeSvgEnvironment({ toBlob: "null" }).environment), /PNG encoding failed/);
  await assert.rejects(renderTemplateCardPng(svg, 800, fakeSvgEnvironment({ toBlob: "empty" }).environment), /PNG encoding failed/);
  await assert.rejects(renderTemplateCardPng(svg, 800, fakeSvgEnvironment({ toBlob: "throw" }).environment), /SecurityError/);
  await assert.rejects(renderTemplateCardPng(svg, 800, fakeSvgEnvironment({ contextNull: true }).environment), /canvas/);
  await assert.rejects(renderTemplateCardPng(svg, 800, fakeSvgEnvironment({ loadFails: true }).environment), /decode failed/);
});

test("the SVG is checked by the policy before anything is loaded or drawn", async () => {
  const hostile = cleanSvg(800).replace("<article", `<article><image href="https://evil.example/a.png"/><script>1</script`);
  const fake = fakeSvgEnvironment();
  await assert.rejects(renderTemplateCardPng(hostile, 800, fake.environment), (error) => isTemplateExportError(error));
  assert.deepEqual(fake.loadedSources, []);
  assert.deepEqual(fake.sizes, []);
});

test("the card export and the image check never touch the network", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests += 1; throw new Error("network is off"); }) as typeof fetch;
  try {
    templateCardDocument(cleanMarkup, templateCardCss(siteRules, variables), "Вирус");
    await renderTemplateCardPng(cleanSvg(900), 900, fakeSvgEnvironment().environment);
    await decodeLocalTemplateImage(fileOf(pngSignature, "image/png"), { loadImage: okImage() });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(requests, 0);
});

// OWN-12 (owner 2026-11-21, item 24): the downloaded file is named after the virus. The name is user input that lands in the `download` attribute.
test("templateDownloadName names the file after the virus and keeps Cyrillic", () => {
  assert.equal(templateDownloadName("Вирус Б-12", "html"), "Вирус Б-12.html");
  assert.equal(templateDownloadName("Тест Ж-1", "png"), "Тест Ж-1.png");
});

// 26.1-REVIEW-2 CR-03: the e2e scenario of a too-long card has no virus name; the cut of a long name is checked here instead.
test("templateDownloadName cuts a long name at 80 characters and names an empty one by default", () => {
  assert.equal(templateDownloadName("Д".repeat(110), "html"), `${"Д".repeat(80)}.html`);
  assert.equal(templateDownloadName("", "html"), "shablon-dosye.html");
});

test("templateDownloadName drops characters a file name cannot carry and trims edges", () => {
  assert.equal(templateDownloadName("a/b:c*?", "png"), "abc.png");
  assert.equal(templateDownloadName('<a>"b"|c\d', "html"), "abcd.html");
  assert.equal(templateDownloadName("  Точка. ", "html"), "Точка.html");
  assert.equal(templateDownloadName("Имя...", "html"), "Имя.html");
  assert.equal(templateDownloadName("../../etc/passwd", "html"), "etcpasswd.html");
  assert.equal(templateDownloadName("А\u0000Б\u001fВ\u007fГ\u0301Д", "html"), "АБВГД.html");
  assert.equal(templateDownloadName("Ф\u202eБ", "html"), "ФБ.html");
});

test("templateDownloadName gives reserved Windows names an underscore", () => {
  assert.equal(templateDownloadName("CON", "html"), "CON_.html");
  assert.equal(templateDownloadName("nul", "png"), "nul_.png");
  assert.equal(templateDownloadName("Com1", "html"), "Com1_.html");
  assert.equal(templateDownloadName("LPT9", "html"), "LPT9_.html");
  assert.equal(templateDownloadName("CON.log", "html"), "CON_.log.html");
  assert.equal(templateDownloadName("CONSOLE", "html"), "CONSOLE.html");
  assert.equal(templateDownloadName("COM10", "html"), "COM10.html");
});

test("templateDownloadName falls back to the old file name when nothing usable is left", () => {
  assert.equal(templateDownloadName("", "png"), "shablon-dosye.png");
  assert.equal(templateDownloadName("   ", "html"), "shablon-dosye.html");
  assert.equal(templateDownloadName("?*:", "html"), "shablon-dosye.html");
  assert.equal(templateDownloadName("...", "png"), "shablon-dosye.png");
});

test("templateDownloadName cuts a long name to 80 characters without splitting a surrogate pair", () => {
  const long = templateDownloadName("Я".repeat(200), "html");
  assert.equal(long, `${"Я".repeat(80)}.html`);
  const emoji = templateDownloadName("\u{1F9A0}".repeat(100), "png");
  assert.equal(emoji, `${"\u{1F9A0}".repeat(80)}.png`);
  assert.doesNotMatch(emoji, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/, "no lone surrogate");
  assert.equal(templateDownloadName(`${"Я".repeat(79)}. хвост`, "html"), `${"Я".repeat(79)}.html`, "a dot or space left at the cut is trimmed");
});
