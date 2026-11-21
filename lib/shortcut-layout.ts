export type Rect = { x: number; y: number; width: number; height: number };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Keeps a dragged shortcut inside the desktop area and off every obstacle (assistant, format button); never mutates its arguments. */
export function clampShortcutPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  area: { width: number; height: number },
  obstacles: Rect[] = [],
  inset = 8,
): { x: number; y: number } {
  const maxX = Math.max(inset, area.width - size.width - inset);
  const maxY = Math.max(inset, area.height - size.height - inset);
  const clamped = { x: Math.min(maxX, Math.max(inset, position.x)), y: Math.min(maxY, Math.max(inset, position.y)) };
  const box = (point: { x: number; y: number }): Rect => ({ ...point, ...size });
  const hit = obstacles.find((obstacle) => overlaps(box(clamped), obstacle));
  if (!hit) return clamped;
  // Left, above, right, below the obstacle that was hit, in that order for ties; keep the free one that moves the shortcut least.
  const candidates = [
    { x: hit.x - size.width - inset, y: clamped.y },
    { x: clamped.x, y: hit.y - size.height - inset },
    { x: hit.x + hit.width + inset, y: clamped.y },
    { x: clamped.x, y: hit.y + hit.height + inset },
  ].filter((point) => point.x >= inset && point.x <= maxX && point.y >= inset && point.y <= maxY && !obstacles.some((obstacle) => overlaps(box(point), obstacle)));
  let best = clamped;
  let bestDistance = Infinity;
  for (const point of candidates) {
    const distance = Math.hypot(point.x - clamped.x, point.y - clamped.y);
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}

export type ShortcutCell = { width: number; height: number };
export type ShortcutPlacement = { positions: Record<string, { x: number; y: number }>; contentHeight: number };

// What app/portia.css draws at 521–900px for each icon size (the 521–900 rule and the base .desktop-icon rule); a test reads both back.
export const shortcutCellMetrics = {
  compact: { width: 80, minHeight: 72, paddingY: 5, symbol: 44, fontSize: 11 },
  default: { width: 94, minHeight: 86, paddingY: 7, symbol: 52, fontSize: 12 },
  large: { width: 110, minHeight: 98, paddingY: 8, symbol: 62, fontSize: 13 },
} as const;
const shortcutBorder = 1;
const shortcutSymbolGap = 6;
const shortcutLabelLineHeight = 1.25;
const shortcutLabelLines = 2;

/** The box one shortcut needs at 521–900px: the icon of that size plus room for a two-line label (the settings value «standard» is the default size). */
export function shortcutCell(size: string): ShortcutCell {
  const metrics = size === "compact" || size === "large" ? shortcutCellMetrics[size] : shortcutCellMetrics.default;
  const drawn = 2 * shortcutBorder + 2 * metrics.paddingY + metrics.symbol + shortcutSymbolGap + shortcutLabelLines * metrics.fontSize * shortcutLabelLineHeight;
  return { width: metrics.width, height: Math.ceil(Math.max(metrics.minHeight, drawn)) };
}

/** The area a placed or dropped shortcut is held in: the measured area without the taskbar reserve at the bottom. */
export function shortcutDropArea(area: { width: number; height: number }, inset = 8, reserveBottom = 56): { width: number; height: number } {
  return { width: area.width, height: Math.max(0, area.height - reserveBottom + inset) };
}

/**
 * The one placement rule for the shortcuts at 521–900px (UI-09). Saved spots come first, each held inside the area above the
 * taskbar reserve and off the saved shortcuts placed before it (clampShortcutPosition); the rest fill free cells column by
 * column from the top-left corner, top to bottom, the next column when one is full. When the width runs out the columns get
 * longer and contentHeight grows past the area, so the page scrolls instead of cutting a shortcut off. Never mutates its arguments.
 */
export function placeShortcuts(
  ids: readonly string[],
  area: { width: number; height: number },
  cell: ShortcutCell,
  gap: number,
  saved: Readonly<Record<string, { x: number; y: number } | undefined>> = {},
  inset = 8,
  reserveBottom = 56,
): ShortcutPlacement {
  const positions: Record<string, { x: number; y: number }> = {};
  const taken: Rect[] = [];
  const dropArea = shortcutDropArea(area, inset, reserveBottom);
  for (const id of ids) {
    const spot = saved[id];
    if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) continue;
    const point = clampShortcutPosition(spot, cell, dropArea, taken, inset);
    positions[id] = point;
    taken.push({ ...point, ...cell });
  }
  const flowing = ids.filter((id) => !(id in positions));
  const stepX = cell.width + gap;
  const stepY = cell.height + gap;
  const columns = Math.max(1, Math.floor((area.width - 2 * inset + gap) / stepX));
  let rows = Math.max(1, Math.floor((area.height - reserveBottom - inset + gap) / stepY));
  for (;;) {
    const cells: { x: number; y: number }[] = [];
    for (let column = 0; column < columns; column += 1) for (let row = 0; row < rows; row += 1) {
      const point = { x: inset + column * stepX, y: inset + row * stepY };
      if (!taken.some((rect) => overlaps({ ...point, ...cell }, rect))) cells.push(point);
    }
    // Every free cell costs one more row in the worst case, so this ends after at most flowing.length extra rows.
    if (cells.length >= flowing.length || rows > ids.length + taken.length) {
      flowing.forEach((id, index) => { positions[id] = cells[index] ?? { x: inset, y: inset + (rows + index) * stepY }; });
      break;
    }
    rows += 1;
  }
  const bottom = Math.max(0, ...Object.values(positions).map((point) => point.y + cell.height));
  return { positions, contentHeight: Math.max(area.height, bottom + reserveBottom) };
}

