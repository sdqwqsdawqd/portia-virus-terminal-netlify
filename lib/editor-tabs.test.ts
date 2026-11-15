import assert from "node:assert/strict";
import test from "node:test";
import { editorSections, sectionLabels } from "./editor-changes.ts";
import { readFileSync } from "node:fs";
import { type PortiaContent } from "./portia-content.ts";
import { portiaContentFixture } from "./testing/portia-content-fixture.ts";
import { closedMessage, closedSectionsOf, contentRefusal, openTabIds, parseTabLists, tabRegistry, type TabDef } from "./editor-tabs.ts";

const regularTabs = ["viruses", "info", "guide", "broadcasts", "recycle", "search", "assistant", "employees", "users"];
const allTabs = [...regularTabs, "promo"];

test("registry holds nine regular tabs followed by trusted Повышение", () => {
  assert.deepEqual(tabRegistry.map((tab) => tab.id), allTabs);
  assert.deepEqual(tabRegistry.slice(0, 7).map((tab) => tab.label), editorSections.map((id) => sectionLabels[id]));
  assert.equal(tabRegistry[7].label, "Сотрудники");
  assert.deepEqual(tabRegistry.slice(0, 9).map((tab) => tab.kind), Array(9).fill("regular"));
  assert.deepEqual(tabRegistry[8], { id: "users", label: "Пользователи", kind: "regular" });
  assert.deepEqual(tabRegistry[9], { id: "promo", label: "Повышение", kind: "trusted" });
  assert.ok(!tabRegistry.some((tab) => tab.id === "access"));
});

test("openTabIds: empty lists open regular tabs and keep Повышение closed", () => {
  assert.deepEqual(openTabIds([], []), regularTabs);
});

test("openTabIds: a closed tab drops out, all nine closed gives an empty list (D-07)", () => {
  assert.deepEqual(openTabIds(["broadcasts"], []), regularTabs.filter((id) => id !== "broadcasts"));
  assert.deepEqual(openTabIds(regularTabs, []), []);
});

test("openTabIds: a stored id the registry does not know is ignored", () => {
  assert.deepEqual(openTabIds(["ghost"], ["ghost"]), regularTabs);
});

test("openTabIds: Повышение opens only by grant and closedTabs cannot close it (D-24, D-25)", () => {
  const registry: TabDef[] = [...tabRegistry, { id: "future", label: "Будущая", kind: "regular" }];
  assert.ok(!openTabIds([], [], registry).includes("promo"));
  assert.ok(openTabIds([], ["promo"], registry).includes("promo"));
  assert.ok(openTabIds(["promo"], ["promo"], registry).includes("promo"));
  assert.ok(openTabIds([], [], registry).includes("future"));
});

test("closedSectionsOf: opening only viruses and employees closes the six other content sections", () => {
  assert.deepEqual(closedSectionsOf(["viruses", "employees"]), ["info", "guide", "broadcasts", "recycle", "search", "assistant"]);
});

test("closedMessage names one or several sections", () => {
  assert.equal(closedMessage(["broadcasts"]), "Раздел «Сводка» для вас закрыт.");
  assert.equal(closedMessage(["broadcasts", "recycle"]), "Разделы «Сводка», «Корзина» для вас закрыты.");
});

test("parseTabLists accepts an empty closed list and all nine regular tabs closed", () => {
  assert.deepEqual(parseTabLists({ closedTabs: [] }), { closedTabs: [] });
  assert.deepEqual(parseTabLists({ closedTabs: regularTabs }), { closedTabs: regularTabs });
});

test("USR-09: closing users drops it from openTabIds and parseTabLists accepts it", () => {
  assert.deepEqual(openTabIds(["users"], []), regularTabs.filter((id) => id !== "users"));
  assert.deepEqual(parseTabLists({ closedTabs: ["users"] }), { closedTabs: ["users"] });
});

test("parseTabLists rejects bad bodies", () => {
  assert.equal(parseTabLists({}), null);
  assert.equal(parseTabLists({ closedTabs: "viruses" }), null);
  assert.equal(parseTabLists({ closedTabs: [1] }), null);
  assert.equal(parseTabLists({ closedTabs: ["ghost"] }), null);
  assert.equal(parseTabLists({ closedTabs: ["access"] }), null);
  assert.equal(parseTabLists({ closedTabs: ["promo"] }), null); // trusted id in closedTabs
  assert.equal(parseTabLists({ grantedTabs: ["viruses"] }), null); // regular id in grantedTabs
  assert.equal(parseTabLists({ closedTabs: ["viruses"], grantedTabs: "x" }), null);
});

test("parseTabLists removes duplicates and keeps registry order", () => {
  assert.deepEqual(parseTabLists({ closedTabs: ["recycle", "viruses", "recycle"] }), { closedTabs: ["viruses", "recycle"] });
  assert.deepEqual(parseTabLists({ grantedTabs: ["promo", "promo"] }), { grantedTabs: ["promo"] });
});

const fixture = (): PortiaContent => structuredClone(portiaContentFixture);
const sevenSections = regularTabs.slice(0, 7);
const without = (...ids: string[]) => regularTabs.filter((id) => !ids.includes(id));
const withBroadcast = (): PortiaContent => {
  const content = fixture();
  content.broadcasts.push({ id: "b1", type: "news", title: "a", body: "", published: false, important: false, startsAt: "", endsAt: "", conditions: "" });
  return content;
};

