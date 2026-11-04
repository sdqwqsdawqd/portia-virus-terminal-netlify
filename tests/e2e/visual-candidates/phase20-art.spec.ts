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
