import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

import {
  AccessStoreError,
  accessRpc,
  isClosureEnabled,
  setClosure,
  type AccessRpcClient,
} from "./access-store.ts";

// Offline contract tests for the owner-only site-closure flag (21-04, ACC-09 / D-05 / D-08 / T-21-19).
// No database is available here: the SQL is checked as text, and Postgres/RLS behaviour stays BLOCKED until an
// isolated staging run (plan 21-07).

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const migrationPath = join(repoRoot, "supabase", "migrations", "20261109000000_portia_access_foundation.sql");
const raw = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
// Comment-stripped text so a rule mentioned only in a header comment cannot satisfy a contract.
const sql = raw.replace(/--[^\n]*/g, "");

function functionParts(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is missing from the migration`);
  const bodyStart = sql.indexOf("as $$", start);
  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);
  assert.ok(bodyStart > start && bodyEnd > bodyStart, `${name}: cannot find its $$ body`);
  return { header: sql.slice(start, bodyStart), body: sql.slice(bodyStart + 5, bodyEnd), start };
}

function grantedRoles(name: string) {
  const roles = new Set<string>();
  for (const match of sql.matchAll(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to ([^;]+);`, "g"))) {
    for (const role of match[1].split(",")) roles.add(role.trim());
  }
  return roles;
}

const journalInsert = /insert into public\.portia_access_journal/;

test("ACC-09 / D-05 the flag is row 'main' of portia_access_settings, created OFF and never flipped by a re-run", () => {
  assert.match(sql, /create table if not exists public\.portia_access_settings \(/);
  assert.match(sql, /id text primary key/);
  assert.match(sql, /constraint portia_access_settings_id_check check \(id = 'main'\)/);
  assert.match(sql, /closure_enabled boolean not null default false/);
  assert.match(sql, /updated_at timestamptz not null default now\(\)/);
  assert.match(sql, /updated_by uuid null/);
  assert.match(
    sql,
    /insert into public\.portia_access_settings \(id, closure_enabled\) values \('main', false\)\s+on conflict \(id\) do nothing;/,
  );
  assert.ok(sql.includes("values ('main', false)"), "default OFF");
  assert.ok(!/values \('main', true\)/.test(sql), "never created ON");
});

test("ACC-09 the settings table is closed to every API role (RPC only)", () => {
  assert.ok(sql.includes("alter table public.portia_access_settings enable row level security;"));
  assert.ok(sql.includes("revoke all on table public.portia_access_settings from public, anon, authenticated;"));
  assert.ok(sql.includes("grant all on table public.portia_access_settings to service_role;"));
  assert.ok(!/create\s+policy/i.test(sql), "no policies: RPC only");
  assert.ok(!/references\s+auth\./i.test(sql), "no foreign key to auth.users");
});

test("ACC-09 closure_enabled reads the stored value, false when the row is missing, for anon and authenticated", () => {
  const { header, body } = functionParts("portia_access_closure_enabled");
  assert.match(header, /portia_access_closure_enabled\(\)/);
  assert.ok(header.includes("returns boolean") && header.includes("language sql") && header.includes("stable"));
  assert.ok(header.includes("security definer") && header.includes("set search_path = ''"));
  assert.match(body, /coalesce\(/);
  assert.match(body, /from public\.portia_access_settings/);
  assert.match(body, /id = 'main'/);
  assert.match(body, /false\)/, "false when the row is missing");
  const roles = grantedRoles("portia_access_closure_enabled");
  assert.ok(roles.has("anon") && roles.has("authenticated") && roles.has("service_role"));
  const start = functionParts("portia_access_closure_enabled").start;
  const revoke = sql.indexOf("revoke all on function public.portia_access_closure_enabled() from public, anon, authenticated;", start);
  const grant = sql.indexOf("grant execute on function public.portia_access_closure_enabled()", start);
  assert.ok(revoke > 0 && grant > revoke, "revoke all before grant");
});

test("T-21-19 / D-05 set_closure: owner-only first statement, null is invalid, upsert with last-change metadata", () => {
  const { header, body } = functionParts("portia_access_set_closure");
  assert.match(header, /portia_access_set_closure\(p_enabled boolean\)/);
  assert.ok(header.includes("returns jsonb") && header.includes("language plpgsql") && header.includes("volatile"));
  assert.ok(header.includes("security definer") && header.includes("set search_path = ''"));
  const first = body.split("begin\n")[1].split("\n")[0].trim();
  assert.equal(first, "if not public.portia_is_owner() then raise exception 'owner-required'; end if;");
  assert.ok(body.indexOf("p_enabled is null") > body.indexOf("owner-required"), "the owner check comes before everything else");
  assert.match(body, /p_enabled is null[\s\S]*?'code', 'invalid'/);
  assert.match(body, /insert into public\.portia_access_settings/);
  assert.match(body, /on conflict \(id\) do update\s+set/);
  assert.match(body, /closure_enabled = (excluded\.closure_enabled|p_enabled)/);
  assert.match(body, /updated_at = now\(\)/);
  assert.match(body, /updated_by = auth\.uid\(\)/);
  assert.match(body, /'code', 'updated'/);
  assert.match(body, /'enabled'/);
  assert.match(body, /'updatedAt'/);
  const roles = grantedRoles("portia_access_set_closure");
  assert.deepEqual([...roles].sort(), ["authenticated", "service_role"], "never anon");
  const start = functionParts("portia_access_set_closure").start;
  const revoke = sql.indexOf("revoke all on function public.portia_access_set_closure(boolean) from public, anon, authenticated;", start);
  const grant = sql.indexOf("grant execute on function public.portia_access_set_closure(boolean)", start);
  assert.ok(revoke > 0 && grant > revoke, "revoke all before grant");
});

test("D-08 / D-07 flag toggles carry updated_at and updated_by and are NOT written to the people journal", () => {
  for (const name of ["portia_access_closure_enabled", "portia_access_set_closure"]) {
    assert.ok(!journalInsert.test(functionParts(name).body), `${name} must not insert into portia_access_journal`);
  }
  assert.ok(!sql.includes("'closure"), "the journal event vocabulary gains no closure event");
  const eventTypes = sql.match(/event_type in \(([^)]*)\)/)?.[1] ?? "";
  assert.ok(!/closure/.test(eventTypes), "journal event types are people decisions only");
});

