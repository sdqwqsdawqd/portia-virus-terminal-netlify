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
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved"; normalized: T; savedFrom: T }
  | { type: "sync"; content: T };

export function initHistory<T>(content: T, clone: (value: T) => T): EditorHistory<T> {
  const present = clone(content);
  return { present, baseline: present, past: [], future: [], source: content, key: null, at: 0, since: 0 };
}

// present and every stored entry are never mutated: a change clones, edits the clone and stores the old object.
export function historyReducer<T>(state: EditorHistory<T>, action: HistoryAction<T>, clone: (value: T) => T): EditorHistory<T> {
  switch (action.type) {
    case "change": {
      const next = clone(state.present);
      action.updater(next);
      if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
      const { key, now } = action;
      const coalesce = key !== null && key === state.key
        && (key.startsWith("drag:") || (now - state.at <= TYPING_PAUSE_MS && now - state.since <= TYPING_SPAN_MS));
      if (coalesce) return { ...state, present: next, at: now };
      return { ...state, present: next, past: [...state.past, state.present].slice(-HISTORY_LIMIT), future: [], key, at: now, since: now };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return { ...state, present: previous, past: state.past.slice(0, -1), future: [state.present, ...state.future], key: null };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { ...state, present: next, past: [...state.past, state.present], future: rest, key: null };
    }
    case "saved": {
      const saved = { ...state, baseline: action.normalized, source: action.normalized };
      // Edits typed while the request ran keep their draft and history; otherwise history ends at the save.
      return state.present === action.savedFrom ? { ...saved, present: action.normalized, past: [], future: [], key: null } : saved;
    }
    case "sync":
      return action.content === state.source ? state : initHistory(action.content, clone);
  }
}
