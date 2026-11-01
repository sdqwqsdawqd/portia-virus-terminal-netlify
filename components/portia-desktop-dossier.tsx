"use client";

import type { RichTextDocument } from "@/lib/portia-content";

const knownKlipyMedia: Record<string, string> = {
  "https://klipy.com/gifs/anime-tsundere-6": "https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/e0/d8/GIVgKXMP.gif",
};

function embeddedMediaUrl(value: string) {
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

function documentBackground(hex: string | undefined, opacity: number | undefined) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity ?? 1})`;
}

export function FormattedText({ text, document, className = "" }: { text?: string; document?: RichTextDocument; className?: string }) {
  const runs = document?.runs?.length ? document.runs : [{ text: text ?? "" }];
  const fullText = runs.map((run) => run.text).join("");
  const runRanges = runs.map((run, index) => {
    const start = runs.slice(0, index).reduce((total, item) => total + item.text.length, 0);
    return { run, start, end: start + run.text.length };
  });
  const nodes: React.ReactNode[] = [];
  const mediaPattern = /https:\/\/[^\s<>"']+/gi;

  const appendStyledText = (start: number, end: number, key: string) => {
    runRanges.forEach(({ run, start: runStart, end: runEnd }, runIndex) => {
      const from = Math.max(start, runStart);
      const to = Math.min(end, runEnd);
      if (from >= to) return;
      nodes.push(<span key={`${key}-${runIndex}-${from}`} style={{
        color: run.style?.color,
        fontSize: run.style?.fontSize ? `${run.style.fontSize}px` : undefined,
        fontWeight: run.style?.fontWeight,
        backgroundColor: documentBackground(run.style?.backgroundColor, run.style?.backgroundOpacity),
      }}>{fullText.slice(from, to)}</span>);
    });
  };

  let cursor = 0;
  Array.from(fullText.matchAll(mediaPattern)).forEach((match, index) => {
    const start = match.index ?? cursor;
    const matchedText = match[0];
    const mediaUrl = embeddedMediaUrl(matchedText);
    if (!mediaUrl) return;
    appendStyledText(cursor, start, `before-media-${index}`);
    nodes.push(<img
      key={`media-${index}-${start}`}
      className="embedded-rich-media"
      src={mediaUrl}
      alt="GIF"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />);
    cursor = start + matchedText.length;
  });
  appendStyledText(cursor, fullText.length, "after-media");

  return <span className={`formatted-content${className ? ` ${className}` : ""}`}>{nodes}</span>;
}
