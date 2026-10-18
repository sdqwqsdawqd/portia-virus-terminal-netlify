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

export type DossierTab = "main" | "text" | "mutations" | "logs";

export const dossierTabs: [DossierTab, string][] = [
  ["main", "Основное"],
  ["text", "Описание"],
  ["mutations", "Мутации"],
  ["logs", "Записи учёных"],
];

export function changedDossierTabs(baseline: PortiaContent, draft: PortiaContent, virusId: string): DossierTab[] {
  const find = (content: PortiaContent) => [...content.viruses, ...content.recycledViruses].find((virus) => virus.id === virusId);
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
