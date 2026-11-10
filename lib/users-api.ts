import {
  AccessStoreError,
  accessHistory,
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

export type UsersAccess = { canEdit: boolean; canManageEditors: boolean; openTabs: readonly string[] };
export type UsersApiDeps = { access: UsersAccess; client: AccessRpcClient };
export type UsersApiResult = { status: number; body: Record<string, unknown> };

export const PENDING_DATABASE_STATES = ["PGRST202", "42883", "42P01"] as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type UsersAction =
  | { action: "approve"; requestId: string; level?: AccessLevel }
  | { action: "reject"; requestId: string }
  | { action: "set-level"; personId: string; level: AccessLevel; expectedLevel: AccessLevel }
  | { action: "revoke"; personId: string }
  | { action: "clear-cooldown"; nicknameKey: string };

type UsersActionParse = { action: UsersAction } | { error: "invalid-action" | "invalid-body" | "invalid-level" };

const denied = (): UsersApiResult => ({ status: 403, body: { error: "Доступ закрыт." } });

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
      return { action: { action, requestId: body.requestId, ...(body.level === undefined ? {} : { level: body.level }) } };
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

export async function parseUsersPostRequest(request: Request): Promise<{ result?: UsersApiResult; body?: Record<string, unknown> }> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { result: { status: 415, body: { code: "json-required" } } };
  }
  const body = parseJsonObject(await request.text());
  return body ? { body } : { result: { status: 400, body: { code: "invalid-body" } } };
}

export async function handleUsersGet(deps: UsersApiDeps, params: URLSearchParams): Promise<UsersApiResult> {
  if (!deps.access.canEdit || !deps.access.openTabs.includes("users")) return denied();
  const view = params.get("view") ?? "list";
  try {
    if (view === "list") {
      const query = (params.get("q") ?? "").trim().toLowerCase();
      if (!/^[a-z0-9_]{0,20}$/.test(query)) return { status: 400, body: { code: "invalid-query" } };
      return { status: 200, body: { list: await listAccess(deps.client, { query, limit: 50 }) } };
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
    return { status: 400, body: { code: "invalid-view" } };
  } catch (error) {
    return mapAccessError(error);
  }
}

export async function handleUsersPost(deps: UsersApiDeps, body: Record<string, unknown>): Promise<UsersApiResult> {
  if (!deps.access.canEdit || !deps.access.openTabs.includes("users")) return denied();
  const parsed = parseUsersAction(body);
  if ("error" in parsed) return { status: 400, body: { code: parsed.error } };
  try {
    if (parsed.action.action === "approve" || parsed.action.action === "reject") {
      const result = await decideAccessRequest(deps.client, {
        requestId: parsed.action.requestId,
        decision: parsed.action.action,
        ...(parsed.action.action === "approve" && parsed.action.level !== undefined ? { level: parsed.action.level } : {}),
      });
      return { status: 200, body: { ...result } };
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
