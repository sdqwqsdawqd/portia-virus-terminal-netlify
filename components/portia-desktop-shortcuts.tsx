"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { appMeta, type AppId } from "@/components/portia-desktop-window";
import { originOf, type OpenOrigin } from "@/lib/window-open";
import { clampShortcutPosition, type Rect } from "@/lib/shortcut-layout";

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

export function DesktopIcon({ app, onOpen, position, onMove, className = "", badge = false }: { app: Exclude<AppId, "editor">; onOpen: (app: AppId, origin?: OpenOrigin) => void; position?: ShortcutPosition; onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void; className?: string; badge?: boolean }) {
  return <DraggableDesktopIcon shortcutId={app} label={appMeta[app].label} icon={appMeta[app].icon} position={position} onMove={onMove} onActivate={(origin) => onOpen(app, origin)} className={className} badge={badge} />;
}

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

function DraggableDesktopIcon({ shortcutId, label, icon, position, onMove, onActivate, className = "", badge = false }: {
  shortcutId: DesktopShortcutId;
  label: string;
  icon: PortiaIconName;
  position?: ShortcutPosition;
  onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void;
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

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    iconAnimation.play();
    // Same breakpoint as windows: the phone grid has no free drag.
    if (window.matchMedia("(max-width: 900px)").matches || event.button !== 0) return;
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
    operation.last = clampShortcutPosition(
      { x: operation.originX + deltaX, y: operation.originY + deltaY },
      { width: operation.target.offsetWidth, height: operation.target.offsetHeight },
      { width: operation.workspace.clientWidth, height: operation.workspace.clientHeight },
    );
    onMove(shortcutId, operation.last);
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (operation.moved) {
      // On drop the shortcut also leaves the assistant and the format button free.
      const workspaceRect = operation.workspace.getBoundingClientRect();
      const obstacles = Array.from(document.querySelectorAll<HTMLElement>(".desktop-assistant, .global-format-launch")).map((element): Rect => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left - workspaceRect.left, y: rect.top - workspaceRect.top, width: rect.width, height: rect.height };
      });
      onMove(shortcutId, clampShortcutPosition(
        operation.last,
        { width: operation.target.offsetWidth, height: operation.target.offsetHeight },
        { width: operation.workspace.clientWidth, height: operation.workspace.clientHeight },
        obstacles,
      ));
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
    // A position saved on a bigger screen is held inside the desktop so the icon never disappears.
    style: position ? savedShortcutLayout(position) : defaultShortcutLayout[shortcutId],
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onClick: handleClick,
    onPointerEnter: iconAnimation.play,
    onFocus: iconAnimation.play,
    onDragStart: (event: React.DragEvent<HTMLElement>) => event.preventDefault(),
  };
  const content = <><span data-icon={icon} className="desktop-icon-symbol"><PortiaIcon name={icon} />{badge && <i className="desktop-icon-badge" aria-label="Есть новая сводка" />}</span><span>{label}</span></>;

  return <button {...sharedProps} type="button">{content}</button>;
}
