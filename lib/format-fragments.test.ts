import test from "node:test";
import assert from "node:assert/strict";
import { mergeFragments, removeFragmentAt, type FormatFragment } from "./format-fragments.ts";

const f = (key: string, from: number, to: number): FormatFragment => ({ key, from, to });

test("an empty list stays empty and a single fragment comes back unchanged", () => {
  assert.deepEqual(mergeFragments([]), []);
  assert.deepEqual(mergeFragments([f("a", 2, 6)]), [f("a", 2, 6)]);
});

test("merge does not mutate its input", () => {
  const input = [f("a", 9, 2), f("a", 4, 5)];
  const copy = structuredClone(input);
  mergeFragments(input);
  assert.deepEqual(input, copy);
});

test("overlapping fragments of one field merge", () => {
  assert.deepEqual(mergeFragments([f("a", 2, 6), f("a", 4, 9)]), [f("a", 2, 9)]);
});

test("touching fragments merge", () => {
  assert.deepEqual(mergeFragments([f("a", 2, 6), f("a", 6, 9)]), [f("a", 2, 9)]);
});

test("a fragment inside another merges into it", () => {
  assert.deepEqual(mergeFragments([f("a", 2, 20), f("a", 4, 9)]), [f("a", 2, 20)]);
});

test("separated fragments stay two", () => {
  assert.deepEqual(mergeFragments([f("a", 2, 5), f("a", 6, 9)]), [f("a", 2, 5), f("a", 6, 9)]);
});

test("the same offsets in different fields stay two", () => {
  assert.deepEqual(mergeFragments([f("b", 2, 6), f("a", 2, 6)]), [f("a", 2, 6), f("b", 2, 6)]);
});

test("a collapsed fragment is dropped and a reversed one is read in order", () => {
  assert.deepEqual(mergeFragments([f("a", 4, 4), f("a", 9, 2)]), [f("a", 2, 9)]);
  assert.deepEqual(mergeFragments([f("a", 4, 4)]), []);
});

test("output is sorted by field, then by start", () => {
  assert.deepEqual(
    mergeFragments([f("b", 10, 12), f("a", 8, 9), f("b", 1, 2), f("a", 1, 2)]),
    [f("a", 1, 2), f("a", 8, 9), f("b", 1, 2), f("b", 10, 12)],
  );
});

test("offsets are UTF-16 code units: a surrogate pair is never split by a merge", () => {
  const text = "a😀b";
  const [merged] = mergeFragments([f("a", 1, 3)]);
  assert.equal(text.slice(merged.from, merged.to), "😀");
});

test("removeFragmentAt drops the fragment that holds the position, edges included", () => {
  const list = [f("a", 2, 6), f("a", 8, 9), f("b", 2, 6)];
  assert.deepEqual(removeFragmentAt(list, "a", 4), [f("a", 8, 9), f("b", 2, 6)]);
  assert.deepEqual(removeFragmentAt(list, "a", 2), [f("a", 8, 9), f("b", 2, 6)]);
  assert.deepEqual(removeFragmentAt(list, "a", 6), [f("a", 8, 9), f("b", 2, 6)]);
});

test("removeFragmentAt leaves the list equal on a miss or another field", () => {
  const list = [f("a", 2, 6), f("b", 2, 6)];
  assert.deepEqual(removeFragmentAt(list, "a", 7), list);
  assert.deepEqual(removeFragmentAt(list, "c", 4), list);
});
