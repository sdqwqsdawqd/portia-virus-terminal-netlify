// A GET older than what this tab already has (its cache, an earlier answer, its own save) or sent before a save started would put the pre-save copy back (late poll, stale CDN copy); lower is dropped, equal is taken.
export function acceptFetchedContent(revision: number, knownRevision: number, savesAtSend: number, savesNow: number): boolean {
  return savesAtSend === savesNow && revision >= knownRevision;
}
