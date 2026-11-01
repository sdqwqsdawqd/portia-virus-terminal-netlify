import type { Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

const query = "Настройки";

async function openFromStartPanel(page: Page, name: string) {
  await page.getByRole("button", { name: "PORTIA", exact: true }).click();
  await page.locator(".start-panel").getByRole("button", { name: new RegExp(name) }).click();
}

test("[STAB-DESK-01] one app id keeps one window from every entry point", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith("-phone"), "Phone projects have no cascading windows.");
  const desktop = new DesktopPage(page);
  await desktop.goto();
  const search = desktop.window("Глобальный поиск");
  const searchField = search.getByPlaceholder("Введите название, код или тему");
  const taskbarSearch = page.locator('[data-taskbar-app="search"]');

  // (a) shortcut, minimise, start panel: one active window, query kept.
  await desktop.openApp("Глобальный поиск");
  await searchField.fill(query);
  await page.getByRole("button", { name: "Свернуть Глобальный поиск" }).click();
  await expect(search).toBeHidden();
  await openFromStartPanel(page, "Глобальный поиск");
  await expect(search).toHaveCount(1);
  await expect(search).toBeVisible();
  await expect(search).toHaveClass(/is-active/);
  await expect(searchField).toHaveValue(query);

  // (b) minimise again, taskbar.
  await page.getByRole("button", { name: "Свернуть Глобальный поиск" }).click();
  await expect(search).toBeHidden();
  await taskbarSearch.click();
  await expect(search).toHaveCount(1);
  await expect(search).toBeVisible();
  await expect(search).toHaveClass(/is-active/);
  await expect(searchField).toHaveValue(query);

  // (c) a window behind others only comes forward: Settings via start panel, search forward via taskbar, Settings again via a search result.
  await openFromStartPanel(page, "Настройки");
  const settings = desktop.window("Настройки");
  await expect(settings).toHaveClass(/is-active/);
  await taskbarSearch.click();
  await expect(search).toHaveClass(/is-active/);
  await search.locator(".global-result").filter({ hasText: "ПРИЛОЖЕНИЕ" }).filter({ hasText: "Настройки" }).first().click();
  await expect(settings).toHaveCount(1);
  await expect(settings).toHaveClass(/is-active/);

  // (d) close and reopen from the shortcut: one window; globalQuery lives in PortiaDesktop, so 17-WINDOW-REOPEN.md says the query is kept.
  // After (c) Settings is active and covers the search window, so bring search forward before closing it.
  await taskbarSearch.click();
  await expect(search).toHaveClass(/is-active/);
  await page.getByRole("button", { name: "Закрыть Глобальный поиск" }).click();
  await expect(search).toHaveCount(0);
  await desktop.openApp("Глобальный поиск");
  await expect(search).toHaveCount(1);
  await expect(searchField).toHaveValue(query);
});
