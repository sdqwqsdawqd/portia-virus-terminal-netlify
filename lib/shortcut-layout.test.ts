import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as layout from "./shortcut-layout.ts";
import { clampShortcutPosition, type Rect } from "./shortcut-layout.ts";

const shortcuts = readFileSync(new URL("../components/portia-desktop-shortcuts.tsx", import.meta.url), "utf8");
const size = { width: 80, height: 72 };
const area = { width: 800, height: 600 };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("a position inside the area is kept", () => {
  assert.deepEqual(clampShortcutPosition({ x: 100, y: 120 }, size, area), { x: 100, y: 120 });
});

test("past the right or bottom edge it is pulled to area - size - inset", () => {
  assert.deepEqual(clampShortcutPosition({ x: 5000, y: 5000 }, size, area), { x: 800 - 80 - 8, y: 600 - 72 - 8 });
});

test("past the left or top edge it is pulled to the inset", () => {
  assert.deepEqual(clampShortcutPosition({ x: -50, y: -9 }, size, area), { x: 8, y: 8 });
});

test("an area smaller than the shortcut gives the inset on that axis", () => {
  assert.deepEqual(clampShortcutPosition({ x: 40, y: 40 }, size, { width: 60, height: 50 }), { x: 8, y: 8 });
});

test("a shortcut dropped on an obstacle moves to the nearest free side and stays clear and inside", () => {
  const assistant: Rect = { x: 700, y: 480, width: 80, height: 100 };
  const result = clampShortcutPosition({ x: 690, y: 500 }, size, area, [assistant]);
  assert.ok(!overlaps({ ...result, ...size }, assistant));
  assert.deepEqual(result, { x: assistant.x - size.width - 8, y: 500 }); // left is the smallest move
  assert.ok(result.x >= 8 && result.y >= 8 && result.x + size.width <= area.width - 8 && result.y + size.height <= area.height - 8);
});

test("when the left side is outside the area the shortcut goes above, still clear of every obstacle", () => {
  const wide: Rect = { x: 0, y: 500, width: 800, height: 40 };
  const result = clampShortcutPosition({ x: 100, y: 515 }, size, area, [wide]);
  assert.ok(!overlaps({ ...result, ...size }, wide));
  assert.deepEqual(result, { x: 100, y: 500 - size.height - 8 });
});

test("with no free side the clamped position is returned", () => {
  const everything: Rect = { x: 0, y: 0, width: 800, height: 600 };
  assert.deepEqual(clampShortcutPosition({ x: 5000, y: -5 }, size, area, [everything]), { x: 800 - 80 - 8, y: 8 });
});

test("arguments are not mutated", () => {
  const position = { x: 5000, y: 5000 };
  const obstacles: Rect[] = [{ x: 700, y: 500, width: 80, height: 80 }];
  const before = JSON.stringify([position, size, area, obstacles]);
  clampShortcutPosition(position, size, area, obstacles);
  assert.equal(JSON.stringify([position, size, area, obstacles]), before);
});

test("DraggableDesktopIcon starts the cycle first, gates free drag at 520px (UI-09), clamps through the pure function and opens immediately", () => {
  const down = /const handlePointerDown = [\s\S]*?\n  \};/.exec(shortcuts)?.[0] ?? "";
  assert.match(down, /handlePointerDown = \(event[^\n]*\n\s*iconAnimation\.play\(\);/);
  assert.ok(down.includes("window.matchMedia(phoneShortcutQuery).matches"));
  assert.ok(shortcuts.includes('const phoneShortcutQuery = "(max-width: 520px)";'), "the phone query is the one the stylesheet uses");
  assert.ok(!shortcuts.includes("window.innerWidth <= 520"));
  assert.ok(/handlePointerMove[\s\S]*clampShortcutPosition\(/.test(shortcuts));
  assert.ok(/finishDrag[\s\S]*clampShortcutPosition\(/.test(shortcuts));
  assert.ok(shortcuts.includes('".desktop-assistant, .global-format-launch"'));
  const click = /const handleClick = [\s\S]*?\n  \};/.exec(shortcuts)?.[0] ?? "";
  assert.ok(click.includes("onActivate?.("));
  assert.doesNotMatch(click, /setTimeout/);
  assert.ok(shortcuts.includes("onFocus: iconAnimation.play"));
  assert.ok(shortcuts.includes("max(8px, min(${position.x}px, calc(100% - 118px)))"));
  assert.ok(shortcuts.includes("max(8px, min(${position.y}px, calc(100% - 128px)))"));
});

// ---- Phase 26-11 (UI-09): one placement rule for the shortcuts at 521–900px ----
// Order of defaultShortcutLayout in components/portia-desktop-shortcuts.tsx (left column, second column, the bottom pair, trash).
const order = ["search", "archive", "broadcasts", "info", "employees", "settings", "guide", "promotion", "charter", "sheet", "trash"] as const;
const widths = [521, 600, 768, 900] as const;
const iconSizes = ["compact", "default", "large"] as const;
const areas = [{ width: 521, height: 600 }, { width: 600, height: 700 }, { width: 768, height: 900 }, { width: 900, height: 600 }, { width: 521, height: 400 }];
const gap = 8;

type Placement = { positions: Record<string, { x: number; y: number }>; contentHeight: number };
type Cell = { width: number; height: number };
const place = (...args: unknown[]): Placement => {
  assert.equal(typeof (layout as Record<string, unknown>).placeShortcuts, "function", "lib/shortcut-layout.ts exports placeShortcuts");
  return ((layout as Record<string, unknown>).placeShortcuts as (...a: unknown[]) => Placement)(...args);
};
const cellOf = (size: string): Cell => {
  assert.equal(typeof (layout as Record<string, unknown>).shortcutCell, "function", "lib/shortcut-layout.ts exports shortcutCell");
  return ((layout as Record<string, unknown>).shortcutCell as (size: string) => Cell)(size);
};

function assertClean(result: Placement, area: { width: number; height: number }, cell: Cell, label: string) {
  const rects = order.map((id) => {
    const point = result.positions[id];
    assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), `${label}: ${id} has a position`);
    return { id, x: point.x, y: point.y, width: cell.width, height: cell.height };
  });
  assert.ok(result.contentHeight >= area.height, `${label}: the content is never shorter than the area`);
  for (const rect of rects) {
    assert.ok(rect.x >= 8 && rect.x + rect.width <= area.width - 8, `${label}: ${rect.id} is cut by a side (x ${rect.x})`);
    assert.ok(rect.y >= 8, `${label}: ${rect.id} is cut by the top`);
    assert.ok(rect.y + rect.height <= result.contentHeight - 56, `${label}: ${rect.id} reaches the taskbar reserve`);
  }
  for (let a = 0; a < rects.length; a += 1) for (let b = a + 1; b < rects.length; b += 1) {
    assert.ok(!overlaps(rects[a], rects[b]), `${label}: ${rects[a].id} overlaps ${rects[b].id}`);
  }
}

