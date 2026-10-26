import type { PortiaContent, Virus } from "./portia-content.ts";

export type EditorSection = "viruses" | "info" | "broadcasts" | "recycle" | "search" | "assistant";

export const editorSections: EditorSection[] = ["viruses", "info", "broadcasts", "recycle", "search", "assistant"];

export const sectionLabels: Record<EditorSection, string> = {
  viruses: "База вирусов",
  info: "Информация",
  broadcasts: "Сводка",
  recycle: "Корзина",
  search: "Рекомендации",
  assistant: "Помощник",
};

export function sectionOfKey(key: string): EditorSection | null {
  if (key === "viruses") return "viruses";
  if (key === "infoSections") return "info";
  if (key === "broadcasts") return "broadcasts";
  if (key === "recycledViruses" || key === "recycleFiles" || key === "recycleOrder") return "recycle";
  if (key === "searchRecommendations") return "search";
  if (key.startsWith("assistant")) return "assistant";
  return null;
}

const prefixSections: Record<string, EditorSection> = {
  "info:": "info",
  "info-block:": "info",
  "broadcast:": "broadcasts",
  "recycle:": "recycle",
  "search:": "search",
  "assistant:": "assistant",
};

function sectionOfFormattedKey(key: string, baseline: PortiaContent, draft: PortiaContent): EditorSection | null {
  if (key.startsWith("virus:")) {
    const id = key.split(":")[1];
    return [...baseline.viruses, ...draft.viruses].some((virus) => virus.id === id) ? "viruses" : "recycle";
  }
  const prefix = Object.keys(prefixSections).find((candidate) => key.startsWith(candidate));
  return prefix ? prefixSections[prefix] : null;
}

// Employees and access are saved on their own, outside the draft, so they never show up here.
export function changedSections(baseline: PortiaContent, draft: PortiaContent): EditorSection[] {
  const found = new Set<EditorSection>();
  const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

  const topKeys = new Set([...Object.keys(baseline), ...Object.keys(draft)]);
  topKeys.delete("formattedText");
  for (const key of topKeys) {
    const section = sectionOfKey(key);
    if (section && differs((baseline as Record<string, unknown>)[key], (draft as Record<string, unknown>)[key])) found.add(section);
  }

  const before = baseline.formattedText ?? {};
  const after = draft.formattedText ?? {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!differs(before[key], after[key])) continue;
    const section = sectionOfFormattedKey(key, baseline, draft);
    if (section) found.add(section);
  }

  return editorSections.filter((section) => found.has(section));
}

// Fail closed: the server refuses these for a restricted editor, since no section owns them.
export function unclassifiedTextKeys(baseline: PortiaContent, draft: PortiaContent): string[] {
  const before = baseline.formattedText ?? {};
  const after = draft.formattedText ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && sectionOfFormattedKey(key, baseline, draft) === null,
  );
}

// D-13: a virus is moved when it was live in the stored copy, is not in its bin, and now sits in the incoming bin and not in the live list.
function movedVirusIds(baseline: PortiaContent, incoming: PortiaContent): Set<string> {
  const live = new Set(incoming.viruses.map((virus) => virus.id));
  const binned = new Set((baseline.recycledViruses ?? []).map((virus) => virus.id));
  const inBin = new Set((incoming.recycledViruses ?? []).map((virus) => virus.id));
  return new Set(baseline.viruses.filter((virus) => !live.has(virus.id) && !binned.has(virus.id) && inBin.has(virus.id)).map((virus) => virus.id));
}

// Closed sections that the incoming copy changes compared with the stored one.
export function deniedSections(baseline: PortiaContent, incoming: PortiaContent, closed: readonly EditorSection[]): EditorSection[] {
  let compared = incoming;
  if (closed.includes("recycle")) {
    // D-13, a live virus moved to the bin is a «База вирусов» edit; its `virus:<id>:*` texts already count as viruses because the id is in baseline.viruses.
    const moved = movedVirusIds(baseline, incoming);
    // Comparison copy only: never returned or saved.
    if (moved.size) compared = {
      ...incoming,
      recycledViruses: (incoming.recycledViruses ?? []).filter((virus) => !moved.has(virus.id)),
      recycleOrder: (incoming.recycleOrder ?? []).filter((key) => !(key.startsWith("virus:") && moved.has(key.slice("virus:".length)))),
    };
  }
  return changedSections(baseline, compared).filter((section) => closed.includes(section));
}

