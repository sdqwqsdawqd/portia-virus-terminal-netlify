import assert from "node:assert/strict";
import test from "node:test";
import { HOLD_MS, HOLD_SLOP_PX, hasPlaceToGo, holdStep, holdTargetAllowed, idleHold, liftsOnDrag, type HoldState } from "./hold-gesture.ts";

// OWN-09: a row, a tab or a card is picked up by holding it, not by a drawn handle.

const down = (at = 0, x = 100, y = 100, pointerType?: string): HoldState => holdStep(idleHold, { type: "down", x, y, at, pointerType });
const touchDown = (at = 0, x = 100, y = 100): HoldState => down(at, x, y, "touch");

test("the hold takes 400 ms and 6 px", () => {
  assert.equal(HOLD_MS, 400);
  assert.equal(HOLD_SLOP_PX, 6);
});

test("a press starts pressing; nothing is lifted yet", () => {
  const state = down();
  assert.equal(state.phase, "pressing");
  assert.equal(state.suppressClick, false);
});

test("a move of up to 6 px keeps pressing, for every kind of pointer", () => {
  for (const kind of ["mouse", "pen", "touch"]) {
    assert.equal(holdStep(down(0, 100, 100, kind), { type: "move", x: 106, y: 100, at: 100 }).phase, "pressing", kind);
    assert.equal(holdStep(down(0, 100, 100, kind), { type: "move", x: 103, y: 104, at: 100 }).phase, "pressing", `${kind}: 5 px diagonally is still within 6 px`);
  }
});

// OWN-09 (owner 2026-11-20, after 26.1-08): "нельзя переносить, хотя появляется курсор захвата". Pressing the mouse and dragging at once drifts past 6 px long before 400 ms,
// and the old model cancelled that: the press became nothing while the open-hand cursor promised a drag.
test("mouse: a drift beyond the threshold lifts at once, without waiting for 400 ms", () => {
  assert.equal(holdStep(down(0, 100, 100, "mouse"), { type: "move", x: 107, y: 100, at: 50 }).phase, "lifted");
  assert.equal(holdStep(down(0, 100, 100, "mouse"), { type: "move", x: 100, y: 93, at: 399 }).phase, "lifted");
  assert.equal(holdStep(down(0, 100, 100, "mouse"), { type: "move", x: 105, y: 105, at: 100 }).phase, "lifted", "the distance is the straight line: 7.07 px");
});

test("pen: a drift beyond the threshold lifts at once, like the mouse", () => {
  assert.equal(holdStep(down(0, 100, 100, "pen"), { type: "move", x: 107, y: 100, at: 50 }).phase, "lifted");
});

test("a press without a known kind of pointer behaves as a mouse (older calls and synthetic events)", () => {
  assert.equal(holdStep(down(), { type: "move", x: 140, y: 100, at: 10 }).phase, "lifted");
  assert.equal(holdStep(down(0, 100, 100, ""), { type: "move", x: 140, y: 100, at: 10 }).phase, "lifted");
  assert.equal(liftsOnDrag(undefined), true);
  assert.equal(liftsOnDrag(""), true);
});

test("touch: an early drift beyond the threshold cancels (the finger is scrolling)", () => {
  assert.equal(holdStep(touchDown(), { type: "move", x: 107, y: 100, at: 100 }).phase, "cancelled");
  assert.equal(holdStep(touchDown(), { type: "move", x: 100, y: 93, at: 399 }).phase, "cancelled");
  assert.equal(holdStep(touchDown(), { type: "move", x: 105, y: 105, at: 100 }).phase, "cancelled", "the distance is the straight line: 7.07 px");
  assert.equal(liftsOnDrag("touch"), false);
  assert.equal(liftsOnDrag("mouse"), true);
  assert.equal(liftsOnDrag("pen"), true);
});

test("the kind of pointer is kept through the press", () => {
  assert.equal(touchDown().pointerType, "touch");
  assert.equal(down(0, 0, 0, "pen").pointerType, "pen");
  assert.equal(down().pointerType, "mouse");
  assert.equal(holdStep(touchDown(), { type: "move", x: 101, y: 100, at: 5 }).pointerType, "touch");
});

test("the tick at 400 ms lifts, an earlier tick does not", () => {
  assert.equal(holdStep(down(), { type: "tick", at: HOLD_MS - 1 }).phase, "pressing");
  assert.equal(holdStep(down(), { type: "tick", at: HOLD_MS }).phase, "lifted");
  assert.equal(holdStep(down(1000), { type: "tick", at: 1000 + HOLD_MS }).phase, "lifted", "the time counts from the press");
});

test("mouse: a still hold of 400 ms lifts too (the second way to pick up), a small tremble does not stop it", () => {
  const trembling = holdStep(down(0, 100, 100, "mouse"), { type: "move", x: 104, y: 102, at: 200 });
  assert.equal(trembling.phase, "pressing");
  assert.equal(holdStep(trembling, { type: "tick", at: HOLD_MS }).phase, "lifted");
});

test("touch: a still hold of 400 ms lifts, and a move after the lift keeps it lifted", () => {
  const lifted = holdStep(touchDown(), { type: "tick", at: HOLD_MS });
  assert.equal(lifted.phase, "lifted");
  assert.equal(holdStep(lifted, { type: "move", x: 400, y: 400, at: 900 }).phase, "lifted");
});

test("a release that the page never heard (a move with no button pressed) ends the press; a lifted drag ends without swallowing a click", () => {
  assert.equal(holdStep(down(), { type: "move", x: 300, y: 300, at: 20, pressed: false }).phase, "idle");
  const lifted = holdStep(down(), { type: "tick", at: HOLD_MS });
  const ended = holdStep(lifted, { type: "move", x: 300, y: 300, at: 900, pressed: false });
  assert.deepEqual([ended.phase, ended.suppressClick], ["idle", false]);
  assert.equal(holdStep(down(), { type: "move", x: 300, y: 300, at: 20, pressed: true }).phase, "lifted");
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
  const cancelled = holdStep(touchDown(), { type: "move", x: 200, y: 100, at: 50 });
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

// OWN-09 (26.1-15), the second cause: under a strip of tabs only the selected section, subsection or card stands in the page, a list of one. Its head showed the open hand
// and started a hold, but there was nobody to swap with.
const alone = { rows: 1, crossesLists: false, sameKindLists: 1, otherDropGroups: 0 };

test("a row with neighbours has a place to go", () => {
  assert.equal(hasPlaceToGo({ ...alone, rows: 2 }), true);
  assert.equal(hasPlaceToGo({ ...alone, rows: 7 }), true);
});

test("a row alone in its list has none: the selected card under its tabs", () => {
  assert.equal(hasPlaceToGo(alone), false);
  assert.equal(hasPlaceToGo({ ...alone, rows: 0 }), false);
});

test("a card that may change lists has a place only if another list or another section head is on the page", () => {
  assert.equal(hasPlaceToGo({ ...alone, crossesLists: true }), false, "a single section on the page: its own list is the only one");
  assert.equal(hasPlaceToGo({ ...alone, crossesLists: true, sameKindLists: 2 }), true);
  assert.equal(hasPlaceToGo({ ...alone, crossesLists: true, otherDropGroups: 1 }), true);
  assert.equal(hasPlaceToGo({ ...alone, crossesLists: false, sameKindLists: 2, otherDropGroups: 1 }), false, "a card that cannot cross lists ignores them");
});
