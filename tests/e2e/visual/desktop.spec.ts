import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { visualPolicy } from "../fixtures/visual-policy";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

test("[STAB-BASE-03] approved desktop and window shell", async ({ page }, testInfo) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Анимации", "Выключены");
  await desktop.closeApp("Настройки");
  await desktop.desktop.waitFor();

  await expect(page).toHaveScreenshot(`desktop-clean--${testInfo.project.name}.png`, visualPolicy(page, "desktop:clean"));

  await page.getByRole("button", { name: "PORTIA", exact: true }).click();
  await expect(page.getByText("PORTIA OS", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveScreenshot(`desktop-start-open--${testInfo.project.name}.png`, visualPolicy(page, "desktop:start-open"));
  await page.getByRole("button", { name: "PORTIA", exact: true }).click();

  await desktop.openApp("Глобальный поиск");
  await expect(page).toHaveScreenshot(`window-search-restored--${testInfo.project.name}.png`, visualPolicy(page, "desktop:search-restored"));
  await page.getByRole("button", { name: "Развернуть Глобальный поиск" }).click();
  await expect(page).toHaveScreenshot(`window-search-maximized--${testInfo.project.name}.png`, visualPolicy(page, "desktop:search-maximized"));
  await page.getByRole("button", { name: "Свернуть Глобальный поиск" }).click();
  await expect(desktop.window("Глобальный поиск")).toBeHidden();
  await expect(page).toHaveScreenshot(`window-search-minimized--${testInfo.project.name}.png`, visualPolicy(page, "desktop:search-minimized"));
});
