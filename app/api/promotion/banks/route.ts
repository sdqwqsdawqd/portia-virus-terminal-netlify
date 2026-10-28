import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret } from "@/lib/portia-device-binding";
import {
  createPreviewToken,
  parsePromotionBankCommand,
  requirePromotionReviewer,
  selectQualificationPreview,
  selectTaskPreview,
  verifyPreviewToken,
  type QualificationPreviewItem,
  type TaskPreviewItem,
} from "@/lib/portia-promotion-reviewer";
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
  const body = parseJsonObject(await request.text());
  if (!body || typeof body.action !== "string") return Response.json({ error: "Некорректные данные." }, { status: 400, headers: noStoreHeaders });

  if (body.action === "preview" || body.action === "confirm") {
    const kind = body.kind === "ordinary" || body.kind === "qualification" ? body.kind : null;
    const bankId = typeof body.bankId === "string" ? body.bankId : "";
    const state = await bankState(supabase);
    const bank = state && kind ? (kind === "ordinary" ? state.taskBanks : state.qualificationBanks).find((item) => item.id === bankId) : null;
    if (!kind || !bank) return Response.json({ error: "Банк не найден." }, { status: 404, headers: noStoreHeaders });
    const secret = promotionDeviceSecret();
    if (body.action === "preview") {
      try {
        const manualIds = Array.isArray(body.manualIds) && body.manualIds.every((id) => typeof id === "string") ? body.manualIds : undefined;
        const replaceId = typeof body.replaceId === "string" ? body.replaceId : "";
        const priorIds = replaceId && typeof body.preview === "string"
          ? verifyPreviewToken(body.preview, { kind, bankId, version: bank.version, now: Date.now() }, secret)
          : null;
        let items: Array<TaskPreviewItem | QualificationPreviewItem>;
        if (priorIds && priorIds.includes(replaceId)) {
          const old = bank.items.find((item) => item.id === replaceId);
          const candidates = bank.items.filter((item) => item.active && !priorIds.includes(item.id)
            && (kind === "ordinary" || (item as QualificationPreviewItem).type === (old as QualificationPreviewItem | undefined)?.type));
          if (!old || !candidates.length) throw new Error("insufficient-replacement");
          const replacement = candidates[Math.floor(Math.random() * candidates.length)];
          items = priorIds.map((id) => id === replaceId ? replacement : bank.items.find((item) => item.id === id)).filter(Boolean) as Array<TaskPreviewItem | QualificationPreviewItem>;
        } else {
          items = kind === "ordinary"
            ? selectTaskPreview(bank.items as TaskPreviewItem[], bank.requiredCount ?? 0, { manualIds })
            : selectQualificationPreview(bank.items as QualificationPreviewItem[], bank.quotas ?? { single: 0, multiple: 0, freeText: 0 }, { manualIds });
        }
        const expiresAt = Date.now() + 10 * 60 * 1000;
        const preview = createPreviewToken({ kind, bankId, version: bank.version, ids: items.map((item) => item.id), expiresAt }, secret);
        return Response.json({ preview, expiresAt: new Date(expiresAt).toISOString(), items }, { headers: noStoreHeaders });
      } catch (error) {
        return Response.json({ error: error instanceof Error && error.message.includes("insufficient") ? "Недостаточно активных элементов." : "Набор не соответствует настройкам банка." }, { status: 409, headers: noStoreHeaders });
      }
    }
    const token = typeof body.preview === "string" ? body.preview : "";
    const ids = verifyPreviewToken(token, { kind, bankId, version: bank.version, now: Date.now() }, secret);
    if (!ids) return Response.json({ error: "Банк изменился. Соберите набор заново.", code: "stale-preview" }, { status: 409, headers: noStoreHeaders });
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    if (new Set(ids).size !== ids.length) return Response.json({ error: "Набор содержит повторы.", code: "confirm-conflict" }, { status: 409, headers: noStoreHeaders });
    const selected = ids.map((id) => bank.items.find((item) => item.id === id && item.active)).filter(Boolean);
    if (selected.length !== ids.length) return Response.json({ error: "Банк изменился. Соберите набор заново.", code: "stale-preview" }, { status: 409, headers: noStoreHeaders });
    const rpc = kind === "ordinary"
      ? ["portia_promo_confirm_assignment", { p_request_id: requestId, p_bank_id: bankId, p_bank_version: bank.version, p_items: selected.map((item, sortOrder) => ({ source_item_id: item!.id, sort_order: sortOrder })) }]
      : ["portia_promo_confirm_test", { p_request_id: requestId, p_bank_id: bankId, p_bank_version: bank.version, p_questions: selected.map((item, sortOrder) => ({ source_question_id: item!.id, sort_order: sortOrder })) }];
    const { data, error } = await supabase.rpc(rpc[0] as string, rpc[1] as Record<string, unknown>);
    return error || !data
      ? Response.json({ error: "Не удалось подтвердить набор.", code: error?.code === "42883" ? "pending-database" : "confirm-conflict" }, { status: error?.code === "42883" ? 503 : 409, headers: noStoreHeaders })
      : Response.json({ id: data }, { status: 201, headers: noStoreHeaders });
  }

  if (JSON.stringify(body).length > 64 * 1024) return Response.json({ error: "Данные слишком велики." }, { status: 413, headers: noStoreHeaders });
  const command = parsePromotionBankCommand(body);
  if (!command) return Response.json({ error: "Некорректная команда банка." }, { status: 400, headers: noStoreHeaders });
  if ("bankId" in command) {
    const state = await bankState(supabase);
    const banks = command.action.includes("question") ? state?.qualificationBanks : state?.taskBanks;
    const bank = banks?.find((item) => item.id === command.bankId);
    const itemId = "itemId" in command ? command.itemId : "questionId" in command ? command.questionId : undefined;
    if (!bank || (itemId && !bank.items.some((item) => item.id === itemId))) {
      return Response.json({ error: "Банк или элемент банка не найден.", code: "bank-conflict" }, { status: 409, headers: noStoreHeaders });
    }
  }
  const { data, error } = await supabase.rpc("portia_promo_bank_command", { p_action: command.action, p_payload: command });
  return error
    ? Response.json({ error: "Не удалось сохранить банк.", code: error.code === "42883" ? "pending-database" : "bank-write-failed" }, { status: error.code === "42883" ? 503 : 400, headers: noStoreHeaders })
    : Response.json({ id: data, state: await bankState(supabase) }, { headers: noStoreHeaders });
}
