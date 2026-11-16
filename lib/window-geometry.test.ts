import test from "node:test";
import assert from "node:assert/strict";
import { dragGeometry, fitGeometry, resizeGeometry } from "./window-geometry.ts";

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

const desk = { width: 1600, height: 900 };
const at = { x: 100, y: 80, width: 600, height: 400 };

test("dragging the title bar moves the window and keeps its size", () => {
  assert.deepEqual(dragGeometry(at, 50, -30, desk), { x: 150, y: 50, width: 600, height: 400 });
});

test("dragging far right keeps the full window inside the same eight-pixel inset as the left", () => {
  const next = dragGeometry(at, 5000, 5000, desk);
  assert.equal(next.x, desk.width - at.width - 8);
  assert.equal(next.y, desk.height - at.height - 8);
});

test("dragging past the top or left stops at the symmetric inset", () => {
  const next = dragGeometry(at, -5000, -5000, desk);
  assert.equal(next.x, 8);
  assert.equal(next.y, 8);
});

test("a window wider than the workspace is fitted before horizontal dragging", () => {
  assert.deepEqual(dragGeometry(at, 50, 0, { width: 120, height: 900 }), { x: 8, y: 80, width: 104, height: 400 });
});

test("resize then drag preserves the resized width and mirrored horizontal limits", () => {
  const bounds = { width: 1000, height: 700 };
  const resized = resizeGeometry({ x: 100, y: 80, width: 700, height: 400 }, "e", 120, 0, bounds, minimum);
  assert.equal(resized.width, 820);
  assert.equal(dragGeometry(resized, 5000, 0, bounds).x, 172);
  assert.equal(dragGeometry(resized, -5000, 0, bounds).x, 8);
});

const roomy = { width: 1600, height: 900 };
const frame = { x: 400, y: 200, width: 800, height: 500 };

for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const) {
  test(`resizing the ${edge} edge keeps the opposite side still and respects the minimum`, () => {
    const grown = resizeGeometry(frame, edge, edge.includes("w") ? -100 : 100, edge.includes("n") ? -100 : 100, roomy, minimum);
    const squeezed = resizeGeometry(frame, edge, edge.includes("w") ? 5000 : -5000, edge.includes("n") ? 5000 : -5000, roomy, minimum);
    for (const next of [grown, squeezed]) {
      if (edge.includes("w")) assert.equal(next.x + next.width, frame.x + frame.width);
      else assert.equal(next.x, frame.x);
      if (edge.includes("n")) assert.equal(next.y + next.height, frame.y + frame.height);
      else assert.equal(next.y, frame.y);
    }
    assert.equal(grown.width, edge.includes("e") || edge.includes("w") ? 900 : 800);
    assert.equal(grown.height, edge.includes("n") || edge.includes("s") ? 600 : 500);
    assert.equal(squeezed.width, edge.includes("e") || edge.includes("w") ? minimum.width : 800);
    assert.equal(squeezed.height, edge.includes("n") || edge.includes("s") ? minimum.height : 500);
  });
}

test("on a screen smaller than the minimum, a resize gives way to the screen", () => {
  const small = { width: 500, height: 300 };
  const next = resizeGeometry({ x: 8, y: 8, width: 484, height: 284 }, "se", -400, -400, small, minimum);
  assert.deepEqual([next.width, next.height], [484, 284]);
});

test("drag and resize at the 8px inset, one pixel outside and one pixel inside stay inside it", () => {
  const widthRoom = roomy.width - at.width - 8;
  const heightRoom = roomy.height - at.height - 8;
  for (const [dx, dy, x, y] of [
    [8 - at.x, 8 - at.y, 8, 8], [7 - at.x, 7 - at.y, 8, 8], [9 - at.x, 9 - at.y, 9, 9],
    [widthRoom - at.x, heightRoom - at.y, widthRoom, heightRoom], [widthRoom + 1 - at.x, heightRoom + 1 - at.y, widthRoom, heightRoom], [widthRoom - 1 - at.x, heightRoom - 1 - at.y, widthRoom - 1, heightRoom - 1],
  ] as const) {
    const next = dragGeometry(at, dx, dy, roomy);
    assert.deepEqual([next.x, next.y], [x, y]);
  }
  assert.equal(resizeGeometry(frame, "w", 8 - frame.x - 1, 0, roomy, minimum).x, 8);
  assert.equal(resizeGeometry(frame, "n", 0, 8 - frame.y - 1, roomy, minimum).y, 8);
  assert.equal(resizeGeometry(frame, "e", roomy.width - 8 - frame.x - frame.width + 1, 0, roomy, minimum).width, roomy.width - 8 - frame.x);
  assert.equal(resizeGeometry(frame, "s", 0, roomy.height - 8 - frame.y - frame.height + 1, roomy, minimum).height, roomy.height - 8 - frame.y);
});

