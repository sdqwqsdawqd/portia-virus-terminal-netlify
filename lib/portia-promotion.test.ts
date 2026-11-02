import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePromotionTitle,
  ordinaryPromotionTransitions,
  promotionAvailabilityText,
  promotionEligibility,
  promotionTitles,
  qualificationPromotionTransitions,
  type PromotionRosterEntry,
} from "./portia-promotion.ts";

const day = 24 * 60 * 60 * 1_000;

test("canonical promotion transitions are derived from the eight-rank ladder", () => {
  assert.equal(ordinaryPromotionTransitions.length, 7);
  assert.deepEqual(ordinaryPromotionTransitions.map((transition) => transition.targetTitleId), promotionTitles.slice(1).map((title) => title.id));
  assert.deepEqual(qualificationPromotionTransitions.map((transition) => [transition.sourceLevel, transition.transitionId]), [
    [2, "laboratory-assistant"], [4, "assistant"], [6, "virologist-specialist"],
  ]);
  assert.equal(ordinaryPromotionTransitions[0].label, "Академик → Стажёр");
});

function rosterEntry(title: string, promotedAt = "2026-10-01T00:00:00.000Z"): PromotionRosterEntry {
  const normalized = normalizePromotionTitle(title);
  assert.ok(normalized, `test title must normalize: ${title}`);
  const current = promotionTitles.find((item) => item.id === normalized);
  assert.ok(current);
  const next = promotionTitles.at(current.level);
  return {
    nickname: "PortiaUser",
    nicknameKey: "portiauser",
    title: current.label,
    titleId: current.id,
    nextTitle: next?.label ?? "",
    nextTitleId: next?.id ?? null,
    antiSpeedrun: "Ожидание",
    promotedAt,
  };
}

test("promotion title ladder normalizes all eight titles and ё/е spelling", () => {
  assert.deepEqual(
    promotionTitles.map(({ level, label, cooldownDays }) => [level, label, cooldownDays]),
    [
      [1, "Академик", 7],
      [2, "Стажёр", 3],
      [3, "Лаборант", 4],
      [4, "Исследователь", 6],
      [5, "Ассистент", 8],
      [6, "Научный сотрудник", 10],
      [7, "Специалист вирусолог", 18],
      [8, "Эксперт вирусолог", null],
    ],
  );
  assert.equal(normalizePromotionTitle("  СТАЖЕР "), "trainee");
  assert.equal(normalizePromotionTitle("Эксперт-вирусолог"), "expert-virologist");
  assert.equal(normalizePromotionTitle("неизвестное звание"), null);
});

test("promotion ordinary cooldowns use Moscow midnight and flip at every exact boundary", () => {
  const cases = [
    ["Академик", 7],
    ["Стажёр", 3],
    ["Лаборант", 4],
    ["Исследователь", 6],
    ["Ассистент", 8],
    ["Научный сотрудник", 10],
  ] as const;
  for (const [title, cooldownDays] of cases) {
    const entry = rosterEntry(title);
    const availableAt = Date.parse(entry.promotedAt) + cooldownDays * day;
    const before = promotionEligibility(entry, { kind: "ordinary", now: new Date(availableAt - 1), qualificationPassed: true });
    assert.equal(before.status, "cooldown", title);
    assert.equal(before.availableAt, new Date(availableAt).toISOString(), title);
    assert.equal(before.copyKey, "promotion.cooldown", title);
    assert.equal(
      promotionEligibility(entry, { kind: "ordinary", now: new Date(availableAt), qualificationPassed: true }).status,
      "eligible",
      title,
    );
  }
});

test("promotion cooldown flips immediately around the true Moscow deadline", () => {
  const entry = rosterEntry("Академик", "2026-09-30T21:00:00.000Z");
  const deadline = Date.parse("2026-10-07T21:00:00.000Z");
  assert.equal(promotionEligibility(entry, { kind: "ordinary", now: new Date(deadline - 1), qualificationPassed: true }).status, "cooldown");
  assert.equal(promotionEligibility(entry, { kind: "ordinary", now: new Date(deadline), qualificationPassed: true }).status, "eligible");
  assert.equal(promotionEligibility(entry, { kind: "ordinary", now: new Date(deadline + 1), qualificationPassed: true }).status, "eligible");
});

