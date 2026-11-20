export type WindowGeometry = { x: number; y: number; width: number; height: number };
export type Bounds = { width: number; height: number };
export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const margin = 8;

/** Keeps a window fully inside the workspace; on a small screen the minimum size gives way to the screen. */
export function fitGeometry(geometry: WindowGeometry, bounds: Bounds, minimum: Bounds): WindowGeometry {
  const maxWidth = Math.max(0, bounds.width - margin * 2);
  const maxHeight = Math.max(0, bounds.height - margin * 2);
  const width = Math.min(Math.max(geometry.width, Math.min(minimum.width, maxWidth)), maxWidth);
  const height = Math.min(Math.max(geometry.height, Math.min(minimum.height, maxHeight)), maxHeight);
  const x = Math.min(Math.max(margin, geometry.x), bounds.width - width - margin);
  const y = Math.min(Math.max(margin, geometry.y), bounds.height - height - margin);
  return { x: Math.max(0, x), y: Math.max(0, y), width, height };
}

/** Drags one edge or corner of the frame; the opposite side stays where it was. */
export function resizeGeometry(start: WindowGeometry, edge: ResizeEdge, dx: number, dy: number, bounds: Bounds, minimum: Bounds): WindowGeometry {
  const minWidth = Math.min(minimum.width, bounds.width - margin * 2);
  const minHeight = Math.min(minimum.height, bounds.height - margin * 2);
  let { x, y, width, height } = start;
  if (edge.includes("e")) width = Math.min(Math.max(minWidth, start.width + dx), bounds.width - margin - start.x);
  if (edge.includes("s")) height = Math.min(Math.max(minHeight, start.height + dy), bounds.height - margin - start.y);
  if (edge.includes("w")) {
    const right = start.x + start.width;
    x = Math.min(Math.max(margin, start.x + dx), right - minWidth);
    width = right - x;
  }
  if (edge.includes("n")) {
    const bottom = start.y + start.height;
    y = Math.min(Math.max(margin, start.y + dy), bottom - minHeight);
    height = bottom - y;
  }
  return { x, y, width, height };
}


/**
 * Moves a window by its title bar. Owner 2026-11-20 (OWN-06) replaced the 8px inset of 18-04: the window may leave the
 * screen to the left, right and bottom, down to being entirely beyond the edge; its top never goes above the workspace
 * (the title bar stays grabbable) and its size never changes.
 */
export function dragGeometry(start: WindowGeometry, dx: number, dy: number, bounds: Bounds): WindowGeometry {
  const { width, height } = start;
  const x = Math.min(Math.max(-width, start.x + dx), Math.max(-width, bounds.width));
  const y = Math.min(Math.max(0, start.y + dy), Math.max(0, bounds.height));
  return { x, y, width, height };
}

export const titlebarHeight = 46;
/** The least width of the title bar that must stay inside the screen for a window to count as reachable. */
export const reachableTitlebarWidth = 48;

/** True while enough of the title bar is on the screen to grab it: at least 48px across, and the window not below the bottom edge. */
export function titlebarReachable(geometry: WindowGeometry, bounds: Bounds, height = titlebarHeight): boolean {
  const visibleWidth = Math.min(geometry.x + geometry.width, bounds.width) - Math.max(geometry.x, 0);
  const visibleHeight = Math.min(geometry.y + height, bounds.height) - Math.max(geometry.y, 0);
  return visibleWidth >= reachableTitlebarWidth && visibleHeight > 0;
}

/**
 * Refits after the browser was resized. Only a window larger than the workspace shrinks (and is pulled inside on that
 * axis); a window the owner carried partly or wholly off the screen stays where it is. Its top never rises above the workspace.
 */
export function refitGeometry(geometry: WindowGeometry, bounds: Bounds, minimum: Bounds): WindowGeometry {
  const fitted = fitGeometry(geometry, bounds, minimum);
  const shrankWidth = fitted.width !== geometry.width;
  const shrankHeight = fitted.height !== geometry.height;
  return {
    x: shrankWidth ? fitted.x : geometry.x,
    y: shrankHeight ? fitted.y : Math.max(0, geometry.y),
    width: fitted.width,
    height: fitted.height,
  };
}

export type PreviewRect = { left: number; top: number; width: number; height: number };

/** Where the window sits on the taskbar preview map, in percent of the workspace; values below 0 or above 100 mean beyond the edge. */
export function previewRect(geometry: WindowGeometry | undefined, bounds: Bounds): PreviewRect {
  if (!geometry || bounds.width <= 0 || bounds.height <= 0) return { left: 0, top: 0, width: 100, height: 100 };
  return {
    left: (geometry.x / bounds.width) * 100,
    top: (geometry.y / bounds.height) * 100,
    width: (geometry.width / bounds.width) * 100,
    height: (geometry.height / bounds.height) * 100,
  };
}
