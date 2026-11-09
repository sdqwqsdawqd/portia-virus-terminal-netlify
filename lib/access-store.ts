// Typed wrappers over the portia_access_* RPCs (Phase 21). Fail closed: any error or unknown reply throws.
// A SupabaseClient satisfies AccessRpcClient. No other module imports this file in Phase 21 (Phase 23 adds the route).

import { isAccessLevel, type AccessLevel, type AccessOrigin } from "./access-levels.ts";

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
} as const;

export class AccessStoreError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "AccessStoreError";
    this.code = code;
  }
}

// D-06. The SQL in portia_access_submit_request carries the same values as literals (pinned by lib/access-requests.test.ts).
export const ACCESS_REQUEST_LIMITS = {
  cooldownMinutes: 60,
  perNicknamePerDay: 3,
  perIpBucketPerDay: 10,
  maxPending: 200,
} as const;

export type SubmitResult =
  | { code: "created" | "pending" | "approved" | "device-busy" | "unavailable" | "invalid" | "throttled" }
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

const submitCodes = ["created", "pending", "approved", "device-busy", "unavailable", "invalid", "throttled"] as const;

const unexpected = () => new AccessStoreError("unexpected-reply");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function call(client: AccessRpcClient, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new AccessStoreError(error.message);
  if (!isRecord(data)) throw unexpected();
  return data;
}

export async function submitAccessRequest(
  client: AccessRpcClient,
  input: { nickname: string; origin: AccessOrigin; tokenHash: string; ipBucket: string },
): Promise<SubmitResult> {
  const data = await call(client, accessRpc.submit, {
    p_nickname: input.nickname,
    p_origin: input.origin,
    p_token_hash: input.tokenHash,
    p_ip_bucket: input.ipBucket,
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
