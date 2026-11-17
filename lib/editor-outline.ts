import { broadcastTabOf, type BroadcastTab } from "./broadcasts.ts";
import { MAX_SUBSECTIONS } from "./content-limits.ts";
import {
  portiaTextKey,
  type Broadcast,
  type OutlineSection,
  type PortiaContent,
  type RecommendationSection,
  type RichTextDocument,
  type RichTextStyle,
} from "./portia-content.ts";
import { compactRuns, expandStyles } from "./rich-text-style.ts";

// Sections and subsections of the «Сводка» and «Рекомендации» editor tabs (Phase 20, D-41, D-42).
// Everything is pure: no DOM, no Supabase. Operations mutate the draft they are given, like lib/editor-items.ts.
// There are no editor notes: the owner removed them in 20-33 (supabase/migrations/20261106000000_portia_drop_editor_notes.sql).

/** The id of the section that shows the old flat recommendation list until the first edit writes real sections. */
export const SYNTHETIC_RECOMMENDATION_ID = "search-recommendations-all";
const SYNTHETIC_RECOMMENDATION_TITLE = "Рекомендации";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asText = (value: unknown) => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const sameList = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((item, index) => item === right[index]);

// ---- normalization (reading stored JSON) ----

type Parsed = { id: string; title: string; items: string[]; subs: { id: string; title: string; items: string[] }[] };

// A missing or repeated id becomes a positional one that depends only on the position (stable across polls) and is unique across sections and subsections.
function assignIds(entries: { id: unknown; prefix: string }[]): string[] {
  const taken = new Set<string>();
  const kept = entries.map((entry) => {
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id : "";
    if (!id || taken.has(id)) return "";
    taken.add(id);
    return id;
  });
  return kept.map((id, index) => {
    if (id) return id;
    let derived = `${entries[index].prefix}-${index}`;
    for (let n = 2; taken.has(derived); n += 1) derived = `${entries[index].prefix}-${index}-${n}`;
    taken.add(derived);
    return derived;
  });
}

function parseOutline(value: unknown, idPrefix: string): Parsed[] {
  if (!Array.isArray(value)) return [];
  const raws = value.filter(isRecord).map((section) => ({
    section,
    subs: (Array.isArray(section.subsections) ? section.subsections : []).filter(isRecord),
  }));
  const entries: { id: unknown; prefix: string }[] = [];
  for (const { section, subs } of raws) {
    entries.push({ id: section.id, prefix: idPrefix });
    for (const sub of subs) entries.push({ id: sub.id, prefix: `${idPrefix}-sub` });
  }
  const ids = assignIds(entries);
  let cursor = 0;
  // Only the known fields are copied, so a stored "note" (D-47) or any other extra key is dropped here.
  return raws.map(({ section, subs }) => ({
    id: ids[cursor++],
    title: asText(section.title),
    items: strings(section.items),
    subs: subs.map((sub) => ({ id: ids[cursor++], title: asText(sub.title), items: strings(sub.items) })),
  }));
}

export function normalizeOutlineSections(value: unknown, idPrefix: string): OutlineSection[] {
  return parseOutline(value, idPrefix).map((section) => ({
    id: section.id,
    title: section.title,
    subsections: section.subs.map((sub) => ({ id: sub.id, title: sub.title })),
  }));
}

/** A section's own lines, then each subsection's lines in order: the flat list the site reads. */
export function flattenRecommendationSections(sections: RecommendationSection[]): string[] {
  return sections.flatMap((section) => [...section.items, ...section.subsections.flatMap((sub) => sub.items)]);
}

/** Sections are kept only while they expand to exactly the flat list; otherwise the flat list wins and they are dropped. */
export function normalizeRecommendationSections(value: unknown, flat: string[]): RecommendationSection[] {
  const sections: RecommendationSection[] = parseOutline(value, "recommendation-section").map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items,
    subsections: section.subs.map((sub) => ({ id: sub.id, title: sub.title, items: sub.items })),
  }));
  return sameList(flattenRecommendationSections(sections), flat) ? sections : [];
}

