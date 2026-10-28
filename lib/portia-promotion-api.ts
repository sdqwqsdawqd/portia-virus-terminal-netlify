import {
  buildDeviceCookie,
  createDeviceToken,
  deviceTokenDigest,
  promotionAttemptBucket,
} from "./portia-device-binding.ts";
import { promotionEligibility, promotionTitles, type PromotionRequestKind, type PromotionTitleId } from "./portia-promotion.ts";
import {
  findPromotionAccessEntry,
  findPromotionRosterEntry,
  loadPromotionAccessRoster,
  loadPromotionRoster,
  type PromotionAccessResult,
  type PromotionRosterResult,
} from "./portia-promotion-sheet.ts";

export type PromotionPublicResult = {
  kind: PromotionRequestKind;
  outcome: "approved" | "passed" | "failed" | "rejected" | "technical-failure" | "retake-released";
  createdAt: string;
};

export type PromotionPublicActive = {
  status: string;
  targetTitleId: PromotionTitleId | null;
  attemptId?: string;
  availableAt?: string;
  percent?: number;
  tasks?: { id: string; text: string; sortOrder: number }[];
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
  | { status: "device-denied" | "throttled"; blockedUntil: string | null }
  | { status: "unavailable" };
type ResolveResult = { status: "ok"; nicknameKey: string | null } | { status: "unavailable" };

export type PromotionApiDependencies = {
  now: () => Date;
  secret: string;
  createToken?: () => string;
  loadAccessRoster: () => Promise<PromotionAccessResult>;
  loadRoster: () => Promise<PromotionRosterResult>;
  resolveDevice: (tokenHash: string) => Promise<ResolveResult>;
  workflowStatus: (input: { nicknameKey: string; titleId: PromotionTitleId; tokenHash: string | null }) => Promise<DependencyResult<PromotionWorkflowProjection>>;
  submitRequest: (input: {
    kind: PromotionRequestKind;
    nickname: string;
    nicknameKey: string;
    titleId: PromotionTitleId;
    targetId: PromotionTitleId;
    tokenHash: string;
    riskBucket: string;
    bucketKey: string;
    ipBucket: string;
  }) => Promise<SubmitResult>;
};

export type PromotionApiResult = {
  status: number;
  body: Record<string, unknown>;
  setCookie?: string;
};

const notListed = { error: "Ник не найден в списке PORTIA. Проверьте написание или обратитесь к руководителю.", code: "not-listed" };
const sheetUnavailable = { error: "Список участников временно недоступен. Попробуйте позже — заявка не отправлена.", code: "sheet-unavailable" };
const promotionSheetUnavailable = { error: "Данные повышения временно недоступны. Попробуйте позже.", code: "promotion-sheet-unavailable" };
const promotionSourceInvalid = { error: "Данные повышения требуют проверки. Попробуйте позже.", code: "promotion-source-invalid" };
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
  const attemptId = typeof (row.attemptId ?? row.attempt_id) === "string" ? String(row.attemptId ?? row.attempt_id) : null;
  const percent = Number.isInteger(row.percent) && (row.percent as number) >= 0 && (row.percent as number) <= 100 ? row.percent as number : null;
  const tasks = Array.isArray(row.tasks) ? row.tasks.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const task = item as Record<string, unknown>;
    const id = task.id;
    const text = task.text;
    const sortOrder = task.sortOrder ?? task.sort_order;
    if (typeof id !== "string" || typeof text !== "string" || !Number.isInteger(sortOrder) || (sortOrder as number) < 1) return [];
    return [{ id, text, sortOrder: sortOrder as number }];
  }).slice(0, 50) : [];
  return {
    status: row.status,
    targetTitleId: titleId(row.targetTitleId ?? row.target_title_id),
    ...(attemptId ? { attemptId } : {}),
    ...(availableAt ? { availableAt } : {}),
    ...(percent !== null ? { percent } : {}),
    ...(tasks.length ? { tasks } : {}),
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
    promotionRecord: {
      currentTitle: { id: entry.titleId, label: entry.title },
      nextTitle: entry.nextTitleId ? { id: entry.nextTitleId, label: entry.nextTitle } : null,
    },
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
  input: { nickname: string; token: string | null; headers?: Headers },
  deps: PromotionApiDependencies,
): Promise<PromotionApiResult> {
  let nickname = validNickname(input.nickname);
  const presentedHash = hashToken(input.token, deps.secret);
  if (!nickname) {
    if (input.nickname.trim() || !presentedHash) return { status: input.nickname.trim() ? 400 : 404, body: { error: "Некорректный ник.", code: input.nickname.trim() ? "invalid-nickname" : "unbound-device" } };
    const resolved = await deps.resolveDevice(presentedHash);
    if (resolved.status !== "ok") return { status: 503, body: pendingDatabase };
    if (!resolved.nicknameKey) return { status: 404, body: { error: "Привязка устройства не найдена.", code: "unbound-device" } };
    nickname = resolved.nicknameKey;
  }
  const access = await deps.loadAccessRoster();
  if (access.status !== "ok") return { status: 503, body: access.status === "invalid-source" ? promotionSourceInvalid : sheetUnavailable };
  const admitted = findPromotionAccessEntry(access.roster, nickname);
  if (!admitted) return { status: 404, body: notListed };

  const existingHash = presentedHash;
  const token = existingHash ? input.token! : (deps.createToken ?? createDeviceToken)();
  const tokenHash = existingHash ?? deviceTokenDigest(token, deps.secret);
  const cookie = existingHash ? {} : { setCookie: buildDeviceCookie(token) };

  const roster = await deps.loadRoster();
  if (roster.status !== "ok") return { status: 503, body: roster.status === "invalid-source" ? promotionSourceInvalid : promotionSheetUnavailable, ...cookie };
  const entry = findPromotionRosterEntry(roster.roster, admitted.nickname);
  if (!entry) {
    return {
      status: 200,
      body: { nickname: admitted.nickname, promotionRecord: null, workflowAvailable: false },
      ...cookie,
    };
  }
  const workflow = await deps.workflowStatus({ nicknameKey: entry.nicknameKey, titleId: entry.titleId, tokenHash });
  if (workflow.status !== "ok") return { status: 503, body: pendingDatabase, ...cookie };
  if (workflow.projection.binding === "denied") return { status: 423, body: { ...deviceDenied, code: "device-denied" } };
  return { status: 200, body: statusBody(entry, workflow.projection, deps.now()), ...cookie };
}

