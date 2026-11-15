import { requiredLevelOf, type AccessLevel } from "./access-levels.ts";
import type { PortiaContent } from "./portia-content.ts";

// Phase 24, D-17 / LVL-03: a record inside a section is never more open than the section. One rule for the editor,
// the PUT normalization and the redaction: the effective level is the higher of the record's own level and its parent's.
// A damaged own level reads as the highest (requiredLevelOf), so it stays closed.
export function effectiveLevel(own: unknown, parent: AccessLevel): AccessLevel {
  return Math.max(requiredLevelOf(own), parent) as AccessLevel;
}

// Mutates the given draft children on purpose (the editor calls it from inside its draft change). A child below the parent
// is set to the parent's level; a child at or above it is left alone, including a damaged value (left for the normalizer).
// Returns how many children were changed.
export function raiseChildren<T extends { level?: AccessLevel }>(children: T[], parentLevel: AccessLevel): number {
  let raised = 0;
  for (const child of children) {
    if (requiredLevelOf(child.level) < parentLevel) {
      child.level = parentLevel;
      raised += 1;
    }
  }
  return raised;
}

// Returns a deep copy where the subsections of each «Информация» section and the cards of each «Справочник» section are at
// least as closed as their section, and how many children were lifted. The input is not changed. There is no level of the
// «Информация»/«Справочник» app itself (A-5), and scientist logs are not bound to their virus's level.
export function raiseChildLevels(content: PortiaContent): { content: PortiaContent; raised: number } {
  const copy: PortiaContent = JSON.parse(JSON.stringify(content));
  let raised = 0;
  for (const section of copy.infoSections) raised += raiseChildren(section.subsections, requiredLevelOf(section.level));
  for (const section of copy.guideSections) raised += raiseChildren(section.cards, requiredLevelOf(section.level));
  return { content: copy, raised };
}
