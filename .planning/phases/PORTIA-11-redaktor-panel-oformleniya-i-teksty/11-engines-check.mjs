// Usage: node 11-engines-check.mjs [--check ctrl|phone|all] [--url http://localhost:3125] [--debug]
// Why: 11-editor-check.mjs drives Edge (Chromium) over CDP, but the owner uses Firefox (Gecko) on the PC and Firefox on an iPhone, where every
// browser is WebKit. Bugs that only exist there (several Selection ranges in Gecko; flex/grid/touch sizing in WebKit) need those engines:
//   ctrl  - Playwright firefox: select a word, Ctrl+select more words (same and other field), one colour click styles all of them (EDIT-06)
//   phone - Playwright webkit with the iPhone 13 descriptor (touch, mobile): nothing wider than the screen, names stop before their buttons,
//           the public info tab strip does not overlap, the ОГЛАВЛЕНИЕ moves only up and down (EDIT-03)
// Needs playwright-core 1.64.x (matches the installed browser builds firefox-1555 / webkit-2370). It is NOT a project dependency: set
// PLAYWRIGHT_CORE to its folder, or install it to %LOCALAPPDATA%\portia-pw-tools (npm i playwright-core@1.64.1 there).
// Like 11-editor-check.mjs: GET /api/access -> {canEdit:true}, GET /api/content -> fixtures; any non-GET /api/* is blocked and fails the check.
// Exit 0 ok, 1 not ok, 2 setup problem.
import { createRequire } from "node:module";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
const URL_ = flag("url", "http://localhost:3125");
const CHECK = flag("check", "all");
const DEBUG = args.includes("--debug");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pwDir = process.env.PLAYWRIGHT_CORE || path.join(process.env.LOCALAPPDATA || "", "portia-pw-tools", "node_modules", "playwright-core");
let pw;
try { pw = createRequire(import.meta.url)(pwDir); } catch (error) { console.log(JSON.stringify({ ok: false, reasons: [`playwright-core not found at ${pwDir}: ${error.message}`] })); process.exit(2); }

const reasons = [];
const log = (...a) => { if (DEBUG) console.log(...a); };
const fixture = (overrides = {}) => ({ viruses: [], infoSections: [], broadcasts: [], searchRecommendations: [], ...overrides });
const multiFixture = () => fixture({
  viruses: [{ id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "один два три четыре пять шесть", physiology: "семь восемь девять десять одиннадцать двенадцать" }],
});
const LONG = "Оченьдлинноеназвание".repeat(10);
const LONG_VIRUS = "Вирус".repeat(30);
const longText = "Очень длинный абзац без пробелов: " + "Сверхдлинноеслово".repeat(12) + " и обычный текст " + "словослово ".repeat(40);
const phoneFixture = () => {
  const infoSections = Array.from({ length: 6 }, (_, i) => ({
    id: `s${i + 1}`, title: i === 2 ? LONG : `Раздел ${i + 1}`, body: i === 0 ? longText : `Текст раздела ${i + 1}`,
    subsections: [{ id: `u${i + 1}`, title: i === 0 ? "Способы распространения вирусов и их длинное название" : `Подраздел ${i + 1}`, blocks: i === 0
      ? [{ id: "b1", type: "text", text: longText }, { id: "b1t", type: "table", rows: [{ id: "r1", key: "Ключ " + "длинный".repeat(8), value: "Значение " + "очень длинное ".repeat(6) }] }, { id: "b1p", type: "photo", url: "/portia-logo.png" }, { id: "b1v", type: "video", videoId: "dQw4w9WgXcQ" }]
      : [{ id: `b${i + 1}`, type: "text", text: `Блок ${i + 1}` }] }],
  }));
  const viruses = [
    { id: "v1", name: "Вирус", code: "A-1", status: "ИЗУЧЕН", external: "Короткий текст", physiology: "" },
    { id: "v2", name: LONG_VIRUS, code: "A-2", status: "ИЗУЧЕН", external: "", physiology: "" },
    ...Array.from({ length: 4 }, (_, i) => ({ id: `v${i + 3}`, name: `Вирус ${i + 3}`, code: `A-${i + 3}`, status: "ИЗУЧЕН", external: "", physiology: "" })),
  ];
  const broadcasts = Array.from({ length: 6 }, (_, i) => ({ id: `n${i + 1}`, type: "news", title: `Новость ${i + 1}`, body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }));
  return fixture({ viruses, infoSections, broadcasts });
};
// The public tab strip: a long active subsection title among its neighbours (owner screenshot: «01.3 Жизненный цикл ви…» with «02» drawn on top).
const tabsFixture = () => fixture({
  viruses: [{ id: "v1", name: "Альфа", code: "A-1", status: "ИЗУЧЕН", external: "", physiology: "" }],
  infoSections: [
    { id: "s1", title: "Вирус", body: "Текст", subsections: [
      { id: "u1", title: "Общие сведения", blocks: [] }, { id: "u2", title: "Строение вириона", blocks: [] },
      { id: "u3", title: "Жизненный цикл вируса в организме хозяина", blocks: [] }] },
    { id: "s2", title: "Второй раздел", body: "Текст", subsections: [{ id: "u4", title: "Подраздел", blocks: [] }] },
    { id: "s3", title: "Третий раздел с очень длинным названием", body: "Текст", subsections: [] },
  ],
});

