import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { closedMessage } from "@/lib/editor-tabs";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { loadEmployees } from "@/lib/portia-employees";

export const dynamic = "force-dynamic";

// The public /api/employees is CDN-cached by path, so a no-store request there can still be answered from the CDN (D-10).
// This path never is; it is editor-only because every call reaches Sheets and Roblox.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (!data.user || !access.canEdit) return Response.json({ error: "Нет доступа к редактору." }, { status: 403, headers: noStoreHeaders });
    if (!access.openTabs.includes("employees")) return Response.json({ error: closedMessage(["employees"]) }, { status: 403, headers: noStoreHeaders });

    const { employees, syncedAt, complete, profilesRead, manualRead } = await loadEmployees(supabase);
    return Response.json({ employees, syncedAt, degraded: !complete, profilesRead, manualRead }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA editor employee read failed", error);
    return Response.json({ error: "Не удалось получить список сотрудников из таблицы." }, { status: 502, headers: noStoreHeaders });
  }
}
