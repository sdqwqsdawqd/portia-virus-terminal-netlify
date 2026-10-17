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

/** Moves a window by its title bar; it may leave the workspace except for 160 px of its title bar. */
export function dragGeometry(start: WindowGeometry, dx: number, dy: number, bounds: Bounds): WindowGeometry {
  return {
    x: Math.min(Math.max(0, start.x + dx), Math.max(0, bounds.width - 160)),
    y: Math.min(Math.max(0, start.y + dy), Math.max(0, bounds.height - 46)),
    width: start.width,
    height: start.height,
  };
}
