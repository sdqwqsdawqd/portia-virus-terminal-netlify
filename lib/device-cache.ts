// The device keeps the last good content and roster to stay usable offline. Such a copy is only valid for the data
// source it came from: a copy from another Supabase project (or from before this stamp existed) has unrelated revisions,
// and a higher foreign revision made the client drop every real answer (owner UAT 19-14). Foreign copies are not shown.

type Env = { NEXT_PUBLIC_SUPABASE_URL?: string };

// Next inlines NEXT_PUBLIC_* at build time only for direct `process.env.NAME` reads, so the default argument reads it that way.
export function deviceCacheSource(env: Env = { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }): string {
  return (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().toLowerCase().replace(/\/+$/u, "");
}

export function cacheMatchesSource(cached: unknown, source: string): boolean {
  if (!source || !cached || typeof cached !== "object") return false;
  return (cached as { source?: unknown }).source === source;
}

export function stampCacheSource<T extends object>(value: T, source: string): T & { source: string } {
  return { ...value, source };
}

export const CONTENT_CACHE_KEY = "portia-content-last-success-v1";
export const EMPLOYEES_CACHE_KEY = "portia-employees-last-success-v1";

// Phase 24 (LVL-05): a content copy is cut for one viewer (editor or one level). It is shown only when the key it was saved
// with equals the key of the current gate decision; a copy of another level, or one without a key, is not shown.
export function cacheMatchesViewer(cached: unknown, viewerKey: string): boolean {
  if (!viewerKey || !cached || typeof cached !== "object") return false;
  return (cached as { viewer?: unknown }).viewer === viewerKey;
}

// D-21: when the gate says "closed and not allowed" (including a revoke) nothing of the content stays on the device.
export function clearDeviceContentCaches(storage: () => Pick<Storage, "removeItem">): void {
  for (const key of [CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY]) {
    try {
      storage().removeItem(key);
    } catch {
      // Storage may be blocked or missing; the copy then cannot be read either.
    }
  }
}
