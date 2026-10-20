import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptsRoster, addManualEmployee, employeeId, employeeRatings, mergeManualEmployees, parseCsv, profileChanged, profileFromRow, profileOf,
  readEmployeeProfiles, readManualEmployees, removeManualEmployee, rosterFromRows, sanitizeEmployeeUpdate, sanitizeManualDetails, sanitizeManualEmployee, updateManualEmployee,
  saveEmployeeProfile, saveEmployeePatch, loadEmployees, withProfile, type EmployeeProfile, type EmployeeUpdate, type PortiaEmployee, type RosterEmployee,
} from "./portia-employees.ts";

const noRatings = { pawsRating: null, bioRating: null, sRating: null, activityRating: null, testsRating: null, overallRating: null };
const header = '"Номер","Никнейм сотрудника","Позывной","Звание","Ранг"';

function sheet(rows: string[]) {
  return parseCsv([header, ...rows].join("\r\n"));
}

test("CSV cells keep commas, quotes and line breaks", () => {
  const rows = parseCsv('a,"b, c","say ""hi""","two\nlines"\r\nlast');
  assert.deepEqual(rows, [["a", "b, c", 'say "hi"', "two\nlines"], ["last"]]);
});

test("only the 34 staff slots are read, empty slots are skipped", () => {
  const staff = Array.from({ length: 34 }, (_, index) => `"${index + 1}","user${index + 1}","","",""`);
  staff[4] = '"5","","","N/A","N/A"';
  const rows = sheet([...staff, '"","","Сотрудников:","16",""', '"x","notes_row","","",""']);
  const roster = rosterFromRows(rows, new Map());
  assert.equal(roster.length, 33);
  assert.ok(!roster.some((employee) => employee.nickname === "notes_row"));
});

test("the Roblox id keeps an employee's id stable across nickname changes", () => {
  const before = rosterFromRows(sheet(['"1","OldName","Fox","",""']), new Map([["oldname", { id: 42, name: "OldName", avatarUrl: "", fullAvatarUrl: "" }]]));
  const after = rosterFromRows(sheet(['"1","NewName","Fox","",""']), new Map([["newname", { id: 42, name: "NewName", avatarUrl: "", fullAvatarUrl: "" }]]));
  assert.equal(before[0].id, "roblox-42");
  assert.equal(after[0].id, before[0].id);
});

test("a temporary Roblox outage keeps the id saved with the profile", () => {
  const during = rosterFromRows(sheet(['"1","Akemi_Fox36","","",""']), new Map(), new Map([["akemi_fox36", 7]]));
  assert.equal(during[0].id, "roblox-7");
});

test("profiles saved before the Roblox id was known are still found", () => {
  const [employee] = rosterFromRows(sheet(['"1","Serias227","","",""']), new Map([["serias227", { id: 9, name: "Serias227", avatarUrl: "", fullAvatarUrl: "" }]]));
  const index = (byId: Map<string, EmployeeProfile>) => ({ byId, robloxIdByNickname: new Map<string, number>() });
  assert.equal(withProfile(employee, index(new Map([[employeeId("Serias227", null), { ...noRatings, biography: "bio", photoUrl: "", knowledgeRating: 4 }]]))).biography, "bio");
  assert.equal(withProfile(employee, index(new Map())).knowledgeRating, 1);
});

const someone: PortiaEmployee = { id: "a", nickname: "a", callsign: "", title: "", rank: "", knowledgeRating: 0, ...noRatings, biography: "", photoUrl: "", robloxUserId: null, robloxAvatarUrl: "", robloxFullAvatarUrl: "", order: 1, source: "sheet" };

test("a complete non-empty roster is accepted", () => {
  assert.equal(acceptsRoster({ employees: [someone], degraded: false }), true);
});

test("a degraded non-empty roster is accepted: only avatars or profiles are missing", () => {
  assert.equal(acceptsRoster({ employees: [someone], degraded: true }), true);
});

test("a complete empty roster is accepted: the sheet has no staff rows", () => {
  assert.equal(acceptsRoster({ employees: [], degraded: false }), true);
});

test("a degraded empty roster is ignored: the 502 shape or a partial sync", () => {
  assert.equal(acceptsRoster({ employees: [], degraded: true }), false);
});

test("an empty roster without a degraded flag is not trusted", () => {
  assert.equal(acceptsRoster({ employees: [] }), false);
});

test("a missing or non-array employees field is ignored", () => {
  assert.equal(acceptsRoster({ employees: "x" }), false);
  assert.equal(acceptsRoster({}), false);
});

