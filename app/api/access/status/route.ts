import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { getEditorAccess } from "@/lib/editor-access";
import { accessSessionSecret } from "@/lib/access-session";
import { resolveGate } from "@/lib/access-gate";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const client = await createServerSupabaseClient();
    const decision = await resolveGate(request.headers, {
      client,
      sessionSecret: accessSessionSecret(),
      editorAccess: async () => {
        const { data, error } = await client.auth.getUser();
        if (isAuthRetryableFetchError(error)) return { canEdit: false, unavailable: true };
        const access = await getEditorAccess(client, data.user);
        return { canEdit: access.canEdit, unavailable: access.unavailable };
      },
    });
    return Response.json(decision, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA visitor gate check failed", error);
    return Response.json({ error: "Проверка доступа временно недоступна." }, { status: 503, headers: noStoreHeaders });
  }
}
