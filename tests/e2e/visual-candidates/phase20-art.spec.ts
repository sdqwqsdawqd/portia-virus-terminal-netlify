import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // The tests below run the fake clock ahead by seconds; a /api/content answer still in flight would then hit the app's own load timeout
  // and abort (ERR_ABORTED is an unexpected runtime event). The first load finishes in real time before the clock moves.
  await page.waitForLoadState("networkidle");
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

// D-53 (20-37) replaces the D-50 S1-А probe (light rim on nine layers, rim contrast >= 3:1): the spider has no rim and no white inside the
// legs (owner clarification 2026-11-07). The probe checks the colours of the parts, the missing rim layer, the missing stroke, and measures
// pixels: with the body group hidden, the brightest point of the spider at rest is not brighter than the strand (--teal) plus 0.05.
for (const accent of accents) {
  test(`[STAB-VIS-01] D-53 (20-37) spider at rest on the ${accent.label}: white body, black parts, accent strand, no rim, no white inside the legs`, async ({ page, browser, determinism }, testInfo) => {
    const desktop = await openWeb(page, { ...accent.settings, motion: "off" });
    await expect(desktop.spider).toBeVisible();
    await expect(desktop.spider).toHaveCSS("opacity", "1");
    const probe = await page.evaluate(() => {
      const all = (selector: string) => [...document.querySelectorAll<SVGElement>(selector)];
      const bodyParts = all(".wallpaper-spider .wallpaper-spider-dark, .wallpaper-spider .wallpaper-spider-limb, .wallpaper-spider .wallpaper-spider-pale");
      const tint = document.createElement("i");
      tint.style.color = "var(--teal)";
      tint.style.backgroundColor = "var(--desktop-base)";
      document.body.append(tint);
      const teal = getComputedStyle(tint).color;
      const desktopBase = getComputedStyle(tint).backgroundColor;
      tint.remove();
      const style = (element: Element) => getComputedStyle(element);
      const hasStroke = (element: Element) => style(element).stroke !== "none" && Number.parseFloat(style(element).strokeWidth) > 0;
      return {
        legs: all(".wallpaper-spider [data-leg]").length,
        parts: bodyParts.length,
        translucent: bodyParts.filter((part) => style(part).opacity !== "1" || style(part).fillOpacity !== "1").length,
        staticStroke: bodyParts.filter(hasStroke).length,
        anyStroke: all(".wallpaper-spider *").filter(hasStroke).length,
        filtered: all(".wallpaper-spider, .wallpaper-spider *").filter((part) => style(part).filter !== "none").length,
        teal,
        desktopBase,
        paleFills: all(".wallpaper-spider-pale").map((part) => style(part).fill),
        palePlacedInLegs: all(".wallpaper-spider [data-leg] .wallpaper-spider-pale").length,
        darkFills: all(".wallpaper-spider-dark").map((part) => style(part).fill),
        limbFills: all(".wallpaper-spider-limb").map((part) => style(part).fill),
        eyes: all(".wallpaper-spider-body circle").map((eye) => style(eye).fill),
        accentPupils: all(".wallpaper-spider-accent").length,
        rimLayers: all(".wallpaper-spider-kant").length,
      };
    });
    const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const linear = (channel: number) => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
    const luminance = (value: string) => channels(value).reduce((sum, channel, index) => sum + linear(channel) * [.2126, .7152, .0722][index], 0);
    expect(probe.legs, "eight [data-leg] groups L1-L4, R1-R4").toBe(8);
    expect(probe.parts, "body and leg parts found").toBeGreaterThan(20);
    expect(probe.translucent, "parts with opacity or fill-opacity below 1 (D-25)").toBe(0);
    expect(probe.rimLayers, "no rim layer anywhere (D-53)").toBe(0);
    expect(probe.staticStroke, "the parts carry no stroke (D-53)").toBe(0);
    expect(probe.anyStroke, "nothing in the spider carries a stroke (D-53)").toBe(0);
    expect(probe.filtered, "no filter, blur, shadow or glow on the spider (D-45, D-53)").toBe(0);
    expect(probe.accentPupils, "no accent pupils over the eyes (D-50)").toBe(0);
    expect(probe.paleFills.length, "pale parts: head, eye plate, two fangs").toBeGreaterThan(0);
    expect(probe.palePlacedInLegs, "no white part inside any leg group (D-53)").toBe(0);
    for (const fill of probe.paleFills) expect(luminance(fill), `body fill ${fill} is white`).toBeGreaterThan(0.9);
    expect(probe.darkFills.length, "black parts found").toBeGreaterThan(8);
    for (const fill of probe.darkFills) expect(luminance(fill), `black part ${fill} is near-black`).toBeLessThan(0.01);
    expect(probe.limbFills.length, "second strands found").toBeGreaterThan(8);
    for (const fill of probe.limbFills) expect(fill, "the second strand is the accent (D-50 S2-А, D-53)").toBe(probe.teal);
    expect(probe.eyes.length, "four black eyes").toBe(4);
    for (const fill of probe.eyes) expect(luminance(fill), `eye ${fill} is black`).toBeLessThan(0.01);

    // Pixel probe (D-53): hide the white body for the measurement only, shoot the spider element and read every pixel with alpha above 0.5.
    // Shortcut labels and the assistant are page furniture drawn above the wallpaper (on a phone the label «Таблица» sits over the resting spider); they are hidden for the measurement too, so only the legs are read.
    // What is left is the legs over the desktop: black parts, the accent strand and the transparent gaps. Nothing may be brighter than the strand.
    const hideFurniture = await page.addStyleTag({ content: ".desktop-icons, .desktop-assistant { visibility: hidden !important; }" });
    // The crop with the body is kept for the by-eye comparison with the sample (logo-check), ×4 and the sample raster are made by the run notes.
    const cropDir = path.join(runRoot, "logo-check");
    mkdirSync(cropDir, { recursive: true });
    writeFileSync(path.join(cropDir, `spider-crop-${accent.id}--${testInfo.project.name}.png`), await desktop.spider.screenshot({ type: "png" }));
    const hideBody = await page.addStyleTag({ content: ".wallpaper-spider-body { visibility: hidden !important; }" });
    const shot = await desktop.spider.screenshot({ type: "png" });
    await hideBody.evaluate((node) => (node as Element).remove());
    await hideFurniture.evaluate((node) => (node as Element).remove());
    const decoder = await browser.newPage();
    let pixels: { max: number; at: [number, number]; rgb: number[]; counted: number; width: number; height: number };
    try {
      pixels = await decoder.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const lin = (channel: number) => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
        let max = -1, counted = 0, at: [number, number] = [0, 0], rgb = [0, 0, 0];
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] / 255 <= 0.5) continue;
          counted += 1;
          const value = lin(data[index]) * .2126 + lin(data[index + 1]) * .7152 + lin(data[index + 2]) * .0722;
          if (value > max) { max = value; rgb = [data[index], data[index + 1], data[index + 2]]; at = [(index / 4) % canvas.width, Math.floor(index / 4 / canvas.width)]; }
        }
        return { max, at, rgb, counted, width: canvas.width, height: canvas.height };
      }, shot.toString("base64"));
    } finally {
      await decoder.close();
    }
    const tealLuminance = luminance(probe.teal);
    writeRun(`spider-legs-luma-${accent.id}--${testInfo.project.name}.json`, {
      accent: accent.id,
      project: testInfo.project.name,
      decision: "D-53 (20-37): body group hidden, brightest legs pixel not brighter than --teal + 0.05",
      teal: probe.teal,
      tealLuminance,
      threshold: tealLuminance + 0.05,
      maxLuminance: pixels.max,
      brightestAt: pixels.at,
      brightestRgb: pixels.rgb,
      pixelsCounted: pixels.counted,
      size: [pixels.width, pixels.height],
    });
    expect(pixels.counted, "the spider element was captured").toBeGreaterThan(0);
    expect(pixels.max, `brightest legs pixel rgb(${pixels.rgb.join(", ")}) at ${pixels.at.join(",")} against --teal ${probe.teal}: no light rim, no white inside the legs`).toBeLessThanOrEqual(tealLuminance + 0.05);

    const context = { page, browser, determinism, testInfo };
    await captureCandidate(context, {
      id: `phase20-spider-accent-${accent.id}`,
      requirement: "STAB-BASE-03",
      surface: "Spider CURRENT",
      actor: "visitor",
      state: `D-53 spider at rest on «Паутина», ${accent.label}, motion off; body fill ${probe.paleFills[0]}, no rim, no white inside the legs, strand ${probe.teal}`,
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

test("[STAB-A11Y-04] D-01..D-04 full walks, reduced and off stop looping motion, mid-step off keeps the finished action; the OS setting does not switch the mode", async ({ page, browser, determinism, diagnostics }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  // The walk below runs the fake clock tens of seconds ahead. The site polls /api/content every 10 s; a poll whose real answer is still in flight
  // then reaches the app's own fetch timeout on the fake clock and is aborted. The page itself is correct; the abort comes from the test's clock.
  diagnostics.expectFault({ kind: "requestfailed", source: "fetch", text: /^GET \[url-redacted\] net::ERR_ABORTED$/, reason: "a content poll in flight hits the app's fetch timeout while the test runs the fake clock ahead" });
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
  await expect(desktop.spider, "D-45: the compositor layer exists while walking").toHaveAttribute("data-spider-walking", "");
  const readsBefore = await page.evaluate(() => (window as unknown as { __layoutReads: { reads: number } }).__layoutReads.reads);
  const trace: Array<{ t: number; transform: string; rotations: string[]; scales: string[]; pulses: number }> = [];
  for (let tick = 0; tick < 40; tick += 1) {
    await page.clock.runFor(100);
    trace.push({ t: tick * 100, ...(await state()) });
  }
  const layoutReadsWhileWalking = (await page.evaluate(() => (window as unknown as { __layoutReads: { reads: number } }).__layoutReads.reads)) - readsBefore;
  // D-53 (20-37, plan 20-41): all eight legs step and every footfall waves the web. A sample counts as walking when the transform moved since the
  // previous sample and a leg is still swung; the range of a leg is its largest minus its smallest rotation over those samples.
  const legNames = await desktop.spider.evaluate((element) => [...element.querySelectorAll<SVGGElement>("[data-leg]")].map((leg) => leg.dataset.leg ?? ""));
  const walkingSamples = trace.filter((sample, index) => index > 0 && sample.transform !== trace[index - 1].transform && swinging(sample.rotations));
  const legRanges = legNames.map((leg, column) => {
    const values = walkingSamples.map((sample) => Number.parseFloat(sample.rotations[column]) || 0);
    return { leg, range: values.length ? Math.max(...values) - Math.min(...values) : 0 };
  });
  const waveShare = walkingSamples.length ? walkingSamples.filter((sample) => sample.pulses > 0).length / walkingSamples.length : 0;
  writeRun(`spider-gait-trace--${testInfo.project.name}.json`, { project: testInfo.project.name, layoutReadsWhileWalking, walkingSamples: walkingSamples.length, legRanges, waveShare, samples: trace });
  expect(new Set(trace.map((sample) => sample.transform)).size, "the transform changes while walking").toBeGreaterThan(5);
  expect(walkingSamples.length, "enough of the 4 s trace is walking to judge the gait").toBeGreaterThanOrEqual(12);
  expect(legNames.length, "eight legs").toBe(8);
  for (const { leg, range } of legRanges) expect(range, `D-53: leg ${leg} swings at least 8 degrees over the walk (${range.toFixed(1)})`).toBeGreaterThanOrEqual(8);
  expect(waveShare, `D-53: waves are visible in at least 90% of the walking samples (${(waveShare * 100).toFixed(0)}%)`).toBeGreaterThanOrEqual(0.9);
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
  await expect(desktop.spider, "D-45: no layer once stopped").not.toHaveAttribute("data-spider-walking", /.*/);
  expect(await desktop.spider.evaluate((element) => getComputedStyle(element).willChange), "no will-change at rest").toBe("auto");
  expect(afterOff.pulses, "waves cleared").toBe(0);
  // The settings window opens in real time, so the spider may have stepped on a little before the click; what matters is that after the stop nothing moves.
  await page.clock.runFor(4_000);
  const later = await state();
  expect(later.transform, "no looping motion after off").toBe(afterOff.transform);
  expect(translateOf(later.transform)).toBe(translateOf(afterOff.transform));
  expect(translateOf(beforeOff.transform), "a position was reached before the stop").not.toBe("");
  // The frame shows the spider in its terminal pose. On a phone the Settings window is maximised and covers the whole desktop, so it is closed
  // before the capture (the mode stays off) and opened again for the next step. Nothing may cover the spider in the frame.
  await desktop.closeApp("Настройки");
  await expect(async () => {
    await page.clock.runFor(100);
    await expect(desktop.window("Настройки")).toBeHidden({ timeout: 250 });
  }).toPass({ timeout: 10_000 });
  await expect(desktop.spider).toBeVisible();
  const coveredBy = await desktop.spider.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    return document.elementsFromPoint(x, y).filter((candidate) => candidate.closest(".app-window")).map((candidate) => candidate.className.toString());
  });
  expect(coveredBy, "no window covers the spider in the frame").toEqual([]);
  expect((await state()).transform, "closing Settings does not move the spider").toBe(afterOff.transform);
  await captureCandidate(context, {
    id: "phase20-spider-mid-step-off",
    requirement: "STAB-BASE-03",
    surface: "Spider CURRENT",
    actor: "visitor",
    state: "D-02/D-04 «Анимации: Выключены» chosen in the middle of a step: terminal pose, position kept, no waves; the Settings window is closed so the spider is in view",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-mid-step-off--${testInfo.project.name}.png`,
    animations: "allow",
  });

  // «Уменьшены»: the spider stays visible and still too.
  await desktop.openApp("Настройки");
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

// D-45: the spider at rest must not be blurred. The sharpness of the live element (mean absolute discrete Laplacian of the luminance, in the
// page) is compared with a reference: the same SVG in a motionless container, no CSS transform / translate / will-change, rotated by an SVG
// attribute so the rotation happens before rasterisation. Factors are then switched one at a time by a style override on the live element.
// The last three put the old causes back on the fixed build (will-change: transform, a forwards-filled animation) to show which one blurs.
const REST_FACTORS = ["as-is", "will-change-auto", "transform-snapped", "no-scale", "translate-snapped", "all", "regress-will-change", "regress-fill", "regress-both"] as const;
type SharpnessRow = { project: string; state: string; factor: string; sharpness: number; reference: number; ratio: number; dpr: number; transform: string };

// Rows of both projects land in one file; a lock directory keeps two workers from overwriting each other.
function mergeSharpnessRows(rows: SharpnessRow[]) {
  mkdirSync(runRoot, { recursive: true });
  const lock = path.join(runRoot, ".spider-rest-sharpness.lock");
  for (let attempt = 0; ; attempt += 1) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (attempt > 200) throw new Error("[PORTIA_SPIDER_REST_LOCK_TIMEOUT]");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    const file = path.join(runRoot, "spider-rest-sharpness.json");
    const existing: SharpnessRow[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
    const keep = existing.filter((row) => !rows.some((next) => next.project === row.project && next.state === row.state));
    writeFileSync(file, `${JSON.stringify([...keep, ...rows], null, 2)}\n`);
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

async function openStill(page: Page, patch: Settings) {
  const settings = { ...baseSettings, ...patch };
  await page.addInitScript((value) => window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(value)), settings);
  // The loop is driven by the paused clock, so the spider stands exactly where the test leaves it.
  await page.clock.pauseAt(new Date(Date.parse("2026-10-30T09:00:00+03:00") + 5_000));
  await page.goto("/");
  const desktop = new DesktopPage(page);
  await expect(async () => {
    await page.clock.runFor(50);
    await expect(desktop.desktop).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 20_000 });
  return desktop;
}

async function sharpnessOf(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const luma = new Float64Array(width * height);
    for (let index = 0; index < luma.length; index += 1) luma[index] = 0.2126 * data[index * 4] + 0.7152 * data[index * 4 + 1] + 0.0722 * data[index * 4 + 2];
    let sum = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const at = y * width + x;
        sum += Math.abs(luma[at - 1] + luma[at + 1] + luma[at - width] + luma[at + width] - 4 * luma[at]);
      }
    }
    return sum / ((width - 2) * (height - 2));
  }, png.toString("base64"));
}

async function measureRest(page: Page, state: string, projectName: string): Promise<SharpnessRow[]> {
  // Park the page for the measurement: no web, waves, dew, icons or Vivian behind the spider, and a marker at the transform origin.
  const setup = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".wallpaper-spider")!;
    const marker = document.createElement("span");
    marker.dataset.spiderOrigin = "1";
    marker.style.cssText = "position:absolute;left:50%;top:46.875%;width:0;height:0;";
    element.append(marker);
    const park = document.createElement("style");
    park.dataset.spiderPark = "1";
    park.textContent = ".desktop-wallpaper, .wallpaper-web-pulses, .desktop-icon, .desktop-assistant { visibility: hidden !important; }";
    document.head.append(park);
    return { dpr: window.devicePixelRatio, width: parseFloat(getComputedStyle(element).width) };
  });
  const side = Math.ceil(setup.width * 1.8);
  const clipAt = async () => {
    const origin = await page.evaluate(() => {
      const rect = document.querySelector<HTMLElement>("[data-spider-origin]")!.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    return { x: Math.round(origin.x) - Math.round(side / 2), y: Math.round(origin.y) - Math.round(side / 2), width: side, height: side };
  };
  const clip = await clipAt();
  const settle = () => page.waitForTimeout(200);

  // Reference: the same artwork, motionless and unrotated by CSS, centred on the same (integer) origin pixel.
  const inline = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".wallpaper-spider")!;
    return { transform: element.style.transform, cssText: element.style.cssText };
  });
  const angle = Number.parseFloat(inline.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? "0");
  await page.evaluate(({ degrees, region }) => {
    const element = document.querySelector<HTMLElement>(".wallpaper-spider")!;
    const copy = document.createElement("div");
    copy.className = "wallpaper-spider";
    copy.dataset.spiderReference = "1";
    const clone = element.querySelector("svg")!.cloneNode(true) as SVGSVGElement;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("transform", `rotate(${degrees} 324.75 360)`);
    group.append(...Array.from(clone.childNodes));
    clone.append(group);
    copy.append(clone);
    const width = parseFloat(getComputedStyle(element).width);
    const height = (width * 768) / 649.5;
    const origin = { x: region.x + region.width / 2, y: region.y + region.height / 2 };
    copy.style.cssText = `position:fixed;left:${origin.x - width / 2}px;top:${origin.y - height * 0.46875}px;width:${width}px;translate:none;transform:none;will-change:auto;animation:none;opacity:1;z-index:99999;`;
    document.body.append(copy);
    element.style.visibility = "hidden";
  }, { degrees: angle, region: clip });
  await settle();
  const reference = await sharpnessOf(page, await page.screenshot({ clip, animations: "allow" }));
  await page.evaluate(() => {
    document.querySelector("[data-spider-reference]")?.remove();
    document.querySelector<HTMLElement>(".wallpaper-spider")!.style.visibility = "";
  });

  const rows: SharpnessRow[] = [];
  for (const factor of REST_FACTORS) {
    await page.evaluate(({ name, dpr }) => {
      const element = document.querySelector<HTMLElement>(".wallpaper-spider")!;
      const snap = (value: number) => Math.round(value * dpr) / dpr;
      if (name === "will-change-auto" || name === "all") element.style.willChange = "auto";
      if (name === "regress-will-change" || name === "regress-both") element.style.willChange = "transform";
      if (name === "regress-fill" || name === "regress-both") element.style.animation = "fade-in 600ms ease-out 0s both";
      if (name === "transform-snapped" || name === "all") {
        element.style.transform = element.style.transform.replace(/translate\(([-\d.]+)px, ([-\d.]+)px\)/, (_, x, y) => `translate(${snap(Number(x))}px, ${snap(Number(y))}px)`);
      }
      if (name === "no-scale" || name === "all") element.style.transform = element.style.transform.replace(/\s*scale\([^)]*\)/, "");
      if (name === "translate-snapped" || name === "all") {
        const style = getComputedStyle(element);
        const width = parseFloat(style.width), height = parseFloat(style.height);
        element.style.translate = `${snap(-0.5 * width)}px ${snap(-0.46875 * height)}px`;
        element.style.left = `${snap(parseFloat(style.left))}px`;
        element.style.top = `${snap(parseFloat(style.top))}px`;
      }
    }, { name: factor, dpr: setup.dpr });
    await settle();
    if (factor === "regress-fill" || factor === "regress-both") await page.waitForTimeout(700); // the 600ms fade-in is a real-time CSS animation
    const live = await clipAt();
    const transform = await page.evaluate(() => document.querySelector<HTMLElement>(".wallpaper-spider")!.style.transform);
    const sharpness = await sharpnessOf(page, await page.screenshot({ clip: live, animations: "allow" }));
    rows.push({ project: projectName, state, factor, sharpness, reference, ratio: reference > 0 ? sharpness / reference : 0, dpr: setup.dpr, transform });
    await page.evaluate((css) => { document.querySelector<HTMLElement>(".wallpaper-spider")!.style.cssText = css; }, inline.cssText);
  }
  await page.evaluate(() => {
    document.querySelector("[data-spider-origin]")?.remove();
    document.querySelector("[data-spider-park]")?.remove();
  });
  return rows;
}

for (const rest of [{ id: "off", label: "motion off", motion: "off" }, { id: "full", label: "full motion, standing", motion: "on" }]) {
  test(`[STAB-VIS-01] D-45 spider at rest (${rest.label}): sharpness against the unmoved reference, factor by factor`, async ({ page, browser, determinism }, testInfo) => {
    const desktop = await openStill(page, { motion: rest.motion });
    await page.clock.runFor(3_000);
    await page.waitForTimeout(2_800); // the 600ms fade-in (1.8s delay) is a real-time CSS animation
    await expect(desktop.spider).toHaveCSS("opacity", "1");
    if (rest.motion === "on") {
      // Standing: the inline transform has not changed for a second of loop time.
      let unchanged = 0, previous = "";
      for (let elapsed = 0; unchanged < 1_000 && elapsed <= 90_000; elapsed += 100) {
        await page.clock.runFor(100);
        const current = await desktop.spider.evaluate((element) => element.style.transform);
        unchanged = current === previous ? unchanged + 100 : 0;
        previous = current;
      }
      expect(unchanged, "the spider stands (style.transform unchanged for 1s)").toBeGreaterThanOrEqual(1_000);
    }
    await captureCandidate({ page, browser, determinism, testInfo }, {
      id: `phase20-spider-rest-${rest.id}`,
      requirement: "STAB-BASE-03",
      surface: "Spider CURRENT",
      actor: "visitor",
      state: `D-45 spider at rest, ${rest.label}; transform ${await desktop.spider.evaluate((element) => element.style.transform)}`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-spider-rest-${rest.id}--${testInfo.project.name}.png`,
      animations: "allow",
    });
    const rows = await measureRest(page, rest.id, testInfo.project.name);
    mergeSharpnessRows(rows);
    for (const row of rows) testInfo.annotations.push({ type: "sharpness", description: `${row.state}/${row.factor}: ${row.ratio.toFixed(3)}` });
    expect(rows.find((row) => row.factor === "as-is")!.reference, "the reference has edges to measure").toBeGreaterThan(0);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Phase 20-04 (D-22, D-01..D-04, UI-SPEC E1/E2): the «Лабораторные колбы» wallpaper.
// Candidates only; the budget of a frame on PC / phone hardware is recorded BLOCKED (no approved budget, no device).
// ---------------------------------------------------------------------------------------------------------------------

const oldWallpapers: Array<[string, string]> = [["radar", "Паутина"], ["grid", "Спирали ДНК"], ["gel", "Гель"], ["cells", "Клетки"], ["quiet", "Чистый"]];
const FLASKS_LABEL = "Лабораторные колбы";
// D-56 (20-37): the failure text is one short phrase.
const SAVE_FAILED_TEXT = "Фон не сохранён. Остался прежний.";
const isPhone = (name: string) => name === "chromium-phone";

async function openFlasks(page: Page, patch: Settings = {}) {
  return openWeb(page, { wallpaper: "flasks", spider: "off", ...patch });
}

const wallpaperOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.wallpaper);
const motionOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.motion);
const storedSettings = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem("portia-desktop-settings-v1") ?? "{}") as Record<string, string>);

