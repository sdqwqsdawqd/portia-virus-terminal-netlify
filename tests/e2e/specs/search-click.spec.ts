import type { Locator, Page } from "@playwright/test";
import { DesktopPage } from "../pages/desktop.page";
import { expect, test } from "../fixtures/test";

// Click-through of every kind of global search result (STAB-SEARCH-02, D-14): the click opens the owner app (one window), marks exactly the
// chosen record with data-search-hit and leaves the search window open. The records come from the target's own /api answers (read, never
// replaced); a kind the target holds no record of is skipped as «BLOCKED (DATA)», never counted as a pass. It runs in 19-14.

type Kind = {
  type: string;
  mark: string;
  owner: string;
  ownerId: string;
  /** The records of this kind served by the target, as search titles. */
  title: (data: Served) => string;
  /** The element inside the owner window that must carry the mark. */
  hit: (window: Locator, title: string) => Locator;
};

type Served = {
  content: {
    viruses?: { name: string }[];
    infoSections?: { title: string }[];
    guideSections?: { cards?: { title: string }[] }[];
    broadcasts?: { title: string; published?: boolean }[];
    recycleFiles?: { name: string }[];
    recycledViruses?: { name: string }[];
  };
  employees: { nickname: string }[];
};

const isPhone = () => test.info().project.name.includes("phone");

const kinds: Kind[] = [
  { type: "app", mark: "APP", owner: "Справочник", ownerId: "guide", title: () => "Справочник", hit: (w) => w },
  { type: "virus", mark: "VIS", owner: "База вирусов", ownerId: "archive", title: (d) => d.content.viruses?.[0]?.name ?? "", hit: (w, t) => w.locator(".virus-row[data-search-hit='true']").filter({ hasText: t }) },
  { type: "employee", mark: "EMP", owner: "Сотрудники", ownerId: "employees", title: (d) => d.employees[0]?.nickname ?? "", hit: (w, t) => w.locator(".personnel-list > button[data-search-hit='true']").filter({ hasText: t }) },
  { type: "info", mark: "INF", owner: "Информация", ownerId: "info", title: (d) => d.content.infoSections?.[0]?.title ?? "", hit: (w, t) => w.locator(".info-index [data-search-hit='true']").filter({ hasText: t }) },
  { type: "guide", mark: "REF", owner: "Справочник", ownerId: "guide", title: (d) => d.content.guideSections?.flatMap((section) => section.cards ?? [])[0]?.title ?? "", hit: (w, t) => w.locator("[data-search-hit='true']").filter({ hasText: t }) },
  { type: "broadcast", mark: "MSG", owner: "Сводка", ownerId: "broadcasts", title: (d) => d.content.broadcasts?.find((item) => item.published)?.title ?? "", hit: (w, t) => w.locator(".broadcast-card[data-search-hit='true']").filter({ hasText: t }) },
  { type: "file", mark: "FILE", owner: "Корзина", ownerId: "trash", title: (d) => d.content.recycleFiles?.[0]?.name ?? d.content.recycledViruses?.[0]?.name ?? "", hit: (w, t) => w.locator(".trash-file-row[data-search-hit='true']").filter({ hasText: t }) },
];

async function served(page: Page): Promise<Served> {
  const content = await page.request.get("/api/content");
  const roster = await page.request.get("/api/employees");
  const contentJson = content.ok() ? (await content.json()) as { content?: Served["content"] } : {};
  const rosterJson = roster.ok() ? (await roster.json()) as { employees?: Served["employees"] } : {};
  return { content: contentJson.content ?? {}, employees: rosterJson.employees ?? [] };
}

for (const kind of kinds) {
  test(`[STAB-SEARCH-02] a ${kind.type} result opens «${kind.owner}», marks that record and keeps the search window`, async ({ page }) => {
    const data = await served(page);
    const title = kind.title(data).trim();
    test.skip(!title, `BLOCKED (DATA): this target serves no ${kind.type} record to search for.`);

    const desktop = new DesktopPage(page);
    await desktop.goto();
    await desktop.openApp("Глобальный поиск");
    const search = desktop.window("Глобальный поиск");
    await search.getByRole("searchbox").fill(title);
    const row = search.locator(".global-result")
      .filter({ has: page.locator(".global-result-mark", { hasText: new RegExp(`^${kind.mark}$`) }) })
      .filter({ hasText: title })
      .first();
    await expect(row).toBeVisible();
    await row.click();

    const owner = desktop.window(kind.owner);
    await expect(page.locator(`.app-window[data-window-app="${kind.ownerId}"]`)).toHaveCount(1);
    await expect(owner).toBeVisible();
    if (kind.type === "app") {
      await expect(page.locator(`.app-window[data-window-app="${kind.ownerId}"][data-search-hit="true"]`)).toHaveCount(1);
    } else {
      const hit = kind.hit(owner, title);
      await expect(hit).toHaveCount(1);
      await expect(hit).toHaveAttribute("aria-current", "true");
      await expect(hit).toBeInViewport();
    }

    // Not closed, not minimised, not modal. On a phone the opened app is full screen over the search; the taskbar brings it back with its query.
    await expect(page.locator('.app-window[data-window-app="search"]')).toHaveCount(1);
    if (isPhone()) await page.locator('[data-taskbar-app="search"]').click();
    await expect(search).toBeVisible();
    await expect(search.getByRole("searchbox")).toHaveValue(title);
  });
}
