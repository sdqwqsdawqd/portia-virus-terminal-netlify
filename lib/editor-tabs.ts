import { editorSections, sectionLabels, type EditorSection } from "./editor-changes.ts";

export type TabKind = "regular" | "trusted";
export type TabDef = { id: string; label: string; kind: TabKind };

// Editor tab strip order (D-01). A future regular tab such as «Справочник» is one new line here and is open
// to everyone by default (D-05); a trusted tab such as «Повышение» is one new line with kind "trusted" and
// stays closed until granted (D-24, D-25). The owner-only «Доступ» is never in the registry (D-09).
// "employees" is not an EditorSection on purpose: changedSections keeps returning content sections only.
export const tabRegistry: TabDef[] = [
  ...editorSections.map((id) => ({ id, label: sectionLabels[id], kind: "regular" as const })),
  { id: "employees", label: "Сотрудники", kind: "regular" },
];

export function openTabIds(closed: readonly string[], granted: readonly string[], registry: readonly TabDef[] = tabRegistry): string[] {
  return registry
    .filter((tab) => (tab.kind === "trusted" ? granted.includes(tab.id) : !closed.includes(tab.id)))
    .map((tab) => tab.id);
}

export function closedSectionsOf(openTabs: readonly string[]): EditorSection[] {
  return editorSections.filter((section) => !openTabs.includes(section));
}

export function closedMessage(ids: readonly string[]): string {
  const labels = ids.map((id) => `«${tabRegistry.find((tab) => tab.id === id)?.label ?? id}»`);
  return labels.length === 1 ? `Раздел ${labels[0]} для вас закрыт.` : `Разделы ${labels.join(", ")} для вас закрыты.`;
}

function parseIds(value: unknown, kind: TabKind): string[] | null {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) return null;
  const allowed = tabRegistry.filter((tab) => tab.kind === kind).map((tab) => tab.id);
  if (!value.every((entry) => allowed.includes(entry))) return null;
  return allowed.filter((id) => value.includes(id));
}

export function parseTabLists(body: Record<string, unknown>): { closedTabs?: string[]; grantedTabs?: string[] } | null {
  const result: { closedTabs?: string[]; grantedTabs?: string[] } = {};
  if ("closedTabs" in body) {
    const closed = parseIds(body.closedTabs, "regular");
    if (!closed) return null;
    result.closedTabs = closed;
  }
  if ("grantedTabs" in body) {
    const granted = parseIds(body.grantedTabs, "trusted");
    if (!granted) return null;
    result.grantedTabs = granted;
  }
  return result.closedTabs || result.grantedTabs ? result : null;
}
