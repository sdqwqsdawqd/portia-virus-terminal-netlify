import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { expect, test } from "../fixtures/test";

test("[STAB-BASE-02] @smoke visitor opens desktop applications through Russian controls", async ({ page }) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();

  await expect(desktop.systemStatus).toContainText("В СЕТИ");
  await expect(desktop.assistant).toBeVisible();
  await desktop.openApp("Глобальный поиск");

  const searchWindow = desktop.window("Глобальный поиск");
  await expect(searchWindow.getByRole("heading", { name: "Глобальный поиск" })).toBeVisible();
  await expect(searchWindow.getByPlaceholder("Введите название, код или тему")).toBeVisible();
});

test("[STAB-BASE-02] visitor settings persist across a real reload", async ({ page }) => {
  const desktop = new DesktopPage(page);
  const initialDataReady = Promise.all(
    ["/api/content", "/api/access", "/api/employees"].map((pathname) =>
      page.waitForResponse((response) => new URL(response.url()).pathname === pathname),
    ),
  );
  await desktop.goto();
  // Firefox reports in-flight fetches as NS_BINDING_ABORTED when reload replaces
  // the document. Let the desktop's initial reads settle so this test measures
  // persisted settings instead of a navigation cancellation.
  await initialDataReady;
  await desktop.openApp("Настройки");

  await desktop.chooseSetting("Анимации", "Выключены");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

  await page.reload();
  await desktop.desktop.waitFor();
  await desktop.openApp("Настройки");
  await expect(desktop.setting("Анимации", "Выключены")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
});

test("[STAB-BASE-02] Promotion exposes a safe participant identity gate", async ({ page }) => {
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();

  await expect(promotion.heading("ПРОВЕРИТЬ ПОВЫШЕНИЕ")).toBeVisible();
  await expect(promotion.nickname).toHaveAttribute("autocomplete", "off");
  await expect(promotion.checkNickname).toBeDisabled();
  await promotion.nickname.fill("portia_e2e_missing");
  await expect(promotion.checkNickname).toBeEnabled();
  await expect(promotion.window).toContainText("Первая заявка закрепит этот ник за устройством");
});

test("[STAB-BASE-02] @smoke touch viewport keeps primary controls usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone-only touch and viewport smoke");
  const desktop = new DesktopPage(page);
  await desktop.goto();

  await desktop.shortcut("Настройки").tap();
  await expect(desktop.window("Настройки")).toBeVisible();
  await expect(desktop.setting("Паук", "Скрыть")).toBeVisible();
});
