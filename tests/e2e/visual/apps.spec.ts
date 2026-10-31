import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { visualPolicy } from "../fixtures/visual-policy";

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
    await expect(desktop.window(name)).toBeVisible();
    if (name !== "Таблица" && name !== "Устав") {
      await expect(desktop.window(name).getByRole("status").filter({ hasText: /Загрузка/ })).toHaveCount(0);
    }
    await expect(page).toHaveScreenshot(
      `application-${id}--${testInfo.project.name}.png`,
      visualPolicy(page, `application:${id}`),
    );
  });
}
