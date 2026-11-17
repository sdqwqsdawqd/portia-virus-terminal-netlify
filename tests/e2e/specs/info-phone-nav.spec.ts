import type { Locator, Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

// Phase 26-10 (UI-08, D-14 … D-16) over Phase 20-16 (D-29, D-31, D-32): «Информация» on a phone always shows the article; above it a quiet
// bar in the flow holds the «РАЗДЕЛЫ ▾» button and the name of the current article; the list of sections opens in the flow under the bar
// (#info-sections-list). «Далее» ends an article of a section with subsections; a global-search hit opens its article under a closed list.
// The PC view is not changed. The records come from the target's own /api/content answer (read, never replaced). A check the target holds
// no record for is skipped as «BLOCKED (DATA)», never counted as a pass; the whole file is BLOCKED (ENV) where no read data source is set.
// The physical-phone check is Phase 27, not this file.

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
  // D-14: the article is on screen at once (on a phone the list waits behind the РАЗДЕЛЫ button).
  await expect(window.locator(".info-document")).toBeVisible();
  // The window scales in on open: measure the settled layout, not a frame of the animation.
  await window.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))));
  return { desktop, window };
}

const sectionRows = (window: Locator) => window.locator(".info-index > div > button");
const itemById = (window: Locator, id: string) => window.locator(`[data-info-id="${id}"]`);
// The glyph is aria-hidden; with search hits the button is named «Разделы, найдено в разделах: N».
const sectionsButton = (window: Locator) => window.getByRole("button", { name: /^РАЗДЕЛЫ/i });
const sectionsList = (window: Locator) => window.locator("#info-sections-list");
const currentName = (window: Locator) => window.locator(".info-sections-bar .info-sections-current");

async function openSections(window: Locator) {
  const button = sectionsButton(window);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(sectionsList(window)).toBeVisible();
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("element has no box");
  return rect;
}

