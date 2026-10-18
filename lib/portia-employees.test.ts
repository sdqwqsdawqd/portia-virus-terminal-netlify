import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptsRoster, addManualEmployee, employeeId, employeeRatings, mergeManualEmployees, parseCsv, profileChanged, profileFromRow,
  readEmployeeProfiles, readManualEmployees, rosterFromRows, sanitizeEmployeeUpdate, sanitizeManualEmployee,
  saveEmployeeProfile, withProfile, type EmployeeProfile, type PortiaEmployee, type RosterEmployee,
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
  const before = rosterFromRows(sheet(['"1","OldName","Fox","",""']), new Map([["oldname", { id: 42, avatarUrl: "", fullAvatarUrl: "" }]]));
  const after = rosterFromRows(sheet(['"1","NewName","Fox","",""']), new Map([["newname", { id: 42, avatarUrl: "", fullAvatarUrl: "" }]]));
  assert.equal(before[0].id, "roblox-42");
  assert.equal(after[0].id, before[0].id);
});

test("a temporary Roblox outage keeps the id saved with the profile", () => {
  const during = rosterFromRows(sheet(['"1","Akemi_Fox36","","",""']), new Map(), new Map([["akemi_fox36", 7]]));
  assert.equal(during[0].id, "roblox-7");
});

