import test from "node:test";
import assert from "node:assert/strict";
import { removeBroadcast, removeInfoSection, updateById } from "./editor-items.ts";
import { defaultPortiaContent, portiaTextKey, type PortiaContent } from "./portia-content.ts";

const fixture = (): PortiaContent => {
  const content = structuredClone(defaultPortiaContent);
  content.broadcasts = [
    { id: "a", type: "news", title: "A", body: "текст A", published: true },
    { id: "b", type: "task", title: "B", body: "текст B", published: false },
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
  content.broadcasts = [{ id: "a", type: "news", title: "A", body: "текст A", published: true }];
  content.broadcasts.unshift({ id: "b", type: "news", title: "", body: "", published: false });
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
