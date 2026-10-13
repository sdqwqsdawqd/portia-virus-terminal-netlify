import test from "node:test";
import assert from "node:assert/strict";
import { changedSections, sectionOfKey } from "./editor-changes.ts";
import { defaultPortiaContent, type PortiaContent } from "./portia-content.ts";

const fixture = (): PortiaContent => structuredClone(defaultPortiaContent);

test("identical copies have no changed sections", () => {
  assert.deepEqual(changedSections(fixture(), fixture()), []);
});

test("renaming a virus changes only the viruses section", () => {
  const draft = fixture();
  draft.viruses[0].name = "ПЕРЕИМЕНОВАН";
  assert.deepEqual(changedSections(fixture(), draft), ["viruses"]);
});

test("moving a virus to the bin changes viruses and the bin", () => {
  const draft = fixture();
  const [virus] = draft.viruses.splice(0, 1);
  draft.recycledViruses.push(virus);
  draft.recycleOrder.push(`virus:${virus.id}`);
  assert.deepEqual(changedSections(fixture(), draft), ["viruses", "recycle"]);
});

test("an info formattedText entry marks the info section", () => {
  const draft = fixture();
  draft.formattedText["info:some:body"] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(changedSections(fixture(), draft), ["info"]);
});

test("a virus formattedText entry follows where the virus lives", () => {
  const live = fixture();
  live.formattedText[`virus:${live.viruses[0].id}:external`] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(changedSections(fixture(), live), ["viruses"]);

  const baseline = fixture();
  const [virus] = baseline.viruses.splice(0, 1);
  baseline.recycledViruses.push(virus);
  const recycled = structuredClone(baseline);
  recycled.formattedText[`virus:${virus.id}:external`] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(changedSections(baseline, recycled), ["recycle"]);
});

test("toggling an assistant flag marks the assistant section", () => {
  const draft = fixture();
  draft.assistantIdleEnabled = !draft.assistantIdleEnabled;
  assert.deepEqual(changedSections(fixture(), draft), ["assistant"]);
});

test("every content key except formattedText belongs to a section", () => {
  for (const key of Object.keys(defaultPortiaContent)) {
    if (key === "formattedText") continue;
    assert.notEqual(sectionOfKey(key), null, key);
  }
  assert.equal(sectionOfKey("formattedText"), null);
  assert.equal(sectionOfKey("somethingNew"), null);
});
