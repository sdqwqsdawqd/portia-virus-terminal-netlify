import { isAccessLevel } from "./access-levels.ts";
import { LEVELED_APP_IDS, type DocumentLinks } from "./portia-content.ts";

// A GET older than or equal to what this tab already has (its cache, an earlier answer, its own save, or simply nothing new) or sent before a save started is dropped: a late poll or stale CDN copy would put the pre-save copy back, and an equal copy would swap the content object and reset the editor's undo history. The cache is normalized at load by the shared normalizer, so an equal copy brings nothing new.
// Phase 24 (LVL-09): the same revision from another viewer (editor <-> level N, or level N <-> level M) is new data, because the server cut a different copy; the same revision from the same viewer stays dropped.
export function acceptFetchedContent(
  revision: number,
  knownRevision: number,
  savesAtSend: number,
  savesNow: number,
  viewerKey = "",
  knownViewerKey = "",
): boolean {
  return savesAtSend === savesNow && (revision > knownRevision || viewerKey !== knownViewerKey);
}

// Answers are ordered by the number of the request, not by arrival: an answer to a request sent before one already handled
// is dropped whatever its viewer key, so an old copy of a higher level never returns after a downgrade (T-24-11).
export function isNewerAnswer(requestSeq: number, answeredSeq: number): boolean {
  return requestSeq > answeredSeq;
}

// The one place that fixes the format of the viewer key: "editor" or "level-N" for N in 1..5. Anything else is "" and a
// copy with an empty key is never trusted (see cacheMatchesViewer).
export function viewerKeyOf(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const { editor, level } = raw as { editor?: unknown; level?: unknown };
  if (editor === true) return "editor";
  return isAccessLevel(level) ? `level-${level}` : "";
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Links of the leveled document windows as the server sent them (or as the device cache kept them): only known apps, only
// https addresses, both addresses present. Anything else is dropped so a damaged copy cannot open a foreign address.
export function normalizeDocumentLinks(raw: unknown): DocumentLinks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const links: DocumentLinks = {};
  for (const id of LEVELED_APP_IDS) {
    if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
    const link = source[id];
    if (!link || typeof link !== "object") continue;
    const { src, external } = link as { src?: unknown; external?: unknown };
    if (isHttpsUrl(src) && isHttpsUrl(external)) links[id] = { src, external };
  }
  return links;
}
