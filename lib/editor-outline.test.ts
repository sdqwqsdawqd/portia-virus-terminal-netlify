import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addBroadcastSection,
  addBroadcastSubsection,
  addRecommendationSection,
  addRecommendationSubsection,
  broadcastGroupIds,
  broadcastGroupPath,
  broadcastGroupsView,
  flattenRecommendationSections,
  moveBroadcastSection,
  moveBroadcastSubsection,
  moveRecommendationLine,
  moveRecommendationSection,
  moveRecommendationSubsection,
  normalizeOutlineSections,
  normalizeRecommendationSections,
  recommendationGroupIds,
  recommendationGroupText,
  recommendationView,
  renameRecommendationGroup,
  removeBroadcastOutlineGroup,
  removeRecommendationGroup,
  setBroadcastSection,
  trimRecommendationSections,
  writeRecommendationGroup,
} from "./editor-outline.ts";
import { contentRefusal } from "./editor-tabs.ts";
import { editorSections, sectionOfKey } from "./editor-changes.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";
import { defaultPortiaContent, portiaTextKey, type PortiaContent, type RichTextDocument } from "./portia-content.ts";
import { expandStyles } from "./rich-text-style.ts";

const KEY = portiaTextKey.searchRecommendations;
const RED = { color: "#ff0000" };

const base = (): PortiaContent => {
  const content = normalizePortiaContent(structuredClone(defaultPortiaContent));
  assert.ok(content);
  return content;
};

// Flat list r1..r3 with a colour on the second line only: the old format, no sections.
const oldFormat = (): PortiaContent => {
  const content = base();
  content.searchRecommendations = ["r1", "r2", "r3"];
  content.formattedText[KEY] = { runs: [{ text: "r1\n" }, { text: "r2", style: RED }, { text: "\nr3" }] };
  return content;
};

const flatText = (content: PortiaContent) => content.searchRecommendations.join("\n");
// The style of the first character of `line` inside the stored formatting of the flat list.
const styleOfLine = (content: PortiaContent, line: string) => expandStyles(content.formattedText[KEY])[flatText(content).indexOf(line)];
const documentText = (document: RichTextDocument) => document.runs.map((run) => run.text).join("");
const groupIds = (content: PortiaContent) => (content.searchRecommendationSections ?? []).flatMap((section) => [section.id, ...section.subsections.map((sub) => sub.id)]);

const withGroups = (): PortiaContent => {
  const content = oldFormat();
  addRecommendationSection(content, "s-classes", "Классы");
  addRecommendationSubsection(content, "s-classes", "sub-mind", "Разум");
  writeRecommendationGroup(content, "sub-mind", "Люцидиум", { runs: [{ text: "Люцидиум", style: { color: "#00ff00" } }] });
  return content;
};

// ---- compatibility of reading (D-41) ----

test("D-41 old content gets empty section lists and an empty group on every broadcast", () => {
  const content = base();
  content.broadcasts = [{ id: "b1", type: "news", title: "A", body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "" }];
  const normalized = normalizePortiaContent(content);
  assert.ok(normalized);
  assert.deepEqual(normalized.broadcastSections, []);
  assert.deepEqual(normalized.searchRecommendationSections, []);
  assert.equal(normalized.broadcasts[0].sectionId, "");
});

test("D-41 a stored sectionId survives normalization", () => {
  const content = base();
  content.broadcasts = [{ id: "b1", type: "news", title: "A", body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "", sectionId: "s1" }];
  assert.equal(normalizePortiaContent(content)?.broadcasts[0].sectionId, "s1");
});

test("D-41 the old flat list shows as one synthetic section called Рекомендации", () => {
  const view = recommendationView(oldFormat());
  assert.equal(view.synthetic, true);
  assert.equal(view.sections.length, 1);
  assert.equal(view.sections[0].id, "search-recommendations-all");
  assert.equal(view.sections[0].title, "Рекомендации");
  assert.deepEqual(view.sections[0].items, ["r1", "r2", "r3"]);
});

