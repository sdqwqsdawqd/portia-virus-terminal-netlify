import test from "node:test";
import assert from "node:assert/strict";
import type { RichTextDocument } from "./portia-content.ts";
import {
  applyRichTextStyle,
  compactRuns,
  rangeHasStyle,
  removeRichTextStyleKeys,
  stylePresets,
  togglePreset,
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
  const bold = togglePreset(doc, 0, 6, stylePresets.bold);
  assert.deepEqual(bold, { runs: [{ text: "привет", style: { fontWeight: 800 } }, { text: " мир" }] });
  assert.deepEqual(togglePreset(bold, 0, 6, stylePresets.bold), doc);
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
    bold: { fontWeight: 800 },
    important: { color: "#b43632", fontWeight: 600 },
  });
});
