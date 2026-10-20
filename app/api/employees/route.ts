import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { employeesCacheTag, noStoreHeaders, publicCacheHeaders, purgeCacheTag } from "@/lib/portia-cdn";
import { parseJsonObject } from "@/lib/request-json";
import { addManualEmployee, loadEmployees, removeManualEmployee, sanitizeEmployeeUpdate, sanitizeManualDetails, sanitizeManualEmployee, saveEmployeeProfile, updateManualEmployee, withProfile } from "@/lib/portia-employees";

export const dynamic = "force-dynamic";

// The Netlify Next.js runtime keys this cache by path only (its Netlify-Vary lists
// just its own query params), so freshness comes from purging on save, not URLs.
export async function GET() {
  try {
    const { employees, syncedAt, complete, profilesRead } = await loadEmployees(createPublicSupabaseClient());
    return Response.json(
      { employees, syncedAt, degraded: !complete, profilesRead },
      { headers: publicCacheHeaders(employeesCacheTag, complete ? 600 : 30) },
    );
  } catch (error) {
    console.error("PORTIA employee sync failed", error);
    return Response.json(
      { employees: [], syncedAt: null, degraded: true, error: "Не удалось получить список сотрудников из таблицы." },
      { status: 502, headers: noStoreHeaders },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });

    const body = parseJsonObject(await request.text());
    if (!body) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const id = typeof body.id === "string" ? body.id : "";
    const changes = sanitizeEmployeeUpdate(body.changes);
    if (!changes) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const { employees, profilesRead } = await loadEmployees(supabase);
    if (!profilesRead) return Response.json({ error: "Профили сотрудников не загрузились. Обновите страницу через минуту." }, { status: 503 });
    const employee = employees.find((item) => item.id === id);
    if (!employee) return Response.json({ error: "Сотрудник не найден. Обновите страницу." }, { status: 404 });
    // «Знания» is no longer edited: keep the stored value whatever the client sent.
    changes.knowledgeRating = employee.knowledgeRating;

    // Title, rank and callsign are editable only for people outside the sheet; the profile is saved first either way.
    const details = employee.source === "manual" ? sanitizeManualDetails(body.details) : null;
    const { ratingsSaved } = await saveEmployeeProfile(supabase, employee, changes, data.user.id);
    const detailsResult = details ? await updateManualEmployee(supabase, employee, details) : null;
    const saved = detailsResult?.status === "updated" ? { ...employee, ...details } : employee;
    const detailsPending = detailsResult?.status === "pending-database" || undefined;
    await purgeCacheTag(employeesCacheTag);
    if (ratingsSaved) return Response.json({ employee: { ...saved, ...changes }, detailsPending }, { headers: noStoreHeaders });
    // The new rating columns do not exist yet: echo only what was stored.
    const { biography, photoUrl, knowledgeRating } = changes;
    return Response.json({ employee: { ...saved, biography, photoUrl, knowledgeRating }, ratingsPending: true, detailsPending }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA employee update failed", error);
    return Response.json({ error: "Не удалось сохранить профиль." }, { status: 500 });
  }
}

// Adds a person outside the Google Sheet by Roblox nickname (D-01..D-03).
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });

    const input = sanitizeManualEmployee(parseJsonObject(await request.text()));
    if (!input) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const { employees, profilesRead, profiles } = await loadEmployees(supabase);
    if (!profilesRead) return Response.json({ error: "Профили сотрудников не загрузились. Обновите страницу через минуту." }, { status: 503 });

    const result = await addManualEmployee(supabase, input, employees, data.user.id);
    if (result.status !== "added") {
      const refusals = {
        "not-found": { error: "Ник не найден", status: 404 },
        "duplicate": { error: "Уже есть в списке", status: 409 },
        "roblox-unavailable": { error: "Roblox не отвечает. Попробуйте через минуту.", status: 503 },
        "pending-database": { error: "База данных ещё не обновлена: добавление заработает после обновления.", status: 503 },
      };
      const { error, status } = refusals[result.status];
      return Response.json({ error }, { status });
    }

    await purgeCacheTag(employeesCacheTag);
    return Response.json({ employee: withProfile(result.employee, profiles) }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA employee add failed", error);
    return Response.json({ error: "Не удалось добавить сотрудника." }, { status: 500 });
  }
}

// Removes a person added outside the sheet; a sheet employee is refused with 403 (D-02).
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403 });

    const body = parseJsonObject(await request.text());
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const { employees } = await loadEmployees(supabase);

    const result = await removeManualEmployee(supabase, employees, id);
    // The editor tells this refusal from an expired session by `code`, never by the text.
    if (result.status === "sheet") return Response.json({ error: "Нельзя удалить сотрудника из таблицы.", code: "sheet-employee" }, { status: 403 });
    if (result.status === "not-found") return Response.json({ error: "Сотрудник не найден. Обновите страницу." }, { status: 404 });

    await purgeCacheTag(employeesCacheTag);
    return Response.json({ id }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA employee delete failed", error);
    return Response.json({ error: "Не удалось удалить сотрудника." }, { status: 500 });
  }
}
