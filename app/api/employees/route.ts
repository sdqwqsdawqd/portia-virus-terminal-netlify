import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { readEmployeesSnapshot, sanitizeEmployeeUpdate, syncEmployeesSnapshot, writeEmployeesSnapshot } from "@/lib/portia-employees";

export const dynamic = "force-dynamic";

export async function GET() {
  let snapshot = await readEmployeesSnapshot();
  if (!snapshot) {
    try { snapshot = await syncEmployeesSnapshot(); }
    catch (error) {
      console.error("PORTIA employee live sync failed", error);
      return Response.json({ employees: [], syncedAt: null, degraded: true });
    }
  }
  return Response.json({ ...snapshot, degraded: false });
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });

    const body = await request.json() as { id?: unknown; changes?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const changes = sanitizeEmployeeUpdate(body.changes);
    const snapshot = await readEmployeesSnapshot();
    if (!snapshot || !changes) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const employee = snapshot.employees.find((item) => item.id === id);
    if (!employee) return Response.json({ error: "Сотрудник не найден." }, { status: 404 });
    Object.assign(employee, changes);
    snapshot.syncedAt = new Date().toISOString();
    await writeEmployeesSnapshot(snapshot);
    return Response.json({ employee, syncedAt: snapshot.syncedAt });
  } catch (error) {
    console.error("PORTIA employee update failed", error);
    return Response.json({ error: "Не удалось сохранить профиль." }, { status: 500 });
  }
}
