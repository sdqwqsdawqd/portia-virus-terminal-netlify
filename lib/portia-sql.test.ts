import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isLocalMediaPath } from "./media-url.ts";

const apply = readFileSync(new URL("../supabase/phase12_apply.sql", import.meta.url), "utf8");

// Text of one "-- STEP <id>" section, up to the next "-- STEP " line.
function step(id: string) {
  const lines = apply.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^-- STEP ${id}\\b`).test(line));
  assert.ok(start >= 0, `STEP ${id} is missing`);
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => line.startsWith("-- STEP "));
  return lines.slice(start, next < 0 ? undefined : start + 1 + next).join("\n");
}

const withoutComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "").trim();
const collapse = (sql: string) => sql.replace(/\s+/g, " ").trim();

// The photo_url rule, written once; every occurrence in the file must equal it.
const PHOTO_REGEX = "'^/([^/\\\\[:cntrl:]][^[:cntrl:]]*)?$'";
const regexLiterals = (sql: string) => sql.match(/'\^\/[^']*'/g) ?? [];

const employeePolicies = [
  "Editors can create PORTIA employee profiles",
  "Editors can update PORTIA employee profiles",
  "Editors can add PORTIA manual employees",
  "Editors can remove PORTIA manual employees",
  "Editors can edit PORTIA manual employees",
];

function policyBlock(sql: string, name: string) {
  const start = sql.indexOf(`create policy "${name}"`);
  assert.ok(start >= 0, `policy "${name}" is missing`);
  return sql.slice(start, sql.indexOf(";", start));
}

test("STEP headers 0, 1, 2, 2b, 3, 4 appear in this order", () => {
  const headers = apply.split(/\r?\n/).filter((line) => line.startsWith("-- STEP ")).map((line) => line.split(/\s+/)[2]);
  assert.deepEqual(headers, ["0", "1", "2", "2b", "3", "4"]);
});

test("STEP 2 starts with the owner guard, ends with notify and commit", () => {
  const body = withoutComments(step("2"));
  assert.match(body, /^begin;\s*do \$\$/);
  const guard = body.slice(body.indexOf("do $$"), body.indexOf("$$;"));
  assert.match(guard, /raise exception/);
  assert.match(guard, /email_confirmed_at is not null/);
  assert.match(body, /notify pgrst, 'reload schema';\s*commit;$/);
});

test("validate constraint appears only in STEP 2b", () => {
  for (const id of ["0", "1", "2", "3", "4"]) assert.doesNotMatch(step(id), /validate constraint/i, `STEP ${id}`);
  assert.match(step("2b"), /validate constraint portia_employee_profiles_photo_url_local/);
  assert.doesNotMatch(apply.slice(0, apply.indexOf("-- STEP 0")), /validate constraint/i);
});

test("the photo_url regex literal is identical in STEP 1, 2 and 3", () => {
  for (const id of ["1", "2", "3"]) {
    const literals = regexLiterals(step(id));
    assert.ok(literals.length > 0, `STEP ${id} has no regex`);
    for (const literal of literals) assert.equal(literal, PHOTO_REGEX, `STEP ${id}`);
  }
});

test("the SQL photo_url regex agrees with isLocalMediaPath in lib/media-url.ts (CONT-09)", () => {
  // The only translation: POSIX [:cntrl:] is the ASCII controls U+0000-U+001F and U+007F.
  const js = new RegExp(PHOTO_REGEX.slice(1, -1).replaceAll("[:cntrl:]", "\\x00-\\x1f\\x7f"));
  const samples = ["", "/", "/a", "/a/b.png", "/%2F/x", "//x/a.png", "/\\x/a.png", "/\t/x", "/a\nb", "/a\u007fb", "/a\u0000b", "x.png", "https://x/y.png"];
  for (const sample of samples) assert.equal(js.test(sample), isLocalMediaPath(sample), JSON.stringify(sample));
});

test("STEP 2 employee write policies use portia_can_edit_tab('employees') and never portia_can_edit()", () => {
  const body = step("2");
  for (const name of employeePolicies) {
    const block = policyBlock(body, name);
    assert.match(block, /portia_can_edit_tab\('employees'\)/, name);
    assert.doesNotMatch(block, /portia_can_edit\(\)/, name);
  }
});

test("STEP 2 leaves the content table and storage alone (D-11)", () => {
  assert.doesNotMatch(step("2"), /portia_content|storage\.objects/);
});

test("STEP 4 is one transaction", () => {
  const body = withoutComments(step("4"));
  assert.match(body, /^begin;/);
  assert.match(body, /commit;$/);
});
