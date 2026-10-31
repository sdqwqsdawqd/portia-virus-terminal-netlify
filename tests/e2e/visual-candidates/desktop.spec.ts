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
  if (testInfo.project.name.endsWith("-phone")) {
    for (const [id, state] of [
      ["window-search-maximized", "separate maximized control"],
      ["window-search-minimized", "separate minimized control"],
    ] as const) {
      await recordBlockedCandidate(context, {
        id,
        requirement: "STAB-BASE-03",
        surface: "Desktop and window shell",
        actor: "visitor",
        state: `${state}; ${testInfo.project.name}`,
        intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
      }, {
        reasonCode: "PHONE_WINDOW_CONTRACT",
        recoveryPhase: 18,
        reason: "Phone windows use the full-screen phone contract and do not expose this desktop window control.",
      });
    }
    return;
  }
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

test("[STAB-BASE-03] capture the declared device project candidate", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  await staticDesktop(context);
  const target = {
    "chromium-dpr125": ["desktop-dpr125", "owner-PC DPR 1.25 desktop geometry"],
    "webkit-phone": ["phone-webkit", "iPhone 13 WebKit layout and touch viewport"],
    "chromium-phone": ["phone-chromium", "Pixel 7 Chromium layout and touch viewport"],
  }[testInfo.project.name] as readonly [string, string] | undefined;

  if (target) {
    const [id, state] = target;
    await captureCandidate(context, {
      id,
      requirement: "STAB-BASE-03",
      surface: "Viewport, device and DPR matrix",
      actor: "visitor",
      state: `${state}; captured on actual project ${testInfo.project.name}; motion off`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    });
    return;
  }

  if (testInfo.project.name === "firefox-desktop") {
    await recordBlockedCandidate(context, {
      id: "desktop-firefox",
      requirement: "STAB-BASE-03",
      surface: "Viewport, device and DPR matrix",
      actor: "visitor",
      state: "Firefox behavior/accessibility smoke; no pixel authority",
      intendedSnapshot: "tests/e2e/visual/__screenshots__/desktop-firefox--firefox-desktop.png",
    }, {
      reasonCode: "PIXEL_AUTHORITY_NOT_SIGNED",
      recoveryPhase: 22,
      reason: "Firefox remains behavior/a11y evidence until an explicit cross-browser pixel row is owner-signed.",
    });
  }
});