test("UI-09 shortcutCell: the cell holds the icon of each size plus two label lines", () => {
  const compact = cellOf("compact");
  const standard = cellOf("default");
  const large = cellOf("large");
  assert.deepEqual([compact.width, standard.width, large.width], [80, 94, 110]);
  // border 2 + padding + symbol + gap 6 + two lines of font-size × 1.25, never below the CSS min-height.
  assert.equal(compact.height, Math.ceil(2 + 10 + 44 + 6 + 2 * 11 * 1.25));
  assert.equal(standard.height, Math.ceil(2 + 14 + 52 + 6 + 2 * 12 * 1.25));
  assert.equal(large.height, Math.ceil(2 + 16 + 62 + 6 + 2 * 13 * 1.25));
  assert.ok(compact.height >= 72 && standard.height >= 86 && large.height >= 98);
  assert.deepEqual(cellOf("standard"), standard, "the settings value «standard» is the default size");
});

test("UI-09 shortcutCell numbers are the ones the 521–900px stylesheet draws", () => {
  const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const start = css.indexOf("@media (520px < width <= 900px) {");
  assert.ok(start > 0);
  const block = css.slice(start, css.indexOf("\n}\n", start));
  assert.match(block, /\n  \.desktop-icon \{[^}]*width: 94px; min-height: 86px; padding: 7px 5px; font-size: 12px;/);
  assert.match(block, /html\[data-icon-size="compact"\] \.desktop-icon \{ width: 80px; min-height: 72px; padding: 5px 3px; font-size: 11px; \}/);
  assert.match(block, /html\[data-icon-size="large"\] \.desktop-icon \{ width: 110px; min-height: 98px; padding: 8px 5px; font-size: 13px; \}/);
  assert.match(block, /\n  \.desktop-icon-symbol \{ width: 52px; height: 52px; \}/);
  assert.match(block, /html\[data-icon-size="compact"\] \.desktop-icon-symbol \{ width: 44px; height: 44px; \}/);
  assert.match(block, /html\[data-icon-size="large"\] \.desktop-icon-symbol \{ width: 62px; height: 62px; \}/);
  const base = /\n\.desktop-icon \{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
  assert.match(base, /gap: 6px;/);
  assert.match(base, /line-height: 1\.25;/);
  assert.match(base, /border: 1px solid transparent;/);
});

test("UI-09 placeShortcuts: at 521/600/768/900px and every icon size no shortcut overlaps another, a side, the top or the taskbar reserve", () => {
  for (const area of areas) for (const size of iconSizes) {
    const cell = cellOf(size);
    assertClean(place(order, area, cell, gap), area, cell, `${area.width}×${area.height} ${size}`);
  }
  assert.deepEqual([...new Set(areas.map((area) => area.width))].sort((a, b) => a - b), [...widths]);
});

test("UI-09 placeShortcuts: columns fill from the top-left corner downwards, the next column starts when one is full", () => {
  const cell = cellOf("default");
  const area = { width: 768, height: 600 };
  const result = place(order, area, cell, gap);
  assert.deepEqual(result.positions.search, { x: 8, y: 8 });
  assert.deepEqual(result.positions.archive, { x: 8, y: 8 + cell.height + gap });
  const rows = Math.floor((area.height - 56 - 8 + gap) / (cell.height + gap));
  const firstOfSecond = order[rows];
  assert.deepEqual(result.positions[firstOfSecond], { x: 8 + cell.width + gap, y: 8 }, "the shortcut after a full column starts the next one at the top");
  assert.equal(result.positions[order[rows - 1]].x, 8);
  assert.equal(result.contentHeight, area.height, "everything fits, so the content is the area");
});

test("UI-09 placeShortcuts: when the width runs out the content grows downwards instead of cutting a shortcut off", () => {
  const cell = cellOf("large");
  const area = { width: 521, height: 400 };
  const result = place(order, area, cell, gap);
  assert.ok(result.contentHeight > area.height, `contentHeight ${result.contentHeight} grows past ${area.height}`);
  assertClean(result, area, cell, "521×400 large");
});

test("UI-09 placeShortcuts: a saved position outside the area is held inside and off the shortcuts already placed", () => {
  const cell = cellOf("default");
  const area = { width: 600, height: 700 };
  const saved = { trash: { x: 5000, y: 5000 }, info: { x: -40, y: -40 }, sheet: { x: 300, y: 200 } };
  const result = place(order, area, cell, gap, saved);
  assertClean(result, area, cell, "saved");
  assert.deepEqual(result.positions.sheet, { x: 300, y: 200 }, "a saved spot inside the area is kept");
  assert.deepEqual(result.positions.info, { x: 8, y: 8 }, "a spot above-left of the area is pulled to the inset");
  const trash = result.positions.trash;
  assert.ok(trash.x + cell.width <= area.width - 8 && trash.y + cell.height <= area.height - 56, "the far-away saved shortcut is pulled inside, above the taskbar reserve");
});

test("UI-09 placeShortcuts never mutates its arguments", () => {
  const ids = [...order];
  const area = { width: 521, height: 400 };
  const cell = cellOf("large");
  const saved = { trash: { x: 5000, y: 5000 } };
  const before = JSON.stringify([ids, area, cell, saved]);
  place(ids, area, cell, gap, saved);
  assert.equal(JSON.stringify([ids, area, cell, saved]), before);
});

test("UI-09: a drop at 521–900px lands where placeShortcuts keeps it — the next placement does not move the released shortcut", () => {
  const cell = cellOf("default");
  const area = { width: 768, height: 700 };
  const dropArea = (layout as unknown as { shortcutDropArea: (area: { width: number; height: number }) => { width: number; height: number } }).shortcutDropArea;
  assert.equal(typeof dropArea, "function");
  const assistant: Rect = { x: 690, y: 560, width: 70, height: 100 };
  // Inside the area, in the middle of the auto columns, past the bottom edge, and onto the assistant.
  for (const raw of [{ x: 320, y: 240 }, { x: 8, y: 8 }, { x: 400, y: 5000 }, { x: 700, y: 560 }]) {
    const dropped = clampShortcutPosition(raw, cell, dropArea(area), [assistant]);
    const result = place(order, area, cell, gap, { trash: dropped });
    assert.deepEqual(result.positions.trash, dropped, `drop ${JSON.stringify(raw)} stays where it was released`);
    assertClean(result, area, cell, `drop ${JSON.stringify(raw)}`);
  }
});

// ---- Review WR-02: the 520/521 and 900/901 borders leave no gap on a fractional width (a zoomed 520.8px) ----

test("WR-02: phone, tablet and PC queries cover every width exactly once, in the stylesheet and in the shortcuts code", () => {
  const phoneQuery = /const phoneShortcutQuery = "([^"]+)";/.exec(shortcuts)?.[1] ?? "";
  const tabletQuery = /const tabletShortcutQuery = "([^"]+)";/.exec(shortcuts)?.[1] ?? "";
  assert.equal(phoneQuery, "(max-width: 520px)");
  assert.equal(tabletQuery, "(520px < width <= 900px)");
  const phone = (width: number) => width <= 520;
  const tablet = (width: number) => 520 < width && width <= 900;
  const pc = (width: number) => width > 900;
  for (const width of [320, 520, 520.5, 520.8, 520.98, 520.99, 521, 600, 900, 900.5, 900.99, 901, 1280, 1920]) {
    assert.equal([phone(width), tablet(width), pc(width)].filter(Boolean).length, 1, `${width}px is in exactly one band`);
  }
  const css = ["../app/portia.css", "../app/portia-promotion-editor.css"].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  assert.ok(css.includes(`@media ${phoneQuery} {`), "the phone block is the JS phone query");
  assert.ok(css.includes(`@media ${tabletQuery} {`), "the tablet block is the JS tablet query");
  assert.doesNotMatch(css, /@media \(min-width: 521px\)|@media \(min-width: 901px\)|min-width: 521px\) and|\(min-width: 901px\)/, "no min-width border that pairs with a max-width one and leaves a gap");
  assert.ok(css.includes("@media (width > 900px) {"), "the PC blocks start where the phone blocks (max-width: 900px) end");
});

