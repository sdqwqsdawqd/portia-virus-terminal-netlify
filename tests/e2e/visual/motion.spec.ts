import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Phase 15 pixel authority is pinned to chromium-desktop.");
});

test("[STAB-BASE-03] approved shortcut motion key states", async ({ page }, testInfo) => {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  const shortcut = desktop.shortcut("Настройки");
  const compare = (id: string) => expect(page).toHaveScreenshot(`${id}--${testInfo.project.name}.png`, {
    animations: "allow",
    maxDiffPixels: 2_500,
  });

  await shortcut.hover();
  await expect(shortcut).toHaveClass(/is-icon-animating/);
  await compare("motion-shortcut-start");
  await page.clock.runFor(260);
  await compare("motion-shortcut-key");

  // toHaveScreenshot may consume the first 760 ms cycle while it checks the
  // approved frame. Start one fresh cycle so the pointer-exit contract is
  // asserted before the comparison, without changing product timing.
  await page.clock.runFor(760);
  await expect(shortcut).not.toHaveClass(/is-icon-animating/);
  await page.mouse.move(720, 450);
  await shortcut.hover();
  await expect(shortcut).toHaveClass(/is-icon-animating/);
  await page.clock.runFor(260);
  await page.mouse.move(720, 450);
  await expect(shortcut).toHaveClass(/is-icon-animating/);
  await compare("motion-shortcut-interruption");
  await page.clock.runFor(500);
  await expect(shortcut).not.toHaveClass(/is-icon-animating/);
  await compare("motion-shortcut-end");
  await page.clock.runFor(1_000);
  await compare("motion-shortcut-rest");
});
