import type { Locator, Page, Route } from "@playwright/test";
import { contentBodyFor, slotKeyFactory, type ContentRow } from "../../../lib/content-response.ts";
import { MAX_SCIENTIST_LOGS } from "../../../lib/content-limits.ts";
import { editorSections } from "../../../lib/editor-changes.ts";
import type { AccessLevel } from "../../../lib/access-levels.ts";
import { cloneDefaultContent, type GuideCard, type GuideSection, type PortiaContent, type ScientistLog, type Virus } from "../../../lib/portia-content.ts";
import { DesktopPage } from "../pages/desktop.page";
import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";

// Phase 24 backstop checks (24-11): S1 overflow, S3 long-text, S4 overflow, S6 populated, in a browser build with EVERY /api/** answer replaced.
// Nothing here reaches a data source: page.route("**/api/**") answers the known paths with answers built by the same server modules the real
// route uses (contentBodyFor, slotKeyFactory) over invented records, and aborts any other own /api request. No nickname, link or key of a real
// person is used. What this proves is the browser layout and the in-page refresh on mocked answers; live roles, Postgres/RLS, staging,
// production, the Netlify CDN and physical devices are NOT proven here (BLOCKED until their phase).

// A fixed string of the right length, not a secret of any environment: the slot keys only have to be stable inside one run.
const slotSecret = "phase24-e2e-mock-slot-key-0123456789";
const slotOf = slotKeyFactory(slotSecret);
const aborted: string[] = [];

const longTitle = (label: string) => `${label} с очень длинным названием записи которое обязано переноситься внутри строки без горизонтальной прокрутки`;

