import assert from "node:assert/strict";
import test from "node:test";
import { GUIDE_TILE_COLUMNS, GUIDE_TILE_TITLE_LINES, guideTileTitleFit, guideTileTitleLines } from "./guide-tile.ts";

test("owner 2026-11-20 OWN-01: the tiles stand up to 5 in a row", () => {
  assert.equal(GUIDE_TILE_COLUMNS, 5);
});

test("owner 2026-11-21 item 23: the title field of every tile is three lines high, always", () => {
  assert.equal(GUIDE_TILE_TITLE_LINES, 3);
});

// The estimate is monospace-like, as classification-fit does it: characters a line = text width / (font size * 0.55), on the narrowest PC tile (132px).
test("guideTileTitleLines: a greedy wrap on the narrowest tile; a long word is broken, and starts a line of its own", () => {
  assert.equal(guideTileTitleLines("", "regular"), 1);
  assert.equal(guideTileTitleLines("Glock 13", "regular"), 1);
  assert.equal(guideTileTitleLines("a".repeat(16), "regular"), 1, "16 characters fill the 13px line exactly");
  assert.equal(guideTileTitleLines("a".repeat(17), "regular"), 2);
  assert.equal(guideTileTitleLines("abc " + "d".repeat(16), "regular"), 2, "the word that does not fit goes to the next line whole");
  assert.equal(guideTileTitleLines("a".repeat(48), "regular"), 3);
  assert.equal(guideTileTitleLines("a".repeat(49), "regular"), 4);
  assert.ok(guideTileTitleLines("a".repeat(48), "smaller") <= guideTileTitleLines("a".repeat(48), "regular"), "a smaller size never needs more lines");
});

test("guideTileTitleFit: a title that is at most two lines at 13px keeps the regular size", () => {
  assert.equal(guideTileTitleFit("Glock 13"), "regular");
  assert.equal(guideTileTitleFit(""), "regular");
  assert.equal(guideTileTitleFit("   "), "regular");
  assert.equal(guideTileTitleFit("a".repeat(32)), "regular", "two full lines");
  assert.equal(guideTileTitleFit("a".repeat(33)), "small", "the third line is needed, so the font shrinks first");
  assert.equal(guideTileTitleFit("  Glock 13  "), "regular", "spaces at the edges do not count");
});

test("guideTileTitleFit: a title that needs a third line at 13px, but only three at 12px, gets the small size; the rest the smallest", () => {
  assert.equal(guideTileTitleFit("a".repeat(51)), "small", "three full lines at 12px");
  assert.equal(guideTileTitleFit("a".repeat(52)), "smaller");
  assert.equal(guideTileTitleFit("слово ".repeat(30)), "smaller");
});

test("owner 2026-11-21 item 23: a title of up to 54 characters fits three lines at its own size on the narrowest tile (57 unbroken ones too); longer is the last resort, the third line is cut", () => {
  const family = { regular: 13, small: 12, smaller: 11 } as const;
  const words = ["Газ", "Контейнеры", "и", "баллоны", "Противогаз", "ГП-7", "Защита", "органов", "дыхания"];
  for (let length = 1; length <= 60; length += 1) {
    // a deterministic title of exactly `length` characters: the words in turn, cut to length
    let title = "";
    for (let i = 0; title.length < length; i += 1) title += (title ? " " : "") + words[i % words.length];
    title = title.slice(0, length).trim();
    const fit = guideTileTitleFit(title);
    assert.ok(fit in family);
    assert.ok(guideTileTitleLines(title, fit) <= GUIDE_TILE_TITLE_LINES || title.length > 54, `${length}: "${title}" is ${guideTileTitleLines(title, fit)} lines at ${family[fit]}px`);
  }
  assert.equal(guideTileTitleFit("a".repeat(57)), "smaller");
  assert.equal(guideTileTitleLines("a".repeat(57), "smaller"), 3);
});

test("guideTileTitleFit returns only one of three literals (T-26.1-01)", () => {
  const allowed = new Set(["regular", "small", "smaller"]);
  for (const title of ["", "x", "<script>alert(1)</script>", "\"onload=\"x", "я".repeat(400), "слово ".repeat(30)]) {
    assert.ok(allowed.has(guideTileTitleFit(title)), title.slice(0, 20));
  }
});
