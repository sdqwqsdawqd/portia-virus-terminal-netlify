// Phase 24, D-04: server-side redaction. A closed record never reaches the response: it is left out of the arrays and its
// place is marked in `redaction`. The browser only draws what arrived. Pure, no node: imports, never mutates its input.
//
// Rules this module keeps (each one has canary tests in level-redact.test.ts):
// - D-04: every field of the answer is built by name below, never by spreading the stored top-level object, so a field added
//   to the content later does not reach a visitor until it is placed here on purpose. `formattedText` is an allow-list.
// - D-10: a closed section is one node and nothing about its children (no key in infoSubsections / guideCards).
// - D-12: the only narrow exception — a closed scientist record of an open virus stays in place with its title and scientist
//   and `withheld: true`, its text is gone. It does not apply to a virus, a section, a subsection or a card.
// - O-3 / A-4 (assumption, not an owner decision): a closed virus in the recycle bin is a placeholder at its place in the order.
// - Free text of broadcasts and assistant phrases is not leveled: if an editor names a closed record there, the server does
//   not cut it. This is a known limit written in .planning/PROJECT.md, not hidden.
import { requiredLevelOf, type AccessLevel } from "./access-levels.ts";
import { effectiveLevel } from "./level-hierarchy.ts";
import type { ContentRedaction, PortiaContent, RedactedSlot, ScientistLog, Virus } from "./portia-content.ts";
import { normalizeSearch } from "./search-index.ts";

// Opaque, stable key of one record id (the HMAC lives in content-response.ts). It never contains the id.
export type SlotKey = (id: string) => string;

const BASE_LEVEL = requiredLevelOf(undefined);
// A search line and a closed name this short would match half of the language.
const MIN_TERM_LENGTH = 2;

function withoutWithheld(virus: Virus): Virus {
  if (!virus.scientistLogs.some((log) => log.withheld !== undefined)) return virus;
  return {
    ...virus,
    scientistLogs: virus.scientistLogs.map((log) => {
      const rest = { ...log };
      delete rest.withheld;
      return rest;
    }),
  };
}

// The stored payload must never carry the viewer's markers: a direct write to the database cannot make the editor see
// (or save back) a copy built for a visitor.
export function withoutViewerMarkers(content: PortiaContent): PortiaContent {
  const rest = { ...content };
  delete rest.redaction;
  return {
    ...rest,
    viruses: rest.viruses.map(withoutWithheld),
    recycledViruses: rest.recycledViruses.map(withoutWithheld),
  };
}

// D-12: a closed record keeps five fields and the marker; richContent and any unknown key are not copied.
function redactScientistLogs(virus: Virus, level: AccessLevel): Virus {
  if (!virus.scientistLogs.some((log) => requiredLevelOf(log.lockedLevel) > level)) return virus;
  return {
    ...virus,
    scientistLogs: virus.scientistLogs.map((log): ScientistLog => {
      const required = requiredLevelOf(log.lockedLevel);
      if (required <= level) return log;
      return { id: log.id, title: log.title, scientist: log.scientist, lockedLevel: required, content: [], withheld: true };
    }),
  };
}

type Leveled = { id: string; title: string; level?: AccessLevel };

// A section tree (info: section -> subsection, guide: section -> card). The open sections keep their own order, each with
// its open children in their own order. A closed section is one node and its children leave no trace but their titles in
// `terms` (D-10). A child's level is max(own, section) (effectiveLevel), a closed child is a node in its section's list.
function redactTree<S extends Leveled, C extends Leveled>(
  sections: readonly S[],
  childrenOf: (section: S) => readonly C[],
  rebuild: (section: S, children: C[]) => S,
  level: AccessLevel,
  slotOf: SlotKey,
  slots: Record<string, string>,
  terms: string[],
) {
  const open: S[] = [];
  const closed: RedactedSlot[] = [];
  const closedChildren: Record<string, RedactedSlot[]> = {};
  const openChildren: C[] = [];
  sections.forEach((section, index) => {
    const required = requiredLevelOf(section.level);
    if (required > level) {
      closed.push({ slot: slotOf(section.id), requiredLevel: required, at: index });
      terms.push(section.title, ...childrenOf(section).map((child) => child.title));
      return;
    }
    const keep: C[] = [];
    const nodes: RedactedSlot[] = [];
    childrenOf(section).forEach((child, childIndex) => {
      const own = effectiveLevel(child.level, required);
      if (own <= level) {
        keep.push(child);
        slots[child.id] = slotOf(child.id);
      } else {
        nodes.push({ slot: slotOf(child.id), requiredLevel: own, at: childIndex });
        terms.push(child.title);
      }
    });
    open.push(rebuild(section, keep));
    openChildren.push(...keep);
    slots[section.id] = slotOf(section.id);
    if (nodes.length) closedChildren[section.id] = nodes;
  });
  return { open, closed, closedChildren, openChildren };
}

