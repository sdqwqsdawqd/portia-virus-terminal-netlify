"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function ownerLogin(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const ownerEmail = process.env.PORTIA_OWNER_EMAIL?.trim();
  if (!ownerEmail || !password) redirect("/owner-login?error=missing");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email: ownerEmail, password });
  if (error) redirect("/owner-login?error=invalid");

  revalidatePath("/", "layout");
  redirect("/");
}

export async function ownerLogout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