// Pauses every animation inside the flask art at the given time (the effect time is that minus its delay).
async function seekFlasks(page: Page, ms: number) {
  await page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
      if (!target?.closest(".wallpaper-flasks")) continue;
      animation.pause();
      animation.currentTime = time;
    }
  }, ms);
}

const flaskAnimationCount = (page: Page) => page.evaluate(() => document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks")).length);

type FlaskBox = { index: number; display: string; left: number; right: number; top: number; bottom: number };
const flaskBoxes = (page: Page): Promise<FlaskBox[]> => page.evaluate(() => [...document.querySelectorAll<SVGGElement>(".wallpaper-flask")].map((flask) => {
  const box = flask.querySelector(".wallpaper-flask-glass")!.getBoundingClientRect();
  return { index: Number(flask.dataset.flask), display: getComputedStyle(flask).display, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
}));

const boxesOf = (page: Page, selector: string) => page.evaluate((query) => [...document.querySelectorAll(query)].map((element) => {
  const box = element.getBoundingClientRect();
  return [Math.round(box.x * 10) / 10, Math.round(box.y * 10) / 10, Math.round(box.width * 10) / 10, Math.round(box.height * 10) / 10];
}), selector);

// Boxes once two reads 120 ms apart agree (a window that has just opened is still scaling in).
async function settledBoxes(page: Page, selector: string) {
  let previous = JSON.stringify(await boxesOf(page, selector));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.waitForTimeout(120);
    const current = JSON.stringify(await boxesOf(page, selector));
    if (current === previous) return JSON.parse(current) as number[][];
    previous = current;
  }
  throw new Error(`[PORTIA_FLASKS_BOXES_UNSETTLED] ${selector}`);
}

// Luminance statistics of a PNG: mean sRGB luma (0..255), the largest relative luminance (0..1) of any single pixel (a thin bright line counts),
// and the largest average relative luminance of any 8 CSS px square (the backdrop a text label actually sits on).
async function lumaStats(page: Page, png: Buffer, dpr = 1) {
  return page.evaluate(async ([base64, dpr]) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const linear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
    const width = bitmap.width, height = bitmap.height;
    let sum = 0, peak = 0;
    // Summed-area table of the relative luminance, one extra row and column of zeros.
    const table = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 4;
        sum += 0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2];
        const lum = 0.2126 * linear(data[at]) + 0.7152 * linear(data[at + 1]) + 0.0722 * linear(data[at + 2]);
        peak = Math.max(peak, lum);
        table[(y + 1) * (width + 1) + x + 1] = lum + table[y * (width + 1) + x + 1] + table[(y + 1) * (width + 1) + x] - table[y * (width + 1) + x];
      }
    }
    const side = Math.max(2, Math.round(8 * dpr));
    let area = 0;
    for (let y = 0; y + side <= height; y += 1) {
      for (let x = 0; x + side <= width; x += 1) {
        const total = table[(y + side) * (width + 1) + x + side] - table[y * (width + 1) + x + side] - table[(y + side) * (width + 1) + x] + table[y * (width + 1) + x];
        area = Math.max(area, total / (side * side));
      }
    }
    return { mean: sum / (width * height), peak, area };
  }, [png.toString("base64"), dpr] as const);
}

