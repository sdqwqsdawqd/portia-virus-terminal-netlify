import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page, Route } from "@playwright/test";
import { emptyCopy, failureCopy, iframeFailureCopy } from "../../../lib/app-state.ts";
import { DesktopPage } from "../pages/desktop.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

// Phase 20-05 (D-21): the new 96x96 flask («Информация», «Новостей пока нет») and the new 96x96 microscope («Справочник», empty) next to the
// surfaces that keep their old drawing (quests, archive, global search, the iframe error and every error panel).
// Candidates only: every frame goes under visual-candidates/.runs; nothing here touches tests/e2e/visual/__screenshots__.
// The requirement id of a frame is STAB-BASE-03 because that is the only family support.ts accepts; the evidence belongs to STAB-VIS-03.
// The spec reads the real /api answers of the target and only injects faults into them (abort or hold, never fulfil): own /api routes are never
// answered with invented data. A state the target cannot show without that is recorded BLOCKED (DATA) and skipped, never counted as a pass.

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20 empty-art candidates run on chromium-desktop and chromium-phone.");
});

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${sourceCommit.slice(0, 12)}`;
const runRoot = path.resolve("tests/e2e/visual-candidates/.runs", setId);

type Context = Parameters<typeof captureCandidate>[0];
type Settings = Record<string, string>;
type Drawing = "flask" | "flaskEmpty" | "microscope" | "microscopeGuide";

async function setDesktopSetting(page: Page, patch: Settings) {
  await page.evaluate((next) => {
    const key = "portia-desktop-settings-v1";
    window.localStorage.setItem(key, JSON.stringify({ ...JSON.parse(window.localStorage.getItem(key) ?? "{}"), ...next }));
  }, patch);
}

async function openDesktop(page: Page, patch: Settings = {}) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  if (Object.keys(patch).length) {
    await setDesktopSetting(page, patch);
    await page.reload();
    await desktop.desktop.waitFor();
  }
  return desktop;
}

const accents: Array<{ id: string; label: string; settings: Settings }> = [
  { id: "default", label: "standard accent", settings: { accent: "teal", customAccent: "", motion: "on" } },
  { id: "custom-dark", label: "very dark «Свой» accent #1a1a1a", settings: { accent: "custom", customAccent: "#1a1a1a", motion: "on" } },
  { id: "custom-light", label: "very light «Свой» accent #f2f2f2", settings: { accent: "custom", customAccent: "#f2f2f2", motion: "on" } },
];
const staticDefault = { id: "default-static", label: "standard accent, motion off (static frame)", settings: { accent: "teal", customAccent: "", motion: "off" } };

// ---- faults on the real answers (never an invented one) -------------------------------------------------------------------------

async function abortApi(page: Page, pattern: string) {
  await page.route(pattern, (route) => route.abort("failed"));
  return () => page.unroute(pattern);
}

async function holdRoute(page: Page, pattern: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(pattern, async (route: Route) => {
    await gate;
    await route.fallback().catch(() => undefined);
  });
  return release;
}

/** The faults this spec causes on purpose; every other diagnostic still fails the test. */
function forgiveFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "requestfailed" && /ERR_FAILED|ERR_ABORTED|NS_ERROR|Failed|aborted|Blocked by Web Inspector|cancelled/i.test(entry.text))
    || (entry.kind === "console" && /Failed to load resource|ERR_FAILED/i.test(entry.text))
    || (entry.kind === "response" && /sdqwqsdawqd.github.io/.test(entry.text))
    || (entry.kind === "console" && /sdqwqsdawqd.github.io/.test(entry.source))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

// ---- the three chosen surfaces ----------------------------------------------------------------------------------------------------

type Surface = {
  key: "info" | "news" | "guide";
  app: string;
  name: string;
  /** Drawing in the empty state (the D-21 variant). */
  drawing: Drawing;
  /** Drawing of the error panel of the same app: unchanged by D-21. */
  fatalDrawing: Drawing;
  copy: { heading: string; body: string };
  records: (window: Locator) => Locator;
  box: (window: Locator) => Locator;
  /** Switches to the tab that shows this surface. */
  prepare?: (window: Locator) => Promise<void>;
};

const surfaces: Surface[] = [
  { key: "info", app: "Информация", name: "«Информация», пусто", drawing: "flaskEmpty", fatalDrawing: "flask", copy: emptyCopy.info, records: (w) => w.locator(".info-index button"), box: (w) => w.locator(".app-state-body .empty-state") },
  { key: "news", app: "Сводка", name: "«Сводка» → «Новости», пусто", drawing: "flaskEmpty", fatalDrawing: "flask", copy: emptyCopy.news, records: (w) => w.locator(".broadcast-card"), box: (w) => w.locator(".broadcast-empty"), prepare: async (w) => { await w.getByRole("button", { name: /^Новости/ }).click(); } },
  { key: "guide", app: "Справочник", name: "«Справочник», пусто", drawing: "microscopeGuide", fatalDrawing: "microscope", copy: emptyCopy.guide, records: (w) => w.locator(".guide-tile"), box: (w) => w.locator(".guide-empty") },
];

const skeleton = (window: Locator) => window.locator('.app-skeleton[aria-busy="true"]').first();
const fatalPanel = (window: Locator) => window.locator(".app-fatal-panel");

async function blocked(context: Context, id: string, surface: string, state: string, reason: string) {
  await recordBlockedCandidate(context, {
    id, requirement: "STAB-BASE-03", surface, actor: "visitor", state,
    intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
  }, { reasonCode: "PUBLIC_STATE_FIXTURE_REQUIRED", recoveryPhase: 20, reason });
}

async function openSurface(page: Page, s: Surface, patch: Settings = {}) {
  const desktop = await openDesktop(page, patch);
  await desktop.openApp(s.app);
  return desktop.window(s.app);
}

/** Crop of one element next to the full frame: the 96px drawing and its text are readable at this size. */
async function crop(box: Locator, id: string, testInfo: { project: { name: string } }) {
  mkdirSync(runRoot, { recursive: true });
  await box.screenshot({ path: path.join(runRoot, `${id}--${testInfo.project.name}.crop.png`), animations: "disabled" });
}

/** Contrast of the drawing against its own background: the farthest pixel of the element screenshot against the mean of its four corners. */
async function drawingContrast(page: Page, svg: Locator) {
  const png = (await svg.screenshot({ animations: "disabled" })).toString("base64");
  return page.evaluate(async (base64: string) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const linear = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = (i: number) => 0.2126 * linear(data[i]) + 0.7152 * linear(data[i + 1]) + 0.0722 * linear(data[i + 2]);
    const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4];
    const background = corners.reduce((sum, i) => sum + lum(i), 0) / corners.length;
    let max = 0, min = 1;
    for (let i = 0; i < data.length; i += 4) { const l = lum(i); if (l > max) max = l; if (l < min) min = l; }
    const ratio = Math.max((max + 0.05) / (background + 0.05), (background + 0.05) / (min + 0.05));
    return { background, max, min, ratio };
  }, png);
}

/** Waits for the finite opening animations of a window (it scales in), so bounding boxes are measured at rest. */
async function settle(window: Locator) {
  await window.evaluate((node) => Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))));
}

/** What an empty state must be: the named drawing, decorative, 96x96, inside the window, with the Russian text carrying the meaning. */
async function assertEmptyDrawing(page: Page, window: Locator, s: Surface) {
  const box = s.box(window);
  await expect(box).toBeVisible();
  await settle(window);
  const svg = box.locator("svg");
  await expect(svg).toHaveCount(1);
  await expect(svg).toHaveAttribute("data-illustration", s.drawing);
  await expect(svg).toHaveAttribute("aria-hidden", "true");
  await expect(svg).toHaveAttribute("viewBox", "0 0 96 96");
  await expect(box.locator("strong")).toHaveText(s.copy.heading);
  await expect(box.locator("span")).toHaveText(s.copy.body);
  const frame = await window.boundingBox();
  const drawn = await svg.boundingBox();
  const text = await box.locator("strong").boundingBox();
  expect(frame && drawn && text).toBeTruthy();
  expect(await svg.evaluate((node) => [node.getBoundingClientRect().width, node.getBoundingClientRect().height]), "the drawing keeps 96 CSS px").toEqual([96, 96]);
  for (const part of [drawn!, text!]) {
    expect(part.x).toBeGreaterThanOrEqual(frame!.x - 0.5);
    expect(part.x + part.width).toBeLessThanOrEqual(frame!.x + frame!.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth), "no page-level horizontal scroll").toBe(true);
  return { svg, box };
}

// ---- the drawings themselves (source level, same for every lane) ---------------------------------------------------------------------

// sha256 of the three pre-plan drawings, taken from components/portia-icons.tsx at 8c05499 (before this plan): they must stay byte for byte.
const oldDrawings = {
  dish: "6a19e541ecf41b5b8f9d345ee213fce172606d3a78aa44e9fa9797473fe09cdb",
  microscope: "1177e355fdae3fe64684b2f10429114f2c65af494151d5711c5691121d03de36",
  flask: "aca34412817a33b5adb4cf8eebfb4a2f901b97977615fd6643eb726b4e4bf56d",
} as const;

function drawingSource(name: string) {
  const source = readFileSync(path.resolve("components/portia-icons.tsx"), "utf8").replaceAll("\r\n", "\n");
  const match = source.match(new RegExp(`  ${name}: <>\\n([\\s\\S]*?)\\n  </>,`));
  expect(match, `drawing ${name} exists`).not.toBeNull();
  return match![1];
}

test("[STAB-VIS-03] D-21 the old flask, microscope and dish are byte-identical; the two new drawings exist, differ, and use only currentColor", async ({}, testInfo) => {
  for (const [name, hash] of Object.entries(oldDrawings)) {
    expect(createHash("sha256").update(drawingSource(name)).digest("hex"), `${name} is unchanged`).toBe(hash);
  }
  const fresh = { flaskEmpty: drawingSource("flaskEmpty"), microscopeGuide: drawingSource("microscopeGuide") };
  expect(fresh.flaskEmpty).not.toBe(drawingSource("flask"));
  expect(fresh.microscopeGuide).not.toBe(drawingSource("microscope"));
  for (const source of Object.values(fresh)) expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(|var\(/i);
  // Only the three chosen call sites name a new variant.
  const users = ["components/portia-desktop.tsx", "components/portia-desktop-documents.tsx"].flatMap((file) =>
    readFileSync(path.resolve(file), "utf8").split(/\r?\n/).map((line, index) => ({ file, line: index + 1, text: line })).filter((row) => /flaskEmpty|microscopeGuide/.test(row.text)));
  expect(users.map((row) => `${row.file}:${/flaskEmpty/.test(row.text) ? (/broadcastTab/.test(row.text) ? "news" : "info") : "guide"}`).sort()).toEqual([
    "components/portia-desktop-documents.tsx:guide", "components/portia-desktop.tsx:info", "components/portia-desktop.tsx:news",
  ]);
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(path.join(runRoot, `phase20-empty-art-drawings--${testInfo.project.name}.json`), `${JSON.stringify({ oldDrawingSha256: oldDrawings, newDrawingSha256: Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, createHash("sha256").update(v).digest("hex")])), callSites: users }, null, 2)}\n`);
});

// ---- E3/E6: loading, error, populated for the three surfaces ----------------------------------------------------------------------------

for (const s of surfaces) {
  test(`[STAB-VIS-03] ${s.name}: loading keeps the skeleton and draws no empty state`, async ({ page, browser, determinism }, testInfo) => {
    const context = { page, browser, determinism, testInfo };
    const release = await holdRoute(page, "**/api/content");
    const window = await openSurface(page, s);
    await expect(skeleton(window)).toBeVisible();
    await expect(window.locator("svg[data-illustration]")).toHaveCount(0);
    await expect(s.box(window)).toHaveCount(0);
    await captureCandidate(context, {
      id: `empty-art-${s.key}-loading`, requirement: "STAB-BASE-03", surface: `E3/E6 ${s.app}`, actor: "visitor",
      state: `${s.app}: first load held, skeleton shown, no empty drawing`, intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
    });
    release();
    await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
  });

  test(`[STAB-VIS-03] ${s.name}: error shows the reason and the retry with the old drawing, not the empty state`, async ({ page, browser, determinism, diagnostics }, testInfo) => {
    const context = { page, browser, determinism, testInfo };
    const restore = await abortApi(page, "**/api/content");
    const window = await openSurface(page, s);
    const panel = fatalPanel(window);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("alert")).toContainText(failureCopy.offline.heading);
    await expect(panel.getByRole("button", { name: "Повторить загрузку" })).toBeEnabled();
    await expect(panel.locator("svg")).toHaveAttribute("data-illustration", s.fatalDrawing);
    await expect(panel.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(window.getByText(s.copy.heading)).toHaveCount(0);
    await captureCandidate(context, {
      id: `empty-art-${s.key}-error`, requirement: "STAB-BASE-03", surface: `E3/E6 ${s.app}`, actor: "visitor",
      state: `${s.app}: first load failed, reason and retry shown on the unchanged ${s.fatalDrawing} drawing`, intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
    });
    await restore();
    forgiveFaults(diagnostics);
  });

  test(`[STAB-VIS-03] ${s.name}: populated hides the empty drawing`, async ({ page, browser, determinism }, testInfo) => {
    const context = { page, browser, determinism, testInfo };
    const window = await openSurface(page, s);
    await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
    await s.prepare?.(window);
    if (await s.records(window).count() === 0) {
      const reason = `BLOCKED (DATA): this target serves no records for ${s.app}, so the populated state cannot be shown without invented data.`;
      await blocked(context, `empty-art-${s.key}-populated`, `E3/E6 ${s.app}`, `${s.app}: populated`, reason);
      test.skip(true, reason);
    }
    await expect(s.box(window)).toHaveCount(0);
    await expect(window.locator("svg[data-illustration]")).toHaveCount(0);
    await captureCandidate(context, {
      id: `empty-art-${s.key}-populated`, requirement: "STAB-BASE-03", surface: `E3/E6 ${s.app}`, actor: "visitor",
      state: `${s.app}: populated from the served content, empty drawing absent`, intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
    });
  });
}

// ---- E3/E6: the empty states, default and custom accent, full and static, PC and phone --------------------------------------------------

for (const accent of [...accents, staticDefault]) {
  for (const s of surfaces) {
    test(`[STAB-VIS-03] ${s.name}: new drawing on the ${accent.label}`, async ({ page, browser, determinism }, testInfo) => {
      const context = { page, browser, determinism, testInfo };
      const window = await openSurface(page, s, accent.settings);
      await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
      await s.prepare?.(window);
      if (!(await s.box(window).isVisible())) {
        const reason = `BLOCKED (DATA): this target serves ${await s.records(window).count()} record(s) for ${s.app}, so the empty state cannot be shown without invented data.`;
        await blocked(context, `empty-art-${s.key}-empty-${accent.id}`, `E3/E6 ${s.app}`, `${s.name}; ${accent.label}`, reason);
        test.skip(true, reason);
      }
      const { svg, box } = await assertEmptyDrawing(page, window, s);
      const contrast = await drawingContrast(page, svg);
      expect(contrast.ratio, `drawing against its background on the ${accent.label}`).toBeGreaterThanOrEqual(3);
      await crop(box, `empty-art-${s.key}-empty-${accent.id}`, testInfo);
      await captureCandidate(context, {
        id: `empty-art-${s.key}-empty-${accent.id}`, requirement: "STAB-BASE-03", surface: `E3/E6 ${s.app}`, actor: "visitor",
        state: `D-21 ${s.name}; ${accent.label}; new ${s.drawing}; drawing contrast ${contrast.ratio.toFixed(2)}`, intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
      });
      writeFileSync(path.join(runRoot, `empty-art-${s.key}-contrast-${accent.id}--${testInfo.project.name}.json`), `${JSON.stringify({ surface: s.key, accent: accent.id, project: testInfo.project.name, ...contrast, threshold: 3 }, null, 2)}\n`);
    });
  }
}

// ---- E3/E6: overflow and long text ---------------------------------------------------------------------------------------------------

for (const s of surfaces) {
  test(`[STAB-VIS-03] ${s.name}: a long heading and description wrap beside the drawing inside the window`, async ({ page }, testInfo) => {
    const window = await openSurface(page, s);
    await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
    await s.prepare?.(window);
    test.skip(!(await s.box(window).isVisible()), `BLOCKED (DATA): this target shows no empty state for ${s.app}; the wrapping probe needs one (the plain empty frame is recorded as BLOCKED by the accent tests).`);
    const box = s.box(window);
    await settle(window);
    // A layout probe on the live element, not content: the text node of the heading and the description is replaced by long phrases.
    await box.evaluate((node) => {
      node.querySelector("strong")!.textContent = "Очень длинный заголовок пустого состояния, который обязан переноситься на несколько строк рядом с рисунком";
      node.querySelector("span")!.textContent = "Описание тоже длинное: оно должно переноситься внутри окна, не накладываться на рисунок и не растягивать страницу по горизонтали ни на PC, ни на телефоне.";
    });
    const frame = (await window.boundingBox())!;
    const svg = (await box.locator("svg").boundingBox())!;
    const heading = (await box.locator("strong").boundingBox())!;
    const body = (await box.locator("span").boundingBox())!;
    expect(svg.width, "drawing keeps its size").toBeCloseTo(96, 0);
    expect(heading.height, "the heading wraps to several lines").toBeGreaterThan(24);
    for (const part of [svg, heading, body]) {
      expect(part.x).toBeGreaterThanOrEqual(frame.x - 0.5);
      expect(part.x + part.width).toBeLessThanOrEqual(frame.x + frame.width + 0.5);
    }
    expect(heading.y, "text starts below the drawing, no overlap").toBeGreaterThanOrEqual(svg.y + svg.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth), "no page-level horizontal scroll").toBe(true);
    await crop(box, `empty-art-${s.key}-long-text`, testInfo);
  });
}

// ---- unchanged surfaces, next to the new ones -------------------------------------------------------------------------------------------

test("[STAB-VIS-03] D-21 quests keep the old flask beside the new one in the news tab (same window, same state)", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const window = await openSurface(page, surfaces[1]);
  await expect(skeleton(window)).toHaveCount(0, { timeout: 20_000 });
  const tabs = { news: window.getByRole("button", { name: /^Новости/ }), quests: window.getByRole("button", { name: /^Квесты/ }) };
  await tabs.news.click();
  if (!(await window.locator(".broadcast-empty").isVisible()) || (await tabs.quests.click(), !(await window.locator(".broadcast-empty").isVisible()))) {
    const reason = "BLOCKED (DATA): this target serves announcements, so the empty news and quests tabs cannot be compared without invented data.";
    await blocked(context, "empty-art-quests-vs-news", "E3 Сводка", "«Новости» (новая колба) рядом с «Квесты» (прежняя колба)", reason);
    test.skip(true, reason);
  }
  await tabs.news.click();
  const news = window.locator(".broadcast-empty svg");
  await expect(news).toHaveAttribute("data-illustration", "flaskEmpty");
  const newMarkup = await news.innerHTML();
  await crop(window.locator(".broadcast-empty"), "empty-art-news-new-flask", testInfo);
  await tabs.quests.click();
  const quests = window.locator(".broadcast-empty svg");
  await expect(quests).toHaveAttribute("data-illustration", "flask");
  await expect(window.locator(".broadcast-empty strong")).toHaveText(emptyCopy.quests.heading);
  expect(await quests.innerHTML(), "the quests drawing is not the new one").not.toBe(newMarkup);
  await crop(window.locator(".broadcast-empty"), "empty-art-quests-old-flask", testInfo);
  await captureCandidate(context, {
    id: "empty-art-quests-old-flask", requirement: "STAB-BASE-03", surface: "E3 Сводка", actor: "visitor",
    state: "D-21 «Квесты» empty keeps the old flask; the new flask is in the «Новости» frame of the same window", intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
  });
});

test("[STAB-VIS-03] D-21 global search «Совпадений нет» keeps the old microscope, different from the guide microscope", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = await openDesktop(page);
  await desktop.openApp("Глобальный поиск");
  const search = desktop.window("Глобальный поиск");
  await search.getByRole("searchbox").fill("яяяяяяяяяяяяяя");
  const empty = search.locator(".global-search-empty");
  await expect(empty).toBeVisible();
  const old = empty.locator("svg");
  await expect(old).toHaveAttribute("data-illustration", "microscope");
  await expect(old).toHaveAttribute("aria-hidden", "true");
  await expect(empty.locator("strong")).toHaveText("Совпадений нет");
  const oldMarkup = await old.innerHTML();
  await crop(empty, "empty-art-search-old-microscope", testInfo);
  await captureCandidate(context, {
    id: "empty-art-search-old-microscope", requirement: "STAB-BASE-03", surface: "E6 Глобальный поиск", actor: "visitor",
    state: "D-21 global search with no match keeps the old microscope", intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
  });
  // The guide window in the same page: when it is empty it must draw something else.
  await desktop.closeApp("Глобальный поиск");
  await expect(search).toHaveCount(0);
  await desktop.openApp("Справочник");
  const guide = desktop.window("Справочник");
  await expect(skeleton(guide)).toHaveCount(0, { timeout: 20_000 });
  if (await guide.locator(".guide-empty").isVisible()) {
    const fresh = guide.locator(".guide-empty svg");
    await expect(fresh).toHaveAttribute("data-illustration", "microscopeGuide");
    expect(await fresh.innerHTML(), "the guide drawing is a new one").not.toBe(oldMarkup);
  }
});

test("[STAB-VIS-03] D-21 archive keeps the old microscope in its error panel; its empty state is BLOCKED (DATA) while the target serves viruses", async ({ page, browser, determinism, diagnostics }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  // Fault first: a successful load would leave a device cache and the failure would then read as a stale strip, not as the error panel.
  const restore = await abortApi(page, "**/api/content");
  let desktop = await openDesktop(page);
  await desktop.openApp("База вирусов");
  const panel = fatalPanel(desktop.window("База вирусов"));
  await expect(panel).toBeVisible();
  await expect(panel.locator("svg")).toHaveAttribute("data-illustration", "microscope");
  await captureCandidate(context, {
    id: "empty-art-archive-error-old-microscope", requirement: "STAB-BASE-03", surface: "E6 База вирусов", actor: "visitor",
    state: "D-21 archive error panel keeps the old microscope", intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
  });
  await restore();
  forgiveFaults(diagnostics);

  desktop = await openDesktop(page);
  await desktop.openApp("База вирусов");
  const archive = desktop.window("База вирусов");
  await expect(skeleton(archive)).toHaveCount(0, { timeout: 20_000 });
  if (await archive.locator(".virus-row").count() > 0) {
    await blocked(context, "empty-art-archive-empty-old-microscope", "E6 База вирусов", "«База вирусов», пусто (старый микроскоп)",
      "BLOCKED (DATA): this target serves viruses, so the archive empty state cannot be shown without invented data. The archive keeps microscope by the source check and by its error panel above.");
  } else {
    await expect(archive.locator(".record-empty svg")).toHaveAttribute("data-illustration", "microscope");
  }
});

test("[STAB-VIS-03] D-21 the iframe error of «Таблица» keeps the old microscope", async ({ page, browser, determinism, diagnostics }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const release = await holdRoute(page, "https://docs.google.com/**");
  const desktop = await openDesktop(page);
  await desktop.openApp("Таблица");
  const window = desktop.window("Таблица");
  await expect(skeleton(window)).toBeAttached();
  await page.clock.runFor(15_500);
  const panel = fatalPanel(window);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("alert")).toContainText(iframeFailureCopy.heading);
  await expect(panel.locator("svg")).toHaveAttribute("data-illustration", "microscope");
  await expect(panel.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await captureCandidate(context, {
    id: "empty-art-iframe-error-old-microscope", requirement: "STAB-BASE-03", surface: "E6 Таблица", actor: "visitor",
    state: "D-21 iframe error keeps the old microscope", intendedSnapshot: "phase20-empty-art (после одобрения 20-11)",
    mask: [window.locator("iframe")],
  });
  release();
  forgiveFaults(diagnostics);
});
