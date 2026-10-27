import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret } from "@/lib/portia-device-binding";
import {
  createPreviewToken,
  requirePromotionReviewer,
  selectQualificationPreview,
  selectTaskPreview,
  validateQuestionDraft,
  verifyPreviewToken,
  type QualificationPreviewItem,
  type TaskPreviewItem,
} from "@/lib/portia-promotion-reviewer";
import { parseJsonObject } from "@/lib/request-json";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Bank = { id: string; version: string; requiredCount?: number; quotas?: { single: number; multiple: number; freeText: number }; items: Array<TaskPreviewItem | QualificationPreviewItem> };
type BankState = { taskBanks: Bank[]; qualificationBanks: Bank[] };
const mutationActions = new Set(["save-task-bank", "save-task-item", "delete-task-item", "save-qualification-bank", "save-question", "delete-question"]);

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
        const items = kind === "ordinary"
          ? selectTaskPreview(bank.items as TaskPreviewItem[], bank.requiredCount ?? 0, { manualIds })
          : selectQualificationPreview(bank.items as QualificationPreviewItem[], bank.quotas ?? { single: 0, multiple: 0, freeText: 0 }, { manualIds });
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
    const selected = ids.map((id) => bank.items.find((item) => item.id === id)).filter(Boolean);
    const rpc = kind === "ordinary"
      ? ["portia_promo_confirm_assignment", { p_request_id: requestId, p_items: selected.map((item, sortOrder) => ({ source_item_id: item!.id, snapshot_text: item!.text, sort_order: sortOrder })) }]
      : ["portia_promo_confirm_test", { p_request_id: requestId, p_questions: selected.map((item, sortOrder) => {
        const question = item as QualificationPreviewItem & { options?: Array<{ text: string }>; answerKey?: unknown };
        return {
          source_question_id: question.id,
          question_type: question.type,
          snapshot_text: question.text,
          snapshot_options: (question.options ?? []).map((option) => option.text),
          answer_key: question.answerKey,
          sort_order: sortOrder,
        };
      }), p_client_mode: "desktop" }];
    const { data, error } = await supabase.rpc(rpc[0] as string, rpc[1] as Record<string, unknown>);
    return error || !data
      ? Response.json({ error: "Не удалось подтвердить набор.", code: error?.code === "42883" ? "pending-database" : "confirm-conflict" }, { status: error?.code === "42883" ? 503 : 409, headers: noStoreHeaders })
      : Response.json({ id: data }, { status: 201, headers: noStoreHeaders });
  }

  if (!mutationActions.has(body.action)) return Response.json({ error: "Неизвестная команда банка." }, { status: 400, headers: noStoreHeaders });
  if (body.action === "save-question" && !validateQuestionDraft(body.question)) return Response.json({ error: "Некорректный вопрос или ответ." }, { status: 400, headers: noStoreHeaders });
  if (JSON.stringify(body).length > 64 * 1024) return Response.json({ error: "Данные слишком велики." }, { status: 413, headers: noStoreHeaders });
  const { data, error } = await supabase.rpc("portia_promo_bank_command", { p_action: body.action, p_payload: body });
  return error
    ? Response.json({ error: "Не удалось сохранить банк.", code: error.code === "42883" ? "pending-database" : "bank-write-failed" }, { status: error.code === "42883" ? 503 : 400, headers: noStoreHeaders })
    : Response.json({ id: data, state: await bankState(supabase) }, { headers: noStoreHeaders });
}
