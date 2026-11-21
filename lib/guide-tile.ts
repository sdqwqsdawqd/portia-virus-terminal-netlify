// «Справочник» tiles (owner 2026-11-20, OWN-01): up to 5 tiles a row, and a long title gets a smaller size instead of an ellipsis.
// Owner 2026-11-21, item 23: all tiles are ONE size (with a cover and without), so the title field has a fixed height of GUIDE_TILE_TITLE_LINES lines
// and a tile never grows. A long title shrinks its font first (the three tiers below); the third line is cut only as the last resort, and the full
// title stays in the tile's `title` and in the button's name.
// The rule is one pure function: the CSS only reads the data-title-fit attribute it produces.

export const GUIDE_TILE_COLUMNS = 5;
export const GUIDE_TILE_TITLE_LINES = 3;

export type GuideTileTitleFit = "regular" | "small" | "smaller";

// The estimate is made on the narrowest tile of a PC (132px: the grid's minimum), as classification-fit does it: a monospace-like width,
// characters a line = text width / (font size * 0.55). The sizes are the CSS tiers of .guide-tile-title (13px, 12px, 11px).
const NARROWEST_TILE_PX = 132;
const TILE_BORDER_PX = 2;
const TILE_TEXT_PADDING_PX = 6; // each side; the same in .guide-tile-title
const GLYPH_WIDTH = 0.55;
const FONT_PX: Readonly<Record<GuideTileTitleFit, number>> = { regular: 13, small: 12, smaller: 11 };
// The regular size is kept while the title needs at most two lines: three full lines at 13px read as a block, so the font shrinks first.
const REGULAR_MAX_LINES = 2;

/** The lines a title needs at a tier's size on the narrowest tile: a greedy wrap, a word longer than a line is broken and starts a line of its own. */
export function guideTileTitleLines(title: string, fit: GuideTileTitleFit): number {
  const perLine = Math.max(1, Math.floor((NARROWEST_TILE_PX - TILE_BORDER_PX - 2 * TILE_TEXT_PADDING_PX) / (FONT_PX[fit] * GLYPH_WIDTH)));
  let lines = 1;
  let used = 0;
  for (const word of title.trim().split(/\s+/u).filter(Boolean)) {
    if (word.length > perLine) {
      if (used > 0) lines += 1;
      const parts = Math.ceil(word.length / perLine);
      lines += parts - 1;
      used = word.length - (parts - 1) * perLine;
    } else if (used === 0) {
      used = word.length;
    } else if (used + 1 + word.length <= perLine) {
      used += 1 + word.length;
    } else {
      lines += 1;
      used = word.length;
    }
  }
  return lines;
}

export function guideTileTitleFit(title: string): GuideTileTitleFit {
  if (guideTileTitleLines(title, "regular") <= REGULAR_MAX_LINES) return "regular";
  if (guideTileTitleLines(title, "small") <= GUIDE_TILE_TITLE_LINES) return "small";
  return "smaller";
}
