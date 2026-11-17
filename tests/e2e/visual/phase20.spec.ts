import { DesktopPage } from "../pages/desktop.page";
import { parkClock } from "../fixtures/determinism";
import { PromotionPage } from "../pages/promotion.page";
import { EditorPage } from "../pages/editor.page";
import { tabRegistry } from "../../../lib/editor-tabs.ts";
import { deflateSync } from "node:zlib";
import { expect, test } from "../fixtures/test";
import { visualPolicy, type VisualState } from "../fixtures/visual-policy";
import type { Locator, Page, Request } from "@playwright/test";
import { portiaContentFixture } from "../../../lib/testing/portia-content-fixture.ts";

// Phase 20-12 (D-68): baselines of the code the owner accepted (20-58), on FIXED DATA.
// Data mode: the server runs under tests/e2e/harness/offline-supabase.cjs (empty portia_content -> the starting content of the site) with invented
// public values, so a baseline here says nothing about real content, roles, saving or a live data source. Scenes that need a role or a populated
// target use substituted reads and are labelled as such: "substituted reads = UI contract, not proof of roles".
// Every test name carries @phase20 (the older baselines are run with --grep-invert @phase20).

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20 baselines are taken on chromium-desktop and chromium-phone.");
});

type Settings = Record<string, string>;
const baseSettings: Settings = { accent: "teal", wallpaper: "radar", iconSize: "standard", motion: "on", spider: "on", customAccent: "" };

const snapshotName = (surface: string, projectName: string) => `phase20-${surface}--${projectName}.png`;

async function compare(page: Page, surface: string, projectName: string, state: VisualState) {
  await expect(page).toHaveScreenshot(snapshotName(surface, projectName), visualPolicy(page, state));
}

// The desktop on the "Паутина" wallpaper with animations «Выключены» (motion off): the spider is drawn at its resting place and nothing moves.
// The clock is paused, so no timer of the page fires between the load and the frame.
async function openStill(page: Page, patch: Settings) {
  const settings = { ...baseSettings, ...patch };
  await page.addInitScript((value) => window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(value)), settings);
  await page.clock.pauseAt(new Date(Date.parse("2026-10-30T09:00:00+03:00") + 5_000));
  await page.goto("/");
  const desktop = new DesktopPage(page);
  await expect(async () => {
    await page.clock.runFor(50);
    await expect(desktop.desktop).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 20_000 });
  return desktop;
}

// The window scenes are taken with animations «Выключены» (settings motion: off): the spider then stands at its resting place, so no frame depends on
// how far the fake clock ran before the frame (a running spider moved between two runs once in five; the window itself is the subject, not the spider).
async function openDesktopStill(page: Page) {
  await page.addInitScript((value) => window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(value)), { ...baseSettings, motion: "off" });
  const desktop = new DesktopPage(page);
  await desktop.goto();
  return desktop;
}

test("@phase20 spider at rest (D-45, D-53): animations «Выключены», no rim, sharp body, accent strand", async ({ page }, testInfo) => {
  const desktop = await openStill(page, { motion: "off" });
  await page.clock.runFor(3_000);
  await page.waitForTimeout(2_800); // the 600 ms fade-in (1.8 s delay) is a real-time CSS animation
  await expect(desktop.spider).toBeVisible();
  await expect(desktop.spider).toHaveCSS("opacity", "1");
  await compare(page, "spider", testInfo.project.name, "phase20:spider");
});

// D-54, D-59: the «Лабораторные колбы» wallpaper with animations «Выключены»: the finished frame (liquid at its drawn opacity 0.85, bubbles at their
// places, boards and waves finished), nothing moves. The spider is switched off so the frame is the wallpaper alone.
test("@phase20 flasks, animations «Выключены»: finished still frame (D-54, D-59)", async ({ page }, testInfo) => {
  await openStill(page, { wallpaper: "flasks", spider: "off", motion: "off" });
  await page.clock.runFor(3_000);
  const wallpaper = page.locator(".wallpaper-flasks");
  await expect(wallpaper).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.dataset.motion), "motion is off").toBe("off");
  expect(await page.evaluate(() => document.documentElement.dataset.wallpaper), "the flasks wallpaper is chosen").toBe("flasks");
  expect(
    await page.evaluate(() => document.getAnimations().filter((animation) => ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".wallpaper-flasks")).length),
    "no running animation in the flask art",
  ).toBe(0);
  await compare(page, "flasks", testInfo.project.name, "phase20:flasks");
});

