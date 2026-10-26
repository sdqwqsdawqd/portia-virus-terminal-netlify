import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess, normalizeEditorEmail } from "@/lib/editor-access";
import { parseJsonObject } from "@/lib/request-json";
import { parseTabLists } from "@/lib/editor-tabs";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { isMissingColumnError } from "@/lib/portia-employees";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireOwner() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const access = await getEditorAccess(supabase, data.user);
  if (!data.user || !access.canManageEditors) return null;
  return { supabase, user: data.user };
}

type EditorRow = { email: string; created_at?: string; closed_tabs?: string[] | null; granted_tabs?: string[] | null };

// code "pending-database" tells the owner chips (12-07) the SQL is not applied yet (D-04).
const pendingDatabase = () => Response.json(
  { code: "pending-database", error: "Вкладки по редакторам заработают после применения SQL." },
  { status: 503, headers: noStoreHeaders },
);

export async function GET() {
  const access = await requireOwner();
  if (!access) return Response.json({ error: "Управление доступом разрешено только владельцу." }, { status: 403 });

  const query = (columns: string) => access.supabase.from("portia_editors").select(columns)
    .order("created_at", { ascending: true }).returns<EditorRow[]>();
  let { data, error } = await query("email, created_at, closed_tabs, granted_tabs");
  // Before the SQL the lists do not exist yet: list the editors with empty lists.
  const tabsEnforced = !isMissingColumnError(error);
  if (!tabsEnforced) ({ data, error } = await query("email, created_at"));
  if (error) return Response.json({ error: "Не удалось получить список редакторов." }, { status: 500, headers: noStoreHeaders });

  const editors = (data ?? []).map(({ email, created_at, closed_tabs, granted_tabs }) => ({
    email, created_at, closedTabs: closed_tabs ?? [], grantedTabs: granted_tabs ?? [],
  }));
  return Response.json({ editors, tabsEnforced }, { headers: noStoreHeaders });
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

// Full lists, never a toggle: a server-side toggle over PostgREST is a non-atomic read-modify-write.
export async function PATCH(request: Request) {
  const access = await requireOwner();
  if (!access) return Response.json({ error: "Управление доступом разрешено только владельцу." }, { status: 403 });

  const body = parseJsonObject(await request.text());
  if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });
  const email = normalizeEditorEmail(typeof body.email === "string" ? body.email : "");
  if (!emailPattern.test(email)) return Response.json({ error: "Введите корректный email." }, { status: 400 });
  if (email === normalizeEditorEmail(access.user.email ?? "")) return Response.json({ error: "Владелец уже имеет полный доступ." }, { status: 400 });
  const lists = parseTabLists(body);
  if (!lists) return Response.json({ error: "Некорректный список вкладок." }, { status: 400 });

  const changes: { closed_tabs?: string[]; granted_tabs?: string[] } = {};
  if (lists.closedTabs) changes.closed_tabs = lists.closedTabs;
  if (lists.grantedTabs) changes.granted_tabs = lists.grantedTabs;
  const { data, error } = await access.supabase.from("portia_editors").update(changes).eq("email", email)
    .select("email, closed_tabs, granted_tabs").returns<EditorRow[]>();
  if (error?.code === "42501" || isMissingColumnError(error)) return pendingDatabase();
  if (error) return Response.json({ error: "Не удалось сохранить вкладки." }, { status: 500, headers: noStoreHeaders });

  const saved = data?.[0];
  if (!saved) {
    const { data: row, error: readError } = await access.supabase.from("portia_editors").select("email").eq("email", email).maybeSingle();
    if (readError) return Response.json({ error: "Не удалось сохранить вкладки." }, { status: 500, headers: noStoreHeaders });
    // A row that exists but was not updated means the UPDATE policy is not applied yet.
    return row ? pendingDatabase() : Response.json({ error: "Редактор не найден. Обновите список." }, { status: 404, headers: noStoreHeaders });
  }
  return Response.json({ editor: { email: saved.email, closedTabs: saved.closed_tabs ?? [], grantedTabs: saved.granted_tabs ?? [] } }, { headers: noStoreHeaders });
}
