import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page, Route } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { PromotionPage } from "../pages/promotion.page";
import type { DiagnosticLedger } from "../fixtures/diagnostics";
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

// ---- Phase 20-06 (D-17/D-18/D-20): participant (E4) and reviewer (E5) redesign -----------------------------------------------------
// Candidates only: frames go under visual-candidates/.runs and nothing here touches tests/e2e/visual/__screenshots__.
// The spec never answers an own /api route with invented data: it holds or aborts the real request (a fault), so what it shows is what the
// target really does. A state that needs a participant row, a reviewer role or queue/bank records is recorded BLOCKED and is not a pass.
// The requirement id of a frame is STAB-BASE-03 because that is the only family support.ts accepts; the evidence belongs to STAB-VIS-04.

const lanes = new Set(["chromium-desktop", "chromium-phone"]);
// Exactly the 64 characters the field accepts (maxLength), with no break opportunity.
const longNickname = "Очень_длинный_ник_участника_без_пробелов_1234567890_ABCDEFGHIJ_ok".slice(0, 64);
const statusWithNickname = "**/api/promotion/status?nickname=*";

async function holdNicknameLookup(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/promotion/status**", async (route: Route) => {
    if (!new URL(route.request().url()).searchParams.has("nickname")) { await route.fallback(); return; }
    await gate;
    await route.fallback().catch(() => undefined);
  });
  return release;
}

/** The fault this spec causes on purpose; every other diagnostic still fails the test. */
function forgiveFaults(diagnostics: DiagnosticLedger) {
  const kept = diagnostics.entries.filter((entry) => !(
    (entry.kind === "requestfailed" && /ERR_FAILED|ERR_ABORTED|NS_ERROR|Failed|aborted|Blocked by Web Inspector|cancelled/i.test(entry.text))
    || (entry.kind === "console" && /Failed to load resource|ERR_FAILED/i.test(entry.text))
  ));
  diagnostics.entries.splice(0, diagnostics.entries.length, ...kept);
}

/** A window scales in when it opens; sizes are measured at rest. */
async function settle(window: Locator) {
  await window.evaluate((node) => Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))));
}

async function assertTouchTargets(locators: Locator[]) {
  for (const locator of locators) {
    const box = await locator.boundingBox();
    expect(box, "control is laid out").not.toBeNull();
    expect(box!.height, "touch target height").toBeGreaterThanOrEqual(44);
    expect(box!.width, "touch target width").toBeGreaterThanOrEqual(44);
  }
}

async function assertNoOverflow(page: Page, window: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth), "no page-level horizontal scroll").toBe(true);
  expect(await window.locator(".promotion-app").evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "no horizontal scroll inside the window").toBe(true);
}

test("[STAB-VIS-04] E4 participant lookup: empty gate keeps one clear step, 44px targets and no overflow", async ({ page, browser, determinism }, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-06 candidates run on chromium-desktop and chromium-phone.");
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();
  await expect(promotion.heading("ПРОВЕРИТЬ ПОВЫШЕНИЕ")).toBeVisible();
  await expect(promotion.nickname).toHaveValue("");
  await expect(promotion.checkNickname).toBeDisabled();
  await settle(promotion.window);
  await expect(promotion.window.getByText("Первая заявка закрепит ник за устройством.") /* D-56 (20-37) */).toBeVisible();
  await settle(promotion.window);
  await assertTouchTargets([promotion.nickname, promotion.checkNickname]);
  await assertNoOverflow(page, promotion.window);
  await captureCandidate(context, {
    id: "promotion-e4-gate-empty", requirement: "STAB-BASE-03", surface: "Promotion", actor: "participant-unbound",
    state: "E4 empty: lookup gate, binding note, disabled action until a nickname is typed",
    intendedSnapshot: "phase20-promotion (после одобрения 20-11)",
  });
});

