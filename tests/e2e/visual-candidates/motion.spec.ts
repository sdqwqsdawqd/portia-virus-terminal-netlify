import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";
import type { Page } from "@playwright/test";

async function advanceUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  message: string,
  limitMs = 30_000,
) {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 50) {
    if (await predicate()) return elapsed;
    await page.clock.runFor(50);
  }
  throw new Error(`[PORTIA_MOTION_STATE_TIMEOUT] ${message}`);
}

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

test("[STAB-BASE-03] capture semantic spider, web and Vivian states", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  const capture = (id: string, state: string) => captureCandidate(context, {
    id,
    requirement: "STAB-BASE-03",
    surface: "Motion CURRENT",
    actor: "visitor",
    state,
    intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    animations: "allow",
  });

  await expect(desktop.spider).toBeVisible();
  await expect(desktop.spider).toHaveCSS("opacity", "1");
  const spawnTransform = await desktop.spider.evaluate((element) => element.style.transform);
  expect(spawnTransform).not.toBe("");
  await capture("motion-spider-spawn", "spider visible at seeded spawn between web threads");

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
  await capture("motion-spider-front-leg-hunt", "front legs L4/R4 probe beside the fangs while rear L1/R1 remain neutral");

  await advanceUntil(page, async () => {
    const transform = await desktop.spider.evaluate((element) => element.style.transform);
    return transform !== spawnTransform;
  }, "seeded spider route movement");
  await capture("motion-spider-route", "seeded route key state between web threads");

  await page.clock.runFor(2_500);
  const webOffsets = await desktop.web.locator("path").evaluateAll((paths) =>
    paths.map((path) => getComputedStyle(path).strokeDashoffset),
  );
  expect(webOffsets.every((value) => value === "0px" || value === "0")).toBe(true);
  await capture("motion-web-rest", "web draw completed; stable rest state");

  await advanceUntil(page, async () =>
    desktop.webPulses.evaluateAll((paths) => paths.some((path) => path.getAttribute("d"))),
  "footfall wave path emitted");
  await capture("motion-web-wave", "web wave emitted by a real spider footfall");

  await expect(desktop.assistantShell).not.toHaveClass(/is-speaking|is-offended|is-recovering/);
  await capture("motion-vivian-idle", "Vivian idle with no bubble or transient class");
  await desktop.assistant.click();
  await expect(desktop.assistantShell).toHaveClass(/is-speaking/);
  await expect(desktop.assistantShell.getByRole("status")).toBeVisible();
  await capture("motion-vivian-activity", "Vivian click activity with visible advice bubble");

  for (let index = 0; index < 4; index += 1) {
    await page.clock.runFor(1_000);
    await desktop.assistant.click();
  }
  await expect(desktop.assistantShell).toHaveClass(/is-offended/);
  await expect(desktop.assistant).toHaveAttribute("aria-disabled", "true");
  await capture("motion-vivian-offended", "Vivian offended state after sustained clicks");
  await page.clock.runFor(10_000);
  await expect(desktop.assistantShell).toHaveClass(/is-recovering/);
  await capture("motion-vivian-recovery", "Vivian recovery transition after offended cooldown");
  await page.clock.runFor(780);
  await expect(desktop.assistantShell).not.toHaveClass(/is-recovering|is-offended/);
});

test("[STAB-BASE-03] inventory motion surfaces that need dedicated actor/device evidence", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  for (const [id, state, blocker] of [
    ["motion-boot", "boot start, transition and complete", {
      reasonCode: "MOTION_CAPTURE_BOUNDARY_REQUIRED",
      recoveryPhase: 18,
      reason: "Current deterministic fixture intentionally skips the once-per-session boot; a dedicated isolated context is still required.",
    }],
    ["motion-wallpapers", "wallpaper movement and switching", {
      reasonCode: "MOTION_CAPTURE_BOUNDARY_REQUIRED",
      recoveryPhase: 18,
      reason: "Each wallpaper requires a separately mapped clock state; no blanket timer capture.",
    }],
    ["motion-window-lock", "window drag/resize and qualification lock", {
      reasonCode: "ISOLATED_PROMOTION_DATA_REQUIRED",
      recoveryPhase: 19,
      reason: "Qualification lock requires isolated participant fixtures.",
    }],
  ] as const) {
    await recordBlockedCandidate(context, {
      id,
      requirement: "STAB-BASE-03",
      surface: "Motion CURRENT",
      actor: id === "motion-window-lock" ? "participant" : "visitor",
      state,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    }, blocker);
  }
});
