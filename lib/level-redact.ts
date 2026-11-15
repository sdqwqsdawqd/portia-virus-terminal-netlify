// Phase 24, D-04: server-side redaction. A closed record never reaches the response: it is left out of the arrays and its
// place is marked in `redaction`. The browser only draws what arrived. Pure, no node: imports, never mutates its input.
import { requiredLevelOf, type AccessLevel } from "./access-levels.ts";
import type { ContentRedaction, PortiaContent, RedactedSlot, Virus } from "./portia-content.ts";

// Opaque, stable key of one record id (the HMAC lives in content-response.ts). It never contains the id.
export type SlotKey = (id: string) => string;

// Prefixes of PortiaContent.formattedText keys, from portiaTextKey in portia-content.ts. A key with any other prefix is
// dropped (fail closed): a new kind of text must be added here on purpose before a visitor can receive it.
const KNOWN_TEXT_PREFIXES = ["virus:", "info:", "info-block:", "guide-block:", "broadcast:", "recycle:", "search:", "assistant:"] as const;

const hasWithheld = (virus: Virus) => virus.scientistLogs.some((log) => log.withheld !== undefined);

function withoutWithheld(virus: Virus): Virus {
  if (!hasWithheld(virus)) return virus;
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

function textKeyAllowed(key: string, openVirusIds: readonly string[], closedVirusIds: readonly string[]): boolean {
  const prefix = KNOWN_TEXT_PREFIXES.find((candidate) => key.startsWith(candidate));
  if (!prefix) return false;
  if (prefix !== "virus:") return true;
  if (closedVirusIds.some((id) => key.startsWith(`virus:${id}:`))) return false;
  return openVirusIds.some((id) => key.startsWith(`virus:${id}:`));
}

// Splits a list by level: the open items in their own order, a node for each closed one at the index it has in the full list.
function splitByLevel<T extends { id: string; level?: AccessLevel }>(items: readonly T[], level: AccessLevel, slotOf: SlotKey) {
  const open: T[] = [];
  const closed: RedactedSlot[] = [];
  const closedIds: string[] = [];
  items.forEach((item, index) => {
    const required = requiredLevelOf(item.level);
    if (required <= level) open.push(item);
    else {
      closed.push({ slot: slotOf(item.id), requiredLevel: required, at: index });
      closedIds.push(item.id);
    }
  });
  return { open, closed, closedIds };
}

export function redactContentForViewer(content: PortiaContent, level: AccessLevel, slotOf: SlotKey): PortiaContent {
  const viruses = splitByLevel(content.viruses, level, slotOf);

  const slots: Record<string, string> = {};
  for (const virus of viruses.open) slots[virus.id] = slotOf(virus.id);

  const redaction: ContentRedaction = {
    level,
    slots,
    viruses: viruses.closed,
    recycle: [],
    infoSections: [],
    infoSubsections: {},
    guideSections: [],
    guideCards: {},
    apps: {},
  };

  // The recycle bin is not closed in this slice (plan 24-05), so every bin virus keeps its text keys.
  const openVirusIds = [...viruses.open.map((virus) => virus.id), ...content.recycledViruses.map((virus) => virus.id)];
  const formattedText = Object.fromEntries(
    Object.entries(content.formattedText).filter(([key]) => textKeyAllowed(key, openVirusIds, viruses.closedIds)),
  );

  return { ...content, viruses: viruses.open, formattedText, redaction };
}
