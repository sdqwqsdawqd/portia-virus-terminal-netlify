"use client";

import { useLayoutEffect, useRef } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { dragGeometry, resizeGeometry, type ResizeEdge, type WindowGeometry } from "@/lib/window-geometry";
import { originOf, type WindowState } from "@/lib/window-open";

export type AppId = "archive" | "employees" | "search" | "info" | "guide" | "promotion" | "settings" | "broadcasts" | "trash" | "sheet" | "charter" | "editor";

export const appMeta: Record<AppId, { label: string; path: string; icon: PortiaIconName }> = {
  archive: { label: "База вирусов", path: "PORTIA://VIRUS_ARCHIVE", icon: "virus" },
  employees: { label: "Сотрудники", path: "PORTIA://PERSONNEL", icon: "employees" },
  search: { label: "Глобальный поиск", path: "PORTIA://GLOBAL_SEARCH", icon: "search" },
  info: { label: "Информация", path: "PORTIA://INFORMATION", icon: "info" },
  guide: { label: "Справочник", path: "PORTIA://GUIDE", icon: "guide" },
  promotion: { label: "Повышение", path: "Повышение", icon: "promotion" },
  settings: { label: "Настройки", path: "PORTIA://DESKTOP_SETTINGS", icon: "settings" },
  broadcasts: { label: "Сводка", path: "PORTIA://NEWS", icon: "broadcasts" },
  trash: { label: "Корзина", path: "PORTIA://RECYCLE_BIN", icon: "trash" },
  sheet: { label: "Таблица", path: "PORTIA://DEPARTMENT_SHEET", icon: "sheet" },
  charter: { label: "Устав", path: "PORTIA://CHARTER", icon: "charter" },
  editor: { label: "Редактор", path: "PORTIA://CONTENT_CONTROL", icon: "editor" },
};

// Sized from each window's layout (personnel: 260 px list + a stacked profile), so shrinking never squashes it (D-03).
const windowMinimums: Record<AppId, { width: number; height: number }> = {
  archive: { width: 780, height: 480 },
  employees: { width: 720, height: 480 },
  editor: { width: 720, height: 480 },
  search: { width: 520, height: 420 },
  info: { width: 560, height: 420 },
  guide: { width: 560, height: 420 },
  promotion: { width: 620, height: 480 },
  settings: { width: 520, height: 420 },
  broadcasts: { width: 520, height: 420 },
  trash: { width: 640, height: 440 },
  sheet: { width: 640, height: 440 },
  charter: { width: 640, height: 440 },
};

export function minimumWindowSize(appId: AppId) {
  return windowMinimums[appId];
}

