import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_COMPANION_ITEMS, companionPictureSource, companionPlacement, normalizeCompanionItems, spiderSlots } from "./companion-items.ts";

// Owner 2026-11-18: items of the assistant and of the spider live on the device only; the stored list is untrusted input.

const png = "data:image/png;base64,iVBORw0KGgo=";
const item = (over: Record<string, unknown> = {}) => ({ id: "item-1", target: "assistant", slot: "head", src: png, size: 100, rotate: 0, flip: false, ...over });

test("a picture is a local data image or an https link, nothing else", () => {
  assert.equal(companionPictureSource(png), png);
  assert.equal(companionPictureSource("https://example.com/hat.png"), "https://example.com/hat.png");
  for (const bad of ["http://example.com/hat.png", "javascript:alert(1)", "data:text/html;base64,PGI+", "https://example.com/a b.png", 'https://e.com/x".png', "", 5, null,
    `data:image/png;base64,${"A".repeat(400_001)}`]) {
    assert.equal(companionPictureSource(bad), null, String(bad).slice(0, 40));
  }
});

test("the stored list keeps only known, whole items, clamps the numbers and caps each target", () => {
  assert.deepEqual(normalizeCompanionItems([item({ size: 999, rotate: -999, flip: "yes" })]), [{ ...item(), size: 250, rotate: -180, flip: false }]);
  assert.deepEqual(normalizeCompanionItems([item({ slot: "tail" }), item({ target: "cat" }), item({ id: "bad id" }), item({ src: "http://x" }), "x", null]), []);
  assert.equal(normalizeCompanionItems([item(), item()]).length, 1, "ids are unique");
  const many = Array.from({ length: 12 }, (_, index) => item({ id: `a${index}` }));
  assert.equal(normalizeCompanionItems(many).length, MAX_COMPANION_ITEMS);
  assert.deepEqual(normalizeCompanionItems("[]"), []);
});

test("a spider paw item belongs to a front leg (the pair nearest the head) and scales from its slot", () => {
  assert.deepEqual(spiderSlots.filter((slot) => slot.leg).map((slot) => slot.leg), ["L4", "R4"]);
  const placed = companionPlacement({ id: "s", target: "spider", slot: "front-left", src: png, size: 200, rotate: 0, flip: false });
  assert.equal(placed?.width, 300);
});

test("pictures never leave the device: the store uses localStorage only and no request", () => {
  const source = readFileSync(new URL("./companion-items.ts", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/portia-companion-items.tsx", import.meta.url), "utf8");
  for (const text of [source, component]) assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|\/api\//);
  assert.match(source, /localStorage\.setItem\(companionItemsStorageKey/);
});
