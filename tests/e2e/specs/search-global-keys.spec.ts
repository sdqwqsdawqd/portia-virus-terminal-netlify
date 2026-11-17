import type { Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

// 20-19: D-44/D-46 the arrow keys outside the search window never open it or take the focus; Ctrl/Cmd+K is the only global call.
// The spec fabricates no site data: the probe fields live in a temporary container that is removed at the end.

const isPhone = () => test.info().project.name.includes("phone");
const searchWindow = (page: Page) => page.locator('.app-window[data-window-app="search"]');

test("[STAB-SEARCH-07] D-44 ArrowUp in an input, a textarea or a contenteditable does not open the search or move the focus", async ({ page }) => {
  test.skip(isPhone(), "A phone takes over Enter alone (no Ctrl+K, arrows or Escape logic).");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "e2e-d44-probe";
    box.innerHTML = '<input id="e2e-d44-input" type="text" value="проверка"><textarea id="e2e-d44-area">первая строка\nвторая строка</textarea><div id="e2e-d44-editable" contenteditable="true">текст редактора</div>';
    document.body.appendChild(box);
  });
  try {
    for (const id of ["e2e-d44-input", "e2e-d44-area", "e2e-d44-editable"]) {
      const field = page.locator(`#${id}`);
      await field.focus();
      await page.evaluate((fieldId) => {
        const element = document.getElementById(fieldId) as HTMLElement;
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.setSelectionRange(4, 4);
        else {
          const range = document.createRange();
          range.setStart(element.firstChild as Node, 4);
          range.collapse(true);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, id);
      await page.keyboard.press("ArrowUp");
      await expect(searchWindow(page), id).toHaveCount(0);
      await expect(field, id).toBeFocused();
    }
  } finally {
    await page.evaluate(() => document.getElementById("e2e-d44-probe")?.remove());
  }
});

test("[STAB-SEARCH-07] D-46 ArrowUp on an empty desktop does not open the search", async ({ page }) => {
  test.skip(isPhone(), "A phone takes over Enter alone (no Ctrl+K, arrows or Escape logic).");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("ArrowUp");
  await expect(searchWindow(page)).toHaveCount(0);
});

test("[STAB-SEARCH-07] D-46 Ctrl+K from a text field opens the search and focuses its field", async ({ page }) => {
  test.skip(isPhone(), "A phone takes over Enter alone (no Ctrl+K, arrows or Escape logic).");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "e2e-d44-probe";
    box.innerHTML = '<textarea id="e2e-d44-area">первая строка\nвторая строка</textarea>';
    document.body.appendChild(box);
  });
  try {
    await page.locator("#e2e-d44-area").focus();
    await page.keyboard.press("Control+k");
    const search = desktop.window("Глобальный поиск");
    await expect(search).toBeVisible();
    await expect(search.getByRole("searchbox")).toBeFocused();
  } finally {
    await page.evaluate(() => document.getElementById("e2e-d44-probe")?.remove());
  }
});

// D-43: 5-10 random recommendations per page load (all of them when fewer than five), stable until the next load.
async function recommendationCount(page: Page): Promise<number> {
  const response = await page.request.get("/api/content");
  if (!response.ok()) return 0;
  const body = await response.json() as { content?: { searchRecommendations?: unknown } };
  const list = body.content?.searchRecommendations;
  return Array.isArray(list) ? list.filter((item) => typeof item === "string" && item.trim()).length : 0;
}

async function openSearch(page: Page, desktop: DesktopPage) {
  if (isPhone()) await desktop.openApp("Глобальный поиск");
  else {
    await page.keyboard.press("Control+k");
    await desktop.window("Глобальный поиск").waitFor();
  }
}

async function shownRecommendations(page: Page, desktop: DesktopPage): Promise<string[]> {
  const buttons = desktop.window("Глобальный поиск").locator(".search-recommendations button");
  await expect(buttons.first()).toBeVisible();
  return (await buttons.allTextContents()).map((text) => text.trim());
}

test("[STAB-SEARCH-05] D-43 the search shows 5-10 recommendations (all when fewer than five), unchanged when the window is reopened", async ({ page }) => {
  const total = await recommendationCount(page);
  test.skip(total === 0, "BLOCKED (DATA): no search recommendations on this target");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await openSearch(page, desktop);
  const first = await shownRecommendations(page, desktop);
  expect(first.length).toBeGreaterThanOrEqual(Math.min(5, total));
  expect(first.length).toBeLessThanOrEqual(Math.min(10, total));
  await desktop.closeApp("Глобальный поиск");
  await expect(desktop.window("Глобальный поиск")).toHaveCount(0);
  await openSearch(page, desktop);
  expect(await shownRecommendations(page, desktop)).toEqual(first);
});

test("[STAB-SEARCH-05] D-43 reloading the page changes the set of recommendations when there are more than five", async ({ page }) => {
  const total = await recommendationCount(page);
  test.skip(total === 0, "BLOCKED (DATA): no search recommendations on this target");
  const desktop = new DesktopPage(page);
  const seen = new Set<string>();
  for (let load = 0; load < 8; load += 1) {
    await desktop.goto();
    await openSearch(page, desktop);
    const shown = await shownRecommendations(page, desktop);
    if (total <= 5) expect(shown).toHaveLength(total);
    seen.add(shown.join("\n"));
    if (total > 5 && seen.size >= 2) break;
  }
  if (total > 5) expect(seen.size, "at least two different sets over up to 8 loads").toBeGreaterThanOrEqual(2);
});
