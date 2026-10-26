import { portiaTextKey, type Broadcast, type PortiaContent, type Virus } from "./portia-content.ts";

// A post added at the top, a delete or a reorder shifts every index that a handler or the open format panel captured (uat-03-owner-broadcast-duplicates).
export function updateById<T extends { id: string }>(items: T[], id: string, update: (item: T) => void): void {
  const item = items.find((candidate) => candidate.id === id);
  if (item) update(item);
}

// New items go to the top, blank, in the editor list and in the reader feed (G-03.2-2a).
export function addBroadcast(content: PortiaContent, id: string, type: Broadcast["type"]): void {
  content.broadcasts.unshift({ id, type, title: "", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" });
}

// A deleted item takes its stored formatting with it, so no orphan text stays in formattedText.
export function removeBroadcast(content: PortiaContent, id: string): void {
  content.broadcasts = content.broadcasts.filter((item) => item.id !== id);
  delete content.formattedText[portiaTextKey.broadcast(id)];
}

// The trailing colon keeps "ab" from matching the formatting of "abc".
export function removeRecycledVirus(content: PortiaContent, id: string): void {
  content.recycledViruses = content.recycledViruses.filter((virus) => virus.id !== id);
  for (const key of Object.keys(content.formattedText)) if (key.startsWith(`virus:${id}:`)) delete content.formattedText[key];
}

export function removeRecycleFile(content: PortiaContent, id: string): void {
  content.recycleFiles = content.recycleFiles.filter((file) => file.id !== id);
  delete content.formattedText[portiaTextKey.recycle(id)];
}

export function removeInfoSection(content: PortiaContent, id: string): void {
  const section = content.infoSections.find((item) => item.id === id);
  content.infoSections = content.infoSections.filter((item) => item.id !== id);
  delete content.formattedText[portiaTextKey.info(id)];
  for (const sub of section?.subsections ?? []) for (const block of sub.blocks) delete content.formattedText[portiaTextKey.infoBlock(block.id)];
}

export function removeInfoSubsection(content: PortiaContent, sectionId: string, subsectionId: string): void {
  const section = content.infoSections.find((item) => item.id === sectionId);
  if (!section) return;
  const sub = section.subsections.find((item) => item.id === subsectionId);
  section.subsections = section.subsections.filter((item) => item.id !== subsectionId);
  for (const block of sub?.blocks ?? []) delete content.formattedText[portiaTextKey.infoBlock(block.id)];
}

export function removeInfoBlock(content: PortiaContent, subsectionId: string, blockId: string): void {
  for (const section of content.infoSections) {
    const sub = section.subsections.find((item) => item.id === subsectionId);
    if (sub) sub.blocks = sub.blocks.filter((block) => block.id !== blockId);
  }
  delete content.formattedText[portiaTextKey.infoBlock(blockId)];
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
