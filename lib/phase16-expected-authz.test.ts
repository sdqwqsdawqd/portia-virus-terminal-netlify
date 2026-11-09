import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { NICKNAME_PATTERN } from "./nickname.ts";

// Offline completeness of the role x surface matrix against the effective schema of ALL migrations (plan 16-08, T-16-23/24;
// widened in 21-04 / T-21-22). The migrations are replayed in version order, statement by statement, so a function or table
// that a later migration adds, re-grants or drops is judged by its final state. Expectations come from the SQL text only;
// nothing here talks to Supabase.

const migrationsDir = "supabase/migrations";
const baselineFile = "20261101000000_portia_baseline.sql";
const baselinePath = `${migrationsDir}/${baselineFile}`;
const migrationFiles = readdirSync(new URL(`../${migrationsDir}/`, import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationTexts = new Map(
  migrationFiles.map((name) => [name, readFileSync(new URL(`../${migrationsDir}/${name}`, import.meta.url), "utf8").replace(/\r\n/gu, "\n")] as const),
);
const sql = migrationTexts.get(baselineFile) ?? "";
const matrix = JSON.parse(readFileSync(new URL("../tests/e2e/fixtures/data/expected-authz.json", import.meta.url), "utf8"));

const inertUuid = "00000000-0000-4000-8000-000000000000";
const outcomePattern = /^(allow|42501|forbidden|owner-required|rls-empty|rls-deny|accepted:D-11|accepted:SEC-M1|http-\d{3}|[0-9A-Z]{5})$/u;
const sourcePattern = /^supabase\/migrations\/(\d{14}_portia_[a-z0-9_]+\.sql):(\d+)$/u;
const tableOps = ["select", "insert", "update", "delete"];

const identityOf = (args: string) =>
  args
    .split(",")
    .map((arg) => arg.trim())
    .filter(Boolean)
    .map((arg) => arg.replace(/\s+default\s[\s\S]*$/iu, "").replace(/\s+/gu, " "))
    .join(", ");

// Argument types only: a create statement names its parameters, grant/revoke/drop statements do not.
const typesOf = (args: string, named: boolean) =>
  identityOf(args)
    .split(", ")
    .filter(Boolean)
    .map((arg) => (named ? arg.split(" ").slice(1).join(" ") : arg))
    .join(", ");

const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;
const splitRoles = (list: string) => list.split(",").map((role) => role.trim()).filter(Boolean);
const expandPrivileges = (privileges: string) =>
  privileges
    .replace(/\([^)]*\)/gu, "")
    .split(",")
    .map((priv) => priv.trim().toLowerCase())
    .flatMap((priv) => (priv === "all" ? ["select", "insert", "update", "delete", "all"] : [priv]));

type FunctionState = { name: string; key: string; roles: Set<string>; setBy: string };
type TableState = { createdIn: string; privileges: Map<string, Set<string>>; columnLevelUpdate: string[] | null; setBy: string };
type Event = { at: number; apply: () => void };

// Effective state after all migrations: functions by name(types), tables by name. setBy is the file:line of the
// statement that last changed the object (used in failure messages).
const effectiveFunctions = new Map<string, FunctionState>();
const effectiveTables = new Map<string, TableState>();
const orphans: string[] = [];

for (const file of migrationFiles) {
  const text = migrationTexts.get(file) ?? "";
  const events: Event[] = [];
  const here = (index: number) => `${file}:${lineAt(text, index)}`;

  for (const match of text.matchAll(/^create or replace function public\.(portia_\w+)\(([^)]*)\)/gmu)) {
    const sig = `${match[1]}(${typesOf(match[2], true)})`;
    events.push({
      at: match.index,
      apply: () => {
        const present = effectiveFunctions.get(sig);
        effectiveFunctions.set(sig, {
          name: match[1],
          key: `public.${match[1]}(${identityOf(match[2])})`,
          roles: present?.roles ?? new Set<string>(),
          setBy: here(match.index),
        });
      },
    });
  }
  for (const match of text.matchAll(/^drop function if exists public\.(portia_\w+)\(([^)]*)\)\s*;/gmu)) {
    events.push({ at: match.index, apply: () => void effectiveFunctions.delete(`${match[1]}(${typesOf(match[2], false)})`) });
  }
  for (const match of text.matchAll(/^grant execute on function public\.(portia_\w+)\(([^)]*)\) to ([^;]+);/gmu)) {
    events.push({
      at: match.index,
      apply: () => {
        const state = effectiveFunctions.get(`${match[1]}(${typesOf(match[2], false)})`);
        if (!state) return void orphans.push(here(match.index));
        for (const role of splitRoles(match[3])) state.roles.add(role);
        state.setBy = here(match.index);
      },
    });
  }
  for (const match of text.matchAll(/^revoke (?:all|execute) on function public\.(portia_\w+)\(([^)]*)\) from ([^;]+);/gmu)) {
    events.push({
      at: match.index,
      apply: () => {
        const state = effectiveFunctions.get(`${match[1]}(${typesOf(match[2], false)})`);
        if (!state) return void orphans.push(here(match.index));
        for (const role of splitRoles(match[3])) state.roles.delete(role);
        state.setBy = here(match.index);
      },
    });
  }
  for (const match of text.matchAll(/^create table if not exists public\.(portia_\w+)/gmu)) {
    events.push({
      at: match.index,
      apply: () => {
        if (!effectiveTables.has(match[1])) {
          effectiveTables.set(match[1], { createdIn: file, privileges: new Map(), columnLevelUpdate: null, setBy: here(match.index) });
        }
      },
    });
  }
  for (const match of text.matchAll(/^drop table if exists public\.(portia_\w+)\s*;/gmu)) {
    events.push({ at: match.index, apply: () => void effectiveTables.delete(match[1]) });
  }
  for (const match of text.matchAll(/^grant (.+?) on table public\.(portia_\w+) to ([^;]+);/gmu)) {
    events.push({
      at: match.index,
      apply: () => {
        const state = effectiveTables.get(match[2]);
        if (!state) return void orphans.push(here(match.index));
        const columns = match[1].match(/\(([^)]*)\)/u);
        if (columns) state.columnLevelUpdate = columns[1].split(",").map((column) => column.trim());
        for (const priv of expandPrivileges(match[1])) {
          const granted = state.privileges.get(priv) ?? new Set<string>();
          for (const role of splitRoles(match[3])) granted.add(role);
          state.privileges.set(priv, granted);
        }
        state.setBy = here(match.index);
      },
    });
  }
  for (const match of text.matchAll(/^revoke (.+?) on table public\.(portia_\w+) from ([^;]+);/gmu)) {
    events.push({
      at: match.index,
      apply: () => {
        const state = effectiveTables.get(match[2]);
        if (!state) return void orphans.push(here(match.index));
        const roles = splitRoles(match[3]);
        for (const priv of expandPrivileges(match[1])) for (const role of roles) state.privileges.get(priv)?.delete(role);
        if (/\ball\b/iu.test(match[1]) && roles.includes("authenticated")) state.columnLevelUpdate = null;
        state.setBy = here(match.index);
      },
    });
  }
  for (const event of events.sort((a, b) => a.at - b.at)) event.apply();
}

