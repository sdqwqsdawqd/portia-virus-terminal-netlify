import { noStoreHeaders } from "@/lib/portia-cdn";
import { findPromotionRosterEntry, loadPromotionRoster } from "@/lib/portia-promotion-sheet";
import { parsePromotionReviewerCommand, requirePromotionReviewer } from "@/lib/portia-promotion-reviewer";
import { parseJsonObject } from "@/lib/request-json";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const denied = (status: "forbidden" | "unavailable") => Response.json(
  status === "forbidden" ? { error: "Вкладка «Повышение» для вас закрыта." } : { error: "Проверка доступа временно недоступна." },
  { status: status === "forbidden" ? 403 : 503, headers: noStoreHeaders },
);

async function reviewerState(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data, error } = await supabase.rpc("portia_promo_reviewer_state");
  return error ? null : data;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const auth = await requirePromotionReviewer(supabase);
  if (auth.status !== "allowed") return denied(auth.status);
  const state = await reviewerState(supabase);
  return state === null
    ? Response.json({ error: "База повышения ещё не обновлена.", code: "pending-database" }, { status: 503, headers: noStoreHeaders })
    : Response.json(state, { headers: noStoreHeaders });
}

async function rosterStillMatches(state: unknown, kind: string, requestId: string) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return "unavailable" as const;
  const rows = (state as Record<string, unknown>)[kind === "ordinary" ? "ordinary" : "qualification"];
  if (!Array.isArray(rows)) return "unavailable" as const;
  const row = rows.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).requestId === requestId) as Record<string, unknown> | undefined;
  if (!row || typeof row.nickname !== "string" || typeof row.titleId !== "string") return "changed" as const;
  const roster = await loadPromotionRoster();
  if (roster.status !== "ok") return "unavailable" as const;
  const entry = findPromotionRosterEntry(roster.roster, row.nickname);
  return entry?.titleId === row.titleId ? "ok" as const : "changed" as const;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await requirePromotionReviewer(supabase);
  if (auth.status !== "allowed") return denied(auth.status);
  const command = parsePromotionReviewerCommand(parseJsonObject(await request.text()));
  if (!command) return Response.json({ error: "Некорректная команда." }, { status: 400, headers: noStoreHeaders });

  if (command.action === "approve-task") {
    const state = await reviewerState(supabase);
    const roster = await rosterStillMatches(state, command.kind, command.requestId);
    if (roster === "unavailable") return Response.json({ error: "Список участников временно недоступен." }, { status: 503, headers: noStoreHeaders });
    if (roster === "changed") return Response.json({ error: "Звание или доступ участника изменились. Обновите запрос." }, { status: 409, headers: noStoreHeaders });
  }

  const rpc = command.action === "claim"
    ? ["portia_promo_claim_request", { p_kind: command.kind, p_request_id: command.requestId }]
    : command.action === "release" || command.action === "force-release"
      ? ["portia_promo_release_request", { p_kind: command.kind, p_request_id: command.requestId, p_force: command.action === "force-release" }]
      : command.action === "reject"
        ? ["portia_promo_reject_request", { p_kind: command.kind, p_request_id: command.requestId, p_internal_note: command.note }]
        : command.action === "approve-task"
          ? ["portia_promo_approve_assignment", { p_request_id: command.requestId }]
          : command.action === "override-failure"
            ? ["portia_promo_override_failure", { p_attempt_id: command.attemptId }]
            : command.action === "release-retake"
              ? ["portia_promo_release_retake", { p_attempt_id: command.attemptId }]
              : command.action === "grade-answer"
                ? ["portia_promo_grade_answer", { p_answer_id: command.answerId, p_correct: command.correct }]
                : command.action === "finalize-attempt"
                  ? ["portia_promo_finalize_attempt", { p_attempt_id: command.attemptId, p_passed: command.passed, p_percent: command.percent, p_retake_days: command.retakeDays }]
                  : ["portia_promo_reset_device", { p_nickname_key: (command as { action: "reset-device"; nicknameKey: string }).nicknameKey }];
  const { data, error } = await supabase.rpc(rpc[0] as string, rpc[1] as Record<string, unknown>);
  if (error) return Response.json({ error: "Команда не выполнена.", code: error.code === "42883" ? "pending-database" : "command-failed" }, { status: error.code === "42883" ? 503 : 403, headers: noStoreHeaders });
  if (data !== true) return Response.json({ error: "Состояние уже изменилось другим проверяющим.", code: "claim-conflict", state: await reviewerState(supabase) }, { status: 409, headers: noStoreHeaders });
  return Response.json({ ok: true, state: await reviewerState(supabase) }, { headers: noStoreHeaders });
}
