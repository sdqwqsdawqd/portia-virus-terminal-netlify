import test from "node:test";
import assert from "node:assert/strict";
import { EDITOR_COLUMN_SIZE, columnMajor } from "./editor-columns.ts";

const sizes = (columns: { item: number; index: number }[][]) => columns.map((column) => column.length);
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

test("D-40 the column size is five", () => {
  assert.equal(EDITOR_COLUMN_SIZE, 5);
});

test("D-40 an empty list has no columns", () => {
  assert.deepEqual(columnMajor([]), []);
});

test("D-40 two cards stay in one column with their own indexes", () => {
  const columns = columnMajor(["a", "b"]);
  assert.equal(columns.length, 1);
  assert.deepEqual(columns[0], [
    { item: "a", index: 0 },
    { item: "b", index: 1 },
  ]);
});

test("D-40 five cards still fit one column", () => {
  assert.deepEqual(sizes(columnMajor(range(5))), [5]);
});

test("D-40 the sixth card starts a new column on the right", () => {
  const columns = columnMajor(range(6));
  assert.deepEqual(sizes(columns), [5, 1]);
  assert.deepEqual(
    columns[0].map((entry) => entry.index),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(columns[1], [{ item: 5, index: 5 }]);
});

test("D-40 eleven cards make columns of 5, 5 and 1", () => {
  assert.deepEqual(sizes(columnMajor(range(11))), [5, 5, 1]);
});

test("D-40 reading the columns top to bottom, then to the right, gives the source order", () => {
  const items = range(13).map((value) => `s${value}`);
  const flat = columnMajor(items).flat();
  assert.deepEqual(
    flat.map((entry) => entry.item),
    items,
  );
  assert.deepEqual(
    flat.map((entry) => entry.index),
    range(13),
  );
});

test("D-40 a custom column size is honoured", () => {
  assert.deepEqual(sizes(columnMajor(range(7), 3)), [3, 3, 1]);
});

test("D-40 an invalid column size falls back to at least one per column", () => {
  assert.deepEqual(sizes(columnMajor(range(3), 0)), [1, 1, 1]);
  assert.deepEqual(sizes(columnMajor(range(3), -4)), [1, 1, 1]);
  assert.deepEqual(sizes(columnMajor(range(5), 2.9)), [2, 2, 1]);
  assert.deepEqual(sizes(columnMajor(range(2), Number.NaN)), [1, 1]);
});

test("D-40 the source list is not mutated", () => {
  const items = Object.freeze(["a", "b", "c", "d", "e", "f"]);
  columnMajor(items);
  assert.deepEqual([...items], ["a", "b", "c", "d", "e", "f"]);
});