test("D-41 an empty flat list has no synthetic section", () => {
  const content = base();
  content.searchRecommendations = [];
  assert.deepEqual(recommendationView(content), { sections: [], synthetic: false });
});

test("D-41 the synthetic section text and document are the flat list with its formatting", () => {
  const { text, document } = recommendationGroupText(oldFormat(), "search-recommendations-all");
  assert.equal(text, "r1\nr2\nr3");
  assert.equal(documentText(document), "r1\nr2\nr3");
  assert.deepEqual(expandStyles(document)[3], RED);
});

// ---- normalizeOutlineSections ----

test("D-41 normalizeOutlineSections: not an array gives an empty list", () => {
  for (const value of [undefined, null, "x", 5, {}]) assert.deepEqual(normalizeOutlineSections(value, "bs"), []);
});

test("D-41 normalizeOutlineSections: a missing or repeated id gets a unique positional one", () => {
  const sections = normalizeOutlineSections([
    { id: "a", title: "  Один  ", subsections: [{ id: "a", title: "дубль" }, { title: "без id" }] },
    { title: "второй", subsections: [] },
    { id: "a", title: "третий" },
  ], "bs");
  const ids = sections.flatMap((section) => [section.id, ...section.subsections.map((sub) => sub.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.length > 0));
  assert.equal(sections[0].id, "a");
  assert.equal(sections[0].title, "  Один  ");
  assert.equal(sections[2].subsections.length, 0);
});

// ---- D-47: no note field in the public payload ----

test("D-47 a note in the stored sections never reaches the normalized content", () => {
  const content = base();
  content.searchRecommendations = ["a", "b"];
  const payload = {
    ...content,
    broadcastSections: [{ id: "bs1", title: "T", note: "SECRET-NOTE-1", subsections: [{ id: "bs2", title: "S", note: "SECRET-NOTE-2" }] }],
    searchRecommendationSections: [{ id: "rs1", title: "T", note: "SECRET-NOTE-3", items: ["a"], subsections: [{ id: "rs2", title: "S", note: "SECRET-NOTE-4", items: ["b"] }] }],
  };
  const normalized = normalizePortiaContent(payload);
  assert.ok(normalized);
  assert.equal(normalized.broadcastSections?.length, 1);
  assert.equal(normalized.searchRecommendationSections?.length, 1);
  const json = JSON.stringify(normalized);
  assert.doesNotMatch(json, /SECRET-NOTE/);
  assert.doesNotMatch(json, /"note"/);
});

// ---- normalizeRecommendationSections (invariant of the flat list) ----

const sectionsFixture = () => [{ id: "s1", title: "A", items: ["a", "b"], subsections: [{ id: "s2", title: "B", items: ["c"] }] }];

test("D-41 sections whose expansion equals the flat list are kept", () => {
  assert.deepEqual(normalizeRecommendationSections(sectionsFixture(), ["a", "b", "c"]), sectionsFixture());
});

test("D-41 sections that differ from the flat list are dropped, the flat list wins", () => {
  assert.deepEqual(normalizeRecommendationSections(sectionsFixture(), ["a", "b", "x"]), []);
  assert.deepEqual(normalizeRecommendationSections(sectionsFixture(), ["a", "b"]), []);
  assert.deepEqual(normalizeRecommendationSections(sectionsFixture(), ["b", "a", "c"]), []);
});

test("D-41 items that are not strings are dropped before the comparison", () => {
  const sections = normalizeRecommendationSections([{ id: "s1", title: "A", items: ["a", 5, null, "b"], subsections: [] }], ["a", "b"]);
  assert.deepEqual(sections[0].items, ["a", "b"]);
});

test("D-41 flattenRecommendationSections lists a section's lines, then each subsection's in order", () => {
  assert.deepEqual(flattenRecommendationSections([
    { id: "s1", title: "A", items: ["a"], subsections: [{ id: "x", title: "", items: ["b", "c"] }, { id: "y", title: "", items: ["d"] }] },
    { id: "s2", title: "B", items: ["e"], subsections: [] },
  ]), ["a", "b", "c", "d", "e"]);
});

test("D-41 normalizePortiaContent drops sections that disagree with the flat list", () => {
  const payload = { ...oldFormat(), searchRecommendationSections: sectionsFixture() };
  assert.deepEqual(normalizePortiaContent(payload)?.searchRecommendationSections, []);
  const agreeing = { ...oldFormat(), searchRecommendations: ["a", "b", "c"], searchRecommendationSections: sectionsFixture() };
  assert.deepEqual(normalizePortiaContent(agreeing)?.searchRecommendationSections, sectionsFixture());
});

// ---- writing a group ----

test("D-41 the first edit of the synthetic section writes a real section and keeps the other formatting", () => {
  const content = oldFormat();
  writeRecommendationGroup(content, "search-recommendations-all", "r1\nr2\nr3\nr4", { runs: [{ text: "r1\n" }, { text: "r2", style: RED }, { text: "\nr3\nr4" }] });
  assert.equal(content.searchRecommendationSections?.length, 1);
  assert.equal(content.searchRecommendationSections?.[0].id, "search-recommendations-all");
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3", "r4"]);
  assert.deepEqual(flattenRecommendationSections(content.searchRecommendationSections ?? []), content.searchRecommendations);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
  assert.deepEqual(styleOfLine(content, "r1"), {});
});

test("D-41 writing one group leaves the formatting of every other group untouched character by character", () => {
  const content = withGroups();
  const before = expandStyles(content.formattedText[KEY]);
  writeRecommendationGroup(content, "sub-mind", "Люцидиум 2", { runs: [{ text: "Люцидиум 2", style: { color: "#00ff00" } }] });
  const after = expandStyles(content.formattedText[KEY]);
  assert.deepEqual(after.slice(0, "r1\nr2\nr3".length), before.slice(0, "r1\nr2\nr3".length));
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3", "Люцидиум 2"]);
  assert.deepEqual(flattenRecommendationSections(content.searchRecommendationSections ?? []), content.searchRecommendations);
  assert.equal(documentText(content.formattedText[KEY]), flatText(content));
});

test("D-41 a new section starts empty and the old flat list becomes a real section first", () => {
  const content = oldFormat();
  addRecommendationSection(content, "s-new", "Классы");
  assert.deepEqual(groupIds(content), ["search-recommendations-all", "s-new"]);
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3"]);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
  assert.deepEqual(recommendationGroupText(content, "s-new"), { text: "", document: { runs: [{ text: "" }] } });
});

test("D-41 a subsection is created inside its section and the text can be read back", () => {
  const content = withGroups();
  assert.deepEqual(content.searchRecommendationSections?.[1].subsections.map((sub) => sub.title), ["Разум"]);
  const { text, document } = recommendationGroupText(content, "sub-mind");
  assert.equal(text, "Люцидиум");
  assert.deepEqual(expandStyles(document)[0], { color: "#00ff00" });
});

// ---- D-42: moving ----

test("D-42 moving a section carries its lines and their formatting; the flat list follows", () => {
  const content = withGroups();
  moveRecommendationSection(content, 1, 0);
  assert.deepEqual(groupIds(content), ["s-classes", "sub-mind", "search-recommendations-all"]);
  assert.deepEqual(content.searchRecommendations, ["Люцидиум", "r1", "r2", "r3"]);
  assert.deepEqual(flattenRecommendationSections(content.searchRecommendationSections ?? []), content.searchRecommendations);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
  assert.deepEqual(styleOfLine(content, "Люцидиум"), { color: "#00ff00" });
  assert.equal(documentText(content.formattedText[KEY]), flatText(content));
});

test("D-42 moving a subsection reorders inside its section only", () => {
  const content = withGroups();
  addRecommendationSubsection(content, "s-classes", "sub-two", "Тело");
  writeRecommendationGroup(content, "sub-two", "Эктоморф", { runs: [{ text: "Эктоморф", style: RED }] });
  moveRecommendationSubsection(content, "s-classes", 1, 0);
  assert.deepEqual(content.searchRecommendationSections?.[1].subsections.map((sub) => sub.id), ["sub-two", "sub-mind"]);
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3", "Эктоморф", "Люцидиум"]);
  assert.deepEqual(styleOfLine(content, "Эктоморф"), RED);
});

test("D-42 moving a line inside a group keeps the line's own formatting", () => {
  const content = oldFormat();
  moveRecommendationLine(content, "search-recommendations-all", 1, 0);
  assert.deepEqual(content.searchRecommendations, ["r2", "r1", "r3"]);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
  assert.deepEqual(styleOfLine(content, "r1"), {});
  assert.deepEqual(flattenRecommendationSections(content.searchRecommendationSections ?? []), content.searchRecommendations);
});

test("D-42 moving a line out of range changes nothing", () => {
  const content = oldFormat();
  moveRecommendationLine(content, "search-recommendations-all", 1, 9);
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3"]);
});

// ---- removing a group ----

test("D-41 removing a recommendation section removes its lines and their formatting", () => {
  const content = withGroups();
  removeRecommendationGroup(content, "search-recommendations-all");
  assert.deepEqual(groupIds(content), ["s-classes", "sub-mind"]);
  assert.deepEqual(content.searchRecommendations, ["Люцидиум"]);
  assert.equal(documentText(content.formattedText[KEY]), "Люцидиум");
  assert.deepEqual(styleOfLine(content, "Люцидиум"), { color: "#00ff00" });
});

test("D-41 removing a subsection removes only its own lines", () => {
  const content = withGroups();
  removeRecommendationGroup(content, "sub-mind");
  assert.deepEqual(groupIds(content), ["search-recommendations-all", "s-classes"]);
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3"]);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
});

// ---- trimming before save ----

test("D-41 trimRecommendationSections trims every group, drops empty lines and recomputes the flat list", () => {
  const content = oldFormat();
  writeRecommendationGroup(content, "search-recommendations-all", "  r1  \n\nr2\n  ", { runs: [{ text: "  r1  \n\n" }, { text: "r2", style: RED }, { text: "\n  " }] });
  addRecommendationSection(content, "s-new", "Новый");
  writeRecommendationGroup(content, "s-new", "\n x \n", { runs: [{ text: "\n x \n" }] });
  trimRecommendationSections(content);
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "x"]);
  assert.deepEqual(flattenRecommendationSections(content.searchRecommendationSections ?? []), ["r1", "r2", "x"]);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
  assert.equal(documentText(content.formattedText[KEY]), "r1\nr2\nx");
});

