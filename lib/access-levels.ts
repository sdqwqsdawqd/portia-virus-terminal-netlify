// Access levels 1..5 (Phase 21, D-03 / D-04 / LVL-01). The single source of level names: no other file may hard-code them.
// SQL pins (lib/access-levels.test.ts): people.level check "between 1 and 5", the decide defaults (sheet 2, outside 1)
// and public.portia_access_caller_level() = 5 for anyone for whom public.portia_can_edit() is true.
//
// Resolution order Phase 23 will use: the editor session first (level 5, full payload), then the portia_access
// cookie via portia_access_resolve.

export const ACCESS_LEVELS = [1, 2, 3, 4, 5] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const MIN_ACCESS_LEVEL = 1;
export const MAX_ACCESS_LEVEL = 5;
export const EDITOR_ACCESS_LEVEL: AccessLevel = 5;

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_ACCESS_LEVEL && value <= MAX_ACCESS_LEVEL;
}

// Phase 24, D-03: the level a record asks of its visitor. No field at all is level 1; an integer 1..5 is itself; anything
// else (a string, 0, 6, 2.5, null) is the highest level, so a damaged value hides the record instead of opening it.
export function requiredLevelOf(raw: unknown): AccessLevel {
  if (raw === undefined) return MIN_ACCESS_LEVEL;
  return isAccessLevel(raw) ? raw : MAX_ACCESS_LEVEL;
}

export function accessLevelLabel(level: AccessLevel): string {
  return `Уровень ${level}`;
}

export const ACCESS_ORIGINS = ["sheet", "outside"] as const;
export type AccessOrigin = (typeof ACCESS_ORIGINS)[number];

export function accessOriginLabel(origin: AccessOrigin): string {
  return origin === "sheet" ? "из таблицы" : "не из таблицы";
}

// D-04 and D-09: every new approval starts here; a revoked person approved again does not get the old level back.
export function defaultApprovalLevel(origin: AccessOrigin): AccessLevel {
  return origin === "sheet" ? 2 : 1;
}

export function effectiveAccessLevel(input: {
  isEditor: boolean;
  isOwner: boolean;
  person: { status: "active" | "revoked"; level: number } | null;
}): AccessLevel | null {
  if (input.isEditor || input.isOwner) return EDITOR_ACCESS_LEVEL;
  const { person } = input;
  if (!person || person.status !== "active") return null;
  return isAccessLevel(person.level) ? person.level : null;
}
