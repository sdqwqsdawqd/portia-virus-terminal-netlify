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

// Phase 25 (SEC-04): the keys are v2. The v1 copies were taken before the closure existed and carry no proof of whose they are,
// so they are never read again and are deleted once when the gate mounts. This file is the single source of the key names;
// the desktop and the e2e specs import them.
export const CONTENT_CACHE_KEY = "portia-content-last-success-v2";
export const EMPLOYEES_CACHE_KEY = "portia-employees-last-success-v2";
export const LEGACY_CACHE_KEYS = ["portia-content-last-success-v1", "portia-employees-last-success-v1"] as const;

// Phase 24 (LVL-05): a content copy is cut for one viewer (editor or one level). It is shown only when the key it was saved
// with equals the key of the current gate decision; a copy of another level, or one without a key, is not shown.
export function cacheMatchesViewer(cached: unknown, viewerKey: string): boolean {
  if (!viewerKey || !cached || typeof cached !== "object") return false;
  return (cached as { viewer?: unknown }).viewer === viewerKey;
}

// D-21: when the gate says "closed and not allowed" (including a revoke), or the person or level on this device changed
// (SEC-04), nothing of the content stays on the device.
export function clearDeviceContentCaches(storage: () => Pick<Storage, "removeItem">): void {
  removeKeys(storage, [CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY]);
}

// T-25-28: the copies taken before the closure (v1) are removed, independent of the gate decision.
export function purgeLegacyDeviceCaches(storage: () => Pick<Storage, "removeItem">): void {
  removeKeys(storage, LEGACY_CACHE_KEYS);
}

function removeKeys(storage: () => Pick<Storage, "removeItem">, keys: readonly string[]): void {
  for (const key of keys) {
    try {
      storage().removeItem(key);
    } catch {
      // Storage may be blocked or missing; the copy then cannot be read either.
    }
  }
}

// SEC-04: the identity of the cache is "<viewer key>|<person key>" (see cacheIdentityOf in access-viewer.ts). Any change between
// two gate answers - approved to rejected or revoked, a level up or down, an editor leaving - wipes both copies. The first answer
// after the page loads has nothing to compare with (a foreign copy is dropped by the load-time check), so it wipes nothing.
export function identityChanged(previous: string | null, next: string): boolean {
  return previous !== null && previous !== next;
}
