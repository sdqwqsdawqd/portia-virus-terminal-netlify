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
