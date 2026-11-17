import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_COMPANION_ITEMS, companionAttachLabels, companionFigures, companionItemsStorageKey, companionPictureSource, moveCompanionItem, newCompanionItem, normalizeCompanionItems, resizeCompanionItem, scaleCompanionItem, type CompanionItem } from "./companion-items.ts";

// Owner 2026-11-18 (round 2): items of the assistant and of the spider are placed freely in a mini-editor and live on the device only;
// the stored list is untrusted input.

const png = "data:image/png;base64,iVBORw0KGgo=";
const item = (over: Record<string, unknown> = {}) => ({ id: "item-1", target: "assistant", attach: "body", src: png, x: 50, y: 30, width: 24, height: 20, rotate: 0, flip: false, ...over });
const spider = (over: Partial<CompanionItem> = {}): CompanionItem => ({ id: "s", target: "spider", attach: "body", src: png, x: 325, y: 360, width: 160, height: 100, rotate: 0, flip: false, ...over });

test("a picture is a local data image or an https link, nothing else", () => {
  assert.equal(companionPictureSource(png), png);
  assert.equal(companionPictureSource("https://example.com/hat.png"), "https://example.com/hat.png");
  for (const bad of ["http://example.com/hat.png", "javascript:alert(1)", "data:text/html;base64,PGI+", "https://example.com/a b.png", 'https://e.com/x".png', "", 5, null,
    `data:image/png;base64,${"A".repeat(400_001)}`]) {
    assert.equal(companionPictureSource(bad), null, String(bad).slice(0, 40));
  }
});

test("the figures are the svg box of the assistant picture and the spider artwork", () => {
  assert.deepEqual(companionFigures.assistant, { width: 100, height: 66.667, picture: "/assets/portia-assistant.png" });
  assert.deepEqual(companionFigures.spider, { width: 649.5, height: 768 });
  assert.deepEqual(companionAttachLabels, { body: "Тело", L4: "Левая лапа", R4: "Правая лапа" });
});

test("the stored list keeps only whole v2 items, clamps and rounds the numbers and caps each target", () => {
  assert.deepEqual(normalizeCompanionItems([item()]), [item()]);
  // Centre in [-0.5W, 1.5W] x [-0.5H, 1.5H], size in [0.02W, 1.5 x max(W, H)], rotate rounded in [-180, 180], flip a real boolean.
  assert.deepEqual(normalizeCompanionItems([item({ x: 999, y: -999, width: 0.01, height: 9999, rotate: -999.4, flip: "yes" })]),
    [item({ x: 150, y: -33.3, width: 2, height: 150, rotate: -180, flip: false })]);
  assert.deepEqual(normalizeCompanionItems([item({ x: 12.3456, width: 20.04 })]), [item({ x: 12.3, width: 20 })]);
  const big = normalizeCompanionItems([item({ id: "b", target: "spider", x: 1e6, y: 1e6, width: 1e6, height: 0 })])[0];
  assert.deepEqual([big.x, big.y, big.width, big.height], [974.3, 1152, 1152, 13]);
  assert.deepEqual(normalizeCompanionItems([item({ target: "cat" }), item({ id: "bad id" }), item({ src: "http://x" }), item({ x: "5" }), item({ width: null }), "x", null]), []);
  assert.equal(normalizeCompanionItems([item(), item()]).length, 1, "ids are unique");
  const many = Array.from({ length: 12 }, (_, index) => item({ id: `a${index}` }));
  assert.equal(normalizeCompanionItems(many).length, MAX_COMPANION_ITEMS);
  assert.deepEqual(normalizeCompanionItems("[]"), []);
});

test("attach: the spider may hang an item on a front paw; everything else is body", () => {
  const attach = (target: string, value: unknown) => normalizeCompanionItems([item({ target, attach: value })])[0].attach;
  assert.equal(attach("spider", "L4"), "L4");
  assert.equal(attach("spider", "R4"), "R4");
  assert.equal(attach("spider", "body"), "body");
  assert.equal(attach("spider", "L1"), "body");
  assert.equal(attach("spider", undefined), "body");
  assert.equal(attach("assistant", "L4"), "body", "the assistant has no paws to hang an item on");
});

test("an entry of the slot version (slot and size, no width and height) is dropped", () => {
  assert.deepEqual(normalizeCompanionItems([{ id: "old", target: "assistant", slot: "head", src: png, size: 100, rotate: 0, flip: false }]), []);
  assert.equal(companionItemsStorageKey, "portia-companion-items-v2");
});

