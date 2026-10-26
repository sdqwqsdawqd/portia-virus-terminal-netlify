import test from "node:test";
import assert from "node:assert/strict";
import type { RichTextDocument } from "./portia-content.ts";
import type { FieldSelectionEvent, FieldSelectionState } from "./rich-text-style.ts";
import {
  applyRichTextStyle,
  compactRuns,
  fieldSelectionStep,
  nextFieldSelection,
  rangeHasStyle,
  removeRichTextStyleKeys,
  rangeIsPlain,
  resetRichTextStyle,
  resolveRange,
  stylePresets,
  togglePreset,
  wordRangeAt,
} from "./rich-text-style.ts";

const plain = (text: string): RichTextDocument => ({ runs: [{ text }] });

test("a collapsed range changes nothing, it never widens to the whole field", () => {
  const doc = plain("привет мир");
  assert.deepEqual(applyRichTextStyle(doc, 3, 3, { fontWeight: 800 }), doc);
});

test("a range styles only its characters, in either direction, clamped to the text", () => {
  const expected = { runs: [{ text: "привет", style: { fontWeight: 800 } }, { text: " мир" }] };
  assert.deepEqual(applyRichTextStyle(plain("привет мир"), 0, 6, { fontWeight: 800 }), expected);
  assert.deepEqual(applyRichTextStyle(plain("привет мир"), 6, 0, { fontWeight: 800 }), expected);
  assert.deepEqual(applyRichTextStyle(plain("привет мир"), -5, 6, { fontWeight: 800 }), expected);
  assert.deepEqual(
    applyRichTextStyle(plain("мир"), 1, 99, { fontWeight: 800 }),
    { runs: [{ text: "м" }, { text: "ир", style: { fontWeight: 800 } }] },
  );
});

test("rangeHasStyle needs every character to carry every property, colours ignore case", () => {
  const doc = applyRichTextStyle(plain("привет мир"), 0, 6, { fontWeight: 800, color: "#B43632" });
  assert.equal(rangeHasStyle(doc, 0, 6, { fontWeight: 800 }), true);
  assert.equal(rangeHasStyle(doc, 0, 6, { color: "#b43632" }), true);
  assert.equal(rangeHasStyle(doc, 0, 7, { fontWeight: 800 }), false);
  assert.equal(rangeHasStyle(doc, 0, 6, { fontWeight: 600 }), false);
  assert.equal(rangeHasStyle(doc, 2, 2, { fontWeight: 800 }), false);
});

test("pressing a preset twice restores the original document", () => {
  const doc = plain("привет мир");
  const heading = togglePreset(doc, 0, 6, stylePresets.heading);
  assert.deepEqual(heading, { runs: [{ text: "привет", style: { fontSize: 22, fontWeight: 800 } }, { text: " мир" }] });
  assert.deepEqual(togglePreset(heading, 0, 6, stylePresets.heading), doc);
});

test("removing keys keeps the other properties and never leaves an empty style", () => {
  const doc: RichTextDocument = { runs: [{ text: "ab", style: { color: "#0b7568", fontWeight: 800 } }] };
  assert.deepEqual(removeRichTextStyleKeys(doc, 0, 2, ["fontWeight"]), { runs: [{ text: "ab", style: { color: "#0b7568" } }] });
  assert.deepEqual(removeRichTextStyleKeys(doc, 0, 2, ["fontWeight", "color"]), plain("ab"));
});

test("neighbours whose styles differ only in key order merge into one run", () => {
  const merged = compactRuns("ab", [{ color: "#111111", fontWeight: 800 }, { fontWeight: 800, color: "#111111" }]);
  assert.equal(merged.runs.length, 1);
});

test("presets are the D-01 values", () => {
  assert.deepEqual(stylePresets, {
    heading: { fontSize: 22, fontWeight: 800 },
    important: { color: "#b43632", fontWeight: 600 },
  });
});

test("word bounds: a caret touching either edge counts, joins and Cyrillic work, gaps give null", () => {
  assert.deepEqual([0, 3, 6].map((at) => wordRangeAt("привет мир", at)), Array(3).fill({ from: 0, to: 6 }));
  assert.deepEqual(wordRangeAt("привет мир", 7), { from: 7, to: 10 });
  assert.deepEqual(wordRangeAt("по-русски", 4), { from: 0, to: 9 });
  assert.deepEqual(wordRangeAt("it’s ok", 2), { from: 0, to: 4 });
  assert.deepEqual(wordRangeAt("v2 test", 1), { from: 0, to: 2 });
  assert.equal(wordRangeAt("ёлка,  мир", 6), null);
  assert.equal(wordRangeAt("", 0), null);
  assert.deepEqual(wordRangeAt("мир", 3), { from: 0, to: 3 });
  assert.deepEqual(wordRangeAt("мир", 99), { from: 0, to: 3 });
});

