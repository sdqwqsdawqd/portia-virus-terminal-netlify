/** Question builder model and the plain composition of the test (quick 261117-px5, OWN-08: quotas removed). Pure; the reviewer module stays untouched. */
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

// OWN-08 (owner 2026-11-20): the editor has no quotas. The test is every active question of the bank, or the marked ones.

/** The limit of portia_promo_confirm_test (1..100 questions) and of the bank counts (each 0..100, sum 1..100). */
export const QUALIFICATION_TEST_MAX = 100;

type PoolItem = { id?: string; type?: BuilderType; active: boolean; sortOrder?: number };

/** Counts by type of the active questions, or of the active questions among the marked `ids`; no type means free text, like the editor. */
export function qualificationTestQuotas(items: readonly PoolItem[], ids?: readonly string[]): QualificationQuotas {
  const marked = ids ? new Set(ids) : null;
  const counts: QualificationQuotas = { single: 0, multiple: 0, freeText: 0 };
  for (const item of items) {
    if (!item.active || (marked && !(item.id !== undefined && marked.has(item.id)))) continue;
    const type = item.type ?? "free-text";
    if (type === "single") counts.single += 1;
    else if (type === "multiple") counts.multiple += 1;
    else counts.freeText += 1;
  }
  return counts;
}

// 1, 21, 31 ... «свободный» / «вопрос»; 2-4 «вопроса»; every other count the plural.
const freeTextWord = (count: number) => (count % 10 === 1 && count % 100 !== 11 ? "свободный" : "свободных");
const questionWord = (count: number) => {
  if (count % 10 === 1 && count % 100 !== 11) return "вопрос";
  return count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "вопроса" : "вопросов";
};

/** One plain line: how many questions the test has and of which types; asks for a question when there is none. */
export function qualificationTestSummary(pools: QualificationQuotas): string {
  const total = pools.single + pools.multiple + pools.freeText;
  if (total < 1) return "Добавьте хотя бы один активный вопрос.";
  const parts = [
    pools.single > 0 ? `${pools.single} с одним ответом` : "",
    pools.multiple > 0 ? `${pools.multiple} с несколькими` : "",
    pools.freeText > 0 ? `${pools.freeText} ${freeTextWord(pools.freeText)}` : "",
  ].filter(Boolean).join(" · ");
  return `В тесте: ${total} ${questionWord(total)} (${parts})`;
}

/** Every active question in random order; more than QUALIFICATION_TEST_MAX gives a random QUALIFICATION_TEST_MAX of them. The same `random` gives the same set. */
export function pickAutoQualificationSet(items: readonly (PoolItem & { id: string })[], random: () => number): string[] {
  const pool = items.filter((item) => item.active).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let at = pool.length - 1; at > 0; at -= 1) {
    const other = Math.min(at, Math.max(0, Math.floor(random() * (at + 1))));
    [pool[at], pool[other]] = [pool[other], pool[at]];
  }
  return pool.slice(0, QUALIFICATION_TEST_MAX).map((item) => item.id);
}

/** Why a set of this size cannot be confirmed; null from 1 to QUALIFICATION_TEST_MAX. */
export function qualificationSetProblem(count: number): "empty" | "too-large" | null {
  if (count < 1) return "empty";
  return count > QUALIFICATION_TEST_MAX ? "too-large" : null;
}

/** Texts and codes of a set outside the limit: an honest answer, never the «bank changed» conflict. */
export const qualificationSetMessages = {
  empty: { code: "empty-set", text: "В наборе нет активных вопросов. Включите или добавьте вопрос." },
  tooLarge: { code: "set-too-large", text: "В наборе больше 100 вопросов. Уберите лишние." },
  capped: (activeCount: number) => `В тесте ${QUALIFICATION_TEST_MAX} из ${activeCount} активных вопросов (предел ${QUALIFICATION_TEST_MAX})`,
} as const;
