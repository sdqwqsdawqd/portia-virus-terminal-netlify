import assert from "node:assert/strict";
import test from "node:test";
import { HOLD_MS, HOLD_SLOP_PX, holdStep, holdTargetAllowed, idleHold, type HoldState } from "./hold-gesture.ts";

// OWN-09: a row, a tab or a card is picked up by holding it, not by a drawn handle.

const down = (at = 0, x = 100, y = 100): HoldState => holdStep(idleHold, { type: "down", x, y, at });

test("the hold takes 400 ms and 6 px", () => {
  assert.equal(HOLD_MS, 400);
  assert.equal(HOLD_SLOP_PX, 6);
});

test("a press starts pressing; nothing is lifted yet", () => {
  const state = down();
  assert.equal(state.phase, "pressing");
  assert.equal(state.suppressClick, false);
});

test("a move of up to 6 px keeps pressing, a move beyond it cancels before the time is up", () => {
  assert.equal(holdStep(down(), { type: "move", x: 106, y: 100, at: 100 }).phase, "pressing");
  assert.equal(holdStep(down(), { type: "move", x: 103, y: 104, at: 100 }).phase, "pressing", "5 px diagonally is still within 6 px");
  assert.equal(holdStep(down(), { type: "move", x: 107, y: 100, at: 100 }).phase, "cancelled");
  assert.equal(holdStep(down(), { type: "move", x: 100, y: 93, at: 399 }).phase, "cancelled");
  assert.equal(holdStep(down(), { type: "move", x: 105, y: 105, at: 100 }).phase, "cancelled", "the distance is the straight line: 7.07 px");
});

test("the tick at 400 ms lifts, an earlier tick does not", () => {
  assert.equal(holdStep(down(), { type: "tick", at: HOLD_MS - 1 }).phase, "pressing");
  assert.equal(holdStep(down(), { type: "tick", at: HOLD_MS }).phase, "lifted");
  assert.equal(holdStep(down(1000), { type: "tick", at: 1000 + HOLD_MS }).phase, "lifted", "the time counts from the press");
});

test("a release before the lift is an ordinary click: idle, the click is not suppressed", () => {
  const state = holdStep(down(), { type: "up" });
  assert.equal(state.phase, "idle");
  assert.equal(state.suppressClick, false);
});

test("a release or cancel after the lift ends the drag and suppresses the click that follows", () => {
  const lifted = holdStep(down(), { type: "tick", at: HOLD_MS });
  assert.deepEqual([holdStep(lifted, { type: "up" }).phase, holdStep(lifted, { type: "up" }).suppressClick], ["idle", true]);
  assert.deepEqual([holdStep(lifted, { type: "cancel" }).phase, holdStep(lifted, { type: "cancel" }).suppressClick], ["idle", true]);
});

test("a cancel while pressing (scroll took the touch) is idle without suppressing", () => {
  const state = holdStep(down(), { type: "cancel" });
  assert.equal(state.phase, "idle");
  assert.equal(state.suppressClick, false);
});

test("moving after the lift keeps it lifted: the drag is the pointer's business", () => {
  const lifted = holdStep(down(), { type: "tick", at: HOLD_MS });
  assert.equal(holdStep(lifted, { type: "move", x: 300, y: 300, at: 900 }).phase, "lifted");
});

test("a move that arrives after the time is up, before the tick, still lifts and does not cancel", () => {
  assert.equal(holdStep(down(), { type: "move", x: 140, y: 100, at: HOLD_MS + 5 }).phase, "lifted");
});

test("a second press while pressing restarts; a cancelled hold ignores moves and ticks until the next press", () => {
  const cancelled = holdStep(down(), { type: "move", x: 200, y: 100, at: 50 });
  assert.equal(cancelled.phase, "cancelled");
  assert.equal(holdStep(cancelled, { type: "tick", at: HOLD_MS }).phase, "cancelled");
  assert.equal(holdStep(cancelled, { type: "move", x: 100, y: 100, at: 60 }).phase, "cancelled");
  assert.equal(holdStep(cancelled, { type: "up" }).phase, "idle");
  assert.equal(holdStep(cancelled, { type: "down", x: 5, y: 5, at: 70 }).phase, "pressing");
});

test("idle ignores moves, ticks and releases", () => {
  for (const event of [{ type: "move", x: 1, y: 1, at: 1 }, { type: "tick", at: 500 }, { type: "up" }, { type: "cancel" }] as const) {
    const state = holdStep(idleHold, event);
    assert.equal(state.phase, "idle");
    assert.equal(state.suppressClick, false);
  }
});

const plain = { tag: "button", editable: false, insideActions: false, nestedRow: false };

test("a tab, a card head, a label and a plain part of a row may start a hold", () => {
  assert.equal(holdTargetAllowed(plain), true);
  assert.equal(holdTargetAllowed({ ...plain, tag: "span" }), true);
  assert.equal(holdTargetAllowed({ ...plain, tag: "label" }), true);
  assert.equal(holdTargetAllowed({ ...plain, tag: "strong" }), true);
});

test("fields, links, editable text, action buttons and nested rows may not", () => {
  for (const tag of ["input", "textarea", "select", "a", "INPUT", "TEXTAREA"]) {
    assert.equal(holdTargetAllowed({ ...plain, tag }), false, tag);
  }
  assert.equal(holdTargetAllowed({ ...plain, tag: "div", editable: true }), false, "contentEditable");
  assert.equal(holdTargetAllowed({ ...plain, insideActions: true }), false, "buttons of .nested-editor-actions");
  assert.equal(holdTargetAllowed({ ...plain, nestedRow: true }), false, "a target inside a nested row belongs to that row");
});
