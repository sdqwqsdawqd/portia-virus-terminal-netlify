import test from "node:test";
import assert from "node:assert/strict";
import { acceptFetchedContent } from "./content-sync.ts";

test("a newer revision is taken", () => {
  assert.equal(acceptFetchedContent(7, 6, 0, 0), true);
});

test("the same revision is taken so a server-normalized copy still replaces the cache", () => {
  assert.equal(acceptFetchedContent(6, 6, 0, 0), true);
});

test("an answer older than the tab's last save is dropped", () => {
  assert.equal(acceptFetchedContent(5, 6, 1, 1), false);
});

test("a request sent before a save started is dropped whatever its revision", () => {
  assert.equal(acceptFetchedContent(7, 5, 0, 1), false);
  assert.equal(acceptFetchedContent(5, 5, 0, 1), false);
});

test("a late poll after a save is dropped and the next poll is taken", () => {
  let known = 5;
  let saves = 0;
  const lateSavesAtSend = saves;
  saves += 1;
  known = 6;
  assert.equal(acceptFetchedContent(5, known, lateSavesAtSend, saves), false);
  const nextSavesAtSend = saves;
  assert.equal(acceptFetchedContent(6, known, nextSavesAtSend, saves), true);
});

test("a stale CDN copy older than the cached one is dropped", () => {
  assert.equal(acceptFetchedContent(118, 122, 0, 0), false);
});

test("after a conflict resets the gate to -1, the next poll is taken even below the cached revision", () => {
  assert.equal(acceptFetchedContent(1, 122, 0, 0), false);
  assert.equal(acceptFetchedContent(1, -1, 0, 0), true);
});
