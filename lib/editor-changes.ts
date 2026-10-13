import type { PortiaContent } from "./portia-content.ts";

export type EditorSection = "viruses" | "info" | "broadcasts" | "recycle" | "search" | "assistant";

export const editorSections: EditorSection[] = [];
export const sectionLabels = {} as Record<EditorSection, string>;

// RED stubs: behavior arrives in the GREEN commit.
export function sectionOfKey(_key: string): EditorSection | null {
  return null;
}

export function changedSections(_baseline: PortiaContent, _draft: PortiaContent): EditorSection[] {
  return [];
}
