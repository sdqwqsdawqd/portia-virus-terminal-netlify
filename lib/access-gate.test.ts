import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { accessTokenDigest } from "./access-session.ts";
import { isMissingClosureFunction, onceWarn, resolveGate, type GateDecision } from "./access-gate.ts";
import { ACCESS_APPROVED_NOTICE_KEY, accessGateLayout, accessSubmitFailure, claimApprovedNotice } from "./access-gate-view.ts";
import { AccessStoreError, type AccessRpcClient } from "./access-store.ts";
import { getEditorAccess } from "./editor-access.ts";

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

const closedNone = { mode: "closed", state: { state: "none" }, allowed: false, level: null, editor: false };

type ProbeReply = { status: number; body: unknown };

// A real @supabase/ssr client on a reserved, unreachable host: every request goes to the injected fetch, which answers
// from the table (exact "METHOD path" key first, then a path prefix) and records the call. Nothing leaves the machine.
function probeClient(cookies: Array<{ name: string; value: string }>, routes: Record<string, ProbeReply>) {
  const calls: string[] = [];
  const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const key = `${method} ${url.pathname}`;
    const reply = url.origin === "https://probe.invalid"
      ? routes[key] ?? Object.entries(routes).find(([prefix]) => key.startsWith(prefix))?.[1]
      : undefined;
    if (!reply) {
      calls.push(`UNEXPECTED ${method} ${url.origin}${url.pathname}`);
      assert.fail(`unexpected request ${method} ${url.href}`);
    }
    calls.push(key);
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const client = createServerClient("https://probe.invalid", "probe-key", {
    cookies: { getAll: () => cookies, setAll: () => {} },
    global: { fetch: stub },
  });
  return { client, calls };
}

// Verbatim copy of the editorAccess callback of app/api/access/status/route.ts.
function routeEditorAccess(client: SupabaseClient) {
  return async () => {
    const { data, error } = await client.auth.getUser();
    if (isAuthRetryableFetchError(error)) return { canEdit: false, unavailable: true as const };
    const access = await getEditorAccess(client, data.user);
    return { canEdit: access.canEdit, unavailable: access.unavailable };
  };
}

const closureRoute = "POST /rest/v1/rpc/portia_access_closure_enabled";

test("tracer: a real Supabase client answering PGRST202 yields the closed request screen with one request (G-PORTIA-23-4)", async () => {
  const { client, calls } = probeClient([], {
    [closureRoute]: { status: 404, body: { code: "PGRST202", details: null, hint: null, message: "Could not find the function public.portia_access_closure_enabled without parameters in the schema cache" } },
  });
  const warnings: unknown[] = [];
  const decision = await resolveGate(new Headers(), {
    client, sessionSecret: secret, editorAccess: routeEditorAccess(client),
    warn: (_message, detail) => { warnings.push(detail); },
  });
  assert.deepEqual(decision, closedNone);
  assert.deepEqual(calls, [closureRoute]);
  assert.deepEqual(warnings, [{ sqlState: "PGRST202" }]);
  const layout = accessGateLayout({ kind: "decision", decision }, true);
  assert.equal(layout.desktop, false);
  assert.equal(layout.showCard, true);
  assert.equal(layout.showForm, true);
  assert.equal(layout.showReopen, false);
  assert.equal(layout.showError, false);
  assert.equal(layout.status, null);
});

test("missing closure function closes the site and keeps the request form (G-PORTIA-23-4)", async () => {
  for (const reply of missingClosureReplies) {
    const called: string[] = [];
    const warnings: Array<{ message: string; detail: unknown }> = [];
    const decision = await resolveGate(headers, {
      client: recordingClient({ error: reply }, called),
      sessionSecret: secret,
      editorAccess: async () => ({ canEdit: false }),
      warn: (message, detail) => { warnings.push({ message, detail }); },
    });
    assert.deepEqual(decision, closedNone);
    assert.deepEqual(called, ["portia_access_closure_enabled"]);
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0].detail, { sqlState: reply.code });
    const layout = accessGateLayout({ kind: "decision", decision: decision as GateDecision }, true);
    assert.equal(layout.desktop, false);
    assert.equal(layout.showCard, true);
    assert.equal(layout.showForm, true);
  }
  const forwarded: Array<[string, unknown]> = [];
  const warn = onceWarn((message, detail) => { forwarded.push([message, detail]); });
  warn("first", { sqlState: "PGRST202" });
  warn("second", { sqlState: "42883" });
  warn("third", { sqlState: null });
  assert.deepEqual(forwarded, [["first", { sqlState: "PGRST202" }]]);
});

