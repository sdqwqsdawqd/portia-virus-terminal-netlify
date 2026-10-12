import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import {
  readEmployeeProfiles,
  readRosterSnapshot,
  sanitizeEmployeeUpdate,
  saveEmployeeProfile,
  syncRosterSnapshot,
  withProfile,
} from "@/lib/portia-employees";

export const dynamic = "force-dynamic";

async function loadRoster() {
  return await readRosterSnapshot() ?? await syncRosterSnapshot();
}

export async function GET() {
  let roster;
  try {
    roster = await loadRoster();
  } catch (error) {
    console.error("PORTIA employee live sync failed", error);
    return Response.json({ employees: [], syncedAt: null, degraded: true });
  }

  let profiles: Awaited<ReturnType<typeof readEmployeeProfiles>> = new Map();
  let degraded = false;
  try {
    profiles = await readEmployeeProfiles(await createServerSupabaseClient());
  } catch (error) {
    console.error("PORTIA employee profiles read failed", error);
    degraded = true;
  }
  return Response.json({
    employees: roster.employees.map((employee) => withProfile(employee, profiles)),
    syncedAt: roster.syncedAt,
    degraded,
  });
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });

    const body = await request.json() as { id?: unknown; changes?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const changes = sanitizeEmployeeUpdate(body.changes);
    if (!changes) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const roster = await loadRoster();
    const employee = roster.employees.find((item) => item.id === id);
    if (!employee) return Response.json({ error: "Сотрудник не найден. Обновите страницу." }, { status: 404 });

    await saveEmployeeProfile(supabase, employee.id, changes, data.user.id);
    return Response.json({ employee: { ...employee, ...changes }, syncedAt: roster.syncedAt });
  } catch (error) {
    console.error("PORTIA employee update failed", error);
    return Response.json({ error: "Не удалось сохранить профиль." }, { status: 500 });
  }
}