// A recommendation line goes if it contains a closed name or is part of one (both after normalizeSearch, both long enough).
function namesClosedRecord(line: string, terms: readonly string[]): boolean {
  const text = normalizeSearch(line.trim());
  if (text.length < MIN_TERM_LENGTH) return false;
  return terms.some((term) => text.includes(term) || term.includes(text));
}

const VIRUS_TEXT_KEY = /^virus:(.+):(?:external|physiology|ppu-health|ppu-speed|ppu-abilities|mutation:\d+:description)$/;
const INFO_BODY_KEY = /^info:(.+):body$/;
const INFO_BLOCK_KEY = /^info-block:(.+):text$/;
const GUIDE_BLOCK_KEY = /^guide-block:(.+):text$/;
const BROADCAST_KEY = /^broadcast:(.+):body$/;
const RECYCLE_KEY = /^recycle:(.+):content$/;
const SEARCH_RECOMMENDATIONS_KEY = "search:recommendations";
const ASSISTANT_PREFIX = "assistant:";

export function redactContentForViewer(content: PortiaContent, level: AccessLevel, slotOf: SlotKey): PortiaContent {
  const slots: Record<string, string> = {};
  // Names that identify a closed record; a search recommendation naming one of them is dropped.
  const terms: string[] = [];

  // Viruses: live ones and the ones in the recycle bin. The file made from a virus takes the level of that virus.
  const virusLevels = new Map<string, AccessLevel>();
  for (const virus of [...content.viruses, ...content.recycledViruses]) virusLevels.set(virus.id, requiredLevelOf(virus.level));
  const isVirusOpen = (virus: Virus) => requiredLevelOf(virus.level) <= level;

  const openViruses = content.viruses.filter(isVirusOpen);
  const openRecycled = content.recycledViruses.filter(isVirusOpen);
  const closedViruses = [...content.viruses, ...content.recycledViruses].filter((virus) => !isVirusOpen(virus));
  for (const virus of closedViruses) terms.push(virus.name, virus.code);
  const virusRows: RedactedSlot[] = [];
  content.viruses.forEach((virus, index) => {
    if (!isVirusOpen(virus)) virusRows.push({ slot: slotOf(virus.id), requiredLevel: requiredLevelOf(virus.level), at: index });
  });
  for (const virus of [...openViruses, ...openRecycled]) slots[virus.id] = slotOf(virus.id);

  // The recycle bin. A text or image file is level 1; a virus file follows its virus (not found = level 1).
  const fileLevel = (file: PortiaContent["recycleFiles"][number]): AccessLevel =>
    file.kind === "virus" ? (virusLevels.get(file.virusId) ?? BASE_LEVEL) : BASE_LEVEL;
  const openFiles = content.recycleFiles.filter((file) => fileLevel(file) <= level);
  for (const file of content.recycleFiles) if (fileLevel(file) > level) terms.push(file.name);
  for (const file of openFiles) slots[file.id] = slotOf(file.id);
  const filesById = new Map(content.recycleFiles.map((file) => [file.id, file]));
  const recycledById = new Map(content.recycledViruses.map((virus) => [virus.id, virus]));
  const recycleOrder: string[] = [];
  const recycleRows: RedactedSlot[] = [];
  content.recycleOrder.forEach((key, index) => {
    let id: string;
    let required: AccessLevel;
    if (key.startsWith("file:")) {
      id = key.slice("file:".length);
      const file = filesById.get(id);
      if (!file) return;
      required = fileLevel(file);
    } else if (key.startsWith("virus:")) {
      id = key.slice("virus:".length);
      const virus = recycledById.get(id);
      if (!virus) return;
      required = requiredLevelOf(virus.level);
    } else return;
    if (required <= level) recycleOrder.push(key);
    else recycleRows.push({ slot: slotOf(id), requiredLevel: required, at: index });
  });

  // «Информация» and «Справочник».
  const info = redactTree(content.infoSections, (section) => section.subsections, (section, subsections) => ({ ...section, subsections }), level, slotOf, slots, terms);
  const guide = redactTree(content.guideSections, (section) => section.cards, (section, cards) => ({ ...section, cards }), level, slotOf, slots, terms);

  // The two redaction apps.
  const apps: ContentRedaction["apps"] = {};
  const charterRequired = requiredLevelOf(content.appLevels?.charter);
  if (charterRequired > level) apps.charter = { requiredLevel: charterRequired };

  // Search recommendations: a line naming a closed record goes, and with it the shared formatting document of the list.
  const closedTerms = terms.map((term) => normalizeSearch(term.trim())).filter((term) => term.length >= MIN_TERM_LENGTH);
  const searchRecommendations = content.searchRecommendations.filter((line) => !namesClosedRecord(line, closedTerms));
  const recommendationsChanged = searchRecommendations.length !== content.searchRecommendations.length;

  // `formattedText` is an allow-list (D-04): a key is kept only when it names an open record that exists. Unknown prefixes go.
  const openVirusIds = new Set([...openViruses, ...openRecycled].map((virus) => virus.id));
  const openInfoSectionIds = new Set(info.open.map((section) => section.id));
  const openInfoBlockIds = new Set(info.openChildren.flatMap((subsection) => subsection.blocks.map((block) => block.id)));
  const openGuideBlockIds = new Set(guide.openChildren.flatMap((card) => card.blocks.map((block) => block.id)));
  const openFileIds = new Set(openFiles.map((file) => file.id));
  const broadcastIds = new Set(content.broadcasts.map((broadcast) => broadcast.id));
  const textKeyAllowed = (key: string): boolean => {
    if (key.startsWith(ASSISTANT_PREFIX)) return true;
    if (key === SEARCH_RECOMMENDATIONS_KEY) return !recommendationsChanged;
    const pairs: [RegExp, Set<string>][] = [
      [VIRUS_TEXT_KEY, openVirusIds],
      [INFO_BODY_KEY, openInfoSectionIds],
      [INFO_BLOCK_KEY, openInfoBlockIds],
      [GUIDE_BLOCK_KEY, openGuideBlockIds],
      [RECYCLE_KEY, openFileIds],
      [BROADCAST_KEY, broadcastIds],
    ];
    for (const [pattern, ids] of pairs) {
      const match = pattern.exec(key);
      if (match) return ids.has(match[1]);
    }
    return false;
  };
  const formattedText = Object.fromEntries(Object.entries(content.formattedText).filter(([key]) => textKeyAllowed(key)));

  const redaction: ContentRedaction = {
    level,
    slots,
    viruses: virusRows,
    recycle: recycleRows,
    infoSections: info.closed,
    infoSubsections: info.closedChildren,
    guideSections: guide.closed,
    guideCards: guide.closedChildren,
    apps,
  };

  return {
    viruses: openViruses.map((virus) => redactScientistLogs(virus, level)),
    recycledViruses: openRecycled.map((virus) => redactScientistLogs(virus, level)),
    infoSections: info.open,
    guideSections: guide.open,
    broadcasts: content.broadcasts,
    recycleFiles: openFiles,
    recycleOrder,
    searchRecommendations,
    // The editor's own views of the two lists carry free text; the site reads only the flat lists.
    broadcastSections: [],
    searchRecommendationSections: [],
    assistantAdvice: content.assistantAdvice,
    assistantOffendedPhrase: content.assistantOffendedPhrase,
    assistantOffendedPhrases: content.assistantOffendedPhrases,
    assistantPatienceSeconds: content.assistantPatienceSeconds,
    assistantPatienceVariants: content.assistantPatienceVariants,
    assistantIdlePhrases: content.assistantIdlePhrases,
    assistantActivityPhrases: content.assistantActivityPhrases,
    assistantIdleEnabled: content.assistantIdleEnabled,
    assistantActivityEnabled: content.assistantActivityEnabled,
    assistantAutoTimingMode: content.assistantAutoTimingMode,
    assistantAutoIntervalSeconds: content.assistantAutoIntervalSeconds,
    assistantAutoMinSeconds: content.assistantAutoMinSeconds,
    assistantAutoMaxSeconds: content.assistantAutoMaxSeconds,
    formattedText,
    redaction,
  };
}