// In-memory stand-in for the profile table; `migrated` toggles the rating columns, `upsertError` fails every write.
type Row = Record<string, unknown>;
const tableDefaults: Row = { biography: "", photo_url: "", knowledge_rating: 1, nickname: "" };
function fakeTable(migrated: boolean, seed: Row[] = [], upsertError?: { code: string }, readError?: { code: string }) {
  const rows = new Map<string, Row>(seed.map((row) => [String(row.employee_id), row]));
  const upserts: Row[] = [];
  const ratingColumn = (name: string) => /^(paws|bio|s|activity|overall)_rating$/.test(name);
  const client = {
    from: () => ({
      select: (columns: string) => ({
        returns: async () => {
          if (readError) return { data: null, error: readError };
          if (!migrated && columns.split(",").some((column) => ratingColumn(column.trim()))) return { data: null, error: { code: "42703" } };
          return { data: [...rows.values()].map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => migrated || !ratingColumn(key)))), error: null };
        },
        eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: rows.get(id) ?? null, error: null }) }),
      }),
      // Like PostgREST: the stored row is answered after the write, and a first insert takes the column defaults.
      upsert: (row: Row) => ({
        select: () => ({
          single: async () => {
            if (upsertError) return { data: null, error: upsertError };
            if (!migrated && Object.keys(row).some(ratingColumn)) return { data: null, error: { code: "PGRST204" } };
            upserts.push(row);
            const stored = { ...(rows.get(String(row.employee_id)) ?? tableDefaults), ...row };
            rows.set(String(row.employee_id), stored);
            return { data: stored, error: null };
          },
        }),
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, upserts, rows };
}

const target: RosterEmployee = { id: "roblox-1", nickname: "Fox", callsign: "", title: "", rank: "", robloxUserId: 1, robloxAvatarUrl: "", robloxFullAvatarUrl: "", order: 0, source: "sheet" };
const fullRatings = { knowledgeRating: 6, pawsRating: 5, bioRating: 4, sRating: 3, activityRating: 2, testsRating: 7, overallRating: 9 };
const foxTarget = { id: target.id, nickname: target.nickname };

async function roundTrip(migrated: boolean) {
  const table = fakeTable(migrated);
  const changes = sanitizeEmployeeUpdate({ biography: "bio", photoUrl: "https://x/y.png", ...fullRatings });
  assert.ok(changes);
  const saved = await saveEmployeeProfile(table.client, foxTarget, changes, "user-1");
  const profile = withProfile(target, await readEmployeeProfiles(table.client));
  return { table, saved, profile };
}

test("before the migration a save keeps biography and photo, and new ratings stay empty", async () => {
  const { table, saved, profile } = await roundTrip(false);
  assert.equal(saved.ratingsSaved, false);
  assert.equal(table.upserts.length, 1);
  // knowledge_rating is never written from a request: the column default stays.
  assert.deepEqual([profile.biography, profile.photoUrl, profile.knowledgeRating], ["bio", "https://x/y.png", 1]);
  assert.deepEqual([profile.pawsRating, profile.bioRating, profile.sRating, profile.activityRating, profile.overallRating], [null, null, null, null, null]);
});

test("after the migration one upsert stores all six ratings and they read back", async () => {
  const { table, saved, profile } = await roundTrip(true);
  assert.equal(saved.ratingsSaved, true);
  assert.equal(table.upserts.length, 1);
  assert.deepEqual({ p: profile.pawsRating, t: profile.testsRating, b: profile.bioRating, s: profile.sRating, a: profile.activityRating, o: profile.overallRating }, { p: 5, t: 7, b: 4, s: 3, a: 2, o: 9 });
  assert.deepEqual(saved.profile, profileOf(profile));
});

test("an upsert error that is not a missing column is thrown", async () => {
  const client = fakeTable(true, [], { code: "42501" }).client;
  await assert.rejects(saveEmployeeProfile(client, foxTarget, sanitizeEmployeeUpdate({ ...fullRatings })!, "user-1"), { code: "42501" });
});

test("a rating key missing from the update is left out of the row; null and empty clear it", async () => {
  const table = fakeTable(true, [{ employee_id: "roblox-1", nickname: "Fox", biography: "", photo_url: "", knowledge_rating: 1, paws_rating: 8, bio_rating: 8 }]);
  const changes = sanitizeEmployeeUpdate({ biography: "x", bioRating: null, sRating: "" });
  assert.ok(changes && !("pawsRating" in changes) && changes.bioRating === null && changes.sRating === null);
  await saveEmployeeProfile(table.client, foxTarget, changes, "user-1");
  assert.ok(!("paws_rating" in table.upserts[0]));
  const stored = withProfile(target, await readEmployeeProfiles(table.client));
  assert.deepEqual([stored.pawsRating, stored.bioRating], [8, null]);
});

test("new ratings are clamped to 1-10 or empty, and nothing is defaulted", () => {
  const read = (value: unknown) => sanitizeEmployeeUpdate({ pawsRating: value })?.pawsRating;
  assert.equal(read(11), 10);
  assert.equal(read(0), 1);
  assert.equal(read("7"), 7);
  assert.equal(read(6.6), 7);
  assert.equal(read(null), null);
  assert.equal(read(""), null);
  assert.deepEqual(sanitizeEmployeeUpdate({}), {});
});

test("sanitizeEmployeeUpdate keeps only the keys that were sent and never reads knowledgeRating", () => {
  assert.deepEqual(sanitizeEmployeeUpdate({ pawsRating: 3 }), { pawsRating: 3 });
  assert.deepEqual(sanitizeEmployeeUpdate({ knowledgeRating: 9, evil: 1 }), {});
  assert.deepEqual(sanitizeEmployeeUpdate({ biography: "", photoUrl: "" }), { biography: "", photoUrl: "" });
});

test("wrong types in changes are refused", () => {
  const bad = [null, [], "x", 5, { biography: 5 }, { photoUrl: 7 }, { photoUrl: "ftp://x" }, { pawsRating: true }, { pawsRating: "abc" }, { pawsRating: {} }, { pawsRating: [] }];
  for (const value of bad) assert.equal(sanitizeEmployeeUpdate(value), null, JSON.stringify(value));
});