const effectiveFunctionKeys = [...effectiveFunctions.values()].map((state) => state.key);
const effectiveTableNames = [...effectiveTables.keys()];
const functionByKey = new Map([...effectiveFunctions.values()].map((state) => [state.key, state] as const));

function diffSets(actual: readonly string[], expected: readonly string[]) {
  const have = new Set(actual);
  const want = new Set(expected);
  return { missing: expected.filter((item) => !have.has(item)), extra: actual.filter((item) => !want.has(item)) };
}

function tableGrants(table: string) {
  const state = effectiveTables.get(table);
  return { grants: state?.privileges ?? new Map<string, Set<string>>(), columnLevelUpdate: state?.columnLevelUpdate ?? null };
}

// The line a cell points at, read from the migration file named in its source.
function sourceLine(source: string | undefined) {
  const match = sourcePattern.exec(source ?? "");
  if (!match) return null;
  return { file: match[1], line: Number(match[2]), text: migrationTexts.get(match[1])?.split("\n")[Number(match[2]) - 1] };
}

type Cell = { outcome: string; source: string; verify_live?: boolean; returns?: boolean; message?: string };
type Entry = { label: string; role: string; cell: Cell };

function* allCells(): Generator<Entry> {
  for (const fn of matrix.functions) {
    for (const [role, cell] of Object.entries<Cell>(fn.cells)) yield { label: `${fn.key} ${role}`, role, cell };
    for (const variant of fn.variants ?? []) {
      for (const [role, cell] of Object.entries<Cell>(variant.cells)) yield { label: `${fn.key} [${variant.label}] ${role}`, role, cell };
    }
  }
  for (const table of matrix.tables) {
    for (const [op, cells] of Object.entries<Record<string, Cell>>(table.ops)) {
      for (const [role, cell] of Object.entries(cells)) yield { label: `${table.name} ${op} ${role}`, role, cell };
    }
  }
  for (const [op, cells] of Object.entries<Record<string, Cell>>(matrix.storage.ops)) {
    for (const [role, cell] of Object.entries(cells)) yield { label: `storage ${op} ${role}`, role, cell };
  }
}

