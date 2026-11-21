"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { appMeta, type AppId } from "@/components/portia-desktop-window";
import { originOf, type OpenOrigin } from "@/lib/window-open";
import { alignShortcutsToGrid, clampShortcutPosition, desktopGrid, freeGridCellAlong, homeShortcutPositions, nearestFreeGridCell, placeShortcuts, shortcutCell, shortcutDropArea, snapShortcutPosition, type DesktopGrid, type DesktopShortcutId, type Rect, type ShortcutCell } from "@/lib/shortcut-layout";

export type { DesktopShortcutId } from "@/lib/shortcut-layout";
export type ShortcutPosition = { x: number; y: number };
type ShortcutLayoutStyle = React.CSSProperties & {
  "--shortcut-left": string;
  "--shortcut-top": string;
  "--shortcut-right": string;
  "--shortcut-bottom": string;
};

// One independent home for every shortcut. Saved drag coordinates override only that shortcut;
// adding an app can no longer inherit another icon's static/absolute position by accident.
// Owner 2026-11-21 item 29: on the PC these CSS homes only stand until the desktop is measured; then every shortcut without a saved
// place stands in its cell of the desktop grid (homeShortcutPositions in lib/shortcut-layout.ts, through useShortcutPlacement).
const defaultShortcutLayout: Record<DesktopShortcutId, ShortcutLayoutStyle> = {
  search: shortcutLayout({ left: 14, top: 20 }),
  archive: shortcutLayout({ left: 14, top: 124 }),
  broadcasts: shortcutLayout({ left: 14, top: 228 }),
  info: shortcutLayout({ left: 14, top: 332 }),
  employees: shortcutLayout({ left: 14, top: 436 }),
  settings: shortcutLayout({ left: 124, top: 20 }),
  guide: shortcutLayout({ left: 124, top: 124 }),
  promotion: shortcutLayout({ left: 124, top: 228 }),
  template: shortcutLayout({ left: 124, top: 332 }),
  charter: shortcutLayout({ left: 14, bottom: 18 }),
  sheet: shortcutLayout({ left: 124, bottom: 18 }),
  trash: shortcutLayout({ right: 14, top: 20 }),
};

function shortcutLayout({ left, top, right, bottom }: { left?: number; top?: number; right?: number; bottom?: number }): ShortcutLayoutStyle {
  return {
    "--shortcut-left": left === undefined ? "auto" : `${left}px`,
    "--shortcut-top": top === undefined ? "auto" : `${top}px`,
    "--shortcut-right": right === undefined ? "auto" : `${right}px`,
    "--shortcut-bottom": bottom === undefined ? "auto" : `${bottom}px`,
  };
}

// Room for the large 110x~120px shortcut plus the 8px inset, so after a reload or viewport change the whole shortcut stays in the zone.
function savedShortcutLayout(position: ShortcutPosition): ShortcutLayoutStyle {
  return {
    "--shortcut-left": `max(8px, min(${position.x}px, calc(100% - 118px)))`,
    "--shortcut-top": `max(8px, min(${position.y}px, calc(100% - 128px)))`,
    "--shortcut-right": "auto",
    "--shortcut-bottom": "auto",
  };
}

// At 521–900px the spot comes from placeShortcuts, already inside the area and off the other shortcuts, so no CSS clamp is needed.
function placedShortcutLayout(position: ShortcutPosition): ShortcutLayoutStyle {
  return { "--shortcut-left": `${position.x}px`, "--shortcut-top": `${position.y}px`, "--shortcut-right": "auto", "--shortcut-bottom": "auto" };
}

