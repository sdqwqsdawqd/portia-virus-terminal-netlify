import test from "node:test";
import assert from "node:assert/strict";
import type { Broadcast } from "./portia-content.ts";
import { broadcastFeed, broadcastTabOf } from "./broadcasts.ts";

const item = (id: string, type: Broadcast["type"], published = true, important = false): Broadcast => ({ id, type, title: id, body: "", published, important });

test("quests and tasks share the quests tab", () => {
  assert.equal(broadcastTabOf("news"), "news");
  assert.equal(broadcastTabOf("quest"), "quests");
  assert.equal(broadcastTabOf("task"), "quests");
});

test("news feed lists published news with important first, otherwise in editor order", () => {
  const list = [item("a", "news"), item("b", "news", true, true), item("c", "quest"), item("d", "news", false, true), item("e", "news"), item("f", "news", true, true)];
  assert.deepEqual(broadcastFeed(list, "news").map((x) => x.id), ["b", "f", "a", "e"]);
});

test("quests feed lists published quests and tasks in editor order", () => {
  const list = [item("a", "task"), item("b", "news"), item("c", "quest", false), item("d", "quest")];
  assert.deepEqual(broadcastFeed(list, "quests").map((x) => x.id), ["a", "d"]);
});

test("a broadcast saved before the important flag counts as not important", () => {
  const old = { id: "o", type: "news", title: "", body: "", published: true } as Broadcast;
  assert.deepEqual(broadcastFeed([old, item("n", "news", true, true)], "news").map((x) => x.id), ["n", "o"]);
});
