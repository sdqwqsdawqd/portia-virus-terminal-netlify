import { EditorPage } from "../pages/editor.page";
import { test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

test("[STAB-BASE-03] capture signed-out editor access states", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await captureCandidate(context, {
    id: "editor-visitor-denied",
    requirement: "STAB-BASE-03",
    surface: "Editor",
    actor: "visitor",
    state: "settings entry; editor action denied; sign-in route offered",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/editor-visitor-denied--${testInfo.project.name}.png`,
  });

  await editor.gotoLogin();
  await captureCandidate(context, {
    id: "editor-signed-out-login",
    requirement: "STAB-BASE-03",
    surface: "Editor",
    actor: "visitor",
    state: "signed-out owner/editor login",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/editor-signed-out-login--${testInfo.project.name}.png`,
  });
});

test("[STAB-BASE-03] inventory privileged editor states as blocked", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  await page.goto("/");
  for (const [id, actor, state] of [
    ["editor-role-clean", "editor", "tab available; clean"],
    ["editor-role-closed", "editor", "tab closed/revoked"],
    ["editor-dirty-saving-saved", "editor", "dirty, saving and saved"],
    ["editor-conflict-error", "editor", "revision conflict and save error"],
    ["editor-long-list-dialog", "editor", "long list/internal scroll and dialogs"],
    ["editor-wysiwyg", "editor", "WYSIWYG selection and format panel"],
    ["editor-phone-keyboard", "editor", "phone keyboard and touch"],
    ["promotion-reviewer-editor", "promo-reviewer", "Promotion reviewer editor access"],
    ["owner-editor-access", "owner", "owner access and editor management"],
  ] as const) {
    await recordBlockedCandidate(context, {
      id,
      requirement: "STAB-BASE-03",
      surface: "Editor",
      actor,
      state,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    }, {
      reasonCode: "ISOLATED_AUTH_REQUIRED",
      recoveryPhase: 16,
      reason: "Dedicated isolated Supabase target and disposable authorized identity are not provisioned.",
    });
  }
});
