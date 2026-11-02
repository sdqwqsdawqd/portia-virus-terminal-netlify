export type Rect = { x: number; y: number; width: number; height: number };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Keeps a dragged shortcut inside the desktop area and off every obstacle (assistant, format button); never mutates its arguments. */
export function clampShortcutPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  area: { width: number; height: number },
  obstacles: Rect[] = [],
  inset = 8,
): { x: number; y: number } {
  const maxX = Math.max(inset, area.width - size.width - inset);
  const maxY = Math.max(inset, area.height - size.height - inset);
  const clamped = { x: Math.min(maxX, Math.max(inset, position.x)), y: Math.min(maxY, Math.max(inset, position.y)) };
  const box = (point: { x: number; y: number }): Rect => ({ ...point, ...size });
  const hit = obstacles.find((obstacle) => overlaps(box(clamped), obstacle));
  if (!hit) return clamped;
  // Left, above, right, below the obstacle that was hit, in that order for ties; keep the free one that moves the shortcut least.
  const candidates = [
    { x: hit.x - size.width - inset, y: clamped.y },
    { x: clamped.x, y: hit.y - size.height - inset },
    { x: hit.x + hit.width + inset, y: clamped.y },
    { x: clamped.x, y: hit.y + hit.height + inset },
  ].filter((point) => point.x >= inset && point.x <= maxX && point.y >= inset && point.y <= maxY && !obstacles.some((obstacle) => overlaps(box(point), obstacle)));
  let best = clamped;
  let bestDistance = Infinity;
  for (const point of candidates) {
    const distance = Math.hypot(point.x - clamped.x, point.y - clamped.y);
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}
