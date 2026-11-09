// RED stub (21-01 Task 2): exports exist with deliberately wrong behaviour so the tests fail on their assertions.
// Replaced by the real implementation in the GREEN commit.

export type AccessLevel = 1 | 2 | 3 | 4 | 5;
export type AccessOrigin = "sheet" | "outside";

export const ACCESS_LEVELS: readonly AccessLevel[] = [];
export const MIN_ACCESS_LEVEL = 0;
export const MAX_ACCESS_LEVEL = 0;
export const EDITOR_ACCESS_LEVEL = 0;
export const ACCESS_ORIGINS: readonly AccessOrigin[] = [];

export function isAccessLevel(_value: unknown): _value is AccessLevel {
  return false;
}

export function accessLevelLabel(_level: AccessLevel): string {
  return "";
}

export function accessOriginLabel(_origin: AccessOrigin): string {
  return "";
}

export function defaultApprovalLevel(_origin: AccessOrigin): AccessLevel {
  return 3;
}

export function effectiveAccessLevel(_input: {
  isEditor: boolean;
  isOwner: boolean;
  person: { status: "active" | "revoked"; level: number } | null;
}): AccessLevel | null {
  return null;
}
