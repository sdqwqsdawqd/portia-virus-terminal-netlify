import assert from "node:assert/strict";
import test from "node:test";
import type { UsersList } from "./users-model.ts";

type UsersViewModule = {
  pendingBadgeText?: (count: number | null) => string | null;
  originPlaque?: (origin: "sheet" | "outside") => string;
  eventVerb?: (type: "approve" | "reject" | "level-change" | "revoke" | "cooldown-clear") => string;
  rowCaption?: (event: { type: "approve"; at: string; actor: string | null } | null, now: Date) => string | null;
  levelPlaque?: (level: 1 | 2 | 3 | 4 | 5) => string;
  statusPlaque?: (status: "pending" | "rejected" | "revoked") => string;
  pauseCaption?: (retryAt: string | null, now: Date) => string | null;
  robloxProfileUrl?: (nickname: string) => string;
  buildUsersView?: (list: UsersList, query: string, now: Date) => {
    pending: { title: string; truncated: boolean };
    people: { title: string; truncated: boolean };
    closed: { title: string; truncated: boolean };
    emptyKind: string | null;
  };
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

test("users copy keeps the pending empty-state contract outside the component", async () => {
  const { usersCopy } = await import("./users-copy.ts");
  assert.equal(usersCopy.tabPendingSuffix(3), ", ожидают: 3");
  assert.equal(usersCopy.pendingEmpty.heading, "Новых заявок нет");
  assert.equal(usersCopy.pendingEmpty.body, "Когда посетитель подаст заявку по нику, она появится здесь.");
});

test("Europe/Moscow formatter is device-independent and adds a different year", async () => {
  const time = await import("./users-time.ts").catch(() => ({}));
  assert.equal(typeof time.formatMoscow, "function", "formatMoscow must exist");
  assert.equal(time.formatMoscow?.("2026-11-09T11:32:00Z", new Date("2026-11-09T12:00:00Z")), "9 РЅРѕСЏР±., 14:32");
  assert.equal(time.formatMoscow?.("2025-12-31T21:05:00Z", new Date("2026-01-05T09:00:00Z")), "1 СЏРЅРІ., 00:05");
  assert.equal(time.formatMoscow?.("2025-12-31T21:05:00Z", new Date("2027-03-01T09:00:00Z")), "1 СЏРЅРІ. 2026 Рі., 00:05");
  assert.equal(time.formatMoscow?.("invalid", new Date()), null);
});

test("pluralZayavka follows Russian one-few-many endings", async () => {
  const time = await import("./users-time.ts").catch(() => ({}));
  assert.equal(typeof time.pluralZayavka, "function", "pluralZayavka must exist");
  const expected = new Map([[1, "Р·Р°СЏРІРєСѓ"], [2, "Р·Р°СЏРІРєРё"], [5, "Р·Р°СЏРІРѕРє"], [11, "Р·Р°СЏРІРѕРє"], [12, "Р·Р°СЏРІРѕРє"], [14, "Р·Р°СЏРІРѕРє"], [21, "Р·Р°СЏРІРєСѓ"], [22, "Р·Р°СЏРІРєРё"], [101, "Р·Р°СЏРІРєСѓ"], [111, "Р·Р°СЏРІРѕРє"]]);
  for (const [value, word] of expected) assert.equal(time.pluralZayavka?.(value), word);
});

test("full users view builds captions, plaques, section totals and truncation", async () => {
  const view = await usersView();
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(view.eventVerb?.("approve"), "РѕРґРѕР±СЂРёР»");
  assert.equal(view.rowCaption?.({ type: "approve", at: "2026-11-09T11:32:00Z", actor: "q•••z@gmail.com" }, now), "РѕРґРѕР±СЂРёР» q•••z@gmail.com В· 9 РЅРѕСЏР±., 14:32");
  assert.equal(view.rowCaption?.({ type: "approve", at: "2026-11-09T11:32:00Z", actor: null }, now), "РѕРґРѕР±СЂРёР» РЅРµРёР·РІРµСЃС‚РЅРѕ В· 9 РЅРѕСЏР±., 14:32");
  assert.equal(view.levelPlaque?.(3), "РЈР РћР’Р•РќР¬ 3");
  assert.equal(view.statusPlaque?.("rejected"), "РћРўРљР›РћРќР•РќРђ");
  assert.equal(view.statusPlaque?.("revoked"), "Р”РћРЎРўРЈРџ РћРўРћР—Р’РђРќ");
  assert.equal(view.pauseCaption?.("2026-11-09T12:32:00Z", now), "РїР°СѓР·Р° РґРѕ 15:32");
  assert.equal(view.robloxProfileUrl?.("Qloxz_1"), "https://www.roblox.com/users/profile?username=Qloxz_1");
  const empty = { total: 0, rows: [] };
  const list = { callerIsOwner: false, pendingTotalAll: 0, serverNow: now.toISOString(), pending: empty, people: empty, closed: empty } as UsersList;
  assert.equal(view.buildUsersView?.(list, "qloxz", now).emptyKind, "search");
  const populated = { ...list, pending: { total: 2, rows: [] }, people: { total: 3, rows: [] }, closed: { total: 4, rows: [] } } as UsersList;
  const built = view.buildUsersView?.(populated, "", now);
  assert.equal(built?.pending.title, "Р—РђРЇР’РљР В· 2");
  assert.equal(built?.people.title, "Р›Р®Р”Р В· 3");
  assert.equal(built?.closed.title, "РћС‚РєР»РѕРЅС‘РЅРЅС‹Рµ Рё РѕС‚РѕР·РІР°РЅРЅС‹Рµ В· 4");
  assert.equal(built?.people.truncated, true);
});
