import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getEditorAccess, type EditorAccess } from "./editor-access.ts";
import {
  ordinaryPromotionTransitions,
  qualificationPromotionTransitions,
  type PromotionRequestKind,
} from "./portia-promotion.ts";

export type PromotionReviewerAccess =
  | { status: "allowed"; supabase: SupabaseClient; user: User; access: EditorAccess }
  | { status: "forbidden" | "unavailable" };

export function promotionReviewerDecision(hasUser: boolean, access: EditorAccess | null) {
  if (access?.unavailable) return "unavailable" as const;
  if (!hasUser || !access?.canEdit || !access.openTabs.includes("promo")) return "forbidden" as const;
  return "allowed" as const;
}

export async function requirePromotionReviewer(supabase: SupabaseClient): Promise<PromotionReviewerAccess> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { status: "unavailable" };
  const access = await getEditorAccess(supabase, data.user);
  const decision = promotionReviewerDecision(Boolean(data.user), access);
  if (decision === "unavailable") return { status: "unavailable" };
  if (decision === "forbidden" || !data.user) return { status: "forbidden" };
  return { status: "allowed", supabase, user: data.user, access };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const requestActions = new Set(["claim", "release", "force-release", "reject", "delete-request", "approve-task"]);
const attemptActions = new Set(["override-failure", "release-retake"]);

export type PromotionReviewerCommand =
  | { action: "claim" | "release" | "force-release" | "approve-task"; kind: PromotionRequestKind; requestId: string }
  | { action: "reject"; kind: PromotionRequestKind; requestId: string; note: string }
  | { action: "delete-request"; kind: PromotionRequestKind; requestId: string }
  | { action: "override-failure" | "release-retake"; attemptId: string }
  | { action: "grade-answer"; answerId: string; correct: boolean }
  | { action: "finalize-attempt"; attemptId: string; passed: boolean; percent: number | null; retakeDays: number }
  | { action: "reset-device"; nicknameKey: string };

export type PromotionSourceStatus = "ok" | "unavailable" | "invalid-source";

export function promotionReviewerSourcePolicy(action: PromotionReviewerCommand["action"], source: PromotionSourceStatus) {
  // Releasing or removing an already stored request does not depend on the current
  // roster row. Keep those recovery actions available while the sheet is offline.
  if (source === "ok" || action === "release" || action === "force-release" || action === "reject" || action === "delete-request") return "allow" as const;
  return "block" as const;
}

export type PromotionCleanupRow = {
  requestId: string;
  kind: PromotionRequestKind;
  status: string;
  nickname: string;
  deleteAt: string;
  due: boolean;
};

export function promotionCleanupPreview(state: unknown, now: Date): PromotionCleanupRow[] {
  if (!state || typeof state !== "object" || Array.isArray(state) || !Number.isFinite(now.getTime())) return [];
  const source = state as Record<string, unknown>;
  const eligible = { ordinary: new Set(["pending", "rejected"]), qualification: new Set(["pending", "rejected", "failed"]) };
  return (["ordinary", "qualification"] as const).flatMap((kind): PromotionCleanupRow[] => {
    const rows = source[kind];
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((item): PromotionCleanupRow[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      if (typeof row.requestId !== "string" || typeof row.nickname !== "string" || typeof row.status !== "string"
        || !eligible[kind].has(row.status) || typeof row.updatedAt !== "string") return [];
      const updated = Date.parse(row.updatedAt);
      if (!Number.isFinite(updated)) return [];
      const deleteAt = new Date(updated + 3 * 24 * 60 * 60 * 1_000).toISOString();
      return [{ requestId: row.requestId, kind, status: row.status, nickname: row.nickname, deleteAt, due: now.getTime() >= Date.parse(deleteAt) }];
    });
  }).slice(0, 100);
}

export function parsePromotionReviewerCommand(value: unknown): PromotionReviewerCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.action !== "string") return null;
  if (requestActions.has(body.action)) {
    if ((body.kind !== "ordinary" && body.kind !== "qualification") || typeof body.requestId !== "string" || !uuidPattern.test(body.requestId)) return null;
    if (body.action === "reject") {
      const note = typeof body.note === "string" ? body.note.trim() : "";
      return note.length <= 2000 ? { action: "reject", kind: body.kind, requestId: body.requestId, note } : null;
    }
    return { action: body.action as "claim" | "release" | "force-release" | "delete-request" | "approve-task", kind: body.kind, requestId: body.requestId };
  }
  if (attemptActions.has(body.action)) {
    return typeof body.attemptId === "string" && uuidPattern.test(body.attemptId)
      ? { action: body.action as "override-failure" | "release-retake", attemptId: body.attemptId }
      : null;
  }
  if (body.action === "grade-answer") {
    return typeof body.answerId === "string" && uuidPattern.test(body.answerId) && typeof body.correct === "boolean"
      ? { action: "grade-answer", answerId: body.answerId, correct: body.correct }
      : null;
  }
  if (body.action === "finalize-attempt") {
    const percent = body.percent === null ? null : body.percent;
    const retakeDays = body.retakeDays ?? 2;
    return typeof body.attemptId === "string" && uuidPattern.test(body.attemptId) && typeof body.passed === "boolean"
      && (percent === null || (Number.isInteger(percent) && (percent as number) >= 0 && (percent as number) <= 100))
      && Number.isInteger(retakeDays) && (retakeDays as number) >= 0 && (retakeDays as number) <= 365
      ? { action: "finalize-attempt", attemptId: body.attemptId, passed: body.passed, percent: percent as number | null, retakeDays: retakeDays as number }
      : null;
  }
  if (body.action === "reset-device") {
    const nicknameKey = typeof body.nicknameKey === "string" ? body.nicknameKey.trim().toLocaleLowerCase("en-US") : "";
    return keyPattern.test(nicknameKey) ? { action: "reset-device", nicknameKey } : null;
  }
  return null;
}

