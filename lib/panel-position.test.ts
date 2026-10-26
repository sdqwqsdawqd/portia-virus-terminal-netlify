import test from "node:test";
import assert from "node:assert/strict";
import { clampPanelOffset, parsePanelOffset } from "./panel-position.ts";

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
