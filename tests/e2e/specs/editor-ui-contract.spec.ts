import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Request } from "@playwright/test";
import { defaultPortiaContent, type PortiaContent } from "../../../lib/portia-content.ts";
import { tabRegistry } from "../../../lib/editor-tabs.ts";
import { DesktopPage } from "../pages/desktop.page";
import { EditorPage } from "../pages/editor.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";

type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

// UI-контракт: подменены только GET /api/access, GET /api/content и GET /api/users; это не доказательство роли редактора и не живые данные;
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

/** Stubs only the READS the desktop needs to mount the editor; a write to any stubbed path is aborted (and the tracker records it).
 *  D-63 chain: `content` replaces the default fixture and `puts` collects the body of PUT /api/content, which is then aborted too (the only write the chain tolerates). */
async function stubEditorReads(page: Page, options: { content?: unknown; revision?: number; puts?: { content: PortiaContent; revision: number }[] } = {}) {
  await page.route("**/api/access", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ canEdit: true, canManageEditors: false, openTabs: tabRegistry.map((tab) => tab.id), tabsEnforced: false }),
    });
  });
  await page.route("**/api/users**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    const view = new URL(route.request().url()).searchParams.get("view");
    const emptyList = {
      callerIsOwner: false,
      pendingTotalAll: 0,
      serverNow: "2026-11-11T12:00:00.000Z",
      pending: { total: 0, rows: [] },
      people: { total: 0, rows: [] },
      closed: { total: 0, rows: [] },
      roster: "ok",
    };
    const body = view === "count"
      ? { pending: 0 }
      : view === "history"
        ? { entries: [] }
        : view === "bulk"
          ? { roster: "ok", eligible: [], excluded: [] }
          : { list: emptyList };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(body),
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
// [STAB-REL-08] D-66 (20-56, replaces the three sliders of D-63 / 20-53): the block «Видимая часть» under a picture field is a compact preview and «Изменить»;
// the dialog «Видимая часть» (native <dialog>) chooses the part. Same UI contract as above, with ONE tolerated write: PUT /api/content is
// intercepted, its body is recorded and the request is aborted (the abort is declared per test through DiagnosticLedger.expectFault). Any other
// non-GET request fails the test. The chain: dialog -> «Применить» -> preview of the editor -> body of the PUT -> the site fed with that body.
// D-67: the frame of the dialog is the place of the site (proportions and the visible part, against the site on the same fixture).
// Not proven here: editor rights, saving on the server, real photos (the owner's check, 20-UAT EDITOR-FRAMING-01), dragging by finger and mouse, cyclic Tab, axe of the dialog (20-57).
// ---------------------------------------------------------------------------------------------------------------------------------------------

type PutBody = { content: PortiaContent; revision: number };
type Frame = { x: number; y: number; zoom: number };
const chosenFrame: Frame = { x: 20, y: 80, zoom: 160 };
const otherPicture = "/assets/portia-logo.png";

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
  diagnostics.expectFault({ kind: "requestfailed", source: /^(fetch|xhr)$/, text: /ERR_FAILED|NS_ERROR|aborted|cancelled|Blocked by Web Inspector/i, reason: "the test aborts its own PUT /api/content on purpose (D-63 chain); WebKit words an aborted request «Blocked by Web Inspector»" });
  diagnostics.expectFault({ kind: "console", source: /^browser:\/api\//, text: /Failed to load resource: net::ERR_FAILED/, reason: "the browser mirrors the aborted own /api request to its console" });
}

/** What a picture shows: computed object-position and transform, the INLINE transform-origin (the computed one is in pixels and follows the box, the style is the percent pair; Firefox writes it with a third "0px", dropped here), and the ratios of the frame and of the picture. */
async function pictureState(frame: Locator) {
  // A picture below the fold is lazy: WebKit loads it only once it is in view.
  await frame.scrollIntoViewIfNeeded();
  const img = frame.locator("img").first();
  await expect(img).toBeVisible();
  const state = await img.evaluate((element: HTMLImageElement) => {
    const computed = getComputedStyle(element);
    return { objectPosition: computed.objectPosition, transform: computed.transform, transformOrigin: element.style.transformOrigin.replace(/ 0px$/, "") };
  });
  const frameBox = await box(frame);
  const imgBox = await box(img);
  return { ...state, frameRatio: frameBox.width / frameBox.height, imgRatio: imgBox.width / imgBox.height };
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
  /** The record of the PUT body that carries the picture and its frame, the keys of its address and of its frame. */
  holder: (content: PortiaContent) => Record<string, unknown> | undefined;
  addressKey: string;
  frameKey: string;
  /** Opens the site app with the surface and returns the span `.portia-image` that holds the picture. */
  site: (page: Page) => Promise<Locator>;
  /** What the ratio check compares: the clipping frame (a band, a cover) or the picture box (a picture that lies as it is: the frame of the site is a wider span). */
  compare: "frame" | "picture";
};

/** Unsaved edits sit behind the chip of the save bar: it opens the panel with «СОХРАНИТЬ». */
async function save(page: Page) {
  const popover = page.locator(".editor-save-popover");
  if (!(await popover.isVisible())) await page.locator(".editor-save-chip > button").click();
  const button = popover.getByRole("button", { name: "СОХРАНИТЬ", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}

// The dialog «Видимая часть» (D-66): the closed block holds the preview and «Изменить»; the dialog is a native <dialog> in the top layer.
const dialogOf = (page: Page) => page.getByRole("dialog", { name: /^Видимая часть/ });
const positionOf = (dialog: Locator) => dialog.getByRole("slider", { name: "Положение картинки" });
const zoomOf = (dialog: Locator) => dialog.getByRole("slider", { name: "Масштаб" });
const positionText = ({ x, y }: { x: number; y: number }) => `по горизонтали ${x} %, по вертикали ${y} %`;

/** Clicks «Изменить» and waits until the dialog has laid the picture out under its frame. */
async function openFraming(page: Page, group: Locator) {
  const change = group.getByRole("button", { name: "Изменить" });
  await expect(change, "the closed block has the button «Изменить»").toBeVisible();
  await change.click();
  const dialog = dialogOf(page);
  await expect(dialog, "«Изменить» opens the dialog «Видимая часть»").toBeVisible();
  await expect(dialog.locator(".image-framing-window"), "the picture of the dialog is laid out under its frame").toBeVisible();
  return dialog;
}

/** «Масштаб» by the arrow keys of the slider (steps of 5) to `to`. */
async function setZoom(dialog: Locator, to: number) {
  const slider = zoomOf(dialog);
  await slider.focus();
  const steps = (to - Number(await slider.inputValue())) / 5;
  for (let step = 0; step < Math.abs(steps); step += 1) await slider.press(steps > 0 ? "ArrowRight" : "ArrowLeft");
  await expect(slider).toHaveValue(String(to));
  await expect(slider).toHaveAttribute("aria-valuetext", `${to} %`);
}

/** «Положение картинки» by the arrow keys (steps of 5) to `to`; the value is read from aria-valuetext. */
async function movePart(dialog: Locator, to: { x: number; y: number }) {
  const part = positionOf(dialog);
  await part.focus();
  const text = (await part.getAttribute("aria-valuetext")) ?? "";
  const found = /по горизонтали (\d+) %, по вертикали (\d+) %/.exec(text);
  expect(found, `aria-valuetext of the position «${text}»`).not.toBeNull();
  const from = { x: Number(found![1]), y: Number(found![2]) };
  for (let step = 0; step < Math.abs(to.x - from.x) / 5; step += 1) await part.press(to.x > from.x ? "ArrowRight" : "ArrowLeft");
  for (let step = 0; step < Math.abs(to.y - from.y) / 5; step += 1) await part.press(to.y > from.y ? "ArrowDown" : "ArrowUp");
  await expect(part).toHaveAttribute("aria-valuetext", positionText(to));
}

async function applyFraming(dialog: Locator) {
  await dialog.getByRole("button", { name: "Применить" }).click();
  await expect(dialog, "«Применить» closes the dialog").toBeHidden();
}

type Fractions = { left: number; top: number; width: number; height: number };

/** The window of the dialog, from the rectangles of its frame and of its dimmed picture: the part of the picture inside the frame, in fractions. */
async function dialogWindow(dialog: Locator) {
  const frame = await box(dialog.locator(".image-framing-window"));
  const image = await box(dialog.locator(".image-framing-dim"));
  const visible: Fractions = { left: (frame.x - image.x) / image.width, top: (frame.y - image.y) / image.height, width: frame.width / image.width, height: frame.height / image.height };
  return { frame, image, ratio: frame.width / frame.height, visible };
}

/** The part of the picture the SITE shows, by an independent model of the DOM: the clipping frame (.portia-image), the layout box of the img, its natural size,
 *  computed object-fit and object-position, the scale of the computed transform and the percent pair of the inline transform-origin. The frame region is mapped
 *  back through the transform onto the content rectangle of the picture. */
async function siteWindow(place: Locator) {
  await place.scrollIntoViewIfNeeded();
  await expect.poll(() => place.locator("img").first().evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0), "the site picture is loaded").toBe(true);
  return place.evaluate((element: HTMLElement) => {
    const clip = (element.matches(".portia-image") ? element : element.querySelector(".portia-image")) as HTMLElement;
    const img = clip.querySelector("img") as HTMLImageElement;
    const style = getComputedStyle(img);
    const percent = (text: string) => text.split(/\s+/).map((part) => (part.endsWith("%") ? Number.parseFloat(part) : 50));
    const boxLeft = img.offsetLeft, boxTop = img.offsetTop, boxWidth = img.offsetWidth, boxHeight = img.offsetHeight;
    const natural = { width: img.naturalWidth, height: img.naturalHeight };
    let drawnWidth = boxWidth, drawnHeight = boxHeight;
    if (style.objectFit === "cover" || style.objectFit === "contain") {
      const scale = (style.objectFit === "cover" ? Math.max : Math.min)(boxWidth / natural.width, boxHeight / natural.height);
      drawnWidth = natural.width * scale;
      drawnHeight = natural.height * scale;
    }
    const [positionX, positionY] = percent(style.objectPosition);
    const contentLeft = boxLeft + (boxWidth - drawnWidth) * (positionX / 100);
    const contentTop = boxTop + (boxHeight - drawnHeight) * (positionY / 100);
    const matrix = style.transform === "none" ? null : new DOMMatrixReadOnly(style.transform);
    const zoom = matrix ? matrix.a : 1;
    const [originX, originY] = percent(img.style.transformOrigin || "50% 50%");
    const pointX = boxLeft + boxWidth * (originX / 100);
    const pointY = boxTop + boxHeight * (originY / 100);
    const back = (qx: number, qy: number) => [(pointX + (qx - pointX) / zoom - contentLeft) / drawnWidth, (pointY + (qy - pointY) / zoom - contentTop) / drawnHeight];
    const region = (x0: number, y0: number, x1: number, y1: number) => {
      const [left, top] = back(x0, y0);
      const [right, bottom] = back(x1, y1);
      return { left, top, width: right - left, height: bottom - top };
    };
    // `visible`: what the clipping frame of the site shows. `inPicture`: the same model with the drawn picture as the frame (what the dialog promises for a picture that lies whole).
    // They differ only where the site draws the picture other than its frame (smaller, or clipped) (a picture capped in height by the style sheet: «Корзина», max-height 55vh; a short phone screen).
    return {
      visible: region(0, 0, clip.clientWidth, clip.clientHeight),
      inPicture: region(contentLeft, contentTop, contentLeft + drawnWidth, contentTop + drawnHeight),
      frameOverPicture: Math.max(clip.clientWidth / drawnWidth, drawnWidth / clip.clientWidth, clip.clientHeight / drawnHeight, drawnHeight / clip.clientHeight),
      frameRatio: clip.clientWidth / clip.clientHeight,
      imgRatio: boxWidth / boxHeight,
      objectFit: style.objectFit,
    };
  });
}

const maxDifference = (a: Fractions, b: Fractions) => Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height));

/** Answers GET /api/content with `content` (a write passes nowhere: the tracker sees it). */
async function stubContent(page: Page, content: Record<string, unknown>, revision = 1) {
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ content, revision, updatedAt: null }) });
  });
}

