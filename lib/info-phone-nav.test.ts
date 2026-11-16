import assert from "node:assert/strict";
import test from "node:test";
import type { InfoSection } from "./portia-content.ts";
// A namespace import keeps the module linkable while it does not export the helpers yet, so the RED run fails on the assertions.
import * as nav from "./info-phone-nav.ts";

const longTitle = "Очень длинный заголовок подраздела, который не помещается в одну строку на узком экране телефона и должен переноситься целиком, а не обрезаться";

function section(id: string, title: string, body: string, subsections: { id: string; title: string }[] = []): InfoSection {
  return { id, title, body, subsections: subsections.map((sub) => ({ id: sub.id, title: sub.title, blocks: [] })) };
}

const sections: InfoSection[] = [
  section("what", "Что такое вирусы?", "Вирус — это организм."),
  section("class", "Классификация", "Обзор классов.", [
    { id: "class-a", title: "Класс А" },
    { id: "class-b", title: "" },
    { id: "class-c", title: longTitle },
  ]),
  section("docs", "Документация", "Порядок утверждения.", [{ id: "docs-a", title: "Единственный подраздел" }]),
  section("tail", "Хвост", ""),
];

test("D-31 infoNextTarget: a section with subsections leads to its first subsection", () => {
  assert.deepEqual(nav.infoNextTarget(sections, "class"), { id: "class-a", title: "Класс А" });
});

test("D-31 infoNextTarget: a subsection leads to the next one of the same section", () => {
  assert.deepEqual(nav.infoNextTarget(sections, "class-a"), { id: "class-b", title: "БЕЗ НАЗВАНИЯ" });
  assert.deepEqual(nav.infoNextTarget(sections, "class-b"), { id: "class-c", title: longTitle });
});

test("D-31 infoNextTarget: the last subsection has no next button and never leaves its section", () => {
  assert.equal(nav.infoNextTarget(sections, "class-c"), null);
  assert.equal(nav.infoNextTarget(sections, "docs-a"), null);
});

test("D-31 infoNextTarget: a section without subsections and an unknown id have no next button", () => {
  assert.equal(nav.infoNextTarget(sections, "what"), null);
  assert.equal(nav.infoNextTarget(sections, "tail"), null);
  assert.equal(nav.infoNextTarget(sections, "missing"), null);
  assert.equal(nav.infoNextTarget([], "class"), null);
});

test("D-31 infoNextTarget: an empty or blank target title reads БЕЗ НАЗВАНИЯ, a long one is kept whole", () => {
  const blank = [section("s", "S", "t", [{ id: "a", title: "A" }, { id: "b", title: "   " }])];
  assert.equal(nav.infoNextTarget(blank, "a")?.title, "БЕЗ НАЗВАНИЯ");
  assert.equal(nav.infoNextTarget(sections, "class-b")?.title, longTitle);
});

test("D-29 toggleInfoExpanded: an id outside the set is added, an id in the set is removed", () => {
  const opened = nav.toggleInfoExpanded(new Set<string>(), "class");
  assert.deepEqual([...opened], ["class"]);
  const closed = nav.toggleInfoExpanded(opened, "class");
  assert.deepEqual([...closed], []);
});

test("D-29 toggleInfoExpanded: other ids stay and the source set is not changed", () => {
  const source: ReadonlySet<string> = new Set(["a", "b"]);
  const next = nav.toggleInfoExpanded(source, "c");
  assert.deepEqual([...next].sort(), ["a", "b", "c"]);
  assert.deepEqual([...source].sort(), ["a", "b"]);
  const removed = nav.toggleInfoExpanded(source, "a");
  assert.deepEqual([...removed], ["b"]);
  assert.deepEqual([...source].sort(), ["a", "b"]);
  assert.notEqual(next, source);
});

test("D-32 revealInfoForSearch: a subsection expands its section", () => {
  assert.deepEqual(nav.revealInfoForSearch(sections, "class-b"), { expand: "class" });
});

test("D-32 revealInfoForSearch: a section with subsections expands itself, a plain section expands nothing", () => {
  assert.deepEqual(nav.revealInfoForSearch(sections, "class"), { expand: "class" });
  assert.deepEqual(nav.revealInfoForSearch(sections, "what"), { expand: null });
});

test("D-32 revealInfoForSearch: an unknown id reveals nothing", () => {
  assert.equal(nav.revealInfoForSearch(sections, "missing"), null);
  assert.equal(nav.revealInfoForSearch([], "class"), null);
});

