import test from "node:test";
import assert from "node:assert/strict";
import { limitStatus, limitText } from "./content-limits.ts";

test("limitStatus is free under 80%, counter from 80% and full at the limit", () => {
  assert.equal(limitStatus(0, 500), "free");
  assert.equal(limitStatus(399, 500), "free");
  assert.equal(limitStatus(400, 500), "counter");
  assert.equal(limitStatus(499, 500), "counter");
  assert.equal(limitStatus(500, 500), "full");
  assert.equal(limitStatus(501, 500), "full");
  assert.equal(limitStatus(239, 300), "free");
  assert.equal(limitStatus(240, 300), "counter");
  assert.equal(limitStatus(119, 150), "free");
  assert.equal(limitStatus(120, 150), "counter");
});

test("limitText reads nothing, n / max, or МАКСИМУМ max", () => {
  assert.equal(limitText(10, 500), "");
  assert.equal(limitText(400, 500), "400 / 500");
  assert.equal(limitText(500, 500), "МАКСИМУМ 500");
});
