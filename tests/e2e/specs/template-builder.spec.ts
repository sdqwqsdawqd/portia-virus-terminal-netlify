import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import type { Browser, Locator, Page, Request, TestInfo, ViewportSize } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { templateExportViolations } from "../../../lib/portia-template-export.ts";
import { classificationOptions } from "../../../lib/portia-content.ts";
import { deterministicContract } from "../fixtures/determinism";
import { expect, test } from "../fixtures/test";

// UI-contract lane (STAB-TMPL-01, D-52). The participant READ status is stubbed so the builder entry can be reached without
// a staging participant; this proves the local builder and export only. It is NOT authenticated-role or server
// evidence and must never be reported as such (CLAUDE.md: roles and staging stay BLOCKED until their phase proves them).
// The form is the site editor's virus card (tabs «Основное», «Описание», «Мутации», formatted text, panel «ОФОРМЛЕНИЕ») without
// the scientist records; every scenario ends with an empty write tracker.
// D-55 (20-43): a view switch «Поля» / «Предпросмотр» shows the form or the archive's own card (VirusCardBody), never both; the download
// buttons and the status line stay in both views. Preview checks therefore switch the view first.
const nickname = "portia_e2e_template";
const markup = `<img src=x onerror="window.__pwned=1"> & "кавычки"`;

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

async function openParticipantPromotion(page: Page) {
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
  return promotion;
}

/** Collects every request that could write to our API, Supabase or the archive. */
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
/** A real, decodable solid-colour PNG, so the test needs no fixture file. */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const redPng = solidPng(64, 32, [214, 40, 40]);
const imageRefusal = "Не удалось открыть изображение. Выберите другой файл.";
const exportRefusal = "Не удалось подготовить файл. Повторите скачивание.";
const tooLongPng = "Карточка слишком длинная для PNG, лишнее не обрезается. Сократите текст или скачайте HTML.";

async function openBuilder(page: Page) {
  const promotion = await openParticipantPromotion(page);
  await promotion.window.getByRole("button", { name: "Создать шаблон" }).click();
  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeVisible();
  return { promotion, builder };
}

/** The view switch: two buttons with aria-pressed in the group «Вид». */
const viewGroup = (builder: Locator) => builder.getByRole("group", { name: "Вид", exact: true });
async function showPreview(builder: Locator) {
  await viewGroup(builder).getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(builder.getByLabel("Предпросмотр шаблона")).toBeVisible();
}
async function showFields(builder: Locator) {
  await viewGroup(builder).getByRole("button", { name: "Поля", exact: true }).click();
  await expect(builder.getByRole("group", { name: "Поля шаблона" })).toBeVisible();
}

/** The dossier tabs are plain buttons in the navigation «Разделы досье», exactly like the site editor's virus card. */
async function openTab(builder: Locator, name: "Основное" | "Описание" | "Мутации") {
  await builder.getByRole("navigation", { name: "Разделы досье" }).getByRole("button", { name, exact: true }).click();
}

/** Plain fields (Field) are found by their label; the formatted text fields are role=textbox named through aria-labelledby. */
const nameField = (builder: Locator) => builder.getByLabel("Название", { exact: true });
const textField = (builder: Locator, name: string) => builder.getByRole("textbox", { name, exact: true });

/** Pastes plain text into an empty formatted field the way the editor receives it, so long multi-line text is exact and fast. */
async function pasteText(field: Locator, text: string) {
  await field.click();
  await field.evaluate((element, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    // A plain Event with an own clipboardData reads the same in every engine: Firefox hands a synthetic ClipboardEvent a protected, empty DataTransfer (D-61, 20-49: first Firefox run of this spec).
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: data });
    element.dispatchEvent(paste);
  }, text);
}

/** Types `${word} и далее` into a formatted field, selects the first word and applies a ready style from the panel «ОФОРМЛЕНИЕ». */
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