test("matrix header lists the six roles, the supported placeholders and every migration file", () => {
  assert.equal(matrix.schema, "portia-expected-authz-v1");
  assert.equal(matrix.baseline, baselinePath);
  assert.deepEqual(Object.keys(matrix.roles), ["anon", "outsider", "editor-full", "editor-restricted", "promo-reviewer", "owner"]);
  assert.ok(Array.isArray(matrix.placeholders) && matrix.placeholders.length > 0);
  // A new migration cannot be added without acknowledging it here (T-21-22).
  assert.deepEqual(matrix.migrations, migrationFiles, "matrix.migrations must equal the sorted list of supabase/migrations/*.sql");
});

test("api section (plan 16-13) has a cell per role and a source line that exists in the route code", () => {
  const roles = ["visitor", "participant", "editor", "promo-reviewer", "owner"];
  assert.equal(matrix.api.schema, "portia-expected-authz-api-v1");
  assert.deepEqual(Object.keys(matrix.api.mapping), roles);
  for (const route of matrix.api.routes) {
    assert.deepEqual(Object.keys(route.cells), roles, `${route.key} cells`);
    for (const source of [route.source, route.via, ...Object.values<{ source?: string }>(route.cells).map((cell) => cell.source)].filter(Boolean)) {
      const [file, line] = String(source).split(":");
      const length = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split(/\r?\n/).length;
      assert.ok(Number(line) >= 1 && Number(line) <= length, `${route.key}: ${source} is outside the file`);
    }
  }
});

test("the replay understands every grant/revoke statement: none refers to an object that does not exist yet", () => {
  assert.deepEqual(orphans, []);
  assert.ok(migrationFiles.length >= 7, `only ${migrationFiles.length} migration files`);
  assert.ok(migrationFiles.includes(baselineFile));
});

test("set comparison reports a function that has no decision, in both directions", () => {
  const withNew = diffSets(effectiveFunctionKeys, [...effectiveFunctionKeys, "public.portia_new_rpc()"]);
  assert.deepEqual(withNew.missing, ["public.portia_new_rpc()"]);
  const withoutOne = diffSets(effectiveFunctionKeys.slice(1), effectiveFunctionKeys);
  assert.deepEqual(withoutOne.missing, [effectiveFunctionKeys[0]]);
  assert.ok(effectiveFunctionKeys.length >= 30, `parsed only ${effectiveFunctionKeys.length} functions`);
});

test("function set in the matrix equals the effective create or replace function public.portia_* of all migrations", () => {
  const diff = diffSets(matrix.functions.map((fn: { key: string }) => fn.key), effectiveFunctionKeys);
  assert.deepEqual(diff, { missing: [], extra: [] }, `functions without a decision: ${diff.missing.join("; ")}; unknown entries: ${diff.extra.join("; ")}`);
  assert.equal(new Set(matrix.functions.map((fn: { key: string }) => fn.key)).size, matrix.functions.length, "duplicate function entries");
});

test("table set in the matrix equals the effective create table if not exists public.portia_* of all migrations", () => {
  const diff = diffSets(matrix.tables.map((table: { name: string }) => table.name), effectiveTableNames);
  assert.deepEqual(diff, { missing: [], extra: [] }, `tables without a decision: ${diff.missing.join("; ")}; unknown entries: ${diff.extra.join("; ")}`);
  // 20 baseline + portia_access_people, _requests, _journal, _settings, _secrets; portia_editor_notes is created and dropped.
  assert.equal(effectiveTableNames.length, 25);
  assert.ok(!effectiveTableNames.includes("portia_editor_notes"), "a created-then-dropped table is not part of the effective schema");
  assert.equal(new Set(matrix.tables.map((table: { name: string }) => table.name)).size, matrix.tables.length, "duplicate table entries");
});

