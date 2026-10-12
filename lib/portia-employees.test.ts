import test from "node:test";
import assert from "node:assert/strict";
import { employeeId, parseCsv, rosterFromRows, withProfile } from "./portia-employees.ts";

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
  const index = (byId: Map<string, { biography: string; photoUrl: string; knowledgeRating: number }>) => ({ byId, robloxIdByNickname: new Map<string, number>() });
  assert.equal(withProfile(employee, index(new Map([[employeeId("Serias227", null), { biography: "bio", photoUrl: "", knowledgeRating: 4 }]]))).biography, "bio");
  assert.equal(withProfile(employee, index(new Map())).knowledgeRating, 1);
});
