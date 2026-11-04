import test from "node:test";
import assert from "node:assert/strict";
import { passesTarget, type Box } from "./sort-order.ts";

const own: Box = { left: 0, top: 0, width: 340, height: 100 };
const right: Box = { left: 350, top: 0, width: 340, height: 100 };
const below: Box = { left: 0, top: 110, width: 340, height: 200 };

test("same row: moving forward needs the pointer past the horizontal middle of the neighbour", () => {
  assert.equal(passesTarget(own, right, { x: 400, y: 50 }, true), false);
  assert.equal(passesTarget(own, right, { x: 600, y: 50 }, true), true);
});

test("same row: moving back needs the pointer before the horizontal middle of the neighbour", () => {
  const left: Box = { left: 0, top: 0, width: 340, height: 100 };
  const self: Box = { left: 350, top: 0, width: 340, height: 100 };
  assert.equal(passesTarget(self, left, { x: 300, y: 50 }, false), false);
  assert.equal(passesTarget(self, left, { x: 100, y: 50 }, false), true);
});

test("different rows: the vertical middle decides, as in a single column", () => {
  assert.equal(passesTarget(own, below, { x: 10, y: 150 }, true), false);
  assert.equal(passesTarget(own, below, { x: 10, y: 250 }, true), true);
  assert.equal(passesTarget({ ...below }, own, { x: 10, y: 80 }, false), false);
  assert.equal(passesTarget({ ...below }, own, { x: 10, y: 20 }, false), true);
});

test("rows of unequal height do not flip back and forth around the middle of the taller one", () => {
  const tall: Box = { left: 0, top: 110, width: 340, height: 400 };
  assert.equal(passesTarget(own, tall, { x: 10, y: 200 }, true), false);
  assert.equal(passesTarget(own, tall, { x: 10, y: 320 }, true), true);
});

test("a sub-pixel top difference still counts as the same row", () => {
  const nearly: Box = { ...right, top: 0.4 };
  assert.equal(passesTarget(own, nearly, { x: 400, y: 50 }, true), false);
  assert.equal(passesTarget(own, nearly, { x: 600, y: 50 }, true), true);
});

// D-42 (20-22): section cards sit in columns of five, column after column. Column geometry: 340 wide, 10 gap, cards 100 high.
const columnOne = [0, 1, 2, 3, 4].map((row): Box => ({ left: 0, top: row * 110, width: 340, height: 100 }));
const columnTwo = [0, 1].map((row): Box => ({ left: 350, top: row * 110, width: 340, height: 100 }));

test("D-42 same column: the target below swaps only after its vertical middle", () => {
  assert.equal(passesTarget(columnOne[1], columnOne[2], { x: 100, y: 260 }, true), false);
  assert.equal(passesTarget(columnOne[1], columnOne[2], { x: 100, y: 285 }, true), true);
});

test("D-42 neighbouring column at the same height: the horizontal middle of the target decides", () => {
  assert.equal(passesTarget(columnOne[0], columnTwo[0], { x: 400, y: 50 }, true), false);
  assert.equal(passesTarget(columnOne[0], columnTwo[0], { x: 560, y: 50 }, true), true);
  assert.equal(passesTarget(columnTwo[0], columnOne[0], { x: 300, y: 50 }, false), false);
  assert.equal(passesTarget(columnTwo[0], columnOne[0], { x: 100, y: 50 }, false), true);
});

test("D-42 from the bottom of a column to the top of the next one: the target's vertical middle decides", () => {
  const last = columnOne[4];
  const top = columnTwo[0];
  assert.equal(passesTarget(last, top, { x: 500, y: 20 }, true), false);
  assert.equal(passesTarget(last, top, { x: 500, y: 70 }, true), true);
});

test("D-42 from the top of a column back to the bottom of the previous one is symmetric", () => {
  const first = columnTwo[0];
  const bottom = columnOne[4];
  assert.equal(passesTarget(first, bottom, { x: 100, y: 520 }, false), false);
  assert.equal(passesTarget(first, bottom, { x: 100, y: 460 }, false), true);
});
