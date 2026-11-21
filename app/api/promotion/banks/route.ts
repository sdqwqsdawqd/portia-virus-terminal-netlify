import { isDeepStrictEqual } from "node:util";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret } from "@/lib/portia-device-binding";
import {
  parsePromotionBankCommand,
  replacePreviewItem,
  requirePromotionReviewer,
  selectQualificationPreview,
  selectTaskPreview,
  type QualificationPreviewItem,
  type TaskPreviewItem,
} from "@/lib/portia-promotion-reviewer";
import { qualificationPromotionTransitions } from "@/lib/portia-promotion";
import { createPreviewToken, verifyPreviewToken } from "@/lib/portia-promotion-preview-token";
import { pickAutoQualificationSet, qualificationSetMessages, qualificationSetProblem, qualificationTestQuotas } from "@/lib/portia-qualification-builder";
import { qualificationRulesSaveFailure, qualificationRulesText } from "@/lib/portia-qualification-rules";
import { bankBodyTooLarge, parseManualIds } from "@/lib/promotion-bank-request";
import { parseJsonObject } from "@/lib/request-json";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Bank = { id: string; targetTitleId?: string; transitionId?: string; version: string; requiredCount?: number; quotas?: { single: number; multiple: number; freeText: number }; items: Array<TaskPreviewItem | QualificationPreviewItem> };
type BankState = { taskBanks: Bank[]; qualificationBanks: Bank[] };

const denied = (status: "forbidden" | "unavailable") => Response.json(
  { error: status === "forbidden" ? "Вкладка «Повышение» для вас закрыта." : "Проверка доступа временно недоступна." },
  { status: status === "forbidden" ? 403 : 503, headers: noStoreHeaders },
);

async function bankState(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data, error } = await supabase.rpc("portia_promo_bank_state");
  return error || !data || typeof data !== "object" ? null : data as BankState;
}

// OWN-08 (owner 2026-11-20): a set outside 1..100 is its own answer (422 with its own code), never the «bank changed» conflict.
const setProblemResponse = (problem: "empty" | "too-large") => {
  const message = problem === "empty" ? qualificationSetMessages.empty : qualificationSetMessages.tooLarge;
  return Response.json({ error: message.text, code: message.code }, { status: 422, headers: noStoreHeaders });
};

// CR-01 (26.1 review): the sync below moves the bank version on the server. Every answer that follows a sync carries the authoritative bank state,
// so the client never keeps the old version and hides the next preview without a word.
async function stateField(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<{ state?: BankState }> {
  const reloaded = await bankState(supabase);
  return reloaded ? { state: reloaded } : {};
}

// WR-01 (26.1 review, mitigation without SQL): the stored counts are written before portia_promo_confirm_test looks at the request, so the request
// is checked first through the reviewer state: it must be a qualification request of this transition, claimed by the caller.
// The full fix (counts written inside the confirm transaction) needs a migration and stays owner-run on the isolated test branch.
async function qualificationRequestOwnership(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, requestId: string, transitionId: string | undefined): Promise<"owned" | "not-owned" | "unavailable"> {
  const { data, error } = await supabase.rpc("portia_promo_reviewer_state");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return "unavailable";
  const rows = (data as Record<string, unknown>).qualification;
  if (!Array.isArray(rows)) return "unavailable";
  const row = rows.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).requestId === requestId) as Record<string, unknown> | undefined;
  return row && row.assignedToMe === true && row.status === "claimed" && transitionId !== undefined && row.targetTitleId === transitionId ? "owned" : "not-owned";
}

type SyncFailure = "stale" | "changed" | "program" | "pending-database";