test("D-41 trimRecommendationSections does nothing when the content has no sections", () => {
  const content = oldFormat();
  content.searchRecommendations = [" r1 ", "", "r3"];
  trimRecommendationSections(content);
  assert.deepEqual(content.searchRecommendations, [" r1 ", "", "r3"]);
  assert.equal(content.searchRecommendationSections?.length ?? 0, 0);
});

// ---- «Сводка» ----

const broadcast = (id: string, type: "news" | "quest" | "task", sectionId: string) => ({ id, type, title: id, body: "", published: true, important: false, startsAt: "", endsAt: "", conditions: "", sectionId });

const broadcastFixture = (): PortiaContent => {
  const content = base();
  content.broadcasts = [
    broadcast("n1", "news", ""),
    broadcast("n2", "news", "s1"),
    broadcast("q1", "quest", "s1"),
    broadcast("n3", "news", "sub1"),
    broadcast("n4", "news", "ghost"),
    broadcast("t1", "task", "s2"),
  ];
  content.broadcastSections = [
    { id: "s1", title: "Первый", subsections: [{ id: "sub1", title: "Под" }] },
    { id: "s2", title: "Второй", subsections: [] },
  ];
  return content;
};

test("D-41 broadcastGroupsView lists «Без раздела» first, then sections and subsections in order, each with its tab's entries", () => {
  const groups = broadcastGroupsView(broadcastFixture(), "news");
  assert.deepEqual(groups.map((group) => [group.id, group.kind]), [["", "none"], ["s1", "section"], ["sub1", "subsection"], ["s2", "section"]]);
  assert.deepEqual(groups.map((group) => group.broadcasts.map((item) => item.id)), [["n1", "n4"], ["n2"], ["n3"], []]);
  assert.equal(groups[2].parentId, "s1");
  const quests = broadcastGroupsView(broadcastFixture(), "quests");
  assert.deepEqual(quests.map((group) => group.broadcasts.map((item) => item.id)), [[], ["q1"], [], ["t1"]]);
});

