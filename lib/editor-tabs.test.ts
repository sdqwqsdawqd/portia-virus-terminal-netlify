import assert from "node:assert/strict";
import test from "node:test";
import { editorSections, sectionLabels } from "./editor-changes.ts";
import { readFileSync } from "node:fs";
import { defaultPortiaContent, type PortiaContent } from "./portia-content.ts";
import { closedMessage, closedSectionsOf, contentRefusal, openTabIds, parseTabLists, tabRegistry, type TabDef } from "./editor-tabs.ts";

const allSeven = ["viruses", "info", "broadcasts", "recycle", "search", "assistant", "employees"];

test("registry holds the seven tabs in strip order with the section labels plus Сотрудники", () => {
  assert.deepEqual(tabRegistry.map((tab) => tab.id), allSeven);
  assert.deepEqual(tabRegistry.slice(0, 6).map((tab) => tab.label), editorSections.map((id) => sectionLabels[id]));
  assert.equal(tabRegistry[6].label, "Сотрудники");
  assert.ok(tabRegistry.every((tab) => tab.kind === "regular"));
  assert.ok(!tabRegistry.some((tab) => tab.id === "access"));
});

test("openTabIds: empty lists open all seven in tab order", () => {
  assert.deepEqual(openTabIds([], []), allSeven);
});

test("openTabIds: a closed tab drops out, all seven closed gives an empty list (D-07)", () => {
  assert.deepEqual(openTabIds(["broadcasts"], []), allSeven.filter((id) => id !== "broadcasts"));
  assert.deepEqual(openTabIds(allSeven, []), []);
});

test("openTabIds: a stored id the registry does not know is ignored", () => {
  assert.deepEqual(openTabIds(["ghost"], ["ghost"]), allSeven);
});

test("openTabIds: a trusted tab is closed until granted, a closed list cannot change it, a future regular tab is open (D-24, D-25)", () => {
  const registry: TabDef[] = [...tabRegistry, { id: "promo", label: "Повышение", kind: "trusted" }, { id: "guide", label: "Справочник", kind: "regular" }];
  assert.ok(!openTabIds([], [], registry).includes("promo"));
  assert.ok(openTabIds([], ["promo"], registry).includes("promo"));
  assert.ok(openTabIds(["promo"], ["promo"], registry).includes("promo"));
  assert.ok(openTabIds([], [], registry).includes("guide"));
});

test("closedSectionsOf: opening only viruses and employees closes the five other content sections", () => {
  assert.deepEqual(closedSectionsOf(["viruses", "employees"]), ["info", "broadcasts", "recycle", "search", "assistant"]);
});

test("closedMessage names one or several sections", () => {
  assert.equal(closedMessage(["broadcasts"]), "Раздел «Сводка» для вас закрыт.");
  assert.equal(closedMessage(["broadcasts", "recycle"]), "Разделы «Сводка», «Корзина» для вас закрыты.");
});

test("parseTabLists accepts an empty closed list and all seven closed", () => {
  assert.deepEqual(parseTabLists({ closedTabs: [] }), { closedTabs: [] });
  assert.deepEqual(parseTabLists({ closedTabs: allSeven }), { closedTabs: allSeven });
});

test("parseTabLists rejects bad bodies", () => {
  assert.equal(parseTabLists({}), null);
  assert.equal(parseTabLists({ closedTabs: "viruses" }), null);
  assert.equal(parseTabLists({ closedTabs: [1] }), null);
  assert.equal(parseTabLists({ closedTabs: ["ghost"] }), null);
  assert.equal(parseTabLists({ closedTabs: ["access"] }), null);
  assert.equal(parseTabLists({ grantedTabs: ["viruses"] }), null); // regular id in grantedTabs
  assert.equal(parseTabLists({ closedTabs: ["viruses"], grantedTabs: "x" }), null);
});