async function downloadHtml(page: Page, builder: Locator, testInfo: TestInfo, fileName = "shablon-dosye.html") {
  const pending = page.waitForEvent("download");
  await builder.getByRole("button", { name: "Скачать HTML" }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("shablon-dosye.html");
  const target = testInfo.outputPath(fileName);
  await file.saveAs(target);
  return { html: await readFile(target, "utf8"), target };
}

/** Decodes the downloaded PNG in the browser and counts what is drawn where. */
async function inspectPng(page: Page, bytes: Buffer) {
  return page.evaluate(async (base64) => {
    const raw = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([raw], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let red = 0;
    let ink = 0;
    let footerInk = 0;
    let level3 = 0;
    for (let y = 0; y < bitmap.height; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) {
        const i = (y * bitmap.width + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        if (r > 190 && g < 80 && b < 80) red += 1;
        // The colour of a level-3 class cell (#b43632), within 12 per channel.
        if (Math.abs(r - 180) <= 12 && Math.abs(g - 54) <= 12 && Math.abs(b - 50) <= 12) level3 += 1;
        if (r < 150 && g < 150 && b < 150) {
          ink += 1;
          if (y >= bitmap.height - 200) footerInk += 1;
        }
      }
    }
    return { width: bitmap.width, height: bitmap.height, red, ink, footerInk, level3 };
  }, bytes.toString("base64"));
}

test("[STAB-TMPL-01] the form is the editor's virus card: three tabs, the same groups, no scientist records tab", async ({ page }) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  const tabs = builder.getByRole("navigation", { name: "Разделы досье" });
  await expect(tabs.getByRole("button")).toHaveText(["Основное", "Описание", "Мутации"]);
  await expect(builder.getByRole("button", { name: /Записи учёных/ })).toHaveCount(0);
  await expect(builder.getByText("Записи учёных")).toHaveCount(0);
  await expect(builder.getByRole("group", { name: "Поля шаблона" })).toBeVisible();
  // The view switch: «Поля» is on at the start and the card is not on the page until «Предпросмотр» is chosen.
  await expect(viewGroup(builder).getByRole("button")).toHaveText(["Поля", "Предпросмотр"]);
  await expect(viewGroup(builder).getByRole("button", { name: "Поля", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(viewGroup(builder).getByRole("button", { name: "Предпросмотр", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(builder.getByLabel("Предпросмотр шаблона")).toHaveCount(0);

  // Before any text field is chosen the one format button says so and is off.
  const launch = builder.locator(".global-format-launch > button");
  await expect(launch).toBeDisabled();
  await expect(launch).toHaveAccessibleName("Выберите текст: сначала выберите текстовое поле");
  await expect(launch).toContainText("ВЫБЕРИТЕ ТЕКСТ");

  await expect(builder.getByRole("heading", { name: "Основные данные" })).toBeVisible();
  await expect(builder.getByRole("heading", { name: "Классификация" })).toBeVisible();
  for (const label of ["Название", "Код", "Статус"]) await expect(builder.getByLabel(label, { exact: true })).toBeVisible();
  await expect(builder.locator("select")).toHaveCount(7);

  await openTab(builder, "Описание");
  await expect(builder.getByRole("heading", { name: "Описание", exact: true })).toBeVisible();
  await expect(builder.getByRole("heading", { name: "Характеристики PPU" })).toBeVisible();
  for (const label of ["Внешние характеристики", "Физиологические характеристики", "Здоровье", "Скорость", "Способности"]) {
    await expect(textField(builder, label)).toBeVisible();
  }
  // Pictures come only as files: the text hint says so and there is no address field anywhere. D-56 (20-37): the hint is one short phrase.
  await expect(builder.getByText("Изображения — только файлом.").first()).toBeVisible();
  await expect(builder.getByLabel(/адрес|ссылк/i)).toHaveCount(0);

  await openTab(builder, "Мутации");
  await expect(builder.getByRole("heading", { name: "Мутации", exact: true })).toBeVisible();
  await expect(builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] styling: a ready style on a word reaches the preview span and the downloaded HTML", async ({ page }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await nameField(builder).fill("Вирус с оформлением");

  await openTab(builder, "Описание");
  await styleFirstWord(page, builder, textField(builder, "Внешние характеристики"), "Слово", "Заголовок");

  await showPreview(builder);
  const styled = preview.locator(".formatted-content span", { hasText: /^Слово$/ });
  await expect(styled).toHaveCount(1);
  await expect(styled).toHaveCSS("font-weight", "800");
  await expect(styled).toHaveCSS("font-size", "22px");
  await expect(preview.locator(".formatted-content span", { hasText: "и далее" })).not.toHaveCSS("font-weight", "800");

  const { html } = await downloadHtml(page, builder, testInfo);
  expect(html).toMatch(/<span style="font-size: 22px; font-weight: 800;">Слово<\/span>/);
  expect(html).toContain("и далее");
  expect(html).not.toMatch(/<script/i);

  // The panel keeps nothing in the editor's browser storage: the builder passes no storage key.
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((key) => /format|panel/i.test(key)))).toEqual([]);
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] mutations: add two, style the second, delete the first - one M-01 with the former second's text", async ({ page }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await openTab(builder, "Мутации");
  const add = builder.getByRole("button", { name: "+ ДОБАВИТЬ МУТАЦИЮ" });
  await add.click();
  await add.click();
  await expect(builder.getByText("МУТАЦИЯ 01")).toBeVisible();
  await expect(builder.getByText("МУТАЦИЯ 02")).toBeVisible();
  await showPreview(builder);
  await expect(preview.locator(".mutation-copy h4")).toHaveText(["НОВАЯ МУТАЦИЯ", "НОВАЯ МУТАЦИЯ"]);
  await showFields(builder);

  await nameField(builder).nth(0).fill("Первая");
  await nameField(builder).nth(1).fill("Вторая");
  await styleFirstWord(page, builder, textField(builder, "Описание").nth(1), "Слово", "Важно");
  await builder.locator("[data-testid=template-image-input]").nth(1).setInputFiles({ name: "red.png", mimeType: "image/png", buffer: redPng });
  await showPreview(builder);
  await expect(preview.getByRole("img", { name: "Вторая" })).toBeVisible();
  await expect(preview.locator(".mutation-card")).toHaveCount(2);
  await showFields(builder);

  await builder.getByRole("button", { name: "Удалить" }).first().click();
  await expect(builder.getByText("МУТАЦИЯ 02")).toHaveCount(0);
  await expect(builder.getByLabel("Название", { exact: true })).toHaveValue("Вторая");
  await showPreview(builder);
  await expect(preview.locator(".mutation-card")).toHaveCount(1);
  await expect(preview.locator(".mutation-index")).toHaveText("M-01");
  await expect(preview.locator(".mutation-copy h4")).toHaveText("Вторая");
  const styled = preview.locator(".mutation-card .formatted-content span", { hasText: /^Слово$/ });
  await expect(styled).toHaveCSS("font-weight", "600");
  await expect(styled).toHaveCSS("color", "rgb(180, 54, 50)");
  // The picture followed its mutation; the removed one's name is gone from the draft.
  await expect(preview.getByRole("img", { name: "Вторая" })).toBeVisible();

  await expect(builder.getByRole("button", { name: "Скачать HTML" })).toBeEnabled();
  const { html } = await downloadHtml(page, builder, testInfo);
  expect(html).toContain("M-01");
  expect(html).not.toContain("M-02");
  expect(html).toContain("<h4>Вторая</h4>");
  expect(html).not.toContain("Первая");
  expect(html).toMatch(/<span style="color: rgb\(180, 54, 50\); font-weight: 600;">Слово<\/span>/i);
  expect(html).toMatch(/<img [^>]*src="data:image\/png;base64,/);
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] classification: a changed value shows in the preview and the HTML with its level", async ({ page }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await nameField(builder).fill("Вирус с классом");
  const group = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) });
  const selects = group.locator("select");
  await expect(selects).toHaveCount(7);

  await selects.nth(0).selectOption("Апейрон");
  await selects.nth(1).selectOption("Тезей");
  await showPreview(builder);
  const danger = preview.locator(".class-cell", { hasText: /^общий уровень опасности/i });
  await expect(danger).toContainText("Апейрон");
  await expect(danger).toContainText("УРОВЕНЬ 3");
  const spread = preview.locator(".class-cell", { hasText: /^распространение/i });
  await expect(spread).toContainText("Тезей");
  await expect(spread).toContainText("УРОВЕНЬ 2");

  const { html } = await downloadHtml(page, builder, testInfo);
  expect(html).toContain("Апейрон</strong><small>УРОВЕНЬ 3</small>");
  expect(html).toContain("Тезей</strong><small>УРОВЕНЬ 2</small>");
  expect(writes).toEqual([]);
});

// D-55 (20-37): the preview is the archive's own card (VirusCardBody): coloured class icons, the section kickers 01-05, no scientist records.
test("[STAB-TMPL-01] D-55 the preview is the archive card with coloured class icons", async ({ page }) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  await nameField(builder).fill("Вирус с иконками");
  const group = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) });
  const selects = group.locator("select");
  await expect(selects).toHaveCount(7);
  // Axis order of the form: danger, spread, transmission, escapeRisk, mind, appearance, behavior.
  await selects.nth(0).selectOption("Апейрон");
  await selects.nth(1).selectOption("Номос");
  await selects.nth(2).selectOption("Контактно-бытовой");
  await selects.nth(3).selectOption("Риск");
  await selects.nth(4).selectOption("Люцидиум");
  await selects.nth(5).selectOption("Ксеноморф");
  await selects.nth(6).selectOption("Инфернар");

  const preview = builder.getByLabel("Предпросмотр шаблона");
  await showPreview(builder);
  await expect(preview).toHaveClass(/\brecord-view\b/);
  const panel = preview.locator(".record-hero .classification-panel");
  await expect(panel.locator(".class-cell")).toHaveCount(7);
  // Every one of the seven chosen values has an icon, drawn beside the name inside its own cell.
  await expect(panel.locator(".class-cell svg.class-badge")).toHaveCount(7);

  const strongColor = (cell: string) => panel.locator(`.class-cell.${cell} strong`);
  await expect(strongColor("danger")).toHaveCSS("color", "rgb(180, 54, 50)"); // level 3
  await expect(panel.locator(".class-cell.danger")).toHaveClass(/\blevel-3\b/);
  await expect(strongColor("spread")).toHaveCSS("color", "rgb(22, 122, 77)"); // level 1
  await expect(strongColor("escape")).toHaveCSS("color", "rgb(128, 88, 0)"); // level 2
  await expect(strongColor("transmission")).toHaveCSS("color", "rgb(11, 117, 104)");
  // The icon takes the colour of its level (stroke currentColor).
  await expect(panel.locator(".class-cell.danger svg.class-badge")).toHaveCSS("color", "rgb(180, 54, 50)");
  await expect(panel.locator(".class-cell.spread svg.class-badge")).toHaveCSS("color", "rgb(22, 122, 77)");

  // Sections 01-05 only: five kickers, the scientist records and the old preview markup are absent.
  await expect(preview.locator(".section-kicker")).toHaveCount(5);
  await expect(preview.getByText("ЗАПИСИ УЧЁНЫХ")).toHaveCount(0);
  await expect(preview.locator("[class*=template-]")).toHaveCount(0);
  await expect(preview.locator("footer.record-footer")).toContainText("ШАБЛОН");
  await expect(preview.locator("footer.record-footer")).not.toContainText("ЗАПИСЬ");
  expect(writes).toEqual([]);
});

