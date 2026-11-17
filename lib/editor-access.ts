import type { SupabaseClient, User } from "@supabase/supabase-js";
import { openTabIds, tabRegistry } from "./editor-tabs.ts";
import { isMissingColumnError } from "./portia-employees.ts";

export type EditorAccess = {
  canEdit: boolean;
  canManageEditors: boolean;
  openTabs: string[];
  tabsEnforced: boolean;
  unavailable?: true;
};

export const noAccess: EditorAccess = { canEdit: false, canManageEditors: false, openTabs: [], tabsEnforced: false };

const unavailable: EditorAccess = { ...noAccess, unavailable: true };
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

// The rules live in Supabase (portia_can_edit / portia_is_owner), so the site and
// the database policies can never disagree about who may edit.
// The column select, not an rpc, is how "SQL not applied" is detected, and it works even for the owner, who has no row.
export async function getEditorAccess(supabase: SupabaseClient, user: User | null | undefined): Promise<EditorAccess> {
  // An unconfirmed email never edits, owner included (D-18, D-22); no network call is made.
  if (!user?.email || !user.email_confirmed_at) return noAccess;

  const [canEdit, isOwner, row] = await Promise.all([
    supabase.rpc("portia_can_edit"),
    supabase.rpc("portia_is_owner"),
    supabase.from("portia_editors").select("closed_tabs, granted_tabs").eq("email", normalizeEditorEmail(user.email)).maybeSingle(),
  ]);
  if (canEdit.error || isOwner.error) {
    console.error("PORTIA editor access lookup failed", canEdit.error ?? isOwner.error);
    return unavailable;
  }
  const tabsEnforced = !isMissingColumnError(row.error);
  if (row.error && tabsEnforced) {
    console.error("PORTIA editor tab lookup failed", row.error);
    return unavailable;
  }

  if (canEdit.data !== true) return noAccess;
  const owner = isOwner.data === true;
  if (owner) return { canEdit: true, canManageEditors: true, openTabs: tabRegistry.map((tab) => tab.id), tabsEnforced };
  if (tabsEnforced && !row.data) return noAccess;

  const stored = (row.data ?? {}) as { closed_tabs?: unknown; granted_tabs?: unknown };
  return {
    canEdit: true,
    canManageEditors: false,
    openTabs: openTabIds(strings(stored.closed_tabs), strings(stored.granted_tabs)),
    tabsEnforced,
  };
}

export function normalizeEditorEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}
