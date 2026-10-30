import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import type { CandidateContext } from "./support";
import { captureCandidate, recordBlockedCandidate } from "./support";

async function staticDesktop(context: CandidateContext) {
  const desktop = new DesktopPage(context.page);
  await desktop.goto();
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Анимации", "Выключены");
  await desktop.closeApp("Настройки");
  await desktop.desktop.waitFor();
  return desktop;
}

test("[STAB-BASE-03] capture desktop rest, start and window geometry candidates", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = await staticDesktop(context);
  await captureCandidate(context, {
    id: "desktop-clean-rest",
    requirement: "STAB-BASE-03",
    surface: "Desktop and window shell",
    actor: "visitor",
    state: "clean desktop; boot complete; taskbar and start closed; motion off",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/desktop-clean--${testInfo.project.name}.png`,
  });

  await page.getByRole("button", { name: "PORTIA", exact: true }).click();
  await expect(page.getByText("PORTIA OS", { exact: true }).last()).toBeVisible();
  await captureCandidate(context, {
    id: "desktop-start-open",
    requirement: "STAB-BASE-03",
    surface: "Desktop and window shell",
    actor: "visitor",
    state: "start panel open; motion off",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/desktop-start-open--${testInfo.project.name}.png`,
  });
  await page.getByRole("button", { name: "PORTIA", exact: true }).click();

  await desktop.openApp("Глобальный поиск");
  await captureCandidate(context, {
    id: "window-search-restored",
    requirement: "STAB-BASE-03",
    surface: "Desktop and window shell",
    actor: "visitor",
    state: "active restored window; motion off",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/window-search-restored--${testInfo.project.name}.png`,
  });
  await page.getByRole("button", { name: "Развернуть Глобальный поиск" }).click();
  await captureCandidate(context, {
    id: "window-search-maximized",
    requirement: "STAB-BASE-03",
    surface: "Desktop and window shell",
    actor: "visitor",
    state: "active maximized window; motion off",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/window-search-maximized--${testInfo.project.name}.png`,
  });
  await page.getByRole("button", { name: "Свернуть Глобальный поиск" }).click();
  await expect(desktop.window("Глобальный поиск")).toBeHidden();
  await captureCandidate(context, {
    id: "window-search-minimized",
    requirement: "STAB-BASE-03",
    surface: "Desktop and window shell",
    actor: "visitor",
    state: "window minimized to taskbar; motion off",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/window-search-minimized--${testInfo.project.name}.png`,
  });
});

test("[STAB-BASE-03] record device candidates that require separate approved runs", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  await staticDesktop(context);
  for (const [id, state, project, reason] of [
    ["desktop-dpr125", "owner-PC DPR 1.25 desktop geometry", "chromium-dpr125", "Run the dedicated DPR 1.25 project before owner approval."],
    ["desktop-firefox", "Firefox behavior/accessibility smoke", "firefox-desktop", "Firefox is behavioral evidence and has no authoritative pixel golden."],
    ["phone-webkit", "representative iPhone layout/touch", "webkit-phone", "Representative owner phone descriptor is not selected."],
    ["phone-chromium", "Android Chromium layout/touch", "chromium-phone", "Owner-recorded Android viewport/DPR is not selected."],
  ] as const) {
    await recordBlockedCandidate(context, {
      id,
      requirement: "STAB-BASE-03",
      surface: "Viewport, device and DPR matrix",
      actor: "visitor",
      state: `${state}; target project ${project}`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${project}.png`,
    }, reason);
  }
});
