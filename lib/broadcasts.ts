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
