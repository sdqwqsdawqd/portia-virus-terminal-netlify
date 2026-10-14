import { portiaTextKey, type PortiaContent } from "./portia-content.ts";

// A post added at the top, a delete or a reorder shifts every index that a handler or the open format panel captured (uat-03-owner-broadcast-duplicates).
export function updateById<T extends { id: string }>(items: T[], id: string, update: (item: T) => void): void {
  const item = items.find((candidate) => candidate.id === id);
  if (item) update(item);
}

// A deleted item takes its stored formatting with it, so no orphan text stays in formattedText.
export function removeBroadcast(content: PortiaContent, id: string): void {
  content.broadcasts = content.broadcasts.filter((item) => item.id !== id);
  delete content.formattedText[portiaTextKey.broadcast(id)];
}

export function removeInfoSection(content: PortiaContent, id: string): void {
  content.infoSections = content.infoSections.filter((item) => item.id !== id);
  delete content.formattedText[portiaTextKey.info(id)];
}
