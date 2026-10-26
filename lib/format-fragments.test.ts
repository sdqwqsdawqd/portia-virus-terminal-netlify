import test from "node:test";
import assert from "node:assert/strict";
import { dropFields, mergeFragments, pickCurrentRange, removeFragmentAt, type FormatFragment } from "./format-fragments.ts";

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

test("a Firefox Ctrl selection holding two ranges reads the new one, not range 0", () => {
  const first = { start: 2, end: 6 };
  const second = { start: 20, end: 25 };
  assert.deepEqual(pickCurrentRange([first, second], [first]), second);
  assert.deepEqual(pickCurrentRange([second, first], [first]), second); // sorted in document order the new range may come first
});

test("one range, no range, and nothing new", () => {
  assert.equal(pickCurrentRange([]), null);
  assert.deepEqual(pickCurrentRange([{ start: 1, end: 3 }]), { start: 1, end: 3 });
  assert.deepEqual(pickCurrentRange([{ start: 1, end: 3 }, { start: 5, end: 8 }], [{ start: 1, end: 3 }, { start: 5, end: 8 }]), { start: 5, end: 8 });
});

const target = (key: string, fragments: FormatFragment[], peers: string[]) => ({ key, document: "doc", selection: { start: 0, end: 1 }, fragments, peers: Object.fromEntries(peers.map((name) => [name, { key: name }])) });

test("a gone target drops the whole selection", () => {
  assert.equal(dropFields(target("b", [f("a", 1, 3)], ["a"]), (key) => key === "b"), null);
});

test("a gone peer leaves with its fragments", () => {
  const before = target("b", [f("a", 1, 3), f("c", 0, 2)], ["a", "c"]);
  const after = dropFields(before, (key) => key === "a");
  assert.deepEqual(after?.fragments, [f("c", 0, 2)]);
  assert.deepEqual(Object.keys(after?.peers ?? {}), ["c"]);
  assert.equal(after?.key, "b");
  assert.equal(after?.document, "doc");
  assert.deepEqual(after?.selection, { start: 0, end: 1 });
});

test("nothing gone keeps the same target", () => {
  const before = target("b", [f("a", 1, 3)], ["a"]);
  assert.equal(dropFields(before, (key) => key === "z"), before);
});