const groupOf = (surface: Surface, page: Page) => surface.field(page).getByRole("group", { name: "Видимая часть" });

/** Editor -> dialog -> «Применить» -> preview -> PUT body -> site, then (on the same draft) «Отмена», Esc, the backdrop, «Сбросить» and a new address, for one surface. */
async function frameChain(page: Page, diagnostics: DiagnosticLedger, surface: Surface) {
  const writes = trackWritesExceptContentPut(page);
  const puts: PutBody[] = [];
  expectAbortedSave(diagnostics);
  const editor = await openEditorTab(page, surface.tab, { content: surface.content, puts });
  await surface.prepare(page);

  await expect(surface.field(page)).toBeVisible();
  const group = groupOf(surface, page);
  await expect(group, "the block of the visible part stands under a picture that opened").toBeVisible();
  await expect(group.getByRole("slider"), "the closed block holds no slider").toHaveCount(0);

  const dialog = await openFraming(page, group);
  await setZoom(dialog, chosenFrame.zoom);
  await movePart(dialog, chosenFrame);
  await applyFraming(dialog);
  await expect(group.getByRole("button", { name: "Изменить" }), "the focus returns to «Изменить»").toBeFocused();
  const preview = await pictureState(group.locator(".portia-image").first());
  expect(preview.objectPosition).toBe(`${chosenFrame.x}% ${chosenFrame.y}%`);
  expect(preview.transform).toBe(`matrix(${chosenFrame.zoom / 100}, 0, 0, ${chosenFrame.zoom / 100}, 0, 0)`);
  expect(preview.transformOrigin).toBe(`${chosenFrame.x}% ${chosenFrame.y}%`);

  await save(page);
  await expect.poll(() => puts.length, "the save reached the intercepted PUT").toBe(1);
  expect(surface.holder(puts[0].content)?.[surface.frameKey], "the body of the PUT holds the chosen frame").toEqual(chosenFrame);
  await expect(editor.editorNavigation()).toBeVisible();

  // The site, fed with exactly that body (the frame chosen in the dialog): a fresh revision, an empty device cache.
  await page.unroute("**/api/content**");
  await stubContent(page, puts[0].content, puts[0].revision + 1);
  await page.addInitScript(() => window.localStorage.clear());
  const picture = await surface.site(page);
  const site = await pictureState(picture);
  expect(site.objectPosition, "object-position: the site equals the preview").toBe(preview.objectPosition);
  expect(site.transform, "transform: the site equals the preview").toBe(preview.transform);
  expect(site.transformOrigin, "transform-origin: the site equals the preview").toBe(preview.transformOrigin);
  const [siteRatio, previewRatio] = surface.compare === "frame" ? [site.frameRatio, preview.frameRatio] : [site.imgRatio, preview.imgRatio];
  expect(Math.abs(siteRatio - previewRatio) / siteRatio, `the ${surface.compare} ratio of the preview (${previewRatio.toFixed(3)}) is within 2% of the site (${siteRatio.toFixed(3)})`).toBeLessThanOrEqual(0.02);

  // The editor again, now on content that already carries the frame (the body above): the dialog reads the frame back; «Отмена», Esc and a click
  // on the backdrop change nothing; «Сбросить» + «Применить» takes the frame out of the data; a new address takes a chosen frame with it.
  await page.unroute("**/api/content**");
  const second: PutBody[] = [];
  const again = await openEditorTab(page, surface.tab, { content: puts[0].content, revision: puts[0].revision + 1, puts: second });
  await surface.prepare(page);
  await expect(surface.field(page)).toBeVisible();
  const framed = groupOf(surface, page);
  const storedState = async () => (await pictureState(framed.locator(".portia-image").first())).objectPosition;

  let open = await openFraming(page, framed);
  await expect(positionOf(open), "the stored frame is read back").toHaveAttribute("aria-valuetext", positionText(chosenFrame));
  await expect(zoomOf(open)).toHaveValue(String(chosenFrame.zoom));
  await movePart(open, { x: 35, y: 65 });
  await open.getByRole("button", { name: "Отмена" }).click();
  await expect(open, "«Отмена» closes the dialog").toBeHidden();
  await expect(page.locator(".editor-save-chip"), "«Отмена» leaves the draft unchanged").toHaveCount(0);
  expect(await storedState(), "«Отмена»: the preview is as before").toBe(`${chosenFrame.x}% ${chosenFrame.y}%`);

  open = await openFraming(page, framed);
  await movePart(open, { x: 35, y: 65 });
  await positionOf(open).press("Escape");
  await expect(open, "Esc closes the dialog").toBeHidden();
  await expect(again.editorNavigation(), "Esc leaves the window of the editor open").toBeVisible();
  await expect(page.locator(".editor-save-chip"), "Esc leaves the draft unchanged").toHaveCount(0);
  expect(await storedState(), "Esc: the preview is as before").toBe(`${chosenFrame.x}% ${chosenFrame.y}%`);

  open = await openFraming(page, framed);
  await page.mouse.click(3, 3);
  await expect(open, "a click on the dimmed backdrop does not close the dialog").toBeVisible();

  await open.getByRole("button", { name: "Сбросить" }).click();
  await expect(zoomOf(open)).toHaveValue("100");
  await expect(positionOf(open), "«Сбросить» puts the window back to 50 / 50 / 100").toHaveAttribute("aria-valuetext", positionText({ x: 50, y: 50 }));
  await applyFraming(open);
  await save(page);
  await expect.poll(() => second.length).toBe(1);
  const afterReset = surface.holder(second[0].content);
  expect(afterReset, "the record is still in the body").toBeDefined();
  expect(Object.prototype.hasOwnProperty.call(afterReset!, surface.frameKey), "no frame key after «Сбросить» and «Применить»").toBe(false);
  expect(afterReset?.[surface.addressKey], "the address is untouched by «Сбросить»").toBe(surface.holder(puts[0].content)?.[surface.addressKey]);

  open = await openFraming(page, framed);
  await setZoom(open, 150);
  await applyFraming(open);
  await expect(framed.locator(".portia-image").first()).toHaveAttribute("data-framing", "true");
  await surface.field(page).getByRole("textbox").first().fill(otherPicture);
  await expect(framed.locator(".portia-image").first(), "the preview of the new picture is without a frame").not.toHaveAttribute("data-framing", "true");
  await save(page);
  await expect.poll(() => second.length).toBe(2);
  const afterAddress = surface.holder(second[1].content);
  expect(afterAddress?.[surface.addressKey], "the new address is in the body").toBe(otherPicture);
  expect(Object.prototype.hasOwnProperty.call(afterAddress!, surface.frameKey), "no frame key after the address changed").toBe(false);
  expect(writes, "no write but the intercepted PUT").toEqual([]);
}