const storedFox = { employee_id: "roblox-1", nickname: "Fox", biography: "bio", photo_url: "https://x/p.png", knowledge_rating: 1, paws_rating: 8, bio_rating: 6 };

test("one-field save writes only that column", async () => {
  const table = fakeTable(true, [storedFox]);
  const saved = await saveEmployeeProfile(table.client, { id: "roblox-1" }, sanitizeEmployeeUpdate({ pawsRating: 3 })!, "user-1");
  assert.deepEqual(Object.keys(table.upserts[0]).sort(), ["employee_id", "paws_rating", "updated_at", "updated_by"]);
  assert.equal(table.upserts[0].updated_by, "user-1");
  assert.deepEqual([saved.ratingsSaved, saved.profile.pawsRating, saved.profile.bioRating, saved.profile.biography, saved.profile.photoUrl], [true, 3, 6, "bio", "https://x/p.png"]);
});

test("the old whole-profile request is still accepted and never writes knowledge_rating", async () => {
  const table = fakeTable(true);
  const changes = sanitizeEmployeeUpdate({ biography: "b", photoUrl: "/p.png", ...fullRatings });
  await saveEmployeeProfile(table.client, foxTarget, changes!, "user-1");
  assert.ok(!("knowledge_rating" in table.upserts[0]));
  assert.deepEqual(Object.keys(table.upserts[0]).sort(), ["activity_rating", "bio_rating", "biography", "employee_id", "nickname", "overall_rating", "paws_rating", "photo_url", "s_rating", "tests_rating", "updated_at", "updated_by"]);
});

// Both tables behind one client, as the route sees them.
function fakeDb(profiles: ReturnType<typeof fakeTable>, manual: ReturnType<typeof manualTable>) {
  const from = (name: string) => (name === "portia_manual_employees" ? manual.client.from(name) : profiles.client.from(name));
  return { client: { from } as unknown as SupabaseClient, profiles, manual };
}
const noNetwork = (t: TestContext) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    throw new Error("no network on a known save");
  });
  return calls;
};

test("a known employee is saved with zero network calls", async (t) => {
  const calls = noNetwork(t);
  const profileOnly = fakeDb(fakeTable(true, [storedFox]), manualTable());
  const first = await saveEmployeePatch(profileOnly.client, "user-1", { id: "roblox-1", nickname: "", changes: { bioRating: 5 }, details: {} });
  assert.equal(first.status, "saved");
  const manualOnly = fakeDb(fakeTable(true), manualTable({ rows: [manualRow(50, "Gamma_x")] }));
  const second = await saveEmployeePatch(manualOnly.client, "user-1", { id: "roblox-50", nickname: "", changes: { bioRating: 5 }, details: {} });
  assert.equal(second.status, "saved");
  assert.equal(manualOnly.profiles.upserts[0].nickname, "Gamma_x");
  assert.deepEqual(calls, []);
});

test("the saved answer is the stored profile with its id, and no Roblox fields", async (t) => {
  noNetwork(t);
  const db = fakeDb(fakeTable(true, [storedFox]), manualTable());
  const result = await saveEmployeePatch(db.client, "user-1", { id: "roblox-1", nickname: "Fox", changes: { pawsRating: 3 }, details: {} });
  assert.equal(result.status, "saved");
  if (result.status !== "saved") return;
  assert.deepEqual(result.employee, { id: "roblox-1", biography: "bio", photoUrl: "https://x/p.png", knowledgeRating: 1, pawsRating: 3, bioRating: 6, sRating: null, activityRating: null, testsRating: null, overallRating: null });
  assert.ok(!("robloxAvatarUrl" in result.employee));
  assert.equal(result.ratingsPending, undefined);
  const manual = fakeDb(fakeTable(true), manualTable({ rows: [manualRow(50, "Gamma_x")] }));
  const answer = await saveEmployeePatch(manual.client, "user-1", { id: "roblox-50", nickname: "", changes: {}, details: {} });
  assert.ok(answer.status === "saved" && answer.employee.title === "Лаборант" && answer.employee.rank === "2" && answer.employee.callsign === "Лис");
});

test("before the rating migration the patch answer says the ratings are pending", async (t) => {
  noNetwork(t);
  const db = fakeDb(fakeTable(false, [storedFox]), manualTable());
  const result = await saveEmployeePatch(db.client, "user-1", { id: "roblox-1", nickname: "", changes: { pawsRating: 3, biography: "new" }, details: {} });
  assert.ok(result.status === "saved" && result.ratingsPending === true && result.employee.biography === "new");
});

test("an unknown id is not found in this build of the save path", async (t) => {
  noNetwork(t);
  const db = fakeDb(fakeTable(true), manualTable());
  assert.deepEqual(await saveEmployeePatch(db.client, "user-1", { id: "roblox-404", nickname: "", changes: { pawsRating: 3 }, details: {} }), { status: "not-found" });
  assert.equal(db.profiles.upserts.length, 0);
});

// Google Sheet stand-in: every URL is recorded; Roblox answers an empty list so a stray call shows up in `calls`, not as a crash.
function stubSheet(t: TestContext, answer: string[] | "down" | "throws") {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("roblox.com")) return Response.json({ data: [] });
    if (answer === "throws") throw new Error("offline");
    if (answer === "down") return new Response("", { status: 500 });
    return new Response([header, ...answer].join("\r\n"));
  });
  return calls;
}
const newcomer = (id: string, nickname: string, changes: EmployeeUpdate = { bioRating: 4 }) => ({ id, nickname, changes, details: {} });