// Owner 22: «Выровнять значки по сетке». Owner 2026-11-21 items 29, 31 replaced the old grid (inset + n * (cell + gap), cut short by the
// 56px taskbar reserve, so it was uneven and the bottom row could not be reached) with desktopGrid: one even step over the whole area.
const cell = { width: 94, height: 86 };
const gridArea = { width: 800, height: 600 };
const grid = layout.desktopGrid(gridArea, cell);
const cellAt = (column: number, row: number) => layout.gridCellPosition(grid, column, row);
const rectAt = (column: number, row: number) => ({ ...cellAt(column, row), ...cell });
const maxColumnIndex = grid.columns - 1;
const maxRowIndex = grid.rows - 1;

test("owner 2026-11-21 item 31: desktopGrid is one even step over the whole area, the room left over shared between the cells", () => {
  const standard = cellOf("default");
  const pc = layout.desktopGrid({ width: 1366, height: 680 }, standard);
  assert.equal(pc.columns, Math.floor((1366 - 16) / standard.width));
  assert.equal(pc.rows, Math.floor((680 - 16) / standard.height));
  assert.equal(pc.pitchX, (1366 - 16) / pc.columns);
  assert.equal(pc.pitchY, (680 - 16) / pc.rows);
  assert.deepEqual([pc.originX, pc.originY], [8, 8]);
  // Every cell centre is one pitch from the next: the grid is even, nothing left at the right or the bottom.
  assert.ok(Math.abs(pc.originX + pc.columns * pc.pitchX - (1366 - 8)) < 1e-9 && Math.abs(pc.originY + pc.rows * pc.pitchY - (680 - 8)) < 1e-9);
  const steps = Array.from({ length: pc.columns - 1 }, (_, column) => layout.gridCellPosition(pc, column + 1, 0).x - layout.gridCellPosition(pc, column, 0).x);
  assert.ok(Math.max(...steps) - Math.min(...steps) <= 1, `even columns: ${steps.join(",")}`);
  // A narrow or low area is still one cell each way, of the shortcut's size.
  const tiny = layout.desktopGrid({ width: 40, height: 30 }, standard);
  assert.deepEqual([tiny.columns, tiny.rows, tiny.pitchX, tiny.pitchY], [1, 1, standard.width, standard.height]);
  assert.deepEqual(layout.desktopGrid({ width: Number.NaN, height: -5 }, standard).columns, 1);
});

