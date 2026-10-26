// Usage: node 11-editor-check.mjs --check mark [--url http://localhost:3124]   (later plans add more checks)
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
