import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { legacyClassificationNames } from "./portia-content.ts";
import { checkRewritten, countOldValues, legacyFixturePayload, runStep } from "../scripts/phase20-class-migration-staging.mjs";

// D-36(b): the SQL rewrite of stored class names. Offline text checks only: no database is available here, so
// the behaviour of the statement on real rows is proven on the isolated staging project (20-21 Task 3), not by this file.

const file = "20261104000000_portia_rename_virus_classes.sql";
const raw = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sql = raw.replace(/^\s*--.*$/gm, "");
const lower = sql.toLowerCase();

test("D-36 every old/new class pair of legacyClassificationNames is in the migration", () => {
  const pairs = Object.entries(legacyClassificationNames);
  assert.equal(pairs.length, 9);
  for (const [oldName, newName] of pairs) {
    assert.ok(sql.includes(`('${oldName}', '${newName}')`), `pair ${oldName} -> ${newName} is missing from the migration`);
  }
});

test("D-36 the migration touches only the two virus arrays and the three renamed axes", () => {
  for (const word of ["'viruses'", "'recycledViruses'", "'mind'", "'behavior'", "'appearance'"]) assert.ok(sql.includes(word), `${word} is missing`);
  for (const word of ["danger", "spread", "transmission", "escapeRisk", "infoSections"]) assert.ok(!sql.includes(word), `${word} must not appear in the migration`);
});

test("D-36 one table, revision bump, update only where the payload changes, object payloads only", () => {
  const tables = [...lower.matchAll(/\b(?:public|auth|storage)\.[a-z_]+/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(tables)], ["public.portia_content"]);
  assert.ok(lower.includes("is distinct from"));
  assert.ok(lower.includes("revision + 1"));
  assert.ok(lower.includes("updated_at = now()"));
  assert.ok(!/updated_by/.test(lower), "updated_by must stay untouched");
  assert.ok(lower.includes("jsonb_typeof(c.payload) = 'object'"));
  assert.equal([...lower.matchAll(/\bupdate\b/g)].length, 1, "exactly one UPDATE statement");
});

test("D-36 data-only: no transaction wrapper and no DDL, grants, policies, functions or deletes", () => {
  assert.ok(!/^(begin|commit);$/m.test(sql));
  for (const word of ["create", "alter", "drop", "grant", "revoke", "policy", "function", "truncate", "delete", "insert", "trigger", "security definer", "pg_temp"]) {
    assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(sql), `forbidden keyword in the migration: ${word}`);
  }
});

test("D-36 the staging fixture carries all nine old names and checkRewritten tells right from wrong", () => {
  const before = legacyFixturePayload("unit-run");
  const text = JSON.stringify(before);
  for (const oldName of Object.keys(legacyClassificationNames)) assert.ok(text.includes(oldName), `fixture lacks ${oldName}`);
  assert.equal(countOldValues(before), 9, "nine old values on the renamed axes (the old name on danger and in free text does not count)");

  // The correctly rewritten copy: the nine names on the three axes, nothing else.
  const good = JSON.parse(text);
  const swap = (v: { classification?: unknown } | undefined) => {
    for (const axis of ["mind", "behavior", "appearance"]) {
      const cl = v?.classification as Record<string, string> | undefined;
      if (typeof cl === "object" && cl !== null && Object.hasOwn(legacyClassificationNames, cl[axis])) cl[axis] = legacyClassificationNames[cl[axis]];
    }
  };
  good.viruses.forEach(swap);
  good.recycledViruses.forEach(swap);
  assert.deepEqual(checkRewritten(before, good), { ok: true, problems: [] });
  assert.equal(countOldValues(good), 0);

  const leftover = JSON.parse(JSON.stringify(good));
  leftover.viruses[0].classification.mind = "Рубедо";
  const leftoverResult = checkRewritten(before, leftover);
  assert.equal(leftoverResult.ok, false);
  assert.ok(leftoverResult.problems.some((p: string) => p.includes("viruses[0].classification.mind")));

  const foreign = JSON.parse(JSON.stringify(good));
  foreign.infoSections[0].body = "changed";
  assert.equal(checkRewritten(before, foreign).ok, false);

  const overreach = JSON.parse(JSON.stringify(good));
  overreach.viruses[0].classification.danger = "Люцидиум";
  assert.equal(checkRewritten(before, overreach).ok, false, "renaming a non-renamed axis must be caught");

  assert.equal(checkRewritten(before, before).ok, false, "an unchanged copy is not a rewritten one");
});

test("D-36 staging steps report counters only and cleanup leaves residual 0 (stub client)", async () => {
  const rows = new Map<string, { payload: unknown; revision: number }>();
  rows.set("main", { payload: { viruses: [{ classification: { mind: "Рубедо" } }] }, revision: 7 });
  const admin = {
    from: () => {
      let filter: { kind: string; value: string } | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chainable stub of the supabase query builder
      const query: any = {
        select: () => query,
        eq: (_c: string, value: string) => { filter = { kind: "eq", value }; return query; },
        like: (_c: string, value: string) => { filter = { kind: "like", value }; return query; },
        maybeSingle: async () => ({ data: rows.get(filter!.value) ?? null, error: null }),
        insert: async (row: { id: string; payload: unknown; revision: number }) => { rows.set(row.id, row); return { error: null }; },
        delete: () => { query.deleting = true; return query; },
        then: (resolve: (v: unknown) => void) => {
          if (query.deleting) { rows.delete(filter!.value); query.deleting = false; return resolve({ error: null }); }
          const prefix = filter!.value.replace("%", "");
          return resolve({ data: [...rows.keys()].filter((id) => id.startsWith(prefix)).map((id) => ({ id })), error: null });
        },
      };
      return query;
    },
  };
  const seed = await runStep("seed", "unit-run", admin);
  assert.deepEqual({ ok: seed.ok, mainRevision: seed.mainRevision, mainOldValues: seed.mainOldValues }, { ok: true, mainRevision: 7, mainOldValues: 1 });
  await assert.rejects(runStep("seed", "unit-run", admin), /fixture-already-present/);
  const verifyBefore = await runStep("verify", "unit-run", admin);
  assert.equal(verifyBefore.ok, false, "verify fails when the migration has not rewritten the fixture");
  assert.ok(!JSON.stringify(seed).includes("Рубедо"), "receipts carry no payload");
  const cleanup = await runStep("cleanup", "unit-run", admin);
  assert.deepEqual(cleanup, { runId: "unit-run", step: "cleanup", ok: true, residual: 0 });
});