test("[STAB-VIS-04] E4 loading: the typed long nickname stays in the field while the lookup is held", async ({ page, browser, determinism }, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-06 candidates run on chromium-desktop and chromium-phone.");
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  const release = await holdNicknameLookup(page);
  await desktop.goto();
  await promotion.open();
  await promotion.nickname.fill(longNickname);
  await promotion.checkNickname.click();
  const checking = promotion.window.getByRole("button", { name: "ПРОВЕРЯЕМ…" });
  await expect(checking).toBeVisible();
  await expect(checking).toBeDisabled();
  await expect(promotion.nickname).toHaveValue(longNickname);
  await expect(promotion.window.getByRole("status")).toContainText("Проверяем ник. Введённый ник сохранён.");
  await assertNoOverflow(page, promotion.window);
  await captureCandidate(context, {
    id: "promotion-e4-gate-loading", requirement: "STAB-BASE-03", surface: "Promotion", actor: "participant-unbound",
    state: "E4 loading + long-text: lookup held, 64-character nickname kept, action locked with its own text",
    intendedSnapshot: "phase20-promotion (после одобрения 20-11)",
  });
  release();
});

test("[STAB-VIS-04] E4 error: a failed lookup says why, keeps the nickname and offers the repeat", async ({ page, browser, determinism, diagnostics }, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-06 candidates run on chromium-desktop and chromium-phone.");
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await page.route(statusWithNickname, (route) => route.abort("failed"));
  await desktop.goto();
  await promotion.open();
  await promotion.nickname.fill(longNickname);
  await promotion.checkNickname.click();
  await expect(promotion.alert()).toHaveText("Система повышения временно недоступна. Попробуйте позже.");
  await expect(promotion.nickname).toHaveValue(longNickname);
  await expect(promotion.checkNickname).toBeEnabled();
  await expect(promotion.checkNickname).toHaveText("ПРОВЕРИТЬ НИК");
  await expect(promotion.window.getByText("Ник сохранён. Нажмите «Проверить ник» ещё раз.") /* D-56 (20-37) */).toBeVisible();
  await expect(promotion.window.getByText("Первая заявка закрепит ник за устройством.")).toHaveCount(0); // D-56 (20-37)
  await settle(promotion.window);
  await assertTouchTargets([promotion.nickname, promotion.checkNickname]);
  await assertNoOverflow(page, promotion.window);
  await captureCandidate(context, {
    id: "promotion-e4-gate-error", requirement: "STAB-BASE-03", surface: "Promotion", actor: "participant-unbound",
    state: "E4 error: aborted lookup (fault), reason and repeat step visible, nickname kept",
    intendedSnapshot: "phase20-promotion (после одобрения 20-11)",
  });
  forgiveFaults(diagnostics);
});

test("[STAB-VIS-04] E4 error from the real target: an unlisted nickname is refused with the server's own reason and the field is kept", async ({ page, browser, determinism }, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-06 candidates run on chromium-desktop and chromium-phone.");
  const context = { page, browser, determinism, testInfo };
  const desktop = new DesktopPage(page);
  const promotion = new PromotionPage(page);
  await desktop.goto();
  await promotion.open();
  await promotion.nickname.fill(longNickname);
  await promotion.checkNickname.click();
  // The reason text is whatever the target answers (no invented response); the screen must show it, keep the field and offer the repeat.
  await expect(promotion.alert()).toBeVisible();
  expect((await promotion.alert().innerText()).trim().length).toBeGreaterThan(10);
  await expect(promotion.nickname).toHaveValue(longNickname);
  await expect(promotion.checkNickname).toBeEnabled();
  await expect(promotion.window.getByText("Ник сохранён. Нажмите «Проверить ник» ещё раз.") /* D-56 (20-37) */).toBeVisible();
  await settle(promotion.window);
  await assertTouchTargets([promotion.nickname, promotion.checkNickname]);
  await assertNoOverflow(page, promotion.window);
  await captureCandidate(context, {
    id: "promotion-e4-gate-refused", requirement: "STAB-BASE-03", surface: "Promotion", actor: "participant-unbound",
    state: "E4 error: the target's own refusal of an unlisted 64-character nickname; field kept, repeat step visible",
    intendedSnapshot: "phase20-promotion (после одобрения 20-11)",
  });
});

