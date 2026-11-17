import { portiaTextKey, type Broadcast, type GuideCard, type PortiaContent, type Virus } from "./portia-content.ts";

export const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

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

const dropGuideFormatting = (content: PortiaContent, cards: GuideCard[]) => {
  for (const card of cards) for (const block of card.blocks) delete content.formattedText[portiaTextKey.guideBlock(block.id)];
};

// D-13: a section goes with its cards and their blocks' formatting.
export function removeGuideSection(content: PortiaContent, id: string): void {
  const section = content.guideSections.find((item) => item.id === id);
  content.guideSections = content.guideSections.filter((item) => item.id !== id);
  dropGuideFormatting(content, section?.cards ?? []);
}

// D-12: cards can be moved between sections, so the card is looked up everywhere.
export function removeGuideCard(content: PortiaContent, cardId: string): void {
  for (const section of content.guideSections) {
    const card = section.cards.find((item) => item.id === cardId);
    if (!card) continue;
    section.cards = section.cards.filter((item) => item.id !== cardId);
    dropGuideFormatting(content, [card]);
  }
}

export function removeGuideBlock(content: PortiaContent, cardId: string, blockId: string): void {
  for (const section of content.guideSections) {
    const card = section.cards.find((item) => item.id === cardId);
    if (card) card.blocks = card.blocks.filter((block) => block.id !== blockId);
  }
  delete content.formattedText[portiaTextKey.guideBlock(blockId)];
}

// One call is one draft change, so a cross-section drag is a single undo step (D-11).
export function moveGuideCard(content: PortiaContent, cardId: string, toSectionId: string, toIndex: number): void {
  const from = content.guideSections.find((section) => section.cards.some((card) => card.id === cardId));
  const to = content.guideSections.find((section) => section.id === toSectionId);
  if (!from || !to) return;
  const [card] = from.cards.splice(from.cards.findIndex((item) => item.id === cardId), 1);
  to.cards.splice(Math.min(Math.max(toIndex, 0), to.cards.length), 0, card);
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
