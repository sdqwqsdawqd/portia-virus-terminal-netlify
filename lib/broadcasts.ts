import type { Broadcast } from "./portia-content.ts";

export type BroadcastTab = "news" | "quests";
export type QuestState = "active" | "upcoming" | "finished";

// Tasks are assignments like quests, so they share the quests tab (D-03).
export function broadcastTabOf(type: Broadcast["type"]): BroadcastTab {
  return type === "news" ? "news" : "quests";
}

// Quest state comes from the visitor's local date (D-03); YYYY-MM-DD strings compare as dates.
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Start and end are inclusive; an empty or missing side is ignored, so undated quests are active.
export function questState(item: Partial<Pick<Broadcast, "startsAt" | "endsAt">>, today: string): QuestState {
  if (item.startsAt && today < item.startsAt) return "upcoming";
  if (item.endsAt && today > item.endsAt) return "finished";
  return "active";
}

export function formatQuestDay(day: string): string {
  return day ? day.split("-").reverse().join(".") : "";
}

const stateRank: Record<QuestState, number> = { active: 0, upcoming: 1, finished: 2 };

// Published items of one tab. News: important first. Quests: active, upcoming, finished; tasks count as active.
// Editor order otherwise (sort is stable).
export function broadcastFeed(broadcasts: Broadcast[], tab: BroadcastTab, today: string): Broadcast[] {
  const list = broadcasts.filter((item) => item.published && broadcastTabOf(item.type) === tab);
  if (tab === "news") return list.sort((a, b) => Number(b.important === true) - Number(a.important === true));
  const rank = (item: Broadcast) => (item.type === "quest" ? stateRank[questState(item, today)] : 0);
  return list.sort((a, b) => rank(a) - rank(b));
}

// Seen quest ids come from visitor-editable storage: only an array of strings counts, anything else is "nothing seen".
export function parseSeenQuestIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

const activePublishedQuests = (list: Broadcast[], today: string) => list.filter((item) => item.published && item.type === "quest" && questState(item, today) === "active");

// One window for all unseen active quests: the first in editor order, `more` counts the rest (D-03).
export function questPopup(list: Broadcast[], seen: string[], today: string): { quest: Broadcast; more: number } | null {
  const unseen = activePublishedQuests(list, today).filter((item) => !seen.includes(item.id));
  return unseen.length ? { quest: unseen[0], more: unseen.length - 1 } : null;
}

// Stored ids that still exist in the list plus every active published quest; ids of deleted quests drop out so the list cannot grow forever.
export function markQuestsSeen(list: Broadcast[], seen: string[], today: string): string[] {
  const existing = new Set(list.map((item) => item.id));
  return [...new Set([...seen.filter((id) => existing.has(id)), ...activePublishedQuests(list, today).map((item) => item.id)])];
}
