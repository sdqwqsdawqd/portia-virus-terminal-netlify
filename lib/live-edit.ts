import type { ImageFraming } from "./image-framing.ts";
import { broadcastFeed, questDateError, type BroadcastTab } from "./broadcasts.ts";
import { MAX_BLOCKS, MAX_CONDITIONS, MAX_SCIENTIST_LOGS, MAX_SUBSECTIONS, MAX_TABLE_ROWS } from "./content-limits.ts";
import { addBroadcast, makeId, removeBroadcast, removeGuideBlock, removeGuideCard, removeGuideSection, removeInfoBlock, removeInfoSection, removeInfoSubsection, removeMutation } from "./editor-items.ts";
import { classificationOptions, findGuide, findInfo, portiaTextKey, type Broadcast, type GuideBlock, type GuideCard, type InfoBlock, type InfoSubsection, type PortiaContent, type RichTextDocument, type ScientistLog, type Virus } from "./portia-content.ts";
import { parseYoutubeId } from "./portia-content-normalize.ts";
import { ACCESS_LEVELS } from "./access-levels.ts";
import { splitEmbeddedMedia } from "./rich-text-media.ts";

// LIVE-01..05 (26.1-10): the pure model of the live editing mode. The editor shows the visitor's own view of an app on the draft and edits it in place;
// every function here edits the editor's draft inside one changeDraft call (the draft is already a copy), so one call is one undo step.

/** The apps the live mode covers (owner 2026-11-20): «Поиск» and «Сотрудники» have no live mode. */
export type LiveApp = "guide" | "info" | "broadcasts" | "viruses" | "recycle" | "assistant";
export const LIVE_EXCLUDED = ["search", "employees"] as const;

/** The editor tabs that have a live mode so far, and the app each one shows. */
export const LIVE_TABS = ["guide", "info", "broadcasts", "viruses"] as const;
export type LiveTab = (typeof LIVE_TABS)[number];

const liveAppOfTab: Record<LiveTab, LiveApp> = { guide: "guide", info: "info", broadcasts: "broadcasts", viruses: "viruses" };

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
  | { kind: "guide-block-text"; cardId: string; blockId: string }
  /** «Информация» (26.1-11): the title of a section, and its body (formatted text, stored under portiaTextKey.info(sectionId)). */
  | { kind: "info-section-title"; sectionId: string }
  | { kind: "info-section-body"; sectionId: string }
  | { kind: "info-subsection-title"; subsectionId: string }
  /** The text of a text block of a subsection: formatted text, stored under portiaTextKey.infoBlock(blockId). */
  | { kind: "info-block-text"; subsectionId: string; blockId: string }
  | { kind: "info-table-key" | "info-table-value"; subsectionId: string; blockId: string; rowId: string }
  | { kind: "info-video-url"; subsectionId: string; blockId: string }
  /** «Сводка» (26.1-11): an entry of the feed; the body is formatted text under portiaTextKey.broadcast(id), the conditions are plain lines kept as typed (up to MAX_CONDITIONS). */
  | { kind: "broadcast-title" | "broadcast-body" | "broadcast-conditions"; broadcastId: string }
  /** «База вирусов» (26.1-12): the name, the code and the status of a virus (plain lines, cut to the lengths of the template: 120, 40, 80). */
  | { kind: "virus-name" | "virus-code" | "virus-status"; virusId: string }
  /** One of the five texts of a virus: formatted text, stored under portiaTextKey.virus(virusId, field). */
  | { kind: "virus-text"; virusId: string; field: LiveVirusField }
  /** A mutation has no id: it is found by its position, and its description is formatted text under portiaTextKey.mutation(virusId, index). */
  | { kind: "mutation-name" | "mutation-description"; virusId: string; index: number }
  /** A scientist record: the title and the pseudonym are plain lines, the text is formatted text kept in the record itself (richContent), under the format key "scientist:<logId>". */
  | { kind: "log-title" | "log-scientist"; virusId: string; logId: string }
  | { kind: "log-text"; virusId: string; logId: string };

/** The five formatted texts of a virus card: section 02, section 04 and the three PPU metrics. */
export type LiveVirusField = "external" | "physiology" | "ppu-health" | "ppu-speed" | "ppu-abilities";