test("every cell has a vocabulary outcome and a source line that exists in a migration file", () => {
  let count = 0;
  for (const { label, cell } of allCells()) {
    count += 1;
    assert.match(cell.outcome, outcomePattern, `${label}: outcome ${cell.outcome}`);
    const source = sourceLine(cell.source);
    assert.ok(source, `${label}: source ${cell.source}`);
    const text = source.text;
    assert.ok(text && text.trim() !== "" && !text.trim().startsWith("--"), `${label}: source line ${source.file}:${source.line} is empty or a comment`);
    if (cell.outcome === "42501") assert.match(text, /\b(revoke|grant)\b/iu, `${label}: ${source.file}:${source.line} is not a grant/revoke`);
    if (cell.outcome === "forbidden" || cell.outcome === "owner-required") {
      assert.match(text, new RegExp(`'${cell.outcome}'`, "u"), `${label}: ${source.file}:${source.line} does not raise ${cell.outcome}`);
    }
    if (cell.verify_live !== undefined) assert.equal(typeof cell.verify_live, "boolean", `${label}: verify_live`);
  }
  assert.ok(count > 400, `only ${count} cells`);
});

test("every role has a cell for every function, table operation and storage operation", () => {
  const roles = Object.keys(matrix.roles);
  const complete = (label: string, cells: Record<string, unknown>) => assert.deepEqual(Object.keys(cells).sort(), [...roles].sort(), label);
  for (const fn of matrix.functions) {
    complete(fn.key, fn.cells);
    for (const variant of fn.variants ?? []) complete(`${fn.key} [${variant.label}]`, variant.cells);
  }
  for (const table of matrix.tables) {
    for (const op of tableOps) assert.ok(table.ops[op], `${table.name} ${op}`);
    for (const [op, cells] of Object.entries<Record<string, unknown>>(table.ops)) complete(`${table.name} ${op}`, cells);
  }
  for (const op of ["read", "insert", "insert-oversize", "insert-bad-mime", "update", "delete"]) assert.ok(matrix.storage.ops[op], `storage ${op}`);
  for (const [op, cells] of Object.entries<Record<string, unknown>>(matrix.storage.ops)) complete(`storage ${op}`, cells);
});

test("function cells agree with the effective grant/revoke state of all migrations", () => {
  for (const fn of matrix.functions) {
    const state = functionByKey.get(fn.key);
    assert.ok(state, `${fn.key}: not an effective function`);
    const groups: Array<[string, Record<string, Cell>]> = [["default", fn.cells], ...(fn.variants ?? []).map((v: { label: string; cells: Record<string, Cell> }) => [v.label, v.cells] as [string, Record<string, Cell>])];
    for (const [label, cells] of groups) {
      for (const [role, cell] of Object.entries(cells)) {
        const executable: boolean = role === "anon" ? state.roles.has("anon") : state.roles.has("authenticated");
        assert.equal(cell.outcome === "42501", !executable, `${fn.key} [${label}] ${role}: ${cell.outcome} but execute granted to ${[...state.roles].join(",") || "nobody"} (last change ${state.setBy})`);
      }
    }
  }
});

test("table cells agree with the effective grant statements of all migrations", () => {
  for (const table of matrix.tables) {
    const { grants, columnLevelUpdate } = tableGrants(table.name);
    for (const op of tableOps) {
      for (const [role, cell] of Object.entries<Cell>(table.ops[op])) {
        const granted = grants.get(op)?.has(role === "anon" ? "anon" : "authenticated") ?? false;
        const columnOnly = op === "update" && columnLevelUpdate !== null;
        // A column-level update grant still lets the permitted columns through.
        assert.equal(cell.outcome === "42501", !granted && !(columnOnly && role !== "anon"), `${table.name} ${op} ${role}: ${cell.outcome}, granted=${granted}`);
      }
    }
    if (table.ops["update-other-column"]) {
      assert.ok(columnLevelUpdate, `${table.name}: update-other-column needs a column-level grant in the migrations`);
      assert.deepEqual([...table.columns].sort(), [...(columnLevelUpdate ?? [])].sort(), `${table.name}: column list`);
      for (const [role, cell] of Object.entries<Cell>(table.ops["update-other-column"])) assert.equal(cell.outcome, "42501", `${table.name} update-other-column ${role}`);
    } else {
      assert.equal(columnLevelUpdate, null, `${table.name} has a column-level update grant but no update-other-column decision`);
    }
  }
});

