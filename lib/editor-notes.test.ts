import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTES_TABS,
  changedNotesTabs,
  isMissingNotesTable,
  normalizeNotesMap,
  notesPayloadForTabs,
  notesPutRefusal,
  pruneNotes,
  rebaseNotes,
} from "./editor-notes.ts";
import { defaultPortiaContent } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";

// Collects every object key at any depth, so a leaked "note" cannot hide in a nested block.
function allKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      allKeys(inner, found);
    }
  }
  return found;
}

// A stored payload the way a careless editor build might have written it: a note on every level of the three note tabs.
function payloadWithNotes(): Record<string, unknown> {
  const base = structuredClone(defaultPortiaContent) as unknown as Record<string, unknown>;
  base.guideSections = [
    {
      id: "g1",
      title: "Раздел",
      photo: "",
      note: "заметка раздела guide",
      cards: [{ id: "g1c1", title: "Карточка", cover: "", note: "заметка карточки", blocks: [{ id: "b1", type: "text", text: "Текст", note: "заметка блока" }] }],
    },
  ];
  base.broadcasts = [{ id: "s1", title: "Сводка", note: "заметка сводки", text: "Текст сводки" }];
  base.infoSections = [{ id: "i1", title: "Информация", note: "заметка информации", text: "Текст" }];
  base.searchRecommendations = ["Рекомендация", { note: "заметка рекомендации" }];
  base.note = "заметка верхнего уровня";
  // Records that keep unknown fields through a spread must drop the note too.
  base.viruses = [{
    id: "v1",
    name: "Вирус",
    note: "заметка вируса",
    mutations: [{ name: "М", note: "заметка мутации" }],
    scientistLogs: [{ id: "l1", title: "Лог", note: "заметка лога" }],
  }];
  return base;
}

test("D-47: the public projection (normalizePortiaContent) has no note key at any depth", () => {
  const source = payloadWithNotes();
  assert.ok(allKeys(source).has("note"), "fixture must really carry notes");
  const projected = normalizePortiaContent(source);
  assert.ok(projected);
  assert.equal(allKeys(projected).has("note"), false);
  assert.equal(JSON.stringify(projected).includes("заметка"), false);
});

test("D-47: the projection keeps the ordinary fields next to the dropped notes", () => {
  const projected = normalizePortiaContent(payloadWithNotes());
  assert.ok(projected);
  assert.equal(projected.guideSections[0]?.title, "Раздел");
  assert.equal(projected.guideSections[0]?.cards[0]?.title, "Карточка");
  assert.equal(projected.searchRecommendations[0], "Рекомендация");
});

test("D-47: the editor answer keeps the notes of the open tabs only", () => {
  const rows = [
    { tab: "guide", notes: { g1: "заметка guide" }, revision: 3 },
    { tab: "broadcasts", notes: { s1: "заметка сводки" }, revision: 2 },
    { tab: "search", notes: { r1: "заметка поиска" }, revision: 1 },
  ];
  assert.deepEqual(notesPayloadForTabs(rows, ["guide"]), { notes: { guide: { g1: "заметка guide" } }, revisions: { guide: 3 } });
  assert.deepEqual(notesPayloadForTabs(rows, []), { notes: {}, revisions: {} });
  const two = notesPayloadForTabs(rows, ["search", "broadcasts", "viruses"]);
  assert.deepEqual(Object.keys(two.notes).sort(), ["broadcasts", "search"]);
  assert.deepEqual(two.revisions, { broadcasts: 2, search: 1 });
});

test("D-47: an open tab without a stored row answers with empty notes and revision 0", () => {
  assert.deepEqual(notesPayloadForTabs([], ["guide"]), { notes: { guide: {} }, revisions: { guide: 0 } });
});

test("D-47: a row with a broken notes value is read as empty notes, never thrown", () => {
  const rows = [{ tab: "guide", notes: "oops", revision: 4 }, { tab: "search", notes: null, revision: "x" }];
  assert.deepEqual(notesPayloadForTabs(rows, ["guide", "search"]), { notes: { guide: {}, search: {} }, revisions: { guide: 4, search: 0 } });
});

test("D-47: NOTES_TABS are exactly the three note tabs", () => {
  assert.deepEqual([...NOTES_TABS], ["guide", "broadcasts", "search"]);
});

test("D-47: notesPutRefusal rejects an unknown tab with 400", () => {
  assert.deepEqual(notesPutRefusal({ tab: "viruses", notes: {}, revision: 0 }, ["viruses"]), { status: 400, error: "Некорректные данные." });
  assert.equal(notesPutRefusal({ notes: {}, revision: 0 }, ["guide"])?.status, 400);
});

test("D-47: notesPutRefusal rejects a closed tab with 403 and the closed-section text", () => {
  const refusal = notesPutRefusal({ tab: "guide", notes: {}, revision: 0 }, ["broadcasts"]);
  assert.equal(refusal?.status, 403);
  assert.equal(refusal?.error, "Раздел «Справочник» для вас закрыт.");
});

test("D-47: notesPutRefusal rejects a bad revision with 400", () => {
  for (const revision of [-1, 1.5, "1", null, undefined, Number.NaN]) {
    assert.equal(notesPutRefusal({ tab: "guide", notes: {}, revision }, ["guide"])?.status, 400, String(revision));
  }
});

