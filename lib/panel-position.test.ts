import test from "node:test";
import assert from "node:assert/strict";
import { clampPanelOffset, parsePanelOffset } from "./panel-position.ts";

const panel = { width: 680, height: 300 };
const bounds = { width: 1100, height: 760 };

test("a place inside the window is kept", () => {
  assert.deepEqual(clampPanelOffset({ right: 100, bottom: 120 }, panel, bounds), { right: 100, bottom: 120 });
});

test("the panel keeps 8px from the sides", () => {
  assert.equal(clampPanelOffset({ right: 2, bottom: 120 }, panel, bounds).right, 8);
  assert.equal(clampPanelOffset({ right: 9999, bottom: 120 }, panel, bounds).right, 1100 - 680 - 8);
});

test("the panel stays above the save bar and below the title bar", () => {
  assert.equal(clampPanelOffset({ right: 100, bottom: 10 }, panel, bounds).bottom, 72);
  assert.equal(clampPanelOffset({ right: 100, bottom: 9999 }, panel, bounds).bottom, 760 - 300 - 54);
});

test("a window smaller than the panel gives the default corner", () => {
  assert.deepEqual(clampPanelOffset({ right: 500, bottom: 500 }, panel, { width: 400, height: 200 }), { right: 8, bottom: 72 });
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
