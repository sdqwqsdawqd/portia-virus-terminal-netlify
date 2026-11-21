import test from "node:test";
import assert from "node:assert/strict";
import { dragGeometry, fitGeometry, refitGeometry, resizeGeometry, titlebarReachable } from "./window-geometry.ts";

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

// owner 2026-11-20 OWN-06 supersedes 18-04 variant A: a window may leave the screen to the left, right and bottom.
test("dragging far left puts the whole window behind the left edge, size unchanged", () => {
  assert.deepEqual(dragGeometry({ x: 100, y: 100, width: 400, height: 300 }, -900, 0, { width: 1200, height: 800 }), { x: -400, y: 100, width: 400, height: 300 });
});

test("dragging far right or down stops where the window is entirely beyond the edge", () => {
  const next = dragGeometry({ x: 100, y: 100, width: 400, height: 300 }, 5000, 5000, { width: 1200, height: 800 });
  assert.deepEqual(next, { x: 1200, y: 800, width: 400, height: 300 });
});

test("the title bar never goes above the workspace", () => {
  assert.equal(dragGeometry({ x: 100, y: 100, width: 400, height: 300 }, 0, -500, { width: 1200, height: 800 }).y, 0);
});

test("a window wider than the workspace keeps its size while dragging", () => {
  assert.deepEqual(dragGeometry(at, 50, 0, { width: 120, height: 900 }), { x: 120, y: 80, width: 600, height: 400 });
});

test("resize then drag preserves the resized width and the new limits", () => {
  const bounds = { width: 1000, height: 700 };
  const resized = resizeGeometry({ x: 100, y: 80, width: 700, height: 400 }, "e", 120, 0, bounds, minimum);
  assert.equal(resized.width, 820);
  assert.equal(dragGeometry(resized, 5000, 0, bounds).x, 1000);
  assert.equal(dragGeometry(resized, -5000, 0, bounds).x, -820);
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

test("resize still keeps the 8px inset, one pixel outside and one pixel inside", () => {
  assert.equal(resizeGeometry(frame, "w", 8 - frame.x - 1, 0, roomy, minimum).x, 8);
  assert.equal(resizeGeometry(frame, "n", 0, 8 - frame.y - 1, roomy, minimum).y, 8);
  assert.equal(resizeGeometry(frame, "e", roomy.width - 8 - frame.x - frame.width + 1, 0, roomy, minimum).width, roomy.width - 8 - frame.x);
  assert.equal(resizeGeometry(frame, "s", 0, roomy.height - 8 - frame.y - frame.height + 1, roomy, minimum).height, roomy.height - 8 - frame.y);
});

test("a window taller than the workspace keeps its size while dragging down", () => {
  assert.deepEqual(dragGeometry(at, 0, 50, { width: 1600, height: 120 }), { x: 100, y: 120, width: 600, height: 400 });
});

test("fractional bounds (DPR 1.25): fit keeps equal unrounded insets, drag reaches the exact edge", () => {
  const dpr = { width: 1535.2, height: 763.2 };
  const fitted = fitGeometry({ x: 5000, y: 5000, width: 5000, height: 5000 }, dpr, minimum);
  assert.ok(Math.abs(fitted.x - (dpr.width - fitted.x - fitted.width)) < 1e-9);
  assert.ok(Math.abs(fitted.y - (dpr.height - fitted.y - fitted.height)) < 1e-9);
  const far = dragGeometry({ x: 100, y: 100, width: 1000, height: 700 }, 5000, 5000, dpr);
  assert.equal(far.x, dpr.width);
  assert.equal(far.y, dpr.height);
});

test("zero or tiny bounds never produce a negative top or a smaller window", () => {
  for (const bounds of [{ width: 0, height: 0 }, { width: 10, height: 10 }]) {
    const next = dragGeometry(at, 50, 50, bounds);
    assert.ok(next.y >= 0);
    assert.equal(next.width, at.width);
    assert.equal(next.height, at.height);
  }
});

// Phase 26 UI-11a: the reachable inset of resize and fit is the same 8px on the left and on the right (drag no longer clamps, OWN-06).
test("mirrored start (Phase 26 UI-11a): left and right insets are equal for resize and fit", () => {
  const near = (actual: number, expected: number, label: string) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);
  for (const bounds of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1536, height: 864 }, { width: 1535.2, height: 763.2 }]) {
    for (const size of [{ width: 680, height: 320 }, { width: 900, height: 600 }]) {
      for (const startX of [8, bounds.width - size.width - 8]) {
        const start = { x: startX, y: 40, width: size.width, height: size.height };
        const east = resizeGeometry(start, "e", 5000, 0, bounds, minimum);
        const west = resizeGeometry(start, "w", -5000, 0, bounds, minimum);
        near(bounds.width - (east.x + east.width), 8, "east resize inset");
        near(west.x, 8, "west resize inset");
      }
      const fitLeft = fitGeometry({ x: -5000, y: 40, ...size }, bounds, minimum);
      const fitRight = fitGeometry({ x: 5000, y: 40, ...size }, bounds, minimum);
      near(fitLeft.x, 8, "fit left inset");
      near(bounds.width - (fitRight.x + fitRight.width), 8, "fit right inset");
    }
  }
});