test("[STAB-VIS-02] D-22 «Лабораторные колбы» is a separate sixth choice: the five old ones and the saved settings stay, the choice survives a reload, nothing shifts", async ({ page }) => {
  // A saved choice (Гель, ice, large icons) is not reset by the new option existing.
  const desktop = await openWeb(page, { wallpaper: "gel", accent: "ice", iconSize: "large", motion: "on", spider: "off" });
  expect(await wallpaperOf(page), "the saved wallpaper is kept").toBe("gel");
  const iconsBefore = await settledBoxes(page, ".desktop-icon");
  expect(iconsBefore.length).toBeGreaterThan(3);
  const before = await storedSettings(page);

  await desktop.openApp("Настройки");
  const group = desktop.settingsGroup("Фон рабочего стола");
  await expect(group.getByRole("button")).toHaveText([...oldWallpapers.slice(0, 4).map(([, label]) => label), FLASKS_LABEL, "Чистый"]);
  await expect(desktop.setting("Фон рабочего стола", "Гель")).toHaveAttribute("aria-pressed", "true");
  await expect(desktop.setting("Фон рабочего стола", FLASKS_LABEL)).toHaveAttribute("aria-pressed", "false");
  const windowBefore = await settledBoxes(page, '[aria-label="Настройки"]');

  await desktop.chooseSetting("Фон рабочего стола", FLASKS_LABEL);
  await expect.poll(() => wallpaperOf(page)).toBe("flasks");
  await expect(page.locator(".wallpaper-layer"), "the crossfade ends with one layer").toHaveCount(1);
  await expect(page.locator(".desktop-wallpaper-flasks")).toBeVisible();
  await expect(desktop.setting("Фон рабочего стола", FLASKS_LABEL)).toHaveAttribute("aria-pressed", "true");
  expect(await settledBoxes(page, '[aria-label="Настройки"]'), "the settings window does not move").toEqual(windowBefore);
  await desktop.closeApp("Настройки");
  await expect(desktop.window("Настройки")).toBeHidden();
  expect(await settledBoxes(page, ".desktop-icon"), "shortcuts do not move").toEqual(iconsBefore);
  await desktop.openApp("Настройки");
  expect(await storedSettings(page), "only the wallpaper changed in the saved settings").toEqual({ ...before, wallpaper: "flasks" });

  await page.reload();
  await desktop.desktop.waitFor();
  expect(await wallpaperOf(page), "the choice survives a reload").toBe("flasks");
  await expect(page.locator(".desktop-wallpaper-flasks")).toBeVisible();
  expect((await storedSettings(page)).accent, "other settings survive too").toBe("ice");

  // Every old option still works from the new one.
  await desktop.openApp("Настройки");
  for (const [id, label] of oldWallpapers) {
    await desktop.chooseSetting("Фон рабочего стола", label);
    await expect.poll(() => wallpaperOf(page), `${label} still selects ${id}`).toBe(id);
  }
  await desktop.chooseSetting("Фон рабочего стола", FLASKS_LABEL);
  await expect.poll(() => wallpaperOf(page)).toBe("flasks");

  // The default is unchanged: the factory reset goes back to «Паутина», not to the new background.
  await page.getByRole("button", { name: "СБРОСИТЬ ДО ЗАВОДСКИХ" }).click();
  await expect.poll(() => wallpaperOf(page)).toBe("radar");
  expect((await storedSettings(page)).wallpaper).toBe("radar");
});

test("[STAB-VIS-02] D-22 a stored wallpaper outside the allowlist falls back to the default, not to the new background", async ({ page }) => {
  await openWeb(page, { wallpaper: "bogus" });
  expect(await wallpaperOf(page)).toBe("radar");
  await openWeb(page, { wallpaper: "flasks" });
  expect(await wallpaperOf(page)).toBe("flasks");
});

// D-51 (20-34): the old rules "four flasks", "right of centre" and "two or three on a phone" are replaced by the owner's answers F1-А / F2 / F6-А:
// a lab of many vessels across the lower half of the screen; a phone shows the richest right strip with 2-4 whole vessels.
const FLASK_COUNT = 12, PHONE_FLASKS = 4;
// D-51 (20-34): the table of expected cycles covers all twelve vessels. The first four are the D-22 pairs; the rest are new, authored values.
// It must change together with flaskSpecs in components/portia-wallpaper.tsx.
const wantedCycles = [
  { duration: 6800, delay: -1900 }, { duration: 8900, delay: -5200 }, { duration: 11300, delay: -3400 }, { duration: 7700, delay: -6100 },
  { duration: 9700, delay: -1000 }, { duration: 6300, delay: -3000 }, { duration: 10400, delay: -5300 }, { duration: 7200, delay: -4000 },
  { duration: 8300, delay: -7800 }, { duration: 11800, delay: -6000 }, { duration: 6600, delay: -2500 }, { duration: 9100, delay: -4600 },
];