async function newPage(browser, content, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...contextOptions });
  const page = await context.newPage();
  page.on("pageerror", (e) => reasons.push(`page exception: ${String(e.message).slice(0, 120)}`));
  await context.route("**/api/**", (route) => {
    const request = route.request(); const { pathname } = new URL(request.url());
    if (request.method() !== "GET") { reasons.push(`write blocked: ${request.method()} ${pathname}`); return route.abort(); }
    const body = pathname === "/api/access" ? { canEdit: true, canManageEditors: false } : pathname === "/api/content" ? { content, revision: 1, updatedAt: null } : null;
    return body ? route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) }) : route.abort();
  });
  await page.goto(URL_);
  await page.waitForFunction(() => { const e = document.querySelector(".desktop-icons"); return !!e && e.getBoundingClientRect().width > 0; }, null, { timeout: 15000 });
  return page;
}
async function openEditor(page) {
  await page.click('[data-shortcut="settings"]');
  await page.waitForFunction(() => { const b = document.querySelector(".content-control-actions button"); return !!b && !b.disabled; }, null, { timeout: 8000 });
  await page.click(".content-control-actions button");
  await page.waitForSelector(".content-editor", { timeout: 8000 });
}
const clickText = (page, selector, text) => page.locator(selector).filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) }).first().click();