// ---- «Рекомендации»: one tree of lines, rebuilt into sections, the flat list and its formatting after every change ----

/** What the editor shows: the real sections, or one synthetic section for an old flat list (written only on the first edit). */
export function recommendationView(content: PortiaContent): { sections: RecommendationSection[]; synthetic: boolean } {
  const flat = content.searchRecommendations ?? [];
  const sections = content.searchRecommendationSections ?? [];
  if (sections.length && sameList(flattenRecommendationSections(sections), flat)) return { sections, synthetic: false };
  if (flat.length) return { sections: [{ id: SYNTHETIC_RECOMMENDATION_ID, title: SYNTHETIC_RECOMMENDATION_TITLE, items: [...flat], subsections: [] }], synthetic: true };
  return { sections: [], synthetic: false };
}

type Line = { text: string; styles: RichTextStyle[] };
type Group = { id: string; title: string; lines: Line[] };
type Node = Group & { subs: Group[] };

function readLines(flat: readonly string[], document: RichTextDocument | undefined): Line[] {
  const styles = document ? expandStyles(document) : [];
  let offset = 0;
  return flat.map((text) => {
    const line = { text, styles: Array.from({ length: text.length }, (_, index) => styles[offset + index] ?? {}) };
    offset += text.length + 1;
    return line;
  });
}

function buildTree(content: PortiaContent): Node[] {
  const lines = readLines(content.searchRecommendations ?? [], content.formattedText?.[portiaTextKey.searchRecommendations]);
  let cursor = 0;
  const take = (count: number) => lines.slice(cursor, (cursor += count));
  return recommendationView(content).sections.map((section) => ({
    id: section.id,
    title: section.title,
    lines: take(section.items.length),
    subs: section.subsections.map((sub) => ({ id: sub.id, title: sub.title, lines: take(sub.items.length) })),
  }));
}

const joinLines = (lines: Line[]) => {
  const text = lines.map((line) => line.text).join("\n");
  const styles = lines.flatMap((line, index) => (index < lines.length - 1 ? [...line.styles, {}] : line.styles));
  return { text, document: compactRuns(text, styles), styled: styles.some((style) => Object.keys(style).length > 0) };
};

// Every change ends here, so the flat list always equals the expansion of the sections and each line keeps its own styles.
function commitTree(content: PortiaContent, tree: Node[]): void {
  const lines = tree.flatMap((node) => [...node.lines, ...node.subs.flatMap((sub) => sub.lines)]);
  content.searchRecommendationSections = tree.map((node) => ({
    id: node.id,
    title: node.title,
    items: node.lines.map((line) => line.text),
    subsections: node.subs.map((sub) => ({ id: sub.id, title: sub.title, items: sub.lines.map((line) => line.text) })),
  }));
  content.searchRecommendations = lines.map((line) => line.text);
  const joined = joinLines(lines);
  content.formattedText ??= {};
  if (joined.styled || portiaTextKey.searchRecommendations in content.formattedText) content.formattedText[portiaTextKey.searchRecommendations] = joined.document;
}

const findGroup = (tree: Node[], groupId: string): Group | undefined => {
  for (const node of tree) {
    if (node.id === groupId) return node;
    const sub = node.subs.find((item) => item.id === groupId);
    if (sub) return sub;
  }
  return undefined;
};

function moveItem<T>(items: T[], from: number, to: number): boolean {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return false;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  return true;
}

/** The text of one group (its lines joined by newlines) with the stored formatting of exactly those lines. */
export function recommendationGroupText(content: PortiaContent, groupId: string): { text: string; document: RichTextDocument } {
  const group = findGroup(buildTree(content), groupId);
  const { text, document } = joinLines(group?.lines ?? []);
  return { text, document };
}

