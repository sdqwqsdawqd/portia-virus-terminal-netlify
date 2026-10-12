import test from "node:test";
import assert from "node:assert/strict";
import { fitGeometry, resizeGeometry } from "./window-geometry.ts";

const minimum = { width: 680, height: 320 };

test("a window opened on a big screen shrinks into a small one", () => {
  const fitted = fitGeometry({ x: 200, y: 100, width: 1120, height: 760 }, { width: 960, height: 600 }, minimum);
  assert.deepEqual(fitted, { x: 8, y: 8, width: 944, height: 584 });
});

test("the minimum size gives way when the screen is smaller than it", () => {
  const fitted = fitGeometry({ x: 0, y: 0, width: 300, height: 200 }, { width: 500, height: 300 }, minimum);
  assert.equal(fitted.width, 484);
  assert.equal(fitted.height, 284);
});

test("dragging the left edge keeps the right edge in place", () => {
  const start = { x: 300, y: 100, width: 800, height: 500 };
  const next = resizeGeometry(start, "w", -120, 0, { width: 1600, height: 900 }, minimum);
  assert.equal(next.x, 180);
  assert.equal(next.x + next.width, start.x + start.width);
});

test("an edge never pushes the window past the workspace or below its minimum", () => {
  const start = { x: 100, y: 100, width: 800, height: 500 };
  const bounds = { width: 1000, height: 700 };
  assert.equal(resizeGeometry(start, "se", 900, 900, bounds, minimum).width, 892);
  assert.equal(resizeGeometry(start, "n", 0, 900, bounds, minimum).height, 320);
  assert.equal(resizeGeometry(start, "nw", -900, -900, bounds, minimum).x, 8);
});
