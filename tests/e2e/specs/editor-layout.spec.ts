import { createClient } from "@supabase/supabase-js";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { defaultPortiaContent } from "../../../lib/portia-content.ts";
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