const fixtureContent = (patch: Record<string, unknown>): Record<string, unknown> => ({ ...structuredClone(defaultPortiaContent), ...patch });

/** A card of the editor (section, subsection, block, guide card) opens by the toggle of its head; an open one stays open. */
async function openCard(page: Page, id: string) {
  const toggle = page.locator(`#card-${id} > .nested-editor-head .nested-editor-toggle`);
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

/** The first virus row opens its record (on a phone the list comes first), and the dossier tab is chosen. */
async function openVirusRecord(page: Page, dossierTab: string) {
  await page.locator(".editor-record-list .editor-record-row button", { has: page.locator("strong") }).first().click();
  await page.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name: dossierTab }).click();
}

const baseVirus = () => ({ ...structuredClone(defaultPortiaContent.viruses[0]), id: "virus-d63", name: "Вирус с фото", infectedImage: "/assets/portia-assistant.png", mutations: [{ name: "Мутация с фото", description: "", image: "/assets/portia-assistant.png" }] });
const imageField = (page: Page) => page.locator(".image-editor-field").first();
const guideCard = { id: "c-d63", title: "Карточка с обложкой", cover: "/assets/portia-assistant.png", blocks: [] };
const infoSection = { id: "i-d63", title: "Раздел с фото", body: "", subsections: [{ id: "i-d63-s", title: "Страница с фото", blocks: [{ id: "ph-d63", type: "photo", url: "/assets/portia-assistant.png" }] }] };
const recycleImageFile = { id: "f-d63", name: "Файл с фото", location: "C:\\PORTIA\\RECYCLE_BIN", kind: "image", content: "", image: "/assets/portia-assistant.png", virusId: "" };

const guideSectionSurface: Surface = {
  name: "«Справочник» section photo (band)",
  tab: /^Справочник/,
  content: fixtureContent({ guideSections: [{ id: "g-d63", title: "Раздел с фото", photo: "/assets/portia-assistant.png", cards: [] }] }),
  prepare: openSelectedSectionCard,
  field: (page) => page.locator(".image-editor-field").filter({ hasText: "Фото раздела" }),
  holder: (content) => content.guideSections.find((section) => section.id === "g-d63") as unknown as Record<string, unknown>,
  addressKey: "photo",
  frameKey: "photoFraming",
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Справочник");
    return desktop.window("Справочник").locator(".guide-section").filter({ hasText: "Раздел с фото" }).locator(".guide-section-band");
  },
  compare: "frame",
};

const guideCoverSurface: Surface = {
  name: "«Справочник» card cover (tile)",
  tab: /^Справочник/,
  content: fixtureContent({ guideSections: [{ id: "g-d63", title: "Раздел", photo: "", cards: [guideCard] }] }),
  prepare: async (page) => { await openSelectedSectionCard(page); await openCard(page, guideCard.id); },
  field: (page) => page.locator(`#card-${guideCard.id}`).locator(".image-editor-field").filter({ hasText: "Обложка" }),
  holder: (content) => content.guideSections[0].cards.find((card) => card.id === guideCard.id) as unknown as Record<string, unknown>,
  addressKey: "cover",
  frameKey: "coverFraming",
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Справочник");
    const guide = desktop.window("Справочник");
    const head = guide.locator('.guide-section-head[aria-expanded="false"]');
    if (await head.count()) await head.first().click();
    return guide.locator(".guide-tile").filter({ hasText: guideCard.title }).locator(".guide-tile-cover");
  },
  compare: "frame",
};

const virusPhotoSurface: Surface = {
  name: "virus photo after infection (natural)",
  tab: /^База вирусов/,
  content: fixtureContent({ viruses: [baseVirus()] }),
  prepare: (page) => openVirusRecord(page, "Основное"),
  field: imageField,
  holder: (content) => content.viruses.find((virus) => virus.id === "virus-d63") as unknown as Record<string, unknown>,
  addressKey: "infectedImage",
  frameKey: "infectedImageFraming",
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("База вирусов");
    return desktop.window("База вирусов").locator(".record-view .subject-media").nth(0);
  },
  compare: "picture",
};

const mutationSurface: Surface = {
  name: "mutation image (natural)",
  tab: /^База вирусов/,
  content: fixtureContent({ viruses: [baseVirus()] }),
  prepare: (page) => openVirusRecord(page, "Мутации"),
  field: imageField,
  holder: (content) => content.viruses.find((virus) => virus.id === "virus-d63")?.mutations[0] as unknown as Record<string, unknown>,
  addressKey: "image",
  frameKey: "imageFraming",
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("База вирусов");
    return desktop.window("База вирусов").locator(".record-view .subject-media").nth(1);
  },
  compare: "picture",
};

