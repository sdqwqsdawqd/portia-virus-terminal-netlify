// Usage: node 12-editor-check.mjs --check tabs|revert|chips|all [--url http://localhost:3124]
// Why: the phase-12 editor rules (closed tabs vanish, a closure resets only the closed sections' drafts, saves send closed sections
// as stored) have no DOM test runner, so headless Edge drives the production build. Inside the browser it launches,
// GET /api/access is answered from current.access and GET /api/content from the current fixture. EVERY non-GET request to /api/*
// is blocked and recorded as a failure reason ("write blocked"), never forwarded, so nothing is ever saved and no login is needed.
// One exception: while current.fakeSave is set, a PUT /api/content is answered locally (Fetch.fulfillRequest after 800 ms,
// revision + 1), its body kept in savedBody and counted in fakeSaves; it is NEVER forwarded to the server.
// Plan 12-07 adds GET /api/editors (current.editors, current.tabsEnforced) and a PATCH /api/editors answered locally while
// current.fakePatch is set ({ delay, status, error?, code? }); its body and send/answer times are kept in `patches` and it is NEVER forwarded.
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
const PORT = 9336;
const PROFILE = path.join(os.tmpdir(), "portia-editor-check-12");
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
const ALL_TABS = ["viruses", "info", "broadcasts", "recycle", "search", "assistant", "employees"];
const without = (...ids) => ALL_TABS.filter((id) => !ids.includes(id));
const defaultAccess = () => ({ canEdit: true, canManageEditors: false, openTabs: [...ALL_TABS], tabsEnforced: true });

/** One virus, one broadcast, one info section; padded advice and search lines so a normalizing save would visibly rewrite them. */
const baseFixture = (overrides = {}) => ({
  viruses: [{ id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "", physiology: "" }],
  infoSections: [{ id: "s1", title: "Раздел 1", body: "Текст раздела", subsections: [] }],
  broadcasts: [{ id: "n1", type: "news", title: "Новость", body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }],
  searchRecommendations: ["  запрос  "],
  assistantAdvice: ["  совет  ", ""],
  ...overrides,
});

let revision = 0; // a new revision for every serve: the page caches content by revision, and a fake save caches revision + 1
let current = { content: baseFixture(), revision: 1, fakeSave: false, access: defaultAccess() };
let patches = []; // { body, sentAt, answeredAt } of every fake PATCH /api/editors
const baseEditors = () => [{ email: "ed@example.com", created_at: "2026-01-01T00:00:00Z", closedTabs: [], grantedTabs: [] }];
let fakeSaves = 0;
let savedBody = ""; // the body of the last fake save
const serve = (content, access = defaultAccess()) => { revision += 10; current = { content, revision, fakeSave: false, access, editors: baseEditors(), tabsEnforced: true, fakePatch: null }; patches = []; };

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
    if (p.request.method === "PUT" && pathname === "/api/content" && current.fakeSave) { fakeSaves += 1; savedBody = p.request.postData ?? Buffer.concat((p.request.postDataEntries ?? []).map((e) => Buffer.from(e.bytes ?? "", "base64"))).toString("utf8"); setTimeout(() => fulfil(p, { revision: current.revision + 1 }), 800); return; }
    if (p.request.method === "PATCH" && pathname === "/api/editors" && current.fakePatch) {
      const { delay = 300, status = 200, error = "", code } = current.fakePatch;
      let body = {}; try { body = JSON.parse(p.request.postData ?? "{}"); } catch { /* reported by the check's body comparison */ }
      const entry = { body, sentAt: Date.now(), answeredAt: 0 }; patches.push(entry);
      setTimeout(() => { entry.answeredAt = Date.now(); fulfil(p, status === 200 ? { editor: body } : { error, ...(code ? { code } : {}) }, status); }, delay);
      return;
    }
    if (p.request.method !== "GET") { reasons.push(`write blocked: ${p.request.method} ${pathname}`); block(p); return; }
    if (pathname === "/api/access") fulfil(p, current.access);
    else if (pathname === "/api/editors") fulfil(p, { editors: current.editors, tabsEnforced: current.tabsEnforced });
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

