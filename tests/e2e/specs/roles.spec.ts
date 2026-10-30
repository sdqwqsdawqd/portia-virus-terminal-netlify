import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";
import {
  actorAvailability,
  type ActorBlockCode,
  type ActorRole,
} from "../fixtures/actors";

const privilegedRoles = [
  "participant",
  "editor",
  "promo-reviewer",
  "owner",
] as const satisfies readonly ActorRole[];

test("[STAB-BASE-02] visitor is denied editor authority and receives the real sign-in route", async ({ page, actor }) => {
  expect(actor.status).toBe("READY");
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();

  await expect(editor.openEditor).toBeDisabled();
  await expect(editor.signIn).toHaveAttribute("href", "/owner-login");
});

test("[STAB-BASE-02] privileged role inventory remains explicitly blocked without verified authority", async () => {
  const expectedCodes = new Set<ActorBlockCode>([
    "TARGET_NOT_ISOLATED",
    "AUTHENTICATED_SESSION_UNPROVEN",
  ]);

  for (const role of privilegedRoles) {
    const availability = actorAvailability(role);
    expect(availability.status, `${role} must fail closed`).toBe("BLOCKED");
    if (availability.status === "BLOCKED") {
      expect(expectedCodes.has(availability.code)).toBe(true);
      expect(availability.reason).not.toBe("");
    }
  }
});

for (const role of privilegedRoles) {
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
