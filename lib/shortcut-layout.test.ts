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
  assert.ok(down.includes('window.matchMedia("(max-width: 520px)").matches'));
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
  const start = css.indexOf("@media (min-width: 521px) and (max-width: 900px) {");
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
