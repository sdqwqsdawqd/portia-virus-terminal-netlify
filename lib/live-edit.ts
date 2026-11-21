import type { ImageFraming } from "./image-framing.ts";
import { broadcastFeed, questDateError, type BroadcastTab } from "./broadcasts.ts";
import { MAX_BLOCKS, MAX_CONDITIONS, MAX_SCIENTIST_LOGS, MAX_SUBSECTIONS, MAX_TABLE_ROWS } from "./content-limits.ts";
import { addBroadcast, makeId, removeBroadcast, removeGuideBlock, removeGuideCard, removeGuideSection, removeInfoBlock, removeInfoSection, removeInfoSubsection, removeMutation, removeRecycleFile, removeRecycledVirus } from "./editor-items.ts";
import { classificationOptions, findGuide, findInfo, portiaTextKey, type Broadcast, type GuideBlock, type GuideCard, type InfoBlock, type InfoSubsection, type PortiaContent, type RichTextDocument, type RichTextStyle, type ScientistLog, type Virus } from "./portia-content.ts";
import { parseYoutubeId } from "./portia-content-normalize.ts";
import { ACCESS_LEVELS } from "./access-levels.ts";
import { splitEmbeddedMedia } from "./rich-text-media.ts";
import { compactRuns, expandStyles, replaceRichTextRuns } from "./rich-text-style.ts";

// LIVE-01..05 (26.1-10): the pure model of the live editing mode. The editor shows the visitor's own view of an app on the draft and edits it in place;
// every function here edits the editor's draft inside one changeDraft call (the draft is already a copy), so one call is one undo step.

/** The apps the live mode covers: the six of the draft (owner 2026-11-20), «Повышение» and «Доступ» (owner 2026-11-21, item 13); the tabs without one are in LIVE_EXCLUDED. */
export type LiveApp = "guide" | "info" | "broadcasts" | "viruses" | "recycle" | "assistant" | "promo" | "access";

/**
 * The editor tabs that have no live mode, each with its reason: the final boundary of the mode. «Поиск» and «Сотрудники»: the owner's decision (2026-11-20; the drafts of the employees of 26.1-02 stay as they are, OWN-07).
 * «Пользователи»: the owner's decision (2026-11-21, item 13) - no live mode.
 * «Повышение» and «Доступ» left the list on 2026-11-21 (owner, item 13): the view of the one under review is shown in place (26.1-16, 26.1-19).
 */
export const LIVE_EXCLUDED: Readonly<Record<"search" | "employees" | "users", string>> = {
  search: "решение владельца 2026-11-20",
  employees: "решение владельца 2026-11-20",
  users: "решение владельца 2026-11-21: без живого режима",
};

/** The editor tabs that have a live mode, and the app each one shows. */
export const LIVE_TABS = ["guide", "info", "broadcasts", "viruses", "recycle", "assistant", "promo", "access"] as const;
export type LiveTab = (typeof LIVE_TABS)[number];

const liveAppOfTab: Record<LiveTab, LiveApp> = { guide: "guide", info: "info", broadcasts: "broadcasts", viruses: "viruses", recycle: "recycle", assistant: "assistant", promo: "promo", access: "access" };

/**
 * The editor tabs whose live mode lives in their own seam, not in the surface of the editor: «Повышение» draws its toggle in its own bar and writes the banks of the server (its data is not in the draft),
 * so `useLiveMode` draws no toggle for them (one button per tab, not one in the draft row too). «Доступ» (26.1-19) draws its own toggle too and shows the visitor's gate screens, which edit nothing.
 */
export const LIVE_SEAM_TABS = ["promo", "access"] as const;

/** The screens of the visitor's gate the preview of «Доступа» can show (26.1-19), in the order of its tabs. */
export type AccessPreviewId = "checking" | "form" | "form-error" | "pending" | "approved" | "rejected" | "revoked" | "error";