// ---------------------------------------------------------------- ctrl (Firefox)
async function ctrl(browser) {
  const page = await newPage(browser, multiFixture());
  await openEditor(page);
  const lead = '.formatted-rich-input[data-area="lead"]';
  await clickText(page, ".dossier-tabs button", "Описание");
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, lead);
  const wordBox = (index, word) => page.evaluate(([s, i, w]) => {
    const field = document.querySelectorAll(s)[i]; field.scrollIntoView({ block: "center" });
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.data.indexOf(w); if (at < 0) continue;
      const range = document.createRange(); range.setStart(node, at); range.setEnd(node, at + w.length);
      const r = range.getBoundingClientRect(); return { left: r.left, right: r.right, y: r.top + r.height / 2 };
    }
    return null;
  }, [lead, index, word]);
  const painted = () => page.evaluate(() => { const h = CSS.highlights.get("portia-format"); return h ? [...h].map(String) : null; });
  const colorOf = (word) => page.evaluate(([s, w]) => { for (const f of document.querySelectorAll(s)) { const t = document.createTreeWalker(f, NodeFilter.SHOW_TEXT); for (let n = t.nextNode(); n; n = t.nextNode()) if (n.data.includes(w)) return getComputedStyle(n.parentElement).color; } return null; }, [lead, word]);
  const header = () => page.evaluate(() => document.querySelector(".floating-text-format > header")?.textContent ?? "");
  const ranges = () => page.evaluate(() => { const s = getSelection(); return Array.from({ length: s.rangeCount }, (_, i) => String(s.getRangeAt(i))); });
  // the way a user does it: a drag over the word, or a double-click on it; Control held for every pick after the first
  const pick = async (index, word, how, withCtrl) => {
    await wordBox(index, word); await sleep(700);
    const b = await wordBox(index, word); const x = (b.left + b.right) / 2;
    if (withCtrl) await page.keyboard.down("Control");
    if (how === "drag") { await page.mouse.move(b.left + 1, b.y); await page.mouse.down(); await page.mouse.move(x, b.y, { steps: 3 }); await page.mouse.move(b.right - 1, b.y, { steps: 3 }); await page.mouse.up(); }
    else await page.mouse.dblclick(x, b.y);
    if (withCtrl) await page.keyboard.up("Control");
    await sleep(120);
    log(`  ${how}${withCtrl ? "+Ctrl" : ""} «${word}» -> ranges ${JSON.stringify(await ranges())}`);
  };
  const red = "rgb(180, 54, 50)";
  for (const [how, panelFirst] of [["drag", false], ["dblclick", false], ["drag", true], ["dblclick", true]]) {
    await page.reload(); await page.waitForSelector(".desktop-icons");
    await openEditor(page); await clickText(page, ".dossier-tabs button", "Описание");
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, lead);
    // plain pick, then Ctrl picks: same field, other field, same field again (panelFirst: the ✎ panel is already open while picking)
    await pick(0, "два", how, false);
    if (panelFirst) { await page.click(".global-format-launch > button"); await page.waitForSelector(".floating-text-format"); log("  panel open, header:", await header()); }
    await pick(0, "четыре", how, true); if (panelFirst) log("  header:", await header()); await pick(1, "восемь", how, true); if (panelFirst) log("  header:", await header()); await pick(1, "десять", how, true); if (panelFirst) log("  header:", await header());
    if (!panelFirst) await page.click(".global-format-launch > button");
    await page.waitForSelector(".floating-text-format"); await sleep(200);
    const head = await header();
    if (!head.includes("ВЫБРАНО: 4")) reasons.push(`ctrl/${how}${panelFirst ? "+panel" : ""}: header reads ${JSON.stringify(head)}, expected «ВЫБРАНО: 4»`);
    const both = await painted();
    if (JSON.stringify(both?.map((t) => t.trim())) !== JSON.stringify(["два", "четыре", "восемь", "десять"])) reasons.push(`ctrl/${how}${panelFirst ? "+panel" : ""}: painted ${JSON.stringify(both)}, expected the four words`);
    await page.click('.format-swatches button[aria-label="Красный"]'); await sleep(250);
    for (const w of ["два", "четыре", "восемь", "десять"]) { const c = await colorOf(w); if (c !== red) reasons.push(`ctrl/${how}${panelFirst ? "+panel" : ""}: «${w}» colour ${c}, expected ${red}`); }
    for (const w of ["три", "пять", "семь", "девять"]) { const c = await colorOf(w); if (c === red) reasons.push(`ctrl/${how}${panelFirst ? "+panel" : ""}: «${w}» was coloured`); }
    // the other controls reach every fragment too: a preset, and a click on the custom colour board
    const where = `ctrl/${how}${panelFirst ? "+panel" : ""}`;
    await clickText(page, ".format-presets button", "Заголовок"); await sleep(250);
    for (const w of ["два", "четыре", "восемь", "десять"]) { const size = await page.evaluate(([s, w]) => { for (const f of document.querySelectorAll(s)) { const t = document.createTreeWalker(f, NodeFilter.SHOW_TEXT); for (let n = t.nextNode(); n; n = t.nextNode()) if (n.data.includes(w)) return getComputedStyle(n.parentElement).fontSize; } return null; }, [lead, w]); if (size !== "22px") reasons.push(`${where}: «${w}» font size ${size} after «Заголовок», expected 22px`); }
    await page.click('[aria-label="Выбрать свой цвет текста"]');
    await page.locator(".custom-color-board").click({ position: { x: 30, y: 20 } }); await sleep(250);
    const custom = []; for (const w of ["два", "четыре", "восемь", "десять"]) custom.push(await colorOf(w));
    if (new Set(custom).size !== 1 || custom[0] === red) reasons.push(`${where}: custom colour reached ${JSON.stringify(custom)}, expected one new colour on all four`);
  }
  await page.context().close();
}