export type TaskPreviewItem = { id: string; text: string; active: boolean; sortOrder: number; updatedAt: string };
export type QuestionType = "single" | "multiple" | "free-text";
export type QualificationPreviewItem = TaskPreviewItem & { type: QuestionType };
type PreviewChoice = { manualIds?: string[]; random?: () => number };

function assertCount(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error("invalid-count");
}

function randomWithoutReplacement<T>(items: readonly T[], count: number, random: () => number) {
  const pool = [...items];
  const selected: T[] = [];
  while (selected.length < count) {
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

export function selectTaskPreview(items: readonly TaskPreviewItem[], required: number, choice: PreviewChoice = {}) {
  assertCount(required);
  const active = items.filter((item) => item.active);
  if (choice.manualIds) {
    if (new Set(choice.manualIds).size !== choice.manualIds.length) throw new Error("duplicate-selection");
    if (choice.manualIds.length !== required) throw new Error("invalid-count");
    const byId = new Map(active.map((item) => [item.id, item]));
    const selected = choice.manualIds.map((id) => byId.get(id));
    if (selected.some((item) => !item)) throw new Error("inactive-selection");
    return selected as TaskPreviewItem[];
  }
  if (active.length < required) throw new Error("insufficient-pool");
  return randomWithoutReplacement(active, required, choice.random ?? Math.random);
}

export type QualificationQuotas = { single: number; multiple: number; freeText: number };

export function taskBankLimitError(required: number, activePool: number, bankExists: boolean) {
  if (!bankExists || required <= activePool) return null;
  return `Нужно ${required}, активно ${activePool}.`;
}

export function qualificationBankLimitError(
  quotas: QualificationQuotas,
  activePools: QualificationQuotas,
  bankExists: boolean,
) {
  if (!bankExists) return null;
  const labels: Record<keyof QualificationQuotas, string> = {
    single: "один вариант",
    multiple: "несколько вариантов",
    freeText: "свободный ответ",
  };
  const shortages = (Object.keys(quotas) as Array<keyof QualificationQuotas>)
    .filter((type) => quotas[type] > activePools[type])
    .map((type) => `${labels[type]} — нужно ${quotas[type]}, активно ${activePools[type]}`);
  return shortages.length ? `Не хватает вопросов: ${shortages.join("; ")}.` : null;
}

export function selectQualificationPreview(items: readonly QualificationPreviewItem[], quotas: QualificationQuotas, choice: PreviewChoice = {}) {
  for (const value of Object.values(quotas)) assertCount(value);
  const expected = quotas.single + quotas.multiple + quotas.freeText;
  const active = items.filter((item) => item.active);
  const requiredFor = (type: QuestionType) => type === "single" ? quotas.single : type === "multiple" ? quotas.multiple : quotas.freeText;
  if (choice.manualIds) {
    if (new Set(choice.manualIds).size !== choice.manualIds.length) throw new Error("duplicate-selection");
    if (choice.manualIds.length !== expected) throw new Error("invalid-count");
    const byId = new Map(active.map((item) => [item.id, item]));
    const selected = choice.manualIds.map((id) => byId.get(id));
    if (selected.some((item) => !item)) throw new Error("inactive-selection");
    for (const type of ["single", "multiple", "free-text"] as const) {
      if (selected.filter((item) => item?.type === type).length !== requiredFor(type)) throw new Error("invalid-quota");
    }
    return selected as QualificationPreviewItem[];
  }
  const random = choice.random ?? Math.random;
  return (["single", "multiple", "free-text"] as const).flatMap((type) => {
    const pool = active.filter((item) => item.type === type);
    const count = requiredFor(type);
    if (pool.length < count) throw new Error("insufficient-pool");
    return randomWithoutReplacement(pool, count, random);
  });
}

export function replacePreviewItem<T extends TaskPreviewItem | QualificationPreviewItem>(
  items: readonly T[],
  priorIds: readonly string[],
  replaceId: string,
  kind: PromotionRequestKind,
  random: () => number = Math.random,
) {
  if (new Set(priorIds).size !== priorIds.length) throw new Error("stale-preview");
  const byId = new Map(items.map((item) => [item.id, item]));
  const prior = priorIds.map((id) => byId.get(id));
  if (prior.some((item) => !item?.active)) throw new Error("stale-preview");
  const old = byId.get(replaceId);
  if (!old || !priorIds.includes(replaceId)) throw new Error("stale-preview");
  const candidates = items.filter((item) => item.active && !priorIds.includes(item.id)
    && (kind === "ordinary" || (item as QualificationPreviewItem).type === (old as QualificationPreviewItem).type));
  if (!candidates.length) throw new Error("insufficient-replacement");
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  const replacement = candidates[index];
  return priorIds.map((id) => id === replaceId ? replacement : byId.get(id)!) as T[];
}

export type QuestionDraft =
  | { type: "single"; text: string; options: string[]; answer: number }
  | { type: "multiple"; text: string; options: string[]; answer: number[] }
  | { type: "free-text"; text: string; answer: string };

function validText(value: unknown, max = 4000) {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max ? value.trim() : null;
}

function optionsOf(value: unknown) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) return null;
  const options = value.map((item) => validText(item, 1000));
  if (options.some((item) => !item) || new Set(options).size !== options.length) return null;
  return options as string[];
}

