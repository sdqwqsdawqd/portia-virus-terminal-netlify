import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { accessTokenDigest } from "./access-session.ts";
import { resolveGate } from "./access-gate.ts";
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
  const approved = await resolveGate(headers, { client: client(true, { state: "approved", nickname: "Visitor_1", level: 2 }), sessionSecret: secret, editorAccess: async () => ({ canEdit: false }) });
  assert.deepEqual(approved, { mode: "closed", state: { state: "approved", nickname: "Visitor_1", level: 2 }, allowed: true, level: 2, editor: false });
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

test("home page's static shell contains no desktop content", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /PortiaAccessGate/);
  assert.doesNotMatch(page, /PortiaDesktop|defaultPortiaContent/);
});