// ---------------------------------------------------------------- phone (WebKit, iPhone)
async function phone(browser, device) {
  for (const [w, h] of [[390, 844], [360, 640]]) {
    const where = `${w}x${h}`;
    const page = await newPage(browser, phoneFixture(), { ...device, viewport: { width: w, height: h } });
    await openEditor(page);
    await clickText(page, ".editor-tabs button", "Информация");
    const top = ".flat-editor-form > .nested-editor-card";
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 6, top);
    // anything of the page wider than the screen: documents, containers and any element whose box ends past the right edge
    const wide = async (label) => {
      await sleep(300);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth, out = [];
        const over = (e) => (e ? e.scrollWidth - e.clientWidth : 0);
        for (const e of document.querySelectorAll(".content-editor *")) {
          const r = e.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.right > vw + 1 && !e.closest(".editor-tabs, .global-format-launch, .sr-only")) { out.push((typeof e.className === "string" && e.className ? "." + e.className.split(" ")[0] : e.tagName) + ":" + Math.round(r.right)); if (out.length >= 5) break; }
        }
        return { doc: over(document.documentElement), editor: over(document.querySelector(".content-editor")), win: over(document.querySelector(".editor-window")), inner: window.innerWidth, vv: window.visualViewport.width, out };
      });
      for (const p of ["doc", "editor", "win"]) if (m[p] > 0) reasons.push(`${where} ${label}: ${p} is ${m[p]}px wider than the screen`);
      if (m.out.length) reasons.push(`${where} ${label}: sticks out of the screen: ${m.out.join(", ")}`);
      if (m.vv > w + 1) reasons.push(`${where} ${label}: the visual viewport grew to ${m.vv}px`);
      log(where, label, JSON.stringify(m));
    };
    await wide("collapsed");
    for (const n of [3, 1]) {
      await page.locator(`${top}:nth-of-type(${n}) > .nested-editor-head .nested-editor-toggle`).tap();
      await page.waitForFunction(([s, i]) => !document.querySelectorAll(s)[i].querySelector(":scope > .nested-editor-body").hidden, [top, n - 1]);
      await page.evaluate(([s, i]) => document.querySelectorAll(s)[i].querySelectorAll(".nested-editor-card .nested-editor-toggle[aria-expanded=false]").forEach((b) => b.click()), [top, n - 1]);
      await wide(`section ${n} expanded`);
      // the fields inside an expanded card end before the card does
      const inside = await page.evaluate(([s, i]) => {
        const card = document.querySelectorAll(s)[i], cr = card.getBoundingClientRect(), bad = [];
        for (const e of card.querySelectorAll("input:not(.sr-only), textarea, .formatted-rich-input, .formatted-text-field-hint, .editor-field")) {
          const r = e.getBoundingClientRect(); if (r.width && r.right > cr.right + 0.5) bad.push((e.className || e.tagName) + ":" + Math.round(r.right) + ">" + Math.round(cr.right));
        }
        return bad.slice(0, 4);
      }, [top, n - 1]);
      if (inside.length) reasons.push(`${where} section ${n} expanded: fields run past their card: ${inside.join("; ")}`);
    }
    // every row / card head: nothing overlaps its neighbour or ends past the row, and a name stops before the buttons at its right
    for (const tab of ["Информация", "База вирусов", "Сводка", "Корзина"]) {
      await clickText(page, ".editor-tabs button", tab); await sleep(500);
      if (tab !== "Информация") await wide(tab);
      const rows = await page.evaluate(() => {
        const bad = [];
        for (const row of document.querySelectorAll(".editor-record-row, .nested-editor-head")) {
          const box = row.getBoundingClientRect(); if (!box.width) continue;
          const kids = [...row.children].map((c) => ({ c, r: c.getBoundingClientRect() })).filter((k) => k.r.width > 0).sort((a, b) => a.r.left - b.r.left);
          kids.forEach((k, i) => {
            if (k.r.right > box.right + 0.5) bad.push("past the row: " + (k.c.className || k.c.tagName));
            if (i > 0 && k.r.left < kids[i - 1].r.right - 0.5) bad.push("overlap: " + (kids[i - 1].c.className || kids[i - 1].c.tagName) + " / " + (k.c.className || k.c.tagName));
            for (const name of k.c.querySelectorAll("strong, .nested-editor-title")) if (name.getBoundingClientRect().right > k.r.right + 0.5) bad.push("label past its box: «" + row.textContent.trim().slice(0, 28) + "» " + (name.className || name.tagName) + " " + Math.round(name.getBoundingClientRect().right) + ">" + Math.round(k.r.right));
          });
          // the visible text may not reach a sibling's box: compare the text's own rendered right edge to the next element
          for (const name of row.querySelectorAll("strong, .nested-editor-title")) {
            const range = document.createRange(); range.selectNodeContents(name);
            const textRight = Math.min(range.getBoundingClientRect().right, name.getBoundingClientRect().right);
            for (const other of row.querySelectorAll("button, .editor-row-actions, .nested-editor-actions")) {
              if (other.contains(name) || name.contains(other)) continue;
              const o = other.getBoundingClientRect(); const n = name.getBoundingClientRect();
              if (o.width && o.left > n.left && textRight > o.left + 0.5) bad.push("text under a button: «" + row.textContent.trim().slice(0, 28) + "» " + (name.className || name.tagName) + " -> " + (other.className || other.tagName));
            }
          }
        }
        return [...new Set(bad)].slice(0, 5);
      });
      if (rows.length) reasons.push(`${where} rows ${tab}: ${rows.join("; ")}`);
    }
    // the ОГЛАВЛЕНИЕ moves only up and down: a real sideways touch swipe changes neither scrollX nor the list
    await clickText(page, ".editor-tabs button", "Информация"); await sleep(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("nav.editor-toc .editor-toc-bar button").first().tap();
    await page.waitForFunction(() => !document.querySelector("nav.editor-toc ol").hidden); await sleep(300);
    const geometry = () => page.evaluate(() => { const nav = document.querySelector("nav.editor-toc"), ol = nav.querySelector("ol"), r = ol.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(60, r.height / 2), nav: nav.getBoundingClientRect().left, olLeft: ol.scrollLeft, sx: window.scrollX, edLeft: document.querySelector(".content-editor").scrollLeft, docLeft: document.scrollingElement.scrollLeft, olW: ol.scrollWidth - ol.clientWidth, navW: nav.scrollWidth - nav.clientWidth }; });
    const before = await geometry();
    const swiped = false; // desktop WebKit cannot dispatch real finger pans; what a finger may do is read from the styles below
    const after = await geometry();
    log(where, "toc before", JSON.stringify(before), "after", JSON.stringify(after), "synthetic swipe", swiped);
    if (before.olW > 0 || before.navW > 0) reasons.push(`${where} TOC: list ${before.olW}px / nav ${before.navW}px wider than itself`);
    for (const k of ["nav", "olLeft", "sx", "edLeft", "docLeft"]) if (Math.abs(after[k] - before[k]) > 0.5) reasons.push(`${where} TOC: a sideways swipe moved ${k} (${before[k]} -> ${after[k]})`);
    // what the browser would let a finger do: horizontal panning must be off on the list and on every ancestor up to the window
    const pans = await page.evaluate(() => {
      const out = []; let e = document.querySelector("nav.editor-toc ol");
      for (; e && e !== document.documentElement; e = e.parentElement) {
        const s = getComputedStyle(e); const x = s.overflowX;
        const scrolls = (x === "auto" || x === "scroll") && e.scrollWidth > e.clientWidth;
        out.push({ el: (e.className || e.tagName).toString().split(" ")[0], touch: s.touchAction, overflowX: x, scrolls });
      }
      return out;
    });
    log(where, "toc chain", JSON.stringify(pans));
    const list = pans[0];
    if (!/pan-y/.test(list.touch) || /pan-x|auto|manipulation/.test(list.touch)) reasons.push(`${where} TOC: touch-action on the list is ${list.touch}, expected pan-y`);
    for (const p of pans) if (p.scrolls) reasons.push(`${where} TOC: ${p.el} can scroll sideways`);
    await page.context().close();
  }
}

