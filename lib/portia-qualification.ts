export type QualificationQuestion = {
  id: string;
  type: "single" | "multiple" | "free-text";
  text: string;
  options: string[];
  answerKey: unknown;
};

export type QualificationAnswer = { questionId: string; nonce: string; value: unknown; reviewerCorrect?: boolean };
export type QualificationClientMode = "desktop" | "phone";
export const QUALIFICATION_HEARTBEAT_MS = 15_000;

/** Only explicit mobile evidence enables the phone exception; unknown signals fail closed as desktop. */
export function conservativeQualificationClientMode(headers: Headers): QualificationClientMode {
  if (headers.get("sec-ch-ua-mobile") === "?1") return "phone";
  return /Android|iPhone|iPad|iPod/i.test(headers.get("user-agent") ?? "") ? "phone" : "desktop";
}
export type QualificationAttempt = {
  id: string;
  status: "prepared" | "active" | "submitted" | "auto-failed" | "reviewed";
  clientMode: QualificationClientMode;
  questions: QualificationQuestion[];
  answers: QualificationAnswer[];
  startedAt: string | null;
  deadlineAt: string | null;
  technicalFailure: "timeout" | "hidden" | "blur" | "page-exit" | "offline" | null;
  finalDecision: "passed" | "failed" | null;
};

export type QualificationEvent =
  | { type: "start"; clientMode: QualificationClientMode }
  | { type: "answer"; questionId: string; answer: unknown; nonce: string }
  | { type: "technical-failure"; reason: NonNullable<QualificationAttempt["technicalFailure"]> }
  | { type: "review"; decision: "passed" | "failed" };

const fifteenMinutes = 15 * 60 * 1000;

export function validateQualificationAnswer(question: QualificationQuestion, answer: unknown) {
  if (question.type === "single") return Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) < question.options.length;
  if (question.type === "multiple") return Array.isArray(answer) && answer.length > 0
    && answer.every((index) => Number.isInteger(index) && index >= 0 && index < question.options.length)
    && new Set(answer).size === answer.length;
  return typeof answer === "string" && answer.trim().length > 0 && answer.trim().length <= 4000;
}

function autoFail(state: QualificationAttempt, reason: NonNullable<QualificationAttempt["technicalFailure"]>): QualificationAttempt {
  if (state.status === "auto-failed") return state;
  if (state.status !== "active") return state;
  return { ...state, status: "auto-failed", technicalFailure: reason };
}

export function qualificationTransition(state: QualificationAttempt, event: QualificationEvent, now: Date): QualificationAttempt {
  if (!Number.isFinite(now.getTime())) throw new TypeError("A valid server time is required.");
  if (event.type === "start") {
    if (state.status !== "prepared") return state;
    return { ...state, status: "active", clientMode: event.clientMode, startedAt: now.toISOString(), deadlineAt: new Date(now.getTime() + fifteenMinutes).toISOString() };
  }
  if (event.type === "technical-failure") return autoFail(state, event.reason);
  if (event.type === "review") {
    if (state.status !== "submitted" && state.status !== "auto-failed") return state;
    return { ...state, status: "reviewed", finalDecision: event.decision };
  }
  if (state.status !== "active") return state;
  if (!state.deadlineAt || now.getTime() >= Date.parse(state.deadlineAt)) return autoFail(state, "timeout");
  const duplicate = state.answers.find((answer) => answer.nonce === event.nonce);
  if (duplicate) return state;
  const question = state.questions[state.answers.length];
  if (!question || question.id !== event.questionId) throw new Error("out-of-order-question");
  if (!validateQualificationAnswer(question, event.answer)) throw new Error("invalid-answer");
  const answers = [...state.answers, { questionId: question.id, nonce: event.nonce, value: event.answer }];
  return { ...state, answers, status: answers.length === state.questions.length ? "submitted" : "active" };
}

export function qualificationPublicProjection(state: QualificationAttempt, now: Date) {
  const deadlineAt = state.deadlineAt;
  const expired = state.status === "active" && (!deadlineAt || now.getTime() >= Date.parse(deadlineAt));
  const status = expired ? "failed" : state.status === "auto-failed" ? "failed" : state.status;
  const question = state.status === "active" && !expired ? state.questions[state.answers.length] : undefined;
  return {
    attemptId: state.id,
    status,
    clientMode: state.clientMode,
    deadlineAt,
    question: question ? { id: question.id, type: question.type, text: question.text, options: [...question.options], index: state.answers.length, total: state.questions.length } : null,
    ...(state.status === "reviewed" ? { result: state.finalDecision } : {}),
  };
}

export function qualificationGrade(
  questions: readonly QualificationQuestion[],
  answers: readonly QualificationAnswer[],
  marks: Record<string, boolean>,
) {
  const byAnswer = new Map(answers.map((answer) => [answer.questionId, answer]));
  const items = questions.map((question) => ({ questionId: question.id, answer: byAnswer.get(question.id)?.value, correct: marks[question.id] === true }));
  const percent = items.length ? Math.round(items.filter((item) => item.correct).length / items.length * 100) : 0;
  return { items, percent };
}
