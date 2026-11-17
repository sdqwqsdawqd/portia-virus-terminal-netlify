import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { portiaContentFixture } from "../../../lib/testing/portia-content-fixture.ts";
import { DesktopPage } from "../pages/desktop.page";
import { EditorPage } from "../pages/editor.page";
import { expect, test, type StagingRun, type StagingSession } from "../fixtures/test";

// Editor section layout (Phase 20-22, D-40 / D-41 / D-42 / D-47) on the isolated staging project, run by explicit path.
// Identities come from the staging harness (run-prefixed, removed with residual 0); portia_content "main" is put back after each test.
// Own /api routes are never answered with invented data. Without safe staging keys every scenario is skipped as BLOCKED (ENV);
// a skip is never counted as a pass. Notes steps additionally need the 20-24 table: BLOCKED (OWNER) until the owner applies it.

const fallbackBase = "http://127.0.0.1:3000";

type ContentRow = { id: string; payload: unknown; revision: number; updated_at: string; updated_by: string | null };

function adminOf(stagingRun: StagingRun) {
  const live = stagingRun.live;
  if (!live) throw new Error("safe target unavailable");
  return createClient(live.url, live.adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sessionOrSkip(stagingRun: StagingRun, baseURL: string, testInfo: TestInfo, label: string) {
  const outcome = await stagingRun.session("editor", baseURL, label);
  testInfo.skip("blocked" in outcome, "blocked" in outcome ? `BLOCKED (ENV): ${outcome.blocked}` : undefined);
  if (!("session" in outcome)) throw new Error("unreachable");
  return outcome.session;
}

async function contextFor(browser: Browser, baseURL: string, session: StagingSession) {
  const context = await browser.newContext({ baseURL, locale: "ru-RU", storageState: { cookies: session.cookies, origins: [] } });
  await context.addInitScript(() => window.sessionStorage.setItem("portia-boot-seen-v1", "1"));
  return context;
}

// Records portia_content "main", lets the test seed it, and puts the row back (or removes it) afterwards.
async function withContentRestored<T>(stagingRun: StagingRun, work: (seed: (change: (payload: Record<string, unknown>) => void) => Promise<void>) => Promise<T>): Promise<T> {
  const admin = adminOf(stagingRun);
  const before = await admin.from("portia_content").select("*").eq("id", "main").maybeSingle<ContentRow>();
  expect(before.error, "snapshot portia_content").toBeNull();
  const seed = async (change: (payload: Record<string, unknown>) => void) => {
    const payload = structuredClone((before.data?.payload ?? portiaContentFixture) as Record<string, unknown>);
    change(payload);
    const written = before.data
      ? await admin.from("portia_content").update({ payload }).eq("id", "main")
      : await admin.from("portia_content").upsert({ id: "main", payload, revision: 1 });
    expect(written.error, "seed portia_content").toBeNull();
  };
  try {
    return await work(seed);
  } finally {
    const restored = before.data
      ? await admin.from("portia_content").update({
          payload: before.data.payload, revision: before.data.revision, updated_at: before.data.updated_at, updated_by: before.data.updated_by,
        }).eq("id", "main")
      : await admin.from("portia_content").delete().eq("id", "main");
    expect(restored.error, "restore portia_content").toBeNull();
    const after = await admin.from("portia_content").select("revision").eq("id", "main").maybeSingle<{ revision: number }>();
    expect(after.data?.revision ?? 0, "content restored to its original revision").toBe(before.data?.revision ?? 0);
  }
}

async function openEditor(context: BrowserContext) {
  const page = await context.newPage();
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  return { page, editor };
}

const isPhone = () => test.info().project.name.endsWith("-phone");
const tab = (editor: EditorPage, name: RegExp) => editor.editorNavigation().getByRole("button", { name });

const infoSeed = (run: string, count: number) => Array.from({ length: count }, (_, index) => ({
  id: `${run}-info-${index + 1}`, title: `${run} Раздел ${index + 1}`, body: "", subsections: [],
}));

const card = (page: Page, id: string) => page.locator(`#card-${id}`);
const handle = (page: Page, id: string) => card(page, id).locator(":scope > .nested-editor-head .order-drag-handle");
const activeHandleOf = (page: Page, id: string) => page.evaluate((cardId) => {
  const own = document.getElementById(`card-${cardId}`)?.querySelector(":scope > .nested-editor-head .order-drag-handle");
  return Boolean(own) && own === document.activeElement;
}, id);

async function box(locator: ReturnType<typeof card>) {
  const found = await locator.boundingBox();
  expect(found, "element is laid out").not.toBeNull();
  return found!;
}

async function openInfo(browser: Browser, stagingRun: StagingRun, baseURL: string, testInfo: TestInfo, label: string, work: (ctx: { page: Page; editor: EditorPage; run: string }) => Promise<void>) {
  const session = await sessionOrSkip(stagingRun, baseURL, testInfo, label);
  const context = await contextFor(browser, baseURL, session);
  try {
    await withContentRestored(stagingRun, async (seed) => {
      const run = stagingRun.run!.runId;
      await seed((payload) => { payload.infoSections = infoSeed(run, 7); });
      const { page, editor } = await openEditor(context);
      await tab(editor, /^Информация/).click();
      await expect(page.locator(".editor-section-columns [data-sort-index]")).toHaveCount(7);
      await work({ page, editor, run });
    });
  } finally {
    await context.close();
  }
}

test.describe("[STAB-EDIT-01] D-40 editor section columns", () => {
  test("[STAB-EDIT-01] PC: five cards per column, the sixth starts the next column at the same top, no empty strip on the right", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "PC layout");
    await openInfo(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-columns", async ({ page, run }) => {
      await expect(page.locator(".editor-section-column").first().locator(":scope > .nested-editor-card")).toHaveCount(5);
      const first = await box(card(page, `${run}-info-1`));
      const sixth = await box(card(page, `${run}-info-6`));
      expect(sixth.x, "the sixth card is in the next column, to the right").toBeGreaterThan(first.x + first.width - 1);
      expect(Math.abs(sixth.y - first.y), "the sixth card starts at the top of its column").toBeLessThanOrEqual(2);
      const columns = page.locator(".editor-section-columns");
      const frame = await box(columns);
      const lastColumn = await box(page.locator(".editor-section-column").last());
      expect(frame.x + frame.width - (lastColumn.x + lastColumn.width), "right edge of the last column against the container").toBeLessThanOrEqual(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });

  test("[STAB-EDIT-01] PC: ArrowDown on the fifth card's handle moves it across the column border and keeps the focus there; ArrowUp brings it back", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "PC layout");
    await openInfo(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-keyboard", async ({ page, run }) => {
      const fifth = `${run}-info-5`;
      await handle(page, fifth).focus();
      await page.keyboard.press("ArrowDown");
      await expect(card(page, fifth)).toHaveAttribute("data-sort-index", "5");
      await expect(page.locator(".editor-section-column").nth(1).locator(":scope > .nested-editor-card").first()).toHaveAttribute("id", `card-${fifth}`);
      await expect.poll(() => activeHandleOf(page, fifth)).toBe(true);
      await page.keyboard.press("ArrowUp");
      await expect(card(page, fifth)).toHaveAttribute("data-sort-index", "4");
      await expect(page.locator(".editor-section-column").first().locator(":scope > .nested-editor-card").nth(4)).toHaveAttribute("id", `card-${fifth}`);
      await expect.poll(() => activeHandleOf(page, fifth)).toBe(true);
    });
  });

  test("[STAB-EDIT-03] PC: a keyboard move across the column border keeps the focus on the handle and is one undo step", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "PC layout");
    await openInfo(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-keyboard-undo", async ({ page, run }) => {
      const fifth = `${run}-info-5`;
      await handle(page, fifth).focus();
      await page.keyboard.press("ArrowDown");
      // The moved card is the first one of the second column, at index 5, and the focus is still on its own handle.
      await expect(card(page, fifth)).toHaveAttribute("data-sort-index", "5");
      await expect(page.locator(".editor-section-column").nth(1).locator(":scope > .nested-editor-card").first()).toHaveAttribute("id", `card-${fifth}`);
      await expect.poll(() => activeHandleOf(page, fifth)).toBe(true);
      // One undo step puts it back: it is checked right after the first press, a second press is not needed.
      await page.keyboard.press("Control+z");
      await expect(card(page, fifth)).toHaveAttribute("data-sort-index", "4");
      await expect(page.locator(".editor-section-column").first().locator(":scope > .nested-editor-card").nth(4)).toHaveAttribute("id", `card-${fifth}`);
    });
  });

  test("[STAB-A11Y-02] phone: one column in the source order, no horizontal overflow", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(!isPhone(), "phone layout");
    await openInfo(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-phone", async ({ page, run }) => {
      const lefts = new Set<number>();
      let previousTop = -Infinity;
      for (let index = 1; index <= 7; index += 1) {
        const found = await box(card(page, `${run}-info-${index}`));
        lefts.add(Math.round(found.x));
        expect(found.y, `card ${index} sits below card ${index - 1}`).toBeGreaterThan(previousTop);
        previousTop = found.y;
      }
      expect(lefts.size, "all cards share one left edge").toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
});

