import { portiaTextKey, type PortiaContent, type Virus } from "./portia-content.ts";

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

// Mutations have no id and their formatting is keyed by position, so a delete moves each later key down one place instead of leaving it on the next mutation.
export function removeMutation(content: PortiaContent, virus: Virus, index: number): void {
  const count = virus.mutations.length;
  virus.mutations.splice(index, 1);
  for (let position = index; position < count; position += 1) {
    const following = content.formattedText[portiaTextKey.mutation(virus.id, position + 1)];
    if (following) content.formattedText[portiaTextKey.mutation(virus.id, position)] = following;
    else delete content.formattedText[portiaTextKey.mutation(virus.id, position)];
  }
}
