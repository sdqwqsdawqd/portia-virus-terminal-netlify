"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingState } from "@/components/portia-desktop-dossier";

// D-19: one permission set for every third-party frame. Scripts and same-origin let the viewers run, popups escape the sandbox so links open as normal tabs;
// no top-navigation flag, so a frame can never move the PORTIA tab. If a device needs more, add only that one flag.
export const embedSandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

const zoomSteps = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
// D-21: Ctrl zooms everywhere and Cmd on a Mac; the Windows key never does (trackpad pinch arrives as ctrlKey).
const zoomModifier = (event: { ctrlKey: boolean; metaKey: boolean }) => event.ctrlKey || (event.metaKey && /^(Mac|iPhone|iPad|iPod)/.test(navigator.platform));

export function EmbeddedDocument({ src, external, title }: { src: string; external: string; title: string }) {
  const [zoom, setZoom] = useState(1);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [frameLoading, setFrameLoading] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const step = useCallback((direction: 1 | -1) => setZoom((current) => {
    const index = zoomSteps.findIndex((value) => value >= current - 0.001);
    return zoomSteps[Math.min(zoomSteps.length - 1, Math.max(0, index + direction))];
  }), []);

  // Wheel events over the embedded page never reach PORTIA, so while Ctrl is held a clear
  // layer covers the document and takes the wheel for our own zoom.
  useEffect(() => {
    const key = (event: KeyboardEvent) => setCtrlHeld(zoomModifier(event));
    const release = () => setCtrlHeld(false);
    const hide = () => { if (document.visibilityState === "hidden") setCtrlHeld(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // Non-passive so Ctrl+wheel zooms the document instead of the whole browser tab.
    const wheel = (event: WheelEvent) => {
      if (!zoomModifier(event)) return;
      event.preventDefault();
      step(event.deltaY < 0 ? 1 : -1);
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, [step]);

  return <div className="document-app" ref={frameRef}>
    <div className="document-app-viewport">
      <iframe src={src} title={title} loading="lazy" sandbox={embedSandbox} referrerPolicy="no-referrer" onLoad={() => setFrameLoading(false)} style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})` }} />
      {frameLoading && <LoadingState label="Загрузка документа…" />}
      {/* A lost keyup (Ctrl+key shortcut that moved focus, a context menu) clears on the first move or press instead of leaving the document blocked (01-WR-03). */}
      {ctrlHeld && <div className="document-app-zoom-layer" aria-hidden="true" onPointerMove={(event) => { if (!zoomModifier(event)) setCtrlHeld(false); }} onPointerDown={(event) => { if (!zoomModifier(event)) setCtrlHeld(false); }} />}
    </div>
    <div className="document-app-bar">
      <div className="document-app-zoom" role="group" aria-label="Масштаб документа">
        <button type="button" onClick={() => step(-1)} aria-label="Уменьшить">−</button>
        <button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => step(1)} aria-label="Увеличить">+</button>
      </div>
      <a className="document-app-external" href={external} target="_blank" rel="noreferrer">Открыть отдельно</a>
    </div>
  </div>;
}
