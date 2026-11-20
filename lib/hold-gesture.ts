// owner 2026-11-20 (OWN-09): a row, a tab, a card or a table column is picked up by holding it, not by a drawn ≡ handle.
// This is the pure model of the hold; the pointer listeners and the DOM live in components/portia-editor-dossier.tsx.

/** How long the pointer must stay put before the element is lifted. */
export const HOLD_MS = 400;
/** How far the pointer may drift during that time (a finger always moves a little). */
export const HOLD_SLOP_PX = 6;

/** The kind of pointer that pressed. A mouse and a pen start the drag by moving; a finger must hold, because moving a finger is a scroll. */
export type HoldPointer = "mouse" | "pen" | "touch";

/** Anything that is not clearly a finger or a pen is a mouse: old calls without the field, synthetic events with an empty kind. */
export function holdPointerOf(pointerType: string | undefined): HoldPointer {
  return pointerType === "touch" || pointerType === "pen" ? pointerType : "mouse";
}

/** True for the pointers that lift the element as soon as they drift past HOLD_SLOP_PX (owner 2026-11-20, OWN-09: "нажал и сразу потащил"). */
export function liftsOnDrag(pointerType: string | undefined): boolean {
  return holdPointerOf(pointerType) !== "touch";
}

export type HoldState = {
  phase: "idle" | "pressing" | "lifted" | "cancelled";
  x: number;
  y: number;
  at: number;
  pointerType: HoldPointer;
  /** True only for the state right after a lifted element was released: the click that follows must not fire. */
  suppressClick: boolean;
};

export type HoldEvent =
  | { type: "down"; x: number; y: number; at: number; pointerType?: string }
  /** `pressed: false` means the button is no longer down although no release was heard (it was let go outside the page): the press ends. */
  | { type: "move"; x: number; y: number; at: number; pressed?: boolean }
  | { type: "tick"; at: number }
  | { type: "up" }
  | { type: "cancel" };

export const idleHold: HoldState = { phase: "idle", x: 0, y: 0, at: 0, pointerType: "mouse", suppressClick: false };

/**
 * One step of the hold: press, drift, the clock, release.
 * Mouse and pen: a drift beyond the threshold lifts at once; a still hold of HOLD_MS lifts too. Touch: only the still hold lifts, an early drift cancels (a scroll).
 * A release before the lift is an ordinary click; after the lift it ends the drag and swallows the click.
 */
export function holdStep(state: HoldState, event: HoldEvent): HoldState {
  switch (event.type) {
    case "down":
      return { phase: "pressing", x: event.x, y: event.y, at: event.at, pointerType: holdPointerOf(event.pointerType), suppressClick: false };
    case "move": {
      if (state.phase === "idle") return state;
      if (event.pressed === false) return { ...idleHold };
      if (state.phase !== "pressing") return { ...state, suppressClick: false };
      // The time was already up when the pointer moved: the hold counts, the drag takes over.
      if (event.at - state.at >= HOLD_MS) return { ...state, phase: "lifted", suppressClick: false };
      const moved = Math.hypot(event.x - state.x, event.y - state.y);
      if (moved <= HOLD_SLOP_PX) return { ...state, suppressClick: false };
      return { ...state, phase: liftsOnDrag(state.pointerType) ? "lifted" : "cancelled", suppressClick: false };
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

export type HoldPlaces = {
  /** Rows that stand in the held row's list (the row itself included); for table-like columns, in all the columns together. */
  rows: number;
  /** The row may also change the list it stands in (a guide card moves between the cards of other sections). */
  crossesLists: boolean;
  /** Lists of the same kind that are on the page now (the row's own list included). */
  sameKindLists: number;
  /** Heads of other groups that take a dropped card. */
  otherDropGroups: number;
};

/**
 * Has the held row anywhere to go? A row alone in its list has nowhere: the selected section, subsection or card under its strip of tabs. Such a row neither
 * shows the open hand nor starts a hold (26.1-15): the hand promised a drag that could not happen, and the click that folds the card was swallowed.
 */
export function hasPlaceToGo(places: HoldPlaces): boolean {
  return places.rows > 1 || (places.crossesLists && (places.sameKindLists > 1 || places.otherDropGroups > 0));
}
