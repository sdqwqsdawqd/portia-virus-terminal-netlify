import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Request } from "@playwright/test";
import { defaultPortiaContent } from "../../../lib/portia-content.ts";
import { tabRegistry } from "../../../lib/editor-tabs.ts";
import { DesktopPage } from "../pages/desktop.page";
import { EditorPage } from "../pages/editor.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

// UI-контракт: подменены только GET /api/access и GET /api/content; это не доказательство роли редактора и не живые данные;
// живые проверки редактора остаются в editor-layout.spec.ts на staging (там без роли они «BLOCKED (ENV)», а не прохождение).
// Что здесь доказывается: раскладка и поведение вкладок редактора в браузере (D-62 «Информация»: кнопка раздела сверху).
// Чего здесь нет: прав редактора, сохранения, сервера. Любой не-GET запрос к /api роняет тест (трекер записи), PUT /api/content не уходит.
// Подмена: GET /api/access отвечает canEdit true и всеми открытыми вкладками (редактор монтируется как у владельца без «Доступа»);
// GET /api/content отвечает содержимым по умолчанию (defaultPortiaContent) ревизии 1. Остальное — настоящая сборка в режиме посетителя.

/** Every request that could write to our API or Supabase (GET and HEAD are reads). */
function trackWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && !readOnly) writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}

/** Stubs only the two READS the desktop needs to mount the editor; a write to either path is aborted (and the tracker records it).
 *  D-63 chain: `content` replaces the default fixture and `puts` collects the body of PUT /api/content, which is then aborted too (the only write the chain tolerates). */
async function stubEditorReads(page: Page, options: { content?: unknown; revision?: number; puts?: { content: Record<string, unknown>; revision: number }[] } = {}) {
  await page.route("**/api/access", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ canEdit: true, canManageEditors: false, openTabs: tabRegistry.map((tab) => tab.id), tabsEnforced: false }),
    });
  });
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") {
      if (route.request().method() === "PUT" && options.puts) options.puts.push(JSON.parse(route.request().postData() ?? "null"));
      return route.abort();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ content: options.content ?? defaultPortiaContent, revision: options.revision ?? 1, updatedAt: null }),
    });
  });
}

async function openEditorTab(page: Page, tabName: RegExp, options?: Parameters<typeof stubEditorReads>[1]) {
  await stubEditorReads(page, options);
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  await editor.editorNavigation().getByRole("button", { name: tabName }).click();
  return editor;
}

async function openInfoTab(page: Page) {
  const editor = await openEditorTab(page, /^Информация/);
  await expect(page.getByRole("navigation", { name: "Разделы информации" })).toBeVisible();
  return editor;
}

// Measured on the editor before this plan and NOT caused by D-62 (the guard proves the file differs from the sample only by the D-62 hunk); fixing them needs
// edits of components/portia-editor.tsx and app/portia.css that D-58/D-64 forbid here, so they go to deferred-items.md for an owner decision.
// Tolerated node by node (by the markup of the node), never by rule: any other critical or serious node fails the test.
//  - label-content-name-mismatch: the aria-label of .nested-editor-toggle does not contain its visible text («РАЗДЕЛ 01 …»).
//  - color-contrast: the eyebrow «УПРАВЛЕНИЕ СОДЕРЖИМЫМ» of the editor header, 4.28:1 (PC).
const knownBeforeD62: Record<string, string[]> = {
  "label-content-name-mismatch": ['class="nested-editor-toggle"'],
  "color-contrast": ['class="eyebrow"'],
};

const isPhone = () => test.info().project.name.endsWith("-phone");

type Rect = { x: number; y: number; width: number; height: number };
// Two rectangles overlap when they share area (touching edges and a 1 px rounding gap do not count).
const overlaps = (a: Rect, b: Rect) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

const addSectionButton = (page: Page) => page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true });
const infoTabsNav = (page: Page) => page.getByRole("navigation", { name: "Разделы информации" });
const infoSectionCount = defaultPortiaContent.infoSections.length;

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, "the element has a box").not.toBeNull();
  return found!;
}

/** Creates a section through the bar at the top; it becomes the selected one. */
async function createSection(page: Page, title: string) {
  await addSectionButton(page).click();
  const form = page.locator(".editor-section-create");
  await form.getByLabel("Заголовок раздела").fill(title);
  await form.getByRole("button", { name: "Создать раздел" }).click();
  await expect(form).toBeHidden();
  await expect(infoTabsNav(page).getByRole("button", { name: title, exact: true })).toHaveAttribute("aria-pressed", "true");
}