test("resolveRange: a selection wins in either direction, a caret becomes its word or null", () => {
  assert.deepEqual(resolveRange("привет мир", { start: 6, end: 0 }), { from: 0, to: 6 });
  assert.deepEqual(resolveRange("привет мир", { start: 8, end: 8 }), { from: 7, to: 10 });
  assert.equal(resolveRange("ёлка,  мир", { start: 6, end: 6 }), null);
});

test("rangeIsPlain: no style key anywhere in the range, false when empty", () => {
  const doc = applyRichTextStyle(plain("привет мир"), 0, 6, { color: "#b43632" });
  assert.equal(rangeIsPlain(doc, 7, 10), true);
  assert.equal(rangeIsPlain(doc, 0, 10), false);
  assert.equal(rangeIsPlain(doc, 3, 3), false);
});

test("heading keeps the colour and its second press removes only size and weight", () => {
  const doc = applyRichTextStyle(plain("привет"), 0, 6, { color: "#0b7568" });
  const on = togglePreset(doc, 0, 6, stylePresets.heading);
  assert.deepEqual(on, { runs: [{ text: "привет", style: { color: "#0b7568", fontSize: 22, fontWeight: 800 } }] });
  assert.deepEqual(togglePreset(on, 0, 6, stylePresets.heading), doc);
});

test("important on bold text sets colour and weight 600, its second press removes both", () => {
  const doc = applyRichTextStyle(plain("привет"), 0, 6, { fontWeight: 800 });
  const on = togglePreset(doc, 0, 6, stylePresets.important);
  assert.deepEqual(on, { runs: [{ text: "привет", style: { fontWeight: 600, color: "#b43632" } }] });
  assert.deepEqual(togglePreset(on, 0, 6, stylePresets.important), plain("привет"));
});

test("reset clears only its range, an empty range changes nothing", () => {
  const doc = applyRichTextStyle(plain("привет мир"), 0, 10, { fontWeight: 800 });
  assert.deepEqual(resetRichTextStyle(doc, 0, 6), { runs: [{ text: "привет" }, { text: " мир", style: { fontWeight: 800 } }] });
  assert.deepEqual(resetRichTextStyle(doc, 4, 4), doc);
});

// The panel's weight buttons commit applyRichTextStyle over resolveRange; owner report: they did nothing (05-01 tracer review).
test("weights 400/600/800 apply through the resolved range for a selection and for a caret in a word", () => {
  const text = "привет мир";
  for (const fontWeight of [400, 600, 800]) {
    const viaRange = (selection: { start: number; end: number }) => {
      const range = resolveRange(text, selection);
      return range ? applyRichTextStyle(plain(text), range.from, range.to, { fontWeight }) : plain(text);
    };
    const expected = { runs: [{ text: "привет", style: { fontWeight } }, { text: " мир" }] };
    assert.deepEqual(viaRange({ start: 0, end: 6 }), expected, `selection, weight ${fontWeight}`);
    assert.deepEqual(viaRange({ start: 3, end: 3 }), expected, `caret in a word, weight ${fontWeight}`);
  }
});

test("nextFieldSelection: a missing reading with own input means nothing known, otherwise the stored range is kept", () => {
  assert.deepEqual(nextFieldSelection({ start: 2, end: 5 }, null, false), { start: 2, end: 5 });
  assert.equal(nextFieldSelection(null, null, false), null);
  assert.equal(nextFieldSelection({ start: 2, end: 5 }, null, true), null);
  assert.deepEqual(nextFieldSelection({ start: 2, end: 5 }, { start: 3, end: 3 }, false), { start: 2, end: 5 });
  assert.deepEqual(nextFieldSelection({ start: 2, end: 5 }, { start: 3, end: 3 }, true), { start: 3, end: 3 });
  assert.deepEqual(nextFieldSelection({ start: 2, end: 5 }, { start: 1, end: 4 }, false), { start: 1, end: 4 });
  assert.deepEqual(nextFieldSelection({ start: 1, end: 1 }, { start: 3, end: 3 }, false), { start: 1, end: 1 });
});

test("resolveRange returns null for no selection", () => {
  assert.equal(resolveRange("привет мир", null), null);
});

// Owner bug (D-05): a style tap on a phone collapsed the selection, so the next tap (weight in particular) landed on nothing or the wrong word.
test("repeated taps on one selection keep acting on that text although every tap collapses the selection", () => {
  const text = "привет мир сегодня";
  let doc = plain(text);
  let stored: { start: number; end: number } | null = { start: 7, end: 10 };
  for (const style of [{ fontWeight: 800 }, stylePresets.heading, { fontWeight: 400 }, stylePresets.important]) {
    const range = resolveRange(text, stored!)!;
    doc = applyRichTextStyle(doc, range.from, range.to, style);
    // the phone then reports a caret outside the field, then one inside the next word, none of it caused by a touch in the field
    stored = nextFieldSelection(stored, null, false);
    stored = nextFieldSelection(stored, { start: 12, end: 12 }, false);
  }
  assert.deepEqual(stored, { start: 7, end: 10 });
  assert.equal(doc.runs.map((run) => run.text).join(""), text);
  assert.deepEqual(doc.runs.map((run) => run.text), ["привет ", "мир", " сегодня"]);
});

