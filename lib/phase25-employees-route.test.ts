import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Offline contract of the source of GET /api/employees (Phase 25, plan 25-03, SEC-01/SEC-02, D-23). Live CDN headers, Cache-Status
// and the Postgres/RLS execution behind the signed function are BLOCKED and are NOT proved here.

const lf = (text: string) => text.replace(/\r\n/g, "\n");
const withoutComments = (text: string) => lf(text).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const source = withoutComments(readFileSync(new URL("../app/api/employees/route.ts", import.meta.url), "utf8"));
const start = source.indexOf("export async function GET");
const get = source.slice(start, source.indexOf("export async function PATCH"));

test("GET /api/employees: the gate decides the viewer before any read, a closed site without access is a 401", () => {
  assert.ok(start >= 0 && get.length > 0);
  for (const call of ["resolveGateFor(", "viewerOf(", "readEmployeeRows(", "loadEmployeesFromRows("]) assert.ok(get.includes(call), call);
  assert.ok(get.indexOf("resolveGateFor(") < get.indexOf("viewerOf("), "gate first, then the viewer");
  assert.ok(get.indexOf("viewerOf(") < get.indexOf("readEmployeeRows("), "T-25-11: the rows are read only after the viewer is known");
  assert.ok(get.indexOf("viewerOf(") < get.indexOf("loadEmployeesFromRows("), "T-25-11: Sheets and Roblox are reached only after the viewer is known");
  assert.match(get, /if \(!viewer\) return Response\.json\(contentAccessRequired, \{ status: 401, headers: noStoreHeaders \}\);/);
  assert.ok(get.indexOf("!viewer") < get.indexOf("readEmployeeRows("), "the refusal comes before the read");
});

test("GET /api/employees: every answer is no-store, no shared cache helper, no tag", () => {
  const responses = get.split("Response.json(").slice(1);
  assert.ok(responses.length >= 4, "401, success, gate failure and sync failure");
  for (const response of responses) assert.ok(response.slice(0, response.indexOf(";\n")).includes("noStoreHeaders"), response.slice(0, 80));
  assert.ok(!/publicCacheHeaders|Netlify-Cache-Tag|employeesCacheTag/.test(get), "T-25-12");
  assert.ok(!source.includes("publicCacheHeaders"), "the file no longer imports the public cache helper");
});

test("GET /api/employees: the tables are read by the signed function, never by the public client directly", () => {
  assert.ok(!get.includes('.from("portia_employee_profiles")'));
  assert.ok(!get.includes('.from("portia_manual_employees")'));
  assert.ok(!get.includes("loadEmployees("), "the old direct read through the public client is gone");
  assert.ok(get.includes("readEmployeeRows(viewer, { session: client, anonymous: () => createPublicSupabaseClient() })"));
});

test("GET /api/employees: a failed or refused signed read keeps the old degradation and logs the kind only", () => {
  assert.ok(get.includes('console.error("PORTIA employees read failed", error.kind);'));
  assert.ok(get.includes("let stored: EmployeeRows | null = null;"), "no stored rows until the signed read succeeds");
  assert.ok(get.includes("loadEmployeesFromRows(stored)"));
  assert.ok(get.indexOf("console.error(\"PORTIA employees read failed\"") < get.indexOf("loadEmployeesFromRows(stored)"));
  assert.ok(get.includes("Проверка доступа временно недоступна."));
  assert.ok(get.includes("{ status: 503, headers: noStoreHeaders }"));
  assert.ok(get.includes("{ status: 502, headers: noStoreHeaders }"));
});