test("parseTabLists removes duplicates and keeps registry order", () => {
  assert.deepEqual(parseTabLists({ closedTabs: ["recycle", "viruses", "recycle"] }), { closedTabs: ["viruses", "recycle"] });
});

const fixture = (): PortiaContent => structuredClone(defaultPortiaContent);
const sixSections = allSeven.slice(0, 6);
const without = (...ids: string[]) => allSeven.filter((id) => !ids.includes(id));
const withBroadcast = (): PortiaContent => {
  const content = fixture();
  content.broadcasts.push({ id: "b1", type: "news", title: "a", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" });
  return content;
};

test("contentRefusal: all seven open is null even when every section changed", () => {
  const draft = fixture();
  draft.viruses[0].name = "X";
  draft.broadcasts.push(withBroadcast().broadcasts[0]);
  draft.recycleFiles[0].name = "X";
  assert.equal(contentRefusal(fixture(), draft, allSeven), null);
});

test("contentRefusal: a changed broadcast with «Сводка» closed gives 403 naming it", () => {
  const baseline = withBroadcast();
  const draft = structuredClone(baseline);
  draft.broadcasts[0].title = "b";
  assert.deepEqual(contentRefusal(baseline, draft, without("broadcasts")), {
    status: 403, error: "Раздел «Сводка» для вас закрыт.", code: "section-closed", sections: ["broadcasts"],
  });
});

test("contentRefusal: two closed and changed sections are both named", () => {
  const draft = fixture();
  draft.broadcasts.push(withBroadcast().broadcasts[0]);
  draft.assistantOffendedPhrase = "X";
  const refusal = contentRefusal(fixture(), draft, without("broadcasts", "assistant"));
  assert.equal(refusal?.status, 403);
  assert.equal(refusal?.error, "Разделы «Сводка», «Помощник» для вас закрыты.");
  assert.deepEqual(refusal?.sections, ["broadcasts", "assistant"]);
});

test("contentRefusal: D-13 a live virus moved to the bin saves with «Корзина» closed, a bin edit does not", () => {
  const moved = fixture();
  const [virus] = moved.viruses.splice(0, 1);
  moved.recycledViruses.push(virus);
  moved.recycleOrder.push(`virus:${virus.id}`);
  assert.equal(contentRefusal(fixture(), moved, without("recycle")), null);

  const edited = fixture();
  edited.recycleFiles[0].name = "X";
  const refusal = contentRefusal(fixture(), edited, without("recycle"));
  assert.equal(refusal?.status, 403);
  assert.equal(refusal?.error, "Раздел «Корзина» для вас закрыт.");
});

test("contentRefusal: every content section closed is frozen, even with no change (D-17)", () => {
  for (const open of [["employees"], []]) {
    assert.deepEqual(contentRefusal(fixture(), fixture(), open), { status: 403, error: "Владелец пока не открыл вам ни одного раздела." });
  }
});

test("contentRefusal: a changed key that belongs to no section is refused with 400 for a restricted editor", () => {
  const draft = fixture();
  draft.formattedText["zzz:1"] = { runs: [{ text: "x" }] } as never;
  assert.deepEqual(contentRefusal(fixture(), draft, without("search")), { status: 400, error: "Некорректная структура данных." });
});

test("contentRefusal: only «Сотрудники» closed leaves content free", () => {
  const draft = fixture();
  draft.viruses[0].name = "X";
  assert.equal(contentRefusal(fixture(), draft, sixSections), null);
});

const routeText = (path: string) => readFileSync(new URL(`../app/api/${path}/route.ts`, import.meta.url), "utf8");

test("PUT /api/content refuses before the write and the cache purge", () => {
  const put = routeText("content").split("export async function PUT")[1];
  const refusal = put.indexOf("contentRefusal(");
  assert.ok(refusal > 0);
  for (const later of [".update(row)", ".insert(", "purgeCacheTag("]) {
    assert.ok(refusal < put.indexOf(later), `contentRefusal must come before ${later}`);
  }
});