// ---- UI-09: one JS placement rule for the shortcuts at 521–900px ----
// Same order as the PC homes above: left column, second column, the bottom pair, trash.
export const desktopShortcutOrder = Object.keys(defaultShortcutLayout) as DesktopShortcutId[];
// Review WR-02: three queries that cover every width exactly once, including a fractional one (a zoomed 520.8px): ≤520, (520–900], >900.
// The stylesheet uses the same strings (app/portia.css: `(max-width: 520px)`, `(520px < width <= 900px)`, `(width > 900px)`).
const phoneShortcutQuery = "(max-width: 520px)";
const tabletShortcutQuery = "(520px < width <= 900px)";
const shortcutGap = 8;
// Which of the three bands the page is in: the phone grid, the tablet placement or the PC desktop.
type ShortcutBand = "phone" | "tablet" | "pc";
const subscribeShortcutBand = (notify: () => void) => {
  const queries = [window.matchMedia(phoneShortcutQuery), window.matchMedia(tabletShortcutQuery)];
  for (const query of queries) query.addEventListener("change", notify);
  return () => { for (const query of queries) query.removeEventListener("change", notify); };
};
const shortcutBandSnapshot = (): ShortcutBand => (window.matchMedia(phoneShortcutQuery).matches ? "phone" : window.matchMedia(tabletShortcutQuery).matches ? "tablet" : "pc");
const shortcutBandServerSnapshot = (): ShortcutBand => "pc";

export type ShortcutPlacementState = {
  positions: Partial<Record<DesktopShortcutId, ShortcutPosition>>;
  contentHeight: number;
  area: { width: number; height: number };
  cell: ShortcutCell;
  grid: DesktopGrid;
};
export type PlacedShortcut = { position: ShortcutPosition; area: { width: number; height: number }; cell: ShortcutCell; grid: DesktopGrid; positions: Partial<Record<DesktopShortcutId, ShortcutPosition>> };

/**
 * Measures .desktop-icons (a ResizeObserver: rotation, window size, icon size) and places every shortcut. At 521–900px through placeShortcuts
 * (UI-09); on the PC (≥901px, owner 2026-11-21 items 29, 31) every shortcut without a saved place stands in its home cell of the desktop grid
 * and a saved place is held inside the area. null on a phone (≤520px, the CSS grid).
 */