/** The virus of the list or of the recycle bin with this id (the formatting keys are keyed by the id alone, so one lookup serves both). */
export function findLiveVirus(draft: PortiaContent, virusId: string): Virus | undefined {
  return draft.viruses.find((item) => item.id === virusId) ?? (draft.recycledViruses ?? []).find((item) => item.id === virusId);
}

const findLiveLog = (draft: PortiaContent, virusId: string, logId: string): ScientistLog | undefined => findLiveVirus(draft, virusId)?.scientistLogs.find((item) => item.id === logId);

/** The text of a scientist record with its formatting document, written as the editor's own field writes it: paragraphs in `content`, the document in `richContent`. False when the record is gone. */
export function applyLiveLogText(draft: PortiaContent, target: Extract<LiveTarget, { kind: "log-text" }>, value: string, document: RichTextDocument): boolean {
  const log = findLiveLog(draft, target.virusId, target.logId);
  if (!log) return false;
  log.content = value.split(/\n\s*\n/);
  log.richContent = document;
  return true;
}

/** A choice in place: one axis of the classification of a virus, or the level a scientist record needs. */
export type LiveChoiceTarget =
  | { kind: "virus-class"; virusId: string; axis: keyof Virus["classification"] }
  | { kind: "log-level"; virusId: string; logId: string };

/**
 * Sets a choice; false, and nothing written, when the place is gone or the value is not one of its choices: an axis takes a value of its list (the routes of transmission
 * take the canonical string of lib/transmission-routes.ts, which the field builds), the level of a record takes 1 to 5.
 */
export function applyLiveChoice(draft: PortiaContent, target: LiveChoiceTarget, value: string): boolean {
  if (target.kind === "log-level") {
    const log = findLiveLog(draft, target.virusId, target.logId);
    const level = Number(value);
    if (!log || !(ACCESS_LEVELS as readonly number[]).includes(level)) return false;
    log.lockedLevel = level;
    return true;
  }
  const virus = findLiveVirus(draft, target.virusId);
  if (!virus) return false;
  if (target.axis !== "transmission" && !(classificationOptions[target.axis] as readonly { value: string }[]).some((option) => option.value === value)) return false;
  virus.classification[target.axis] = value;
  return true;
}

/** The cuts of the plain lines of a virus, the same as the template's. */
const VIRUS_LINE_LIMIT = { "virus-name": 120, "virus-code": 40, "virus-status": 80 } as const;

/** The key of the stored formatting (draft.formattedText) of a formatted text place; "" for a plain one. */
export function liveTextKey(target: LiveTarget): string {
  if (target.kind === "guide-block-text") return portiaTextKey.guideBlock(target.blockId);
  if (target.kind === "info-section-body") return portiaTextKey.info(target.sectionId);
  if (target.kind === "info-block-text") return portiaTextKey.infoBlock(target.blockId);
  if (target.kind === "broadcast-body") return portiaTextKey.broadcast(target.broadcastId);
  if (target.kind === "virus-text") return portiaTextKey.virus(target.virusId, target.field);
  if (target.kind === "mutation-description") return portiaTextKey.mutation(target.virusId, target.index);
  if (target.kind === "log-text") return `scientist:${target.logId}`;
  return "";
}

/** A switch of an entry of «Сводки»: shown to visitors (any entry), important (news only). */
export type LiveFlagTarget = { kind: "broadcast-published" | "broadcast-important"; broadcastId: string };

/** The start or the end of a quest. */
export type LiveDateTarget = { kind: "broadcast-starts" | "broadcast-ends"; broadcastId: string };

/** Sets a switch; false when the entry is gone, or a quest or task is asked to be important (D-19: only news are). */
export function applyLiveFlag(draft: PortiaContent, target: LiveFlagTarget, checked: boolean): boolean {
  const item = draft.broadcasts.find((entry) => entry.id === target.broadcastId);
  if (!item) return false;
  if (target.kind === "broadcast-published") { item.published = checked; return true; }
  if (item.type !== "news") return false;
  item.important = checked;
  return true;
}

const isDay = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
};

