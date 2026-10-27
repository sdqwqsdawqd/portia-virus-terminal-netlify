import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getEditorAccess, type EditorAccess } from "./editor-access.ts";
import type { PromotionRequestKind } from "./portia-promotion.ts";

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
const requestActions = new Set(["claim", "release", "force-release", "reject", "approve-task"]);
const attemptActions = new Set(["override-failure", "release-retake"]);

export type PromotionReviewerCommand =
  | { action: "claim" | "release" | "force-release" | "approve-task"; kind: PromotionRequestKind; requestId: string }
  | { action: "reject"; kind: PromotionRequestKind; requestId: string; note: string }
  | { action: "override-failure" | "release-retake"; attemptId: string }
  | { action: "reset-device"; nicknameKey: string };

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
    return { action: body.action as "claim" | "release" | "force-release" | "approve-task", kind: body.kind, requestId: body.requestId };
  }
  if (attemptActions.has(body.action)) {
    return typeof body.attemptId === "string" && uuidPattern.test(body.attemptId)
      ? { action: body.action as "override-failure" | "release-retake", attemptId: body.attemptId }
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

type PreviewPayload = { kind: PromotionRequestKind; bankId: string; version: string; ids: string[]; expiresAt: number };
const encode = (value: string) => Buffer.from(value).toString("base64url");
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");

export function createPreviewToken(payload: PreviewPayload, secret: string) {
  if (secret.length < 32) throw new Error("preview-secret-too-short");
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyPreviewToken(
  token: string,
  expected: { kind: PromotionRequestKind; bankId: string; version: string; now: number },
  secret: string,
) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(sign(encoded, secret));
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PreviewPayload;
    if (value.kind !== expected.kind || value.bankId !== expected.bankId || value.version !== expected.version
      || !Array.isArray(value.ids) || !value.ids.every((id) => typeof id === "string") || value.expiresAt < expected.now) return null;
    return value.ids;
  } catch {
    return null;
  }
}
