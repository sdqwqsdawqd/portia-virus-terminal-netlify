import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { Page, Request } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { expect, test } from "../fixtures/test";

// UI-contract lane (STAB-TMPL-01). The participant READ status is stubbed so the builder entry can be reached without
// a staging participant; this proves the local builder and export only. It is NOT authenticated-role or server
// evidence and must never be reported as such (CLAUDE.md: roles and staging stay BLOCKED until their phase proves them).
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

test("[STAB-TMPL-01] participant builds a text template, downloads it and opens the HTML offline", async ({ page, browser }, testInfo) => {
  const writes = trackWrites(page);
  const promotion = await openParticipantPromotion(page);
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));

  const trigger = promotion.window.getByRole("button", { name: "Создать шаблон" });
  await expect(trigger).toHaveCount(1);
  await expect(promotion.window).toContainText("Работа скачивается на ваше устройство. Отправьте файл проверяющему вне сайта.");
  await trigger.click();

  const builder = promotion.window.locator(".template-builder");
  await expect(builder.getByRole("heading", { name: "Шаблон досье", level: 1 })).toBeVisible();
  // The Promotion view is kept underneath, not rebuilt.
  await expect(promotion.heading(nickname)).toBeHidden();

  // Empty draft: labelled fields, honest preview, nothing to download yet.
  await expect(builder.getByLabel("Название вируса")).toHaveValue("");
  await expect(builder.getByRole("button", { name: "Скачать HTML" })).toBeDisabled();
  await expect(builder.getByLabel("Предпросмотр шаблона")).toContainText("Не заполнено");

  await builder.getByLabel("Название вируса").fill(markup);
  await builder.getByLabel("Физиология").fill("Первая строка\nВторая строка");
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
    await expect(offlinePage.getByRole("heading", { level: 1 })).toHaveText(markup);
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
  await builder.getByLabel("Название вируса").fill("Только название");
  await expect(preview.getByRole("heading", { name: "Только название" })).toBeVisible();
  // Fields that were not filled are shown as empty, never invented.
  await expect(preview.locator(".template-empty").first()).toHaveText("Не заполнено");
  await expect(builder.getByText("Текущий текст ещё не скачан.")).toBeVisible();

  await builder.getByRole("button", { name: "Вернуться к повышению" }).click();
  const confirm = builder.getByRole("alertdialog");
  await expect(confirm).toContainText("Черновик ещё не скачан");
  await expect(confirm).toContainText("Данные на сервер не отправляются");
  await expect(confirm.getByRole("button", { name: "Остаться и скачать" })).toBeFocused();

  // Staying keeps every typed value.
  await confirm.getByRole("button", { name: "Остаться и скачать" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(builder.getByLabel("Название вируса")).toHaveValue("Только название");

  // Leaving without a file drops the draft but keeps Promotion's own state.
  await builder.getByRole("button", { name: "Вернуться к повышению" }).click();
  await builder.getByRole("button", { name: "Вернуться без скачивания" }).click();
  await expect(builder).toHaveCount(0);
  await expect(promotion.heading(nickname)).toBeVisible();
  await expect(promotion.window).toContainText("Назначенные задания");
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
});
