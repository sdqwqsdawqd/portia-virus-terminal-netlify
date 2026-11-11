import assert from "node:assert/strict";
import test from "node:test";
import type { TableMark, UsersBulk, UsersClosedRow, UsersList, UsersPendingRow, UsersPersonRow } from "./users-model.ts";

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
  visibleControls?: (row: UsersPendingRow | UsersPersonRow | UsersClosedRow, callerIsOwner: boolean) => {
    controls: string[];
    caption: string | null;
    levelDefault: number | null;
    fixedLevelText: string | null;
  };
  resultNote?: (code: string) => string;
  successAnnouncement?: (kind: string, nickname: string, level?: 1 | 2 | 3 | 4 | 5) => string;
  historyLine?: (
    entry: { type: "approve" | "reject" | "level-change" | "revoke" | "cooldown-clear"; at: string; actor: string | null; details: Record<string, unknown> },
    now: Date,
  ) => string | null;
  markPlaque?: (mark: TableMark) => { text: string; tone: "accent" | "warning" | "neutral" };
  bulkTitle?: (count: number) => string;
  bulkProgress?: (completed: number, total: number) => string;
  bulkSummary?: (result: { approved: number; already: number; failed: number }) => string;
  bulkButtonState?: (list: UsersList, bulk: UsersBulk | null) => { visible: boolean; disabled: boolean; caption: string | null };
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
  const time = await import("./users-time.ts");
  assert.equal(typeof time.formatMoscow, "function", "formatMoscow must exist");
  assert.equal(time.formatMoscow?.("2026-11-09T11:32:00Z", new Date("2026-11-09T12:00:00Z")), "9 нояб., 14:32");
  assert.equal(time.formatMoscow?.("2025-12-31T21:05:00Z", new Date("2026-01-05T09:00:00Z")), "1 янв., 00:05");
  assert.equal(time.formatMoscow?.("2025-12-31T21:05:00Z", new Date("2027-03-01T09:00:00Z")), "1 янв. 2026 г., 00:05");
  assert.equal(time.formatMoscow?.("invalid", new Date()), null);
});

test("history lines carry the event verb, safe details, actor and Moscow time", async () => {
  const view = await usersView();
  const { usersCopy } = await import("./users-copy.ts");
  assert.equal(usersCopy.history, "ИСТОРИЯ");
  assert.equal(usersCopy.hideHistory, "СКРЫТЬ ИСТОРИЮ");
  assert.equal(usersCopy.historyHeading, "Последние 5 записей");
  assert.equal(usersCopy.historyEmpty, "Записей пока нет.");
  assert.equal(typeof view.historyLine, "function", "historyLine must exist");
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(
    view.historyLine?.({ type: "approve", at: "2026-11-09T11:32:00Z", actor: "q•••z@gmail.com", details: { level: 2, origin: "sheet", deviceAdded: true } }, now),
    "одобрил · q•••z@gmail.com · 9 нояб., 14:32 МСК",
  );
  assert.equal(
    view.historyLine?.({ type: "level-change", at: "2026-11-09T11:32:00Z", actor: "q•••z@gmail.com", details: { from: 2, to: 3 } }, now),
    "изменил уровень 2 → 3 · q•••z@gmail.com · 9 нояб., 14:32 МСК",
  );
  assert.equal(
    view.historyLine?.({ type: "reject", at: "2026-11-09T11:32:00Z", actor: null, details: { origin: "outside" } }, now),
    "отклонил · неизвестно · 9 нояб., 14:32 МСК",
  );
  assert.equal(view.historyLine?.({ type: "revoke", at: "invalid", actor: null, details: { level: 2 } }, now), null);
});

test("pluralZayavka follows Russian one-few-many endings", async () => {
  const time = await import("./users-time.ts");
  assert.equal(typeof time.pluralZayavka, "function", "pluralZayavka must exist");
  const expected = new Map([[1, "заявку"], [2, "заявки"], [5, "заявок"], [11, "заявок"], [12, "заявок"], [14, "заявок"], [21, "заявку"], [22, "заявки"], [101, "заявку"], [111, "заявок"]]);
  for (const [value, word] of expected) assert.equal(time.pluralZayavka?.(value), word);
});

