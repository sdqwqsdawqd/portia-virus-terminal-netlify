import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { expect, test as base } from "@playwright/test";
import type { Locator, Page, Request, TestInfo } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { test as portia } from "../fixtures/test";

// Phase 20-47: review extras for the owner's gallery (review.html). NOT ledger rows and NOT baselines: 20-12 never promotes anything from
// `extras/`. The files only let the owner judge what a still frame cannot show:
//   - the spider walking for 8 s of real walking on the standard and on the very dark «Свой» accent #1a1a1a (D-53, 20-40, 20-41);
//   - the full-motion «Лабораторные колбы» for 8 s (D-54, 20-42);
//   - the template builder's downloaded HTML and PNG and a snapshot of the HTML opened without a network (D-55, 20-43, 20-44).
// Real time, not a fake clock: the videos use Playwright's own `test` (no determinism fixture). Chromium only: chromium-desktop and chromium-phone.
//
// UI CONTRACT, NOT A ROLE PROOF (builder part): one answer is substituted, GET /api/promotion/status?nickname=, so the builder can be reached
// without a staging participant. This is not authenticated-role, server or staging evidence. A request tracker fails every test on any
// non-GET request to our own /api, any request to Supabase and any request to file uploads (zero write requests).

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${sourceCommit.slice(0, 12)}`;
const extrasRoot = path.resolve("tests/e2e/visual-candidates/.runs", setId, "extras");

function keep(source: string, name: string, testInfo: TestInfo, extension = path.extname(source)) {
  mkdirSync(extrasRoot, { recursive: true });
  const target = path.join(extrasRoot, `${name}--${testInfo.project.name}${extension}`);
  copyFileSync(source, target);
  return target;
}

const SETTINGS_KEY = "portia-desktop-settings-v1";
const baseSettings = { accent: "teal", wallpaper: "radar", iconSize: "standard", motion: "on", spider: "on", customAccent: "" };

function trackWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && (!readOnly || url.pathname.startsWith("/api/uploads"))) writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}

async function openRealTime(page: Page, patch: Record<string, string>) {
  const settings = { ...baseSettings, ...patch };
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem("portia-boot-seen-v1", "1");
  }, [SETTINGS_KEY, JSON.stringify(settings)] as const);
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.desktop.waitFor();
  await page.waitForLoadState("networkidle");
  return desktop;
}

/** Closes the page so the recording is finished, then keeps the video under extras/. */
async function keepVideo(page: Page, name: string, testInfo: TestInfo) {
  const video = page.video();
  expect(video, "the video recording is on").not.toBeNull();
  await page.close();
  const file = await video!.path();
  return keep(file, name, testInfo, ".webm");
}


base.use({ video: "on" });
base.beforeEach(({}, testInfo) => {
  base.skip(!lanes.has(testInfo.project.name), "Phase 20-47 review extras run on chromium-desktop and chromium-phone.");
});

const walkAccents = [
  { id: "default", label: "standard accent", settings: { accent: "teal", customAccent: "" } },
  { id: "custom-dark", label: "very dark «Свой» accent #1a1a1a", settings: { accent: "custom", customAccent: "#1a1a1a" } },
];

for (const accent of walkAccents) {
  base(`[STAB-VIS-01] D-53 review video: the spider walks for 8 s of real walking on the ${accent.label}`, async ({ page }, testInfo) => {
    base.setTimeout(120_000);
    const writes = trackWrites(page);
    const desktop = await openRealTime(page, { ...accent.settings, wallpaper: "radar", spider: "on", motion: "on" });
    await expect(desktop.spider).toBeVisible();
    // Real time: count 8 s in which the spider's transform keeps changing (a pause between routes does not count); give up after 40 s.
    let walkingMs = 0;
    let previous = await desktop.spider.evaluate((element) => (element as HTMLElement).style.transform);
    for (let elapsed = 0; elapsed < 40_000 && walkingMs < 8_000; elapsed += 250) {
      await page.waitForTimeout(250);
      const next = await desktop.spider.evaluate((element) => (element as HTMLElement).style.transform);
      if (next !== previous) walkingMs += 250;
      previous = next;
    }
    expect(walkingMs, "the spider walked for 8 s while recorded").toBeGreaterThanOrEqual(8_000);
    expect(writes).toEqual([]);
    await keepVideo(page, `spider-walk-${accent.id}`, testInfo);
  });
}

base("[STAB-VIS-02] D-54 review video: the «Лабораторные колбы» wallpaper in full motion for 8 s", async ({ page }, testInfo) => {
  base.setTimeout(60_000);
  const writes = trackWrites(page);
  const desktop = await openRealTime(page, { wallpaper: "flasks", spider: "off", motion: "on" });
  await expect(desktop.desktop).toBeVisible();
  await expect(page.locator(".wallpaper-flasks")).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
    return Boolean(target?.closest(".wallpaper-flasks")) && animation.playState === "running";
  }).length);
  expect(running, "the drawing's animations run").toBeGreaterThan(0);
  await page.waitForTimeout(8_000);
  expect(writes).toEqual([]);
  await keepVideo(page, "flasks-motion", testInfo);
});

// ---- the template builder: downloaded HTML and PNG, and the HTML opened without a network ----

const nickname = "portia_e2e_template";
const participantStatus = {
  nickname,
  promotionRecord: { currentTitle: { id: "academic", label: "Академик" }, nextTitle: { id: "intern", label: "Стажёр" } },
  currentTitle: { id: "academic", label: "Академик" },
  nextTitle: { id: "intern", label: "Стажёр" },
  ordinary: {
    eligibility: { status: "eligible", targetTitleId: null },
    active: {
      status: "assigned",
      targetTitleId: null,
      attemptId: undefined,
      tasks: [
        { id: "task-1", text: "Создать шаблон досье вируса по образцу «Базы вирусов».", sortOrder: 1 },
        { id: "task-2", text: "Описать порядок работы в лаборатории.", sortOrder: 2 },
      ],
    },
  },
  qualification: { eligibility: { status: "not-listed" }, active: null },
  results: [],
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Buffer) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function bandPng(width: number, height: number, top: [number, number, number], bottom: [number, number, number]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Array.from({ length: height }, (_, y) => {
    const [r, g, b] = y < height / 2 ? top : bottom;
    return Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const infectedPng = bandPng(240, 140, [38, 92, 84], [196, 160, 64]);
const mutationPng = bandPng(180, 100, [120, 36, 52], [40, 56, 120]);

async function settle(window: Locator) {
  await window.evaluate((node) => Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))));
}

const textField = (builder: Locator, name: string) => builder.getByRole("textbox", { name, exact: true });

async function styleFirstWord(page: Page, builder: Locator, field: Locator, word: string, preset: "Заголовок" | "Важно") {
  await field.fill(`${word} и далее`);
  await field.press("Home");
  for (let step = 0; step < word.length; step += 1) await page.keyboard.press("Shift+ArrowRight");
  const launch = builder.getByRole("button", { name: /^Оформление .+: панель оформления текста$/ });
  await expect(launch).toBeEnabled();
  await launch.click();
  const panel = page.getByRole("region", { name: /^Форматирование:/ });
  await expect(panel).toBeVisible();
  const expand = panel.getByRole("button", { name: "Развернуть панель оформления" });
  if (await expand.isVisible()) await expand.click();
  const style = panel.getByRole("group", { name: "Готовые стили" }).getByRole("button", { name: preset, exact: true });
  await style.click();
  await expect(style).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Закрыть панель оформления" }).click();
  await expect(panel).toHaveCount(0);
}

portia("[STAB-TMPL-01] D-55 review extras: a filled template's downloaded HTML and PNG, and the HTML opened without a network (UI contract, one substituted read, not a role proof)", async ({ page, browser }, testInfo) => {
  portia.skip(!lanes.has(testInfo.project.name), "Phase 20-47 review extras run on chromium-desktop and chromium-phone.");
  portia.setTimeout(120_000);
  const writes = trackWrites(page);
  await page.route("**/api/promotion/status**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("nickname")) {
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(participantStatus) });
      return;
    }
    await route.fallback();
  });
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();
  await promotion.nickname.fill(nickname);
  await promotion.checkNickname.click();
  await expect(promotion.heading(nickname)).toBeVisible();
  await promotion.window.getByRole("button", { name: "Создать шаблон" }).click();
  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeVisible();
  await settle(promotion.window);

  // A filled draft with a level-3 class, a photo, a styled description and one mutation with its picture.
  await builder.getByLabel("Название", { exact: true }).fill("Подвальная плесень");
  await builder.getByLabel("Код", { exact: true }).fill("PM-07");
  await builder.getByLabel("Статус", { exact: true }).fill("Изучается");
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "infected.png", mimeType: "image/png", buffer: infectedPng });
  const selects = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) }).locator("select");
  await selects.nth(0).selectOption("Апейрон");
  await selects.nth(1).selectOption("Тезей");
  const tabs = builder.getByRole("navigation", { name: "Разделы досье" });
  await tabs.getByRole("button", { name: "Описание", exact: true }).click();
  await styleFirstWord(page, builder, textField(builder, "Внешние характеристики"), "Бугристая", "Заголовок");
  await textField(builder, "Физиологические характеристики").fill("Колония живёт в сыром подвале и не любит свет.");
  await textField(builder, "Здоровье").fill("120 единиц");
  await textField(builder, "Скорость").fill("Медленная");
  await tabs.getByRole("button", { name: "Мутации", exact: true }).click();
  await builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" }).click();
  await builder.getByLabel("Название", { exact: true }).fill("Светобоязнь");
  await styleFirstWord(page, builder, textField(builder, "Описание"), "Реагирует", "Важно");
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "mutation.png", mimeType: "image/png", buffer: mutationPng });
  await settle(promotion.window);

  const pendingHtml = page.waitForEvent("download");
  await builder.getByRole("button", { name: "Скачать HTML" }).click();
  const htmlFile = await pendingHtml;
  expect(htmlFile.suggestedFilename()).toBe("shablon-dosye.html");
  const htmlTarget = testInfo.outputPath("shablon-dosye.html");
  await htmlFile.saveAs(htmlTarget);
  const htmlKept = keep(htmlTarget, "template-html", testInfo);

  const pendingPng = page.waitForEvent("download");
  await builder.getByRole("button", { name: "Скачать PNG" }).click();
  const pngFile = await pendingPng;
  expect(pngFile.suggestedFilename()).toBe("shablon-dosye.png");
  const pngTarget = testInfo.outputPath("shablon-dosye.png");
  await pngFile.saveAs(pngTarget);
  const pngKept = keep(pngTarget, "template-png", testInfo);
  expect([...readFileSync(pngKept).subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // The HTML opened from the saved file in a context with no network: no request except file: and data:.
  for (const [label, viewport] of [["1280", { width: 1280, height: 900 }], ["412", { width: 412, height: 915 }]] as const) {
    const offline = await browser.newContext({ offline: true, locale: "ru-RU", viewport });
    try {
      const offlinePage = await offline.newPage();
      const requests: string[] = [];
      offlinePage.on("request", (request) => { if (!/^(?:file|data):/i.test(request.url())) requests.push(request.url()); });
      await offlinePage.goto(pathToFileURL(htmlKept).href);
      await expect(offlinePage.getByRole("heading", { name: "Подвальная плесень" })).toBeVisible();
      await offlinePage.screenshot({ path: testInfo.outputPath(`template-html-open-${label}.png`), fullPage: true, animations: "disabled" });
      expect(requests, "the opened file makes no request").toEqual([]);
      keep(testInfo.outputPath(`template-html-open-${label}.png`), `template-html-open-${label}`, testInfo);
    } finally {
      await offline.close();
    }
  }
  await expect(builder.getByRole("status")).toContainText("Файл скачан на устройство");
  expect(writes, "the builder must not write to our API, Supabase or file uploads").toEqual([]);
});
