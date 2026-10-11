"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";

export async function ownerLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/owner-login?error=missing");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/owner-login?error=invalid");
  const access = await getEditorAccess(supabase, data.user);
  if (!access.canEdit) {
    await supabase.auth.signOut();
    redirect("/owner-login?error=denied");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function editorSignUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) redirect("/owner-login?error=signup");

  const supabase = await createServerSupabaseClient();
  const { data: approved, error: approvalError } = await supabase.rpc("portia_editor_is_approved", { candidate_email: email });
  if (approvalError) redirect("/owner-login?error=setup");
  if (!approved) redirect("/owner-login?error=not-approved");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect("/owner-login?error=signup");

  if (data.user && data.session) {
    const access = await getEditorAccess(supabase, data.user);
    if (!access.canEdit) await supabase.auth.signOut();
  }

  redirect("/owner-login?success=registered");
}

export async function ownerLogout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
