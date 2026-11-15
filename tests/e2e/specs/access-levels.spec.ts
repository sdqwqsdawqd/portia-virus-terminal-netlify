import type { Locator, Page, Route } from "@playwright/test";
import { contentBodyFor, slotKeyFactory, type ContentRow } from "../../../lib/content-response.ts";
import { MAX_SCIENTIST_LOGS } from "../../../lib/content-limits.ts";
import { editorSections } from "../../../lib/editor-changes.ts";
import type { AccessLevel } from "../../../lib/access-levels.ts";
import { type GuideCard, type GuideSection, type PortiaContent, type ScientistLog, type Virus } from "../../../lib/portia-content.ts";
import type { PortiaEmployee } from "../../../lib/portia-employees.ts";
import { cloneFixtureContent } from "../../../lib/testing/portia-content-fixture.ts";
import { CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY, LEGACY_CACHE_KEYS } from "../../../lib/device-cache.ts";
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
  const content = cloneFixtureContent();
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

const mockEmployee: PortiaEmployee = { id: "mock-employee-1", nickname: "MockEmployee", callsign: "МОК", title: "Тестовый сотрудник", rank: "1", knowledgeRating: 1, pawsRating: null, bioRating: null, sRating: null, activityRating: null, testsRating: null, overallRating: null, biography: "", photoUrl: "", robloxUserId: null, robloxAvatarUrl: "", robloxFullAvatarUrl: "", order: 1, source: "sheet" };

const row = (): ContentRow => ({ payload: storedContent(), revision: 7, updated_at: "2026-11-15T09:00:00.000Z" });

// "gate" (Phase 25, SEC-04): the test states the whole gate decision and the cut the content route would answer with (null = 401 access-required).
type Cut = { editor: boolean; level: AccessLevel };
type Mode = { kind: "level"; level: AccessLevel } | { kind: "editor" } | { kind: "revoked" } | { kind: "gate"; decision: Record<string, unknown>; viewer: Cut | null };

const approvedState = (level: AccessLevel, nickname = "MockVisitor") => ({ state: "approved", nickname, level, origin: "sheet" });
const revokedState = { state: "revoked", nickname: "MockVisitor", retryAt: null };

function decisionOf(mode: Mode) {
  if (mode.kind === "gate") return mode.decision;
  if (mode.kind === "editor") return { mode: "closed", state: { state: "none" }, allowed: true, level: 5, editor: true };
  if (mode.kind === "revoked") return { mode: "closed", state: revokedState, allowed: false, level: null, editor: false };
  return { mode: "closed", state: approvedState(mode.level), allowed: true, level: mode.level, editor: false };
}

function answer(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });
}

