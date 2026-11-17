"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { appMeta, type AppId } from "@/components/portia-desktop-window";
import { originOf, type OpenOrigin } from "@/lib/window-open";
import { clampShortcutPosition, placeShortcuts, shortcutCell, shortcutDropArea, type Rect, type ShortcutCell } from "@/lib/shortcut-layout";

export type DesktopShortcutId = "search" | "archive" | "employees" | "broadcasts" | "info" | "guide" | "promotion" | "settings" | "charter" | "sheet" | "trash";
export type ShortcutPosition = { x: number; y: number };
type ShortcutLayoutStyle = React.CSSProperties & {
  "--shortcut-left": string;
  "--shortcut-top": string;
  "--shortcut-right": string;
  "--shortcut-bottom": string;
};

// One independent home for every shortcut. Saved drag coordinates override only that shortcut;
// adding an app can no longer inherit another icon's static/absolute position by accident.
const defaultShortcutLayout: Record<DesktopShortcutId, ShortcutLayoutStyle> = {
  search: shortcutLayout({ left: 14, top: 20 }),
  archive: shortcutLayout({ left: 14, top: 124 }),
  broadcasts: shortcutLayout({ left: 14, top: 228 }),
  info: shortcutLayout({ left: 14, top: 332 }),
  employees: shortcutLayout({ left: 14, top: 436 }),
  settings: shortcutLayout({ left: 124, top: 20 }),
  guide: shortcutLayout({ left: 124, top: 124 }),
  promotion: shortcutLayout({ left: 124, top: 228 }),
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
const subscribeTabletShortcuts = (notify: () => void) => {
  const query = window.matchMedia(tabletShortcutQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const tabletShortcutsSnapshot = () => window.matchMedia(tabletShortcutQuery).matches;
const tabletShortcutsServerSnapshot = () => false;

export type ShortcutPlacementState = {
  positions: Partial<Record<DesktopShortcutId, ShortcutPosition>>;
  contentHeight: number;
  area: { width: number; height: number };
  cell: ShortcutCell;
};
export type PlacedShortcut = { position: ShortcutPosition; area: { width: number; height: number }; cell: ShortcutCell };

/**
 * At 521–900px measures .desktop-icons (a ResizeObserver: rotation, window size, icon size) and places every shortcut through
 * placeShortcuts; null on the PC (≥901px, the approved absolute homes) and on a phone (≤520px, the CSS grid).
 */
export function useShortcutPlacement(
  ref: React.RefObject<HTMLElement | null>,
  ids: readonly DesktopShortcutId[],
  iconSize: string,
  saved: Partial<Record<DesktopShortcutId, ShortcutPosition>>,
): ShortcutPlacementState | null {
  const tablet = useSyncExternalStore(subscribeTabletShortcuts, tabletShortcutsSnapshot, tabletShortcutsServerSnapshot);
  const [placement, setPlacement] = useState<ShortcutPlacementState | null>(null);
  // A layout effect, so the first frame on this width already shows the placed shortcuts and not the PC homes.
  useLayoutEffect(() => {
    const nav = ref.current;
    if (!tablet || !nav) return;
    const cell = shortcutCell(iconSize);
    const measure = () => {
      // While an app window covers the desktop the nav is not drawn; the last placement stays until it comes back.
      if (!nav.clientWidth || !nav.clientHeight) return;
      const area = { width: nav.clientWidth, height: nav.clientHeight };
      const next: ShortcutPlacementState = { ...placeShortcuts(ids, area, cell, shortcutGap, saved), area, cell };
      setPlacement((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [ref, tablet, ids, iconSize, saved]);
  return tablet ? placement : null;
}

export function placedShortcut(placement: ShortcutPlacementState | null, id: DesktopShortcutId): PlacedShortcut | undefined {
  const position = placement?.positions[id];
  return placement && position ? { position, area: placement.area, cell: placement.cell } : undefined;
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

  useEffect(() => () => {
    if (dropTimer.current !== null) window.clearTimeout(dropTimer.current);
  }, []);

  // 521–900px: the cell and area of the placement, so a drop lands where the next placement keeps it; PC: the shortcut and the workspace.
  const dropBounds = (workspace: HTMLElement, target: HTMLElement) => placed ? { size: placed.cell, area: shortcutDropArea(placed.area) } : { size: { width: target.offsetWidth, height: target.offsetHeight }, area: { width: workspace.clientWidth, height: workspace.clientHeight } };

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
      onMove(shortcutId, clampShortcutPosition(operation.last, bounds.size, bounds.area, obstacles));
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
    onMove(shortcutId, clampShortcutPosition(
      { x: iconRect.left - workspaceRect.left + deltaX, y: iconRect.top - workspaceRect.top + deltaY },
      bounds.size,
      bounds.area,
      shortcutObstacles(workspace),
    ));
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