test("profiles saved before the Roblox id was known are still found", () => {
  const [employee] = rosterFromRows(sheet(['"1","Serias227","","",""']), new Map([["serias227", { id: 9, avatarUrl: "", fullAvatarUrl: "" }]]));
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

// In-memory stand-in for the one table call shape the module uses; `migrated` toggles the rating columns.
type Row = Record<string, unknown>;
function fakeTable(migrated: boolean, seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((row) => [String(row.employee_id), row]));
  const upserts: Row[] = [];
  const ratingColumn = (name: string) => /^(paws|bio|s|activity|overall)_rating$/.test(name);
  const client = {
    from: () => ({
      select: (columns: string) => ({
        returns: async () => {
          if (!migrated && columns.split(",").some((column) => ratingColumn(column.trim()))) return { data: null, error: { code: "42703" } };
          return { data: [...rows.values()].map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => migrated || !ratingColumn(key)))), error: null };
        },
      }),
      upsert: async (row: Row) => {
        if (!migrated && Object.keys(row).some(ratingColumn)) return { error: { code: "PGRST204" } };
        upserts.push(row);
        rows.set(String(row.employee_id), { ...rows.get(String(row.employee_id)), ...row });
        return { error: null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, upserts, rows };
}

const target: RosterEmployee = { id: "roblox-1", nickname: "Fox", callsign: "", title: "", rank: "", robloxUserId: 1, robloxAvatarUrl: "", robloxFullAvatarUrl: "", order: 0, source: "sheet" };
const fullRatings = { knowledgeRating: 6, pawsRating: 5, bioRating: 4, sRating: 3, activityRating: 2, testsRating: 7, overallRating: 9 };

async function roundTrip(migrated: boolean) {
  const table = fakeTable(migrated);
  const changes = sanitizeEmployeeUpdate({ biography: "bio", photoUrl: "https://x/y.png", ...fullRatings });
  assert.ok(changes);
  const saved = await saveEmployeeProfile(table.client, target, changes, "user-1");
  const profile = withProfile(target, await readEmployeeProfiles(table.client));
  return { table, saved, profile };
}

test("before the migration a save keeps biography, photo and knowledge, and new ratings stay empty", async () => {
  const { table, saved, profile } = await roundTrip(false);
  assert.equal(saved.ratingsSaved, false);
  assert.equal(table.upserts.length, 1);
  assert.deepEqual([profile.biography, profile.photoUrl, profile.knowledgeRating], ["bio", "https://x/y.png", 6]);
  assert.deepEqual([profile.pawsRating, profile.bioRating, profile.sRating, profile.activityRating, profile.overallRating], [null, null, null, null, null]);
});

test("after the migration one upsert stores all six ratings and they read back", async () => {
  const { table, saved, profile } = await roundTrip(true);
  assert.equal(saved.ratingsSaved, true);
  assert.equal(table.upserts.length, 1);
  assert.deepEqual({ k: profile.knowledgeRating, p: profile.pawsRating, b: profile.bioRating, s: profile.sRating, a: profile.activityRating, o: profile.overallRating }, { k: 6, p: 5, b: 4, s: 3, a: 2, o: 9 });
});

test("an upsert error that is not a missing column is thrown", async () => {
  const client = { from: () => ({ upsert: async () => ({ error: { code: "42501" } }) }) } as unknown as SupabaseClient;
  const changes = sanitizeEmployeeUpdate({ ...fullRatings });
  await assert.rejects(saveEmployeeProfile(client, target, changes!, "user-1"), { code: "42501" });
});

test("a rating key missing from the update is left out of the row; null and empty clear it", async () => {
  const table = fakeTable(true, [{ employee_id: "roblox-1", nickname: "Fox", biography: "", photo_url: "", knowledge_rating: 1, paws_rating: 8, bio_rating: 8 }]);
  const changes = sanitizeEmployeeUpdate({ biography: "x", knowledgeRating: 2, bioRating: null, sRating: "" });
  assert.ok(changes && !("pawsRating" in changes) && changes.bioRating === null && changes.sRating === null);
  await saveEmployeeProfile(table.client, target, changes, "user-1");
  assert.ok(!("paws_rating" in table.upserts[0]));
  const stored = withProfile(target, await readEmployeeProfiles(table.client));
  assert.deepEqual([stored.pawsRating, stored.bioRating], [8, null]);
});

test("new ratings are clamped to 1-10 or empty, knowledge defaults to 1", () => {
  const read = (value: unknown) => sanitizeEmployeeUpdate({ pawsRating: value })?.pawsRating;
  assert.equal(read(11), 10);
  assert.equal(read(0), 1);
  assert.equal(read("7"), 7);
  assert.equal(read(6.6), 7);
  assert.equal(read(null), null);
  assert.equal(read(""), null);
  assert.equal(sanitizeEmployeeUpdate({})?.knowledgeRating, 1);
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
  const merged = mergeManualEmployees(roster, [manualRow(50, "Gamma_x"), manualRow(51, "Delta_y")], new Map([["gamma_x", { id: 50, avatarUrl: "a", fullAvatarUrl: "f" }]]));
  assert.deepEqual(merged.map((employee) => [employee.nickname, employee.source, employee.order]), [["Alpha", "sheet", 0], ["Beta", "sheet", 1], ["Gamma_x", "manual", 2], ["Delta_y", "manual", 3]]);
  assert.deepEqual([merged[2].id, merged[2].robloxUserId, merged[2].robloxAvatarUrl, merged[2].robloxFullAvatarUrl, merged[2].title, merged[2].rank, merged[2].callsign], ["roblox-50", 50, "a", "f", "Лаборант", "2", "Лис"]);
  assert.deepEqual([merged[3].robloxAvatarUrl, merged[3].robloxFullAvatarUrl], ["", ""]);
});

test("a manual row for an account already in the sheet is dropped: the sheet wins on id and on nickname", () => {
  const roster = rosterFromRows(sheet(['"1","Alpha","","",""', '"2","Beta","","",""']), new Map([["alpha", { id: 7, avatarUrl: "", fullAvatarUrl: "" }]]));
  const merged = mergeManualEmployees(roster, [manualRow(7, "Renamed"), manualRow(99, "BETA"), manualRow(100, "Fresh")], new Map());
  assert.deepEqual(merged.map((employee) => employee.nickname), ["Alpha", "Beta", "Fresh"]);
  assert.equal(merged[2].order, 2);
});

// In-memory stand-in for the manual table: a read, an insert and a filtered delete, each with a configurable error.
type ManualTableOptions = { rows?: Record<string, unknown>[]; readError?: { code: string }; insertError?: { code: string } };
function manualTable(options: ManualTableOptions = {}) {
  const inserts: Record<string, unknown>[] = [];
  const rows = options.rows ?? [];
  const client = {
    from: (table: string) => {
      assert.equal(table, "portia_manual_employees");
      return {
        select: () => ({ order: () => ({ returns: async () => (options.readError ? { data: null, error: options.readError } : { data: rows, error: null }) }) }),
        insert: async (row: Record<string, unknown>) => {
          if (options.insertError) return { error: options.insertError };
          inserts.push(row);
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, inserts };
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
const existing = rosterFromRows(sheet(['"1","Alpha","","",""']), new Map([["alpha", { id: 7, avatarUrl: "", fullAvatarUrl: "" }]]));

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
