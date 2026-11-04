import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { defaultPortiaContent } from "../../../lib/portia-content.ts";
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
    const payload = structuredClone((before.data?.payload ?? defaultPortiaContent) as Record<string, unknown>);
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
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
});

// The private store of 20-24 is applied by the owner. Until then these steps are BLOCKED (OWNER), never a pass.
async function skipUnlessNotesTable(stagingRun: StagingRun, testInfo: TestInfo) {
  testInfo.skip(!stagingRun.live, "BLOCKED (ENV): safe target unavailable");
  const probe = await adminOf(stagingRun).from("portia_editor_notes").select("tab").limit(1);
  const absent = probe.error?.code === "42P01" || probe.error?.code === "PGRST205";
  testInfo.skip(absent, "BLOCKED (OWNER/ENV): notes store not applied (migration 20261104000100 awaits the owner)");
  expect(probe.error, "probe portia_editor_notes").toBeNull();
}

test.describe("[STAB-EDIT-04] D-47 editor note of a «Справочник» section stays private", () => {
  test("[STAB-EDIT-04] the note is stored only in /api/content/notes; visitors, the «Справочник» window and the search never show it", async ({ browser, stagingRun, baseURL }, testInfo) => {
    test.skip(isPhone(), "Same data path on every device; the PC lane runs it once");
    const base = baseURL ?? fallbackBase;
    await skipUnlessNotesTable(stagingRun, testInfo);
    await openGuide(browser, stagingRun, base, testInfo, "layout-guide-notes", async ({ context, page, run }) => {
      const admin = adminOf(stagingRun);
      const rowsBefore = await admin.from("portia_editor_notes").select("*");
      expect(rowsBefore.error, "snapshot portia_editor_notes").toBeNull();
      try {
        const title = `${run} Раздел с заметкой`;
        const note = `${run} только для редактора`;
        await addButton(page).click();
        const form = page.locator(".editor-section-create");
        await form.getByLabel("Заголовок раздела").fill(title);
        const noteField = form.getByLabel("Заметка для редактора");
        await expect(noteField, "the store answers, so the field is enabled").toBeEnabled();
        await noteField.fill(note);
        await form.getByRole("button", { name: "Создать раздел" }).click();
        const created = page.locator(".editor-section-columns [data-sort-index]").filter({ has: page.getByRole("button", { name: new RegExp(title) }) });
        await expect(created.getByLabel("Заметка для редактора")).toHaveValue(note);
        await expect(page.getByRole("button", { name: /^Справочник, есть несохранённые правки/ })).toBeVisible();

        await page.locator(".editor-save-chip > button").click();
        await page.getByRole("button", { name: "СОХРАНИТЬ", exact: true }).click();
        await expect(page.locator("p.sr-only[role='status']")).toContainText("Сохранено");

        const stored = await context.request.get("/api/content/notes");
        expect(stored.status()).toBe(200);
        const answer = (await stored.json()) as { notes: { guide?: Record<string, string> } };
        expect(Object.values(answer.notes.guide ?? {})).toContain(note);

        const visitor = await browser.newContext({ baseURL: base, locale: "ru-RU" });
        try {
          await visitor.addInitScript(() => window.sessionStorage.setItem("portia-boot-seen-v1", "1"));
          await expect.poll(async () => (await (await visitor.request.get("/api/content")).text()).includes(title), { timeout: 20_000 }).toBe(true);
          expect(await (await visitor.request.get("/api/content")).text()).not.toContain(note);
          const visitorPage = await visitor.newPage();
          const desktop = new DesktopPage(visitorPage);
          await desktop.goto();
          await desktop.openApp("Справочник");
          await expect(desktop.window("Справочник")).not.toContainText(note);
          await desktop.openApp("Глобальный поиск");
          const search = desktop.window("Глобальный поиск");
          await search.getByRole("searchbox").fill(note);
          await expect(search).not.toContainText(note.slice(run.length + 1));
          await expect(search.locator(".global-result")).toHaveCount(0);
        } finally {
          await visitor.close();
        }
      } finally {
        const wipe = await admin.from("portia_editor_notes").delete().in("tab", ["guide", "broadcasts", "search"]);
        expect(wipe.error, "clear portia_editor_notes").toBeNull();
        if (rowsBefore.data?.length) {
          const back = await admin.from("portia_editor_notes").insert(rowsBefore.data);
          expect(back.error, "restore portia_editor_notes").toBeNull();
        }
      }
    });
  });
});