type ClosureReply = { data?: unknown; error?: { message: string; code?: string } | null } | "reject";

function closureClient(closure: ClosureReply, called: string[]): AccessRpcClient {
  return { rpc(fn) {
    called.push(fn);
    if (fn !== "portia_access_closure_enabled") assert.fail(`unexpected rpc ${fn}`);
    if (closure === "reject") return Promise.reject(new Error("socket hang up"));
    return Promise.resolve({ data: closure.data ?? null, error: closure.error ?? null });
  } };
}

const editorDecision = { mode: "closed", state: { state: "none" }, allowed: true, level: 5, editor: true };

test("verified editor gets the desktop before the closure flag is read", async () => {
  const replies: ClosureReply[] = [
    { data: true },
    { data: false },
    { error: { code: "PGRST202", message: "Could not find the public.portia_access_closure_enabled() function in the schema cache" } },
    { error: { code: "", message: "TypeError: fetch failed" } },
    "reject",
  ];
  for (const reply of replies) {
    const called: string[] = [];
    const decision = await resolveGate(headers, { client: closureClient(reply, called), sessionSecret: secret, editorAccess: async () => ({ canEdit: true }) });
    assert.deepEqual(decision, editorDecision);
    assert.deepEqual(called, []);
  }
});

const failClosedReplies: ClosureReply[] = [
  { error: { code: "PGRST202", message: "Could not find the function public.portia_access_resolve(p_token_hash) in the schema cache" } },
  { error: { code: "42883", message: "operator does not exist: text = integer" } },
  { error: { code: "42883", message: "function public.portia_access_closure_enabled_legacy() does not exist" } },
  { error: { code: "42501", message: "permission denied for function portia_access_closure_enabled" } },
  { error: { code: "PGRST002", message: "Could not query the database for the schema cache. Retrying." } },
  { error: { code: "57014", message: "canceling statement due to statement timeout" } },
  { error: { code: "", message: "TypeError: fetch failed" } },
  { error: { code: "", message: "AbortError: This operation was aborted" } },
  { error: { message: "Could not find the function public.portia_access_closure_enabled without parameters in the schema cache" } },
  { data: "yes" },
  "reject",
];

test("only the exact missing closure function gets the closed request screen; every other closure failure stays fail-closed", async () => {
  for (const reply of failClosedReplies) {
    const called: string[] = [];
    let warned = 0;
    const error = await resolveGate(headers, {
      client: closureClient(reply, called), sessionSecret: secret,
      editorAccess: async () => ({ canEdit: false }), warn: () => { warned += 1; },
    }).then(() => null, (caught: unknown) => caught);
    assert.notEqual(error, null, JSON.stringify(reply));
    assert.equal(warned, 0, JSON.stringify(reply));
    assert.equal(isMissingClosureFunction(error), false, JSON.stringify(reply));
    assert.deepEqual(called, ["portia_access_closure_enabled"]);
  }
  assert.equal(isMissingClosureFunction(new Error("x")), false);
  assert.equal(isMissingClosureFunction(new AccessStoreError("function public.portia_access_closure_enabled() does not exist", "PGRST203")), false);
  assert.equal(isMissingClosureFunction(new AccessStoreError("function public.portia_access_closure_enabled() does not exist", "42883")), true);
});

test("unavailable or failing editor verification keeps the previous branch behaviour", async () => {
  const editors: Array<() => Promise<{ canEdit: boolean; unavailable?: true }>> = [
    async () => ({ canEdit: false, unavailable: true }),
    async () => ({ canEdit: true, unavailable: true }),
    async () => { throw new Error("editor lookup failed"); },
  ];
  const missing: ClosureReply = { error: { code: "PGRST202", message: "Could not find the function public.portia_access_closure_enabled without parameters in the schema cache" } };
  for (const editorAccess of editors) {
    const run = (closure: ClosureReply) => resolveGate(headers, { client: closureClient(closure, []), sessionSecret: secret, editorAccess, warn: () => {} });
    const off = await run({ data: false });
    assert.equal(off.mode === "closed" && off.editor, false);
    assert.equal(off.mode, "open");
    await assert.rejects(run(missing), { message: "Editor verification unavailable." });
    await assert.rejects(run({ data: true }));
    await assert.rejects(run({ error: { code: "", message: "TypeError: fetch failed" } }));
  }
});

