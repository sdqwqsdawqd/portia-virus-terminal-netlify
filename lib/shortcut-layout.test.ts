import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("DraggableDesktopIcon starts the cycle first, gates free drag at 900px, clamps through the pure function and opens immediately", () => {
  const down = /const handlePointerDown = [\s\S]*?\n  \};/.exec(shortcuts)?.[0] ?? "";
  assert.match(down, /handlePointerDown = \(event[^\n]*\n\s*iconAnimation\.play\(\);/);
  assert.ok(down.includes('window.matchMedia("(max-width: 900px)").matches'));
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
