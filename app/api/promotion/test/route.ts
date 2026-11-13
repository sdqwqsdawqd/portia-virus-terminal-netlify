import { noStoreHeaders } from "@/lib/portia-cdn";
import { deviceTokenDigest, promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { conservativeQualificationClientMode, validateQualificationAnswer, type QualificationQuestion } from "@/lib/portia-qualification";
import { findPromotionRosterEntry, loadPromotionRoster } from "@/lib/portia-promotion-sheet";
import { parseLimitedJsonObject } from "@/lib/request-json";
import { promotionParticipantResponse, resolvePromotionParticipant, type PromotionParticipant } from "@/lib/promotion-participant";
import { signPromotionTest, type PromotionTestAction } from "@/lib/access-identity";
import { accessSubmitSecret } from "@/lib/access-session";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const failures = new Set(["hidden", "blur", "page-exit", "offline"]);
type Approved = Extract<PromotionParticipant, { status: "approved" }>;

function proof(participant: Approved, attemptId: string, tokenHash: string, action: PromotionTestAction) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return { p_access_hash: participant.accessHash, p_attempt_id: attemptId, p_token_hash: tokenHash,
    p_issued_at: issuedAt, p_signature: signPromotionTest({ accessHash: participant.accessHash, attemptId, tokenHash, action, issuedAt }, accessSubmitSecret()) };
}

function safeProjection(value: Record<string, unknown>) {
  const question = value.question && typeof value.question === "object" && !Array.isArray(value.question) ? value.question as Record<string, unknown> : null;
  return {
    attemptId: value.attemptId,
    status: value.status,
    deadlineAt: value.deadlineAt ?? null,
    clientMode: value.clientMode,
    ...(value.terminalReason === "timeout" || value.terminalReason === "technical" ? { terminalReason: value.terminalReason } : {}),
    question: question ? { id: question.id, type: question.type, text: question.text, options: Array.isArray(question.options) ? question.options.filter((item) => typeof item === "string") : [], index: question.index, total: question.total } : null,
    ...(typeof value.result === "string" ? { result: value.result } : {}),
    ...(Number.isInteger(value.percent) ? { percent: value.percent } : {}),
  };
}

