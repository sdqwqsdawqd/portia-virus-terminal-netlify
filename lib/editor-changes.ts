import type { PortiaContent } from "./portia-content.ts";

export type EditorSection = "viruses" | "info" | "broadcasts" | "recycle" | "search" | "assistant";

export const editorSections: EditorSection[] = ["viruses", "info", "broadcasts", "recycle", "search", "assistant"];

export const sectionLabels: Record<EditorSection, string> = {
  viruses: "База вирусов",
  info: "Информация",
  broadcasts: "Сообщения",
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
