import type { Bounds } from "./window-geometry.ts";

/** Distance of the format panel from the editor window's right and bottom edges, in px. */
export type PanelOffset = { right: number; bottom: number };

const sideMargin = 8;
// The save bar under the panel stays visible (phase 3 D-01).
const minimumBottom = 72;
// 46px window title bar + 8px margin.
const topInset = 54;

/** Keeps the panel fully inside the editor window: 8px from the sides, above the save bar, below the title bar. */
export function clampPanelOffset(offset: PanelOffset, panel: Bounds, bounds: Bounds): PanelOffset {
  const maxRight = Math.max(sideMargin, bounds.width - panel.width - sideMargin);
  const maxBottom = Math.max(minimumBottom, bounds.height - panel.height - topInset);
  return {
    right: Math.round(Math.min(Math.max(sideMargin, offset.right), maxRight)),
    bottom: Math.round(Math.min(Math.max(minimumBottom, offset.bottom), maxBottom)),
  };
}