test("owner 2026-11-21 item 31: a shortcut in the last row of desktopGrid is whole inside the area, above the taskbar", () => {
  for (const area of [{ width: 1366, height: 680 }, { width: 1920, height: 992 }, { width: 1280, height: 632 }]) for (const size of iconSizes) {
    const shortcut = cellOf(size);
    const desktop = layout.desktopGrid(area, shortcut);
    for (let column = 0; column < desktop.columns; column += 1) {
      const point = layout.gridCellPosition(desktop, column, desktop.rows - 1);
      assert.ok(point.y + shortcut.height <= area.height - 8 + 0.5, `${area.width}×${area.height} ${size}: the bottom row ends above the taskbar`);
      assert.ok(point.x >= 8 - 0.5 && point.x + shortcut.width <= area.width - 8 + 0.5, `${area.width}×${area.height} ${size}: inside the sides`);
      assert.ok(area.height - 8 - (point.y + shortcut.height) < desktop.pitchY - shortcut.height + 1, "no unused strip under the bottom row");
    }
  }
});

test("owner 2026-11-21 item 29: homeShortcutPositions puts all twelve shortcuts each into its own cell of the grid", () => {
  const standard = cellOf("default");
  for (const area of [{ width: 1366, height: 680 }, { width: 1920, height: 992 }, { width: 1024, height: 560 }, { width: 960, height: 420 }]) for (const size of iconSizes) {
    const shortcut = cellOf(size);
    const desktop = layout.desktopGrid(area, shortcut);
    const homes = layout.homeShortcutPositions(desktop);
    assert.deepEqual(Object.keys(homes).sort(), [...layout.desktopShortcutIds].sort(), "all twelve");
    const rects = Object.entries(homes).map(([id, point]) => ({ id, ...point, ...shortcut }));
    for (const rect of rects) {
      assert.deepEqual(layout.snapShortcutPosition(rect, desktop), { x: rect.x, y: rect.y }, `${area.width}×${area.height} ${size}: ${rect.id} stands on a cell`);
      assert.ok(rect.y + rect.height <= area.height - 8 + 0.5, `${rect.id} is inside the area`);
    }
    rects.forEach((one, i) => rects.forEach((two, j) => { if (i < j) assert.ok(!overlaps(one, two), `${area.width}×${area.height} ${size}: ${one.id} and ${two.id}`); }));
  }
  const pc = layout.desktopGrid({ width: 1366, height: 680 }, standard);
  const homes = layout.homeShortcutPositions(pc);
  const at = (column: number, row: number) => layout.gridCellPosition(pc, column, row);
  assert.deepEqual(homes.trash, at(pc.columns - 1, 0), "«Корзина» in the last column of the first row");
  assert.deepEqual(homes.charter, at(0, pc.rows - 1), "«Устав» in the bottom row, first column");
  assert.deepEqual(homes.sheet, at(1, pc.rows - 1), "«Таблица» in the bottom row, second column");
  (["search", "archive", "broadcasts", "info", "employees"] as const).forEach((id, row) => assert.deepEqual(homes[id], at(0, row), `${id} in the first column`));
  (["settings", "guide", "promotion", "template"] as const).forEach((id, row) => assert.deepEqual(homes[id], at(1, row), `${id} in the second column`));
  // A low desktop: a column that runs out goes on in the next column, nothing lands on «Устав».
  const low = layout.desktopGrid({ width: 1366, height: 4 * standard.height + 16 }, standard);
  const lowHomes = layout.homeShortcutPositions(low);
  assert.deepEqual(lowHomes.charter, layout.gridCellPosition(low, 0, 3));
  assert.deepEqual(lowHomes.info, layout.gridCellPosition(low, 1, 0), "the fourth of the first column goes on at the top of the next one");
});

