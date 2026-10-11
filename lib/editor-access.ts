import type { SupabaseClient, User } from "@supabase/supabase-js";

const normalizeEmail = (email: string | null | undefined) => email?.trim().toLocaleLowerCase("en-US") ?? "";

export function isOwnerEmail(email: string | null | undefined) {
  const ownerEmail = normalizeEmail(process.env.PORTIA_OWNER_EMAIL);
  return Boolean(ownerEmail && normalizeEmail(email) === ownerEmail);
}

export async function getEditorAccess(supabase: SupabaseClient, user: User | null | undefined) {
  if (!user?.email) return { canEdit: false, canManageEditors: false };
  if (isOwnerEmail(user.email)) return { canEdit: true, canManageEditors: true };

  const email = normalizeEmail(user.email);
  const { data, error } = await supabase
    .from("portia_editors")
    .select("email")
    .eq("email", email)
    .maybeSingle<{ email: string }>();

  if (error) {
    console.error("PORTIA editor access lookup failed", error);
    return { canEdit: false, canManageEditors: false };
  }

  return { canEdit: Boolean(data), canManageEditors: false };
}

export function normalizeEditorEmail(email: string) {
  return normalizeEmail(email);
}
