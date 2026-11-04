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
    // A section without subsections has no «Далее».
    await itemById(window, plain.id).click();
    await expect(window.locator(".info-document h1")).toHaveText(plain.title);
    await expect(window.locator(".info-next")).toHaveCount(0);
  });

  // ---- D-29, D-31, D-32: need a section with at least two subsections; the target may not serve one (BLOCKED (DATA), never a pass). ----

  const multi = (sections: Section[]) => sections.find((section) => section.title.trim() && section.subsections.length >= 2);
  const untitled = (title: string) => title.trim() ? title : "БЕЗ НАЗВАНИЯ";
  const toggleOf = (window: Locator, page: Page, section: Section) =>
    window.locator(".info-index > div > button[aria-expanded]").filter({ has: page.getByText(section.title, { exact: true }) });
  const BLOCKED_MULTI = "BLOCKED (DATA): the target serves no «Информация» section with two or more subsections.";

  test("[STAB-A11Y-03] D-29 a section with subsections opens and closes its group (aria-expanded), the marker stays in its own column", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    if (!section) return;
    const { window } = await openInfo(page);
    const toggle = toggleOf(window, page, section);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(itemById(window, section.subsections[0].id)).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(window.locator(".info-library")).toHaveAttribute("data-info-screen", "list");
    for (const sub of section.subsections) await expect(itemById(window, sub.id)).toBeVisible();
    const label = await box(toggle.locator("span").first());
    const marker = await box(toggle.locator(".info-sub-marker"));
    expect(marker.x, "the marker does not cover the title").toBeGreaterThanOrEqual(label.x + label.width - 1);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(itemById(window, section.subsections[0].id)).toHaveCount(0);
  });

  test("[STAB-A11Y-02] D-31 «Далее» ends the article in the flow, leads inside the section and is absent in the last subsection", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    if (!section) return;
    const { window } = await openInfo(page);
    await toggleOf(window, page, section).click();
    await itemById(window, section.subsections[0].id).click();
    for (let index = 0; index < section.subsections.length; index += 1) {
      const sub = section.subsections[index];
      const heading = window.locator(".info-document h1");
      await expect(heading).toHaveText(untitled(sub.title));
      await expect(heading).toBeFocused();
      const next = section.subsections[index + 1];
      if (!next) {
        await expect(window.locator(".info-next")).toHaveCount(0);
        break;
      }
      const button = window.getByRole("button", { name: `Далее: ${untitled(next.title)}` });
      await expect(button).toHaveCount(1);
      await button.scrollIntoViewIfNeeded();
      const position = await button.evaluate((element) => [element, element.parentElement].map((node) => node ? getComputedStyle(node).position : "").join("/"));
      expect(position, "«Далее» and its wrapper stay in the flow").toBe("static/static");
      const rect = await box(button);
      const blocksBottom = await window.locator(".info-document .content-fade").last().evaluate((element) => {
        const parts = [...element.children].filter((child) => !child.classList.contains("info-next"));
        return Math.max(...parts.map((part) => part.getBoundingClientRect().bottom));
      });
      expect(rect.y, "«Далее» sits below the last block").toBeGreaterThanOrEqual(blocksBottom - 1);
      const article = await box(window.locator(".info-document"));
      expect(article.x + article.width - rect.x - rect.width, "«Далее» is on the right").toBeLessThanOrEqual(40);
      expect(rect.x + rect.width, "no sideways overflow").toBeLessThanOrEqual(article.x + article.width + 1);
      expect(rect.height).toBeGreaterThanOrEqual(43);
      await button.click();
    }
  });

  test("[STAB-A11Y-02] D-31 from the article of a section «Далее» leads to its first subsection; «Обзор раздела» opens that article", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    test.skip(!section?.body.trim(), "BLOCKED (DATA): the section with subsections has no text of its own, so it has no «Обзор раздела».");
    if (!section) return;
    const { window } = await openInfo(page);
    await toggleOf(window, page, section).click();
    await window.getByRole("button", { name: "Обзор раздела" }).first().click();
    await expect(window.locator(".info-document h1")).toHaveText(section.title);
    await window.getByRole("button", { name: `Далее: ${untitled(section.subsections[0].title)}` }).click();
    await expect(window.locator(".info-document h1")).toHaveText(untitled(section.subsections[0].title));
    await backButton(window).click();
    await expect(itemById(window, section.subsections[0].id)).toBeFocused();
  });

  test("[STAB-A11Y-03] keyboard: Enter toggles a section, opens a subsection on its heading and «←» returns the focus to the subsection", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    if (!section) return;
    const { window } = await openInfo(page);
    const toggle = toggleOf(window, page, section);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const sub = itemById(window, section.subsections[0].id);
    await sub.focus();
    await page.keyboard.press("Enter");
    await expect(window.locator(".info-document h1")).toBeFocused();
    await backButton(window).focus();
    await page.keyboard.press("Enter");
    await expect(sub).toBeFocused();
  });

  for (const from of ["list", "article"] as const) {
    test(`[STAB-A11Y-02] D-32 a search hit on a subsection shows the list with its section opened and the item marked (from the ${from})`, async ({ page }) => {
      const sections = await infoSections(page);
      const section = multi(sections);
      const target = section?.subsections.find((sub) => sub.title.trim());
      test.skip(!section || !target, BLOCKED_MULTI);
      if (!section || !target) return;
      const plain = sections.find((item) => item.title.trim() && item.subsections.length === 0);
      test.skip(from === "article" && !plain, "BLOCKED (DATA): the target serves no «Информация» section without subsections to open first.");
      const { desktop, window } = await openInfo(page);
      if (from === "article" && plain) {
        await itemById(window, plain.id).click();
        await expect(window.locator(".info-library")).toHaveAttribute("data-info-screen", "article");
      }
      // A phone window is full screen and hides the icons: close «Информация» (its screen and opened sections stay in the page) to reach the search.
      await desktop.closeApp("Информация");
      await desktop.openApp("Глобальный поиск");
      const search = desktop.window("Глобальный поиск");
      await search.getByRole("searchbox").fill(target.title);
      const row = search.locator(".global-result")
        .filter({ has: page.locator(".global-result-mark", { hasText: /^INF$/ }) })
        .filter({ hasText: target.title })
        .first();
      await expect(row).toBeVisible();
      await row.click();

      const info = desktop.window("Информация");
      await expect(info).toBeVisible();
      await expect(info.locator(".info-library")).toHaveAttribute("data-info-screen", "list");
      const hit = info.locator(".info-index [data-search-hit='true']");
      await expect(hit).toHaveCount(1);
      await expect(hit).toHaveAttribute("aria-current", "true");
      await expect(hit).toHaveAttribute("data-info-id", target.id);
      await expect(hit).toBeInViewport();
      await expect(toggleOf(info, page, section)).toHaveAttribute("aria-expanded", "true");
    });
  }
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
