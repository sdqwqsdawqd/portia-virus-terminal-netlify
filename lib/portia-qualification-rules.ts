/** Rules text of a qualification transition and the fixed pre-start lines (quick 261117-px5). Pure, no imports. */

export const QUALIFICATION_RULES_MAX_LENGTH = 4000;

/** Strings only; CRLF to LF; trimmed. An empty string is a valid "no rules" value, a too-long one is refused (null). */
export function qualificationRulesText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").trim();
  return text.length > QUALIFICATION_RULES_MAX_LENGTH ? null : text;
}

export type QualificationPreStartLine = { id: "timer" | "questions" | "answers" | "desktop" | "phone" | "timeout"; text: string; current: boolean };

/**
 * The fixed lines the site always shows before the candidate starts. They restate the supervision the code enforces today
 * and nothing more: PC loses focus -> failed attempt, phone loses connection -> ended attempt, timeout -> handed to the reviewer.
 */
export function qualificationPreStartLines({ clientMode, questionCount }: { clientMode: "desktop" | "phone" | null; questionCount: number | null }): QualificationPreStartLine[] {
  const known = typeof questionCount === "number" && Number.isInteger(questionCount) && questionCount >= 0;
  return [
    { id: "timer", text: "На проверку даётся 15 минут. Время пойдёт, когда вы нажмёте «НАЧАТЬ ПРОВЕРКУ».", current: false },
    { id: "questions", text: known ? `Вопросов: ${questionCount}. Они показываются по одному.` : "Вопросы показываются по одному.", current: false },
    { id: "answers", text: "Отправленный ответ изменить нельзя, к прошлым вопросам вернуться нельзя.", current: false },
    { id: "desktop", text: "ПК: уход со вкладки или из окна сразу завершает попытку как проваленную.", current: clientMode === "desktop" },
    { id: "phone", text: "Телефон: переключаться между приложениями можно, но потеря связи завершает попытку.", current: clientMode === "phone" },
    { id: "timeout", text: "Когда время выйдет, попытка завершится и будет передана проверяющему.", current: false },
  ];
}

/** The rules write needs the new migration; its absence is a refusal, never a crash of bank saving. */
export function qualificationRulesSaveFailure(code: string | undefined): { status: number; code: string; error: string } {
  if (code === "42883" || code === "PGRST202" || code === "42703") {
    return { status: 503, code: "pending-database", error: "Правила не сохранены: база ещё не обновлена (миграция ждёт владельца). Квоты и вопросы сохраняются как обычно." };
  }
  return { status: 400, code: "rules-write-failed", error: "Не удалось сохранить правила." };
}
