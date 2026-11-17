import type { Page, Request } from "@playwright/test";
import { portiaContentFixture } from "../../../lib/testing/portia-content-fixture.ts";
import { tabRegistry } from "../../../lib/editor-tabs.ts";
import { parseUsersListReply, type UsersList } from "../../../lib/users-model.ts";
import { EditorPage } from "../pages/editor.page";
import { expect, test } from "../fixtures/test";

const viewportHeight = 800;
const searchNickname = "Pending_User_0000000";

function uuid(serial: number) {
  return `00000000-0000-4000-8000-${String(serial).padStart(12, "0")}`;
}

export function usersListFixture(callerIsOwner = false): UsersList {
  const pending = Array.from({ length: 50 }, (_, index) => ({
    id: uuid(index + 1),
    nickname: `Pending_User_${String(index).padStart(7, "0")}`,
    nicknameKey: `pending_user_${String(index).padStart(7, "0")}`,
    origin: index % 2 === 0 ? "sheet" as const : "outside" as const,
    createdAt: new Date(Date.UTC(2026, 10, 1, 8, index)).toISOString(),
    existingLevel: index === 0 ? 3 as const : null,
    canDecide: true,
    reason: null,
    tableMark: index % 3 === 0 ? "yes" as const : index % 3 === 1 ? "no" as const : "unknown" as const,
  }));
  const people = Array.from({ length: 50 }, (_, index) => ({
    id: uuid(index + 101),
    nickname: `Person_Long_${String(index).padStart(8, "0")}`,
    nicknameKey: `person_long_${String(index).padStart(8, "0")}`,
    origin: index % 2 === 0 ? "sheet" as const : "outside" as const,
    level: (index % 5 + 1) as 1 | 2 | 3 | 4 | 5,
    approvedAt: new Date(Date.UTC(2026, 9, 1, 9, index)).toISOString(),
    canSetLevel: true,
    canRevoke: true,
    reason: null,
    lastEvent: {
      type: "approve" as const,
      at: new Date(Date.UTC(2026, 9, 1, 9, index)).toISOString(),
      actor: `editor.${index}@very-long-subdomain.portia.example.test`,
    },
    tableMark: index % 2 === 0 ? "yes" as const : "unknown" as const,
  }));
  const closed = Array.from({ length: 10 }, (_, index) => ({
    nickname: `Closed_User_${String(index).padStart(8, "0")}`,
    nicknameKey: `closed_user_${String(index).padStart(8, "0")}`,
    status: index % 2 === 0 ? "rejected" as const : "revoked" as const,
    decidedAt: new Date(Date.UTC(2026, 8, 1, 10, index)).toISOString(),
    retryAt: new Date(Date.UTC(2026, 11, 1, 10, index)).toISOString(),
    lastEvent: {
      type: index % 2 === 0 ? "reject" as const : "revoke" as const,
      at: new Date(Date.UTC(2026, 8, 1, 10, index)).toISOString(),
      actor: `moderator.${index}@another-very-long-domain.portia.example.test`,
    },
    tableMark: index % 2 === 0 ? "no" as const : "unknown" as const,
  }));
  const fixture = {
    callerIsOwner,
    pendingTotalAll: 73,
    serverNow: "2026-11-11T12:00:00.000Z",
    pending: { total: 73, rows: pending },
    people: { total: 81, rows: people },
    closed: { total: 14, rows: closed },
    roster: "ok" as const,
  };
  return parseUsersListReply(fixture);
}

function bulkFixture() {
  return {
    roster: "ok",
    eligible: Array.from({ length: 200 }, (_, index) => ({
      id: uuid(index + 301),
      nickname: `BulkEligible_${String(index).padStart(7, "0")}`,
    })),
    excluded: Array.from({ length: 3 }, (_, index) => ({
      id: uuid(index + 601),
      nickname: `BulkExcluded_${String(index).padStart(7, "0")}`,
    })),
  };
}

