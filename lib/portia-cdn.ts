import { purgeCache } from "@netlify/functions";

export const contentCacheTag = "portia-content";
export const employeesCacheTag = "portia-employees";

// Public responses are cached by the Netlify CDN; browsers always revalidate.
export function publicCacheHeaders(tag: string, seconds: number) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": `public, durable, s-maxage=${seconds}, stale-while-revalidate=86400`,
    "Netlify-Cache-Tag": tag,
  };
}

export const noStoreHeaders = {
  "Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
};

// Saves must not fail because the CDN purge did; the short s-maxage bounds staleness anyway.
export async function purgeCacheTag(tag: string) {
  try {
    await purgeCache({ tags: [tag] });
  } catch (error) {
    console.error(`PORTIA cache purge failed for ${tag}`, error);
  }
}
