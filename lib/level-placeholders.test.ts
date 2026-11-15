// Offline client rules of the closed-record placeholders (Phase 24, plan 24-02): merge, marker normalization, viewer shape and
// the window selection rule. The browser and the live roles stay BLOCKED until plan 24-11 proves them; nothing here claims them.
// All values are invented.
import test from "node:test";
import assert from "node:assert/strict";
import {
  flattenPlaceholders,
  guideSlotChain,
  infoSlotChain,
  isViewerShapedContent,
  mergePlaceholders,
  normalizeContentRedaction,
  reconcileSelection,
  shownViewerLevel,
  simpleSlotChain,
} from "./level-placeholders.ts";
import { defaultPortiaContent, type PortiaContent, type RedactedSlot, type ScientistLog, type Virus } from "./portia-content.ts";

const node = (slot: string, at: number, requiredLevel: RedactedSlot["requiredLevel"] = 3): RedactedSlot => ({ slot, requiredLevel, at });

test("LVL-04 mergePlaceholders: placeholder goes to its own position, open positions do not shift", () => {
  const rows = mergePlaceholders(["a", "c"], [node("S_b", 1)]);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.position]),
    [["item", 0], ["redacted", 1], ["item", 2]],
  );
  assert.deepEqual(rows.map((row) => (row.kind === "item" ? row.item : row.slot)), ["a", "S_b", "c"]);
});

test("EDGE LVL-04/ordering: `at` past the end puts the placeholder last", () => {
  const rows = mergePlaceholders(["a"], [node("S_z", 99)]);
  assert.deepEqual(rows.map((row) => row.kind), ["item", "redacted"]);
  assert.equal(rows[1].position, 1);
});

test("EDGE LVL-04/ordering: no placeholder list gives only the items", () => {
  const rows = mergePlaceholders(["a", "b"], undefined);
  assert.deepEqual(rows.map((row) => row.kind), ["item", "item"]);
  assert.deepEqual(rows.map((row) => row.position), [0, 1]);
  assert.deepEqual(mergePlaceholders([], undefined), []);
});

test("EDGE LVL-04/ordering: two placeholders in a row give two rows and keep the open positions", () => {
  const rows = mergePlaceholders(["a", "d"], [node("S_b", 1), node("S_c", 2, 4)]);
  assert.deepEqual(rows.map((row) => row.kind), ["item", "redacted", "redacted", "item"]);
  assert.deepEqual(rows.map((row) => row.position), [0, 1, 2, 3]);
  assert.equal(rows[2].kind === "redacted" && rows[2].requiredLevel, 4);
});

test("EDGE LVL-04/ordering: only placeholders gives only placeholder rows", () => {
  const rows = mergePlaceholders([], [node("S_a", 0), node("S_b", 1)]);
  assert.deepEqual(rows.map((row) => row.kind), ["redacted", "redacted"]);
});

test("normalizeContentRedaction: no marker is no marker", () => {
  assert.equal(normalizeContentRedaction(undefined), undefined);
  assert.equal(normalizeContentRedaction(null), undefined);
});

test("normalizeContentRedaction: a damaged marker fails closed to level 1 with empty lists", () => {
  for (const damaged of [{}, "x", 7, [], true]) {
    const marker = normalizeContentRedaction(damaged);
    assert.ok(marker, String(damaged));
    assert.equal(marker.level, 1);
    assert.deepEqual(marker.slots, {});
    assert.deepEqual(marker.viruses, []);
    assert.deepEqual(marker.recycle, []);
    assert.deepEqual(marker.infoSections, []);
    assert.deepEqual(marker.infoSubsections, {});
    assert.deepEqual(marker.guideSections, []);
    assert.deepEqual(marker.guideCards, {});
    assert.deepEqual(marker.apps, {});
  }
  assert.equal(normalizeContentRedaction({ level: 9 })?.level, 1);
  assert.equal(normalizeContentRedaction({ level: 3 })?.level, 3);
});

