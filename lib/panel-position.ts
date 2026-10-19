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

/** Reads a saved place; anything that is not an object with two finite numbers gives null (storage can hold junk). */
export function parsePanelOffset(raw: string | null): PanelOffset | null {
  try {
    const value: unknown = JSON.parse(raw ?? "");
    if (typeof value !== "object" || value === null) return null;
    const { right, bottom } = value as Record<string, unknown>;
    return typeof right === "number" && typeof bottom === "number" && Number.isFinite(right) && Number.isFinite(bottom) ? { right, bottom } : null;
  } catch {
    return null;
  }
}