/** Replaces one group's lines (an empty text means no lines); the lines and styles of every other group stay as they are. */
export function writeRecommendationGroup(content: PortiaContent, groupId: string, text: string, document: RichTextDocument): void {
  const tree = buildTree(content);
  const group = findGroup(tree, groupId);
  if (!group) return;
  const styles = expandStyles(document);
  let offset = 0;
  group.lines = text === ""
    ? []
    : text.split("\n").map((line) => {
        const next = { text: line, styles: Array.from({ length: line.length }, (_, index) => styles[offset + index] ?? {}) };
        offset += line.length + 1;
        return next;
      });
  commitTree(content, tree);
}

/** Every group id the tab can show, synthetic section included: the notes of any other id are stale. */
export function recommendationGroupIds(content: PortiaContent): string[] {
  return recommendationView(content).sections.flatMap((section) => [section.id, ...section.subsections.map((sub) => sub.id)]);
}

export function renameRecommendationGroup(content: PortiaContent, groupId: string, title: string): void {
  const tree = buildTree(content);
  const group = findGroup(tree, groupId);
  if (!group || group.title === title) return;
  group.title = title;
  commitTree(content, tree);
}

export function addRecommendationSection(content: PortiaContent, id: string, title: string): void {
  const tree = buildTree(content);
  if (tree.length >= MAX_SUBSECTIONS || findGroup(tree, id)) return;
  tree.push({ id, title, lines: [], subs: [] });
  commitTree(content, tree);
}

export function addRecommendationSubsection(content: PortiaContent, sectionId: string, id: string, title: string): void {
  const tree = buildTree(content);
  const section = tree.find((node) => node.id === sectionId);
  if (!section || section.subs.length >= MAX_SUBSECTIONS || findGroup(tree, id)) return;
  section.subs.push({ id, title, lines: [] });
  commitTree(content, tree);
}

/** A section goes with its subsections, a subsection with its lines; the formatting of those lines goes with them. */
export function removeRecommendationGroup(content: PortiaContent, groupId: string): void {
  const tree = buildTree(content);
  if (!findGroup(tree, groupId)) return;
  commitTree(content, tree.filter((node) => node.id !== groupId).map((node) => ({ ...node, subs: node.subs.filter((sub) => sub.id !== groupId) })));
}

export function moveRecommendationSection(content: PortiaContent, from: number, to: number): void {
  const tree = buildTree(content);
  if (moveItem(tree, from, to)) commitTree(content, tree);
}

export function moveRecommendationSubsection(content: PortiaContent, sectionId: string, from: number, to: number): void {
  const tree = buildTree(content);
  const section = tree.find((node) => node.id === sectionId);
  if (section && moveItem(section.subs, from, to)) commitTree(content, tree);
}

export function moveRecommendationLine(content: PortiaContent, groupId: string, from: number, to: number): void {
  const tree = buildTree(content);
  const group = findGroup(tree, groupId);
  if (group && moveItem(group.lines, from, to)) commitTree(content, tree);
}

/** Before saving: trims every line of every group, drops the empty ones and rebuilds the flat list. False when the content has no real sections (the caller then trims the flat list as before). */
export function trimRecommendationSections(content: PortiaContent): boolean {
  if (!content.searchRecommendationSections?.length || recommendationView(content).synthetic) return false;
  const trim = (group: Group): Group => ({
    ...group,
    lines: group.lines.flatMap((line) => {
      const text = line.text.trim();
      if (!text) return [];
      const leading = line.text.length - line.text.trimStart().length;
      return [{ text, styles: line.styles.slice(leading, leading + text.length) }];
    }),
  });
  commitTree(content, buildTree(content).map((node) => ({ ...trim(node), subs: node.subs.map(trim) })));
  return true;
}

// ---- «Сводка»: sections and subsections are only a label on the entries; the broadcasts list itself is never reordered or cut ----

export type BroadcastGroup = { id: string; kind: "none" | "section" | "subsection"; title: string; parentId: string; broadcasts: Broadcast[] };

const knownBroadcastGroups = (content: PortiaContent) => new Set((content.broadcastSections ?? []).flatMap((section) => [section.id, ...section.subsections.map((sub) => sub.id)]));

