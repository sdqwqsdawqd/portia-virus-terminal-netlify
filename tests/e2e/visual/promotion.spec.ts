import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { expect, test } from "../fixtures/test";
import { visualPolicy } from "../fixtures/visual-policy";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

test("[STAB-BASE-03] approved safe Promotion participant lookup", async ({ page }, testInfo) => {
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();
  await expect(promotion.heading("ПРОВЕРИТЬ ПОВЫШЕНИЕ")).toBeVisible();
  await expect(page).toHaveScreenshot(`promotion-participant-lookup--${testInfo.project.name}.png`, visualPolicy(page, "promotion:participant-lookup"));
});