function scientistLogs(count: number): ScientistLog[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock-log-${index + 1}`,
    title: longTitle(`ЗАПИСЬ ${String(index + 1).padStart(2, "0")}`),
    scientist: "Длиннофамильный Учёный-Исследователь Иванович-Петрович",
    lockedLevel: [2, 3, 4, 5, 3][index % 5],
    content: [`Текст записи учёного ${index + 1}.`],
  }));
}

function virusOf(base: Virus, index: number, level: AccessLevel, logs: number): Virus {
  return { ...structuredClone(base), id: `mock-virus-${index}`, code: `MOCK-${index}`, name: `ВИРУС ${index}`, level, scientistLogs: scientistLogs(logs) };
}

function guideCard(id: string, title: string, level?: AccessLevel): GuideCard {
  return { id, title, cover: "", blocks: [{ id: `${id}-text`, type: "text", text: `Текст карточки ${title}.` }], ...(level ? { level } : {}) };
}

// One stored copy for every scenario: leveled viruses (one with the maximum of scientist records), info sections with subsections, guide
// sections with cards and a closed section, and the recycle bin. Levels start at 1 so every viewer level 1..5 shows something and hides something.
function storedContent(): PortiaContent {
  const content = cloneDefaultContent();
  const base = content.viruses[0];
  content.viruses = [
    virusOf(base, 1, 1, MAX_SCIENTIST_LOGS),
    virusOf(base, 2, 3, 2),
    virusOf(base, 3, 2, 1),
    virusOf(base, 4, 4, 1),
    virusOf(base, 5, 5, 1),
    virusOf(base, 6, 3, 1),
  ];
  content.viruses[0].name = longTitle("ВИРУС 1");
  content.viruses[1].name = "ВИРУС ТРЕТЬЕГО УРОВНЯ";
  content.recycledViruses = [];
  content.recycleFiles = [
    { id: "mock-file-1", name: "ФАЙЛ 1", location: "корзина", kind: "text", content: "Открытый файл", image: "", virusId: "" },
    { id: "mock-file-2", name: "ФАЙЛ ВИРУСА 3", location: "корзина", kind: "virus", content: "", image: "", virusId: "mock-virus-2" },
    { id: "mock-file-3", name: "ФАЙЛ ВИРУСА 4", location: "корзина", kind: "virus", content: "", image: "", virusId: "mock-virus-4" },
  ];
  content.recycleOrder = ["file:mock-file-1", "file:mock-file-2", "file:mock-file-3"];
  content.infoSections = [
    { id: "mock-info-1", title: "ОТКРЫТЫЙ РАЗДЕЛ", body: "Текст.", subsections: [
      { id: "mock-info-1-a", title: "Подраздел открытый", blocks: [{ id: "mock-info-1-a-b", type: "text", text: "Текст." }] },
      { id: "mock-info-1-b", title: "Подраздел третьего уровня", level: 3, blocks: [{ id: "mock-info-1-b-b", type: "text", text: "Текст." }] },
    ] },
    { id: "mock-info-2", title: "РАЗДЕЛ ТРЕТЬЕГО УРОВНЯ", body: "Текст.", level: 3, subsections: [
      { id: "mock-info-2-a", title: "Подраздел раздела третьего уровня", blocks: [{ id: "mock-info-2-a-b", type: "text", text: "Текст." }] },
    ] },
    { id: "mock-info-3", title: longTitle("РАЗДЕЛ ПЯТОГО УРОВНЯ"), body: "Текст.", level: 5, subsections: [] },
  ];
  const guideSections: GuideSection[] = [
    { id: "mock-guide-1", title: "ОТКРЫТЫЙ СПРАВОЧНИК", photo: "", cards: [guideCard("mock-card-1", "Карточка 1"), guideCard("mock-card-2", "Карточка третьего уровня", 3), guideCard("mock-card-3", longTitle("Карточка"))] },
    { id: "mock-guide-2", title: "СПРАВОЧНИК ЧЕТВЁРТОГО УРОВНЯ", photo: "", level: 4, cards: [guideCard("mock-card-4", "Карточка 4")] },
  ];
  content.guideSections = guideSections;
  content.appLevels = { charter: 3 };
  return content;
}

const row = (): ContentRow => ({ payload: storedContent(), revision: 7, updated_at: "2026-11-15T09:00:00.000Z" });

type Mode = { kind: "level"; level: AccessLevel } | { kind: "editor" } | { kind: "revoked" };

const approvedState = (level: AccessLevel) => ({ state: "approved", nickname: "MockVisitor", level, origin: "sheet" });
const revokedState = { state: "revoked", nickname: "MockVisitor", retryAt: null };

function decisionOf(mode: Mode) {
  if (mode.kind === "editor") return { mode: "closed", state: { state: "none" }, allowed: true, level: 5, editor: true };
  if (mode.kind === "revoked") return { mode: "closed", state: revokedState, allowed: false, level: null, editor: false };
  return { mode: "closed", state: approvedState(mode.level), allowed: true, level: mode.level, editor: false };
}

function answer(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
}

/** Answers every own /api request from `control.mode`; any other own /api path is aborted and written to `aborted`, never answered. */
async function mockApi(page: Page, control: { mode: Mode }) {
  aborted.length = 0;
  // The one-time «Доступ подтверждён» notice would cover the icons on a narrow screen; the device is told it was already shown (key of lib/access-gate-view.ts).
  await page.addInitScript(() => window.localStorage.setItem("portia-access-approved-notice-v1", "1"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const { mode } = control;
    if (path === "/api/access/status") return answer(route, decisionOf(mode));
    if (path === "/api/content" && route.request().method() === "GET") {
      if (mode.kind === "revoked") return answer(route, { error: "Нет доступа к содержимому.", code: "access-required" }, 401);
      const viewer = mode.kind === "editor" ? { editor: true, level: 5 as AccessLevel } : { editor: false, level: mode.level };
      return answer(route, contentBodyFor(viewer, row(), { slotOf }));
    }
    if (path === "/api/employees") return answer(route, { employees: [], degraded: false, profilesRead: true, manualRead: true, syncedAt: null });
    if (path === "/api/access") return answer(route, { canEdit: mode.kind === "editor", canManageEditors: false, openTabs: [...editorSections] });
    aborted.push(`${route.request().method()} ${path}`);
    return route.abort("failed");
  });
}

async function openApp(page: Page, name: string) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp(name);
  return desktop.window(name);
}

// Horizontal overflow of one window. A box that is wider than itself and is not a deliberate horizontal scroller is counted by its tag.class key with the
// amount of excess; deliberate scrollers (overflow-x auto/scroll, e.g. the phone strip of the virus list, which exists without Phase 24) are listed apart.
// A placeholder must not overflow its own box either. Placeholders are `.access-redacted`; nothing else in the window is assumed.
type OverflowReport = { placeholders: number; variants: string[]; excess: Record<string, number>; scrollers: string[]; ownOverflow: string[] };

async function overflowReport(window: Locator): Promise<OverflowReport> {
  return window.evaluate((root) => {
    const key = (node: Element) => `${node.tagName.toLowerCase()}.${String(node.className).split(" ").filter(Boolean).slice(0, 2).join(".")}`;
    const isScroller = (node: Element) => { const overflowX = getComputedStyle(node).overflowX; return overflowX === "auto" || overflowX === "scroll"; };
    const insideScroller = (node: Element) => { for (let up = node.parentElement; up && up !== root; up = up.parentElement) if (isScroller(up)) return true; return false; };
    const excess: Record<string, number> = {};
    const scrollers: string[] = [];
    const variants = new Set<string>();
    const ownOverflow: string[] = [];
    let placeholders = 0;
    for (const node of [root, ...Array.from(root.querySelectorAll("*"))]) {
      if (node.classList.contains("access-redacted")) {
        placeholders += 1;
        for (const name of node.classList) if (name.startsWith("access-redacted-") && name !== "access-redacted-number") variants.add(name.slice("access-redacted-".length));
        if (node.scrollWidth > node.clientWidth + 1) ownOverflow.push(`${key(node)} ${node.scrollWidth}>${node.clientWidth}`);
      }
      if (node !== root && insideScroller(node)) continue;
      if (node !== root && isScroller(node)) {
        if (node.scrollWidth > node.clientWidth + 1) scrollers.push(key(node));
        continue;
      }
      const over = node.scrollWidth - node.clientWidth;
      if (over > 1) excess[key(node)] = Math.max(excess[key(node)] ?? 0, over);
    }
    const page = document.documentElement;
    if (page.scrollWidth - page.clientWidth > 1) excess.page = page.scrollWidth - page.clientWidth;
    return { placeholders, variants: [...variants].sort(), excess, scrollers: [...new Set(scrollers)].sort(), ownOverflow };
  });
}

/** Overflow the placeholders add: a box that is wider than its own baseline (the same windows with every record open). Empty = nothing new. */
function addedOverflow(shown: OverflowReport, baseline: OverflowReport): string[] {
  return Object.entries(shown.excess).filter(([key, over]) => over > (baseline.excess[key] ?? 0)).map(([key, over]) => `${key} +${over - (baseline.excess[key] ?? 0)}px`);
}

const widths = [320, 390, 900] as const;

test.describe("access-levels backstop (mocked /api/**)", () => {
  test.describe.configure({ timeout: 90_000 });
  for (const width of widths) {
    test(`S1 overflow: placeholders row, index, tile, bar at ${width}px make no horizontal scroll`, async ({ page }) => {
      const control: { mode: Mode } = { mode: { kind: "level", level: 2 } };
      await mockApi(page, control);
      await page.setViewportSize({ width, height: 800 });
      const apps: { name: string; placeholder: string; variants: string[]; prepare?: (window: Locator) => Promise<void> }[] = [
        { name: "База вирусов", placeholder: ".access-redacted-row", variants: ["row"] },
        { name: "Информация", placeholder: ".access-redacted-index", variants: ["index"] },
        { name: "Справочник", placeholder: ".access-redacted-tile", variants: ["bar", "tile"], prepare: async (window: Locator) => { const folded = window.locator('.guide-section-head[aria-expanded="false"]'); for (let attempt = 0; attempt < 4 && await folded.count(); attempt += 1) await folded.first().click({ timeout: 3_000 }).catch(() => undefined); } },
        { name: "Корзина", placeholder: ".access-redacted-row", variants: ["row"] },
      ];
      for (const app of apps) {
        control.mode = { kind: "level", level: 2 };
        const shownWindow = await openApp(page, app.name);
        await app.prepare?.(shownWindow);
        await expect(shownWindow.locator(app.placeholder).first()).toBeVisible();
        const shown = await overflowReport(shownWindow);
        // Baseline: the same stored copy for a visitor who may open everything, so no placeholder exists and any overflow left is not theirs.
        control.mode = { kind: "level", level: 5 };
        const baselineWindow = await openApp(page, app.name);
        await app.prepare?.(baselineWindow);
        await expect(baselineWindow.locator(".access-redacted")).toHaveCount(0);
        const baseline = await overflowReport(baselineWindow);
        expect(shown.variants, `${app.name} placeholder forms`).toEqual(expect.arrayContaining(app.variants));
        expect(shown.ownOverflow, `${app.name}: a placeholder wider than its own box at ${width}px`).toEqual([]);
        expect(addedOverflow(shown, baseline), `${app.name}: overflow the placeholders add at ${width}px (shown ${JSON.stringify(shown.excess)}, baseline ${JSON.stringify(baseline.excess)}, existing scrollers ${shown.scrollers.join(",")})`).toEqual([]);
        test.info().annotations.push({ type: `s1-${width}-${app.name}`, description: `excess ${JSON.stringify(shown.excess)}; baseline ${JSON.stringify(baseline.excess)}; scrollers ${shown.scrollers.join(",") || "none"}` });
      }
    });
  }

  for (const width of widths.filter((value) => value <= 900)) {
    test(`S3 long-text: level picker is 44x44 and shows «Не ниже раздела: N» at ${width}px (editor view)`, async ({ page }) => {
      await mockApi(page, { mode: { kind: "editor" } });
      await page.setViewportSize({ width, height: 900 });
      const editor = new EditorPage(page);
      await editor.desktop.goto();
      await editor.openSettings();
      await expect(editor.openEditor).toBeEnabled();
      await editor.openEditor.click();
      await expect(editor.editorNavigation()).toBeVisible();
      await editor.editorNavigation().getByRole("button", { name: /Информация/ }).click();

      // The second section needs level 3, so its subsection picker has a floor of 3 and shows the hint.
      await page.getByRole("navigation", { name: "Разделы информации" }).getByRole("button", { name: /РАЗДЕЛ ТРЕТЬЕГО УРОВНЯ/ }).click();
      const hint = page.locator(".access-level-hint", { hasText: "Не ниже раздела: 3" });
      await expect(async () => {
        // Open collapsed cards (the subsection card holds the picker) until the hint is on screen.
        if (await hint.first().isVisible()) return;
        await page.locator(".nested-editor-toggle[aria-expanded=false]:visible").first().click();
        await expect(hint.first()).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 15_000 });
      await hint.first().scrollIntoViewIfNeeded();
      await expect(hint.first()).toBeVisible();

      const option = hint.first().locator("xpath=ancestor::fieldset[contains(@class,'access-level-picker')]").locator(".access-level-option").first();
      await option.scrollIntoViewIfNeeded();
      const box = await option.boundingBox();
      expect(box, "level option has a box").not.toBeNull();
      expect(Math.round(box!.width), `option width at ${width}px`).toBe(44);
      expect(Math.round(box!.height), `option height at ${width}px`).toBe(44);
      const pageWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(pageWidth.scroll, `page scrollWidth at ${width}px`).toBeLessThanOrEqual(pageWidth.client + 1);
    });
  }

  test("S4 overflow: with MAX_SCIENTIST_LOGS records the list scrolls vertically and the dossier has no horizontal scroll at 320px", async ({ page }) => {
    const control: { mode: Mode } = { mode: { kind: "level", level: 2 } };
    await mockApi(page, control);
    await page.setViewportSize({ width: 320, height: 640 });
    const archive = await openApp(page, "База вирусов");
    await archive.locator(".virus-row", { hasText: "ВИРУС 1" }).first().click();
    const list = archive.locator(".scientist-log-list");
    await expect(list).toBeVisible();
    await expect(list.locator(".scientist-log-row")).toHaveCount(MAX_SCIENTIST_LOGS);
    await expect(list.locator(".scientist-log-row.locked").first()).toBeVisible();
    const shown = await overflowReport(archive);

    // Each record row keeps its text inside its own box, and the list is held by a vertical scroll container that scrolls.
    const rows = await list.locator(".scientist-log-row").evaluateAll((nodes) => nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => `${node.className} ${node.scrollWidth}>${node.clientWidth}`));
    expect(rows, "record rows wider than their own box").toEqual([]);
    // On a phone the window grows with its content and the page (the viewport) scrolls; on a wide window an inner container scrolls. Either one counts, and it must actually move.
    const vertical = await list.evaluate((node, rootLabel) => {
      const root = node.closest(`[aria-label="${rootLabel}"]`) ?? document.body;
      let scroller: HTMLElement | null = null;
      for (let element: Element | null = node; element; element = element.parentElement) {
        const overflowY = getComputedStyle(element).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") { scroller = element as HTMLElement; break; }
        if (element === root) break;
      }
      if (scroller && scroller.scrollHeight > scroller.clientHeight) {
        scroller.scrollTop = scroller.scrollHeight;
        return { kind: "container", scrollable: true, moved: scroller.scrollTop > 0 };
      }
      const page = document.scrollingElement as HTMLElement;
      const scrollable = page.scrollHeight > page.clientHeight;
      if (scrollable) window.scrollTo(0, page.scrollHeight);
      return { kind: "page", scrollable, moved: window.scrollY > 0 };
    }, "База вирусов");
    expect(vertical.scrollable, "the record list is taller than the view, so a scroller holds it").toBe(true);
    expect(vertical.moved, `the ${vertical.kind} scrolls vertically`).toBe(true);

    // Baseline: the same virus for a level that opens all five records, so no row is withheld.
    control.mode = { kind: "level", level: 5 };
    const baselineWindow = await openApp(page, "База вирусов");
    await baselineWindow.locator(".virus-row", { hasText: "ВИРУС 1" }).first().click();
    await expect(baselineWindow.locator(".scientist-log-row.locked")).toHaveCount(0);
    const baseline = await overflowReport(baselineWindow);
    expect(addedOverflow(shown, baseline), `overflow the withheld records add at 320px (shown ${JSON.stringify(shown.excess)}, baseline ${JSON.stringify(baseline.excess)})`).toEqual([]);
    test.info().annotations.push({ type: "s4-320", description: `vertical scroller ${JSON.stringify(vertical)}; excess ${JSON.stringify(shown.excess)}; baseline ${JSON.stringify(baseline.excess)}` });
  });

  test("S6 populated: after a downgrade, an upgrade and a revoke the next refresh shows the new state without a reload", async ({ page, diagnostics }) => {
    // The revoke step ends in a 401 on purpose; the browser mirrors it to the console and the ledger records the response.
    diagnostics.expectFault({ kind: "response", source: /^(fetch|xhr)$/, text: /^GET \/api\/content -> 401$/, reason: "the mocked revoke answers 401 access-required on purpose" });
    diagnostics.expectFault({ kind: "console", source: /^browser:\/api\/content/, text: /Failed to load resource: the server responded with a status of 401/, reason: "the browser mirrors the mocked 401 to its console" });
    const control: { mode: Mode } = { mode: { kind: "level", level: 3 } };
    await mockApi(page, control);
    await page.setViewportSize({ width: 1440, height: 900 });
    const archive = await openApp(page, "База вирусов");

    // Level 3: the record of level 3 is open and selected.
    const wanted = archive.locator(".virus-row", { hasText: "ВИРУС ТРЕТЬЕГО УРОВНЯ" });
    await expect(wanted).toHaveCount(1);
    await wanted.click();
    await expect(archive.locator(".virus-row.active")).toContainText("ВИРУС ТРЕТЬЕГО УРОВНЯ");
    const openAt3 = await archive.locator(".virus-row").count();
    const closedAt3 = await archive.locator(".access-redacted-row").count();

    const refresh = async () => { await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); };

    // Downgrade 3 -> 2, seen through the polling clock (the content refresh runs at most every 30 s).
    control.mode = { kind: "level", level: 2 };
    await page.clock.runFor(31_000);
    await expect(archive.locator(".access-redacted-block")).toBeVisible({ timeout: 15_000 });
    await expect(archive.locator(".access-redacted-block")).toContainText("ЗАСЕКРЕЧЕНО · нужен допуск 3");
    await expect(archive.locator(".virus-row")).toHaveCount(openAt3 - 2);
    await expect(archive.locator(".access-redacted-row")).toHaveCount(closedAt3 + 2);

    // Upgrade 2 -> 3: the placeholders are records again, the window gives the record back; no reload happened.
    const markBefore = await page.evaluate(() => { (window as unknown as { __portiaNoReload: number }).__portiaNoReload = 1; return 1; });
    expect(markBefore).toBe(1);
    control.mode = { kind: "level", level: 3 };
    await refresh();
    await expect(archive.locator(".virus-row")).toHaveCount(openAt3, { timeout: 15_000 });
    await expect(archive.locator(".access-redacted-row")).toHaveCount(closedAt3);
    await expect(archive.locator(".access-redacted-block")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __portiaNoReload?: number }).__portiaNoReload)).toBe(1);

    // Revoke: the gate answers revoked and the content 401 access-required; the desktop leaves and the device copies are cleared.
    control.mode = { kind: "revoked" };
    await refresh();
    await expect(page.locator(".access-status")).toContainText("Доступ отозван", { timeout: 15_000 });
    await expect(page.getByRole("navigation", { name: "Рабочий стол PORTIA" })).toHaveCount(0);
    const stored = await page.evaluate(() => ({
      content: window.localStorage.getItem("portia-content-last-success-v1"),
      employees: window.localStorage.getItem("portia-employees-last-success-v1"),
    }));
    expect(stored.content, "content copy cleared").toBeNull();
    expect(stored.employees, "employees copy cleared").toBeNull();
    expect(await page.evaluate(() => (window as unknown as { __portiaNoReload?: number }).__portiaNoReload)).toBe(1);
  });

  test("every own /api request was answered by the mock or aborted by it (nothing reaches a data source)", async ({ page }) => {
    await mockApi(page, { mode: { kind: "level", level: 2 } });
    const requested: string[] = [];
    page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.startsWith("/api/")) requested.push(url.pathname); });
    await openApp(page, "База вирусов");
    expect(requested.length, "the page asked its API").toBeGreaterThan(0);
    expect(aborted, "own /api paths the mock does not know").toEqual([]);
  });
});
