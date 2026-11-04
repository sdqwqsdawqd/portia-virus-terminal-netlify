import type { Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

// Global search (19-11): Ctrl/Cmd+K and the arrows (owner verdict 3), the opened record is marked for 2400ms (D-14),
// the search window stays open. The spec reads the real published content of the target and fabricates none; it runs in 19-14.

const isPhone = () => test.info().project.name.includes("phone");

async function firstVirusName(page: Page, desktop: DesktopPage) {
  await desktop.goto();
  await desktop.openApp("База вирусов");
  const archive = desktop.window("База вирусов");
  await expect(archive.locator('.app-skeleton[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
  test.skip(await archive.locator(".virus-row").count() === 0, "BLOCKED (DATA): this target serves no viruses to search for.");
  const name = (await archive.locator(".virus-row strong").first().textContent())?.trim() ?? "";
  test.skip(!name, "BLOCKED (DATA): this target serves no viruses to search for.");
  await desktop.closeApp("База вирусов");
  await expect(desktop.window("База вирусов")).toHaveCount(0);
  return name;
}

test("[STAB-SEARCH-03] Ctrl+K opens the search with the field focused; arrows move between field and results; Escape clears, then closes", async ({ page }) => {
  test.skip(isPhone(), "A phone takes over Enter alone (no Ctrl+K, arrows or Escape logic).");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await page.keyboard.press("Control+k");
  const search = desktop.window("Глобальный поиск");
  await expect(search).toBeVisible();
  const field = search.getByRole("searchbox");
  await expect(field).toBeFocused();

  await page.keyboard.press("Control+k");
  await expect(field).toBeFocused();
  await expect(page.locator('.app-window[data-window-app="search"]')).toHaveCount(1);

  const results = search.locator(".global-result[data-result-index]");
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThan(1);
  await page.keyboard.press("ArrowDown");
  await expect(results.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(results.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(results.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(field).toBeFocused();

  await page.keyboard.type("вирус");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue("");
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
});

test("[STAB-SEARCH-02] choosing a virus opens its app, scrolls to and marks the record, and leaves the search window open", async ({ page }) => {
  const desktop = new DesktopPage(page);
  const name = await firstVirusName(page, desktop);
  await desktop.openApp("Глобальный поиск");
  const search = desktop.window("Глобальный поиск");
  await search.getByRole("searchbox").fill(name);
  await search.locator(".global-result").filter({ has: page.locator(".global-result-mark", { hasText: "VIS" }) }).filter({ hasText: name }).first().click();

  const archive = desktop.window("База вирусов");
  const hit = archive.locator('.virus-row[data-search-hit="true"]');
  await expect(hit).toHaveCount(1);
  await expect(hit).toHaveAttribute("aria-current", "true");
  await expect(hit).toHaveClass(/search-hit/);
  await expect(hit).toBeInViewport();
  // Not closed, not minimised, not modal: the field still holds the query and takes typing.
  // On a phone the opened app is full screen and the search is behind it; the window stays open and the taskbar brings it back with its query (D-14).
  if (isPhone()) {
    await expect(page.locator('.app-window[data-window-app="search"]')).toHaveCount(1);
    await page.locator('[data-taskbar-app="search"]').click();
  }
  await expect(search).toBeVisible();
  await expect(search.getByRole("searchbox")).toHaveValue(name);
  await expect(archive.locator('[data-search-hit="true"]')).toHaveCount(0, { timeout: 5_000 });
});

test("[STAB-SEARCH-02] a click inside the opened app takes the mark off before the timer", async ({ page }) => {
  const desktop = new DesktopPage(page);
  const name = await firstVirusName(page, desktop);
  await desktop.openApp("Глобальный поиск");
  const search = desktop.window("Глобальный поиск");
  await search.getByRole("searchbox").fill(name);
  await search.locator(".global-result").filter({ hasText: name }).first().click();
  const archive = desktop.window("База вирусов");
  await expect(archive.locator('[data-search-hit="true"]')).toHaveCount(1);
  await page.clock.runFor(450);
  await archive.locator(".browser-heading").click();
  await expect(archive.locator('[data-search-hit="true"]')).toHaveCount(0, { timeout: 1_000 });
});

test("[STAB-SEARCH-01] a query no record holds says «Совпадений нет»; the results never overflow the page sideways", async ({ page }) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Глобальный поиск");
  const search = desktop.window("Глобальный поиск");
  await search.getByRole("searchbox").fill("яяяяяяяяяяяяяяяяяяяяяяяя");
  await expect(search.getByText("Совпадений нет")).toBeVisible();
  await expect(search.getByText("Измените запрос или выберите рекомендацию.")).toBeVisible();
  await search.getByRole("searchbox").fill("");
  await expect(search.locator(".global-result").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("[STAB-SEARCH-01] «Ёж», «ёж» and «еж» are one query, and an app is found by its name", async ({ page }) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Глобальный поиск");
  const search = desktop.window("Глобальный поиск");
  const field = search.getByRole("searchbox");
  await field.fill("УСТАВ");
  await expect(search.locator(".global-result").filter({ has: page.locator(".global-result-mark", { hasText: "APP" }) }).filter({ hasText: "Устав" })).toHaveCount(1);
  const counts: number[] = [];
  for (const query of ["ЁЖ", "ёж", "еж"]) {
    await field.fill(query);
    await expect(search.locator(".global-search-summary strong")).toBeVisible();
    counts.push(await search.locator(".global-result").count());
  }
  test.skip(counts[0] === 0, "BLOCKED (DATA): this target holds no record with «ё/е» in its title, so normalization cannot be shown.");
  expect(counts[0]).toBeGreaterThan(0);
  expect(new Set(counts).size).toBe(1);
});
