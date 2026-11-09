import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ACCESS_LEVELS,
  ACCESS_ORIGINS,
  EDITOR_ACCESS_LEVEL,
  MAX_ACCESS_LEVEL,
  MIN_ACCESS_LEVEL,
  accessLevelLabel,
  accessOriginLabel,
  defaultApprovalLevel,
  effectiveAccessLevel,
  isAccessLevel,
} from "./access-levels.ts";

// LVL-01 / D-03 / D-04: one module names the levels and decides who is level 5. The SQL side is pinned as text.

const sql = readFileSync(new URL("../supabase/migrations/20261109000000_portia_access_foundation.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function functionBody(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const bodyStart = sql.indexOf("as $$", start) + 5;
  return sql.slice(bodyStart, sql.indexOf("$$;", bodyStart));
}

test("D-03 levels are the integers 1..5 labelled Уровень 1 … Уровень 5", () => {
  assert.deepEqual([...ACCESS_LEVELS], [1, 2, 3, 4, 5]);
  assert.equal(MIN_ACCESS_LEVEL, 1);
  assert.equal(MAX_ACCESS_LEVEL, 5);
  assert.deepEqual(ACCESS_LEVELS.map((level) => accessLevelLabel(level)), ["Уровень 1", "Уровень 2", "Уровень 3", "Уровень 4", "Уровень 5"]);
});

test("isAccessLevel accepts integers 1..5 only", () => {
  for (const level of [1, 2, 3, 4, 5]) assert.equal(isAccessLevel(level), true, String(level));
  for (const value of [0, 6, 2.5, "2", Number.NaN, null, undefined, -1, Infinity]) assert.equal(isAccessLevel(value), false, String(value));
});

test("D-04 approval defaults: sheet gives level 2, outside gives level 1, with origin labels", () => {
  assert.deepEqual([...ACCESS_ORIGINS], ["sheet", "outside"]);
  assert.equal(defaultApprovalLevel("sheet"), 2);
  assert.equal(defaultApprovalLevel("outside"), 1);
  assert.equal(accessOriginLabel("sheet"), "из таблицы");
  assert.equal(accessOriginLabel("outside"), "не из таблицы");
});

test("LVL-01 editors and the owner resolve to level 5 whatever person row exists", () => {
  assert.equal(EDITOR_ACCESS_LEVEL, 5);
  assert.equal(effectiveAccessLevel({ isEditor: true, isOwner: false, person: null }), 5);
  assert.equal(effectiveAccessLevel({ isEditor: false, isOwner: true, person: { status: "active", level: 1 } }), 5);
  assert.equal(effectiveAccessLevel({ isEditor: true, isOwner: false, person: { status: "revoked", level: 1 } }), 5);
});

test("a visitor gets the level of an active person only, anything odd fails closed", () => {
  assert.equal(effectiveAccessLevel({ isEditor: false, isOwner: false, person: { status: "active", level: 3 } }), 3);
  assert.equal(effectiveAccessLevel({ isEditor: false, isOwner: false, person: { status: "revoked", level: 3 } }), null);
  assert.equal(effectiveAccessLevel({ isEditor: false, isOwner: false, person: { status: "active", level: 9 } }), null);
  assert.equal(effectiveAccessLevel({ isEditor: false, isOwner: false, person: { status: "active", level: 0 } }), null);
  assert.equal(effectiveAccessLevel({ isEditor: false, isOwner: false, person: null }), null);
});

test("SQL parity: level bounds are 1..5 on the people table", () => {
  assert.ok(sql.includes(`check (level between ${MIN_ACCESS_LEVEL} and ${MAX_ACCESS_LEVEL})`), "people level check differs from MIN/MAX");
  assert.ok(functionBody("portia_access_decide").includes(`new_level not between ${MIN_ACCESS_LEVEL} and ${MAX_ACCESS_LEVEL}`));
});

test("SQL parity: decide default maps sheet and outside exactly as defaultApprovalLevel does", () => {
  const body = functionBody("portia_access_decide");
  const match = body.match(/case when req\.origin = '(\w+)' then (\d) else (\d) end/);
  assert.ok(match, "default level case not found in portia_access_decide");
  assert.equal(match[1], "sheet");
  assert.equal(Number(match[2]), defaultApprovalLevel("sheet"));
  assert.equal(Number(match[3]), defaultApprovalLevel("outside"));
});

test("LVL-01 SQL parity: caller_level is 5 from portia_can_edit() and reads no person row", () => {
  const body = functionBody("portia_access_caller_level");
  assert.ok(body.includes("public.portia_can_edit()"));
  assert.ok(body.includes(`${EDITOR_ACCESS_LEVEL}::smallint`));
  assert.ok(!body.includes("portia_access_people"), "caller_level must not read a person row");
});
