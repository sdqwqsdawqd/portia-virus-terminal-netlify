import assert from "node:assert/strict";
import test from "node:test";
import { baseDraftOf, createEmployeeDraftStore, detailsOf, dirtyEmployeeIds, draftFor, dropDraft, employeeRowName, putDraft, saveQueue, settleAfterSave, type EmployeeDrafts } from "./employee-drafts.ts";
import type { PortiaEmployee } from "./portia-employees.ts";

const person = (id: string, over: Partial<PortiaEmployee> = {}): PortiaEmployee => ({
  id,
  nickname: `Nick${id}`,
  callsign: "Волк",
  title: "Доктор",
  rank: "3",
  knowledgeRating: 1,
  pawsRating: null,
  bioRating: null,
  sRating: null,
  activityRating: null,
  testsRating: null,
  overallRating: null,
  biography: `Биография ${id}`,
  photoUrl: "",
  robloxUserId: null,
  robloxAvatarUrl: "",
  robloxFullAvatarUrl: "",
  order: 0,
  source: "sheet",
  ...over,
});

const a = person("a");
const b = person("b");
const manual = person("m", { source: "manual" });
const list = [a, b, manual];

const typed = (employee: PortiaEmployee, biography: string) => ({ ...baseDraftOf(employee), profile: { ...baseDraftOf(employee).profile, biography } });

test("OWN-07: putDraft keeps a draft per id and leaves the others untouched", () => {
  const first = putDraft({}, "a", typed(a, "новая A"));
  const both = putDraft(first, "b", typed(b, "новая B"));
  assert.equal(both.a.profile.biography, "новая A");
  assert.equal(both.b.profile.biography, "новая B");
  assert.equal(first.b, undefined, "the earlier map is not changed");
  assert.deepEqual(Object.keys(putDraft(both, "a", typed(a, "ещё раз"))), ["a", "b"]);
});

test("OWN-07: draftFor returns the typed draft or the stored profile and details; only own keys count", () => {
  const drafts: EmployeeDrafts = putDraft({}, "a", typed(a, "правка"));
  assert.equal(draftFor(drafts, a).profile.biography, "правка");
  assert.deepEqual(draftFor(drafts, b), baseDraftOf(b));
  assert.deepEqual(draftFor({}, manual).details, { title: "Доктор", rank: "3", callsign: "Волк" });
  const odd = person("constructor");
  assert.deepEqual(draftFor({}, odd), baseDraftOf(odd), "an id that is a property of Object does not find a draft");
  assert.deepEqual(dirtyEmployeeIds({}, [odd]), []);
});

test("OWN-07: dirtyEmployeeIds lists only people with a real change, in the order of the list", () => {
  let drafts: EmployeeDrafts = {};
  drafts = putDraft(drafts, "b", typed(b, "правка B"));
  drafts = putDraft(drafts, "a", baseDraftOf(a));
  assert.deepEqual(dirtyEmployeeIds(drafts, list), ["b"], "a draft equal to the stored profile is not dirty");
  drafts = putDraft(drafts, "a", typed(a, "правка A"));
  assert.deepEqual(dirtyEmployeeIds(drafts, list), ["a", "b"], "list order, not the order of typing");
  const missingRating = putDraft({}, "a", { ...baseDraftOf(a), profile: { ...baseDraftOf(a).profile, pawsRating: 4 } });
  assert.deepEqual(dirtyEmployeeIds(missingRating, list), ["a"], "a rating counts");
});

test("OWN-07: details count only for a manual employee", () => {
  const sheetDetails = putDraft({}, "a", { ...baseDraftOf(a), details: { ...detailsOf(a), rank: "9" } });
  assert.deepEqual(dirtyEmployeeIds(sheetDetails, list), [], "a sheet employee takes the details from the sheet");
  const manualDetails = putDraft({}, "m", { ...baseDraftOf(manual), details: { ...detailsOf(manual), rank: "9" } });
  assert.deepEqual(dirtyEmployeeIds(manualDetails, list), ["m"]);
});

test("OWN-07: dropDraft removes one draft and returns the same map when there is none", () => {
  const drafts = putDraft(putDraft({}, "a", typed(a, "x")), "b", typed(b, "y"));
  assert.deepEqual(Object.keys(dropDraft(drafts, "a")), ["b"]);
  assert.equal(dropDraft(drafts, "zzz"), drafts);
});

test("OWN-07: settleAfterSave takes the saved profile where nothing was typed since sending, by id (T-26.1-05)", () => {
  const sent = typed(a, "отправлено");
  const drafts = putDraft(putDraft({}, "a", sent), "b", typed(b, "правка B"));
  const stored = { ...a, biography: "отправлено" };
  const settled = settleAfterSave(drafts, "a", sent, stored);
  assert.equal(Object.hasOwn(settled, "a"), false, "the draft equals the stored profile and is dropped");
  assert.equal(settled.b.profile.biography, "правка B", "another employee's draft is not touched");
});

