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
      tint.style.backgroundColor = "var(--desktop-base)";
      document.body.append(tint);
      const teal = getComputedStyle(tint).color;
      const desktopBase = getComputedStyle(tint).backgroundColor;
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
        desktopBase,
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
    if (accent.id === "custom-dark") {
      expect(probe.stroke, "the very dark custom accent gets a readable rim").toBe(probe.teal);
      expect(probe.stroke).not.toBe("rgb(2, 7, 6)");
      const channels = (value: string) => (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
      const linear = (channel: number) => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      const luminance = (value: string) => channels(value).reduce((sum, channel, index) => sum + linear(channel) * [.2126, .7152, .0722][index], 0);
      const light = luminance(probe.stroke), dark = luminance(probe.desktopBase);
      expect((Math.max(light, dark) + .05) / (Math.min(light, dark) + .05), "rim contrast against the desktop").toBeGreaterThanOrEqual(3);
    } else {
      expect(probe.stroke, "the accepted spider outline remains unchanged").toBe("rgb(2, 7, 6)");
    }
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
  await expect(desktop.spider, "D-45: the compositor layer exists while walking").toHaveAttribute("data-spider-walking", "");
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
  await expect(desktop.spider, "D-45: no layer once stopped").not.toHaveAttribute("data-spider-walking", /.*/);
  expect(await desktop.spider.evaluate((element) => getComputedStyle(element).willChange), "no will-change at rest").toBe("auto");
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
const SAVE_FAILED_TEXT = "Не удалось сохранить фон на этом устройстве. Остался прежний фон.";
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

test("[STAB-VIS-02] D-22 four flasks on PC, three on a phone, each with its own cycle; bubbles stay in the liquid; the glow is smooth", async ({ page, browser, determinism }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await openFlasks(page, { motion: "on" });
  await expect(page.locator(".wallpaper-flasks")).toBeAttached();
  const viewport = page.viewportSize()!;

  const boxes = await flaskBoxes(page);
  expect(boxes, "all four flasks are drawn").toHaveLength(4);
  const shown = boxes.filter((box) => box.display !== "none");
  if (phone) {
    expect(shown.length, "a phone shows two or three flasks").toBeGreaterThanOrEqual(2);
    expect(shown.length).toBeLessThanOrEqual(3);
  } else {
    expect(shown.length, "a PC shows four").toBe(4);
  }
  for (const box of shown) {
    expect(box.left, `flask ${box.index} is not cut at the left`).toBeGreaterThanOrEqual(0);
    expect(box.right, `flask ${box.index} is not cut at the right`).toBeLessThanOrEqual(viewport.width);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
  }
  if (!phone) expect(Math.min(...shown.map((box) => box.left)), "the group stands right of centre").toBeGreaterThan(viewport.width / 2);

  // Independent cycles: durations and delays are the authored candidates, all different.
  const timings = await page.evaluate(() => document.getAnimations().flatMap((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
    if (!target?.classList.contains("wallpaper-flask-liquid")) return [];
    const timing = animation.effect!.getTiming();
    if (getComputedStyle(target.closest(".wallpaper-flask")!).display === "none") return [];
    return [{ index: Number(target.closest<SVGGElement>(".wallpaper-flask")!.dataset.flask), duration: Number(timing.duration), delay: Number(timing.delay), name: (animation as CSSAnimation).animationName }];
  }).sort((a, b) => a.index - b.index));
  const wanted = [{ duration: 6800, delay: -1900 }, { duration: 8900, delay: -5200 }, { duration: 11300, delay: -3400 }, { duration: 7700, delay: -6100 }];
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
  expect(escapes.bubbles, "bubbles exist").toBeGreaterThanOrEqual(shown.length * 5);
  expect(escapes.out, `${escapes.checked} bubble positions checked`).toEqual([]);
  expect(await page.locator(".wallpaper-flask-bubbles[clip-path]").count(), "every bubble group is also clipped by the glass").toBe(4);

  // A frame of the full-motion wallpaper at a fixed animation time (the candidate; not an approved baseline).
  await seekFlasks(page, 4_000);
  await captureCandidate({ page, browser, determinism, testInfo }, {
    id: "phase20-flasks-full",
    requirement: "STAB-BASE-03",
    surface: "Flask wallpaper CANDIDATE",
    actor: "visitor",
    state: `D-22 «Лабораторные колбы», full motion, animations paused at 4.0 s; ${shown.length} flasks shown`,
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
    expect(probe.count).toBe(isPhone(testInfo.project.name) ? 3 : 4);
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
    stand: document.querySelectorAll(".wallpaper-flask-stand path").length,
    icon: document.querySelector(".desktop-icon")!.getBoundingClientRect().height,
    liquid: Number(getComputedStyle(document.querySelector(".wallpaper-flask-liquid")!).opacity),
    artOpacity: Number(getComputedStyle(document.querySelector(".desktop-wallpaper-flasks")!).opacity),
  }));
  expect(first.art && first.glass === 4 && first.stand >= 2, "the vector frame is in the DOM").toBe(true);
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
  test(`[STAB-VIS-02] the flasks on the ${accent.label}: behind windows, shortcuts and Vivian; label contrast over the brightest flask pixel`, async ({ page, browser, determinism }, testInfo) => {
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
    await page.addStyleTag({ content: ".desktop-icon, .desktop-assistant { visibility: hidden !important; }" });
    const boxes = (await flaskBoxes(page)).filter((box) => box.display !== "none");
    const viewport = page.viewportSize()!;
    const x = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.left)) - 20)), y = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.top)) - 20));
    const clip = { x, y, width: Math.min(viewport.width - x, Math.ceil(Math.max(...boxes.map((box) => box.right)) + 20 - x)), height: Math.min(viewport.height - y, Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + 90 - y)) };
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
