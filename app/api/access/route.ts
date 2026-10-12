import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { noStoreHeaders } from "@/lib/portia-cdn";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return Response.json(await getEditorAccess(supabase, data.user), { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA access check failed", error);
    return Response.json({ canEdit: false, canManageEditors: false }, { headers: noStoreHeaders });
  }
}
