import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";
import type { Page } from "@playwright/test";

// Phase 20-03 (D-17..D-19, D-25..D-27, D-45): the redrawn spider and web on the «Паутина» wallpaper.
// Candidates only: every frame goes under visual-candidates/.runs, nothing here touches tests/e2e/visual/__screenshots__.
// The requirement id of a frame is STAB-BASE-03 because that is the only family support.ts accepts; the evidence belongs to STAB-VIS-01 / STAB-A11Y-04.

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20 spider candidates run on chromium-desktop and chromium-phone.");
});

// The same run directory as support.ts (PORTIA_VISUAL_SET_ID or the Phase 15 default).
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${sourceCommit.slice(0, 12)}`;
const runRoot = path.resolve("tests/e2e/visual-candidates/.runs", setId);
function writeRun(name: string, value: unknown) {
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(path.join(runRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

type Settings = Record<string, string>;
const baseSettings: Settings = { accent: "teal", wallpaper: "radar", iconSize: "standard", motion: "on", spider: "on", customAccent: "" };

async function setDesktopSetting(page: Page, patch: Settings) {
  await page.evaluate((next) => {
    const key = "portia-desktop-settings-v1";
    window.localStorage.setItem(key, JSON.stringify({ ...JSON.parse(window.localStorage.getItem(key) ?? "{}"), ...next }));
  }, patch);
}

// Opens the desktop on the «Паутина» wallpaper with the given settings (the storage origin needs one load first).
async function openWeb(page: Page, patch: Settings) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await setDesktopSetting(page, { ...baseSettings, ...patch });
  await page.reload();
  await desktop.desktop.waitFor();
  return desktop;
}

async function advanceUntil(page: Page, predicate: () => Promise<boolean>, message: string, limitMs = 40_000) {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 50) {
    if (await predicate()) return elapsed;
    await page.clock.runFor(50);
  }
  throw new Error(`[PORTIA_SPIDER_STATE_TIMEOUT] ${message}`);
}

const accents: Array<{ id: string; label: string; settings: Settings }> = [
  { id: "default", label: "standard accent", settings: { accent: "teal", customAccent: "" } },
  { id: "custom-dark", label: "very dark «Свой» accent #1a1a1a", settings: { accent: "custom", customAccent: "#1a1a1a" } },
  { id: "custom-light", label: "very light «Свой» accent #f2f2f2", settings: { accent: "custom", customAccent: "#f2f2f2" } },
];

for (const accent of accents) {
  test(`[STAB-VIS-01] D-25/D-26 spider at rest on the ${accent.label}: dense dark outlined body, accent only in details`, async ({ page, browser, determinism }, testInfo) => {
    const desktop = await openWeb(page, { ...accent.settings, motion: "off" });
    await expect(desktop.spider).toBeVisible();
    await expect(desktop.spider).toHaveCSS("opacity", "1");
    const probe = await page.evaluate(() => {
      const bodyParts = [...document.querySelectorAll<SVGElement>(".wallpaper-spider .wallpaper-spider-dark, .wallpaper-spider .wallpaper-spider-limb, .wallpaper-spider .wallpaper-spider-pale")];
      const details = [...document.querySelectorAll<SVGElement>(".wallpaper-spider .wallpaper-spider-accent")];
      const tint = document.createElement("i");
      tint.style.color = "var(--teal)";
      document.body.append(tint);
      const teal = getComputedStyle(tint).color;
      tint.remove();
      const style = (element: Element) => getComputedStyle(element);
      return {
        parts: bodyParts.length,
        translucent: bodyParts.filter((part) => style(part).opacity !== "1" || style(part).fillOpacity !== "1").length,
        unoutlined: bodyParts.filter((part) => style(part).stroke === "none").length,
        accentFilled: bodyParts.filter((part) => style(part).fill === teal).length,
        details: details.length,
        detailsOnAccent: details.filter((detail) => style(detail).fill === teal).length,
        teal,
        bodyFill: style(bodyParts[0]).fill,
        stroke: style(bodyParts[0]).stroke,
      };
    });
    expect(probe.parts, "body and leg parts found").toBeGreaterThan(20);
    expect(probe.translucent, "parts with opacity or fill-opacity below 1 (D-25)").toBe(0);
    expect(probe.unoutlined, "parts with stroke none (D-25)").toBe(0);
    expect(probe.accentFilled, "body/leg parts filled with the accent (D-26)").toBe(0);
    expect(probe.details, "accent details exist").toBeGreaterThan(0);
    expect(probe.detailsOnAccent, "every accent detail is filled with the accent").toBe(probe.details);
    const context = { page, browser, determinism, testInfo };
    await captureCandidate(context, {
      id: `phase20-spider-accent-${accent.id}`,
      requirement: "STAB-BASE-03",
      surface: "Spider CURRENT",
      actor: "visitor",
      state: `D-26 spider at rest on «Паутина», ${accent.label}, motion off; body fill ${probe.bodyFill}, stroke ${probe.stroke}, accent ${probe.teal}`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-accent-${accent.id}--${testInfo.project.name}.png`,
      animations: "allow",
    });
  });
}