/** The runs' downloaded files are kept next to the work-set frames (ignored by git) so the gallery of 20-47 can show them. */
async function keepExport(testInfo: TestInfo, source: string, name: string) {
  const setId = process.env.PORTIA_VISUAL_SET_ID;
  if (!setId) return;
  const directory = path.join(process.cwd(), "tests", "e2e", "visual-candidates", ".runs", setId, "exports");
  await mkdir(directory, { recursive: true });
  await copyFile(source, path.join(directory, `${name}--${testInfo.project.name}${path.extname(source)}`));
}

// D-55 (20-37, 20-44): the downloaded HTML is the archive's card itself: the markup of VirusCardBody, the card's own CSS taken from the
// site's style sheets, coloured class icons, no font file, no address; opened without a network it makes no request and looks like the card.
test("[STAB-TMPL-01] D-55 the downloaded HTML is the archive card", async ({ page, browser }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  await nameField(builder).fill("Вирус из файла");
  const group = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) });
  await group.locator("select").nth(0).selectOption("Апейрон"); // level 3

  const { html, target } = await downloadHtml(page, builder, testInfo);
  await keepExport(testInfo, target, "template-html");
  expect(html).toContain('class="record-view');
  expect(html).toContain("classification-panel");
  expect(html).toMatch(/class-cell danger level-3[\s\S]*?<svg[^>]*class="class-badge"/);
  expect(html).toContain(".class-cell.level-3 strong");
  expect(html).toContain("@container (max-width: 840px)");
  expect(html).toContain("default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  expect(html).not.toContain("ЗАПИСИ УЧЁНЫХ");
  expect(templateExportViolations(html)).toEqual([]);
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  expect(style.length).toBeGreaterThan(2000);
  expect(templateExportViolations(style)).toEqual([]);
  expect(style).not.toMatch(/@font-face|@import|url\(|https?:/i);

  const offline = await browser.newContext({ offline: true, locale: "ru-RU", viewport: { width: 1280, height: 900 } });
  try {
    const offlinePage = await offline.newPage();
    const requests: string[] = [];
    offlinePage.on("request", (request) => { if (!/^(?:file|data):/i.test(request.url())) requests.push(request.url()); });
    await offlinePage.goto(pathToFileURL(target).href);
    await expect(offlinePage.getByRole("heading", { name: "Вирус из файла" })).toBeVisible();
    const strong = offlinePage.locator(".class-cell.danger strong");
    await expect(strong).toHaveCSS("color", "rgb(180, 54, 50)");
    await expect(offlinePage.locator(".class-cell.danger svg.class-badge")).toHaveCSS("color", "rgb(180, 54, 50)");
    const columns = await offlinePage.locator(".record-hero").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns, "two columns at 1280 px, as the archive's card").toBe(2);
    expect(requests).toEqual([]);
  } finally {
    await offline.close();
  }
  expect(writes).toEqual([]);
});