/**
 * The state of a request in a sample, in the shape of the gate's own (lib/access-store.ts). Both shapes below are written out, not imported: this file is in the import graph of the template builder,
 * which must hold no module of the access side, not even for a type. The checks of the shapes are the uses: the preview hands `view` to `accessGateLayout`, and the test does too.
 */
type SampleRequest =
  | { state: "none" }
  | { state: "pending"; nickname: string }
  | { state: "approved"; nickname: string; level: 1; origin: "outside" }
  | { state: "rejected" | "revoked"; nickname: string; retryAt: null };

/** The view of a sample, as an input of `accessGateLayout` (lib/access-gate-view.ts): the check, the connection error, or an answer of a gate with the closure on. */
export type AccessPreviewView = { kind: "checking" } | { kind: "error" } | { kind: "decision"; decision: { mode: "closed"; state: SampleRequest; allowed: false; level: null; editor: false } };

/** A sample state of the gate: the view the gate would hold and the errors the request form shows with it. */
export type AccessPreviewState = { id: AccessPreviewId; view: AccessPreviewView; fieldErrors: { nickname: boolean; origin: boolean } };

const noErrors = { nickname: false, origin: false };
const closed = (state: SampleRequest): AccessPreviewView => ({ kind: "decision", decision: { mode: "closed", state, allowed: false, level: null, editor: false } });

/**
 * «Доступ» in the live mode (26.1-19, owner 2026-11-21, item 13): the screens of a visitor who files a request, each by a sample state of the gate. None of them is a real answer of the server
 * (no nickname of a person, no level of a person); the preview draws them without a request. Closure is on in every sample, so «Отклонено» and «Отозвано» keep their texts (D-09, D-21).
 */
export const accessPreviewStates: readonly AccessPreviewState[] = [
  { id: "checking", view: { kind: "checking" }, fieldErrors: noErrors },
  { id: "form", view: closed({ state: "none" }), fieldErrors: noErrors },
  { id: "form-error", view: closed({ state: "none" }), fieldErrors: { nickname: true, origin: true } },
  { id: "pending", view: closed({ state: "pending", nickname: "Nickname" }), fieldErrors: noErrors },
  { id: "approved", view: closed({ state: "approved", nickname: "Nickname", level: 1, origin: "outside" }), fieldErrors: noErrors },
  { id: "rejected", view: closed({ state: "rejected", nickname: "Nickname", retryAt: null }), fieldErrors: noErrors },
  { id: "revoked", view: closed({ state: "revoked", nickname: "Nickname", retryAt: null }), fieldErrors: noErrors },
  { id: "error", view: { kind: "error" }, fieldErrors: noErrors },
];

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
  | { kind: "log-text"; virusId: string; logId: string }
  /** «Корзина» (26.1-12): the name and the original place of a file are plain lines; its text is formatted text under portiaTextKey.recycle(fileId) (`caption`: the text under a picture). */
  | { kind: "recycle-file-name" | "recycle-file-location"; fileId: string }
  | { kind: "recycle-file-text"; fileId: string; caption?: boolean }
  /** «Вивьян» (26.1-13): one phrase of a group; the formatting of the whole group is one document under portiaTextKey.assistant<Group>, one line per phrase. */
  | { kind: "assistant-phrase"; group: LivePhraseGroup; index: number }
  /**
   * «Повышение» (26.1-16): the places of the candidate's view. They are not in the draft: the banks live on the server, so the seam of «Повышения» writes them by the commands of the banks
   * (applyLiveText knows nothing of them). The rules belong to the transition on show, which the seam knows.
   */
  | { kind: "promo-rules" }
  | { kind: "promo-question-text"; questionId: string }
  | { kind: "promo-question-option"; questionId: string; index: number }
  | { kind: "promo-task-text"; taskId: string };

/** The four groups of the phrases of the assistant, in the order of the editor's tab: advice, after the patience is out, long idleness, activity. */
export type LivePhraseGroup = "advice" | "offended" | "idle" | "activity";
export const LIVE_PHRASE_GROUPS: readonly LivePhraseGroup[] = ["advice", "offended", "idle", "activity"];

