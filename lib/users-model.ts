import { ACCESS_ORIGINS, type AccessLevel, type AccessOrigin } from "./access-levels.ts";
import { isValidNickname, nicknameKey } from "./nickname.ts";

export class UsersReplyError extends Error {
  constructor() {
    super("unexpected-reply");
    this.name = "UsersReplyError";
  }
}

export type TableMark = "yes" | "no" | "unknown";
export type UsersRosterStatus = "ok" | "degraded";

export type UsersPendingRow = {
  id: string;
  nickname: string;
  nicknameKey: string;
  origin: AccessOrigin;
  createdAt: string;
  existingLevel: AccessLevel | null;
  canDecide: boolean;
  reason: UsersGuardReason;
  tableMark?: TableMark;
};

export type AccessEventType = "approve" | "reject" | "level-change" | "revoke" | "cooldown-clear";
export type UsersGuardReason = "self" | "owner" | null;
export type UsersEvent = { type: AccessEventType; at: string; actor: string | null };
export type UsersHistoryDetails = {
  level?: AccessLevel;
  from?: AccessLevel;
  to?: AccessLevel;
  origin?: AccessOrigin;
  deviceAdded?: boolean;
  previousLevel?: AccessLevel;
  count?: number;
};
export type UsersHistoryEntry = UsersEvent & { details: UsersHistoryDetails };

export type UsersPersonRow = {
  id: string;
  nickname: string;
  nicknameKey: string;
  origin: AccessOrigin;
  level: AccessLevel;
  approvedAt: string;
  canSetLevel: boolean;
  canRevoke: boolean;
  reason: UsersGuardReason;
  lastEvent: UsersEvent | null;
  tableMark?: TableMark;
};

export type UsersClosedRow = {
  nickname: string;
  nicknameKey: string;
  status: "rejected" | "revoked";
  decidedAt: string;
  retryAt: string | null;
  lastEvent: UsersEvent | null;
  tableMark?: TableMark;
};

export type UsersSection<T> = { total: number; rows: T[] };

export type UsersList = {
  callerIsOwner: boolean;
  pendingTotalAll: number;
  serverNow: string;
  pending: UsersSection<UsersPendingRow>;
  people: UsersSection<UsersPersonRow>;
  closed: UsersSection<UsersClosedRow>;
  roster?: UsersRosterStatus;
};

export type UsersBulkCandidate = { id: string; nickname: string };
export type UsersBulk = { roster: UsersRosterStatus; eligible: UsersBulkCandidate[]; excluded: UsersBulkCandidate[] };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function parseReason(value: unknown): UsersGuardReason {
  if (value !== null && value !== "self" && value !== "owner") throw new UsersReplyError();
  return value;
}

function parseEvent(value: unknown): UsersEvent | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new UsersReplyError();
  const types: AccessEventType[] = ["approve", "reject", "level-change", "revoke", "cooldown-clear"];
  if (!types.includes(value.type as AccessEventType) || !isDateString(value.at) || (value.actor !== null && typeof value.actor !== "string")) {
    throw new UsersReplyError();
  }
  return { type: value.type as AccessEventType, at: value.at, actor: value.actor as string | null };
}