test("[STAB-VIS-02] D-51 twelve vessels on PC, four on a phone, each with its own cycle; bubbles stay in the liquid; the glow is smooth", async ({ page, browser, determinism }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await openFlasks(page, { motion: "on" });
  await expect(page.locator(".wallpaper-flasks")).toBeAttached();
  const viewport = page.viewportSize()!;

  const boxes = await flaskBoxes(page);
  // D-51 (20-34): twelve animated vessels are drawn (was four).
  expect(boxes, "all twelve vessels are drawn").toHaveLength(FLASK_COUNT);
  const shown = boxes.filter((box) => box.display !== "none");
  // D-51 (20-34): a phone shows 2-4 whole vessels of the richest part (was 2-3); a PC shows all twelve (was four).
  if (phone) {
    expect(shown.length, "a phone shows two to four vessels").toBeGreaterThanOrEqual(2);
    expect(shown.length).toBeLessThanOrEqual(4);
    expect(shown.length).toBe(PHONE_FLASKS);
  } else {
    expect(shown.length, "a PC shows all twelve").toBe(FLASK_COUNT);
  }
  for (const box of shown) {
    expect(box.left, `flask ${box.index} is not cut at the left`).toBeGreaterThanOrEqual(0);
    expect(box.right, `flask ${box.index} is not cut at the right`).toBeLessThanOrEqual(viewport.width);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
  }
  // D-51 (20-34): "right of centre" is dropped; the scene runs the whole width, so the vessels reach into the left half on a PC.
  if (!phone) expect(Math.min(...shown.map((box) => box.left)), "the vessels spread over the whole width").toBeLessThan(viewport.width / 2);

  // Independent cycles: durations and delays are the authored candidates, all different.
  const timings = await page.evaluate(() => document.getAnimations().flatMap((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
    if (!target?.classList.contains("wallpaper-flask-liquid")) return [];
    const timing = animation.effect!.getTiming();
    if (getComputedStyle(target.closest(".wallpaper-flask")!).display === "none") return [];
    return [{ index: Number(target.closest<SVGGElement>(".wallpaper-flask")!.dataset.flask), duration: Number(timing.duration), delay: Number(timing.delay), name: (animation as CSSAnimation).animationName }];
  }).sort((a, b) => a.index - b.index));
  const wanted = wantedCycles;
  expect(timings.length, "every shown flask glows").toBe(shown.length);
  for (const timing of timings) {
    expect(timing.name).toBe("flask-glow");
    expect({ duration: timing.duration, delay: timing.delay }).toEqual(wanted[timing.index]);
  }
  expect(new Set(timings.map((timing) => timing.duration)).size, "every flask has its own cycle length").toBe(timings.length);
  expect(new Set(timings.map((timing) => timing.delay)).size, "every flask has its own phase").toBe(timings.length);

  // The glow of every flask sampled every 50 ms: smooth (no flash), a range of about .55..1, and the first peaks do not coincide.
  const glow = await page.evaluate(() => {
    const liquids = [...document.querySelectorAll<SVGGElement>(".wallpaper-flask-liquid")].filter((liquid) => getComputedStyle(liquid.closest(".wallpaper-flask")!).display !== "none");
    const animations = document.getAnimations().filter((animation) => liquids.includes((animation.effect as KeyframeEffect).target as SVGGElement));
    return animations.map((animation) => {
      const target = (animation.effect as KeyframeEffect).target as SVGGElement;
      const duration = Number(animation.effect!.getTiming().duration);
      animation.pause();
      const series: number[] = [];
      for (let time = 0; time <= 12_000; time += 50) {
        animation.currentTime = time;
        series.push(Number(getComputedStyle(target).opacity));
      }
      const firstCycle = series.slice(0, Math.floor(duration / 50));
      return { index: Number(target.closest<SVGGElement>(".wallpaper-flask")!.dataset.flask), series, peak: firstCycle.indexOf(Math.max(...firstCycle)) * 50 };
    }).sort((a, b) => a.index - b.index);
  });
  for (const flask of glow) {
    const steps = flask.series.slice(1).map((value, at) => Math.abs(value - flask.series[at]));
    expect(Math.max(...steps), `flask ${flask.index}: largest opacity step per 50 ms (a flash would jump)`).toBeLessThan(0.05);
    expect(Math.min(...flask.series), `flask ${flask.index}: dimmest`).toBeGreaterThan(0.53);
    expect(Math.max(...flask.series), `flask ${flask.index}: brightest`).toBeLessThanOrEqual(1);
    expect(Math.max(...flask.series)).toBeGreaterThan(0.97);
  }
  for (let a = 0; a < glow.length; a += 1) {
    for (let b = a + 1; b < glow.length; b += 1) {
      expect(Math.abs(glow[a].peak - glow[b].peak), `first peaks of flasks ${glow[a].index} and ${glow[b].index} are apart`).toBeGreaterThan(400);
    }
  }
  writeRun(`flasks-glow--${testInfo.project.name}.json`, glow.map((flask) => ({ flask: flask.index, firstPeakMs: flask.peak, minOpacity: Math.min(...flask.series), maxOpacity: Math.max(...flask.series), maxStepPer50ms: Math.max(...flask.series.slice(1).map((value, at) => Math.abs(value - flask.series[at]))) })));

  // Bubbles: through a whole cycle of every bubble, the bubble stays under the surface line and inside the glass.
  const escapes = await page.evaluate(() => {
    const out: string[] = [];
    const bubbles = [...document.querySelectorAll<SVGCircleElement>(".wallpaper-flask-bubble")].filter((bubble) => getComputedStyle(bubble.closest(".wallpaper-flask")!).display !== "none");
    const byElement = new Map(document.getAnimations().map((animation) => [(animation.effect as KeyframeEffect).target, animation]));
    let checked = 0;
    for (let step = 0; step <= 40; step += 1) {
      for (const bubble of bubbles) {
        const animation = byElement.get(bubble)!;
        animation.pause();
        animation.currentTime = (step / 40) * Number(animation.effect!.getTiming().duration);
        const flask = bubble.closest(".wallpaper-flask")!;
        const dot = bubble.getBoundingClientRect(), glass = flask.querySelector(".wallpaper-flask-glass")!.getBoundingClientRect(), surface = flask.querySelector(".wallpaper-flask-surface")!.getBoundingClientRect();
        checked += 1;
        const inside = dot.top >= surface.bottom - 0.01 && dot.bottom <= glass.bottom + 0.01 && dot.left >= glass.left - 0.01 && dot.right <= glass.right + 0.01;
        if (!inside) out.push(`flask ${(flask as SVGGElement).dataset.flask} step ${step}: bubble ${dot.left.toFixed(1)},${dot.top.toFixed(1)}-${dot.right.toFixed(1)},${dot.bottom.toFixed(1)} vs surface bottom ${surface.bottom.toFixed(1)} glass ${glass.left.toFixed(1)}-${glass.right.toFixed(1)} bottom ${glass.bottom.toFixed(1)}`);
      }
    }
    return { out, checked, bubbles: bubbles.length };
  });
  expect(escapes.bubbles, "bubbles exist").toBeGreaterThanOrEqual(shown.length * 3);
  expect(escapes.out, `${escapes.checked} bubble positions checked`).toEqual([]);
  // D-51 (20-34): one clipped bubble group per animated vessel, twelve (was four).
  expect(await page.locator(".wallpaper-flask-bubbles[clip-path]").count(), "every bubble group is also clipped by the glass").toBe(FLASK_COUNT);
  // D-51 (20-34): a budget on the endless animations inside the drawing (cost on a phone). D-54 (20-37): the limit is now 140 (was 100) and is declared with its
  // reasons below; the actual numbers are recorded by the D-54 budget test (flasks-animation-count--<project>.json).
  const infinite = await page.evaluate(() => document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks") && animation.effect!.getTiming().iterations === Infinity).length);
  expect(infinite, "endless animations inside the drawing").toBeLessThanOrEqual(MAX_INFINITE_ANIMATIONS);
  expect(infinite).toBeGreaterThan(shown.length * 5);

  // A frame of the full-motion wallpaper at a fixed animation time (the candidate; not an approved baseline).
  await seekFlasks(page, 4_000);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-flasks-full",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: `D-51 «Лабораторные колбы», full motion, animations paused at 4.0 s; ${shown.length} vessels shown`,
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-full--${testInfo.project.name}.png`,
    animations: "allow",
  });
});

for (const mode of ["reduced", "off"] as const) {
  test(`[STAB-A11Y-04] D-02 «Анимации: ${mode === "off" ? "Выключены" : "Уменьшены"}»: the flasks stand still and finished, liquid and stand stay drawn`, async ({ page, browser, determinism }, testInfo) => {
    await openFlasks(page, { motion: mode });
    expect(await motionOf(page)).toBe(mode);
    await expect(page.locator(".wallpaper-flasks")).toBeAttached();
    expect(await flaskAnimationCount(page), "no running animation in the flask art").toBe(0);
    const probe = await page.evaluate(() => {
      const first = (selector: string) => document.querySelector(selector)!;
      const shown = [...document.querySelectorAll<SVGGElement>(".wallpaper-flask")].filter((flask) => getComputedStyle(flask).display !== "none");
      return {
        names: [".wallpaper-flask-liquid", ".wallpaper-flask-surface", ".wallpaper-flask-bubble"].map((selector) => getComputedStyle(first(selector)).animationName),
        liquidOpacity: shown.map((flask) => getComputedStyle(flask.querySelector(".wallpaper-flask-liquid")!).opacity),
        bubbleTransforms: [...document.querySelectorAll<SVGCircleElement>(".wallpaper-flask-bubble")].map((bubble) => getComputedStyle(bubble).transform),
        drawn: shown.map((flask) => ["fill", "glass", "lip", "surface"].every((part) => flask.querySelector(`.wallpaper-flask-${part}`)!.getBoundingClientRect().width > 0)),
        stand: first(".wallpaper-flask-stand path").getBoundingClientRect().width,
        count: shown.length,
      };
    });
    expect(probe.names, "animation-name is none on the liquid, the surface and a bubble").toEqual(["none", "none", "none"]);
    expect(probe.liquidOpacity.every((value) => value === "0.85"), "the liquid shows its finished frame").toBe(true);
    expect(probe.bubbleTransforms.every((value) => value === "none"), "bubbles sit at their drawn place").toBe(true);
    expect(probe.drawn.every(Boolean), "glass, liquid, lip and surface are drawn").toBe(true);
    expect(probe.stand, "the stand is drawn").toBeGreaterThan(100);
    // D-51 (20-34): four vessels on a phone (was three), twelve on a PC (was four).
    expect(probe.count).toBe(isPhone(testInfo.project.name) ? PHONE_FLASKS : FLASK_COUNT);
    const first = await boxesOf(page, ".wallpaper-flask-bubble");
    await page.waitForTimeout(700);
    expect(await boxesOf(page, ".wallpaper-flask-bubble"), "nothing moves").toEqual(first);
    await captureCandidate({ page, browser, determinism, testInfo }, {
      id: `phase20-flasks-${mode}`,
      requirement: "STAB-BASE-03",
      surface: "Flask wallpaper CANDIDATE",
      actor: "visitor",
      state: `D-02 «Лабораторные колбы», motion ${mode}: still, finished frame`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-${mode}--${testInfo.project.name}.png`,
      animations: "allow",
    });
  });
}

test("[STAB-A11Y-04] D-01 the OS reduced-motion preference does not switch PORTIA OS: the flasks keep moving in «Включены»", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFlasks(page, { motion: "on" });
  expect(await motionOf(page), "the site mode is still full").toBe("full");
  expect(await flaskAnimationCount(page), "glow, surface and bubbles run").toBeGreaterThan(10);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".wallpaper-flask-liquid")!).animationName)).toBe("flask-glow");
});

test("[STAB-A11Y-04] D-03/D-04 «Выключены» in the middle of a cycle stops the flasks at once, keeps the saved action and shows the text result", async ({ page, browser, determinism }, testInfo) => {
  const desktop = await openFlasks(page, { motion: "on" });
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks") && Number(animation.currentTime) > 300).length), "the cycle is under way").toBeGreaterThan(10);
  await desktop.openApp("Настройки");
  await desktop.chooseSetting("Анимации", "Выключены");
  await expect.poll(() => motionOf(page)).toBe("off");
  expect(await flaskAnimationCount(page), "no animation survives the switch").toBe(0);
  const stopped = await boxesOf(page, ".wallpaper-flask-bubble");
  expect(await page.evaluate(() => [...document.querySelectorAll(".wallpaper-flask-bubble")].every((bubble) => getComputedStyle(bubble).transform === "none")), "bubbles are at their finished place").toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".wallpaper-flask-liquid")!).opacity)).toBe("0.85");
  await page.waitForTimeout(1_200);
  expect(await boxesOf(page, ".wallpaper-flask-bubble"), "the picture does not move after the switch").toEqual(stopped);
  expect((await storedSettings(page)).motion, "the chosen action is saved").toBe("off");
  expect((await storedSettings(page)).wallpaper).toBe("flasks");
  const status = desktop.window("Настройки").getByRole("status");
  await expect(status, "the text result of the action").toHaveText("Настройки сохранены");
  await expect(status).toHaveClass(/is-visible/);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-flasks-mid-cycle-off",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: "D-04 «Анимации: Выключены» chosen in the middle of a flask cycle: finished still frame, saved status shown",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-mid-cycle-off--${testInfo.project.name}.png`,
    animations: "allow",
  });
});

