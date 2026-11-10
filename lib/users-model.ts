import { ACCESS_ORIGINS, type AccessOrigin } from "./access-levels.ts";
import { isValidNickname, nicknameKey } from "./nickname.ts";

export class UsersReplyError extends Error {
  constructor() {
    super("unexpected-reply");
    this.name = "UsersReplyError";
  }
}

export type UsersPendingRow = {
  id: string;
  nickname: string;
  nicknameKey: string;
  origin: AccessOrigin;
  createdAt: string;
};

export type UsersSection<T> = { total: number; rows: T[] };

export type UsersList = {
  callerIsOwner: boolean;
  pendingTotalAll: number;
  serverNow: string;
  pending: UsersSection<UsersPendingRow>;
};

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

function parsePendingRow(value: unknown): UsersPendingRow {
  if (!isRecord(value)) throw new UsersReplyError();
  const { id, nickname, nicknameKey: key, origin, createdAt } = value;
  if (
    typeof id !== "string" || !uuidPattern.test(id)
    || !isValidNickname(nickname)
    || typeof key !== "string" || nicknameKey(nickname) !== key
    || typeof origin !== "string" || !(ACCESS_ORIGINS as readonly string[]).includes(origin)
    || !isDateString(createdAt)
  ) throw new UsersReplyError();
  return { id, nickname, nicknameKey: key, origin: origin as AccessOrigin, createdAt };
}

export function parseUsersList(value: unknown): UsersList {
  if (!isRecord(value) || !isRecord(value.pending)) throw new UsersReplyError();
  const { callerIsOwner, pendingTotalAll, serverNow, pending } = value;
  if (
    typeof callerIsOwner !== "boolean"
    || !isNonNegativeInteger(pendingTotalAll)
    || !isDateString(serverNow)
    || !isNonNegativeInteger(pending.total)
    || !Array.isArray(pending.rows)
    || pending.rows.length > 50
    || pending.rows.length > pending.total
  ) throw new UsersReplyError();
  return {
    callerIsOwner,
    pendingTotalAll,
    serverNow,
    pending: { total: pending.total, rows: pending.rows.map(parsePendingRow) },
  };
}

export function parseUsersCount(value: unknown): number {
  if (!isRecord(value) || !isNonNegativeInteger(value.pending)) throw new UsersReplyError();
  return value.pending;
}