const infoPhotoSurface: Surface = {
  name: "«Информация» photo block (natural)",
  tab: /^Информация/,
  content: fixtureContent({ infoSections: [infoSection] }),
  prepare: async (page) => { await openSelectedSectionCard(page); await openCard(page, "i-d63-s"); await openCard(page, "ph-d63"); },
  field: imageField,
  holder: (content) => content.infoSections[0].subsections[0].blocks.find((block) => block.id === "ph-d63") as unknown as Record<string, unknown>,
  addressKey: "url",
  frameKey: "framing",
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Информация");
    const info = desktop.window("Информация");
    await info.locator(".info-index > div > button").filter({ hasText: "Раздел с фото" }).click();
    await info.locator('.info-index [data-info-id="i-d63-s"]').click();
    return info.locator(".info-document .info-block-photo").first();
  },
  compare: "picture",
};

const recycleFileSurface: Surface = {
  name: "«Корзина» image file (natural)",
  tab: /^Корзина/,
  content: fixtureContent({ recycleFiles: [recycleImageFile], recycledViruses: [], recycleOrder: ["file:f-d63"] }),
  prepare: async (page) => { await page.locator(".editor-record-list .editor-record-row button").filter({ hasText: "Файл с фото" }).click(); },
  field: (page) => page.locator(".image-editor-field").filter({ hasText: "Фотография или GIF" }),
  holder: (content) => content.recycleFiles.find((file) => file.id === "f-d63") as unknown as Record<string, unknown>,
  addressKey: "image",
  frameKey: "imageFraming",
  site: async (page) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Корзина");
    const trash = desktop.window("Корзина");
    await trash.locator(".trash-file-row").filter({ hasText: "Файл с фото" }).click();
    return trash.locator(".trash-image-document");
  },
  compare: "picture",
};

const archivedVirus = () => ({ ...baseVirus(), id: "virus-d63-bin", name: "Вирус в корзине с фото" });
const archivedVirusSite = async (page: Page, index: number) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Корзина");
  const trash = desktop.window("Корзина");
  await trash.locator(".trash-file-row").filter({ hasText: "Вирус в корзине с фото" }).click();
  return trash.locator(".trash-virus-document .subject-media").nth(index);
};

const archivedPhotoSurface: Surface = {
  name: "«Корзина» virus photo (natural)",
  tab: /^Корзина/,
  content: fixtureContent({ recycleFiles: [], recycledViruses: [archivedVirus()], recycleOrder: ["virus:virus-d63-bin"] }),
  prepare: async (page) => { await page.locator(".editor-record-list .editor-record-row button").filter({ hasText: "Вирус в корзине с фото" }).click(); },
  field: imageField,
  holder: (content) => content.recycledViruses.find((virus) => virus.id === "virus-d63-bin") as unknown as Record<string, unknown>,
  addressKey: "infectedImage",
  frameKey: "infectedImageFraming",
  site: (page) => archivedVirusSite(page, 0),
  compare: "picture",
};

const archivedMutationSurface: Surface = {
  name: "«Корзина» virus mutation image (natural)",
  tab: /^Корзина/,
  content: fixtureContent({ recycleFiles: [], recycledViruses: [archivedVirus()], recycleOrder: ["virus:virus-d63-bin"] }),
  prepare: async (page) => {
    await page.locator(".editor-record-list .editor-record-row button").filter({ hasText: "Вирус в корзине с фото" }).click();
    await page.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name: "Мутации" }).click();
  },
  field: imageField,
  holder: (content) => content.recycledViruses.find((virus) => virus.id === "virus-d63-bin")?.mutations[0] as unknown as Record<string, unknown>,
  addressKey: "image",
  frameKey: "imageFraming",
  site: (page) => archivedVirusSite(page, 1),
  compare: "picture",
};

/** The section card is the one top-level card of its column; a section opens by its toggle. */
async function openSelectedSectionCard(page: Page) {
  const toggle = sectionCard(page).locator(":scope > .nested-editor-head .nested-editor-toggle");
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

const allSurfaces = [guideSectionSurface, guideCoverSurface, virusPhotoSurface, mutationSurface, infoPhotoSurface, recycleFileSurface, archivedPhotoSurface, archivedMutationSurface];

test.describe("[STAB-REL-08] D-66 the dialog «Видимая часть» chooses the visible part of a picture", () => {
  for (const surface of allSurfaces) {
    test(`[STAB-REL-08] D-66 ${surface.name}: the dialog chooses the part, the preview is the site`, async ({ page, diagnostics }) => {
      await frameChain(page, diagnostics, surface);
    });
  }
});

// [STAB-REL-08] D-67: the frame of the dialog is the place of the site. The content carries the frame, so the dialog reads it back and the site draws it.
// Proportions: the frame of the dialog against the place on the site (the clipping frame of a band or a cover, the picture itself for pictures that lie whole), 2%.
// Visible part: the rectangles of the dialog (frame over the dimmed picture) against an independent model of the DOM of the site, 0.015 of the picture.
function withFrame(surface: Surface, frame: Frame): Record<string, unknown> {
  const content = structuredClone(surface.content);
  (surface.holder(content as unknown as PortiaContent) as Record<string, unknown>)[surface.frameKey] = frame;
  return content;
}

const frameCases: Frame[] = [chosenFrame, { x: 50, y: 30, zoom: 200 }];

async function frameMatchesSite(page: Page, diagnostics: DiagnosticLedger, surface: Surface, frame: Frame) {
  const writes = trackWritesExceptContentPut(page);
  // The test leaves the editor page for the site (a second load of the page) while a read of the first page may still be in flight; WebKit reports such a read as a cancelled load.
  diagnostics.expectFault({ kind: "requestfailed", source: "fetch", text: /Load request cancelled|cancelled|aborted/i, reason: "the test leaves the page of the editor for the site while a read is in flight (WebKit reports the cancelled load)" });
  const content = withFrame(surface, frame);
  await openEditorTab(page, surface.tab, { content });
  await surface.prepare(page);
  await expect(surface.field(page)).toBeVisible();
  const group = groupOf(surface, page);
  await expect(group).toBeVisible();
  await expect(group.locator(".portia-image.is-loaded"), "the preview of the block is loaded").toBeVisible();
  const previewBox = await box(group.locator(".portia-image").first());

  const dialog = await openFraming(page, group);
  const inDialog = await dialogWindow(dialog);
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();

  await page.unroute("**/api/content**");
  await stubContent(page, content, 2);
  await page.addInitScript(() => window.localStorage.clear());
  const place = await surface.site(page);
  const onSite = await siteWindow(place);
  const siteRatio = surface.compare === "frame" ? onSite.frameRatio : onSite.imgRatio;

  const where = `${surface.name} at ${frame.x}/${frame.y}/${frame.zoom}`;
  // A picture that lies whole is compared with the site's frame. Where the site draws it narrower than its frame (capped in height by the style sheet, «Корзина»: 20-56 plan assumption 2),
  // the dialog frame is the picture and the site shows a little more: the drawn picture is the frame of the comparison, the overshoot is measured, recorded and capped at 25%.
  const frameIsWider = surface.compare === "picture" && onSite.frameOverPicture > 1.01;
  const siteVisible = frameIsWider ? onSite.inPicture : onSite.visible;
  if (frameIsWider) expect(onSite.frameOverPicture, `the site frame differs from the drawn picture (known limit of D-67), but not by more than 25%: ${where}`).toBeLessThanOrEqual(1.25);
  test.info().annotations.push({ type: "measure", description: `${where}: ratio dialog ${inDialog.ratio.toFixed(4)}, preview ${(previewBox.width / previewBox.height).toFixed(4)}, site ${siteRatio.toFixed(4)} (${surface.compare}); dialog ${JSON.stringify(inDialog.visible)}, site frame ${JSON.stringify(onSite.visible)}, site picture ${JSON.stringify(onSite.inPicture)} (${onSite.objectFit}), site frame over picture ${onSite.frameOverPicture.toFixed(4)}, max difference ${maxDifference(inDialog.visible, siteVisible).toFixed(4)}${frameIsWider ? " (against the drawn picture)" : ""}` });
  expect(Math.abs(inDialog.ratio - siteRatio) / siteRatio, `the frame of the dialog (${inDialog.ratio.toFixed(3)}) is within 2% of the place on the site (${siteRatio.toFixed(3)}): ${where}`).toBeLessThanOrEqual(0.02);
  expect(Math.abs(previewBox.width / previewBox.height - siteRatio) / siteRatio, `the preview of the block is within 2% of the place on the site: ${where}`).toBeLessThanOrEqual(0.02);
  for (const key of ["left", "top", "width", "height"] as const) {
    expect(Math.abs(inDialog.visible[key] - siteVisible[key]), `${key} of the visible part, dialog ${inDialog.visible[key].toFixed(4)} against site ${siteVisible[key].toFixed(4)}: ${where}`).toBeLessThanOrEqual(0.015);
  }
  expect(writes, "no write but the intercepted PUT").toEqual([]);
}

test.describe("[STAB-REL-08] D-67 the frame of the dialog is the place of the site", () => {
  for (const surface of allSurfaces) {
    for (const frame of frameCases) {
      test(`[STAB-REL-08] D-67 ${surface.name}: the frame of the dialog is the place of the site, the visible part is the site's (${frame.x}/${frame.y}/${frame.zoom})`, async ({ page, diagnostics }) => {
        await frameMatchesSite(page, diagnostics, surface, frame);
      });
    }
  }

  test("[STAB-REL-08] D-67 virus photo after infection (natural): at 100% the frame is the whole picture and the arrows move nothing; zoomed, the picture leaves the frame and moves; back at 100% the position is 50 / 50 and «Применить» stores no frame", async ({ page }) => {
    const writes = trackWritesExceptContentPut(page);
    await openEditorTab(page, virusPhotoSurface.tab, { content: virusPhotoSurface.content });
    await virusPhotoSurface.prepare(page);
    const group = groupOf(virusPhotoSurface, page);
    await expect(group).toBeVisible();
    const dialog = await openFraming(page, group);
    const flat = await dialogWindow(dialog);
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(flat.frame[key] - flat.image[key]), `at 100% the frame ${key} equals the picture ${key} (1 px)`).toBeLessThanOrEqual(1);
    const part = positionOf(dialog);
    await part.focus();
    for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await part.press(key);
    await expect(part, "at 100% the arrows change nothing").toHaveAttribute("aria-valuetext", positionText({ x: 50, y: 50 }));

    await setZoom(dialog, 150);
    const zoomed = await dialogWindow(dialog);
    expect(zoomed.image.width, "the zoomed picture leaves the frame (width)").toBeGreaterThan(zoomed.frame.width + 1);
    expect(zoomed.image.height, "the zoomed picture leaves the frame (height)").toBeGreaterThan(zoomed.frame.height + 1);
    await part.focus();
    await part.press("ArrowRight");
    await expect(part, "after the zoom the arrows move the visible part").toHaveAttribute("aria-valuetext", positionText({ x: 55, y: 50 }));

    await setZoom(dialog, 100);
    await expect(part, "back at 100% the position is 50 / 50 again").toHaveAttribute("aria-valuetext", positionText({ x: 50, y: 50 }));
    await applyFraming(dialog);
    await expect(group.locator(".portia-image").first(), "the default frame is not stored: the preview has no frame").not.toHaveAttribute("data-framing", "true");
    await expect(page.locator(".editor-save-chip"), "nothing changed, nothing to save").toHaveCount(0);
    expect(writes, "the UI contract never writes").toEqual([]);
  });
});

