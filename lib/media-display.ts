import { isAllowedMediaUrl } from "./media-url.ts";

// How long a picture may stay on its skeleton before the placeholder replaces it (UI-SPEC E5: no endless spinner).
export const MEDIA_SLOW_MS = 15_000;

export type MediaSource = { kind: "image"; src: string } | { kind: "placeholder" };

// The one gate between a stored image link and an <img>: an empty or disallowed link never reaches the network.
// The link is compared and passed on as the exact trimmed string, never re-encoded, so Cyrillic and %-encoded links load as stored.
export function mediaSource(src: string | undefined): MediaSource {
  const exact = (src ?? "").trim();
  return exact && isAllowedMediaUrl(exact) ? { kind: "image", src: exact } : { kind: "placeholder" };
}

// Only the active hero is fetched eagerly and with high priority; collections stay lazy so the first frame has no request burst.
export function mediaLoadingAttrs(priority: "hero" | "lazy"): { loading: "eager" | "lazy"; decoding: "async"; fetchPriority: "high" | "auto" } {
  return priority === "hero"
    ? { loading: "eager", decoding: "async", fetchPriority: "high" }
    : { loading: "lazy", decoding: "async", fetchPriority: "auto" };
}
