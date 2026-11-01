"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { appMeta, type AppId } from "@/components/portia-desktop-window";
import { originOf, type OpenOrigin } from "@/lib/window-open";

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

function savedShortcutLayout(position: ShortcutPosition): ShortcutLayoutStyle {
  return {
    "--shortcut-left": `max(0px, min(${position.x}px, calc(100% - 100px)))`,
    "--shortcut-top": `max(0px, min(${position.y}px, calc(100% - 110px)))`,
    "--shortcut-right": "auto",
    "--shortcut-bottom": "auto",
  };
}

export function DesktopIcon({ app, onOpen, position, onMove, className = "", badge = false }: { app: Exclude<AppId, "editor">; onOpen: (app: AppId, origin?: OpenOrigin) => void; position?: ShortcutPosition; onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void; className?: string; badge?: boolean }) {
  return <DraggableDesktopIcon shortcutId={app} label={appMeta[app].label} icon={appMeta[app].icon} position={position} onMove={onMove} onActivate={(origin) => onOpen(app, origin)} className={className} badge={badge} />;
}

const shortcutAnimationMs = 760;

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
  const dragRef = useRef<null | { pointerId: number; startX: number; startY: number; originX: number; originY: number; workspace: HTMLElement; target: HTMLElement; moved: boolean }>(null);
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
    if (window.innerWidth <= 520 || event.button !== 0) return;
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
    const maximumX = Math.max(8, operation.workspace.clientWidth - operation.target.offsetWidth - 8);
    const maximumY = Math.max(8, operation.workspace.clientHeight - operation.target.offsetHeight - 8);
    onMove(shortcutId, {
      x: Math.min(maximumX, Math.max(8, operation.originX + deltaX)),
      y: Math.min(maximumY, Math.max(8, operation.originY + deltaY)),
    });
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (operation.moved) {
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
