import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { accessSessionSecret } from "./access-session.ts";
import { resolveGate, type GateDependencies } from "./access-gate.ts";
import { getEditorAccess } from "./editor-access.ts";

// The one place where the dependencies of the site gate are put together (closes IN-04 of Phase 24). /api/content and
// /api/access/status must reach the same decision for the same request: the viewer key of a copy, the fetched-copy check and
// the status poll all rest on it, so neither route builds its own callback. The route creates the session client, because the
// same client also serves the editor's read of the content row (lib/server-read.ts). No import of the Next.js cookie helpers
// here, so node:test can import this module.

// A transient network error while asking who the session is must not read as "not an editor": the gate fails closed instead.
export function editorAccessFor(client: SupabaseClient): GateDependencies["editorAccess"] {
  return async () => {
    const { data, error } = await client.auth.getUser();
    if (isAuthRetryableFetchError(error)) return { canEdit: false, unavailable: true as const };
    const access = await getEditorAccess(client, data.user);
    return { canEdit: access.canEdit, unavailable: access.unavailable };
  };
}

// Throws when the session secret is not configured: the route answers 503 (fail closed).
export function gateDependencies(client: SupabaseClient): GateDependencies {
  return { client, sessionSecret: accessSessionSecret(), editorAccess: editorAccessFor(client) };
}

export async function resolveGateFor(request: Request, client: SupabaseClient) {
  return resolveGate(request.headers, gateDependencies(client));
}
