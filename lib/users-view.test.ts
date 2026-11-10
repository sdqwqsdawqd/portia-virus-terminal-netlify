import assert from "node:assert/strict";
import test from "node:test";

type UsersViewModule = {
  pendingBadgeText?: (count: number | null) => string | null;
  originPlaque?: (origin: "sheet" | "outside") => string;
};

async function usersView(): Promise<UsersViewModule> {
  try {
    return await import("./users-view.ts") as UsersViewModule;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") return {};
    throw error;
  }
}

test("pending badge caps at 99+ and is hidden at 0", async () => {
  const view = await usersView();
  assert.equal(typeof view.pendingBadgeText, "function", "pendingBadgeText must exist");
  assert.equal(view.pendingBadgeText?.(null), null);
  assert.equal(view.pendingBadgeText?.(0), null);
  assert.equal(view.pendingBadgeText?.(-1), null);
  assert.equal(view.pendingBadgeText?.(1.5), null);
  assert.equal(view.pendingBadgeText?.(1), "1");
  assert.equal(view.pendingBadgeText?.(99), "99");
  assert.equal(view.pendingBadgeText?.(100), "99+");
});

test("origin plaque is derived from the shared access label", async () => {
  const view = await usersView();
  assert.equal(view.originPlaque?.("sheet"), "ИЗ ТАБЛИЦЫ");
  assert.equal(view.originPlaque?.("outside"), "НЕ ИЗ ТАБЛИЦЫ");
});