test("D-47: notesPutRefusal rejects a note longer than 300 characters", () => {
  const refusal = notesPutRefusal({ tab: "guide", notes: { a: "я".repeat(301) }, revision: 0 }, ["guide"]);
  assert.deepEqual(refusal, { status: 400, error: "Заметка длиннее 300 символов." });
  assert.equal(notesPutRefusal({ tab: "guide", notes: { a: "я".repeat(300) }, revision: 0 }, ["guide"]), null);
});

test("D-47: notesPutRefusal rejects notes that are not an object", () => {
  for (const notes of [null, [], "text", 5, undefined]) {
    assert.equal(notesPutRefusal({ tab: "guide", notes, revision: 0 }, ["guide"])?.status, 400, String(notes));
  }
});

test("D-47: notesPutRefusal accepts a correct body", () => {
  assert.equal(notesPutRefusal({ tab: "search", notes: { r1: "текст" }, revision: 2 }, ["guide", "search"]), null);
});

test("D-47: normalizeNotesMap drops non-string, blank and badly keyed entries and trims values", () => {
  const map = normalizeNotesMap({
    ok: "  заметка  ",
    "with-dash_1": "x",
    blank: "   ",
    number: 5,
    nested: { a: 1 },
    "bad key": "x",
    "ключ": "x",
    [""]: "x",
    ["k".repeat(81)]: "x",
  });
  assert.deepEqual(map, { ok: "заметка", "with-dash_1": "x" });
  assert.deepEqual(normalizeNotesMap(null), {});
  assert.deepEqual(normalizeNotesMap([1, 2]), {});
  assert.deepEqual(normalizeNotesMap("x"), {});
});

test("D-47: normalizeNotesMap keeps at most 500 entries", () => {
  const big = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [`k${index}`, "x"]));
  assert.equal(Object.keys(normalizeNotesMap(big)).length, 500);
});

test("D-47: normalizeNotesMap drops the __proto__ key and never changes the prototype", () => {
  const map = normalizeNotesMap(JSON.parse('{"__proto__":"x","constructor":"y","a":"z"}'));
  assert.equal(Object.getPrototypeOf(map), Object.prototype);
  assert.equal(Object.hasOwn(map, "__proto__"), false);
  assert.deepEqual(map, { constructor: "y", a: "z" });
});

test("D-47: pruneNotes removes ids that no longer exist", () => {
  assert.deepEqual(pruneNotes({ a: "1", b: "2", c: "3" }, ["a", "c", "zzz"]), { a: "1", c: "3" });
  assert.deepEqual(pruneNotes({ a: "1" }, new Set<string>()), {});
});

test("D-47: changedNotesTabs lists the tabs whose maps differ", () => {
  const baseline = { guide: { a: "1" }, broadcasts: { b: "2" }, search: {} };
  assert.deepEqual(changedNotesTabs(baseline, baseline), []);
  assert.deepEqual(changedNotesTabs(baseline, { ...baseline, guide: { a: "1", z: "new" } }), ["guide"]);
  assert.deepEqual(changedNotesTabs(baseline, { guide: { a: "1" }, broadcasts: { b: "changed" }, search: { s: "x" } }), ["broadcasts", "search"]);
  // Key order is not a change.
  assert.deepEqual(changedNotesTabs({ guide: { a: "1", b: "2" } }, { guide: { b: "2", a: "1" } }), []);
  // A tab missing on one side counts as an empty map.
  assert.deepEqual(changedNotesTabs({}, { guide: {} }), []);
  assert.deepEqual(changedNotesTabs({}, { guide: { a: "1" } }), ["guide"]);
});

test("D-47: isMissingNotesTable is true only for 42P01 and PGRST205", () => {
  assert.equal(isMissingNotesTable({ code: "42P01" }), true);
  assert.equal(isMissingNotesTable({ code: "PGRST205" }), true);
  assert.equal(isMissingNotesTable({ code: "42501" }), false);
  assert.equal(isMissingNotesTable({ message: "relation does not exist" }), false);
  assert.equal(isMissingNotesTable(null), false);
  assert.equal(isMissingNotesTable(undefined), false);
});

test("D-47: rebaseNotes puts the editor's own changes over the notes another editor saved", () => {
  const before = { a: "old", b: "keep", c: "gone" };
  const mine = { a: "mine", b: "keep", n: "new" };
  const server = { a: "theirs", b: "theirs-b", c: "theirs-c", z: "only-theirs" };
  // Changed (a), added (n) and removed (c) by me win; everything else follows the server.
  assert.deepEqual(rebaseNotes(before, mine, server), { a: "mine", b: "theirs-b", n: "new", z: "only-theirs" });
});

test("D-47: rebaseNotes without own changes is the server copy, and never mutates its inputs", () => {
  const before = { a: "1" };
  const server = { a: "2", b: "3" };
  assert.deepEqual(rebaseNotes(before, { a: "1" }, server), server);
  assert.deepEqual(before, { a: "1" });
  assert.deepEqual(server, { a: "2", b: "3" });
});