const cloneOf = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// Puts the given sections back to the stored copy and returns a new object; neither input is mutated.
// Rule: the result never loses or duplicates a stored virus. A virus moved between the live list and the bin is
// kept in one list when only one of the two is reverted, so every stored id sits in exactly one list.
export function revertSections(baseline: PortiaContent, content: PortiaContent, sections: readonly EditorSection[]): PortiaContent {
  const result = cloneOf(content);
  if (!sections.length) return result;
  const reverted = new Set(sections);
  const out = result as unknown as Record<string, unknown>;
  const stored = baseline as unknown as Record<string, unknown>;

  for (const key of new Set([...Object.keys(baseline), ...Object.keys(content)])) {
    const section = key === "formattedText" ? null : sectionOfKey(key);
    if (!section || !reverted.has(section)) continue;
    if (key in stored) out[key] = cloneOf(stored[key]);
    else delete out[key];
  }

  // D-13: with the bin closed and the viruses open, a live virus moved to the bin stays moved.
  if (reverted.has("recycle") && !reverted.has("viruses")) {
    const moved = movedVirusIds(baseline, content);
    for (const virus of content.recycledViruses ?? []) {
      if (!moved.has(virus.id)) continue;
      (result.recycledViruses ??= []).push(cloneOf(virus));
      (result.recycleOrder ??= []).push(`virus:${virus.id}`);
    }
  }

  // A move or restore in the draft puts an id in two lists or none once only one list is reverted.
  if (reverted.has("viruses") || reverted.has("recycle")) {
    const inContent = new Set([...content.viruses, ...(content.recycledViruses ?? [])].map((virus) => virus.id));
    const homes: [Virus, "live" | "bin", number][] = [
      ...baseline.viruses.map((virus, index): [Virus, "live" | "bin", number] => [virus, "live", index]),
      ...(baseline.recycledViruses ?? []).map((virus, index): [Virus, "live" | "bin", number] => [virus, "bin", index]),
    ];
    for (const [virus, home, index] of homes) {
      const live = result.viruses.some((item) => item.id === virus.id);
      const binned = (result.recycledViruses ?? []).some((item) => item.id === virus.id);
      const key = `virus:${virus.id}`;
      if (live && binned) {
        if (home === "live") {
          result.recycledViruses = result.recycledViruses.filter((item) => item.id !== virus.id);
          result.recycleOrder = (result.recycleOrder ?? []).filter((item) => item !== key);
        } else result.viruses = result.viruses.filter((item) => item.id !== virus.id);
      // Gone from both lists and absent from the draft means an open section deleted it on purpose.
      } else if (!live && !binned && inContent.has(virus.id)) {
        const list = home === "live" ? result.viruses : (result.recycledViruses ??= []);
        list.splice(Math.min(index, list.length), 0, cloneOf(virus));
        if (home === "bin" && !(result.recycleOrder ??= []).includes(key)) result.recycleOrder.push(key);
      }
    }
  }

  // A key is reverted when its section is reverted in the draft's view or in the result's view, so a restored virus's texts follow where it ended up.
  const before = baseline.formattedText ?? {};
  const after = content.formattedText ?? {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const hit = [sectionOfFormattedKey(key, baseline, content), sectionOfFormattedKey(key, baseline, result)].some((section) => section && reverted.has(section));
    if (!hit) continue;
    result.formattedText ??= {};
    if (key in before) result.formattedText[key] = cloneOf(before[key]);
    else delete result.formattedText[key];
  }

  return result;
}

export type DossierTab = "main" | "text" | "mutations" | "logs";

export const dossierTabs: [DossierTab, string][] = [
  ["main", "Основное"],
  ["text", "Описание"],
  ["mutations", "Мутации"],
  ["logs", "Записи учёных"],
];

export function changedDossierTabs(baseline: PortiaContent, draft: PortiaContent, virusId: string): DossierTab[] {
  // D-22: an old cached copy has no recycle list.
  const find = (content: PortiaContent) => [...content.viruses, ...(content.recycledViruses ?? [])].find((virus) => virus.id === virusId);
  const after = find(draft);
  if (!after) return [];
  const before = find(baseline);
  if (!before) return dossierTabs.map(([id]) => id);

  // Anything that is not text, mutations or logs falls into "main", so a future virus field still marks a tab.
  const slices = (virus: Virus, content: PortiaContent) => {
    const { external, physiology, ppu, mutations, scientistLogs, ...main } = virus;
    const parts: Record<DossierTab, unknown[]> = { main: [main], text: [external, physiology, ppu], mutations: [mutations], logs: [scientistLogs] };
    const prefix = `virus:${virusId}:`;
    for (const key of Object.keys(content.formattedText ?? {}).sort()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const tab: DossierTab = key.includes(":mutation:") ? "mutations" : rest === "external" || rest === "physiology" || rest.startsWith("ppu-") ? "text" : "main";
      parts[tab].push([key, content.formattedText[key]]);
    }
    return parts;
  };
  const was = slices(before, baseline);
  const now = slices(after, draft);
  return dossierTabs.map(([id]) => id).filter((id) => JSON.stringify(was[id]) !== JSON.stringify(now[id]));
}
