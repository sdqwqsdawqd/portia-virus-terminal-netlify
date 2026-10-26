// Usage: node 11-editor-check.mjs --check mark|panel|savechip|sections|table [--url http://localhost:3124]   (later plans add more checks)
// Why: Phase 11 has no DOM test runner, so headless Edge drives the production build. Inside the browser it launches,
// GET /api/access is answered {canEdit: true} and GET /api/content is served from fixtures; every non-GET request to /api/*
// is blocked and fails the check (nothing is ever saved, no login is needed). The only exception is the savechip fake-save
// step: while current.fakeSave is set, a PUT /api/content is answered locally (Fetch.fulfillRequest after 800 ms, revision + 1)
// and counted in fakeSaves; it is NEVER forwarded to the server (no Fetch.continueRequest for a non-GET anywhere).
// The stub is a CDP interception only: no app or server code knows about it.
// Prints one JSON verdict { check, ok, reasons } (booleans, numbers, fixture labels, exception text only).
// Exit 0 ok, 1 not ok, 2 Edge or server unreachable or unknown check.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
const URL_ = flag("url", "http://localhost:3124");
const CHECK = flag("check", "");
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const PROFILE = path.join(os.tmpdir(), "portia-editor-check");
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
const fixture = (overrides = {}) => ({ viruses: [], infoSections: [], broadcasts: [], searchRecommendations: [], ...overrides });
let current = { content: fixture(), revision: 1, fakeSave: false };
let fakeSaves = 0;
const serve = (content, revision, fakeSave = false) => { current = { content, revision, fakeSave }; };

/** One virus with plain text in both lead fields; the editor opens on it. */
const editorFixture = (overrides = {}) => fixture({
  viruses: [{ id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "Первое слово второе третье", physiology: "Четвёртое пятое шестое" }],
  infoSections: [], broadcasts: [], searchRecommendations: [],
  ...overrides,
});

const LONG = "Оченьдлинноеназвание".repeat(10); // 200 unbroken characters
const LONG_VIRUS = "Вирус".repeat(30); // 150 unbroken characters
/** Info sections 1..count, each with one subsection and one text block; section 3 has the long name. */
const sectionsFixture = (overrides = {}) => {
  const count = overrides.sections ?? 6;
  const infoSections = Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`, title: i === 2 ? LONG : `Раздел ${i + 1}`, body: `Текст раздела ${i + 1}`,
    subsections: (overrides.noSubsections ? [] : [{ id: `u${i + 1}`, title: `Подраздел ${i + 1}`, blocks: [{ id: `b${i + 1}`, type: "text", text: `Блок ${i + 1}` }] }]),
  }));
  const viruses = [
    { id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "", physiology: "" },
    { id: "v2", name: LONG_VIRUS, code: "A-2", status: "ИЗУЧЕН", external: "", physiology: "" },
    ...Array.from({ length: (overrides.viruses ?? 6) - 2 }, (_, i) => ({ id: `v${i + 3}`, name: `Вирус ${i + 3}`, code: `A-${i + 3}`, status: "ИЗУЧЕН", external: "", physiology: "" })),
  ];
  const broadcasts = Array.from({ length: overrides.news ?? 6 }, (_, i) => ({ id: `n${i + 1}`, type: "news", title: `Новость ${i + 1}`, body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }));
  const archived = (id, name) => ({ id, name, code: "R", status: "ИЗУЧЕН", external: "", physiology: "" });
  const file = (id, name) => ({ id, name, location: "", kind: "text", content: "", image: "", virusId: "" });
  return fixture({
    ...editorFixture(), viruses, infoSections, broadcasts,
    recycledViruses: [archived("r1", "Архив 1"), archived("r2", "Архив 2"), archived("r3", "Архив 3")],
    recycleFiles: [file("f1", "Файл 1"), file("f2", "Файл 2")],
    recycleOrder: ["virus:r1", "file:f1", "virus:r2", "file:f2", "virus:r3"],
  });
};

const json = { "content-type": "application/json", "cache-control": "no-store" };
function installStub(cdp) {
  cdp.on("Runtime.exceptionThrown", (p) => reasons.push(`page exception: ${String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).slice(0, 120)}`));
  cdp.on("Page.javascriptDialogOpening", () => { cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {}); });
  const fulfil = (p, body) => cdp.send("Fetch.fulfillRequest", {
    requestId: p.requestId, responseCode: 200,
    responseHeaders: Object.entries(json).map(([name, value]) => ({ name, value })),
    body: Buffer.from(JSON.stringify(body)).toString("base64"),
  }).catch(() => {});
  const block = (p) => cdp.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }).catch(() => {});
  cdp.on("Fetch.requestPaused", (p) => {
    const { pathname } = new URL(p.request.url);
    if (p.request.method === "PUT" && pathname === "/api/content" && current.fakeSave) { fakeSaves += 1; setTimeout(() => fulfil(p, { revision: current.revision + 1 }), 800); return; }
    if (p.request.method !== "GET") { reasons.push(`write blocked: ${p.request.method} ${pathname}`); block(p); return; }
    if (pathname === "/api/access") fulfil(p, { canEdit: true, canManageEditors: false });
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
const click = (cdp, selector) => cdp.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true; })()`);
const clickText = (cdp, selector, text) => cdp.eval(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => n.textContent.trim() === ${JSON.stringify(text)}); if (!e) return false; e.click(); return true; })()`);

async function openEditor(cdp) {
  if (!(await click(cdp, '[data-shortcut="settings"]'))) { reasons.push("openEditor: settings shortcut missing"); return false; }
  if (!(await waitFor(cdp, `(() => { const b = document.querySelector(".content-control-actions button"); return !!b && !b.disabled; })()`, 5000))) { reasons.push("openEditor: editor button not enabled"); return false; }
  await click(cdp, ".content-control-actions button");
  if (!(await waitFor(cdp, `!!document.querySelector(".content-editor")`, 8000))) { reasons.push("openEditor: .content-editor did not appear"); return false; }
  return true;
}

/** Scrolls the index-th match of the selector to the centre and returns the word's left, right and vertical middle (null when absent). */
const wordBox = (cdp, fieldSelector, index, word) => cdp.eval(`(() => {
  const field = document.querySelectorAll(${JSON.stringify(fieldSelector)})[${index}];
  if (!field) return null;
  field.scrollIntoView({ block: "center" });
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.data.indexOf(${JSON.stringify(word)});
    if (at < 0) continue;
    const range = document.createRange(); range.setStart(node, at); range.setEnd(node, at + ${JSON.stringify(word)}.length);
    const rect = range.getBoundingClientRect();
    return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2 };
  }
  return null;
})()`);

async function mouseSelect(cdp, box, modifiers = 0) {
  const at = (type, x, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x, y: box.y, button: "left", modifiers, ...extra });
  await at("mouseMoved", box.left + 1, { button: "none" });
  await at("mousePressed", box.left + 1, { buttons: 1, clickCount: 1 });
  await at("mouseMoved", (box.left + box.right) / 2, { buttons: 1 });
  await at("mouseMoved", box.right - 1, { buttons: 1 });
  await at("mouseReleased", box.right - 1, { buttons: 0, clickCount: 1 });
}
const panelKey = "portia-format-panel-v1";
const panelRect = (cdp) => cdp.eval(`(() => { const e = document.querySelector(".floating-text-format"); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; })()`);
/** A point on the panel header (8px below its top edge, so it can still be grabbed when the taskbar covers the rest) away from its buttons: fraction 0 is its left end, 1 its right end; "left"/"right" are the outermost grabbable points. */
const headerPoint = (cdp, fraction = 0.15) => cdp.eval(`(() => { const e = document.querySelector(".floating-text-format > header"); if (!e) return null; const r = e.getBoundingClientRect(); const f = ${JSON.stringify(fraction)}; const x = f === "left" ? r.left + 5 : f === "right" ? r.right - 46 : r.left + 20 + (r.width - 120) * f; return { x, y: r.top + 8 }; })()`);

const closePanel = async (cdp) => { await click(cdp, '.floating-text-format [aria-label="Закрыть панель оформления"]'); await waitFor(cdp, `!document.querySelector(".floating-text-format")`, 2000); };
const viewportSize = (cdp) => cdp.eval(`({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight })`); // the viewport differs a little between loads (scrollbars)
const forgetPlace = (cdp) => cdp.eval(`localStorage.removeItem(${JSON.stringify(panelKey)})`);
const key = (cdp, name, code, modifiers = 0) => ["keyDown", "keyUp"].reduce((chain, type) => chain.then(() => cdp.send("Input.dispatchKeyEvent", { type, key: name, code: name, windowsVirtualKeyCode: code, modifiers })), Promise.resolve());
const windowBox = (cdp) => cdp.eval(`(() => { const r = document.querySelector(".editor-window").getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })()`);

/** Describe tab, «второе» selected with the mouse, ✎ clicked, waits for the panel. */
let opens = 0;
async function openPanel(cdp) {
  opens += 1;
  await clickText(cdp, ".dossier-tabs button", "Описание");
  const lead = '.formatted-rich-input[data-area="lead"]';
  if (!(await waitFor(cdp, `!!document.querySelector(${JSON.stringify(lead)})`, 3000))) { reasons.push(`openPanel #${opens}: no lead field`); return false; }
  await cdp.eval("getSelection().removeAllRanges()"); // a mouse press inside a selected word starts a text drag instead of a new selection
  await wordBox(cdp, lead, 0, "второе"); await sleep(500); // the scroll into view may be smooth, so measure again once it has settled
  const box = await wordBox(cdp, lead, 0, "второе");
  if (!box) { reasons.push(`openPanel #${opens}: word «второе» not found`); return false; }
  await mouseSelect(cdp, box);
  await click(cdp, ".global-format-launch > button");
  if (!(await waitFor(cdp, `!!document.querySelector(".floating-text-format")`, 3000))) { reasons.push(`openPanel #${opens}: the format panel did not open (${await cdp.eval(`(() => { const b = document.querySelector(".global-format-launch > button"); const a = document.elementFromPoint(${box.left + 1}, ${box.y}); return "launch disabled=" + b?.disabled + " expanded=" + b?.getAttribute("aria-expanded") + " selection=" + JSON.stringify(String(getSelection())) + " at word: " + (a?.className || a?.tagName) + " box " + ${Math.round(box.left)} + "," + ${Math.round(box.y)}; })()`)})`); return false; }
  await sleep(150);
  return true;
}