test("full users view builds captions, plaques, section totals and truncation", async () => {
  const view = await usersView();
  const now = new Date("2026-11-09T12:00:00Z");
  assert.equal(view.eventVerb?.("approve"), "одобрил");
  assert.equal(view.rowCaption?.({ type: "approve", at: "2026-11-09T11:32:00Z", actor: "q•••z@gmail.com" }, now), "одобрил q•••z@gmail.com · 9 нояб., 14:32");
  assert.equal(view.rowCaption?.({ type: "approve", at: "2026-11-09T11:32:00Z", actor: null }, now), "одобрил неизвестно · 9 нояб., 14:32");
  assert.equal(view.levelPlaque?.(3), "УРОВЕНЬ 3");
  assert.equal(view.statusPlaque?.("rejected"), "ОТКЛОНЕНА");
  assert.equal(view.statusPlaque?.("revoked"), "ДОСТУП ОТОЗВАН");
  assert.equal(view.pauseCaption?.("2026-11-09T12:32:00Z", now), "пауза до 15:32");
  assert.equal(view.robloxProfileUrl?.("Qloxz_1"), "https://www.roblox.com/users/profile?username=Qloxz_1");
  assert.equal(view.robloxProfileUrl?.("A B"), "https://www.roblox.com/users/profile?username=A%20B");
  const empty = { total: 0, rows: [] };
  const list = { callerIsOwner: false, pendingTotalAll: 0, serverNow: now.toISOString(), pending: empty, people: empty, closed: empty } as UsersList;
  assert.equal(view.buildUsersView?.(list, "qloxz", now).emptyKind, "search");
  const populated = { ...list, pending: { total: 2, rows: [] }, people: { total: 3, rows: [] }, closed: { total: 4, rows: [] } } as UsersList;
  const built = view.buildUsersView?.(populated, "", now);
  assert.equal(built?.pending.title, "ЗАЯВКИ · 2");
  assert.equal(built?.people.title, "ЛЮДИ · 3");
  assert.equal(built?.closed.title, "Отклонённые и отозванные · 4");
  assert.equal(built?.people.truncated, true);
});

test("pending decision controls follow server flags and approval defaults", async () => {
  const view = await usersView();
  assert.equal(typeof view.visibleControls, "function", "visibleControls must exist");
  const base = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    nickname: "Qloxz",
    nicknameKey: "qloxz",
    origin: "sheet" as const,
    createdAt: "2026-11-10T00:00:00.000Z",
    existingLevel: null,
    canDecide: true,
    reason: null,
  };
  assert.deepEqual(view.visibleControls?.(base, false), {
    controls: ["level", "approve", "reject"],
    caption: null,
    levelDefault: 2,
    fixedLevelText: null,
  });
  assert.deepEqual(view.visibleControls?.({ ...base, origin: "outside" }, false)?.levelDefault, 1);
  assert.deepEqual(view.visibleControls?.({ ...base, existingLevel: 4 }, false), {
    controls: ["approve", "reject"],
    caption: null,
    levelDefault: null,
    fixedLevelText: "Уровень 4 уже выдан",
  });
  assert.deepEqual(view.visibleControls?.({ ...base, canDecide: false, reason: "self" }, false)?.controls, []);
  assert.equal(view.visibleControls?.({ ...base, canDecide: false, reason: "self" }, false)?.caption, "Свою заявку решить нельзя.");
  assert.equal(view.visibleControls?.({ ...base, canDecide: false, reason: "owner" }, false)?.caption, "Владельца изменить нельзя.");
});

test("decision notes and announcements use the frozen Russian copy", async () => {
  const view = await usersView();
  assert.equal(typeof view.resultNote, "function", "resultNote must exist");
  assert.equal(view.resultNote?.("already-decided"), "Уже решено. Строка обновлена.");
  assert.equal(view.resultNote?.("not-found"), "Заявка не найдена. Список обновлён.");
  assert.equal(view.resultNote?.("self"), "Свою заявку решить нельзя.");
  assert.equal(view.resultNote?.("owner"), "Владельца изменить нельзя.");
  assert.equal(view.resultNote?.("unexpected"), "Не удалось выполнить. Проверьте связь и повторите.");
  assert.equal(view.successAnnouncement?.("approved", "Qloxz", 2), "Заявка «Qloxz» одобрена, Уровень 2.");
  assert.equal(view.successAnnouncement?.("rejected", "Qloxz"), "Заявка «Qloxz» отклонена.");
});

