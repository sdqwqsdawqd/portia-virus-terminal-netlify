import test from "node:test";
import assert from "node:assert/strict";
import { defaultImageFraming, imageFramingStyles, normalizeImageFraming } from "./image-framing.ts";

// D-63 (20-51): the visible part of a picture is three whole numbers. Whatever arrives from a request is untrusted input.

test("D-63 the default frame is the centre at 100%", () => {
  assert.deepEqual(defaultImageFraming, { x: 50, y: 50, zoom: 100 });
});

test("D-63 a valid frame is kept as it is", () => {
  assert.deepEqual(normalizeImageFraming({ x: 30, y: 70, zoom: 150 }), { x: 30, y: 70, zoom: 150 });
  assert.deepEqual(normalizeImageFraming({ x: 0, y: 100, zoom: 300 }), { x: 0, y: 100, zoom: 300 });
  assert.deepEqual(normalizeImageFraming({ x: 50, y: 50, zoom: 105 }), { x: 50, y: 50, zoom: 105 });
});

test("D-63 numbers are rounded and clamped: x and y to 0..100, zoom to 100..300", () => {
  assert.deepEqual(normalizeImageFraming({ x: 30.4, y: -5, zoom: 999 }), { x: 30, y: 0, zoom: 300 });
  assert.deepEqual(normalizeImageFraming({ x: 130, y: 99.6, zoom: 20 }), { x: 100, y: 100, zoom: 100 });
  assert.deepEqual(normalizeImageFraming({ x: 1e9, y: -1e9, zoom: 1e9 }), { x: 100, y: 0, zoom: 300 });
  assert.deepEqual(normalizeImageFraming({ x: -1e9, y: 1e9, zoom: -1e9 }), { x: 0, y: 100, zoom: 100 });
  const result = normalizeImageFraming({ x: -0.2, y: 10, zoom: 120 });
  assert.ok(result && Object.is(result.x, 0), "negative zero never reaches a style");
});

test("D-63 the default frame is the same as no frame", () => {
  assert.equal(normalizeImageFraming({ x: 50, y: 50, zoom: 100 }), undefined);
  assert.equal(normalizeImageFraming({ x: 49.6, y: 50.4, zoom: 100.2 }), undefined);
  assert.equal(normalizeImageFraming({ x: 50, y: 50, zoom: 1 }), undefined);
});

test("D-63 anything that is not an object of three finite numbers gives no frame", () => {
  for (const value of [
    undefined, null, "", "50", "x=1", 5, true, [], [50, 50, 100], () => undefined,
    {}, { x: 1, y: 2 }, { x: 1, zoom: 120 }, { y: 1, zoom: 120 },
    { x: "50", y: 50, zoom: 120 }, { x: 50, y: "50", zoom: 120 }, { x: 50, y: 50, zoom: "120" },
    { x: Number.NaN, y: 50, zoom: 120 }, { x: 50, y: Number.POSITIVE_INFINITY, zoom: 120 }, { x: 50, y: 50, zoom: Number.NEGATIVE_INFINITY },
    { x: null, y: 50, zoom: 120 }, { x: {}, y: 50, zoom: 120 }, { x: [1], y: 50, zoom: 120 }, { x: 10n, y: 50, zoom: 120 },
    { x: "50; background:url(//evil.example/x)", y: 50, zoom: 120 },
    { x: "expression(alert(1))", y: 50, zoom: 120 },
  ]) {
    assert.equal(normalizeImageFraming(value), undefined, `no frame for ${typeof value === "bigint" ? "bigint" : JSON.stringify(value) ?? String(value)}`);
  }
});

test("D-63 extra keys never survive and the result is a fresh object", () => {
  const input = { x: 1, y: 2, zoom: 120, extra: "url(x)", __proto__: { evil: "1" } };
  const result = normalizeImageFraming(input);
  assert.deepEqual(result, { x: 1, y: 2, zoom: 120 });
  assert.deepEqual(Object.keys(result ?? {}), ["x", "y", "zoom"]);
  assert.notEqual(result, input);
  const parsed = JSON.parse('{"x":10,"y":20,"zoom":150,"__proto__":{"x":99},"constructor":{"x":1}}');
  assert.deepEqual(normalizeImageFraming(parsed), { x: 10, y: 20, zoom: 150 });
});

test("D-63 an inherited number is not a frame value", () => {
  const inherited = Object.create({ x: 10, y: 20, zoom: 150 });
  assert.equal(normalizeImageFraming(inherited), undefined);
});

test("D-63 normalizing twice gives the same frame", () => {
  const once = normalizeImageFraming({ x: 30.4, y: -5, zoom: 999 });
  assert.deepEqual(normalizeImageFraming(once), once);
});

test("D-63 no frame gives no styles", () => {
  assert.deepEqual(imageFramingStyles(undefined), {});
});

test("D-63 a frame gives numbers only: the frame clips, the picture moves and scales from the same point", () => {
  assert.deepEqual(imageFramingStyles({ x: 30, y: 70, zoom: 150 }), {
    frame: { overflow: "hidden" },
    image: { objectPosition: "30% 70%", transform: "scale(1.5)", transformOrigin: "30% 70%" },
  });
  assert.deepEqual(imageFramingStyles({ x: 20, y: 80, zoom: 160 }).image, { objectPosition: "20% 80%", transform: "scale(1.6)", transformOrigin: "20% 80%" });
});

test("D-63 styles are made from the normalized numbers even when a hostile object reaches them", () => {
  const hostile = { x: "1; background:url(//evil.example)", y: 2, zoom: 120 } as unknown as { x: number; y: number; zoom: number };
  assert.deepEqual(imageFramingStyles(hostile), {});
  const wild = imageFramingStyles({ x: 1e9, y: -1e9, zoom: 1e9 });
  assert.deepEqual(wild.image, { objectPosition: "100% 0%", transform: "scale(3)", transformOrigin: "100% 0%" });
  for (const text of Object.values({ ...wild.frame, ...wild.image })) assert.match(text, /^[a-z0-9 .%()-]+$/);
});
