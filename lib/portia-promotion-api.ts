import {
  buildDeviceCookie,
  createDeviceToken,
  deviceTokenDigest,
  promotionAttemptBucket,
} from "./portia-device-binding.ts";
import { promotionEligibility, promotionTitles, type PromotionRequestKind, type PromotionTitleId } from "./portia-promotion.ts";
import { findPromotionRosterEntry, loadPromotionRoster, type PromotionRosterResult } from "./portia-promotion-sheet.ts";

export type PromotionPublicResult = {
  kind: PromotionRequestKind;
  outcome: "approved" | "passed" | "failed" | "rejected" | "technical-failure" | "retake-released";
  createdAt: string;
};

export type PromotionPublicActive = {
  status: string;
  targetTitleId: PromotionTitleId | null;
  availableAt?: string;
};

export type PromotionWorkflowProjection = {
  binding: "unbound" | "allowed" | "denied";
  ordinary: PromotionPublicActive | null;
  qualification: PromotionPublicActive | null;
  qualificationPassed: boolean;
  awaitingTitleId: PromotionTitleId | null;
  results: PromotionPublicResult[];
};

type DependencyResult<T> = { status: "ok"; projection: T } | { status: "unavailable" };
type SubmitResult =
  | { status: "created"; requestId: string }
  | { status: "active" }
  | { status: "device-denied" }
  | { status: "unavailable" };

export type PromotionApiDependencies = {
  now: () => Date;
  secret: string;
  createToken?: () => string;
  loadRoster: () => Promise<PromotionRosterResult>;
  workflowStatus: (input: { nicknameKey: string; titleId: PromotionTitleId; tokenHash: string | null }) => Promise<DependencyResult<PromotionWorkflowProjection>>;
  submitRequest: (input: {
    kind: PromotionRequestKind;
    nickname: string;
    nicknameKey: string;
    titleId: PromotionTitleId;
    targetId: PromotionTitleId;
    tokenHash: string;
    riskBucket: string;
  }) => Promise<SubmitResult>;
  registerAttempt: (input: {
    bucketKey: string;
    ipBucket: string;
    success: boolean;
  }) => Promise<{ status: "ok"; blockedUntil: string | null } | { status: "unavailable" }>;
};

export type PromotionApiResult = {
  status: number;
  body: Record<string, unknown>;
  setCookie?: string;
};

const notListed = { error: "Ник не найден в списке PORTIA. Проверьте написание или обратитесь к руководителю.", code: "not-listed" };
const sheetUnavailable = { error: "Список участников временно недоступен. Попробуйте позже — заявка не отправлена.", code: "sheet-unavailable" };
const pendingDatabase = { error: "Система повышения пока недоступна. Попробуйте позже.", code: "pending-database" };
const deviceDenied = { error: "Это устройство уже связано с другим участником. Обратитесь к проверяющему." };

function validNickname(value: string) {
  const nickname = value.trim();
  return nickname.length >= 1 && nickname.length <= 64 ? nickname : null;
}

function titleId(value: unknown): PromotionTitleId | null {
  return typeof value === "string" && promotionTitles.some((title) => title.id === value) ? value as PromotionTitleId : null;
}

function safeDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

const activeStatuses = new Set(["pending", "claimed", "assigned", "awaiting-sheet-change", "approved", "testing", "grading", "passed", "failed"]);
const outcomes = new Set<PromotionPublicResult["outcome"]>(["approved", "passed", "failed", "rejected", "technical-failure", "retake-released"]);

function activeFrom(value: unknown): PromotionPublicActive | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.status !== "string" || !activeStatuses.has(row.status)) return null;
  const availableAt = safeDate(row.availableAt ?? row.available_at);
  return {
    status: row.status,
    targetTitleId: titleId(row.targetTitleId ?? row.target_title_id),
    ...(availableAt ? { availableAt } : {}),
  };
}

/** Parses only the fields the public route is allowed to know from the security-definer RPC. */
export function promotionProjectionFromRpc(value: unknown): PromotionWorkflowProjection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!(["unbound", "allowed", "denied"] as unknown[]).includes(row.binding)) return null;
  const results = Array.isArray(row.results) ? row.results.flatMap((item): PromotionPublicResult[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const result = item as Record<string, unknown>;
    const kind = result.kind;
    const outcome = result.outcome;
    const createdAt = safeDate(result.createdAt ?? result.created_at);
    if ((kind !== "ordinary" && kind !== "qualification") || typeof outcome !== "string" || !outcomes.has(outcome as PromotionPublicResult["outcome"]) || !createdAt) return [];
    return [{ kind, outcome: outcome as PromotionPublicResult["outcome"], createdAt }];
  }).slice(0, 3) : [];
  return {
    binding: row.binding as PromotionWorkflowProjection["binding"],
    ordinary: activeFrom(row.ordinary),
    qualification: activeFrom(row.qualification),
    qualificationPassed: row.qualificationPassed === true || row.qualification_passed === true,
    awaitingTitleId: titleId(row.awaitingTitleId ?? row.awaiting_title_id),
    results,
  };
}