function parseHistoryDetails(type: AccessEventType, value: unknown): UsersHistoryDetails {
  if (!isRecord(value)) throw new UsersReplyError();
  const allowed = new Set(["level", "from", "to", "origin", "deviceAdded", "previousLevel", "count"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new UsersReplyError();
  const level = value.level;
  const from = value.from;
  const to = value.to;
  const origin = value.origin;
  const deviceAdded = value.deviceAdded;
  const previousLevel = value.previousLevel;
  const count = value.count;

  if (type === "approve") {
    if (!isAccessLevel(level) || typeof origin !== "string" || !(ACCESS_ORIGINS as readonly string[]).includes(origin) || typeof deviceAdded !== "boolean") {
      throw new UsersReplyError();
    }
    if (previousLevel !== undefined && !isAccessLevel(previousLevel)) throw new UsersReplyError();
    if (from !== undefined || to !== undefined || count !== undefined) throw new UsersReplyError();
    return { level, origin: origin as AccessOrigin, deviceAdded, ...(previousLevel === undefined ? {} : { previousLevel }) };
  }
  if (type === "reject") {
    if (typeof origin !== "string" || !(ACCESS_ORIGINS as readonly string[]).includes(origin) || Object.keys(value).length !== 1) throw new UsersReplyError();
    return { origin: origin as AccessOrigin };
  }
  if (type === "level-change") {
    if (!isAccessLevel(from) || !isAccessLevel(to) || Object.keys(value).length !== 2) throw new UsersReplyError();
    return { from, to };
  }
  if (type === "revoke") {
    if (!isAccessLevel(level) || Object.keys(value).length !== 1) throw new UsersReplyError();
    return { level };
  }
  if (!isNonNegativeInteger(count) || count === 0 || Object.keys(value).length !== 1) throw new UsersReplyError();
  return { count };
}

function parsePendingRow(value: unknown): UsersPendingRow {
  if (!isRecord(value)) throw new UsersReplyError();
  const { id, nickname, nicknameKey: key, origin, createdAt, existingLevel, canDecide, reason } = value;
  if (
    typeof id !== "string" || !uuidPattern.test(id)
    || !isValidNickname(nickname)
    || typeof key !== "string" || nicknameKey(nickname) !== key
    || typeof origin !== "string" || !(ACCESS_ORIGINS as readonly string[]).includes(origin)
    || !isDateString(createdAt)
    || (existingLevel !== null && !isAccessLevel(existingLevel))
    || typeof canDecide !== "boolean"
  ) throw new UsersReplyError();
  return { id, nickname, nicknameKey: key, origin: origin as AccessOrigin, createdAt, existingLevel, canDecide, reason: parseReason(reason) };
}

function parsePersonRow(value: unknown): UsersPersonRow {
  if (!isRecord(value)) throw new UsersReplyError();
  const { id, nickname, nicknameKey: key, origin, level, approvedAt, canSetLevel, canRevoke, reason, lastEvent } = value;
  if (
    typeof id !== "string" || !uuidPattern.test(id)
    || !isValidNickname(nickname)
    || typeof key !== "string" || nicknameKey(nickname) !== key
    || typeof origin !== "string" || !(ACCESS_ORIGINS as readonly string[]).includes(origin)
    || !isAccessLevel(level) || !isDateString(approvedAt)
    || typeof canSetLevel !== "boolean" || typeof canRevoke !== "boolean"
  ) throw new UsersReplyError();
  return { id, nickname, nicknameKey: key, origin: origin as AccessOrigin, level, approvedAt, canSetLevel, canRevoke, reason: parseReason(reason), lastEvent: parseEvent(lastEvent) };
}

function parseClosedRow(value: unknown): UsersClosedRow {
  if (!isRecord(value)) throw new UsersReplyError();
  const { nickname, nicknameKey: key, status, decidedAt, retryAt, lastEvent } = value;
  if (
    !isValidNickname(nickname)
    || typeof key !== "string" || nicknameKey(nickname) !== key
    || (status !== "rejected" && status !== "revoked")
    || !isDateString(decidedAt)
    || (retryAt !== null && !isDateString(retryAt))
  ) throw new UsersReplyError();
  return { nickname, nicknameKey: key, status, decidedAt, retryAt, lastEvent: parseEvent(lastEvent) };
}

function parseSection<T>(value: unknown, parseRow: (row: unknown) => T): UsersSection<T> {
  if (!isRecord(value) || !isNonNegativeInteger(value.total) || !Array.isArray(value.rows) || value.rows.length > 50 || value.rows.length > value.total) {
    throw new UsersReplyError();
  }
  return { total: value.total, rows: value.rows.map(parseRow) };
}

export function parseUsersList(value: unknown): UsersList {
  if (!isRecord(value)) throw new UsersReplyError();
  const { callerIsOwner, pendingTotalAll, serverNow, pending, people, closed } = value;
  if (
    typeof callerIsOwner !== "boolean"
    || !isNonNegativeInteger(pendingTotalAll)
    || !isDateString(serverNow)
  ) throw new UsersReplyError();
  return {
    callerIsOwner,
    pendingTotalAll,
    serverNow,
    pending: parseSection(pending, parsePendingRow),
    people: parseSection(people, parsePersonRow),
    closed: parseSection(closed, parseClosedRow),
  };
}

function parseTableMark(value: unknown): TableMark {
  if (value !== "yes" && value !== "no" && value !== "unknown") throw new UsersReplyError();
  return value;
}

function parseMarkedSection<T extends { tableMark?: TableMark }>(
  raw: unknown,
  parsed: UsersSection<T>,
): UsersSection<T> {
  if (!isRecord(raw) || !Array.isArray(raw.rows) || raw.rows.length !== parsed.rows.length) throw new UsersReplyError();
  const rawRows = raw.rows;
  return {
    ...parsed,
    rows: parsed.rows.map((row, index) => {
      const source = rawRows[index];
      if (!isRecord(source)) throw new UsersReplyError();
      return { ...row, tableMark: parseTableMark(source.tableMark) };
    }),
  };
}

export function parseUsersListReply(value: unknown): UsersList {
  if (!isRecord(value) || (value.roster !== "ok" && value.roster !== "degraded")) throw new UsersReplyError();
  const parsed = parseUsersList(value);
  return {
    ...parsed,
    roster: value.roster,
    pending: parseMarkedSection(value.pending, parsed.pending),
    people: parseMarkedSection(value.people, parsed.people),
    closed: parseMarkedSection(value.closed, parsed.closed),
  };
}

function parseBulkCandidate(value: unknown): UsersBulkCandidate {
  if (!isRecord(value) || typeof value.id !== "string" || !uuidPattern.test(value.id) || !isValidNickname(value.nickname)) {
    throw new UsersReplyError();
  }
  return { id: value.id, nickname: value.nickname };
}

export function parseUsersBulk(value: unknown): UsersBulk {
  if (
    !isRecord(value)
    || (value.roster !== "ok" && value.roster !== "degraded")
    || !Array.isArray(value.eligible) || value.eligible.length > 200
    || !Array.isArray(value.excluded) || value.excluded.length > 200
  ) throw new UsersReplyError();
  return {
    roster: value.roster,
    eligible: value.eligible.map(parseBulkCandidate),
    excluded: value.excluded.map(parseBulkCandidate),
  };
}

export function parseUsersHistory(value: unknown): UsersHistoryEntry[] {
  if (!isRecord(value) || !Array.isArray(value.entries) || value.entries.length > 5) throw new UsersReplyError();
  return value.entries.map((entry) => {
    if (!isRecord(entry)) throw new UsersReplyError();
    const parsed = parseEvent(entry);
    if (parsed === null) throw new UsersReplyError();
    return { ...parsed, details: parseHistoryDetails(parsed.type, entry.details) };
  });
}

export function parseUsersCount(value: unknown): number {
  if (!isRecord(value) || !isNonNegativeInteger(value.pending)) throw new UsersReplyError();
  return value.pending;
}