test("owner 2026-11-21 item 29: turning the grid on does not move the home places", () => {
  for (const area of [{ width: 1366, height: 680 }, { width: 1920, height: 992 }, { width: 960, height: 420 }]) for (const size of iconSizes) {
    const desktop = layout.desktopGrid(area, cellOf(size));
    const homes = layout.homeShortcutPositions(desktop);
    assert.deepEqual(layout.alignShortcutsToGrid(homes, layout.desktopShortcutIds, desktop), homes, `${area.width}×${area.height} ${size}`);
  }
});

test("owner 2026-11-21 item 29: the PC places the shortcuts without a saved place in their home cells, after the desktop is measured", () => {
  const hook = /export function useShortcutPlacement\([\s\S]*?\n\}/.exec(shortcuts)?.[0] ?? "";
  assert.ok(hook.includes("const grid = desktopGrid(area, cell);") && hook.includes("homeShortcutPositions(grid)"), "PC: the homes come from the grid");
  assert.ok(hook.includes("useLayoutEffect("), "measured before the first paint, so there is no visible jump from the CSS homes");
  assert.ok(hook.includes('return band === "phone" ? null : placement;'), "the phone keeps its CSS grid");
  assert.ok(shortcuts.includes("const defaultShortcutLayout"), "the CSS homes stay only for the frame before the measurement");
});

test("snapShortcutPosition puts a position into the nearest cell of the grid", () => {
  assert.deepEqual(layout.snapShortcutPosition(cellAt(0, 0), grid), cellAt(0, 0));
  assert.deepEqual(layout.snapShortcutPosition({ x: cellAt(2, 1).x + 20, y: cellAt(2, 1).y + 30 }, grid), cellAt(2, 1));
  assert.deepEqual(layout.snapShortcutPosition({ x: cellAt(2, 1).x + 60, y: cellAt(2, 1).y + 60 }, grid), cellAt(3, 2));
});

test("snapShortcutPosition holds the cell inside the area and survives junk", () => {
  assert.deepEqual(layout.snapShortcutPosition({ x: -500, y: -500 }, grid), cellAt(0, 0));
  assert.deepEqual(layout.snapShortcutPosition({ x: 9000, y: 9000 }, grid), cellAt(maxColumnIndex, maxRowIndex));
  assert.deepEqual(layout.snapShortcutPosition({ x: Number.NaN, y: Infinity }, grid).x, cellAt(0, 0).x);
  assert.deepEqual(layout.snapShortcutPosition({ x: 300, y: 300 }, layout.desktopGrid({ width: 10, height: 10 }, cell)), { x: 8, y: 8 });
});

test("alignShortcutsToGrid gives every shortcut its own cell, the nearest free one, in the order of the shortcuts", () => {
  const order = ["a", "b", "c", "d"];
  // a and b sit almost on the same spot; c is off the grid; d has no spot at all and is left out.
  const positions = { a: { x: cellAt(0, 0).x + 2, y: cellAt(0, 0).y - 4 }, b: { x: cellAt(0, 0).x + 4, y: cellAt(0, 0).y + 40 }, c: { x: cellAt(1, 0).x + 40, y: cellAt(1, 0).y + 3 } };
  const result = layout.alignShortcutsToGrid(positions, order, grid);
  assert.deepEqual(Object.keys(result), ["a", "b", "c"]);
  assert.deepEqual(result.a, cellAt(0, 0));
  assert.deepEqual(result.b, cellAt(0, 1), "the next free cell for the one who came second");
  assert.deepEqual(result.c, cellAt(1, 0), "c is nearest to the second column");
  const rects = Object.values(result).map((point) => ({ ...point, ...cell }));
  rects.forEach((one, i) => rects.forEach((two, j) => { if (i < j) assert.ok(!overlaps(one, two)); }));
});

test("alignShortcutsToGrid never overlaps, even with more shortcuts than the area has cells", () => {
  const tiny = layout.desktopGrid({ width: 120, height: 100 }, cell);
  const order = ["a", "b", "c", "d", "e"];
  const positions = Object.fromEntries(order.map((id) => [id, { x: 8, y: 8 }]));
  const result = layout.alignShortcutsToGrid(positions, order, tiny);
  const rects = order.map((id) => ({ ...result[id], ...cell }));
  assert.equal(rects.length, 5);
  rects.forEach((one, i) => rects.forEach((two, j) => { if (i < j) assert.ok(!overlaps(one, two), `${i} and ${j}`); }));
});