test("D-41 a section removal keeps every broadcast and moves its entries to «Без раздела»", () => {
  const content = broadcastFixture();
  const order = content.broadcasts.map((item) => item.id);
  removeBroadcastOutlineGroup(content, "s1");
  assert.deepEqual(content.broadcasts.map((item) => item.id), order);
  assert.deepEqual(content.broadcasts.map((item) => item.sectionId), ["", "", "", "", "ghost", "s2"]);
  assert.deepEqual(content.broadcastSections?.map((section) => section.id), ["s2"]);
});

test("D-41 a subsection removal sends only its entries to «Без раздела»", () => {
  const content = broadcastFixture();
  removeBroadcastOutlineGroup(content, "sub1");
  assert.equal(content.broadcasts.find((item) => item.id === "n3")?.sectionId, "");
  assert.equal(content.broadcasts.find((item) => item.id === "n2")?.sectionId, "s1");
  assert.deepEqual(content.broadcastSections?.[0].subsections, []);
});

test("D-41 setBroadcastSection files an entry under a section or subsection and an unknown group means none", () => {
  const content = broadcastFixture();
  setBroadcastSection(content, "n1", "sub1");
  assert.equal(content.broadcasts[0].sectionId, "sub1");
  setBroadcastSection(content, "n1", "ghost");
  assert.equal(content.broadcasts[0].sectionId, "");
  setBroadcastSection(content, "n1", "s2");
  assert.equal(content.broadcasts[0].sectionId, "s2");
});

