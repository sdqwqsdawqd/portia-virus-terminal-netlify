// Usage: node 10-desktop-check.mjs --check assistant [--url http://localhost:3124]   (later plans add accent, embeds, zoom, toast)
// Why: Phase 10 has no DOM test runner, so headless Edge drives the production build with GET /api/content stubbed
// from fixtures. Any non-GET request to /api/content is blocked and fails the check (nothing is ever saved).
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
const PORT = 9334;
const PROFILE = path.join(os.tmpdir(), "portia-desktop-check");
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

function installStub(cdp) {
  cdp.on("Runtime.exceptionThrown", (p) => reasons.push(`page exception: ${String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).slice(0, 120)}`));
  cdp.on("Fetch.requestPaused", (p) => {
    if (p.request.method !== "GET") {
      reasons.push("write to /api/content blocked");
      cdp.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }).catch(() => {});
      return;
    }
    const body = Buffer.from(JSON.stringify({ content: current.content, revision: current.revision, updatedAt: null })).toString("base64");
    cdp.send("Fetch.fulfillRequest", {
      requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "cache-control", value: "no-store" }],
      body,
    }).catch(() => {});
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
const bubble = `!!document.querySelector(".assistant-bubble")`;

const checks = {
  async assistant(cdp) {
    serve(fixture({ assistantAdvice: ["Первый совет", "Второй совет", "Третий совет"] }), 1);
    await load(cdp);
    if (!(await click(cdp, ".assistant-button"))) reasons.push("assistant button missing");
    if (!(await waitFor(cdp, bubble, 2000))) reasons.push("fixture A: bubble did not appear");

    serve(fixture({ assistantAdvice: [] }), 2); await refetch(cdp);
    if (!(await waitFor(cdp, `!${bubble}`, 2000))) reasons.push("fixture B: bubble stayed after the tip vanished");
    if (!(await cdp.eval(`!!document.querySelector(".desktop-assistant")`))) reasons.push("fixture B: desktop unmounted");
    await sleep(1500);
    await click(cdp, ".assistant-button"); await sleep(500);
    if (await cdp.eval(bubble)) reasons.push("fixture B: bubble shown for an empty list");

    serve(fixture({ assistantAdvice: ["   ", ""] }), 3); await refetch(cdp);
    await sleep(1500);
    await click(cdp, ".assistant-button"); await sleep(500);
    if (await cdp.eval(bubble)) reasons.push("fixture C: bubble shown for whitespace-only tips");
    if (!(await cdp.eval(`!!document.querySelector(".desktop-assistant")`))) reasons.push("fixture C: desktop unmounted");
  },
  async accent(cdp) {
    const KEY = "portia-desktop-settings-v1"; // value of desktopSettingsStorageKey
    const stored = (extra = {}) => JSON.stringify({ accent: "custom", customAccent: "#ff3366", wallpaper: "radar", iconSize: "standard", motion: "on", ...extra });
    const inline = (name) => `document.documentElement.style.getPropertyValue("${name}").trim()`;
    const colorButton = ".color-options > button:last-of-type";
    serve(fixture(), 1);
    await load(cdp);
    // The first page writes its defaults once settings are restored; seed only after that, or the seed is overwritten.
    await waitFor(cdp, `localStorage.getItem(${JSON.stringify(KEY)}) !== null`, 5000);
    await sleep(300);
    await cdp.eval(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(stored())}); true`);
    // (a) the head script must paint the saved colour while <body> does not exist yet (D-11)
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const record = () => { const d = document.documentElement; if (!d || window.__bootAccent || d.dataset.accent !== "custom" || !d.style.getPropertyValue("--accent-hue")) return;
        window.__bootAccent = { accent: d.dataset.accent, hue: d.style.getPropertyValue("--accent-hue"), bodyParsed: document.body !== null }; };
      new MutationObserver(record).observe(document, { attributes: true, childList: true, subtree: true, attributeFilter: ["style", "data-accent"] });
    })()` });
    await load(cdp);
    const boot = await cdp.eval(`window.__bootAccent || null`);
    if (!boot) reasons.push("(a) head script did not set accent custom with tokens");
    else if (boot.bodyParsed) reasons.push("(a) tokens appeared only after the body was parsed");
    // (b) the Settings option reflects the saved colour and opens the picker
    await click(cdp, '[data-shortcut="settings"]');
    if (!(await waitFor(cdp, `!!document.querySelector("${colorButton}")`, 3000))) reasons.push("(b) Settings colour row missing");
    if ((await cdp.eval(`document.querySelector("${colorButton}")?.getAttribute("aria-pressed")`)) !== "true") reasons.push("(b) «Свой» is not pressed after restore");
    if (!(await cdp.eval(`!!document.querySelector("${colorButton} .swatch.custom")?.style.background`))) reasons.push("(b) «Свой» swatch has no inline colour");
    await click(cdp, colorButton);
    if (!(await waitFor(cdp, `!!document.querySelector(".accent-picker .custom-color-picker")`, 2000))) reasons.push("(b) picker did not open");
    // (c) dragging recolours live, nothing is stored until release (D-08)
    const tealBefore = await cdp.eval(inline("--teal"));
    const rect = await cdp.eval(`(() => { const r = document.querySelector(".accent-picker .custom-color-board").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    const at = (fx, fy) => ({ x: rect.x + rect.w * fx, y: rect.y + rect.h * fy });
    const mouse = (type, point, extra = {}) => cdp.send("Input.dispatchMouseEvent", { type, x: point.x, y: point.y, button: "left", ...extra });
    await mouse("mousePressed", at(0.2, 0.2), { buttons: 1, clickCount: 1 });
    await mouse("mouseMoved", at(0.8, 0.4), { buttons: 1 });
    await sleep(300);
    if ((await cdp.eval(inline("--teal"))) === tealBefore) reasons.push("(c) --teal did not change while dragging");
    const savedDuringDrag = await cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).customAccent`);
    if (savedDuringDrag !== "#ff3366") reasons.push(`(c) stored colour changed before release: ${savedDuringDrag}`);
    await mouse("mouseReleased", at(0.8, 0.4), { buttons: 0, clickCount: 1 });
    await sleep(300);
    const hexField = await cdp.eval(`document.querySelector(".accent-picker .custom-color-value input").value.toLowerCase()`);
    const after = await cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);
    if (after.customAccent !== hexField) reasons.push(`(c) stored ${after.customAccent} is not the picked ${hexField}`);
    if (after.accent !== "custom") reasons.push("(c) stored accent is not custom after release");
    // (d) the picked colour survives a reload
    const tealPicked = await cdp.eval(inline("--teal"));
    await load(cdp);
    if ((await cdp.eval(inline("--teal"))) !== tealPicked) reasons.push("(d) --teal after reload differs from the picked colour");
    // (e) a tampered stored colour is ignored: nothing applied, nothing thrown (D-11)
    await sleep(600); // let the reloaded page finish its own write before overwriting the key
    await cdp.eval(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(stored({ customAccent: '"><img src=x onerror=alert(1)>' }))}); true`);
    await load(cdp);
    await sleep(2000);
    if (await cdp.eval(inline("--teal"))) reasons.push("(e) tampered colour left an inline --teal");
    if ((await cdp.eval(`document.documentElement.dataset.accent`)) === "custom") reasons.push("(e) tampered colour kept accent custom");
    await click(cdp, '[data-shortcut="settings"]');
    await waitFor(cdp, `!!document.querySelector("${colorButton}")`, 3000);
    if ((await cdp.eval(`document.querySelector("${colorButton}")?.getAttribute("aria-pressed")`)) !== "false") reasons.push("(e) «Свой» is pressed for a tampered colour");
    // (f)-(i) start again from a valid saved colour with the picker closed
    await sleep(600);
    await cdp.eval(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(stored())}); true`);
    await load(cdp);
    await click(cdp, '[data-shortcut="settings"]');
    await waitFor(cdp, `!!document.querySelector("${colorButton}")`, 3000);
    const html = `document.documentElement.dataset.accent`;
    const pressed = () => cdp.eval(`document.querySelector("${colorButton}")?.getAttribute("aria-pressed")`);
    const pickerOpen = `!!document.querySelector(".accent-picker .custom-color-picker")`;
    const savedSettings = () => cdp.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);
    const tealCustom = await cdp.eval(inline("--teal"));
    // (f) a preset replaces the colour but keeps the saved one
    await click(cdp, ".color-options > button:first-of-type");
    await waitFor(cdp, `${html} === "teal"`, 2000);
    if ((await cdp.eval(html)) !== "teal") reasons.push("(f) preset did not set data-accent");
    if (await cdp.eval(inline("--teal"))) reasons.push("(f) inline --teal stayed after a preset");
    if ((await savedSettings()).customAccent !== "#ff3366") reasons.push("(f) saved custom colour lost after a preset");
    if (await cdp.eval(pickerOpen)) reasons.push("(f) picker open after a preset");
    // (g) «Свой» brings the colour back and toggles the picker
    await click(cdp, colorButton);
    if (!(await waitFor(cdp, pickerOpen, 2000))) reasons.push("(g) picker did not open");
    if ((await cdp.eval(inline("--teal"))) !== tealCustom) reasons.push("(g) colour after switching back differs");
    await click(cdp, colorButton);
    if (!(await waitFor(cdp, `!${pickerOpen}`, 2000))) reasons.push("(g) second click did not close the picker");
    if ((await pressed()) !== "true") reasons.push("(g) «Свой» not pressed after closing the picker");
    // (h) Escape inside the picker closes only the picker and returns focus
    await click(cdp, colorButton);
    await waitFor(cdp, pickerOpen, 2000);
    await cdp.eval(`document.querySelector(".accent-picker .custom-color-value input").focus(); true`);
    const escape = (type) => cdp.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await escape("rawKeyDown"); await escape("keyUp");
    if (!(await waitFor(cdp, `!${pickerOpen}`, 2000))) reasons.push("(h) Escape did not close the picker");
    if (!(await cdp.eval(`!!document.querySelector(".settings-window")`))) reasons.push("(h) Escape closed the Settings window");
    if (!(await cdp.eval(`document.activeElement === document.querySelector("${colorButton}")`))) reasons.push("(h) focus did not return to «Свой»");
    // (i) factory reset clears the custom colour
    await click(cdp, ".factory-reset");
    await waitFor(cdp, `${html} === "teal"`, 2000);
    await sleep(300);
    const reset = await savedSettings();
    if (reset.accent !== "teal" || reset.customAccent !== "") reasons.push(`(i) reset left accent ${reset.accent} custom "${reset.customAccent}"`);
    if (await cdp.eval(inline("--teal"))) reasons.push("(i) inline --teal after reset");
    if (await cdp.eval(`!!document.querySelector("${colorButton} .swatch.custom")?.style.background`)) reasons.push("(i) «Свой» swatch kept a colour after reset");
    if (await cdp.eval(pickerOpen)) reasons.push("(i) picker open after reset");
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
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/content*", requestStage: "Request" }] });
  await checks[CHECK](cdp);
  ws.close();
  const ok = reasons.length === 0;
  console.log(JSON.stringify({ check: CHECK, ok, reasons }, null, 2));
  code = ok ? 0 : 1;
} catch (error) {
  console.error(`desktop check failed: ${error.message}`);
  code = 2;
} finally {
  cleanup();
  await sleep(800);
  try { fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* temp dir, harmless */ }
}
process.exit(code);
