import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

test("[STAB-BASE-03] capture shortcut start, key, interruption, end and rest frames", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  const shortcut = desktop.shortcut("Настройки");
  const capture = (id: string, state: string) => captureCandidate(context, {
    id,
    requirement: "STAB-BASE-03",
    surface: "Motion CURRENT",
    actor: "visitor",
    state,
    intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    animations: "allow",
  });

  await shortcut.hover();
  await expect(shortcut).toHaveClass(/is-icon-animating/);
  await capture("motion-shortcut-start", "shortcut animation start; fixed clock 0ms");
  await page.clock.runFor(260);
  await capture("motion-shortcut-key", "shortcut animation key frame; fixed clock 260ms");
  await page.mouse.move(720, 450);
  await expect(shortcut).toHaveClass(/is-icon-animating/);
  await capture("motion-shortcut-interruption", "pointer exited at 260ms; animation continues without moving the shortcut");
  await page.clock.runFor(500);
  await expect(shortcut).not.toHaveClass(/is-icon-animating/);
  await capture("motion-shortcut-end", "shortcut animation completed at 760ms; static geometry restored");
  await page.clock.runFor(1_000);
  await capture("motion-shortcut-rest", "shortcut stable rest frame after completion");
});

test("[STAB-BASE-03] inventory motion surfaces that need dedicated actor/device evidence", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  for (const [id, state, reason] of [
    ["motion-boot", "boot start, transition and complete", "Current deterministic fixture intentionally skips the once-per-session boot; a dedicated isolated context is still required."],
    ["motion-spider", "PNG spider spawn, front-leg step, hunting signal and route", "A stable semantic pose marker is not exposed yet; arbitrary timer screenshots are prohibited."],
    ["motion-web-wave", "web rest and wave response", "A deterministic semantic wave trigger is not exposed yet."],
    ["motion-vivian", "Vivian idle, click/activity/offended and bubble", "Offended/recovery timing needs an explicit semantic state contract before capture."],
    ["motion-wallpapers", "wallpaper movement and switching", "Each wallpaper requires a separately mapped clock state; no blanket timer capture."],
    ["motion-window-lock", "window drag/resize and qualification lock", "Qualification lock requires isolated participant fixtures."],
  ] as const) {
    await recordBlockedCandidate(context, {
      id,
      requirement: "STAB-BASE-03",
      surface: "Motion CURRENT",
      actor: id === "motion-window-lock" ? "participant" : "visitor",
      state,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    }, reason);
  }
});