test("D-41 addBroadcastSection and addBroadcastSubsection create empty groups", () => {
  const content = base();
  addBroadcastSection(content, "bs-1", "Еженедельное");
  addBroadcastSubsection(content, "bs-1", "bs-2", "Итоги");
  assert.deepEqual(content.broadcastSections, [{ id: "bs-1", title: "Еженедельное", subsections: [{ id: "bs-2", title: "Итоги" }] }]);
});

test("D-42 moving broadcast sections and subsections keeps the order of the broadcasts", () => {
  const content = broadcastFixture();
  addBroadcastSubsection(content, "s1", "sub2", "Второй под");
  const order = content.broadcasts.map((item) => item.id);
  moveBroadcastSection(content, 0, 1);
  assert.deepEqual(content.broadcastSections?.map((section) => section.id), ["s2", "s1"]);
  moveBroadcastSubsection(content, "s1", 1, 0);
  assert.deepEqual(content.broadcastSections?.[1].subsections.map((sub) => sub.id), ["sub2", "sub1"]);
  assert.deepEqual(content.broadcasts.map((item) => item.id), order);
});

// ---- tab permissions (T-20-31) ----

test("D-41 the new keys belong to the Сводка and Рекомендации tabs", () => {
  assert.equal(sectionOfKey("broadcastSections"), "broadcasts");
  assert.equal(sectionOfKey("searchRecommendationSections"), "search");
});

test("D-41 a restricted editor without «Рекомендации» cannot change searchRecommendationSections", () => {
  const baseline = base();
  const incoming = structuredClone(baseline);
  incoming.searchRecommendationSections = [{ id: "s1", title: "A", items: [], subsections: [] }];
  const open = editorSections.filter((section) => section !== "search");
  assert.deepEqual(contentRefusal(baseline, incoming, open), { status: 403, error: "Раздел «Рекомендации» для вас закрыт.", code: "section-closed", sections: ["search"] });
});

