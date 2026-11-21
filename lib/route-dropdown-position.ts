// OWN-03 (owner 2026-11-21, clarification 32, 26.1-25): the panel of the routes of transmission is a layer over the page, `position: fixed` by the
// rectangle of its button, so opening it never changes the layout or the scroll bars of the window. Its place is computed here, from the button,
// the panel's own size and the visible screen, and from nothing else, so the component only reads one rectangle and writes one style per frame.

/** The panel is compact (owner item 18): 320px wide, the screen less 32px on a phone. */
export const ROUTE_PANEL_WIDTH = 320;
/** The room kept between the panel and the screen's edge, on the sides and at the far end. */
const EDGE = 16;
const FAR_END = 8;
/** However short the room, the panel keeps a few rows: it scrolls inside. */
const MIN_HEIGHT = 120;

export type RouteAnchor = { top: number; bottom: number; left: number; width: number };
export type RouteClip = { top: number; bottom: number; left: number; right: number; width: number; height: number };
export type RoutePanelPlace = {
  /** The top edge on the screen; for an upward panel this is where its full height would start. */
  top: number;
  /** An upward panel is anchored by its bottom edge (distance from the screen's bottom), so a longer description grows away from the button. */
  bottom: number | null;
  left: number;
  width: number;
  maxHeight: number;
  side: "down" | "up";
};

export function routePanelPlacement(
  anchor: RouteAnchor,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 4,
): RoutePanelPlace {
  const width = Math.max(0, Math.min(panel.width, viewport.width - 2 * EDGE));
  const below = viewport.height - anchor.bottom - gap;
  const above = anchor.top - gap;
  // Down by default; up only when it does not fit below and there is more room above (as in 26.1-21).
  const side: RoutePanelPlace["side"] = below >= panel.height + FAR_END || below >= above ? "down" : "up";
  const room = side === "down" ? below : above;
  const maxHeight = Math.max(MIN_HEIGHT, room - FAR_END);
  const height = Math.min(panel.height, maxHeight);
  const top = side === "down" ? anchor.bottom + gap : anchor.top - gap - height;
  const bottom = side === "up" ? viewport.height - anchor.top + gap : null;
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - EDGE - width));
  return { top, bottom, left, width, maxHeight, side };
}

/** The button is visible while some part of it stands inside every clipping box (the scrolling ancestors); a button without a box (display: none) is not. */
export function routeAnchorVisible(anchor: RouteClip, clips: readonly RouteClip[]): boolean {
  if (anchor.width === 0 && anchor.height === 0) return false;
  return clips.every((clip) => anchor.bottom > clip.top && anchor.top < clip.bottom && anchor.right > clip.left && anchor.left < clip.right);
}