test("sheet-only check: a never-saved newcomer is saved after one sheet call and no Roblox call", async (t) => {
  const calls = stubSheet(t, ['"1","Fox","","",""']);
  const db = fakeDb(fakeTable(true), manualTable());
  const result = await saveEmployeePatch(db.client, "user-1", newcomer("roblox-5", "fox"));
  assert.equal(result.status, "saved");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("docs.google.com"));
  assert.ok(!calls.some((url) => url.includes("roblox.com")));
  assert.deepEqual([db.profiles.upserts[0].employee_id, db.profiles.upserts[0].nickname], ["roblox-5", "Fox"]);
});

test("an id of the nickname form is accepted for a newcomer", async (t) => {
  stubSheet(t, ['"1","Fox","","",""']);
  const db = fakeDb(fakeTable(true), manualTable());
  assert.equal((await saveEmployeePatch(db.client, "user-1", newcomer(employeeId("Fox", null), "Fox"))).status, "saved");
});

test("sheet-unavailable, never not-found: a sheet that does not answer writes nothing", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const answer of ["down", "throws"] as const) {
    const calls = stubSheet(t, answer);
    const db = fakeDb(fakeTable(true), manualTable());
    assert.deepEqual(await saveEmployeePatch(db.client, "user-1", newcomer("roblox-5", "Fox")), { status: "sheet-unavailable" });
    assert.equal(db.profiles.upserts.length, 0);
    assert.ok(!calls.some((url) => url.includes("roblox.com")));
    t.mock.restoreAll();
    t.mock.method(console, "error", () => {});
  }
});

test("not found and nothing is written: no nickname, a stranger, or an id of the wrong form", async (t) => {
  const calls = stubSheet(t, ['"1","Fox","","",""']);
  const db = fakeDb(fakeTable(true), manualTable());
  assert.deepEqual(await saveEmployeePatch(db.client, "user-1", newcomer("roblox-5", "")), { status: "not-found" });
  assert.equal(calls.length, 0);
  assert.deepEqual(await saveEmployeePatch(db.client, "user-1", newcomer("roblox-5", "Nobody")), { status: "not-found" });
  assert.deepEqual(await saveEmployeePatch(db.client, "user-1", newcomer("evil-1", "Fox")), { status: "not-found" });
  assert.deepEqual(await saveEmployeePatch(db.client, "user-1", newcomer("nick-someone-else", "Fox")), { status: "not-found" });
  assert.equal(db.profiles.upserts.length, 0);
});

test("a legacy nick- profile seeds the first row of a newcomer", async (t) => {
  stubSheet(t, ['"1","Fox","","",""']);
  const legacy = { employee_id: "nick-fox", nickname: "Fox", biography: "old", photo_url: "https://x/p.png", knowledge_rating: 3, paws_rating: 8 };
  const db = fakeDb(fakeTable(true, [legacy]), manualTable());
  const result = await saveEmployeePatch(db.client, "user-1", newcomer("roblox-5", "Fox"));
  assert.ok(result.status === "saved");
  assert.deepEqual(
    [result.employee.biography, result.employee.photoUrl, result.employee.pawsRating, result.employee.bioRating],
    ["old", "https://x/p.png", 8, 4],
  );
  assert.ok(!("knowledge_rating" in db.profiles.upserts[0]));
});

test("profiles-unavailable: a newcomer is not written when the stored profiles cannot be read", async (t) => {
  t.mock.method(console, "error", () => {});
  stubSheet(t, ['"1","Fox","","",""']);
  const db = fakeDb(fakeTable(true, [], undefined, { code: "42501" }), manualTable());
  assert.deepEqual(await saveEmployeePatch(db.client, "user-1", newcomer("roblox-5", "Fox")), { status: "profiles-unavailable" });
  assert.equal(db.profiles.upserts.length, 0);
});

test("loadEmployees still reads the sheet, profiles and manual rows, and throws on a non-OK sheet", async (t) => {
  stubSheet(t, ['"1","Fox","Лис","Доктор","2"']);
  const db = fakeDb(fakeTable(true, [{ employee_id: "nick-fox", nickname: "Fox", biography: "old", photo_url: "", knowledge_rating: 1 }]), manualTable({ rows: [manualRow(50, "Gamma_x")] }));
  const loaded = await loadEmployees(db.client);
  assert.deepEqual(loaded.employees.map((employee) => [employee.nickname, employee.source]), [["Fox", "sheet"], ["Gamma_x", "manual"]]);
  assert.equal(loaded.employees[0].biography, "old");
  t.mock.restoreAll();
  stubSheet(t, "down");
  await assert.rejects(loadEmployees(db.client), /Google Sheets returned 500/);
});

test("stored rows without rating columns, or with junk, map to empty ratings", () => {
  const base = { biography: "b", photo_url: "", knowledge_rating: 3 };
  assert.equal(profileFromRow(base).pawsRating, null);
  assert.equal(profileFromRow({ ...base, paws_rating: "x", bio_rating: 15, s_rating: 7 }).pawsRating, null);
  assert.equal(profileFromRow({ ...base, bio_rating: 15 }).bioRating, null);
  assert.equal(profileFromRow({ ...base, s_rating: 7 }).sRating, 7);
});

