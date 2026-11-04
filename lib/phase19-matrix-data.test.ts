import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultPortiaContent } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";
import { matrixPayload, matrixRun, matrixRestore, matrixResidual } from "../scripts/phase19-matrix-data.mjs";

const target = { projectId: "aaaaaaaaaaaaaaaaaaaa", url: "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", adminKey: "fake-key" };
const clone = <T>(value: T): T => structuredClone(value);
const original = clone(defaultPortiaContent);

function fakeClient(initial: Record<string, unknown> | null = { id: "main", payload: original, revision: 7, updated_at: "2026-01-01T00:00:00Z", updated_by: "owner" }) {
  let row = initial ? clone(initial) : null;
  let writes = 0;
  const admin = {
    from(table: string) {
      assert.equal(table, "portia_content");
      const filters: [string, unknown][] = [];
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        async maybeSingle() { return { data: row && filters.every(([key, value]) => row?.[key] === value) ? clone(row) : null, error: null }; },
        async upsert(value: Record<string, unknown>) { writes++; row = clone(value); return { error: null }; },
        update(value: Record<string, unknown>) {
          return { eq(key: string, expected: unknown) { filters.push([key, expected]); return this; }, async select() {
            if (!row || !filters.every(([key, expected]) => row?.[key] === expected)) return { data: [], error: null };
            writes++; row = { ...row, ...clone(value) }; return { data: [clone(row)], error: null };
          } };
        },
        delete() { return { eq(key: string, expected: unknown) { filters.push([key, expected]); return this; }, async select() {
          if (!row || !filters.every(([key, expected]) => row?.[key] === expected)) return { data: [], error: null };
          writes++; row = null; return { data: [{ id: "main" }], error: null };
        } }; },
      };
      return query;
    },
  };
  return { admin, get row() { return row; }, set row(next) { row = next; }, get writes() { return writes; } };
}

function fixture(initial?: Record<string, unknown> | null) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "portia-matrix-test-"));
  const db = fakeClient(initial);
  const manifestFile = path.join(dir, "evidence", "19-MATRIX-DATA-RUN.json");
  const output: string[] = [];
  const calls: { file: string; args: string[]; options: Record<string, unknown> }[] = [];
  const deps = { admin: db.admin, manifestFile, tmpdir: dir, out: (s: string) => output.push(s),
    spawn: (file: string, args: string[], options: Record<string, unknown>) => {
      calls.push({ file, args, options });
      return { status: 0 };
    },
  };
  return { db, deps, output, calls, manifestFile, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("empty matrix payload keeps unrelated fields and normalizes to empty record lists", () => {
  const payload = normalizePortiaContent(matrixPayload("empty", original));
  assert.ok(payload);
  for (const key of ["viruses", "infoSections", "guideSections", "broadcasts", "recycleFiles", "recycledViruses"] as const) assert.equal(payload[key].length, 0, key);
  assert.deepEqual(payload.searchRecommendations, original.searchRecommendations);
});

test("populated matrix payload has guides, media, broadcasts and an extra Ё virus", () => {
  const payload = normalizePortiaContent(matrixPayload("populated", original));
  assert.ok(payload);
  assert.ok(payload.guideSections.length >= 2);
  for (const section of payload.guideSections) {
    assert.match(section.photo, /^\/assets\//);
    assert.ok(section.cards.length >= 2);
    for (const card of section.cards) assert.match(card.cover, /^\/assets\//);
  }
  assert.ok(payload.guideSections.some((section) => section.cards.some((card) => card.blocks.some((block) => block.type === "photo" && block.url.startsWith("/assets/")))));
  assert.ok(payload.broadcasts.some((item) => item.type === "news" && item.published && item.important));
  assert.ok(payload.broadcasts.some((item) => item.type === "quest" && item.published));
  assert.ok(payload.broadcasts.some((item) => !item.published));
  assert.equal(payload.viruses.length, original.viruses.length + 1);
  assert.ok(payload.viruses.some((item) => item.name.includes("Ё")));
  for (const virus of original.viruses) assert.ok(payload.viruses.some((item) => item.id === virus.id));
});

test("matrix-run writes a variant, invokes fixed specs, and restores exact snapshot", async () => {
  const fx = fixture();
  try {
    const before = clone(fx.db.row);
    assert.equal(await matrixRun(target, "populated", { stagingEmployees: false }, fx.deps), 0);
    assert.deepEqual(fx.db.row, before);
    assert.equal(fx.calls.length, 1);
    assert.equal(fx.calls[0].file, process.execPath);
    assert.equal(fx.calls[0].options.shell, false);
    assert.equal(fx.calls[0].args.filter((arg) => arg.endsWith(".spec.ts")).length, 5);
    const manifest = JSON.parse(readFileSync(fx.manifestFile, "utf8"));
    assert.equal(manifest.restoredAt !== null, true);
    assert.equal(manifest.snapshotRevision, 7);
    assert.ok(!JSON.stringify(manifest).includes("fake-key"));
    assert.equal(JSON.parse(fx.output.at(-1) ?? "{}").restored, true);
  } finally { fx.cleanup(); }
});

test("matrix-open-run refuses before any database write", async () => {
  const fx = fixture();
  try {
    await matrixRun(target, "empty", { stagingEmployees: false }, fx.deps);
    const manifest = JSON.parse(readFileSync(fx.manifestFile, "utf8"));
    writeFileSync(fx.manifestFile, JSON.stringify({ ...manifest, restoredAt: null }));
    await assert.rejects(() => matrixRun(target, "empty", { stagingEmployees: false }, fx.deps), /matrix-open-run/);
    assert.equal(fx.db.writes, 2);
  } finally { fx.cleanup(); }
});

test("matrix-content-moved leaves another writer's row and manifest open", async () => {
  const fx = fixture();
  try {
    fx.deps.spawn = () => { fx.db.row = { ...fx.db.row, payload: { ...original, searchRecommendations: ["other edit"] } }; return { status: 0 }; };
    await assert.rejects(() => matrixRun(target, "empty", { stagingEmployees: false }, fx.deps), /matrix-content-moved/);
    assert.deepEqual((fx.db.row?.payload as { searchRecommendations: string[] }).searchRecommendations, ["other edit"]);
    assert.equal(JSON.parse(readFileSync(fx.manifestFile, "utf8")).restoredAt, null);
  } finally { fx.cleanup(); }
});

test("matrix-residual reads only and matrix-restore closed run is idempotent", async () => {
  const fx = fixture();
  try {
    await matrixRun(target, "empty", { stagingEmployees: false }, fx.deps);
    const writes = fx.db.writes;
    assert.equal(await matrixResidual(target, fx.deps), 0);
    assert.equal(JSON.parse(fx.output.at(-1) ?? "{}").open, false);
    assert.equal(await matrixRestore(target, fx.deps), 0);
    assert.equal(fx.db.writes, writes);
  } finally { fx.cleanup(); }
});
