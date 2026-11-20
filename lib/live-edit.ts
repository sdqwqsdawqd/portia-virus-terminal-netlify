import type { ImageFraming } from "./image-framing.ts";
import { MAX_BLOCKS, MAX_SUBSECTIONS, MAX_TABLE_ROWS } from "./content-limits.ts";
import { makeId, removeGuideBlock, removeGuideCard, removeGuideSection } from "./editor-items.ts";
import { findGuide, portiaTextKey, type GuideBlock, type GuideCard, type PortiaContent } from "./portia-content.ts";
import { parseYoutubeId } from "./portia-content-normalize.ts";
import { splitEmbeddedMedia } from "./rich-text-media.ts";

// LIVE-01..05 (26.1-10): the pure model of the live editing mode. The editor shows the visitor's own view of an app on the draft and edits it in place;
// every function here edits the editor's draft inside one changeDraft call (the draft is already a copy), so one call is one undo step.

/** The apps the live mode covers (owner 2026-11-20): «Поиск» and «Сотрудники» have no live mode. */
export type LiveApp = "guide" | "info" | "broadcasts" | "viruses" | "recycle" | "assistant";
export const LIVE_EXCLUDED = ["search", "employees"] as const;

/** The editor tabs that have a live mode so far, and the app each one shows. */
export const LIVE_TABS = ["guide"] as const;
export type LiveTab = (typeof LIVE_TABS)[number];

const liveAppOfTab: Record<LiveTab, LiveApp> = { guide: "guide" };

/** The app the live mode of an editor tab shows; null where the tab has none. */
export function liveAppForTab(tab: string): LiveApp | null {
  return (LIVE_TABS as readonly string[]).includes(tab) ? liveAppOfTab[tab as LiveTab] : null;
}

/** The longest plain line, the same as the `maxLength` of the editor's text fields. */
export const TEXT_LIMIT = 300;

/** A text place of the «Справочник»: the field it stands for, found by ids so an edit that ends after a reorder or a delete still lands right. */
export type LiveTarget =
  | { kind: "guide-section-title"; sectionId: string }
  | { kind: "guide-card-title"; cardId: string }
  | { kind: "guide-heading"; cardId: string; blockId: string }
  | { kind: "guide-callout-label"; cardId: string; blockId: string }
  | { kind: "guide-photo-caption"; cardId: string; blockId: string }
  | { kind: "guide-table-key" | "guide-table-value"; cardId: string; blockId: string; rowId: string }
  | { kind: "guide-video-url"; cardId: string; blockId: string }
  /** The body of a text block or a callout: formatted text, stored with its document under portiaTextKey.guideBlock(blockId). */
  | { kind: "guide-block-text"; cardId: string; blockId: string };

/** A picture place of the «Справочник»: the photo of a section, the cover of a card, the picture of a photo block. */
export type LiveImageTarget =
  | { kind: "guide-section-photo"; sectionId: string }
  | { kind: "guide-card-cover"; cardId: string }
  | { kind: "guide-photo-url"; cardId: string; blockId: string };

/** The block «Карточки»: the ids of the cards it shows. */
export type LiveCardsTarget = { kind: "guide-cards-block"; cardId: string; blockId: string };

const findBlock = (draft: PortiaContent, cardId: string, blockId: string): GuideBlock | undefined => findGuide(draft.guideSections, cardId)?.card?.blocks.find((item) => item.id === blockId);

/** Writes `value` into the place; false when the place is gone. Plain lines are cut to TEXT_LIMIT; a video link is read as a YouTube address (nothing recognised leaves no video). */
export function applyLiveText(draft: PortiaContent, target: LiveTarget, value: string): boolean {
  const line = value.slice(0, TEXT_LIMIT);
  switch (target.kind) {
    case "guide-section-title": {
      const section = draft.guideSections.find((item) => item.id === target.sectionId);
      if (!section) return false;
      section.title = line;
      return true;
    }
    case "guide-card-title": {
      const card = findGuide(draft.guideSections, target.cardId)?.card;
      if (!card) return false;
      card.title = line;
      return true;
    }
    case "guide-table-key":
    case "guide-table-value": {
      const block = findBlock(draft, target.cardId, target.blockId);
      const row = block?.type === "table" ? block.rows.find((item) => item.id === target.rowId) : undefined;
      if (!row) return false;
      if (target.kind === "guide-table-key") row.key = line; else row.value = line;
      return true;
    }
    default: {
      const block = findBlock(draft, target.cardId, target.blockId);
      if (!block) return false;
      if (target.kind === "guide-heading" && block.type === "heading") block.text = line;
      else if (target.kind === "guide-callout-label" && block.type === "callout") block.label = line;
      else if (target.kind === "guide-photo-caption" && block.type === "photo") block.caption = line;
      else if (target.kind === "guide-video-url" && block.type === "video") block.videoId = parseYoutubeId(value);
      else if (target.kind === "guide-block-text" && (block.type === "text" || block.type === "callout")) block.text = value;
      else return false;
      return true;
    }
  }
}

