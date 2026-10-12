import type { SupabaseClient, User } from "@supabase/supabase-js";

const noAccess = { canEdit: false, canManageEditors: false };

// The rules live in Supabase (portia_can_edit / portia_is_owner), so the site and
// the database policies can never disagree about who may edit.
export async function getEditorAccess(supabase: SupabaseClient, user: User | null | undefined) {
  if (!user?.email) return noAccess;

  const [canEdit, isOwner] = await Promise.all([
    supabase.rpc("portia_can_edit"),
    supabase.rpc("portia_is_owner"),
  ]);
  if (canEdit.error || isOwner.error) {
    console.error("PORTIA editor access lookup failed", canEdit.error ?? isOwner.error);
    return noAccess;
  }

  return { canEdit: canEdit.data === true, canManageEditors: isOwner.data === true };
}

export function normalizeEditorEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}