const PHRASE_KEY: Record<LivePhraseGroup, string> = { advice: portiaTextKey.assistantAdvice, offended: portiaTextKey.assistantOffended, idle: portiaTextKey.assistantIdle, activity: portiaTextKey.assistantActivity };

/** The phrases of a group as the editor's field lists them. */
export function livePhraseLines(draft: PortiaContent, group: LivePhraseGroup): string[] {
  if (group === "advice") return draft.assistantAdvice ?? [];
  if (group === "offended") return draft.assistantOffendedPhrases ?? [draft.assistantOffendedPhrase];
  return (group === "idle" ? draft.assistantIdlePhrases : draft.assistantActivityPhrases) ?? [];
}

/** The document of the formatting of a group, fitted to its lines (one text, the lines joined by a line break); a plain document when nothing is stored. */
function livePhraseDocument(draft: PortiaContent, group: LivePhraseGroup): RichTextDocument {
  const text = livePhraseLines(draft, group).join("\n");
  const stored = draft.formattedText[PHRASE_KEY[group]];
  if (!stored?.runs?.length) return { runs: [{ text }] };
  return stored.runs.map((run) => run.text).join("") === text ? stored : replaceRichTextRuns(stored, text);
}

/** The formatting of one phrase, cut out of the document of its group the way the visitor's bubble cuts it; undefined when the group has no stored formatting. */
export function livePhraseSlice(draft: PortiaContent, group: LivePhraseGroup, index: number): RichTextDocument | undefined {
  if (!draft.formattedText[PHRASE_KEY[group]]?.runs?.length) return undefined;
  const line = readPhrases(draft, group)[index];
  return line ? compactRuns(line.text, line.styles) : undefined;
}

type PhraseLine = { text: string; styles: RichTextStyle[] };

/** The phrases of a group, each with the style of every one of its characters. */
function readPhrases(draft: PortiaContent, group: LivePhraseGroup): PhraseLine[] {
  const styles = expandStyles(livePhraseDocument(draft, group));
  let offset = 0;
  return livePhraseLines(draft, group).map((text) => {
    const line = { text, styles: Array.from({ length: text.length }, (_, at) => styles[offset + at] ?? {}) };
    offset += text.length + 1;
    return line;
  });
}

/** Writes the phrases back: the list in the shape of the editor's field and one document for the whole group (the lines joined by a line break, a plain separator between them). */
function writePhrases(draft: PortiaContent, group: LivePhraseGroup, lines: PhraseLine[]): void {
  const texts = lines.map((line) => line.text);
  if (group === "advice") draft.assistantAdvice = texts;
  else if (group === "offended") { draft.assistantOffendedPhrases = texts; draft.assistantOffendedPhrase = texts.find((item) => item.trim()) ?? ""; }
  else if (group === "idle") draft.assistantIdlePhrases = texts;
  else draft.assistantActivityPhrases = texts;
  draft.formattedText[PHRASE_KEY[group]] = compactRuns(texts.join("\n"), lines.flatMap((line, at) => (at ? [{}, ...line.styles] : line.styles)));
}

/**
 * Writes one phrase. `document` is its own formatting (from the format panel); without it the styles the phrase had are kept where the text is the same (as typing in the editor's field does).
 * A line break makes a new phrase, as it does in the editor's field. False, and nothing written, when the phrase is gone.
 */
export function applyLivePhrase(draft: PortiaContent, target: Extract<LiveTarget, { kind: "assistant-phrase" }>, value: string, document?: RichTextDocument): boolean {
  const lines = readPhrases(draft, target.group);
  const old = lines[target.index];
  if (!Number.isInteger(target.index) || !old) return false;
  const own = document && document.runs.map((run) => run.text).join("") === value ? document : replaceRichTextRuns(compactRuns(old.text, old.styles), value);
  const styles = expandStyles(own);
  let offset = 0;
  const parts = value.split("\n").map((text) => {
    const part = { text, styles: styles.slice(offset, offset + text.length) };
    offset += text.length + 1;
    return part;
  });
  lines.splice(target.index, 1, ...parts);
  writePhrases(draft, target.group, lines);
  return true;
}

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
  | { kind: "log-level"; virusId: string; logId: string }
  /** The type of a file of the bin, and the virus of the archive a «file of a virus» is linked to ("" - none). */
  | { kind: "recycle-file-kind"; fileId: string }
  | { kind: "recycle-file-virus"; fileId: string };