test("[STAB-VIS-04] E4/E5 source contract: order, separate flows, one action per card, no private fields, sizes and spacing", async () => {
  const read = (file: string) => readFileSync(path.resolve(file), "utf8").replaceAll("\r\n", "\n");
  const participant = read("components/portia-promotion.tsx");
  const main = read("components/portia-promotion-editor-main.tsx");
  const css = read("app/portia.css");

  // Participant order and split are unchanged: identity, then the two cards, then the hint and the history.
  expect(participant.indexOf("promotion-identity")).toBeLessThan(participant.indexOf("promotion-flow-list"));
  expect(participant.indexOf("promotion-flow-list")).toBeLessThan(participant.indexOf("promotion-cleanup-hint"));
  expect(participant.indexOf("promotion-cleanup-hint")).toBeLessThan(participant.indexOf("promotion-history"));
  expect(participant).toContain("promotion-ordinary-card");
  expect(participant).toContain("promotion-qualification-card");
  // One highlighted next step: only one card can carry data-next, and the only request button is gated by canRequest.
  expect(participant).toContain('data-next={next ? "true" : undefined}');
  expect(participant.match(/canRequest && <button/g)).toHaveLength(1);
  expect(participant).toContain("nextKind");
  // The state is a word, not only a colour.
  for (const word of ["ДОСТУПНО СЕЙЧАС", "ПОКА НЕДОСТУПНО", "В ПРОЦЕССЕ", "Почему сейчас нельзя"]) expect(participant).toContain(word);
  // The participant component never touches reviewer data.
  for (const forbidden of ["answerKey", "reviewerId", "reviewerName", "reviewerNote", "internalNote", "correctAnswer", "isCorrect", "futureQuestions"]) {
    expect(participant, forbidden).not.toContain(forbidden);
  }

  // Reviewer tabs, order and the manual verdict are unchanged.
  const tabs = ["ЗАПРОСЫ", "ЗАДАНИЯ", "КВАЛИФИКАЦИЯ"].map((label) => main.indexOf(`'${label}'`));
  expect(tabs.every((at) => at >= 0)).toBe(true);
  expect([...tabs].sort((a, b) => a - b)).toEqual(tabs);
  // D-56 (20-37): the hint under the percentage is gone.
  expect(main).not.toContain("Процент не принимает решение автоматически.");
  expect(main).toContain("Подтвердите итог");
  for (const label of ["Отклонить и удалить", "Удалить запрос", "Сбросить привязку"]) expect(main, label).toContain(label);
  // 409 keeps both alternatives and the typed forms live (the forms own their drafts; this view never clears them).
  expect(main).toContain("Загрузить их версию");
  expect(main).toContain("Оставить мой ввод");
  expect(main).toContain("response.status === 409");
  expect(main).toContain("Повторить загрузку");

  // 20-06 style blocks: fonts only 12/14/18/28 (no 9/10px), spacing on the 4px scale.
  const participantBlock = css.slice(css.indexOf("/* 20-06 (D-17/D-18/D-20)"), css.indexOf("@media (max-width: 520px) {\n  .promotion-app { height"));
  const reviewerBlock = css.slice(css.indexOf("/* 20-06 (D-18/D-20)"), css.indexOf("@media (max-width: 900px) {\n  .promotion-editor { display: block"));
  const blocks = `${participantBlock}\n${reviewerBlock}`;
  expect(participantBlock.length).toBeGreaterThan(300);
  expect(reviewerBlock.length).toBeGreaterThan(300);
  for (const font of blocks.matchAll(/font:\s*(?:\d{3}\s+)?(\d+)px/g)) expect([12, 14, 18, 28], `font size ${font[1]}px`).toContain(Number(font[1]));
  for (const spacing of blocks.matchAll(/(?:padding|margin|gap)[a-z-]*:\s*([^;}]+)[;}]/g)) {
    for (const value of spacing[1].matchAll(/(-?\d+)px/g)) expect(Number(value[1]) % 4, `spacing ${value[0]} in "${spacing[0]}"`).toBe(0);
  }
});

