import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptsRoster, employeeId, employeeRatings, parseCsv, profileChanged, profileFromRow, readEmployeeProfiles, rosterFromRows,
  sanitizeEmployeeUpdate, saveEmployeeProfile, withProfile, type EmployeeProfile, type PortiaEmployee,
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

const someone: PortiaEmployee = { id: "a", nickname: "a", callsign: "", title: "", rank: "", knowledgeRating: 0, ...noRatings, biography: "", photoUrl: "", robloxUserId: null, robloxAvatarUrl: "", robloxFullAvatarUrl: "", order: 1 };

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

const target = { id: "roblox-1", nickname: "Fox", callsign: "", title: "", rank: "", robloxUserId: 1, robloxAvatarUrl: "", robloxFullAvatarUrl: "", order: 0 };
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
  assert.deepEqual(employeeRatings.map((rating) => rating.label), ["Знания", "Знания лаборатории", "Знания тестов", "Умение делать БИО", "Умение делать СС", "Актив", "Общая"]);
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