// D-55 (20-44): the PNG is the raster of the same card (SVG with a foreignObject drawn on a canvas): at least 1060 CSS px wide, with the pixels
// of the chosen level's colour. Runs on a PC and on a phone, where the card is still laid out at the file's width.
test("[STAB-TMPL-01] D-55 the downloaded PNG is the archive card", async ({ page }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  await nameField(builder).fill("Вирус из растра");
  const group = builder.locator("section.editor-group", { has: page.getByRole("heading", { name: "Классификация" }) });
  await group.locator("select").nth(0).selectOption("Апейрон"); // level 3, #b43632

  const pending = page.waitForEvent("download");
  await builder.getByRole("button", { name: "Скачать PNG" }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("shablon-dosye.png");
  const target = testInfo.outputPath("shablon-dosye.png");
  await file.saveAs(target);
  await keepExport(testInfo, target, "template-png");
  const bytes = await readFile(target);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(width, "1060 CSS px wide at scale 1 or 2").toBeGreaterThanOrEqual(1060);
  expect(width % 1060).toBe(0);
  expect(height).toBeGreaterThan(1000);
  const png = await inspectPng(page, bytes);
  expect(png.width).toBe(width);
  expect(png.level3, "the class cell of level 3 is drawn in its colour").toBeGreaterThanOrEqual(40);
  await expect(builder.getByRole("status")).toContainText("Файл скачан на устройство");
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] a local image and long text reach the preview, the offline HTML and the PNG without any server write", async ({ page, browser }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  const longText = Array.from({ length: 90 }, (_, index) => `строка-${index} описание описание описание`).join("\n");
  await nameField(builder).fill("Вирус с картинкой");
  await openTab(builder, "Описание");
  await pasteText(textField(builder, "Физиологические характеристики"), longText);
  await openTab(builder, "Основное");

  // Nothing to download from an empty preview, then the image alone is enough content only once it is really decoded.
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: redPng });
  const preview = builder.getByLabel("Предпросмотр шаблона");
  const previewImage = preview.getByRole("img", { name: "Фото после заражения" });
  await expect(builder.getByRole("button", { name: "Убрать изображение" })).toBeVisible();
  await expect(builder.getByText("Выбрано: red.png, 64×32")).toBeVisible();
  await showPreview(builder);
  await expect(previewImage).toBeVisible();
  expect(await previewImage.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual([64, 32]);
  // The archive's caption stays under the local photo.
  await expect(preview.locator("figure.subject-media figcaption")).toHaveText("Фото после заражения");

  // HTML: the image is embedded, nothing points at a server, and it opens offline.
  const { html, target: htmlPath } = await downloadHtml(page, builder, testInfo);
  expect(html).toMatch(/<img [^>]*src="data:image\/png;base64,/);
  expect(html).not.toMatch(/(?:src|href)=["']?(?:https?:)?\/\//i);
  expect(html).not.toMatch(/<script|<link|url\(/i);
  expect(html).toContain("строка-89 описание");

  const offline = await browser.newContext({ offline: true, locale: "ru-RU" });
  try {
    const offlinePage = await offline.newPage();
    const remote: string[] = [];
    offlinePage.on("request", (request) => { if (/^https?:/i.test(request.url())) remote.push(request.url()); });
    await offlinePage.goto(pathToFileURL(htmlPath).href);
    const embedded = offlinePage.getByRole("img", { name: "Фото после заражения" });
    await expect(embedded).toBeVisible();
    expect(await embedded.evaluate((element: HTMLImageElement) => [element.complete, element.naturalWidth, element.naturalHeight])).toEqual([true, 64, 32]);
    await expect(offlinePage.getByText("строка-89 описание описание описание")).toBeVisible();
    expect(remote).toEqual([]);
  } finally {
    await offline.close();
  }

  // PNG: decodes, contains the image pixels and the whole long card down to the footer.
  await expect(builder.getByRole("button", { name: "Скачать PNG" })).toBeEnabled();
  const pngDownload = page.waitForEvent("download");
  await builder.getByRole("button", { name: "Скачать PNG" }).click();
  await expect(builder.getByRole("status")).toHaveText("Готовим файл…");
  const pngFile = await pngDownload;
  expect(pngFile.suggestedFilename()).toBe("shablon-dosye.png");
  const pngPath = testInfo.outputPath("shablon-dosye.png");
  await pngFile.saveAs(pngPath);
  const pngBytes = await readFile(pngPath);
  expect([...pngBytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = await inspectPng(page, pngBytes);
  // D-55 (20-44): the raster of the file's card, 1060 CSS px wide at scale 2 (or 1 for a tall card).
  expect([1060, 2120]).toContain(png.width);
  expect(png.height / (png.width / 1060)).toBeGreaterThan(2400);
  expect(png.height).toBeLessThanOrEqual(8000);
  expect(png.red).toBeGreaterThanOrEqual(64 * 32 - 40);
  expect(png.ink).toBeGreaterThan(2000);
  expect(png.footerInk).toBeGreaterThan(10);
  await expect(builder.getByRole("status")).toContainText("Файл скачан на устройство");

  // Removing the image removes it from the preview and from the next file.
  await showFields(builder);
  await builder.getByRole("button", { name: "Убрать изображение" }).click();
  await showPreview(builder);
  await expect(previewImage).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] an unsupported, corrupt, oversized or unreadable image is refused and the draft stays", async ({ page }) => {
  const writes = trackWrites(page);
  await page.addInitScript(() => {
    const NativeImage = window.Image;
    window.Image = function PatchedImage(this: unknown, ...args: ConstructorParameters<typeof Image>) {
      const image = new NativeImage(...args);
      if ((window as unknown as { __failDecode?: boolean }).__failDecode) {
        Object.defineProperty(image, "src", { configurable: true, get: () => "", set: () => { queueMicrotask(() => image.onerror?.(new Event("error"))); } });
      }
      return image;
    } as unknown as typeof Image;
  });
  const { builder } = await openBuilder(page);
  const input = builder.locator("[data-testid=template-image-input]");
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await nameField(builder).fill("Остаётся");
  await openTab(builder, "Описание");
  await textField(builder, "Физиологические характеристики").fill("Первая строка");
  await openTab(builder, "Основное");

  const refused = async (file: { name: string; mimeType: string; buffer: Buffer }) => {
    await input.setInputFiles(file);
    await expect(builder.getByRole("alert")).toHaveText(imageRefusal);
    await expect(nameField(builder)).toHaveValue("Остаётся");
    await expect(builder.getByRole("button", { name: "Скачать HTML" })).toBeEnabled();
    await showPreview(builder);
    await expect(preview.getByRole("img")).toHaveCount(0);
    await expect(preview).toContainText("Первая строка");
    await showFields(builder);
  };
  await refused({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("это не изображение") });
  await refused({ name: "vector.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await refused({ name: "mislabelled.png", mimeType: "image/png", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]) });
  await refused({ name: "broken.png", mimeType: "image/png", buffer: Buffer.concat([redPng.subarray(0, 40), Buffer.from("garbage")]) });
  await refused({ name: "wide.png", mimeType: "image/png", buffer: solidPng(4097, 1, [0, 0, 0]) });
  await refused({ name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([redPng, Buffer.alloc(5 * 1024 * 1024)]) });

  // A good file clears the message and shows up in the preview.
  await input.setInputFiles({ name: "red.png", mimeType: "image/png", buffer: redPng });
  await expect(builder.getByRole("alert")).toHaveCount(0);
  await showPreview(builder);
  await expect(preview.getByRole("img")).toBeVisible();
  await showFields(builder);

  // A later refusal does not throw away the image that was already accepted.
  await input.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("нет") });
  await expect(builder.getByRole("alert")).toHaveText(imageRefusal);
  await showPreview(builder);
  await expect(preview.getByRole("img")).toBeVisible();
  await showFields(builder);

  // The decoder itself failing is reported the same way.
  await builder.getByRole("button", { name: "Убрать изображение" }).click();
  await page.evaluate(() => { (window as unknown as { __failDecode?: boolean }).__failDecode = true; });
  await input.setInputFiles({ name: "red.png", mimeType: "image/png", buffer: redPng });
  await expect(builder.getByRole("alert")).toHaveText(imageRefusal);
  await expect(nameField(builder)).toHaveValue("Остаётся");
  await showPreview(builder);
  await expect(preview.getByRole("img")).toHaveCount(0);
  await expect(preview).toContainText("Первая строка");
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] an encoding failure keeps the draft, shows a status and retries the same format", async ({ page }) => {
  const writes = trackWrites(page);
  await page.addInitScript(() => {
    const flags = window as unknown as { __pngMode?: "null" | "throw" | "context" | "decode" };
    const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function patchedToBlob(this: HTMLCanvasElement, callback: BlobCallback, ...rest: [string?, number?]) {
      if (flags.__pngMode === "null") { callback(null); return; }
      if (flags.__pngMode === "throw") throw new DOMException("tainted", "SecurityError");
      nativeToBlob.call(this, callback, ...rest);
    };
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(this: HTMLCanvasElement, ...args: unknown[]) {
      if (flags.__pngMode === "context") return null;
      return (nativeGetContext as (...a: unknown[]) => unknown).apply(this, args);
    } as typeof HTMLCanvasElement.prototype.getContext;
    const NativeImage = window.Image;
    window.Image = function PatchedImage(this: unknown, ...args: ConstructorParameters<typeof Image>) {
      const image = new NativeImage(...args);
      if (flags.__pngMode === "decode") {
        Object.defineProperty(image, "src", { configurable: true, get: () => "", set: () => { queueMicrotask(() => image.onerror?.(new Event("error"))); } });
      }
      return image;
    } as unknown as typeof Image;
  });
  const { builder } = await openBuilder(page);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await nameField(builder).fill("Черновик остаётся");
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: redPng });
  await openTab(builder, "Описание");
  await textField(builder, "Физиологические характеристики").fill("Текст участника");
  await openTab(builder, "Основное");

  for (const mode of ["null", "throw", "context", "decode"] as const) {
    await page.evaluate((value) => { (window as unknown as { __pngMode?: string }).__pngMode = value; }, mode);
    await builder.getByRole("button", { name: "Скачать PNG" }).click();
    await expect(builder.getByRole("status")).toHaveText("Готовим файл…");
    await expect(builder.getByRole("button", { name: "Скачать PNG" })).toBeDisabled();
    await expect(builder.getByRole("alert")).toHaveText(exportRefusal);
    await expect(builder.getByRole("button", { name: "Повторить скачивание" })).toBeVisible();
    await expect(builder.getByRole("status")).toHaveText("");
    await expect(nameField(builder)).toHaveValue("Черновик остаётся");
    expect(downloads).toEqual([]);
  }
  // The draft, text and picture are still in the card after four failed encodings.
  await showPreview(builder);
  await expect(preview).toContainText("Текст участника");
  await expect(preview.getByRole("img")).toBeVisible();
  await showFields(builder);

  // The encoder works again: the retry produces the PNG (the format that failed), and the error goes away.
  await page.evaluate(() => { (window as unknown as { __pngMode?: string }).__pngMode = undefined; });
  const retried = page.waitForEvent("download");
  await builder.getByRole("button", { name: "Повторить скачивание" }).click();
  expect((await retried).suggestedFilename()).toBe("shablon-dosye.png");
  await expect(builder.getByRole("status")).toContainText("Файл скачан на устройство");
  await expect(builder.getByRole("alert")).toHaveCount(0);
  await expect(builder.getByRole("button", { name: "Повторить скачивание" })).toHaveCount(0);
  expect(downloads).toEqual(["shablon-dosye.png"]);
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] a card too long for PNG is refused with an HTML alternative that keeps every line", async ({ page }, testInfo) => {
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  const lines = "п\n".repeat(1999);
  await openTab(builder, "Описание");
  await pasteText(textField(builder, "Физиологические характеристики"), lines);
  await pasteText(textField(builder, "Внешние характеристики"), lines);

  await builder.getByRole("button", { name: "Скачать PNG" }).click();
  await expect(builder.getByRole("alert")).toHaveText(tooLongPng);
  // A retry cannot help a too-long card, so only the HTML way out is offered.
  await expect(builder.getByRole("button", { name: "Повторить скачивание" })).toHaveCount(0);
  expect(downloads).toEqual([]);

  const { html } = await downloadHtml(page, builder, testInfo, "long.html");
  // Both fields keep all 1999 typed lines; nothing is cut.
  expect(html.split("п\n").length - 1).toBe(2 * 1999);
  await expect(builder.getByRole("alert")).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] long unbroken text and a wide image stay inside the window in both views", async ({ page }) => {
  const writes = trackWrites(page);
  const { promotion, builder } = await openBuilder(page);
  await nameField(builder).fill("Д".repeat(110));
  await builder.locator("[data-testid=template-image-input]").setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: solidPng(3000, 200, [30, 90, 200]) });
  await openTab(builder, "Описание");
  await pasteText(textField(builder, "Физиологические характеристики"), `${"длинноеслово".repeat(300)} ${"x".repeat(900)}`);
  const preview = builder.getByLabel("Предпросмотр шаблона");

  const overflowOf = () => page.evaluate(() => {
    const root = document.documentElement;
    const builderElement = document.querySelector(".template-builder")!;
    const card = document.querySelector(".template-card-preview");
    return {
      pageOverflow: root.scrollWidth - root.clientWidth,
      builderOverflow: builderElement.scrollWidth - builderElement.clientWidth,
      cardOverflow: card ? card.scrollWidth - card.clientWidth : 0,
      imageRight: card?.querySelector("img")?.getBoundingClientRect().right ?? 0,
      cardRight: card?.getBoundingClientRect().right ?? 0,
    };
  });

  // The fields view: long text in the form does not widen the page or the builder.
  const fields = await overflowOf();
  expect(fields.pageOverflow).toBeLessThanOrEqual(1);
  expect(fields.builderOverflow).toBeLessThanOrEqual(1);

  // The card view: the same, and the wide picture stays inside the card.
  await showPreview(builder);
  await expect(preview.getByRole("img")).toBeVisible();
  const card = await overflowOf();
  expect(card.pageOverflow).toBeLessThanOrEqual(1);
  expect(card.builderOverflow).toBeLessThanOrEqual(1);
  expect(card.cardOverflow).toBeLessThanOrEqual(1);
  expect(card.imageRight).toBeLessThanOrEqual(card.cardRight + 1);

  // The card is reachable by scrolling inside the window, not by a page-level scroll.
  await preview.locator("footer.record-footer").scrollIntoViewIfNeeded();
  await expect(preview.locator("footer.record-footer")).toBeVisible();
  const box = await promotion.window.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(writes).toEqual([]);
});

