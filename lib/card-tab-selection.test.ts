import assert from "node:assert/strict";
import test from "node:test";
import { resolveCardTab, type CardTabGroup } from "./card-tab-selection.ts";

const seen = (ids: string[], selected = ids[0]): CardTabGroup => ({ selected, known: ids });

test("OWN-10: the first look selects the first id; an empty group selects nothing", () => {
  assert.equal(resolveCardTab(undefined, ["a", "b"]).active, "a");
  assert.deepEqual(resolveCardTab(undefined, []), { active: "", group: { selected: "", known: [] } });
  assert.equal(resolveCardTab(seen(["a"]), []).active, "");
});

test("OWN-10: a choice stays while its id is in the group, even when the order changes", () => {
  assert.equal(resolveCardTab(seen(["a", "b", "c"], "b"), ["a", "b", "c"]).active, "b");
  assert.equal(resolveCardTab(seen(["a", "b", "c"], "b"), ["c", "b", "a"]).active, "b", "a moved tab keeps the choice");
});

test("OWN-10: a new id becomes the selected one at once; the last of several new ones", () => {
  assert.equal(resolveCardTab(seen(["a", "b"], "a"), ["a", "b", "c"]).active, "c");
  assert.equal(resolveCardTab(seen(["a", "b"], "b"), ["x", "a", "b"]).active, "x", "a card added in front is the new one too");
  assert.equal(resolveCardTab(seen(["a"]), ["a", "n1", "n2"]).active, "n2");
});

test("OWN-10: after the look the new id is known, so the next render keeps it (a render may repeat)", () => {
  const first = resolveCardTab(seen(["a", "b"], "a"), ["a", "b", "c"]);
  const again = resolveCardTab(first.group, ["a", "b", "c"]);
  assert.equal(again.active, "c");
  assert.deepEqual(again.group, first.group);
});

test("OWN-10: deleting the selected one selects the neighbour at its place, or the last", () => {
  assert.equal(resolveCardTab(seen(["a", "b", "c"], "b"), ["a", "c"]).active, "c");
  assert.equal(resolveCardTab(seen(["a", "b", "c"], "c"), ["a", "b"]).active, "b");
  assert.equal(resolveCardTab(seen(["a", "b"], "a"), ["b"]).active, "b");
  // Index ids (mutations have no id): deleting the shown last one steps back, deleting a middle one shows the one that moved up.
  assert.equal(resolveCardTab(seen(["0", "1", "2", "3"], "3"), ["0", "1", "2"]).active, "2");
  assert.equal(resolveCardTab(seen(["0", "1", "2", "3"], "1"), ["0", "1", "2"]).active, "1");
});

test("OWN-10: deleting a tab that is not selected keeps the choice", () => {
  assert.equal(resolveCardTab(seen(["a", "b", "c"], "c"), ["a", "c"]).active, "c");
});