test("the rating labels live in one ordered table", () => {
  assert.deepEqual(employeeRatings.map((rating) => rating.label), ["Знания лаборатории", "Знания тестов", "Умение делать БИО", "Умение делать СС", "Актив", "Общая"]);
});

test("profileChanged: identical profiles are clean, a missing new rating equals null", () => {
  const saved: EmployeeProfile = { biography: "bio", photoUrl: "", knowledgeRating: 5, ...noRatings };
  assert.equal(profileChanged(saved, { ...saved }), false);
  const legacy = { ...saved } as Partial<EmployeeProfile>;
  delete legacy.pawsRating;
  assert.equal(profileChanged(legacy as EmployeeProfile, saved), false);
});

test("profileChanged: biography, photo and each rating are changes, whitespace counts", () => {
  const saved: EmployeeProfile = { biography: "bio", photoUrl: "", knowledgeRating: 5, ...noRatings };
  assert.equal(profileChanged(saved, { ...saved, biography: "bio " }), true);
  assert.equal(profileChanged(saved, { ...saved, photoUrl: "x" }), true);
  for (const { key } of employeeRatings) assert.equal(profileChanged(saved, { ...saved, [key]: 7 }), true, key);
});

test("every sheet employee is marked source sheet", () => {
  assert.deepEqual(rosterFromRows(sheet(['"1","A_one","","",""', '"2","B_two","","",""']), new Map()).map((employee) => employee.source), ["sheet", "sheet"]);
});

const manualRow = (id: number, nickname: string) => ({ employee_id: `roblox-${id}`, nickname, title: "Лаборант", rank: "2", callsign: "Лис" });

test("manual employees follow the sheet staff, marked manual, with avatars by nickname", () => {
  const roster = rosterFromRows(sheet(['"1","Alpha","","",""', '"2","Beta","","",""']), new Map());
  const merged = mergeManualEmployees(roster, [manualRow(50, "Gamma_x"), manualRow(51, "Delta_y")], new Map([["gamma_x", { id: 50, name: "Gamma_x", avatarUrl: "a", fullAvatarUrl: "f" }]]));
  assert.deepEqual(merged.map((employee) => [employee.nickname, employee.source, employee.order]), [["Alpha", "sheet", 0], ["Beta", "sheet", 1], ["Gamma_x", "manual", 2], ["Delta_y", "manual", 3]]);
  assert.deepEqual([merged[2].id, merged[2].robloxUserId, merged[2].robloxAvatarUrl, merged[2].robloxFullAvatarUrl, merged[2].title, merged[2].rank, merged[2].callsign], ["roblox-50", 50, "a", "f", "Лаборант", "2", "Лис"]);
  assert.deepEqual([merged[3].robloxAvatarUrl, merged[3].robloxFullAvatarUrl], ["", ""]);
});

test("a manual row for an account already in the sheet is dropped: the sheet wins on id and on nickname", () => {
  const roster = rosterFromRows(sheet(['"1","Alpha","","",""', '"2","Beta","","",""']), new Map([["alpha", { id: 7, name: "Alpha", avatarUrl: "", fullAvatarUrl: "" }]]));
  const merged = mergeManualEmployees(roster, [manualRow(7, "Renamed"), manualRow(99, "BETA"), manualRow(100, "Fresh")], new Map());
  assert.deepEqual(merged.map((employee) => employee.nickname), ["Alpha", "Beta", "Fresh"]);
  assert.equal(merged[2].order, 2);
});

test("an old manual row shows the Roblox spelling when Roblox answered and the stored one otherwise", () => {
  const roster = rosterFromRows(sheet(['"1","Alpha","","",""']), new Map());
  const answered = new Map([["gamma_x", { id: 50, name: "Gamma_X", avatarUrl: "a", fullAvatarUrl: "f" }]]);
  assert.equal(mergeManualEmployees(roster, [manualRow(50, "gamma_x")], answered)[1].nickname, "Gamma_X");
  assert.equal(mergeManualEmployees(roster, [manualRow(50, "gamma_x")], new Map())[1].nickname, "gamma_x");
});

