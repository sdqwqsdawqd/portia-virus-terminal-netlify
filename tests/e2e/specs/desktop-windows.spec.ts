import type { Locator, Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error("element has no box");
  return found;
}

/** Waits until the window stops animating (two equal boxes in a row) and returns the resting box. */
async function settledBox(locator: Locator): Promise<Box> {
  let previous = await box(locator);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await locator.page().waitForTimeout(100);
    const next = await box(locator);
    if (["x", "y", "width", "height"].every((key) => Math.abs(next[key as keyof Box] - previous[key as keyof Box]) < 0.5)) return next;
    previous = next;
  }
  return previous;
}

function expectSameBox(actual: Box, expected: Box, tolerance = 1) {
  for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(actual[key] - expected[key]), key).toBeLessThanOrEqual(tolerance);
}

/** Window must sit inside the workspace with the 8px inset (+-1px) on all four sides. */
async function expectInsideInset(page: Page, windowBox: Box) {
  const workspace = await box(page.locator(".workspace"));
  expect(windowBox.x - workspace.x).toBeGreaterThanOrEqual(7);
  expect(windowBox.y - workspace.y).toBeGreaterThanOrEqual(7);
  expect(workspace.x + workspace.width - (windowBox.x + windowBox.width)).toBeGreaterThanOrEqual(7);
  expect(workspace.y + workspace.height - (windowBox.y + windowBox.height)).toBeGreaterThanOrEqual(7);
}

async function dragBy(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test.describe("desktop windows (PC)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.endsWith("-phone"), "Free drag, resize and cascading windows exist only on PC.");
  });

  test("[STAB-DESK-02] window stays inside symmetric insets on drag, resize and viewport change", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Глобальный поиск");
    const search = desktop.window("Глобальный поиск");
    await settledBox(search);
    const title = search.locator(".window-titlebar");

    // Drag far beyond every side of the viewport: the whole window stays inside the 8px inset (owner variant A, 18-MOTION-APPROVAL.md п. 7).
    const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
    for (const target of [{ x: -3000, y: 450 }, { x: 4000, y: 450 }, { x: 700, y: -3000 }, { x: 700, y: 4000 }, { x: 4000, y: 4000 }, { x: -3000, y: -3000 }]) {
      const handle = await box(title);
      await dragBy(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, target);
      await expectInsideInset(page, await settledBox(search));
    }

    // Move away from the border, then resize: the opposite side stays still within 1px.
    const centre = await box(title);
    await dragBy(page, { x: centre.x + centre.width / 2, y: centre.y + centre.height / 2 }, { x: viewport.width / 2, y: viewport.height / 2 });
    const before = await settledBox(search);
    const west = await box(search.locator(".window-edge-w"));
    await dragBy(page, { x: west.x + west.width / 2, y: west.y + west.height / 2 }, { x: west.x + west.width / 2 - 60, y: west.y + west.height / 2 });
    const afterWest = await settledBox(search);
    expect(Math.abs(afterWest.x + afterWest.width - (before.x + before.width))).toBeLessThanOrEqual(1);
    const southEast = await box(search.locator(".window-edge-se"));
    await dragBy(page, { x: southEast.x + southEast.width / 2, y: southEast.y + southEast.height / 2 }, { x: southEast.x + 40, y: southEast.y + 40 });
    const afterSouthEast = await settledBox(search);
    expect(Math.abs(afterSouthEast.x - afterWest.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterSouthEast.y - afterWest.y)).toBeLessThanOrEqual(1);

    // A smaller viewport refits the window back inside the workspace.
    await page.setViewportSize({ width: 1100, height: 700 });
    await expect.poll(async () => {
      const workspace = await box(page.locator(".workspace"));
      const current = await box(search);
      return current.x + current.width <= workspace.x + workspace.width - 7 && current.y + current.height <= workspace.y + workspace.height - 7;
    }).toBe(true);
  });

  test("[STAB-DESK-03] minimize, maximize, close and taskbar keep state and leave other windows alone", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Глобальный поиск");
    await page.getByRole("button", { name: "PORTIA", exact: true }).click();
    await page.locator(".start-panel").getByRole("button", { name: /Настройки/ }).click();
    const search = desktop.window("Глобальный поиск");
    const settings = desktop.window("Настройки");
    // Settings opened last and covers the search controls: bring search forward through the taskbar first.
    await page.locator('[data-taskbar-app="search"]').click();
    await expect(search).toHaveClass(/is-active/);
    const searchBox = await settledBox(search);
    const settingsBox = await settledBox(settings);

    await page.getByRole("button", { name: "Свернуть Глобальный поиск" }).click();
    await expect(search).toBeHidden();
    expectSameBox(await settledBox(settings), settingsBox);
    await page.locator('[data-taskbar-app="search"]').click();
    await expect(search).toBeVisible();
    expectSameBox(await settledBox(search), searchBox);
    expectSameBox(await settledBox(settings), settingsBox);

    // Maximise and back restores the remembered geometry.
    await page.getByRole("button", { name: "Развернуть Глобальный поиск" }).click();
    await expect(search).toHaveClass(/is-maximized/);
    await page.getByRole("button", { name: "Развернуть Глобальный поиск" }).click();
    await expect(search).not.toHaveClass(/is-maximized/);
    expectSameBox(await settledBox(search), searchBox);

    // Opening the visible window again (start panel: windows cover the shortcuts) nods it and returns it to rest in the same place (D-14).
    await page.getByRole("button", { name: "PORTIA", exact: true }).click();
    await page.locator(".start-panel").getByRole("button", { name: /Глобальный поиск/ }).click();
    await page.waitForTimeout(400);
    expectSameBox(await box(search), searchBox);
    await expect(search).toHaveCount(1);
    expectSameBox(await settledBox(settings), settingsBox);

    // Closing one window leaves the other where it was.
    await desktop.closeApp("Глобальный поиск");
    await expect(search).toHaveCount(0);
    expectSameBox(await settledBox(settings), settingsBox);
  });
});

test.describe("desktop windows (phone)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.endsWith("-phone"), "The phone window contract is checked on phone projects only.");
  });

  test("[STAB-DESK-04] phone windows fill the screen between system bar and taskbar without page overflow", async ({ page }) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    const apps = ["Глобальный поиск", "Настройки", "Информация", "Справочник", "Сводка"];
    for (const name of apps) {
      const shortcut = desktop.shortcut(name);
      // An open window may cover the shortcut grid; the taskbar of the previously open windows stays reachable, so minimise it first.
      if (!(await shortcut.isVisible())) {
        const open = page.locator(".app-window.is-active");
        await open.getByRole("button", { name: /^Свернуть / }).tap();
      }
      await shortcut.tap();
      const current = desktop.window(name);
      await expect(current).toBeVisible();
      const rect = await settledBox(current);
      const bar = await box(page.locator(".system-bar"));
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(innerWidth + 0.5);
      expect(rect.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
      await expect(current.locator('[data-window-action="maximize"]')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    // The taskbar switches windows: only the active one is shown.
    await page.locator('[data-taskbar-app="search"]').tap();
    await expect(desktop.window("Глобальный поиск")).toBeVisible();
    await expect(page.locator(".app-window:visible")).toHaveCount(1);
  });
});