test("alignShortcutsToGrid does not touch its arguments and keeps an aligned layout as it is", () => {
  const order = ["a", "b"];
  const positions = { a: cellAt(0, 0), b: cellAt(1, 1) };
  const copy = JSON.parse(JSON.stringify(positions));
  assert.deepEqual(layout.alignShortcutsToGrid(positions, order, grid), positions);
  assert.deepEqual(positions, copy);
});

test("the shortcut seam snaps a drop and an Alt+Arrow step to the grid only while the setting is on", () => {
  // Owner 2026-11-21 item 30: the drop goes through placeShortcutDrop, which snaps with the grid on (snapShortcutPosition lives inside it).
  assert.ok(shortcuts.includes("placeShortcutDrop("));
  assert.ok(shortcuts.includes("export function alignedShortcutPositions"));
  assert.ok(shortcuts.includes("ShortcutGridContext"));
  assert.ok(/const grid = useContext\(ShortcutGridContext\)/.test(shortcuts));
  assert.ok(shortcuts.includes("grid ?"), "off: the old free drop stays");
});

// 26.1-REVIEW-2 WR-05: with the grid on, a drop or an Alt+Arrow step never ends in a cell another shortcut stands in, and never leaves the grid.

test("nearestFreeGridCell: a free cell is the nearest cell, a taken one gives way to the nearest free one", () => {
  assert.deepEqual(layout.nearestFreeGridCell(cellAt(2, 1), grid, []), cellAt(2, 1), "nothing in the way: the cell itself");
  assert.deepEqual(layout.nearestFreeGridCell({ x: cellAt(2, 1).x + 10, y: cellAt(2, 1).y + 5 }, grid, [rectAt(1, 1), rectAt(0, 0)]), cellAt(2, 1), "a taken cell elsewhere does not matter");
  const dropped = layout.nearestFreeGridCell(cellAt(2, 1), grid, [rectAt(2, 1)]);
  assert.notDeepEqual(dropped, cellAt(2, 1), "the cell of another shortcut is not taken");
  assert.ok(dropped && Math.hypot(dropped.x - cellAt(2, 1).x, dropped.y - cellAt(2, 1).y) <= Math.max(grid.pitchX, grid.pitchY) + 1, "one cell away at most");
  assert.ok(dropped && [cellAt(2, 0), cellAt(2, 2), cellAt(1, 1), cellAt(3, 1)].some((next) => next.x === dropped.x && next.y === dropped.y), "a neighbouring cell");
});

test("nearestFreeGridCell: the result is always a cell of the grid, even when an obstacle sits where the drop is", () => {
  const obstacle = { x: cellAt(3, 2).x + 20, y: cellAt(3, 2).y + 20, width: 40, height: 40 };
  const dropped = layout.nearestFreeGridCell(cellAt(3, 2), grid, [obstacle]);
  assert.ok(dropped);
  assert.deepEqual(layout.snapShortcutPosition(dropped, grid), dropped, "on a cell of the grid");
  assert.ok(![obstacle].some((blocker) => dropped.x < blocker.x + blocker.width && blocker.x < dropped.x + cell.width && dropped.y < blocker.y + blocker.height && blocker.y < dropped.y + cell.height), "off the obstacle");
});

test("nearestFreeGridCell: no free cell is null, junk is held in the area", () => {
  const all = Array.from({ length: (maxColumnIndex + 1) * (maxRowIndex + 1) }, (_, index) => rectAt(index % (maxColumnIndex + 1), Math.floor(index / (maxColumnIndex + 1))));
  assert.equal(layout.nearestFreeGridCell(cellAt(0, 0), grid, all), null);
  assert.deepEqual(layout.nearestFreeGridCell({ x: Number.NaN, y: -900 }, grid, []), cellAt(0, 0));
});

test("owner 2026-11-21 item 31: a drop at the very bottom lands in the bottom row", () => {
  assert.deepEqual(layout.nearestFreeGridCell({ x: cellAt(3, 0).x, y: gridArea.height }, grid, []), cellAt(3, maxRowIndex));
  assert.deepEqual(layout.snapShortcutPosition({ x: gridArea.width, y: gridArea.height }, grid), cellAt(maxColumnIndex, maxRowIndex));
});

test("freeGridCellAlong: one step goes to the next cell, a taken cell is jumped over, the edge stops it", () => {
  const right = { x: 1, y: 0 };
  assert.deepEqual(layout.freeGridCellAlong(cellAt(1, 1), right, 1, grid, []), cellAt(2, 1));
  assert.deepEqual(layout.freeGridCellAlong(cellAt(1, 1), right, 1, grid, [rectAt(2, 1)]), cellAt(3, 1), "the taken cell is jumped over");
  assert.deepEqual(layout.freeGridCellAlong(cellAt(1, 1), { x: 0, y: -1 }, 1, grid, [rectAt(1, 0)]), null, "the top row is taken and nothing is above it: the shortcut stays");
  assert.deepEqual(layout.freeGridCellAlong(cellAt(maxColumnIndex, 1), right, 1, grid, []), null, "the last column: no cell that way");
  assert.deepEqual(layout.freeGridCellAlong(cellAt(maxColumnIndex - 1, 1), right, 4, grid, []), cellAt(maxColumnIndex, 1), "a long step past the edge ends in the last free cell short of it");
  assert.deepEqual(layout.freeGridCellAlong(cellAt(0, 0), right, 4, grid, []), cellAt(4, 0), "a long step is four cells");
  assert.deepEqual(layout.freeGridCellAlong({ x: cellAt(1, 1).x + 12, y: cellAt(1, 1).y - 9 }, right, 1, grid, []), cellAt(2, 1), "counted from the cell the shortcut is in now");
  assert.deepEqual(layout.freeGridCellAlong(cellAt(2, maxRowIndex - 1), { x: 0, y: 1 }, 1, grid, []), cellAt(2, maxRowIndex), "a step down reaches the bottom row");
});