// Event order of a real touch: pointerdown, pointerup, then the compatibility focus / mouseup / selectionchange (CR-01).
const down: FieldSelectionEvent = { type: "down" };
const blur: FieldSelectionEvent = { type: "blur" };
const up = (at: number): FieldSelectionEvent => ({ type: "up", at });
const read = (at: number, incoming: { start: number; end: number } | null, guarded = true): FieldSelectionEvent => ({ type: "read", at, incoming, guarded });
const run = (stored: FieldSelectionState["stored"], events: FieldSelectionEvent[]) => events.reduce(fieldSelectionStep, { stored, ownUntil: 0 } as FieldSelectionState);

test("event order: tap on another word, the focus reading of the old range does not spend the touch", () => {
  const state = run({ start: 7, end: 10 }, [down, read(100, { start: 7, end: 10 }), up(120), read(160, { start: 2, end: 2 })]);
  assert.deepEqual(state.stored, { start: 2, end: 2 });
});

test("event order: a caret reported before pointerup is taken", () => {
  assert.deepEqual(run({ start: 7, end: 10 }, [down, read(90, { start: 2, end: 2 }), up(100)]).stored, { start: 2, end: 2 });
});

test("event order: scroll (pointercancel, no reading) leaves the stored range alone", () => {
  const state = run({ start: 7, end: 10 }, [down, up(100), read(900, { start: 0, end: 0 }), read(900, null)]);
  assert.deepEqual(state.stored, { start: 7, end: 10 });
});

test("event order: re-entry after blur starts from nothing known", () => {
  const events: FieldSelectionEvent[] = [blur];
  assert.equal(run({ start: 7, end: 10 }, events).stored, null);
  assert.equal(run({ start: 7, end: 10 }, [...events, down, read(100, null)]).stored, null);
  assert.deepEqual(run({ start: 7, end: 10 }, [...events, down, read(100, null), up(110), read(150, { start: 3, end: 3 })]).stored, { start: 3, end: 3 });
});

test("event order: panel taps keep a stored caret and a stored selection", () => {
  assert.deepEqual(run({ start: 2, end: 2 }, [read(5000, { start: 0, end: 0 }), read(5000, null)]).stored, { start: 2, end: 2 });
  assert.deepEqual(run({ start: 7, end: 10 }, [read(5000, { start: 12, end: 12 })]).stored, { start: 7, end: 10 });
});

test("event order: long press, a non-empty selection always wins", () => {
  assert.deepEqual(run({ start: 2, end: 2 }, [down, up(100), read(2000, { start: 4, end: 9 })]).stored, { start: 4, end: 9 });
});

test("event order: no phone panel, readings are taken as they are and nothing known is never a caret at 0", () => {
  const afterCaret = run({ start: 7, end: 10 }, [read(0, { start: 3, end: 3 }, false)]);
  assert.deepEqual(afterCaret.stored, { start: 3, end: 3 });
  assert.equal(fieldSelectionStep(afterCaret, read(0, null, false)).stored, null);
  assert.equal(run(null, [read(0, null, false)]).stored, null);
});

test("event order: a release without a press in the field opens nothing", () => {
  assert.deepEqual(run({ start: 7, end: 10 }, [up(100), read(150, { start: 0, end: 0 })]).stored, { start: 7, end: 10 });
});

test("event order: owner scenario, weight buttons keep acting on the touched word", () => {
  const text = "привет мир сегодня";
  let state = run({ start: 0, end: 6 }, [down, read(100, { start: 0, end: 6 }), up(110), read(150, { start: 14, end: 14 })]);
  const range = () => resolveRange(text, state.stored)!;
  assert.deepEqual(range(), { from: 11, to: 18 });
  let doc = applyRichTextStyle(plain(text), range().from, range().to, { fontWeight: 800 });
  state = fieldSelectionStep(state, read(1000, { start: 0, end: 0 }));
  assert.deepEqual(state.stored, { start: 14, end: 14 });
  doc = applyRichTextStyle(doc, range().from, range().to, { fontWeight: 600 });
  assert.deepEqual(doc.runs, [{ text: "привет мир " }, { text: "сегодня", style: { fontWeight: 600 } }]);
});

test("the own-input window closes exactly 400 ms after up (05-IN-01)", () => {
  const incoming = { start: 0, end: 0 };
  assert.deepEqual(run({ start: 2, end: 6 }, [down, up(1000), read(1400, incoming)]).stored, { start: 2, end: 6 });
  assert.deepEqual(run({ start: 2, end: 6 }, [down, up(1000), read(1399, incoming)]).stored, incoming);
});