// ---- shared helpers of the scenes with substituted reads ---------------------------------------------------------------------------------
// UI contract on substituted reads, not proof of roles or of live content: a GET of our own API is answered with a fixture, every write is
// aborted and recorded, and the test fails on any write to our API or Supabase (tracker below).

let writes: string[] = [];

/** Every request that could write to our API or Supabase (GET and HEAD are reads) or to file uploads: the test fails on any of them. */
function trackWrites(page: Page) {
  writes = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && (!readOnly || url.pathname.startsWith("/api/uploads"))) writes.push(`${request.method()} ${url.pathname}`);
  });
}

test.afterEach(() => {
  expect(writes, "the @phase20 scenes must not write to our API, Supabase or file uploads").toEqual([]);
});

const contentFixture = (patch: Record<string, unknown>) => ({ ...structuredClone(portiaContentFixture), ...patch });

async function stubContent(page: Page, content: unknown) {
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ content, revision: 1, updatedAt: null }) });
  });
}

/** A window scales in when it opens; sizes are measured at rest. */
async function settle(window: Locator) {
  await window.evaluate((node) => Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))));
}

// ---- D-21: the three drawings of the empty states --------------------------------------------------------------------------------------
// The empty state is a fixture of GET /api/content (no articles, no cards, no news) - not data of the target. Substituted read = UI contract.
const emptyContent = () => contentFixture({ infoSections: [], guideSections: [], broadcasts: [], broadcastSections: [] });

const emptyScenes = [
  { key: "info-flask", app: "Информация", drawing: "flaskEmpty", box: ".app-state-body .empty-state", heading: "В «Информации» пока нет статей" },
  { key: "news-flask", app: "Сводка", drawing: "flaskEmpty", box: ".broadcast-empty", heading: "Новостей пока нет", tab: /^Новости/ },
  { key: "guide-microscope", app: "Справочник", drawing: "microscopeGuide", box: ".guide-empty", heading: "В «Справочнике» пока нет карточек" },
] as const;

