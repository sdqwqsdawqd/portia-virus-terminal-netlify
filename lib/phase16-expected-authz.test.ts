import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Offline completeness of the role x surface matrix against the canonical baseline (plan 16-08, T-16-23/24).
// Expectations come from the SQL text; nothing here talks to Supabase.

const baselinePath = "supabase/migrations/20261101000000_portia_baseline.sql";
const sql = readFileSync(new URL(`../${baselinePath}`, import.meta.url), "utf8");
const lines = sql.split(/\r?\n/);
const matrix = JSON.parse(readFileSync(new URL("../tests/e2e/fixtures/data/expected-authz.json", import.meta.url), "utf8"));

const inertUuid = "00000000-0000-4000-8000-000000000000";
const outcomePattern = /^(allow|42501|forbidden|owner-required|rls-empty|rls-deny|accepted:D-11|accepted:SEC-M1|http-\d{3}|[0-9A-Z]{5})$/u;
const sourcePattern = new RegExp(`^${baselinePath.replaceAll(".", "\\.")}:(\\d+)$`, "u");
const tableOps = ["select", "insert", "update", "delete"];

const identityOf = (args: string) =>
  args
    .split(",")
    .map((arg) => arg.trim())
    .filter(Boolean)
    .map((arg) => arg.replace(/\s+default\s[\s\S]*$/iu, "").replace(/\s+/gu, " "))
    .join(", ");

const baselineFunctions = [...sql.matchAll(/^create or replace function public\.(portia_\w+)\(([^)]*)\)/gmu)].map((match) => ({
  name: match[1],
  key: `public.${match[1]}(${identityOf(match[2])})`,
}));
const baselineTables = [...sql.matchAll(/^create table if not exists public\.(portia_\w+)/gmu)].map((match) => match[1]);

function diffSets(actual: readonly string[], expected: readonly string[]) {
  const have = new Set(actual);
  const want = new Set(expected);
  return { missing: expected.filter((item) => !have.has(item)), extra: actual.filter((item) => !want.has(item)) };
}

function executeRoles(name: string) {
  const roles = new Set<string>();
  for (const match of sql.matchAll(new RegExp(`^grant execute on function public\\.${name}\\(([^)]*)\\) to ([^;]+);`, "gmu"))) {
    for (const role of match[2].split(",")) roles.add(role.trim());
  }
  return roles;
}

function tableGrants(table: string) {
  const grants = new Map<string, Set<string>>();
  let columnLevelUpdate: string[] | null = null;
  for (const match of sql.matchAll(new RegExp(`^grant (.+?) on table public\\.${table} to ([^;]+);`, "gmu"))) {
    const columns = match[1].match(/\(([^)]*)\)/u);
    if (columns) columnLevelUpdate = columns[1].split(",").map((column) => column.trim());
    for (const priv of match[1].replace(/\([^)]*\)/gu, "").split(",")) {
      const role = grants.get(priv.trim()) ?? new Set<string>();
      for (const name of match[2].split(",")) role.add(name.trim());
      grants.set(priv.trim(), role);
    }
  }
  return { grants, columnLevelUpdate };
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