// Heights of the block of 20-53 (three sliders) on the same field, project and fixture, measured on PLAN_BASE 9d3e607 before 20-56 removed the sliders (20-56 Task 1).
const blockHeightBefore: Record<string, { band: number; natural: number }> = {
  "chromium-desktop": { band: 274, natural: 550 },
  "chromium-phone": { band: 358.953125, natural: 506.65625 },
  "webkit-phone": { band: 355.125, natural: 492 },
};

test.describe("[STAB-REL-08] D-66 the closed block is compact", () => {
  for (const [kind, surface] of [["band", guideSectionSurface], ["natural", virusPhotoSurface]] as const) {
    test(`[STAB-REL-08] D-66 ${surface.name}: the closed block has no slider and is at most half as high as the block of 20-53; it covers neither the address field nor the upload zone`, async ({ page }, testInfo) => {
      const before = blockHeightBefore[testInfo.project.name];
      test.skip(!before, `no height of the block of 20-53 was measured on the project ${testInfo.project.name}`);
      const writes = trackWritesExceptContentPut(page);
      await openEditorTab(page, surface.tab, { content: surface.content });
      await surface.prepare(page);
      const field = surface.field(page);
      const group = groupOf(surface, page);
      await expect(group).toBeVisible();
      await expect(group.locator(".portia-image.is-loaded"), "the preview is loaded").toBeVisible();
      await expect(group.getByRole("slider"), "no slider in the closed block").toHaveCount(0);
      const height = (await box(group)).height;
      testInfo.annotations.push({ type: "measure", description: `${surface.name} on ${testInfo.project.name}: block ${height.toFixed(1)} px, before ${before[kind]} px, ratio ${(height / before[kind]).toFixed(3)}` });
      expect(height / before[kind], `the closed block (${height.toFixed(1)} px) is at most half of the block of 20-53 (${before[kind]} px)`).toBeLessThanOrEqual(0.5);
      const groupBox = await box(group);
      expect(overlaps(groupBox, await box(field.getByRole("textbox").first())), "the block over the address field").toBe(false);
      expect(overlaps(groupBox, await box(field.locator(".editor-dropzone"))), "the block over the upload zone").toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "no horizontal overflow of the page").toBeLessThanOrEqual(0);
      if (isPhone()) {
        const change = await box(group.getByRole("button", { name: "Изменить" }));
        expect(change.height, "phone target height of «Изменить»").toBeGreaterThanOrEqual(44);
        expect(change.width, "phone target width of «Изменить»").toBeGreaterThanOrEqual(44);
      }
      expect(writes, "the UI contract never writes").toEqual([]);
    });
  }
});

