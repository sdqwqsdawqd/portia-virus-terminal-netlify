import { DesktopPage } from "../pages/desktop.page";
import { alignParkedClock, parkClockBeforeLoad, settleAnimations } from "../fixtures/determinism";
import { expect, test } from "../fixtures/test";
import { compareApprovedScreenshot, type VisualState } from "../fixtures/visual-policy";
import type { Page } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

async function advanceUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  message: string,
  limitMs = 30_000,
) {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 50) {
    if (await predicate()) return;
    await page.clock.runFor(50);
  }
  throw new Error(`[PORTIA_MOTION_STATE_TIMEOUT] ${message}`);
}

test("[STAB-BASE-03] approved web and Vivian motion states", async ({ page }, testInfo) => {
  // 20-12 (D-68, class (в) nondeterminism): the fake clock runs at real speed after install(), so the spider route moved with the wall time between
  // two runs. 20-62 (D-69, G3): the clock is parked BEFORE the load (parkClock after it left a 277-323 ms real-time head start), the desktop mounts
  // through runFor only, and CSS animations are settled before each frame (settleAnimations). runFor costs real time.
  test.slow();
  const desktop = new DesktopPage(page);
  // /api/employees answers in about 8 s of real time; its own 15 s fake-time limit would abort it while the scene steps the parked clock
  // (an unexpected requestfailed). The scene lets the answer arrive first, still on the parked clock, so no timer can cut it.
  const employees = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/employees");
  await parkClockBeforeLoad(page);
  await page.goto("/");
  await alignParkedClock(page);
  await advanceUntil(page, () => page.evaluate(() => (document.querySelector(".wallpaper-spider") as HTMLElement | null)?.style.opacity === "1"), "spider mounted under the parked clock");
  await desktop.desktop.waitFor();
  await employees;
  const compare = (id: Extract<VisualState, `motion:${string}`>) =>
    compareApprovedScreenshot(
      page,
      id,
      `${id.replace("motion:", "motion-")}--${testInfo.project.name}.png`,
    );
  // Measured scopes (20-62): the endless wallpaper dew (7 s cycle, a different phase in every run) and everything Vivian animates (hover and press transitions,
  // squish, bubble, offended and recover animations). The scopes are not wider than what differed.
  const scopes = [".wallpaper-web-dew", ".desktop-assistant"];

  await expect(desktop.spider).toBeVisible();
  await expect(desktop.spider).toHaveCSS("opacity", "1");
  const spawnTransform = await desktop.spider.evaluate((element) => element.style.transform);
  expect(spawnTransform).not.toBe("");

  await advanceUntil(page, async () => {
    const front = await desktop.spiderFrontLegs.evaluateAll((legs) =>
      legs.map((leg) => Math.abs(Number.parseFloat((leg as HTMLElement).style.rotate) || 0)),
    );
    const rear = await desktop.spiderRearLegs.evaluateAll((legs) =>
      legs.map((leg) => Math.abs(Number.parseFloat((leg as HTMLElement).style.rotate) || 0)),
    );
    return front.some((value) => value > 0.2) && rear.every((value) => value < 0.05);
  }, "front legs L4/R4 hunting beside the fangs");
  await expect(desktop.spiderFrontLegs).toHaveCount(2);

  await advanceUntil(page, async () => {
    const transform = await desktop.spider.evaluate((element) => element.style.transform);
    return transform !== spawnTransform;
  }, "seeded spider route movement");

  await page.clock.runFor(2_500);
  const webOffsets = await desktop.web.locator("path").evaluateAll((paths) =>
    paths.map((path) => getComputedStyle(path).strokeDashoffset),
  );
  expect(webOffsets.every((value) => value === "0px" || value === "0")).toBe(true);
  await settleAnimations(page, scopes);
  await compare("motion:web-rest");

  await advanceUntil(page, async () =>
    desktop.webPulses.evaluateAll((paths) => paths.some((path) => path.getAttribute("d"))),
  "footfall wave path emitted");

  await expect(desktop.assistantShell).not.toHaveClass(/is-speaking|is-offended|is-recovering/);
  await settleAnimations(page, scopes);
  await compare("motion:vivian-idle");
  await desktop.assistant.click();
  await expect(desktop.assistantShell).toHaveClass(/is-speaking/);
  await expect(desktop.assistantShell.getByRole("status")).toBeVisible();
  await settleAnimations(page, scopes);
  await compare("motion:vivian-activity");

  for (let index = 0; index < 60; index += 1) {
    await page.clock.runFor(1_000);
    await desktop.assistant.click();
    if (await desktop.assistantShell.evaluate((element) => element.classList.contains("is-offended"))) break;
  }
  await expect(desktop.assistantShell).toHaveClass(/is-offended/);
  await expect(desktop.assistant).toHaveAttribute("aria-disabled", "true");
  await settleAnimations(page, scopes);
  await compare("motion:vivian-offended");
  await page.clock.runFor(10_000);
  await expect(desktop.assistantShell).toHaveClass(/is-recovering/);
  await settleAnimations(page, scopes);
  await compare("motion:vivian-recovery");
});
