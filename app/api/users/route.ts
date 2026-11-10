import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { noStoreHeaders } from "@/lib/portia-cdn";
import { handleUsersGet, handleUsersPost, parseUsersPostRequest } from "@/lib/users-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (access.unavailable) {
      return Response.json({ code: "access-check-failed" }, { status: 503, headers: noStoreHeaders });
    }
    const result = await handleUsersGet({ access, client: supabase }, new URL(request.url).searchParams);
    return Response.json(result.body, { status: result.status, headers: noStoreHeaders });
  } catch {
    return Response.json({ code: "unavailable" }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseUsersPostRequest(request);
    if (parsed.result) return Response.json(parsed.result.body, { status: parsed.result.status, headers: noStoreHeaders });
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    const access = await getEditorAccess(supabase, data.user);
    if (access.unavailable) {
      return Response.json({ code: "access-check-failed" }, { status: 503, headers: noStoreHeaders });
    }
    const result = await handleUsersPost({ access, client: supabase }, parsed.body ?? {});
    return Response.json(result.body, { status: result.status, headers: noStoreHeaders });
  } catch {
    return Response.json({ code: "unavailable" }, { status: 500, headers: noStoreHeaders });
  }
}