test("matrix header lists the six roles and the supported placeholders", () => {
  assert.equal(matrix.schema, "portia-expected-authz-v1");
  assert.equal(matrix.baseline, baselinePath);
  assert.deepEqual(Object.keys(matrix.roles), ["anon", "outsider", "editor-full", "editor-restricted", "promo-reviewer", "owner"]);
  assert.ok(Array.isArray(matrix.placeholders) && matrix.placeholders.length > 0);
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

test("set comparison reports a function that has no decision, in both directions", () => {
  const withNew = diffSets(baselineFunctions.map((fn) => fn.key), [...baselineFunctions.map((fn) => fn.key), "public.portia_new_rpc()"]);
  assert.deepEqual(withNew.missing, ["public.portia_new_rpc()"]);
  const withoutOne = diffSets(baselineFunctions.slice(1).map((fn) => fn.key), baselineFunctions.map((fn) => fn.key));
  assert.deepEqual(withoutOne.missing, [baselineFunctions[0].key]);
  assert.ok(baselineFunctions.length >= 30, `parsed only ${baselineFunctions.length} baseline functions`);
});

test("function set in the matrix equals create or replace function public.portia_* in the baseline", () => {
  const diff = diffSets(matrix.functions.map((fn: { key: string }) => fn.key), baselineFunctions.map((fn) => fn.key));
  assert.deepEqual(diff, { missing: [], extra: [] }, `functions without a decision: ${diff.missing.join("; ")}; unknown entries: ${diff.extra.join("; ")}`);
  assert.equal(new Set(matrix.functions.map((fn: { key: string }) => fn.key)).size, matrix.functions.length, "duplicate function entries");
});

test("table set in the matrix equals create table if not exists public.portia_* in the baseline", () => {
  const diff = diffSets(matrix.tables.map((table: { name: string }) => table.name), baselineTables);
  assert.deepEqual(diff, { missing: [], extra: [] }, `tables without a decision: ${diff.missing.join("; ")}; unknown entries: ${diff.extra.join("; ")}`);
  assert.equal(baselineTables.length, 20);
});

test("every cell has a vocabulary outcome and a source line that exists in the baseline", () => {
  let count = 0;
  for (const { label, cell } of allCells()) {
    count += 1;
    assert.match(cell.outcome, outcomePattern, `${label}: outcome ${cell.outcome}`);
    const match = sourcePattern.exec(cell.source ?? "");
    assert.ok(match, `${label}: source ${cell.source}`);
    const text = lines[Number(match[1]) - 1];
    assert.ok(text && text.trim() !== "" && !text.trim().startsWith("--"), `${label}: source line ${match[1]} is empty or a comment`);
    if (cell.outcome === "42501") assert.match(text, /\b(revoke|grant)\b/iu, `${label}: line ${match[1]} is not a grant/revoke`);
    if (cell.outcome === "forbidden" || cell.outcome === "owner-required") {
      assert.match(text, new RegExp(`'${cell.outcome}'`, "u"), `${label}: line ${match[1]} does not raise ${cell.outcome}`);
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

test("function cells agree with the grant/revoke statements of the baseline", () => {
  for (const fn of matrix.functions) {
    const roles = executeRoles(fn.name);
    const groups: Array<[string, boolean, Record<string, Cell>]> = [["default", true, fn.cells], ...(fn.variants ?? []).map((v: { label: string; cells: Record<string, Cell> }) => [v.label, true, v.cells] as [string, boolean, Record<string, Cell>])];
    for (const [label, , cells] of groups) {
      for (const [role, cell] of Object.entries(cells)) {
        const executable = role === "anon" ? roles.has("anon") : roles.has("authenticated");
        assert.equal(cell.outcome === "42501", !executable, `${fn.key} [${label}] ${role}: ${cell.outcome} but execute granted to ${[...roles].join(",") || "nobody"}`);
      }
    }
  }
});

test("table cells agree with the grant statements of the baseline", () => {
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
      assert.ok(columnLevelUpdate, `${table.name}: update-other-column needs a column-level grant in the baseline`);
      assert.deepEqual([...table.columns].sort(), [...(columnLevelUpdate ?? [])].sort(), `${table.name}: column list`);
      for (const [role, cell] of Object.entries<Cell>(table.ops["update-other-column"])) assert.equal(cell.outcome, "42501", `${table.name} update-other-column ${role}`);
    } else {
      assert.equal(columnLevelUpdate, null, `${table.name} has a column-level update grant but no update-other-column decision`);
    }
  }
});

test("promo tables: RLS on, every privilege revoked, no grant and no policy, so every role gets 42501", () => {
  const promo = matrix.tables.filter((table: { name: string }) => table.name.startsWith("portia_promo_"));
  assert.equal(promo.length, 16);
  for (const table of promo) {
    assert.match(sql, new RegExp(`^alter table public\\.${table.name} enable row level security;`, "mu"), `${table.name}: RLS`);
    assert.match(sql, new RegExp(`^revoke all on table public\\.${table.name} from public, anon, authenticated;`, "mu"), `${table.name}: revoke`);
    assert.doesNotMatch(sql, new RegExp(`^grant [^;]* on table public\\.${table.name}\\b`, "mu"), `${table.name}: unexpected grant`);
    assert.doesNotMatch(sql, new RegExp(`^create policy [^;]*on public\\.${table.name}\\b`, "mu"), `${table.name}: unexpected policy`);
    for (const op of tableOps) for (const [role, cell] of Object.entries<Cell>(table.ops[op])) assert.equal(cell.outcome, "42501", `${table.name} ${op} ${role}`);
    // The live probes need a real column and a typed key, otherwise PostgREST may answer before the privilege check.
    assert.ok(["uuid", "bigint", "text"].includes(table.pk_kind), `${table.name}: pk_kind`);
    assert.ok(Object.keys(table.probes?.update?.set ?? {}).length > 0, `${table.name}: probe column`);
    assert.ok(new RegExp(`^  ${Object.keys(table.probes.update.set)[0]} `, "mu").test(sql.slice(sql.indexOf(`create table if not exists public.${table.name} (`))), `${table.name}: probe column exists`);
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