test("[STAB-VIS-02] UI E1 the base and the vector frame appear at once; a failed effect or a failed picture leaves still flasks or the dark base, never an empty screen", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = await openFlasks(page, { motion: "on" });
  // loading: the frame is there together with the shortcuts, at a visible opacity from the first frame.
  const first = await page.evaluate(() => ({
    art: document.querySelector(".desktop-wallpaper-flasks") !== null,
    glass: document.querySelectorAll(".wallpaper-flask-glass").length,
    scene: document.querySelectorAll(".wallpaper-flask-scene-vessel").length,
    stand: document.querySelectorAll(".wallpaper-flask-stand path").length,
    icon: document.querySelector(".desktop-icon")!.getBoundingClientRect().height,
    liquid: Number(getComputedStyle(document.querySelector(".wallpaper-flask-liquid")!).opacity),
    artOpacity: Number(getComputedStyle(document.querySelector(".desktop-wallpaper-flasks")!).opacity),
  }));
  // D-51 (20-34): twelve animated vessels, a shelf of still ones and the bench are in the frame from the first paint (was four vessels).
  expect(first.art && first.glass === FLASK_COUNT && first.scene > 5 && first.stand >= 2, "the vector frame is in the DOM").toBe(true);
  expect(first.icon, "shortcuts are shown with it").toBeGreaterThan(0);
  expect(first.liquid, "the liquid is visible from the first frame").toBeGreaterThanOrEqual(0.5);
  expect(first.artOpacity).toBeGreaterThan(0.5);

  // error 1: the effect fails (its keyframes do not apply). The flasks stay, still and visible.
  await page.addStyleTag({ content: ".wallpaper-flasks * { animation-name: flask-missing !important; }" });
  expect(await flaskAnimationCount(page), "no animation runs").toBe(0);
  const still = await page.evaluate(() => [...document.querySelectorAll(".wallpaper-flask")].filter((flask) => getComputedStyle(flask).display !== "none").flatMap((flask) => [...flask.querySelectorAll(".wallpaper-flask-glass, .wallpaper-flask-fill")]).map((part) => Number(getComputedStyle(part).opacity) > 0 && part.getBoundingClientRect().width > 0));
  expect(still.length).toBeGreaterThan(5);
  expect(still.every(Boolean), "glass and liquid are drawn without the effect").toBe(true);
  await captureCandidate(context, {
    id: "phase20-flasks-effect-failed",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: "UI E1 error: the flask effect does not apply; still flasks remain",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-effect-failed--${testInfo.project.name}.png`,
    animations: "allow",
  });

  // error 2: the picture itself is gone. The dark base stays and the desktop works.
  await page.evaluate(() => document.querySelector(".desktop-wallpaper-frame")!.replaceChildren());
  await expect(desktop.desktop).toBeVisible();
  await expect(desktop.shortcut("Настройки")).toBeVisible();
  const base = await lumaStats(page, await page.screenshot());
  expect(base.mean, "the screen is dark, not white or empty").toBeLessThan(90);
  expect(base.mean, "and not flat black either: the base gradient and the shortcuts draw").toBeGreaterThan(2);
  await captureCandidate(context, {
    id: "phase20-flasks-picture-missing",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: "UI E1 empty: no wallpaper picture; the dark base and the shortcuts remain",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-picture-missing--${testInfo.project.name}.png`,
    animations: "allow",
  });
});

test("[STAB-VIS-02] UI E2 the choice stays visible while the wallpaper changes; a refused save keeps the previous wallpaper and says so", async ({ page, browser, determinism }, testInfo) => {
  const desktop = await openWeb(page, { wallpaper: "radar", spider: "off", motion: "on" });
  await desktop.openApp("Настройки");
  const group = desktop.settingsGroup("Фон рабочего стола");

  // loading: the options and the current choice stay visible during the 500 ms crossfade.
  await desktop.chooseSetting("Фон рабочего стола", "Гель");
  await expect(page.locator(".wallpaper-layer"), "two layers while it fades").toHaveCount(2);
  await expect(group.getByRole("button")).toHaveCount(6);
  for (const button of await group.getByRole("button").all()) await expect(button).toBeVisible();
  await expect(desktop.setting("Фон рабочего стола", "Гель")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".wallpaper-layer")).toHaveCount(1);

  // error: the device refuses the write.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { __restoreSetItem: () => void }).__restoreSetItem = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "portia-desktop-settings-v1") throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await desktop.chooseSetting("Фон рабочего стола", FLASKS_LABEL);
  const alert = desktop.window("Настройки").getByRole("alert");
  await expect(alert).toHaveText(SAVE_FAILED_TEXT);
  expect(await wallpaperOf(page), "the previous wallpaper stays active").toBe("gel");
  await expect(desktop.setting("Фон рабочего стола", "Гель"), "and stays chosen").toHaveAttribute("aria-pressed", "true");
  await expect(desktop.setting("Фон рабочего стола", FLASKS_LABEL)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".desktop-wallpaper-gel")).toBeVisible();
  await expect(page.locator(".desktop-wallpaper-flasks")).toHaveCount(0);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-flasks-save-error",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: "UI E2 error: the wallpaper could not be saved; the previous choice and the message are shown",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-save-error--${testInfo.project.name}.png`,
    animations: "allow",
  });

  // recovery: with the device writing again, the same click works and the message goes.
  await page.evaluate(() => (window as unknown as { __restoreSetItem: () => void }).__restoreSetItem());
  await desktop.chooseSetting("Фон рабочего стола", FLASKS_LABEL);
  await expect.poll(() => wallpaperOf(page)).toBe("flasks");
  await expect(alert).toHaveCount(0);
  expect((await storedSettings(page)).wallpaper).toBe("flasks");
});

test("[STAB-VIS-02] UI E2 a long option label wraps inside its button, keeps the focus ring and adds no page-level horizontal scroll", async ({ page, browser, determinism }, testInfo) => {
  const desktop = await openWeb(page, { wallpaper: "radar", spider: "off", motion: "off" });
  await desktop.openApp("Настройки");
  const button = desktop.settingsGroup("Фон рабочего стола").getByRole("button").nth(4);
  await expect(button).toHaveText(FLASKS_LABEL);
  await button.evaluate((element) => { element.querySelector("span")!.textContent = "Лабораторные колбы на штативе с очень длинной подписью, которая обязана перенестись без обрезки"; });
  await page.keyboard.press("Tab"); // a key press first, so :focus-visible applies to the next programmatic focus
  await button.focus();
  await expect(button).toBeFocused();
  const fit = await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const ring = getComputedStyle(element);
    const ringSize = parseFloat(ring.outlineWidth) + parseFloat(ring.outlineOffset);
    // The nearest ancestor that clips or scrolls: the focus ring must fit inside it.
    let clip: Element | null = element.parentElement;
    while (clip && clip !== document.body && getComputedStyle(clip).overflowX === "visible") clip = clip.parentElement;
    const clipBox = (clip ?? document.documentElement).getBoundingClientRect();
    const span = element.querySelector("span")!.getBoundingClientRect();
    return {
      ringStyle: ring.outlineStyle, ringSize, textWrapped: element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
      spanInside: span.left >= box.left - 0.5 && span.right <= box.right + 0.5,
      ringLeft: box.left - ringSize - clipBox.left, ringRight: clipBox.right - (box.right + ringSize),
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyScroll: document.body.scrollWidth - document.body.clientWidth,
      height: box.height,
    };
  });
  expect(fit.ringStyle, "a focus ring is drawn").not.toBe("none");
  expect(fit.ringSize).toBeGreaterThanOrEqual(3);
  expect(fit.textWrapped, "the long label does not overflow its button").toBe(true);
  expect(fit.spanInside, "the label stays inside the button").toBe(true);
  expect(fit.ringLeft, "the ring is not cut at the left").toBeGreaterThanOrEqual(0);
  expect(fit.ringRight, "the ring is not cut at the right").toBeGreaterThanOrEqual(0);
  expect(fit.height, "the button grew to hold the wrapped text").toBeGreaterThan(54);
  expect(fit.pageScroll, "no horizontal scroll on the page").toBeLessThanOrEqual(0);
  expect(fit.bodyScroll).toBeLessThanOrEqual(0);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-flasks-long-label",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: "UI E2 long-text: a very long option label wraps in its button with the focus ring visible",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-long-label--${testInfo.project.name}.png`,
    animations: "allow",
  });
});