function statusBody(entry: NonNullable<ReturnType<typeof findPromotionRosterEntry>>, projection: PromotionWorkflowProjection, now: Date) {
  return {
    nickname: entry.nickname,
    currentTitle: { id: entry.titleId, label: entry.title },
    nextTitle: entry.nextTitleId ? { id: entry.nextTitleId, label: entry.nextTitle } : null,
    ordinary: {
      eligibility: promotionEligibility(entry, {
        kind: "ordinary",
        now,
        qualificationPassed: projection.qualificationPassed,
        awaitingTitleId: projection.awaitingTitleId,
      }),
      active: projection.ordinary,
    },
    qualification: {
      eligibility: promotionEligibility(entry, { kind: "qualification", now }),
      active: projection.qualification,
    },
    results: projection.results.slice(0, 3),
  };
}

function hashToken(token: string | null, secret: string) {
  if (!token) return null;
  try { return deviceTokenDigest(token, secret); } catch { return null; }
}

export async function promotionStatus(
  input: { nickname: string; token: string | null },
  deps: PromotionApiDependencies,
): Promise<PromotionApiResult> {
  const nickname = validNickname(input.nickname);
  if (!nickname) return { status: 400, body: { error: "Некорректный ник.", code: "invalid-nickname" } };
  const roster = await deps.loadRoster();
  if (roster.status !== "ok") return { status: 503, body: sheetUnavailable };
  const entry = findPromotionRosterEntry(roster.roster, nickname);
  if (!entry) return { status: 404, body: notListed };
  const workflow = await deps.workflowStatus({ nicknameKey: entry.nicknameKey, titleId: entry.titleId, tokenHash: hashToken(input.token, deps.secret) });
  if (workflow.status !== "ok") return { status: 503, body: pendingDatabase };
  if (workflow.projection.binding === "denied") return { status: 423, body: { ...deviceDenied, code: "device-denied" } };
  return { status: 200, body: statusBody(entry, workflow.projection, deps.now()) };
}

