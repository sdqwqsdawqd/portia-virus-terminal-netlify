import test from "node:test";
import assert from "node:assert/strict";
import { openedWindow, visibleWindowCount, windowAppears, type OpenOrigin, type WindowState } from "./window-open.ts";

const bounds = { width: 1200, height: 800 };
const minimum = { width: 520, height: 420 };
const origin: OpenOrigin = { x: 40, y: 50, kind: "icon" };
const oldOrigin: OpenOrigin = { x: 900, y: 790, kind: "taskbar" };
const created = { x: 100, y: 80, width: 700, height: 500 };
const closed: WindowState = { open: false, minimized: false, maximized: false, z: 10 };

test("a closed window opens visible with the new origin and a cascaded geometry", () => {
  let calls = 0;
  const next = openedWindow(closed, origin, bounds, minimum, () => { calls += 1; return created; });
  assert.deepEqual(next, { open: true, minimized: false, maximized: false, z: 10, exiting: undefined, openOrigin: origin, geometry: created });
  assert.equal(calls, 1);
  assert.equal(windowAppears(closed), true);
});

test("a minimized window with a remembered geometry is restored, refitted and keeps maximized and z", () => {
  const state: WindowState = { open: true, minimized: true, maximized: true, z: 14, geometry: { x: 120, y: 90, width: 640, height: 480 }, openOrigin: oldOrigin };
  let calls = 0;
  const next = openedWindow(state, origin, bounds, minimum, () => { calls += 1; return created; });
  assert.equal(next.minimized, false);
  assert.equal(next.maximized, true);
  assert.equal(next.z, 14);
  assert.deepEqual(next.openOrigin, origin);
  assert.deepEqual(next.geometry, { x: 120, y: 90, width: 640, height: 480 });
  assert.equal(calls, 0);
});

test("re-opening a window that is closing or minimising cancels the exit", () => {
  for (const exiting of ["close", "minimize"] as const) {
    const state: WindowState = { open: true, minimized: false, maximized: false, z: 11, exiting, geometry: { x: 20, y: 20, width: 600, height: 450 }, openOrigin: oldOrigin };
    const next = openedWindow(state, origin, bounds, minimum, () => created);
    assert.equal(next.exiting, undefined);
    assert.equal(next.open, true);
    assert.deepEqual(next.openOrigin, origin);
    assert.equal(windowAppears(state), true);
  }
});

test("a visible window behind others only keeps its origin, so its animation is not replayed (D-05)", () => {
  const state: WindowState = { open: true, minimized: false, maximized: false, z: 12, geometry: { x: 20, y: 20, width: 600, height: 450 }, openOrigin: oldOrigin };
  assert.equal(windowAppears(state), false);
  const next = openedWindow(state, origin, bounds, minimum, () => created);
  assert.deepEqual(next, { ...state, exiting: undefined });
  assert.equal(next.openOrigin, oldOrigin);
});

test("a remembered geometry bigger than the screen is refitted inside the bounds and above the minimum", () => {
  const state: WindowState = { open: true, minimized: true, maximized: false, z: 10, geometry: { x: 700, y: 500, width: 2000, height: 1500 } };
  const next = openedWindow(state, origin, { width: 900, height: 600 }, minimum, () => created);
  const geometry = next.geometry!;
  assert.ok(geometry.x >= 0 && geometry.y >= 0);
  assert.ok(geometry.x + geometry.width <= 900);
  assert.ok(geometry.y + geometry.height <= 600);
  assert.ok(geometry.width >= minimum.width && geometry.height >= minimum.height);
});

test("only open, unminimised, non-exiting windows count as visible", () => {
  const windows: Record<string, WindowState> = {
    a: { open: true, minimized: false, maximized: false, z: 1 },
    b: { open: true, minimized: true, maximized: false, z: 1 },
    c: { open: true, minimized: false, maximized: false, z: 1, exiting: "close" },
    d: closed,
    e: { open: true, minimized: false, maximized: true, z: 1 },
  };
  assert.equal(visibleWindowCount(windows), 2);
});

test("openedWindow does not mutate its argument", () => {
  const state: WindowState = { open: true, minimized: true, maximized: false, z: 10, exiting: "minimize", geometry: { x: 20, y: 20, width: 600, height: 450 }, openOrigin: oldOrigin };
  const snapshot = structuredClone(state);
  openedWindow(state, origin, bounds, minimum, () => created);
  assert.deepEqual(state, snapshot);
});
