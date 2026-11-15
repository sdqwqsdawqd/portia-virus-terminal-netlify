import test from "node:test";
import assert from "node:assert/strict";
import { acceptFetchedContent, isNewerAnswer, normalizeDocumentLinks, viewerKeyOf } from "./content-sync.ts";

test("a newer revision is taken", () => {
  assert.equal(acceptFetchedContent(7, 6, 0, 0), true);
});

test("the same revision is dropped so a poll never replaces the content and undo survives", () => {
  assert.equal(acceptFetchedContent(6, 6, 0, 0), false);
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
  assert.equal(acceptFetchedContent(6, known, nextSavesAtSend, saves), false);
  assert.equal(acceptFetchedContent(7, known, nextSavesAtSend, saves), true);
});

test("a stale CDN copy older than the cached one is dropped", () => {
  assert.equal(acceptFetchedContent(118, 122, 0, 0), false);
});

test("after a conflict resets the gate to -1, the next poll is taken even below the cached revision", () => {
  assert.equal(acceptFetchedContent(1, 122, 0, 0), false);
  assert.equal(acceptFetchedContent(1, -1, 0, 0), true);
});

test("LVL-09: the same revision from another viewer is taken, the same revision from the same viewer is dropped", () => {
  assert.equal(acceptFetchedContent(6, 6, 0, 0), false);
  assert.equal(acceptFetchedContent(6, 6, 0, 0, "level-2", "level-3"), true);
  assert.equal(acceptFetchedContent(6, 6, 0, 0, "editor", "level-3"), true);
  assert.equal(acceptFetchedContent(6, 6, 0, 0, "level-2", "level-2"), false);
});

test("LVL-09: a request sent before a save started is dropped even when the viewer changed", () => {
  assert.equal(acceptFetchedContent(6, 6, 0, 1, "level-2", "level-3"), false);
});

test("EDGE LVL-09/idempotency: a second identical answer is dropped after the first was taken", () => {
  let knownViewer = "level-3";
  assert.equal(acceptFetchedContent(6, 6, 0, 0, "level-2", knownViewer), true);
  knownViewer = "level-2";
  assert.equal(acceptFetchedContent(6, 6, 0, 0, "level-2", knownViewer), false);
});

test("EDGE LVL-09/concurrency: an answer to an earlier request than the one already handled is dropped", () => {
  assert.equal(isNewerAnswer(5, 6), false);
  assert.equal(isNewerAnswer(7, 6), true);
  assert.equal(isNewerAnswer(6, 6), false);
  // The old high-level copy must not come back after a downgrade, whatever its viewer key.
  let answered = 0;
  const sendSeqOld = 1;
  const sendSeqNew = 2;
  assert.equal(isNewerAnswer(sendSeqNew, answered), true);
  answered = sendSeqNew;
  assert.equal(isNewerAnswer(sendSeqOld, answered), false);
});

test("the viewer key is editor, level-N for 1..5, and empty for anything else", () => {
  assert.equal(viewerKeyOf({ editor: true, level: 5 }), "editor");
  assert.equal(viewerKeyOf({ editor: false, level: 3 }), "level-3");
  assert.equal(viewerKeyOf({ editor: false, level: 9 }), "");
  assert.equal(viewerKeyOf({ editor: false, level: 2.5 }), "");
  assert.equal(viewerKeyOf({ editor: false }), "");
  assert.equal(viewerKeyOf(undefined), "");
  assert.equal(viewerKeyOf(null), "");
  assert.equal(viewerKeyOf("junk"), "");
});

test("normalizeDocumentLinks keeps only known apps with https links", () => {
  const ok = { src: "https://a.example/", external: "https://a.example/" };
  assert.deepEqual(normalizeDocumentLinks({ charter: ok, junk: {} }), { charter: ok });
  assert.deepEqual(normalizeDocumentLinks({ charter: { src: "http://a.example/", external: "https://a.example/" } }), {});
  assert.deepEqual(normalizeDocumentLinks({ charter: { src: "https://a.example/", external: 5 } }), {});
  assert.deepEqual(normalizeDocumentLinks({ charter: { src: "not a url", external: "https://a.example/" } }), {});
  assert.deepEqual(normalizeDocumentLinks({ charter: "x" }), {});
  assert.deepEqual(normalizeDocumentLinks(null), {});
  assert.deepEqual(normalizeDocumentLinks("junk"), {});
  assert.deepEqual(normalizeDocumentLinks([ok]), {});
});