test.describe("phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isPhone(), `phone-only: ${testInfo.project.name} keeps the PC view of «Информация».`);
  });

  test("[STAB-A11Y-02] UI-08 D-14 the article is shown at once under a bar in the flow; the open list runs top to bottom without a horizontal scroll", async ({ page }) => {
    const sections = await infoSections(page);
    test.skip(sections.length < 2, "BLOCKED (DATA): the target serves fewer than two «Информация» sections.");
    const { window } = await openInfo(page);
    const button = sectionsButton(window);
    await expect(button).toHaveText(/^РАЗДЕЛЫ ▾$/);
    await expect(button).toHaveAttribute("aria-controls", "info-sections-list");
    await expect(sectionsList(window)).toBeHidden();
    await expect(window.locator(".info-document h1")).toHaveText(sections[0].title.trim() ? sections[0].title : "БЕЗ НАЗВАНИЯ");
    await expect(currentName(window)).toHaveText(sections[0].title.trim() ? sections[0].title : "Без названия");
    const position = await window.locator(".info-sections-bar").evaluate((element) => getComputedStyle(element).position);
    expect(position, "the bar is never fixed or sticky").toBe("static");
    const barBox = await box(window.locator(".info-sections-bar"));
    expect(barBox.height, "the bar is a touch row").toBeGreaterThanOrEqual(44);
    expect((await box(button)).height, "touch target").toBeGreaterThanOrEqual(44);
    const articleBox = await box(window.locator(".info-document"));
    expect(articleBox.y, "the article starts below the bar").toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);

    await openSections(window);
    await expect(button).toHaveText(/^РАЗДЕЛЫ ▴$/);
    const first = await box(sectionRows(window).nth(0));
    const second = await box(sectionRows(window).nth(1));
    expect(first.y, "the list opens under the bar").toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
    expect(second.y, "the second section sits below the first").toBeGreaterThanOrEqual(first.y + first.height - 1);
    expect(first.height, "touch target").toBeGreaterThanOrEqual(44);
    const overflow = await sectionsList(window).evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "list scrollWidth within clientWidth").toBeLessThanOrEqual(1);
    const inner = await sectionsList(window).evaluate((element) => element.scrollHeight - element.clientHeight);
    expect(inner, "no inner scroll: the page scrolls").toBeLessThanOrEqual(1);
    const pushed = await box(window.locator(".info-document"));
    expect(pushed.y, "the open list pushes the article down (no overlay)").toBeGreaterThanOrEqual(first.y + first.height - 1);
  });

  for (const width of [320, 390, 521, 900]) {
    test(`[STAB-A11Y-02] UI-08 D-14 at ${width}px the bar has no horizontal overflow and the name shrinks before the button`, async ({ page }) => {
      const sections = await infoSections(page);
      test.skip(sections.length === 0, "BLOCKED (DATA): the target serves no «Информация» section.");
      await page.setViewportSize({ width, height: 800 });
      const { window } = await openInfo(page);
      const button = await box(sectionsButton(window));
      const name = await box(currentName(window));
      expect(button.x + button.width, "the button and the name never overlap").toBeLessThanOrEqual(name.x + 1);
      const fits = await sectionsButton(window).evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
      expect(fits, "the button keeps its whole label").toBe(true);
      const bar = await window.locator(".info-sections-bar").evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(bar, "bar scrollWidth within clientWidth").toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - globalThis.innerWidth), "no page overflow").toBeLessThanOrEqual(0);
    });
  }

  test("[STAB-A11Y-02] UI-08 D-15 picking a section closes the list, shows its article, names it in the bar and returns the focus to РАЗДЕЛЫ", async ({ page }) => {
    const sections = await infoSections(page);
    const plain = sections.find((section) => section.title.trim() && section.subsections.length === 0);
    test.skip(!plain, "BLOCKED (DATA): the target serves no «Информация» section without subsections.");
    if (!plain) return;
    const { window } = await openInfo(page);
    await openSections(window);
    await itemById(window, plain.id).click();

    const button = sectionsButton(window);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(sectionsList(window)).toBeHidden();
    await expect(window.locator(".info-document h1")).toHaveText(plain.title);
    await expect(currentName(window)).toHaveText(plain.title);
    await expect(button).toBeFocused();
    // The two-screen model and its back arrow are retired.
    await expect(window.locator(".info-phone-back")).toHaveCount(0);
    await expect(window.getByRole("button", { name: "Назад к разделам" })).toHaveCount(0);
    // A section without subsections has no «Далее».
    await expect(window.locator(".info-next")).toHaveCount(0);
    // Picked again from the list, the current section keeps its mark.
    await openSections(window);
    await expect(itemById(window, plain.id)).toHaveClass(/\bactive\b/);
  });

  // ---- D-29, D-31, D-32: need a section with at least two subsections; the target may not serve one (BLOCKED (DATA), never a pass). ----

  const multi = (sections: Section[]) => sections.find((section) => section.title.trim() && section.subsections.length >= 2);
  const untitled = (title: string) => title.trim() ? title : "БЕЗ НАЗВАНИЯ";
  const barUntitled = (title: string) => title.trim() ? title : "Без названия";
  const toggleOf = (window: Locator, page: Page, section: Section) =>
    window.locator(".info-index > div > button[aria-expanded]").filter({ has: page.getByText(section.title, { exact: true }) });
  const BLOCKED_MULTI = "BLOCKED (DATA): the target serves no «Информация» section with two or more subsections.";

  test("[STAB-A11Y-03] D-29 in the open list a section with subsections opens and closes its group (aria-expanded), the marker stays in its own column", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    if (!section) return;
    const { window } = await openInfo(page);
    await openSections(window);
    const toggle = toggleOf(window, page, section);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(itemById(window, section.subsections[0].id)).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Opening a group is not a pick: the list stays open.
    await expect(sectionsButton(window)).toHaveAttribute("aria-expanded", "true");
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
    await openSections(window);
    await toggleOf(window, page, section).click();
    await itemById(window, section.subsections[0].id).click();
    // A pick gives the focus back to РАЗДЕЛЫ (D-15); «Далее» puts it on the heading of the next article.
    await expect(sectionsButton(window)).toBeFocused();
    for (let index = 0; index < section.subsections.length; index += 1) {
      const sub = section.subsections[index];
      const heading = window.locator(".info-document h1");
      await expect(heading).toHaveText(untitled(sub.title));
      await expect(currentName(window)).toHaveText(barUntitled(sub.title));
      if (index > 0) await expect(heading).toBeFocused();
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

  test("[STAB-A11Y-02] D-31 from the article of a section «Далее» leads to its first subsection; «Обзор раздела» opens that article; Escape closes the list", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    test.skip(!section?.body.trim(), "BLOCKED (DATA): the section with subsections has no text of its own, so it has no «Обзор раздела».");
    if (!section) return;
    const { window } = await openInfo(page);
    await openSections(window);
    await toggleOf(window, page, section).click();
    await window.getByRole("button", { name: "Обзор раздела" }).first().click();
    await expect(sectionsButton(window)).toHaveAttribute("aria-expanded", "false");
    await expect(window.locator(".info-document h1")).toHaveText(section.title);
    await expect(currentName(window)).toHaveText(section.title);
    await window.getByRole("button", { name: `Далее: ${untitled(section.subsections[0].title)}` }).click();
    await expect(window.locator(".info-document h1")).toHaveText(untitled(section.subsections[0].title));
    // The list still holds the section opened and marks the current subsection; Escape closes it and gives the focus back.
    await openSections(window);
    await expect(itemById(window, section.subsections[0].id)).toHaveClass(/\bactive\b/);
    await itemById(window, section.subsections[0].id).focus();
    await page.keyboard.press("Escape");
    await expect(sectionsButton(window)).toHaveAttribute("aria-expanded", "false");
    await expect(sectionsList(window)).toBeHidden();
    await expect(sectionsButton(window)).toBeFocused();
  });

  test("[STAB-A11Y-03] keyboard: Enter opens the list, Tab goes button → list, a subsection picked with Enter closes it, Escape closes it", async ({ page }) => {
    const section = multi(await infoSections(page));
    test.skip(!section, BLOCKED_MULTI);
    if (!section) return;
    const { window } = await openInfo(page);
    const button = sectionsButton(window);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(sectionRows(window).first()).toBeFocused();
    const toggle = toggleOf(window, page, section);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const sub = itemById(window, section.subsections[0].id);
    await sub.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(window.locator(".info-document h1")).toHaveText(untitled(section.subsections[0].title));
    await expect(button).toBeFocused();
    // A closed list is out of the Tab order: the next stop after the button is not a list row.
    await page.keyboard.press("Tab");
    expect(await sectionsList(window).evaluate((element) => element.contains(document.activeElement))).toBe(false);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
  });

  for (const from of ["closed", "open"] as const) {
    test(`[STAB-A11Y-02] D-16 a search hit on a subsection opens its article under a closed list and the button counts it (list ${from} before)`, async ({ page }) => {
      const sections = await infoSections(page);
      const section = multi(sections);
      const target = section?.subsections.find((sub) => sub.title.trim());
      test.skip(!section || !target, BLOCKED_MULTI);
      if (!section || !target) return;
      const { desktop, window } = await openInfo(page);
      if (from === "open") await openSections(window);
      // A phone window is full screen and hides the icons: close «Информация» (its list state stays in the page) to reach the search.
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
      // The mark of a hit lives 2400ms (Phase 19, D-14): the count is read first, before any click inside the window.
      const button = sectionsButton(info);
      await expect(button).toHaveAttribute("aria-label", "Разделы, найдено в разделах: 1");
      await expect(button).toHaveText(/^РАЗДЕЛЫ ▾ · 1$/);
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(sectionsList(info)).toBeHidden();
      await expect(info.locator(".info-document h1")).toHaveText(target.title);
      await expect(currentName(info)).toHaveText(target.title);
      // The row of the hit carries the shared search look in the list data, with its section opened (D-32).
      const hit = info.locator("#info-sections-list [data-search-hit='true']");
      await expect(hit).toHaveCount(1);
      await expect(hit).toHaveAttribute("aria-current", "true");
      await expect(hit).toHaveAttribute("data-info-id", target.id);
      await expect(hit).toHaveClass(/\bsearch-hit\b/);
      await expect(toggleOf(info, page, section)).toHaveAttribute("aria-expanded", "true");
    });
  }
});

test("[STAB-A11Y-02] D-28 the PC view keeps the index beside the article without the phone bar", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium-desktop", "the PC check runs on chromium-desktop; phone-only lanes cover the phone screens.");
  const { window } = await openInfo(page);
  await expect(window.locator(".info-library")).not.toHaveAttribute("data-sections-open", /.*/);
  await expect(window.locator(".info-sections-bar")).toHaveCount(0);
  await expect(window.locator(".info-phone-back")).toHaveCount(0);
  await expect(window.locator(".info-next")).toHaveCount(0);
  await expect(sectionsList(window)).toBeVisible();
  await expect(window.locator(".info-document")).toBeVisible();
  const index = await box(sectionsList(window));
  const document = await box(window.locator(".info-document"));
  expect(document.x, "the article is to the right of the index").toBeGreaterThanOrEqual(index.x + index.width - 1);
});
