import { DesktopPage } from "../pages/desktop.page";
import { parkClock } from "../fixtures/determinism";
import { expect, test } from "../fixtures/test";
import { visualPolicy, type VisualState } from "../fixtures/visual-policy";
import type { Locator, Page, Request } from "@playwright/test";
import { defaultPortiaContent } from "../../../lib/portia-content.ts";

// Phase 20-12 (D-68): baselines of the code the owner accepted (20-58), on FIXED DATA.
// Data mode: the server runs under tests/e2e/harness/offline-supabase.cjs (empty portia_content -> the starting content of the site) with invented
// public values, so a baseline here says nothing about real content, roles, saving or a live data source. Scenes that need a role or a populated
// target use substituted reads and are labelled as such: "substituted reads = UI contract, not proof of roles".
// Every test name carries @phase20 (the older baselines are run with --grep-invert @phase20).

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20 baselines are taken on chromium-desktop and chromium-phone.");
});

type Settings = Record<string, string>;
const baseSettings: Settings = { accent: "teal", wallpaper: "radar", iconSize: "standard", motion: "on", spider: "on", customAccent: "" };

const snapshotName = (surface: string, projectName: string) => `phase20-${surface}--${projectName}.png`;

async function compare(page: Page, surface: string, projectName: string, state: VisualState) {
  await expect(page).toHaveScreenshot(snapshotName(surface, projectName), visualPolicy(page, state));
}

// The desktop on the "Паутина" wallpaper with animations «Выключены» (motion off): the spider is drawn at its resting place and nothing moves.
// The clock is paused, so no timer of the page fires between the load and the frame.
async function openStill(page: Page, patch: Settings) {
  const settings = { ...baseSettings, ...patch };
  await page.addInitScript((value) => window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(value)), settings);
  await page.clock.pauseAt(new Date(Date.parse("2026-10-30T09:00:00+03:00") + 5_000));
  await page.goto("/");
  const desktop = new DesktopPage(page);
  await expect(async () => {
    await page.clock.runFor(50);
    await expect(desktop.desktop).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 20_000 });
  return desktop;
}

test("@phase20 spider at rest (D-45, D-53): animations «Выключены», no rim, sharp body, accent strand", async ({ page }, testInfo) => {
  const desktop = await openStill(page, { motion: "off" });
  await page.clock.runFor(3_000);
  await page.waitForTimeout(2_800); // the 600 ms fade-in (1.8 s delay) is a real-time CSS animation
  await expect(desktop.spider).toBeVisible();
  await expect(desktop.spider).toHaveCSS("opacity", "1");
  await compare(page, "spider", testInfo.project.name, "phase20:spider");
});

// D-54, D-59: the «Лабораторные колбы» wallpaper with animations «Выключены»: the finished frame (liquid at its drawn opacity 0.85, bubbles at their
// places, boards and waves finished), nothing moves. The spider is switched off so the frame is the wallpaper alone.
test("@phase20 flasks, animations «Выключены»: finished still frame (D-54, D-59)", async ({ page }, testInfo) => {
  await openStill(page, { wallpaper: "flasks", spider: "off", motion: "off" });
  await page.clock.runFor(3_000);
  const wallpaper = page.locator(".wallpaper-flasks");
  await expect(wallpaper).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.dataset.motion), "motion is off").toBe("off");
  expect(await page.evaluate(() => document.documentElement.dataset.wallpaper), "the flasks wallpaper is chosen").toBe("flasks");
  expect(
    await page.evaluate(() => document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks")).length),
    "no running animation in the flask art",
  ).toBe(0);
  await compare(page, "flasks", testInfo.project.name, "phase20:flasks");
});

// ---- shared helpers of the scenes with substituted reads ---------------------------------------------------------------------------------
// UI contract on substituted reads, not proof of roles or of live content: a GET of our own API is answered with a fixture, every write is
// aborted and recorded, and the test fails on any write to our API or Supabase (tracker below).

let writes: string[] = [];

/** Every request that could write to our API or Supabase (GET and HEAD are reads) or to file uploads: the test fails on any of them. */
function trackWrites(page: Page) {
  writes = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && (!readOnly || url.pathname.startsWith("/api/uploads"))) writes.push(`${request.method()} ${url.pathname}`);
  });
}

test.afterEach(() => {
  expect(writes, "the @phase20 scenes must not write to our API, Supabase or file uploads").toEqual([]);
});

const contentFixture = (patch: Record<string, unknown>) => ({ ...structuredClone(defaultPortiaContent), ...patch });

async function stubContent(page: Page, content: unknown) {
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ content, revision: 1, updatedAt: null }) });
  });
}

/** A window scales in when it opens; sizes are measured at rest. */
async function settle(window: Locator) {
  await window.evaluate((node) => Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))));
}

// ---- D-21: the three drawings of the empty states --------------------------------------------------------------------------------------
// The empty state is a fixture of GET /api/content (no articles, no cards, no news) - not data of the target. Substituted read = UI contract.
const emptyContent = () => contentFixture({ infoSections: [], guideSections: [], broadcasts: [], broadcastSections: [] });

const emptyScenes = [
  { key: "info-flask", app: "Информация", drawing: "flaskEmpty", box: ".app-state-body .empty-state", heading: "В «Информации» пока нет статей" },
  { key: "news-flask", app: "Сводка", drawing: "flaskEmpty", box: ".broadcast-empty", heading: "Новостей пока нет", tab: /^Новости/ },
  { key: "guide-microscope", app: "Справочник", drawing: "microscopeGuide", box: ".guide-empty", heading: "В «Справочнике» пока нет карточек" },
] as const;

for (const scene of emptyScenes) {
  test(`@phase20 empty state ${scene.key} (D-21; UI contract on a substituted GET /api/content, not proof of live content)`, async ({ page }, testInfo) => {
    trackWrites(page);
    await stubContent(page, emptyContent());
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp(scene.app);
    const window = desktop.window(scene.app);
    await expect(window.locator('.app-skeleton[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
    if ("tab" in scene) await window.getByRole("button", { name: scene.tab }).click();
    const box = window.locator(scene.box);
    await expect(box).toBeVisible();
    await expect(box.locator("svg")).toHaveAttribute("data-illustration", scene.drawing);
    await expect(box.locator("strong")).toHaveText(scene.heading);
    await settle(window);
    await parkClock(page);
    await compare(page, `empty-art-${scene.key}`, testInfo.project.name, `phase20:empty-art-${scene.key}`);
  });
}