const RECYCLE_FILE_KINDS = ["virus", "text", "image"] as const;

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
  if (target.kind === "recycle-file-kind" || target.kind === "recycle-file-virus") {
    const file = draft.recycleFiles.find((item) => item.id === target.fileId);
    if (!file) return false;
    if (target.kind === "recycle-file-kind") {
      if (!(RECYCLE_FILE_KINDS as readonly string[]).includes(value)) return false;
      file.kind = value as (typeof RECYCLE_FILE_KINDS)[number];
    } else {
      if (value !== "" && !draft.viruses.some((item) => item.id === value)) return false;
      file.virusId = value;
    }
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
  if (target.kind === "recycle-file-text") return portiaTextKey.recycle(target.fileId);
  if (target.kind === "assistant-phrase") return PHRASE_KEY[target.group];
  return "";
}

/** The key the format panel knows a place by: the stored key, except a phrase, which has one key of its own (the stored formatting of its group is one document for all its phrases). */
export function liveFormatKey(target: LiveTarget): string {
  return target.kind === "assistant-phrase" ? `${PHRASE_KEY[target.group]}#${target.index}` : liveTextKey(target);
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
  | { kind: "mutation-image"; virusId: string; index: number }
  /** The picture of a file of the bin (26.1-12). */
  | { kind: "recycle-file-image"; fileId: string };

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
    case "recycle-file-name":
    case "recycle-file-location":
    case "recycle-file-text": {
      const file = draft.recycleFiles.find((item) => item.id === target.fileId);
      if (!file) return false;
      if (target.kind === "recycle-file-name") file.name = line; else if (target.kind === "recycle-file-location") file.location = line; else file.content = value;
      return true;
    }
    case "assistant-phrase": return applyLivePhrase(draft, target, value);
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
    // 26.1-16: the places of «Повышения» are data of the server banks; the seam of «Повышения» writes them, not the draft
    case "promo-rules":
    case "promo-question-text":
    case "promo-question-option":
    case "promo-task-text":
      return false;
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
  if (target.kind === "recycle-file-image") {
    const file = draft.recycleFiles.find((item) => item.id === target.fileId);
    if (!file) return null;
    return { address: file.image, set: (url) => { file.image = url; }, frame: (frame) => { if (frame) file.imageFraming = frame; else delete file.imageFraming; } };
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
export type LiveAddKind = "section" | "subsection" | "card" | "heading" | "text" | "table" | "photo" | "video" | "callout" | "cards" | "row" | "news" | "quest" | "mutation" | "log" | "file" | "phrase";

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
  | { kind: "virus"; virusId: string }
  /** The bin: a new file (a virus is written in the editor, its fields are the card's). */
  | { kind: "recycle" }
  /** A group of the phrases of the assistant: a new, empty phrase at its end. */
  | { kind: "assistant-group"; group: LivePhraseGroup };

/** An ordered list the live mode can reorder. */
export type LiveList =
  | { kind: "guide-sections" }
  | { kind: "guide-cards"; sectionId: string }
  | { kind: "guide-blocks"; cardId: string }
  | { kind: "info-sections" }
  | { kind: "info-subsections"; sectionId: string }
  | { kind: "info-blocks"; subsectionId: string }
  /** The viruses of the archive, in the order of the list. */
  | { kind: "viruses" }
  /** The rows of the bin, files and viruses together, in the order the editor keeps (recycleOrder). */
  | { kind: "recycle" };

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
  | { kind: "log"; virusId: string; logId: string }
  | { kind: "recycle-file"; fileId: string }
  | { kind: "recycled-virus"; virusId: string }
  /** A phrase of the assistant; the last one of «обида», «бездействие» and «активность» cannot go (the save would bring a default phrase back). */
  | { kind: "assistant-phrase"; group: LivePhraseGroup; index: number };

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
  if (container.kind === "recycle") return ["file"];
  if (container.kind === "assistant-group") return ["phrase"];
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
  if (kind === "file") return makeId("file");
  if (kind === "mutation") return makeId("mutation");
  if (kind === "phrase") return makeId("phrase");
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
  if (container.kind === "recycle") {
    draft.recycleFiles.push({ id, name: "НОВЫЙ_ФАЙЛ.txt", location: "C:\\PORTIA\\RECYCLE_BIN", kind: "text", content: "", image: "", virusId: "" });
    draft.recycleOrder = [...liveRecycleKeys(draft).filter((key) => key !== `file:${id}`), `file:${id}`];
    return id;
  }
  if (container.kind === "assistant-group") {
    // A phrase has no id: it is found by its position, and its new, empty line goes at the end of the group (the editor's field gets one by a line break).
    const lines = readPhrases(draft, container.group);
    lines.push({ text: "", styles: [] });
    writePhrases(draft, container.group, lines);
    return String(lines.length - 1);
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
  if (list.kind === "recycle") return null;
  return findGuide(draft.guideSections, list.cardId)?.card?.blocks ?? null;
}

/** The rows of the bin as the editor reads them: the stored order without the keys of what is gone, then every file and virus the order misses. */
export function liveRecycleKeys(content: PortiaContent): string[] {
  const files = content.recycleFiles.map((file) => `file:${file.id}`);
  const viruses = (content.recycledViruses ?? []).map((virus) => `virus:${virus.id}`);
  const valid = new Set([...files, ...viruses]);
  return [...new Set([...(content.recycleOrder ?? []).filter((key) => valid.has(key)), ...files, ...viruses])];
}

/** Moves one item of an ordered list; false (nothing changed) when the list is gone or an index is out of range or the same. */
export function applyLiveMove(draft: PortiaContent, list: LiveList, from: number, to: number): boolean {
  if (list.kind === "recycle") {
    const order = liveRecycleKeys(draft);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= order.length || to >= order.length || from === to) return false;
    const [key] = order.splice(from, 1);
    order.splice(to, 0, key);
    draft.recycleOrder = order;
    return true;
  }
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
  if (item.kind === "recycle-file") return [portiaTextKey.recycle(item.fileId)];
  // A phrase has the format key of its position: the removed one and every later one change their key.
  if (item.kind === "assistant-phrase") return Array.from({ length: Math.max(0, livePhraseLines(draft, item.group).length - item.index) }, (_, step) => `${PHRASE_KEY[item.group]}#${item.index + step}`);
  if (item.kind === "recycled-virus") {
    const virus = findLiveVirus(draft, item.virusId);
    return [...Object.keys(draft.formattedText).filter((key) => key.startsWith(`virus:${item.virusId}:`)), ...(virus?.scientistLogs ?? []).map((log) => `scientist:${log.id}`)];
  }
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
  if (item.kind === "assistant-phrase") {
    const lines = readPhrases(draft, item.group);
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= lines.length || (item.group !== "advice" && lines.length <= 1)) return false;
    lines.splice(item.index, 1);
    writePhrases(draft, item.group, lines);
    return true;
  }
  if (item.kind === "recycle-file") {
    if (!draft.recycleFiles.some((file) => file.id === item.fileId)) return false;
    removeRecycleFile(draft, item.fileId);
    draft.recycleOrder = liveRecycleKeys(draft);
    return true;
  }
  if (item.kind === "recycled-virus") {
    if (!(draft.recycledViruses ?? []).some((virus) => virus.id === item.virusId)) return false;
    removeRecycledVirus(draft, item.virusId);
    draft.recycleOrder = liveRecycleKeys(draft);
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
  if (container.kind === "guide-root" || container.kind === "broadcasts" || container.kind === "recycle" || container.kind === "assistant-group") return false;
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

/** The timing settings of the assistant the live mode changes («Время показа»); every field is optional, the rest of the draft keeps its value. */
export type LiveSettingsPatch = {
  idleEnabled?: boolean;
  activityEnabled?: boolean;
  /** The seconds of patience, one or more; the first one is the patience of the assistant (as in the editor's field). */
  patienceVariants?: number[];
  autoTimingMode?: PortiaContent["assistantAutoTimingMode"];
  autoIntervalSeconds?: number;
  autoMinSeconds?: number;
  autoMaxSeconds?: number;
};

/** The same limits as the number fields of the editor's form (min 1, max 3600). */
const AUTO_SECONDS = { min: 1, max: 3600 } as const;

const wholeSeconds = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const whole = Math.round(value);
  return whole >= AUTO_SECONDS.min && whole <= AUTO_SECONDS.max ? whole : null;
};

/** The writer of a patch when every value of it is right (the minimum not above the maximum counted with the draft's own other value); null when one is not. */
function settingsWriter(draft: PortiaContent, patch: LiveSettingsPatch): (() => void) | null {
  if (patch.idleEnabled !== undefined && typeof patch.idleEnabled !== "boolean") return null;
  if (patch.activityEnabled !== undefined && typeof patch.activityEnabled !== "boolean") return null;
  if (patch.autoTimingMode !== undefined && patch.autoTimingMode !== "fixed" && patch.autoTimingMode !== "random") return null;
  const variants = patch.patienceVariants;
  if (variants !== undefined && (!Array.isArray(variants) || !variants.length || !variants.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0))) return null;
  const interval = patch.autoIntervalSeconds === undefined ? undefined : wholeSeconds(patch.autoIntervalSeconds);
  const min = patch.autoMinSeconds === undefined ? undefined : wholeSeconds(patch.autoMinSeconds);
  const max = patch.autoMaxSeconds === undefined ? undefined : wholeSeconds(patch.autoMaxSeconds);
  if (interval === null || min === null || max === null) return null;
  if ((min ?? draft.assistantAutoMinSeconds) > (max ?? draft.assistantAutoMaxSeconds)) return null;
  return () => {
    if (patch.idleEnabled !== undefined) draft.assistantIdleEnabled = patch.idleEnabled;
    if (patch.activityEnabled !== undefined) draft.assistantActivityEnabled = patch.activityEnabled;
    if (patch.autoTimingMode !== undefined) draft.assistantAutoTimingMode = patch.autoTimingMode;
    if (variants !== undefined) { draft.assistantPatienceVariants = [...variants]; draft.assistantPatienceSeconds = variants[0]; }
    if (interval !== undefined) draft.assistantAutoIntervalSeconds = interval;
    if (min !== undefined) draft.assistantAutoMinSeconds = min;
    if (max !== undefined) draft.assistantAutoMaxSeconds = max;
  };
}

