// Typed wrappers over the portia_access_* RPCs (Phase 21). Fail closed: any error or unknown reply throws.
// A SupabaseClient satisfies AccessRpcClient. No other module imports this file in Phase 21 (Phase 23 adds the route).

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
} as const;

export class AccessStoreError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "AccessStoreError";
    this.code = code;
  }
}

export type AccessOriginValue = "sheet" | "outside";

export type SubmitResult = { code: "created" | "pending" | "approved" | "device-busy" | "unavailable" | "invalid" };

export type AccessState =
  | { state: "none" }
  | { state: "pending"; nickname: string }
  | { state: "approved"; nickname: string; level: number }
  | { state: "rejected" | "revoked"; nickname: string; retryAt: string | null };

export type DecideResult =
  | { code: "approved"; personId: string; level: number }
  | { code: "rejected" }
  | { code: "already-decided"; status: string }
  | { code: "not-found" };

const submitCodes = ["created", "pending", "approved", "device-busy", "unavailable", "invalid"] as const;

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
  input: { nickname: string; origin: AccessOriginValue; tokenHash: string; ipBucket: string },
): Promise<SubmitResult> {
  const data = await call(client, accessRpc.submit, {
    p_nickname: input.nickname,
    p_origin: input.origin,
    p_token_hash: input.tokenHash,
    p_ip_bucket: input.ipBucket,
  });
  const code = data.code;
  if (typeof code !== "string" || !(submitCodes as readonly string[]).includes(code)) throw unexpected();
  return { code: code as SubmitResult["code"] };
}

export async function resolveAccess(client: AccessRpcClient, tokenHash: string): Promise<AccessState> {
  const data = await call(client, accessRpc.resolve, { p_token_hash: tokenHash });
  const { state, nickname } = data;
  if (state === "none") return { state: "none" };
  if (typeof nickname !== "string") throw unexpected();
  if (state === "pending") return { state: "pending", nickname };
  if (state === "approved") {
    const level = data.level;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 5) throw unexpected();
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
  input: { requestId: string; decision: "approve" | "reject"; level?: number },
): Promise<DecideResult> {
  const data = await call(client, accessRpc.decide, {
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_level: input.level ?? null,
  });
  switch (data.code) {
    case "approved": {
      const { personId, level } = data;
      if (typeof personId !== "string" || typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 5) throw unexpected();
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
