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
