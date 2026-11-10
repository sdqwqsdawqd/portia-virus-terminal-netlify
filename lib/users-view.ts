import { accessOriginLabel, type AccessOrigin } from "./access-levels.ts";

export function pendingBadgeText(count: number | null): string | null {
  if (count === null || !Number.isInteger(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export function originPlaque(origin: AccessOrigin): string {
  return accessOriginLabel(origin).toUpperCase();
}