const STRIP = ".content-editor > .editor-tabs";
const stripLabels = (cdp) => cdp.eval(`[...document.querySelectorAll(${JSON.stringify(`${STRIP} > button`)})].map((b) => b.textContent.trim())`);
const keyChord = async (cdp, name, code, vk) => { for (const type of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type, key: name, code, windowsVirtualKeyCode: vk, modifiers: 2 }); await sleep(200); };
const ctrlZ = (cdp) => keyChord(cdp, "z", "KeyZ", 90);
const ctrlY = (cdp) => keyChord(cdp, "y", "KeyY", 89);
const typeInto = async (cdp, selector, text) => {
  const ok = await cdp.eval(`(() => { const i = document.querySelector(${JSON.stringify(selector)}); if (!i) return false; i.scrollIntoView({ block: "center" }); i.focus(); return true; })()`);
  if (!ok) return false;
  await cdp.send("Input.insertText", { text }); await sleep(250);
  return true;
};
const chipOpen = async (cdp) => {
  if (!(await cdp.eval(`!!document.querySelector(".editor-save-chip")`))) return false;
  if (!(await cdp.eval(`!!document.querySelector(".editor-save-popover")`))) await cdp.eval(`document.querySelector(".editor-save-chip > button").click()`);
  return waitFor(cdp, `!!document.querySelector(".editor-save-popover")`, 2000);
};
const popoverList = async (cdp) => (await chipOpen(cdp)) ? cdp.eval(`[...document.querySelectorAll(".editor-save-popover li")].map((n) => n.textContent.trim())`) : null;
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bootEditor = async (cdp, content, access) => { serve(content, access); await load(cdp); return openEditor(cdp); };