test("a window taller than the workspace is fitted before vertical dragging", () => {
  assert.deepEqual(dragGeometry(at, 0, 50, { width: 1600, height: 120 }), { x: 100, y: 8, width: 600, height: 104 });
});

test("fractional bounds (DPR 1.25) give equal unrounded insets", () => {
  const dpr = { width: 1535.2, height: 763.2 };
  const fitted = fitGeometry({ x: 5000, y: 5000, width: 5000, height: 5000 }, dpr, minimum);
  assert.ok(Math.abs(fitted.x - (dpr.width - fitted.x - fitted.width)) < 1e-9);
  assert.ok(Math.abs(fitted.y - (dpr.height - fitted.y - fitted.height)) < 1e-9);
  const far = dragGeometry({ x: 100, y: 100, width: 1535.2, height: 5000 }, 5000, 5000, dpr);
  assert.ok(Math.abs(far.x - (dpr.width - far.x - far.width)) < 1e-9);
  assert.ok(Math.abs(far.y - (dpr.height - far.y - far.height)) < 1e-9);
  assert.equal(far.width, 1535.2 - 16);
  const narrow = dragGeometry({ x: 100, y: 100, width: 1000, height: 700 }, 5000, 5000, dpr);
  assert.ok(Math.abs(narrow.x - (dpr.width - 1000 - 8)) < 1e-9 && narrow.x !== Math.round(narrow.x));
});

test("zero or tiny bounds never produce negative geometry", () => {
  for (const bounds of [{ width: 0, height: 0 }, { width: 10, height: 10 }]) {
    const next = dragGeometry(at, 50, 50, bounds);
    assert.ok(next.x >= 0 && next.y >= 0 && next.width >= 0 && next.height >= 0);
  }
});

// Phase 26 UI-11a (todo 2026-10-28, item 9): the reachable inset is the same 8px on the left and on the right,
// from a mirrored start, for drag by -Δ/+Δ, for east/west resize to the edge, and for fitGeometry.
test("mirrored start (Phase 26 UI-11a): left and right insets are equal for drag, resize and fit", () => {
  const near = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
  for (const bounds of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1536, height: 864 }, { width: 1535.2, height: 763.2 }]) {
    for (const size of [{ width: 680, height: 320 }, { width: 900, height: 600 }]) {
      const starts = [8, bounds.width - size.width - 8];
      for (const startX of starts) {
        const start = { x: startX, y: 40, width: size.width, height: size.height };
        for (const delta of [1, 50, 5000]) {
          const left = dragGeometry(start, -delta, 0, bounds);
          const right = dragGeometry(start, delta, 0, bounds);
          assert.equal(left.width, size.width);
          assert.equal(right.width, size.width);
          assert.ok(left.x >= 8 - 1e-9 && bounds.width - (left.x + left.width) >= 8 - 1e-9, `drag -${delta} stays inside`);
          assert.ok(right.x >= 8 - 1e-9 && bounds.width - (right.x + right.width) >= 8 - 1e-9, `drag +${delta} stays inside`);
        }
        const farLeft = dragGeometry(start, -5000, 0, bounds);
        const farRight = dragGeometry(start, 5000, 0, bounds);
        near(farLeft.x, 8, "far left inset");
        near(bounds.width - (farRight.x + farRight.width), 8, "far right inset");
        const east = resizeGeometry(start, "e", 5000, 0, bounds, minimum);
        const west = resizeGeometry(start, "w", -5000, 0, bounds, minimum);
        near(bounds.width - (east.x + east.width), 8, "east resize inset");
        near(west.x, 8, "west resize inset");
      }
      const fitLeft = fitGeometry({ x: -5000, y: 40, ...size }, bounds, minimum);
      const fitRight = fitGeometry({ x: 5000, y: 40, ...size }, bounds, minimum);
      near(fitLeft.x, 8, "fit left inset");
      near(bounds.width - (fitRight.x + fitRight.width), 8, "fit right inset");
      const mirroredLeft = fitGeometry({ x: 8, y: 40, ...size }, bounds, minimum);
      const mirroredRight = fitGeometry({ x: bounds.width - size.width - 8, y: 40, ...size }, bounds, minimum);
      near(mirroredLeft.x, 8, "fit keeps mirrored left start");
      near(bounds.width - (mirroredRight.x + mirroredRight.width), 8, "fit keeps mirrored right start");
    }
  }
});
