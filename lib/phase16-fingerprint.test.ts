import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  canonicalize,
  diffFingerprints,
  extractFingerprint,
  inventory,
  sectionHashes,
} from "../scripts/phase16-fingerprint-compare.mjs";

// Synthetic fingerprints only: nothing here touches a database.

const fnKey = "public.portia_x(p_a text)";
const make = (overrides: Record<string, unknown> = {}) => ({
  schema: "portia-fingerprint-v1",
  pg_major: 17,
  search_path: '"$user", public',
  sections: {
    extensions: { pg_cron: true, plpgsql: true },
    functions: {
      [fnKey]: { secdef: true, acl: ["authenticated:EXECUTE"], config: ["search_path=\"\""] },
      "public.portia_y()": { secdef: false, acl: [], config: [] },
    },
    policies: { "public.portia_content:read": { cmd: "r", roles: ["PUBLIC"] } },
    cron: null,
  },
  ...overrides,
});

test("canonicalize sorts keys recursively and keeps array order", () => {
  const a = canonicalize({ b: [{ z: 1, a: 2 }], a: 1 });
  assert.equal(JSON.stringify(a), '{"a":1,"b":[{"a":2,"z":1}]}');
});

test("same content with different key order is equal with equal section hashes", () => {
  const a = make();
  const b = JSON.parse(JSON.stringify(a));
  // rebuild functions in reverse key order
  b.sections.functions = Object.fromEntries(Object.entries(b.sections.functions).reverse());
  b.sections.functions[fnKey] = { config: ["search_path=\"\""], acl: ["authenticated:EXECUTE"], secdef: true };
  assert.deepEqual(diffFingerprints(a, b), { comparable: true, equal: true, diff: {}, info: {} });
  assert.deepEqual(sectionHashes(a), sectionHashes(b));
});

test("different search_path is incomparable like pg_major", () => {
  assert.deepEqual(diffFingerprints(make(), make({ search_path: "public" })), {
    comparable: false,
    reason: "search-path",
  });
});

test("a diff touching only the privileged API role ACL entries is tagged info but still a diff", () => {
  const withRole = JSON.parse(JSON.stringify(make()));
  withRole.sections.functions[fnKey].acl = ["authenticated:EXECUTE", "service_role:EXECUTE"];
  const onlyRole = diffFingerprints(make(), withRole);
  assert.equal(onlyRole.equal, false);
  assert.deepEqual(onlyRole.diff, { functions: [fnKey] });
  assert.deepEqual(onlyRole.info, { functions: [fnKey] });

  const both = JSON.parse(JSON.stringify(withRole));
  both.sections.functions[fnKey].acl.push("PUBLIC:EXECUTE");
  const mixed = diffFingerprints(make(), both);
  assert.deepEqual(mixed.diff, { functions: [fnKey] });
  assert.deepEqual(mixed.info, {});
});

test("one changed ACL names only its section and key", () => {
  const b = JSON.parse(JSON.stringify(make()));
  b.sections.functions[fnKey].acl = ["PUBLIC:EXECUTE", "authenticated:EXECUTE"];
  const result = diffFingerprints(make(), b);
  assert.equal(result.comparable, true);
  assert.equal(result.equal, false);
  assert.deepEqual(result.diff, { functions: [fnKey] });
  const ha = sectionHashes(make());
  const hb = sectionHashes(b);
  assert.notEqual(ha.functions, hb.functions);
  assert.equal(ha.policies, hb.policies);
});

test("a key present on one side only lands in its section diff", () => {
  const b = JSON.parse(JSON.stringify(make()));
  delete b.sections.policies["public.portia_content:read"];
  b.sections.extensions.pgcrypto = true;
  const result = diffFingerprints(make(), b);
  assert.deepEqual(result.diff, {
    extensions: ["pgcrypto"],
    policies: ["public.portia_content:read"],
  });
});