/** «Без раздела» first (empty or unknown sectionId), then each section followed by its subsections; each group holds this tab's entries in broadcasts order. */
export function broadcastGroupsView(content: PortiaContent, tab: BroadcastTab): BroadcastGroup[] {
  const known = knownBroadcastGroups(content);
  const mine = content.broadcasts.filter((item) => broadcastTabOf(item.type) === tab);
  const groups: BroadcastGroup[] = [{ id: "", kind: "none", title: "Без раздела", parentId: "", broadcasts: mine.filter((item) => !known.has(item.sectionId ?? "")) }];
  for (const section of content.broadcastSections ?? []) {
    groups.push({ id: section.id, kind: "section", title: section.title, parentId: "", broadcasts: mine.filter((item) => item.sectionId === section.id) });
    for (const sub of section.subsections) {
      groups.push({ id: sub.id, kind: "subsection", title: sub.title, parentId: section.id, broadcasts: mine.filter((item) => item.sectionId === sub.id) });
    }
  }
  return groups;
}

/** Every section and subsection id of «Сводка»: the notes of any other id are stale. */
export function broadcastGroupIds(content: PortiaContent): string[] {
  return [...knownBroadcastGroups(content)];
}

/** The cards to open so a group is visible: [section] for a section, [section, subsection] for a subsection, [] for «Без раздела» or an unknown id. */
export function broadcastGroupPath(content: PortiaContent, groupId: string): string[] {
  for (const section of content.broadcastSections ?? []) {
    if (section.id === groupId) return [section.id];
    if (section.subsections.some((sub) => sub.id === groupId)) return [section.id, groupId];
  }
  return [];
}

export function addBroadcastSection(content: PortiaContent, id: string, title: string): void {
  const sections = (content.broadcastSections ??= []);
  if (sections.length >= MAX_SUBSECTIONS || knownBroadcastGroups(content).has(id)) return;
  sections.push({ id, title, subsections: [] });
}

export function addBroadcastSubsection(content: PortiaContent, sectionId: string, id: string, title: string): void {
  const section = content.broadcastSections?.find((item) => item.id === sectionId);
  if (!section || section.subsections.length >= MAX_SUBSECTIONS || knownBroadcastGroups(content).has(id)) return;
  section.subsections.push({ id, title });
}

/** Removing a section (with its subsections) or a subsection never removes an entry: its entries go to «Без раздела». */
export function removeBroadcastOutlineGroup(content: PortiaContent, groupId: string): void {
  const sections = content.broadcastSections ?? [];
  const section = sections.find((item) => item.id === groupId);
  const gone = new Set<string>();
  if (section) {
    gone.add(section.id);
    for (const sub of section.subsections) gone.add(sub.id);
    content.broadcastSections = sections.filter((item) => item.id !== groupId);
  } else {
    const owner = sections.find((item) => item.subsections.some((sub) => sub.id === groupId));
    if (!owner) return;
    gone.add(groupId);
    owner.subsections = owner.subsections.filter((sub) => sub.id !== groupId);
  }
  for (const item of content.broadcasts) if (gone.has(item.sectionId ?? "")) item.sectionId = "";
}

export function moveBroadcastSection(content: PortiaContent, from: number, to: number): void {
  if (content.broadcastSections) moveItem(content.broadcastSections, from, to);
}

export function moveBroadcastSubsection(content: PortiaContent, sectionId: string, from: number, to: number): void {
  const section = content.broadcastSections?.find((item) => item.id === sectionId);
  if (section) moveItem(section.subsections, from, to);
}

/** Files an entry under a section or subsection; an empty or unknown group means «Без раздела». */
export function setBroadcastSection(content: PortiaContent, broadcastId: string, groupId: string): void {
  const item = content.broadcasts.find((candidate) => candidate.id === broadcastId);
  if (item) item.sectionId = knownBroadcastGroups(content).has(groupId) ? groupId : "";
}
