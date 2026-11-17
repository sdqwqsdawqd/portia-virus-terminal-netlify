// Here, "staff table" means only the Google Sheet access roster loaded by
// loadPromotionAccessRoster. Manually entered employees are intentionally not counted (research A1).

import { nicknameKey } from "./nickname.ts";
import { loadPromotionAccessRoster, type PromotionAccessResult } from "./portia-promotion-sheet.ts";

export type UsersRoster = { status: "ok"; keys: ReadonlySet<string> } | { status: "degraded" };
export type UsersRosterLoad = () => Promise<PromotionAccessResult>;

let cachedRoster: { load: UsersRosterLoad; at: number; keys: ReadonlySet<string> } | null = null;

export function resetUsersRosterCache() {
  cachedRoster = null;
}

export async function loadUsersRoster({
  load = loadPromotionAccessRoster,
  now = () => new Date(),
  ttlMs = 20_000,
}: {
  load?: UsersRosterLoad;
  now?: () => Date;
  ttlMs?: number;
} = {}): Promise<UsersRoster> {
  const at = now().getTime();
  if (ttlMs > 0 && cachedRoster?.load === load && at - cachedRoster.at < ttlMs) {
    return { status: "ok", keys: cachedRoster.keys };
  }
  try {
    const source = await load();
    if (source.status !== "ok") return { status: "degraded" };
    const keys = new Set<string>();
    for (const entry of source.roster) {
      const key = nicknameKey(entry.nickname);
      if (key !== null) keys.add(key);
    }
    cachedRoster = { load, at, keys };
    return { status: "ok", keys };
  } catch {
    return { status: "degraded" };
  }
}

export function tableMarkFor(key: string, roster: UsersRoster): "yes" | "no" | "unknown" {
  if (roster.status === "degraded") return "unknown";
  return roster.keys.has(key) ? "yes" : "no";
}
