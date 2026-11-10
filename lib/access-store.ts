// Typed wrappers over the portia_access_* RPCs (Phase 21). Fail closed: any error or unknown reply throws.
// A SupabaseClient satisfies AccessRpcClient. Phase 22 adds the editor read wrappers used by lib/users-api.ts.

import { isAccessLevel, type AccessLevel, type AccessOrigin } from "./access-levels.ts";
import { signAccessSubmit } from "./access-session.ts";
import { parseUsersHistory, parseUsersList, UsersReplyError, type UsersHistoryEntry, type UsersList } from "./users-model.ts";

export type AccessRpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export const accessRpc = {
  submit: "portia_access_submit_request",
  resolve: "portia_access_resolve",
  decide: "portia_access_decide",
  setLevel: "portia_access_set_level",
  revoke: "portia_access_revoke",
  clearCooldown: "portia_access_clear_cooldown",
  list: "portia_access_list",
  history: "portia_access_history",
  closureEnabled: "portia_access_closure_enabled",
  setClosure: "portia_access_set_closure",
} as const;

export class AccessStoreError extends Error {
  readonly code: string;
  readonly sqlState: string | null;
  constructor(code: string, sqlState: string | null = null) {
    super(code);
    this.name = "AccessStoreError";
    this.code = code;
    this.sqlState = sqlState;
  }
}

// D-06. The SQL in portia_access_submit_request carries the same values as literals (pinned by lib/access-requests.test.ts).
export const ACCESS_REQUEST_LIMITS = {
  cooldownMinutes: 60,
  perNicknamePerDay: 3,
  perIpBucketPerDay: 10,
  maxPending: 200,
  // RLS21-01: global rate of new requests, counted under the same queue lock.
  maxNewPerMinute: 20,
} as const;

export type SubmitResult =
  | { code: "created" | "pending" | "approved" | "device-busy" | "unavailable" | "invalid" | "throttled" | "unauthorized" }
  | { code: "cooldown"; retryAt: string };

export type ClearCooldownResult = { code: "cleared" | "no-cooldown" | "invalid" };

export type AccessState =
  | { state: "none" }
  | { state: "pending"; nickname: string }
  | { state: "approved"; nickname: string; level: AccessLevel }
  | { state: "rejected" | "revoked"; nickname: string; retryAt: string | null };

export type DecideResult =
  | { code: "approved"; personId: string; level: AccessLevel }
  | { code: "rejected" }
  | { code: "already-decided"; status: string }
  | { code: "not-found" };

export type SetLevelResult =
  | { code: "updated" | "unchanged" | "stale"; level: AccessLevel }
  | { code: "not-found" | "not-active" };

export type RevokeResult = { code: "revoked" | "already-revoked" | "not-found" };

const submitCodes = ["created", "pending", "approved", "device-busy", "unavailable", "invalid", "throttled", "unauthorized"] as const;

const unexpected = () => new AccessStoreError("unexpected-reply");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function call(client: AccessRpcClient, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new AccessStoreError(error.message, error.code ?? null);
  if (!isRecord(data)) throw unexpected();
  return data;
}

// The server signs every submit (RLS21-01): submitSecret is the server-only PORTIA_ACCESS_SUBMIT_SECRET (see
// accessSubmitSecret in access-session.ts), issuedAt defaults to now in whole seconds. The secret itself is never sent.
export async function submitAccessRequest(
  client: AccessRpcClient,
  input: { nickname: string; origin: AccessOrigin; tokenHash: string; ipBucket: string; submitSecret: string; issuedAt?: number },
): Promise<SubmitResult> {
  const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
  const signature = signAccessSubmit(
    { nickname: input.nickname, origin: input.origin, tokenHash: input.tokenHash, ipBucket: input.ipBucket, issuedAt },
    input.submitSecret,
  );
  const data = await call(client, accessRpc.submit, {
    p_nickname: input.nickname,
    p_origin: input.origin,
    p_token_hash: input.tokenHash,
    p_ip_bucket: input.ipBucket,
    p_issued_at: issuedAt,
    p_signature: signature,
  });
  const code = data.code;
  if (code === "cooldown") {
    if (typeof data.retryAt !== "string") throw unexpected();
    return { code: "cooldown", retryAt: data.retryAt };
  }
  if (typeof code !== "string" || !(submitCodes as readonly string[]).includes(code)) throw unexpected();
  return { code: code as Exclude<SubmitResult, { code: "cooldown" }>["code"] };
}

