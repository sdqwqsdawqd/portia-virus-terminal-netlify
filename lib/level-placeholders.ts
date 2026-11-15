// Phase 24: the place of a closed record. Shared by the server (it writes the markers) and the browser (it reads them), so no
// node: imports. The browser only draws what the server sent; it never decides what is closed (D-04).
import { MAX_ACCESS_LEVEL, MIN_ACCESS_LEVEL, isAccessLevel, type AccessLevel } from "./access-levels.ts";
import { LEVELED_APP_IDS, findGuide, findInfo, type ContentRedaction, type PortiaContent, type RedactedSlot } from "./portia-content.ts";

const MAX_KEY_LENGTH = 240;

export type MergedRow<T> =
  | { kind: "item"; item: T; position: number }
  | { kind: "redacted"; slot: string; requiredLevel: AccessLevel; position: number };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// A node always names a level it needs; a missing or damaged one is not "level 1", it reads as the highest (D-03).
const nodeLevel = (raw: unknown): AccessLevel => (isAccessLevel(raw) ? raw : MAX_ACCESS_LEVEL);

function normalizeSlots(value: unknown): RedactedSlot[] {
  if (!Array.isArray(value)) return [];
  const nodes: RedactedSlot[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const { slot, at } = raw;
    if (typeof slot !== "string" || !slot || slot.length > MAX_KEY_LENGTH) continue;
    if (typeof at !== "number" || !Number.isInteger(at) || at < 0) continue;
    nodes.push({ slot, requiredLevel: nodeLevel(raw.requiredLevel), at });
  }
  return nodes;
}

function normalizeSlotMap(value: unknown): Record<string, RedactedSlot[]> {
  const result: Record<string, RedactedSlot[]> = {};
  if (!isRecord(value)) return result;
  for (const [key, list] of Object.entries(value)) {
    if (!key || key.length > MAX_KEY_LENGTH) continue;
    result[key] = normalizeSlots(list);
  }
  return result;
}

function normalizeSlotIndex(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(value)) return result;
  for (const [id, slot] of Object.entries(value)) {
    if (!id || id.length > MAX_KEY_LENGTH) continue;
    if (typeof slot !== "string" || !slot || slot.length > MAX_KEY_LENGTH) continue;
    result[id] = slot;
  }
  return result;
}

function normalizeApps(value: unknown): ContentRedaction["apps"] {
  const result: ContentRedaction["apps"] = {};
  if (!isRecord(value)) return result;
  for (const id of LEVELED_APP_IDS) {
    const entry = value[id];
    if (!isRecord(entry)) continue;
    result[id] = { requiredLevel: nodeLevel(entry.requiredLevel) };
  }
  return result;
}

// undefined/null -> undefined (the copy is not for a visitor). Anything else keeps a marker: a damaged marker is level 1 with
// empty lists, so the viewer sees less, never more (fail closed).
export function normalizeContentRedaction(value: unknown): ContentRedaction | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = isRecord(value) ? value : {};
  return {
    level: isAccessLevel(raw.level) ? raw.level : MIN_ACCESS_LEVEL,
    slots: normalizeSlotIndex(raw.slots),
    viruses: normalizeSlots(raw.viruses),
    recycle: normalizeSlots(raw.recycle),
    infoSections: normalizeSlots(raw.infoSections),
    infoSubsections: normalizeSlotMap(raw.infoSubsections),
    guideSections: normalizeSlots(raw.guideSections),
    guideCards: normalizeSlotMap(raw.guideCards),
    apps: normalizeApps(raw.apps),
  };
}

// Open items in their own order, each placeholder at the index it had in the full list: the full list is restored.
// A placeholder past the end goes last; no placeholder list gives only the items.
export function mergePlaceholders<T>(items: readonly T[], placeholders: readonly RedactedSlot[] | undefined): MergedRow<T>[] {
  const rows: MergedRow<T>[] = [];
  const pending = [...(placeholders ?? [])].sort((a, b) => a.at - b.at);
  let next = 0;
  let nextItem = 0;
  const pushPlaceholder = (node: RedactedSlot) => {
    rows.push({ kind: "redacted", slot: node.slot, requiredLevel: node.requiredLevel, position: rows.length });
  };
  while (nextItem < items.length || next < pending.length) {
    if (next < pending.length && pending[next].at <= rows.length) {
      pushPlaceholder(pending[next]);
      next += 1;
    } else if (nextItem < items.length) {
      rows.push({ kind: "item", item: items[nextItem], position: rows.length });
      nextItem += 1;
    } else {
      pushPlaceholder(pending[next]);
      next += 1;
    }
  }
  return rows;
}

