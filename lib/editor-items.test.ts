import test from "node:test";
import assert from "node:assert/strict";
import { addBroadcast, removeBroadcast, removeInfoBlock, removeInfoSection, removeInfoSubsection, removeMutation, removeRecycleFile, removeRecycledVirus, updateById } from "./editor-items.ts";
import { defaultPortiaContent, portiaTextKey, type PortiaContent } from "./portia-content.ts";

const fixture = (): PortiaContent => {
  const content = structuredClone(defaultPortiaContent);
  content.broadcasts = [
    { id: "a", type: "news", title: "A", body: "текст A", published: true, important: false, startsAt: "", endsAt: "", conditions: "" },
    { id: "b", type: "task", title: "B", body: "текст B", published: false, important: false, startsAt: "", endsAt: "", conditions: "" },
  ];
  content.infoSections = [
    { id: "s1", title: "S1", body: "раздел 1", subsections: [] },
    { id: "s2", title: "S2", body: "раздел 2", subsections: [] },
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

const withGuide = () => {
  const content = fixture();
  content.infoSections[0].subsections = [
    { id: "u1", title: "U1", blocks: [{ id: "b1", type: "text", text: "один" }, { id: "b2", type: "text", text: "два" }] },
    { id: "u2", title: "U2", blocks: [{ id: "b3", type: "text", text: "три" }] },
  ];
  for (const id of ["b1", "b2", "b3"]) content.formattedText[portiaTextKey.infoBlock(id)] = { runs: [] };
  return content;
};

test("deleting a guide block removes it and its formatting only", () => {
  const content = withGuide();
  removeInfoBlock(content, "u1", "b1");
  assert.deepEqual(content.infoSections[0].subsections[0].blocks.map((block) => block.id), ["b2"]);
  assert.equal(portiaTextKey.infoBlock("b1") in content.formattedText, false);
  assert.equal(portiaTextKey.infoBlock("b2") in content.formattedText, true);
});

test("deleting a subsection, or its whole section, takes its blocks' formatting with it", () => {
  const content = withGuide();
  removeInfoSubsection(content, "s1", "u1");
  assert.deepEqual(content.infoSections[0].subsections.map((sub) => sub.id), ["u2"]);
  assert.equal(portiaTextKey.infoBlock("b2") in content.formattedText, false);
  assert.equal(portiaTextKey.infoBlock("b3") in content.formattedText, true);
  removeInfoSection(content, "s1");
  assert.equal(portiaTextKey.infoBlock("b3") in content.formattedText, false);
  assert.equal(portiaTextKey.info("s2") in content.formattedText, true);
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

const binFixture = (): PortiaContent => {
  const content = structuredClone(defaultPortiaContent);
  const [first] = content.viruses;
  content.recycledViruses = [{ ...structuredClone(first), id: "ab" }, { ...structuredClone(first), id: "abc" }];
  content.recycleFiles = [
    { id: "f1", name: "F1", location: "", kind: "text", content: "1", image: "", virusId: "" },
    { id: "f2", name: "F2", location: "", kind: "text", content: "2", image: "", virusId: "" },
  ];
  content.formattedText = {
    "virus:ab:external": { runs: [] },
    "virus:ab:ppu-health": { runs: [] },
    "virus:ab:mutation:0:description": { runs: [] },
    "virus:abc:external": { runs: [] },
    [portiaTextKey.recycle("f1")]: { runs: [] },
    [portiaTextKey.recycle("f2")]: { runs: [] },
  };
  return content;
};

test("permanently deleting a recycled virus removes all of its formatting and nothing else", () => {
  const content = binFixture();
  removeRecycledVirus(content, "ab");
  assert.deepEqual(content.recycledViruses.map((virus) => virus.id), ["abc"]);
  assert.deepEqual(Object.keys(content.formattedText).sort(), ["recycle:f1:content", "recycle:f2:content", "virus:abc:external"]);
});

test("permanently deleting a recycle file removes only its text formatting", () => {
  const content = binFixture();
  removeRecycleFile(content, "f1");
  assert.deepEqual(content.recycleFiles.map((file) => file.id), ["f2"]);
  assert.equal("recycle:f1:content" in content.formattedText, false);
  assert.equal("recycle:f2:content" in content.formattedText, true);
  assert.equal(Object.keys(content.formattedText).length, 5);
});

test("restoring from the bin keeps formatting", () => {
  const content = binFixture();
  const restored = content.recycledViruses.find((virus) => virus.id === "ab")!;
  content.recycledViruses = content.recycledViruses.filter((virus) => virus.id !== "ab");
  content.viruses.push(restored);
  assert.equal(Object.keys(content.formattedText).filter((key) => key.startsWith("virus:ab:")).length, 3);
});
