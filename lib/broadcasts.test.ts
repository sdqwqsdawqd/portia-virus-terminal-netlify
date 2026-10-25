import test from "node:test";
import assert from "node:assert/strict";
import type { Broadcast } from "./portia-content.ts";
import { broadcastFeed, broadcastTabOf, categoryChange, formatQuestDay, localDateKey, markQuestsSeen, parseSeenQuestIds, questDateError, questPopup, questState } from "./broadcasts.ts";

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

test("a quest published during the visit is offered once and then never again", () => {
  assert.equal(questPopup([item("n", "news")], [], TODAY), null);
  const list1 = [item("q1", "quest")];
  assert.deepEqual(questPopup(list1, [], TODAY), { quest: list1[0], more: 0 });
  const list2 = [item("q2", "quest"), ...list1];
  assert.deepEqual(questPopup(list2, [], TODAY), { quest: list2[0], more: 1 });
  const seen = markQuestsSeen(list2, [], TODAY);
  assert.equal(questPopup(list2, seen, TODAY), null);
  const list3 = [item("q3", "quest"), ...list2];
  assert.deepEqual(questPopup(list3, seen, TODAY), { quest: list3[0], more: 0 });
  const reloaded = parseSeenQuestIds(JSON.stringify(markQuestsSeen(list3, seen, TODAY)));
  assert.equal(questPopup(list3, reloaded, TODAY), null);
});

test("an upcoming quest pops up on its start day", () => {
  const list = [item("soon", "quest", true, false, { startsAt: "2026-10-25" })];
  assert.equal(questPopup(list, [], TODAY), null);
  assert.equal(questPopup(list, [], "2026-10-25")?.quest.id, "soon");
});

test("markQuestsSeen adds active published quests, keeps every stored id and dedupes", () => {
  const list = [item("a", "quest"), item("b", "quest"), item("soon", "quest", true, false, { startsAt: "2026-10-25" }), item("h", "quest", false)];
  assert.deepEqual(markQuestsSeen(list, [], TODAY), ["a", "b"]);
  assert.deepEqual(markQuestsSeen(list, ["a", "gone", "soon"], TODAY), ["a", "gone", "soon", "b"]);
  assert.deepEqual(markQuestsSeen(list, ["b", "b"], TODAY), ["b", "a"]);
});

test("marking seen against a list keeps every stored id that is still in it", () => {
  const list = [item("a", "quest"), item("b", "quest"), item("soon", "quest", true, false, { startsAt: "2026-10-25" }), item("n", "news")];
  const stored = ["soon", "n", "a"];
  const marked = markQuestsSeen(list, stored, TODAY);
  for (const id of stored) assert.ok(marked.includes(id), id);
  assert.deepEqual(marked, ["soon", "n", "a", "b"]);
});

test("markQuestsSeen from a stale tab keeps a seen id this tab's content does not list", () => {
  const marked = markQuestsSeen([item("a", "quest")], ["q-elsewhere"], TODAY);
  assert.deepEqual(marked, ["q-elsewhere", "a"]);
});

test("markQuestsSeen caps the list at 200 ids, keeps every active quest and drops the oldest stored ids", () => {
  const stored = Array.from({ length: 250 }, (_, i) => `old${i}`);
  const marked = markQuestsSeen([item("a", "quest"), item("b", "quest")], stored, TODAY);
  assert.equal(marked.length, 200);
  assert.ok(marked.includes("a") && marked.includes("b"));
  assert.ok(!marked.includes("old0") && marked.includes("old249"));
  assert.equal(markQuestsSeen([item("a", "quest")], ["a", ...stored.slice(0, 198)], TODAY).length, 199);
});

test("questDateError flags only a quest whose end is before its start", () => {
  const d = (type: Broadcast["type"], startsAt: string, endsAt: string) => ({ type, startsAt, endsAt });
  assert.equal(questDateError(d("quest", "2026-10-20", "2026-10-19")), true);
  assert.equal(questDateError(d("quest", "2026-10-20", "2026-10-20")), false);
  assert.equal(questDateError(d("quest", "2026-10-20", "")), false);
  assert.equal(questDateError(d("quest", "", "2026-10-19")), false);
  assert.equal(questDateError(d("quest", "", "")), false);
  assert.equal(questDateError(d("task", "2026-10-20", "2026-10-19")), false);
  assert.equal(questDateError(d("news", "2026-10-20", "2026-10-19")), false);
});

test("categoryChange finds the first card that moved between news and quests", () => {
  const from = [item("a", "news"), item("b", "quest")];
  assert.deepEqual(categoryChange(from, [item("a", "quest"), item("b", "quest")]), { id: "a", tab: "quests" });
  assert.equal(categoryChange(from, [item("a", "news"), item("b", "task")]), null);
  assert.equal(categoryChange([item("b", "quest")], [item("a", "quest"), item("b", "quest")]), null);
  assert.equal(categoryChange(from, from), null);
  assert.deepEqual(categoryChange(from, [item("a", "news"), item("b", "news")]), { id: "b", tab: "news" });
});
