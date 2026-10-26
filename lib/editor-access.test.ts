import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getEditorAccess, noAccess } from "./editor-access.ts";
import { tabRegistry } from "./editor-tabs.ts";

const allSeven = tabRegistry.map((tab) => tab.id);

type Reply = { data: unknown; error: { code?: string } | null };
function fakeClient(opts: { canEdit?: Reply; isOwner?: Reply; row?: Reply }) {
  const calls: string[] = [];
  const client = {
    rpc: async (name: string) => {
      calls.push(name);
      return (name === "portia_can_edit" ? opts.canEdit : opts.isOwner) ?? { data: false, error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => opts.row ?? { data: null, error: null } }) }) }),
  };
  return { supabase: client as unknown as SupabaseClient, calls };
}
const ok = (data: unknown): Reply => ({ data, error: null });
const confirmed = { email: "Ed@Example.com", email_confirmed_at: "2026-01-01T00:00:00Z" } as User;

test("unconfirmed email gets noAccess and makes zero rpc calls, owner included (SEC-01)", async () => {
  const { supabase, calls } = fakeClient({ canEdit: ok(true), isOwner: ok(true) });
  assert.deepEqual(await getEditorAccess(supabase, { email: "owner@example.com" } as User), noAccess);
  assert.deepEqual(await getEditorAccess(supabase, { email: "owner@example.com", email_confirmed_at: "" } as User), noAccess);
  assert.deepEqual(await getEditorAccess(supabase, null), noAccess);
  assert.equal(calls.length, 0);
});

test("confirmed editor with a closed_tabs row gets the remaining tabs, enforced", async () => {
  const { supabase } = fakeClient({ canEdit: ok(true), isOwner: ok(false), row: ok({ closed_tabs: ["broadcasts"], granted_tabs: [] }) });
  const access = await getEditorAccess(supabase, confirmed);
  assert.equal(access.canEdit, true);
  assert.equal(access.canManageEditors, false);
  assert.equal(access.tabsEnforced, true);
  assert.deepEqual(access.openTabs, allSeven.filter((id) => id !== "broadcasts"));
});

test("a missing column (42703 or PGRST204) opens all seven and tabs are not enforced", async () => {
  for (const code of ["42703", "PGRST204"]) {
    const { supabase } = fakeClient({ canEdit: ok(true), isOwner: ok(false), row: { data: null, error: { code } } });
    const access = await getEditorAccess(supabase, confirmed);
    assert.equal(access.canEdit, true);
    assert.deepEqual(access.openTabs, allSeven);
    assert.equal(access.tabsEnforced, false);
    assert.equal(access.unavailable, undefined);
  }
});

test("owner before the SQL still gets every tab, not enforced", async () => {
  const { supabase } = fakeClient({ canEdit: ok(true), isOwner: ok(true), row: { data: null, error: { code: "42703" } } });
  const access = await getEditorAccess(supabase, confirmed);
  assert.deepEqual(access, { canEdit: true, canManageEditors: true, openTabs: allSeven, tabsEnforced: false });
});

test("any other row read error, or any rpc error, fails closed as unavailable", async () => {
  const other = fakeClient({ canEdit: ok(true), isOwner: ok(false), row: { data: null, error: { code: "XX000" } } });
  assert.deepEqual(await getEditorAccess(other.supabase, confirmed), { ...noAccess, unavailable: true });
  const rpc = fakeClient({ canEdit: { data: null, error: { code: "500" } }, isOwner: ok(false) });
  assert.deepEqual(await getEditorAccess(rpc.supabase, confirmed), { ...noAccess, unavailable: true });
});

test("owner (is_owner true, no row) gets every registry tab and canManageEditors", async () => {
  const { supabase } = fakeClient({ canEdit: ok(true), isOwner: ok(true), row: ok(null) });
  const access = await getEditorAccess(supabase, confirmed);
  assert.equal(access.canManageEditors, true);
  assert.deepEqual(access.openTabs, allSeven);
  assert.equal(access.tabsEnforced, true);
});

test("canEdit true, not owner, no row (revoked between the calls) gives noAccess", async () => {
  const { supabase } = fakeClient({ canEdit: ok(true), isOwner: ok(false), row: ok(null) });
  assert.deepEqual(await getEditorAccess(supabase, confirmed), noAccess);
});

test("canEdit false gives noAccess with no open tabs", async () => {
  const { supabase } = fakeClient({ canEdit: ok(false), isOwner: ok(false), row: ok({ closed_tabs: [], granted_tabs: [] }) });
  const access = await getEditorAccess(supabase, confirmed);
  assert.deepEqual(access, noAccess);
  assert.deepEqual(access.openTabs, []);
});