test("contentRefusal: all nine open is null even when every section changed", () => {
  const draft = fixture();
  draft.viruses[0].name = "X";
  draft.broadcasts.push(withBroadcast().broadcasts[0]);
  draft.recycleFiles[0].name = "X";
  assert.equal(contentRefusal(fixture(), draft, regularTabs), null);
});

test("contentRefusal: a changed broadcast with «Сводка» closed gives 403 naming it", () => {
  const baseline = withBroadcast();
  const draft = structuredClone(baseline);
  draft.broadcasts[0].title = "b";
  assert.deepEqual(contentRefusal(baseline, draft, without("broadcasts")), {
    status: 403, error: "Раздел «Сводка» для вас закрыт.", code: "section-closed", sections: ["broadcasts"],
  });
});

test("contentRefusal: a changed guide card with «Справочник» closed gives 403 naming it, open gives null", () => {
  const baseline = fixture();
  baseline.guideSections = [{ id: "g1", title: "Раздел", photo: "", cards: [{ id: "c1", title: "a", cover: "", blocks: [] }] }];
  const draft = structuredClone(baseline);
  draft.guideSections[0].cards[0].title = "b";
  assert.deepEqual(contentRefusal(baseline, draft, without("guide")), {
    status: 403, error: "Раздел «Справочник» для вас закрыт.", code: "section-closed", sections: ["guide"],
  });
  assert.equal(contentRefusal(baseline, draft, regularTabs), null);
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
  assert.equal(contentRefusal(fixture(), draft, sevenSections), null);
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

const bodyOf = (text: string, name: string) => text.split(`export async function ${name}`)[1].split("export async function")[0];

test("employee writes check the Сотрудники tab after canEdit; the public GET does not", () => {
  const route = routeText("employees");
  for (const method of ["PATCH", "POST", "DELETE"]) {
    const body = bodyOf(route, method);
    assert.ok(body.indexOf('openTabs.includes("employees")') > body.indexOf("access.canEdit"), method);
  }
  assert.ok(!bodyOf(route, "GET").includes("openTabs"));
});

test("the editor employee roster and uploads respect the tab list", () => {
  assert.ok(bodyOf(routeText("employees/editor"), "GET").includes('openTabs.includes("employees")'));
  // The decision lives in uploadGate (20-17 WR-03); the route passes the access answer to it.
  assert.ok(routeText("uploads").includes("uploadGate(") && routeText("uploads").includes("getEditorAccess("));
  assert.ok(readFileSync(new URL("./image-upload.ts", import.meta.url), "utf8").includes("access.openTabs.length"));
});

test("/api/editors has an owner-only PATCH with full lists and a pending-database answer; POST still inserts only email and granted_by", () => {
  const route = routeText("editors");
  const patch = bodyOf(route, "PATCH");
  assert.ok(patch.includes("requireOwner(") && patch.includes("parseTabLists(") && patch.includes("pendingDatabase(") && route.includes(`code: "pending-database"`));
  assert.ok(bodyOf(route, "GET").includes("tabsEnforced"));
  assert.ok(bodyOf(route, "POST").includes(".insert({ email, granted_by: access.user.id })"));
});

test("an auth network blip makes /api/access answer 503, not canEdit:false (CR-01)", () => {
  const route = routeText("access");
  assert.ok(route.indexOf("isAuthRetryableFetchError(") > 0 && route.indexOf("isAuthRetryableFetchError(") < route.indexOf("getEditorAccess(supabase"));
});

test("openTabIds: tab ids are exact strings, so a case or whitespace variant neither closes a tab nor grants Повышение (STAB-APP-09 encoding)", () => {
  assert.deepEqual(openTabIds(["Info", " info", "INFO"], []), regularTabs);
  assert.ok(!openTabIds([], ["Promo", " promo", "promo "]).includes("promo"));
  assert.ok(openTabIds([], ["promo"]).includes("promo"));
});

test("an editor with no grants and no closures gets every regular tab and no Повышение; an empty list refuses content and uploads (STAB-APP-09 empty)", () => {
  const open = openTabIds([], []);
  assert.deepEqual(open, regularTabs);
  assert.ok(!open.includes("promo"));
  assert.equal(contentRefusal(portiaContentFixture, portiaContentFixture, open), null);
  const none = openTabIds(regularTabs, []);
  assert.deepEqual(none, []);
  // No tab at all: the content save is refused as a whole and the upload route answers by the same empty list.
  assert.equal(contentRefusal(portiaContentFixture, portiaContentFixture, none)?.status, 403);
  assert.match(readFileSync(new URL("./image-upload.ts", import.meta.url), "utf8"), /access\.openTabs\.length === 0/);
});

test("a tab revoked while editing: the next access answer drops it and the same save is refused for that section only (STAB-APP-09 concurrency)", () => {
  const before = openTabIds([], []);
  const after = openTabIds(["info"], []);
  assert.ok(before.includes("info") && !after.includes("info"));
  const edited = structuredClone(portiaContentFixture) as PortiaContent;
  edited.infoSections[0].title = "Правка раздела, закрытого во время ввода";
  edited.viruses[0].name = "Правка открытого раздела";
  assert.equal(contentRefusal(portiaContentFixture, edited, before), null);
  const refusal = contentRefusal(portiaContentFixture, edited, after);
  assert.equal(refusal?.code, "section-closed");
  assert.deepEqual(refusal?.sections, ["info"]);
});
