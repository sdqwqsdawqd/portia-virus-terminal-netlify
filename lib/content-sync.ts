// A GET older than or equal to what this tab already has (its cache, an earlier answer, its own save, or simply nothing new) or sent before a save started is dropped: a late poll or stale CDN copy would put the pre-save copy back, and an equal copy would swap the content object and reset the editor's undo history. The cache is normalized at load by the shared normalizer, so an equal copy brings nothing new.
export function acceptFetchedContent(revision: number, knownRevision: number, savesAtSend: number, savesNow: number): boolean {
  return savesAtSend === savesNow && revision > knownRevision;
}