export async function resolveAccess(client: AccessRpcClient, tokenHash: string): Promise<AccessState> {
  const data = await call(client, accessRpc.resolve, { p_token_hash: tokenHash });
  const { state, nickname } = data;
  if (state === "none") return { state: "none" };
  if (typeof nickname !== "string") throw unexpected();
  if (state === "pending") return { state: "pending", nickname };
  if (state === "approved") {
    const level = data.level;
    if (!isAccessLevel(level)) throw unexpected();
    return { state: "approved", nickname, level };
  }
  if (state === "rejected" || state === "revoked") {
    const retryAt = data.retryAt;
    if (retryAt !== null && typeof retryAt !== "string") throw unexpected();
    return { state, nickname, retryAt };
  }
  throw unexpected();
}

export async function decideAccessRequest(
  client: AccessRpcClient,
  input: { requestId: string; decision: "approve" | "reject"; level?: AccessLevel },
): Promise<DecideResult> {
  const data = await call(client, accessRpc.decide, {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_level: input.level ?? null,
  });
  switch (data.code) {
    case "approved": {
      const { personId, level } = data;
      if (typeof personId !== "string" || !isAccessLevel(level)) throw unexpected();
      return { code: "approved", personId, level };
    }
    case "rejected":
      return { code: "rejected" };
    case "already-decided":
      if (typeof data.status !== "string") throw unexpected();
      return { code: "already-decided", status: data.status };
    case "not-found":
      return { code: "not-found" };
    default:
      throw unexpected();
  }
}

export async function setAccessLevel(
  client: AccessRpcClient,
  input: { personId: string; level: AccessLevel; expectedLevel: AccessLevel },
): Promise<SetLevelResult> {
  const data = await call(client, accessRpc.setLevel, {
    p_person_id: input.personId,
    p_level: input.level,
    p_expected_level: input.expectedLevel,
  });
  switch (data.code) {
    case "updated":
    case "unchanged":
    case "stale":
      if (!isAccessLevel(data.level)) throw unexpected();
      return { code: data.code, level: data.level };
    case "not-found":
    case "not-active":
      return { code: data.code };
    default:
      throw unexpected();
  }
}

export async function revokeAccess(client: AccessRpcClient, input: { personId: string }): Promise<RevokeResult> {
  const data = await call(client, accessRpc.revoke, { p_person_id: input.personId });
  switch (data.code) {
    case "revoked":
    case "already-revoked":
    case "not-found":
      return { code: data.code };
    default:
      throw unexpected();
  }
}

export async function clearAccessCooldown(client: AccessRpcClient, input: { nicknameKey: string }): Promise<ClearCooldownResult> {
  const data = await call(client, accessRpc.clearCooldown, { p_nickname_key: input.nicknameKey });
  switch (data.code) {
    case "cleared":
    case "no-cooldown":
    case "invalid":
      return { code: data.code };
    default:
      throw unexpected();
  }
}

export async function listAccess(client: AccessRpcClient, input: { query: string; limit: number }): Promise<UsersList> {
  const data = await call(client, accessRpc.list, { p_query: input.query, p_limit: input.limit });
  try {
    return parseUsersList(data);
  } catch (error) {
    if (error instanceof UsersReplyError) throw unexpected();
    throw error;
  }
}

export async function accessHistory(client: AccessRpcClient, input: { nicknameKey: string }): Promise<UsersHistoryEntry[]> {
  const data = await call(client, accessRpc.history, { p_nickname_key: input.nicknameKey });
  try {
    return parseUsersHistory(data);
  } catch (error) {
    if (error instanceof UsersReplyError) throw unexpected();
    throw error;
  }
}

export type SetClosureResult = { code: "updated"; enabled: boolean; updatedAt: string } | { code: "invalid" };

// The reply is a bare boolean (not a record), so this one does not go through call().
export async function isClosureEnabled(client: AccessRpcClient): Promise<boolean> {
  const { data, error } = await client.rpc(accessRpc.closureEnabled, {});
  if (error) throw new AccessStoreError(error.message, error.code ?? null);
  if (typeof data !== "boolean") throw unexpected();
  return data;
}

// Owner only: a non-owner makes the database raise "owner-required", which surfaces as AccessStoreError.
export async function setClosure(client: AccessRpcClient, input: { enabled: boolean }): Promise<SetClosureResult> {
  const data = await call(client, accessRpc.setClosure, { p_enabled: input.enabled });
  switch (data.code) {
    case "updated": {
      const { enabled, updatedAt } = data;
      if (typeof enabled !== "boolean" || typeof updatedAt !== "string") throw unexpected();
      return { code: "updated", enabled, updatedAt };
    }
    case "invalid":
      return { code: "invalid" };
    default:
      throw unexpected();
  }
}
