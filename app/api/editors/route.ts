import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess, normalizeEditorEmail } from "@/lib/editor-access";
import { parseJsonObject } from "@/lib/request-json";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireOwner() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const access = await getEditorAccess(supabase, data.user);
  if (!data.user || !access.canManageEditors) return null;
  return { supabase, user: data.user };
}

export async function GET() {
  const access = await requireOwner();
  if (!access) return Response.json({ error: "Управление доступом разрешено только владельцу." }, { status: 403 });

  const { data, error } = await access.supabase
    .from("portia_editors")
    .select("email, created_at")
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: "Не удалось получить список редакторов." }, { status: 500 });

  return Response.json({ editors: data ?? [] });
}

export async function POST(request: Request) {
  const access = await requireOwner();
  if (!access) return Response.json({ error: "Управление доступом разрешено только владельцу." }, { status: 403 });

  const body = parseJsonObject(await request.text());
  if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });
  const email = normalizeEditorEmail(typeof body.email === "string" ? body.email : "");
  if (!emailPattern.test(email)) return Response.json({ error: "Введите корректный email." }, { status: 400 });
  if (email === normalizeEditorEmail(access.user.email ?? "")) return Response.json({ error: "Владелец уже имеет полный доступ." }, { status: 400 });

  const { data: existing } = await access.supabase
    .from("portia_editors")
    .select("email, created_at")
    .eq("email", email)
    .maybeSingle();
  if (existing) return Response.json({ editor: existing });

  const { data, error } = await access.supabase
    .from("portia_editors")
    .insert({ email, granted_by: access.user.id })
    .select("email, created_at")
    .single();
  if (error) return Response.json({ error: "Не удалось выдать доступ. Проверьте настройку Supabase." }, { status: 500 });

  return Response.json({ editor: data });
}

export async function DELETE(request: Request) {
  const access = await requireOwner();
  if (!access) return Response.json({ error: "Управление доступом разрешено только владельцу." }, { status: 403 });

  const email = normalizeEditorEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!emailPattern.test(email)) return Response.json({ error: "Некорректный email." }, { status: 400 });

  const { error } = await access.supabase.from("portia_editors").delete().eq("email", email);
  if (error) return Response.json({ error: "Не удалось отозвать доступ." }, { status: 500 });
  return Response.json({ ok: true });
}