export function useShortcutPlacement(
  ref: React.RefObject<HTMLElement | null>,
  ids: readonly DesktopShortcutId[],
  iconSize: string,
  saved: Partial<Record<DesktopShortcutId, ShortcutPosition>>,
): ShortcutPlacementState | null {
  const band = useSyncExternalStore(subscribeShortcutBand, shortcutBandSnapshot, shortcutBandServerSnapshot);
  const [placement, setPlacement] = useState<ShortcutPlacementState | null>(null);
  // A layout effect, so the first frame already shows the placed shortcuts and not the CSS homes (no visible jump).
  useLayoutEffect(() => {
    const nav = ref.current;
    if (band === "phone" || !nav) return;
    const cell = shortcutCell(iconSize);
    const measure = () => {
      // While an app window covers the desktop the nav is not drawn; the last placement stays until it comes back.
      if (!nav.clientWidth || !nav.clientHeight) return;
      const area = { width: nav.clientWidth, height: nav.clientHeight };
      let next: ShortcutPlacementState;
      if (band === "tablet") {
        next = { ...placeShortcuts(ids, area, cell, shortcutGap, saved), area, cell, grid: desktopGrid(shortcutDropArea(area), cell) };
      } else {
        const grid = desktopGrid(area, cell);
        const homes = homeShortcutPositions(grid);
        const positions: Partial<Record<DesktopShortcutId, ShortcutPosition>> = {};
        for (const id of ids) {
          const spot = saved[id];
          positions[id] = spot ? clampShortcutPosition(spot, cell, area) : homes[id];
        }
        next = { positions, contentHeight: area.height, area, cell, grid };
      }
      setPlacement((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [ref, band, ids, iconSize, saved]);
  return band === "phone" ? null : placement;
}

/** Owner 22: while «Выровнять значки по сетке» is on, a drop and an Alt+Arrow step end in a cell of the grid; the desktop provides it around the shortcuts. */
export const ShortcutGridContext = createContext(false);

// The desktop grid: the one the placement measured; before the first measurement, the workspace with the cell of the size the desktop set on the page root.
const gridOf = (workspace: HTMLElement, placed?: { grid: DesktopGrid }): DesktopGrid => placed?.grid ?? desktopGrid({ width: workspace.clientWidth, height: workspace.clientHeight }, shortcutCell(document.documentElement.dataset.iconSize ?? "standard"));

/**
 * Where every shortcut stands now, put into the grid (the toggle «Выровнять значки по сетке» was turned on): the places the tablet placement
 * gave, or on the PC the places measured on the page. null on a phone (a CSS grid, nothing to move) or when the desktop has no size to measure.
 */
export function alignedShortcutPositions(nav: HTMLElement, ids: readonly DesktopShortcutId[], placement: ShortcutPlacementState | null): Partial<Record<DesktopShortcutId, ShortcutPosition>> | null {
  if (window.matchMedia(phoneShortcutQuery).matches) return null;
  const workspace = nav.closest<HTMLElement>(".workspace");
  if (!workspace) return null;
  const current: Partial<Record<DesktopShortcutId, ShortcutPosition>> = {};
  if (placement) Object.assign(current, placement.positions);
  else {
    const origin = workspace.getBoundingClientRect();
    for (const id of ids) {
      const rect = nav.querySelector<HTMLElement>(`[data-shortcut="${id}"]`)?.getBoundingClientRect();
      if (rect && rect.width > 0) current[id] = { x: rect.left - origin.left, y: rect.top - origin.top };
    }
  }
  const grid = gridOf(workspace, placement ?? undefined);
  if (grid.area.width <= 0 || grid.area.height <= 0) return null;
  // The home places are cells of this grid already, so turning the grid on does not move a shortcut that was never moved (owner 2026-11-21 item 29).
  return alignShortcutsToGrid(current, ids, grid);
}

export function placedShortcut(placement: ShortcutPlacementState | null, id: DesktopShortcutId): PlacedShortcut | undefined {
  const position = placement?.positions[id];
  return placement && position ? { position, area: placement.area, cell: placement.cell, grid: placement.grid, positions: placement.positions } : undefined;
}

export function DesktopIcon({ app, onOpen, position, placed, onMove, onAnnounce, className = "", badge = false }: { app: Exclude<AppId, "editor">; onOpen: (app: AppId, origin?: OpenOrigin) => void; position?: ShortcutPosition; placed?: PlacedShortcut; onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void; onAnnounce?: (message: string) => void; className?: string; badge?: boolean }) {
  return <DraggableDesktopIcon shortcutId={app} label={appMeta[app].label} icon={appMeta[app].icon} position={position} placed={placed} onMove={onMove} onAnnounce={onAnnounce} onActivate={(origin) => onOpen(app, origin)} className={className} badge={badge} />;
}

// What a moved shortcut must leave free: the assistant and the format button (same set for a drop and for a key press).
function shortcutObstacles(workspace: HTMLElement): Rect[] {
  const workspaceRect = workspace.getBoundingClientRect();
  return Array.from(document.querySelectorAll<HTMLElement>(".desktop-assistant, .global-format-launch")).map((element): Rect => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left - workspaceRect.left, y: rect.top - workspaceRect.top, width: rect.width, height: rect.height };
  });
}

// The other shortcuts as rectangles in the workspace: with the grid on, the cell of one of them is not free for the shortcut that is moved (26.1-REVIEW-2 WR-05).
function shortcutNeighbours(workspace: HTMLElement, ownId: string): Rect[] {
  const workspaceRect = workspace.getBoundingClientRect();
  return Array.from(workspace.querySelectorAll<HTMLElement>("[data-shortcut]")).filter((element) => element.dataset.shortcut !== ownId).flatMap((element): Rect[] => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? [{ x: rect.left - workspaceRect.left, y: rect.top - workspaceRect.top, width: rect.width, height: rect.height }] : [];
  });
}

// Alt+Arrow moves a shortcut by this many px (Shift: the large step); the drag it replaces has no other keyboard route.
const keyboardMoveStep = 16;
const keyboardMoveLargeStep = 64;

// Not shorter than the longest cycle (560 + 90ms offset); a timer, not animationend, because a hidden tab may never deliver the event (D-02).
const shortcutAnimationMs = 700;

function useShortcutAnimation() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const play = useCallback(() => {
    if (timer.current !== null) return;
    setPlaying(true);
    timer.current = window.setTimeout(() => {
      setPlaying(false);
      timer.current = null;
    }, shortcutAnimationMs);
  }, []);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  return { playing, play };
}

