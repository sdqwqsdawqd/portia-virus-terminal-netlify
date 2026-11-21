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
export type ShortcutPlacement = { positions: Record<string, { x: number; y: number }>; contentHeight: number; grid: DesktopGrid };

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

/**
 * The one placement rule for the shortcuts at 521–900px (UI-09), on the same desktop grid as the PC (owner 2026-11-21 item 31): the area is
 * .desktop-icons, which ends at the top of the taskbar, and the grid reaches its bottom row. Saved spots come first, each held inside the
 * area and off the saved shortcuts placed before it (resolveShortcutOverlaps, item 30); the rest fill the free cells column by column from
 * the top-left corner, top to bottom, the next column when one is full. When the width runs out the columns get longer (rows below the
 * area) and contentHeight grows past the area by the taskbar reserve, so the page scrolls instead of cutting a shortcut off. Nothing ever
 * lies on another shortcut. Never mutates its arguments.
 */
export function placeShortcuts(
  ids: readonly string[],
  area: { width: number; height: number },
  cell: ShortcutCell,
  saved: Readonly<Record<string, { x: number; y: number } | undefined>> = {},
  gridOn = false,
  inset = 8,
  reserveBottom = 56,
): ShortcutPlacement {
  const grid = desktopGrid(area, cell, inset);
  const kept = ids.filter((id) => {
    const spot = saved[id];
    return spot !== undefined && Number.isFinite(spot.x) && Number.isFinite(spot.y);
  });
  const positions: Record<string, { x: number; y: number }> = resolveShortcutOverlaps(saved, kept, cell, grid, gridOn);
  const taken: Rect[] = Object.values(positions).map((point) => ({ ...point, ...cell }));
  const flowing = ids.filter((id) => !(id in positions));
  let rows = grid.rows;
  for (;;) {
    const cells: { x: number; y: number }[] = [];
    for (let column = 0; column < grid.columns; column += 1) for (let row = 0; row < rows; row += 1) {
      const point = gridCellPosition(grid, column, row);
      if (!taken.some((rect) => overlaps({ ...point, ...cell }, rect))) cells.push(point);
    }
    // Every free cell costs one more row in the worst case, so this ends after at most flowing.length extra rows.
    if (cells.length >= flowing.length || rows > ids.length + grid.rows) {
      flowing.forEach((id, index) => { positions[id] = cells[index] ?? gridCellPosition(grid, 0, rows + index); });
      break;
    }
    rows += 1;
  }
  const bottom = Math.max(0, ...Object.values(positions).map((point) => point.y + cell.height));
  return { positions, contentHeight: bottom + inset > area.height ? bottom + reserveBottom : area.height, grid };
}

const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/**
 * The one grid of the desktop (owner 2026-11-21 items 29, 31): cells of one even step over the whole area, from the top inset down to the
 * taskbar, the bottom row included. As many cells of the shortcut's size as fit across and down, and what is left over is shared evenly
 * between them (pitch = the room / the count), so no strip at the right or the bottom is left out of the grid. At least one cell each way.
 * The cell and the area travel with the grid, so every rule below works on the same one.
 */
export type DesktopGrid = {
  columns: number;
  rows: number;
  pitchX: number;
  pitchY: number;
  originX: number;
  originY: number;
  cell: ShortcutCell;
  area: { width: number; height: number };
};

export function desktopGrid(area: { width: number; height: number }, cell: ShortcutCell, inset = 8): DesktopGrid {
  const width = Math.max(0, finiteOr(area.width, 0) - 2 * inset);
  const height = Math.max(0, finiteOr(area.height, 0) - 2 * inset);
  const columns = Math.max(1, Math.floor(width / cell.width));
  const rows = Math.max(1, Math.floor(height / cell.height));
  return {
    columns,
    rows,
    // A room narrower than one cell still gets one whole cell, so the shortcut is never squeezed.
    pitchX: Math.max(cell.width, width / columns),
    pitchY: Math.max(cell.height, height / rows),
    originX: inset,
    originY: inset,
    cell: { width: cell.width, height: cell.height },
    area: { width: Math.max(0, finiteOr(area.width, 0)), height: Math.max(0, finiteOr(area.height, 0)) },
  };
}

