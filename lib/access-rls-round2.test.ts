import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Contract tests for the round 2 findings of the supabase-rls-reviewer (21-RLS-REVIEW.md, RLS21-09..RLS21-14). The SQL is
// checked as text; Postgres/RLS execution stays BLOCKED until an isolated staging run.

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sql = readFileSync(join(repoRoot, "supabase", "migrations", "20261109000000_portia_access_foundation.sql"), "utf8").replace(/\r\n/g, "\n");
const privileged = "service_role";

function submitBody() {
  const start = sql.indexOf("create or replace function public.portia_access_submit_request(");
  assert.ok(start >= 0);
  const bodyStart = sql.indexOf("as $$", start);
  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);
  return { start, body: sql.slice(bodyStart + 5, bodyEnd) };
}

test("RLS21-09: the unsigned round 1 overload is dropped before the signed function is created", () => {
  const drop = "drop function if exists public.portia_access_submit_request(text, text, text, text);";
  const dropAt = sql.indexOf(drop);
  assert.ok(dropAt >= 0, "drop of the (text, text, text, text) overload");
  assert.equal(sql.indexOf(drop, dropAt + 1), -1, "dropped once");
  const createAt = sql.indexOf("create or replace function public.portia_access_submit_request(");
  assert.ok(dropAt < createAt, "drop comes before create");
  // Only the exact old signature: the new six-parameter function must not be touched by a drop.
  assert.deepEqual(
    [...sql.matchAll(/^drop function [^;]*portia_access_submit_request[^;]*;/gm)].map((match) => match[0]),
    [drop],
  );
});

test("RLS21-10: the journal sequence gives the privileged role usage and select only, never update (setval)", () => {
  const revoke = `revoke all on sequence public.portia_access_journal_id_seq from ${privileged};`;
  const grant = `grant usage, select on sequence public.portia_access_journal_id_seq to ${privileged};`;
  assert.ok(sql.includes("revoke all on sequence public.portia_access_journal_id_seq from public, anon, authenticated;"));
  assert.ok(sql.includes(revoke), "revoke all from the privileged role");
  assert.ok(sql.includes(grant), "grant usage, select");
  assert.ok(sql.indexOf(revoke) < sql.indexOf(grant), "revoke before grant");
  assert.doesNotMatch(sql, /grant all on sequence/i);
  assert.doesNotMatch(sql, /grant [^;]*\bupdate\b[^;]* on sequence/i);
});

test("RLS21-11: a caller without a valid signature can never get created, pending or any other signed-path answer", () => {
  const { body } = submitBody();
  const gate = body.indexOf("return jsonb_build_object('code', 'unauthorized');");
  assert.ok(gate > 0, "the unauthorized refusal exists");
  assert.equal(body.split("'unauthorized'").length - 1, 1, "one neutral refusal, one place");
  // Everything that can say created / pending / approved / throttled / cooldown or write a row sits after the gate.
  for (const marker of ["'created'", "'pending'", "'approved'", "'throttled'", "'unavailable'", "'device-busy'", "'cooldown'", "insert into", "pg_advisory_xact_lock"]) {
    assert.ok(body.indexOf(marker) > gate, `${marker} must come after the signature gate`);
  }
  // The refusal is taken when the signature does not match: the comparison and the unauthorized return form one `if`.
  const gateStatement = body.slice(body.lastIndexOf("  if signing_secret is null", gate), gate);
  assert.match(gateStatement, /extensions\.digest\(p_signature, 'sha256'\) is distinct from extensions\.digest\(expected_signature, 'sha256'\)/);
  assert.match(gateStatement, /signing_secret is null/);
  // The matrix probe is unsigned by construction (stale time, zero signature): see lib/phase16-expected-authz.test.ts.
  const matrix = JSON.parse(readFileSync(join(repoRoot, "tests", "e2e", "fixtures", "data", "expected-authz.json"), "utf8"));
  const probe = matrix.functions.find((fn: { name: string }) => fn.name === "portia_access_submit_request");
  assert.equal(probe.args.p_issued_at, 0);
  assert.match(probe.args.p_signature, /^0{64}$/);
  assert.equal(probe.creates_rows, false);
  assert.deepEqual(probe.expected_response, { code: "unauthorized" }, "the unsigned probe is pinned to the neutral refusal");
});

test("RLS21-13: the owner step checks the secret length before it inserts, so the check constraint never fires with the secret in DETAIL", () => {
  const header = sql.slice(0, sql.indexOf("-- a. One nickname rule"));
  const insertAt = header.indexOf("insert into public.portia_access_secrets");
  assert.ok(insertAt > 0, "the owner step is in the header");
  const step = header.slice(header.lastIndexOf("-- OWNER STEP"), header.indexOf("-- Rotating the secret"));
  assert.match(step, /length[^\n]*>= 32/i, "the step names the 32-character minimum check");
  const lengthAt = step.search(/where length\(\w+\) >= 32/);
  assert.ok(lengthAt >= 0, "the insert is guarded by a length condition, not left to the table check");
  assert.ok(step.includes("select 'submit'"), "insert ... select form, so a short value inserts nothing instead of raising");
  assert.match(step, /1 row/i, "the owner confirms that one row was written");
  assert.match(header, /unauthorized[^\n]*(alarm|alert|log)/i, "the route must log every unauthorized");
  assert.ok(!sql.includes("values ('submit'"), "no insert values form that would hit the check constraint with the secret in DETAIL");
});

test("RLS21-14: the legacy setup scripts that still grant bind_device to anon are pinned by hash, so they are deferred, not edited", () => {
  const parity = readFileSync(join(repoRoot, "lib", "portia-canonical-parity.test.ts"), "utf8");
  assert.match(parity, /"portia_setup\.sql": "[0-9a-f]{64}"/);
  assert.match(parity, /"phase14_apply\.sql": "[0-9a-f]{64}"/);
  // The effective schema comes from the migrations: the Phase 21 migration revokes bind_device from anon at the end.
  assert.match(sql, /^revoke all on function public\.portia_promo_bind_device\(text, text, text\) from public, anon, authenticated;/m);
});
