import test from "node:test";
import assert from "node:assert/strict";
import { addBroadcast, removeBroadcast, removeInfoSection, removeMutation, updateById } from "./editor-items.ts";
import { defaultPortiaContent, portiaTextKey, type PortiaContent } from "./portia-content.ts";

const fixture = (): PortiaContent => {
  const content = structuredClone(defaultPortiaContent);
  content.broadcasts = [
    { id: "a", type: "news", title: "A", body: "текст A", published: true, important: false, startsAt: "", endsAt: "", conditions: "" },
    { id: "b", type: "task", title: "B", body: "текст B", published: false, important: false, startsAt: "", endsAt: "", conditions: "" },
  ];
  content.infoSections = [
    { id: "s1", title: "S1", body: "раздел 1" },
    { id: "s2", title: "S2", body: "раздел 2" },
  ];
  content.formattedText = {
    [portiaTextKey.broadcast("a")]: { runs: [] },
    [portiaTextKey.broadcast("b")]: { runs: [] },
    [portiaTextKey.info("s1")]: { runs: [] },
    [portiaTextKey.info("s2")]: { runs: [] },
  };
  return content;
};

test("editing a post by id after a new post is added at the top changes only that post", () => {
  const content = fixture();
  content.broadcasts = [{ id: "a", type: "news", title: "A", body: "текст A", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }];
  content.broadcasts.unshift({ id: "b", type: "news", title: "", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" });
  updateById(content.broadcasts, "a", (item) => { item.body = "текст A2"; });
  assert.equal(content.broadcasts[0].body, "");
  assert.equal(content.broadcasts[1].id, "a");
  assert.equal(content.broadcasts[1].body, "текст A2");
});

test("updating an id that no longer exists changes nothing", () => {
  const content = fixture();
  const before = structuredClone(content);
  updateById(content.broadcasts, "gone", (item) => { item.body = "x"; });
  assert.deepEqual(content, before);
});

test("deleting a post removes only that post and its formatting", () => {
  const content = fixture();
  removeBroadcast(content, "a");
  assert.deepEqual(content.broadcasts.map((item) => item.id), ["b"]);
  assert.equal(portiaTextKey.broadcast("a") in content.formattedText, false);
  assert.equal(portiaTextKey.broadcast("b") in content.formattedText, true);
  assert.equal(portiaTextKey.info("s1") in content.formattedText, true);
});

test("deleting an info section removes only that section and its formatting", () => {
  const content = fixture();
  removeInfoSection(content, "s1");
  assert.deepEqual(content.infoSections.map((item) => item.id), ["s2"]);
  assert.equal(portiaTextKey.info("s1") in content.formattedText, false);
  assert.equal(portiaTextKey.info("s2") in content.formattedText, true);
});

test("deleting a mutation moves the later mutations' formatting down and leaves no formatting on a neighbour", () => {
  const content = fixture();
  const virus = content.viruses[0];
  virus.mutations = [
    { name: "M0", description: "ноль", image: "" },
    { name: "M1", description: "один", image: "" },
    { name: "M2", description: "два", image: "" },
  ];
  const doc1 = { runs: [{ text: "один" }] };
  const doc2 = { runs: [{ text: "два" }] };
  content.formattedText[portiaTextKey.mutation(virus.id, 1)] = doc1;
  content.formattedText[portiaTextKey.mutation(virus.id, 2)] = doc2;
  removeMutation(content, virus, 1);
  assert.deepEqual(virus.mutations.map((mutation) => mutation.name), ["M0", "M2"]);
  assert.deepEqual(content.formattedText[portiaTextKey.mutation(virus.id, 1)], doc2);
  assert.equal(portiaTextKey.mutation(virus.id, 2) in content.formattedText, false);
  assert.equal(portiaTextKey.mutation(virus.id, 0) in content.formattedText, false);
  assert.equal(portiaTextKey.broadcast("a") in content.formattedText, true);
});

test("deleting an unformatted mutation drops the formatting the next one would have inherited", () => {
  const content = fixture();
  const virus = content.viruses[0];
  virus.mutations = [{ name: "M0", description: "ноль", image: "" }, { name: "M1", description: "один", image: "" }];
  content.formattedText[portiaTextKey.mutation(virus.id, 0)] = { runs: [{ text: "ноль" }] };
  removeMutation(content, virus, 1);
  assert.deepEqual(virus.mutations.map((mutation) => mutation.name), ["M0"]);
  assert.equal(portiaTextKey.mutation(virus.id, 0) in content.formattedText, true);
  removeMutation(content, virus, 0);
  assert.equal(virus.mutations.length, 0);
  assert.equal(portiaTextKey.mutation(virus.id, 0) in content.formattedText, false);
});

test("a new news item and a new quest are blank, unpublished and put at the top", () => {
  const content = fixture();
  const before = structuredClone(content);
  addBroadcast(content, "n1", "news");
  addBroadcast(content, "q1", "quest");
  const blank = { title: "", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" };
  assert.deepEqual(content.broadcasts[1], { id: "n1", type: "news", ...blank });
  assert.deepEqual(content.broadcasts[0], { id: "q1", type: "quest", ...blank });
  assert.deepEqual(content.broadcasts.slice(2), before.broadcasts);
  assert.deepEqual(content.formattedText, before.formattedText);
});

test("a new item is blank, not a copy of the last edited one", () => {
  const content = fixture();
  updateById(content.broadcasts, "a", (item) => { item.body = "текст A2"; });
  addBroadcast(content, "n1", "news");
  assert.equal(content.broadcasts[0].body, "");
  assert.equal(content.broadcasts[0].title, "");
  assert.equal(content.broadcasts[1].body, "текст A2");
});
