import test from "node:test";
import assert from "node:assert/strict";
import { clampPanelOffset, initialPanelOffset, parsePanelOffset } from "./panel-position.ts";

const panel = { width: 680, height: 300 };
const bounds = { width: 1920, height: 1080 };

test("a place inside the screen is kept", () => {
  assert.deepEqual(clampPanelOffset({ right: 100, bottom: 120 }, panel, bounds), { right: 100, bottom: 120 });
});

test("64px of the panel stay on screen sideways", () => {
  assert.equal(clampPanelOffset({ right: -9999, bottom: 120 }, panel, bounds).right, -616);
  assert.equal(clampPanelOffset({ right: 9999, bottom: 120 }, panel, bounds).right, 1856);
});

test("the top edge stays on screen and 64px of the header stay above the bottom", () => {
  assert.equal(clampPanelOffset({ right: 100, bottom: 9999 }, panel, bounds).bottom, 780);
  assert.equal(clampPanelOffset({ right: 100, bottom: -9999 }, panel, bounds).bottom, -236);
});

test("the same limits hold at 1280x720", () => {
  const small = { width: 1280, height: 720 };
  assert.equal(clampPanelOffset({ right: 100, bottom: 9999 }, panel, small).bottom, 420);
  assert.equal(clampPanelOffset({ right: 9999, bottom: 120 }, panel, small).right, 1216);
});

test("a legacy editor-relative place is kept as a viewport place", () => {
  assert.deepEqual(clampPanelOffset({ right: 14, bottom: 72 }, panel, bounds), { right: 14, bottom: 72 });
});

test("a screen lower than the panel keeps the header on screen", () => {
  assert.equal(clampPanelOffset({ right: 100, bottom: -9999 }, panel, { width: 1280, height: 200 }).bottom, -236);
});

test("fractional places come back in whole pixels", () => {
  assert.deepEqual(clampPanelOffset({ right: 100.4, bottom: 120.6 }, panel, bounds), { right: 100, bottom: 121 });
});

test("a saved place is read back", () => {
  assert.deepEqual(parsePanelOffset('{"right":120,"bottom":200}'), { right: 120, bottom: 200 });
});

test("junk in storage gives no place", () => {
  for (const raw of [null, "", "{bad", "null", "[]", '{"right":"5","bottom":1}', '{"right":1e999,"bottom":1}']) assert.equal(parsePanelOffset(raw), null, String(raw));
});

test("extra keys are dropped", () => {
  assert.deepEqual(parsePanelOffset('{"right":5,"bottom":1,"x":9}'), { right: 5, bottom: 1 });
});

test("the first place is 16px right of the editor window when the panel fits there", () => {
  assert.deepEqual(initialPanelOffset({ right: 1120, bottom: 880 }, panel, bounds), { right: 104, bottom: 200 });
});

test("without room beside the editor the first place is the default corner above the taskbar", () => {
  assert.deepEqual(initialPanelOffset({ right: 1400, bottom: 880 }, panel, bounds), { right: 16, bottom: 60 });
});

test("without an editor window the first place is the default corner", () => {
  assert.deepEqual(initialPanelOffset(null, panel, bounds), { right: 16, bottom: 60 });
});

test("the first place always passes through the clamp", () => {
  assert.equal(initialPanelOffset({ right: 1120, bottom: 2000 }, panel, bounds).bottom, -236);
});

test("a drag by mouse or touch, with fractional pointer coordinates, always lands on whole pixels inside the limits (STAB-APP-08)", () => {
  const minRight = 64 - panel.width;
  const maxRight = bounds.width - 64;
  for (let start = -3000; start <= 5000; start += 137.3) {
    const placed = clampPanelOffset({ right: start, bottom: start / 2 }, panel, bounds);
    assert.ok(Number.isInteger(placed.right) && Number.isInteger(placed.bottom), String(start));
    assert.ok(placed.right >= minRight && placed.right <= maxRight, `right at ${start}`);
    assert.ok(placed.bottom >= 64 - panel.height && placed.bottom <= bounds.height - panel.height, `bottom at ${start}`);
  }
});

test("moving the panel again from a clamped place does not move it (STAB-APP-08)", () => {
  for (const offset of [{ right: -9999, bottom: 9999 }, { right: 9999, bottom: -9999 }, { right: 100.6, bottom: 120.4 }]) {
    const once = clampPanelOffset(offset, panel, bounds);
    assert.deepEqual(clampPanelOffset(once, panel, bounds), once);
  }
});

test("a panel wider than the screen still keeps 64px of its header reachable (STAB-APP-08)", () => {
  const phone = { width: 360, height: 640 };
  const placed = clampPanelOffset({ right: -9999, bottom: 120 }, panel, phone);
  assert.equal(placed.right, 64 - panel.width);
  assert.ok(phone.width - (placed.right + panel.width) >= 0);
});
