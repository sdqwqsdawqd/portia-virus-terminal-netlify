import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { employeesCacheTag, noStoreHeaders, publicCacheHeaders, purgeCacheTag } from "@/lib/portia-cdn";
import { parseJsonObject } from "@/lib/request-json";
import { addManualEmployee, loadEmployees, removeManualEmployee, sanitizeEmployeeUpdate, sanitizeManualEmployee, saveEmployeePatch, withProfile } from "@/lib/portia-employees";

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
    const id = typeof body.id === "string" && body.id.length <= 128 ? body.id : "";
    const changes = sanitizeEmployeeUpdate(body.changes);
    if (!id || !changes) return Response.json({ error: "Некорректные данные." }, { status: 400 });
    // The nickname only lets the server check a never-saved sheet employee against the sheet (no Roblox call).
    const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 64) : "";

    const result = await saveEmployeePatch(supabase, data.user.id, { id, nickname, changes, details: {} });
    if (result.status !== "saved") {
      const refusals = {
        "not-found": { error: "Сотрудник не найден. Обновите страницу.", status: 404 },
        "sheet-unavailable": { error: "Таблица не отвечает, попробуйте через минуту.", status: 503 },
        "profiles-unavailable": { error: "Профили сотрудников не загрузились. Обновите страницу через минуту.", status: 503 },
        "details-failed": { error: "Не удалось сохранить звание, ранг и позывной. Профиль не изменён.", status: 500 },
      };
      const { error, status } = refusals[result.status];
      return Response.json({ error }, { status });
    }
    await purgeCacheTag(employeesCacheTag);
    const { employee, ratingsPending, detailsPending } = result;
    return Response.json({ employee, ratingsPending, detailsPending }, { headers: noStoreHeaders });
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
