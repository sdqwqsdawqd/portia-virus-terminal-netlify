import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { canonicalize, inventory } from "../scripts/phase16-fingerprint-compare.mjs";

// Offline parity between supabase/migrations/*.sql and the golden schema fingerprint (plan 21-05, T-21-24).
//
// What is COMPUTED here, from the migration text, and compared with the golden: for every portia_* function the body hash
// (sha256 of the text between `as $$` and `$$;`, CR removed, which is what Postgres stores as prosrc), secdef, volatility,
// config, return type and the effective EXECUTE grants.
//
// What is only CHECKED FOR PRESENCE AND KIND: tables, columns, constraints, indexes and the trigger of the Phase 21 tables.
// The normalised definition text of those (pg_get_constraintdef, pg_get_indexdef, pg_get_triggerdef, column defaults) is
// derived offline from analogous golden entries of the promo tables. It is confirmed only by a fingerprint capture on an
// isolated staging project: BLOCKED (ENV) until that run, never a pass. Nothing here talks to a database.

const migrationsDir = "supabase/migrations";
const migrationFiles = readdirSync(new URL(`../${migrationsDir}/`, import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationTexts = new Map(
  migrationFiles.map((name) => [name, readFileSync(new URL(`../${migrationsDir}/${name}`, import.meta.url), "utf8").replace(/\r\n/gu, "\n")] as const),
);
const golden = JSON.parse(readFileSync(new URL("../supabase/fingerprint/expected/portia.fingerprint.json", import.meta.url), "utf8"));
const sections = golden.sections as Record<string, Record<string, Record<string, unknown>>>;

const PRIVILEGED = "service_role";
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const sortC = (items: Iterable<string>) => [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

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
const splitRoles = (list: string) => list.split(",").map((role) => role.trim()).filter(Boolean);

const RETURNS: Record<string, string> = { timestamptz: "timestamp with time zone", int: "integer" };

type FunctionState = {
  key: string;
  returns: string;
  secdef: boolean;
  volatility: string;
  config: string[];
  srcSha256: string;
  roles: Set<string>;
};

// Effective functions after all migrations, in version order, statement by statement (create, drop, grant, revoke).
// The ACL starts at PUBLIC only: the migrations never rely on default privileges. The explicit-grants migration gives the
// privileged API role EXECUTE on every PORTIA function that exists when it runs (a dynamic DO block).
const effectiveFunctions = new Map<string, FunctionState>();
for (const file of migrationFiles) {
  const text = migrationTexts.get(file) ?? "";
  const events: { at: number; apply: () => void }[] = [];

  for (const match of text.matchAll(/^create or replace function public\.(portia_\w+)\(([^)]*)\)([\s\S]*?)\bas \$\$([\s\S]*?)\$\$;/gmu)) {
    const header = match[3];
    const returnsRaw = /\breturns\s+(\w+)/u.exec(header)?.[1];
    assert.ok(returnsRaw, `${match[1]}: no returns clause`);
    const config = /\bset search_path = ''/u.test(header) ? ['search_path=""'] : [];
    const volatility = /\bimmutable\b/u.test(header) ? "i" : /\bstable\b/u.test(header) ? "s" : "v";
    events.push({
      at: match.index,
      apply: () => {
        const sig = `${match[1]}(${typesOf(match[2], true)})`;
        effectiveFunctions.set(sig, {
          key: `public.${match[1]}(${identityOf(match[2])})`,
          returns: RETURNS[returnsRaw] ?? returnsRaw,
          secdef: /\bsecurity definer\b/u.test(header),
          volatility,
          config,
          srcSha256: sha256(match[4].replace(/\r/gu, "")),
          roles: effectiveFunctions.get(sig)?.roles ?? new Set<string>(["PUBLIC"]),
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
        assert.ok(state, `${file}: grant on unknown function ${match[1]}`);
        for (const role of splitRoles(match[3])) state.roles.add(role === "public" ? "PUBLIC" : role);
      },
    });
  }
  for (const match of text.matchAll(/^revoke (?:all|execute) on function public\.(portia_\w+)\(([^)]*)\) from ([^;]+);/gmu)) {
    events.push({
      at: match.index,
      apply: () => {
        const state = effectiveFunctions.get(`${match[1]}(${typesOf(match[2], false)})`);
        assert.ok(state, `${file}: revoke on unknown function ${match[1]}`);
        for (const role of splitRoles(match[3])) state.roles.delete(role === "public" ? "PUBLIC" : role);
      },
    });
  }
  if (/execute format\('grant execute on function %s to service_role'/u.test(text)) {
    const at = text.indexOf("grant execute on function %s to service_role");
    events.push({ at, apply: () => void [...effectiveFunctions.values()].forEach((state) => state.roles.add(PRIVILEGED)) });
  }
  for (const event of events.sort((a, b) => a.at - b.at)) event.apply();
}

const aclOf = (roles: Set<string>) => sortC([...roles].filter((role) => ["PUBLIC", "anon", "authenticated", PRIVILEGED].includes(role)).map((role) => `${role}:EXECUTE`));

test("the golden still parses and carries the platform function next to every effective PORTIA function", () => {
  assert.equal(golden.schema, "portia-fingerprint-v1");
  assert.equal(golden.pg_major, 17);
  const counts = inventory(canonicalize(golden));
  assert.equal(counts.functions, 1 + effectiveFunctions.size, "golden functions = rls_auto_enable + effective portia_* functions");
  assert.equal(counts.triggers, 2, "two triggers: the journal append-only guards (rows, truncate)");
});

test("function set: the golden lists exactly the effective portia_* functions of all migrations (and the platform function)", () => {
  const expected = sortC([...[...effectiveFunctions.values()].map((state) => state.key), "public.rls_auto_enable()"]);
  assert.deepEqual(sortC(Object.keys(sections.functions)), expected);
});

test("every effective function matches its golden entry: body hash, secdef, volatility, config, return type and ACL", () => {
  assert.ok(effectiveFunctions.size >= 35, "the 35 baseline functions are still part of the set");
  for (const state of effectiveFunctions.values()) {
    const entry = sections.functions[state.key];
    assert.ok(entry, `missing golden function ${state.key}`);
    assert.equal(entry.src_sha256, state.srcSha256, `${state.key}: src_sha256`);
    assert.equal(entry.secdef, state.secdef, `${state.key}: secdef`);
    assert.equal(entry.volatility, state.volatility, `${state.key}: volatility`);
    assert.deepEqual(entry.config, state.config, `${state.key}: config`);
    assert.equal(entry.returns, state.returns, `${state.key}: returns`);
    assert.equal(entry.kind, "f", `${state.key}: kind`);
    assert.deepEqual(entry.acl, aclOf(state.roles), `${state.key}: acl differs from the replayed grants`);
  }
});

test("a Phase 21 function without a golden entry would be caught: the access functions are all in the golden", () => {
  const access = [...effectiveFunctions.values()].filter((state) => state.key.startsWith("public.portia_access_"));
  assert.ok(access.length >= 12, `only ${access.length} portia_access_* functions found`);
  for (const state of access) assert.ok(sections.functions[state.key], `missing golden function ${state.key}`);
});

// ---- Phase 21 tables: presence and kind (normalised text is staging-unconfirmed, see the header comment) ----

const accessText = migrationTexts.get("20261109000000_portia_access_foundation.sql") ?? "";
const typeMap: Record<string, string> = { timestamptz: "timestamp with time zone" };

type ColumnSpec = { name: string; type: string; notnull: boolean; defaultText: string | null; identity: string };
type TableSpec = { name: string; columns: ColumnSpec[]; constraints: { name: string; kind: string }[]; rls: boolean };

function splitTopLevel(body: string) {
  const items: string[] = [];
  let depth = 0;
  let quote = false;
  let current = "";
  for (const char of body) {
    if (char === "'") quote = !quote;
    if (!quote && char === "(") depth += 1;
    if (!quote && char === ")") depth -= 1;
    if (!quote && depth === 0 && char === ",") {
      items.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

const tables: TableSpec[] = [];
for (const match of accessText.matchAll(/^create table if not exists public\.(portia_access_\w+) \(\n([\s\S]*?)\n\);/gmu)) {
  const columns: ColumnSpec[] = [];
  const constraints: { name: string; kind: string }[] = [];
  for (const item of splitTopLevel(match[2].replace(/--[^\n]*/gu, ""))) {
    const named = /^constraint (\w+) (check|unique|foreign key|primary key)\b/u.exec(item);
    if (named) {
      constraints.push({ name: named[1], kind: { check: "c", unique: "u", "foreign key": "f", "primary key": "p" }[named[2]] as string });
      continue;
    }
    const column = /^(\w+) (uuid|text|smallint|bigint|boolean|jsonb|timestamptz|integer)\b(.*)$/u.exec(item);
    assert.ok(column, `${match[1]}: cannot read column definition "${item}"`);
    const rest = column[3];
    const type = typeMap[column[2]] ?? column[2];
    let defaultText = /\bdefault\s+(.+)$/u.exec(rest)?.[1] ?? null;
    if (defaultText && /^'.*'$/u.test(defaultText) && type === "text") defaultText = `${defaultText}::text`;
    if (/primary key/u.test(rest)) constraints.push({ name: `${match[1]}_pkey`, kind: "p" });
    columns.push({
      name: column[1],
      type,
      notnull: /\bnot null\b|\bprimary key\b/u.test(rest),
      defaultText,
      identity: /generated always as identity/u.test(rest) ? "a" : "",
    });
  }
  tables.push({
    name: match[1],
    columns,
    constraints,
    rls: new RegExp(`^alter table public\\.${match[1]} enable row level security;`, "mu").test(accessText),
  });
}

const sequences = tables.flatMap((table) => table.columns.filter((column) => column.identity === "a").map((column) => `${table.name}_${column.name}_seq`));
const privilegedTable = ["DELETE", "INSERT", "MAINTAIN", "REFERENCES", "SELECT", "TRIGGER", "TRUNCATE", "UPDATE"].map((priv) => `${PRIVILEGED}:${priv}`);

test("the migration creates the four Phase 21 tables and one identity sequence", () => {
  assert.deepEqual(
    tables.map((table) => table.name).sort(),
    ["portia_access_journal", "portia_access_people", "portia_access_requests", "portia_access_settings"],
  );
  assert.deepEqual(sequences, ["portia_access_journal_id_seq"]);
});

test("golden tables: every Phase 21 table (RLS on, only the privileged role) and the journal sequence", () => {
  const goldenAccess = Object.keys(sections.tables).filter((key) => key.startsWith("public.portia_access_"));
  assert.deepEqual(sortC(goldenAccess), sortC([...tables.map((table) => `public.${table.name}`), ...sequences.map((name) => `public.${name}`)]));
  for (const table of tables) {
    assert.ok(table.rls, `${table.name}: row level security is enabled in the migration`);
    assert.match(accessText, new RegExp(`^revoke all on table public\\.${table.name} from public, anon, authenticated;`, "mu"));
    // The journal is append-only (RLS21-03): the privileged role may only read and append, no truncate/update/delete.
    const journal = table.name === "portia_access_journal";
    assert.match(accessText, new RegExp(`^grant ${journal ? "select, insert" : "all"} on table public\\.${table.name} to ${PRIVILEGED};`, "mu"));
    assert.deepEqual(
      sections.tables[`public.${table.name}`],
      { acl: journal ? [`${PRIVILEGED}:INSERT`, `${PRIVILEGED}:SELECT`] : privilegedTable, force_rls: false, options: null, relkind: "r", rls: true, viewdef: null },
      `${table.name}`,
    );
  }
  for (const name of sequences) {
    assert.match(accessText, new RegExp(`^revoke all on sequence public\\.${name} from public, anon, authenticated;`, "mu"));
    assert.deepEqual(
      sections.tables[`public.${name}`],
      { acl: [`${PRIVILEGED}:SELECT`, `${PRIVILEGED}:UPDATE`, `${PRIVILEGED}:USAGE`], force_rls: false, options: null, relkind: "S", rls: false, viewdef: null },
      name,
    );
  }
});

test("golden columns: every declared column of the Phase 21 tables with type, not null, default and identity", () => {
  const expectedKeys: string[] = [];
  for (const table of tables) {
    for (const column of table.columns) {
      const key = `public.${table.name}.${column.name}`;
      expectedKeys.push(key);
      assert.deepEqual(
        sections.columns[key],
        { acl: null, default: column.defaultText, generated: "", identity: column.identity, notnull: column.notnull, type: column.type },
        key,
      );
    }
  }
  const goldenKeys = Object.keys(sections.columns).filter((key) => key.startsWith("public.portia_access_"));
  assert.deepEqual(sortC(goldenKeys), sortC(expectedKeys));
});

test("golden constraints: every named constraint and primary key of the Phase 21 tables, with the right kind", () => {
  const expectedKeys: string[] = [];
  for (const table of tables) {
    for (const constraint of table.constraints) {
      const key = `${table.name}.${constraint.name}`;
      expectedKeys.push(key);
      const entry = sections.constraints[key];
      assert.ok(entry, `missing golden constraint ${key}`);
      assert.equal(entry.type, constraint.kind, `${key}: kind`);
      assert.equal(entry.validated, true, `${key}: validated`);
      assert.equal(typeof entry.def, "string", `${key}: def`);
    }
  }
  const goldenKeys = Object.keys(sections.constraints).filter((key) => key.startsWith("portia_access_"));
  assert.deepEqual(sortC(goldenKeys), sortC(expectedKeys));
});

test("golden indexes: primary keys, unique constraints and every explicit create index of the Phase 21 tables", () => {
  const expected = new Map<string, { unique: boolean; table: string; name: string; columns: string | null; partial: boolean }>();
  for (const table of tables) {
    for (const constraint of table.constraints) {
      if (constraint.kind === "p" || constraint.kind === "u") {
        expected.set(`${table.name}.${constraint.name}`, { unique: true, table: table.name, name: constraint.name, columns: null, partial: false });
      }
    }
  }
  for (const match of accessText.matchAll(/^create (unique )?index if not exists (\w+)\s+on public\.(portia_access_\w+) \(([^)]*)\)( where [^;]+)?;/gmu)) {
    expected.set(`${match[3]}.${match[2]}`, {
      unique: Boolean(match[1]),
      table: match[3],
      name: match[2],
      columns: match[4].replace(/\bdesc\b/gu, "DESC"),
      partial: Boolean(match[5]),
    });
  }
  for (const [key, spec] of expected) {
    const entry = sections.indexes[key];
    assert.ok(entry, `missing golden index ${key}`);
    assert.equal(entry.unique, spec.unique, `${key}: unique`);
    assert.equal(entry.valid, true, `${key}: valid`);
    const def = String(entry.def);
    assert.ok(def.startsWith(`CREATE ${spec.unique ? "UNIQUE " : ""}INDEX ${spec.name} ON public.${spec.table} USING btree (`), `${key}: def prefix`);
    if (spec.columns) assert.ok(def.includes(`USING btree (${spec.columns})`), `${key}: columns ${spec.columns}`);
    assert.equal(def.includes(" WHERE ("), spec.partial, `${key}: partial predicate`);
  }
  const goldenKeys = Object.keys(sections.indexes).filter((key) => key.startsWith("portia_access_"));
  assert.deepEqual(sortC(goldenKeys), sortC(expected.keys()));
});

test("golden triggers: the journal append-only guards, before update or delete (rows) and before truncate (statement), enabled", () => {
  const rowGuard = /^create trigger (\w+) before update or delete on public\.(\w+) for each row execute function public\.(\w+)\(\);/mu.exec(accessText);
  assert.ok(rowGuard, "row trigger statement in the migration");
  assert.equal(rowGuard[1], rowGuard[3], "trigger and function share a name");
  const truncateGuard = /^create trigger (\w+) before truncate on public\.(\w+) for each statement execute function public\.(\w+)\(\);/mu.exec(accessText);
  assert.ok(truncateGuard, "truncate trigger statement in the migration (RLS21-03)");
  assert.equal(truncateGuard[2], rowGuard[2], "both guards sit on the journal");
  assert.equal(truncateGuard[3], rowGuard[3], "both guards run the same append-only function");
  assert.deepEqual(sortC(Object.keys(sections.triggers)), sortC([`${rowGuard[2]}.${rowGuard[1]}`, `${truncateGuard[2]}.${truncateGuard[1]}`]));
  assert.deepEqual(sections.triggers[`${rowGuard[2]}.${rowGuard[1]}`], {
    def: `CREATE TRIGGER ${rowGuard[1]} BEFORE DELETE OR UPDATE ON public.${rowGuard[2]} FOR EACH ROW EXECUTE FUNCTION ${rowGuard[3]}()`,
    enabled: "O",
  });
  assert.deepEqual(sections.triggers[`${truncateGuard[2]}.${truncateGuard[1]}`], {
    def: `CREATE TRIGGER ${truncateGuard[1]} BEFORE TRUNCATE ON public.${truncateGuard[2]} FOR EACH STATEMENT EXECUTE FUNCTION ${truncateGuard[3]}()`,
    enabled: "O",
  });
  assert.ok(sections.functions[`public.${rowGuard[3]}()`], "the trigger function is in the golden");
});

test("no policy was added: the Phase 21 tables are RPC only", () => {
  assert.deepEqual(
    Object.keys(sections.policies).filter((key) => key.includes("portia_access_")),
    [],
  );
});
