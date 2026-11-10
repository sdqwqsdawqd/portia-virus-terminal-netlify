import { ACCESS_LEVELS, accessLevelLabel, accessOriginLabel, defaultApprovalLevel, type AccessLevel, type AccessOrigin } from "./access-levels.ts";
import { usersCopy } from "./users-copy.ts";
import { formatMoscow } from "./users-time.ts";
import type { AccessEventType, UsersClosedRow, UsersEvent, UsersList, UsersPendingRow, UsersPersonRow } from "./users-model.ts";

export function pendingBadgeText(count: number | null): string | null {
  if (count === null || !Number.isInteger(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export function originPlaque(origin: AccessOrigin): string {
  return accessOriginLabel(origin).toUpperCase();
}

export function eventVerb(type: AccessEventType): string {
  const verbs: Record<AccessEventType, string> = {
    approve: "одобрил",
    reject: "отклонил",
    revoke: "отозвал",
    "level-change": "изменил уровень",
    "cooldown-clear": "снял паузу",
  };
  return verbs[type];
}

export function rowCaption(event: UsersEvent | null, now: Date): string | null {
  if (!event) return null;
  const time = formatMoscow(event.at, now);
  if (!time) return null;
  return `${eventVerb(event.type)} ${event.actor ?? usersCopy.unknownActor} · ${time}`;
}

export function levelPlaque(level: AccessLevel): string {
  return accessLevelLabel(level).toUpperCase();
}

export function statusPlaque(status: "pending" | "rejected" | "revoked"): string {
  if (status === "pending") return usersCopy.pendingPlaque;
  return status === "rejected" ? "ОТКЛОНЕНА" : "ДОСТУП ОТОЗВАН";
}

export function pauseCaption(retryAt: string | null, now: Date): string | null {
  if (!retryAt) return null;
  const formatted = formatMoscow(retryAt, now);
  if (!formatted) return null;
  const time = formatted.match(/(\d{2}:\d{2})$/u)?.[1];
  return time ? `пауза до ${time}` : null;
}

export function robloxProfileUrl(nickname: string): string {
  return `https://www.roblox.com/users/profile?username=${encodeURIComponent(nickname)}`;
}

type ViewRow = {
  key: string;
  nickname: string;
  typePlaque: string;
  statusPlaque: string;
  profileUrl: string;
  caption: string | null;
  captionAt: string | null;
  pause: string | null;
  source: UsersPendingRow | UsersPersonRow | UsersClosedRow;
};

type ViewSection = {
  title: string;
  rows: ViewRow[];
  truncated: boolean;
  emptyKind: "pending" | "people" | "closed" | null;
};

export type UsersView = {
  pending: ViewSection;
  people: ViewSection;
  closed: ViewSection;
  emptyKind: "search" | null;
};

export type UsersControl = "level" | "approve" | "reject" | "setLevel" | "revoke" | "clearCooldown";
export type UsersVisibleControls = {
  controls: UsersControl[];
  caption: string | null;
  levelDefault: AccessLevel | null;
  fixedLevelText: string | null;
};

export function decisionLevelOptions(maximum: AccessLevel = 5): { value: AccessLevel; label: string }[] {
  return ACCESS_LEVELS.filter((level) => level <= maximum).map((level) => ({ value: level, label: accessLevelLabel(level) }));
}

export function visibleControls(row: UsersPendingRow | UsersPersonRow | UsersClosedRow, callerIsOwner: boolean): UsersVisibleControls {
  void callerIsOwner;
  if ("canDecide" in row) {
    if (!row.canDecide) {
      return {
        controls: [],
        caption: row.reason === "owner" ? usersCopy.ownerCaption : usersCopy.selfCaption,
        levelDefault: null,
        fixedLevelText: null,
      };
    }
    return {
      controls: row.existingLevel === null ? ["level", "approve", "reject"] : ["approve", "reject"],
      caption: null,
      levelDefault: row.existingLevel === null ? defaultApprovalLevel(row.origin) : null,
      fixedLevelText: row.existingLevel === null ? null : usersCopy.fixedLevel(row.existingLevel),
    };
  }
  return { controls: [], caption: null, levelDefault: null, fixedLevelText: null };
}

export function resultNote(code: string): string {
  if (code === "already-decided") return usersCopy.alreadyDecided;
  if (code === "not-found") return usersCopy.requestNotFound;
  if (code === "self") return usersCopy.selfCaption;
  if (code === "owner") return usersCopy.ownerCaption;
  return usersCopy.actionFailed;
}

export function successAnnouncement(kind: string, nickname: string, level?: AccessLevel): string {
  if (kind === "approved" && level !== undefined) return usersCopy.approved(nickname, level);
  if (kind === "rejected") return usersCopy.rejected(nickname);
  return usersCopy.actionFailed;
}

export function buildUsersView(list: UsersList, query: string, now: Date): UsersView {
  const pendingRows: ViewRow[] = list.pending.rows.map((row) => ({
    key: row.id,
    nickname: row.nickname,
    typePlaque: originPlaque(row.origin),
    statusPlaque: statusPlaque("pending"),
    profileUrl: robloxProfileUrl(row.nickname),
    caption: formatMoscow(row.createdAt, now) ? `заявка от ${formatMoscow(row.createdAt, now)}` : null,
    captionAt: row.createdAt,
    pause: null,
    source: row,
  }));
  const peopleRows: ViewRow[] = list.people.rows.map((row) => ({
    key: row.id,
    nickname: row.nickname,
    typePlaque: originPlaque(row.origin),
    statusPlaque: levelPlaque(row.level),
    profileUrl: robloxProfileUrl(row.nickname),
    caption: rowCaption(row.lastEvent, now),
    captionAt: row.lastEvent?.at ?? null,
    pause: null,
    source: row,
  }));
  const closedRows: ViewRow[] = list.closed.rows.map((row) => ({
    key: row.nicknameKey,
    nickname: row.nickname,
    typePlaque: statusPlaque(row.status),
    statusPlaque: statusPlaque(row.status),
    profileUrl: robloxProfileUrl(row.nickname),
    caption: rowCaption(row.lastEvent, now),
    captionAt: row.lastEvent?.at ?? row.decidedAt,
    pause: pauseCaption(row.retryAt, now),
    source: row,
  }));
  const searchEmpty = query.trim() !== "" && list.pending.total === 0 && list.people.total === 0 && list.closed.total === 0;
  return {
    pending: {
      title: `${usersCopy.pendingTitle} · ${list.pending.total}`,
      rows: pendingRows,
      truncated: pendingRows.length < list.pending.total,
      emptyKind: list.pending.total === 0 && !searchEmpty ? "pending" : null,
    },
    people: {
      title: `${usersCopy.peopleTitle} · ${list.people.total}`,
      rows: peopleRows,
      truncated: peopleRows.length < list.people.total,
      emptyKind: list.people.total === 0 && !searchEmpty ? "people" : null,
    },
    closed: {
      title: `${usersCopy.closedTitle} · ${list.closed.total}`,
      rows: closedRows,
      truncated: closedRows.length < list.closed.total,
      emptyKind: list.closed.total === 0 && !searchEmpty ? "closed" : null,
    },
    emptyKind: searchEmpty ? "search" : null,
  };
}
