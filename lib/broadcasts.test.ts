import test from "node:test";
import assert from "node:assert/strict";
import type { Broadcast } from "./portia-content.ts";
import { broadcastFeed, broadcastTabOf, formatQuestDay, localDateKey, markQuestsSeen, parseSeenQuestIds, questPopup, questState } from "./broadcasts.ts";

const TODAY = "2026-10-19";
const item = (id: string, type: Broadcast["type"], published = true, important = false, dates: Partial<Broadcast> = {}): Broadcast => ({ id, type, title: id, body: "", published, important, startsAt: "", endsAt: "", conditions: "", ...dates });

test("quests and tasks share the quests tab", () => {
  assert.equal(broadcastTabOf("news"), "news");
  assert.equal(broadcastTabOf("quest"), "quests");
  assert.equal(broadcastTabOf("task"), "quests");
});

test("news feed lists published news with important first, otherwise in editor order", () => {
  const list = [item("a", "news"), item("b", "news", true, true), item("c", "quest"), item("d", "news", false, true), item("e", "news"), item("f", "news", true, true)];
  assert.deepEqual(broadcastFeed(list, "news", TODAY).map((x) => x.id), ["b", "f", "a", "e"]);
});

test("quests feed lists published quests and tasks in editor order", () => {
  const list = [item("a", "task"), item("b", "news"), item("c", "quest", false), item("d", "quest")];
  assert.deepEqual(broadcastFeed(list, "quests", TODAY).map((x) => x.id), ["a", "d"]);
});

test("a broadcast saved before the important flag counts as not important", () => {
  const old = { id: "o", type: "news", title: "", body: "", published: true } as Broadcast;
  assert.deepEqual(broadcastFeed([old, item("n", "news", true, true)], "news", TODAY).map((x) => x.id), ["n", "o"]);
});

test("localDateKey uses local getters and zero-pads", () => {
  assert.equal(localDateKey(new Date(2026, 9, 5, 23, 59)), "2026-10-05");
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
});

test("questState is inclusive on both ends and ignores empty fields", () => {
  const q = (startsAt: string, endsAt: string) => ({ startsAt, endsAt });
  assert.equal(questState(q("2026-10-20", ""), "2026-10-19"), "upcoming");
  assert.equal(questState(q("2026-10-20", ""), "2026-10-20"), "active");
  assert.equal(questState(q("", "2026-10-25"), "2026-10-25"), "active");
  assert.equal(questState(q("", "2026-10-25"), "2026-10-26"), "finished");
  assert.equal(questState(q("", ""), TODAY), "active");
  assert.equal(questState({}, TODAY), "active");
  assert.equal(questState(q("2026-10-01", "2026-10-31"), TODAY), "active");
});

test("formatQuestDay turns YYYY-MM-DD into dd.mm.yyyy", () => {
  assert.equal(formatQuestDay("2026-10-05"), "05.10.2026");
  assert.equal(formatQuestDay(""), "");
});

test("quests feed leads with active, then upcoming, then finished, keeping editor order inside a group; tasks count as active", () => {
  const list = [
    item("done1", "quest", true, false, { endsAt: "2026-10-18" }),
    item("soon1", "quest", true, false, { startsAt: "2026-10-22" }),
    item("on1", "quest", true, false, { startsAt: "2026-10-01", endsAt: "2026-10-31" }),
    item("task", "task"),
    item("soon2", "quest", true, false, { startsAt: "2026-10-20" }),
    item("on2", "quest"),
    item("done2", "quest", true, false, { startsAt: "2026-09-01", endsAt: "2026-09-30" }),
  ];
  assert.deepEqual(broadcastFeed(list, "quests", TODAY).map((x) => x.id), ["on1", "task", "on2", "soon1", "soon2", "done1", "done2"]);
});

test("parseSeenQuestIds accepts only an array of strings", () => {
  for (const raw of [null, "", "{", "5", '{"a":1}']) assert.deepEqual(parseSeenQuestIds(raw), []);
  assert.deepEqual(parseSeenQuestIds('["a",3,"b"]'), ["a", "b"]);
});

test("questPopup returns the first unseen active published quest and counts the rest", () => {
  const list = [
    item("n", "news"), item("t", "task"), item("hidden", "quest", false),
    item("soon", "quest", true, false, { startsAt: "2026-10-25" }), item("old", "quest", true, false, { endsAt: "2026-10-01" }),
    item("a", "quest"), item("b", "quest"), item("c", "quest"),
  ];
  assert.deepEqual(questPopup(list, [], TODAY), { quest: list[5], more: 2 });
  assert.deepEqual(questPopup(list, ["a"], TODAY), { quest: list[6], more: 1 });
  assert.equal(questPopup(list, ["a", "b", "c"], TODAY), null);
  assert.equal(questPopup([item("n", "news"), item("t", "task")], [], TODAY), null);
});

test("an upcoming quest pops up on its start day", () => {
  const list = [item("soon", "quest", true, false, { startsAt: "2026-10-25" })];
  assert.equal(questPopup(list, [], TODAY), null);
  assert.equal(questPopup(list, [], "2026-10-25")?.quest.id, "soon");
});

test("markQuestsSeen adds active published quests, keeps stored ids that still exist and drops gone ones", () => {
  const list = [item("a", "quest"), item("b", "quest"), item("soon", "quest", true, false, { startsAt: "2026-10-25" }), item("h", "quest", false)];
  assert.deepEqual(markQuestsSeen(list, [], TODAY), ["a", "b"]);
  assert.deepEqual(markQuestsSeen(list, ["a", "gone", "soon"], TODAY), ["a", "soon", "b"]);
  assert.deepEqual(markQuestsSeen(list, ["b", "b"], TODAY), ["b", "a"]);
});

test("marking seen against a list keeps every stored id that is still in it", () => {
  const list = [item("a", "quest"), item("b", "quest"), item("soon", "quest", true, false, { startsAt: "2026-10-25" }), item("n", "news")];
  const stored = ["soon", "n", "a"];
  const marked = markQuestsSeen(list, stored, TODAY);
  for (const id of stored) assert.ok(marked.includes(id), id);
  assert.deepEqual(marked, ["soon", "n", "a", "b"]);
});