/** True when the patch would be written as it is (the field shows its own error otherwise); writes nothing. */
export function liveSettingsOk(draft: PortiaContent, patch: LiveSettingsPatch): boolean {
  return settingsWriter(draft, patch) !== null;
}

/** Writes the settings; false, and nothing written (not even a right part of the patch), when one value is outside the limits of the editor's form (T-26.1-29). */
export function applyLiveSettings(draft: PortiaContent, patch: LiveSettingsPatch): boolean {
  const write = settingsWriter(draft, patch);
  if (!write) return false;
  write();
  return true;
}

// ---- «Повышение» (26.1-16): the candidate's view is edited in place, and its data is the banks of the server, not the draft. These functions only build the bodies of the commands. ----

export type PromoQuestionType = "single" | "multiple" | "free-text";

/** A question as the server accepts it (the shape of the question check of the banks). */
export type PromoQuestion =
  | { type: "single"; text: string; options: string[]; answer: number }
  | { type: "multiple"; text: string; options: string[]; answer: number[] }
  | { type: "free-text"; text: string; answer: string };

/** The check of a question the dialog and the server use (validateQuestionDraft of the reviewer). It is handed in, so this model keeps no import of the server side of the banks. */
export type PromoQuestionCheck = (value: unknown) => PromoQuestion | null;