// The copy is shaped for a visitor if it carries the marker or any withheld scientist record (D-12).
export function isViewerShapedContent(content: Pick<PortiaContent, "viruses" | "recycledViruses" | "redaction">): boolean {
  if (content.redaction !== undefined) return true;
  return [...content.viruses, ...content.recycledViruses].some((virus) => virus.scientistLogs.some((log) => log.withheld === true));
}

// WR-03: the level the visitor sees on screen. The marker of the copy first, then the level of the gate decision (the editor
// copy has no marker, and the gate says 5 for the editor), and only then the lowest level: an unknown level reads as the least, never as 5.
export function shownViewerLevel(content: Pick<PortiaContent, "redaction">, viewerLevel?: number | null): AccessLevel {
  return content.redaction?.level ?? (isAccessLevel(viewerLevel) ? viewerLevel : MIN_ACCESS_LEVEL);
}

export type SelectionState = { id: string; lostSlot: string | null };
export type SelectionResult = { id: string; lostSlot: string | null; lostLevel: AccessLevel | null };

// D-20/D-22: one pure rule for a window that lists records. An open record stays; a record that became closed leaves the
// placeholder of its own slot (a closed parent wins by chain order); a lost slot that is open again gives the record back
// without a notice; a deleted record gives an empty result and the caller picks the first open one. The result carries only the
// slot and the level of the placeholder, never the previous copy of the record (T-24-38).
export function reconcileSelection(
  prev: SelectionState,
  prevChain: readonly string[],
  next: { ids: readonly string[]; slots: Record<string, string>; placeholders: readonly RedactedSlot[] },
): SelectionResult {
  const open = { lostSlot: null, lostLevel: null };
  if (prev.id && next.ids.includes(prev.id)) return { id: prev.id, ...open };
  if (prev.lostSlot) {
    const reopened = Object.keys(next.slots).find((id) => next.slots[id] === prev.lostSlot && next.ids.includes(id));
    if (reopened !== undefined) return { id: reopened, ...open };
  }
  const candidates = [prev.lostSlot, ...prevChain].filter((slot): slot is string => typeof slot === "string" && slot !== "");
  for (const slot of candidates) {
    const node = next.placeholders.find((placeholder) => placeholder.slot === slot);
    if (node) return { id: "", lostSlot: slot, lostLevel: node.requiredLevel };
  }
  return { id: "", ...open };
}

export function flattenPlaceholders(map: Record<string, RedactedSlot[]> | undefined): RedactedSlot[] {
  return map ? Object.values(map).flat() : [];
}

const presentSlots = (slots: Record<string, string> | undefined, ids: readonly (string | undefined)[]): string[] =>
  slots ? ids.flatMap((id) => (id !== undefined && slots[id] ? [slots[id]] : [])) : [];

// Slots of a record and of its parents, nearest first. An editor copy has no marker, so the chain is empty.
export function simpleSlotChain(content: Pick<PortiaContent, "redaction">, id: string): string[] {
  return presentSlots(content.redaction?.slots, [id]);
}

export function infoSlotChain(content: Pick<PortiaContent, "infoSections" | "redaction">, id: string): string[] {
  const found = findInfo(content.infoSections, id);
  return presentSlots(content.redaction?.slots, found ? [found.subsection?.id, found.section.id] : [id]);
}

export function guideSlotChain(content: Pick<PortiaContent, "guideSections" | "redaction">, id: string): string[] {
  const found = findGuide(content.guideSections, id);
  return presentSlots(content.redaction?.slots, found ? [found.card?.id, found.section.id] : [id]);
}