test.describe("[STAB-A11Y-02] D-66 the closed block «Видимая часть» is accessible", () => {

  // Found while D-63 was checked, in nodes the plan does not touch (the hint under a text field with GIF, the small caption of a record row of «База вирусов» and «Корзина»; deferred-items.md 20-53):
  // tolerated node by node, together with the two known before D-62. Anything inside the block «Видимая часть» is tolerated never.
  const knownBeforeD63: Record<string, string[]> = {
    ...knownBeforeD62,
    "color-contrast": [...knownBeforeD62["color-contrast"], 'class="formatted-text-field-hint"', '<small title="'],
  };
  const axeSurfaces: [string, Surface][] = [["Справочник", guideSectionSurface], ["База вирусов", virusPhotoSurface], ["Информация", infoPhotoSurface], ["Корзина", recycleFileSurface]];
  for (const [tabName, surface] of axeSurfaces) {
    test(`[STAB-A11Y-02] D-66 axe finds nothing critical or serious in the block and the dialog «Видимая часть» of the «${tabName}» tab`, async ({ page }, testInfo) => {
      const writes = trackWritesExceptContentPut(page);
      await openEditorTab(page, surface.tab, { content: surface.content });
      await surface.prepare(page);
      const group = groupOf(surface, page);
      await expect(group).toBeVisible();
      const describe = (violation: AxeViolation) => `${violation.id}:${violation.impact} @ ${violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} ${node.html.slice(0, 160)} ${node.failureSummary?.replace(/\s+/g, " ").slice(0, 200) ?? ""}`).join(" | ")}`;
      const blockingOf = (violations: AxeViolation[]) => violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");

      // The block itself and the open dialog: no tolerance at all.
      await expect(group.locator(".portia-image.is-loaded"), "the preview is loaded").toBeVisible();
      const own = await new AxeBuilder({ page }).include(".image-framing").analyze();
      expect(blockingOf(own.violations).map(describe), "critical or serious axe violations in the block «Видимая часть»").toEqual([]);
      const dialog = await openFraming(page, group);
      const inDialog = await new AxeBuilder({ page }).include(".image-framing-dialog").analyze();
      expect(blockingOf(inDialog.violations).map(describe), "critical or serious axe violations in the dialog «Видимая часть»").toEqual([]);
      await dialog.getByRole("button", { name: "Отмена" }).click();
      await expect(dialog).toBeHidden();

      // The whole tab: the findings measured before D-62/D-63 are tolerated node by node (knownBeforeD62), nothing else.
      const results = await new AxeBuilder({ page }).analyze();
      await testInfo.attach(`axe-editor-${tabName}`, {
        body: Buffer.from(JSON.stringify(results.violations.map((violation) => ({ fingerprint: `${violation.id}:${violation.impact ?? "unknown"}`, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) })), null, 2)),
        contentType: "application/json",
      });
      const unexpected = blockingOf(results.violations)
        .map((violation) => ({ ...violation, nodes: violation.nodes.filter((node) => !(knownBeforeD63[violation.id] ?? []).some((marker) => node.html.includes(marker))) }))
        .filter((violation) => violation.nodes.length > 0)
        .map(describe);
      expect(unexpected, "critical or serious axe violations other than the known ones").toEqual([]);
      expect(writes, "the UI contract never writes").toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// [STAB-A11Y-01/02] D-66 (20-57): the picture is dragged under the frame of the dialog by a mouse (PC) and by a finger (phones); the dragging has the keyboard
// alternative of 20-56 (the arrows of «Положение картинки»). Same UI contract as above: only reads are substituted, the one write tolerated is the intercepted PUT.
// The finger: Playwright's touchscreen has only tap. On chromium the touches are real touch events through CDP (Input.dispatchTouchEvent); on WebKit
// (no CDP) the same stream is PointerEvents with pointerType "touch" through dispatchEvent. The method used is written to the annotations of every run.
// ---------------------------------------------------------------------------------------------------------------------------------------------

const stageOf = (dialog: Locator) => dialog.locator(".image-framing-stage");

/** The value of «Положение картинки» as numbers (read from aria-valuetext, the way a screen reader reads it). A drag fed by dispatched events ends before React has painted the last
 *  move: the value is read once it stops changing (two equal reads, 100 ms apart). */
async function readPosition(dialog: Locator) {
  const read = async () => {
    const text = (await positionOf(dialog).getAttribute("aria-valuetext")) ?? "";
    const found = /по горизонтали (\d+) %, по вертикали (\d+) %/.exec(text);
    expect(found, `aria-valuetext of the position «${text}»`).not.toBeNull();
    return { x: Number(found![1]), y: Number(found![2]) };
  };
  let previous = await read();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await dialog.page().waitForTimeout(100);
    const next = await read();
    if (next.x === previous.x && next.y === previous.y) return next;
    previous = next;
  }
  return previous;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** The picture moves with the pointer, so the visible part goes the other way: by the rectangles of the frame and of the picture in the dialog (not by lib/image-framing-crop.ts). */
function positionAfterDrag(start: { x: number; y: number }, delta: { dx: number; dy: number }, rects: { frame: Rect; image: Rect }) {
  const spanX = rects.image.width - rects.frame.width;
  const spanY = rects.image.height - rects.frame.height;
  expect(spanX, "the picture is wider than the frame at this zoom").toBeGreaterThan(0);
  expect(spanY, "the picture is higher than the frame at this zoom").toBeGreaterThan(0);
  return { x: clampPercent(start.x - (delta.dx / spanX) * 100), y: clampPercent(start.y - (delta.dy / spanY) * 100) };
}

function expectPositionNear(actual: { x: number; y: number }, expected: { x: number; y: number }, what: string) {
  expect(Math.abs(actual.x - expected.x), `${what}: x ${actual.x} against ${expected.x} (±1)`).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.y - expected.y), `${what}: y ${actual.y} against ${expected.y} (±1)`).toBeLessThanOrEqual(1);
}

/** The scroll offsets of the page and of every scrolling ancestor of the element: a drag on the stage must not scroll any of them. */
async function scrollOffsets(anchor: Locator) {
  return anchor.evaluate((element) => {
    const offsets: number[] = [window.scrollX, window.scrollY];
    for (let node: Element | null = element; node; node = node.parentElement) offsets.push(node.scrollLeft, node.scrollTop);
    return offsets;
  });
}

type Finger = { method: string; down: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void>; up: () => Promise<void>; cancel: () => Promise<void> };

/** A finger on the stage. chromium: CDP touch events (real touches, the browser makes the pointer events); WebKit: PointerEvent with pointerType "touch" (isPrimary, one pointerId). */
async function fingerOn(page: Page, stage: Locator): Promise<Finger> {
  if (test.info().project.name !== "webkit-phone") {
    const session = await page.context().newCDPSession(page);
    const send = (type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel", touchPoints: { x: number; y: number; id: number }[]) => session.send("Input.dispatchTouchEvent", { type, touchPoints }).then(() => undefined);
    return {
      method: "CDP Input.dispatchTouchEvent (touchStart / touchMove / touchEnd / touchCancel)",
      down: (x, y) => send("touchStart", [{ x, y, id: 1 }]),
      move: (x, y) => send("touchMove", [{ x, y, id: 1 }]),
      up: () => send("touchEnd", []),
      cancel: () => send("touchCancel", []),
    };
  }
  const pointer = (type: string, x: number, y: number, buttons: number) => stage.dispatchEvent(type, { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, buttons, clientX: x, clientY: y, width: 1, height: 1, pressure: buttons ? 0.5 : 0 });
  let last = { x: 0, y: 0 };
  return {
    method: 'PointerEvent pointerType "touch" through locator.dispatchEvent (pointerdown / pointermove / pointerup / pointercancel)',
    down: async (x, y) => { last = { x, y }; await pointer("pointerdown", x, y, 1); },
    move: async (x, y) => { last = { x, y }; await pointer("pointermove", x, y, 1); },
    up: () => pointer("pointerup", last.x, last.y, 0),
    cancel: () => pointer("pointercancel", last.x, last.y, 0),
  };
}

/** Editor on the band of a «Справочник» section: the dialog is open at 160 % (the picture leaves the frame on both axes). */
async function openForDragging(page: Page, diagnostics: DiagnosticLedger) {
  const surface = guideSectionSurface;
  const writes = trackWritesExceptContentPut(page);
  const puts: PutBody[] = [];
  expectAbortedSave(diagnostics);
  // The test leaves the editor for the site (a second load); WebKit reports a read in flight as a cancelled load.
  diagnostics.expectFault({ kind: "requestfailed", source: "fetch", text: /Load request cancelled|cancelled|aborted/i, reason: "the test leaves the page of the editor for the site while a read is in flight (WebKit reports the cancelled load)" });
  await openEditorTab(page, surface.tab, { content: surface.content, puts });
  await surface.prepare(page);
  const group = groupOf(surface, page);
  await expect(group).toBeVisible();
  const dialog = await openFraming(page, group);
  await setZoom(dialog, 160);
  const stageBox = await box(stageOf(dialog));
  return { surface, writes, puts, group, dialog, stageBox };
}

/** «Применить» → save → the intercepted PUT → the site fed with that body shows the same part of the picture as the dialog did (0.015 of the picture). */
async function applyAndCompareWithSite(page: Page, ctx: Awaited<ReturnType<typeof openForDragging>>, chosen: { x: number; y: number }, shown: Fractions) {
  const { surface, puts, dialog } = ctx;
  await applyFraming(dialog);
  await save(page);
  await expect.poll(() => puts.length, "the save reached the intercepted PUT").toBe(1);
  expect(surface.holder(puts[0].content)?.[surface.frameKey], "the body of the PUT holds the dragged frame").toEqual({ ...chosen, zoom: 160 });
  await page.unroute("**/api/content**");
  await stubContent(page, puts[0].content, puts[0].revision + 1);
  await page.addInitScript(() => window.localStorage.clear());
  const onSite = await siteWindow(await surface.site(page));
  test.info().annotations.push({ type: "measure", description: `dialog ${JSON.stringify(shown)}, site ${JSON.stringify(onSite.visible)}, max difference ${maxDifference(shown, onSite.visible).toFixed(4)}` });
  for (const key of ["left", "top", "width", "height"] as const) {
    expect(Math.abs(shown[key] - onSite.visible[key]), `${key} of the part: dialog ${shown[key].toFixed(4)} against site ${onSite.visible[key].toFixed(4)}`).toBeLessThanOrEqual(0.015);
  }
  expect(ctx.writes, "no write but the intercepted PUT").toEqual([]);
}

/** After the drag ended, no stray move of any pointer changes the position: nothing is left holding the pointer. */
async function expectNoHangingDrag(page: Page, dialog: Locator, held: { x: number; y: number }) {
  await page.evaluate(() => { for (let pointerId = 0; pointerId < 20; pointerId += 1) window.dispatchEvent(new PointerEvent("pointermove", { pointerId, clientX: 5, clientY: 5, bubbles: true })); });
  expectPositionNear(await readPosition(dialog), held, "a stray move after the drag ended");
}

test.describe("[STAB-A11Y-02] D-66 touch and mouse drag the picture under the frame", () => {
  test("[STAB-A11Y-02] D-66 touch: a finger drags the picture under the frame", async ({ page, diagnostics }, testInfo) => {
    test.skip(!isPhone(), "a finger exists on the phone projects only; the mouse is checked on chromium-desktop");
    const ctx = await openForDragging(page, diagnostics);
    const { dialog, group, stageBox } = ctx;
    const stage = stageOf(dialog);
    await expect(stage, "the stage takes the touches itself").toHaveCSS("touch-action", "none");
    const startRects = await dialogWindow(dialog);
    const start = await readPosition(dialog);
    const scrolled = await scrollOffsets(group);
    const from = { x: stageBox.x + stageBox.width / 2, y: stageBox.y + stageBox.height / 2 };
    const finger = await fingerOn(page, stage);
    testInfo.annotations.push({ type: "touch", description: `${testInfo.project.name}: ${finger.method}` });

    await finger.down(from.x, from.y);
    await finger.move(from.x + 20, from.y + 10);
    await finger.move(from.x + 40, from.y + 20);
    await finger.up();
    const moved = await readPosition(dialog);
    expectPositionNear(moved, positionAfterDrag(start, { dx: 40, dy: 20 }, startRects), "a finger moved right 40 px and down 20 px");
    expect(moved.x, "the picture went right, the visible part left").toBeLessThan(start.x);
    expect(moved.y, "the picture went down, the visible part up").toBeLessThan(start.y);
    expect(await scrollOffsets(group), "neither the page nor the window of the editor scrolled").toEqual(scrolled);
    await expect(dialog, "the drag leaves the dialog open").toBeVisible();

    // A touch the system takes away (pointercancel) ends the drag where it was and leaves the dialog open.
    await finger.down(from.x, from.y);
    await finger.move(from.x - 10, from.y - 10);
    await finger.cancel();
    await expect(dialog).toBeVisible();
    const held = await readPosition(dialog);
    await expectNoHangingDrag(page, dialog, held);
    expect(await scrollOffsets(group), "the cancelled touch scrolled nothing either").toEqual(scrolled);

    const part = (await dialogWindow(dialog)).visible;
    await applyAndCompareWithSite(page, ctx, held, part);
  });

  test("[STAB-A11Y-01] D-66 mouse: dragging moves the part, a drag released outside keeps the dialog", async ({ page, diagnostics }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "the mouse is checked on chromium-desktop; the phones are checked with a finger");
    const ctx = await openForDragging(page, diagnostics);
    const { dialog, stageBox } = ctx;
    const startRects = await dialogWindow(dialog);
    const start = await readPosition(dialog);
    const centre = { x: stageBox.x + stageBox.width / 2, y: stageBox.y + stageBox.height / 2 };

    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 20, centre.y + 10, { steps: 4 });
    await page.mouse.move(centre.x + 40, centre.y + 20, { steps: 4 });
    await page.mouse.up();
    const moved = await readPosition(dialog);
    expectPositionNear(moved, positionAfterDrag(start, { dx: 40, dy: 20 }, startRects), "the mouse moved right 40 px and down 20 px");
    expect(moved.x, "the picture went right, the visible part left").toBeLessThan(start.x);
    expect(moved.y, "the picture went down, the visible part up").toBeLessThan(start.y);

    // A drag released outside the stage and outside the dialog: the window of the browser carries the drag, the dialog stays open, the frame is the last move's.
    const dialogBox = await box(dialog);
    const second = await dialogWindow(dialog);
    const grab = { x: stageBox.x + 10, y: centre.y };
    const outside = { x: dialogBox.x - 30, y: centre.y + 15 };
    expect(outside.x, "there is room left of the dialog").toBeGreaterThan(2);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move((grab.x + outside.x) / 2, (grab.y + outside.y) / 2, { steps: 4 });
    await page.mouse.move(outside.x, outside.y, { steps: 4 });
    await page.mouse.up();
    await expect(dialog, "a drag released outside the window keeps the dialog open").toBeVisible();
    const released = await readPosition(dialog);
    expectPositionNear(released, positionAfterDrag(moved, { dx: outside.x - grab.x, dy: outside.y - grab.y }, second), "the drag released outside the dialog keeps the frame of its last move");
    expect(released.x, "dragged left past the stage, the visible part moved right").toBeGreaterThan(moved.x);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.move(centre.x + 30, centre.y + 30, { steps: 3 });
    expectPositionNear(await readPosition(dialog), released, "a mouse move over the stage with the button up");
    await expectNoHangingDrag(page, dialog, released);

    // And one released over the head of the dialog (outside the stage, inside the window).
    const head = await box(dialog.locator(".image-framing-dialog-head"));
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x, head.y + head.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(dialog, "a drag released over the head of the dialog keeps it open").toBeVisible();

    const finalPosition = await readPosition(dialog);
    await applyAndCompareWithSite(page, ctx, finalPosition, (await dialogWindow(dialog)).visible);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// [STAB-A11Y-01/02/03] D-66 (20-57): names, values and focus of the dialog «Видимая часть», a phone, the motion setting «Выключены».
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** What holds the focus: the accessible name or text of the active element, and whether it is inside the dialog. */
async function focusState(dialog: Locator) {
  return dialog.evaluate((element) => {
    const active = document.activeElement;
    const inside = !!active && element.contains(active);
    const name = active ? (active.getAttribute("aria-label") ?? active.textContent?.trim() ?? active.tagName) : "nothing";
    return { inside, name: active && active !== document.body ? name : "the page body" };
  });
}

const dialogRing = ["Положение картинки", "Масштаб", "Сбросить", "Отмена", "Применить"];

test.describe("[STAB-A11Y-01] D-66 the dialog «Видимая часть»: names, values, focus, Tab, Esc", () => {
  test("[STAB-A11Y-01] D-66 dialog: names, values, focus, Tab inside, Esc and «Отмена» keep the draft", async ({ page }) => {
    const surface = guideSectionSurface;
    const writes = trackWritesExceptContentPut(page);
    const editor = await openEditorTab(page, surface.tab, { content: surface.content });
    await surface.prepare(page);
    const group = groupOf(surface, page);
    await expect(group).toBeVisible();
    await expect(group.locator(".portia-image.is-loaded"), "the preview is loaded").toBeVisible();
    const change = group.getByRole("button", { name: "Изменить" });
    await expect(change, "«Изменить» announces a dialog").toHaveAttribute("aria-haspopup", "dialog");
    const label = ((await group.locator(".sr-only").first().textContent()) ?? "").trim();
    expect(label, "the label of the field is there for the name of the dialog").not.toBe("");
    const preview = async () => (await pictureState(group.locator(".portia-image").first())).objectPosition;
    const before = await preview();

    const dialog = await openFraming(page, group);
    await expect(dialog, "the dialog is named «Видимая часть» and the label of its field").toHaveAccessibleName(`Видимая часть ${label}`);
    await expect(group, "the closed block has the same name").toHaveAccessibleName(`Видимая часть ${label}`);
    await expect(positionOf(dialog), "the focus is on «Положение картинки» when the dialog opens").toBeFocused();
    await expect(positionOf(dialog)).toHaveAttribute("aria-valuetext", positionText({ x: 50, y: 50 }));
    const zoom = zoomOf(dialog);
    await expect(zoom).toHaveAttribute("min", "100");
    await expect(zoom).toHaveAttribute("max", "300");
    await expect(zoom).toHaveAttribute("step", "5");
    await expect(zoom).toHaveAttribute("aria-valuetext", "100 %");
    await setZoom(dialog, 120);
    await expect(zoom, "the value text follows the zoom").toHaveAttribute("aria-valuetext", "120 %");
    await setZoom(dialog, 100);

    // Tab and Shift+Tab go round inside the dialog: five stops in the order of the dialog, never the page behind it.
    await positionOf(dialog).focus();
    const forward = [(await focusState(dialog)).name];
    for (let press = 0; press < 10; press += 1) {
      await page.keyboard.press("Tab");
      const state = await focusState(dialog);
      expect(state.inside, `Tab ${press + 1}: the focus is inside the dialog (it is on «${state.name}»)`).toBe(true);
      forward.push(state.name);
    }
    expect(forward.slice(0, 5), "the order of Tab from «Положение картинки»").toEqual(dialogRing);
    expect(forward.slice(5, 10), "after «Применить» the focus goes round").toEqual(dialogRing);
    const backward: string[] = [];
    for (let press = 0; press < 10; press += 1) {
      await page.keyboard.press("Shift+Tab");
      const state = await focusState(dialog);
      expect(state.inside, `Shift+Tab ${press + 1}: the focus is inside the dialog (it is on «${state.name}»)`).toBe(true);
      backward.push(state.name);
    }
    expect(backward.slice(0, 5), "the order of Shift+Tab from «Положение картинки»").toEqual([...dialogRing].reverse());
    test.info().annotations.push({ type: "tab", description: `${test.info().project.name}: Tab ${forward.join(" > ")}; Shift+Tab ${backward.join(" > ")}` });

    // A draft that is not applied: Esc, then «Отмена», both leave the preview as it was, the window of the editor open, and the focus on «Изменить».
    for (const close of ["Escape", "Отмена"]) {
      const open = close === "Escape" ? dialog : await openFraming(page, group);
      await setZoom(open, 160);
      await movePart(open, { x: 30, y: 60 });
      if (close === "Escape") await positionOf(open).press("Escape");
      else await open.getByRole("button", { name: "Отмена" }).click();
      await expect(open, `${close} closes the dialog`).toBeHidden();
      await expect(editor.editorNavigation(), `${close} leaves the window of the editor open`).toBeVisible();
      await expect(change, `${close} gives the focus back to «Изменить»`).toBeFocused();
      expect(await preview(), `${close}: the preview is as before`).toBe(before);
      await expect(page.locator(".editor-save-chip"), `${close} leaves the draft unchanged`).toHaveCount(0);
    }
    const again = await openFraming(page, group);
    await expect(positionOf(again), "a dialog opened again starts from the stored frame").toHaveAttribute("aria-valuetext", positionText({ x: 50, y: 50 }));
    await expect(zoomOf(again)).toHaveValue("100");
    await again.getByRole("button", { name: "Применить" }).click();
    await expect(again).toBeHidden();
    await expect(change, "«Применить» gives the focus back to «Изменить» too").toBeFocused();
    expect(writes, "the UI contract never writes").toEqual([]);
  });

  test("[STAB-A11Y-02] D-66 dialog on a phone: inside the screen, 44 px targets, no overflow", async ({ page }, testInfo) => {
    test.skip(!isPhone(), "the phone layout is checked on the phone projects");
    const surface = guideSectionSurface;
    const writes = trackWritesExceptContentPut(page);
    await openEditorTab(page, surface.tab, { content: surface.content });
    await surface.prepare(page);
    const group = groupOf(surface, page);
    await expect(group).toBeVisible();
    await expect(group.locator(".portia-image.is-loaded"), "the preview is loaded").toBeVisible();
    const field = surface.field(page);
    const closed = await box(group);
    expect(overlaps(closed, await box(field.getByRole("textbox").first())), "the closed block over the address field").toBe(false);
    expect(overlaps(closed, await box(field.locator(".editor-dropzone"))), "the closed block over the upload zone").toBe(false);
    const change = await box(group.getByRole("button", { name: "Изменить" }));

    const dialog = await openFraming(page, group);
    const viewport = page.viewportSize()!;
    const dialogBox = await box(dialog);
    expect(dialogBox.x, "the dialog is inside the screen (left)").toBeGreaterThanOrEqual(0);
    expect(dialogBox.y, "the dialog is inside the screen (top)").toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width, "the dialog is inside the screen (right)").toBeLessThanOrEqual(viewport.width);
    expect(dialogBox.y + dialogBox.height, "the dialog is inside the screen (bottom)").toBeLessThanOrEqual(viewport.height);
    const overflow = await dialog.evaluate((element) => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth, dialog: element.scrollWidth - element.clientWidth }));
    expect(overflow.page, "no horizontal scroll of the page").toBeLessThanOrEqual(0);
    expect(overflow.dialog, "no horizontal scroll of the dialog").toBeLessThanOrEqual(0);
    const targets: Record<string, Rect> = {
      "«Изменить»": change,
      "«Масштаб»": await box(zoomOf(dialog)),
      "«Сбросить»": await box(dialog.getByRole("button", { name: "Сбросить" })),
      "«Отмена»": await box(dialog.getByRole("button", { name: "Отмена" })),
      "«Применить»": await box(dialog.getByRole("button", { name: "Применить" })),
    };
    const stage = await box(stageOf(dialog));
    testInfo.annotations.push({ type: "measure", description: `${testInfo.project.name} ${viewport.width}x${viewport.height}: dialog ${dialogBox.width.toFixed(1)}x${dialogBox.height.toFixed(1)} at ${dialogBox.x.toFixed(1)},${dialogBox.y.toFixed(1)}; stage ${stage.width.toFixed(1)}x${stage.height.toFixed(1)}; ${Object.entries(targets).map(([name, rect]) => `${name} ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`).join(", ")}` });
    for (const [name, rect] of Object.entries(targets)) {
      expect(rect.width, `${name} is at least 44 px wide`).toBeGreaterThanOrEqual(44);
      expect(rect.height, `${name} is at least 44 px high`).toBeGreaterThanOrEqual(44);
    }
    expect(stage.width, "the stage is at least 280 px wide").toBeGreaterThanOrEqual(280);
    await dialog.getByRole("button", { name: "Отмена" }).click();
    await expect(dialog).toBeHidden();
    expect(writes, "the UI contract never writes").toEqual([]);
  });

  test("[STAB-A11Y-03] D-66 motion off: no animation runs in the dialog when the animations are «Выключены»", async ({ page }) => {
    const surface = guideSectionSurface;
    const writes = trackWritesExceptContentPut(page);
    await page.addInitScript(() => window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify({ motion: "off" })));
    await openEditorTab(page, surface.tab, { content: surface.content });
    await expect(page.locator("html"), "the animations are off").toHaveAttribute("data-motion", "off");
    await surface.prepare(page);
    const group = groupOf(surface, page);
    await expect(group).toBeVisible();
    const dialog = await openFraming(page, group);
    await setZoom(dialog, 160);
    const running = await dialog.evaluate((element) => ({
      animations: (element as HTMLElement).getAnimations({ subtree: true }).length,
      timed: [element, ...element.querySelectorAll("*")].filter((node) => { const style = getComputedStyle(node); return style.animationDuration.split(",").some((value) => parseFloat(value) > 0) || style.transitionDuration.split(",").some((value) => parseFloat(value) > 0); }).length,
    }));
    expect(running.animations, "no running animation or transition in the dialog").toBe(0);
    expect(running.timed, "no element of the dialog has an animation or transition duration").toBe(0);
    await dialog.getByRole("button", { name: "Отмена" }).click();
    expect(writes, "the UI contract never writes").toEqual([]);
  });
});