export function validateQuestionDraft(value: unknown): QuestionDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const text = validText(body.text);
  if (!text) return null;
  if (body.type === "free-text") {
    const answer = validText(body.answer);
    return answer ? { type: "free-text", text, answer } : null;
  }
  const options = optionsOf(body.options);
  if (!options) return null;
  if (body.type === "single") {
    return Number.isInteger(body.answer) && (body.answer as number) >= 0 && (body.answer as number) < options.length
      ? { type: "single", text, options, answer: body.answer as number }
      : null;
  }
  if (body.type === "multiple" && Array.isArray(body.answer) && body.answer.length > 0
    && body.answer.every((index) => Number.isInteger(index) && index >= 0 && index < options.length)
    && new Set(body.answer).size === body.answer.length) {
    return { type: "multiple", text, options, answer: body.answer as number[] };
  }
  return null;
}

export type PromotionBankCommand =
  | { action: "save-task-bank"; targetTitleId: string; requiredCount: number }
  | { action: "save-qualification-bank"; transitionId: string; quotas: QualificationQuotas }
  | { action: "save-task-item"; bankId: string; itemId?: string; text: string; active: boolean; sortOrder: number }
  | { action: "delete-task-item"; bankId: string; itemId: string }
  | { action: "save-question"; bankId: string; questionId?: string; question: QuestionDraft; active: boolean; sortOrder: number }
  | { action: "delete-question"; bankId: string; questionId: string };

const ordinaryTargetIds = new Set(ordinaryPromotionTransitions.map((transition) => transition.targetTitleId));
const qualificationTransitionIds = new Set(qualificationPromotionTransitions.map((transition) => transition.transitionId));

function boundedInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function parsePromotionBankCommand(value: unknown): PromotionBankCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.action === "save-task-bank") {
    return typeof body.targetTitleId === "string" && ordinaryTargetIds.has(body.targetTitleId as never)
      && boundedInteger(body.requiredCount, 1, 50)
      ? { action: body.action, targetTitleId: body.targetTitleId, requiredCount: body.requiredCount }
      : null;
  }
  if (body.action === "save-qualification-bank") {
    const quotas = body.quotas && typeof body.quotas === "object" && !Array.isArray(body.quotas)
      ? body.quotas as Record<string, unknown>
      : null;
    if (!quotas || typeof body.transitionId !== "string" || !qualificationTransitionIds.has(body.transitionId)
      || !boundedInteger(quotas.single, 0, 100) || !boundedInteger(quotas.multiple, 0, 100)
      || !boundedInteger(quotas.freeText, 0, 100)) return null;
    const total = quotas.single + quotas.multiple + quotas.freeText;
    return total >= 1 && total <= 100
      ? { action: body.action, transitionId: body.transitionId, quotas: { single: quotas.single, multiple: quotas.multiple, freeText: quotas.freeText } }
      : null;
  }
  if (body.action === "save-task-item") {
    const text = validText(body.text);
    return uuid(body.bankId) && (body.itemId === undefined || uuid(body.itemId)) && text
      && typeof body.active === "boolean" && boundedInteger(body.sortOrder, 0, 10_000)
      ? { action: body.action, bankId: body.bankId, ...(body.itemId ? { itemId: body.itemId as string } : {}), text, active: body.active, sortOrder: body.sortOrder }
      : null;
  }
  if (body.action === "delete-task-item") {
    return uuid(body.bankId) && uuid(body.itemId) ? { action: body.action, bankId: body.bankId, itemId: body.itemId } : null;
  }
  if (body.action === "save-question") {
    const question = validateQuestionDraft(body.question);
    return uuid(body.bankId) && (body.questionId === undefined || uuid(body.questionId)) && question
      && typeof body.active === "boolean" && boundedInteger(body.sortOrder, 0, 10_000)
      ? { action: body.action, bankId: body.bankId, ...(body.questionId ? { questionId: body.questionId as string } : {}), question, active: body.active, sortOrder: body.sortOrder }
      : null;
  }
  if (body.action === "delete-question") {
    return uuid(body.bankId) && uuid(body.questionId) ? { action: body.action, bankId: body.bankId, questionId: body.questionId } : null;
  }
  return null;
}
