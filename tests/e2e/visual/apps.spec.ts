import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

const applications = [
  ["База вирусов", "virus-archive"],
  ["Сотрудники", "employees"],
  ["Сводка", "broadcasts"],
  ["Информация", "information"],
  ["Справочник", "guide"],
  ["Корзина", "trash"],
  ["Настройки", "settings"],
  ["Глобальный поиск", "search"],
  ["Таблица", "table"],
  ["Устав", "charter"],
] as const;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

for (const [name, id] of applications) {
  test(`[STAB-BASE-03] approved public application: ${name}`, async ({ page }, testInfo) => {
    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp(name);
    if (name !== "Таблица" && name !== "Устав") {
      await expect(desktop.window(name).getByRole("status").filter({ hasText: /Загрузка/ })).toHaveCount(0);
    }
    const mask = name === "Сотрудники"
      ? [page.locator(".personnel-app")]
      : name === "Таблица" || name === "Устав"
        ? [page.locator("iframe")]
        : undefined;
    await expect(page).toHaveScreenshot(`application-${id}--${testInfo.project.name}.png`, {
      mask,
      maskColor: "#0c1715",
      maxDiffPixels: 2_500,
    });
  });
}
