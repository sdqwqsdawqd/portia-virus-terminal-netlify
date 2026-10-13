export const HISTORY_LIMIT = 50;
export const TYPING_PAUSE_MS = 700;
export const TYPING_SPAN_MS = 1500;

export type EditorHistory<T> = {
  present: T;
  baseline: T;
  past: T[];
  future: T[];
  source: T;
  key: string | null;
  at: number;
  since: number;
};

export type HistoryAction<T> =
  | { type: "change"; updater: (next: T) => void; key: string | null; now: number }
  | { type: "saved"; normalized: T; savedFrom: T }
  | { type: "sync"; content: T };

export function initHistory<T>(content: T, clone: (value: T) => T): EditorHistory<T> {
  const present = clone(content);
  return { present, baseline: present, past: [], future: [], source: content, key: null, at: 0, since: 0 };
}

// RED stub: behavior arrives in the GREEN commit.
export function historyReducer<T>(state: EditorHistory<T>, _action: HistoryAction<T>, _clone: (value: T) => T): EditorHistory<T> {
  return state;
}