// OWN-06: reachability of the title bar, refit on browser resize, the taskbar preview map.
const room = { width: 1200, height: 800 };

test("titlebarReachable: at least 48px of the title bar stays inside, and the window is not below the bottom", () => {
  assert.equal(titlebarReachable({ x: 100, y: 100, width: 400, height: 300 }, room), true);
  assert.equal(titlebarReachable({ x: -352, y: 100, width: 400, height: 300 }, room), true, "exactly 48px visible");
  assert.equal(titlebarReachable({ x: -353, y: 100, width: 400, height: 300 }, room), false);
  assert.equal(titlebarReachable({ x: 1152, y: 100, width: 400, height: 300 }, room), true, "48px at the right edge");
  assert.equal(titlebarReachable({ x: 1153, y: 100, width: 400, height: 300 }, room), false);
  assert.equal(titlebarReachable({ x: 100, y: 799, width: 400, height: 300 }, room), true);
  assert.equal(titlebarReachable({ x: 100, y: 800, width: 400, height: 300 }, room), false);
});

test("a window dragged by dragGeometry to the far edges is reported as unreachable", () => {
  const start = { x: 100, y: 100, width: 400, height: 300 };
  for (const [dx, dy] of [[-5000, 0], [5000, 0], [0, 5000]] as const) {
    assert.equal(titlebarReachable(dragGeometry(start, dx, dy, room), room), false);
  }
});

test("refitGeometry shrinks a window larger than the workspace and pulls it inside on that axis", () => {
  assert.deepEqual(refitGeometry({ x: 300, y: 50, width: 2000, height: 400 }, { width: 960, height: 600 }, minimum), { x: 8, y: 50, width: 944, height: 400 });
  assert.deepEqual(refitGeometry({ x: 300, y: 50, width: 700, height: 2000 }, { width: 960, height: 600 }, minimum), { x: 300, y: 8, width: 700, height: 584 });
});

test("refitGeometry leaves a partly carried window where it is", () => {
  const away = { x: -300, y: 100, width: 700, height: 400 };
  assert.deepEqual(refitGeometry(away, room, minimum), away);
  const right = { x: 1100, y: 700, width: 700, height: 400 };
  assert.deepEqual(refitGeometry(right, room, minimum), right);
});

test("refitGeometry only moves a window whose top went above the workspace", () => {
  assert.deepEqual(refitGeometry({ x: 100, y: -40, width: 700, height: 400 }, room, minimum), { x: 100, y: 0, width: 700, height: 400 });
});

