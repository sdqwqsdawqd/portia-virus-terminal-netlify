import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { visualPolicy, type VisualState } from "../fixtures/visual-policy";
import type { Page } from "@playwright/test";

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