export function StartPanelButton({ icon, label, onClick }: { icon: PortiaIconName; label: string; onClick: () => void }) {
  const animation = useShortcutAnimation();
  return <button className={animation.playing ? "is-icon-animating" : undefined} type="button" onPointerEnter={animation.play} onFocus={animation.play} onClick={onClick}><span className="start-panel-icon" data-icon={icon}><PortiaIcon name={icon} /></span>{label}</button>;
}

function DraggableDesktopIcon({ shortcutId, label, icon, position, placed, onMove, onAnnounce, onActivate, className = "", badge = false }: {
  shortcutId: DesktopShortcutId;
  label: string;
  icon: PortiaIconName;
  position?: ShortcutPosition;
  placed?: PlacedShortcut;
  onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void;
  onAnnounce?: (message: string) => void;
  onActivate?: (origin: OpenOrigin) => void;
  className?: string;
  badge?: boolean;
}) {
  const dragRef = useRef<null | { pointerId: number; startX: number; startY: number; originX: number; originY: number; workspace: HTMLElement; target: HTMLElement; moved: boolean; last: ShortcutPosition }>(null);
  const suppressActivation = useRef(false);
  const dropTimer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const iconAnimation = useShortcutAnimation();
  const grid = useContext(ShortcutGridContext);

  useEffect(() => () => {
    if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
  }, []);

  // The cell and the area of the placement's grid, so a drop lands where the next placement keeps it; before the first measurement: the shortcut and the workspace.
  const dropBounds = (workspace: HTMLElement, target: HTMLElement) => placed ? { size: placed.cell, area: placed.grid.area } : { size: { width: target.offsetWidth, height: target.offsetHeight }, area: { width: workspace.clientWidth, height: workspace.clientHeight } };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    iconAnimation.play();
    // ≤520px — сетка телефона без свободного перетаскивания; 521–900 — то же правило, что и ПК, с расстановкой JS.
    if (window.matchMedia(phoneShortcutQuery).matches || event.button !== 0) return;
    if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
    setDropping(false);
    const workspace = event.currentTarget.closest<HTMLElement>(".workspace");
    if (!workspace) return;
    const iconRect = event.currentTarget.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: iconRect.left - workspaceRect.left,
      originY: iconRect.top - workspaceRect.top,
      workspace,
      target: event.currentTarget,
      moved: false,
      last: { x: iconRect.left - workspaceRect.left, y: iconRect.top - workspaceRect.top },
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - operation.startX;
    const deltaY = event.clientY - operation.startY;
    if (!operation.moved && Math.hypot(deltaX, deltaY) < 6) return;
    operation.moved = true;
    setDragging(true);
    event.preventDefault();
    const bounds = dropBounds(operation.workspace, operation.target);
    operation.last = clampShortcutPosition({ x: operation.originX + deltaX, y: operation.originY + deltaY }, bounds.size, bounds.area);
    onMove(shortcutId, operation.last);
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (operation.moved) {
      // On drop the shortcut also leaves the assistant and the format button free.
      const obstacles = shortcutObstacles(operation.workspace);
      const bounds = dropBounds(operation.workspace, operation.target);
      // With the grid on the drop ends in the nearest FREE cell (no other shortcut, no obstacle in it), which is a cell of the grid, so no clamp follows that could push it off the grid;
      // only when every cell is taken does the old snap-and-clamp stand (26.1-REVIEW-2 WR-05).
      const desktop = gridOf(operation.workspace, placed);
      const landing = grid ? nearestFreeGridCell(operation.last, desktop, [...obstacles, ...shortcutNeighbours(operation.workspace, shortcutId)]) ?? clampShortcutPosition(snapShortcutPosition(operation.last, desktop), bounds.size, bounds.area, obstacles) : clampShortcutPosition(operation.last, bounds.size, bounds.area, obstacles);
      onMove(shortcutId, landing);
      suppressActivation.current = true;
      window.setTimeout(() => { suppressActivation.current = false; }, 0);
      setDropping(true);
      dropTimer.current = window.setTimeout(() => {
        setDropping(false);
        dropTimer.current = null;
      }, 180);
    }
    dragRef.current = null;
    setDragging(false);
  };

  // The keyboard alternative to the drag (WCAG 2.5.7): Alt+Arrow moves the focused shortcut, Shift makes the step larger. Plain arrows and Enter keep their meaning.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!event.altKey || event.ctrlKey || !event.key.startsWith("Arrow")) return;
    // ≤520px — сетка телефона без свободного перетаскивания; 521–900 — то же правило, что и ПК, с расстановкой JS.
    if (window.matchMedia(phoneShortcutQuery).matches) return;
    const workspace = event.currentTarget.closest<HTMLElement>(".workspace");
    if (!workspace) return;
    const step = event.shiftKey ? keyboardMoveLargeStep : keyboardMoveStep;
    const deltaX = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const deltaY = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!deltaX && !deltaY) return;
    event.preventDefault();
    const iconRect = event.currentTarget.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const bounds = dropBounds(workspace, event.currentTarget);
    const from = { x: iconRect.left - workspaceRect.left, y: iconRect.top - workspaceRect.top };
    // With the grid on one press is one cell (Shift: four), counted from the cell the shortcut is in now.
    const desktop = gridOf(workspace, placed);
    const cells = event.shiftKey ? 4 : 1;
    if (grid) {
      // A taken cell is jumped over to the next free one that way; with none, the shortcut stays and says so (26.1-REVIEW-2 WR-05).
      const free = freeGridCellAlong(from, { x: Math.sign(deltaX), y: Math.sign(deltaY) }, cells, desktop, [...shortcutObstacles(workspace), ...shortcutNeighbours(workspace, shortcutId)]);
      if (!free) { onAnnounce?.(`Ярлык «${label}» остался на месте: клетка занята`); return; }
      onMove(shortcutId, free);
      onAnnounce?.(`Ярлык «${label}» перемещён`);
      return;
    }
    onMove(shortcutId, clampShortcutPosition({ x: from.x + deltaX, y: from.y + deltaY }, bounds.size, bounds.area, shortcutObstacles(workspace)));
    onAnnounce?.(`Ярлык «${label}» перемещён`);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (suppressActivation.current) {
      event.preventDefault();
      return;
    }
    const symbol = event.currentTarget.querySelector(".desktop-icon-symbol") ?? event.currentTarget;
    onActivate?.(originOf(symbol, "icon"));
  };

  const sharedProps = {
    className: `desktop-icon${className ? ` ${className}` : ""}${dragging ? " is-dragging" : ""}${dropping ? " is-dropping" : ""}${iconAnimation.playing ? " is-icon-animating" : ""}`,
    "data-shortcut": shortcutId,
    // 521–900px: the spot placeShortcuts gave it. Otherwise a position saved on a bigger screen is held inside the desktop so the icon never disappears.
    style: placed ? placedShortcutLayout(placed.position) : position ? savedShortcutLayout(position) : defaultShortcutLayout[shortcutId],
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    onPointerEnter: iconAnimation.play,
    onFocus: iconAnimation.play,
    onDragStart: (event: React.DragEvent<HTMLElement>) => event.preventDefault(),
  };
  const content = <><span data-icon={icon} className="desktop-icon-symbol"><PortiaIcon name={icon} />{badge && <i className="desktop-icon-badge" aria-label="Есть новая сводка" />}</span><span className="desktop-icon-label">{label}</span></>;

  return <button {...sharedProps} type="button">{content}</button>;
}