test("normalizeContentRedaction: nodes without a slot or with a non-integer `at` are dropped, damaged requiredLevel reads as 5", () => {
  const marker = normalizeContentRedaction({
    level: 2,
    viruses: [
      { slot: "", requiredLevel: 3, at: 0 },
      { slot: "S_a", requiredLevel: 3, at: 1.5 },
      { slot: "S_b", requiredLevel: 3, at: -1 },
      { slot: 7, requiredLevel: 3, at: 0 },
      { slot: "S_c", requiredLevel: "3", at: 2 },
      { slot: "S_d", requiredLevel: 0, at: 3 },
      { slot: "S_e", at: 4 },
      { slot: "S_f", requiredLevel: 4, at: 5 },
      null,
      "x",
    ],
  });
  assert.deepEqual(marker?.viruses, [
    { slot: "S_c", requiredLevel: 5, at: 2 },
    { slot: "S_d", requiredLevel: 5, at: 3 },
    { slot: "S_e", requiredLevel: 5, at: 4 },
    { slot: "S_f", requiredLevel: 4, at: 5 },
  ]);
});

test("normalizeContentRedaction: keys of `slots` over 240 characters are dropped", () => {
  const long = "k".repeat(241);
  const marker = normalizeContentRedaction({ level: 2, slots: { a: "S_a", [long]: "S_long", b: "x".repeat(241), c: "" } });
  assert.deepEqual(marker?.slots, { a: "S_a" });
});

const log = (extra: Partial<ScientistLog> = {}): ScientistLog => ({ id: "l1", title: "t", scientist: "s", lockedLevel: 1, content: [], ...extra });
const withLogs = (logs: ScientistLog[]): Virus => ({ ...(defaultPortiaContent.viruses[0] as Virus), scientistLogs: logs });

test("isViewerShapedContent: marker, a withheld log in viruses or in recycledViruses, otherwise full", () => {
  const redaction = normalizeContentRedaction({ level: 1 });
  assert.equal(isViewerShapedContent({ viruses: [], recycledViruses: [], redaction }), true);
  assert.equal(isViewerShapedContent({ viruses: [withLogs([log({ withheld: true })])], recycledViruses: [] }), true);
  assert.equal(isViewerShapedContent({ viruses: [], recycledViruses: [withLogs([log({ withheld: true })])] }), true);
  assert.equal(isViewerShapedContent({ viruses: [withLogs([log()])], recycledViruses: [withLogs([log()])] }), false);
  assert.equal(isViewerShapedContent({ viruses: [], recycledViruses: [] }), false);
});

test("shownViewerLevel: the level of the marker, the editor copy shows 5", () => {
  assert.equal(shownViewerLevel({ redaction: normalizeContentRedaction({ level: 3 }) }), 3);
  assert.equal(shownViewerLevel({}), 5);
});

// D-20 / D-22: the selection rule.

test("D-20 an open record stays selected without a notice", () => {
  assert.deepEqual(
    reconcileSelection({ id: "a", lostSlot: null }, ["S_a"], { ids: ["a", "b"], slots: { a: "S_a", b: "S_b" }, placeholders: [] }),
    { id: "a", lostSlot: null, lostLevel: null },
  );
});

test("D-20 an open record that became closed gives the slot and the level of its placeholder and no id", () => {
  assert.deepEqual(
    reconcileSelection({ id: "a", lostSlot: null }, ["S_a"], { ids: ["b"], slots: { b: "S_b" }, placeholders: [{ slot: "S_a", requiredLevel: 4, at: 0 }] }),
    { id: "", lostSlot: "S_a", lostLevel: 4 },
  );
});

test("D-20 a child of a closed parent gets the placeholder of the parent", () => {
  assert.deepEqual(
    reconcileSelection({ id: "u", lostSlot: null }, ["S_u", "S_s"], { ids: [], slots: {}, placeholders: [{ slot: "S_s", requiredLevel: 3, at: 0 }] }),
    { id: "", lostSlot: "S_s", lostLevel: 3 },
  );
});

test("D-20 the nearest placeholder in the chain wins over the parent", () => {
  assert.deepEqual(
    reconcileSelection(
      { id: "u", lostSlot: null },
      ["S_u", "S_s"],
      { ids: [], slots: {}, placeholders: [{ slot: "S_s", requiredLevel: 3, at: 0 }, { slot: "S_u", requiredLevel: 5, at: 0 }] },
    ),
    { id: "", lostSlot: "S_u", lostLevel: 5 },
  );
});