// OWN-08 (owner 2026-11-20): quotas are gone from the editor; the stored counts only satisfy portia_promo_confirm_test (the set must be as long as their sum),
// so they follow the set being confirmed. Called only after the token, the activity of every id, the size of the set (1..100) and the ownership of the request were checked.
async function syncQualificationCounts(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, bank: Bank, ids: readonly string[]): Promise<{ bank: Bank } | { failure: SyncFailure }> {
  const wanted = qualificationTestQuotas(bank.items as QualificationPreviewItem[], ids);
  const stored = bank.quotas;
  if (stored && stored.single === wanted.single && stored.multiple === wanted.multiple && stored.freeText === wanted.freeText) return { bank };
  const command = parsePromotionBankCommand({ action: "save-qualification-bank", transitionId: bank.transitionId, quotas: wanted });
  if (!command) return { failure: "program" };
  const { error } = await supabase.rpc("portia_promo_bank_command", { p_action: command.action, p_payload: command });
  if (error) return { failure: error.code === "42883" ? "pending-database" : "stale" };
  const reloaded = await bankState(supabase);
  const fresh = reloaded?.qualificationBanks.find((item) => item.id === bank.id);
  // The version moved with the counts: the confirmation below uses the reloaded bank, and every id must still be an active question of it.
  if (!fresh || !ids.every((id) => fresh.items.some((item) => item.id === id && item.active))) return { failure: "stale" };
  // WR-02 (26.1 review): the token was verified against the bank read before the sync. The reloaded bank carries a new version, so the token cannot vouch for it:
  // a question edited by someone else in between would be frozen into the test unseen. The chosen questions must be exactly what the preview showed.
  const unchanged = ids.every((id) => isDeepStrictEqual(bank.items.find((item) => item.id === id), fresh.items.find((item) => item.id === id)));
  return unchanged ? { bank: fresh } : { failure: "changed" };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const auth = await requirePromotionReviewer(supabase);
  if (auth.status !== "allowed") return denied(auth.status);
  const state = await bankState(supabase);
  return state ? Response.json(state, { headers: noStoreHeaders }) : Response.json({ error: "База повышения ещё не обновлена.", code: "pending-database" }, { status: 503, headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await requirePromotionReviewer(supabase);
  if (auth.status !== "allowed") return denied(auth.status);
  // 26.1-17 L1: the size is checked on the raw text, before the JSON is parsed, for every action (preview and confirm included).
  const text = await request.text();
  if (bankBodyTooLarge(text)) return Response.json({ error: "Данные слишком велики." }, { status: 413, headers: noStoreHeaders });
  const body = parseJsonObject(text);
  if (!body || typeof body.action !== "string") return Response.json({ error: "Некорректные данные." }, { status: 400, headers: noStoreHeaders });

  if (body.action === "preview" || body.action === "confirm") {
    const kind = body.kind === "ordinary" || body.kind === "qualification" ? body.kind : null;
    const bankId = typeof body.bankId === "string" ? body.bankId : "";
    const state = await bankState(supabase);
    const bank = state && kind ? (kind === "ordinary" ? state.taskBanks : state.qualificationBanks).find((item) => item.id === bankId) : null;
    if (!kind || !bank) return Response.json({ error: "Банк не найден." }, { status: 404, headers: noStoreHeaders });
    const secret = promotionDeviceSecret();
    if (body.action === "preview") {
      // 26.1-17 L1: the selection is bounded (at most 100 ids of 64 characters; replaceId of 64 characters) before anything is looked up.
      const manualIds = parseManualIds(body.manualIds);
      const replaceId = typeof body.replaceId === "string" ? body.replaceId : "";
      if (manualIds === "invalid" || replaceId.length > 64) return Response.json({ error: "Некорректный выбор вопросов.", code: "invalid-selection" }, { status: 400, headers: noStoreHeaders });
      try {
        const priorIds = replaceId && typeof body.preview === "string"
          ? verifyPreviewToken(body.preview, { kind, bankId, version: bank.version, now: Date.now() }, secret)
          : null;
        let items: Array<TaskPreviewItem | QualificationPreviewItem>;
        if (priorIds && priorIds.includes(replaceId)) {
          items = replacePreviewItem(bank.items, priorIds, replaceId, kind);
        } else if (kind === "ordinary") {
          items = selectTaskPreview(bank.items as TaskPreviewItem[], bank.requiredCount ?? 0, { manualIds });
        } else {
          // The set is every active question (or the marked ones); the bank quotas are not used here.
          const questions = bank.items as QualificationPreviewItem[];
          const picked = manualIds ?? pickAutoQualificationSet(questions, Math.random);
          const problem = qualificationSetProblem(picked.length);
          if (problem) return setProblemResponse(problem);
          items = selectQualificationPreview(questions, qualificationTestQuotas(questions, picked), { manualIds: picked });
        }
        const expiresAt = Date.now() + 10 * 60 * 1000;
        const preview = createPreviewToken({ kind, bankId, version: bank.version, ids: items.map((item) => item.id), expiresAt }, secret);
        return Response.json({ preview, expiresAt: new Date(expiresAt).toISOString(), version: bank.version, items, activeCount: bank.items.filter((item) => item.active).length }, { headers: noStoreHeaders });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        if (reason === "stale-preview") return Response.json({ error: "Банк изменился. Соберите набор заново.", code: "stale-preview" }, { status: 409, headers: noStoreHeaders });
        return Response.json({ error: reason.includes("insufficient") ? "Недостаточно активных элементов." : "Набор не соответствует настройкам банка." }, { status: 409, headers: noStoreHeaders });
      }
    }
    const token = typeof body.preview === "string" ? body.preview : "";
    const ids = verifyPreviewToken(token, { kind, bankId, version: bank.version, now: Date.now() }, secret);
    if (!ids) return Response.json({ error: "Банк изменился. Соберите набор заново.", code: "stale-preview" }, { status: 409, headers: noStoreHeaders });
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    if (new Set(ids).size !== ids.length) return Response.json({ error: "Набор содержит повторы.", code: "confirm-conflict" }, { status: 409, headers: noStoreHeaders });
    const selected = ids.map((id) => bank.items.find((item) => item.id === id && item.active)).filter(Boolean);
    if (selected.length !== ids.length) return Response.json({ error: "Банк изменился. Соберите набор заново.", code: "stale-preview" }, { status: 409, headers: noStoreHeaders });
    let confirmBank = bank;
    if (kind === "qualification") {
      const problem = qualificationSetProblem(ids.length);
      if (problem) return setProblemResponse(problem);
      const ownership = await qualificationRequestOwnership(supabase, requestId, bank.transitionId);
      if (ownership === "unavailable") return Response.json({ error: "База повышения ещё не обновлена.", code: "pending-database" }, { status: 503, headers: noStoreHeaders });
      if (ownership === "not-owned") return Response.json({ error: "Не удалось подтвердить набор.", code: "confirm-conflict" }, { status: 409, headers: noStoreHeaders });
      const synced = await syncQualificationCounts(supabase, bank, ids);
      if ("failure" in synced) {
        if (synced.failure === "program") return Response.json({ error: "Не удалось подтвердить набор.", code: "confirm-failed" }, { status: 500, headers: noStoreHeaders });
        // The counts may already be written: the answer carries the bank as the server has it now.
        const fresh = await stateField(supabase);
        if (synced.failure === "pending-database") return Response.json({ error: "Не удалось подтвердить набор.", code: "pending-database", ...fresh }, { status: 503, headers: noStoreHeaders });
        return synced.failure === "changed"
          ? Response.json({ error: "Вопросы набора изменились после предпросмотра. Соберите набор заново.", code: "stale-preview", ...fresh }, { status: 409, headers: noStoreHeaders })
          : Response.json({ error: "Банк изменился. Соберите набор заново.", code: "stale-preview", ...fresh }, { status: 409, headers: noStoreHeaders });
      }
      confirmBank = synced.bank;
    }
    const rpc = kind === "ordinary"
      ? ["portia_promo_confirm_assignment", { p_request_id: requestId, p_bank_id: bankId, p_bank_version: bank.version, p_items: selected.map((item, sortOrder) => ({ source_item_id: item!.id, sort_order: sortOrder })) }]
      : ["portia_promo_confirm_test", { p_request_id: requestId, p_bank_id: bankId, p_bank_version: confirmBank.version, p_questions: selected.map((item, sortOrder) => ({ source_question_id: item!.id, sort_order: sortOrder })) }];
    const { data, error } = await supabase.rpc(rpc[0] as string, rpc[1] as Record<string, unknown>);
    // CR-01: a qualification confirm may have moved the bank version (the counts sync), success or not, so the authoritative state goes back with the answer.
    const afterConfirm = kind === "qualification" ? await stateField(supabase) : {};
    return error || !data
      ? Response.json({ error: "Не удалось подтвердить набор.", code: error?.code === "42883" ? "pending-database" : "confirm-conflict", ...afterConfirm }, { status: error?.code === "42883" ? 503 : 409, headers: noStoreHeaders })
      : Response.json({ id: data, ...afterConfirm }, { status: 201, headers: noStoreHeaders });
  }

  // Rules text of a transition (quick 261117-px5). Not part of the frozen question set: the bank version, and so an open preview, stay valid.
  if (body.action === "save-qualification-rules") {
    const transitionId = typeof body.transitionId === "string" && qualificationPromotionTransitions.some((item) => item.transitionId === body.transitionId) ? body.transitionId : "";
    if (!transitionId) return Response.json({ error: "Некорректный переход.", code: "invalid-transition" }, { status: 400, headers: noStoreHeaders });
    const rulesText = qualificationRulesText(body.rulesText);
    if (rulesText === null) return Response.json({ error: "Правила длиннее 4000 символов.", code: "invalid-rules" }, { status: 400, headers: noStoreHeaders });
    const { data, error } = await supabase.rpc("portia_promo_save_qualification_rules", { p_transition_id: transitionId, p_rules_text: rulesText });
    if (error) {
      const failure = qualificationRulesSaveFailure(error.code);
      return Response.json({ error: failure.error, code: failure.code }, { status: failure.status, headers: noStoreHeaders });
    }
    if (!data) return Response.json({ error: "Сначала добавьте вопрос.", code: "bank-missing" }, { status: 409, headers: noStoreHeaders });
    const reloaded = await bankState(supabase);
    return reloaded
      ? Response.json({ id: data, state: reloaded }, { headers: noStoreHeaders })
      : Response.json({ error: "Изменение принято, но подтверждённое состояние пока недоступно. Обновите банки.", code: "authoritative-state-unavailable" }, { status: 503, headers: noStoreHeaders });
  }
  const command = parsePromotionBankCommand(body);
  if (!command) return Response.json({ error: "Некорректная команда банка." }, { status: 400, headers: noStoreHeaders });
  let state: BankState | null = null;
  if (command.action === "save-task-bank" || command.action === "save-qualification-bank" || "bankId" in command) {
    state = await bankState(supabase);
    if (!state) return Response.json({ error: "Не удалось проверить текущее состояние банка.", code: "authoritative-state-unavailable" }, { status: 503, headers: noStoreHeaders });
  }
  // A bank can be configured before its pool is filled. Pool sufficiency is
  // enforced when building the exact preview, not while saving the draft quota.
  if ("bankId" in command) {
    const banks = command.action.includes("question") ? state?.qualificationBanks : state?.taskBanks;
    const bank = banks?.find((item) => item.id === command.bankId);
    const itemId = "itemId" in command ? command.itemId : "questionId" in command ? command.questionId : undefined;
    if (!bank || (itemId && !bank.items.some((item) => item.id === itemId))) {
      return Response.json({ error: "Банк или элемент банка не найден.", code: "bank-conflict" }, { status: 409, headers: noStoreHeaders });
    }
  }
  const { data, error } = await supabase.rpc("portia_promo_bank_command", { p_action: command.action, p_payload: command });
  if (error) return Response.json({ error: "Не удалось сохранить банк.", code: error.code === "42883" ? "pending-database" : "bank-write-failed" }, { status: error.code === "42883" ? 503 : 400, headers: noStoreHeaders });
  const authoritativeState = await bankState(supabase);
  return authoritativeState
    ? Response.json({ id: data, state: authoritativeState }, { headers: noStoreHeaders })
    : Response.json({ error: "Изменение принято, но подтверждённое состояние пока недоступно. Обновите банки.", code: "authoritative-state-unavailable" }, { status: 503, headers: noStoreHeaders });
}
