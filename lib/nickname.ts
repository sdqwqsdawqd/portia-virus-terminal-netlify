// Canonical Roblox nickname rule for site access (Phase 21, D-01 / ACC-04).
// The same pattern literal lives in SQL: public.portia_access_nickname_key (evaluated under collate "C").
// lib/access-foundation.test.ts pins the two together. The rule never trims; only parseNicknameInput cleans input.
// Promotion keeps its own 64-character nickname handling in this phase (D-10); lib/portia-employees.ts is not changed.

export const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

export function isValidNickname(value: unknown): value is string {
  return typeof value === "string" && NICKNAME_PATTERN.test(value);
}

// The key is ASCII-only by construction, so toLowerCase equals SQL lower() under collate "C".
export function nicknameKey(value: unknown): string | null {
  return isValidNickname(value) ? value.toLowerCase() : null;
}

// Trimming surrounding whitespace is input clean-up for the future boot form; the rule itself and the SQL never trim.
export function parseNicknameInput(raw: unknown): { nickname: string; key: string } | null {
  if (typeof raw !== "string") return null;
  const nickname = raw.trim();
  const key = nicknameKey(nickname);
  return key === null ? null : { nickname, key };
}

export function sameNickname(a: unknown, b: unknown): boolean {
  const left = nicknameKey(a);
  const right = nicknameKey(b);
  return left !== null && right !== null && left === right;
}