// ---- D-42 pointer drag between columns, D-41 pinned add-section bar, D-47 private notes -------------------------------------------

const sectionOrder = (page: Page) => page.locator(".editor-section-columns [data-sort-index]").evaluateAll((cards) => cards
  .sort((a, b) => Number((a as HTMLElement).dataset.sortIndex) - Number((b as HTMLElement).dataset.sortIndex))
  .map((element) => element.id.replace(/^card-/, "")));

const centre = (found: { x: number; y: number; width: number; height: number }) => ({ x: found.x + found.width / 2, y: found.y + found.height / 2 });

test.describe("[STAB-EDIT-02] D-42 pointer drag between columns", () => {
  test("[STAB-EDIT-02] PC: dragging the second card to the last one crosses the column border in one gesture and one undo step", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "PC layout");
    await openInfo(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-drag", async ({ page, run }) => {
      const ids = Array.from({ length: 7 }, (_, index) => `${run}-info-${index + 1}`);
      expect(await sectionOrder(page)).toEqual(ids);
      const from = centre(await box(handle(page, ids[1])));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      // The handle starts a drag after a 170 ms hold.
      await page.waitForTimeout(250);
      const to = centre(await box(card(page, ids[6])));
      await page.mouse.move(to.x, to.y, { steps: 14 });
      await page.mouse.up();
      expect(await sectionOrder(page)).toEqual([ids[0], ...ids.slice(2), ids[1]]);
      // The moved card now stands in the second column; nested lists were not touched.
      await expect(page.locator(".editor-section-column").nth(1).locator(`:scope > #card-${ids[1]}`)).toHaveCount(1);
      await page.keyboard.press("Control+z");
      expect(await sectionOrder(page)).toEqual(ids);
    });
  });
});

