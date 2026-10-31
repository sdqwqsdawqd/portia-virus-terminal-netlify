import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

test("[STAB-BASE-03] capture safe participant Promotion lookup", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();
  await expect(promotion.heading("ПРОВЕРИТЬ ПОВЫШЕНИЕ")).toBeVisible();
  await captureCandidate(context, {
    id: "promotion-participant-lookup",
    requirement: "STAB-BASE-03",
    surface: "Promotion",
    actor: "participant-unbound",
    state: "safe participant lookup; no nickname or private projection captured",
    intendedSnapshot: `tests/e2e/visual/__screenshots__/promotion-participant-lookup--${testInfo.project.name}.png`,
  });
});

test("[STAB-BASE-03] inventory private Promotion states as blocked", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  await page.goto("/");
  for (const [id, actor, state] of [
    ["promotion-eligible", "participant", "eligible action"],
    ["promotion-cooldown", "participant", "cooldown"],
    ["promotion-active-request", "participant", "active ordinary/qualification request"],
    ["promotion-assigned", "participant", "assigned task or qualification"],
    ["promotion-result", "participant", "safe pass/fail result"],
    ["promotion-safe-error", "participant", "safe first-party failure"],
    ["promotion-reviewer-queue", "promo-reviewer", "claimed and unclaimed reviewer queue"],
    ["promotion-question-bank", "promo-reviewer", "bank list/editor/count/preview/save"],
    ["promotion-qualification-lock", "participant", "active qualification lock and question types"],
    ["promotion-deadline", "participant", "qualification deadline and terminal state"],
    ["promotion-phone", "participant", "phone qualification variant"],
  ] as const) {
    await recordBlockedCandidate(context, {
      id,
      requirement: "STAB-BASE-03",
      surface: "Promotion",
      actor,
      state,
      intendedSnapshot: `tests/e2e/visual/__screenshots__/${id}--${testInfo.project.name}.png`,
    }, {
      reasonCode: "ISOLATED_PROMOTION_DATA_REQUIRED",
      recoveryPhase: 19,
      reason: "State requires isolated server fixtures; private questions, answers, notes and live employee data cannot enter candidate evidence.",
    });
  }
});
