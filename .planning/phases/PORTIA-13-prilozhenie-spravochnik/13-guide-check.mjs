// Usage: node 13-guide-check.mjs --check <name>|all [--url http://localhost:3124]
// Checks: open-card, grid, card-blocks, poll-gone, search, editor-save (the «Справочник» desktop window of phase 13).
// Why: the guide window (grid, card page, remembered folding, poll safety, search) has no DOM test runner, so headless Edge drives the production build.
// Inside the browser it launches, GET /api/access and GET /api/content are answered from the current fixture. EVERY non-GET request to /api/*
// is blocked and recorded as a failure reason ("write blocked"), never forwarded, so nothing is ever saved and no login is needed.
// One exception: while current.fakeSave is set, a PUT /api/content is answered locally (Fetch.fulfillRequest after 800 ms, revision + 1),
// its body kept in savedBody and counted in fakeSaves; it is NEVER forwarded to the server.
// The stub is a CDP interception only: no app or server code knows about it.
// Prints one JSON verdict { check, ok, reasons } (`all`: { check, ok, results }). Exit 0 ok, 1 not ok, 2 Edge or server unreachable or unknown check.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
const URL_ = flag("url", "http://localhost:3124");
const CHECK = flag("check", "");
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
const PROFILE = path.join(os.tmpdir(), "portia-guide-check-13");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id); this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      } else if (message.method) (this.listeners.get(message.method) || []).forEach((fn) => fn(message.params));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(method, fn) { this.listeners.set(method, [...(this.listeners.get(method) || []), fn]); }
  once(method, ms = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), ms);
      this.on(method, (params) => { clearTimeout(timer); resolve(params); });
    });
  }
  eval(expression) { return this.send("Runtime.evaluate", { expression, returnByValue: true }).then((r) => r.result.value); }
}

const reasons = [];
const ALL_TABS = ["viruses", "info", "guide", "broadcasts", "recycle", "search", "assistant", "employees"];
const defaultAccess = () => ({ canEdit: false, canManageEditors: false, openTabs: [...ALL_TABS], tabsEnforced: true });

const LOGO = "/assets/portia-logo.png";
const MISSING = "/assets/missing-guide-photo.png";
/** guideSections for the harness; `ids` keeps only the named sections (default: all). */
const guideFixture = (ids) => {
  const sections = [
    { id: "g1", title: "Лаборатория", photo: LOGO, cards: [
      { id: "c1", title: "Как пройти в лабораторию", cover: LOGO, blocks: [
        { id: "b1", type: "heading", text: "Маршрут" },
        { id: "b2", type: "text", text: "Идите по коридору B." },
      ] },
      { id: "c2", title: "Пропуск", cover: "", blocks: [{ id: "b3", type: "text", text: "Пропуск выдаёт охрана." }] },
    ] },
    { id: "g2", title: "Справочный отдел", photo: "", cards: [
      { id: "c3", title: "Все блоки", cover: "", blocks: [
        { id: "k1", type: "heading", text: "Раздел карточки" },
        { id: "k2", type: "text", text: "Обычный текст" },
        { id: "k3", type: "table", rows: [{ id: "r1", key: "Уровень", value: "III" }] },
        { id: "k4", type: "photo", url: LOGO, caption: "Подпись к фото" },
        { id: "k5", type: "photo", url: MISSING, caption: "" },
        { id: "k6", type: "video", videoId: "dQw4w9WgXcQ" },
        { id: "k7", type: "callout", label: "ВАЖНО", text: "Не открывать без пропуска" },
        { id: "k8", type: "callout", label: "", text: "Без подписи" },
      ] },
      { id: "c4", title: "Пустая", cover: "", blocks: [] },
    ] },
    { id: "g3", title: "Пустой раздел", photo: "", cards: [] },
    { id: "g4", title: "Длинный", photo: "", cards: Array.from({ length: 30 }, (_, i) => ({ id: `l${i}`, title: `Длинная карточка ${i}`, cover: "", blocks: [{ id: `lb${i}`, type: "text", text: `Текст ${i}` }] })) },
  ];
  return ids ? sections.filter((section) => ids.includes(section.id)) : sections;
};
const baseFixture = (guideSections) => ({
  viruses: [{ id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "", physiology: "" }],
  infoSections: [{ id: "s1", title: "Раздел 1", body: "Текст раздела", subsections: [] }],
  broadcasts: [],
  searchRecommendations: [],
  guideSections,
});

