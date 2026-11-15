"use client";

import { useRef, useState, type ReactNode } from "react";
import type { PortiaContent } from "@/lib/portia-content";
import { levelCopy } from "@/lib/level-copy";
import { imageUrlsOfRecord, parsePortiaMediaUrl, replaceImageInContent, retirableUrls, type RewriteKind } from "@/lib/media-rewrite";
import { retireImageUrl, rewriteImageUrl } from "@/lib/media-rewrite-client";

// Phase 25, D-13 / D-14 / SEC-05: the editor's «change the address of a picture». It lives here so components/portia-editor.tsx
// (a file guarded by the D-64 registry) only calls it: it keeps its own pinned set of requests and holds no Russian text.
//
// The flow: the editor raises the level of a record that shows pictures of the site bucket -> an offer and a button appear
// beside the level picker -> the button copies each picture under a new random name (server) and puts the new address in the
// draft -> the old address waits in a queue -> after a SAVE the old files are removed (the server refuses when a saved record
// still shows one). Nothing happens without the press, and the result line is always shown (D-14).
type Offer = { key: string; kind: RewriteKind; id: string; urls: string[]; external: number };

export function useImageRewrite(changeDraft: (updater: (next: PortiaContent) => void) => void) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [report, setReport] = useState<{ key: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const lastKey = useRef("");
  // Addresses the editor replaced and whose files have not been removed yet. Kept until removed: a failed call is retried after the next save.
  const queue = useRef(new Set<string>());
  const site = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Called from the level picker's onChange with the record and its effective level before and after the change. Only a RAISE
  // of a record that shows pictures of this site's bucket makes an offer; a lowering or a record without such pictures clears it.
  const raised = (key: string, kind: RewriteKind, id: string, record: unknown, before: number, after: number) => {
    setReport(null);
    const urls = after > before ? imageUrlsOfRecord(kind, record) : [];
    const ours = urls.filter((url) => parsePortiaMediaUrl(url, site) !== null);
    if (ours.length) lastKey.current = key;
    setOffer(ours.length ? { key, kind, id, urls: ours, external: urls.length - ours.length } : null);
  };

  const run = async () => {
    if (!offer || running.current) return;
    running.current = true;
    setBusy(true);
    const { key, kind, id, external } = offer;
    let done = 0;
    let rest = offer.urls;
    for (const url of offer.urls) {
      const result = await rewriteImageUrl(url);
      if ("error" in result) break;
      changeDraft((next) => replaceImageInContent(next, kind, id, url, result.url));
      queue.current.add(url);
      rest = rest.filter((left) => left !== url);
      done += 1;
    }
    const failed = rest.length > 0;
    const lines = [
      done > 0 ? levelCopy.imageRewriteDone(done) : "",
      failed ? levelCopy.imageRewriteFailed : external > 0 ? levelCopy.imageRewriteExternal(external) : "",
    ].filter(Boolean);
    setReport({ key, text: lines.join(" ") });
    setOffer(failed ? { key, kind, id, urls: rest, external } : null);
    setBusy(false);
    running.current = false;
  };

  // D-13: called after the server stored the record. Only addresses that the saved record no longer shows are removed.
  const retire = async (saved: PortiaContent) => {
    let kept = false;
    for (const url of retirableUrls(queue.current, JSON.stringify(saved))) {
      const outcome = await retireImageUrl(url);
      if (outcome === "failed") continue;
      queue.current.delete(url);
      if (outcome === "in-use") kept = true;
    }
    if (kept) setReport({ key: lastKey.current, text: levelCopy.imageRetireKept });
  };

  const action = (key: string): ReactNode => {
    const showOffer = offer?.key === key;
    const line = report?.key === key ? report.text : "";
    if (!showOffer && !line) return null;
    return (
      <>
        {showOffer && <p className="access-level-hint">{levelCopy.imageRewriteOffer}</p>}
        {showOffer && <button className="secondary-control" type="button" disabled={busy} onClick={() => void run()}>{levelCopy.imageRewriteButton}</button>}
        {line && <p className="access-level-notice" role="status">{line}</p>}
      </>
    );
  };

  return { raised, action, retire };
}