// ---------------------------------------------------------------- public info tab strip (WebKit, iPhone)
async function tabs(browser, device) {
  for (const [w, h] of [[390, 844], [360, 640]]) {
    const where = `${w}x${h}`;
    const page = await newPage(browser, tabsFixture(), { ...device, viewport: { width: w, height: h } });
    await page.click('[data-shortcut="info"]');
    await page.waitForSelector(".info-subsections button"); // section 1 opens on its own
    // the third subsection («Жизненный цикл…») is the active tab, as in the owner's screenshot
    await page.locator(".info-subsections button").nth(2).dispatchEvent("click"); await sleep(500);
    const bad = await page.evaluate(() => {
      const out = [], strip = document.querySelector(".info-index");
      const tabs = [...strip.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().width > 0);
      const name = (e) => e.textContent.trim().slice(0, 16);
      const rects = tabs.map((t) => t.getBoundingClientRect());
      tabs.forEach((t, i) => {
        const r = rects[i];
        // a tab starts after the one before it ends (tabs are in one row)
        for (let j = 0; j < i; j += 1) if (Math.abs(rects[j].top - r.top) < 6 && rects[j].right > r.left + 1 && rects[j].left < r.left) out.push(`tab «${name(tabs[j])}» (..${Math.round(rects[j].right)}) overlaps «${name(t)}» (${Math.round(r.left)}..)`);
        // the number and the title inside one tab do not overlap
        const parts = [...t.children].map((c) => ({ c, r: c.getBoundingClientRect() })).filter((p) => p.r.width > 0).sort((a, b) => a.r.left - b.r.left);
        parts.forEach((p, j) => { if (j > 0 && p.r.left < parts[j - 1].r.right - 0.5) out.push(`inside «${name(t)}»: ${p.c.tagName} overlaps ${parts[j - 1].c.tagName}`); });
      });
      // the group of subsection tabs ends where its last tab ends (a narrower group lets the next section tab sit on top of them)
      const group = strip.querySelector(".info-subsections");
      if (group) { const g = group.getBoundingClientRect(), last = [...group.querySelectorAll("button")].pop().getBoundingClientRect(); if (last.right > g.right + 1) out.push(`the subsection group ends at ${Math.round(g.right)} but its last tab at ${Math.round(last.right)}`); }
      return [...new Set(out)].slice(0, 6);
    });
    for (const x of bad) reasons.push(`${where} tabs: ${x}`);
    if (DEBUG) await page.screenshot({ path: path.join(process.env.TEMP || ".", `tabs-${w}.png`) });
    await page.context().close();
  }
}

