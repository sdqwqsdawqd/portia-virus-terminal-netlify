import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { accessTokenDigest } from "./access-session.ts";
import { onceWarn, resolveGate, type GateDecision } from "./access-gate.ts";
import { accessGateLayout } from "./access-gate-view.ts";
import type { AccessRpcClient } from "./access-store.ts";

const secret = "s".repeat(40);
const token = "a".repeat(43);
const headers = new Headers({ cookie: `portia_access=${token}` });

function client(closed: boolean, state: Record<string, unknown>): AccessRpcClient {
  return { rpc(fn, args) {
    if (fn === "portia_access_closure_enabled") return Promise.resolve({ data: closed, error: null });
    assert.equal(fn, "portia_access_resolve");
    assert.equal(args?.p_token_hash, accessTokenDigest(token, secret));
    return Promise.resolve({ data: state, error: null });
  } };
}

test("closed gate admits only approved current-device token", async () => {
  const approved = await resolveGate(headers, { client: client(true, { state: "approved", nickname: "Visitor_1", level: 2, origin: "sheet" }), sessionSecret: secret, editorAccess: async () => ({ canEdit: false }) });
  assert.deepEqual(approved, { mode: "closed", state: { state: "approved", nickname: "Visitor_1", level: 2, origin: "sheet" }, allowed: true, level: 2, editor: false });
  const pending = await resolveGate(headers, { client: client(true, { state: "pending", nickname: "Visitor_1" }), sessionSecret: secret, editorAccess: async () => ({ canEdit: false }) });
  assert.equal(pending.mode, "closed");
  assert.equal(pending.mode === "closed" && pending.allowed, false);
});

test("verified editor bypass requires a verified access reply", async () => {
  const editor = await resolveGate(new Headers(), { client: client(true, { state: "none" }), sessionSecret: secret, editorAccess: async () => ({ canEdit: true }) });
  assert.deepEqual(editor, { mode: "closed", state: { state: "none" }, allowed: true, level: 5, editor: true });
  await assert.rejects(resolveGate(new Headers(), { client: client(true, { state: "none" }), sessionSecret: secret, editorAccess: async () => ({ canEdit: false, unavailable: true }) }));
});

test("open gate stays usable when optional token resolution fails", async () => {
  const failing: AccessRpcClient = { rpc(fn) { return Promise.resolve(fn === "portia_access_closure_enabled" ? { data: false, error: null } : { data: null, error: { message: "offline" } }); } };
  const decision = await resolveGate(headers, { client: failing, sessionSecret: secret, editorAccess: async () => ({ canEdit: false }) });
  assert.equal(decision.mode, "open");
});

test("two devices resolve independently even when their nickname matches", async () => {
  const secondToken = "b".repeat(43);
  const seen: string[] = [];
  const rpc: AccessRpcClient = { rpc(fn, args) {
    if (fn === "portia_access_closure_enabled") return Promise.resolve({ data: true, error: null });
    const digest = String(args?.p_token_hash);
    seen.push(digest);
    return Promise.resolve({ data: digest === accessTokenDigest(token, secret)
      ? { state: "approved", nickname: "SameNick", level: 2, origin: "sheet" }
      : { state: "pending", nickname: "SameNick" }, error: null });
  } };
  const dependencies = { client: rpc, sessionSecret: secret, editorAccess: async () => ({ canEdit: false }) };
  const first = await resolveGate(headers, dependencies);
  const second = await resolveGate(new Headers({ cookie: `portia_access=${secondToken}` }), dependencies);
  assert.equal(first.mode === "closed" && first.allowed, true);
  assert.equal(second.mode === "closed" && second.allowed, false);
  assert.notEqual(seen[0], seen[1]);
});

test("repeated reads remain stable and revoked status closes the gate", async () => {
  let state: Record<string, unknown> = { state: "pending", nickname: "Visitor_1" };
  const rpc: AccessRpcClient = { rpc(fn) { return Promise.resolve({ data: fn === "portia_access_closure_enabled" ? true : state, error: null }); } };
  const dependencies = { client: rpc, sessionSecret: secret, editorAccess: async () => ({ canEdit: false }) };
  const pendingA = await resolveGate(headers, dependencies);
  const pendingB = await resolveGate(headers, dependencies);
  assert.deepEqual(pendingA, pendingB);
  state = { state: "approved", nickname: "Visitor_1", level: 2, origin: "sheet" };
  const approved = await resolveGate(headers, dependencies);
  assert.equal(approved.mode === "closed" && approved.allowed, true);
  state = { state: "revoked", nickname: "Visitor_1", retryAt: "2026-11-12T18:00:00Z" };
  const revoked = await resolveGate(headers, dependencies);
  assert.equal(revoked.mode === "closed" && revoked.allowed, false);
  assert.equal(revoked.state.state, "revoked");
});

test("home page's static shell contains no desktop content", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /PortiaAccessGate/);
  assert.doesNotMatch(page, /PortiaDesktop|defaultPortiaContent/);
});

const missingClosureReplies = [
  { code: "PGRST202", message: "Could not find the function public.portia_access_closure_enabled without parameters in the schema cache" },
  { code: "PGRST202", message: "Could not find the public.portia_access_closure_enabled() function in the schema cache" },
  { code: "42883", message: "function public.portia_access_closure_enabled() does not exist" },
];

function recordingClient(closure: { data?: unknown; error?: { message: string; code?: string } | null }, called: string[]): AccessRpcClient {
  return { rpc(fn) {
    called.push(fn);
    if (fn === "portia_access_closure_enabled") return Promise.resolve({ data: closure.data ?? null, error: closure.error ?? null });
    assert.fail(`unexpected rpc ${fn}`);
  } };
}

test("missing closure function opens the site with the request form (G-PORTIA-23-2/3)", async () => {
  for (const reply of missingClosureReplies) {
    const called: string[] = [];
    const warnings: Array<{ message: string; detail: unknown }> = [];
    const decision = await resolveGate(headers, {
      client: recordingClient({ error: reply }, called),
      sessionSecret: secret,
      editorAccess: async () => ({ canEdit: false }),
      warn: (message, detail) => { warnings.push({ message, detail }); },
    });
    assert.deepEqual(decision, { mode: "open", state: { state: "none" } });
    assert.deepEqual(called, ["portia_access_closure_enabled"]);
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0].detail, { sqlState: reply.code });
    const layout = accessGateLayout({ kind: "decision", decision: decision as GateDecision }, true);
    assert.deepEqual(layout, { desktop: true, showCard: true, showForm: true, showError: false, status: null });
  }
  const forwarded: Array<[string, unknown]> = [];
  const warn = onceWarn((message, detail) => { forwarded.push([message, detail]); });
  warn("first", { sqlState: "PGRST202" });
  warn("second", { sqlState: "42883" });
  warn("third", { sqlState: null });
  assert.deepEqual(forwarded, [["first", { sqlState: "PGRST202" }]]);
});