// In-memory stand-in for the manual table: a read, an insert and a filtered delete, each with a configurable error.
type ManualTableOptions = { rows?: Record<string, unknown>[]; readError?: { code: string }; insertError?: { code: string }; deleteError?: { code: string }; updateError?: { code: string }; failUpdatesFrom?: number; updateMatchesNoRow?: boolean; updateRemovesRow?: boolean };
// A real database answers a copy, so a later update must not rewrite what an earlier read returned.
const copyOf = (row: Record<string, unknown> | undefined) => (row ? { ...row } : null);
function manualTable(options: ManualTableOptions = {}) {
  const inserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const updates: { id: string; values: Record<string, unknown> }[] = [];
  const rows = (options.rows ?? []).map((row) => ({ ...row }));
  const client = {
    from: (table: string) => {
      assert.equal(table, "portia_manual_employees");
      return {
        select: () => ({
          order: () => ({ returns: async () => (options.readError ? { data: null, error: options.readError } : { data: rows, error: null }) }),
          eq: (_column: string, id: string) => ({ maybeSingle: async () => (options.readError ? { data: null, error: options.readError } : { data: copyOf(rows.find((row) => row.employee_id === id)), error: null }) }),
        }),
        insert: async (row: Record<string, unknown>) => {
          if (options.insertError) return { error: options.insertError };
          inserts.push(row);
          return { error: null };
        },
        delete: () => ({
          eq: (column: string, id: string) => ({
            select: async () => {
              assert.equal(column, "employee_id");
              deletes.push(id);
              if (options.deleteError) return { data: null, error: options.deleteError };
              return { data: rows.filter((row) => row.employee_id === id).map((row) => ({ employee_id: row.employee_id })), error: null };
            },
          }),
        }),
        update: (values: Record<string, unknown>) => ({
          eq: (column: string, id: string) => ({
            select: async () => {
              assert.equal(column, "employee_id");
              updates.push({ id, values });
              if (options.updateError) return { data: null, error: options.updateError };
              if (options.failUpdatesFrom && updates.length >= options.failUpdatesFrom) return { data: null, error: { code: "XX000" } };
              // The row stays readable (RLS hides it from the update) or vanishes (deleted by someone else in between).
              if (options.updateRemovesRow) rows.splice(0, rows.length);
              if (options.updateMatchesNoRow || options.updateRemovesRow) return { data: [], error: null };
              const matched = rows.filter((row) => row.employee_id === id);
              matched.forEach((row) => Object.assign(row, values));
              return { data: matched.map((row) => ({ employee_id: row.employee_id })), error: null };
            },
          }),
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, inserts, deletes, updates };
}

test("the manual read keeps the stored columns; a missing table is an empty, healthy list", async () => {
  const stored = manualRow(5, "Echo_five");
  assert.deepEqual(await readManualEmployees(manualTable({ rows: [stored] }).client), { rows: [stored], ok: true });
  for (const code of ["PGRST205", "42P01"]) assert.deepEqual(await readManualEmployees(manualTable({ readError: { code } }).client), { rows: [], ok: true });
});

test("any other manual read error is an empty list that marks the roster incomplete", async (t) => {
  t.mock.method(console, "error", () => {});
  assert.deepEqual(await readManualEmployees(manualTable({ readError: { code: "42501" } }).client), { rows: [], ok: false });
});

test("sanitizeManualEmployee trims, cuts to 64 and refuses a body without a nickname", () => {
  assert.deepEqual(sanitizeManualEmployee({ nickname: "  Fox_1 ", title: " Ст. ", rank: 5, callsign: "x".repeat(80) }), { nickname: "Fox_1", title: "Ст.", rank: "", callsign: "x".repeat(64) });
  for (const bad of [null, "Fox", 7, {}, { nickname: 5 }, { nickname: "   " }]) assert.equal(sanitizeManualEmployee(bad), null);
});

// Roblox stand-in: `users` is the answer to the username lookup, or "down" (HTTP 500) / "throws" for the unavailable cases.
type RobloxUser = { id: number; name: string; requestedUsername: string };
function stubRoblox(t: TestContext, users: "down" | "throws" | RobloxUser[]) {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(String(url));
    if (String(url).includes("users.roblox.com")) {
      if (users === "throws") throw new Error("offline");
      if (users === "down") return new Response("", { status: 500 });
      return Response.json({ data: users });
    }
    return Response.json({ data: (Array.isArray(users) ? users : []).map((user) => ({ targetId: user.id, imageUrl: `https://img/${user.id}` })) });
  });
  return calls;
}

const input = { nickname: "Newbie_9", title: "Лаборант", rank: "1", callsign: "Нова" };
const existing = rosterFromRows(sheet(['"1","Alpha","","",""']), new Map([["alpha", { id: 7, name: "Alpha", avatarUrl: "", fullAvatarUrl: "" }]]));

test("an invalid nickname is not found without asking Roblox", async (t) => {
  const calls = stubRoblox(t, []);
  for (const nickname of ["ab", "a".repeat(21), "has space", "кириллица", "x-y"]) {
    assert.deepEqual(await addManualEmployee(manualTable().client, { ...input, nickname }, existing, "u1"), { status: "not-found" });
  }
  assert.equal(calls.length, 0);
});

test("a nickname Roblox does not know is not found", async (t) => {
  const table = manualTable();
  stubRoblox(t, []);
  assert.deepEqual(await addManualEmployee(table.client, input, existing, "u1"), { status: "not-found" });
  assert.equal(table.inserts.length, 0);
});

test("an unreachable Roblox is never reported as an unknown nickname", async (t) => {
  t.mock.method(console, "error", () => {});
  const table = manualTable();
  const fetchMock = stubRoblox(t, "down");
  assert.deepEqual(await addManualEmployee(table.client, input, existing, "u1"), { status: "roblox-unavailable" });
  assert.equal(fetchMock.length, 1);
  t.mock.restoreAll();
  t.mock.method(console, "error", () => {});
  stubRoblox(t, "throws");
  assert.deepEqual(await addManualEmployee(table.client, input, existing, "u1"), { status: "roblox-unavailable" });
  assert.equal(table.inserts.length, 0);
});

test("a person already in the roster is a duplicate and nothing is inserted", async (t) => {
  const table = manualTable();
  stubRoblox(t, [{ id: 7, name: "Renamed", requestedUsername: "Renamed" }]);
  assert.deepEqual(await addManualEmployee(table.client, { ...input, nickname: "Renamed" }, existing, "u1"), { status: "duplicate" });
  t.mock.restoreAll();
  stubRoblox(t, [{ id: 8, name: "ALPHA", requestedUsername: "ALPHA" }]);
  assert.deepEqual(await addManualEmployee(table.client, { ...input, nickname: "ALPHA" }, existing, "u1"), { status: "duplicate" });
  assert.equal(table.inserts.length, 0);
});

test("insert errors: a taken key is a duplicate, a missing table is pending, anything else is thrown", async (t) => {
  stubRoblox(t, [{ id: 9, name: "Newbie_9", requestedUsername: "Newbie_9" }]);
  assert.deepEqual(await addManualEmployee(manualTable({ insertError: { code: "23505" } }).client, input, existing, "u1"), { status: "duplicate" });
  for (const code of ["PGRST205", "42P01"]) assert.deepEqual(await addManualEmployee(manualTable({ insertError: { code } }).client, input, existing, "u1"), { status: "pending-database" });
  await assert.rejects(addManualEmployee(manualTable({ insertError: { code: "42501" } }).client, input, existing, "u1"), { code: "42501" });
});

test("a found newcomer is inserted as exactly one row and returned as a manual employee after the roster", async (t) => {
  const table = manualTable();
  stubRoblox(t, [{ id: 9, name: "Newbie_9", requestedUsername: "Newbie_9" }]);
  const result = await addManualEmployee(table.client, input, existing, "user-1");
  assert.deepEqual(table.inserts, [{ employee_id: "roblox-9", nickname: "Newbie_9", title: "Лаборант", rank: "1", callsign: "Нова", created_by: "user-1" }]);
  assert.equal(result.status, "added");
  if (result.status !== "added") return;
  assert.deepEqual(
    [result.employee.id, result.employee.source, result.employee.order, result.employee.robloxUserId, result.employee.robloxAvatarUrl, result.employee.robloxFullAvatarUrl],
    ["roblox-9", "manual", 1, 9, "https://img/9", "https://img/9"],
  );
});

test("a manual employee is stored and returned in Roblox spelling, whatever case was typed", async (t) => {
  const table = manualTable();
  stubRoblox(t, [{ id: 9, name: "Newbie_9", requestedUsername: "newbie_9" }]);
  const result = await addManualEmployee(table.client, { ...input, nickname: "newbie_9" }, existing, "user-1");
  assert.equal(table.inserts.length, 1);
  assert.equal(table.inserts[0].nickname, "Newbie_9");
  assert.equal(result.status, "added");
  if (result.status !== "added") return;
  assert.deepEqual([result.employee.nickname, result.employee.id], ["Newbie_9", "roblox-9"]);
});

const mixedRoster = mergeManualEmployees(existing, [manualRow(50, "Gamma_x")], new Map());

test("removing a sheet employee is refused and never issues a delete", async () => {
  const table = manualTable({ rows: [manualRow(7, "Alpha")] });
  assert.deepEqual(await removeManualEmployee(table.client, mixedRoster, "roblox-7"), { status: "sheet" });
  assert.equal(table.deletes.length, 0);
});

test("removing an id that is not in the roster is not found and issues no delete", async () => {
  const table = manualTable();
  assert.deepEqual(await removeManualEmployee(table.client, mixedRoster, "roblox-404"), { status: "not-found" });
  assert.equal(table.deletes.length, 0);
});

test("removing a manual employee deletes exactly its manual row; a row that was already gone is not found", async () => {
  const table = manualTable({ rows: [manualRow(50, "Gamma_x")] });
  assert.deepEqual(await removeManualEmployee(table.client, mixedRoster, "roblox-50"), { status: "deleted" });
  assert.deepEqual(table.deletes, ["roblox-50"]);
  assert.deepEqual(await removeManualEmployee(manualTable().client, mixedRoster, "roblox-50"), { status: "not-found" });
});

const newDetails = { title: "Доктор", rank: "3", callsign: "Гамма" };

test("updateManualEmployee writes exactly the given columns of its row", async () => {
  const table = manualTable({ rows: [manualRow(50, "Gamma_x")] });
  assert.deepEqual(await updateManualEmployee(table.client, "roblox-50", newDetails), { status: "updated" });
  assert.deepEqual(await updateManualEmployee(table.client, "roblox-50", { rank: "4" }), { status: "updated" });
  assert.deepEqual(table.updates, [{ id: "roblox-50", values: newDetails }, { id: "roblox-50", values: { rank: "4" } }]);
});

test("before the update grant and policy exist the details are pending, not an error", async () => {
  for (const code of ["42501", "PGRST205", "42P01"]) {
    assert.deepEqual(await updateManualEmployee(manualTable({ rows: [manualRow(50, "Gamma_x")], updateError: { code } }).client, "roblox-50", newDetails), { status: "pending-database" });
  }
  // Without the update policy RLS matches no row, but the row is still there.
  assert.deepEqual(await updateManualEmployee(manualTable({ rows: [manualRow(50, "Gamma_x")], updateMatchesNoRow: true }).client, "roblox-50", newDetails), { status: "pending-database" });
});

test("a manual row that is gone is not found, any other update error is thrown", async () => {
  assert.deepEqual(await updateManualEmployee(manualTable().client, "roblox-50", newDetails), { status: "not-found" });
  await assert.rejects(updateManualEmployee(manualTable({ rows: [manualRow(50, "Gamma_x")], updateError: { code: "XX000" } }).client, "roblox-50", newDetails), { code: "XX000" });
});

test("details keep absent fields: only the sent keys are trimmed, cut to 64 and kept", () => {
  assert.deepEqual(sanitizeManualDetails({ rank: " 9 " }), { rank: "9" });
  assert.deepEqual(sanitizeManualDetails({}), {});
  assert.deepEqual(sanitizeManualDetails({ title: "" }), { title: "" });
  assert.deepEqual(sanitizeManualDetails({ callsign: "x".repeat(80), evil: 1 }), { callsign: "x".repeat(64) });
  for (const bad of [null, [], "x", { title: 5 }, { rank: null }]) assert.equal(sanitizeManualDetails(bad), null, JSON.stringify(bad));
});

// A manual employee Gamma_x (title Лаборант, rank 2, callsign Лис) saved through the real save path.
function manualPatch(options: ManualTableOptions, profileError?: { code: string }) {
  const log: string[] = [];
  const profiles = fakeTable(true, [], profileError);
  const manual = manualTable({ rows: [manualRow(50, "Gamma_x")], ...options });
  const from = (name: string) => {
    log.push(name);
    return name === "portia_manual_employees" ? manual.client.from(name) : profiles.client.from(name);
  };
  const client = { from } as unknown as SupabaseClient;
  const save = (details: Partial<typeof newDetails>, changes: EmployeeUpdate = { bioRating: 5 }) => saveEmployeePatch(client, "user-1", { id: "roblox-50", nickname: "", changes, details });
  return { save, profiles, manual, log };
}

test("manual details are written before the profile, one update with only the sent keys", async () => {
  const run = manualPatch({});
  const result = await run.save({ rank: "9" });
  assert.deepEqual(run.manual.updates, [{ id: "roblox-50", values: { rank: "9" } }]);
  assert.ok(result.status === "saved" && result.detailsPending === undefined);
  if (result.status !== "saved") return;
  assert.deepEqual([result.employee.title, result.employee.rank, result.employee.callsign, result.employee.bioRating], ["Лаборант", "9", "Лис", 5]);
  // findKnownEmployee reads both tables first, then the details update, then the profile upsert.
  assert.deepEqual(run.log.slice(2), ["portia_manual_employees", "portia_employee_profiles"]);
});

test("a failed profile write restores the previous details of only the changed keys", async () => {
  const run = manualPatch({}, { code: "42501" });
  await assert.rejects(run.save({ rank: "9", title: "Доктор" }), { code: "42501" });
  assert.deepEqual(run.manual.updates.map((update) => update.values), [{ rank: "9", title: "Доктор" }, { rank: "2", title: "Лаборант" }]);
});

test("a failed restore is logged and the profile error is still the one thrown", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const run = manualPatch({ failUpdatesFrom: 2 }, { code: "42501" });
  await assert.rejects(run.save({ rank: "9" }), { code: "42501" });
  assert.equal(run.manual.updates.length, 2);
  assert.equal(log.mock.calls[0].arguments[0], "PORTIA manual details restore failed");
});

test("details-failed: a details write that throws writes nothing else", async (t) => {
  t.mock.method(console, "error", () => {});
  const run = manualPatch({ updateError: { code: "XX000" } });
  assert.deepEqual(await run.save({ rank: "9" }), { status: "details-failed" });
  assert.equal(run.profiles.upserts.length, 0);
});

test("a manual row that is gone is not found and the profile is not written", async () => {
  const run = manualPatch({ updateRemovesRow: true });
  assert.deepEqual(await run.save({ rank: "9" }), { status: "not-found" });
  assert.equal(run.profiles.upserts.length, 0);
});

test("details the database cannot take yet are pending while the profile is saved", async () => {
  for (const options of [{ updateMatchesNoRow: true }, { updateError: { code: "42501" } }]) {
    const run = manualPatch(options);
    const result = await run.save({ rank: "9" });
    assert.ok(result.status === "saved" && result.detailsPending === true && result.employee.rank === "2" && result.employee.bioRating === 5);
    assert.equal(run.profiles.upserts.length, 1);
  }
  // Nothing was changed, so a later profile failure has nothing to restore.
  const failing = manualPatch({ updateError: { code: "42501" } }, { code: "42501" });
  await assert.rejects(failing.save({ rank: "9" }), { code: "42501" });
  assert.equal(failing.manual.updates.length, 1);
});

test("empty details, and details for a sheet employee, issue no manual update", async () => {
  const run = manualPatch({});
  assert.equal((await run.save({})).status, "saved");
  assert.equal(run.manual.updates.length, 0);
  const sheetEmployee = fakeDb(fakeTable(true, [storedFox]), manualTable());
  const result = await saveEmployeePatch(sheetEmployee.client, "user-1", { id: "roblox-1", nickname: "", changes: {}, details: newDetails });
  assert.ok(result.status === "saved" && !("title" in result.employee));
  assert.equal(sheetEmployee.manual.updates.length, 0);
});

test("a delete error is thrown", async () => {
  await assert.rejects(removeManualEmployee(manualTable({ rows: [manualRow(50, "Gamma_x")], deleteError: { code: "42501" } }).client, mixedRoster, "roblox-50"), { code: "42501" });
});