// Only the selected section is rendered; its card is the one top-level card of a column.
const sectionCard = (page: Page) => page.locator(".editor-section-column > .nested-editor-card");
const subsectionCards = (card: Locator) => card.locator(":scope > .nested-editor-body > .info-subsection-list > .nested-editor-card");
// The add-subsection button is a direct child row of the section card body, below the subsection list.
const subsectionButton = (card: Locator) => card.locator(":scope > .nested-editor-body > .scientist-log-actions").getByRole("button", { name: "+ ПОДРАЗДЕЛ", exact: true });

test.describe("[STAB-EDIT-02] D-62 «Информация» add-section bar", () => {
  test("[STAB-EDIT-02] D-62 «Информация»: add-section sits above the section tabs like «Справочник»", async ({ page }, testInfo) => {
    const writes = trackWrites(page);
    await openInfoTab(page);

    const button = addSectionButton(page);
    await expect(button, "one add-section button in the tab, and it is the top one").toHaveCount(1);
    await expect(page.locator(".editor-section-addbar").getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true }), "the button lives in the pinned bar of «Справочник»").toHaveCount(1);
    const nav = infoTabsNav(page);
    const buttonBox = await box(button);
    const navBox = await box(nav);
    testInfo.annotations.push({ type: "measure", description: `button top ${buttonBox.y}, height ${buttonBox.height}; section tabs top ${navBox.y}` });
    expect(buttonBox.y + buttonBox.height, `the button (top ${buttonBox.y}) is above the section tabs (top ${navBox.y})`).toBeLessThanOrEqual(navBox.y + 1);
    await expect(page.locator(".editor-section-columns ~ button"), "nothing is left below the columns of sections").toHaveCount(0);
    await expect(nav.getByRole("button")).toHaveCount(infoSectionCount);

    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const form = page.locator(".editor-section-create");
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Заголовок раздела")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(form).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    const title = "Раздел из UI-контракта";
    await form.getByLabel("Заголовок раздела").fill(title);
    await form.getByRole("button", { name: "Создать раздел" }).click();
    await expect(form).toBeHidden();
    await expect(nav.getByRole("button")).toHaveCount(infoSectionCount + 1);
    const tab = nav.getByRole("button", { name: title, exact: true });
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    const card = page.locator(".editor-section-column > .nested-editor-card");
    await expect(card, "only the selected section is shown").toHaveCount(1);
    await expect(card.locator(":scope > .nested-editor-head .nested-editor-toggle")).toHaveAttribute("aria-expanded", "true");
    const heading = card.locator(":scope > .nested-editor-body").getByLabel("Заголовок", { exact: true });
    await expect(heading).toHaveValue(title);
    await expect(heading, "focus lands in the title of the new section").toBeFocused();

    // An empty title keeps the old default name.
    await button.click();
    await form.getByRole("button", { name: "Создать раздел" }).click();
    await expect(nav.getByRole("button", { name: "НОВЫЙ РАЗДЕЛ", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(nav.getByRole("button")).toHaveCount(infoSectionCount + 2);

    expect(writes, "the UI contract never writes").toEqual([]);
  });

  test("[STAB-EDIT-02] D-62 the bar stays in view while the tab scrolls and covers neither the section tabs nor the title field", async ({ page }, testInfo) => {
    const writes = trackWrites(page);
    await openInfoTab(page);
    await createSection(page, "Закреплённый раздел");
    const card = sectionCard(page);
    const addSubsection = subsectionButton(card);
    for (let count = 1; count <= 6; count += 1) {
      await addSubsection.click();
      await expect(subsectionCards(card)).toHaveCount(count);
    }

    const bar = page.locator(".editor-section-addbar");
    const nav = infoTabsNav(page);
    const heading = card.locator(":scope > .nested-editor-body").getByLabel("Заголовок", { exact: true });
    const scrollTo = (end: boolean) => isPhone()
      ? page.evaluate((toEnd) => window.scrollTo(0, toEnd ? document.documentElement.scrollHeight : 0), end)
      : page.locator(".content-editor").evaluate((element, toEnd) => { element.scrollTop = toEnd ? element.scrollHeight : 0; }, end);
    const scrollable = () => isPhone()
      ? page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
      : page.locator(".content-editor").evaluate((element) => element.scrollHeight - element.clientHeight);

    expect(await scrollable(), "the tab is long enough to scroll (otherwise the pinning check proves nothing)").toBeGreaterThan(200);

    // At the top: three separate bands, no overlap.
    await scrollTo(false);
    await expect.poll(async () => (await box(heading)).y, "the title field is in view at the top").toBeGreaterThan(0);
    const [barTop, navTop, headingTop] = [await box(bar), await box(nav), await box(heading)];
    expect(overlaps(barTop, navTop), "bar over the section tabs").toBe(false);
    expect(overlaps(barTop, headingTop), "bar over the title field").toBe(false);
    expect(overlaps(navTop, headingTop), "section tabs over the title field").toBe(false);
    expect(barTop.y, "the bar is above the section tabs").toBeLessThan(navTop.y);

    // At the end: the bar is still inside the visible part of the editor and still clear of the section tabs.
    await scrollTo(true);
    await expect.poll(async () => {
      const found = await bar.boundingBox();
      const view = isPhone() ? { top: 0, bottom: page.viewportSize()!.height } : await page.locator(".content-editor").boundingBox().then((editorBox) => ({ top: editorBox!.y, bottom: editorBox!.y + editorBox!.height }));
      return found !== null && found.y >= view.top - 1 && found.y + found.height <= view.bottom + 1;
    }, "the add-section bar is still in the visible part of the editor").toBe(true);
    expect(overlaps(await box(bar), await box(nav)), "bar over the section tabs after scrolling").toBe(false);

    const button = addSectionButton(page);
    const target = await box(button);
    testInfo.annotations.push({ type: "measure", description: `after scrolling: bar ${JSON.stringify(await box(bar))}, section tabs top ${(await box(nav)).y}, button ${target.width}x${target.height}` });
    if (isPhone()) {
      expect(target.width, "phone target width").toBeGreaterThanOrEqual(44);
      expect(target.height, "phone target height").toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "no horizontal overflow of the page").toBeLessThanOrEqual(0);
    // The bar still works from the scrolled position.
    await button.click();
    await expect(page.locator(".editor-section-create").getByLabel("Заголовок раздела")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
    expect(writes, "the UI contract never writes").toEqual([]);
  });

  test("[STAB-EDIT-02] D-62 «+ ПОДРАЗДЕЛ» stays at the bottom of the section card, and sections run in columns of five (D-40)", async ({ page }) => {
    const writes = trackWrites(page);
    await openInfoTab(page);
    const nav = infoTabsNav(page);
    // 4 stored sections + 2 created through the bar at the top = 6: the sixth opens a second column, the fifth stays in the first.
    await createSection(page, "Пятый раздел");
    await createSection(page, "Шестой раздел");
    const columnOfSelected = () => sectionCard(page).evaluate((element) => {
      const column = element.closest(".editor-section-column")!;
      return Array.from(column.parentElement!.children).indexOf(column);
    });
    expect(await columnOfSelected(), "the sixth section is in the second column").toBe(1);
    await nav.getByRole("button", { name: "Пятый раздел", exact: true }).click();
    await expect(nav.getByRole("button", { name: "Пятый раздел", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await columnOfSelected(), "the fifth section is in the first column").toBe(0);

    const card = sectionCard(page);
    const addSubsection = subsectionButton(card);
    await expect(card.getByRole("button", { name: /^\+ ДОБАВИТЬ РАЗДЕЛ/ }), "the card has no add-section button").toHaveCount(0);
    await expect(addSubsection).toBeVisible();
    await expect(addSubsection).toHaveAttribute("aria-describedby", /limit-subsections-/);
    await addSubsection.click();
    await expect(subsectionCards(card)).toHaveCount(1);
    await expect(subsectionCards(card).first().locator(":scope > .nested-editor-head .nested-editor-toggle strong")).toHaveText("ПОДРАЗДЕЛ 01");
    // The button stays below the subsections and inside the card.
    const [list, button, cardBox] = [await box(card.locator(":scope > .nested-editor-body > .info-subsection-list")), await box(addSubsection), await box(card)];
    expect(button.y, "the button is below the subsection list").toBeGreaterThanOrEqual(list.y + list.height - 1);
    expect(button.y + button.height, "the button is inside the card").toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
    await addSubsection.click();
    await expect(subsectionCards(card)).toHaveCount(2);
    expect(writes, "the UI contract never writes").toEqual([]);
  });

  test("[STAB-EDIT-02] D-62 axe finds nothing critical or serious in the «Информация» tab with the add-section form open", async ({ page }, testInfo) => {
    const writes = trackWrites(page);
    await openInfoTab(page);
    await addSectionButton(page).click();
    await expect(page.locator(".editor-section-create").getByLabel("Заголовок раздела")).toBeFocused();
    const describe = (violation: AxeViolation) => `${violation.id}:${violation.impact} @ ${violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} ${node.html.slice(0, 160)} ${node.failureSummary?.replace(/\s+/g, " ").slice(0, 200) ?? ""}`).join(" | ")}`;
    const blockingOf = (violations: AxeViolation[]) => violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");

    // The moved UI itself (bar, form, section tabs): no tolerance at all.
    const moved = await new AxeBuilder({ page }).include(".editor-section-addbar").include(".editor-section-tabs").analyze();
    expect(blockingOf(moved.violations).map(describe), "critical or serious axe violations in the add-section bar and the section tabs").toEqual([]);

    // The whole page: only the two findings measured before this plan (see knownBeforeD62) are tolerated, node by node.
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach("axe-editor-info", {
      body: Buffer.from(JSON.stringify(results.violations.map((violation) => ({
        fingerprint: `${violation.id}:${violation.impact ?? "unknown"}`,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
      })), null, 2)),
      contentType: "application/json",
    });
    const unexpected = blockingOf(results.violations)
      .map((violation) => ({ ...violation, nodes: violation.nodes.filter((node) => !(knownBeforeD62[violation.id] ?? []).some((marker) => node.html.includes(marker))) }))
      .filter((violation) => violation.nodes.length > 0)
      .map(describe);
    expect(unexpected, "critical or serious axe violations other than the two known ones").toEqual([]);
    expect(writes, "the UI contract never writes").toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// [STAB-REL-08] D-63 (20-53): the block «Видимая часть» under a picture field. Same UI contract as above, with ONE tolerated write: PUT /api/content is
// intercepted, its body is recorded and the request is aborted (the abort is declared per test through DiagnosticLedger.expectFault). Any other
// non-GET request fails the test. The chain: editor sliders -> preview of the editor -> body of the PUT -> the site fed with that body.
// Not proven here: editor rights, saving on the server, real photos (the owner's check, 20-UAT EDITOR-FRAMING-01).
// ---------------------------------------------------------------------------------------------------------------------------------------------

type PutBody = { content: Record<string, unknown>; revision: number };
type Frame = { x: number; y: number; zoom: number };
const chosenFrame: Frame = { x: 20, y: 80, zoom: 160 };

/** Every non-GET request to our API or Supabase except PUT /api/content, which the chain intercepts and aborts itself. */
function trackWritesExceptContentPut(page: Page) {
  const writes: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    const interceptedSave = request.method() === "PUT" && url.pathname === "/api/content";
    if ((own || supabase) && !readOnly && !interceptedSave) writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}

/** The aborted save is a fault of the test itself: declared before the click (rules of the same kind as app-states.spec.ts). */
function expectAbortedSave(diagnostics: DiagnosticLedger) {
  diagnostics.expectFault({ kind: "requestfailed", source: /^(fetch|xhr)$/, text: /ERR_FAILED|NS_ERROR|aborted|cancelled/i, reason: "the test aborts its own PUT /api/content on purpose (D-63 chain)" });
  diagnostics.expectFault({ kind: "console", source: /^browser:\/api\//, text: /Failed to load resource: net::ERR_FAILED/, reason: "the browser mirrors the aborted own /api request to its console" });
}

/** What a picture shows: computed object-position and transform, the INLINE transform-origin (the computed one is in pixels and follows the box, the style is the percent pair), the frame box. */
async function pictureState(frame: Locator) {
  const img = frame.locator("img").first();
  await expect(img).toBeVisible();
  const state = await img.evaluate((element: HTMLImageElement) => {
    const computed = getComputedStyle(element);
    return { objectPosition: computed.objectPosition, transform: computed.transform, transformOrigin: element.style.transformOrigin };
  });
  const rect = await box(frame);
  return { ...state, ratio: rect.width / rect.height };
}

type Surface = {
  /** The record the surface shows. */
  name: string;
  tab: RegExp;
  /** The fixture the editor and the site both show: the picture has NO frame yet. */
  content: Record<string, unknown>;
  /** Brings the record with the field on screen in the editor. */
  prepare: (page: Page) => Promise<void>;
  field: (page: Page) => Locator;
  /** The frame this surface got in the body of the PUT. */
  saved: (content: Record<string, any>) => unknown;
  /** Opens the site app with the surface and returns the span `.portia-image` that holds the picture. */
  site: (page: Page) => Promise<Locator>;
};

const saveButton = (page: Page) => page.getByRole("button", { name: "СОХРАНИТЬ", exact: true });

async function setSlider(group: Locator, name: string, from: number, to: number) {
  const slider = group.getByRole("slider", { name });
  await slider.focus();
  const steps = (to - from) / 5;
  for (let step = 0; step < Math.abs(steps); step += 1) await slider.press(steps > 0 ? "ArrowRight" : "ArrowLeft");
  await expect(slider).toHaveValue(String(to));
  await expect(slider).toHaveAttribute("aria-valuetext", `${to} %`);
}

/** Answers GET /api/content with `content` (a write passes nowhere: the tracker sees it). */
async function stubContent(page: Page, content: Record<string, unknown>, revision = 1) {
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ content, revision, updatedAt: null }) });
  });
}

/** Editor -> preview -> PUT body -> site, for one surface. Returns the recorded PUT bodies for further checks. */
async function frameChain(page: Page, diagnostics: DiagnosticLedger, surface: Surface) {
  const writes = trackWritesExceptContentPut(page);
  const puts: PutBody[] = [];
  expectAbortedSave(diagnostics);
  await openEditorTab(page, surface.tab, { content: surface.content, puts });
  await surface.prepare(page);

  const field = surface.field(page);
  await expect(field).toBeVisible();
  const group = field.getByRole("group", { name: "Видимая часть" });
  await expect(group, "the block of the visible part stands under a picture that opened").toBeVisible();
  await setSlider(group, "По горизонтали", 50, chosenFrame.x);
  await setSlider(group, "По вертикали", 50, chosenFrame.y);
  await setSlider(group, "Масштаб", 100, chosenFrame.zoom);
  const preview = await pictureState(group.locator(".portia-image").first());
  expect(preview.objectPosition).toBe(`${chosenFrame.x}% ${chosenFrame.y}%`);
  expect(preview.transform).toBe(`matrix(${chosenFrame.zoom / 100}, 0, 0, ${chosenFrame.zoom / 100}, 0, 0)`);
  expect(preview.transformOrigin).toBe(`${chosenFrame.x}% ${chosenFrame.y}%`);

  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  await expect.poll(() => puts.length, "the save reached the intercepted PUT").toBe(1);
  expect(surface.saved(puts[0].content), "the body of the PUT holds the chosen frame").toEqual(chosenFrame);

  // The site, fed with exactly the body of the PUT (a fresh revision, an empty device cache: no copy of the editor's fixture is shown instead).
  await page.unroute("**/api/content**");
  await stubContent(page, puts[0].content, puts[0].revision + 1);
  await page.addInitScript(() => window.localStorage.clear());
  const picture = await surface.site(page);
  const site = await pictureState(picture);
  expect(site.objectPosition, "object-position: the site equals the preview").toBe(preview.objectPosition);
  expect(site.transform, "transform: the site equals the preview").toBe(preview.transform);
  expect(site.transformOrigin, "transform-origin: the site equals the preview").toBe(preview.transformOrigin);
  expect(Math.abs(site.ratio - preview.ratio) / site.ratio, `the frame ratio of the preview (${preview.ratio.toFixed(3)}) is within 2% of the site (${site.ratio.toFixed(3)})`).toBeLessThanOrEqual(0.02);
  expect(writes, "no write but the intercepted PUT").toEqual([]);
  return { puts, preview, site };
}

const fixtureContent = (patch: Record<string, unknown>): Record<string, unknown> => ({ ...structuredClone(defaultPortiaContent), ...patch });

/** The section card is the one top-level card of its column; a section opens by its toggle. */
async function openSelectedSectionCard(page: Page) {
  const toggle = sectionCard(page).locator(":scope > .nested-editor-head .nested-editor-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

const guideSectionSurface: Surface = {
  name: "«Справочник» section photo",
  tab: /^Справочник/,
  content: fixtureContent({ guideSections: [{ id: "g-d63", title: "Раздел с фото", photo: "/assets/portia-assistant.png", cards: [] }] }),
  prepare: openSelectedSectionCard,
  field: (page) => page.locator(".image-editor-field").filter({ hasText: "Фото раздела" }),
  saved: (content) => content.guideSections.find((section: { id: string }) => section.id === "g-d63")?.photoFraming,
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Справочник");
    return desktop.window("Справочник").locator(".guide-section").filter({ hasText: "Раздел с фото" }).locator(".guide-section-band");
  },
};

test.describe("[STAB-REL-08] D-63 the editor chooses the visible part of a picture", () => {
  test("[STAB-REL-08] D-63 «Справочник» section photo: the editor preview is the site", async ({ page, diagnostics }) => {
    await frameChain(page, diagnostics, guideSectionSurface);
  });
});