async function current(participant: Approved, attemptId: string, tokenHash: string, mode: "desktop" | "phone") {
  const roster = await loadPromotionRoster();
  if (roster.status !== "ok") return { unavailable: true } as const;
  const entry = findPromotionRosterEntry(roster.roster, participant.nickname);
  if (!entry) return { removed: true } as const;
  const { data, error } = await participant.client.rpc("portia_promo_secure_current_test", {
    ...proof(participant, attemptId, tokenHash, "current"), p_client_mode: mode,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.nickname !== participant.nickname || row.titleId !== entry.titleId) return { removed: true } as const;
  return { row, supabase: participant.client };
}

export async function GET(request: Request) {
  const participant = await resolvePromotionParticipant(request.headers);
  if (participant.status !== "approved") return promotionParticipantResponse(participant);
  const attemptId = new URL(request.url).searchParams.get("attemptId") ?? "";
  const token = readDeviceToken(request.headers);
  if (!uuid.test(attemptId) || !token) return Response.json({ error: "Проверка недоступна." }, { status: 403, headers: noStoreHeaders });
  const state = await current(participant, attemptId, deviceTokenDigest(token, promotionDeviceSecret()), conservativeQualificationClientMode(request.headers));
  if (!state) return Response.json({ error: "Проверка не найдена." }, { status: 404, headers: noStoreHeaders });
  if ("unavailable" in state) return Response.json({ error: "Список участников временно недоступен." }, { status: 503, headers: noStoreHeaders });
  if ("removed" in state) return Response.json({ error: "Доступ к проверке прекращён." }, { status: 403, headers: noStoreHeaders });
  return Response.json(safeProjection(state.row), { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const participant = await resolvePromotionParticipant(request.headers);
  if (participant.status !== "approved") return promotionParticipantResponse(participant);
  const body = await parseLimitedJsonObject(request, 8192);
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
  const token = readDeviceToken(request.headers);
  if (!body || !uuid.test(attemptId) || !token) return Response.json({ error: "Некорректные данные." }, { status: 400, headers: noStoreHeaders });
  const tokenHash = deviceTokenDigest(token, promotionDeviceSecret());
  const mode = conservativeQualificationClientMode(request.headers);
  if (body.action === "start") {
    const roster = await loadPromotionRoster();
    if (roster.status !== "ok") return Response.json({ code: "sheet-unavailable" }, { status: 503, headers: noStoreHeaders });
    if (!findPromotionRosterEntry(roster.roster, participant.nickname)) return Response.json({ code: "not-listed" }, { status: 403, headers: noStoreHeaders });
    const { data, error } = await participant.client.rpc("portia_promo_secure_start_test", { ...proof(participant, attemptId, tokenHash, "start"), p_client_mode: mode });
    if (error) return Response.json({ error: "Проверка временно недоступна.", code: "test-unavailable" }, { status: 503, headers: noStoreHeaders });
    if (!data) return Response.json({ code: "test-inactive" }, { status: 403, headers: noStoreHeaders });
    const started = await current(participant, attemptId, tokenHash, mode);
    return started && !("unavailable" in started) && !("removed" in started)
      ? Response.json(safeProjection(started.row), { headers: noStoreHeaders })
      : Response.json({ error: "Проверка недоступна.", code: "test-inactive" }, { status: 409, headers: noStoreHeaders });
  }
  const state = await current(participant, attemptId, tokenHash, mode);
  if (!state || "unavailable" in state || "removed" in state) return Response.json({ error: "Проверка недоступна." }, { status: state && "unavailable" in state ? 503 : 403, headers: noStoreHeaders });
  if (body.action === "heartbeat") {
    const { data, error } = await state.supabase.rpc("portia_promo_secure_heartbeat_test", proof(participant, attemptId, tokenHash, "heartbeat"));
    if (error || !data || data.code === "inactive") return Response.json({ error: "Связь с проверкой потеряна.", code: "heartbeat-failed" }, { status: 503, headers: noStoreHeaders });
  } else if (body.action === "failure") {
    const reason = typeof body.reason === "string" && failures.has(body.reason) ? body.reason : "";
    if (!reason || (state.row.clientMode === "phone" && reason !== "offline")) return Response.json({ error: "Некорректный сигнал." }, { status: 400, headers: noStoreHeaders });
    const failed = await state.supabase.rpc("portia_promo_secure_fail_attempt", { ...proof(participant, attemptId, tokenHash, "fail"), p_reason: reason });
    if (failed.error || failed.data !== true) return Response.json({ code: "test-unavailable" }, { status: 503, headers: noStoreHeaders });
  } else if (body.action === "answer") {
    const question = state.row.question as Record<string, unknown> | null;
    const nonce = typeof body.nonce === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(body.nonce) ? body.nonce : "";
    const expectedQuestionIndex = Number.isInteger(body.expectedQuestionIndex) && (body.expectedQuestionIndex as number) >= 0 ? body.expectedQuestionIndex as number : -1;
    const publicQuestion: QualificationQuestion | null = question && typeof question.id === "string" && (question.type === "single" || question.type === "multiple" || question.type === "free-text")
      ? { id: question.id, type: question.type, text: String(question.text ?? ""), options: Array.isArray(question.options) ? question.options as string[] : [], answerKey: null } : null;
    if (!publicQuestion || !nonce || expectedQuestionIndex !== question?.index || !validateQualificationAnswer(publicQuestion, body.answer)) return Response.json({ error: "Некорректный ответ." }, { status: 400, headers: noStoreHeaders });
    const { data, error } = await state.supabase.rpc("portia_promo_secure_answer_question", {
      ...proof(participant, attemptId, tokenHash, "answer"), p_question_id: publicQuestion.id, p_expected_question_index: expectedQuestionIndex,
      p_answer: body.answer, p_nonce: nonce, p_token_hash: tokenHash,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return Response.json({ error: "Состояние временно недоступно.", code: "test-unavailable" }, { status: 503, headers: noStoreHeaders });
    if (data.code === "conflict") {
      const authoritative = await current(participant, attemptId, tokenHash, mode);
      return authoritative && !("unavailable" in authoritative) && !("removed" in authoritative)
        ? Response.json({ ...safeProjection(authoritative.row), code: "answer-conflict" }, { status: 409, headers: noStoreHeaders })
        : Response.json({ error: "Состояние изменилось.", code: "answer-conflict" }, { status: 409, headers: noStoreHeaders });
    }
    if (data.code !== "accepted") return Response.json({ error: "Ответ не принят: попытка завершена.", code: "attempt-expired" }, { status: 409, headers: noStoreHeaders });
  } else return Response.json({ error: "Неизвестная команда." }, { status: 400, headers: noStoreHeaders });
  const refreshed = await current(participant, attemptId, tokenHash, mode);
  return refreshed && !("unavailable" in refreshed) && !("removed" in refreshed)
    ? Response.json(safeProjection(refreshed.row), { headers: noStoreHeaders })
    : Response.json({ error: "Состояние временно недоступно." }, { status: 503, headers: noStoreHeaders });
}
