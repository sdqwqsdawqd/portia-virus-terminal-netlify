import { fitGeometry, type Bounds, type WindowGeometry } from "./window-geometry.ts";

// Where a window appears from: a desktop icon (zoom) or its taskbar button (scales back out of it).
export type OpenOrigin = { x: number; y: number; kind: "icon" | "taskbar" };
export type WindowState = { open: boolean; minimized: boolean; maximized: boolean; z: number; geometry?: WindowGeometry; exiting?: "close" | "minimize"; openOrigin?: OpenOrigin };

/** True when opening makes the window visibly appear; a window already in view only comes forward. */
export function windowAppears(state: WindowState): boolean {
  return !state.open || state.minimized || Boolean(state.exiting);
}

/** Windows currently in view; the count drives the cascade offset of the next new window. */
export function visibleWindowCount(windows: Record<string, WindowState>): number {
  return Object.values(windows).filter((state) => state.open && !state.minimized && !state.exiting).length;
}

/** Opens or restores one window; re-opening during an exit cancels it. `create` runs only when no geometry is remembered. */
export function openedWindow(state: WindowState, origin: OpenOrigin | undefined, bounds: Bounds, minimum: Bounds, create: () => WindowGeometry | undefined): WindowState {
  return {
    ...state,
    open: true,
    minimized: false,
    exiting: undefined,
    // The origin only matters when the window appears; changing it on a visible window would replay its animation.
    openOrigin: windowAppears(state) ? origin : state.openOrigin,
    // A size remembered from a bigger screen is refitted, so the window never opens past the edge.
    geometry: state.geometry ? fitGeometry(state.geometry, bounds, minimum) : create(),
  };
}