// ---- Owner 2026-11-21 item 30: shortcuts never lie on each other, with the grid or without it ----
const pcCell = { width: 94, height: 104 };
const pcGrid = layout.desktopGrid({ width: 1366, height: 680 }, pcCell);
const pcHomes = layout.homeShortcutPositions(pcGrid);

function assertNoOverlap(positions: Record<string, { x: number; y: number }>, label: string, size = pcCell, area = pcGrid.area) {
  const rects = Object.entries(positions).map(([id, point]) => ({ id, ...point, ...size }));
  for (const rect of rects) {
    assert.ok(Number.isFinite(rect.x) && Number.isFinite(rect.y), `${label}: ${rect.id} has a finite place`);
    assert.ok(rect.x >= 8 - 0.5 && rect.y >= 8 - 0.5 && rect.x + rect.width <= area.width - 8 + 0.5 && rect.y + rect.height <= area.height - 8 + 0.5, `${label}: ${rect.id} is inside the area (${rect.x}, ${rect.y})`);
  }
  rects.forEach((one, i) => rects.forEach((two, j) => { if (i < j) assert.ok(!overlaps(one, two), `${label}: ${one.id} lies on ${two.id}`); }));
}

test("placeShortcutDrop: a drop on a free place stays where it was released; with the grid it is the cell under the point", () => {
  const free = { x: 600, y: 300 };
  assert.deepEqual(layout.placeShortcutDrop("search", free, pcHomes, pcCell, pcGrid, false), { position: free, displaced: false });
  const onGrid = layout.placeShortcutDrop("search", free, pcHomes, pcCell, pcGrid, true);
  assert.deepEqual(onGrid, { position: layout.snapShortcutPosition(free, pcGrid), displaced: false });
  // Its own place is never in the way.
  assert.deepEqual(layout.placeShortcutDrop("search", pcHomes.search, pcHomes, pcCell, pcGrid, false), { position: pcHomes.search, displaced: false });
});

test("placeShortcutDrop: every shortcut dropped on every other one lands next to it, inside the area and on nobody, with and without the grid", () => {
  for (const gridOn of [false, true]) for (const id of layout.desktopShortcutIds) for (const target of ["search", "employees", "charter", "trash", "template"] as const) {
    if (id === target) continue;
    const point = { x: pcHomes[target].x + 10, y: pcHomes[target].y + 6 };
    const { position, displaced } = layout.placeShortcutDrop(id, point, pcHomes, pcCell, pcGrid, gridOn);
    assert.equal(displaced, true, `${id} on ${target}: the place is taken`);
    assertNoOverlap({ ...pcHomes, [id]: position }, `${gridOn ? "grid" : "free"}: ${id} dropped on ${target}`);
    if (gridOn) assert.deepEqual(layout.snapShortcutPosition(position, pcGrid), position, "with the grid: a cell");
    else assert.ok(Math.hypot(position.x - point.x, position.y - point.y) <= Math.hypot(pcGrid.pitchX, pcGrid.pitchY) * 2, `${id} on ${target}: nearby, not far away`);
  }
});

test("placeShortcutDrop: in a tight group and in the corner the drop finds the nearest free place", () => {
  // A dense block of shortcuts in the top-left corner, free place only around it.
  const group: Record<string, { x: number; y: number }> = {};
  ["a", "b", "c", "d", "e", "f"].forEach((id, index) => { group[id] = { x: 8 + (index % 3) * pcCell.width, y: 8 + Math.floor(index / 3) * pcCell.height }; });
  for (const gridOn of [false, true]) for (const point of [{ x: 8, y: 8 }, { x: -200, y: -200 }, { x: 8 + pcCell.width, y: 8 + pcCell.height / 2 }]) {
    const { position, displaced } = layout.placeShortcutDrop("moved", point, group, pcCell, pcGrid, gridOn);
    assert.equal(displaced, true);
    assertNoOverlap({ ...group, moved: position }, `${gridOn ? "grid" : "free"} corner ${JSON.stringify(point)}`);
  }
  const corner = layout.placeShortcutDrop("moved", { x: 8, y: 8 }, group, pcCell, pcGrid, false).position;
  assert.deepEqual(corner, { x: 8, y: 8 + 2 * pcCell.height }, "the nearest free place: under the block (208px), nearer than right of it (282px)");
  // An obstacle (the assistant) is kept free as well.
  const assistant: Rect = { x: 1200, y: 520, width: 104, height: 150 };
  const away = layout.placeShortcutDrop("moved", { x: 1220, y: 540 }, {}, pcCell, pcGrid, false, [assistant]);
  assert.ok(away.displaced && !overlaps({ ...away.position, ...pcCell }, assistant));
});