/** The entry as it would stand with `value` in the date place, or null when the place is gone, the entry is not a quest, or the value is neither a day nor empty. */
function withDate(draft: PortiaContent, target: LiveDateTarget, value: string): { item: Broadcast; startsAt: string; endsAt: string } | null {
  const item = draft.broadcasts.find((entry) => entry.id === target.broadcastId);
  if (!item || item.type !== "quest" || (value !== "" && !isDay(value))) return null;
  return { item, startsAt: target.kind === "broadcast-starts" ? value : item.startsAt, endsAt: target.kind === "broadcast-ends" ? value : item.endsAt };
}

/** True when `value` would put the end of the quest before its start (the editor's «Окончание раньше начала», D-18). */
export function liveDateError(draft: PortiaContent, target: LiveDateTarget, value: string): boolean {
  const next = withDate(draft, target, value);
  return !!next && questDateError({ type: next.item.type, startsAt: next.startsAt, endsAt: next.endsAt });
}

/** Writes a day (or clears it); false, and nothing written, when it is not a day, the entry is not a quest, or the end would come before the start (T-26.1-25). */
export function applyLiveDate(draft: PortiaContent, target: LiveDateTarget, value: string): boolean {
  const next = withDate(draft, target, value);
  if (!next || questDateError({ type: next.item.type, startsAt: next.startsAt, endsAt: next.endsAt })) return false;
  next.item.startsAt = next.startsAt;
  next.item.endsAt = next.endsAt;
  return true;
}

/** The feed of a tab as the visitor sees it (news: important first; quests by their dates), but with the entries not yet shown to visitors too, each keeping its real `published`. */
export function liveBroadcastFeed(broadcasts: Broadcast[], tab: BroadcastTab, today: string): Broadcast[] {
  const shown = new Map(broadcasts.map((item) => [item.id, item.published]));
  return broadcastFeed(broadcasts.map((item) => ({ ...item, published: true })), tab, today).map((item) => ({ ...item, published: shown.get(item.id) ?? false }));
}

/** A picture place of the «Справочник»: the photo of a section, the cover of a card, the picture of a photo block. */
export type LiveImageTarget =
  | { kind: "guide-section-photo"; sectionId: string }
  | { kind: "guide-card-cover"; cardId: string }
  | { kind: "guide-photo-url"; cardId: string; blockId: string }
  | { kind: "info-photo-url"; subsectionId: string; blockId: string }
  /** «База вирусов» (26.1-12): the photo after infection and the picture of a mutation (by position). */
  | { kind: "virus-infected"; virusId: string }
  | { kind: "mutation-image"; virusId: string; index: number };

/** The block «Карточки»: the ids of the cards it shows. */
export type LiveCardsTarget = { kind: "guide-cards-block"; cardId: string; blockId: string };

const findBlock = (draft: PortiaContent, cardId: string, blockId: string): GuideBlock | undefined => findGuide(draft.guideSections, cardId)?.card?.blocks.find((item) => item.id === blockId);

