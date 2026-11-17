/** Question builder model and the one-line quota summary (quick 261117-px5). Pure; the reviewer module stays untouched. */
import { validateQuestionDraft, type QualificationQuotas, type QuestionDraft } from "./portia-promotion-reviewer.ts";

export const QUALIFICATION_OPTION_MIN = 2;
export const QUALIFICATION_OPTION_MAX = 8;

export type BuilderType = "single" | "multiple" | "free-text";
export type BuilderOption = { text: string; correct: boolean };
export type BuilderDraft = { type: BuilderType; text: string; options: BuilderOption[]; sample: string };
type BuilderItem = { type?: BuilderType; text: string; options?: Array<{ text: string }> | string[]; answerKey?: unknown };

const blankRow = (): BuilderOption => ({ text: "", correct: false });

export function emptyBuilderDraft(): BuilderDraft {
  return { type: "single", text: "", options: Array.from({ length: QUALIFICATION_OPTION_MIN }, blankRow), sample: "" };
}

export function draftFromItem(item: BuilderItem): BuilderDraft {
  const type: BuilderType = item.type ?? "free-text";
  const texts = (item.options ?? []).map((option) => (typeof option === "string" ? option : option.text));
  if (type === "free-text") return { ...emptyBuilderDraft(), type, text: item.text, sample: String(item.answerKey ?? "") };
  const marked = new Set<number>(Array.isArray(item.answerKey) ? item.answerKey.map(Number) : [Number(item.answerKey ?? 0)]);
  const options = texts.map((text, index) => ({ text, correct: marked.has(index) }));
  while (options.length < QUALIFICATION_OPTION_MIN) options.push(blankRow());
  return { type, text: item.text, options, sample: "" };
}

export function switchDraftType(draft: BuilderDraft, type: BuilderType): BuilderDraft {
  if (type !== "single") return { ...draft, type };
  const first = draft.options.findIndex((option) => option.correct);
  return { ...draft, type, options: draft.options.map((option, index) => ({ ...option, correct: index === first })) };
}

export function toggleOptionCorrect(draft: BuilderDraft, index: number): BuilderDraft {
  return {
    ...draft,
    options: draft.options.map((option, at) => draft.type === "single"
      ? { ...option, correct: at === index }
      : at === index ? { ...option, correct: !option.correct } : option),
  };
}

export function setOptionText(draft: BuilderDraft, index: number, text: string): BuilderDraft {
  return { ...draft, options: draft.options.map((option, at) => (at === index ? { ...option, text } : option)) };
}

export function addOptionRow(draft: BuilderDraft): BuilderDraft {
  return draft.options.length >= QUALIFICATION_OPTION_MAX ? draft : { ...draft, options: [...draft.options, blankRow()] };
}

export function removeOptionRow(draft: BuilderDraft, index: number): BuilderDraft {
  return draft.options.length <= QUALIFICATION_OPTION_MIN ? draft : { ...draft, options: draft.options.filter((_, at) => at !== index) };
}

/** Why the draft cannot be saved, in words; null when it can. */
export function builderDraftError(draft: BuilderDraft): string | null {
  if (!draft.text.trim()) return "Напишите текст вопроса.";
  if (draft.type === "free-text") return draft.sample.trim() ? null : "Напишите образец ответа для проверяющего.";
  if (draft.options.length < QUALIFICATION_OPTION_MIN || draft.options.length > QUALIFICATION_OPTION_MAX) return "Нужно от 2 до 8 вариантов.";
  const empty = draft.options.findIndex((option) => !option.text.trim());
  if (empty >= 0) return `Заполните или удалите пустой вариант ${empty + 1}.`;
  const texts = draft.options.map((option) => option.text.trim());
  if (new Set(texts).size !== texts.length) return "Варианты не должны повторяться.";
  const marked = draft.options.filter((option) => option.correct).length;
  if (draft.type === "single" && marked !== 1) return "Отметьте правильный вариант.";
  if (draft.type === "multiple" && marked < 1) return "Отметьте хотя бы один правильный вариант.";
  return null;
}

/** The payload for the save-question command; null while the draft has an error or the server validator would refuse it. */
export function builderDraftPayload(draft: BuilderDraft): QuestionDraft | null {
  if (builderDraftError(draft)) return null;
  const text = draft.text;
  if (draft.type === "free-text") return validateQuestionDraft({ type: "free-text", text, answer: draft.sample });
  const options = draft.options.map((option) => option.text);
  const marked = draft.options.flatMap((option, index) => (option.correct ? [index] : []));
  return validateQuestionDraft({ type: draft.type, text, options, answer: draft.type === "single" ? marked[0] : marked });
}

// 1, 21, 31 ... «свободный»; every other count «свободных».
const freeTextWord = (count: number) => (count % 10 === 1 && count % 100 !== 11 ? "свободный" : "свободных");

/** One plain line: what a test of these quotas contains and whether the active pool of the bank covers it. */
export function qualificationQuotaSummary(quotas: QualificationQuotas, pools: QualificationQuotas, bankExists: boolean): { ok: boolean; text: string } {
  const total = quotas.single + quotas.multiple + quotas.freeText;
  if (total < 1) return { ok: false, text: "В тесте нет вопросов — задайте хотя бы один." };
  const compose = (single: number, multiple: number, freeText: number, separator: string) => [
    single > 0 ? `${single} с одним ответом` : "",
    multiple > 0 ? `${multiple} с несколькими` : "",
    freeText > 0 ? `${freeText} ${freeTextWord(freeText)}` : "",
  ].filter(Boolean).join(separator);
  const prefix = `В тесте: ${compose(quotas.single, quotas.multiple, quotas.freeText, " · ")}`;
  if (!bankExists) return { ok: true, text: `${prefix} — банк ещё не создан: сохраните квоты, затем добавьте вопросы.` };
  const missing = {
    single: Math.max(0, quotas.single - pools.single),
    multiple: Math.max(0, quotas.multiple - pools.multiple),
    freeText: Math.max(0, quotas.freeText - pools.freeText),
  };
  if (missing.single + missing.multiple + missing.freeText > 0) {
    return { ok: false, text: `${prefix} — не хватает активных: ${compose(missing.single, missing.multiple, missing.freeText, ", ")}` };
  }
  return { ok: true, text: `${prefix} — в банке хватает ✓` };
}
