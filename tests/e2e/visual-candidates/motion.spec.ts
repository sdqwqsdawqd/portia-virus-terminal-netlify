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

// The Phase 15 motion inventory (and its owner verdicts) exists for chromium-desktop only; hover and pointer-exit have no meaning on the phone projects.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Motion candidates are captured on chromium-desktop only.");
});

test("[STAB-BASE-03] capture shortcut start, key, interruption, end and rest frames", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  // The installed clock keeps ticking in real time; freeze it before load so slow screenshots cannot end the 700ms cycle early.
  await page.clock.pauseAt(new Date(Date.parse(determinism.now) + 5_000));
  await page.goto("/");
  // The desktop mounts from a 0ms timer; step the frozen clock until it is there.
  await expect(async () => {
    await page.clock.runFor(50);
    await expect(desktop.desktop).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 20_000 });
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

  // Approved cycle (18-MOTION-APPROVAL item 1): 560ms action, whole cycle <= 700ms (shortcutAnimationMs in portia-desktop-shortcuts.tsx).
  const cycleMs = 700;
  const keyMs = 280; // half of the 560ms action
  const boxes: Array<{ state: string; box: Awaited<ReturnType<typeof shortcut.boundingBox>> }> = [];
  const noteBox = async (state: string) => boxes.push({ state, box: await shortcut.boundingBox() });

  // A hover that lands before hydration is lost; leave and enter again until the cycle starts. The clock is not advanced here.
  await expect(async () => {
    await page.mouse.move(720, 450);
    await shortcut.hover();
    await expect(shortcut).toHaveClass(/is-icon-animating/, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await noteBox("start");
  await capture("motion-shortcut-start", "unified cycle 700ms; pointer exit does not cut the cycle; start at clock 0ms");
  await page.clock.runFor(keyMs);
  await noteBox("key");
  await capture("motion-shortcut-key", `unified cycle ${cycleMs}ms; pointer exit does not cut the cycle; key frame at clock ${keyMs}ms`);
  await page.mouse.move(720, 450);
  await expect(shortcut).toHaveClass(/is-icon-animating/);
  await noteBox("interruption");
  await capture("motion-shortcut-interruption", `unified cycle ${cycleMs}ms; pointer exit does not cut the cycle; pointer left at ${keyMs}ms, cycle continues`);
  await page.clock.runFor(cycleMs + 60 - keyMs);
  await expect(shortcut).not.toHaveClass(/is-icon-animating/);
  await noteBox("end");
  // animations "allow": the default "disabled" would fast-forward the cycle and hide a missing end == rest.
  const endShot = await shortcut.screenshot({ animations: "allow" });
  await capture("motion-shortcut-end", `unified cycle ${cycleMs}ms; pointer exit does not cut the cycle; end at clock ${cycleMs + 60}ms, class removed`);
  await page.clock.runFor(1_000);
  await noteBox("rest");
  const restShot = await shortcut.screenshot({ animations: "allow" });
  await capture("motion-shortcut-rest", "unified cycle 700ms; pointer exit does not cut the cycle; stable rest frame");

  // D-03: the shortcut frame never moves; D-02: the last frame is the rest frame, byte for byte.
  for (const { state, box } of boxes) expect(box, `bbox ${state}`).toEqual(boxes[0].box);
  expect(endShot.equals(restShot), "end frame equals rest frame").toBe(true);
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

  // D-08: a footfall sends waves along the threads on both sides of the body, so at least two are alive at once.
  const livePulses = () => desktop.webPulses.evaluateAll((paths) => paths.filter((path) => path.getAttribute("d")).length);
  await advanceUntil(page, async () => (await livePulses()) >= 2, "two footfall waves alive at once (both sides of the body)");
  expect(await livePulses()).toBeGreaterThanOrEqual(2);
  await capture("motion-web-wave", "two or more web waves alive at once after a real spider footfall (both sides of the body)");

  await expect(desktop.assistantShell).not.toHaveClass(/is-speaking|is-offended|is-recovering/);
  await capture("motion-vivian-idle", "Vivian idle with no bubble or transient class");
  await desktop.assistant.click();
  await expect(desktop.assistantShell).toHaveClass(/is-speaking/);
  await expect(desktop.assistantShell.getByRole("status")).toBeVisible();
  await capture("motion-vivian-activity", "Vivian click activity with visible advice bubble");

  // The patience (1-60s) is drawn from the seeded random, whose stream depends on how long the spider ran before; keep clicking once a second until she is offended.
  for (let index = 0; index < 62 && !/is-offended/.test((await desktop.assistantShell.getAttribute("class")) ?? ""); index += 1) {
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

const motionCapture = (context: Parameters<typeof captureCandidate>[0], testInfo: { project: { name: string } }, animations: "allow" | "disabled") =>
  (id: string, state: string) => captureCandidate(context, {
    id,
    requirement: "STAB-BASE-03",
    surface: "Motion CURRENT",
    actor: "visitor",
    state,
    intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    animations,
  });

async function setDesktopSetting(page: Page, patch: Record<string, string>) {
  await page.evaluate((next) => {
    const key = "portia-desktop-settings-v1";
    window.localStorage.setItem(key, JSON.stringify({ ...JSON.parse(window.localStorage.getItem(key) ?? "{}"), ...next }));
  }, patch);
}

test("[STAB-BASE-03] capture the boot screen start, transition and complete frames", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  // The determinism fixture marks the tab as boot-seen on every load; this later init script removes the mark so the boot plays once (D-06).
  await page.addInitScript(() => window.sessionStorage.removeItem("portia-boot-seen-v1"));
  await page.clock.pauseAt(new Date(Date.parse(determinism.now) + 1_000));
  await page.goto("/");
  const boot = page.locator(".boot-screen");
  await expect(boot).toBeVisible();
  const capture = motionCapture(context, testInfo, "allow");
  await capture("motion-boot-start", "boot screen at clock 0ms, motion on");
  await page.clock.runFor(800);
  await capture("motion-boot-transition", "boot screen mid-boot at clock 800ms, motion on");
  await page.clock.runFor(900);
  await expect(boot).toBeHidden();
  await desktop.desktop.waitFor();
  await capture("motion-boot-complete", "boot finished (1650ms): desktop visible, boot screen gone, motion on");

  // D-12: under «Уменьшены» and «Выключены» the boot screen is never visible, not even at 0ms.
  for (const motion of ["reduced", "off"]) {
    await setDesktopSetting(page, { motion });
    await page.reload();
    await expect(boot, `.boot-screen under motion ${motion}`).toBeHidden();
  }
});

test("[STAB-BASE-03] capture each wallpaper at rest and the instant switch under motion off", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  const capture = motionCapture(context, testInfo, "disabled");
  for (const kind of ["radar", "grid", "gel", "cells", "quiet"]) {
    await setDesktopSetting(page, { wallpaper: kind, motion: "on" });
    await page.reload();
    await desktop.desktop.waitFor();
    await capture(`motion-wallpapers-${kind}`, `wallpaper ${kind} at rest (animations frozen at the start state), motion on`);
  }

  // Under «Выключены» the incoming layer shows at once instead of fading in over 500ms.
  await setDesktopSetting(page, { wallpaper: "radar", motion: "off" });
  await page.reload();
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Фон рабочего стола", "Гель");
  await expect(page.locator(".wallpaper-layer").last()).toHaveCSS("opacity", "1");
});

test("[STAB-BASE-03] inventory motion surfaces that need dedicated actor/device evidence", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await recordBlockedCandidate(context, {
    id: "motion-window-lock",
    requirement: "STAB-BASE-03",
    surface: "Motion CURRENT",
    actor: "participant",
    state: "window drag/resize and qualification lock",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/motion-window-lock--${testInfo.project.name}.png`,
  }, {
    reasonCode: "ISOLATED_PROMOTION_DATA_REQUIRED",
    recoveryPhase: 19,
    reason: "Qualification lock requires isolated participant fixtures.",
  });
});
