export const promotionTitles = [
  { id: "academic", level: 1, label: "Академик", cooldownDays: 7 },
  { id: "trainee", level: 2, label: "Стажёр", cooldownDays: 3 },
  { id: "laboratory-assistant", level: 3, label: "Лаборант", cooldownDays: 4 },
  { id: "researcher", level: 4, label: "Исследователь", cooldownDays: 6 },
  { id: "assistant", level: 5, label: "Ассистент", cooldownDays: 8 },
  { id: "scientist", level: 6, label: "Научный сотрудник", cooldownDays: 10 },
  { id: "virologist-specialist", level: 7, label: "Специалист вирусолог", cooldownDays: 18 },
  { id: "expert-virologist", level: 8, label: "Эксперт вирусолог", cooldownDays: null },
] as const;

export type PromotionTitle = (typeof promotionTitles)[number];
export type PromotionTitleId = PromotionTitle["id"];
export type PromotionRequestKind = "ordinary" | "qualification";

export const ordinaryPromotionTransitions = promotionTitles.slice(0, -1).map((source, index) => {
  const target = promotionTitles[index + 1];
  return {
    sourceTitleId: source.id,
    targetTitleId: target.id,
    sourceLevel: source.level,
    label: `${source.label} → ${target.label}`,
  };
}) as ReadonlyArray<{
  sourceTitleId: PromotionTitleId;
  targetTitleId: PromotionTitleId;
  sourceLevel: number;
  label: string;
}>;

export const qualificationPromotionTransitions = ordinaryPromotionTransitions
  .filter((transition) => [2, 4, 6].includes(transition.sourceLevel))
  .map((transition) => ({
    ...transition,
    transitionId: transition.targetTitleId,
  })) as ReadonlyArray<(typeof ordinaryPromotionTransitions)[number] & { transitionId: string }>;

export type PromotionRosterEntry = {
  nickname: string;
  nicknameKey: string;
  title: string;
  titleId: PromotionTitleId;
  nextTitle: string;
  nextTitleId: PromotionTitleId | null;
  /** Human-readable sheet formula/status from column D. Never accepted as a timestamp. */
  antiSpeedrun: string;
  /** Normalized server-readable timestamp from column E. */
  promotedAt: string;
};

export type PromotionEligibility =
  | { status: "eligible"; copyKey: "promotion.eligible"; kind: PromotionRequestKind; targetTitleId: PromotionTitleId | null }
  | { status: "cooldown"; copyKey: "promotion.cooldown"; availableAt: string; remainingMs: number }
  | { status: "qualification-required"; copyKey: "promotion.qualificationRequired" }
  | { status: "awaiting-sheet-change"; copyKey: "promotion.awaitingSheetChange" }
  | { status: "special-task"; copyKey: "promotion.specialTask"; targetTitleId: "expert-virologist" }
  | { status: "not-listed"; copyKey: "promotion.notListed" };

const qualificationLevels = new Set([2, 4, 6]);
const millisecondsPerDay = 24 * 60 * 60 * 1_000;

function titleKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[‐‑‒–—-]+/g, " ")
    .replace(/\s+/g, " ");
}

const titlesByKey = new Map<string, PromotionTitleId>(promotionTitles.map((title) => [titleKey(title.label), title.id]));
const titlesById = new Map<PromotionTitleId, PromotionTitle>(promotionTitles.map((title) => [title.id, title]));

/** Converts the sheet spelling to one canonical title id. Unknown values fail closed. */
export function normalizePromotionTitle(value: string): PromotionTitleId | null {
  return titlesByKey.get(titleKey(value)) ?? null;
}

export function promotionTitle(id: PromotionTitleId) {
  return titlesById.get(id)!;
}

export type PromotionEligibilityOptions = {
  kind: PromotionRequestKind;
  /** Must be supplied by server code. The helper never reads the device clock. */
  now: Date;
  qualificationPassed?: boolean;
  /** Title recorded when the previous assignment was approved. */
  awaitingTitleId?: PromotionTitleId | null;
};

/** Pure server-side decision over one currently listed sheet row. */
export function promotionEligibility(
  entry: PromotionRosterEntry | null,
  options: PromotionEligibilityOptions,
): PromotionEligibility {
  if (!entry) return { status: "not-listed", copyKey: "promotion.notListed" };
  if (!Number.isFinite(options.now.getTime())) throw new TypeError("A valid server timestamp is required.");

  if (options.awaitingTitleId && options.awaitingTitleId === entry.titleId) {
    return { status: "awaiting-sheet-change", copyKey: "promotion.awaitingSheetChange" };
  }

  const title = promotionTitle(entry.titleId);
  const promotedAt = Date.parse(entry.promotedAt);
  if (!Number.isFinite(promotedAt)) throw new TypeError("Promotion roster date must be normalized before eligibility.");
  if (title.cooldownDays !== null) {
    const availableAtMs = promotedAt + title.cooldownDays * millisecondsPerDay;
    if (options.now.getTime() < availableAtMs) {
      return {
        status: "cooldown",
        copyKey: "promotion.cooldown",
        availableAt: new Date(availableAtMs).toISOString(),
        remainingMs: availableAtMs - options.now.getTime(),
      };
    }
  }

  const isQualificationLevel = qualificationLevels.has(title.level);
  if (options.kind === "qualification") {
    if (!isQualificationLevel) return { status: "qualification-required", copyKey: "promotion.qualificationRequired" };
    return { status: "eligible", copyKey: "promotion.eligible", kind: options.kind, targetTitleId: entry.nextTitleId };
  }

  if (isQualificationLevel && !options.qualificationPassed) {
    return { status: "qualification-required", copyKey: "promotion.qualificationRequired" };
  }
  if (entry.titleId === "virologist-specialist") {
    return { status: "special-task", copyKey: "promotion.specialTask", targetTitleId: "expert-virologist" };
  }
  if (entry.titleId === "expert-virologist") {
    return { status: "awaiting-sheet-change", copyKey: "promotion.awaitingSheetChange" };
  }
  return { status: "eligible", copyKey: "promotion.eligible", kind: options.kind, targetTitleId: entry.nextTitleId };
}