async function stubUsersEditor(page: Page, options: { canManageEditors: boolean; callerIsOwner: boolean }) {
  const writes: string[] = [];
  const list = usersListFixture(options.callerIsOwner);
  const recordWrite = (request: Request) => writes.push(`${request.method()} ${new URL(request.url()).pathname}`);

  await page.route("**/api/access", async (route) => {
    if (route.request().method() !== "GET") {
      recordWrite(route.request());
      return route.abort();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({
        canEdit: true,
        canManageEditors: options.canManageEditors,
        openTabs: tabRegistry.map((tab) => tab.id),
        tabsEnforced: false,
      }),
    });
  });
  await page.route("**/api/content**", async (route) => {
    if (route.request().method() !== "GET") {
      recordWrite(route.request());
      return route.abort();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({ content: portiaContentFixture, revision: 1, updatedAt: null }),
    });
  });
  await page.route("**/api/users**", async (route) => {
    if (route.request().method() !== "GET") {
      recordWrite(route.request());
      return route.abort();
    }
    const view = new URL(route.request().url()).searchParams.get("view");
    const body = view === "count"
      ? { pending: list.pendingTotalAll }
      : view === "history"
        ? { entries: [] }
        : view === "bulk"
          ? bulkFixture()
          : { list };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(body),
    });
  });
  return writes;
}

async function openUsersTab(page: Page, options: { width: number; canManageEditors?: boolean; callerIsOwner?: boolean }) {
  await page.setViewportSize({ width: options.width, height: viewportHeight });
  const writes = await stubUsersEditor(page, {
    canManageEditors: options.canManageEditors ?? false,
    callerIsOwner: options.callerIsOwner ?? false,
  });
  const editor = new EditorPage(page);
  await editor.desktop.goto();
  await editor.openSettings();
  await expect(editor.openEditor).toBeEnabled();
  await editor.openEditor.click();
  await expect(editor.editorNavigation()).toBeVisible();
  await editor.editorNavigation().getByRole("button", { name: /^Пользователи/ }).click();
  await expect(page.getByLabel("ПОИСК ПО НИКУ")).toBeVisible();
  return writes;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth, `${label}: scrollWidth ${dimensions.scrollWidth} <= clientWidth ${dimensions.clientWidth}`).toBeLessThanOrEqual(dimensions.clientWidth);
}