for (const scene of emptyScenes) {
  test(`@phase20 empty state ${scene.key} (D-21; UI contract on a substituted GET /api/content, not proof of live content)`, async ({ page }, testInfo) => {
    trackWrites(page);
    await stubContent(page, emptyContent());
    const desktop = await openDesktopStill(page);
    await desktop.openApp(scene.app);
    const window = desktop.window(scene.app);
    await expect(window.locator('.app-skeleton[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
    if ("tab" in scene) await window.getByRole("button", { name: scene.tab }).click();
    const box = window.locator(scene.box);
    await expect(box).toBeVisible();
    await expect(box.locator("svg")).toHaveAttribute("data-illustration", scene.drawing);
    await expect(box.locator("strong")).toHaveText(scene.heading);
    await settle(window);
    await parkClock(page);
    await compare(page, `empty-art-${scene.key}`, testInfo.project.name, `phase20:empty-art-${scene.key}`);
  });
}

// ---- D-18, D-20: «Повышение» ---------------------------------------------------------------------------------------------------------------
// Participant: the gate «ПРОВЕРИТЬ ПОВЫШЕНИЕ» of the redesigned window, as the real server serves it (no substituted read).
test("@phase20 promotion participant: the lookup gate of the redesigned window (D-18, D-20)", async ({ page }, testInfo) => {
  await openDesktopStill(page);
  const promotion = new PromotionPage(page);
  await promotion.open();
  await expect(promotion.heading("ПРОВЕРИТЬ ПОВЫШЕНИЕ")).toBeVisible();
  await expect(promotion.nickname).toBeVisible();
  await expect(promotion.checkNickname).toBeDisabled();
  await settle(promotion.window);
  await parkClock(page);
  await compare(page, "promotion-participant", testInfo.project.name, "phase20:promotion-participant");
});

// Reviewer: the queue and the bank need a signed-in «проверяющий» role and a roster on an attested isolated staging; none exists (19-VERIFICATION).
// No baseline and no register row: the frame would only be an invented one.
test("@phase20 promotion reviewer: queue and bank (D-18, D-20)", async () => {
  test.skip(true, "BLOCKED (ENV): нет аттестованного staging проверяющего (19-VERIFICATION)");
});

// ---- D-39: class icons ----------------------------------------------------------------------------------------------------------------------
// Fixed record: «МОРОК» (vir-d17) of the starting content; classes Транзитиум / Полиморф / Стабилар (one new class per axis). The frame is the crop of
// the panel .classification-panel of its dossier in «База вирусов».
test("@phase20 class icons: the classification panel of МОРОК (Транзитиум / Полиморф / Стабилар) (D-39)", async ({ page }, testInfo) => {
  // The panel is taller than the screen of the phone project and an element capture is cut at the viewport (the taskbar would cover the last row):
  // the viewport of the phone gets a taller screen for this crop only; the width, the scale and the layout of the panel stay those of the phone.
  const viewport = page.viewportSize();
  if (testInfo.project.name === "chromium-phone" && viewport) await page.setViewportSize({ width: viewport.width, height: 1400 });
  const desktop = await openDesktopStill(page);
  await desktop.openApp("База вирусов");
  const archive = desktop.window("База вирусов");
  await expect(archive.getByRole("status").filter({ hasText: /Загрузка/ })).toHaveCount(0);
  await archive.locator(".virus-row").filter({ hasText: "МОРОК" }).first().click();
  const panel = archive.locator(".classification-panel");
  await expect(panel).toBeVisible();
  for (const name of ["Транзитиум", "Полиморф", "Стабилар"]) {
    await expect(panel.locator(".class-cell strong", { hasText: name }).locator("svg.class-badge")).toBeVisible();
  }
  await settle(archive);
  await parkClock(page);
  await expect(panel).toHaveScreenshot(snapshotName("class-icons", testInfo.project.name), visualPolicy(page, "phase20:class-icons"));
});

// ---- D-52, D-55, D-61, D-65: the template builder in «Повышение» -------------------------------------------------------------------------
// UI contract, not a role proof: ONE answer is substituted, GET /api/promotion/status?nickname=, so the local builder can be reached without a
// participant on a staging. The frames show only the local builder (no server write, no upload: the tracker above fails the test on any).
const builderNickname = "portia_e2e_template";
const participantStatus = {
  nickname: builderNickname,
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
function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** A deterministic, decodable two-band PNG generated here, so the frames need no fixture file and repeat byte for byte. */
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
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
const infectedPng = bandPng(240, 140, [38, 92, 84], [196, 160, 64]);
const mutationPng = bandPng(180, 100, [120, 36, 52], [40, 56, 120]);

async function openBuilder(page: Page) {
  trackWrites(page);
  await page.route("**/api/promotion/status**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("nickname")) {
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(participantStatus) });
      return;
    }
    await route.fallback();
  });
  await openDesktopStill(page);
  const promotion = new PromotionPage(page);
  await promotion.open();
  await promotion.nickname.fill(builderNickname);
  await promotion.checkNickname.click();
  await expect(promotion.heading(builderNickname)).toBeVisible();
  await promotion.window.getByRole("button", { name: "Создать шаблон" }).click();
  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeVisible();
  await settle(promotion.window);
  return { promotion, builder };
}

async function openBuilderTab(builder: Locator, name: "Основное" | "Описание" | "Мутации") {
  await builder.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name, exact: true }).click();
}

const builderName = (builder: Locator) => builder.getByLabel("Название", { exact: true });
const builderText = (builder: Locator, name: string) => builder.getByRole("textbox", { name, exact: true });

