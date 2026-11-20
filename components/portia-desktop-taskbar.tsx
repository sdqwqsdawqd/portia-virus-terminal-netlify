"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { previewRect, titlebarReachable, type Bounds, type WindowGeometry } from "@/lib/window-geometry";

/** Pause before the preview of a hovered taskbar button appears, and before it goes away after the pointer left. */
export const PREVIEW_SHOW_MS = 300;
export const PREVIEW_HIDE_MS = 200;

/**
 * One preview for the whole taskbar (OWN-06). `canShow` is asked at the moment of showing, so the phone,
 * a running taskbar drag and similar conditions are never cached. The timers live in a ref and die with the taskbar.
 */
export function useTaskbarPreview<T extends string>(canShow: () => boolean) {
  const [shown, setShown] = useState<T | null>(null);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
  };
  const show = (app: T, delay = 0) => {
    clear();
    if (!canShow()) return;
    if (delay <= 0) { setShown(app); return; }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (canShow()) setShown(app);
    }, delay);
  };
  const hide = (delay = 0) => {
    clear();
    if (delay <= 0) { setShown(null); return; }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setShown(null);
    }, delay);
  };
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  return { shown, show, hide };
}

type TaskbarPreviewProps = {
  app: string;
  label: string;
  icon: PortiaIconName;
  /** The window frame; `undefined` for a maximized window, which fills the whole map. */
  geometry: WindowGeometry | undefined;
  bounds: Bounds;
  minimized: boolean;
  onMaximize: () => void;
  onClose: () => void;
  /** Escape: the desktop hides the preview and gives the focus back to the taskbar button. */
  onDismiss: () => void;
};

/** What hovering a taskbar button shows: the window on a small map of the screen, where it really is, even beyond the edge. */
export function TaskbarPreview({ app, label, icon, geometry, bounds, minimized, onMaximize, onClose, onDismiss }: TaskbarPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = previewRect(geometry, bounds);
  const lost = Boolean(geometry) && !minimized && !titlebarReachable(geometry as WindowGeometry, bounds);
  // Near the right end of the taskbar the preview slides left so it stays on the screen.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.translate = "";
    const over = element.getBoundingClientRect().right - (window.innerWidth - 8);
    if (over > 0) element.style.translate = `${-over}px 0`;
  }, [app]);
  return (
    <div className="taskbar-preview" ref={ref} role="group" aria-label={`${label}: окно`} data-preview-app={app} onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onDismiss();
    }}>
      <div className="taskbar-preview-head"><span className="mini-app-icon"><PortiaIcon name={icon} /></span><strong>{label}</strong></div>
      <div className="taskbar-preview-map" aria-hidden="true">
        <div className="taskbar-preview-screen" style={{ aspectRatio: bounds.width > 0 && bounds.height > 0 ? `${bounds.width} / ${bounds.height}` : "16 / 9" }}>
          <span className="taskbar-preview-window" data-minimized={minimized ? "true" : undefined} style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }} />
        </div>
      </div>
      {lost && <p className="taskbar-preview-note">За краем экрана</p>}
      <div className="taskbar-preview-actions">
        <button type="button" onClick={onMaximize}>РАЗВЕРНУТЬ</button>
        <button type="button" onClick={onClose}>ЗАКРЫТЬ</button>
      </div>
    </div>
  );
}