// D-55 (20-37) compact (20-43): the view switch keeps the draft, the card takes the whole width, the form is short.
// scrollHeight of the builder's scroll container (.template-builder) on an empty draft, tab «Основное», measured on the build of 20-43 Task 1
// (the new card beside the form): chromium-desktop 2033 px (window 760x620), chromium-phone 3384 px (the container grows with its content).
const heightBefore = { "chromium-desktop": 2033, "chromium-phone": 3384 } as const;
test("[STAB-TMPL-01] D-55 compact: the view switch keeps the draft and the card is two-column on a PC", async ({ page, isMobile }, testInfo) => {
  const writes = trackWrites(page);
  const { promotion, builder } = await openBuilder(page);

  // The form alone is at least a quarter shorter on a PC than the builder with the card beside it was.
  const project = testInfo.project.name as keyof typeof heightBefore;
  const fieldsHeight = await builder.evaluate((element) => element.scrollHeight);
  testInfo.annotations.push({ type: "scrollHeight-fields", description: String(fieldsHeight) });
  if (project in heightBefore) {
    if (!isMobile) expect(fieldsHeight).toBeLessThanOrEqual(Math.floor(heightBefore[project] * 0.75));
    else expect(fieldsHeight).toBeLessThan(heightBefore[project]);
  }

  // The draft survives the switch: the typed name, the open tab and a typed text field.
  await nameField(builder).fill("Черновик остаётся");
  await openTab(builder, "Описание");
  await pasteText(textField(builder, "Физиологические характеристики"), "Первая строка");
  const launch = builder.getByRole("button", { name: /^Оформление .+: панель оформления текста$/ });
  await expect(launch).toBeEnabled();
  await launch.click();
  const panel = page.getByRole("region", { name: /^Форматирование:/ });
  await expect(panel).toBeVisible();

  await showPreview(builder);
  // The switch closes the format panel as a tab change does, the form is out of the way and the card says what was typed.
  await expect(panel).toHaveCount(0);
  await expect(builder.getByRole("group", { name: "Поля шаблона" })).toBeHidden();
  await expect(viewGroup(builder).getByRole("button", { name: "Предпросмотр", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(viewGroup(builder).getByRole("button", { name: "Поля", exact: true })).toHaveAttribute("aria-pressed", "false");
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await expect(preview.getByRole("heading", { name: "Черновик остаётся" })).toBeVisible();
  await expect(preview).toContainText("Первая строка");
  // The download buttons and the hint stay in the card view.
  await expect(builder.getByRole("button", { name: "Скачать HTML" })).toBeEnabled();
  await expect(builder.getByText("Текущий черновик ещё не скачан.")).toBeVisible();

  // The card takes the whole width of the builder.
  const widths = await page.evaluate(() => {
    const shell = document.querySelector(".template-shell")!.getBoundingClientRect();
    const card = document.querySelector(".template-card-preview")!.getBoundingClientRect();
    return { shell: shell.width, card: card.width };
  });
  expect(widths.card).toBeGreaterThanOrEqual(Math.min(widths.shell * 0.9, widths.shell - 60));

  // D-65 (20-55): on a PC the card is two columns (the photo left, the classification right) in the Promotion window of the normal size (760 px)
  // and maximized; on a phone the photo is on top. (20-43 stacked the card in the window of the normal size; the owner's «Всегда как в «Базе вирусов»» replaced that.)
  const hero = () => page.evaluate(() => {
    const photo = document.querySelector(".template-card-preview .record-hero > .subject-media")!.getBoundingClientRect();
    const classification = document.querySelector(".template-card-preview .record-hero > .classification-panel")!.getBoundingClientRect();
    return { photoTop: photo.top, photoLeft: photo.left, photoRight: photo.right, photoBottom: photo.bottom, panelTop: classification.top, panelLeft: classification.left };
  });
  if (isMobile) {
    const one = await hero();
    expect(one.panelTop).toBeGreaterThanOrEqual(one.photoBottom - 1);
  } else {
    const narrow = await hero();
    expect(narrow.panelTop - narrow.photoTop, "760 px window: the classification starts level with the photo").toBeLessThanOrEqual(20);
    expect(narrow.panelLeft, "760 px window: the classification stands beside the photo").toBeGreaterThanOrEqual(narrow.photoRight - 1);
    await page.getByRole("button", { name: "Развернуть Повышение" }).click();
    await expect.poll(async () => (await promotion.window.boundingBox())?.width ?? 0).toBeGreaterThan(1200);
    const wide = await hero();
    expect(wide.panelTop - wide.photoTop, "maximized: the classification starts level with the photo").toBeLessThanOrEqual(20);
    expect(wide.panelLeft, "maximized: the classification stands beside the photo").toBeGreaterThanOrEqual(wide.photoRight - 1);
  }

  // Back to the fields: nothing typed was lost and the tab is the one that was open.
  await showFields(builder);
  await expect(textField(builder, "Физиологические характеристики")).toContainText("Первая строка");
  await openTab(builder, "Основное");
  await expect(nameField(builder)).toHaveValue("Черновик остаётся");
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] participant builds a text template, downloads it and opens the HTML offline", async ({ page, browser }, testInfo) => {
  const writes = trackWrites(page);
  const promotion = await openParticipantPromotion(page);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));

  const trigger = promotion.window.getByRole("button", { name: "Создать шаблон" });
  await expect(trigger).toHaveCount(1);
  // D-56 (20-37): the card of the builder says one short phrase.
  await expect(promotion.window).toContainText("Шаблон не засчитывает задание сам по себе.");
  await trigger.click();

  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeVisible();
  // D-56 (20-37): the note at the top is one short phrase; the storage rules are no longer retold.
  await expect(builder).toContainText("Скачайте файл и отправьте проверяющему вне сайта.");
  // The Promotion view is kept underneath, not rebuilt.
  await expect(promotion.heading(nickname)).toBeHidden();

  // Empty draft: labelled fields, honest preview, nothing to download yet.
  await expect(nameField(builder)).toHaveValue("");
  await expect(builder.getByRole("button", { name: "Скачать HTML" })).toBeDisabled();
  await expect(builder.getByText("Чтобы скачать, введите текст или добавьте изображение.")).toBeVisible(); // D-56 (20-37)
  await showPreview(builder);
  await expect(builder.getByLabel("Предпросмотр шаблона")).toContainText("Не заполнено");
  await showFields(builder);

  await nameField(builder).fill(markup);
  await openTab(builder, "Описание");
  await pasteText(textField(builder, "Физиологические характеристики"), "Первая строка\nВторая строка");
  await showPreview(builder);
  await expect(builder.getByLabel("Предпросмотр шаблона")).toContainText("Вторая строка");

  const download = builder.getByRole("button", { name: "Скачать HTML" });
  await expect(download).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await download.click();
  await expect(builder.getByRole("status")).toHaveText("Готовим файл…");
  await expect(download).toBeDisabled();
  const file = await downloadPromise;
  await expect(builder.getByRole("status")).toContainText("Файл скачан на устройство");
  await expect(download).toBeEnabled();
  expect(downloads).toHaveLength(1);

  const savedPath = testInfo.outputPath("shablon-dosye.html");
  await file.saveAs(savedPath);
  const html = await readFile(savedPath, "utf8");
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/<img/i);
  expect(html).toContain("&lt;img src=x onerror=&quot;window.__pwned=1&quot;&gt;");

  // Open the saved file with no network at all.
  const offline = await browser.newContext({ offline: true, locale: "ru-RU" });
  try {
    const offlinePage = await offline.newPage();
    const remote: string[] = [];
    const dialogs: string[] = [];
    offlinePage.on("request", (request) => { if (/^https?:/i.test(request.url())) remote.push(request.url()); });
    offlinePage.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); });
    await offlinePage.goto(pathToFileURL(savedPath).href);
    // The card's own title is the record header's h2.
    await expect(offlinePage.getByRole("heading", { level: 2 })).toHaveText(markup);
    await expect(offlinePage.getByText("Вторая строка")).toBeVisible();
    await expect(offlinePage.getByText("Не заполнено").first()).toBeVisible();
    expect(await offlinePage.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(remote).toEqual([]);
    expect(dialogs).toEqual([]);
  } finally {
    await offline.close();
  }

  // The current text was downloaded, so leaving needs no warning and Promotion is exactly where it was.
  await builder.getByRole("button", { name: "Вернуться к повышению" }).click();
  await expect(builder).toHaveCount(0);
  await expect(promotion.heading(nickname)).toBeVisible();
  await expect(promotion.window).toContainText("Назначенные задания");
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
});