test("a section that is null on one side only is a diff, not equality", () => {
  const b = JSON.parse(JSON.stringify(make()));
  b.sections.cron = {};
  const result = diffFingerprints(make(), b);
  assert.equal(result.equal, false);
  assert.deepEqual(result.diff, { cron: ["<section>"] });
});

test("different pg_major is incomparable, not a diff and not equal", () => {
  assert.deepEqual(diffFingerprints(make(), make({ pg_major: 15 })), {
    comparable: false,
    reason: "pg-major",
  });
});

test("unknown schema or shape throws fingerprint-schema", () => {
  assert.throws(() => diffFingerprints(make({ schema: "other" }), make()), { code: "fingerprint-schema" });
  assert.throws(() => diffFingerprints(make(), { schema: "portia-fingerprint-v1", pg_major: 17 }), {
    code: "fingerprint-schema",
  });
});

test("extractFingerprint accepts object, one-column rows, JSON string and rows envelope", () => {
  const fp = make();
  const text = JSON.stringify(fp);
  assert.deepEqual(extractFingerprint(fp), fp);
  assert.deepEqual(extractFingerprint(text), fp);
  assert.deepEqual(extractFingerprint([{ fingerprint: fp }]), fp);
  assert.deepEqual(extractFingerprint([{ fingerprint: text }]), fp);
  assert.deepEqual(extractFingerprint([text]), fp);
  assert.deepEqual(extractFingerprint({ rows: [{ jsonb_build_object: fp }] }), fp);
});

test("extractFingerprint rejects everything else", () => {
  for (const bad of [null, 5, "not json", "[]", [], [make(), make()], { a: 1, b: 2 }, [{ a: 1, b: 2 }]]) {
    assert.throws(() => extractFingerprint(bad), { code: "fingerprint-format" });
  }
});

test("inventory counts keys per section; null section stays null", () => {
  assert.deepEqual(inventory(make()), { extensions: 2, functions: 2, policies: 1, cron: null });
});

test("CLI: exit 0 equal, 1 diff, 2 incomparable or bad format; --summary prints inventory", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "p16-fp-"));
  const put = (name: string, value: unknown) => {
    const file = path.join(dir, name);
    writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
    return file;
  };
  const script = path.resolve("scripts/phase16-fingerprint-compare.mjs");
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

  const changed = JSON.parse(JSON.stringify(make()));
  changed.sections.functions[fnKey].secdef = false;

  const a = put("a.json", make());
  const same = put("same.json", [{ fingerprint: JSON.stringify(make()) }]);
  const diff = put("diff.json", changed);
  const other = put("other.json", make({ pg_major: 15 }));
  const garbage = put("garbage.json", "{nope");

  assert.equal(run(a, same).status, 0);
  const bom = put("bom.json", "﻿" + JSON.stringify([{ fingerprint: make() }], null, 2));
  assert.equal(run(a, bom).status, 0);
  const d = run(a, diff);
  assert.equal(d.status, 1);
  assert.match(d.stdout, /functions/);
  assert.match(d.stdout, /portia_x/);
  assert.equal(run(a, other).status, 2);
  assert.equal(run(a, garbage).status, 2);
  assert.equal(run(a).status, 2);

  const s = run("--summary", a);
  assert.equal(s.status, 0);
  const printed = JSON.parse(s.stdout);
  assert.equal(printed.inventory.functions, 2);
  assert.match(printed.sha256.functions, /^[0-9a-f]{64}$/);
});

// ---------------------------------------------------------------------------
// Static read-only proof for the fingerprint SQL (owner runs it in production, D5).
// ---------------------------------------------------------------------------

