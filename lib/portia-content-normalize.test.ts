import test from "node:test";
import assert from "node:assert/strict";
import { defaultPortiaContent } from "./portia-content.ts";
import { normalizeBroadcasts, normalizePortiaContent } from "./portia-content-normalize.ts";

test("a save round-trip keeps every field", () => {
  const once = normalizePortiaContent(structuredClone(defaultPortiaContent));
  assert.ok(once);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
  assert.equal(once.viruses.length, defaultPortiaContent.viruses.length);
  assert.equal(once.viruses[0].external, defaultPortiaContent.viruses[0].external);
  assert.equal(once.infoSections.length, defaultPortiaContent.infoSections.length);
  assert.equal(once.broadcasts.length, defaultPortiaContent.broadcasts.length);
});

test("broken payloads are rejected instead of saved", () => {
  assert.equal(normalizePortiaContent(null), null);
  assert.equal(normalizePortiaContent({ viruses: [] }), null);
});

test("unsafe media links and oversized logs are cleaned", () => {
  const content = structuredClone(defaultPortiaContent);
  content.viruses[0].infectedImage = "javascript:alert(1)";
  content.viruses[0].scientistLogs = Array.from({ length: 7 }, (_, index) => ({
    id: `log-${index}`, title: "", scientist: "", lockedLevel: 2, content: ["text"],
  }));
  const normalized = normalizePortiaContent(content);
  assert.ok(normalized);
  assert.equal(normalized.viruses[0].infectedImage, "");
  assert.equal(normalized.viruses[0].scientistLogs.length, 5);
});

test("line breaks inside text survive normalization", () => {
  const content = structuredClone(defaultPortiaContent);
  content.formattedText = { note: { runs: [{ text: "first\nsecond\n" }] } };
  assert.equal(normalizePortiaContent(content)?.formattedText.note.runs[0].text, "first\nsecond\n");
});

test("broadcasts saved before 03.2 normalize to not important and keep their fields", () => {
  const old = { id: "a", type: "quest", title: "T", body: "B", published: true };
  assert.deepEqual(normalizeBroadcasts([old]), [{ ...old, important: false }]);
});

test("important is a strict boolean and junk entries are dropped in order", () => {
  const base = { id: "x", type: "news", title: "", body: "", published: false };
  const out = normalizeBroadcasts([
    { ...base, id: "1", important: true },
    null,
    { ...base, id: "2", important: "yes" },
    "str",
    { ...base, id: "3", important: 1 },
    { ...base, id: "4", important: null },
  ]);
  assert.deepEqual(out.map((item) => [item.id, item.important]), [["1", true], ["2", false], ["3", false], ["4", false]]);
  assert.deepEqual(normalizeBroadcasts("nope"), []);
});

test("normalizePortiaContent stays idempotent with old and new broadcasts", () => {
  const content = structuredClone(defaultPortiaContent);
  content.broadcasts = [
    { id: "a", type: "news", title: "A", body: "", published: true, important: true },
    { id: "b", type: "task", title: "B", body: "", published: true } as never,
  ];
  const once = normalizePortiaContent(content);
  assert.ok(once);
  assert.deepEqual(once.broadcasts.map((item) => item.important), [true, false]);
  assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
});