test("ACC-09 requests are collected whether the flag is OFF or ON: submit never reads the flag", () => {
  const { body } = functionParts("portia_access_submit_request");
  assert.ok(!body.includes("portia_access_settings"));
  assert.ok(!body.includes("portia_access_closure_enabled"));
  assert.ok(!body.includes("closure"));
});

test("ACC-09 the site behaves as before: no product code reads the flag in Phase 21", () => {
  const roots = ["app", "components", "lib"].map((dir) => join(repoRoot, dir));
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(entry)) continue;
      const rel = relative(repoRoot, full).split(sep).join("/");
      if (rel === "lib/access-store.ts" || rel.endsWith(".test.ts")) continue;
      const text = readFileSync(full, "utf8");
      if (/portia_access_closure_enabled|portia_access_set_closure|portia_access_settings|isClosureEnabled|setClosure/.test(text)) {
        offenders.push(rel);
      }
    }
  };
  for (const dir of roots) walk(dir);
  assert.deepEqual(offenders, []);
});

type Call = { fn: string; args: Record<string, unknown> | undefined };

function stubClient(replies: Record<string, unknown>, calls: Call[] = []): AccessRpcClient {
  return {
    rpc(fn, args) {
      calls.push({ fn, args });
      const reply = replies[fn];
      if (reply instanceof Error) return Promise.resolve({ data: null, error: { message: reply.message } });
      return Promise.resolve({ data: reply, error: null });
    },
  };
}

test("ACC-09 isClosureEnabled returns a boolean and fails closed on any other reply", async () => {
  assert.equal(accessRpc.closureEnabled, "portia_access_closure_enabled");
  const calls: Call[] = [];
  assert.equal(await isClosureEnabled(stubClient({ [accessRpc.closureEnabled]: false }, calls)), false);
  assert.equal(await isClosureEnabled(stubClient({ [accessRpc.closureEnabled]: true })), true);
  assert.deepEqual(calls[0], { fn: "portia_access_closure_enabled", args: {} });
  const unexpected = (error: unknown) => error instanceof AccessStoreError && error.code === "unexpected-reply";
  for (const reply of [null, undefined, "true", 1, { code: "x" }, [true]]) {
    await assert.rejects(() => isClosureEnabled(stubClient({ [accessRpc.closureEnabled]: reply })), unexpected);
  }
  await assert.rejects(
    () => isClosureEnabled(stubClient({ [accessRpc.closureEnabled]: new Error("boom") })),
    (error) => error instanceof AccessStoreError && error.code === "boom",
  );
});

test("D-05 setClosure sends p_enabled, maps updated and invalid, passes owner-required through", async () => {
  assert.equal(accessRpc.setClosure, "portia_access_set_closure");
  const calls: Call[] = [];
  const updatedAt = "2026-11-09T12:00:00+00:00";
  const client = stubClient({ [accessRpc.setClosure]: { code: "updated", enabled: true, updatedAt } }, calls);
  assert.deepEqual(await setClosure(client, { enabled: true }), { code: "updated", enabled: true, updatedAt });
  assert.deepEqual(calls[0], { fn: "portia_access_set_closure", args: { p_enabled: true } });
  assert.deepEqual(
    await setClosure(stubClient({ [accessRpc.setClosure]: { code: "invalid" } }), { enabled: false }),
    { code: "invalid" },
  );
  const unexpected = (error: unknown) => error instanceof AccessStoreError && error.code === "unexpected-reply";
  await assert.rejects(() => setClosure(stubClient({ [accessRpc.setClosure]: { code: "surprise" } }), { enabled: true }), unexpected);
  await assert.rejects(() => setClosure(stubClient({ [accessRpc.setClosure]: { code: "updated", enabled: "yes", updatedAt } }), { enabled: true }), unexpected);
  await assert.rejects(() => setClosure(stubClient({ [accessRpc.setClosure]: { code: "updated", enabled: true } }), { enabled: true }), unexpected);
  await assert.rejects(
    () => setClosure(stubClient({ [accessRpc.setClosure]: new Error("owner-required") }), { enabled: true }),
    (error) => error instanceof AccessStoreError && error.code === "owner-required",
  );
});
