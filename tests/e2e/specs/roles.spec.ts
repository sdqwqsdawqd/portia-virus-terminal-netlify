import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";

test("[STAB-BASE-02] visitor is denied editor authority and receives the real sign-in route", async ({ page, actor }) => {
  expect(actor.status).toBe("READY");
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();

  await expect(editor.openEditor).toBeDisabled();
  await expect(editor.signIn).toHaveAttribute("href", "/owner-login");
});

for (const role of ["participant", "editor", "promo-reviewer", "owner"] as const) {
  test.describe(`${role} server-authorized lane`, () => {
    test.use({ actorRole: role });

    test(`[STAB-BASE-02] ${role} traverses its real authorized decision`, async ({ page, actor }) => {
      expect(actor.status).toBe("READY");
      const editor = new EditorPage(page);
      await editor.desktop.goto();

      if (role === "participant") {
        await expect(editor.desktop.shortcut("Повышение")).toBeVisible();
        return;
      }

      await editor.openSettings();
      await expect(editor.openEditor).toBeEnabled();
      await editor.openEditor.click();
      await expect(editor.editorHeading()).toBeVisible();
      await expect(editor.editorNavigation()).toBeVisible();
    });
  });
}
