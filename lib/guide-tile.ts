// «Справочник» tiles (owner 2026-11-20, OWN-01): up to 5 tiles a row, and a long title gets a smaller size instead of an ellipsis.
// The rule is one pure function: the CSS only reads the data-title-fit attribute it produces.

export const GUIDE_TILE_COLUMNS = 5;

export type GuideTileTitleFit = "regular" | "small" | "smaller";

const REGULAR_MAX = 16;
const SMALL_MAX = 28;
const LONGEST_WORD_MAX = 14;

export function guideTileTitleFit(title: string): GuideTileTitleFit {
  const text = title.trim();
  if (text.length > SMALL_MAX) return "smaller";
  const longestWord = text.split(/\s+/u).reduce((longest, word) => Math.max(longest, word.length), 0);
  if (longestWord > LONGEST_WORD_MAX) return "smaller";
  return text.length > REGULAR_MAX ? "small" : "regular";
}