test("RPC-only tables (portia_promo_*, portia_access_*): RLS on, every privilege revoked, no grant and no policy, so every role gets 42501", () => {
  const rpcOnly = matrix.tables.filter((table: { name: string }) => table.name.startsWith("portia_promo_") || table.name.startsWith("portia_access_"));
  assert.equal(rpcOnly.length, 21);
  assert.equal(rpcOnly.filter((table: { name: string }) => table.name.startsWith("portia_access_")).length, 5);
  const allSql = [...migrationTexts.values()].join("\n");
  for (const table of rpcOnly) {
    const created = effectiveTables.get(table.name);
    assert.ok(created, `${table.name}: not an effective table`);
    const text = migrationTexts.get(created.createdIn) ?? "";
    assert.match(text, new RegExp(`^alter table public\\.${table.name} enable row level security;`, "mu"), `${table.name}: RLS`);
    assert.match(text, new RegExp(`^revoke all on table public\\.${table.name} from public, anon, authenticated;`, "mu"), `${table.name}: revoke`);
    for (const [priv, roles] of created.privileges) {
      assert.ok(!roles.has("anon") && !roles.has("authenticated"), `${table.name}: ${priv} is granted to ${[...roles].join(",")}`);
    }
    assert.doesNotMatch(allSql, new RegExp(`^create policy [^;]*on public\\.${table.name}\\b`, "mu"), `${table.name}: unexpected policy`);
    for (const op of tableOps) for (const [role, cell] of Object.entries<Cell>(table.ops[op])) assert.equal(cell.outcome, "42501", `${table.name} ${op} ${role}`);
    // The live probes need a real column and a typed key, otherwise PostgREST may answer before the privilege check.
    assert.ok(["uuid", "bigint", "text"].includes(table.pk_kind), `${table.name}: pk_kind`);
    assert.ok(Object.keys(table.probes?.update?.set ?? {}).length > 0, `${table.name}: probe column`);
    const block = text.slice(text.indexOf(`create table if not exists public.${table.name} (`));
    const columns = block.slice(0, block.indexOf("\n);"));
    assert.ok(new RegExp(`^  ${Object.keys(table.probes.update.set)[0]} `, "mu").test(columns), `${table.name}: probe column exists in its create table block`);
  }
});

test("accepted risks D-11 and SEC-M1 are recorded as ACCEPTED, not denied", () => {
  const content = matrix.tables.find((table: { name: string }) => table.name === "portia_content");
  assert.equal(content.ops.insert["editor-restricted"].outcome, "accepted:D-11");
  assert.equal(content.ops.update["editor-restricted"].outcome, "accepted:D-11");
  const approved = matrix.functions.find((fn: { name: string }) => fn.name === "portia_editor_is_approved");
  assert.equal(approved.cells.anon.outcome, "accepted:SEC-M1");
  assert.deepEqual(matrix.accepted.map((item: { id: string }) => item.id).sort(), ["D-11", "SEC-M1"]);
  const marked = new Set<string>();
  for (const { cell } of allCells()) if (cell.outcome.startsWith("accepted:")) marked.add(cell.outcome.slice("accepted:".length));
  assert.deepEqual([...marked].sort(), ["D-11", "SEC-M1"]);
  for (const item of matrix.accepted) assert.ok(item.reason && sourcePattern.test(item.source), `accepted ${item.id}`);
});

test("function arguments are inert: namespaced text, inert uuid, row creators flagged", () => {
  const supported = new Set<string>(matrix.placeholders);
  const creators = new Set(["portia_promo_bind_device", "portia_promo_register_attempt", "portia_promo_submit_request", "portia_promo_reset_device"]);
  for (const fn of matrix.functions) {
    assert.equal(typeof fn.creates_rows, "boolean", `${fn.key}: creates_rows`);
    assert.equal(fn.creates_rows, creators.has(fn.name), `${fn.key}: creates_rows`);
    const types = new Map(
      identityOf(fn.key.slice(fn.key.indexOf("(") + 1, -1))
        .split(",")
        .map((part) => part.trim().split(" "))
        .filter((part) => part.length === 2)
        .map(([name, type]) => [name, type] as const),
    );
    for (const argName of Object.keys(fn.args ?? {})) assert.ok(types.has(argName), `${fn.key}: unknown argument ${argName}`);
    for (const [argName, type] of types) {
      assert.ok(fn.args && argName in fn.args, `${fn.key}: argument ${argName} is not set`);
      const value = fn.args[argName];
      if (type === "uuid") assert.equal(value, inertUuid, `${fn.key}.${argName}`);
      if (fn.creates_rows && /nickname|bucket_key/u.test(argName)) assert.match(String(value), /^\{prefix\}/u, `${fn.key}.${argName} must be namespaced`);
    }
    const texts = JSON.stringify([fn.args, ...(fn.variants ?? []).map((v: { args?: unknown }) => v.args)]);
    for (const match of texts.matchAll(/\{(\w+)\}/gu)) assert.ok(supported.has(match[1]), `${fn.key}: placeholder {${match[1]}}`);
  }
  for (const table of matrix.tables) {
    for (const match of JSON.stringify([table.seed, table.probes]).matchAll(/\{(\w+)\}/gu)) assert.ok(supported.has(match[1]), `${table.name}: placeholder {${match[1]}}`);
  }
});

