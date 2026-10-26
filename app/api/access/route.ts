import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { noStoreHeaders } from "@/lib/portia-cdn";

export const dynamic = "force-dynamic";

const unavailableBody = { error: "Проверка доступа временно недоступна." };

// The desktop keeps its last state on a non-OK answer, so a blip never unmounts the editor.
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    // A network or 5xx auth failure is not "logged out": answering canEdit:false would unmount the open editor.
    if (isAuthRetryableFetchError(error)) return Response.json(unavailableBody, { status: 503, headers: noStoreHeaders });
    const access = await getEditorAccess(supabase, data.user);
    if (access.unavailable) return Response.json(unavailableBody, { status: 503, headers: noStoreHeaders });
    const { canEdit, canManageEditors, openTabs, tabsEnforced } = access;
    return Response.json({ canEdit, canManageEditors, openTabs, tabsEnforced }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA access check failed", error);
    return Response.json(unavailableBody, { status: 503, headers: noStoreHeaders });
  }
}