const sqlText = readFileSync(new URL("../supabase/fingerprint/portia_schema_fingerprint.sql", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");

const stripComments = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
// Replace string literals with '' so keywords inside text do not count ('' escapes stay inside a literal).
const stripLiterals = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''");
const code = stripLiterals(stripComments(sqlText));
const literals = [...stripComments(sqlText).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));

const forbidden = [
  "insert", "update", "delete", "merge", "create", "drop", "alter", "grant", "revoke", "truncate",
  "copy", "begin", "commit", "rollback", "vacuum", "analyze", "set", "do", "call", "lock", "notify", "refresh",
];

test("fingerprint SQL is a single read-only statement", () => {
  const body = code.trim().replace(/;\s*$/, "");
  assert.ok(!body.includes(";"), "more than one statement");
  assert.match(body, /^(with|select)\b/i);
  for (const word of forbidden) {
    assert.doesNotMatch(code, new RegExp(`\\b${word}\\b`, "i"), `forbidden keyword: ${word}`);
  }
});

test("query_to_xml payload literals are read-only SELECTs", () => {
  // The bare 'cron.job' literal is the to_regclass() argument, not a payload.
  const payloads = literals.filter((l) => /\bcron\.job\b/.test(l) && l !== "cron.job");
  assert.ok(payloads.length >= 1, "cron.job payload missing");
  for (const p of payloads) {
    assert.match(p.trim(), /^select\b/i);
    assert.ok(!p.replace(/;\s*$/, "").includes(";"));
    const inner = stripLiterals(p);
    for (const word of forbidden) {
      assert.doesNotMatch(inner, new RegExp(`\\b${word}\\b`, "i"), `payload keyword: ${word}`);
    }
  }
  // Naming cron.job outside a literal would fail to parse on a project without pg_cron.
  assert.doesNotMatch(code, /\bcron\.job\b/i);
});

test("exactly one query_to_xml, whose first argument is a single string literal", () => {
  const uncommented = stripComments(sqlText);
  assert.equal([...uncommented.matchAll(/query_to_xml\s*\(/gi)].length, 1);
  // A literal directly followed by the next argument rules out concatenation or computed SQL.
  assert.equal([...uncommented.matchAll(/query_to_xml\s*\(\s*'(?:[^']|'')*'\s*,/gi)].length, 1);
});

test("no state-changing or exfiltrating function appears anywhere, literals included", () => {
  const uncommented = stripComments(sqlText).toLowerCase();
  for (const needle of [
    "nextval(", "setval(", "set_config(", "pg_notify(", "pg_advisory", "net.http", "http_post", "dblink",
    "lo_import", "lo_export", "pg_read_file", "pg_read_binary_file", "pg_terminate_backend",
    "pg_cancel_backend", "cron.schedule", "cron.unschedule", "vault",
  ]) {
    assert.ok(!uncommented.includes(needle), `denylisted: ${needle}`);
  }
});

test("header tells the operator to wrap the query in a read-only transaction (instruction text only)", () => {
  const header = sqlText.split("\nwith\n")[0];
  assert.match(header, /begin read only;[\s\S]*rollback;/i);
  assert.doesNotMatch(code, /\bread\b/i);
});

test("raw cron command text is never emitted, only its hash and an expected-command flag", () => {
  const uncommented = stripComments(sqlText);
  assert.ok(uncommented.includes("'command_sha256'") && uncommented.includes("'command_is_expected'"));
  // The key 'command' (followed by a comma) would be a raw output; `path 'command'` ends a column list.
  assert.doesNotMatch(uncommented, /'command'\s*,/);
  assert.ok(uncommented.includes("'username'"));
});

test("fingerprint SQL covers the required catalog functions and sections", () => {
  for (const needle of [
    'collate "C"', "aclexplode", "acldefault", "pg_get_function_identity_arguments", "pg_get_expr",
    "pg_get_constraintdef", "pg_get_indexdef", "convalidated", "attacl", "pg_get_function_result",
    "prosecdef", "provolatile", "proconfig", "sha256", "relrowsecurity", "relforcerowsecurity",
    "polcmd", "polpermissive", "polroles", "portia-media", "portia-promo-cleanup",
    "reloptions", "pg_get_viewdef", "pg_rewrite", "pg_get_triggerdef", "tgenabled", "tgisinternal",
    "nspacl", "pg_default_acl", "pg_publication_tables", "rolbypassrls", "rolsuper", "pg_auth_members",
    "command_sha256", "command_is_expected", "current_setting('search_path')", "chr(13)",
    "'storage'", "'objects'", "'buckets'", "position('portia_' in", "prosecdef",
  ]) {
    assert.ok(sqlText.includes(needle), `missing: ${needle}`);
  }
  // C1: every policy on storage.objects/buckets is fingerprinted, not only %PORTIA% names.
  assert.doesNotMatch(code, /polname\s+like/i);
  for (const section of [
    "extensions", "roles", "schemas", "default_acls", "tables", "columns", "constraints", "indexes", "triggers",
    "functions", "policies", "publications", "bucket", "cron",
  ]) {
    assert.ok(sqlText.includes(`'${section}',`), `missing section: ${section}`);
  }
  assert.ok(sqlText.includes("'portia-fingerprint-v1'"));
});

test("fingerprint SQL emits no ordinals, owners, versions, credentials or raw rows", () => {
  // attnum and owner oids may only be join keys or acldefault() arguments, never output.
  const noJoinUse = code
    .replace(/d\.adnum = att\.attnum/g, "")
    .replace(/att\.attnum > 0/g, "")
    .replace(/c\.relowner as rowner/g, "")
    .replace(/p\.proowner as fowner/g, "")
    .replace(/acldefault\([^)]*\)/g, "");
  assert.doesNotMatch(noJoinUse, /\battnum\b|\b(proowner|relowner|nspowner)\b/i);
  assert.doesNotMatch(code, /\bextversion\b|\bjsonb_pretty\b/i);
  // pg_roles is allowed only through explicit columns; password hashes live in pg_authid/rolpassword.
  assert.doesNotMatch(code, /\b(pg_authid|pg_shadow|pg_user_mapping|rolpassword|rolconfig|row_to_json|to_json)\b/i);
  assert.doesNotMatch(code, /to_jsonb\(\s*(?!true\b|false\b)[a-z_]+\s*\)/i);
  assert.doesNotMatch(code, /\bas oid\b|\bselect\s+\*|,\s*\*\s*from|\w\.\*/i);
  assert.ok(code.includes("rolbypassrls") && code.includes("rolsuper"));
});

test("ACL grantee filter is limited to PUBLIC and the three fixed Supabase roles, in one place", () => {
  const uncommented = stripComments(sqlText);
  assert.equal([...uncommented.matchAll(/aclexplode\s*\(/gi)].length, 1, "one shared aclexplode");
  // Role names are longer than the one-letter relkind lists that also use in (...).
  const filters = [...uncommented.matchAll(/in \('([a-z_]{4,})', '([a-z_]{4,})', '([a-z_]{4,})'\)/g)];
  assert.equal(filters.length, 1);
  assert.deepEqual([filters[0][1], filters[0][2], filters[0][3]], ["anon", "authenticated", "service_role"]);
});

test("role facts cover exactly the four API roles", () => {
  const m = stripComments(sqlText).match(/where r\.rolname in \(([^)]*)\)/);
  assert.ok(m, "roles filter missing");
  assert.deepEqual(
    [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]),
    ["anon", "authenticated", "authenticator", "service_role"],
  );
});

test("extensions are an allowlist, not the full installed set", () => {
  const m = stripComments(sqlText).match(/unnest\(array\[([^\]]*)\]\) as a\(n\)/);
  assert.ok(m, "extension allowlist missing");
  assert.deepEqual(
    [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    ["pg_cron", "pgcrypto", "pg_net", "uuid-ossp", "plpgsql"],
  );
  assert.doesNotMatch(code, /from pg_extension e\s*(order|\)|$)/i);
});

