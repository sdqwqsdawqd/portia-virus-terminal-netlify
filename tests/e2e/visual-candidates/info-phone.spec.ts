import type { Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";
import { captureCandidate, recordBlockedCandidate } from "./support";

// Phase 20-16 (D-28..D-32): «Информация» on a phone, before and after the list-navigation change.
// Candidates only: every frame goes under visual-candidates/.runs; nothing here touches tests/e2e/visual/__screenshots__.
// STAB-BASE-03 is the only requirement family support.ts accepts; the evidence belongs to STAB-A11Y-02/03.
// The records come from the target's own /api/content answer (read, never replaced). A frame the target has no data for is recorded
// BLOCKED (DATA) and skipped, never counted as a pass.

test.beforeEach(({}, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-phone"), "phone-only, D-28: the PC view of «Информация» is not changed by 20-16.");
});

type Section = { id: string; title: string; body?: string; subsections: { id: string; title: string; blocks: unknown[] }[] };

async function infoSections(page: Page): Promise<Section[]> {
  const response = await page.request.get("/api/content");
  if (!response.ok()) return [];
  const json = (await response.json()) as { content?: { infoSections?: Section[] } };
  return json.content?.infoSections ?? [];
}

const intendedSnapshot = "not-promoted: evidence 20-16 (D-28..D-32)";
const base = { requirement: "STAB-BASE-03", surface: "Информация на телефоне", actor: "visitor" } as const;

async function openInfo(page: Page) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Информация");
  const window = desktop.window("Информация");
  await expect(window.getByRole("status").filter({ hasText: /Загрузка/ })).toHaveCount(0);
  await expect(window.locator(".info-index")).toBeVisible();
  return window;
}

test("[STAB-A11Y-02] info-phone-open: the list of sections as first seen", async ({ page, browser, determinism }, testInfo) => {
  const window = await openInfo(page);
  await expect(window.locator(".info-index > div").first()).toBeVisible();
  await captureCandidate({ page, browser, determinism, testInfo }, {
    ...base, id: "info-phone-open", state: "open", intendedSnapshot,
  });
});

test("[STAB-A11Y-02] info-phone-article: the article of the first section without subsections", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const sections = await infoSections(page);
  const plain = sections.find((section) => section.title.trim() && section.subsections.length === 0);
  const spec = { ...base, id: "info-phone-article", state: "article", intendedSnapshot };
  // The site is opened first: the BLOCKED record reads the page's settings, which about:blank does not allow.
  const window = await openInfo(page);
  if (!plain) {
    await recordBlockedCandidate(context, spec, { reasonCode: "PUBLIC_STATE_FIXTURE_REQUIRED", recoveryPhase: 20, reason: "BLOCKED (DATA): the target serves no «Информация» section without subsections." });
    test.skip(true, "BLOCKED (DATA): no section without subsections on this target.");
    return;
  }
  await window.locator(".info-index > div > button").filter({ has: page.getByText(plain.title, { exact: true }) }).first().click();
  await expect(window.locator(".info-document h1")).toHaveText(plain.title);
  await captureCandidate(context, spec);
});

// The two frames below exist only after 20-16: they are taken when the library carries data-info-screen, otherwise nothing is recorded.
async function afterChangeOnly(window: Awaited<ReturnType<typeof openInfo>>) {
  return (await window.locator(".info-library").getAttribute("data-info-screen")) !== null;
}

const withSubsections = (sections: Section[]) => sections.find((section) => section.title.trim() && section.subsections.length >= 2);

test("[STAB-A11Y-02] info-phone-expanded: a section with subsections opened in the list", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const section = withSubsections(await infoSections(page));
  const spec = { ...base, id: "info-phone-expanded", state: "expanded", intendedSnapshot };
  const window = await openInfo(page);
  if (!(await afterChangeOnly(window))) return;
  if (!section) {
    await recordBlockedCandidate(context, spec, { reasonCode: "PUBLIC_STATE_FIXTURE_REQUIRED", recoveryPhase: 20, reason: "BLOCKED (DATA): the target serves no «Информация» section with two or more subsections." });
    test.skip(true, "BLOCKED (DATA): no section with two or more subsections on this target.");
    return;
  }
  await window.locator(".info-index > div > button[aria-expanded]").filter({ has: page.getByText(section.title, { exact: true }) }).click();
  await expect(window.locator(`[data-info-id="${section.subsections[0].id}"]`)).toBeVisible();
  await captureCandidate(context, spec);
});

test("[STAB-A11Y-02] info-phone-next: the end of the first subsection article with «Далее»", async ({ page, browser, determinism }, testInfo) => {
  const context = { page, browser, determinism, testInfo };
  const section = withSubsections(await infoSections(page));
  const spec = { ...base, id: "info-phone-next", state: "next", intendedSnapshot };
  const window = await openInfo(page);
  if (!(await afterChangeOnly(window))) return;
  if (!section) {
    await recordBlockedCandidate(context, spec, { reasonCode: "PUBLIC_STATE_FIXTURE_REQUIRED", recoveryPhase: 20, reason: "BLOCKED (DATA): the target serves no «Информация» section with two or more subsections." });
    test.skip(true, "BLOCKED (DATA): no section with two or more subsections on this target.");
    return;
  }
  await window.locator(".info-index > div > button[aria-expanded]").filter({ has: page.getByText(section.title, { exact: true }) }).click();
  await window.locator(`[data-info-id="${section.subsections[0].id}"]`).click();
  const next = window.locator(".info-next button");
  await expect(next).toBeVisible();
  await next.scrollIntoViewIfNeeded();
  await captureCandidate(context, spec);
});