const guideSeed = (run: string, count: number) => Array.from({ length: count }, (_, index) => ({
  id: `${run}-guide-${index + 1}`, title: `${run} Справочник ${index + 1}`, photo: "", cards: [],
}));

async function openGuide(browser: Browser, stagingRun: StagingRun, baseURL: string, testInfo: TestInfo, label: string, work: (ctx: { context: BrowserContext; session: StagingSession; page: Page; editor: EditorPage; run: string }) => Promise<void>) {
  const session = await sessionOrSkip(stagingRun, baseURL, testInfo, label);
  const context = await contextFor(browser, baseURL, session);
  try {
    await withContentRestored(stagingRun, async (seed) => {
      const run = stagingRun.run!.runId;
      await seed((payload) => { payload.guideSections = guideSeed(run, 7); });
      const { page, editor } = await openEditor(context);
      await tab(editor, /^Справочник/).click();
      await expect(page.locator(".editor-section-columns [data-sort-index]")).toHaveCount(7);
      await work({ context, session, page, editor, run });
    });
  } finally {
    await context.close();
  }
}

const addButton = (page: Page) => page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true });

test.describe("[STAB-EDIT-03] D-41 «Справочник» pinned add-section bar", () => {
  test("[STAB-EDIT-03] the bar stays in view after scrolling; the form opens on the title, Escape returns to the button, a created section opens on its title", async ({ browser, stagingRun, baseURL }, testInfo) => {
    await openGuide(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-guide-bar", async ({ page, run }) => {
      const bar = page.locator(".editor-section-addbar");
      if (isPhone()) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      else await page.locator(".content-editor").evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect.poll(async () => {
        const found = await bar.boundingBox();
        const view = isPhone() ? { top: 0, bottom: page.viewportSize()!.height } : await page.locator(".content-editor").boundingBox().then((editorBox) => ({ top: editorBox!.y, bottom: editorBox!.y + editorBox!.height }));
        return found !== null && found.y >= view.top - 1 && found.y + found.height <= view.bottom + 1;
      }, "the add-section bar is still in the visible part of the editor").toBe(true);
      const button = addButton(page);
      const found = await box(button);
      if (isPhone()) {
        expect(found.width).toBeGreaterThanOrEqual(44);
        expect(found.height).toBeGreaterThanOrEqual(44);
      }
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      const form = page.locator(".editor-section-create");
      await expect(form).toBeVisible();
      await expect(form.getByLabel("Заголовок раздела")).toBeFocused();
      await expect(form.getByLabel("Заметка для редактора"), "the owner dropped editor notes (20-33)").toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(form).toBeHidden();
      await expect(button).toBeFocused();

      await button.click();
      const title = `${run} Новый раздел`;
      await form.getByLabel("Заголовок раздела").fill(title);
      await form.getByRole("button", { name: "Создать раздел" }).click();
      await expect(form).toBeHidden();
      await expect(page.locator(".editor-section-columns [data-sort-index]")).toHaveCount(8);
      const created = page.locator(".editor-section-columns [data-sort-index]").filter({ has: page.getByRole("button", { name: new RegExp(title) }) });
      await expect(created.getByLabel("Заголовок раздела")).toHaveValue(title);
      await expect(created.getByLabel("Заголовок раздела")).toBeFocused();
      await expect(created.getByLabel("Заметка для редактора")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
});

// ---- «Рекомендации» and «Сводка» are plain lists (owner, 20-33) -------------------------------------------------------------------------
// Same rules as above: staging only, content "main" is put back, nothing is mocked, no safe target means BLOCKED (ENV).

type StoredDocument = { runs: { text: string; style?: Record<string, unknown> }[] };
type StoredContent = {
  searchRecommendations: string[];
  searchRecommendationSections?: unknown[];
  formattedText: Record<string, StoredDocument>;
  broadcasts: { id: string; type: string; title: string; published: boolean; sectionId?: string }[];
  broadcastSections?: unknown[];
};

async function storedContent(stagingRun: StagingRun): Promise<StoredContent> {
  const row = await adminOf(stagingRun).from("portia_content").select("payload").eq("id", "main").maybeSingle<{ payload: StoredContent }>();
  expect(row.error, "read portia_content").toBeNull();
  expect(row.data, "portia_content main exists").not.toBeNull();
  return row.data!.payload;
}

// The style of the first character of line `line` of the flat recommendations list.
function styleOfStoredLine(document: StoredDocument | undefined, flat: string[], line: number) {
  const offset = flat.slice(0, line).reduce((total, item) => total + item.length + 1, 0);
  let at = 0;
  for (const run of document?.runs ?? []) {
    if (offset < at + run.text.length) return run.style ?? {};
    at += run.text.length;
  }
  return {};
}

// Phase 26 (26-06, D-13b): «СОХРАНИТЬ» stands in the sticky action bar of the draft tab; there is no chip to open first.
async function saveEditor(page: Page) {
  await page.locator(".etab-bar").getByRole("button", { name: "СОХРАНИТЬ", exact: true }).click();
  await expect(page.locator("p.sr-only[role='status']")).toContainText("Сохранено");
}

async function openTabWith(browser: Browser, stagingRun: StagingRun, baseURL: string, testInfo: TestInfo, label: string, tabName: RegExp, seedPayload: (payload: Record<string, unknown>, run: string) => void, work: (ctx: { context: BrowserContext; page: Page; editor: EditorPage; run: string }) => Promise<void>) {
  const session = await sessionOrSkip(stagingRun, baseURL, testInfo, label);
  const context = await contextFor(browser, baseURL, session);
  try {
    await withContentRestored(stagingRun, async (seed) => {
      const run = stagingRun.run!.runId;
      await seed((payload) => seedPayload(payload, run));
      const { page, editor } = await openEditor(context);
      await tab(editor, tabName).click();
      await work({ context, page, editor, run });
    });
  } finally {
    await context.close();
  }
}

const toggleOf = (target: ReturnType<typeof card>) => target.locator(":scope > .nested-editor-head .nested-editor-toggle");

async function withVisitor(browser: Browser, base: string, work: (desktop: DesktopPage) => Promise<void>) {
  const visitor = await browser.newContext({ baseURL: base, locale: "ru-RU" });
  try {
    await visitor.addInitScript(() => window.sessionStorage.setItem("portia-boot-seen-v1", "1"));
    const desktop = new DesktopPage(await visitor.newPage());
    await desktop.goto();
    await work(desktop);
  } finally {
    await visitor.close();
  }
}

test.describe("[STAB-EDIT-03] «Рекомендации» is one field with a five-per-column overview", () => {
  test("[STAB-EDIT-03] old sections fold into one field; a new line keeps the colour of the others and the flat list is all the site reads", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "PC lane: the same data path runs on every device");
    const base = baseURL ?? fallbackBase;
    await openTabWith(browser, stagingRun, base, testInfo, "layout-recommendations", /^Рекомендации/, (payload, run) => {
      payload.searchRecommendations = [`${run} r1`, `${run} r2`, `${run} r3`];
      payload.searchRecommendationSections = [{ id: `${run}-rec-1`, title: `${run} Раздел`, items: [`${run} r1`, `${run} r2`, `${run} r3`], subsections: [] }];
      const document: StoredDocument = { runs: [{ text: `${run} r1\n` }, { text: `${run} r2`, style: { color: "#b43632" } }, { text: `\n${run} r3` }] };
      payload.formattedText = { ...(payload.formattedText as Record<string, unknown>), "search:recommendations": document };
    }, async ({ page, run }) => {
      await expect(page.locator(".editor-section-addbar"), "no add-section bar").toHaveCount(0);
      await expect(page.getByLabel("Заголовок раздела")).toHaveCount(0);
      const overview = page.locator(".recommendation-preview");
      await expect(overview.locator(".recommendation-preview-item")).toHaveCount(3);
      const line = `${run} r4`;
      await page.locator("[data-format-key='search:recommendations']").click();
      await page.keyboard.press("Control+End");
      await page.keyboard.type(`\n${line}`);
      await expect(overview.locator(".recommendation-preview-item")).toHaveCount(4);
      await saveEditor(page);
      const stored = await storedContent(stagingRun);
      expect(stored.searchRecommendations).toEqual([`${run} r1`, `${run} r2`, `${run} r3`, line]);
      expect(stored.searchRecommendationSections ?? [], "the sections are gone after a save").toEqual([]);
      expect(styleOfStoredLine(stored.formattedText["search:recommendations"], stored.searchRecommendations, 1), "the second line keeps its colour").toEqual({ color: "#b43632" });
      await withVisitor(browser, base, async (desktop) => {
        await desktop.openApp("Глобальный поиск");
        const search = desktop.window("Глобальный поиск");
        const shown = await search.locator(".search-recommendations button").allTextContents();
        for (const text of shown) expect(stored.searchRecommendations, `«${text}» is a line of the flat list`).toContain(text.trim());
        await expect(search).not.toContainText(`${run} Раздел`);
      });
    });
  });

  test("[STAB-A11Y-02] the overview stays inside the editor without horizontal overflow", async ({ browser, stagingRun, baseURL }, testInfo) => {
    await openTabWith(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-recommendations-overview", /^Рекомендации/, (payload, run) => {
      payload.searchRecommendations = Array.from({ length: 12 }, (_, index) => `${run} строка ${index + 1}`);
      delete payload.searchRecommendationSections;
      const formatted = { ...(payload.formattedText as Record<string, unknown>) };
      delete formatted["search:recommendations"];
      payload.formattedText = formatted;
    }, async ({ page }) => {
      await expect(page.locator(".recommendation-preview .recommendation-preview-item")).toHaveCount(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
});

// ---- «Сводка» --------------------------------------------------------------------------------------------------------------------

const newsSeed = (run: string, count: number) => Array.from({ length: count }, (_, index) => ({
  id: `${run}-bc-${index + 1}`, type: "news", title: `${run} Новость ${index + 1}`, body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "",
}));

test.describe("[STAB-EDIT-03] «Сводка» is a plain list per tab", () => {
  test("[STAB-EDIT-03] entries of old sections all stand in one list; no section controls; «Показывать посетителям» hides an entry from the public window", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "PC lane: the same data path runs on every device");
    const base = baseURL ?? fallbackBase;
    await openTabWith(browser, stagingRun, base, testInfo, "layout-broadcasts", /^Сводка/, (payload, run) => {
      payload.broadcasts = newsSeed(run, 2).map((item, index) => (index === 0 ? { ...item, sectionId: `${run}-bs-1` } : item));
      payload.broadcastSections = [{ id: `${run}-bs-1`, title: `${run} Старый раздел`, subsections: [] }];
    }, async ({ page, run }) => {
      const ids = [`${run}-bc-1`, `${run}-bc-2`];
      await expect(page.locator(".broadcast-entry-list [data-broadcast-id]")).toHaveCount(2);
      await expect(page.locator(".editor-section-addbar"), "no add-section bar").toHaveCount(0);
      await expect(page.locator("[data-broadcast-section]"), "no «Раздел» field").toHaveCount(0);
      await expect(page.getByText(`${run} Старый раздел`)).toHaveCount(0);

      await toggleOf(card(page, ids[0])).click();
      await card(page, ids[0]).getByLabel("Показывать посетителям").uncheck();
      await saveEditor(page);
      const stored = await storedContent(stagingRun);
      expect(stored.broadcasts.map((item) => item.id), "the broadcasts keep their order and members").toEqual(ids);
      expect(stored.broadcasts.find((item) => item.id === ids[0])?.published).toBe(false);

      await withVisitor(browser, base, async (desktop) => {
        await desktop.openApp("Сводка");
        const broadcastWindow = desktop.window("Сводка");
        await expect(broadcastWindow).toContainText(`${run} Новость 2`);
        await expect(broadcastWindow).not.toContainText(`${run} Новость 1`);
        await expect(broadcastWindow).not.toContainText(`${run} Старый раздел`);
      });
    });
  });

  test("[STAB-A11Y-02] a long list stays in one column on a phone without horizontal overflow", async ({ browser, stagingRun, baseURL }, testInfo) => {
    await openTabWith(browser, stagingRun, baseURL ?? fallbackBase, testInfo, "layout-broadcasts-list", /^Сводка/, (payload, run) => {
      payload.broadcasts = newsSeed(run, 12);
      delete payload.broadcastSections;
    }, async ({ page, run }) => {
      await expect(page.locator(".broadcast-entry-list [data-broadcast-id]")).toHaveCount(12);
      if (isPhone()) {
        const lefts = new Set<number>();
        for (let index = 1; index <= 12; index += 1) lefts.add(Math.round((await box(card(page, `${run}-bc-${index}`))).x));
        expect(lefts.size, "all entries share one left edge").toBe(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
});
