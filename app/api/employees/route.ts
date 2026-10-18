import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { employeesCacheTag, noStoreHeaders, publicCacheHeaders, purgeCacheTag } from "@/lib/portia-cdn";
import { loadEmployees, sanitizeEmployeeUpdate, saveEmployeeProfile } from "@/lib/portia-employees";

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

    const body = await request.json() as { id?: unknown; changes?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const changes = sanitizeEmployeeUpdate(body.changes);
    if (!changes) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    const { employees, profilesRead } = await loadEmployees(supabase);
    if (!profilesRead) return Response.json({ error: "Профили сотрудников не загрузились. Обновите страницу через минуту." }, { status: 503 });
    const employee = employees.find((item) => item.id === id);
    if (!employee) return Response.json({ error: "Сотрудник не найден. Обновите страницу." }, { status: 404 });
    // «Знания» is no longer edited: keep the stored value whatever the client sent.
    changes.knowledgeRating = employee.knowledgeRating;

    const { ratingsSaved } = await saveEmployeeProfile(supabase, employee, changes, data.user.id);
    await purgeCacheTag(employeesCacheTag);
    if (ratingsSaved) return Response.json({ employee: { ...employee, ...changes } }, { headers: noStoreHeaders });
    // The new rating columns do not exist yet: echo only what was stored.
    const { biography, photoUrl, knowledgeRating } = changes;
    return Response.json({ employee: { ...employee, biography, photoUrl, knowledgeRating }, ratingsPending: true }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA employee update failed", error);
    return Response.json({ error: "Не удалось сохранить профиль." }, { status: 500 });
  }
}