test("D-29 infoOverviewVisible: only a section with subsections and a non-blank body has an overview row", () => {
  assert.equal(nav.infoOverviewVisible(sections[1]), true);
  assert.equal(nav.infoOverviewVisible(sections[0]), false);
  assert.equal(nav.infoOverviewVisible(sections[3]), false);
  assert.equal(nav.infoOverviewVisible(section("x", "X", " \n\t ", [{ id: "x-a", title: "A" }])), false);
});

// Phase 26 (UI-08, D-14 … D-16): the phone sections bar above the article.
const hitIds = (...ids: string[]) => (id: string) => ids.includes(id);

test("D-16 infoSectionsHitCount: counts sections with a hit in the section itself or in any subsection", () => {
  assert.equal(nav.infoSectionsHitCount(sections, hitIds()), 0);
  assert.equal(nav.infoSectionsHitCount(sections, hitIds("what")), 1);
  assert.equal(nav.infoSectionsHitCount(sections, hitIds("class-b")), 1);
  // Two hits inside one section count it once.
  assert.equal(nav.infoSectionsHitCount(sections, hitIds("class", "class-a", "class-c")), 1);
  assert.equal(nav.infoSectionsHitCount(sections, hitIds("what", "class-c", "docs-a")), 3);
  assert.equal(nav.infoSectionsHitCount(sections, hitIds("missing")), 0);
  assert.equal(nav.infoSectionsHitCount([], hitIds("what")), 0);
});

test("D-14 infoCurrentTitle: the title of a section or a subsection by id", () => {
  assert.equal(nav.infoCurrentTitle(sections, "what"), "Что такое вирусы?");
  assert.equal(nav.infoCurrentTitle(sections, "class-a"), "Класс А");
  assert.equal(nav.infoCurrentTitle(sections, "class-c"), longTitle);
});

test("D-14 infoCurrentTitle: an empty or blank title reads «Без названия», an unknown id falls back to the first section", () => {
  assert.equal(nav.infoCurrentTitle(sections, "class-b"), "Без названия");
  assert.equal(nav.infoCurrentTitle([section("s", "   ", "")], "s"), "Без названия");
  assert.equal(nav.infoCurrentTitle(sections, "missing"), "Что такое вирусы?");
  assert.equal(nav.infoCurrentTitle(sections, ""), "Что такое вирусы?");
  assert.equal(nav.infoCurrentTitle([section("s", "", "")], "missing"), "Без названия");
  assert.equal(nav.infoCurrentTitle([], "missing"), "Без названия");
});

test("D-14/D-16 infoSectionsButtonLabel: closed, closed with hits, open", () => {
  assert.deepEqual(nav.infoSectionsButtonLabel(false, 0), { text: "РАЗДЕЛЫ ▾", word: "РАЗДЕЛЫ", glyph: "▾", count: "", ariaLabel: undefined });
  assert.deepEqual(nav.infoSectionsButtonLabel(false, 3), { text: "РАЗДЕЛЫ ▾ · 3", word: "РАЗДЕЛЫ", glyph: "▾", count: " · 3", ariaLabel: "Разделы, найдено в разделах: 3" });
  // The open list shows the hits itself, so the button drops the count.
  assert.deepEqual(nav.infoSectionsButtonLabel(true, 3), { text: "РАЗДЕЛЫ ▴", word: "РАЗДЕЛЫ", glyph: "▴", count: "", ariaLabel: undefined });
  assert.deepEqual(nav.infoSectionsButtonLabel(true, 0), { text: "РАЗДЕЛЫ ▴", word: "РАЗДЕЛЫ", glyph: "▴", count: "", ariaLabel: undefined });
  // A negative or fractional count is not a count of sections.
  assert.equal(nav.infoSectionsButtonLabel(false, -1).count, "");
});

test("D-14 the bar copy is short: every text and accessible name is under 7 words", () => {
  for (const label of [nav.infoSectionsButtonLabel(false, 0), nav.infoSectionsButtonLabel(false, 12), nav.infoSectionsButtonLabel(true, 0)]) {
    assert.ok(label.text.split(/\s+/u).length < 7, label.text);
    if (label.ariaLabel) assert.ok(label.ariaLabel.split(/\s+/u).length < 7, label.ariaLabel);
  }
  assert.ok(nav.infoCurrentTitle([], "x").split(/\s+/u).length < 7);
});