test("D-41 a restricted editor without «Сводка» cannot change broadcastSections", () => {
  const baseline = base();
  const incoming = structuredClone(baseline);
  incoming.broadcastSections = [{ id: "s1", title: "A", subsections: [] }];
  const open = editorSections.filter((section) => section !== "broadcasts");
  assert.deepEqual(contentRefusal(baseline, incoming, open), { status: 403, error: "Раздел «Сводка» для вас закрыт.", code: "section-closed", sections: ["broadcasts"] });
});

// ---- helpers of the editor UI ----

test("D-41 renaming a group of the synthetic section writes real sections and keeps the formatting", () => {
  const content = oldFormat();
  renameRecommendationGroup(content, "search-recommendations-all", "Поиск");
  assert.equal(content.searchRecommendationSections?.[0].title, "Поиск");
  assert.deepEqual(content.searchRecommendations, ["r1", "r2", "r3"]);
  assert.deepEqual(styleOfLine(content, "r2"), RED);
});

test("D-41 renaming an unknown group or to the same title changes nothing", () => {
  const content = oldFormat();
  renameRecommendationGroup(content, "ghost", "x");
  renameRecommendationGroup(content, "search-recommendations-all", "Рекомендации");
  assert.equal(content.searchRecommendationSections?.length ?? 0, 0);
});

test("D-41 recommendationGroupIds lists sections and subsections in order, the synthetic section too", () => {
  assert.deepEqual(recommendationGroupIds(oldFormat()), ["search-recommendations-all"]);
  assert.deepEqual(recommendationGroupIds(withGroups()), ["search-recommendations-all", "s-classes", "sub-mind"]);
  const empty = base();
  empty.searchRecommendations = [];
  assert.deepEqual(recommendationGroupIds(empty), []);
});

test("D-41 broadcastGroupIds and broadcastGroupPath name the cards that hold a group", () => {
  const content = broadcastFixture();
  assert.deepEqual(broadcastGroupIds(content).sort(), ["s1", "s2", "sub1"]);
  assert.deepEqual(broadcastGroupPath(content, "s2"), ["s2"]);
  assert.deepEqual(broadcastGroupPath(content, "sub1"), ["s1", "sub1"]);
  assert.deepEqual(broadcastGroupPath(content, ""), []);
  assert.deepEqual(broadcastGroupPath(content, "ghost"), []);
});

// ---- source guards (the public windows stay as they were) ----

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("D-41 section editing stays in Справочник; Сводка and Рекомендации are plain lists (owner, 20-33)", () => {
  const editor = source("../components/portia-editor.tsx");
  // D-62 (20-50): «Информация» takes the same pinned bar as «Справочник»; the other tabs never get one.
  assert.equal((editor.match(/<SectionAddBar/g) ?? []).length, 2);
  const tabBlock = (name: string, next: string) => editor.slice(editor.indexOf(`{tab === "${name}" && (`), editor.indexOf(`{tab === "${next}" && (`));
  assert.equal((tabBlock("info", "guide").match(/<SectionAddBar/g) ?? []).length, 1, "«Информация» has the bar");
  assert.equal((tabBlock("guide", "broadcasts").match(/<SectionAddBar/g) ?? []).length, 1, "«Справочник» has the bar");
  assert.match(editor, /next\.searchRecommendationSections = \[\]/);
  assert.match(editor, /draft\.searchRecommendations\.join\("\\n"\)/);
  assert.match(editor, /trimRecommendationSections\(/);
  for (const gone of ["broadcastGroupsView(", "setBroadcastSection(", "addBroadcastSection(", "data-broadcast-section", "Разделы и подразделы только группируют"]) assert.ok(!editor.includes(gone), `${gone} is gone from the editor`);
  assert.match(editor, /shownBroadcasts\.map\(renderBroadcastCard\)/);
  const desktop = source("../components/portia-desktop.tsx");
  for (const name of ["broadcastSections", "searchRecommendationSections", "sectionId"]) assert.ok(!desktop.includes(name), `${name} stays out of the public desktop`);
});

test("D-47 the section types carry no note field", () => {
  const types = source("./portia-content.ts");
  const outline = source("./editor-outline.ts");
  assert.doesNotMatch(types, /note\??:/);
  assert.doesNotMatch(outline, /note\??:/);
});
