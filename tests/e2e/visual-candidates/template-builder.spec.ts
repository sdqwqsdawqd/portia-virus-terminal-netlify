import { deflateSync } from "node:zlib";
import type { Locator, Page, Request } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate } from "./support";

// Phase 20-39 (D-52): the template builder made of the site editor's virus card (tabs «Основное», «Описание», «Мутации»), 4 frames on
// desktop and phone. Candidates only: frames go under visual-candidates/.runs and wait for the owner verdict in 20-37; nothing here
// touches tests/e2e/visual/__screenshots__.
//
// UI CONTRACT, NOT A ROLE PROOF. One answer is substituted: GET /api/promotion/status?nickname=, so the builder can be reached without a
// staging participant. The frame shows only the local builder. It is not authenticated-role, server or staging evidence; the rows
// promotion-participant-cards and the other participant states stay BLOCKED (DATA) until their phase proves them.
// The requirement id of a frame is STAB-BASE-03 because that is the only family support.ts accepts; the evidence belongs to STAB-TMPL-01.
//
// A request tracker fails the test on any non-GET request to our own /api, any request to Supabase and any request to file uploads.

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
test.beforeEach(({}, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-39 template-builder candidates run on chromium-desktop and chromium-phone.");
});

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

let writes: string[] = [];

/** Collects every request that could write: a non-GET to our own /api, anything to Supabase, anything to file uploads. */
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
  expect(writes, "the builder must not write to our API, Supabase or file uploads").toEqual([]);
});

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
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const infectedPng = bandPng(240, 140, [38, 92, 84], [196, 160, 64]);
const mutationPng = bandPng(180, 100, [120, 36, 52], [40, 56, 120]);

/** A window scales in when it opens; sizes are measured at rest. */
async function settle(window: Locator) {
  await window.evaluate((node) => Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))));
}

async function assertTouchTargets(locators: Locator[]) {
  for (const locator of locators) {
    const box = await locator.boundingBox();
    expect(box, "control is laid out").not.toBeNull();
    expect(box!.height, "touch target height").toBeGreaterThanOrEqual(44);
    expect(box!.width, "touch target width").toBeGreaterThanOrEqual(44);
  }
}

async function assertNoOverflow(page: Page, builder: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth), "no page-level horizontal scroll").toBe(true);
  expect(await builder.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "no horizontal scroll inside the window").toBe(true);
}

async function openBuilder(page: Page) {
  trackWrites(page);
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
  return { promotion, builder };
}

async function openTab(builder: Locator, name: "Основное" | "Описание" | "Мутации") {
  await builder.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name, exact: true }).click();
}

const nameField = (builder: Locator) => builder.getByLabel("Название", { exact: true });
const textField = (builder: Locator, name: string) => builder.getByRole("textbox", { name, exact: true });

/** Types `${word} и далее`, selects the first word and applies a ready style; the panel stays open unless asked to close. */
async function styleFirstWord(page: Page, builder: Locator, field: Locator, word: string, preset: "Заголовок" | "Важно", closePanel: boolean) {
  await field.fill(`${word} и далее`);
  await field.press("Home");
  for (let step = 0; step < word.length; step += 1) await page.keyboard.press("Shift+ArrowRight");
  const launch = builder.getByRole("button", { name: /^Оформление текста:/ });
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

async function touchTargetsOnPhone(builder: Locator, testName: string) {
  if (testName !== "chromium-phone") return;
  const tabs = builder.getByRole("navigation", { name: "Разделы досье" }).getByRole("button");
  await assertTouchTargets([
    ...(await tabs.all()),
    builder.locator(".global-format-launch > button"),
    builder.getByRole("button", { name: "Скачать PNG" }),
    builder.getByRole("button", { name: "Скачать HTML" }),
  ]);
}

const surface = "Promotion: конструктор шаблона";
const actor = "participant-ui-contract-stub";
const snapshot = (state: string, project: string) => `tests/e2e/visual/__screenshots__/phase20-template-builder-${state}--${project}.png`;

test("[STAB-TMPL-01] template-builder-main: tab «Основное», empty draft (UI contract, one substituted read)", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const { promotion, builder } = await openBuilder(page);
  await expect(builder.getByRole("navigation", { name: "Разделы досье" }).getByRole("button")).toHaveText(["Основное", "Описание", "Мутации"]);
  await expect(builder.getByRole("heading", { name: "Основные данные" })).toBeVisible();
  await expect(builder.getByRole("heading", { name: "Классификация" })).toBeVisible();
  await expect(nameField(builder)).toHaveValue("");
  await settle(promotion.window);
  await touchTargetsOnPhone(builder, testInfo.project.name);
  await assertNoOverflow(page, builder);
  await captureCandidate(context, {
    id: "template-builder-main", requirement: "STAB-BASE-03", surface, actor,
    state: "D-52 / STAB-TMPL-01 UI-контракт (подменено одно чтение статуса участника, не доказательство ролей): вкладка «Основное», пустой черновик, группы «Основные данные» и «Классификация»",
    intendedSnapshot: snapshot("main", testInfo.project.name),
  });
});

