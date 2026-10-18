import type { Broadcast } from "./portia-content.ts";

export type BroadcastTab = "news" | "quests";

// Tasks are assignments like quests, so they share the quests tab (D-03).
export function broadcastTabOf(type: Broadcast["type"]): BroadcastTab {
  return type === "news" ? "news" : "quests";
}

// Published items of one tab; important news first, otherwise editor order (sort is stable).
export function broadcastFeed(broadcasts: Broadcast[], tab: BroadcastTab): Broadcast[] {
  return broadcasts
    .filter((item) => item.published && broadcastTabOf(item.type) === tab)
    .sort((a, b) => Number(b.important === true) - Number(a.important === true));
}