test("[STAB-TMPL-01] unsaved text asks before leaving and a partial draft stays honest", async ({ page, isMobile }) => {
  const writes = trackWrites(page);
  const promotion = await openParticipantPromotion(page);
  const trigger = promotion.window.getByRole("button", { name: "Создать шаблон" });
  if (isMobile) await trigger.tap();
  else {
    await trigger.focus();
    await page.keyboard.press("Enter");
  }

  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeFocused();
  const preview = builder.getByLabel("Предпросмотр шаблона");
  await nameField(builder).fill("Только название");
  await showPreview(builder);
  await expect(preview.getByRole("heading", { name: "Только название" })).toBeVisible();
  // Fields that were not filled are shown as empty, never invented.
  await expect(preview.locator(".formatted-empty").first()).toHaveText("Не заполнено");
  await expect(builder.getByText("Текущий черновик ещё не скачан.")).toBeVisible();
  await showFields(builder);

  await builder.getByRole("button", { name: "Вернуться к повышению" }).click();
  const confirm = builder.getByRole("alertdialog");
  await expect(confirm).toContainText("Черновик ещё не скачан");
  // D-56 (20-37): the confirmation keeps the consequence and drops the retold storage rules.
  await expect(confirm).toContainText("Если вернуться сейчас, набранное будет потеряно.");
  await expect(confirm.getByRole("button", { name: "Остаться и скачать" })).toBeFocused();

  // Staying keeps every typed value.
  await confirm.getByRole("button", { name: "Остаться и скачать" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(nameField(builder)).toHaveValue("Только название");

  // Leaving without a file drops the draft but keeps Promotion's own state.
  await builder.getByRole("button", { name: "Вернуться к повышению" }).click();
  await builder.getByRole("button", { name: "Вернуться без скачивания" }).click();
  await expect(builder).toHaveCount(0);
  await expect(promotion.heading(nickname)).toBeVisible();
  await expect(promotion.window).toContainText("Назначенные задания");
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
});

/* ---------------------------------------------------------------- D-61 (20-49): the status says what happened to the file */

// The owner saw «Не удалось подготовить файл. Повторите скачивание.» although the file had been downloaded. The status must follow the
// fact: the browser received the file (event «download») <=> «Файл скачан на устройство.» and no export alert; no file <=> the alert
// and «Повторить скачивание». Both outcomes at once, or neither, is a failure. Run on every project (Chromium, Firefox, WebKit).
// The shared `page` fixture installs Playwright's fake clock, which REPLACES window.setTimeout with a plain script function. A native
// Window function called as a method of another object throws a TypeError in every engine ("Illegal invocation" in Chromium), and the
// fake one does not, so on the shared page this bug can never be seen. The check therefore runs on its own page with native timers.
async function openNativeTimerPage(
  browser: Browser,
  options: Readonly<{ baseURL: string | undefined; viewport: ViewportSize | null; isMobile: boolean; hasTouch: boolean; deviceScaleFactor: number | undefined; userAgent: string | undefined }>,
) {
  const context = await browser.newContext({
    baseURL: options.baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    colorScheme: "dark",
    viewport: options.viewport,
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
    deviceScaleFactor: options.deviceScaleFactor,
    userAgent: options.userAgent,
  });
  await context.addInitScript((settings) => {
    if (!window.localStorage.getItem("portia-desktop-settings-v1")) window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(settings));
    window.sessionStorage.setItem("portia-boot-seen-v1", "1");
  }, deterministicContract.settings);
  const page = await context.newPage();
  return { context, page };
}

for (const format of ["HTML", "PNG"] as const) {
  test(`[STAB-TMPL-01] D-61 a downloaded file never shows the export error (${format})`, async ({ browser, baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent }, testInfo) => {
    const { context, page } = await openNativeTimerPage(browser, { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent });
    const writes = trackWrites(page);
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.name}: ${error.message}`));
    try {
      const { builder } = await openBuilder(page);
      expect(await page.evaluate(() => window.setTimeout.toString()), "native timers, not the fake clock").toContain("[native code]");
      await nameField(builder).fill("Скачанный шаблон");
      await openTab(builder, "Описание");
      await pasteText(textField(builder, "Физиологические характеристики"), "Первая строка\nВторая строка");

      const received = page.waitForEvent("download", { timeout: 20_000 }).then((file) => file.suggestedFilename(), () => null);
      await builder.getByRole("button", { name: `Скачать ${format}` }).click();
      await expect(builder.getByRole("status")).toHaveText("Готовим файл…");
      const fileName = await received;
      // The export is over when the buttons are enabled again; only then is the status final.
      await expect(builder.getByRole("button", { name: `Скачать ${format}` })).toBeEnabled();

      const exportAlert = builder.getByRole("alert").filter({ hasText: exportRefusal });
      const retry = builder.getByRole("button", { name: "Повторить скачивание" });
      testInfo.annotations.push({ type: "d61-outcome", description: `${testInfo.project.name} ${format}: ${fileName === null ? "no file" : `file ${fileName}`}; page errors: ${JSON.stringify(browserErrors)}` });
      if (fileName !== null) {
        expect(fileName).toBe(format === "PNG" ? "shablon-dosye.png" : "shablon-dosye.html");
        await expect(builder.getByRole("status")).toContainText("Файл скачан на устройство");
        await expect(exportAlert).toHaveCount(0);
        await expect(builder.getByRole("alert")).toHaveCount(0);
        await expect(retry).toHaveCount(0);
      } else {
        // No file reached the browser: the error is shown honestly and the draft stays (WebKit may refuse PNG; that is an observation, not a pass).
        await expect(exportAlert).toHaveCount(1);
        await expect(retry).toBeVisible();
        await expect(builder.getByRole("status")).toHaveText("");
      }
      await openTab(builder, "Основное");
      await expect(nameField(builder)).toHaveValue("Скачанный шаблон");
      expect(writes).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

/* ---------------------------------------------------------------- D-60 (20-49): class values stay whole in the card and in the files */

// The owner saw «Предупреждени-е»: a class value broken in the middle of a word in the template card. Every `.class-cell strong` of the
// card must be one line, and its cell must hold it. Checked in the preview (window of the normal size and maximized on a PC, the phone's
// full screen) and in the downloaded HTML opened at the card's own width (1060) and at a phone's (412). The public archive is not touched
// by this (the rule lives under .template-card-preview); the interpretation «this is the break the owner meant» is confirmed in the gallery of 20-54.
const classAxes = ["danger", "spread", "transmission", "escapeRisk", "mind", "appearance", "behavior"] as const;
const longestClassValues = classAxes.map((axis) => (classificationOptions[axis] as readonly { value: string }[]).reduce((best, option) => (option.value.length > best.length ? option.value : best), ""));

type ClassValueMeasure = { text: string; lines: number; textRight: number; cellRight: number; cellOverflow: number; cellWidth: number; fontSize: number };

/** Per `.class-cell strong` of the card: how many lines its text takes (distinct tops of the text's boxes) and whether the cell holds it. */
async function measureClassValues(page: Page, scope = ".template-card-preview"): Promise<ClassValueMeasure[]> {
  return page.evaluate((root) => Array.from(document.querySelectorAll(`${root} .class-cell strong`)).map((strong) => {
    const cell = strong.closest(".class-cell")!;
    const tops = new Set<number>();
    let right = 0;
    for (const node of Array.from(strong.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || (node.textContent ?? "").trim() === "") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        tops.add(Math.round(rect.top));
        right = Math.max(right, rect.right);
      }
    }
    const box = cell.getBoundingClientRect();
    return {
      text: (strong.textContent ?? "").trim(),
      lines: tops.size,
      textRight: Math.round(right * 10) / 10,
      cellRight: Math.round(box.right * 10) / 10,
      cellOverflow: cell.scrollWidth - cell.clientWidth,
      cellWidth: Math.round(box.width * 10) / 10,
      fontSize: Number.parseFloat(getComputedStyle(strong).fontSize),
    };
  }), scope);
}

function expectClassValuesWhole(measures: ClassValueMeasure[], where: string) {
  expect(measures.map((measure) => measure.text).sort(), `${where}: all seven values are drawn`).toEqual([...longestClassValues].sort());
  for (const measure of measures) {
    expect(measure.lines, `${where}: «${measure.text}» is one line (cell ${measure.cellWidth}px)`).toBe(1);
    expect(measure.cellOverflow, `${where}: «${measure.text}» stays inside its cell`).toBeLessThanOrEqual(0);
    expect(measure.textRight, `${where}: «${measure.text}» ends before the cell's border`).toBeLessThanOrEqual(measure.cellRight);
  }
}

async function chooseLongestClassValues(builder: Locator) {
  await openTab(builder, "Основное");
  const fields = builder.locator(".classification-editor-field select");
  await expect(fields).toHaveCount(classAxes.length);
  for (const [index, value] of longestClassValues.entries()) await fields.nth(index).selectOption(value);
}

test("[STAB-TMPL-01] D-60 class values stay whole in the preview and in the downloaded HTML", async ({ page, browser, isMobile }, testInfo) => {
  const writes = trackWrites(page);
  const { promotion, builder } = await openBuilder(page);
  await nameField(builder).fill("Класс без переноса");
  await chooseLongestClassValues(builder);
  // «Предупреждение» is the default of the axis «Угроза и риск побега» and the longest value of it: it is one of the seven.
  expect(longestClassValues[classAxes.indexOf("escapeRisk")]).toBe("Предупреждение");
  await showPreview(builder);
  const sizes: string[] = [];

  expectClassValuesWhole(await measureClassValues(page), isMobile ? "preview, phone" : "preview, window of the normal size");
  sizes.push(isMobile ? "phone" : "pc-normal");
  if (!isMobile) {
    await page.getByRole("button", { name: "Развернуть Повышение" }).click();
    await expect.poll(async () => (await promotion.window.boundingBox())?.width ?? 0).toBeGreaterThan(1200);
    expectClassValuesWhole(await measureClassValues(page), "preview, window maximized");
    sizes.push("pc-maximized");
  }

  const { html, target } = await downloadHtml(page, builder, testInfo, "classes.html");
  // The rule travels into the file with the card (templateCardCss), so the file is read at the card's own width and at a phone's.
  expect(html).toContain("class-cell");
  expect(html, "the card's rule for class values is in the file").toMatch(/\.template-card-preview \.class-cell strong\{[^}]*overflow-wrap:normal/);
  for (const width of [1060, 412]) {
    const offline = await browser.newContext({ offline: true, locale: "ru-RU", viewport: { width, height: 900 } });
    try {
      const filePage = await offline.newPage();
      await filePage.goto(pathToFileURL(target).href);
      await expect(filePage.getByRole("heading", { level: 2 })).toHaveText("Класс без переноса");
      expectClassValuesWhole(await measureClassValues(filePage), `downloaded HTML at ${width}px`);
    } finally {
      await offline.close();
    }
  }
  testInfo.annotations.push({ type: "d60-checked", description: `${testInfo.project.name}: ${sizes.join(", ")}, file 1060 and 412` });
  expect(writes).toEqual([]);
});

/* ---------------------------------------------------------------- D-65 (20-55): the card is laid out like the archive's record */

// The owner (2026-11-08): «было три сверху, посередине способ распространения и три снизу, а не как сейчас» and, to the question about the columns,
// «Всегда как в «Базе вирусов»». The card's classification is the archive's grid (three cells, the method of spread across the whole width, three cells);
// a class value never breaks in the middle of a word because its size follows the cell's width (not smaller than 12 px), not because the grid changes.
// On a PC the card is always two columns (the photo left, the classification right) in the Promotion window of the normal size and maximized.
// The reading «always as in the archive» is the planner's; it is put to the owner in the gallery of 20-58 (q-template-phone for the phone).

type Box = { top: number; left: number; right: number; bottom: number; width: number };
type CardLayout = {
  heroColumns: number;
  photo: Box;
  panel: Box;
  gridColumns: number;
  gridInner: number;
  cells: { label: string; box: Box }[];
  documentWidth: number;
  cardWidth: number;
  pageOverflow: number;
};

/** Runs inside the page: the geometry of one card (`scope` is the card's selector). Installed as window.__cardProbe so one source serves every measurement. */
function cardProbe(scope: string) {
  const root = document.querySelector(scope);
  if (root === null) return null;
  const box = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width };
  };
  const hero = root.querySelector(".record-hero")!;
  const grid = root.querySelector(".classification-grid")!;
  return {
    heroColumns: getComputedStyle(hero).gridTemplateColumns.split(/\s+/).filter((track) => track !== "").length,
    photo: box(hero.querySelector(":scope > .subject-media")!),
    panel: box(hero.querySelector(":scope > .classification-panel")!),
    gridColumns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter((track) => track !== "").length,
    gridInner: grid.clientWidth,
    cells: Array.from(grid.querySelectorAll(".class-cell")).map((cell) => ({ label: cell.querySelector("span")?.textContent ?? "", box: box(cell) })),
    documentWidth: root.querySelector(".record-document")!.clientWidth,
    cardWidth: root.getBoundingClientRect().width,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

async function installCardProbe(page: Page) {
  await page.evaluate(`window.__cardProbe = ${cardProbe.toString()}`);
}

async function measureCardLayout(page: Page, scope = ".template-card-preview"): Promise<CardLayout> {
  await installCardProbe(page);
  const layout = await page.evaluate((root) => (window as unknown as { __cardProbe: (scope: string) => unknown }).__cardProbe(root), scope);
  expect(layout, `the card ${scope} is on the page`).not.toBeNull();
  return layout as CardLayout;
}

const near = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;

/** The archive's order: three cells on one line, then the method of spread across the grid, then three cells on one line. */
function expectArchiveGrid(layout: CardLayout, where: string) {
  expect(layout.gridColumns, `${where}: the grid keeps the archive's three columns`).toBe(3);
  expect(layout.cells.map((cell) => cell.label), `${where}: the cells keep the archive's order`).toEqual([
    "Общий уровень опасности", "Распространение", "Угроза и риск побега", "Способ распространения", "Разум", "Вид / внешность", "Поведение",
  ]);
  const [danger, spread, escape, transmission, mind, appearance, behavior] = layout.cells.map((cell) => cell.box);
  expect(near(danger.top, spread.top) && near(spread.top, escape.top), `${where}: danger, spread and escape share a top`).toBe(true);
  expect(transmission.top, `${where}: the method of spread is under the first three`).toBeGreaterThanOrEqual(Math.max(danger.bottom, spread.bottom, escape.bottom) - 1);
  expect(near(transmission.width, layout.gridInner), `${where}: the method of spread takes the whole grid (${transmission.width} of ${layout.gridInner})`).toBe(true);
  expect(near(mind.top, appearance.top) && near(appearance.top, behavior.top), `${where}: mind, appearance and behavior share a top`).toBe(true);
  expect(mind.top, `${where}: the last three are under the method of spread`).toBeGreaterThanOrEqual(transmission.bottom - 1);
}

function expectValuesFit(measures: ClassValueMeasure[], where: string) {
  expectClassValuesWhole(measures, where);
  for (const measure of measures) expect(measure.fontSize, `${where}: «${measure.text}» is not smaller than 12 px`).toBeGreaterThanOrEqual(12);
}

function expectTwoColumns(layout: CardLayout, where: string) {
  expect(layout.panel.left, `${where}: the classification stands beside the photo`).toBeGreaterThanOrEqual(layout.photo.right - 1);
  expect(layout.panel.top - layout.photo.top, `${where}: the classification starts level with the photo`).toBeLessThanOrEqual(20);
}

test("[STAB-TMPL-01] D-65 the card is laid out like the archive's record: photo left, three classes, the method of spread, three classes", async ({ page, browser, isMobile }, testInfo) => {
  test.skip(isMobile, "The two-column PC layout; the phone is the next test.");
  const writes = trackWrites(page);
  const { builder } = await openBuilder(page);
  await nameField(builder).fill("Раскладка как в базе");
  await chooseLongestClassValues(builder);
  await showPreview(builder);

  // Window of the normal size (760 px): the card is two columns here too.
  const normal = await measureCardLayout(page);
  testInfo.annotations.push({ type: "d65-normal", description: `card ${normal.cardWidth}px, document ${normal.documentWidth}px, hero columns ${normal.heroColumns}, photo ${normal.photo.width}px, panel ${normal.panel.width}px, cell ${normal.cells[0].box.width}px` });
  expect(normal.heroColumns, "window of the normal size: two columns").toBe(2);
  expectTwoColumns(normal, "window of the normal size");
  expectArchiveGrid(normal, "window of the normal size");
  expectValuesFit(await measureClassValues(page), "window of the normal size");

  // The downloaded file at the card's own width: the same hero, grid and values.
  const { target } = await downloadHtml(page, builder, testInfo, "layout.html");
  const offline = await browser.newContext({ offline: true, locale: "ru-RU", viewport: { width: 1060, height: 900 } });
  try {
    const filePage = await offline.newPage();
    await filePage.goto(pathToFileURL(target).href);
    await expect(filePage.getByRole("heading", { level: 2 })).toHaveText("Раскладка как в базе");
    const file = await measureCardLayout(filePage);
    expect(file.heroColumns, "downloaded HTML at 1060 px: two columns").toBe(2);
    expectTwoColumns(file, "downloaded HTML at 1060 px");
    expectArchiveGrid(file, "downloaded HTML at 1060 px");
    expectValuesFit(await measureClassValues(filePage), "downloaded HTML at 1060 px");
  } finally {
    await offline.close();
  }
  expect(writes).toEqual([]);
});
