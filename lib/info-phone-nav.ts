// Phase 20-16 (D-29, D-31, D-32): pure navigation helpers for «Информация» on a phone. No DOM and no React: the component owns the state,
// these functions decide where «Далее» leads, how the set of opened sections changes and what a search hit opens.
import type { InfoSection } from "./portia-content.ts";

export type InfoNextTarget = { id: string; title: string };

const untitled = "БЕЗ НАЗВАНИЯ";

/** D-31: the article «Далее» leads to, or null. From a section with subsections to its first one; from a subsection to the next one of the same section. */
export function infoNextTarget(sections: readonly InfoSection[], id: string): InfoNextTarget | null {
  for (const section of sections) {
    if (section.id === id) {
      const first = section.subsections[0];
      return first ? { id: first.id, title: first.title.trim() ? first.title : untitled } : null;
    }
    const index = section.subsections.findIndex((subsection) => subsection.id === id);
    if (index >= 0) {
      const next = section.subsections[index + 1];
      return next ? { id: next.id, title: next.title.trim() ? next.title : untitled } : null;
    }
  }
  return null;
}

/** D-29: a section opens when it is closed and closes when it is open; the source set is never changed. */
export function toggleInfoExpanded(expanded: ReadonlySet<string>, sectionId: string): ReadonlySet<string> {
  const next = new Set(expanded);
  if (next.has(sectionId)) next.delete(sectionId);
  else next.add(sectionId);
  return next;
}

/** D-32: what a global-search hit on this id needs opened in the list. `expand` is the section to open (null: nothing); null: the id is not in the list. */
export function revealInfoForSearch(sections: readonly InfoSection[], hitId: string): { expand: string | null } | null {
  for (const section of sections) {
    if (section.id === hitId) return { expand: section.subsections.length ? section.id : null };
    if (section.subsections.some((subsection) => subsection.id === hitId)) return { expand: section.id };
  }
  return null;
}

/** D-29: the «Обзор раздела» row exists only for a section with subsections and a body that is not blank. */
export function infoOverviewVisible(section: InfoSection): boolean {
  return section.subsections.length > 0 && section.body.trim().length > 0;
}

// Phase 26 (UI-08, D-14 … D-16): the sections bar above the article on a phone. The bar copy uses the sentence case of UI-SPEC;
// `untitled` above (capitals) stays the fallback of «Далее» and of the list rows.
const barUntitled = "Без названия";

/** D-16: how many sections hold a hit, in the section itself or in any of its subsections; a section with several hits counts once. */
export function infoSectionsHitCount(sections: readonly InfoSection[], isHit: (id: string) => boolean): number {
  return sections.filter((section) => isHit(section.id) || section.subsections.some((subsection) => isHit(subsection.id))).length;
}

/** D-14: the name of the current article for the bar: a section or a subsection by id; an unknown id is the first section (the default one). */
export function infoCurrentTitle(sections: readonly InfoSection[], id: string): string {
  const named = (title: string) => (title.trim() ? title : barUntitled);
  for (const section of sections) {
    if (section.id === id) return named(section.title);
    const subsection = section.subsections.find((item) => item.id === id);
    if (subsection) return named(subsection.title);
  }
  return named(sections[0]?.title ?? "");
}

export type InfoSectionsButtonLabel = { text: string; word: string; glyph: "▾" | "▴"; count: string; ariaLabel: string | undefined };

/**
 * D-14/D-16: the bar button. `text` is what is read on screen; `glyph` is drawn aria-hidden. The count of sections with hits shows only
 * while the list is closed (the open list marks them itself), and then the button carries a spoken name.
 */
export function infoSectionsButtonLabel(open: boolean, hits: number): InfoSectionsButtonLabel {
  const word = "РАЗДЕЛЫ";
  const glyph = open ? "▴" : "▾";
  const counted = !open && Number.isInteger(hits) && hits > 0;
  const count = counted ? ` · ${hits}` : "";
  return { text: `${word} ${glyph}${count}`, word, glyph, count, ariaLabel: counted ? `Разделы, найдено в разделах: ${hits}` : undefined };
}