/** Mouse pressed at from, six intermediate moves with the button down, released at to. */
async function drag(cdp, from, to) {
  const at = (type, x, y, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });
  await at("mouseMoved", from.x, from.y, { button: "none" });
  await at("mousePressed", from.x, from.y, { buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 6; step += 1) await at("mouseMoved", from.x + ((to.x - from.x) * step) / 6, from.y + ((to.y - from.y) * step) / 6, { buttons: 1 });
  await at("mouseReleased", to.x, to.y, { buttons: 0, clickCount: 1 });
  await sleep(100);
}
const phone = async (cdp, width = 390, height = 844) => {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
};
const desktop = async (cdp) => {
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
};

const checks = {
  async mark(cdp) {
    serve(editorFixture(), 1);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await clickText(cdp, ".dossier-tabs button", "Описание");
    // (a) a mouse-selected word is painted through the Custom Highlight API with exactly that word
    const lead = '.formatted-rich-input[data-area="lead"]';
    if (!(await waitFor(cdp, `!!document.querySelector(${JSON.stringify(lead)})`, 3000))) { reasons.push("(a) no lead field"); return; }
    const box = await wordBox(cdp, lead, 0, "второе");
    if (!box) { reasons.push("(a) word «второе» not found in the first lead field"); return; }
    await mouseSelect(cdp, box);
    await click(cdp, ".global-format-launch > button");
    if (!(await waitFor(cdp, `!!document.querySelector(".floating-text-format")`, 3000))) { reasons.push("(a) the format panel did not open"); return; }
    const painted = await cdp.eval(`(() => { const h = CSS.highlights.get("portia-format"); return h ? [...h].map(String) : null; })()`);
    if (JSON.stringify(painted) !== JSON.stringify(["второе"])) reasons.push(`(a) painted ${JSON.stringify(painted)}, expected ["второе"]`);
    // (b) the served stylesheet holds exactly one mark rule, an underline that follows the accent and has no fill
    const rules = await cdp.eval(`(() => {
      const found = [];
      for (const sheet of document.styleSheets) {
        let list; try { list = sheet.cssRules; } catch { continue; }
        for (const rule of list) if (rule.selectorText && rule.selectorText.includes("::highlight(portia-format)")) found.push(rule.cssText);
      }
      return found;
    })()`);
    if (rules.length !== 1) reasons.push(`(b) ${rules.length} ::highlight(portia-format) rules, expected 1`);
    else {
      if (!rules[0].includes("underline")) reasons.push("(b) the mark rule has no underline");
      if (!rules[0].includes("accent-chroma")) reasons.push("(b) the mark rule does not follow --accent-chroma");
      if (rules[0].includes("background")) reasons.push("(b) the mark rule has a background");
    }
    // (c) the field head carries only its label and the hint is neutral (A11Y-03)
    const heads = await cdp.eval(`document.querySelectorAll(".formatted-text-field-head small").length`);
    if (heads !== 0) reasons.push(`(c) ${heads} empty <small> in the field heads`);
    const hint = await cdp.eval(`document.querySelector(".formatted-text-field-hint")?.textContent ?? null`);
    if (hint !== "Текст и GIF можно использовать вместе. Не добавляйте лишних элементов.") reasons.push(`(c) hint reads ${JSON.stringify(hint)}`);
  },
  async savechip(cdp) {
    serve(editorFixture(), 1);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    const chip = '.editor-save-chip';
    const chipInfo = () => cdp.eval(`(() => { const w = document.querySelector(".editor-save-chip"); const b = w?.querySelector(":scope > button"); if (!b) return null; const r = b.getBoundingClientRect(); const win = document.querySelector(".editor-window").getBoundingClientRect(); return { text: b.textContent, label: b.getAttribute("aria-label"), expanded: b.getAttribute("aria-expanded"), border: getComputedStyle(b).borderTopColor, blocked: w.hasAttribute("data-blocked"), rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }, win: { left: win.left, right: win.right, top: win.top, bottom: win.bottom } }; })()`);
    const popover = () => cdp.eval(`(() => { const p = document.querySelector(".editor-save-popover"); if (!p) return null; const r = p.getBoundingClientRect(); return { text: p.textContent, buttons: [...p.querySelectorAll("button")].map((b) => b.textContent.trim() || b.getAttribute("aria-label")), visible: r.width > 0 && r.height > 0 }; })()`);
    const typeX = async () => { // «Х» into the virus name (first input of the form)
      await cdp.eval(`(() => { const i = document.querySelector(".virus-editor-form input"); i.scrollIntoView({ block: "center" }); i.focus(); })()`);
      await cdp.send("Input.insertText", { text: "Х" });
      await sleep(200);
    };
    // (a) a clean draft has no chip and exactly one polite live region
    if (await cdp.eval(`!!document.querySelector(${JSON.stringify(chip)})`)) reasons.push("(a) a chip is shown for a clean draft");
    const live = await cdp.eval(`document.querySelectorAll('.content-editor [role="status"][aria-live="polite"]').length`);
    if (live !== 1) reasons.push(`(a) ${live} polite live regions in the editor, expected 1`);
    // (b) one edit: the chip counts 1 and is amber
    await typeX();
    let info = await chipInfo();
    if (!info) { reasons.push("(b) no chip after an edit"); return; }
    if (info.text !== "1") reasons.push(`(b) chip text "${info.text}", expected 1`);
    if (info.label !== "Не сохранено разделов: 1") reasons.push(`(b) aria-label "${info.label}"`);
    if (info.border !== "rgb(239, 184, 78)") reasons.push(`(b) chip border ${info.border}, expected rgb(239, 184, 78)`);
    // (c) it sits inside the editor window and is small
    const { rect: r, win } = info;
    if (!(r.left >= win.left && r.right <= win.right && r.top >= win.top && r.bottom <= win.bottom)) reasons.push(`(c) chip ${JSON.stringify(r)} is outside the editor window ${JSON.stringify(win)}`);
    if (!(r.height <= 44 && r.width <= 64)) reasons.push(`(c) chip is ${r.width}x${r.height}, expected at most 64x44`);
    // (d) a click opens the list with the three actions
    const open = async () => { await cdp.eval(`document.querySelector(${JSON.stringify(`${chip} > button`)}).focus()`); if ((await chipInfo()).expanded !== "true") await click(cdp, `${chip} > button`); await sleep(150); }; // a real tap also focuses the button
    await open();
    let pop = await popover();
    if (!pop?.visible) reasons.push("(d) the popover is not visible after a click");
    else {
      if (!pop.text.includes("НЕ СОХРАНЕНО")) reasons.push("(d) the popover has no «НЕ СОХРАНЕНО» title");
      if (!pop.text.includes("База вирусов")) reasons.push("(d) the popover does not list «База вирусов»");
      for (const name of ["↶", "ОТМЕНИТЬ", "СОХРАНИТЬ"]) if (!pop.buttons.includes(name)) reasons.push(`(d) button ${name} missing: ${JSON.stringify(pop.buttons)}`);
    }
    if ((await chipInfo()).expanded !== "true") reasons.push("(d) aria-expanded is not true");
    // (e) Escape closes it and returns focus to the chip button
    await key(cdp, "Escape", 27);
    if (await popover()) reasons.push("(e) the popover is still open after Escape");
    if (!(await cdp.eval(`document.activeElement === document.querySelector(${JSON.stringify(`${chip} > button`)})`))) reasons.push("(e) focus did not return to the chip button");
    // (f) ОТМЕНИТЬ asks first; «НЕ ОТМЕНЯТЬ» keeps the draft
    await open();
    await clickText(cdp, ".editor-save-popover button", "ОТМЕНИТЬ");
    if (!(await waitFor(cdp, `!!document.querySelector("dialog.portia-dialog[open]")`, 2000))) reasons.push("(f) no discard dialog after ОТМЕНИТЬ");
    await clickText(cdp, "dialog.portia-dialog[open] button", "НЕ ОТМЕНЯТЬ");
    if (!(await waitFor(cdp, `!document.querySelector("dialog.portia-dialog[open]")`, 2000))) reasons.push("(f) the dialog did not close");
    if ((await chipInfo())?.text !== "1") reasons.push("(f) the chip lost its count after НЕ ОТМЕНЯТЬ");
    // (g) a pointer press outside closes the popover
    await cdp.eval(`document.activeElement?.blur()`);
    await open();
    if (!(await popover())) reasons.push("(g) the popover did not reopen");
    await cdp.eval(`document.querySelector(".editor-header").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
    await sleep(150);
    if (await popover()) reasons.push("(g) the popover is still open after a press on the header");
    // (h) a save the server would refuse (quest ends before it starts) turns the chip red and the reason jumps to the date
    serve(editorFixture({ broadcasts: [{ id: "b1", type: "quest", title: "Квест", body: "", published: false, important: false, startsAt: "2026-10-20", endsAt: "2026-10-10", conditions: "" }] }), 2); // a new revision each time: the page caches content by revision
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await typeX();
    info = await chipInfo();
    if (!info) reasons.push("(h) no chip with a blocked quest");
    else {
      if (!info.blocked) reasons.push("(h) the chip has no data-blocked");
      if (!info.text.startsWith("!")) reasons.push(`(h) chip text "${info.text}" does not start with «!»`);
      if (info.border !== "rgb(213, 84, 73)") reasons.push(`(h) chip border ${info.border}, expected rgb(213, 84, 73)`);
      await open();
      if (await cdp.eval(`!![...document.querySelectorAll(".editor-save-popover button")].find((b) => b.textContent.trim() === "СОХРАНИТЬ" && !b.disabled)`)) reasons.push("(h) СОХРАНИТЬ is enabled while the quest dates are wrong");
      if (!(await click(cdp, ".editor-save-popover .editor-save-fix"))) reasons.push("(h) no .editor-save-fix in the popover");
      else if (!(await waitFor(cdp, `document.activeElement?.matches("[data-broadcast-ends]")`, 3000))) reasons.push("(h) the date field did not get focus");
    }
    // (i) a save shows … then ✓ then no chip; the PUT is answered locally and counted
    serve(editorFixture(), 3, true);
    fakeSaves = 0;
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await typeX();
    await open();
    await clickText(cdp, ".editor-save-popover button", "СОХРАНИТЬ");
    if (!(await waitFor(cdp, `document.querySelector(".editor-save-chip > button")?.textContent === "…"`, 400))) reasons.push(`(i) the chip did not show … within 400 ms (${(await chipInfo())?.text})`);
    if (!(await waitFor(cdp, `document.querySelector(".editor-save-chip > button")?.textContent === "✓"`, 2000))) reasons.push(`(i) the chip did not show ✓ within 2 s (${(await chipInfo())?.text})`);
    if (!(await waitFor(cdp, `!document.querySelector(".editor-save-chip")`, 4000))) reasons.push("(i) the chip is still there 4 s after the save");
    if (fakeSaves !== 1) reasons.push(`(i) fakeSaves is ${fakeSaves}, expected 1`);
    serve(editorFixture(), 10);
    // (j)-(l) phone stacking at two sizes: chip, format sheet, bottom nav and the ✎ button never overlap
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const boxes = () => cdp.eval(`(() => { const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }; return { chip: box(document.querySelector(".editor-save-chip > button")), sheet: box(document.querySelector(".floating-text-format")), launch: box(document.querySelector(".global-format-launch > button")), w: innerWidth, h: innerHeight }; })()`);
    const noOverlap = (label, b) => {
      if (!b.chip) { reasons.push(`${label} no chip`); return; }
      const nav = { left: 0, right: b.w, top: b.h - 44, bottom: b.h };
      if (hit(b.chip, nav)) reasons.push(`${label} the chip overlaps the bottom nav`);
      if (b.sheet && hit(b.chip, b.sheet)) reasons.push(`${label} the chip overlaps the format sheet`);
      if (b.launch && hit(b.chip, b.launch)) reasons.push(`${label} the chip overlaps the ✎ button`);
    };
    for (const [w, h] of [[390, 844], [360, 640]]) {
      const at = `${w}x${h}`;
      await phone(cdp, w, h);
      await load(cdp);
      if (!(await openEditor(cdp))) { await desktop(cdp); return; }
      await click(cdp, ".editor-record-row > button:last-child");
      await sleep(300);
      await typeX();
      let b = await boxes();
      if (!b.chip) { reasons.push(`(j) ${at}: no chip`); continue; }
      if (Math.abs(b.chip.bottom - (b.h - 52)) > 1) reasons.push(`(j) ${at}: chip bottom ${b.chip.bottom}, expected ${b.h - 52}`);
      if (Math.abs(b.chip.right - (b.w - 54)) > 1) reasons.push(`(j) ${at}: chip right ${b.chip.right}, expected ${b.w - 54}`);
      if (b.chip.width < 43.5 || b.chip.height < 43.5) reasons.push(`(j) ${at}: chip is ${b.chip.width}x${b.chip.height}, expected at least 44x44`);
      noOverlap(`(j) ${at}:`, b);
      // (k) with the sheet open the chip sits 8px above it
      await clickText(cdp, ".dossier-tabs button", "Описание");
      await waitFor(cdp, `!!document.querySelector('.formatted-rich-input[data-area="lead"]')`, 3000);
      await cdp.eval(`document.querySelector('.formatted-rich-input[data-area="lead"]').focus()`);
      await click(cdp, ".global-format-launch > button");
      if (!(await waitFor(cdp, `!!document.querySelector(".floating-text-format")`, 3000))) { reasons.push(`(k) ${at}: the sheet did not open`); continue; }
      await sleep(250);
      b = await boxes();
      if (!b.chip || !b.sheet) { reasons.push(`(k) ${at}: chip or sheet missing`); continue; }
      if (!(b.chip.bottom <= b.sheet.top - 7)) reasons.push(`(k) ${at}: chip bottom ${b.chip.bottom} is not 7px above the sheet top ${b.sheet.top}`);
      noOverlap(`(k) ${at}:`, b);
      // (l) folded, the chip sits 96px above the bottom
      await click(cdp, "[data-sheet-toggle]"); await sleep(250);
      b = await boxes();
      if (!b.chip) { reasons.push(`(l) ${at}: no chip`); continue; }
      if (Math.abs(b.chip.bottom - (b.h - 96)) > 1) reasons.push(`(l) ${at}: chip bottom ${b.chip.bottom}, expected ${b.h - 96}`);
      noOverlap(`(l) ${at}:`, b);
    }
    await desktop(cdp);
  },
  async sections(cdp) {
    serve(sectionsFixture(), 20);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    const top = '.flat-editor-form > .nested-editor-card';
    const tocCount = `document.querySelectorAll("nav.editor-toc ol button").length`;
    const toggle = (n) => `${top}:nth-of-type(${n}) > .nested-editor-head .nested-editor-toggle`;
    // (a) on entry every top-level card is collapsed to its header
    await clickText(cdp, ".editor-tabs button", "Информация");
    if (!(await waitFor(cdp, `document.querySelectorAll(${JSON.stringify(top)}).length === 6`, 3000))) { reasons.push("(a) the info tab did not show 6 section cards"); return; }
    const a = await cdp.eval(`(() => ({ bodies: [...document.querySelectorAll(${JSON.stringify(top + " > .nested-editor-body")})].map((b) => b.hidden && getComputedStyle(b).display === "none"), toggles: [...document.querySelectorAll(${JSON.stringify(top + " > .nested-editor-head .nested-editor-toggle")})].map((b) => b.getAttribute("aria-expanded")) }))()`);
    if (a.bodies.length !== 6 || a.bodies.some((hidden) => !hidden)) reasons.push(`(a) bodies hidden: ${JSON.stringify(a.bodies)}`);
    if (a.toggles.length !== 6 || a.toggles.some((v) => v !== "false")) reasons.push(`(a) aria-expanded: ${JSON.stringify(a.toggles)}`);
    // (c) the 200-character name is one line with «…», the full name in title, and never reaches «Удалить» or the card edge
    const c = await cdp.eval(`(() => {
      const card = document.querySelectorAll(${JSON.stringify(top)})[2];
      const head = card.querySelector(":scope > .nested-editor-head");
      const span = head.querySelector(".nested-editor-title");
      const del = head.querySelector(".nested-editor-actions button");
      const s = span.getBoundingClientRect(), d = del.getBoundingClientRect(), h = head.getBoundingClientRect(), k = card.getBoundingClientRect();
      return { over: span.scrollWidth > span.clientWidth, title: span.title, overlap: s.left < d.right && d.left < s.right && s.top < d.bottom && d.top < s.bottom, headRight: h.right, cardRight: k.right, delVisible: d.width > 0 };
    })()`);
    if (!c.over) reasons.push("(c) the long name is not cut (scrollWidth <= clientWidth)");
    if (c.title !== LONG) reasons.push("(c) the title attribute is not the full name");
    if (c.overlap) reasons.push("(c) the name overlaps «Удалить»");
    if (!c.delVisible) reasons.push("(c) «Удалить» is not visible");
    if (c.headRight > c.cardRight + 0.5) reasons.push(`(c) the head (${c.headRight}) sticks out of the card (${c.cardRight})`);
    // (d) a click opens the section, another closes it
    const body1 = `document.querySelectorAll(${JSON.stringify(top + " > .nested-editor-body")})[0].hidden`;
    await click(cdp, toggle(1));
    if (await cdp.eval(body1)) reasons.push("(d) the first click did not show the body");
    await click(cdp, toggle(1));
    if (!(await cdp.eval(body1))) reasons.push("(d) the second click did not hide the body");
    // (b) the TOC lists sections and subsections; one click expands the section and brings it to the top
    const tocItems = await cdp.eval(tocCount);
    if (tocItems !== 12) reasons.push(`(b) ${tocItems} TOC items, expected 12`);
    await click(cdp, "nav.editor-toc .editor-toc-bar button");
    await clickText(cdp, "nav.editor-toc ol button", "Раздел 4");
    const body4 = `document.querySelectorAll(${JSON.stringify(top + " > .nested-editor-body")})[3].hidden`;
    if (await cdp.eval(body4)) reasons.push("(b) section 4 is still folded after its TOC entry");
    if ((await cdp.eval(`document.querySelector(${JSON.stringify(toggle(4))}).getAttribute("aria-expanded")`)) !== "true") reasons.push("(b) section 4's toggle is not aria-expanded");
    const placed = await waitFor(cdp, `(() => { const c = document.querySelectorAll(${JSON.stringify(top)})[3].getBoundingClientRect(); const e = document.querySelector(".content-editor").getBoundingClientRect(); return c.top >= e.top && c.top <= e.top + 120; })()`, 1500);
    if (!placed) reasons.push(`(b) section 4 did not reach the top of the editor: ${await cdp.eval(`(() => { const c = document.querySelectorAll(${JSON.stringify(top)})[3].getBoundingClientRect(); const e = document.querySelector(".content-editor").getBoundingClientRect(); return Math.round(c.top - e.top); })()`)}px below it`);
    // (e) РАЗВЕРНУТЬ ВСЕ opens every body, СВЕРНУТЬ ВСЕ folds every body
    const hiddenCount = () => cdp.eval(`[...document.querySelectorAll(".nested-editor-body")].filter((b) => b.hidden).length`);
    await clickText(cdp, "nav.editor-toc .editor-toc-bar button", "РАЗВЕРНУТЬ ВСЕ");
    if ((await hiddenCount()) !== 0) reasons.push(`(e) ${await hiddenCount()} bodies still folded after РАЗВЕРНУТЬ ВСЕ`);
    await clickText(cdp, "nav.editor-toc .editor-toc-bar button", "СВЕРНУТЬ ВСЕ");
    const total = await cdp.eval(`document.querySelectorAll(".nested-editor-body").length`);
    if ((await hiddenCount()) !== total) reasons.push(`(e) ${total - await hiddenCount()} bodies still open after СВЕРНУТЬ ВСЕ`);
    // (g) an expanded card is shown folded while it is dragged and the drag lands on the right row
    const titles = () => cdp.eval(`[...document.querySelectorAll(${JSON.stringify(top + " > .nested-editor-head .nested-editor-title")})].map((e) => e.textContent)`);
    await click(cdp, toggle(2));
    await cdp.eval(`(() => { const h = document.querySelectorAll(${JSON.stringify(top)})[1].querySelector(":scope > .nested-editor-head .order-drag-handle"); h.scrollIntoView({ block: "center" }); const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await sleep(300);
    const grab = await cdp.eval(`(() => { const h = document.querySelectorAll(${JSON.stringify(top)})[1].querySelector(":scope > .nested-editor-head .order-drag-handle"); const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const at = (type, x, y, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });
    await at("mouseMoved", grab.x, grab.y, { button: "none" });
    await at("mousePressed", grab.x, grab.y, { buttons: 1, clickCount: 1 });
    await sleep(250);
    const folded = await cdp.eval(`(() => { const c = document.querySelectorAll(${JSON.stringify(top)})[1]; return { display: getComputedStyle(c.querySelector(":scope > .nested-editor-body")).display, dragging: !!c.querySelector(':scope > .nested-editor-head .order-drag-handle[data-dragging="true"]') }; })()`);
    if (!folded.dragging) reasons.push("(g) the drag did not start");
    if (folded.display !== "none") reasons.push(`(g) the dragged card body is "${folded.display}" during the drag, expected none`);
    const third = await cdp.eval(`(() => { const r = document.querySelectorAll(${JSON.stringify(top)})[2].getBoundingClientRect(); return { top: r.top, height: r.height }; })()`);
    const to = { x: grab.x, y: third.top + third.height * 0.8 };
    for (let step = 1; step <= 6; step += 1) await at("mouseMoved", grab.x, grab.y + ((to.y - grab.y) * step) / 6, { buttons: 1 });
    await at("mouseReleased", to.x, to.y, { buttons: 0, clickCount: 1 });
    await sleep(300);
    const order = await titles();
    if (order[2] !== "Раздел 2") reasons.push(`(g) the dragged section is not third: ${JSON.stringify(order.map((t) => t?.slice(0, 12)))}`);
    // (f) a section made with the add button opens expanded with its title field in view
    await clickText(cdp, ".flat-editor-form > button", "+ ДОБАВИТЬ РАЗДЕЛ");
    await waitFor(cdp, `document.querySelectorAll(${JSON.stringify(top)}).length === 7`, 2000);
    const added = await cdp.eval(`(() => { const cards = document.querySelectorAll(${JSON.stringify(top)}); const c = cards[cards.length - 1]; const input = c?.querySelector(":scope > .nested-editor-body input"); const r = input?.getBoundingClientRect(); return { count: cards.length, expanded: c?.querySelector(":scope > .nested-editor-head .nested-editor-toggle")?.getAttribute("aria-expanded"), visible: !!r && r.width > 0 && r.height > 0 }; })()`);
    if (added.count !== 7) reasons.push(`(f) ${added.count} section cards after the add, expected 7`);
    if (added.expanded !== "true") reasons.push(`(f) the new section is aria-expanded ${added.expanded}`);
    if (!added.visible) reasons.push("(f) the new section's title input is not visible");
    // (i) a 150-character virus name stays inside the aside as one line with «…»
    serve(sectionsFixture(), 21);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await waitFor(cdp, `document.querySelectorAll(".editor-record-row").length === 6`, 3000);
    const v = await cdp.eval(`(() => { const s = [...document.querySelectorAll(".editor-record-list strong")].find((e) => e.textContent === ${JSON.stringify(LONG_VIRUS)}); if (!s) return null; const a = document.querySelector(".editor-record-list").getBoundingClientRect(); return { over: s.scrollWidth > s.clientWidth, title: s.title, right: s.getBoundingClientRect().right, asideRight: a.right }; })()`);
    if (!v) reasons.push("(i) the long virus is not listed");
    else {
      if (!v.over) reasons.push("(i) the long virus name is not cut");
      if (v.title !== LONG_VIRUS) reasons.push("(i) the virus name has no full-name title");
      if (v.right > v.asideRight + 0.5) reasons.push(`(i) the name (${v.right}) sticks out of the aside (${v.asideRight})`);
    }
    // (o) the virus list gets the same TOC (no fold buttons); an entry opens that record and the rows stay one line
    const virusToc = await cdp.eval(`(() => ({ items: document.querySelectorAll(".editor-record-list nav.editor-toc ol button").length, fold: [...document.querySelectorAll(".editor-record-list nav.editor-toc button")].some((b) => /ВСЕ/.test(b.textContent)) }))()`);
    if (virusToc.items !== 6) reasons.push(`(o) ${virusToc.items} virus TOC items, expected 6`);
    if (virusToc.fold) reasons.push("(o) the virus TOC has fold buttons");
    await click(cdp, ".editor-record-list nav.editor-toc .editor-toc-bar button");
    await clickText(cdp, ".editor-record-list nav.editor-toc ol button", "Вирус 5");
    const fifth = await cdp.eval(`(() => { const row = document.querySelectorAll(".editor-record-row")[4]; return { active: row.querySelector(":scope > button:last-child").classList.contains("active"), white: getComputedStyle(row.querySelector("strong")).whiteSpace }; })()`);
    if (!fifth.active) reasons.push("(o) the 5th virus row is not active after its TOC entry");
    if (fifth.white !== "nowrap") reasons.push(`(o) the row name wraps (white-space ${fifth.white})`);
    // (p) Корзина: 5 entries, the 4th entry opens the 4th row
    await clickText(cdp, ".editor-tabs button", "Корзина");
    await waitFor(cdp, `document.querySelectorAll(".editor-record-row").length === 5`, 3000);
    const recycleItems = await cdp.eval(tocCount);
    if (recycleItems !== 5) reasons.push(`(p) ${recycleItems} Корзина TOC items, expected 5`);
    await click(cdp, ".editor-record-list nav.editor-toc .editor-toc-bar button");
    await clickText(cdp, ".editor-record-list nav.editor-toc ol button", "Файл 2");
    const fourth = await cdp.eval(`document.getElementById("card-file:f2")?.querySelector(":scope > button:last-child")?.classList.contains("active") ?? null`);
    if (fourth !== true) reasons.push(`(p) the 4th Корзина row is not active after its TOC entry (${fourth})`);
    // (m) Сводка cards are folded and keep «Удалить» in sight
    await clickText(cdp, ".editor-tabs button", "Сводка");
    await waitFor(cdp, `document.querySelectorAll("[data-broadcast-id]").length === 6`, 3000);
    const m = await cdp.eval(`(() => { const cards = [...document.querySelectorAll("[data-broadcast-id]")]; const del = cards[0]?.querySelector(":scope > .nested-editor-head .nested-editor-actions button")?.getBoundingClientRect(); return { count: cards.length, folded: cards.every((c) => c.querySelector(":scope > .nested-editor-body").hidden), delVisible: !!del && del.width > 0 }; })()`);
    if (m.count !== 6 || !m.folded) reasons.push(`(m) Сводка cards: ${m.count}, all folded ${m.folded}`);
    if (!m.delVisible) reasons.push("(m) «Удалить» of the first card is not visible");
    // (h) Сводка: a TOC with 6 items; the 5th entry opens that card
    const newsToc = await cdp.eval(tocCount);
    if (newsToc !== 6) reasons.push(`(h) ${newsToc} Сводка TOC items, expected 6`);
    await click(cdp, "nav.editor-toc .editor-toc-bar button");
    await clickText(cdp, "nav.editor-toc ol button", "Новость 5");
    if (await cdp.eval(`document.querySelector('[data-broadcast-id="n5"] > .nested-editor-body').hidden`)) reasons.push("(h) news card 5 is still folded after its TOC entry");
    // (k) no sections: the empty line names the real button
    serve(sectionsFixture({ sections: 0 }), 22);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await clickText(cdp, ".editor-tabs button", "Информация");
    const empty = await cdp.eval(`(() => { const e = document.querySelector(".flat-editor-form .editor-empty"); return e ? e.textContent : null; })()`);
    if (!empty || !empty.includes("Разделов пока нет") || !empty.includes("+ ДОБАВИТЬ РАЗДЕЛ")) reasons.push(`(k) empty line: ${JSON.stringify(empty)}`);
    if (await cdp.eval(`!!document.querySelector("nav.editor-toc")`)) reasons.push("(k) a TOC is shown for an empty list");
    // (l) 4 sections and 4 viruses: no TOC anywhere; one section: its ≡ is there and dragging it changes nothing
    serve(sectionsFixture({ sections: 4, noSubsections: true, viruses: 4 }), 23);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    if (await cdp.eval(`!!document.querySelector("nav.editor-toc")`)) reasons.push("(l) a TOC is shown for 4 viruses");
    await clickText(cdp, ".editor-tabs button", "Информация");
    await waitFor(cdp, `document.querySelectorAll(${JSON.stringify(top)}).length === 4`, 3000);
    if (await cdp.eval(`!!document.querySelector("nav.editor-toc")`)) reasons.push("(l) a TOC is shown for 4 sections");
    serve(sectionsFixture({ sections: 1, noSubsections: true }), 24);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await clickText(cdp, ".editor-tabs button", "Информация");
    await waitFor(cdp, `document.querySelectorAll(${JSON.stringify(top)}).length === 1`, 3000);
    const lone = await cdp.eval(`(() => { const h = document.querySelector(${JSON.stringify(top + " > .nested-editor-head .order-drag-handle")}); if (!h) return null; h.scrollIntoView({ block: "center" }); return true; })()`);
    if (!lone) reasons.push("(l) the only section has no ≡ handle");
    else {
      await sleep(300);
      const grab1 = await cdp.eval(`(() => { const r = document.querySelector(${JSON.stringify(top + " > .nested-editor-head .order-drag-handle")}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      const at1 = (type, y, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x: grab1.x, y, button: "left", ...extra });
      await at1("mouseMoved", grab1.y, { button: "none" });
      await at1("mousePressed", grab1.y, { buttons: 1, clickCount: 1 });
      await sleep(250);
      for (let step = 1; step <= 4; step += 1) await at1("mouseMoved", grab1.y + step * 15, { buttons: 1 });
      await at1("mouseReleased", grab1.y + 60, { buttons: 0, clickCount: 1 });
      await sleep(300);
      if (await cdp.eval(`!!document.querySelector(".editor-save-chip")`)) reasons.push("(l) dragging the only section marked the draft changed");
    }
    // (n) on a phone the TOC sticks 44px down, under the system bar
    serve(sectionsFixture(), 25);
    await phone(cdp);
    await load(cdp);
    if (!(await openEditor(cdp))) { await desktop(cdp); return; }
    await clickText(cdp, ".editor-tabs button", "Информация");
    await waitFor(cdp, `!!document.querySelector("nav.editor-toc")`, 3000);
    await cdp.eval("window.scrollBy(0, 400)");
    await sleep(200);
    const phoneToc = await cdp.eval(`(() => { const t = document.querySelector("nav.editor-toc"); if (!t) return null; return { top: getComputedStyle(t).top, small: [...t.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 43).length }; })()`);
    if (!phoneToc) reasons.push("(n) no TOC on the phone");
    else {
      if (phoneToc.top !== "44px") reasons.push(`(n) the phone TOC top is ${phoneToc.top}, expected 44px`);
      if (phoneToc.small) reasons.push(`(n) ${phoneToc.small} TOC buttons under 44px tall on the phone`);
    }
    await desktop(cdp);
  },
  async panel(cdp) {
    serve(editorFixture(), 1);
    await load(cdp);
    await cdp.eval(`localStorage.removeItem(${JSON.stringify(panelKey)})`);
    if (!(await openEditor(cdp))) return;
    if (!(await openPanel(cdp))) return;
    // (a) the panel is a layer of the desktop above the windows
    const layer = await cdp.eval(`(() => { const e = document.querySelector(".floating-text-format"); return { parent: e.parentElement.id, z: getComputedStyle(e).zIndex }; })()`);
    if (layer.parent !== "desktop") reasons.push(`(a) panel parent is "${layer.parent}", expected "desktop"`);
    if (layer.z !== "950") reasons.push(`(a) panel z-index is ${layer.z}, expected 950`);
    // (b) dragged by its header out of the editor window
    const windowLeft = await cdp.eval(`document.querySelector(".editor-window").getBoundingClientRect().left`);
    await drag(cdp, await headerPoint(cdp), { x: 40, y: 80 });
    let rect = await panelRect(cdp);
    if (!(rect.left < windowLeft)) reasons.push(`(b) panel left ${rect.left} is not left of the editor window ${windowLeft}`);
    const top = await cdp.eval(`(() => { const h = document.querySelector(".floating-text-format > header").getBoundingClientRect(); const e = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2); return !!e?.closest(".floating-text-format"); })()`);
    if (!top) reasons.push("(b) the panel header is not topmost at its centre");
    // (c) the clamp keeps 64px and the top edge on screen
    await drag(cdp, await headerPoint(cdp, "right"), { x: 1, y: 1 });
    rect = await panelRect(cdp);
    if (!(rect.right >= 63.5)) reasons.push(`(c) up-left: right ${rect.right} < 64`);
    if (!(rect.top >= 0)) reasons.push(`(c) up-left: top ${rect.top} < 0`);
    // the drag must have reached the limit, else the bounds above were never tested
    if (Math.abs(rect.right - 64) > 1 || Math.abs(rect.top) > 1) reasons.push(`(c) up-left: the drag stopped short of the clamp (right ${rect.right}, top ${rect.top})`);
    const edge = await cdp.eval(`({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight })`);
    // the header's left end is off screen after the first drag, so the panel is first walked right by its visible end
    await drag(cdp, await headerPoint(cdp, "right"), { x: edge.w - 1, y: edge.h / 2 });
    await drag(cdp, await headerPoint(cdp, "left"), { x: edge.w - 1, y: edge.h - 1 });
    rect = await panelRect(cdp);
    let size = edge;
    if (!(rect.left <= size.w - 63.5)) reasons.push(`(c) down-right: left ${rect.left} > ${size.w - 64}`);
    if (!(rect.top <= size.h - 63.5)) reasons.push(`(c) down-right: top ${rect.top} > ${size.h - 64}`);
    if (Math.abs(rect.left - (size.w - 64)) > 1 || Math.abs(rect.top - (size.h - 64)) > 1) reasons.push(`(c) down-right: the drag stopped short of the clamp (left ${rect.left}, top ${rect.top})`);
    // (d) the place is stored and survives a reload
    await drag(cdp, await headerPoint(cdp, 0), { x: 400, y: 300 });
    const before = await panelRect(cdp);
    const stored = await cdp.eval(`(() => { try { const v = JSON.parse(localStorage.getItem(${JSON.stringify(panelKey)})); return Number.isFinite(v?.right) && Number.isFinite(v?.bottom); } catch { return false; } })()`);
    if (!stored) reasons.push("(d) portia-format-panel-v1 does not hold finite right/bottom");
    await load(cdp);
    if (!(await openEditor(cdp)) || !(await openPanel(cdp))) return;
    const after = await panelRect(cdp);
    if (["left", "top", "right", "bottom"].some((k) => Math.abs(after[k] - before[k]) > 1)) reasons.push(`(d) after reload the panel moved: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    // (e) windows clicked again and again never rise over the panel
    await cdp.eval(`(() => { const w = document.querySelector(".editor-window"); for (let i = 0; i < 150; i += 1) w.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); })()`);
    const still = await cdp.eval(`(() => { const h = document.querySelector(".floating-text-format > header").getBoundingClientRect(); const e = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2); return !!e?.closest(".floating-text-format"); })()`);
    if (!still) reasons.push(`(e) after 150 window clicks the panel is no longer topmost: ${await cdp.eval(`(() => { const h = document.querySelector(".floating-text-format > header").getBoundingClientRect(); const e = document.elementFromPoint(h.left + h.width / 2, h.top + h.height / 2); return (e?.className || e?.tagName) + " win z=" + document.querySelector(".editor-window").style.zIndex + " rect " + Math.round(h.left) + "," + Math.round(h.top); })()`)}`);
    // (f) the first place is 16px right of the editor window once the window has moved aside
    const title = await cdp.eval(`(() => { const r = document.querySelector(".editor-window .window-titlebar").getBoundingClientRect(); return { x: r.left + 120, y: r.top + r.height / 2 }; })()`);
    await drag(cdp, title, { x: title.x - 400, y: title.y });
    await closePanel(cdp); await forgetPlace(cdp);
    if (!(await openPanel(cdp))) return;
    let win = await windowBox(cdp); rect = await panelRect(cdp);
    if (Math.abs(rect.left - (win.right + 16)) > 2) reasons.push(`(f) panel left ${rect.left}, expected ${win.right + 16} (window right + 16)`);
    // (g) a maximized editor leaves no room beside it: the default corner, 16px from the right and 60px from the bottom
    await click(cdp, '.editor-window [data-window-action="maximize"]'); await sleep(600);
    await closePanel(cdp); await forgetPlace(cdp);
    if (!(await openPanel(cdp))) return;
    rect = await panelRect(cdp);
    size = await viewportSize(cdp);
    if (Math.abs(rect.right - (size.w - 16)) > 2 || Math.abs(rect.bottom - (size.h - 60)) > 2) reasons.push(`(g) maximized: right ${rect.right}, bottom ${rect.bottom}, expected ${size.w - 16}, ${size.h - 60}`);
    await click(cdp, '.editor-window [data-window-action="maximize"]'); await sleep(600);
    // (h) storage that throws still gives a usable panel
    const blocker = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const bad = ${JSON.stringify(panelKey)}; for (const m of ["getItem", "setItem"]) { const orig = Storage.prototype[m]; Storage.prototype[m] = function (k, ...rest) { if (k === bad) throw new Error("storage blocked"); return orig.call(this, k, ...rest); }; } })()` });
    await load(cdp);
    if (!(await openEditor(cdp)) || !(await openPanel(cdp))) return;
    rect = await panelRect(cdp);
    size = await viewportSize(cdp);
    if (!(rect.width > 0 && rect.right > 64 && rect.left < size.w - 64 && rect.top >= 0 && rect.top < size.h - 64)) reasons.push(`(h) blocked storage: the panel is not usable ${JSON.stringify(rect)}`);
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: blocker.identifier });
    // (i) a legacy value is read as a viewport place
    await load(cdp); // the page still carries the throwing storage of (h) until it is reloaded
    await cdp.eval(`localStorage.setItem(${JSON.stringify(panelKey)}, ${JSON.stringify(JSON.stringify({ right: 14, bottom: 72 }))})`);
    await load(cdp);
    if (!(await openEditor(cdp)) || !(await openPanel(cdp))) return;
    rect = await panelRect(cdp);
    size = await viewportSize(cdp);
    if (Math.abs(rect.right - (size.w - 14)) > 1 || Math.abs(rect.bottom - (size.h - 72)) > 1) reasons.push(`(i) legacy value: right ${rect.right}, bottom ${rect.bottom}, expected ${size.w - 14}, ${size.h - 72}`);
    // (j) arrow keys move the focused header 8px, Shift 32px
    await cdp.eval(`document.querySelector(".floating-text-format > header").focus()`);
    const left0 = (await panelRect(cdp)).left;
    await key(cdp, "ArrowLeft", 37);
    const left1 = (await panelRect(cdp)).left;
    if (Math.abs(left0 - left1 - 8) > 0.5) reasons.push(`(j) ArrowLeft moved ${left0 - left1}px, expected 8`);
    await key(cdp, "ArrowLeft", 37, 8);
    const left2 = (await panelRect(cdp)).left;
    if (Math.abs(left1 - left2 - 32) > 0.5) reasons.push(`(j) Shift+ArrowLeft moved ${left1 - left2}px, expected 32`);
    // (k) Esc from the header returns to the first lead field
    await key(cdp, "Escape", 27);
    const back = await cdp.eval(`document.activeElement === document.querySelector('.formatted-rich-input[data-area="lead"]')`);
    if (!back) reasons.push("(k) Esc did not return focus to the lead field");
    // (l) the panel hides with a minimized editor and comes back on restore
    await click(cdp, '.editor-window [data-window-action="minimize"]');
    if (!(await waitFor(cdp, `!document.querySelector(".floating-text-format")`, 3000))) reasons.push("(l) the panel is still shown while the editor is minimized");
    await click(cdp, '[data-taskbar-app="editor"]');
    if (!(await waitFor(cdp, `!!document.querySelector(".floating-text-format")`, 3000))) reasons.push("(l) the panel did not come back after restoring the editor");
    // (m) more clicks never raise a window that is already on top
    await sleep(500);
    const z0 = await cdp.eval(`document.querySelector(".editor-window").style.zIndex`);
    await cdp.eval(`(() => { const w = document.querySelector(".editor-window"); for (let i = 0; i < 50; i += 1) w.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); })()`);
    const z1 = await cdp.eval(`document.querySelector(".editor-window").style.zIndex`);
    if (z0 !== z1) reasons.push(`(m) editor window z went ${z0} -> ${z1} on repeated clicks`);
    // (n) on a phone the panel is a bottom sheet above the 44px nav, with no stored place
    await phone(cdp);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await click(cdp, ".editor-record-row > button:last-child");
    await sleep(300);
    await clickText(cdp, ".dossier-tabs button", "Описание");
    await waitFor(cdp, `!!document.querySelector('.formatted-rich-input[data-area="lead"]')`, 3000);
    await cdp.eval(`document.querySelector('.formatted-rich-input[data-area="lead"]').focus()`);
    await click(cdp, ".global-format-launch > button");
    if (!(await waitFor(cdp, `!!document.querySelector(".floating-text-format")`, 3000))) { reasons.push("(n) the phone panel did not open"); await desktop(cdp); return; }
    await sleep(200);
    const sheet = await cdp.eval(`(() => { const e = document.querySelector(".floating-text-format"); const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, height: r.height, w: innerWidth, h: innerHeight, styleRight: e.style.right, styleBottom: e.style.bottom }; })()`);
    if (Math.abs(sheet.bottom - (sheet.h - 44)) > 1) reasons.push(`(n) sheet bottom ${sheet.bottom}, expected ${sheet.h - 44}`);
    if (sheet.left !== 0 || Math.abs(sheet.right - sheet.w) > 1) reasons.push(`(n) sheet spans ${sheet.left}..${sheet.right}, expected 0..${sheet.w}`);
    if (sheet.height > Math.min(0.34 * sheet.h, 270) + 1) reasons.push(`(n) sheet height ${sheet.height} exceeds min(34svh, 270)`);
    if (sheet.styleRight !== "" || sheet.styleBottom !== "") reasons.push(`(n) inline place on a phone: right "${sheet.styleRight}", bottom "${sheet.styleBottom}"`);
    // (o) one tap folds it to a 44px strip, another unfolds it
    const toggleText = () => cdp.eval(`document.querySelector("[data-sheet-toggle]").textContent`);
    const fold = () => cdp.eval(`(() => { const e = document.querySelector(".floating-text-format"); const r = e.getBoundingClientRect(); return { collapsed: e.hasAttribute("data-collapsed"), height: r.height, bottom: r.bottom, h: innerHeight }; })()`);
    await click(cdp, "[data-sheet-toggle]"); await sleep(250);
    let folded = await fold();
    if (!folded.collapsed || Math.abs(folded.height - 44) > 1) reasons.push(`(o) after the tap: collapsed ${folded.collapsed}, height ${folded.height}`);
    if (!(await toggleText()).includes("ОФОРМЛЕНИЕ")) reasons.push("(o) the folded toggle does not read ОФОРМЛЕНИЕ");
    if (Math.abs(folded.bottom - (folded.h - 44)) > 1) reasons.push(`(o) the folded strip bottom ${folded.bottom}, expected ${folded.h - 44}`);
    await click(cdp, "[data-sheet-toggle]"); await sleep(250);
    folded = await fold();
    if (folded.collapsed || folded.height < 100) reasons.push(`(o) the second tap did not unfold: collapsed ${folded.collapsed}, height ${folded.height}`);
    // (p) no free drag
    const phoneBefore = await panelRect(cdp);
    const grab = await headerPoint(cdp, 0.3);
    await drag(cdp, grab, { x: grab.x - 100, y: grab.y - 200 });
    const phoneAfter = await panelRect(cdp);
    if (["left", "top", "right", "bottom"].some((k) => Math.abs(phoneAfter[k] - phoneBefore[k]) > 0.5)) reasons.push(`(p) the phone sheet moved: ${JSON.stringify(phoneBefore)} -> ${JSON.stringify(phoneAfter)}`);
    await desktop(cdp);
  },
  async table(cdp) {
    const row = (id, key, value) => ({ id, key, value });
    serve(fixture({
      ...editorFixture(),
      infoSections: [{ id: "s1", title: "Раздел 1", body: "", subsections: [{ id: "u1", title: "Подраздел 1", blocks: [
        { id: "t1", type: "table", rows: [row("r1", "A", "1"), row("r2", "B", "2"), row("r3", "C", "3")] },
        { id: "t2", type: "table", rows: [] },
      ] }] }],
    }), 30);
    await load(cdp);
    if (!(await openEditor(cdp))) return;
    await clickText(cdp, ".editor-tabs button", "Информация");
    const openAll = async () => { for (let pass = 0; pass < 4; pass += 1) await cdp.eval(`document.querySelectorAll('.nested-editor-toggle[aria-expanded="false"]').forEach((b) => b.click())`); };
    // Every card starts collapsed: open them all, nested ones last.
    await openAll();
    if (!(await waitFor(cdp, `document.querySelectorAll(".info-table-row").length === 3`, 3000))) { reasons.push("table: the three rows did not appear"); return; }
    const values = (field) => cdp.eval(`[...document.querySelectorAll(".info-table-row")].map((r) => r.querySelectorAll("input")[${field}].value).join("")`);
    const both = async () => `${await values(0)}|${await values(1)}`;
    const center = (selector, index = 0) => cdp.eval(`(() => { const e = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, height: r.height, width: r.width }; })()`);
    const ctrlZ = (type) => cdp.send("Input.dispatchKeyEvent", { type, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, modifiers: 2 });
    const undo = async () => { await ctrlZ("keyDown"); await ctrlZ("keyUp"); await sleep(150); };
    const at = (type, x, y, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", ...extra });
    const START = "ABC|123";
    // (a) the values are A, B, C and each row has a ≡ (34px on a PC)
    if ((await both()) !== START) reasons.push(`(a) rows read ${await both()}, expected ${START}`);
    const handles = await cdp.eval(`[...document.querySelectorAll(".info-table-row")].map((r) => !!r.querySelector(":scope > .order-drag-handle"))`);
    if (handles.length !== 3 || handles.some((h) => !h)) reasons.push(`(a) row handles: ${JSON.stringify(handles)}`);
    const size = await center(".info-table-row .order-drag-handle");
    if (Math.abs(size.width - 34) > 1) reasons.push(`(a) the row handle is ${size.width}px wide, expected 34`);
    // (b) hold row 3's ≡ 250 ms, move above row 1's middle: C, A, B
    const grab = await center(".info-table-row .order-drag-handle", 2);
    await at("mouseMoved", grab.x, grab.y, { button: "none" });
    await at("mousePressed", grab.x, grab.y, { buttons: 1, clickCount: 1 });
    await sleep(250);
    const rect1 = await cdp.eval(`(() => { const r = document.querySelectorAll(".info-table-row")[0].getBoundingClientRect(); return { top: r.top, height: r.height }; })()`);
    const to = { x: grab.x, y: rect1.top + rect1.height * 0.3 };
    for (let step = 1; step <= 14; step += 1) { await at("mouseMoved", grab.x, grab.y + ((to.y - grab.y) * step) / 14, { buttons: 1 }); await sleep(30); }
    await at("mouseReleased", to.x, to.y, { buttons: 0, clickCount: 1 });
    await sleep(300);
    if ((await both()) !== "CAB|312") reasons.push(`(b) after the drag rows read ${await both()}, expected CAB|312`);
    // (c) one Ctrl+Z puts it back
    await undo();
    if ((await both()) !== START) reasons.push(`(c) after Ctrl+Z rows read ${await both()}, expected ${START}`);
    // (d) ArrowDown on row 1's ≡: B, A, C, focus on the handle of the row that holds A
    await cdp.eval(`document.querySelectorAll(".info-table-row .order-drag-handle")[0].focus()`);
    await key(cdp, "ArrowDown", 40);
    await sleep(200);
    if ((await both()) !== "BAC|213") reasons.push(`(d) after ArrowDown rows read ${await both()}, expected BAC|213`);
    const focused = await cdp.eval(`[...document.querySelectorAll(".info-table-row")].findIndex((r) => r.querySelector(":scope > .order-drag-handle") === document.activeElement)`);
    if (focused !== 1) reasons.push(`(d) focus is on row index ${focused}, expected 1 (the row holding A)`);
    await undo();
    if ((await both()) !== START) reasons.push(`(d) after Ctrl+Z rows read ${await both()}, expected ${START}`);
    // (e) drag the «Признак» ≡ onto the «Значение» header: columns swap in every row, one undo restores
    const from = await center(".info-table-head [data-column='key'] .column-swap-handle");
    const target = await center(".info-table-head [data-column='value']");
    await at("mouseMoved", from.x, from.y, { button: "none" });
    await at("mousePressed", from.x, from.y, { buttons: 1, clickCount: 1 });
    for (let step = 1; step <= 6; step += 1) await at("mouseMoved", from.x + ((target.x - from.x) * step) / 6, from.y, { buttons: 1 });
    if (!(await cdp.eval(`!!document.querySelector(".info-table-head [data-column='value'][data-drop-target]")`))) reasons.push("(e) the target header has no drop indicator during the drag");
    await at("mouseReleased", target.x, target.y, { buttons: 0, clickCount: 1 });
    await sleep(200);
    if ((await both()) !== "123|ABC") reasons.push(`(e) after the column drag rows read ${await both()}, expected 123|ABC`);
    if (await cdp.eval(`!!document.querySelector("[data-drop-target], .column-swap-handle[data-dragging]")`)) reasons.push("(e) a drop marker is left after the release");
    await undo();
    if ((await both()) !== START) reasons.push(`(e) after Ctrl+Z rows read ${await both()}, expected ${START}`);
    // (f) ArrowLeft on the «Значение» ≡ swaps, again restores exactly
    await cdp.eval(`document.querySelector(".info-table-head [data-column='value'] .column-swap-handle").focus()`);
    await key(cdp, "ArrowLeft", 37); await sleep(150);
    if ((await both()) !== "123|ABC") reasons.push(`(f) after ArrowLeft rows read ${await both()}, expected 123|ABC`);
    await key(cdp, "ArrowLeft", 37); await sleep(150);
    if ((await both()) !== START) reasons.push(`(f) after the second ArrowLeft rows read ${await both()}, expected ${START}`);
    // (g) the empty table says how to begin and has no column handles
    const empty = await cdp.eval(`(() => { const body = [...document.querySelectorAll(".nested-editor-body")].find((b) => !b.querySelector(".nested-editor-body") && b.textContent.includes("Строк пока нет")); return body ? { text: body.querySelector(".editor-empty")?.textContent ?? "", handles: body.querySelectorAll(".column-swap-handle").length } : null; })()`);
    if (!empty) reasons.push("(g) the empty table block was not found");
    else {
      if (empty.text !== "Строк пока нет. Добавьте первую кнопкой «+ СТРОКА».") reasons.push(`(g) empty text: ${empty.text}`);
      if (empty.handles !== 0) reasons.push(`(g) the empty table has ${empty.handles} column handles`);
    }
    // (h) nothing was saved: the stub blocks every non-GET request to /api/* and records it as "write blocked", which already fails the check
    // (i) on a phone both kinds of ≡ are 44px
    await phone(cdp);
    await load(cdp);
    if (await openEditor(cdp)) {
      await clickText(cdp, ".editor-tabs button", "Информация");
      await openAll();
      await sleep(300);
      const small = await cdp.eval(`(() => { const h = document.querySelector(".info-table-row > .order-drag-handle"); const k = document.querySelector(".column-swap-handle"); return h && k ? { row: h.getBoundingClientRect().width, col: k.getBoundingClientRect().width } : null; })()`);
      if (!small) reasons.push("(i) no handles on the phone");
      else if (Math.abs(small.row - 44) > 1 || Math.abs(small.col - 44) > 1) reasons.push(`(i) phone handles ${small.row} and ${small.col}px, expected 44`);
    }
    await desktop(cdp);
  },
};

let edge;
const cleanup = () => {
  if (edge?.pid) { try { execFileSync("taskkill", ["/pid", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ } }
};
let code = 2;
try {
  if (!checks[CHECK]) throw new Error(`unknown check "${CHECK}" (known: ${Object.keys(checks).join(", ")})`);
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
  await checks[CHECK](cdp);
  ws.close();
  const ok = reasons.length === 0;
  console.log(JSON.stringify({ check: CHECK, ok, reasons }, null, 2));
  code = ok ? 0 : 1;
} catch (error) {
  console.error(`editor check failed: ${error.message}`);
  code = 2;
} finally {
  cleanup();
  await sleep(800);
  try { fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* temp dir, harmless */ }
}
process.exit(code);
