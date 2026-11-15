import { resolveGateFor } from "@/lib/gate-for-request";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const client = await createServerSupabaseClient();
    const decision = await resolveGateFor(request, client);
    return Response.json(decision, { headers: noStoreHeaders });
  } catch (error) {
    console.error("PORTIA visitor gate check failed", error);
    return Response.json({ error: "Проверка доступа временно недоступна." }, { status: 503, headers: noStoreHeaders });
  }
}
