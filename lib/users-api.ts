import { AccessStoreError, listAccess, type AccessRpcClient } from "./access-store.ts";

export type UsersAccess = { canEdit: boolean; canManageEditors: boolean; openTabs: readonly string[] };
export type UsersApiDeps = { access: UsersAccess; client: AccessRpcClient };
export type UsersApiResult = { status: number; body: Record<string, unknown> };

export const PENDING_DATABASE_STATES = ["PGRST202", "42883", "42P01"] as const;

const denied = (): UsersApiResult => ({ status: 403, body: { error: "Доступ закрыт." } });

export function mapAccessError(error: unknown): UsersApiResult {
  if (error instanceof AccessStoreError) {
    if (error.code === "forbidden") return denied();
    if (error.sqlState && (PENDING_DATABASE_STATES as readonly string[]).includes(error.sqlState)) {
      return { status: 503, body: { code: "pending-database" } };
    }
    if (error.code === "unexpected-reply") return { status: 502, body: { code: "unexpected-reply" } };
  }
  return { status: 502, body: { code: "unavailable" } };
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
    return { status: 400, body: { code: "invalid-view" } };
  } catch (error) {
    return mapAccessError(error);
  }
}