/** Types `${word} и далее`, selects the first word and applies a ready style; the panel stays open unless asked to close. */
async function styleFirstWord(page: Page, builder: Locator, field: Locator, word: string, preset: "Заголовок" | "Важно", closePanel: boolean) {
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
  if (closePanel) {
    await panel.getByRole("button", { name: "Закрыть панель оформления" }).click();
    await expect(panel).toHaveCount(0);
  }
}

test("@phase20 template builder main: tab «Основное», empty draft (D-52; UI contract, one substituted read)", async ({ page }, testInfo) => {
  const { promotion, builder } = await openBuilder(page);
  await expect(builder.getByRole("navigation", { name: "Разделы досье" }).getByRole("button")).toHaveText(["Основное", "Описание", "Мутации"]);
  await expect(builder.getByRole("heading", { name: "Основные данные" })).toBeVisible();
  await expect(builder.getByRole("heading", { name: "Классификация" })).toBeVisible();
  await expect(builderName(builder)).toHaveValue("");
  await settle(promotion.window);
  await parkClock(page);
  await compare(page, "template-builder-main", testInfo.project.name, "phase20:template-builder-main");
});

test("@phase20 template builder text: tab «Описание», one word styled, the panel «ОФОРМЛЕНИЕ» open (D-52, D-61; UI contract, one substituted read)", async ({ page }, testInfo) => {
  const { promotion, builder } = await openBuilder(page);
  await openBuilderTab(builder, "Описание");
  await builderText(builder, "Физиологические характеристики").fill("Колония живёт в сыром подвале и не любит свет.");
  await builderText(builder, "Здоровье").fill("120 единиц");
  await styleFirstWord(page, builder, builderText(builder, "Внешние характеристики"), "Бугристая", "Заголовок", false);
  await expect(builder.getByRole("heading", { name: "Характеристики PPU" })).toBeVisible();
  await settle(promotion.window);
  await parkClock(page);
  await compare(page, "template-builder-text", testInfo.project.name, "phase20:template-builder-text");
});

test("@phase20 template builder mutations: tab «Мутации», one mutation with a styled description and a generated PNG (D-52, D-61; UI contract, one substituted read)", async ({ page }, testInfo) => {
  const { promotion, builder } = await openBuilder(page);
  await openBuilderTab(builder, "Мутации");
  await builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" }).click();
  await expect(builder.getByText("МУТАЦИЯ 01")).toBeVisible();
  await builderName(builder).fill("Светобоязнь");
  await styleFirstWord(page, builder, builderText(builder, "Описание"), "Реагирует", "Важно", true);
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "mutation.png", mimeType: "image/png", buffer: mutationPng });
  await expect(builder.getByRole("img", { name: "Предпросмотр: Изображение мутации" })).toBeVisible();
  await settle(promotion.window);
  await parkClock(page);
  await compare(page, "template-builder-mutations", testInfo.project.name, "phase20:template-builder-mutations");
});

test("@phase20 template builder preview: a filled draft in the view «Предпросмотр» (D-55, D-65; UI contract, one substituted read)", async ({ page }, testInfo) => {
  const { promotion, builder } = await openBuilder(page);
  await builderName(builder).fill("Подвальная плесень");
  await builder.getByLabel("Код", { exact: true }).fill("PM-07");
  await builder.getByLabel("Статус", { exact: true }).fill("Изучается");
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "infected.png", mimeType: "image/png", buffer: infectedPng });
  const selects = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) }).locator("select");
  await selects.nth(0).selectOption("Апейрон");
  await selects.nth(1).selectOption("Тезей");

  await openBuilderTab(builder, "Описание");
  await styleFirstWord(page, builder, builderText(builder, "Внешние характеристики"), "Бугристая", "Заголовок", true);
  await builderText(builder, "Физиологические характеристики").fill("Колония живёт в сыром подвале и не любит свет.");
  await builderText(builder, "Здоровье").fill("120 единиц");
  await builderText(builder, "Скорость").fill("Медленная");

  await openBuilderTab(builder, "Мутации");
  await builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" }).click();
  await builderName(builder).fill("Светобоязнь");
  await styleFirstWord(page, builder, builderText(builder, "Описание"), "Реагирует", "Важно", true);
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "mutation.png", mimeType: "image/png", buffer: mutationPng });

  // The view «Предпросмотр»: the archive card over the whole width of the window; on a PC the window keeps its normal size (D-65).
  await builder.getByRole("group", { name: "Вид", exact: true }).getByRole("button", { name: "Предпросмотр", exact: true }).click();
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await expect(preview.getByRole("img", { name: "Фото после заражения" })).toBeVisible();
  await expect(preview.locator(".section-kicker")).toHaveCount(5);
  await expect(preview.locator(".mutation-index")).toHaveText("M-01");
  await expect(preview.locator(".class-cell svg.class-badge").first()).toBeVisible();
  await preview.evaluate((node) => node.scrollIntoView({ block: "start", inline: "nearest" }));
  await settle(promotion.window);
  await parkClock(page);
  await compare(page, "template-builder-preview", testInfo.project.name, "phase20:template-builder-preview");
});

