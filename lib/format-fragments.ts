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
