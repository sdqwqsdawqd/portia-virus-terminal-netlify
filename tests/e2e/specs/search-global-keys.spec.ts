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