test("[STAB-TMPL-01] template-builder-text: tab «Описание», one word styled, the panel «ОФОРМЛЕНИЕ» open (UI contract, one substituted read)", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const { promotion, builder } = await openBuilder(page);
  await openTab(builder, "Описание");
  await textField(builder, "Физиологические характеристики").fill("Колония живёт в сыром подвале и не любит свет.");
  await textField(builder, "Здоровье").fill("120 единиц");
  await styleFirstWord(page, builder, textField(builder, "Внешние характеристики"), "Бугристая", "Заголовок", false);
  await expect(builder.getByRole("heading", { name: "Характеристики PPU" })).toBeVisible();
  await settle(promotion.window);
  await touchTargetsOnPhone(builder, testInfo.project.name);
  await assertNoOverflow(page, builder);
  await captureCandidate(context, {
    id: "template-builder-text", requirement: "STAB-BASE-03", surface, actor,
    state: "D-52 / STAB-TMPL-01 UI-контракт (подменено одно чтение статуса участника, не доказательство ролей): вкладка «Описание» с текстом, одно слово оформлено, панель «ОФОРМЛЕНИЕ» открыта",
    intendedSnapshot: snapshot("text", testInfo.project.name),
  });
});

test("[STAB-TMPL-01] template-builder-mutations: tab «Мутации», one mutation with a styled description and a generated PNG (UI contract, one substituted read)", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const { promotion, builder } = await openBuilder(page);
  await openTab(builder, "Мутации");
  await builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" }).click();
  await expect(builder.getByText("МУТАЦИЯ 01")).toBeVisible();
  await nameField(builder).fill("Светобоязнь");
  await styleFirstWord(page, builder, textField(builder, "Описание"), "Реагирует", "Важно", true);
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "mutation.png", mimeType: "image/png", buffer: mutationPng });
  await expect(builder.getByRole("img", { name: "Предпросмотр: Изображение мутации" })).toBeVisible();
  await settle(promotion.window);
  await touchTargetsOnPhone(builder, testInfo.project.name);
  await assertNoOverflow(page, builder);
  await captureCandidate(context, {
    id: "template-builder-mutations", requirement: "STAB-BASE-03", surface, actor,
    state: "D-52 / STAB-TMPL-01 UI-контракт (подменено одно чтение статуса участника, не доказательство ролей): вкладка «Мутации», одна мутация с названием, оформленным описанием и сгенерированным в спеке PNG в слоте",
    intendedSnapshot: snapshot("mutations", testInfo.project.name),
  });
});

test("[STAB-TMPL-01] template-builder-preview: a filled draft scrolled to the preview, after the fields on the phone (UI contract, one substituted read)", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const { promotion, builder } = await openBuilder(page);
  await nameField(builder).fill("Подвальная плесень");
  await builder.getByLabel("Код", { exact: true }).fill("PM-07");
  await builder.getByLabel("Статус", { exact: true }).fill("Изучается");
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "infected.png", mimeType: "image/png", buffer: infectedPng });
  const selects = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) }).locator("select");
  await selects.nth(0).selectOption("Апейрон");
  await selects.nth(1).selectOption("Тезей");

  await openTab(builder, "Описание");
  await styleFirstWord(page, builder, textField(builder, "Внешние характеристики"), "Бугристая", "Заголовок", true);
  await textField(builder, "Физиологические характеристики").fill("Колония живёт в сыром подвале и не любит свет.");
  await textField(builder, "Здоровье").fill("120 единиц");
  await textField(builder, "Скорость").fill("Медленная");

  await openTab(builder, "Мутации");
  await builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" }).click();
  await nameField(builder).fill("Светобоязнь");
  await styleFirstWord(page, builder, textField(builder, "Описание"), "Реагирует", "Важно", true);
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "mutation.png", mimeType: "image/png", buffer: mutationPng });

  const preview = builder.getByLabel("Предпросмотр шаблона");
  await expect(preview.getByRole("img", { name: "Фото после заражения" })).toBeVisible();
  await expect(preview.locator(".template-kicker")).toHaveCount(5);
  await expect(preview.locator(".template-mutation-index")).toHaveText("M-01");
  await preview.evaluate((node) => node.scrollIntoView({ block: "start", inline: "nearest" }));
  await settle(promotion.window);
  await touchTargetsOnPhone(builder, testInfo.project.name);
  await assertNoOverflow(page, builder);
  await captureCandidate(context, {
    id: "template-builder-preview", requirement: "STAB-BASE-03", surface, actor,
    state: "D-52 / STAB-TMPL-01 UI-контракт (подменено одно чтение статуса участника, не доказательство ролей): заполненный черновик, прокрутка к предпросмотру 01–05 (на телефоне — после полей)",
    intendedSnapshot: snapshot("preview", testInfo.project.name),
  });
});
