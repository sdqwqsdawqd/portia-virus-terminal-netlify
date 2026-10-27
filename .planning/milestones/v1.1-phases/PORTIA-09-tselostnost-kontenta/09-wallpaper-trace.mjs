// Usage: node 09-wallpaper-trace.mjs --wallpaper grid|gel|cells|radar [--motion on|off] [--seconds 10] [--url http://localhost:3124] [--expect-composited] [--expect-spider]
// Why: BG-01 / D-09. Headless Edge traces one wallpaper against the «Без фона» (quiet) baseline in the same run,
// so added cost shows up (dropped frames, paints, non-composited animations). Prints one JSON verdict; numbers and
// animation names only, never page text or storage values. Exit 0 ok, 1 not ok, 2 Edge or server unreachable.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
const has = (name) => args.includes(`--${name}`);
const URL_ = flag("url", "http://localhost:3124");
const KIND = flag("wallpaper", "grid");
const MOTION = flag("motion", "on");
const SECONDS = Number(flag("seconds", "10"));
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const PROFILE = path.join(os.tmpdir(), "portia-wallpaper-trace");
const FRAME_JITTER_ALLOWANCE = 2; // headless jitter: extra frames over 20 ms tolerated over the quiet baseline
const PAINT_ALLOWANCE = 1; // extra paints per second tolerated over the quiet baseline
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

async function measure(cdp, kind, motion) {
  const settings = JSON.stringify({ accent: "teal", wallpaper: kind, iconSize: "standard", motion });
  let loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: URL_ }); await loaded;
  await cdp.eval(`localStorage.setItem("portia-desktop-settings-v1", ${JSON.stringify(settings)}); sessionStorage.setItem("portia-boot-seen-v1", "1"); true`);
  loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.reload"); await loaded;
  await sleep(4000);
  await cdp.eval(`window.__frames = []; (() => { let last = performance.now(); const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })(); true`);
  const spiderState = `(() => { const e = document.querySelector(".wallpaper-spider"); if (!e) return null; const s = getComputedStyle(e); return [s.transform, s.translate, s.rotate].join("|"); })()`;
  const spiderStart = await cdp.eval(spiderState);
  const events = [];
  cdp.on("Tracing.dataCollected", (params) => events.push(...params.value));
  const done = cdp.once("Tracing.tracingComplete", 60000);
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.animations", transferMode: "ReportEvents" });
  // Animations that began before the trace emit no event; flipping html[data-motion] off and on lets the page's own CSS
  // create them again inside the window, so their compositing verdict is recorded (no manual cancel/play, which skews it).
  await sleep(300);
  if (MOTION === "on") {
    await cdp.eval(`document.documentElement.dataset.motion = "reduce"; true`);
    await sleep(200);
    await cdp.eval(`document.documentElement.dataset.motion = "full"; true`);
    await sleep(300);
  }
  const states = await cdp.eval(`document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".desktop-wallpaper-frame")).map((a) => (a.animationName || a.constructor.name) + ":" + a.playState)`);
  await sleep(SECONDS * 1000);
  await cdp.send("Tracing.end"); await done;
  const frames = (await cdp.eval("window.__frames")).slice(1);
  const spiderEnd = await cdp.eval(spiderState);
  const runningAnimations = await cdp.eval(`document.getAnimations().filter((a) => a.playState === "running" && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".desktop-wallpaper-frame")).length`);

  if (has("debug-events")) console.error(JSON.stringify([...new Set(events.map((e) => `${e.cat}:${e.name}`))].filter((n) => !/AnimationFrame/.test(n)).sort()));
  const mainThreads = new Set(events.filter((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain").map((e) => `${e.pid}:${e.tid}`));
  // An Animation is an async event: "b" carries its displayName, a later "n" carries compositeFailed (a bitmask), both under one id2.
  const names = new Map(), failures = new Map();
  for (const e of events) {
    if (e.name !== "Animation" || !e.id2) continue;
    const key = `${e.pid}:${e.id2.local}`;
    if (e.args?.data?.displayName) names.set(key, e.args.data.displayName);
    if (Number(e.args?.data?.compositeFailed) > 0) failures.set(key, Number(e.args.data.compositeFailed));
  }
  const animations = new Map();
  for (const [key, name] of names) animations.set(name, { composited: !failures.has(key) && (animations.get(name)?.composited ?? true), failed: failures.get(key) ?? animations.get(name)?.failed ?? 0 });
  return {
    frames: frames.length,
    maxFrameMs: Math.round(Math.max(0, ...frames) * 10) / 10,
    framesOver20: frames.filter((ms) => ms > 20).length,
    paintsPerSecond: Math.round((events.filter((e) => e.name === "Paint").length / SECONDS) * 10) / 10,
    longTasks: events.filter((e) => e.name === "RunTask" && e.dur > 50000 && mainThreads.has(`${e.pid}:${e.tid}`)).length,
    animations: [...animations].map(([name, state]) => ({ name, ...state })),
    runningAnimations,
    animationStatesAtStart: [...new Set(states)],
    spiderMoved: spiderStart === null ? null : spiderStart !== spiderEnd,
  };
}

let edge;
const cleanup = () => {
  if (edge?.pid) { try { execFileSync("taskkill", ["/pid", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ } }
};
let code = 2;
try {
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
  const baseline = await measure(cdp, "quiet", MOTION);
  const result = await measure(cdp, KIND, MOTION);
  ws.close();

  const reasons = [];
  if (MOTION === "on") {
    if (result.framesOver20 > baseline.framesOver20 + FRAME_JITTER_ALLOWANCE) reasons.push(`framesOver20 ${result.framesOver20} > baseline ${baseline.framesOver20} + ${FRAME_JITTER_ALLOWANCE}`);
    if (has("expect-composited")) {
      if (!result.animations.length) reasons.push("no animation events recorded");
      result.animations.filter((a) => !a.composited).forEach((a) => reasons.push(`${a.name} is not composited`));
      if (result.paintsPerSecond > baseline.paintsPerSecond + PAINT_ALLOWANCE) reasons.push(`paintsPerSecond ${result.paintsPerSecond} > baseline ${baseline.paintsPerSecond} + ${PAINT_ALLOWANCE}`);
    }
    if (has("expect-spider") && result.spiderMoved !== true) reasons.push("spider did not move");
  } else {
    if (result.runningAnimations !== 0) reasons.push(`${result.runningAnimations} wallpaper animations still running`);
    if (result.spiderMoved === true) reasons.push("spider moved with motion off");
    if (result.paintsPerSecond > baseline.paintsPerSecond + PAINT_ALLOWANCE) reasons.push(`paintsPerSecond ${result.paintsPerSecond} > baseline ${baseline.paintsPerSecond} + ${PAINT_ALLOWANCE}`);
  }
  const ok = reasons.length === 0;
  console.log(JSON.stringify({ kind: KIND, motion: MOTION, baseline, result, ok, reasons }, null, 2));
  code = ok ? 0 : 1;
} catch (error) {
  console.error(`trace failed: ${error.message}`);
  code = 2;
} finally {
  cleanup();
  await sleep(800);
  try { fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* temp dir, harmless */ }
}
process.exit(code);