/** Where a shortcut stands in the cell (column, row): centred in it, on whole px. A row past the last one is a row added below the area. */
export function gridCellPosition(grid: DesktopGrid, column: number, row: number): { x: number; y: number } {
  return {
    x: Math.round(grid.originX + column * grid.pitchX + (grid.pitchX - grid.cell.width) / 2),
    y: Math.round(grid.originY + row * grid.pitchY + (grid.pitchY - grid.cell.height) / 2),
  };
}

/** The cell a position is nearest to, held inside the grid; junk counts as the first cell. */
function gridCellIndex(grid: DesktopGrid, position: { x: number; y: number }): { column: number; row: number } {
  const offsetX = grid.originX + (grid.pitchX - grid.cell.width) / 2;
  const offsetY = grid.originY + (grid.pitchY - grid.cell.height) / 2;
  return {
    column: Math.min(grid.columns - 1, Math.max(0, Math.round((finiteOr(position.x, offsetX) - offsetX) / grid.pitchX))),
    row: Math.min(grid.rows - 1, Math.max(0, Math.round((finiteOr(position.y, offsetY) - offsetY) / grid.pitchY))),
  };
}

/** The nearest cell of the desktop grid for a position (owner 22, «Выровнять ярлыки по сетке»), held inside the grid. Pure. */
export function snapShortcutPosition(position: { x: number; y: number }, grid: DesktopGrid): { x: number; y: number } {
  const { column, row } = gridCellIndex(grid, position);
  return gridCellPosition(grid, column, row);
}

/**
 * The cell every shortcut starts in (owner 2026-11-21 item 29): a column and a row of desktopGrid; a negative index counts from the right or
 * the bottom edge (-1 is the last column or row). Two columns from the top-left corner in the order of the shortcuts, «Устав» and «Таблица»
 * in the bottom row of the first two columns, «Корзина» in the last column of the first row.
 */
export const desktopShortcutIds = ["search", "archive", "broadcasts", "info", "employees", "settings", "guide", "promotion", "template", "charter", "sheet", "trash"] as const;
export type DesktopShortcutId = (typeof desktopShortcutIds)[number];
export const homeShortcutCells: Readonly<Record<DesktopShortcutId, { column: number; row: number }>> = {
  search: { column: 0, row: 0 },
  archive: { column: 0, row: 1 },
  broadcasts: { column: 0, row: 2 },
  info: { column: 0, row: 3 },
  employees: { column: 0, row: 4 },
  settings: { column: 1, row: 0 },
  guide: { column: 1, row: 1 },
  promotion: { column: 1, row: 2 },
  template: { column: 1, row: 3 },
  charter: { column: 0, row: -1 },
  sheet: { column: 1, row: -1 },
  trash: { column: -1, row: 0 },
};

/**
 * The starting place of every shortcut: its home cell (homeShortcutCells) of this grid. The ones pinned to the right or bottom edge pick
 * first; a home cell that is outside the grid or already taken gives way to the next free cell down the column, then the next column
 * (so on a low desktop a column that runs out goes on in the next one). With more shortcuts than cells, rows are added below the area,
 * so two shortcuts never share a cell. Every result is a cell of the grid (snapShortcutPosition keeps it as it is). Pure.
 */
export function homeShortcutPositions(grid: DesktopGrid, ids: readonly DesktopShortcutId[] = desktopShortcutIds): Record<DesktopShortcutId, { x: number; y: number }> {
  const { columns, rows } = grid;
  const total = columns * rows;
  const taken = new Set<number>();
  const result = {} as Record<DesktopShortcutId, { x: number; y: number }>;
  let extra = 0;
  const pinned = ids.filter((id) => homeShortcutCells[id].column < 0 || homeShortcutCells[id].row < 0);
  for (const id of [...pinned, ...ids.filter((id) => !pinned.includes(id))]) {
    const home = homeShortcutCells[id];
    const column = home.column < 0 ? columns + home.column : home.column;
    const row = home.row < 0 ? rows + home.row : home.row;
    // Cells are counted down a column, then across: index = column * rows + row. A home outside the grid starts from the nearest cell inside it.
    const start = Math.min(columns - 1, Math.max(0, column)) * rows + Math.min(rows - 1, Math.max(0, row));
    let index = taken.has(start) ? -1 : start;
    for (let step = 1; index < 0 && step < total; step += 1) {
      const next = (start + step) % total;
      if (!taken.has(next)) index = next;
    }
    if (index < 0) {
      result[id] = gridCellPosition(grid, extra % columns, rows + Math.floor(extra / columns));
      extra += 1;
      continue;
    }
    taken.add(index);
    result[id] = gridCellPosition(grid, Math.floor(index / rows), index % rows);
  }
  return result;
}

