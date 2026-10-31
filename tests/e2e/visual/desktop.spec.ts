import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import {
  compareApprovedScreenshot,
  visualPolicy,
  type VisualState,
} from "../fixtures/visual-policy";

async function staticDesktop(page: Parameters<typeof visualPolicy>[0]) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Анимации", "Выключены");
  await desktop.closeApp("Настройки");
  await desktop.desktop.waitFor();
  return desktop;
}

test("[STAB-BASE-03] approved desktop and window shell", async ({ page }, testInfo) => {
  const desktop = await staticDesktop(page);

  if (testInfo.project.name !== "webkit-phone") {
    await compareApprovedScreenshot(page, "desktop:clean", `desktop-clean--${testInfo.project.name}.png`);
  }

  await page.getByRole("button", { name: "PORTIA", exact: true }).click();
  await expect(page.getByText("PORTIA OS", { exact: true }).last()).toBeVisible();
  await compareApprovedScreenshot(page, "desktop:start-open", `desktop-start-open--${testInfo.project.name}.png`);
  await page.getByRole("button", { name: "PORTIA", exact: true }).click();

  if (testInfo.project.name !== "firefox-desktop") return;

  await desktop.openApp("Глобальный поиск");
  await expect(desktop.window("Глобальный поиск")).toBeVisible();
  await compareApprovedScreenshot(
    page,
    "desktop:search-restored",
    `window-search-restored--${testInfo.project.name}.png`,
  );
  if (testInfo.project.name.endsWith("-phone")) return;

  await page.getByRole("button", { name: "Развернуть Глобальный поиск" }).click();
  await expect(desktop.window("Глобальный поиск")).toBeVisible();
  await compareApprovedScreenshot(page, "desktop:search-maximized", `window-search-maximized--${testInfo.project.name}.png`);
  await page.getByRole("button", { name: "Свернуть Глобальный поиск" }).click();
  await expect(desktop.window("Глобальный поиск")).toBeHidden();
  await compareApprovedScreenshot(page, "desktop:search-minimized", `window-search-minimized--${testInfo.project.name}.png`);
});

test("[STAB-BASE-03] approved declared device project", async ({ page }, testInfo) => {
  const target = {
    "chromium-dpr125": ["desktop-dpr125", "desktop:dpr125"],
    "chromium-phone": ["phone-chromium", "desktop:phone-chromium"],
    "webkit-phone": ["phone-webkit", "desktop:phone-webkit"],
  }[testInfo.project.name] as readonly [string, VisualState] | undefined;
  if (!target) {
    test.skip(true, `No device-specific approved row is declared for ${testInfo.project.name}.`);
    return;
  }

  await staticDesktop(page);
  await compareApprovedScreenshot(page, target[1], `${target[0]}--${testInfo.project.name}.png`);
});
