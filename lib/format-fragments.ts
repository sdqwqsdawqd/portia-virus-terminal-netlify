// Offsets are UTF-16 code units, the unit DOM Range offsets and rich-text runs use.
export type FormatFragment = { key: string; from: number; to: number };

/** Orders each fragment, drops empty ones, sorts by field then start, and folds touching or overlapping fragments of one field (D-15). */
export function mergeFragments(list: FormatFragment[]): FormatFragment[] {
  const sorted = list
    .map(({ key, from, to }) => ({ key, from: Math.min(from, to), to: Math.max(from, to) }))
    .filter((fragment) => fragment.from < fragment.to)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.from - b.from));
  const merged: FormatFragment[] = [];
  for (const fragment of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.key === fragment.key && fragment.from <= last.to) last.to = Math.max(last.to, fragment.to);
    else merged.push(fragment);
  }
  return merged;
}

/** Removes the fragment of `key` that holds `at` (edges included); a miss returns an equal list (D-14). */
export function removeFragmentAt(list: FormatFragment[], key: string, at: number): FormatFragment[] {
  return list.filter((fragment) => !(fragment.key === key && fragment.from <= at && at <= fragment.to));
}

/**
 * The selection a field reads when the browser holds several ranges in it (Firefox keeps every Ctrl range, Chromium one): the newest one,
 * i.e. the last range that was not already there when the press began (`known`); with none new, the last. Zero ranges is null.
 */
export function pickCurrentRange(ranges: { start: number; end: number }[], known: { start: number; end: number }[] = []): { start: number; end: number } | null {
  const fresh = ranges.filter((range) => !known.some((old) => old.start === range.start && old.end === range.end));
  return fresh[fresh.length - 1] ?? ranges[ranges.length - 1] ?? null;
}

/** A deleted or folded field leaves the multi-selection; a gone target drops it all (CR-01, WR-02). */
export function dropFields<T extends { key: string; fragments: FormatFragment[]; peers: Record<string, unknown> }>(target: T, gone: (key: string) => boolean): T | null {
  if (gone(target.key)) return null;
  if (!target.fragments.some((fragment) => gone(fragment.key)) && !Object.keys(target.peers).some(gone)) return target;
  return {
    ...target,
    fragments: target.fragments.filter((fragment) => !gone(fragment.key)),
    peers: Object.fromEntries(Object.entries(target.peers).filter(([key]) => !gone(key))),
  } as T;
}