test("gate layout: open mode shows desktop and the request form; closed and error states never mount the desktop", () => {
  const closed = (state: GateDecision["state"], allowed = false): GateDecision => ({ mode: "closed", state, allowed, level: allowed ? 2 : null, editor: false });
  assert.deepEqual(accessGateLayout({ kind: "decision", decision: { mode: "open", state: { state: "none" } } }, true), { desktop: true, showCard: true, showForm: true, showReopen: false, showError: false, status: null, approvedNotice: false });
  assert.deepEqual(accessGateLayout({ kind: "decision", decision: { mode: "open", state: { state: "none" } } }, false), { desktop: true, showCard: false, showForm: true, showReopen: true, showError: false, status: null, approvedNotice: false });
  assert.deepEqual(accessGateLayout({ kind: "decision", decision: closed({ state: "none" }) }, true), { desktop: false, showCard: true, showForm: true, showReopen: false, showError: false, status: null, approvedNotice: false });
  assert.deepEqual(accessGateLayout({ kind: "decision", decision: closed({ state: "pending", nickname: "Visitor_1" }) }, true), { desktop: false, showCard: true, showForm: false, showReopen: false, showError: false, status: "pending", approvedNotice: false });
  assert.deepEqual(accessGateLayout({ kind: "decision", decision: closed({ state: "approved", nickname: "Visitor_1", level: 2, origin: "sheet" }, true) }, false), { desktop: true, showCard: false, showForm: false, showReopen: false, showError: false, status: "approved", approvedNotice: true });
  assert.deepEqual(accessGateLayout({ kind: "error" }, true), { desktop: false, showCard: true, showForm: false, showReopen: false, showError: true, status: null, approvedNotice: false });
  assert.deepEqual(accessGateLayout({ kind: "checking" }, true), { desktop: false, showCard: true, showForm: false, showReopen: false, showError: false, status: null, approvedNotice: false });
});

test("gate layout: a verified editor never sees the visitor card, form or reopen button (WR-04)", () => {
  const editor: GateDecision = { mode: "closed", state: { state: "none" }, allowed: true, level: 5, editor: true };
  for (const cardOpen of [true, false]) {
    assert.deepEqual(accessGateLayout({ kind: "decision", decision: editor }, cardOpen), { desktop: true, showCard: false, showForm: false, showReopen: false, showError: false, status: null, approvedNotice: false });
  }
});

test("gate layout: an approved visitor on an open desktop gets no card and no reopen button, only the one-time notice (G-PORTIA-23-3-r2)", () => {
  const approvedState = { state: "approved", nickname: "Visitor_1", level: 2, origin: "sheet" } as const;
  const approvedLayout = { desktop: true, showCard: false, showForm: false, showReopen: false, showError: false, status: "approved", approvedNotice: true };
  const closedApproved: GateDecision = { mode: "closed", state: approvedState, allowed: true, level: 2, editor: false };
  const openApproved: GateDecision = { mode: "open", state: approvedState };
  for (const cardOpen of [true, false]) {
    assert.deepEqual(accessGateLayout({ kind: "decision", decision: closedApproved }, cardOpen), approvedLayout);
    assert.deepEqual(accessGateLayout({ kind: "decision", decision: openApproved }, cardOpen), approvedLayout);
  }
  // Approved but not allowed: the card with its status text stays, no desktop and no notice.
  const notAllowed: GateDecision = { mode: "closed", state: approvedState, allowed: false, level: null, editor: false };
  assert.deepEqual(accessGateLayout({ kind: "decision", decision: notAllowed }, true), { desktop: false, showCard: true, showForm: false, showReopen: false, showError: false, status: "approved", approvedNotice: false });
  // D-05 unchanged: open mode keeps the card and the reopen button for every non-approved state.
  const openStates: GateDecision["state"][] = [{ state: "none" }, { state: "pending", nickname: "Visitor_1" }, { state: "rejected", nickname: "Visitor_1", retryAt: null }, { state: "revoked", nickname: "Visitor_1", retryAt: null }];
  for (const state of openStates) {
    const decision: GateDecision = { mode: "open", state };
    const shown = accessGateLayout({ kind: "decision", decision }, true);
    const hidden = accessGateLayout({ kind: "decision", decision }, false);
    assert.equal(shown.showCard, true, state.state);
    assert.equal(shown.showReopen, false, state.state);
    assert.equal(hidden.showCard, false, state.state);
    assert.equal(hidden.showReopen, true, state.state);
    assert.equal(shown.approvedNotice, false, state.state);
    assert.equal(hidden.approvedNotice, false, state.state);
  }
  // WR-04, D-03, D-08: a verified editor never sees the notice.
  const editor: GateDecision = { mode: "closed", state: approvedState, allowed: true, level: 5, editor: true };
  for (const cardOpen of [true, false]) {
    assert.equal(accessGateLayout({ kind: "decision", decision: editor }, cardOpen).approvedNotice, false);
  }
});