export async function submitPromotionRequest(
  input: { nickname: string; kind: PromotionRequestKind; token: string | null; headers: Headers },
  deps: PromotionApiDependencies,
): Promise<PromotionApiResult> {
  const nickname = validNickname(input.nickname);
  if (!nickname || (input.kind !== "ordinary" && input.kind !== "qualification")) {
    return { status: 400, body: { error: "Некорректные данные.", code: "invalid-request" } };
  }
  const access = await deps.loadAccessRoster();
  if (access.status !== "ok") return { status: 503, body: access.status === "invalid-source" ? promotionSourceInvalid : sheetUnavailable };
  const admitted = findPromotionAccessEntry(access.roster, nickname);
  if (!admitted) return { status: 404, body: notListed };
  const roster = await deps.loadRoster();
  if (roster.status !== "ok") return { status: 503, body: roster.status === "invalid-source" ? promotionSourceInvalid : promotionSheetUnavailable };
  const entry = findPromotionRosterEntry(roster.roster, admitted.nickname);
  if (!entry) return { status: 409, body: { error: "Для участника ещё нет записи повышения.", code: "promotion-record-unavailable" } };

  const existingHash = hashToken(input.token, deps.secret);
  if (!existingHash) return { status: 423, body: { ...deviceDenied, code: "device-denied" } };
  const workflow = await deps.workflowStatus({ nicknameKey: entry.nicknameKey, titleId: entry.titleId, tokenHash: existingHash });
  if (workflow.status !== "ok") return { status: 503, body: pendingDatabase };
  const buckets = promotionAttemptBucket(entry.nicknameKey, input.headers, deps.secret);
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

  const submitted = await deps.submitRequest({
    kind: input.kind,
    nickname: entry.nickname,
    nicknameKey: entry.nicknameKey,
    titleId: entry.titleId,
    targetId: entry.nextTitleId,
    tokenHash: existingHash,
    riskBucket: buckets.riskBucket,
    bucketKey: buckets.bucketKey,
    ipBucket: buckets.ipBucket,
  });
  if (submitted.status === "unavailable") return { status: 503, body: pendingDatabase };
  if (submitted.status === "device-denied" || submitted.status === "throttled") {
    return { status: 423, body: { ...deviceDenied, code: "device-wait", blockedUntil: submitted.blockedUntil } };
  }
  if (submitted.status === "active") return { status: 409, body: { error: "Запрос этого вида уже активен.", code: "active-request" } };
  if (submitted.status !== "created") return { status: 503, body: pendingDatabase };
  return {
    status: 201,
    body: { requestId: submitted.requestId, kind: input.kind, status: "pending" },
  };
}

type RpcError = { code?: string; message?: string } | null;
const unavailableRpc = (error: RpcError) => error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42P01";

/** Server-route adapter. Public clients receive only security-definer RPC execution, never table access. */
export function createPromotionApiDependencies(supabase: SupabaseClient, secret: string): PromotionApiDependencies {
  return {
    now: () => new Date(),
    secret,
    loadAccessRoster: () => loadPromotionAccessRoster(),
    loadRoster: () => loadPromotionRoster(),
    resolveDevice: async (tokenHash) => {
      const { data, error } = await supabase.rpc("portia_promo_resolve_device", { p_token_hash: tokenHash });
      if (error) {
        if (!unavailableRpc(error)) console.error("PORTIA promotion device restore RPC failed", { code: error.code });
        return { status: "unavailable" } as const;
      }
      return { status: "ok", nicknameKey: typeof data === "string" ? data : null } as const;
    },
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
        p_bucket_key: input.bucketKey,
        p_ip_bucket: input.ipBucket,
      });
      if (error) {
        if (unavailableRpc(error)) return { status: "unavailable" } as const;
        console.error("PORTIA promotion submit RPC failed", { code: error.code });
        return { status: "unavailable" } as const;
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "unavailable" } as const;
      if (data.code === "created" && typeof data.requestId === "string") return { status: "created", requestId: data.requestId } as const;
      if (data.code === "active-request") return { status: "active" } as const;
      if (data.code === "throttled" || data.code === "device-denied") {
        return { status: data.code, blockedUntil: safeDate(data.blockedUntil) } as const;
      }
      return { status: "unavailable" } as const;
    },
  };
}
import type { SupabaseClient } from "@supabase/supabase-js";