test("D-22 a lost slot that is open again returns the record without a notice", () => {
  assert.deepEqual(
    reconcileSelection({ id: "", lostSlot: "S_a" }, [], { ids: ["a"], slots: { a: "S_a" }, placeholders: [] }),
    { id: "a", lostSlot: null, lostLevel: null },
  );
});

test("D-22 a lost slot still closed keeps the notice and takes the new level of the placeholder", () => {
  assert.deepEqual(
    reconcileSelection({ id: "", lostSlot: "S_a" }, [], { ids: ["b"], slots: { b: "S_b" }, placeholders: [{ slot: "S_a", requiredLevel: 5, at: 0 }] }),
    { id: "", lostSlot: "S_a", lostLevel: 5 },
  );
});

test("D-22 a slot that names a record not in the list does not reopen it", () => {
  assert.deepEqual(
    reconcileSelection({ id: "", lostSlot: "S_a" }, [], { ids: [], slots: { a: "S_a" }, placeholders: [] }),
    { id: "", lostSlot: null, lostLevel: null },
  );
});

test("D-20 a deleted record gives an empty result and the caller picks the first open one", () => {
  assert.deepEqual(
    reconcileSelection({ id: "a", lostSlot: null }, ["S_a"], { ids: ["b"], slots: { b: "S_b" }, placeholders: [{ slot: "S_other", requiredLevel: 2, at: 0 }] }),
    { id: "", lostSlot: null, lostLevel: null },
  );
  assert.deepEqual(reconcileSelection({ id: "", lostSlot: null }, [], { ids: [], slots: {}, placeholders: [] }), { id: "", lostSlot: null, lostLevel: null });
});

test("T-24-38 the result carries nothing of the previous record", () => {
  const result = reconcileSelection({ id: "CANARY_ID", lostSlot: null }, ["S_a"], { ids: [], slots: {}, placeholders: [{ slot: "S_a", requiredLevel: 2, at: 0 }] });
  assert.deepEqual(Object.keys(result).sort(), ["id", "lostLevel", "lostSlot"]);
  assert.equal(result.id, "");
});

// Slot chains.

const contentWith = (extra: Partial<PortiaContent>): PortiaContent => ({ ...(structuredClone(defaultPortiaContent) as PortiaContent), ...extra });
const marker = (slots: Record<string, string>) => ({ ...normalizeContentRedaction({ level: 2 })!, slots });

test("slot chains: simple, info and guide give the record and its parents, nearest first, no empty entries", () => {
  const info = [{ id: "s", title: "s", body: "", subsections: [{ id: "u", title: "u", blocks: [] }] }];
  const guide = [{ id: "g", title: "g", photo: "", cards: [{ id: "c", title: "c", cover: "", blocks: [] }] }];
  const content = contentWith({ infoSections: info, guideSections: guide, redaction: marker({ v: "S_v", u: "S_u", s: "S_s", c: "S_c", g: "S_g" }) });
  assert.deepEqual(simpleSlotChain(content, "v"), ["S_v"]);
  assert.deepEqual(simpleSlotChain(content, "none"), []);
  assert.deepEqual(infoSlotChain(content, "u"), ["S_u", "S_s"]);
  assert.deepEqual(infoSlotChain(content, "s"), ["S_s"]);
  assert.deepEqual(guideSlotChain(content, "c"), ["S_c", "S_g"]);
  assert.deepEqual(guideSlotChain(content, "g"), ["S_g"]);
  const partial = contentWith({ infoSections: info, redaction: marker({ s: "S_s" }) });
  assert.deepEqual(infoSlotChain(partial, "u"), ["S_s"]);
});

test("slot chains: an editor copy has no marker, the chain is empty", () => {
  const content = contentWith({ redaction: undefined });
  assert.deepEqual(simpleSlotChain(content, "a"), []);
  assert.deepEqual(infoSlotChain(content, "a"), []);
  assert.deepEqual(guideSlotChain(content, "a"), []);
});

test("flattenPlaceholders: lists of every key in order, undefined gives an empty list", () => {
  const x = node("S_x", 0);
  const y = node("S_y", 1);
  assert.deepEqual(flattenPlaceholders({ s1: [x], s2: [y] }), [x, y]);
  assert.deepEqual(flattenPlaceholders(undefined), []);
});