const findInfoBlock = (draft: PortiaContent, subsectionId: string, blockId: string): InfoBlock | undefined => findInfo(draft.infoSections, subsectionId)?.subsection?.blocks.find((item) => item.id === blockId);

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
    case "info-section-title":
    case "info-section-body": {
      const section = draft.infoSections.find((item) => item.id === target.sectionId);
      if (!section) return false;
      if (target.kind === "info-section-title") section.title = line; else section.body = value;
      return true;
    }
    case "info-subsection-title": {
      const subsection = findInfo(draft.infoSections, target.subsectionId)?.subsection;
      if (!subsection) return false;
      subsection.title = line;
      return true;
    }
    case "info-table-key":
    case "info-table-value": {
      const block = findInfoBlock(draft, target.subsectionId, target.blockId);
      const row = block?.type === "table" ? block.rows.find((item) => item.id === target.rowId) : undefined;
      if (!row) return false;
      if (target.kind === "info-table-key") row.key = line; else row.value = line;
      return true;
    }
    case "info-block-text": {
      const block = findInfoBlock(draft, target.subsectionId, target.blockId);
      if (block?.type !== "text") return false;
      block.text = value;
      return true;
    }
    case "info-video-url": {
      const block = findInfoBlock(draft, target.subsectionId, target.blockId);
      if (block?.type !== "video") return false;
      block.videoId = parseYoutubeId(value);
      return true;
    }
    case "broadcast-title":
    case "broadcast-body":
    case "broadcast-conditions": {
      const item = draft.broadcasts.find((entry) => entry.id === target.broadcastId);
      if (!item) return false;
      if (target.kind === "broadcast-title") item.title = line;
      else if (target.kind === "broadcast-body") item.body = value;
      else item.conditions = value.slice(0, MAX_CONDITIONS);
      return true;
    }
    case "virus-name":
    case "virus-code":
    case "virus-status": {
      const virus = findLiveVirus(draft, target.virusId);
      if (!virus) return false;
      const text = value.slice(0, VIRUS_LINE_LIMIT[target.kind]);
      if (target.kind === "virus-name") virus.name = text; else if (target.kind === "virus-code") virus.code = text; else virus.status = text;
      return true;
    }
    case "mutation-name":
    case "mutation-description": {
      const mutation = findLiveVirus(draft, target.virusId)?.mutations[target.index];
      if (!mutation) return false;
      if (target.kind === "mutation-name") mutation.name = line; else mutation.description = value;
      return true;
    }
    case "log-title":
    case "log-scientist":
    case "log-text": {
      const log = findLiveLog(draft, target.virusId, target.logId);
      if (!log) return false;
      if (target.kind === "log-title") log.title = line;
      else if (target.kind === "log-scientist") log.scientist = line;
      else { log.content = value.split(/\n\s*\n/); log.richContent = { runs: [{ text: value }] }; }
      return true;
    }
    case "virus-text": {
      const virus = findLiveVirus(draft, target.virusId);
      if (!virus) return false;
      if (target.field === "external" || target.field === "physiology") virus[target.field] = value;
      else virus.ppu[target.field === "ppu-health" ? "health" : target.field === "ppu-speed" ? "speed" : "abilities"] = value;
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
  if (target.kind === "info-photo-url") {
    const infoBlock = findInfoBlock(draft, target.subsectionId, target.blockId);
    if (infoBlock?.type !== "photo") return null;
    return { address: infoBlock.url, set: (url) => { infoBlock.url = url; }, frame: (frame) => { if (frame) infoBlock.framing = frame; else delete infoBlock.framing; } };
  }
  if (target.kind === "virus-infected") {
    const virus = findLiveVirus(draft, target.virusId);
    if (!virus) return null;
    return { address: virus.infectedImage, set: (url) => { virus.infectedImage = url; }, frame: (frame) => { if (frame) virus.infectedImageFraming = frame; else delete virus.infectedImageFraming; } };
  }
  if (target.kind === "mutation-image") {
    const mutation = findLiveVirus(draft, target.virusId)?.mutations[target.index];
    if (!mutation) return null;
    return { address: mutation.image, set: (url) => { mutation.image = url; }, frame: (frame) => { if (frame) mutation.imageFraming = frame; else delete mutation.imageFraming; } };
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
export type LiveAddKind = "section" | "subsection" | "card" | "heading" | "text" | "table" | "photo" | "video" | "callout" | "cards" | "row" | "news" | "quest" | "mutation" | "log";

/** A place that takes new elements: the list of sections, one section (cards), one card (blocks), one table block (rows); in «Информации» the table of contents (sections and subsections), one subsection (blocks), one table block (rows). */
export type LiveContainer =
  | { kind: "guide-root" }
  | { kind: "guide-section"; sectionId: string }
  | { kind: "guide-card"; cardId: string }
  | { kind: "guide-table"; cardId: string; blockId: string }
  /** The table of contents: a section anywhere, a subsection in `sectionId` (the section on show; "" when there is none). */
  | { kind: "info-index"; sectionId: string }
  | { kind: "info-subsection"; subsectionId: string }
  | { kind: "info-table"; subsectionId: string; blockId: string }
  /** The feed of «Сводки»: a news or a quest, put at the top like the editor's own button does. */
  | { kind: "broadcasts" }
  /** The end of a virus card: a mutation, a scientist record (the photo after infection is a picture place, drawn beside the bar). */
  | { kind: "virus"; virusId: string };

/** An ordered list the live mode can reorder. */
export type LiveList =
  | { kind: "guide-sections" }
  | { kind: "guide-cards"; sectionId: string }
  | { kind: "guide-blocks"; cardId: string }
  | { kind: "info-sections" }
  | { kind: "info-subsections"; sectionId: string }
  | { kind: "info-blocks"; subsectionId: string }
  /** The viruses of the archive, in the order of the list. */
  | { kind: "viruses" };

/** An element the live mode can remove, after a question. */
export type LiveRemovable =
  | { kind: "guide-section"; sectionId: string }
  | { kind: "guide-card"; cardId: string }
  | { kind: "guide-block"; cardId: string; blockId: string }
  | { kind: "guide-table-row"; cardId: string; blockId: string; rowId: string }
  | { kind: "info-section"; sectionId: string }
  | { kind: "info-subsection"; sectionId: string; subsectionId: string }
  | { kind: "info-block"; subsectionId: string; blockId: string }
  | { kind: "info-table-row"; subsectionId: string; blockId: string; rowId: string }
  | { kind: "broadcast"; broadcastId: string }
  | { kind: "mutation"; virusId: string; index: number }
  | { kind: "log"; virusId: string; logId: string };

type GuideBlockKind = "heading" | "text" | "table" | "photo" | "video" | "callout" | "cards";
type InfoBlockKind = "text" | "table" | "photo" | "video";

const newBlock: Record<GuideBlockKind, (id: string) => GuideBlock> = {
  heading: (id) => ({ id, type: "heading", text: "" }),
  text: (id) => ({ id, type: "text", text: "" }),
  table: (id) => ({ id, type: "table", rows: [{ id: makeId("row"), key: "", value: "" }] }),
  photo: (id) => ({ id, type: "photo", url: "", caption: "" }),
  video: (id) => ({ id, type: "video", videoId: "" }),
  callout: (id) => ({ id, type: "callout", label: "", text: "" }),
  cards: (id) => ({ id, type: "cards", cardIds: [] }),
};

const newInfoBlock: Record<InfoBlockKind, (id: string) => InfoBlock> = {
  text: (id) => ({ id, type: "text", text: "" }),
  table: (id) => ({ id, type: "table", rows: [{ id: makeId("row"), key: "", value: "" }] }),
  photo: (id) => ({ id, type: "photo", url: "" }),
  video: (id) => ({ id, type: "video", videoId: "" }),
};

/** The kinds a container takes, in the order of its bar. */
export function liveAddKinds(container: LiveContainer): LiveAddKind[] {
  if (container.kind === "guide-root") return ["section"];
  if (container.kind === "guide-section") return ["card"];
  if (container.kind === "guide-table" || container.kind === "info-table") return ["row"];
  if (container.kind === "info-index") return ["section", "subsection"];
  if (container.kind === "info-subsection") return ["text", "table", "photo", "video"];
  if (container.kind === "broadcasts") return ["news", "quest"];
  if (container.kind === "virus") return ["mutation", "log"];
  return ["heading", "text", "table", "photo", "video", "callout", "cards"];
}

/** A new id for an element of `kind` made in `container`, with the prefix the editor's own buttons use. The surface makes it beforehand to put the new element on show. */
export function liveNewId(container: LiveContainer, kind: LiveAddKind): string {
  if (kind === "section") return makeId(container.kind === "guide-root" ? "guide" : "info");
  if (kind === "subsection") return makeId("info");
  if (kind === "card") return makeId("card");
  if (kind === "row") return makeId("row");
  if (kind === "news" || kind === "quest") return makeId("broadcast");
  if (kind === "log") return makeId("log");
  if (kind === "mutation") return makeId("mutation");
  return makeId("block");
}

/** The sections of «Информации» and the like: the one the container names, found in the draft. */
const infoSectionOf = (draft: PortiaContent, sectionId: string) => draft.infoSections.find((item) => item.id === sectionId);

/**
 * Adds a new element of `kind` to the container with the shape the editor's own buttons make; returns its id, or null when the container is gone,
 * does not take the kind, or is full (MAX_BLOCKS blocks, MAX_SUBSECTIONS cards or subsections, MAX_TABLE_ROWS rows). `id` is the id to give it (liveNewId); absent, one is made.
 */
export function applyLiveAdd(draft: PortiaContent, container: LiveContainer, kind: LiveAddKind, id: string = liveNewId(container, kind)): string | null {
  if (!liveAddKinds(container).includes(kind)) return null;
  if (container.kind === "guide-root") {
    draft.guideSections.push({ id, title: "НОВЫЙ РАЗДЕЛ", photo: "", cards: [] });
    return id;
  }
  if (container.kind === "guide-section") {
    const section = draft.guideSections.find((item) => item.id === container.sectionId);
    if (!section || section.cards.length >= MAX_SUBSECTIONS) return null;
    section.cards.push({ id, title: "НОВАЯ КАРТОЧКА", cover: "", blocks: [] });
    return id;
  }
  if (container.kind === "guide-table") {
    const block = findBlock(draft, container.cardId, container.blockId);
    if (block?.type !== "table" || block.rows.length >= MAX_TABLE_ROWS) return null;
    block.rows.push({ id, key: "", value: "" });
    return id;
  }
  if (container.kind === "broadcasts") {
    addBroadcast(draft, id, kind === "news" ? "news" : "quest");
    return id;
  }
  if (container.kind === "virus") {
    const virus = findLiveVirus(draft, container.virusId);
    if (!virus) return null;
    if (kind === "mutation") { virus.mutations.push({ name: "НОВАЯ МУТАЦИЯ", description: "", image: "" }); return String(virus.mutations.length - 1); }
    if (virus.scientistLogs.length >= MAX_SCIENTIST_LOGS) return null;
    virus.scientistLogs.push({ id, title: `ЗАПИСЬ ${String(virus.scientistLogs.length + 1).padStart(2, "0")}`, scientist: "ИМЯ УЧЁНОГО", lockedLevel: 1, content: [""], richContent: { runs: [{ text: "" }] } });
    return id;
  }
  if (container.kind === "info-index") {
    if (kind === "section") {
      draft.infoSections.push({ id, title: "НОВЫЙ РАЗДЕЛ", body: "", subsections: [] });
      return id;
    }
    const section = infoSectionOf(draft, container.sectionId);
    if (!section || section.subsections.length >= MAX_SUBSECTIONS) return null;
    section.subsections.push({ id, title: "НОВЫЙ ПОДРАЗДЕЛ", blocks: [] });
    return id;
  }
  if (container.kind === "info-table") {
    const block = findInfoBlock(draft, container.subsectionId, container.blockId);
    if (block?.type !== "table" || block.rows.length >= MAX_TABLE_ROWS) return null;
    block.rows.push({ id, key: "", value: "" });
    return id;
  }
  if (container.kind === "info-subsection") {
    const subsection = findInfo(draft.infoSections, container.subsectionId)?.subsection;
    if (!subsection || subsection.blocks.length >= MAX_BLOCKS) return null;
    subsection.blocks.push(newInfoBlock[kind as InfoBlockKind](id));
    return id;
  }
  const card = findGuide(draft.guideSections, container.cardId)?.card;
  if (!card || card.blocks.length >= MAX_BLOCKS) return null;
  card.blocks.push(newBlock[kind as GuideBlockKind](id));
  return id;
}

function listOf(draft: PortiaContent, list: LiveList): unknown[] | null {
  if (list.kind === "guide-sections") return draft.guideSections;
  if (list.kind === "guide-cards") return draft.guideSections.find((item) => item.id === list.sectionId)?.cards ?? null;
  if (list.kind === "info-sections") return draft.infoSections;
  if (list.kind === "info-subsections") return infoSectionOf(draft, list.sectionId)?.subsections ?? null;
  if (list.kind === "info-blocks") return findInfo(draft.infoSections, list.subsectionId)?.subsection?.blocks ?? null;
  if (list.kind === "viruses") return draft.viruses;
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
  const infoKeys = (subsections: InfoSubsection[]) => subsections.flatMap((sub) => sub.blocks.map((block) => portiaTextKey.infoBlock(block.id)));
  if (item.kind === "guide-section") return keys(draft.guideSections.find((section) => section.id === item.sectionId)?.cards ?? []);
  if (item.kind === "guide-card") {
    const card = findGuide(draft.guideSections, item.cardId)?.card;
    return keys(card ? [card] : []);
  }
  if (item.kind === "guide-block") return [portiaTextKey.guideBlock(item.blockId)];
  if (item.kind === "info-section") return [portiaTextKey.info(item.sectionId), ...infoKeys(infoSectionOf(draft, item.sectionId)?.subsections ?? [])];
  if (item.kind === "info-subsection") return infoKeys(infoSectionOf(draft, item.sectionId)?.subsections.filter((sub) => sub.id === item.subsectionId) ?? []);
  if (item.kind === "info-block") return [portiaTextKey.infoBlock(item.blockId)];
  if (item.kind === "broadcast") return [portiaTextKey.broadcast(item.broadcastId)];
  // Mutations have no id and their formatting is keyed by position: the removed one and every later one change their key.
  if (item.kind === "mutation") return Array.from({ length: Math.max(0, (findLiveVirus(draft, item.virusId)?.mutations.length ?? 0) - item.index) }, (_, step) => portiaTextKey.mutation(item.virusId, item.index + step));
  if (item.kind === "log") return [`scientist:${item.logId}`];
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
  if (item.kind === "info-section") {
    if (!infoSectionOf(draft, item.sectionId)) return false;
    removeInfoSection(draft, item.sectionId);
    return true;
  }
  if (item.kind === "info-subsection") {
    if (!infoSectionOf(draft, item.sectionId)?.subsections.some((sub) => sub.id === item.subsectionId)) return false;
    removeInfoSubsection(draft, item.sectionId, item.subsectionId);
    return true;
  }
  if (item.kind === "info-block") {
    if (!findInfoBlock(draft, item.subsectionId, item.blockId)) return false;
    removeInfoBlock(draft, item.subsectionId, item.blockId);
    return true;
  }
  if (item.kind === "broadcast") {
    if (!draft.broadcasts.some((entry) => entry.id === item.broadcastId)) return false;
    removeBroadcast(draft, item.broadcastId);
    return true;
  }
  if (item.kind === "mutation") {
    const virus = findLiveVirus(draft, item.virusId);
    if (!virus || !Number.isInteger(item.index) || item.index < 0 || item.index >= virus.mutations.length) return false;
    removeMutation(draft, virus, item.index);
    return true;
  }
  if (item.kind === "log") {
    const virus = findLiveVirus(draft, item.virusId);
    const at = virus?.scientistLogs.findIndex((log) => log.id === item.logId) ?? -1;
    if (!virus || at < 0) return false;
    virus.scientistLogs.splice(at, 1);
    return true;
  }
  const block = item.kind === "info-table-row" ? findInfoBlock(draft, item.subsectionId, item.blockId) : findBlock(draft, item.cardId, item.blockId);
  if (block?.type !== "table" || !block.rows.some((row) => row.id === item.rowId)) return false;
  block.rows = block.rows.filter((row) => row.id !== item.rowId);
  return true;
}

/** The GIFs and pictures a text shows, as the visitor's FormattedText finds them (links to a picture, a giphy page, a known klipy page). */
export function liveMediaUrls(text: string): string[] {
  return splitEmbeddedMedia(text).flatMap((segment) => (segment.kind === "media" ? [segment.url] : []));
}

/** True when the container takes no more of `kind` (the bar then disables that button instead of recording an edit that changes nothing). */
export function liveAddBlocked(draft: PortiaContent, container: LiveContainer, kind: LiveAddKind): boolean {
  if (container.kind === "guide-root" || container.kind === "broadcasts") return false;
  if (container.kind === "virus") return kind === "log" && (findLiveVirus(draft, container.virusId)?.scientistLogs.length ?? 0) >= MAX_SCIENTIST_LOGS;
  if (container.kind === "guide-section") return (draft.guideSections.find((item) => item.id === container.sectionId)?.cards.length ?? 0) >= MAX_SUBSECTIONS;
  if (container.kind === "guide-card") return (findGuide(draft.guideSections, container.cardId)?.card?.blocks.length ?? 0) >= MAX_BLOCKS;
  if (container.kind === "info-index") {
    if (kind === "section") return false;
    const section = infoSectionOf(draft, container.sectionId);
    return !section || section.subsections.length >= MAX_SUBSECTIONS;
  }
  if (container.kind === "info-subsection") return (findInfo(draft.infoSections, container.subsectionId)?.subsection?.blocks.length ?? 0) >= MAX_BLOCKS;
  const block = container.kind === "info-table" ? findInfoBlock(draft, container.subsectionId, container.blockId) : findBlock(draft, container.cardId, container.blockId);
  return block?.type === "table" && block.rows.length >= MAX_TABLE_ROWS;
}

/** True when the container takes nothing more of any kind. */
export function liveContainerFull(draft: PortiaContent, container: LiveContainer): boolean {
  return liveAddKinds(container).every((kind) => liveAddBlocked(draft, container, kind));
}
