import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Offline calculation of the calls a visible tab makes to the Netlify functions (D-19, D-24). Only HTTP requests are counted:
// prices and credits of Netlify are not estimated ([ASSUMED] for any cost). The intervals are read from the sources, so a change
// of an interval fails here until 25-POLL-BUDGET.md is recalculated.

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const budget = readFileSync(new URL("../.planning/phases/PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische/25-POLL-BUDGET.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const hint = "пересчитать 25-POLL-BUDGET.md";

const MINUTE = 60_000;
const gate = source("components/portia-access-gate.tsx");
const desktop = source("components/portia-desktop.tsx");
const snapshot = source("lib/employees-snapshot-cache.ts");

function number(text: string, pattern: RegExp, label: string) {
  const match = pattern.exec(text);
  assert.ok(match, `${label}: the line was not found in the source; ${hint}`);
  // The captured text is digits, "_" and "*" only: a product such as "5 * 60 * 1000" or a literal such as "30_000".
  return match[1].split("*").map((factor) => Number(factor.replaceAll("_", "").trim())).reduce((product, factor) => product * factor, 1);
}

// Interval of the access status poll: the timer that runs only while the tab is visible.
const gateMs = number(gate, /document\.visibilityState === "visible"\) void refresh\(\); \}, (\d[\d_ *]*)\);/, "gate status poll");
const contentMs = number(desktop, /const contentSyncMs = (\d[\d_ *]*);/, "contentSyncMs");
const editorContentMs = number(desktop, /const editorContentSyncMs = (\d[\d_ *]*);/, "editorContentSyncMs");
const employeesMs = number(desktop, /window\.setInterval\(fetchEmployees, (\d[\d_ *]*)\)/, "employees poll");
const snapshotTtlMs = number(snapshot, /ttlMs: (\d[\d_ *]*), degradedTtlMs/, "snapshot ttl");
const snapshotDegradedMs = number(snapshot, /degradedTtlMs: (\d[\d_ *]*) \}\);/, "snapshot degraded ttl");

const perMinute = (ms: number) => MINUTE / ms;
const round1 = (value: number) => Math.round(value * 10) / 10;
const ru = (value: number) => String(value).replace(".", ",");

test("the poll intervals are the ones the budget was calculated for", () => {
  assert.equal(gateMs, 5000, `gate status poll changed; ${hint}`);
  assert.equal(contentMs, 30_000, `contentSyncMs changed; ${hint}`);
  assert.equal(editorContentMs, 10_000, `editorContentSyncMs changed; ${hint}`);
  assert.equal(employeesMs, 5 * 60 * 1000, `employees poll changed; ${hint}`);
  assert.equal(snapshotTtlMs, 5 * 60 * 1000, `snapshot ttl changed; ${hint}`);
  assert.equal(snapshotDegradedMs, 30 * 1000, `degraded snapshot ttl changed; ${hint}`);
});

test("calls per visible tab per minute and per hour: visitor 14,2 / 852, editor 18,2 / 1092", () => {
  const visitor = round1(perMinute(gateMs) + perMinute(contentMs) + perMinute(employeesMs));
  const editor = round1(perMinute(gateMs) + perMinute(editorContentMs) + perMinute(employeesMs));
  assert.equal(visitor, 14.2, hint);
  assert.equal(editor, 18.2, hint);
  assert.equal(Math.round(visitor * 60), 852, hint);
  assert.equal(Math.round(editor * 60), 1092, hint);
  assert.equal(perMinute(gateMs), 12);
  assert.equal(perMinute(contentMs), 2);
  assert.equal(perMinute(employeesMs), 0.2);
  for (const needle of [ru(visitor), ru(editor), String(Math.round(visitor * 60)), String(Math.round(editor * 60))]) {
    assert.ok(budget.includes(needle), `25-POLL-BUDGET.md does not contain ${needle}; ${hint}`);
  }
});

test("the budget names the sources, the formula for a day, the Supabase calls and the external snapshot", () => {
  for (const needle of [
    "components/portia-access-gate.tsx", "components/portia-desktop.tsx", "lib/employees-snapshot-cache.ts",
    "}, 5000);", "contentSyncMs = 30_000", "editorContentSyncMs = 10_000", "5 * 60 * 1000",
    "вызовов за сутки ≈ 852 × число вкладок × часов видимости",
    "статус — 1 или 2", "контент — 3",
    "внешние Sheets/Roblox — не чаще раза в 5 мин на экземпляр (30 с для неполного)",
    "интервал остаётся 30 с", "владелец явно не ответил — принят рекомендованный вариант, владелец может изменить",
    "[ASSUMED]",
  ]) assert.ok(budget.includes(needle), `25-POLL-BUDGET.md must contain: ${needle}`);
  assert.ok(!/\bPASS\b/.test(budget), "no PASS in the budget");
  assert.match(budget, /цены и кредиты Netlify не оцениваются/);
});