test("approved notice is claimed once per device and never when storage fails (G-PORTIA-23-3-r2)", () => {
  assert.equal(ACCESS_APPROVED_NOTICE_KEY, "portia-access-approved-notice-v1");
  const fake = (initial?: string) => {
    const map = new Map<string, string>();
    if (initial !== undefined) map.set(ACCESS_APPROVED_NOTICE_KEY, initial);
    const writes: Array<[string, string]> = [];
    return { map, writes, storage: { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { writes.push([key, value]); map.set(key, value); } } };
  };
  const once = fake();
  assert.equal(claimApprovedNotice(() => once.storage), true);
  assert.equal(once.map.get(ACCESS_APPROVED_NOTICE_KEY), "1");
  assert.equal(claimApprovedNotice(() => once.storage), false);
  assert.equal(once.writes.length, 1);
  const done = fake("1");
  assert.equal(claimApprovedNotice(() => done.storage), false);
  assert.equal(done.writes.length, 0);
  const odd = fake("yes");
  assert.equal(claimApprovedNotice(() => odd.storage), true);
  assert.equal(odd.map.get(ACCESS_APPROVED_NOTICE_KEY), "1");
  assert.equal(claimApprovedNotice(() => { throw new Error("storage access denied"); }), false);
  let setCalls = 0;
  assert.equal(claimApprovedNotice(() => ({ getItem: () => { throw new Error("read failed"); }, setItem: () => { setCalls++; } })), false);
  assert.equal(setCalls, 0);
  assert.equal(claimApprovedNotice(() => ({ getItem: () => null, setItem: () => { throw new Error("quota exceeded"); } })), false);
});