export async function submitPromotionRequest(
  input: { nickname: string; kind: PromotionRequestKind; token: string | null; headers: Headers },
  deps: PromotionApiDependencies,
): Promise<PromotionApiResult> {
  const nickname = validNickname(input.nickname);
  if (!nickname || (input.kind !== "ordinary" && input.kind !== "qualification")) {
    return { status: 400, body: { error: "Некорректные данные.", code: "invalid-request" } };
  }
  const roster = await deps.loadRoster();
  if (roster.status !== "ok") return { status: 503, body: sheetUnavailable };
  const entry = findPromotionRosterEntry(roster.roster, nickname);
  if (!entry) return { status: 404, body: notListed };

  const existingHash = hashToken(input.token, deps.secret);
  const workflow = await deps.workflowStatus({ nicknameKey: entry.nicknameKey, titleId: entry.titleId, tokenHash: existingHash });
  if (workflow.status !== "ok") return { status: 503, body: pendingDatabase };
  const buckets = promotionAttemptBucket(entry.nicknameKey, input.headers, deps.secret);
  if (workflow.projection.binding === "denied") {
    const attempt = await deps.registerAttempt({ bucketKey: buckets.bucketKey, ipBucket: buckets.ipBucket, success: false });
    return {
      status: 423,
      body: { ...deviceDenied, code: "device-wait", blockedUntil: attempt.status === "ok" ? attempt.blockedUntil : null },
    };
  }
  const active = input.kind === "ordinary" ? workflow.projection.ordinary : workflow.projection.qualification;
  if (active) {
    const retakeReady = input.kind === "qualification" && active.status === "failed"
      && (!active.availableAt || Date.parse(active.availableAt) <= deps.now().getTime());
    if (!retakeReady) {
      return {
        status: 409,
        body: {
          error: active.status === "failed" ? "Срок повторной проверки ещё не наступил." : "Запрос этого вида уже активен.",
          code: active.status === "failed" ? "retake-wait" : "active-request",
          ...(active.availableAt ? { availableAt: active.availableAt } : {}),
        },
      };
    }
  }
  const eligibility = promotionEligibility(entry, {
    kind: input.kind,
    now: deps.now(),
    qualificationPassed: workflow.projection.qualificationPassed,
    awaitingTitleId: workflow.projection.awaitingTitleId,
  });
  const acceptable = eligibility.status === "eligible" || (input.kind === "ordinary" && eligibility.status === "special-task");
  if (!acceptable || !entry.nextTitleId) {
    return { status: 409, body: { error: "Заявка сейчас недоступна.", code: eligibility.status, eligibility } };
  }

  const token = existingHash ? input.token! : (deps.createToken ?? createDeviceToken)();
  const tokenHash = existingHash ?? deviceTokenDigest(token, deps.secret);
  const submitted = await deps.submitRequest({
    kind: input.kind,
    nickname: entry.nickname,
    nicknameKey: entry.nicknameKey,
    titleId: entry.titleId,
    targetId: entry.nextTitleId,
    tokenHash,
    riskBucket: buckets.riskBucket,
  });
  if (submitted.status === "unavailable") return { status: 503, body: pendingDatabase };
  if (submitted.status === "device-denied") {
    const attempt = await deps.registerAttempt({ bucketKey: buckets.bucketKey, ipBucket: buckets.ipBucket, success: false });
    return { status: 423, body: { ...deviceDenied, code: "device-wait", blockedUntil: attempt.status === "ok" ? attempt.blockedUntil : null } };
  }
  if (submitted.status === "active") return { status: 409, body: { error: "Запрос этого вида уже активен.", code: "active-request" } };
  await deps.registerAttempt({ bucketKey: buckets.bucketKey, ipBucket: buckets.ipBucket, success: true });
  return {
    status: 201,
    body: { requestId: submitted.requestId, kind: input.kind, status: "pending" },
    ...(existingHash ? {} : { setCookie: buildDeviceCookie(token) }),
  };
}

type RpcError = { code?: string; message?: string } | null;
const unavailableRpc = (error: RpcError) => error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42P01";

/** Server-route adapter. Public clients receive only security-definer RPC execution, never table access. */
export function createPromotionApiDependencies(supabase: SupabaseClient, secret: string): PromotionApiDependencies {
  return {
    now: () => new Date(),
    secret,
    loadRoster: () => loadPromotionRoster(),
    workflowStatus: async ({ nicknameKey, titleId: currentTitleId, tokenHash }) => {
      const { data, error } = await supabase.rpc("portia_promo_public_status", {
        p_nickname_key: nicknameKey,
        p_title_id: currentTitleId,
        p_token_hash: tokenHash,
      });
      if (error || data === null) {
        if (!unavailableRpc(error)) console.error("PORTIA promotion status RPC failed", { code: error?.code });
        return { status: "unavailable" } as const;
      }
      const projection = promotionProjectionFromRpc(data);
      return projection ? { status: "ok", projection } as const : { status: "unavailable" } as const;
    },
    submitRequest: async (input) => {
      const { data, error } = await supabase.rpc("portia_promo_submit_request", {
        p_kind: input.kind,
        p_nickname: input.nickname,
        p_nickname_key: input.nicknameKey,
        p_title_id: input.titleId,
        p_target_id: input.targetId,
        p_token_hash: input.tokenHash,
        p_risk_bucket: input.riskBucket,
      });
      if (error) {
        if (unavailableRpc(error)) return { status: "unavailable" } as const;
        if (error.code === "23505") return { status: "active" } as const;
        if (error.message?.includes("device-denied")) return { status: "device-denied" } as const;
        console.error("PORTIA promotion submit RPC failed", { code: error.code });
        return { status: "unavailable" } as const;
      }
      return typeof data === "string" ? { status: "created", requestId: data } as const : { status: "unavailable" } as const;
    },
    registerAttempt: async (input) => {
      const { data, error } = await supabase.rpc("portia_promo_register_attempt", {
        p_bucket_key: input.bucketKey,
        p_ip_bucket: input.ipBucket,
        p_success: input.success,
      });
      if (error) {
        if (!unavailableRpc(error)) console.error("PORTIA promotion throttle RPC failed", { code: error.code });
        return { status: "unavailable" } as const;
      }
      return { status: "ok", blockedUntil: safeDate(data) } as const;
    },
  };
}
import type { SupabaseClient } from "@supabase/supabase-js";
