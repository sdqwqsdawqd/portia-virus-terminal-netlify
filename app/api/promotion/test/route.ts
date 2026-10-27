import { noStoreHeaders } from "@/lib/portia-cdn";
import { deviceTokenDigest, promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { validateQualificationAnswer, type QualificationQuestion } from "@/lib/portia-qualification";
import { findPromotionRosterEntry, loadPromotionRoster } from "@/lib/portia-promotion-sheet";
import { parseJsonObject } from "@/lib/request-json";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const failures = new Set(["hidden", "blur", "page-exit", "offline"]);

function safeProjection(value: Record<string, unknown>) {
  const question = value.question && typeof value.question === "object" && !Array.isArray(value.question) ? value.question as Record<string, unknown> : null;
  return {
    attemptId: value.attemptId,
    status: value.status,
    deadlineAt: value.deadlineAt ?? null,
    clientMode: value.clientMode,
    question: question ? { id: question.id, type: question.type, text: question.text, options: Array.isArray(question.options) ? question.options.filter((item) => typeof item === "string") : [], index: question.index, total: question.total } : null,
    ...(typeof value.result === "string" ? { result: value.result } : {}),
    ...(Number.isInteger(value.percent) ? { percent: value.percent } : {}),
  };
}

function clientMode(headers: Headers) {
  return /Android|iPhone|iPad|Mobile/i.test(headers.get("user-agent") ?? "") ? "phone" : "desktop";
}

async function current(attemptId: string, tokenHash: string, mode: "desktop" | "phone") {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("portia_promo_current_test", { p_attempt_id: attemptId, p_token_hash: tokenHash, p_client_mode: mode });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.nickname !== "string" || typeof row.titleId !== "string") return null;
  const roster = await loadPromotionRoster();
  if (roster.status !== "ok") return { unavailable: true } as const;
  const entry = findPromotionRosterEntry(roster.roster, row.nickname);
  if (!entry || entry.titleId !== row.titleId) return { removed: true } as const;
  return { row, supabase };
}

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get("attemptId") ?? "";
  const token = readDeviceToken(request.headers);
  if (!uuid.test(attemptId) || !token) return Response.json({ error: "Проверка недоступна." }, { status: 403, headers: noStoreHeaders });
  const state = await current(attemptId, deviceTokenDigest(token, promotionDeviceSecret()), clientMode(request.headers));
  if (!state) return Response.json({ error: "Проверка не найдена." }, { status: 404, headers: noStoreHeaders });
  if ("unavailable" in state) return Response.json({ error: "Список участников временно недоступен." }, { status: 503, headers: noStoreHeaders });
  if ("removed" in state) return Response.json({ error: "Доступ к проверке прекращён." }, { status: 403, headers: noStoreHeaders });
  return Response.json(safeProjection(state.row), { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const body = parseJsonObject(await request.text());
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const token = readDeviceToken(request.headers);
  if (!body || !uuid.test(attemptId) || !token) return Response.json({ error: "Некорректные данные." }, { status: 400, headers: noStoreHeaders });
  const tokenHash = deviceTokenDigest(token, promotionDeviceSecret());
  const mode = clientMode(request.headers);
  const state = await current(attemptId, tokenHash, mode);
  if (!state || "unavailable" in state || "removed" in state) return Response.json({ error: "Проверка недоступна." }, { status: state && "unavailable" in state ? 503 : 403, headers: noStoreHeaders });
  if (body.action === "start") return Response.json(safeProjection(state.row), { headers: noStoreHeaders });
  if (body.action === "failure") {
    const reason = typeof body.reason === "string" && failures.has(body.reason) ? body.reason : "";
    if (!reason || (state.row.clientMode === "phone" && reason !== "offline")) return Response.json({ error: "Некорректный сигнал." }, { status: 400, headers: noStoreHeaders });
    await state.supabase.rpc("portia_promo_fail_attempt", { p_attempt_id: attemptId, p_reason: reason, p_token_hash: tokenHash });
  } else if (body.action === "answer") {
    const question = state.row.question as Record<string, unknown> | null;
    const nonce = typeof body.nonce === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(body.nonce) ? body.nonce : "";
    const publicQuestion: QualificationQuestion | null = question && typeof question.id === "string" && (question.type === "single" || question.type === "multiple" || question.type === "free-text")
      ? { id: question.id, type: question.type, text: String(question.text ?? ""), options: Array.isArray(question.options) ? question.options as string[] : [], answerKey: null } : null;
    if (!publicQuestion || !nonce || !validateQualificationAnswer(publicQuestion, body.answer)) return Response.json({ error: "Некорректный ответ." }, { status: 400, headers: noStoreHeaders });
    const { data } = await state.supabase.rpc("portia_promo_answer_question", { p_attempt_id: attemptId, p_question_id: publicQuestion.id, p_answer: body.answer, p_nonce: nonce, p_token_hash: tokenHash });
    if (data !== true) return Response.json({ error: "Ответ не принят: время истекло или состояние изменилось." }, { status: 409, headers: noStoreHeaders });
  } else return Response.json({ error: "Неизвестная команда." }, { status: 400, headers: noStoreHeaders });
  const refreshed = await current(attemptId, tokenHash, mode);
  return refreshed && !("unavailable" in refreshed) && !("removed" in refreshed)
    ? Response.json(safeProjection(refreshed.row), { headers: noStoreHeaders })
    : Response.json({ error: "Состояние временно недоступно." }, { status: 503, headers: noStoreHeaders });
}