/** The card or the section a picture place belongs to, as the object that holds the address and the frame. */
function pictureOf(draft: PortiaContent, target: LiveImageTarget): { address: string; set: (url: string) => void; frame: (frame: ImageFraming | undefined) => void } | null {
  if (target.kind === "guide-section-photo") {
    const section = draft.guideSections.find((item) => item.id === target.sectionId);
    if (!section) return null;
    return { address: section.photo, set: (url) => { section.photo = url; }, frame: (frame) => { if (frame) section.photoFraming = frame; else delete section.photoFraming; } };
  }
  if (target.kind === "guide-card-cover") {
    const card: GuideCard | null | undefined = findGuide(draft.guideSections, target.cardId)?.card;
    if (!card) return null;
    return { address: card.cover, set: (url) => { card.cover = url; }, frame: (frame) => { if (frame) card.coverFraming = frame; else delete card.coverFraming; } };
  }
  const block = findBlock(draft, target.cardId, target.blockId);
  if (block?.type !== "photo") return null;
  return { address: block.url, set: (url) => { block.url = url; }, frame: (frame) => { if (frame) block.framing = frame; else delete block.framing; } };
}

/** A new address replaces the picture and drops the frame that belonged to the old one (as the editor's picture field does); false when the place is gone. */
export function applyLiveImage(draft: PortiaContent, target: LiveImageTarget, url: string): boolean {
  const picture = pictureOf(draft, target);
  if (!picture) return false;
  if (picture.address !== url) picture.frame(undefined);
  picture.set(url);
  return true;
}

/** The visible part of the picture; undefined clears it. */
export function applyLiveFraming(draft: PortiaContent, target: LiveImageTarget, frame: ImageFraming | undefined): boolean {
  const picture = pictureOf(draft, target);
  if (!picture) return false;
  picture.frame(frame);
  return true;
}

/** The cards of the block «Карточки», in the chosen order. */
export function applyLiveCards(draft: PortiaContent, target: LiveCardsTarget, cardIds: string[]): boolean {
  const block = findBlock(draft, target.cardId, target.blockId);
  if (block?.type !== "cards") return false;
  block.cardIds = cardIds;
  return true;
}

/** What the bar «Добавить: …» can add (`row` is a row of a table block). The cover is not here: it is a picture place, not a new element. */
export type LiveAddKind = "section" | "card" | "heading" | "text" | "table" | "photo" | "video" | "callout" | "cards" | "row";

/** A place that takes new elements: the list of sections, one section (cards), one card (blocks), one table block (rows). */
export type LiveContainer =
  | { kind: "guide-root" }
  | { kind: "guide-section"; sectionId: string }
  | { kind: "guide-card"; cardId: string }
  | { kind: "guide-table"; cardId: string; blockId: string };

/** An ordered list the live mode can reorder. */
export type LiveList =
  | { kind: "guide-sections" }
  | { kind: "guide-cards"; sectionId: string }
  | { kind: "guide-blocks"; cardId: string };

/** An element the live mode can remove, after a question. */
export type LiveRemovable =
  | { kind: "guide-section"; sectionId: string }
  | { kind: "guide-card"; cardId: string }
  | { kind: "guide-block"; cardId: string; blockId: string }
  | { kind: "guide-table-row"; cardId: string; blockId: string; rowId: string };

const newBlock: Record<Exclude<LiveAddKind, "section" | "card" | "row">, (id: string) => GuideBlock> = {
  heading: (id) => ({ id, type: "heading", text: "" }),
  text: (id) => ({ id, type: "text", text: "" }),
  table: (id) => ({ id, type: "table", rows: [{ id: makeId("row"), key: "", value: "" }] }),
  photo: (id) => ({ id, type: "photo", url: "", caption: "" }),
  video: (id) => ({ id, type: "video", videoId: "" }),
  callout: (id) => ({ id, type: "callout", label: "", text: "" }),
  cards: (id) => ({ id, type: "cards", cardIds: [] }),
};

/** The kinds a container takes, in the order of its bar. */
export function liveAddKinds(container: LiveContainer): LiveAddKind[] {
  if (container.kind === "guide-root") return ["section"];
  if (container.kind === "guide-section") return ["card"];
  if (container.kind === "guide-table") return ["row"];
  return ["heading", "text", "table", "photo", "video", "callout", "cards"];
}

/**
 * Adds a new element of `kind` to the container with the shape the editor's own buttons make; returns its id, or null when the container is gone,
 * does not take the kind, or is full (MAX_BLOCKS blocks, MAX_SUBSECTIONS cards, MAX_TABLE_ROWS rows).
 */
