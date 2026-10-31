import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

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

for (const [name, id] of applications) {
  test(`[STAB-BASE-03] capture public application: ${name}`, async ({ page, browser, determinism }, testInfo) => {
    const context = { page, browser, determinism, testInfo };
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
    await captureCandidate(context, {
      id: `application-${id}-current`,
      requirement: "STAB-BASE-03",
      surface: "Public applications",
      actor: "visitor",
      state: `${name}; current safe public state; unstable/private pixels masked where applicable`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/application-${id}--${testInfo.project.name}.png`,
      mask,
    });
  });
}

test("[STAB-BASE-03] inventory public application system states not safely constructible locally", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  for (const state of ["loading", "empty", "stale/degraded", "permission denied", "fatal error"] as const) {
    await recordBlockedCandidate(context, {
      id: `applications-system-${state}`,
      requirement: "STAB-BASE-03",
      surface: "Public applications",
      actor: "visitor",
      state: `applicable applications: ${state}`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/applications-${state.replace("/", "-")}--${testInfo.project.name}.png`,
    }, {
      reasonCode: "PUBLIC_STATE_FIXTURE_REQUIRED",
      recoveryPhase: 20,
      reason: "No approved deterministic first-party fixture currently exposes this system state without mocking PORTIA APIs.",
    });
  }
});
