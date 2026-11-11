import {
  AccessStoreError,
  accessHistory,
  bulkCandidates as loadBulkCandidates,
  clearAccessCooldown,
  decideAccessRequest,
  listAccess,
  revokeAccess,
  setAccessLevel,
  type AccessRpcClient,
} from "./access-store.ts";
import { isAccessLevel, type AccessLevel } from "./access-levels.ts";
import { nicknameKey } from "./nickname.ts";
import { parseJsonObject } from "./request-json.ts";
import { loadUsersRoster, tableMarkFor, type UsersRoster, type UsersRosterLoad } from "./users-roster.ts";
import type { UsersList } from "./users-model.ts";

export type UsersAccess = { canEdit: boolean; canManageEditors: boolean; openTabs: readonly string[] };
export type UsersApiDeps = {
  access: UsersAccess;
  client: AccessRpcClient;
  loadRoster?: UsersRosterLoad;
  now?: () => Date;
};
export type UsersApiResult = { status: number; body: Record<string, unknown> };

export const PENDING_DATABASE_STATES = ["PGRST202", "42883", "42P01"] as const;
export const USERS_POST_MAX_BYTES = 16_384;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type UsersAction =
  | { action: "approve"; requestId: string; level?: AccessLevel; bulk?: true; nicknameKey?: string }
  | { action: "reject"; requestId: string }
  | { action: "set-level"; personId: string; level: AccessLevel; expectedLevel: AccessLevel }
  | { action: "revoke"; personId: string }
  | { action: "clear-cooldown"; nicknameKey: string };

type UsersActionParse = { action: UsersAction } | { error: "invalid-action" | "invalid-body" | "invalid-level" };

const denied = (): UsersApiResult => ({ status: 403, body: { error: "Доступ закрыт." } });

export function canAccessUsers(access: UsersAccess): boolean {
  return access.canEdit && access.openTabs.includes("users");
}

export function mapAccessError(error: unknown): UsersApiResult {
  if (error instanceof AccessStoreError) {
    if (error.code === "forbidden") return denied();
    if (error.code === "self-decision") return { status: 409, body: { code: "self" } };
    if (error.code === "owner-protected") return { status: 409, body: { code: "owner" } };
    if (error.code === "level-above-own") return { status: 409, body: { code: "level-above-own" } };
    if (error.code === "level-change-separate") return { status: 409, body: { code: "level-change-separate" } };
    if (error.code === "invalid-level") return { status: 400, body: { code: "invalid-level" } };
    if (error.code === "owner-required") return { status: 403, body: { code: "owner-only" } };
    if (error.sqlState && (PENDING_DATABASE_STATES as readonly string[]).includes(error.sqlState)) {
      return { status: 503, body: { code: "pending-database" } };
    }
    if (error.code === "unexpected-reply") return { status: 502, body: { code: "unexpected-reply" } };
  }
  return { status: 502, body: { code: "unavailable" } };
}

export function parseUsersAction(body: Record<string, unknown>): UsersActionParse {
  const action = body.action;
  if (action !== "approve" && action !== "reject" && action !== "set-level" && action !== "revoke" && action !== "clear-cooldown") {
    return { error: "invalid-action" };
  }
  if (action === "approve" || action === "reject") {
    if (typeof body.requestId !== "string" || !uuidPattern.test(body.requestId)) return { error: "invalid-body" };
    if (action === "approve") {
      if (body.level !== undefined && !isAccessLevel(body.level)) return { error: "invalid-level" };
      if (body.bulk !== undefined && body.bulk !== true) return { error: "invalid-body" };
      if (body.nicknameKey !== undefined && (typeof body.nicknameKey !== "string" || nicknameKey(body.nicknameKey) !== body.nicknameKey)) {
        return { error: "invalid-body" };
      }
      return { action: {
        action,
        requestId: body.requestId,
        ...(body.level === undefined ? {} : { level: body.level }),
        ...(body.bulk === true ? { bulk: true as const } : {}),
        ...(typeof body.nicknameKey === "string" ? { nicknameKey: body.nicknameKey } : {}),
      } };
    }
    return { action: { action, requestId: body.requestId } };
  }
  if (action === "set-level") {
    if (typeof body.personId !== "string" || !uuidPattern.test(body.personId)) return { error: "invalid-body" };
    if (!isAccessLevel(body.level) || !isAccessLevel(body.expectedLevel)) return { error: "invalid-level" };
    return { action: { action, personId: body.personId, level: body.level, expectedLevel: body.expectedLevel } };
  }
  if (action === "revoke") {
    if (typeof body.personId !== "string" || !uuidPattern.test(body.personId)) return { error: "invalid-body" };
    return { action: { action, personId: body.personId } };
  }
  if (typeof body.nicknameKey !== "string" || nicknameKey(body.nicknameKey) !== body.nicknameKey) return { error: "invalid-body" };
  return { action: { action, nicknameKey: body.nicknameKey } };
}

async function rosterFor(deps: UsersApiDeps, ttlMs: number): Promise<UsersRoster> {
  return loadUsersRoster({ load: deps.loadRoster, now: deps.now, ttlMs });
}

function markUsersList(list: UsersList, roster: UsersRoster): UsersList {
  const markRows = <T extends { nicknameKey: string }>(rows: T[]) => rows.map((row) => ({
    ...row,
    tableMark: tableMarkFor(row.nicknameKey, roster),
  }));
  return {
    ...list,
    roster: roster.status === "ok" ? "ok" : "degraded",
    pending: { ...list.pending, rows: markRows(list.pending.rows) },
    people: { ...list.people, rows: markRows(list.people.rows) },
    closed: { ...list.closed, rows: markRows(list.closed.rows) },
  };
}