test("resolveShortcutOverlaps: places inside and on nobody stay, a place outside is held inside, places on each other move to the nearest free ones", () => {
  const order = [...layout.desktopShortcutIds];
  assert.deepEqual(layout.resolveShortcutOverlaps(pcHomes, order, pcCell, pcGrid), pcHomes, "nothing to do");
  const free = { search: { x: 300, y: 200 }, archive: { x: 500, y: 200 } };
  assert.deepEqual(layout.resolveShortcutOverlaps(free, order, pcCell, pcGrid), free, "free places off the grid are kept");
  const out = layout.resolveShortcutOverlaps({ trash: { x: 5000, y: -40 } }, order, pcCell, pcGrid);
  assert.deepEqual(out.trash, { x: 1366 - pcCell.width - 8, y: 8 });
  const piled = Object.fromEntries(order.map((id) => [id, { x: 400, y: 300 }]));
  for (const gridOn of [false, true]) {
    const resolved = layout.resolveShortcutOverlaps(piled, order, pcCell, pcGrid, gridOn);
    assert.deepEqual(Object.keys(resolved).sort(), [...order].sort());
    assert.deepEqual(resolved.search, gridOn ? { x: 400, y: 300 } : { x: 400, y: 300 }, "the first in the order keeps its place");
    assertNoOverlap(resolved, `twelve on one spot, grid ${gridOn}`);
  }
  const junk = layout.resolveShortcutOverlaps({ search: { x: Number.NaN, y: Infinity }, archive: { x: 8, y: 8 } }, order, pcCell, pcGrid);
  assertNoOverlap(junk, "junk");
});

test("resolveShortcutOverlaps never mutates its arguments and leaves out what is not in the order", () => {
  const positions = { search: { x: 400, y: 300 }, archive: { x: 400, y: 300 }, stranger: { x: 1, y: 1 } };
  const copy = JSON.parse(JSON.stringify(positions));
  const resolved = layout.resolveShortcutOverlaps(positions, ["search", "archive"], pcCell, pcGrid);
  assert.deepEqual(positions, copy);
  assert.deepEqual(Object.keys(resolved), ["search", "archive"]);
});

test("owner 2026-11-21 item 30: the seam drops and steps through placeShortcutDrop, draws a dragged shortcut on its own and says when the place was taken", () => {
  const finish = /const finishDrag = [\s\S]*?\n  \};/.exec(shortcuts)?.[0] ?? "";
  const key = /const handleKeyDown = [\s\S]*?\n  \};/.exec(shortcuts)?.[0] ?? "";
  const move = /const handlePointerMove = [\s\S]*?\n  \};/.exec(shortcuts)?.[0] ?? "";
  assert.ok(finish.includes("placeShortcutDrop(shortcutId, operation.last, placed?.positions ?? {}, bounds.size, desktop, grid, obstacles)"), "drop: with the grid and without it");
  assert.ok(key.includes("placeShortcutDrop(shortcutId, target,"), "Alt+Arrow without the grid");
  assert.ok(key.includes("freeGridCellAlong(") && key.includes("neighbourRects(workspace)"), "Alt+Arrow with the grid jumps over the taken cells of the placement");
  for (const handler of [finish, key]) assert.ok(handler.includes("Место занято — ярлык «${label}» рядом"), "a screen reader hears that the place was taken");
  assert.ok(move.includes("setDragPosition(operation.last)") && !move.includes("onMove("), "the saved places change on the drop only, so the others do not move under the dragged one");
  assert.ok(shortcuts.includes("style: dragPosition ? placedShortcutLayout(dragPosition) : placed ? "));
  const hook = /export function useShortcutPlacement\([\s\S]*?\n\}/.exec(shortcuts)?.[0] ?? "";
  assert.ok(hook.includes("resolveShortcutOverlaps(wanted, order, cell, grid, gridOn)"), "PC: nothing is drawn on another shortcut");
});

test("owner 2026-11-21 item 30: the desktop checks the saved places once after load, in the same key, written only when one moved", () => {
  const desktop = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const anchor = desktop.indexOf("const timer = window.setTimeout(() => {\n      shortcutOverlapsChecked.current = true;");
  assert.ok(anchor > 0, "the check runs in a timer after the measurement");
  const effect = desktop.slice(anchor - 700, anchor + 700);
  assert.ok(effect.includes("resolveShortcutOverlaps(current, desktopShortcutOrder, cell, grid, gridOn)"));
  assert.ok(effect.includes("return moved ? resolved : current;"), "the key is rewritten only if a place moved");
  assert.ok(effect.includes("if (shortcutOverlapsChecked.current || !shortcutPositionsLoaded || !desktopSettingsLoaded || !shortcutPlacement) return;"), "once, after load and measurement");
  assert.ok(desktop.includes('const shortcutPositionsStorageKey = "portia-desktop-shortcuts-v3"'), "the same key (STAB-DESK-07)");
});
