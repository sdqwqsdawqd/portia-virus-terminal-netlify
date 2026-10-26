import type { Bounds } from "./window-geometry.ts";

/** Distance of the format panel from the viewport's right and bottom edges, in px. */
export type PanelOffset = { right: number; bottom: number };

// At least this much of the panel stays on screen, so the header can always be grabbed (EDIT-04).
const visible = 64;

/** Keeps 64px of the panel on screen sideways, its top edge on screen, and 64px of its header above the bottom edge. */
export function clampPanelOffset(offset: PanelOffset, panel: Bounds, bounds: Bounds): PanelOffset {
  const minRight = visible - panel.width;
  const minBottom = visible - panel.height;
  const maxRight = Math.max(minRight, bounds.width - visible);
  const maxBottom = Math.max(minBottom, bounds.height - panel.height);
  return {
    right: Math.round(Math.min(Math.max(minRight, offset.right), maxRight)),
    bottom: Math.round(Math.min(Math.max(minBottom, offset.bottom), maxBottom)),
  };
}

/** First opening: 16px right of the editor window with its bottom edge on the window's, else the corner 16px above the 44px taskbar (D-07). */
export function initialPanelOffset(editor: { right: number; bottom: number } | null, panel: Bounds, bounds: Bounds): PanelOffset {
  const beside = editor !== null && bounds.width - editor.right - 16 >= panel.width;
  const place = beside ? { right: bounds.width - editor.right - 16 - panel.width, bottom: bounds.height - editor.bottom } : { right: 16, bottom: 60 };
  return clampPanelOffset(place, panel, bounds);
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