/** A question or an ordinary task of a bank, as the reviewer's bank listing gives it. */
export type PromoBankItem = { id: string; text: string; active: boolean; sortOrder: number; type?: PromoQuestionType; options?: Array<{ text: string }> | string[]; answerKey?: unknown };

/** What an in-place edit changes of a question: its text, the text of one variant, its switch, its place. */
export type PromoQuestionEdit = { text: string } | { option: number; text: string } | { active: boolean } | { sortOrder: number };

/** The body of `save-question` (without the bank and the question id). */
export type PromoQuestionBody = { question: PromoQuestion; active: boolean; sortOrder: number };

/**
 * The body of `save-question` for an edited question: the type, the other variants, the correct answer, the switch and the place stay as they were.
 * Null, and no command, when the result would not pass the check of the dialog and the server (an empty text, two equal variants, an answer that no longer fits).
 */
export function promoQuestionEdit(item: PromoBankItem, edit: PromoQuestionEdit, check: PromoQuestionCheck): PromoQuestionBody | null {
  const type = item.type ?? "free-text";
  const options = (item.options ?? []).map((option) => (typeof option === "string" ? option : option.text));
  let text = item.text;
  if ("option" in edit) {
    if (type === "free-text" || !Number.isInteger(edit.option) || edit.option < 0 || edit.option >= options.length) return null;
    options[edit.option] = edit.text;
  } else if ("text" in edit) text = edit.text;
  const question = check(type === "free-text" ? { type, text, answer: String(item.answerKey ?? "Ответ") } : { type, text, options, answer: item.answerKey ?? 0 });
  if (!question) return null;
  return { question, active: "active" in edit ? edit.active : item.active, sortOrder: "sortOrder" in edit ? edit.sortOrder : item.sortOrder };
}

