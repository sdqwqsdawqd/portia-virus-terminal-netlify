import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  // The desktop is public and must be served immediately. Refreshing an auth
  // session on `/` makes the first document depend on Supabase availability.
  // /api/employees is left out: its GET is CDN-cached and must never carry
  // Set-Cookie; its PATCH refreshes the session in the handler.
  matcher: ["/owner-login/:path*", "/api/content", "/api/editors", "/api/uploads"],
};
