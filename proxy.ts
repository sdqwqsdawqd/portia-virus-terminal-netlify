import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  // The desktop is public and must be served immediately. Refreshing an auth
  // session on `/` makes the first document depend on Supabase availability.
  // /api/content and /api/employees are left out on purpose: their GETs must never carry
  // Set-Cookie (/api/content is built per viewer and is no-store since Phase 24; the
  // employees list is still CDN-cached); their writes refresh the session in the handler.
  // /api/users is a per-user editor read, so long-lived pollers refresh the session.
  matcher: [
    "/owner-login/:path*",
    "/api/access",
    "/api/editors",
    "/api/users",
    "/api/uploads",
    "/api/promotion/reviewer/:path*",
    "/api/promotion/banks/:path*",
  ],
};
