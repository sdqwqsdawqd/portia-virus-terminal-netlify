// Embedded-media recognition for rich text. Pure: no React, no "@/" imports, no server modules.

const knownKlipyMedia: Record<string, string> = {
  "https://klipy.com/gifs/anime-tsundere-6": "https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/e0/d8/GIVgKXMP.gif",
};

export function embeddedMediaUrl(value: string) {
  const trimmed = value.trim().replace(/[),.!?;:]+$/, "");
  if (!trimmed.startsWith("https://")) return null;

  if (knownKlipyMedia[trimmed]) return knownKlipyMedia[trimmed];

  try {
    const url = new URL(trimmed);
    if ((url.hostname === "giphy.com" || url.hostname === "www.giphy.com") && url.pathname.startsWith("/gifs/")) {
      const id = url.pathname.split("/").filter(Boolean).at(-1)?.split("-").at(-1);
      return id && /^[a-z0-9]+$/i.test(id) ? `https://media.giphy.com/media/${id}/giphy.gif` : null;
    }
    const isDirectImage = /\.(?:gif|png|jpe?g|webp)(?:$|[?#])/i.test(url.href);
    const isKnownMediaHost = url.hostname === "media.tenor.com"
      || url.hostname === "media.giphy.com"
      || url.hostname === "i.giphy.com"
      || /^(?:static\d*\.)?klipy\.com$/i.test(url.hostname);
    return isDirectImage || isKnownMediaHost ? url.href : null;
  } catch {
    return null;
  }
}

export type EmbeddedMediaSegment =
  | { kind: "text"; start: number; end: number }
  | { kind: "media"; url: string; start: number; end: number };

const mediaPattern = /https:\/\/[^\s<>"']+/gi;
const trailingPunctuation = /[),.!?;:]+$/;

// Splits text into text and media segments covering the whole input in order.
export function splitEmbeddedMedia(fullText: string): EmbeddedMediaSegment[] {
  const segments: EmbeddedMediaSegment[] = [];
  let cursor = 0;
  for (const match of fullText.matchAll(mediaPattern)) {
    const start = match.index ?? cursor;
    const url = embeddedMediaUrl(match[0]);
    if (!url) continue;
    if (start > cursor) segments.push({ kind: "text", start: cursor, end: start });
    // Trailing punctuation belongs to the sentence, not to the link: it falls into the next text segment.
    cursor = start + match[0].replace(trailingPunctuation, "").length;
    segments.push({ kind: "media", url, start, end: cursor });
  }
  if (cursor < fullText.length) segments.push({ kind: "text", start: cursor, end: fullText.length });
  return segments;
}