test("approved notice looks like the quest notice, never takes focus and closes on × or Escape outside inputs and dialogs (G-PORTIA-23-3-r2)", () => {
  const component = readFileSync(fileURLToPath(new URL("../components/portia-access-gate.tsx", import.meta.url)), "utf8");
  const declaration = component.indexOf("function AccessApprovedToast");
  assert.ok(declaration >= 0, "AccessApprovedToast is declared");
  const nextFunction = component.indexOf("\nfunction ", declaration + 1);
  const body = component.slice(declaration, nextFunction < 0 ? undefined : nextFunction);
  const aside = body.match(/<aside[^>]*>/)?.[0] ?? "";
  assert.ok(aside.includes("portia-dialog quest-toast access-approved-toast"));
  assert.ok(aside.includes("aria-labelledby"));
  assert.doesNotMatch(aside, /role=/);
  assert.doesNotMatch(aside, /onKeyDown/);
  for (const part of [
    '<span role="status" className="sr-only">Доступ подтверждён.</span>',
    'className="quest-toast-head"',
    'className="quest-toast-eyebrow"',
    'className="quest-toast-close"',
    'aria-label="Закрыть уведомление"',
    "<h2 id={titleId}>Доступ подтверждён</h2>",
    'window.document.addEventListener("keydown"',
    'window.document.removeEventListener("keydown"',
    "defaultPrevented",
    "isContentEditable",
    'closest("input, textarea, select")',
    "dialog[open]",
    "event.preventDefault()",
  ]) assert.ok(body.includes(part), part);
  assert.doesNotMatch(body, /autoFocus|\.focus\(/);
  assert.ok(component.includes("claimApprovedNotice(() => window.localStorage)"));
  assert.ok(component.includes("layout.approvedNotice"));
  const css = readFileSync(fileURLToPath(new URL("../app/portia.css", import.meta.url)), "utf8");
  assert.ok(css.includes(".access-approved-toast { border-color: var(--teal-dim); }"));
  assert.ok(css.includes(".access-approved-toast .quest-toast-eyebrow { color: var(--teal); }"));
});

test("request form shows only known or server failure texts, never a raw exception (WR-03)", () => {
  const generalText = "Не удалось отправить заявку. Проверьте соединение и повторите.";
  for (const body of [null, "<!DOCTYPE html>", [], {}, { error: "" }, { error: 42 }, { error: "x".repeat(301) }, { error: "   " }]) {
    assert.deepEqual(accessSubmitFailure(body), { kind: "default" }, JSON.stringify(body));
  }
  assert.deepEqual(accessSubmitFailure({ code: "device-busy" }), { kind: "device-busy" });
  assert.deepEqual(accessSubmitFailure({ code: "cooldown", retryAt: "2026-11-14T18:00:00Z" }), { kind: "cooldown" });
  assert.deepEqual(accessSubmitFailure({ code: "throttled" }), { kind: "throttled" });
  assert.deepEqual(accessSubmitFailure({ code: "unavailable", error: generalText }), { kind: "server", text: generalText });
  assert.deepEqual(accessSubmitFailure({ code: "cooldown", error: "server text" }), { kind: "cooldown" });
  assert.deepEqual(accessSubmitFailure({ error: "x".repeat(300) }), { kind: "server", text: "x".repeat(300) });
  const component = readFileSync(fileURLToPath(new URL("../components/portia-access-gate.tsx", import.meta.url)), "utf8");
  assert.ok(component.includes("accessSubmitFailure("));
  assert.ok(component.includes("layout.showReopen"));
  assert.ok(component.includes(".json().catch("));
  assert.doesNotMatch(component, /error\.message/);
});

test("status route keeps a missing session secret fail-closed and the view helper stays client-safe", () => {
  const route = readFileSync(fileURLToPath(new URL("../app/api/access/status/route.ts", import.meta.url)), "utf8");
  assert.match(route, /try \{[\s\S]*sessionSecret: accessSessionSecret\(\)[\s\S]*\} catch[\s\S]*status: 503/);
  const view = readFileSync(fileURLToPath(new URL("./access-gate-view.ts", import.meta.url)), "utf8");
  const imports = view.split(/\r?\n/).filter((line) => line.startsWith("import"));
  assert.ok(imports.length > 0);
  for (const line of imports) assert.match(line, /^import type /);
});

test("status poll network budget: an anonymous visitor makes one request and a signed-in editor never reads the closure flag", async () => {
  const dependencies = (client: ReturnType<typeof probeClient>["client"]) => ({ client, sessionSecret: secret, editorAccess: routeEditorAccess(client), warn: () => {} });

  // (a) anonymous visitor, closure ON: one request.
  const a = probeClient([], { [closureRoute]: { status: 200, body: true } });
  assert.deepEqual(await resolveGate(new Headers(), dependencies(a.client)), closedNone);
  assert.deepEqual(a.calls, [closureRoute]);

  // (b) anonymous visitor, closure OFF: one request.
  const b = probeClient([], { [closureRoute]: { status: 200, body: false } });
  assert.equal((await resolveGate(new Headers(), dependencies(b.client))).mode, "open");
  assert.deepEqual(b.calls, [closureRoute]);

  // (c) visitor with a device cookie, closure ON: closure flag, then the token resolve.
  const c = probeClient([], {
    [closureRoute]: { status: 200, body: true },
    "POST /rest/v1/rpc/portia_access_resolve": { status: 200, body: { state: "pending", nickname: "Visitor_1" } },
  });
  assert.deepEqual(await resolveGate(headers, dependencies(c.client)), { mode: "closed", state: { state: "pending", nickname: "Visitor_1" }, allowed: false, level: null, editor: false });
  assert.deepEqual(c.calls, [closureRoute, "POST /rest/v1/rpc/portia_access_resolve"]);

  // (d) signed-in owner-editor: user lookup, then three parallel lookups, and no closure read at all.
  const user = {
    id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "editor@example.invalid",
    email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
  };
  const session = { access_token: "h.e.s", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  const cookie = { name: "sb-probe-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
  const d = probeClient([cookie], {
    "GET /auth/v1/user": { status: 200, body: user },
    "POST /rest/v1/rpc/portia_can_edit": { status: 200, body: true },
    "POST /rest/v1/rpc/portia_is_owner": { status: 200, body: true },
    "GET /rest/v1/portia_editors": { status: 200, body: null },
  });
  assert.deepEqual(await resolveGate(new Headers(), dependencies(d.client)), editorDecision);
  assert.equal(d.calls[0], "GET /auth/v1/user");
  assert.deepEqual(d.calls.slice(1).sort(), ["GET /rest/v1/portia_editors", "POST /rest/v1/rpc/portia_can_edit", "POST /rest/v1/rpc/portia_is_owner"]);
  assert.equal(d.calls.length, 4);
  assert.ok(d.calls.every((call) => !call.includes("closure")));
});