const resizeEdges: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export function AppWindow({ app, state, active, onFocus, onMinimize, onMaximize, onClose, onGeometry, className, meta, locked = false, children }: {
  app: AppId;
  state: WindowState;
  active: boolean;
  onFocus: (app: AppId) => void;
  onMinimize: (app: AppId) => void;
  onMaximize: (app: AppId) => void;
  onClose: (app: AppId) => void;
  onGeometry: (app: AppId, geometry: WindowGeometry) => void;
  className: string;
  meta: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const dragRef = useRef<null | (WindowGeometry & { pointerId: number; startX: number; startY: number; parentWidth: number; parentHeight: number })>(null);
  const resizeRef = useRef<null | (WindowGeometry & { edge: ResizeEdge; pointerId: number; startX: number; startY: number; parentWidth: number; parentHeight: number })>(null);
  const liveGeometry = useRef<WindowGeometry | null>(null);

  // Drag and resize move the element directly; desktop state is updated once at the end, so the whole desktop does not re-render per pointermove (D-09 #10).
  const paint = (geometry: WindowGeometry) => {
    const style = windowRef.current?.style;
    if (!style) return;
    style.left = `${geometry.x}px`;
    style.top = `${geometry.y}px`;
    style.width = `${geometry.width}px`;
    style.height = `${geometry.height}px`;
    liveGeometry.current = geometry;
  };

  const readGeometry = () => {
    const element = windowRef.current;
    const parent = element?.parentElement;
    if (!element || !parent) return null;
    const rect = element.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
      parentWidth: parentRect.width,
      parentHeight: parentRect.height,
    };
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || state.maximized || window.matchMedia("(max-width: 900px)").matches) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const geometry = readGeometry();
    if (!geometry) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { ...geometry, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    onGeometry(app, geometry);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    paint(dragGeometry(operation, event.clientX - operation.startX, event.clientY - operation.startY, { width: operation.parentWidth, height: operation.parentHeight }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (liveGeometry.current) onGeometry(app, liveGeometry.current);
    liveGeometry.current = null;
  };

  const beginResize = (edge: ResizeEdge) => (event: React.PointerEvent<HTMLSpanElement>) => {
    if (locked || state.maximized || window.matchMedia("(max-width: 900px)").matches) return;
    const geometry = readGeometry();
    if (!geometry) return;
    event.stopPropagation();
    onFocus(app);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { ...geometry, edge, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    onGeometry(app, geometry);
  };

  const moveResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    const operation = resizeRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    paint(resizeGeometry(operation, operation.edge, event.clientX - operation.startX, event.clientY - operation.startY, { width: operation.parentWidth, height: operation.parentHeight }, minimumWindowSize(app)));
  };

  const endResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (liveGeometry.current) onGeometry(app, liveGeometry.current);
    liveGeometry.current = null;
  };

  // Open and close settle in place around the window centre (D-14), so the origin is cleared; only minimise / restore aim at the taskbar button. Offsets, not getBoundingClientRect, for the window:
  // during a restore the animation has already shrunk the rect.
  const towardTaskbar = state.exiting === "minimize" || (state.openOrigin?.kind === "taskbar" && !state.exiting);
  useLayoutEffect(() => {
    const element = windowRef.current;
    const parent = element?.offsetParent;
    if (!element || !parent || state.minimized) return;
    const parentRect = parent.getBoundingClientRect();
    const box = { left: parentRect.left + element.offsetLeft - parent.scrollLeft, top: parentRect.top + element.offsetTop - parent.scrollTop };
    let target: { x: number; y: number } | undefined;
    if (towardTaskbar) {
      const button = document.querySelector(`[data-taskbar-app="${app}"]`);
      if (button) target = originOf(button, "taskbar");
    }
    if (!target) {
      element.style.transformOrigin = "";
      return;
    }
    const x = target.x - box.left;
    element.style.transformOrigin = `${Math.round(x)}px ${Math.round(target.y - box.top)}px`;
  }, [app, towardTaskbar, state.exiting, state.minimized, state.open, state.openOrigin]);

  if (!state.open) return null;
  const geometryStyle = state.geometry && !state.maximized ? {
    left: state.geometry.x,
    top: state.geometry.y,
    right: "auto",
    bottom: "auto",
    width: state.geometry.width,
    height: state.geometry.height,
    transform: "none",
  } : {};

  return <section ref={windowRef} className={`app-window ${className}${active ? " is-active" : ""}${state.maximized ? " is-maximized" : ""}${locked ? " is-modal-locked" : ""}${state.exiting === "close" ? " is-closing" : ""}${state.exiting === "minimize" ? " is-minimizing" : ""}${state.openOrigin?.kind === "icon" ? " from-icon" : state.openOrigin?.kind === "taskbar" ? " from-taskbar" : ""}`} style={{ zIndex: state.z, display: state.minimized ? "none" : undefined, ...geometryStyle }} onPointerDown={() => onFocus(app)} aria-label={appMeta[app].label} role={locked ? "dialog" : undefined} aria-modal={locked || undefined}>
    <div className="window-titlebar" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={(event) => { if (!locked && !(event.target as HTMLElement).closest("button")) onMaximize(app); }}><div className="window-identity"><span className="window-app-mark"><PortiaIcon name={appMeta[app].icon} /></span><span>{appMeta[app].path}</span></div><div className="window-meta">{locked ? "ПРОВЕРКА АКТИВНА" : meta}</div>{!locked && <div className="window-controls"><button type="button" data-window-action="minimize" onClick={(event) => { event.stopPropagation(); onMinimize(app); }} aria-label={`Свернуть ${appMeta[app].label}`}>―</button><button type="button" data-window-action="maximize" onClick={(event) => { event.stopPropagation(); onMaximize(app); }} aria-label={`Развернуть ${appMeta[app].label}`}>□</button><button type="button" data-window-action="close" onClick={(event) => { event.stopPropagation(); onClose(app); }} aria-label={`Закрыть ${appMeta[app].label}`}>×</button></div>}</div>
    {children}
    {!locked && resizeEdges.map((edge) => <span key={edge} className={`window-edge window-edge-${edge}`} aria-hidden="true" onPointerDown={beginResize(edge)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />)}
  </section>;
}