test.describe("[PORTIA-22] Users tab mocked responsive backstop", () => {
  for (const width of [320, 390, 900]) {
    test(`${width}px keeps pending, people and the opened closed block inside the page`, async ({ page }) => {
      const writes = await openUsersTab(page, { width });
      const closed = page.locator("details.users-closed");
      await closed.locator("summary").click();
      await expect(closed).toHaveAttribute("open", "");
      await expectNoHorizontalOverflow(page, `${width}px open users list`);

      if (width === 320 || width === 390) {
        await page.locator('[data-users-section="pending"] .users-phone-row').first().click();
        const actionDialog = page.getByRole("dialog", { name: searchNickname });
        await expect(actionDialog).toBeVisible();
        await expectNoHorizontalOverflow(page, `${width}px phone action window`);
        await actionDialog.getByRole("button", { name: "ЗАКРЫТЬ ОКНО" }).click();
        await expect(actionDialog).toBeHidden();
      }

      if (width === 320) {
        const response = page.waitForResponse((candidate) => {
          const url = new URL(candidate.url());
          return url.pathname === "/api/users" && url.searchParams.get("view") === "list" && url.searchParams.get("q") === searchNickname;
        });
        await page.getByLabel("ПОИСК ПО НИКУ").fill(searchNickname);
        await response;
        await expectNoHorizontalOverflow(page, "320px 20-character nickname search");
      }

      expect(writes, "the mocked responsive lane never sends a write").toEqual([]);
    });
  }

  test("390px owner bulk dialog bounds both lists and keeps the safe action visible", async ({ page }) => {
    const writes = await openUsersTab(page, { width: 390, canManageEditors: true, callerIsOwner: true });
    await page.getByRole("button", { name: "ОДОБРИТЬ ИЗ ТАБЛИЦЫ" }).click();
    const dialog = page.getByRole("alertdialog", { name: /Одобрить 200 заявок/ });
    await expect(dialog).toBeVisible();
    const lists = dialog.locator(".users-bulk-list");
    await expect(lists).toHaveCount(2);
    const maxHeights = await lists.evaluateAll((elements) => elements.map((element) => Number.parseFloat(getComputedStyle(element).maxHeight)));
    expect(maxHeights.every((height) => Number.isFinite(height) && height <= 320), `computed max-heights: ${maxHeights.join(", ")}`).toBe(true);

    const approve = dialog.getByRole("button", { name: "ОДОБРИТЬ", exact: true });
    await expect(approve).toBeInViewport();
    await dialog.getByRole("button", { name: "НЕ ОДОБРЯТЬ", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(writes, "cancelling bulk approval never sends a POST").toEqual([]);
  });
});

// Phase 26 (UI-04, D-12): on a PC the sections sit in the sticky bar, the rows of the active section on the left and the picked row
// in the detail pane (.etab-detail) with the actions and the history; the rows carry no actions. The phone steps above are unchanged.
test.describe("[PORTIA-26] Users tab on a PC: sections in the bar, rows on the left, the detail on the right", () => {
  test("1280px picking a row opens it in the detail pane; the actions live there, not in the row", async ({ page }) => {
    const writes = await openUsersTab(page, { width: 1280 });
    const bar = page.locator(".users-tab > .etab-bar");
    const detail = page.locator(".users-tab .etab-body > .etab-detail");
    await expect(bar.getByRole("button", { name: "Заявки · 73" })).toHaveAttribute("aria-current", "true");
    await expect(bar.getByRole("status")).toHaveText("Ожидают: 73");
    await expect(detail).toContainText("Выберите заявку или человека");
    await expect(detail).toContainText("Действия появятся справа.");

    const firstPending = page.locator(".etab-list .users-pick-row").first();
    await firstPending.click();
    await expect(firstPending).toHaveAttribute("aria-current", "true");
    await expect(detail.getByRole("heading", { name: searchNickname })).toBeVisible();
    await expect(detail.getByRole("button", { name: `Одобрить заявку: ${searchNickname}` })).toBeVisible();
    await expect(detail.getByRole("button", { name: "ОТКЛОНИТЬ", exact: true })).toBeVisible();
    await expect(page.locator(".etab-list .users-row-actions")).toHaveCount(0);

    await bar.getByRole("button", { name: "Люди · 81" }).click();
    await expect(bar.getByRole("button", { name: "Люди · 81" })).toHaveAttribute("aria-current", "true");
    await expect(detail).toContainText("Выберите заявку или человека");
    await page.locator(".etab-list .users-pick-row").first().click();
    await expect(detail.locator(".users-history")).toBeVisible();
    await expect(detail.getByRole("button", { name: "СМЕНИТЬ УРОВЕНЬ" })).toBeVisible();
    await expectNoHorizontalOverflow(page, "1280px users detail");
    expect(writes, "picking rows never sends a write").toEqual([]);
  });

  test("1280px owner bulk approval is the primary action of the bar", async ({ page }) => {
    const writes = await openUsersTab(page, { width: 1280, canManageEditors: true, callerIsOwner: true });
    const bulk = page.locator(".users-tab > .etab-bar .etab-actions").getByRole("button", { name: "ОДОБРИТЬ ИЗ ТАБЛИЦЫ" });
    await expect(bulk).toHaveClass(/primary-control/);
    await bulk.click();
    const dialog = page.getByRole("alertdialog", { name: /Одобрить 200 заявок/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "НЕ ОДОБРЯТЬ", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(writes, "cancelling bulk approval never sends a POST").toEqual([]);
  });
});