/** A new question of the add bar: placeholder texts, which the owner then edits in place; the first variant is the answer, which the dialog «Ответ» changes. */
export function promoNewQuestion(type: PromoQuestionType): PromoQuestion {
  if (type === "free-text") return { type, text: "Новый вопрос", answer: "Ответ" };
  return type === "single"
    ? { type, text: "Новый вопрос", options: ["Вариант 1", "Вариант 2"], answer: 0 }
    : { type, text: "Новый вопрос", options: ["Вариант 1", "Вариант 2"], answer: [0] };
}

/** The text of a new ordinary task. */
export const PROMO_NEW_TASK_TEXT = "Новое задание";

/** The place after the last item. */
export function promoNextOrder(items: readonly { sortOrder: number }[]): number {
  return items.reduce((top, item) => Math.max(top, item.sortOrder), -1) + 1;
}

/** The ids with the one at `from` put at `to`; the same list when either is out of the list. */
export function promoMoveId(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * The new places of the items after they were put in the order of `orderedIds`: the places the items hold now are handed out again in that order, so a move of one row
 * is the swap the arrows of the ordinary tab make, and only the items whose place changes are listed (one command each).
 */
export function promoOrderChanges(items: readonly { id: string; sortOrder: number }[], orderedIds: readonly string[]): Array<{ id: string; sortOrder: number }> {
  const held = items.map((item) => item.sortOrder).sort((first, second) => first - second);
  // equal places could not tell the new order apart: then the items are numbered from zero
  const places = new Set(held).size === held.length ? held : held.map((_, at) => at);
  const byId = new Map(items.map((item) => [item.id, item]));
  const changes: Array<{ id: string; sortOrder: number }> = [];
  orderedIds.forEach((id, at) => {
    const item = byId.get(id);
    if (item && at < places.length && item.sortOrder !== places[at]) changes.push({ id, sortOrder: places[at] });
  });
  return changes;
}
