import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";
import { visualPolicy } from "../fixtures/visual-policy";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

test("[STAB-BASE-03] approved signed-out editor access", async ({ page }, testInfo) => {
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.settingsWindow).toBeVisible();
  await expect(editor.openEditor).toBeDisabled();
  await expect(editor.signIn).toBeVisible();
  await expect(page).toHaveScreenshot(`editor-visitor-denied--${testInfo.project.name}.png`, visualPolicy(page, "editor:visitor-denied"));

  await editor.gotoLogin();
  await expect(page.getByRole("heading", { name: "Вход", exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot(`editor-signed-out-login--${testInfo.project.name}.png`, visualPolicy(page, "editor:signed-out-login"));
});
