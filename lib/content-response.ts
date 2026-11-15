// Phase 24: the body of GET /api/content, built per viewer. Server only.
import { createHmac } from "node:crypto";
import type { Viewer } from "./access-viewer.ts";
import { redactContentForViewer, withoutViewerMarkers, type SlotKey } from "./level-redact.ts";
import { defaultPortiaContent, type DocumentLinks, type PortiaContent } from "./portia-content.ts";
import { normalizePortiaContent } from "./portia-content-normalize.ts";

export const contentAccessRequired = { error: "Нет доступа к содержимому.", code: "access-required" } as const;

export type ContentRow = { payload: unknown; revision: number; updated_at: string } | null;

export type ContentBody = {
  content: PortiaContent;
  revision: number;
  updatedAt: string | null;
  viewer: { level: Viewer["level"]; editor: boolean };
  // Filled by plan 24-05 (document windows); empty here.
  documents: DocumentLinks;
};

// D-09: the opaque key of a record. HMAC-SHA256 of the id with the session secret, 22 base64url characters: stable between
// polls, cannot be turned back into the id, and different for every secret.
export function slotKeyFactory(secret: string): SlotKey {
  if (secret.length < 32) throw new Error("Slot secret must contain at least 32 characters.");
  return (id) => createHmac("sha256", secret).update(`slot:${id}`).digest("base64url").slice(0, 22);
}

export function contentBodyFor(viewer: Viewer, row: ContentRow, options: { slotOf: SlotKey }): ContentBody {
  const stored = (row?.payload ? normalizePortiaContent(row.payload) : null) ?? defaultPortiaContent;
  // Markers are never trusted from storage: the viewer's own are built below.
  const clean = withoutViewerMarkers(stored);
  return {
    content: viewer.editor ? clean : redactContentForViewer(clean, viewer.level, options.slotOf),
    revision: row?.revision ?? 0,
    updatedAt: row?.updated_at ?? null,
    viewer: { level: viewer.level, editor: viewer.editor },
    documents: {},
  };
}