for (const accent of accents) {
  test(`[STAB-VIS-02] D-51 the flasks on the ${accent.label}: behind windows, shortcuts and Vivian; label contrast over the brightest part of the whole drawing`, async ({ page, browser, determinism }, testInfo) => {
    const desktop = await openFlasks(page, { ...accent.settings, motion: "off" });
    await desktop.openApp("Настройки");
    // Behind everything: the frame is the lowest layer and takes no pointer events.
    const layers = await page.evaluate(() => {
      const z = (selector: string) => { const value = getComputedStyle(document.querySelector(selector)!).zIndex; return value === "auto" ? 0 : Number(value); };
      const frame = document.querySelector(".desktop-wallpaper-frame")!;
      const shownFlask = [...document.querySelectorAll<SVGGElement>(".wallpaper-flask")].find((flask) => getComputedStyle(flask).display !== "none")!;
      const glass = shownFlask.querySelector(".wallpaper-flask-glass")!.getBoundingClientRect();
      const hit = document.elementFromPoint(glass.left + glass.width / 2, glass.top + glass.height / 2);
      return { frame: z(".desktop-wallpaper-frame"), icons: z(".desktop-icons"), assistant: z(".desktop-assistant"), window: z(".app-window"), pointer: getComputedStyle(frame).pointerEvents, hitInsideFrame: !!hit?.closest(".desktop-wallpaper-frame") };
    });
    expect(layers.pointer).toBe("none");
    expect(layers.hitInsideFrame, "a click on a flask reaches the desktop, not the decoration").toBe(false);
    expect(layers.frame).toBeLessThan(layers.icons);
    expect(layers.frame).toBeLessThan(layers.assistant);
    expect(layers.frame).toBeLessThan(layers.window);
    await desktop.closeApp("Настройки");
    await expect(desktop.window("Настройки")).toBeHidden();

    // The brightest pixel of the flask region without shortcuts or Vivian on top, against the shortcut label colour.
    // D-51 (20-34): the measured area is the whole drawing (the rectangle of .wallpaper-flasks), not just the vessels, cut to the work area between the top bar and the taskbar.
    await page.addStyleTag({ content: ".desktop-icon, .desktop-assistant, .system-bar, .taskbar { visibility: hidden !important; }" });
    const clip = await page.evaluate(() => {
      const art = document.querySelector(".wallpaper-flasks")!.getBoundingClientRect();
      const top = document.querySelector(".system-bar")!.getBoundingClientRect().bottom, bottom = document.querySelector(".taskbar")!.getBoundingClientRect().top;
      const x = Math.max(0, Math.floor(art.left)), y = Math.max(Math.ceil(top), Math.floor(art.top));
      return { x, y, width: Math.min(window.innerWidth, Math.ceil(art.right)) - x, height: Math.min(Math.floor(bottom), Math.ceil(art.bottom)) - y };
    });
    expect(clip.width, "the measured area has width").toBeGreaterThan(200);
    expect(clip.height, "the measured area has height").toBeGreaterThan(200);
    const region = await lumaStats(page, await page.screenshot({ clip, animations: "allow" }), await page.evaluate(() => window.devicePixelRatio));
    const label = await page.evaluate(() => {
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.fillStyle = getComputedStyle(document.querySelector(".desktop-icon")!).color;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      const linear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
      return { rgb: [r, g, b], luminance: 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) };
    });
    // Text contrast is asserted against the brightest 8 px square of the wallpaper (what a label sits on); the single brightest pixel is a thin line or a bubble ring
    // and is only recorded: decoration is exempt from the text threshold, and no visible accent line on a near-white accent could meet 4.5:1 pixel by pixel.
    const contrast = (label.luminance + 0.05) / (region.area + 0.05);
    const pixelContrast = (label.luminance + 0.05) / (region.peak + 0.05);
    writeRun(`flasks-contrast-${accent.id}--${testInfo.project.name}.json`, { accent: accent.id, project: testInfo.project.name, labelRgb: label.rgb, labelLuminance: label.luminance, brightest8pxSquareLuminance: region.area, brightestSinglePixelLuminance: region.peak, meanLuma: region.mean, contrastOver8pxSquare: contrast, contrastOverSinglePixel: pixelContrast, textThreshold: 4.5, clip });
    expect(contrast, `shortcut label vs the brightest 8 px square of the flasks (${accent.label})`).toBeGreaterThanOrEqual(4.5);
    await captureCandidate({ page, browser, determinism, testInfo }, {
      id: `phase20-flasks-accent-${accent.id}`,
      requirement: "STAB-BASE-03",
      surface: "Flask wallpaper CANDIDATE",
      actor: "visitor",
      state: `D-22 flasks on the ${accent.label}, motion off, shortcuts and Vivian hidden to show the wallpaper alone; label contrast over the brightest 8 px square ${contrast.toFixed(2)}, over the brightest pixel ${pixelContrast.toFixed(2)}`,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-accent-${accent.id}--${testInfo.project.name}.png`,
      animations: "allow",
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// D-54 (20-37, plan 20-42): the owner asked for more motion in «Лабораторные колбы» — a flickering flame, moving vessels on the back shelf, a ticking
// clock — and for less empty space. The contract below is new; every number that was changed is marked «D-54 (20-37)».
// ---------------------------------------------------------------------------------------------------------------------

// D-54 (20-37): the shelf cycles. One entry per still-until-now shelf vessel that holds liquid, in the order of `shelfItems` (lamp skipped) in
// components/portia-wallpaper.tsx. Durations 5.4–10.6 s, all different, all phases different, the first glow peaks 380 ms apart or more.
// This table and `shelfCycles` in the component change only together.
const SHELF_CYCLES = [
  { duration: 7300, delay: -3250 }, { duration: 5600, delay: -2020 }, { duration: 9400, delay: -3540 }, { duration: 6200, delay: -1560 },
  { duration: 10600, delay: -3380 }, { duration: 8100, delay: -1750 }, { duration: 5900, delay: -270 }, { duration: 9000, delay: -1440 },
  { duration: 6800, delay: -6760 }, { duration: 10100, delay: -1230 }, { duration: 7700, delay: -7350 }, { duration: 5400, delay: -3520 },
  { duration: 8600, delay: -7940 }, { duration: 6500, delay: -4410 },
];

type CycleProbe = { name: string; duration: number; delay: number; iterations: number; properties: string[]; easing: string; frames: number; firstPeakMs: number | null; visible: boolean };

// Every running animation whose target matches the selector: its timing, the properties its keyframes touch, and the first time (ms) its opacity is at the maximum.
const cyclesOf = (page: Page, selector: string): Promise<Array<CycleProbe & { index: number }>> => page.evaluate((query) => {
  const targets = [...document.querySelectorAll(query)];
  return document.getAnimations().flatMap((animation) => {
    const effect = animation.effect as KeyframeEffect | null;
    const target = effect?.target as Element | null;
    if (!effect || !target || !targets.includes(target)) return [];
    const timing = effect.getTiming();
    const frames = effect.getKeyframes();
    const properties = [...new Set(frames.flatMap((frame) => Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key))))].sort();
    const original = animation.currentTime;
    animation.pause();
    const duration = Number(timing.duration), delay = Number(timing.delay);
    let best = -1, peak: number | null = null;
    if (properties.includes("opacity")) {
      for (let at = 0; at < duration; at += 20) {
        // A negative current time is not honoured by the browser, so the time is wrapped into one cycle (the animations are endless, one cycle is the same as the next).
        animation.currentTime = (((delay + at) % duration) + duration) % duration;
        const value = Number(getComputedStyle(target).opacity);
        if (value > best + 1e-6) { best = value; peak = at; }
      }
    }
    animation.currentTime = original;
    animation.play();
    let hidden = false;
    for (let node: Element | null = target; node; node = node.parentElement) if (getComputedStyle(node).display === "none") hidden = true;
    return [{ index: targets.indexOf(target), name: (animation as CSSAnimation).animationName, duration, delay, iterations: Number(timing.iterations), properties, easing: String(timing.easing), frames: frames.length, firstPeakMs: peak === null ? null : ((peak + delay) % duration + duration) % duration, visible: !hidden }];
  }).sort((a, b) => a.index - b.index);
}, selector);

const insideViewport = (box: { left: number; right: number; top: number; bottom: number }, page: Page) => {
  const view = page.viewportSize()!;
  return box.left >= -0.5 && box.top >= -0.5 && box.right <= view.width + 0.5 && box.bottom <= view.height + 0.5;
};
const rectsOf = (page: Page, selector: string) => page.evaluate((query) => [...document.querySelectorAll(query)].map((element) => {
  const box = element.getBoundingClientRect();
  let hidden = false;
  for (let node: Element | null = element; node; node = node.parentElement) if (getComputedStyle(node).display === "none") hidden = true;
  return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, hidden };
}), selector);

// A frame measured the way the contrast test measures it: shortcuts, Vivian, the top bar and the taskbar hidden, the clip is the rectangle of the drawing
// cut to the work area.
async function measureClip(page: Page) {
  await page.addStyleTag({ content: ".desktop-icon, .desktop-icons, .desktop-assistant, .system-bar, .taskbar { visibility: hidden !important; }" });
  return page.evaluate(() => {
    const art = document.querySelector(".wallpaper-flasks")!.getBoundingClientRect();
    const top = document.querySelector(".system-bar")!.getBoundingClientRect().bottom, bottom = document.querySelector(".taskbar")!.getBoundingClientRect().top;
    const x = Math.max(0, Math.floor(art.left)), y = Math.max(Math.ceil(top), Math.floor(art.top));
    return { x, y, width: Math.min(window.innerWidth, Math.ceil(art.right)) - x, height: Math.min(Math.floor(bottom), Math.ceil(art.bottom)) - y, artHeight: art.height, artTop: art.top, artBottom: art.bottom, viewportHeight: window.innerHeight };
  });
}

// Cells of 48 CSS px over the clip: a cell is empty when its brightest pixel is less than 0.01 of relative luminance above the median of the darkest 10% of the frame.
async function emptyCellsOf(page: Page, png: Buffer, dpr: number) {
  return page.evaluate(async ([base64, ratio]) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), { colorSpaceConversion: "none" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const linear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
    const width = bitmap.width, height = bitmap.height;
    const lum = new Float32Array(width * height);
    for (let at = 0; at < lum.length; at += 1) lum[at] = 0.2126 * linear(data[at * 4]) + 0.7152 * linear(data[at * 4 + 1]) + 0.0722 * linear(data[at * 4 + 2]);
    const sorted = Float32Array.from(lum).sort();
    const darkest = sorted[Math.floor(sorted.length * 0.05)];
    const cell = Math.max(2, Math.round(48 * ratio));
    let total = 0, empty = 0;
    for (let top = 0; top < height; top += cell) {
      for (let left = 0; left < width; left += cell) {
        let brightest = 0;
        for (let y = top; y < Math.min(height, top + cell); y += 1) for (let x = left; x < Math.min(width, left + cell); x += 1) brightest = Math.max(brightest, lum[y * width + x]);
        total += 1;
        if (brightest - darkest < 0.01) empty += 1;
      }
    }
    return { total, empty, darkest };
  }, [png.toString("base64"), dpr] as const);
}

// D-54 (20-37): the empty cells of the drawing at HEAD 33552db (замер 20-42 на 33552db, «Выключены», the same clip and the same threshold).
const HEAD_EMPTY_CELLS: Record<string, number | null> = { "chromium-desktop": 78, "chromium-phone": 25 };
const MAX_DRAWING_HEIGHT_SHARE = 0.62; // D-51 F2: «половина экрана или чуть больше»
const MAX_EMPTY_SHARE_OF_HEAD = 0.6; // D-54: at least 40% fewer empty cells than HEAD

test("[STAB-VIS-02] D-54 coverage: less empty space inside the drawing (cells of 48 px), and the drawing stays within 62% of the screen height", async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await openFlasks(page, { motion: "off" });
  const clip = await measureClip(page);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const cells = await emptyCellsOf(page, await page.screenshot({ clip, animations: "allow" }), dpr);
  const head = HEAD_EMPTY_CELLS[project];
  const heightShare = clip.artHeight / clip.viewportHeight;
  writeRun(`flasks-coverage-${project}.json`, { project, emptyCells: cells.empty, totalCells: cells.total, emptyShare: cells.empty / cells.total, headEmptyCells: head, ratioToHead: head ? cells.empty / head : null, darkestLuminance: cells.darkest, cell: 48, heightShare, drawingTop: clip.artTop, drawingBottom: clip.artBottom, clip });
  console.log(`[D-54 coverage] ${project}: empty ${cells.empty} of ${cells.total}, height share ${heightShare.toFixed(3)}, head ${head}`);
  expect(heightShare, "the drawing is not taller than 62% of the screen (D-51 F2)").toBeLessThanOrEqual(MAX_DRAWING_HEIGHT_SHARE);
  expect(head, "the HEAD number is recorded (замер 20-42 на 33552db)").not.toBeNull();
  // D-54: the PC frame must lose at least 40% of the empty cells; the phone number is recorded and its frame is checked by its own test.
  if (!isPhone(project)) expect(cells.empty, `empty cells against HEAD ${head}`).toBeLessThanOrEqual(Math.floor(head! * MAX_EMPTY_SHARE_OF_HEAD));
});

test("[STAB-VIS-02] D-54 the flame flickers: the burner and the lamps each flicker on their own irregular cycle, outer layer and core, opacity and transform only", async ({ page }, testInfo) => {
  await openFlasks(page, { motion: "on" });
  const flames = await cyclesOf(page, ".wallpaper-flask-flame");
  const cores = await cyclesOf(page, ".wallpaper-flask-flame-core");
  const count = await page.locator(".wallpaper-flask-flame").count();
  expect(count, "the burner, the alcohol lamp and one more flame on the shelf (a phone sees that one)").toBeGreaterThanOrEqual(3);
  expect(await page.locator(".wallpaper-flask-flame-core").count(), "every flame has a core").toBe(count);
  for (const cycle of [...flames, ...cores]) {
    expect(cycle.iterations, "a flame flickers for ever").toBe(Infinity);
    expect(cycle.properties, "only opacity and transform").toEqual(["opacity", "transform"]);
    expect(cycle.frames, "an irregular cycle has more than three keyframes").toBeGreaterThanOrEqual(5);
  }
  expect(flames.length, "every outer layer is animated, once").toBe(count);
  expect(cores.length, "every core is animated, once").toBe(count);
  const lengths = [...flames, ...cores].map((cycle) => cycle.duration);
  expect(new Set(lengths).size, "every flame layer has its own cycle length").toBe(lengths.length);
  for (const cycle of [...flames, ...cores]) expect(cycle.duration, "a flicker is quick, 0.8–3 s").toBeGreaterThanOrEqual(800);
  for (const cycle of [...flames, ...cores]) expect(cycle.duration).toBeLessThanOrEqual(3_000);
  if (isPhone(testInfo.project.name)) {
    const shown = (await rectsOf(page, ".wallpaper-flask-flame")).filter((box) => !box.hidden && insideViewport(box, page));
    expect(shown.length, "a phone shows at least one flickering flame whole").toBeGreaterThanOrEqual(1);
  }
});

test("[STAB-VIS-02] D-54 the clock ticks: the second hand steps once a second (60 s, 60 steps), the minute hand turns in 3600 s, both around the dial centre; still hands in the stopped modes", async ({ page }, testInfo) => {
  await openFlasks(page, { motion: "on" });
  const second = await cyclesOf(page, ".wallpaper-flask-clock-second");
  const minute = await cyclesOf(page, ".wallpaper-flask-clock-minute");
  expect(second, "one animation on the second hand").toHaveLength(1);
  expect(minute, "one animation on the minute hand").toHaveLength(1);
  expect(second[0].duration).toBe(60_000);
  expect(second[0].iterations).toBe(Infinity);
  expect(second[0].properties).toEqual(["transform"]);
  expect(minute[0].duration).toBe(3_600_000);
  expect(minute[0].iterations).toBe(Infinity);
  expect(minute[0].properties).toEqual(["transform"]);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".wallpaper-flask-clock-second")!).animationTimingFunction), "the second hand steps").toMatch(/^steps\(60/);
  // The angle of the second hand against the time: it does not move inside a second and jumps 6 degrees on the beat.
  const angleAt = (time: number) => page.evaluate((ms) => {
    const hand = document.querySelector(".wallpaper-flask-clock-second")!;
    const animation = document.getAnimations().find((candidate) => (candidate.effect as KeyframeEffect).target === hand)!;
    animation.pause();
    animation.currentTime = ms;
    const [a, b] = getComputedStyle(hand).transform.replace(/matrix\(|\)/g, "").split(",").map(Number);
    return (Math.atan2(b, a) * 180) / Math.PI;
  }, time);
  const wrap = (value: number) => ((value + 540) % 360) - 180;
  const start = await angleAt(0);
  expect(Math.abs(wrap((await angleAt(990)) - start)), "no creeping between beats").toBeLessThan(0.01);
  expect(Math.abs(wrap((await angleAt(1010)) - start) - 6), "a 6 degree step on the beat").toBeLessThan(0.05);
  expect(Math.abs(Math.abs(wrap((await angleAt(30_500)) - start)) - 180), "half a turn in 30 s").toBeLessThan(0.05);
  // Both hands turn around the dial centre: the middle of a hand's box walks round the middle of the dial.
  const handsAround = async (selector: string, times: number[]) => page.evaluate(([query, stops]) => {
    const hand = document.querySelector(query as string)!;
    const dial = document.querySelector(".wallpaper-flask-clock-face")!.getBoundingClientRect();
    const animation = document.getAnimations().find((candidate) => (candidate.effect as KeyframeEffect).target === hand)!;
    animation.pause();
    const centres = (stops as number[]).map((ms) => {
      animation.currentTime = ms;
      const box = hand.getBoundingClientRect();
      return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    });
    return { centres, middle: { x: (dial.left + dial.right) / 2, y: (dial.top + dial.bottom) / 2 }, radius: dial.width / 2 };
  }, [selector, times] as const);
  const secondRound = await handsAround(".wallpaper-flask-clock-second", [0, 15_000, 30_000, 45_000]);
  const meanX = secondRound.centres.reduce((sum, point) => sum + point.x, 0) / 4, meanY = secondRound.centres.reduce((sum, point) => sum + point.y, 0) / 4;
  expect(Math.abs(meanX - secondRound.middle.x), "second hand pivots on the dial centre (x)").toBeLessThan(secondRound.radius * 0.12);
  expect(Math.abs(meanY - secondRound.middle.y), "second hand pivots on the dial centre (y)").toBeLessThan(secondRound.radius * 0.12);
  const spread = Math.max(...secondRound.centres.map((point) => point.x)) - Math.min(...secondRound.centres.map((point) => point.x));
  expect(spread, "the second hand sweeps round the dial").toBeGreaterThan(secondRound.radius * 0.6);
  const minuteRound = await handsAround(".wallpaper-flask-clock-minute", [0, 900_000, 1_800_000, 2_700_000]);
  const minuteSpread = Math.max(...minuteRound.centres.map((point) => point.y)) - Math.min(...minuteRound.centres.map((point) => point.y));
  expect(minuteSpread, "the minute hand sweeps round the dial too").toBeGreaterThan(minuteRound.radius * 0.5);
  if (isPhone(testInfo.project.name)) {
    const [dial] = await rectsOf(page, ".wallpaper-flask-clock-face");
    expect(dial.hidden, "a phone shows the clock").toBe(false);
    expect(insideViewport(dial, page), "the dial is whole in a phone's frame").toBe(true);
  }
});

test("[STAB-VIS-02] D-54 the shelf vessels move: every vessel with liquid on the back shelf has one overflow cycle of its own (duration and phase), opacity and transform only", async ({ page }, testInfo) => {
  await openFlasks(page, { motion: "on" });
  const liquids = await page.locator(".wallpaper-flask-scene-liquid").count();
  expect(liquids, "fourteen shelf vessels hold liquid").toBe(SHELF_CYCLES.length);
  const cycles = await cyclesOf(page, ".wallpaper-flask-scene-liquid");
  expect(cycles, "exactly one animation on each shelf liquid").toHaveLength(SHELF_CYCLES.length);
  for (const cycle of cycles) {
    expect(cycle.iterations).toBe(Infinity);
    expect(cycle.properties, "only opacity and transform").toEqual(["opacity", "transform"]);
    expect(cycle.duration, "5–11 s").toBeGreaterThanOrEqual(5_000);
    expect(cycle.duration).toBeLessThanOrEqual(11_000);
    expect({ duration: cycle.duration, delay: cycle.delay }, `shelf vessel ${cycle.index} follows the table`).toEqual(SHELF_CYCLES[cycle.index]);
  }
  const pairs = cycles.map((cycle) => `${cycle.duration}/${cycle.delay}`);
  expect(new Set(pairs).size, "duration and phase differ pair by pair").toBe(pairs.length);
  expect(new Set(cycles.map((cycle) => cycle.duration)).size, "every vessel has its own length").toBe(cycles.length);
  expect(new Set(cycles.map((cycle) => cycle.delay)).size, "every vessel has its own phase").toBe(cycles.length);
  // First opacity peaks: the time of the first maximum counted from now.
  const peaks = cycles.map((cycle) => cycle.firstPeakMs!);
  expect(peaks.every((peak) => peak !== null), "every cycle has an opacity peak").toBe(true);
  const sorted = [...peaks].sort((a, b) => a - b);
  for (let at = 1; at < sorted.length; at += 1) expect(sorted[at] - sorted[at - 1], "the first peaks of two shelf vessels are more than 300 ms apart").toBeGreaterThan(300);
  if (isPhone(testInfo.project.name)) {
    const shown = (await rectsOf(page, ".wallpaper-flask-scene-liquid")).filter((box) => !box.hidden && insideViewport(box, page));
    expect(shown.length, "a phone sees moving shelf vessels").toBeGreaterThanOrEqual(3);
  }
});

// D-59 (20-47): the owner's verdict of 2026-11-07 — «убрать лишние часы ведь их там два» — one dial only. The pressure gauge under the shelf (x 1112, y 424, r 24) had the same
// round face with a scale and a needle as the ticking clock (x 1258, y 414, r 24); the gauge is gone and the clock stays. Units are the 1440x900 wallpaper frame.
test("[STAB-VIS-02] D-59 one clock: the drawing has one round dial (the ticking clock), and nothing is drawn where the pressure gauge used to hang", async ({ page }) => {
  await openFlasks(page, { motion: "on" });
  expect(await page.locator(".wallpaper-flasks .wallpaper-flask-clock").count(), "one clock group").toBe(1);
  const probe = await page.evaluate(() => {
    const zone = { left: 1084, right: 1140, top: 396, bottom: 458 }; // the old gauge: dial 1088..1136 x 400..448 and a foot down to 454, with a margin
    const inside = (x: number, y: number) => x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
    const strokes = [...document.querySelectorAll<SVGGeometryElement>(".wallpaper-flask-stand path, .wallpaper-flask-stand circle, .wallpaper-flask-stand rect, .wallpaper-flask-scene-wall path, .wallpaper-flask-scene-wall circle")];
    const hits = strokes.filter((shape) => {
      // Sampled along the outline, not by the box of the whole path (a long path with several sub-paths has a box that covers the zone by accident).
      const length = shape.getTotalLength();
      for (let at = 0; at <= length; at += 2) { const point = shape.getPointAtLength(at); if (inside(point.x, point.y)) return true; }
      return false;
    }).map((shape) => `${shape.tagName} ${(shape.getAttribute("d") ?? shape.getAttribute("class") ?? "").slice(0, 40)}`);
    // Any other circle with a dial-sized radius outside the clock.
    const dials = [...document.querySelectorAll<SVGCircleElement>(".wallpaper-flasks circle")].filter((circle) => circle.r.baseVal.value >= 20 && !circle.closest(".wallpaper-flask-clock")).length;
    return { hits, dials, scaled: strokes.length };
  });
  expect(probe.scaled, "the probe saw the drawing").toBeGreaterThan(20);
  expect(probe.hits, "no stroke of the bench or the wall inside the former gauge area (x 1084-1140, y 396-458)").toEqual([]);
  expect(probe.dials, "no second round dial").toBe(0);
});

// D-59 (20-47): the wave on the oscilloscope screen runs. The trace is its own element under a clip group (the clip must not move with the trace), it is the same sine
// as before and two periods longer, one animation shifts it by one period (24 units) per cycle, so the loop has no seam. Opacity is not touched: the brightness of the wave stays
// at the strength of the other strokes (the peak-contrast tests hold).
test("[STAB-VIS-02] D-59 the oscilloscope wave moves: one endless linear shift of exactly one period (24 units) per cycle, clipped by the screen, still in the stopped modes", async ({ page }) => {
  await openFlasks(page, { motion: "on" });
  const cycles = await cyclesOf(page, ".wallpaper-flask-scope-trace");
  expect(cycles, "exactly one animation on the trace").toHaveLength(1);
  expect(cycles[0].iterations, "the wave runs for ever").toBe(Infinity);
  expect(cycles[0].properties, "keyframes touch transform only").toEqual(["transform"]);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".wallpaper-flask-scope-trace")!).animationTimingFunction), "a constant speed").toBe("linear");
  const probe = await page.evaluate(() => {
    const trace = document.querySelector<SVGPathElement>(".wallpaper-flask-scope-trace")!;
    const animation = document.getAnimations().find((candidate) => (candidate.effect as KeyframeEffect).target === trace)!;
    const timing = animation.effect!.getTiming();
    const duration = Number(timing.duration), delay = Number(timing.delay);
    animation.pause();
    // `ms` is the time inside the cycle; the phase delay is added and the time wrapped into one cycle (a negative current time is not honoured, and the cycle repeats for ever).
    const at = (ms: number) => { animation.currentTime = (((ms + delay) % duration) + duration) % duration; return new DOMMatrixReadOnly(getComputedStyle(trace).transform).m41; };
    const shifts = { start: at(0), middle: at(duration / 2), end: at(duration - 1) };
    const clipGroup = trace.parentElement!;
    const clipId = /url\(#([^)]+)\)/.exec(clipGroup.getAttribute("clip-path") ?? "")?.[1] ?? null;
    const clipRect = clipId ? document.getElementById(clipId)?.querySelector("rect") : null;
    return { shifts, ownClip: trace.getAttribute("clip-path"), clipRect: clipRect ? { x: clipRect.x.baseVal.value, y: clipRect.y.baseVal.value, width: clipRect.width.baseVal.value, height: clipRect.height.baseVal.value } : null, d: trace.getAttribute("d") ?? "" };
  });
  expect(probe.shifts.start, "the loop starts at rest").toBeCloseTo(0, 3);
  expect(probe.shifts.middle, "constant speed: half a period at half a cycle").toBeCloseTo(12, 1);
  expect(probe.shifts.end, "a whole period of 24 units at the end of the cycle").toBeGreaterThan(23.9);
  expect(probe.shifts.end).toBeLessThanOrEqual(24);
  const match = /^M(\d+) 520q6-26 12 0((?:t12 0)+)$/.exec(probe.d);
  expect(match, "the same sine as before: half-waves of 12 units (period 24) on the screen centre line").not.toBeNull();
  expect(Math.abs((Number(match![1]) - 922) % 24), "the trace starts a whole number of periods from the old start, so the picture is the same").toBe(0);
  // The trace slides right by up to 24 units, so the window of the screen (x 918-996) looks at path x 918-s .. 996-s: the path must cover x 894 .. 996.
  expect(Number(match![1]) + 12 * (1 + match![2].length / 5), "the trace reaches the right edge of the screen").toBeGreaterThanOrEqual(996);
  expect(Number(match![1]), "and starts a period left of the screen, so the left edge is never bare").toBeLessThanOrEqual(918 - 24);
  expect(probe.ownClip, "the clip sits on the group, not on the moving trace").toBeNull();
  expect(probe.clipRect, "the trace is clipped by the screen of the oscilloscope").toEqual({ x: 918, y: 466, width: 78, height: 80 });
  // Stopped modes: no animation, the trace is in place.
  await openFlasks(page, { motion: "off" });
  expect(await page.locator(".wallpaper-flask-scope-trace").count(), "the trace is drawn in «Выключены»").toBe(1);
  expect(await cyclesOf(page, ".wallpaper-flask-scope-trace"), "no animation in «Выключены»").toHaveLength(0);
  expect(await page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".wallpaper-flask-scope-trace")!).transform).m41), "the resting position").toBe(0);
});

// D-54 (20-37): the endless-animation limit inside the drawing goes from 100 to 140 and a limit of 80 is added for the animations a phone actually shows.
// The old number was a technical guide set by plan 20-36, not by the owner; D-54 asks for more motion; the extra motion is only opacity and transform
// (compositor properties) and no page code reads layout per frame. Merging the shelf cycles into shared groups was rejected: the owner has already complained
// about uniformity (D-51). The budget on real hardware stays BLOCKED until 20-14.
const MAX_INFINITE_ANIMATIONS = 140, MAX_PHONE_ANIMATIONS = 80;

test("[STAB-A11Y-04] D-54 budget: at most 140 endless animations in the drawing on a PC and 80 shown on a phone, only opacity and transform inside it", async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await openFlasks(page, { motion: "on" });
  const probe = await page.evaluate(() => {
    const inside = document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks"));
    const shown = inside.filter((animation) => {
      for (let node: Element | null = (animation.effect as KeyframeEffect).target as Element; node; node = node.parentElement) if (getComputedStyle(node).display === "none") return false;
      return true;
    });
    const properties = [...new Set(inside.flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().flatMap((frame) => Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)))))].sort();
    const finite = inside.filter((animation) => animation.effect!.getTiming().iterations !== Infinity).length;
    const infinite = inside.filter((animation) => animation.effect!.getTiming().iterations === Infinity).length;
    const shownInfinite = shown.filter((animation) => animation.effect!.getTiming().iterations === Infinity).length;
    const shelfLiquids = [...document.querySelectorAll(".wallpaper-flask-scene-liquid")].filter((element) => { for (let node: Element | null = element; node; node = node.parentElement) if (getComputedStyle(node).display === "none") return false; return true; }).length;
    return { total: inside.length, finite, infinite, shownInfinite, properties, shelfLiquids, vessels: [...document.querySelectorAll<SVGGElement>(".wallpaper-flask")].filter((flask) => getComputedStyle(flask).display !== "none").length };
  });
  writeRun(`flasks-animation-count--${project}.json`, { project, infiniteAnimationsInDrawing: probe.infinite, shownInfiniteAnimations: probe.shownInfinite, finiteAnimations: probe.finite, shownVessels: probe.vessels, shownShelfVessels: probe.shelfLiquids, budgetPc: MAX_INFINITE_ANIMATIONS, budgetPhoneShown: MAX_PHONE_ANIMATIONS, properties: probe.properties });
  expect(probe.properties, "every keyframe inside the drawing animates only opacity and transform (D-54)").toEqual(["opacity", "transform"]);
  expect(probe.finite, "nothing inside the drawing is a one-shot").toBe(0);
  expect(probe.infinite, "endless animations inside the drawing (D-54: 140, was 100)").toBeLessThanOrEqual(MAX_INFINITE_ANIMATIONS);
  expect(probe.infinite, "and the drawing is really busy").toBeGreaterThan(probe.vessels * 5);
  if (isPhone(project)) expect(probe.shownInfinite, "animations with a displayed target on a phone (D-54: new limit 80)").toBeLessThanOrEqual(MAX_PHONE_ANIMATIONS);
});

// D-54 (20-37): the label contrast is measured not only in the stopped frame but at the brightest moment — every animation of the drawing paused at the
// moment its own opacity is the highest (an animation without opacity at its start).
for (const accent of accents) {
  test(`[STAB-VIS-02] D-54 (20-37) peak: the shortcut label stays readable over the brightest part of the drawing when every animation is at its brightest, on the ${accent.label}`, async ({ page }, testInfo) => {
    await openFlasks(page, { ...accent.settings, motion: "on" });
    await page.waitForTimeout(700); // the layer's own fade-in is a real-time animation outside the drawing
    const clip = await measureClip(page);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        const target = effect?.target as Element | null;
        if (!effect || !target?.closest(".wallpaper-flasks")) continue;
        const timing = effect.getTiming();
        let best = -1, at = 0;
        for (const frame of effect.getKeyframes()) {
          if (frame.opacity === undefined || frame.opacity === null) continue;
          const value = Number.parseFloat(String(frame.opacity));
          if (value > best) { best = value; at = Number(frame.computedOffset); }
        }
        animation.pause();
        // The seek time is wrapped into one cycle: a negative current time (a phase delay longer than the peak) is not honoured by the browser.
        const cycle = Number(timing.duration);
        animation.currentTime = (((Number(timing.delay) + at * cycle) % cycle) + cycle) % cycle;
      }
    });
    const peakCount = await page.evaluate(() => document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks") && animation.playState === "paused").length);
    expect(peakCount, "every animation of the drawing is held at its peak").toBeGreaterThan(50);
    const region = await lumaStats(page, await page.screenshot({ clip, animations: "allow" }), await page.evaluate(() => window.devicePixelRatio));
    const label = await page.evaluate(() => {
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.fillStyle = getComputedStyle(document.querySelector(".desktop-icon")!).color;
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      const linear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
      return { rgb: [r, g, b], luminance: 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) };
    });
    const contrast = (label.luminance + 0.05) / (region.area + 0.05);
    writeRun(`flasks-contrast-peak-${accent.id}--${testInfo.project.name}.json`, { accent: accent.id, project: testInfo.project.name, animationsAtPeak: peakCount, labelRgb: label.rgb, labelLuminance: label.luminance, brightest8pxSquareLuminance: region.area, brightestSinglePixelLuminance: region.peak, contrastOver8pxSquare: contrast, textThreshold: 4.5, clip });
    expect(contrast, `shortcut label vs the brightest 8 px square at the peak of every animation (${accent.label})`).toBeGreaterThanOrEqual(4.5);
  });
}

// The wallpaper is CSS-only: this counts layout reads from page code over 3 s of real time (against the quiet wallpaper as a control) and records a Chromium
// trace as evidence. A frame budget needs an approved number and a device; neither exists yet, so that part is BLOCKED and never a pass.
test("[STAB-A11Y-04] wallpaper trace: no per-frame layout reads or React work; the frame budget is recorded BLOCKED", async ({ page, browser, determinism }, testInfo) => {
  const countReads = async (wallpaper: string) => {
    await openFlasks(page, { wallpaper, motion: "on" });
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
    await page.waitForTimeout(3_000);
    return page.evaluate(() => (window as unknown as { __layoutReads: { reads: number } }).__layoutReads.reads);
  };
  const control = await countReads("quiet");
  const reads = await countReads("flasks");

  await openFlasks(page, { motion: "on" });
  mkdirSync(runRoot, { recursive: true });
  const tracePath = path.join(runRoot, `phase20-flasks-trace--${testInfo.project.name}.json`);
  await browser.startTracing(page, { path: tracePath, categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "viz", "blink"] });
  await page.waitForTimeout(3_000);
  const trace = JSON.parse((await browser.stopTracing()).toString("utf8")) as { traceEvents: Array<{ name: string; ph: string; dur?: number }> };
  const durations = (name: string) => trace.traceEvents.filter((event) => event.name === name && event.ph === "X" && typeof event.dur === "number").map((event) => event.dur! / 1000).sort((a, b) => a - b);
  const summary = (name: string) => { const values = durations(name); return { count: values.length, p50Ms: values[Math.floor(values.length * 0.5)] ?? null, p95Ms: values[Math.floor(values.length * 0.95)] ?? null, maxMs: values.at(-1) ?? null }; };
  writeRun(`phase20-flasks-trace-summary--${testInfo.project.name}.json`, {
    project: testInfo.project.name, seconds: 3, traceFile: path.relative(process.cwd(), tracePath).replaceAll("\\", "/"), events: trace.traceEvents.length,
    layoutReadsFromPageCode: reads, controlLayoutReadsQuietWallpaper: control, Layout: summary("Layout"), UpdateLayoutTree: summary("UpdateLayoutTree"), Paint: summary("Paint"), RunTask: summary("RunTask"),
    note: "headless Chromium emulation; not a physical device and not compared with an approved budget",
  });
  expect(trace.traceEvents.length, "the trace has events").toBeGreaterThan(100);
  expect(reads, "the flask wallpaper adds no layout reads from page code").toBeLessThanOrEqual(control);
  await recordBlockedCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-flasks-frame-budget",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: "flask wallpaper frame time on PC and phone hardware against an approved budget",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/phase20-flasks-frame-budget--${testInfo.project.name}.png`,
  }, {
    reasonCode: "MOTION_CAPTURE_BOUNDARY_REQUIRED",
    recoveryPhase: 20,
    reason: "No frame budget has been approved and no physical PC or phone was measured. The headless trace and the zero added layout reads are recorded as evidence only; the budget stays BLOCKED until the physical-device check in 20-14.",
  });
});