test("OWN-07: settleAfterSave keeps what was typed after sending and drops nothing else", () => {
  const sent = typed(a, "отправлено");
  const nowTyped = { ...sent, profile: { ...sent.profile, biography: "отправлено и дальше" } };
  const settled = settleAfterSave(putDraft({}, "a", nowTyped), "a", sent, { ...a, biography: "отправлено" });
  assert.equal(settled.a.profile.biography, "отправлено и дальше");
});

test("OWN-07: settleAfterSave takes the server's normalised value where the text was not touched", () => {
  const sent = { ...baseDraftOf(a), profile: { ...baseDraftOf(a).profile, photoUrl: "  /media/x.png " } };
  const settled = settleAfterSave(putDraft({}, "a", sent), "a", sent, { ...a, photoUrl: "/media/x.png" });
  assert.equal(Object.hasOwn(settled, "a"), false, "the trimmed stored value replaced the typed one, so nothing is left unsaved");
});

test("OWN-07: when the database refused the details the typed ones stay unsaved", () => {
  const sent = { ...baseDraftOf(manual), details: { ...detailsOf(manual), rank: "9" } };
  const stored = { ...manual };
  const settled = settleAfterSave(putDraft({}, "m", sent), "m", sent, stored, { detailsPending: true });
  assert.equal(settled.m.details.rank, "9");
  assert.deepEqual(dirtyEmployeeIds(settled, [stored]), ["m"]);
  const accepted = settleAfterSave(putDraft({}, "m", sent), "m", sent, { ...manual, rank: "9" });
  assert.equal(Object.hasOwn(accepted, "m"), false);
});

test("OWN-07: settleAfterSave for an id with no draft changes nothing", () => {
  const drafts = putDraft({}, "b", typed(b, "x"));
  assert.equal(settleAfterSave(drafts, "a", baseDraftOf(a), a), drafts);
});

test("OWN-07: saveQueue saves the open employee first, then the others in list order", () => {
  assert.deepEqual(saveQueue(["a", "b", "m"], "b"), ["b", "a", "m"]);
  assert.deepEqual(saveQueue(["a", "b", "m"], "a"), ["a", "b", "m"]);
  assert.deepEqual(saveQueue(["a", "m"], "b"), ["a", "m"], "an open employee with no changes is not added");
  assert.deepEqual(saveQueue([], "a"), []);
});

test("OWN-07: the row name holds the visible text and the mark of unsaved edits", () => {
  assert.equal(employeeRowName(a, false), "Nicka Волк · Доктор · 3");
  assert.equal(employeeRowName(a, true), "Nicka Волк · Доктор · 3, есть несохранённые правки");
  assert.equal(employeeRowName(manual, true), "Nickm ВНЕ ТАБЛИЦЫ Волк · Доктор · 3, есть несохранённые правки");
});

test("OWN-07: the store keeps two drafts in a row and tells its listeners", () => {
  const store = createEmployeeDraftStore();
  store.setKnown(list);
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  store.update(a, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "A1" } }));
  store.update(b, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "B1" } }));
  assert.equal(calls, 2);
  assert.deepEqual(store.dirtyIds(), ["a", "b"]);
  assert.equal(store.draftFor(a).profile.biography, "A1", "the first employee's draft comes back when it is opened again");
  assert.equal(store.hasDirty(), true);
  off();
  store.update(a, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "Ещё" } }));
  assert.equal(calls, 2, "an unsubscribed listener is not called");
});

test("OWN-07: typing the stored text back clears the draft", () => {
  const store = createEmployeeDraftStore();
  store.setKnown(list);
  store.update(a, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "другое" } }));
  assert.equal(store.isDirty("a"), true);
  store.update(a, (draft) => ({ ...draft, profile: { ...draft.profile, biography: a.biography } }));
  assert.equal(store.isDirty("a"), false);
  assert.deepEqual(store.getSnapshot().drafts, {});
});

test("OWN-07: the store settles one save without touching the other draft, and reset clears all", () => {
  const store = createEmployeeDraftStore();
  store.setKnown(list);
  store.update(a, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "A1" } }));
  store.update(b, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "B1" } }));
  const sent = store.draftFor(a);
  store.settle(sent, { ...a, biography: "A1" });
  assert.deepEqual(store.dirtyIds(), ["b"]);
  assert.equal(store.getSnapshot().known.find((employee) => employee.id === "a")?.biography, "A1", "the saved copy is the new baseline");
  store.reset();
  assert.equal(store.hasDirty(), false);
});

test("OWN-07: a reloaded list drops drafts of people who are gone and drafts equal to the new stored values", () => {
  const store = createEmployeeDraftStore();
  store.setKnown(list);
  store.update(a, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "A1" } }));
  store.update(b, (draft) => ({ ...draft, profile: { ...draft.profile, biography: "B1" } }));
  store.setKnown([{ ...a, biography: "A1" }, manual]);
  assert.deepEqual(store.getSnapshot().drafts, {}, "A is saved elsewhere, B is gone");
  assert.equal(store.hasDirty(), false);
});