let revision = 0; // a new revision for every serve: the page caches content by revision
let current = { content: baseFixture([]), revision: 1, fakeSave: false, access: defaultAccess() };
let fakeSaves = 0;
let savedBody = "";
const serve = (content, access = defaultAccess()) => { revision += 10; current = { content, revision, fakeSave: false, access }; };

const json = { "content-type": "application/json", "cache-control": "no-store" };
function installStub(cdp) {
  cdp.on("Runtime.exceptionThrown", (p) => reasons.push(`page exception: ${String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).slice(0, 120)}`));
  cdp.on("Page.javascriptDialogOpening", () => { cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {}); });
  const fulfil = (p, body, responseCode = 200) => cdp.send("Fetch.fulfillRequest", {
    requestId: p.requestId, responseCode,
    responseHeaders: Object.entries(json).map(([name, value]) => ({ name, value })),
    body: Buffer.from(JSON.stringify(body)).toString("base64"),
  }).catch(() => {});
  const block = (p) => cdp.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }).catch(() => {});
  cdp.on("Fetch.requestPaused", (p) => {
    const { pathname } = new URL(p.request.url);
    if (p.request.method === "PUT" && pathname === "/api/content" && current.fakeSave) { fakeSaves += 1; savedBody = p.request.postData ?? ""; setTimeout(() => fulfil(p, { revision: current.revision + 1 }), 800); return; }
    if (p.request.method !== "GET") { reasons.push(`write blocked: ${p.request.method} ${pathname}`); block(p); return; }
    if (pathname === "/api/access") fulfil(p, current.access);
    else if (pathname === "/api/content") fulfil(p, { content: current.content, revision: current.revision, updatedAt: null });
    else block(p);
  });
}