export function applyLiveAdd(draft: PortiaContent, container: LiveContainer, kind: LiveAddKind): string | null {
  if (!liveAddKinds(container).includes(kind)) return null;
  if (container.kind === "guide-root") {
    const id = makeId("guide");
    draft.guideSections.push({ id, title: "НОВЫЙ РАЗДЕЛ", photo: "", cards: [] });
    return id;
  }
  if (container.kind === "guide-section") {
    const section = draft.guideSections.find((item) => item.id === container.sectionId);
    if (!section || section.cards.length >= MAX_SUBSECTIONS) return null;
    const id = makeId("card");
    section.cards.push({ id, title: "НОВАЯ КАРТОЧКА", cover: "", blocks: [] });
    return id;
  }
  if (container.kind === "guide-table") {
    const block = findBlock(draft, container.cardId, container.blockId);
    if (block?.type !== "table" || block.rows.length >= MAX_TABLE_ROWS) return null;
    const id = makeId("row");
    block.rows.push({ id, key: "", value: "" });
    return id;
  }
  const card = findGuide(draft.guideSections, container.cardId)?.card;
  if (!card || card.blocks.length >= MAX_BLOCKS) return null;
  const id = makeId("block");
  card.blocks.push(newBlock[kind as keyof typeof newBlock](id));
  return id;
}

function listOf(draft: PortiaContent, list: LiveList): unknown[] | null {
  if (list.kind === "guide-sections") return draft.guideSections;
  if (list.kind === "guide-cards") return draft.guideSections.find((item) => item.id === list.sectionId)?.cards ?? null;
  return findGuide(draft.guideSections, list.cardId)?.card?.blocks ?? null;
}

/** Moves one item of an ordered list; false (nothing changed) when the list is gone or an index is out of range or the same. */
export function applyLiveMove(draft: PortiaContent, list: LiveList, from: number, to: number): boolean {
  const items = listOf(draft, list);
  if (!items || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return false;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  return true;
}

/** The formatting keys that go with a removed element, so the editor can close its format panel for them. */
export function liveRemovedKeys(draft: PortiaContent, item: LiveRemovable): string[] {
  const keys = (cards: GuideCard[]) => cards.flatMap((card) => card.blocks.map((block) => portiaTextKey.guideBlock(block.id)));
  if (item.kind === "guide-section") return keys(draft.guideSections.find((section) => section.id === item.sectionId)?.cards ?? []);
  if (item.kind === "guide-card") {
    const card = findGuide(draft.guideSections, item.cardId)?.card;
    return keys(card ? [card] : []);
  }
  if (item.kind === "guide-block") return [portiaTextKey.guideBlock(item.blockId)];
  return [];
}

/** Removes the element with the formatting that belonged to it (lib/editor-items.ts); false when it is not there. */
export function applyLiveRemove(draft: PortiaContent, item: LiveRemovable): boolean {
  if (item.kind === "guide-section") {
    if (!draft.guideSections.some((section) => section.id === item.sectionId)) return false;
    removeGuideSection(draft, item.sectionId);
    return true;
  }
  if (item.kind === "guide-card") {
    if (!findGuide(draft.guideSections, item.cardId)?.card) return false;
    removeGuideCard(draft, item.cardId);
    return true;
  }
  if (item.kind === "guide-block") {
    if (!findBlock(draft, item.cardId, item.blockId)) return false;
    removeGuideBlock(draft, item.cardId, item.blockId);
    return true;
  }
  const block = findBlock(draft, item.cardId, item.blockId);
  if (block?.type !== "table" || !block.rows.some((row) => row.id === item.rowId)) return false;
  block.rows = block.rows.filter((row) => row.id !== item.rowId);
  return true;
}

/** The GIFs and pictures a text shows, as the visitor's FormattedText finds them (links to a picture, a giphy page, a known klipy page). */
export function liveMediaUrls(text: string): string[] {
  return splitEmbeddedMedia(text).flatMap((segment) => (segment.kind === "media" ? [segment.url] : []));
}

/** True when the container takes no more of its kind (the bar then disables its buttons instead of recording an edit that changes nothing). */
export function liveContainerFull(draft: PortiaContent, container: LiveContainer): boolean {
  if (container.kind === "guide-root") return false;
  if (container.kind === "guide-section") return (draft.guideSections.find((item) => item.id === container.sectionId)?.cards.length ?? 0) >= MAX_SUBSECTIONS;
  if (container.kind === "guide-card") return (findGuide(draft.guideSections, container.cardId)?.card?.blocks.length ?? 0) >= MAX_BLOCKS;
  const block = findBlock(draft, container.cardId, container.blockId);
  return block?.type === "table" && block.rows.length >= MAX_TABLE_ROWS;
}
