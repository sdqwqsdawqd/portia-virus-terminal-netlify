// Usage: node 11-editor-check.mjs --check mark|panel|savechip [--url http://localhost:3124]   (later plans add more checks)
// Why: Phase 11 has no DOM test runner, so headless Edge drives the production build. Inside the browser it launches,
// GET /api/access is answered {canEdit: true} and GET /api/content is served from fixtures; every non-GET request to /api/*
// is blocked and fails the check (nothing is ever saved, no login is needed). The stub is a CDP interception only: no app
// or server code knows about it.
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
let current = { content: fixture(), revision: 1 };
const serve = (content, revision) => { current = { content, revision }; };

/** One virus with plain text in both lead fields; the editor opens on it. */
const editorFixture = (overrides = {}) => fixture({
  viruses: [{ id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "Первое слово второе третье", physiology: "Четвёртое пятое шестое" }],
  infoSections: [], broadcasts: [], searchRecommendations: [],
  ...overrides,
});

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
const phone = async (cdp) => {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
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
