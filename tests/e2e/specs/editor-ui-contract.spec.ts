import type { Locator, Page, Request } from "@playwright/test";
import { defaultPortiaContent } from "../../../lib/portia-content.ts";
import { tabRegistry } from "../../../lib/editor-tabs.ts";
import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";

// UI-контракт: подменены только GET /api/access и GET /api/content; это не доказательство роли редактора и не живые данные;
// живые проверки редактора остаются в editor-layout.spec.ts на staging (там без роли они «BLOCKED (ENV)», а не прохождение).
// Что здесь доказывается: раскладка и поведение вкладок редактора в браузере (D-62 «Информация»: кнопка раздела сверху).
// Чего здесь нет: прав редактора, сохранения, сервера. Любой не-GET запрос к /api роняет тест (трекер записи), PUT /api/content не уходит.
// Подмена: GET /api/access отвечает canEdit true и всеми открытыми вкладками (редактор монтируется как у владельца без «Доступа»);
// GET /api/content отвечает содержимым по умолчанию (defaultPortiaContent) ревизии 1. Остальное — настоящая сборка в режиме посетителя.

/** Every request that could write to our API or Supabase (GET and HEAD are reads). */
function trackWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const own = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const supabase = url.hostname.endsWith(".supabase.co");
    const readOnly = request.method() === "GET" || request.method() === "HEAD";
    if ((own || supabase) && !readOnly) writes.push(`${request.method()} ${url.pathname}`);
  });
  return writes;
}

/** Stubs only the two READS the desktop needs to mount the editor; a write to either path is aborted (and the tracker records it). */
async function stubEditorReads(page: Page) {
  await page.route("**/api/access", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ canEdit: true, canManageEditors: false, openTabs: tabRegistry.map((tab) => tab.id), tabsEnforced: false }),
    });
  });
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") return route.abort();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ content: defaultPortiaContent, revision: 1, updatedAt: null }),
    });
  });
}

async function openInfoTab(page: Page) {
  await stubEditorReads(page);
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  await editor.editorNavigation().getByRole("button", { name: /^Информация/ }).click();
  await expect(page.getByRole("navigation", { name: "Разделы информации" })).toBeVisible();
  return editor;
}

const addSectionButton = (page: Page) => page.getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true });
const infoTabsNav = (page: Page) => page.getByRole("navigation", { name: "Разделы информации" });
const infoSectionCount = defaultPortiaContent.infoSections.length;

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, "the element has a box").not.toBeNull();
  return found!;
}

test.describe("[STAB-EDIT-02] D-62 «Информация» add-section bar", () => {
  test("[STAB-EDIT-02] D-62 «Информация»: add-section sits above the section tabs like «Справочник»", async ({ page }) => {
    const writes = trackWrites(page);
    await openInfoTab(page);

    const button = addSectionButton(page);
    await expect(button, "one add-section button in the tab, and it is the top one").toHaveCount(1);
    await expect(page.locator(".editor-section-addbar").getByRole("button", { name: "+ ДОБАВИТЬ РАЗДЕЛ", exact: true }), "the button lives in the pinned bar of «Справочник»").toHaveCount(1);
    const nav = infoTabsNav(page);
    const buttonBox = await box(button);
    const navBox = await box(nav);
    expect(buttonBox.y + buttonBox.height, `the button (top ${buttonBox.y}) is above the section tabs (top ${navBox.y})`).toBeLessThanOrEqual(navBox.y + 1);
    await expect(page.locator(".editor-section-columns ~ button"), "nothing is left below the columns of sections").toHaveCount(0);
    await expect(nav.getByRole("button")).toHaveCount(infoSectionCount);

    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const form = page.locator(".editor-section-create");
    await expect(form).toBeVisible();
    await expect(form.getByLabel("Заголовок раздела")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(form).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    const title = "Раздел из UI-контракта";
    await form.getByLabel("Заголовок раздела").fill(title);
    await form.getByRole("button", { name: "Создать раздел" }).click();
    await expect(form).toBeHidden();
    await expect(nav.getByRole("button")).toHaveCount(infoSectionCount + 1);
    const tab = nav.getByRole("button", { name: title, exact: true });
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    const card = page.locator(".editor-section-column > .nested-editor-card");
    await expect(card, "only the selected section is shown").toHaveCount(1);
    await expect(card.locator(":scope > .nested-editor-head .nested-editor-toggle")).toHaveAttribute("aria-expanded", "true");
    const heading = card.locator(":scope > .nested-editor-body").getByLabel("Заголовок", { exact: true });
    await expect(heading).toHaveValue(title);
    await expect(heading, "focus lands in the title of the new section").toBeFocused();

    // An empty title keeps the old default name.
    await button.click();
    await form.getByRole("button", { name: "Создать раздел" }).click();
    await expect(nav.getByRole("button", { name: "НОВЫЙ РАЗДЕЛ", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(nav.getByRole("button")).toHaveCount(infoSectionCount + 2);

    expect(writes, "the UI contract never writes").toEqual([]);
  });
});
