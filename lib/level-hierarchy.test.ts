import test from "node:test";
import assert from "node:assert/strict";
import { effectiveLevel, raiseChildLevels, raiseChildren } from "./level-hierarchy.ts";
import { type GuideCard, type GuideSection, type InfoSection, type InfoSubsection, type PortiaContent } from "./portia-content.ts";
import { portiaContentFixture } from "./testing/portia-content-fixture.ts";
import type { AccessLevel } from "./access-levels.ts";

const sub = (id: string, level?: AccessLevel | unknown): InfoSubsection => ({ id, title: id, blocks: [], ...(level === undefined ? {} : { level: level as AccessLevel }) });
const card = (id: string, level?: AccessLevel | unknown): GuideCard => ({ id, title: id, cover: "", blocks: [], ...(level === undefined ? {} : { level: level as AccessLevel }) });
const infoSection = (id: string, level: unknown, subsections: InfoSubsection[]): InfoSection => ({ id, title: id, body: "", subsections, ...(level === undefined ? {} : { level: level as AccessLevel }) });
const guideSection = (id: string, level: unknown, cards: GuideCard[]): GuideSection => ({ id, title: id, photo: "", cards, ...(level === undefined ? {} : { level: level as AccessLevel }) });
const contentOf = (infoSections: InfoSection[], guideSections: GuideSection[]): PortiaContent => ({ ...structuredClone(portiaContentFixture), infoSections, guideSections });

test("LVL-03 / D-17 effectiveLevel is the higher of the record and its parent", () => {
  assert.equal(effectiveLevel(undefined, 1), 1);
  assert.equal(effectiveLevel(2, 3), 3);
  assert.equal(effectiveLevel(4, 3), 4);
  assert.equal(effectiveLevel("x", 1), 5, "a damaged own level is the highest");
  assert.equal(effectiveLevel(undefined, 4), 4, "no own level reads as 1 and follows the parent");
  assert.equal(effectiveLevel(3, 3), 3);
});

test("LVL-03 / D-17 raiseChildren lifts the draft up to the parent level and counts the changes", () => {
  const children: { level?: AccessLevel }[] = [{ level: 1 }, {}, { level: 4 }];
  assert.equal(raiseChildren(children, 3), 2);
  assert.deepEqual(children.map((child) => child.level), [3, 3, 4]);
  assert.equal(raiseChildren([], 3), 0);
});

test("EDGE LVL-03/boundary: a child equal to its section stays, a child one level lower is lifted", () => {
  const equal: { level?: AccessLevel }[] = [{ level: 3 }];
  assert.equal(raiseChildren(equal, 3), 0);
  assert.equal(equal[0].level, 3);
  const lower: { level?: AccessLevel }[] = [{ level: 2 }];
  assert.equal(raiseChildren(lower, 3), 1);
  assert.equal(lower[0].level, 3);
});

test("EDGE LVL-03/adjacency: when no child is below the section the count is 0", () => {
  const children: { level?: AccessLevel }[] = [{ level: 3 }, { level: 4 }, { level: 5 }];
  assert.equal(raiseChildren(children, 3), 0);
  assert.equal(raiseChildLevels(contentOf([infoSection("s", 2, [sub("a", 2), sub("b", 5)])], [])).raised, 0);
});

test("LVL-03 / D-17 raiseChildLevels lifts subsections and cards and does not touch what is already high enough", () => {
  const input = contentOf(
    [infoSection("s", 3, [sub("a", 1), sub("b"), sub("c", 5)])],
    [guideSection("g", undefined, [card("k", 2)])],
  );
  const { content, raised } = raiseChildLevels(input);
  assert.equal(raised, 2);
  assert.deepEqual(content.infoSections[0].subsections.map((item) => item.level), [3, 3, 5]);
  assert.deepEqual(content.guideSections[0].cards.map((item) => item.level), [2]);
});

test("LVL-03 / D-17 raiseChildLevels lifts guide cards under a leveled guide section", () => {
  const { content, raised } = raiseChildLevels(contentOf([], [guideSection("g", 4, [card("k", 2), card("m"), card("n", 4)])]));
  assert.equal(raised, 2);
  assert.deepEqual(content.guideSections[0].cards.map((item) => item.level), [4, 4, 4]);
});

test("LVL-03 / D-17 raiseChildLevels does not change its input", () => {
  const input = contentOf(
    [infoSection("s", 3, [sub("a", 1), sub("b")])],
    [guideSection("g", 5, [card("k", 2)])],
  );
  const snapshot = JSON.parse(JSON.stringify(input));
  const { content } = raiseChildLevels(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(content, input);
  assert.notEqual(content.infoSections[0], input.infoSections[0]);
});

test("EDGE LVL-03/empty: a section without subsections or cards gives 0 and does not throw", () => {
  const { content, raised } = raiseChildLevels(contentOf([infoSection("s", 5, [])], [guideSection("g", 5, [])]));
  assert.equal(raised, 0);
  assert.deepEqual(content.infoSections[0].subsections, []);
  assert.equal(raiseChildLevels(contentOf([], [])).raised, 0);
});

test("EDGE LVL-03/ordering: lifting changes neither the order nor the ids of the children", () => {
  const { content } = raiseChildLevels(contentOf([infoSection("s", 4, [sub("z", 1), sub("a", 2), sub("m", 3)])], []));
  assert.deepEqual(content.infoSections[0].subsections.map((item) => item.id), ["z", "a", "m"]);
});

test("EDGE LVL-03/precision: a damaged child level reads as 5 and stays, a damaged section level lifts every child to 5", () => {
  const damagedChild = raiseChildLevels(contentOf([infoSection("s", 3, [sub("a", "x")])], []));
  assert.equal(damagedChild.raised, 0);
  assert.equal(damagedChild.content.infoSections[0].subsections[0].level, "x" as unknown as AccessLevel, "the damaged value is left for the normalizer to clamp");
  const damagedSection = raiseChildLevels(contentOf([infoSection("s", "x", [sub("a", 2), sub("b")])], [guideSection("g", 9, [card("k", 4)])]));
  assert.equal(damagedSection.raised, 3);
  assert.deepEqual(damagedSection.content.infoSections[0].subsections.map((item) => item.level), [5, 5]);
  assert.deepEqual(damagedSection.content.guideSections[0].cards.map((item) => item.level), [5]);
});