const checks = {
  async tabs(cdp) {
    // (a) closed Сводка and Сотрудники: no button for them, no Доступ for a non-owner
    if (!(await bootEditor(cdp, baseFixture(), { ...defaultAccess(), openTabs: without("broadcasts", "employees") }))) return;
    const labels = await stripLabels(cdp);
    const expected = ["База вирусов", "Информация", "Корзина", "Рекомендации", "Помощник"];
    if (!same(labels, expected)) reasons.push(`(a) strip reads ${JSON.stringify(labels)}, expected ${JSON.stringify(expected)}`);
    // (b) nothing open: the window stays with its own message and no controls
    if (!(await bootEditor(cdp, baseFixture(), { ...defaultAccess(), openTabs: [] }))) return;
    if (await cdp.eval(`!!document.querySelector(${JSON.stringify(STRIP)})`)) reasons.push("(b) a tab strip is shown with no tab open");
    if (!(await cdp.eval(`document.querySelector(".content-editor")?.textContent.includes("Владелец пока не открыл вам ни одного раздела")`))) reasons.push("(b) the «no tab open» message is missing");
    if (await cdp.eval(`!!document.querySelector(".global-format-launch, .editor-save-chip")`)) reasons.push("(b) format launcher or save chip is rendered with no tab open");
    // (c) the picked tab (Вирусы) is closed: the first open one shows and no virus field exists
    if (!(await bootEditor(cdp, baseFixture(), { ...defaultAccess(), openTabs: without("viruses") }))) return;
    const active = await cdp.eval(`document.querySelector(${JSON.stringify(`${STRIP} > button.active`)})?.textContent.trim() ?? null`);
    if (active !== "Информация") reasons.push(`(c) active tab is ${JSON.stringify(active)}, expected «Информация»`);
    if (await cdp.eval(`!!document.querySelector(".virus-editor-layout, .virus-editor-form")`)) reasons.push("(c) virus fields are in the DOM with «База вирусов» closed");
    if (await cdp.eval(`document.querySelector(".content-editor").textContent.includes("Альфа")`)) reasons.push("(c) a closed section's text is rendered");
  },
  async revert(cdp) {
    // (a) closure while both Сводка and a virus carry unsaved edits
    if (!(await bootEditor(cdp, baseFixture()))) return;
    await clickText(cdp, `${STRIP} > button`, "Сводка");
    await cdp.eval(`document.querySelector("#card-n1 .nested-editor-toggle")?.click()`);
    if (!(await typeInto(cdp, "[data-broadcast-title]", "Ы"))) { reasons.push("(a) no broadcast title field"); return; }
    await clickText(cdp, `${STRIP} > button`, "База вирусов");
    if (!(await typeInto(cdp, ".virus-editor-form input", "Х"))) { reasons.push("(a) no virus name field"); return; }
    const before = await popoverList(cdp);
    if (!before || before.length !== 2 || !before.includes("База вирусов") || !before.includes("Сводка")) reasons.push(`(a) before the closure the list reads ${JSON.stringify(before)}`);
    current.access = { ...defaultAccess(), openTabs: without("broadcasts") };
    if (!(await waitFor(cdp, `![...document.querySelectorAll(${JSON.stringify(`${STRIP} > button`)})].some((b) => b.textContent.trim().startsWith("Сводка"))`, 13000))) { reasons.push("(a) «Сводка» stayed in the strip for 13 s after the closure"); return; }
    const notice = await cdp.eval(`document.querySelector(".content-editor p.editor-guidance[role=status]")?.textContent ?? null`);
    if (!notice || !notice.includes("Сводка") || !notice.includes("несохранённые правки в нём сброшены")) reasons.push(`(a) notice reads ${JSON.stringify(notice)}`);
    let list = await popoverList(cdp);
    if (!same(list, ["База вирусов"])) reasons.push(`(a) after the closure the list reads ${JSON.stringify(list)}, expected ["База вирусов"]`);
    await ctrlZ(cdp);
    if (await cdp.eval(`!!document.querySelector(".editor-save-chip")`)) reasons.push("(a) one Ctrl+Z did not make the draft clean");
    await ctrlY(cdp);
    list = await popoverList(cdp);
    if (!same(list, ["База вирусов"])) reasons.push(`(a) after redo the list reads ${JSON.stringify(list)}, expected ["База вирусов"]`);
    const saved = await fakeSave(cdp);
    if (saved) {
      if (saved.broadcasts?.[0]?.title !== "Новость") reasons.push(`(a) the save carries broadcast title ${JSON.stringify(saved.broadcasts?.[0]?.title)}, expected the stored «Новость»`);
      if (!String(saved.viruses?.[0]?.name).includes("Х")) reasons.push(`(a) the save lost the open-section edit: virus name ${JSON.stringify(saved.viruses?.[0]?.name)}`);
    }
    // (b) the save normalization must not touch closed sections (no phantom diff)
    if (!(await bootEditor(cdp, baseFixture(), { ...defaultAccess(), openTabs: without("search", "assistant") }))) return;
    if (!(await typeInto(cdp, ".virus-editor-form input", "Х"))) { reasons.push("(b) no virus name field"); return; }
    let body = await fakeSave(cdp);
    if (body) {
      if (!same(body.assistantAdvice, ["  совет  ", ""])) reasons.push(`(b) closed assistantAdvice went out as ${JSON.stringify(body.assistantAdvice)}`);
      if (!same(body.searchRecommendations, ["  запрос  "])) reasons.push(`(b) closed searchRecommendations went out as ${JSON.stringify(body.searchRecommendations)}`);
    }
    if (!(await bootEditor(cdp, baseFixture()))) return;
    if (!(await typeInto(cdp, ".virus-editor-form input", "Х"))) { reasons.push("(b) no virus name field (all open)"); return; }
    body = await fakeSave(cdp);
    if (body && !same(body.assistantAdvice, ["совет"])) reasons.push(`(b) with everything open assistantAdvice is ${JSON.stringify(body.assistantAdvice)}, expected ["совет"]: the check cannot fail`);
    // (c) the bin keeps «ВОССТАНОВИТЬ В БАЗУ» disabled while the virus base is closed
    const bin = baseFixture({ recycledViruses: [{ id: "r1", name: "Архив 1", code: "R", status: "ИЗУЧЕН", external: "", physiology: "" }], recycleOrder: ["virus:r1"] });
    if (!(await bootEditor(cdp, bin, { ...defaultAccess(), openTabs: without("viruses") }))) return;
    await clickText(cdp, `${STRIP} > button`, "Корзина");
    await waitFor(cdp, `!!document.querySelector('[id="card-virus:r1"] > button:last-of-type')`, 3000);
    await click(cdp, '[id="card-virus:r1"] > button:last-of-type'); // the first button is the drag handle
    const found = await waitFor(cdp, `[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "ВОССТАНОВИТЬ В БАЗУ")`, 3000);
    const disabled = found ? await cdp.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "ВОССТАНОВИТЬ В БАЗУ").disabled`) : null;
    if (disabled !== true) reasons.push(`(c) the restore button disabled is ${JSON.stringify(disabled)}, expected true`);
  },
  async chips(cdp) {
    const ownerAccess = { ...defaultAccess(), canManageEditors: true };
    const CHIP = ".access-editor-list .access-tab-chip";
    const LABELS = ["База вирусов", "Информация", "Сводка", "Корзина", "Рекомендации", "Помощник", "Сотрудники"];
    const chipState = (cdp) => cdp.eval(`[...document.querySelectorAll(${JSON.stringify(CHIP)})].map((b) => b.getAttribute("aria-pressed"))`);
    const clickChip = (cdp, label) => cdp.eval(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(CHIP)})].find((n) => n.textContent.replace("✓ ", "").trim() === ${JSON.stringify(label)}); if (!e) return false; e.click(); return true; })()`);
    const openAccess = async (cdp, editors, tabsEnforced = true) => {
      serve(baseFixture(), ownerAccess); current.editors = editors; current.tabsEnforced = tabsEnforced; current.fakePatch = { delay: 300 };
      await load(cdp);
      if (!(await openEditor(cdp))) return false;
      if (!(await clickText(cdp, `${STRIP} > button`, "Доступ"))) { reasons.push("no «Доступ» tab for the owner"); return false; }
      if (!(await waitFor(cdp, `!!document.querySelector(${JSON.stringify(CHIP)})`, 5000))) { reasons.push("no chips in the «Доступ» list"); return false; }
      return true;
    };
    // (a) seven chips in registry order, all on; one click flips at once and saves the full lists
    if (!(await openAccess(cdp, baseEditors()))) return;
    const labels = await cdp.eval(`[...document.querySelectorAll(${JSON.stringify(CHIP)})].map((b) => b.textContent.replace("✓ ", "").trim())`);
    if (!same(labels, LABELS)) reasons.push(`(a) chips read ${JSON.stringify(labels)}, expected ${JSON.stringify(LABELS)}`);
    if (!same(await chipState(cdp), LABELS.map(() => "true"))) reasons.push("(a) not every chip starts on");
    await clickChip(cdp, "Сводка"); await sleep(100);
    if (!same(await chipState(cdp), LABELS.map((l) => l === "Сводка" ? "false" : "true"))) reasons.push("(a) the chip did not flip at once");
    if (!(await waitFor(cdp, `[...document.querySelectorAll(".access-editor-list [role=status]")].some((n) => n.textContent.trim() === "Сохранено")`, 3000))) reasons.push("(a) «Сохранено» did not appear in the row");
    if (patches.length !== 1 || !same(patches[0].body, { email: "ed@example.com", closedTabs: ["broadcasts"], grantedTabs: [] })) reasons.push(`(a) PATCH bodies ${JSON.stringify(patches.map((x) => x.body))}`);
  },
};

let edge;
const cleanup = () => {
  if (edge?.pid) { try { execFileSync("taskkill", ["/pid", String(edge.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ } }
};
let code = 2;
try {
  const ALL = ["tabs", "revert", "chips"];
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
    reasons.length = 0; fakeSaves = 0; savedBody = ""; patches = []; serve(baseFixture()); // each check starts from a clean verdict, fixture and access
    try { await checks[name](cdp); } catch (error) { reasons.push(`check threw: ${error.message}`); }
    results[name] = { ok: reasons.length === 0, reasons: [...reasons] };
  }
  ws.close();
  const ok = names.every((name) => results[name].ok);
  console.log(JSON.stringify(CHECK === "all" ? { check: "all", ok, results } : { check: CHECK, ok, reasons: results[CHECK].reasons }, null, 2));
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