test("clear cooldown is owner only and editors never receive the control", async () => {
  const view = await usersView();
  assert.equal(typeof view.visibleControls, "function");
  const closed: UsersClosedRow = {
    nickname: "Bob_2",
    nicknameKey: "bob_2",
    status: "rejected",
    decidedAt: "2026-11-10T00:02:00.000Z",
    retryAt: "2026-11-10T01:02:00.000Z",
    lastEvent: null,
  };
  assert.deepEqual(view.visibleControls?.(closed, false)?.controls, []);
  assert.deepEqual(view.visibleControls?.(closed, true)?.controls, ["clearCooldown"]);
  assert.deepEqual(view.visibleControls?.({ ...closed, retryAt: null }, true)?.controls, []);
});

test("person controls and change/revoke result copy stay server driven", async () => {
  const view = await usersView();
  const person: UsersPersonRow = {
    id: "223e4567-e89b-42d3-a456-426614174000",
    nickname: "Ada_1",
    nicknameKey: "ada_1",
    origin: "outside",
    level: 3,
    approvedAt: "2026-11-10T00:01:00.000Z",
    canSetLevel: true,
    canRevoke: true,
    reason: null,
    lastEvent: null,
  };
  assert.deepEqual(view.visibleControls?.(person, false)?.controls, ["level", "setLevel", "revoke"]);
  assert.deepEqual(view.visibleControls?.({ ...person, canSetLevel: false, canRevoke: false, reason: "owner" }, false), {
    controls: [],
    caption: "Владельца изменить нельзя.",
    levelDefault: null,
    fixedLevelText: null,
  });
  assert.equal(view.resultNote?.("stale"), "Уровень уже изменили. Показан актуальный.");
  assert.equal(view.resultNote?.("not-active"), "Человек уже не активен. Список обновлён.");
  assert.equal(view.resultNote?.("already-revoked"), "Уже решено. Строка обновлена.");
  assert.equal(view.resultNote?.("no-cooldown"), "Пауза уже снята. Список обновлён.");
  assert.equal(view.resultNote?.("level-change-separate"), "Уровень меняется отдельно. Список обновлён.");
  assert.equal(view.resultNote?.("level-above-own"), "Нельзя выдать уровень выше своего.");
  assert.equal(view.successAnnouncement?.("level", "Qloxz", 3), "Уровень «Qloxz»: Уровень 3.");
  assert.equal(view.successAnnouncement?.("revoked", "Qloxz"), "Доступ «Qloxz» отозван.");
  assert.equal(view.successAnnouncement?.("cleared", "Qloxz"), "Пауза снята.");
});

test("roster marks and owner bulk copy stay explicit, counted and failure honest", async () => {
  const view = await usersView();
  assert.deepEqual(view.markPlaque?.("yes"), { text: "НИК В ТАБЛИЦЕ", tone: "accent" });
  assert.deepEqual(view.markPlaque?.("no"), { text: "НИКА НЕТ В ТАБЛИЦЕ", tone: "warning" });
  assert.deepEqual(view.markPlaque?.("unknown"), { text: "НЕ ПРОВЕРЕНО", tone: "neutral" });
  assert.equal(view.bulkTitle?.(1), "Одобрить 1 заявку с уровнем 2?");
  assert.equal(view.bulkTitle?.(2), "Одобрить 2 заявки с уровнем 2?");
  assert.equal(view.bulkTitle?.(5), "Одобрить 5 заявок с уровнем 2?");
  assert.equal(view.bulkProgress?.(3, 7), "Одобрено 3 из 7");
  assert.equal(view.bulkSummary?.({ approved: 4, already: 2, failed: 1 }), "Одобрено: 4 · Уже решено другим: 2 · Ошибка: 1");

  const empty = { total: 0, rows: [] };
  const editor = { callerIsOwner: false, pendingTotalAll: 1, serverNow: new Date().toISOString(), pending: empty, people: empty, closed: empty, roster: "ok" } as UsersList;
  const owner = { ...editor, callerIsOwner: true } as UsersList;
  assert.deepEqual(view.bulkButtonState?.(editor, null), { visible: false, disabled: true, caption: null });
  assert.deepEqual(view.bulkButtonState?.({ ...owner, roster: "degraded" }, null), {
    visible: true,
    disabled: true,
    caption: "Таблица сотрудников недоступна, попробуйте позже",
  });
  assert.deepEqual(view.bulkButtonState?.(owner, { roster: "ok", eligible: [], excluded: [] }), {
    visible: true,
    disabled: true,
    caption: "Нет заявок «из таблицы» с ником из таблицы.",
  });
  assert.deepEqual(view.bulkButtonState?.(owner, null), { visible: true, disabled: false, caption: null });
});