test("moving shifts the centre by the delta and keeps it in range", () => {
  assert.deepEqual(moveCompanionItem(spider(), 10, -20), spider({ x: 335, y: 340 }));
  assert.equal(moveCompanionItem(spider(), 1e6, 1e6).x, 974.25);
  assert.equal(moveCompanionItem(spider(), -1e6, -1e6).y, -384);
});

test("resizing stretches width and height separately and keeps the opposite edge", () => {
  const east = resizeCompanionItem(spider(), "e", 20, 99);
  assert.deepEqual([east.width, east.height, east.x, east.y], [180, 100, 335, 360], "e: width +dx, centre +dx/2, height untouched");
  const west = resizeCompanionItem(spider(), "w", -20, 99);
  assert.deepEqual([west.width, west.x], [180, 315], "w: dragging left grows the box and moves the centre left");
  const south = resizeCompanionItem(spider(), "s", 99, 30);
  assert.deepEqual([south.width, south.height, south.y], [160, 130, 375]);
  const north = resizeCompanionItem(spider(), "n", 99, -30);
  assert.deepEqual([north.height, north.y], [130, 345]);
  const corner = resizeCompanionItem(spider(), "se", 20, 30);
  assert.deepEqual([corner.width, corner.height, corner.x, corner.y], [180, 130, 335, 375], "a corner stretches both, no aspect lock");
  const nw = resizeCompanionItem(spider(), "nw", -20, -30);
  assert.deepEqual([nw.width, nw.height, nw.x, nw.y], [180, 130, 315, 345]);
  // At the minimum the opposite edge stays where it was: the east edge of the box is x + width / 2.
  const squeezed = resizeCompanionItem(spider(), "w", 1e6, 0);
  assert.equal(squeezed.width, 0.02 * 649.5);
  assert.ok(Math.abs(squeezed.x + squeezed.width / 2 - (325 + 80)) < 1e-9, "the east edge did not move");
});

test("resizing takes the delta in the item's own axes", () => {
  // Turned by 90 degrees, the item's own "down" points to the left of the figure: a horizontal drag on "s" changes the height.
  const turned = resizeCompanionItem(spider({ rotate: 90 }), "s", -30, 0);
  assert.equal(turned.width, 160);
  assert.equal(turned.height, 130);
  // The centre moves along the turned axis (half of the change, to the left of the figure), not along the figure's y.
  assert.ok(Math.abs(turned.x - (325 - 15)) < 1e-9 && Math.abs(turned.y - 360) < 1e-9, `${turned.x}, ${turned.y}`);
  const along = resizeCompanionItem(spider({ rotate: 90 }), "e", 0, 40);
  assert.equal(along.width, 200, "the item's own east points down the figure at 90 degrees");
});

test("keyboard scaling changes the box about its centre and keeps the limits", () => {
  const grown = scaleCompanionItem(spider(), 6.5, -10);
  assert.deepEqual([grown.x, grown.y, grown.width, grown.height], [325, 360, 166.5, 90]);
  assert.equal(scaleCompanionItem(spider(), -1e6, -1e6).width, 0.02 * 649.5);
});

test("a new item stands in the middle of its figure, as wide as a quarter of the assistant or a fifth of the spider", () => {
  const hat = newCompanionItem("assistant", png, 2);
  assert.deepEqual([hat.x, hat.y, hat.width, hat.height, hat.attach, hat.rotate, hat.flip], [50, 33.3, 24, 12, "body", 0, false]);
  const sock = newCompanionItem("spider", png);
  assert.deepEqual([sock.x, sock.y, sock.width, sock.height, sock.attach], [325, 360, 160, 160, "body"], "square when the aspect is unknown");
  assert.match(sock.id, /^[A-Za-z0-9_-]{1,40}$/);
  assert.equal(normalizeCompanionItems([sock]).length, 1, "a new item survives the store");
});

test("pictures never leave the device: the store uses localStorage only and no request", () => {
  const files = ["./companion-items.ts", "../components/portia-companion-items.tsx", "../components/portia-companion-editor.tsx"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
  for (const text of files) assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|\/api\//);
  assert.match(files[0], /localStorage\.setItem\(companionItemsStorageKey/);
  assert.match(files[0], /removeItem\(legacyStorageKey\)/, "the old v1 list is removed after a successful save");
});