/** How many cells of the shortcut grid fit across and down the area (at least one each): the same grid placeShortcuts fills, inset + n * (cell + gap). */
function shortcutGridSize(cell: ShortcutCell, area: { width: number; height: number }, inset: number, gap: number): { columns: number; rows: number } {
  return {
    columns: Math.max(1, Math.floor((area.width - 2 * inset + gap) / (cell.width + gap))),
    rows: Math.max(1, Math.floor((area.height - 2 * inset + gap) / (cell.height + gap))),
  };
}

const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/**
 * The nearest cell of the shortcut grid for a position (owner 22, «Выровнять значки по сетке»), held inside the area.
 * The step is the cell plus the gap; pass the drop area (shortcutDropArea) on the tablet, the workspace on the PC. Pure.
 */
export function snapShortcutPosition(
  position: { x: number; y: number },
  cell: ShortcutCell,
  area: { width: number; height: number },
  inset = 8,
  gap = 8,
): { x: number; y: number } {
  const { columns, rows } = shortcutGridSize(cell, area, inset, gap);
  const column = Math.min(columns - 1, Math.max(0, Math.round((finiteOr(position.x, inset) - inset) / (cell.width + gap))));
  const row = Math.min(rows - 1, Math.max(0, Math.round((finiteOr(position.y, inset) - inset) / (cell.height + gap))));
  return { x: inset + column * (cell.width + gap), y: inset + row * (cell.height + gap) };
}

const cellBlocked = (point: { x: number; y: number }, cell: ShortcutCell, blockers: readonly Rect[]) => blockers.some((blocker) => overlaps({ ...point, ...cell }, blocker));

/**
 * 26.1-REVIEW-2 WR-05: with the grid on, the cell a shortcut is dropped into is the nearest one that no other shortcut (or obstacle) covers, so two shortcuts never share a cell
 * and the result is always a cell of the grid (no clamp afterwards that could push it off the grid). `blockers` are the rectangles of the other shortcuts and of the assistant and
 * the format button, in the coordinates of the area; ties go to the upper row, then the left column. null when every cell is taken.
 */
export function nearestFreeGridCell(
  position: { x: number; y: number },
  cell: ShortcutCell,
  area: { width: number; height: number },
  blockers: readonly Rect[],
  inset = 8,
  gap = 8,
): { x: number; y: number } | null {
  const { columns, rows } = shortcutGridSize(cell, area, inset, gap);
  const x = finiteOr(position.x, inset);
  const y = finiteOr(position.y, inset);
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const point = { x: inset + column * (cell.width + gap), y: inset + row * (cell.height + gap) };
    if (cellBlocked(point, cell, blockers)) continue;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}

/**
 * The free cell an Alt+Arrow press goes to (26.1-REVIEW-2 WR-05): from the cell `from` is in, `cells` steps in the direction `step` (each -1, 0 or 1); a cell that is taken is jumped over to the
 * next free one in the same direction. A step that would leave the grid falls back to the farthest free cell short of the full step. null when there is no free cell that way (the shortcut stays).
 */
export function freeGridCellAlong(
  from: { x: number; y: number },
  step: { x: number; y: number },
  cells: number,
  cell: ShortcutCell,
  area: { width: number; height: number },
  blockers: readonly Rect[],
  inset = 8,
  gap = 8,
): { x: number; y: number } | null {
  const { columns, rows } = shortcutGridSize(cell, area, inset, gap);
  const origin = snapShortcutPosition(from, cell, area, inset, gap);
  const column0 = Math.round((origin.x - inset) / (cell.width + gap));
  const row0 = Math.round((origin.y - inset) / (cell.height + gap));
  const start = Math.max(1, Math.floor(cells));
  const longest = Math.max(columns, rows);
  const counts = [...Array.from({ length: longest - start + 1 }, (_, index) => start + index), ...Array.from({ length: start - 1 }, (_, index) => start - 1 - index)];
  for (const count of counts) {
    const column = column0 + Math.sign(step.x) * count;
    const row = row0 + Math.sign(step.y) * count;
    if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
    const point = { x: inset + column * (cell.width + gap), y: inset + row * (cell.height + gap) };
    if (!cellBlocked(point, cell, blockers)) return point;
  }
  return null;
}

/**
 * Puts every shortcut that has a position into its own cell of the grid: the nearest free one, the shortcuts in the given order
 * (the earlier one picks first, ties go to the upper row, then the left column). Shortcuts without a position are left out.
 * If the area has fewer cells than shortcuts, rows are added below, so nothing overlaps. Never mutates its arguments.
 */
export function alignShortcutsToGrid(
  positions: Readonly<Record<string, { x: number; y: number } | undefined>>,
  order: readonly string[],
  cell: ShortcutCell,
  area: { width: number; height: number },
  inset = 8,
  gap = 8,
): Record<string, { x: number; y: number }> {
  const ids = order.filter((id) => positions[id] !== undefined);
  const size = shortcutGridSize(cell, area, inset, gap);
  const columns = size.columns;
  const rows = Math.max(size.rows, Math.ceil(ids.length / columns));
  const free: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) free.push({ x: inset + column * (cell.width + gap), y: inset + row * (cell.height + gap) });
  const result: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    const from = positions[id] as { x: number; y: number };
    const x = finiteOr(from.x, inset);
    const y = finiteOr(from.y, inset);
    let best = 0;
    let bestDistance = Infinity;
    free.forEach((point, index) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < bestDistance) { best = index; bestDistance = distance; }
    });
    result[id] = free[best] as { x: number; y: number };
    free.splice(best, 1);
  }
  return result;
}
