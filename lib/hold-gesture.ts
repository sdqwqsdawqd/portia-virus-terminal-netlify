// owner 2026-11-20 (OWN-09): a row, a tab, a card or a table column is picked up by holding it, not by a drawn ≡ handle.
// This is the pure model of the hold; the pointer listeners and the DOM live in components/portia-editor-dossier.tsx.

/** How long the pointer must stay put before the element is lifted. */
export const HOLD_MS = 400;
/** How far the pointer may drift during that time (a finger always moves a little). */
export const HOLD_SLOP_PX = 6;

export type HoldState = {
  phase: "idle" | "pressing" | "lifted" | "cancelled";
  x: number;
  y: number;
  at: number;
  /** True only for the state right after a lifted element was released: the click that follows must not fire. */
  suppressClick: boolean;
};

export type HoldEvent =
  | { type: "down"; x: number; y: number; at: number }
  | { type: "move"; x: number; y: number; at: number }
  | { type: "tick"; at: number }
  | { type: "up" }
  | { type: "cancel" };

export const idleHold: HoldState = { phase: "idle", x: 0, y: 0, at: 0, suppressClick: false };

/** One step of the hold: press, drift, the clock, release. A release before the lift is an ordinary click; after the lift it ends the drag and swallows the click. */
export function holdStep(state: HoldState, event: HoldEvent): HoldState {
  switch (event.type) {
    case "down":
      return { phase: "pressing", x: event.x, y: event.y, at: event.at, suppressClick: false };
    case "move": {
      if (state.phase !== "pressing") return { ...state, suppressClick: false };
      // The time was already up when the pointer moved: the hold counts, the drag takes over.
      if (event.at - state.at >= HOLD_MS) return { ...state, phase: "lifted", suppressClick: false };
      const moved = Math.hypot(event.x - state.x, event.y - state.y);
      return moved > HOLD_SLOP_PX ? { ...state, phase: "cancelled", suppressClick: false } : { ...state, suppressClick: false };
    }
    case "tick":
      return state.phase === "pressing" && event.at - state.at >= HOLD_MS ? { ...state, phase: "lifted", suppressClick: false } : { ...state, suppressClick: false };
    case "up":
    case "cancel":
      return { ...idleHold, suppressClick: state.phase === "lifted" };
  }
}

export type HoldTarget = {
  /** Tag name of the element under the press. */
  tag: string;
  /** contentEditable text. */
  editable: boolean;
  /** A button of the card's action group (or the delete button of a table row). */
  insideActions: boolean;
  /** The target sits inside a row that is nested in the held row. */
  nestedRow: boolean;
};

const FIELD_TAGS = new Set(["input", "textarea", "select", "a"]);

/** A press on a field, a link, editable text, an action button or a nested row never starts a hold: typing, clicking and scrolling work as before. */
export function holdTargetAllowed(target: HoldTarget): boolean {
  return !FIELD_TAGS.has(target.tag.toLowerCase()) && !target.editable && !target.insideActions && !target.nestedRow;
}