const cellBlocked = (point: { x: number; y: number }, cell: ShortcutCell, blockers: readonly Rect[]) => blockers.some((blocker) => overlaps({ ...point, ...cell }, blocker));

/**
 * 26.1-REVIEW-2 WR-05: with the grid on, the cell a shortcut is dropped into is the nearest one that no other shortcut (or obstacle) covers, so two shortcuts never share a cell
 * and the result is always a cell of the grid (no clamp afterwards that could push it off the grid). `blockers` are the rectangles of the other shortcuts and of the assistant and
 * the format button, in the coordinates of the area; ties go to the upper row, then the left column. null when every cell is taken.
 */
export function nearestFreeGridCell(position: { x: number; y: number }, grid: DesktopGrid, blockers: readonly Rect[]): { x: number; y: number } | null {
  const x = finiteOr(position.x, grid.originX);
  const y = finiteOr(position.y, grid.originY);
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (let row = 0; row < grid.rows; row += 1) for (let column = 0; column < grid.columns; column += 1) {
    const point = gridCellPosition(grid, column, row);
    if (cellBlocked(point, grid.cell, blockers)) continue;
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
  grid: DesktopGrid,
  blockers: readonly Rect[],
): { x: number; y: number } | null {
  const { columns, rows } = grid;
  const { column: column0, row: row0 } = gridCellIndex(grid, from);
  const start = Math.max(1, Math.floor(cells));
  const longest = Math.max(columns, rows);
  const counts = [...Array.from({ length: Math.max(0, longest - start + 1) }, (_, index) => start + index), ...Array.from({ length: start - 1 }, (_, index) => start - 1 - index)];
  for (const count of counts) {
    const column = column0 + Math.sign(step.x) * count;
    const row = row0 + Math.sign(step.y) * count;
    if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
    const point = gridCellPosition(grid, column, row);
    if (!cellBlocked(point, grid.cell, blockers)) return point;
  }
  return null;
}

/**
 * Puts every shortcut that has a position into its own cell of the grid: the nearest free one, the shortcuts in the given order
 * (the earlier one picks first, ties go to the upper row, then the left column). Shortcuts without a position are left out.
 * If the area has fewer cells than shortcuts, rows are added below, so nothing overlaps. A layout already on the grid stays as it is
 * (the home places of homeShortcutPositions included). Never mutates its arguments.
 */
export function alignShortcutsToGrid(
  positions: Readonly<Record<string, { x: number; y: number } | undefined>>,
  order: readonly string[],
  grid: DesktopGrid,
): Record<string, { x: number; y: number }> {
  const ids = order.filter((id) => positions[id] !== undefined);
  const columns = grid.columns;
  const rows = Math.max(grid.rows, Math.ceil(ids.length / columns));
  const inset = grid.originX;
  const free: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) free.push(gridCellPosition(grid, column, row));
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

// ---- Owner 2026-11-21 item 30: shortcuts never lie on each other, with the grid or without it ----

/** A position held inside the area of the grid (the inset on every side); junk counts as the top-left corner. */
function insideGrid(position: { x: number; y: number }, cell: ShortcutCell, grid: DesktopGrid): { x: number; y: number } {
  return clampShortcutPosition({ x: finiteOr(position.x, grid.originX), y: finiteOr(position.y, grid.originY) }, cell, grid.area, [], grid.originX);
}

/**
 * The nearest place to `position` where a shortcut covers none of the blockers, without the grid: every place inside the area on an 8px
 * lattice through the position (and the edges of the area) is tried, the nearest free one wins (ties: the upper, then the left). The area
 * is finite and so is the lattice, so this always ends. null when no place is free.
 */
export function nearestFreeShortcutSpot(position: { x: number; y: number }, cell: ShortcutCell, grid: DesktopGrid, blockers: readonly Rect[], step = 8): { x: number; y: number } | null {
  const from = insideGrid(position, cell, grid);
  const maxX = Math.max(grid.originX, grid.area.width - cell.width - grid.originX);
  const maxY = Math.max(grid.originY, grid.area.height - cell.height - grid.originY);
  const axis = (start: number, min: number, max: number) => {
    const values = new Set<number>([min, max]);
    for (let value = start; value >= min; value -= step) values.add(value);
    for (let value = start + step; value <= max; value += step) values.add(value);
    return [...values].sort((a, b) => a - b);
  };
  const xs = axis(from.x, grid.originX, maxX);
  const ys = axis(from.y, grid.originY, maxY);
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (const y of ys) for (const x of xs) {
    const distance = Math.hypot(x - from.x, y - from.y);
    if (distance >= bestDistance || cellBlocked({ x, y }, cell, blockers)) continue;
    best = { x, y };
    bestDistance = distance;
  }
  return best;
}

/** Where a shortcut goes when `wanted` is taken: with the grid the nearest free cell, without it the nearest free place; then the other one; null when the area is full. */
function nearestFree(wanted: { x: number; y: number }, cell: ShortcutCell, grid: DesktopGrid, blockers: readonly Rect[], gridOn: boolean): { x: number; y: number } | null {
  return gridOn
    ? nearestFreeGridCell(wanted, grid, blockers) ?? nearestFreeShortcutSpot(wanted, cell, grid, blockers)
    : nearestFreeShortcutSpot(wanted, cell, grid, blockers) ?? nearestFreeGridCell(wanted, grid, blockers);
}

/**
 * The saved places checked once they are read back (item 30, T-26.1-53): a place outside the area is held inside it; a place that covers a
 * shortcut placed before it (in `order`) goes to the nearest free place (with the grid on, the nearest free cell). A place that is inside and
 * covers nobody is kept as it is. Shortcuts that are not in `order` or have no place are left out. With no room left at all, the shortcut
 * goes to a row added below the area. Never mutates its arguments.
 */
export function resolveShortcutOverlaps(
  positions: Readonly<Record<string, { x: number; y: number } | undefined>>,
  order: readonly string[],
  cell: ShortcutCell,
  grid: DesktopGrid,
  gridOn = false,
): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {};
  const taken: Rect[] = [];
  let extra = 0;
  for (const id of order) {
    const spot = positions[id];
    if (!spot) continue;
    const inside = insideGrid(spot, cell, grid);
    let point = cellBlocked(inside, cell, taken) ? nearestFree(inside, cell, grid, taken, gridOn) : inside;
    if (!point) {
      point = gridCellPosition(grid, extra % grid.columns, grid.rows + Math.floor(extra / grid.columns));
      extra += 1;
    }
    result[id] = point;
    taken.push({ ...point, ...cell });
  }
  return result;
}

/**
 * Where a released (or Alt+Arrow moved) shortcut lands (item 30): with the grid the cell under the point, without it the point held inside the
 * area; if another shortcut (`positions`, the own place left out) or an obstacle is there, the nearest free cell or place instead (`displaced`).
 * The result is inside the area and covers nothing, unless the whole area is full (then the wanted place stays). Pure.
 */
export function placeShortcutDrop(
  id: string,
  point: { x: number; y: number },
  positions: Readonly<Record<string, { x: number; y: number } | undefined>>,
  cell: ShortcutCell,
  grid: DesktopGrid,
  gridOn: boolean,
  obstacles: readonly Rect[] = [],
): { position: { x: number; y: number }; displaced: boolean } {
  const blockers: Rect[] = [...obstacles];
  for (const [other, spot] of Object.entries(positions)) if (other !== id && spot) blockers.push({ ...spot, ...cell });
  const wanted = gridOn ? snapShortcutPosition(point, grid) : insideGrid(point, cell, grid);
  if (!cellBlocked(wanted, cell, blockers)) return { position: wanted, displaced: false };
  return { position: nearestFree(gridOn ? point : wanted, cell, grid, blockers, gridOn) ?? wanted, displaced: true };
}