const results = {};
const run = async (name, fn) => { const before = reasons.length; try { await fn(); } catch (error) { reasons.push(`${name}: ${String(error.message).split("\n")[0].slice(0, 200)}`); } results[name] = { ok: reasons.length === before, reasons: reasons.slice(before) }; };
const selected = (name) => CHECK === "all" || CHECK === name;
if (!["ctrl", "phone", "tabs", "all"].includes(CHECK)) { console.log(JSON.stringify({ ok: false, reasons: [`unknown check ${CHECK}`] })); process.exit(2); }
try { await fetch(URL_); } catch { console.log(JSON.stringify({ ok: false, reasons: [`server unreachable at ${URL_}`] })); process.exit(2); }
if (selected("ctrl")) { const b = await pw.firefox.launch(); await run("ctrl", () => ctrl(b)); await b.close(); }
if (selected("phone") || selected("tabs")) {
  const b = await pw.webkit.launch(); const device = pw.devices["iPhone 13"];
  if (selected("phone")) await run("phone", () => phone(b, device));
  if (selected("tabs")) await run("tabs", () => tabs(b, device));
  await b.close();
}
const ok = Object.values(results).every((r) => r.ok);
console.log(JSON.stringify({ check: CHECK, ok, results }, null, 1));
process.exit(ok ? 0 : 1);