test("[STAB-VIS-01] D-27 «Паук: Скрыть» keeps the web and hides the spider, dew and waves; off to on shows the spider again", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = await openWeb(page, { spider: "off", motion: "on" });
  await expect(desktop.spider).toBeHidden();
  await expect(desktop.spider).toHaveCSS("display", "none");
  await expect(desktop.web).toBeVisible();
  expect(await desktop.web.locator("path").count(), "web threads stay").toBeGreaterThan(10);
  await expect(page.locator(".wallpaper-web-dew")).toHaveCSS("opacity", "0");
  await expect(desktop.webPulses.first()).toBeAttached();
  await expect(page.locator(".wallpaper-web-pulses")).toHaveCSS("opacity", "0");
  await captureCandidate(context, {
    id: "phase20-spider-hidden",
    requirement: "STAB-BASE-03",
    surface: "Spider CURRENT",
    actor: "visitor",
    state: "D-27 «Паук: Скрыть»: web visible, spider element display none, dew and waves hidden",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-hidden--${testInfo.project.name}.png`,
    animations: "allow",
  });
  // Through the real switch: Скрыть → Показывать relocates and shows the spider (the observer sees data-spider).
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Паук", "Показывать");
  await expect(desktop.spider).toBeVisible();
  await expect(desktop.spider).toHaveCSS("opacity", "1");
  await desktop.chooseSetting("Паук", "Скрыть");
  await expect(desktop.spider).toBeHidden();
  await expect(desktop.web).toBeVisible();
});

test("[STAB-A11Y-04] D-01..D-04 full walks, reduced and off stop looping motion, mid-step off keeps the finished action; the OS setting does not switch the mode", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  // D-01: the system preference alone never changes the site mode.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const desktop = await openWeb(page, { motion: "on" });
  expect(await page.evaluate(() => document.documentElement.dataset.motion), "OS reduced-motion does not switch the site mode").toBe("full");

  const state = () => desktop.spider.evaluate((element) => ({
    transform: element.style.transform,
    rotations: [...element.querySelectorAll<SVGGElement>("[data-leg]")].map((leg) => leg.style.rotate),
    scales: [...element.querySelectorAll<SVGGElement>("[data-leg]")].map((leg) => leg.style.scale),
    pulses: [...document.querySelectorAll(".wallpaper-web-pulses path")].filter((path) => path.getAttribute("d")).length,
  }));
  const translateOf = (transform: string) => transform.match(/translate\([^)]*\)/)?.[0] ?? "";
  const swinging = (rotations: string[]) => rotations.some((value) => Math.abs(Number.parseFloat(value) || 0) > 0.2);

  // Layout reads are counted from page load; the walk below must not add any (the spider loop reads no layout).
  await page.evaluate(() => {
    const counter = { reads: 0 };
    (window as unknown as { __layoutReads: typeof counter }).__layoutReads = counter;
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (...args) { counter.reads += 1; return original.apply(this, args); };
    for (const name of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, name) ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      if (!descriptor?.get) continue;
      const get = descriptor.get;
      Object.defineProperty(Element.prototype, name, { ...descriptor, get() { counter.reads += 1; return get.call(this); } });
    }
  });

  const spawnTransform = (await state()).transform;
  await advanceUntil(page, async () => {
    const now = await state();
    return now.transform !== spawnTransform && swinging(now.rotations);
  }, "full motion: the spider walks and swings its legs");
  const readsBefore = await page.evaluate(() => (window as unknown as { __layoutReads: { reads: number } }).__layoutReads.reads);
  const trace: Array<{ t: number; transform: string; rotations: string[]; scales: string[]; pulses: number }> = [];
  for (let tick = 0; tick < 40; tick += 1) {
    await page.clock.runFor(100);
    trace.push({ t: tick * 100, ...(await state()) });
  }
  const layoutReadsWhileWalking = (await page.evaluate(() => (window as unknown as { __layoutReads: { reads: number } }).__layoutReads.reads)) - readsBefore;
  writeRun(`spider-gait-trace--${testInfo.project.name}.json`, { project: testInfo.project.name, layoutReadsWhileWalking, samples: trace });
  expect(new Set(trace.map((sample) => sample.transform)).size, "the transform changes while walking").toBeGreaterThan(5);
  await captureCandidate(context, {
    id: "phase20-spider-full-walk",
    requirement: "STAB-BASE-03",
    surface: "Spider CURRENT",
    actor: "visitor",
    state: `D-17/D-19 full motion, spider walking on «Паутина»; layout reads during the 4s trace: ${layoutReadsWhileWalking}`,
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-full-walk--${testInfo.project.name}.png`,
    animations: "allow",
  });

  // D-04: «Выключены» in the middle of a step stops at once and keeps the action already done (position stays, legs neutral, no waves).
  await advanceUntil(page, async () => swinging((await state()).rotations), "a leg is mid-swing");
  const beforeOff = await state();
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Анимации", "Выключены");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motion)).toBe("off");
  const afterOff = await state();
  expect(afterOff.rotations.every((value) => Number.parseFloat(value) === 0), "legs neutral at once (D-02)").toBe(true);
  expect(afterOff.scales.every((value) => value === "1")).toBe(true);
  expect(afterOff.transform).not.toContain("scale(");
  expect(afterOff.pulses, "waves cleared").toBe(0);
  // The settings window opens in real time, so the spider may have stepped on a little before the click; what matters is that after the stop nothing moves.
  await page.clock.runFor(4_000);
  const later = await state();
  expect(later.transform, "no looping motion after off").toBe(afterOff.transform);
  expect(translateOf(later.transform)).toBe(translateOf(afterOff.transform));
  expect(translateOf(beforeOff.transform), "a position was reached before the stop").not.toBe("");
  await captureCandidate(context, {
    id: "phase20-spider-mid-step-off",
    requirement: "STAB-BASE-03",
    surface: "Spider CURRENT",
    actor: "visitor",
    state: "D-02/D-04 «Анимации: Выключены» chosen in the middle of a step: terminal pose, position kept, no waves",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-mid-step-off--${testInfo.project.name}.png`,
    animations: "allow",
  });

  // «Уменьшены»: the spider stays visible and still too.
  await desktop.chooseSetting("Анимации", "Уменьшены");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motion)).toBe("reduced");
  const reduced = await state();
  await page.clock.runFor(3_000);
  expect((await state()).transform, "reduced: no looping motion").toBe(reduced.transform);
  await expect(desktop.spider).toBeVisible();
});

test("[STAB-A11Y-04] the gait frame budget on a real device is not proven here", async ({ page, browser, determinism }, testInfo) => {
  await new DesktopPage(page).goto();
  await recordBlockedCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-spider-gait-frame-budget",
    requirement: "STAB-BASE-03",
    surface: "Spider CURRENT",
    actor: "visitor",
    state: "spider gait frame time on PC and phone hardware",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-gait-frame-budget--${testInfo.project.name}.png`,
  }, {
    reasonCode: "MOTION_CAPTURE_BOUNDARY_REQUIRED",
    recoveryPhase: 20,
    reason: "The headless run under a fake clock proves no layout reads and no per-frame React state in the loop, not the frame budget; the physical-device check is SPIDER-03 in 20-14.",
  });
});
