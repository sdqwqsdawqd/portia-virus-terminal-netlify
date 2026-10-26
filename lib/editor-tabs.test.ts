import assert from "node:assert/strict";
import test from "node:test";
import { editorSections, sectionLabels } from "./editor-changes.ts";
import { closedMessage, closedSectionsOf, openTabIds, parseTabLists, tabRegistry, type TabDef } from "./editor-tabs.ts";

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
