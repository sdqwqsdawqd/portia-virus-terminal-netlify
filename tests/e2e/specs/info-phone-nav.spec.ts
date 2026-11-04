import type { Locator, Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

// Phase 20-16 (D-28..D-32): «Информация» on a phone is a list of sections from top to bottom, an article on its own screen with «←»,
// «Далее» at the end of an article of a section with subsections, and a reveal from the global search. The PC view is not changed.
// The records come from the target's own /api/content answer (read, never replaced). A check the target holds no record for is skipped as
// «BLOCKED (DATA)», never counted as a pass. The physical-phone check is 20-14 (INFO-PHONE-*), not this file.

type Subsection = { id: string; title: string; blocks: unknown[] };
type Section = { id: string; title: string; body: string; subsections: Subsection[] };

const isPhone = () => test.info().project.name.endsWith("-phone");

async function infoSections(page: Page): Promise<Section[]> {
  const response = await page.request.get("/api/content");
  if (!response.ok()) return [];
  const json = (await response.json()) as { content?: { infoSections?: Section[] } };
  return json.content?.infoSections ?? [];
}

async function openInfo(page: Page) {
  const desktop = new DesktopPage(page);
  await desktop.goto();
  await desktop.openApp("Информация");
  const window = desktop.window("Информация");
  await expect(window.getByRole("status").filter({ hasText: /Загрузка/ })).toHaveCount(0);
  await expect(window.locator(".info-index")).toBeVisible();
  // The window scales in on open: measure the settled layout, not a frame of the animation.
  await window.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  return { desktop, window };
}

const sectionRows = (window: Locator) => window.locator(".info-index > div > button");
const itemById = (window: Locator, id: string) => window.locator(`[data-info-id="${id}"]`);
const backButton = (window: Locator) => window.getByRole("button", { name: "Назад к разделам" });

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("element has no box");
  return rect;
}

test.describe("phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isPhone(), `phone-only: ${testInfo.project.name} keeps the PC view of «Информация».`);
  });

  test("[STAB-A11Y-02] D-28 the sections are a list from top to bottom without a horizontal scroll", async ({ page }) => {
    const sections = await infoSections(page);
    test.skip(sections.length < 2, "BLOCKED (DATA): the target serves fewer than two «Информация» sections.");
    const { window } = await openInfo(page);
    await expect(window.locator(".info-library")).toHaveAttribute("data-info-screen", "list");
    await expect(window.locator(".info-document")).toBeHidden();
    const first = await box(sectionRows(window).nth(0));
    const second = await box(sectionRows(window).nth(1));
    expect(second.y, "the second section sits below the first").toBeGreaterThanOrEqual(first.y + first.height - 1);
    expect(first.height, "touch target").toBeGreaterThanOrEqual(44);
    const overflow = await window.locator(".info-index").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "list scrollWidth within clientWidth").toBeLessThanOrEqual(1);
  });

  test("[STAB-A11Y-02] D-30 a section opens as its own screen, «←» returns the list and the focus to that item", async ({ page }) => {
    const sections = await infoSections(page);
    const plain = sections.find((section) => section.title.trim() && section.subsections.length === 0);
    test.skip(!plain, "BLOCKED (DATA): the target serves no «Информация» section without subsections.");
    if (!plain) return;
    const { window } = await openInfo(page);
    await itemById(window, plain.id).click();

    await expect(window.locator(".info-library")).toHaveAttribute("data-info-screen", "article");
    await expect(window.locator(".info-index")).toBeHidden();
    const heading = window.locator(".info-document h1");
    await expect(heading).toHaveText(plain.title);
    await expect(heading).toBeFocused();

    const back = backButton(window);
    await expect(back).toBeVisible();
    await expect(back).toHaveText("←");
    const backBox = await box(back);
    expect(backBox.width, "back target width").toBeGreaterThanOrEqual(44);
    expect(backBox.height, "back target height").toBeGreaterThanOrEqual(44);
    const headingBox = await box(heading);
    expect(backBox.y + backBox.height, "the heading starts below «←» at rest").toBeLessThanOrEqual(headingBox.y);
    await expect(window.getByRole("button", { name: "Назад к разделам" })).toHaveCount(1);

    await back.click();
    await expect(window.locator(".info-library")).toHaveAttribute("data-info-screen", "list");
    await expect(window.locator(".info-index")).toBeVisible();
    await expect(itemById(window, plain.id)).toBeFocused();
  });
});

test("[STAB-A11Y-02] D-28 the PC view keeps the index beside the article without «←»", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium-desktop", "the PC check runs on chromium-desktop; phone-only lanes cover the phone screens.");
  const { window } = await openInfo(page);
  await expect(window.locator(".info-library")).not.toHaveAttribute("data-info-screen", /.*/);
  await expect(window.locator(".info-phone-back")).toHaveCount(0);
  await expect(window.locator(".info-next")).toHaveCount(0);
  await expect(window.locator(".info-index")).toBeVisible();
  await expect(window.locator(".info-document")).toBeVisible();
  const index = await box(window.locator(".info-index"));
  const document = await box(window.locator(".info-document"));
  expect(document.x, "the article is to the right of the index").toBeGreaterThanOrEqual(index.x + index.width - 1);
});
