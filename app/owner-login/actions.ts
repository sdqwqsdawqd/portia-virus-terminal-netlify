"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { signInErrorParam, signUpErrorParam, signUpReturnedExistingAccount } from "@/lib/owner-login-errors";

export async function ownerLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/owner-login?error=missing");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // "email_not_confirmed" → error=unconfirmed; a wrong password and a rate limit get their own lines (lib/owner-login-errors.ts).
  if (error) redirect(`/owner-login?error=${signInErrorParam(error.code)}`);
  // Confirm email off or an admin-created account: the session exists but the email was never confirmed.
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    redirect("/owner-login?error=unconfirmed");
  }
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
  if (error) redirect(`/owner-login?error=${signUpErrorParam(error.code)}`);
  // An already registered email: say so instead of «Аккаунт создан», which sent no letter.
  if (signUpReturnedExistingAccount(data.user)) redirect("/owner-login?error=exists");

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