// ---- D-62, D-66, D-67: the editor («+ ДОБАВИТЬ РАЗДЕЛ», the dialog «Видимая часть») and the site showing the chosen part -------------------------------
// UI contract on substituted reads of GET /api/access and GET /api/content, not proof of roles or of saving: every write is aborted and the tracker above
// fails the test on any. The pictures are tracked files of public/assets, not real photos: how a chosen part looks on the owner's real photos is the
// owner's check (20-UAT EDITOR-FRAMING-01). Employee photos have no frame (variant b of 20-52).

/** The two reads the desktop needs to mount the editor; a write to either path is aborted (and the tracker records it). */
async function stubEditorReads(page: Page, content: unknown) {
  await page.route("**/api/access", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ canEdit: true, canManageEditors: false, openTabs: tabRegistry.map((tab) => tab.id), tabsEnforced: false }),
    });
  });
  await stubContent(page, content);
}

async function openEditorTab(page: Page, content: unknown, tabName: RegExp) {
  await stubEditorReads(page, content);
  await openDesktopStill(page);
  const editor = new EditorPage(page);
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  await editor.editorNavigation().getByRole("button", { name: tabName }).click();
}

/** A slider of the dialog by the arrow keys (steps of 5). */
async function stepKey(slider: Locator, from: number, to: number, keys: [string, string]) {
  const steps = (to - from) / 5;
  for (let step = 0; step < Math.abs(steps); step += 1) await slider.press(steps > 0 ? keys[0] : keys[1]);
}

const chosenFrame = { x: 30, y: 60, zoom: 150 };
const framePicture = "/assets/portia-assistant.png";
const framedVirus = (framing?: typeof chosenFrame) => ({ ...structuredClone(portiaContentFixture.viruses[0]), id: "virus-frames", name: "Вирус для кадра", infectedImage: framePicture, ...(framing ? { infectedImageFraming: framing } : {}), mutations: [] });

/** The block «Видимая часть» of a field: «Изменить» opens the dialog, «Масштаб» and «Положение картинки» (arrow keys) choose the frame; the dialog stays open. */
async function chooseFrame(page: Page, group: Locator) {
  await expect(group).toBeVisible();
  await group.scrollIntoViewIfNeeded();
  await expect(group.locator(".portia-image.is-loaded")).toBeVisible();
  await group.getByRole("button", { name: "Изменить" }).click();
  const dialog = page.getByRole("dialog", { name: /^Видимая часть/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".image-framing-window")).toBeVisible();
  const zoom = dialog.getByRole("slider", { name: "Масштаб" });
  await zoom.focus();
  await stepKey(zoom, 100, chosenFrame.zoom, ["ArrowRight", "ArrowLeft"]);
  await expect(zoom).toHaveValue(String(chosenFrame.zoom));
  const position = dialog.getByRole("slider", { name: "Положение картинки" });
  await position.focus();
  await stepKey(position, 50, chosenFrame.x, ["ArrowRight", "ArrowLeft"]);
  await stepKey(position, 50, chosenFrame.y, ["ArrowDown", "ArrowUp"]);
  await expect(position).toHaveAttribute("aria-valuetext", `по горизонтали ${chosenFrame.x} %, по вертикали ${chosenFrame.y} %`);
}

