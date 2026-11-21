"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PortiaIcon, type PortiaIconName } from "@/components/portia-icons";
import { titlebarReachable, type Bounds, type WindowGeometry } from "@/lib/window-geometry";

/** Pause before the preview of a hovered taskbar button appears, and before it goes away after the pointer left. */
export const PREVIEW_SHOW_MS = 300;
export const PREVIEW_HIDE_MS = 200;
/** The picture of the window is taken again no more often than this, only while the preview is open. */
export const PREVIEW_REFRESH_MS = 1000;
/** The frame of the picture inside the 220px preview: the widest it may be (inside the 12px padding and the border), and the tallest. */
const THUMB_MAX_WIDTH = 192;
const THUMB_MAX_HEIGHT = 140;
const REPLACED_TAGS = ["iframe", "video", "canvas", "embed", "object"];
/** Attributes that would make the copy a second, live and reachable window: ids repeat, forms submit, focus lands, the window is found twice. */
const COPY_STRIP_ATTRIBUTES = ["id", "name", "for", "form", "autofocus", "tabindex", "accesskey", "data-window-app", "role", "aria-modal"];

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

/** The last picture of every window, so a minimized (hidden) window still has one. One detached node per app; dropped once the window is not minimized and not on the screen. */
const lastPreviewClone = new Map<string, { node: HTMLElement; width: number; height: number }>();

/**
 * A picture-only copy of a window (OWN-06, owner 21): `cloneNode(true)` of the window, then made harmless. Nothing is loaded again:
 * `iframe`, `video`, `canvas`, `embed` and `object` become `span.taskbar-preview-placeholder` of the same size; ids, names, `for`,
 * `autofocus`, `tabindex` and the like are removed; the root is `inert` and `aria-hidden`. A typed value is not copied. The scroll places
 * of the scrolled blocks go to `data-preview-scroll-*` for whoever inserts the copy (a clone does not keep them).
 */
export function previewCloneOf(source: HTMLElement): HTMLElement {
  const copy = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const copies = [copy, ...Array.from(copy.querySelectorAll<HTMLElement>("*"))];
  for (let index = 0; index < copies.length; index += 1) {
    const from = originals[index];
    const node = copies[index];
    if (!from || !node) continue;
    if (from.scrollTop > 0 || from.scrollLeft > 0) {
      node.setAttribute("data-preview-scroll-top", String(Math.round(from.scrollTop)));
      node.setAttribute("data-preview-scroll-left", String(Math.round(from.scrollLeft)));
    }
    for (const name of COPY_STRIP_ATTRIBUTES) node.removeAttribute(name);
    if (node instanceof HTMLInputElement) node.removeAttribute("value");
  }
  for (let index = 1; index < copies.length; index += 1) {
    const node = copies[index];
    const from = originals[index];
    if (!node || !from) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "link") { node.remove(); continue; }
    if (!REPLACED_TAGS.includes(tag)) continue;
    const stub = document.createElement("span");
    stub.className = "taskbar-preview-placeholder";
    stub.style.width = `${from.offsetWidth}px`;
    stub.style.height = `${from.offsetHeight}px`;
    node.replaceWith(stub);
  }
  copy.setAttribute("inert", "");
  copy.setAttribute("aria-hidden", "true");
  return copy;
}

type TaskbarPreviewProps = {
  app: string;
  label: string;
  icon: PortiaIconName;
  /** The window frame; `undefined` for a maximized window. Only the "beyond the edge" note is drawn from it. */
  geometry: WindowGeometry | undefined;
  bounds: Bounds;
  minimized: boolean;
  onMaximize: () => void;
  onClose: () => void;
  /** Escape: the desktop hides the preview and gives the focus back to the taskbar button. */
  onDismiss: () => void;
};

/** What hovering a taskbar button shows: a small copy of what the window shows now, a note when it is beyond the edge, and the buttons. */
export function TaskbarPreview({ app, label, icon, geometry, bounds, minimized, onMaximize, onClose, onDismiss }: TaskbarPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lost = Boolean(geometry) && !minimized && !titlebarReachable(geometry as WindowGeometry, bounds);
  // Near the right end of the taskbar the preview slides left so it stays on the screen.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.translate = "";
    const over = element.getBoundingClientRect().right - (window.innerWidth - 8);
    if (over > 0) element.style.translate = `${-over}px 0`;
  }, [app]);
  // The picture: taken at once, then at most once a second while the preview is open, removed with the preview.
  // It is written by hand into a node React does not own, so no state moves and nothing is stored (STAB-DESK-07).
  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const canvas = canvasRef.current;
    if (!thumb || !canvas) return;
    let size: { width: number; height: number } | null = null;
    const show = (node: HTMLElement, width: number, height: number) => {
      const scale = Math.min(THUMB_MAX_WIDTH / width, THUMB_MAX_HEIGHT / height);
      size = { width, height };
      thumb.style.width = `${Math.round(width * scale)}px`;
      thumb.style.height = `${Math.round(height * scale)}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.transform = `scale(${scale})`;
      canvas.replaceChildren(node);
      thumb.setAttribute("data-live", "true");
      node.querySelectorAll<HTMLElement>("[data-preview-scroll-top]").forEach((block) => {
        block.scrollTop = Number(block.getAttribute("data-preview-scroll-top")) || 0;
        block.scrollLeft = Number(block.getAttribute("data-preview-scroll-left")) || 0;
      });
    };
    const empty = () => {
      size = null;
      canvas.replaceChildren();
      thumb.removeAttribute("data-live");
      thumb.style.width = "";
      thumb.style.height = "";
    };
    const paint = () => {
      try {
        const source = document.querySelector<HTMLElement>(`.app-window[data-window-app="${app}"]`);
        if (source && source.offsetWidth > 0 && source.offsetHeight > 0) {
          show(previewCloneOf(source), source.offsetWidth, source.offsetHeight);
          return;
        }
        const last = minimized ? lastPreviewClone.get(app) : undefined;
        if (!minimized) lastPreviewClone.delete(app);
        if (last) show(last.node.cloneNode(true) as HTMLElement, last.width, last.height);
        else empty();
      } catch {
        empty();
      }
    };
    paint();
    const timer = window.setInterval(paint, PREVIEW_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      // The copy on show becomes the last picture of the window; the node itself leaves the document with the preview.
      const last = canvas.firstElementChild;
      if (last && size) lastPreviewClone.set(app, { node: last as HTMLElement, width: size.width, height: size.height });
      canvas.replaceChildren();
    };
  }, [app, minimized]);
  return (
    <div className="taskbar-preview" ref={ref} role="group" aria-label={`${label}: окно`} data-preview-app={app} onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onDismiss();
    }}>
      <div className="taskbar-preview-head"><span className="mini-app-icon"><PortiaIcon name={icon} /></span><strong>{label}</strong></div>
      <div className="taskbar-preview-thumb" ref={thumbRef} aria-hidden="true" data-minimized={minimized ? "true" : undefined}>
        <span className="taskbar-preview-fallback"><PortiaIcon name={icon} /></span>
        <div className="taskbar-preview-canvas" ref={canvasRef} />
      </div>
      {lost && <p className="taskbar-preview-note">За краем экрана</p>}
      <div className="taskbar-preview-actions">
        <button type="button" onClick={onMaximize}>РАЗВЕРНУТЬ</button>
        <button type="button" onClick={onClose}>ЗАКРЫТЬ</button>
      </div>
    </div>
  );
}
