import test from "node:test";
import assert from "node:assert/strict";
import type { RichTextDocument } from "./portia-content.ts";
import {
  applyRichTextStyle,
  compactRuns,
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