test("@phase20 editor info add section: «Информация» with «+ ДОБАВИТЬ РАЗДЕЛ» above the section tabs (D-62; UI contract, substituted reads)", async ({ page }, testInfo) => {
  trackWrites(page);
  await openEditorTab(page, portiaContentFixture, /^Информация/);
  await expect(page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Разделы информации" })).toBeVisible();
  await parkClock(page);
  await compare(page, "editor-info-add-section", testInfo.project.name, "phase20:editor-info-add-section");
});

test("@phase20 editor framing guide: the dialog «Видимая часть» from a «Справочник» section photo (D-66, D-67; UI contract, substituted reads)", async ({ page }, testInfo) => {
  trackWrites(page);
  await openEditorTab(page, contentFixture({ guideSections: [{ id: "g-frames", title: "Раздел с фото", photo: framePicture, cards: [] }] }), /^Справочник/);
  const toggle = page.locator(".editor-section-column > .nested-editor-card > .nested-editor-head .nested-editor-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const group = page.locator(".image-editor-field").filter({ hasText: "Фото раздела" }).getByRole("group", { name: "Видимая часть" });
  await chooseFrame(page, group);
  await parkClock(page);
  await compare(page, "editor-framing-guide", testInfo.project.name, "phase20:editor-framing-guide");
});

test("@phase20 editor framing dossier: the dialog «Видимая часть» from the photo after infection (D-66, D-67; UI contract, substituted reads)", async ({ page }, testInfo) => {
  trackWrites(page);
  await openEditorTab(page, contentFixture({ viruses: [framedVirus()] }), /^База вирусов/);
  await page.locator(".editor-record-list .editor-record-row button", { has: page.locator("strong") }).first().click();
  await page.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name: "Основное" }).click();
  const group = page.locator(".image-editor-field").first().getByRole("group", { name: "Видимая часть" });
  await chooseFrame(page, group);
  await parkClock(page);
  await compare(page, "editor-framing-dossier", testInfo.project.name, "phase20:editor-framing-dossier");
});

test("@phase20 guide framed: the «Справочник» window shows a section band and a card cover with the chosen part (D-66, D-67; UI contract, substituted read)", async ({ page }, testInfo) => {
  trackWrites(page);
  await stubContent(page, contentFixture({
    guideSections: [{
      id: "g-frames", title: "Раздел с кадром", photo: framePicture, photoFraming: chosenFrame,
      cards: [
        { id: "c-framed", title: "Обложка с кадром", cover: framePicture, coverFraming: chosenFrame, blocks: [] },
        { id: "c-plain", title: "Обложка без кадра", cover: framePicture, blocks: [] },
      ],
    }],
  }));
  const desktop = await openDesktopStill(page);
  await desktop.openApp("Справочник");
  const guide = desktop.window("Справочник");
  const head = guide.locator('.guide-section-head[aria-expanded="false"]');
  if (await head.count()) await head.first().click();
  await expect(guide.locator(".guide-tile")).toHaveCount(2);
  await expect(guide.locator(".guide-section-band")).toHaveAttribute("data-framing", "true");
  await settle(guide);
  await parkClock(page);
  await compare(page, "guide-framed", testInfo.project.name, "phase20:guide-framed");
});

test("@phase20 dossier framed: the dossier shows the chosen part of the photo after infection (D-66, D-67; UI contract, substituted read)", async ({ page }, testInfo) => {
  trackWrites(page);
  await stubContent(page, contentFixture({ viruses: [framedVirus(chosenFrame)] }));
  const desktop = await openDesktopStill(page);
  await desktop.openApp("База вирусов");
  const media = desktop.window("База вирусов").locator(".record-view .subject-media").first();
  await expect(media.locator(".portia-image")).toHaveAttribute("data-framing", "true");
  await settle(desktop.window("База вирусов"));
  await parkClock(page);
  await compare(page, "dossier-framed", testInfo.project.name, "phase20:dossier-framed");
});