const waitFor = async (cdp, expression, ms = 5000) => {
  for (let waited = 0; waited <= ms; waited += 100) { if (await cdp.eval(expression)) return true; await sleep(100); }
  return false;
};
const load = async (cdp) => {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: URL_ }); await loaded;
  await waitFor(cdp, `(() => { const e = document.querySelector(".desktop-icons"); return !!e && e.getBoundingClientRect().width > 0; })()`, 10000);
};
const refetch = (cdp) => cdp.eval(`document.dispatchEvent(new Event("visibilitychange")); true`);
const click = (cdp, selector) => cdp.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true; })()`);
const clickText = (cdp, selector, text) => cdp.eval(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => n.textContent.trim() === ${JSON.stringify(text)}); if (!e) return false; e.click(); return true; })()`);
const count = (cdp, selector) => cdp.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
const text = (cdp, selector) => cdp.eval(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim() ?? null`);

/** Serves a fixture, loads the desktop and opens the guide window. */
async function openGuide(cdp, sections) {
  serve(baseFixture(sections));
  await load(cdp);
  if (!(await click(cdp, '[data-shortcut="guide"]'))) { reasons.push("the guide shortcut is missing on the desktop"); return false; }
  if (!(await waitFor(cdp, `!!document.querySelector(".guide-window .guide-app")`, 6000))) { reasons.push("the guide window did not open"); return false; }
  return true;
}
/** An editor session (canEdit) with the tabs in `openTabs`. */
const editorAccess = (openTabs = ALL_TABS) => ({ canEdit: true, canManageEditors: false, openTabs: [...openTabs], tabsEnforced: true });

async function openEditor(cdp) {
  if (!(await click(cdp, '[data-shortcut="settings"]'))) { reasons.push("openEditor: settings shortcut missing"); return false; }
  if (!(await waitFor(cdp, `(() => { const b = document.querySelector(".content-control-actions button"); return !!b && !b.disabled; })()`, 5000))) { reasons.push("openEditor: editor button not enabled"); return false; }
  await click(cdp, ".content-control-actions button");
  if (!(await waitFor(cdp, `!!document.querySelector(".content-editor")`, 8000))) { reasons.push("openEditor: .content-editor did not appear"); return false; }
  return true;
}
const bootEditor = async (cdp, sections, access = editorAccess()) => { serve(baseFixture(sections), access); await load(cdp); return openEditor(cdp); };
const STRIP = ".content-editor > .editor-tabs";
const stripLabels = (cdp) => cdp.eval(`[...document.querySelectorAll(${JSON.stringify(`${STRIP} > button`)})].map((b) => b.textContent.trim())`);
const ctrlZ = async (cdp) => { for (const type of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 }); await sleep(250); };
/** Focuses the element, selects what it holds and types over it (works for inputs and the formatted fields). */
const typeInto = async (cdp, selector, value, nth = 0) => {
  const ok = await cdp.eval(`(() => { const i = document.querySelectorAll(${JSON.stringify(selector)})[${nth}]; if (!i) return false; i.scrollIntoView({ block: "center" }); i.focus(); if (i.select) i.select(); else document.getSelection().selectAllChildren(i); return true; })()`);
  if (!ok) return false;
  await cdp.send("Input.insertText", { text: value }); await sleep(250);
  return true;
};
/** Types over the input of the editor field with this label (the nth one in the DOM). */
const typeLabel = async (cdp, label, value, nth = 0) => {
  const ok = await cdp.eval(`(() => { const l = [...document.querySelectorAll(".content-editor label.editor-field")].filter((n) => n.querySelector(":scope > span")?.textContent.trim() === ${JSON.stringify(label)})[${nth}]; const i = l?.querySelector("input"); if (!i) return false; i.scrollIntoView({ block: "center" }); i.focus(); i.select(); return true; })()`);
  if (!ok) { reasons.push(`no field «${label}» (#${nth})`); return false; }
  await cdp.send("Input.insertText", { text: value }); await sleep(250);
  return true;
};
const editorClick = (cdp, label, nth = 0) => cdp.eval(`(() => { const e = [...document.querySelectorAll(".content-editor button")].filter((n) => n.textContent.trim() === ${JSON.stringify(label)})[${nth}]; if (!e) return false; e.click(); return true; })()`);
const chipOpen = async (cdp) => {
  if (!(await cdp.eval(`!!document.querySelector(".editor-save-chip")`))) return false;
  if (!(await cdp.eval(`!!document.querySelector(".editor-save-popover")`))) await cdp.eval(`document.querySelector(".editor-save-chip > button").click()`);
  return waitFor(cdp, `!!document.querySelector(".editor-save-popover")`, 2000);
};
/** Presses СОХРАНИТЬ in the popover with fake saves on; returns the parsed content of the one save it caused, or null. */
async function fakeSave(cdp) {
  fakeSaves = 0; savedBody = ""; current.fakeSave = true;
  if (!(await chipOpen(cdp))) { reasons.push("fakeSave: no chip to open"); current.fakeSave = false; return null; }
  await clickText(cdp, ".editor-save-popover button", "СОХРАНИТЬ");
  for (let waited = 0; waited < 6000 && fakeSaves === 0; waited += 100) await sleep(100);
  await sleep(1200); // the answer, then «СОХРАНЕНО»
  current.fakeSave = false;
  if (fakeSaves !== 1) { reasons.push(`fakeSave: ${fakeSaves} saves, expected exactly 1`); return null; }
  try { return JSON.parse(savedBody).content; } catch { reasons.push("fakeSave: the saved body is not JSON"); return null; }
}
const tileSelector = (id) => `.guide-window .guide-tile[data-card-id="${id}"]`;

const checks = {
  async "open-card"(cdp) {
    if (!(await openGuide(cdp, guideFixture(["g1"])))) return;
    if (!(await waitFor(cdp, `document.querySelectorAll(".guide-window .guide-tile").length === 2`, 5000))) { reasons.push(`expected 2 tiles, found ${await count(cdp, ".guide-window .guide-tile")}; window text: ${await text(cdp, ".guide-window")}`); return; }
    if (!(await click(cdp, tileSelector("c1")))) { reasons.push("tile c1 missing"); return; }
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-window .guide-page")`, 3000))) { reasons.push("the card page did not open"); return; }
    if (await count(cdp, ".guide-window .guide-grid") !== 0) reasons.push("the grid is still in the DOM next to the card page");
    if (await count(cdp, ".guide-window .guide-tile") !== 0) reasons.push("tiles are still in the DOM next to the card page");
    if (await text(cdp, ".guide-page h1") !== "Как пройти в лабораторию") reasons.push(`h1 is ${await text(cdp, ".guide-page h1")}`);
    if (await text(cdp, ".guide-page h2") !== "Маршрут") reasons.push(`h2 is ${await text(cdp, ".guide-page h2")}`);
    if (!String(await text(cdp, ".guide-page")).includes("Идите по коридору B.")) reasons.push("the text block is missing from the page");
    const bar = await cdp.eval(`(() => { const b = [...document.querySelectorAll(".guide-window .guide-back-bar button")]; return { n: b.length, label: b[0]?.getAttribute("aria-label") }; })()`);
    if (bar.n !== 1 || bar.label !== "Назад к списку карточек") reasons.push(`back bar: ${JSON.stringify(bar)}`);
    await click(cdp, ".guide-window .guide-back-bar button");
    if (!(await waitFor(cdp, `document.querySelectorAll(".guide-window .guide-tile").length === 2`, 3000))) { reasons.push("the grid did not come back"); return; }
    if (await cdp.eval(`document.activeElement?.dataset?.cardId`) !== "c1") reasons.push(`focus is not on tile c1: ${await cdp.eval(`document.activeElement?.outerHTML?.slice(0, 80)`)}`);
  },

  async grid(cdp) {
    if (!(await openGuide(cdp, guideFixture()))) return;
    if (!(await waitFor(cdp, `!!document.querySelector(${JSON.stringify(tileSelector("c2"))})`, 5000))) { reasons.push("tiles did not render"); return; }
    const geometry = await cdp.eval(`(() => {
      const q = (s) => document.querySelector(s);
      const c1 = q(${JSON.stringify(tileSelector("c1"))}), c2 = q(${JSON.stringify(tileSelector("c2"))});
      const head = (id) => q('.guide-window [aria-controls="guide-grid-' + id + '"]');
      return {
        c1Img: !!c1?.querySelector("img"), c1Height: c1?.offsetHeight,
        c2Thin: c2?.classList.contains("guide-tile-thin"), c2Img: !!c2?.querySelector("img"), c2Height: c2?.offsetHeight,
        g1Photo: head("g1")?.classList.contains("has-photo"), g1Alt: head("g1")?.querySelector("img")?.getAttribute("alt"),
        g2Img: !!head("g2")?.querySelector("img"),
        inputs: document.querySelectorAll(".guide-app input, .guide-app textarea, .guide-app [role=searchbox]").length,
      };
    })()`);
    if (!geometry.c1Img || !(geometry.c1Height > 120)) reasons.push(`c1 tile: ${JSON.stringify({ img: geometry.c1Img, h: geometry.c1Height })}`);
    if (!geometry.c2Thin || geometry.c2Img || !(geometry.c2Height >= 43 && geometry.c2Height <= 45)) reasons.push(`c2 thin row: ${JSON.stringify({ thin: geometry.c2Thin, img: geometry.c2Img, h: geometry.c2Height })}`);
    if (!geometry.g1Photo || geometry.g1Alt !== "") reasons.push(`g1 head: ${JSON.stringify({ photo: geometry.g1Photo, alt: geometry.g1Alt })}`);
    if (geometry.g2Img) reasons.push("g2 head holds an image though the section has no photo");
    if (geometry.inputs) reasons.push(`${geometry.inputs} input(s) inside the guide window (D-17)`);
    if (!String(await text(cdp, "#guide-grid-g3")).includes("В разделе пока нет карточек")) reasons.push("g3 does not say «В разделе пока нет карточек»");
    // Folding: pressing the head folds the grid, and this device remembers it (D-08).
    await click(cdp, '.guide-window [aria-controls="guide-grid-g1"]');
    await sleep(300);
    const folded = await cdp.eval(`(() => { const h = document.querySelector('.guide-window [aria-controls="guide-grid-g1"]'); return { expanded: h?.getAttribute("aria-expanded"), hidden: document.getElementById("guide-grid-g1")?.hidden }; })()`);
    if (folded.expanded !== "false" || folded.hidden !== true) reasons.push(`g1 did not fold: ${JSON.stringify(folded)}`);
    const reopen = async () => { await load(cdp); await click(cdp, '[data-shortcut="guide"]'); return waitFor(cdp, `!!document.querySelector('.guide-window [aria-controls="guide-grid-g1"]')`, 6000); };
    if (!(await reopen())) { reasons.push("the guide window did not reopen after a reload"); return; }
    await sleep(300);
    const again = await cdp.eval(`(() => { const e = (id) => document.querySelector('.guide-window [aria-controls="guide-grid-' + id + '"]')?.getAttribute("aria-expanded"); return { g1: e("g1"), g2: e("g2") }; })()`);
    if (again.g1 !== "false" || again.g2 !== "true") reasons.push(`after reload g1 should stay folded and g2 open: ${JSON.stringify(again)}`);
    const stored = await cdp.eval(`localStorage.getItem("portia-guide-collapsed-v1")`);
    if (stored !== '["g1"]') reasons.push(`localStorage holds ${stored}, expected ["g1"]`);
    // A broken value must not break the window: everything opens.
    await cdp.eval(`localStorage.setItem("portia-guide-collapsed-v1", "not json"); true`);
    if (!(await reopen())) { reasons.push("the guide window did not reopen after a broken stored value"); return; }
    await sleep(300);
    if (await cdp.eval(`document.querySelector('.guide-window [aria-controls="guide-grid-g1"]')?.getAttribute("aria-expanded")`) !== "true") reasons.push("g1 is not open after a broken stored value");
    // An empty guide says so (D-00d).
    if (!(await openGuide(cdp, []))) return;
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-window .guide-empty")`, 4000))) { reasons.push("no empty state for an empty guide"); return; }
    const empty = await text(cdp, ".guide-window .guide-empty");
    if (!empty.includes("Справочник пока пуст") || !empty.includes("Карточки появятся здесь, когда редакторы их добавят.")) reasons.push(`empty state reads: ${empty}`);
  },

  async "card-blocks"(cdp) {
    if (!(await openGuide(cdp, guideFixture()))) return;
    if (!(await waitFor(cdp, `!!document.querySelector(${JSON.stringify(tileSelector("c3"))})`, 5000))) { reasons.push("tile c3 missing"); return; }
    await click(cdp, tileSelector("c3"));
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-page")`, 3000))) { reasons.push("card c3 did not open"); return; }
    const page = await cdp.eval(`(() => {
      const q = (s) => document.querySelector(".guide-page " + s);
      const callouts = [...document.querySelectorAll(".guide-page .guide-callout")];
      const frame = q("iframe");
      return {
        h2: q("h2")?.textContent.trim(), dt: q("dt")?.textContent.trim(), dd: q("dd")?.textContent.trim(),
        figures: document.querySelectorAll(".guide-page .guide-photo:has(figcaption) img").length, caption: q(".guide-photo figcaption")?.textContent.trim(),
        sandbox: frame?.getAttribute("sandbox"), src: frame?.getAttribute("src"), fullscreen: frame?.hasAttribute("allowfullscreen"), frames: document.querySelectorAll(".guide-page iframe").length,
        c1Label: callouts[0]?.querySelector(".guide-callout-label")?.textContent.trim(), c1Body: callouts[0]?.textContent.replace(callouts[0]?.querySelector(".guide-callout-label")?.textContent ?? "", "").trim(),
        c2Label: !!callouts[1]?.querySelector(".guide-callout-label"), callouts: callouts.length,
      };
    })()`);
    if (page.h2 !== "Раздел карточки") reasons.push(`h2 is ${page.h2}`);
    if (page.dt !== "Уровень" || page.dd !== "III") reasons.push(`table row is ${page.dt}/${page.dd}`);
    if (page.figures !== 1 || page.caption !== "Подпись к фото") reasons.push(`photo: ${JSON.stringify({ figures: page.figures, caption: page.caption })}`);
    if (page.sandbox !== "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox") reasons.push(`sandbox is ${page.sandbox}`);
    if (!String(page.src).startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ") || !page.fullscreen || page.frames !== 1) reasons.push(`video frame: ${JSON.stringify({ src: page.src, fullscreen: page.fullscreen, frames: page.frames })}`);
    if (page.callouts !== 2 || page.c1Label !== "ВАЖНО" || page.c1Body !== "Не открывать без пропуска" || page.c2Label) reasons.push(`callouts: ${JSON.stringify(page)}`);
    // The lazy broken image only loads once it is near the viewport.
    let failedShown = false;
    for (let waited = 0; waited < 5000 && !failedShown; waited += 200) {
      await cdp.eval(`document.querySelectorAll(".guide-page img").forEach((i) => i.scrollIntoView({ block: "center" })); true`);
      failedShown = await cdp.eval(`document.querySelector(".guide-page").textContent.includes("Фото не загрузилось")`);
      if (!failedShown) await sleep(200);
    }
    if (!failedShown) reasons.push("«Фото не загрузилось» never appeared for the broken photo");
    // A card without blocks says so (A11Y-03).
    await click(cdp, ".guide-window .guide-back-bar button");
    await waitFor(cdp, `!!document.querySelector(${JSON.stringify(tileSelector("c4"))})`, 3000);
    await click(cdp, tileSelector("c4"));
    await waitFor(cdp, `!!document.querySelector(".guide-page")`, 3000);
    if (!String(await text(cdp, ".guide-page")).includes("В карточке пока нет содержимого")) reasons.push("an empty card does not say «В карточке пока нет содержимого»");
    await click(cdp, ".guide-window .guide-back-bar button");
    await waitFor(cdp, `!!document.querySelector(${JSON.stringify(tileSelector("c4"))})`, 3000);
    // Scroll restore (D-07): back returns to the same scroll position and the same tile.
    await cdp.eval(`document.querySelector(".guide-app").scrollTop = 600; true`);
    await sleep(200);
    const picked = await cdp.eval(`(() => {
      const root = document.querySelector(".guide-app").getBoundingClientRect();
      const tile = [...document.querySelectorAll(".guide-window .guide-tile")].find((t) => { const r = t.getBoundingClientRect(); return r.top >= root.top + 8 && r.bottom <= root.bottom - 8; });
      return tile ? { id: tile.dataset.cardId, top: document.querySelector(".guide-app").scrollTop } : null;
    })()`);
    if (!picked || picked.top < 598) { reasons.push(`could not scroll the grid: ${JSON.stringify(picked)}`); return; }
    await click(cdp, tileSelector(picked.id));
    await waitFor(cdp, `!!document.querySelector(".guide-page")`, 3000);
    const entered = await cdp.eval(`({ top: document.querySelector(".guide-app").scrollTop, page: document.activeElement?.classList.contains("guide-page") })`);
    if (entered.top !== 0 || !entered.page) reasons.push(`entering a card: ${JSON.stringify(entered)}`);
    await click(cdp, ".guide-window .guide-back-bar button");
    await waitFor(cdp, `!!document.querySelector(${JSON.stringify(tileSelector(picked.id))})`, 3000);
    const back = await cdp.eval(`({ top: document.querySelector(".guide-app").scrollTop, id: document.activeElement?.dataset?.cardId })`);
    if (Math.abs(back.top - picked.top) > 2 || back.id !== picked.id) reasons.push(`back: scrollTop ${back.top} (was ${picked.top}), focus ${back.id} (was ${picked.id})`);
  },

  async "poll-gone"(cdp) {
    if (!(await openGuide(cdp, guideFixture(["g1"])))) return;
    await waitFor(cdp, `!!document.querySelector(${JSON.stringify(tileSelector("c1"))})`, 5000);
    await click(cdp, tileSelector("c1"));
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-page")`, 3000))) { reasons.push("card c1 did not open"); return; }
    const without = guideFixture(["g1"]);
    without[0].cards = without[0].cards.filter((card) => card.id !== "c1");
    serve(baseFixture(without));
    await refetch(cdp);
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-window .guide-grid") && !document.querySelector(".guide-page")`, 15000))) { reasons.push("the window did not fall back to the grid after the card was removed"); return; }
    if (/ошибк/i.test(String(await text(cdp, ".guide-window")))) reasons.push("the window shows error text after the poll");
  },

  async search(cdp) {
    serve(baseFixture(guideFixture()));
    await load(cdp);
    if (!(await click(cdp, '[data-shortcut="search"]'))) { reasons.push("the search shortcut is missing"); return; }
    await waitFor(cdp, `!!document.querySelector(".global-search-box input")`, 5000);
    const search = async (query) => {
      await cdp.eval(`(() => { const i = document.querySelector(".global-search-box input"); i.focus(); i.select(); return true; })()`);
      await cdp.send("Input.insertText", { text: query });
      await sleep(400);
      return cdp.eval(`[...document.querySelectorAll(".global-result")].map((r) => ({ mark: r.querySelector(".global-result-mark")?.textContent.trim(), title: r.querySelector(".global-result-heading strong")?.textContent.trim(), meta: r.querySelector(".global-result-heading small")?.textContent.trim(), preview: r.querySelector(".global-result-preview")?.textContent.trim() }))`);
    };
    const callout = await search("Не открывать без пропуска");
    if (callout.length !== 1 || callout[0].mark !== "REF" || callout[0].meta !== "СПРАВОЧНИК · Справочный отдел") reasons.push(`callout search: ${JSON.stringify(callout)}`);
    await click(cdp, ".global-result");
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-window .guide-page h1")`, 5000))) { reasons.push("the guide window did not open on the card"); return; }
    if (await text(cdp, ".guide-page h1") !== "Все блоки") reasons.push(`the card page is ${await text(cdp, ".guide-page h1")}`);
    await click(cdp, ".guide-window .guide-back-bar button");
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-window .guide-grid")`, 3000))) reasons.push("«← Назад» did not show the grid");
    if (await cdp.eval(`document.querySelector(".guide-app").scrollTop`) !== 0) reasons.push("the grid is not at the top after «← Назад»");
    const section = await search("Лаборатория");
    const refs = section.filter((r) => r.mark === "REF").map((r) => r.title);
    if (!refs.includes("Как пройти в лабораторию") || !refs.includes("Пропуск")) reasons.push(`section-title search: ${JSON.stringify(section)}`);
    const caption = await search("Подпись к фото");
    if (!caption.some((r) => r.mark === "REF" && r.title === "Все блоки")) reasons.push(`caption search: ${JSON.stringify(caption)}`);
    else if (!caption.find((r) => r.title === "Все блоки").preview.startsWith("Подпись к фото")) reasons.push(`the preview does not start at the match: ${caption.find((r) => r.title === "Все блоки").preview}`);
  },

  async "editor-save"(cdp) {
    if (!(await bootEditor(cdp, []))) return;
    const labels = await stripLabels(cdp);
    if (labels.indexOf("Справочник") < 0 || labels.indexOf("Справочник") !== labels.indexOf("Информация") + 1) reasons.push(`the strip reads ${JSON.stringify(labels)}: «Справочник» is not right after «Информация»`);
    if (!(await clickText(cdp, `${STRIP} > button`, "Справочник"))) { reasons.push("no «Справочник» strip button"); return; }
    if (!(await waitFor(cdp, `document.querySelector(".content-editor").textContent.includes("Разделов пока нет")`, 3000))) { reasons.push("the empty guide does not say «Разделов пока нет»"); return; }
    await editorClick(cdp, "+ ДОБАВИТЬ РАЗДЕЛ");
    if (!(await typeLabel(cdp, "Заголовок раздела", "Лаборатория"))) return;
    if (!(await editorClick(cdp, "+ ДОБАВИТЬ КАРТОЧКУ"))) { reasons.push("no «+ ДОБАВИТЬ КАРТОЧКУ»"); return; }
    if (!(await typeLabel(cdp, "Заголовок карточки", "Как пройти"))) return;
    if (!(await editorClick(cdp, "+ ТЕКСТ"))) { reasons.push("no «+ ТЕКСТ»"); return; }
    if (!(await typeInto(cdp, ".content-editor .formatted-rich-input", "Идите по коридору B."))) { reasons.push("no formatted text field"); return; }
    const saved = await fakeSave(cdp);
    if (!saved) return;
    const section = saved.guideSections?.[0];
    const block = section?.cards?.[0]?.blocks?.[0];
    if (section?.title !== "Лаборатория" || section?.cards?.[0]?.title !== "Как пройти" || block?.type !== "text" || block?.text !== "Идите по коридору B.") reasons.push(`saved guide: ${JSON.stringify(saved.guideSections)}`);
    if (!(await click(cdp, '[data-shortcut="guide"]'))) { reasons.push("the guide shortcut is missing"); return; }
    if (!(await waitFor(cdp, `[...document.querySelectorAll(".guide-window .guide-tile")].some((t) => t.textContent.includes("Как пройти"))`, 5000))) { reasons.push("the saved card is not a tile on the desktop"); return; }
    await click(cdp, ".guide-window .guide-tile");
    if (!(await waitFor(cdp, `!!document.querySelector(".guide-page")`, 3000))) { reasons.push("the saved card did not open"); return; }
    if (!String(await text(cdp, ".guide-page")).includes("Идите по коридору B.")) reasons.push("the saved text is missing from the card page");
  },
};

let edge;
const cleanup = () => {
  if (edge?.pid) { try { execFileSync("taskkill", ["/pid", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ } }
};
let code = 2;
try {
  const ALL = ["open-card", "grid", "card-blocks", "poll-gone", "search", "editor-save"];
  if (CHECK !== "all" && !checks[CHECK]) throw new Error(`unknown check "${CHECK}" (known: ${Object.keys(checks).join(", ")}, all)`);
  edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--window-size=1920,1080", "--no-first-run", "--disable-extensions", "about:blank"], { stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 50 && !up; i += 1) { up = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.ok, () => false); if (!up) await sleep(200); }
  if (!up) throw new Error("Edge debugging port did not open");
  if (!(await fetch(URL_).then((r) => r.ok, () => false))) throw new Error("server not reachable");
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  installStub(cdp);
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem("portia-boot-seen-v1", "1")` });
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  const names = CHECK === "all" ? ALL : [CHECK];
  const results = {};
  for (const name of names) {
    reasons.length = 0; fakeSaves = 0; savedBody = "";
    await cdp.send("Storage.clearDataForOrigin", { origin: new URL(URL_).origin, storageTypes: "local_storage" }); // each check starts without folded sections or cached content
    try { await checks[name](cdp); } catch (error) { reasons.push(`check threw: ${error.message}`); }
    results[name] = { ok: reasons.length === 0, reasons: [...reasons] };
  }
  ws.close();
  const ok = names.every((name) => results[name].ok);
  console.log(JSON.stringify(CHECK === "all" ? { check: "all", ok, results } : { check: CHECK, ok, reasons: results[CHECK].reasons }, null, 2));
  code = ok ? 0 : 1;
} catch (error) {
  console.error(`guide check failed: ${error.message}`);
  code = 2;
} finally {
  cleanup();
  await sleep(800);
  try { fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* temp dir, harmless */ }
}
process.exit(code);
