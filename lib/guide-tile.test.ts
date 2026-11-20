import assert from "node:assert/strict";
import test from "node:test";
import { GUIDE_TILE_COLUMNS, guideTileTitleFit } from "./guide-tile.ts";

test("owner 2026-11-20 OWN-01: the tiles stand up to 5 in a row", () => {
  assert.equal(GUIDE_TILE_COLUMNS, 5);
});

test("guideTileTitleFit: a short title keeps the regular size (boundary 16/17)", () => {
  assert.equal(guideTileTitleFit("Glock 13"), "regular");
  assert.equal(guideTileTitleFit(""), "regular");
  assert.equal(guideTileTitleFit("   "), "regular");
  assert.equal(guideTileTitleFit("a".repeat(14)), "regular");
  assert.equal(guideTileTitleFit("abcdefgh ijklmnop"), "small", "17 characters");
  assert.equal(guideTileTitleFit("abcdefgh ijklmno"), "regular", "16 characters");
});

test("guideTileTitleFit: a medium title gets the small size (boundary 28/29)", () => {
  assert.equal(guideTileTitleFit("Gas Containers and Canisters"), "small", "28 characters");
  assert.equal(guideTileTitleFit("Gas Containers and Canisters!"), "smaller", "29 characters");
});

test("guideTileTitleFit: a word longer than 14 characters forces the smallest size, spaces at the edges do not count", () => {
  assert.equal(guideTileTitleFit("a".repeat(15)), "smaller");
  assert.equal(guideTileTitleFit("Short " + "b".repeat(15)), "smaller");
  assert.equal(guideTileTitleFit("  Glock 13  "), "regular");
  assert.equal(guideTileTitleFit("  " + "c".repeat(16) + "  "), "smaller");
});

test("guideTileTitleFit returns only one of three literals (T-26.1-01)", () => {
  const allowed = new Set(["regular", "small", "smaller"]);
  for (const title of ["", "x", "<script>alert(1)</script>", "\"onload=\"x", "я".repeat(400), "слово ".repeat(30)]) {
    assert.ok(allowed.has(guideTileTitleFit(title)), title.slice(0, 20));
  }
});