export async function parseUsersPostRequest(request: Request): Promise<{ result?: UsersApiResult; body?: Record<string, unknown> }> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { result: { status: 415, body: { code: "json-required" } } };
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > USERS_POST_MAX_BYTES) {
    return { result: { status: 413, body: { code: "body-too-large" } } };
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let raw = "";
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > USERS_POST_MAX_BYTES) {
        await reader.cancel();
        return { result: { status: 413, body: { code: "body-too-large" } } };
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  }
  const body = parseJsonObject(raw);
  return body ? { body } : { result: { status: 400, body: { code: "invalid-body" } } };
}

export async function handleUsersGet(deps: UsersApiDeps, params: URLSearchParams): Promise<UsersApiResult> {
  if (!canAccessUsers(deps.access)) return denied();
  const view = params.get("view") ?? "list";
  try {
    if (view === "list") {
      const rawQuery = (params.get("q") ?? "").trim();
      if (!/^[A-Za-z0-9_]{0,20}$/.test(rawQuery)) return { status: 400, body: { code: "invalid-query" } };
      const query = rawQuery.toLowerCase();
      const list = await listAccess(deps.client, { query, limit: 50 });
      return { status: 200, body: { list: markUsersList(list, await rosterFor(deps, 20_000)) } };
    }
    if (view === "count") {
      const list = await listAccess(deps.client, { query: "", limit: 0 });
      return { status: 200, body: { pending: list.pendingTotalAll } };
    }
    if (view === "history") {
      const key = params.get("key") ?? "";
      if (nicknameKey(key) !== key) return { status: 400, body: { code: "invalid-key" } };
      return { status: 200, body: { entries: await accessHistory(deps.client, { nicknameKey: key }) } };
    }
    if (view === "bulk") {
      if (!deps.access.canManageEditors) return { status: 403, body: { code: "owner-only" } };
      const candidates = await loadBulkCandidates(deps.client);
      const roster = await rosterFor(deps, 0);
      if (roster.status === "degraded") return { status: 200, body: { roster: "degraded", eligible: [], excluded: [] } };
      const eligible: { id: string; nickname: string }[] = [];
      const excluded: { id: string; nickname: string }[] = [];
      for (const candidate of candidates) {
        (roster.keys.has(candidate.nicknameKey) ? eligible : excluded).push({ id: candidate.id, nickname: candidate.nickname });
      }
      return { status: 200, body: { roster: "ok", eligible, excluded } };
    }
    return { status: 400, body: { code: "invalid-view" } };
  } catch (error) {
    return mapAccessError(error);
  }
}

export async function handleUsersPost(deps: UsersApiDeps, body: Record<string, unknown>): Promise<UsersApiResult> {
  if (!canAccessUsers(deps.access)) return denied();
  const parsed = parseUsersAction(body);
  if ("error" in parsed) return { status: 400, body: { code: parsed.error } };
  try {
    if (parsed.action.action === "approve" || parsed.action.action === "reject") {
      if (parsed.action.action === "approve" && parsed.action.bulk) {
        if (!deps.access.canManageEditors) return { status: 403, body: { code: "owner-only" } };
        if (parsed.action.level !== 2) return { status: 400, body: { code: "invalid-level" } };
        const roster = await rosterFor(deps, 0);
        if (roster.status === "degraded") return { status: 503, body: { code: "roster-unavailable" } };
        const requestId = parsed.action.requestId;
        const candidate = (await loadBulkCandidates(deps.client)).find((item) => item.id === requestId);
        if (!candidate) return { status: 200, body: { code: "already-decided" } };
        if (!roster.keys.has(candidate.nicknameKey)) return { status: 409, body: { code: "not-in-table" } };
        const result = await decideAccessRequest(deps.client, {
          requestId,
          decision: "approve",
          level: 2,
        });
        return { status: 200, body: { ...result, tableMark: "yes" } };
      }
      const roster = parsed.action.action === "approve" ? await rosterFor(deps, 0) : null;
      const result = await decideAccessRequest(deps.client, {
        requestId: parsed.action.requestId,
        decision: parsed.action.action,
        ...(parsed.action.action === "approve" && parsed.action.level !== undefined ? { level: parsed.action.level } : {}),
      });
      return {
        status: 200,
        body: {
          ...result,
          ...(parsed.action.action === "approve"
            ? { tableMark: parsed.action.nicknameKey ? tableMarkFor(parsed.action.nicknameKey, roster as UsersRoster) : "unknown" }
            : {}),
        },
      };
    }
    if (parsed.action.action === "set-level") {
      const result = await setAccessLevel(deps.client, {
        personId: parsed.action.personId,
        level: parsed.action.level,
        expectedLevel: parsed.action.expectedLevel,
      });
      return { status: 200, body: { ...result } };
    }
    if (parsed.action.action === "revoke") {
      return { status: 200, body: { ...await revokeAccess(deps.client, { personId: parsed.action.personId }) } };
    }
    if (!deps.access.canManageEditors) return { status: 403, body: { code: "owner-only" } };
    return { status: 200, body: { ...await clearAccessCooldown(deps.client, { nicknameKey: parsed.action.nicknameKey }) } };
  } catch (error) {
    return mapAccessError(error);
  }
}
