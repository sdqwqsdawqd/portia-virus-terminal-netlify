import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  // The desktop is public and must be served immediately. Refreshing an auth
  // session on `/` makes the first document depend on Supabase availability.
  // /api/content and /api/employees are left out: their GETs are CDN-cached and
  // must never carry Set-Cookie; their writes refresh the session in the handler.
  matcher: ["/owner-login/:path*", "/api/access", "/api/editors", "/api/uploads"],
};
