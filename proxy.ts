import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  // The desktop is public and must be served immediately. Refreshing an auth
  // session on `/` makes the first document depend on Supabase availability.
  matcher: ["/owner-login/:path*", "/api/:path*"],
};