test("Phase 21 access functions are inert in a live run: no probe can pass the signature gate or write a row", () => {
  const access = matrix.functions.filter((fn: { name: string }) => fn.name.startsWith("portia_access_"));
  assert.ok(access.length >= 12, `only ${access.length} portia_access_* functions in the matrix`);
  const roles = Object.keys(matrix.roles);
  // RLS21-07: the probe nicknames are VALID (D-01), so the probes get past the format check and exercise the real branches.
  // Submit is still inert: the signature gate refuses a probe (stale time, zero signature) before any lock, count or insert,
  // so creates_rows stays false. A probe that inserts would need the staging secret and is BLOCKED until 21-07 provides it.
  const fill = (value: string, role: string) =>
    value.replaceAll("{digits}", "4294967295").replaceAll("{n}", String(roles.indexOf(role))).replaceAll("{role}", role).replaceAll("{prefix}", "abcrun").replaceAll("{runId}", "run_1");
  for (const fn of access) {
    assert.equal(fn.creates_rows, false, `${fn.key}: creates_rows`);
    for (const args of [fn.args, ...(fn.variants ?? []).map((variant: { args: Record<string, unknown> }) => variant.args)]) {
      for (const [argName, value] of Object.entries<unknown>(args ?? {})) {
        if (/nickname/u.test(argName)) {
          assert.equal(typeof value, "string", `${fn.key}.${argName}`);
          for (const role of roles) {
            const filled = fill(String(value), role);
            assert.ok(NICKNAME_PATTERN.test(filled), `${fn.key}.${argName} must be a valid D-01 nickname for ${role}: ${filled}`);
            if (argName === "p_nickname_key") assert.equal(filled, filled.toLowerCase(), `${fn.key}.${argName}: a key is lower case`);
            assert.ok(filled.startsWith("p21_"), `${fn.key}.${argName}: namespaced probe nickname ${filled}`);
          }
        }
        if (argName === "p_token_hash") assert.equal(value, "{token}", `${fn.key}.${argName}`);
        if (argName === "p_ip_bucket") assert.match(String(value), /^[0-9a-f]{32}$/u, `${fn.key}.${argName}`);
        if (argName === "p_enabled") assert.equal(value, false, `${fn.key}.${argName}: the default state`);
      }
    }
  }
  const submit = access.find((fn: { name: string }) => fn.name === "portia_access_submit_request");
  assert.equal(submit.args.p_issued_at, 0, "a stale time: the signature gate refuses the probe before any lock or row");
  assert.match(String(submit.args.p_signature), /^0{64}$/u, "a zero signature can never verify");
  assert.deepEqual(Object.keys(submit.args), ["p_nickname", "p_origin", "p_token_hash", "p_ip_bucket", "p_issued_at", "p_signature"]);
});

test("storage decisions mirror the bucket and policies of the baseline", () => {
  assert.match(sql, /'portia-media',\s*'portia-media',\s*true,\s*4194304,/u);
  assert.equal(matrix.storage.bucket, "portia-media");
  assert.equal(matrix.storage.fileSizeLimit, 4194304);
  assert.deepEqual(matrix.storage.allowedMimeTypes, ["image/png", "image/jpeg", "image/webp", "image/gif"]);
  assert.match(sql, /'image\/png', 'image\/jpeg', 'image\/webp', 'image\/gif'/u);
  for (const name of ["Public can read PORTIA media", "Editors can upload PORTIA media", "Editors can update PORTIA media", "Editors can delete PORTIA media"]) {
    assert.ok(sql.includes(`create policy "${name}"`), name);
  }
});