/** Answers every own /api request from `control.mode`; any other own /api path is aborted and written to `aborted`, never answered. */
// delayContentMs holds the content answer back (real time), so a copy from the device cache is applied before the network answer of the same revision can overwrite it.
async function mockApi(page: Page, control: { mode: Mode; delayContentMs?: number }) {
  aborted.length = 0;
  // The one-time «Доступ подтверждён» notice would cover the icons on a narrow screen; the device is told it was already shown (key of lib/access-gate-view.ts).
  await page.addInitScript(() => window.localStorage.setItem("portia-access-approved-notice-v1", "1"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const { mode } = control;
    if (path === "/api/access/status") return answer(route, decisionOf(mode));
    if (path === "/api/content" && route.request().method() === "GET") {
      if (control.delayContentMs) await new Promise((resolve) => setTimeout(resolve, control.delayContentMs));
      if (mode.kind === "revoked" || (mode.kind === "gate" && mode.viewer === null)) return answer(route, { error: "Нет доступа к содержимому.", code: "access-required" }, 401);
      if (mode.kind === "gate") return answer(route, contentBodyFor(mode.viewer!, row(), { slotOf }));
      const viewer = mode.kind === "editor" ? { editor: true, level: 5 as AccessLevel } : { editor: false, level: mode.level };
      return answer(route, contentBodyFor(viewer, row(), { slotOf }));
    }
    // A complete answer with one invented person, so the roster copy is written on the device (an empty complete answer is cacheable too, but this one is visible).
    if (path === "/api/employees" && mode.kind === "gate") return mode.viewer === null ? answer(route, { error: "Нет доступа к содержимому.", code: "access-required" }, 401) : answer(route, { employees: [mockEmployee], degraded: false, profilesRead: true, manualRead: true, syncedAt: "2026-11-15T09:00:00.000Z" });
    if (path === "/api/employees") return answer(route, { employees: [], degraded: false, profilesRead: true, manualRead: true, syncedAt: null });
    if (path === "/api/access") return answer(route, { canEdit: mode.kind === "editor" || (mode.kind === "gate" && mode.decision.editor === true), canManageEditors: false, openTabs: [...editorSections] });
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
    // The key names come from lib/device-cache.ts, so a renamed key cannot make "cleared" pass on an old name.
    const stored = await page.evaluate((keys) => ({
      content: window.localStorage.getItem(keys.content),
      employees: window.localStorage.getItem(keys.employees),
    }), { content: CONTENT_CACHE_KEY, employees: EMPLOYEES_CACHE_KEY });
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

// Phase 25 (SEC-04, D-09, D-16, D-21, T-25-28): the device copies follow the gate decision, in a browser build with EVERY /api/** answer replaced.
// Keys under test: portia-content-last-success-v2 and portia-employees-last-success-v2; the names are imported from lib/device-cache.ts and never
// retyped here, so a renamed key cannot make "empty" pass on an old name. The old (legacy) names come from the same file.
// What this proves is the browser logic on mocked gate answers; live roles, Postgres/RLS, staging, production, the Netlify CDN and physical devices are NOT proven here.
const approved = (level: AccessLevel, nickname = "MockVisitor") => approvedState(level, nickname);
const gateOf = (decision: Record<string, unknown>, viewer: Cut | null): Mode => ({ kind: "gate", decision, viewer });
const openApproved = (level: AccessLevel, nickname = "MockVisitor") => gateOf({ mode: "open", state: approved(level, nickname) }, { editor: false, level });
const openWith = (state: Record<string, unknown>) => gateOf({ mode: "open", state }, { editor: false, level: 1 });
const closedApproved = (level: AccessLevel, nickname = "MockVisitor") => gateOf({ mode: "closed", state: approved(level, nickname), allowed: true, level, editor: false }, { editor: false, level });
const closedOut = (state: Record<string, unknown>) => gateOf({ mode: "closed", state, allowed: false, level: null, editor: false }, null);
const closedEditor = () => gateOf({ mode: "closed", state: { state: "none" }, allowed: true, level: 5, editor: true }, { editor: true, level: 5 });
const rejectedState = { state: "rejected", nickname: "MockVisitor", retryAt: null };

type CopyStamp = { viewer: unknown; person: unknown } | "unreadable" | null;
type Copies = { content: CopyStamp; employees: CopyStamp };

async function readCopies(page: Page): Promise<Copies> {
  return page.evaluate((keys) => {
    const read = (key: string): CopyStamp => {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      try { const value = JSON.parse(raw) as { viewer?: unknown; person?: unknown }; return { viewer: value.viewer, person: value.person }; } catch { return "unreadable"; }
    };
    return { content: read(keys.content), employees: read(keys.employees) };
  }, { content: CONTENT_CACHE_KEY, employees: EMPLOYEES_CACHE_KEY });
}

async function waitForCopies(page: Page, viewer: string, person: string) {
  await expect.poll(() => readCopies(page), { message: `both copies stamped ${viewer}|${person}`, timeout: 15_000 }).toEqual({ content: { viewer, person }, employees: { viewer, person } });
}

/** Nothing of an earlier identity is left: each key is empty, or stamped for the current identity (an open desktop writes a fresh copy for it). */
async function expectOnlyIdentity(page: Page, viewer: string, person: string) {
  const copies = await readCopies(page);
  for (const [name, copy] of Object.entries(copies)) {
    if (copy === null) continue;
    expect(copy, `${name} copy left on the device`).toEqual({ viewer, person });
  }
}

/** No key holds a copy cut for this viewer (an empty key is fine). */
async function expectNoCopyOfViewer(page: Page, viewer: string) {
  await expect.poll(async () => { const copies = await readCopies(page); return Object.values(copies).filter((copy) => copy !== null && (copy === "unreadable" || copy.viewer === viewer)).length; }, { message: `copies still cut for ${viewer}`, timeout: 10_000 }).toBe(0);
}

const refresh = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

test.describe("SEC-04 device copies follow the gate (mocked /api/**)", () => {
  test.describe.configure({ timeout: 90_000 });
  test.afterEach(() => {
    expect(aborted, "own /api paths the mock does not know").toEqual([]);
  });

  test("SEC-04 rejected-open: an approved level-2 visitor is rejected, no copy of theirs stays and the card is the one of a person without a request", async ({ page }) => {
    const control: { mode: Mode } = { mode: openApproved(2) };
    await mockApi(page, control);
    await new DesktopPage(page).goto();
    await waitForCopies(page, "level-2", "mockvisitor");

    control.mode = openWith(rejectedState);
    await refresh(page);
    await expect(page.getByRole("button", { name: "ОТПРАВИТЬ ЗАЯВКУ" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Заявка отклонена")).toHaveCount(0);
    await expect(page.locator(".access-status")).toHaveCount(0);
    // The open desktop keeps running at level 1; the level-2 copy of the earlier person is gone from both keys. A level-1 copy may or may not exist yet (the content answer of the same revision can come before the gate answer), so none is required.
    await expectNoCopyOfViewer(page, "level-2");
  });

  test("SEC-04 revoked-open: an approved level-2 visitor is revoked, no copy of theirs stays and the card is the one of a person without a request", async ({ page }) => {
    const control: { mode: Mode } = { mode: openApproved(2) };
    await mockApi(page, control);
    await new DesktopPage(page).goto();
    await waitForCopies(page, "level-2", "mockvisitor");

    control.mode = openWith({ state: "revoked", nickname: "MockVisitor", retryAt: null });
    await refresh(page);
    await expect(page.getByRole("button", { name: "ОТПРАВИТЬ ЗАЯВКУ" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Доступ отозван")).toHaveCount(0);
    await expect(page.locator(".access-status")).toHaveCount(0);
    await expectNoCopyOfViewer(page, "level-2");
  });

  test("SEC-04 revoked-closed: a revoke on the closed site shows «Доступ отозван», removes the desktop and empties both copies", async ({ page, diagnostics }) => {
    diagnostics.expectFault({ kind: "response", source: /^(fetch|xhr)$/, text: /^GET \/api\/(content|employees) -> 401$/, reason: "the mocked revoke answers 401 access-required on purpose" });
    diagnostics.expectFault({ kind: "console", source: /^browser:\/api\/(content|employees)/, text: /Failed to load resource: the server responded with a status of 401/, reason: "the browser mirrors the mocked 401 to its console" });
    const control: { mode: Mode } = { mode: closedApproved(2) };
    await mockApi(page, control);
    await new DesktopPage(page).goto();
    await waitForCopies(page, "level-2", "mockvisitor");

    control.mode = closedOut({ state: "revoked", nickname: "MockVisitor", retryAt: null });
    await refresh(page);
    await expect(page.locator(".access-status")).toContainText("Доступ отозван", { timeout: 15_000 });
    await expect(page.getByRole("navigation", { name: "Рабочий стол PORTIA" })).toHaveCount(0);
    expect(await readCopies(page), "no copy of the content or the roster on a revoked device").toEqual({ content: null, employees: null });
  });

  test("SEC-04 level-down: level 3 to level 2 erases the level-3 copy and the new copy carries the level-2 stamp", async ({ page }) => {
    const control: { mode: Mode } = { mode: closedApproved(3) };
    await mockApi(page, control);
    await new DesktopPage(page).goto();
    await waitForCopies(page, "level-3", "mockvisitor");

    control.mode = closedApproved(2);
    await refresh(page);
    await expect.poll(() => readCopies(page).then((copies) => copies.content), { timeout: 15_000 }).toEqual({ viewer: "level-2", person: "mockvisitor" });
    await expectOnlyIdentity(page, "level-2", "mockvisitor");
    // The level-3 record is no longer on the screen either: the window shows the placeholder of the withheld record.
    const archive = await openApp(page, "База вирусов");
    await expect(archive.locator(".virus-row", { hasText: "ВИРУС ТРЕТЬЕГО УРОВНЯ" })).toHaveCount(0);
  });

  test("SEC-04 editor-logout: an editor who is no longer one and is not admitted leaves no copy", async ({ page, diagnostics }) => {
    diagnostics.expectFault({ kind: "response", source: /^(fetch|xhr)$/, text: /^GET \/api\/(content|employees) -> 401$/, reason: "after the editor session ends the mocked content route answers 401 access-required on purpose" });
    diagnostics.expectFault({ kind: "console", source: /^browser:\/api\/(content|employees)/, text: /Failed to load resource: the server responded with a status of 401/, reason: "the browser mirrors the mocked 401 to its console" });
    const control: { mode: Mode } = { mode: closedEditor() };
    await mockApi(page, control);
    await new DesktopPage(page).goto();
    await waitForCopies(page, "editor", "");

    control.mode = closedOut({ state: "none" });
    await refresh(page);
    await expect(page.getByRole("navigation", { name: "Рабочий стол PORTIA" })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "ОТПРАВИТЬ ЗАЯВКУ" })).toBeVisible();
    expect(await readCopies(page), "no copy of the editor view stays on the device").toEqual({ content: null, employees: null });
  });

  test("SEC-04 legacy-v1: copies under the old key names are deleted after the first load", async ({ page }) => {
    await mockApi(page, { mode: openApproved(2) });
    // Seeds the old names before the app starts and records that both were present, so "deleted" cannot pass on keys that never existed.
    await page.addInitScript((keys) => {
      for (const key of keys) window.localStorage.setItem(key, JSON.stringify({ content: "legacy copy", revision: 99 }));
      window.sessionStorage.setItem("portia-e2e-legacy-seeded", String(keys.filter((key) => window.localStorage.getItem(key) !== null).length));
    }, [...LEGACY_CACHE_KEYS]);
    await new DesktopPage(page).goto();
    expect(await page.evaluate(() => window.sessionStorage.getItem("portia-e2e-legacy-seeded"))).toBe(String(LEGACY_CACHE_KEYS.length));
    await expect.poll(() => page.evaluate((keys) => keys.map((key) => window.localStorage.getItem(key)), [...LEGACY_CACHE_KEYS]), { timeout: 15_000 }).toEqual(LEGACY_CACHE_KEYS.map(() => null));
    // The current copies are written afresh by the app, so the purge touched only the old names.
    await waitForCopies(page, "level-2", "mockvisitor");
  });

  test("SEC-04 other-person: a copy stamped for another person of the same level is not shown and is replaced", async ({ page }) => {
    const control: { mode: Mode; delayContentMs?: number } = { mode: openApproved(2, "AlphaPerson") };
    await mockApi(page, control);
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await waitForCopies(page, "level-2", "alphaperson");

    // Alpha's own copy, with a record renamed so a copy shown from storage can be told from the answer of the network (same revision and same level: the network answer would be dropped).
    const marker = "КОПИЯ ДРУГОГО ЧЕЛОВЕКА";
    await page.evaluate(({ key, marker: name }) => {
      const copy = JSON.parse(window.localStorage.getItem(key) ?? "null") as { content: { viruses: { id: string; name: string }[] } };
      copy.content.viruses.find((virus) => virus.id === "mock-virus-3")!.name = name;
      window.localStorage.setItem(key, JSON.stringify(copy));
    }, { key: CONTENT_CACHE_KEY, marker });

    control.delayContentMs = 1_500;
    // Control: the same person on the same level is shown their copy, so the seeded copy is a valid one.
    const same = await openApp(page, "База вирусов");
    await expect(same.locator(".virus-row", { hasText: marker })).toHaveCount(1);

    // Another person of the same level: the copy is not shown and is replaced by one of theirs.
    control.mode = openApproved(2, "BetaPerson");
    const other = await openApp(page, "База вирусов");
    await expect(other.locator(".virus-row", { hasText: "ВИРУС 3" })).toHaveCount(1);
    await expect(other.locator(".virus-row", { hasText: marker })).toHaveCount(0);
    await expect.poll(() => readCopies(page).then((copies) => copies.content), { timeout: 15_000 }).toEqual({ viewer: "level-2", person: "betaperson" });
    expect(await page.evaluate(({ key, name }) => window.localStorage.getItem(key)?.includes(name) ?? false, { key: CONTENT_CACHE_KEY, name: marker }), "the other person's copy is not kept").toBe(false);
  });

  test("D-09 pending-open: with closure off a pending request sees the card with the status, not the form", async ({ page }) => {
    await mockApi(page, { mode: openWith({ state: "pending", nickname: "MockVisitor" }) });
    await new DesktopPage(page).goto();
    await expect(page.locator(".access-status")).toContainText("Заявка отправлена", { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "ОТПРАВИТЬ ЗАЯВКУ" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Рабочий стол PORTIA" })).toBeVisible();
  });
});