test("promotion qualification is available only at titles 2, 4 and 6", () => {
  for (const title of promotionTitles) {
    const result = promotionEligibility(rosterEntry(title.label, "2026-01-01T00:00:00.000Z"), {
      kind: "qualification",
      now: new Date("2026-10-27T00:00:00.000Z"),
    });
    assert.equal(result.status, [2, 4, 6].includes(title.level) ? "eligible" : "qualification-required", title.label);
  }
});

test("promotion ordinary request at a rank ceiling requires a passed qualification", () => {
  for (const title of ["Стажёр", "Исследователь", "Научный сотрудник"]) {
    const entry = rosterEntry(title, "2026-01-01T00:00:00.000Z");
    assert.equal(
      promotionEligibility(entry, { kind: "ordinary", now: new Date("2026-10-27T00:00:00.000Z") }).status,
      "qualification-required",
      title,
    );
    assert.equal(
      promotionEligibility(entry, { kind: "ordinary", now: new Date("2026-10-27T00:00:00.000Z"), qualificationPassed: true }).status,
      "eligible",
      title,
    );
  }
});

test("promotion to Expert Virologist is represented as a special task after 18 days", () => {
  const entry = rosterEntry("Специалист вирусолог");
  const before = promotionEligibility(entry, { kind: "ordinary", now: new Date("2026-10-18T23:59:59.999Z") });
  assert.equal(before.status, "cooldown");
  const ready = promotionEligibility(entry, { kind: "ordinary", now: new Date("2026-10-19T00:00:00.000Z") });
  assert.equal(ready.status, "special-task");
  assert.equal(ready.copyKey, "promotion.specialTask");
});

test("promotion blocks another assignment until the sheet title changes", () => {
  const result = promotionEligibility(rosterEntry("Лаборант", "2026-01-01T00:00:00.000Z"), {
    kind: "ordinary",
    now: new Date("2026-10-27T00:00:00.000Z"),
    awaitingTitleId: "laboratory-assistant",
  });
  assert.equal(result.status, "awaiting-sheet-change");
  assert.equal(result.copyKey, "promotion.awaitingSheetChange");
});

test("promotion returns a safe not-listed state without inventing roster data", () => {
  assert.deepEqual(
    promotionEligibility(null, { kind: "ordinary", now: new Date("2026-10-27T00:00:00.000Z") }),
    { status: "not-listed", copyKey: "promotion.notListed" },
  );
});

test("availability text shows a device-time date and time without dots, gaps or Invalid Date", () => {
  const now = new Date("2026-11-02T00:00:00.000Z");
  const text = promotionAvailabilityText("2026-11-05T09:30:00Z", now);
  assert.match(text ?? "", /^Следующая заявка будет доступна \d{2}\.\d{2}\.\d{4} в \d{2}:\d{2}$/);
  for (const bad of ["..", "Invalid", " в  ", "МСК"]) assert.ok(!text!.includes(bad), bad);
  const at = new Date("2026-11-05T09:30:00Z");
  const date = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(at);
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  assert.equal(text, `Следующая заявка будет доступна ${date} в ${time}`);
});

test("availability text is null for missing, invalid or already-passed dates", () => {
  const now = new Date("2026-11-02T00:00:00.000Z");
  for (const value of [undefined, "", "abc"]) assert.equal(promotionAvailabilityText(value, now), null);
  assert.equal(promotionAvailabilityText("2026-11-02T00:00:00.000Z", now), null);
  assert.equal(promotionAvailabilityText("2026-11-01T23:59:59.999Z", now), null);
  assert.ok(promotionAvailabilityText("2026-11-02T00:00:00.001Z", now));
});