// ---- states that need data or a role this target does not have ------------------------------------------------------------------------

test("[STAB-VIS-04] E4/E5 states without a data source or reviewer role are recorded BLOCKED, never passed", async ({ page, browser, determinism }, testInfo) => {
  test.skip(!lanes.has(testInfo.project.name), "Phase 20-06 candidates run on chromium-desktop and chromium-phone.");
  const context = { page, browser, determinism, testInfo };
  await page.goto("/");
  const rows: Array<[id: string, actor: string, state: string, code: "ISOLATED_PROMOTION_DATA_REQUIRED" | "ISOLATED_AUTH_REQUIRED", detail: string]> = [
    ["promotion-e4-populated", "participant", "E4 populated: status, one highlighted next step, conditions beside it", "ISOLATED_PROMOTION_DATA_REQUIRED", "BLOCKED (DATA): a participant row with a title and an eligibility needs the isolated sheet roster."],
    ["promotion-e4-partial", "participant", "E4 partial: admitted employee without a promotion row; unavailable step explained", "ISOLATED_PROMOTION_DATA_REQUIRED", "BLOCKED (DATA): needs a roster member without a promotion row."],
    ["promotion-e4-stale-denied", "participant", "E4 stale strip and refused request: old confirmation never becomes the new one", "ISOLATED_PROMOTION_DATA_REQUIRED", "BLOCKED (DATA): needs a bound participant whose status poll can be refused by the server."],
    ["promotion-e4-zero-one-many", "participant", "E4 history of 0, 1 and 3 results", "ISOLATED_PROMOTION_DATA_REQUIRED", "BLOCKED (DATA): needs three stored results for one participant."],
    ["promotion-e4-long-task", "participant", "E4 long task text and long nickname inside a populated card", "ISOLATED_PROMOTION_DATA_REQUIRED", "BLOCKED (DATA): needs assigned tasks; the long-nickname gate is captured in promotion-e4-gate-loading."],
    ["promotion-e5-queue-empty-loading-error", "promo-reviewer", "E5 empty queue vs empty bank, skeleton keeps the tab, retry button", "ISOLATED_AUTH_REQUIRED", "BLOCKED (ENV): the reviewer editor needs the isolated reviewer identity from 19-21."],
    ["promotion-e5-queue-detail-pc", "promo-reviewer", "E5 PC: queue left, object centre, preview when wide", "ISOLATED_AUTH_REQUIRED", "BLOCKED (ENV): needs the reviewer role and queue records."],
    ["promotion-e5-queue-detail-phone", "promo-reviewer", "E5 phone: sequential screens with back and kept draft", "ISOLATED_AUTH_REQUIRED", "BLOCKED (ENV): needs the reviewer role and queue records on a phone."],
    ["promotion-e5-conflict-409", "promo-reviewer", "E5 409: both alternatives next to the kept input", "ISOLATED_AUTH_REQUIRED", "BLOCKED (ENV): a 409 needs two reviewers acting on one request."],
    ["promotion-e5-denied", "promo-reviewer", "E5 denied: forbidden data removed", "ISOLATED_AUTH_REQUIRED", "BLOCKED (ENV): needs a reviewer whose access is revoked."],
    ["promotion-e5-bank-count-add-save", "promo-reviewer", "E5 banks: count choice, add task, add question, save bank saved/error", "ISOLATED_AUTH_REQUIRED", "BLOCKED (ENV): saving a bank writes to the database and needs the isolated reviewer target."],
  ];
  for (const [id, actor, state, reasonCode, detail] of rows) {
    await recordBlockedCandidate(context, {
      id, requirement: "STAB-BASE-03", surface: "Promotion", actor, state,
      intendedSnapshot: "phase20-promotion (после одобрения 20-11)",
    }, { reasonCode, recoveryPhase: 19, reason: `${detail} Not replaced by a mocked response.` });
  }
});
