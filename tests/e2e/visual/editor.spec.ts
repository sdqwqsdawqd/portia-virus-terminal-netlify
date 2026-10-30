import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

test("[STAB-BASE-03] approved signed-out editor access", async ({ page }, testInfo) => {
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(page).toHaveScreenshot(`editor-visitor-denied--${testInfo.project.name}.png`, { maxDiffPixels: 2_500 });

  await editor.gotoLogin();
  await expect(page).toHaveScreenshot(`editor-signed-out-login--${testInfo.project.name}.png`, { maxDiffPixels: 2_500 });
});
