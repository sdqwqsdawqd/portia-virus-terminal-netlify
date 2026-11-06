"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { preconnect, preload } from "react-dom";
import { MEDIA_SLOW_MS, mediaLoadingAttrs, mediaSource, visibleTimerRunning } from "@/lib/media-display";
import { PortiaIcon, PortiaIllustration, type PortiaIconName, type PortiaIllustrationName } from "@/components/portia-icons";

export type PortiaImageIcon = PortiaIconName | PortiaIllustrationName;

const isIllustration = (name: PortiaImageIcon): name is PortiaIllustrationName => name === "flaskEmpty" || name === "microscopeGuide";

// The active hero opens its connection and starts its fetch before the image element mounts. Called from PortiaImage only.
function prioritizeImage(src: string) {
  if (!src.startsWith("https://")) return;
  try {
    preconnect(new URL(src).origin);
    preload(src, { as: "image", fetchPriority: "high", referrerPolicy: "no-referrer" });
  } catch { /* mediaSource rejects malformed links before they reach this surface. */ }
}

const unavailableLabel = "Изображение недоступно";

type ImageState = "loading" | "loaded" | "failed";

export function useVisibleTimeout(target: RefObject<Element | null>, state: ImageState, ms: number, onTimeout: () => void): boolean {
  const [visible, setVisible] = useState(false);
  const callback = useRef(onTimeout);
  useEffect(() => { callback.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      let active = true;
      queueMicrotask(() => { if (active) setVisible(true); });
      return () => { active = false; };
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: null, rootMargin: "0px", threshold: 0,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  useEffect(() => {
    if (!visibleTimerRunning(state, visible)) return;
    const timer = window.setTimeout(() => callback.current(), ms);
    return () => window.clearTimeout(timer);
  }, [state, visible, ms]);

  return visible;
}

type PortiaImageProps = {
  src: string | undefined;
  alt: string;
  // The record the picture belongs to: a new record mounts a fresh frame, so the previous record's picture is never shown as the new one (D-15).
  recordId: string;
  priority: "hero" | "lazy";
  icon?: PortiaImageIcon;
  className?: string;
  caption?: string;
  style?: CSSProperties;
};

// Every record picture goes through here: link check before any request, a quiet skeleton, the PORTIA placeholder on error, block or 15 seconds.
export function PortiaImage({ src, recordId, ...rest }: PortiaImageProps) {
  const source = mediaSource(src);
  const link = source.kind === "image" ? source.src : "";
  return <PortiaImageFrame key={`${recordId}|${link}`} link={link} {...rest} />;
}

function PortiaImageFrame({ link, alt, priority, icon = "microscopeGuide", className, caption, style }: Omit<PortiaImageProps, "src" | "recordId"> & { link: string }) {
  const [state, setState] = useState<ImageState>(link ? "loading" : "failed");
  const image = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const visible = useVisibleTimeout(frameRef, state, MEDIA_SLOW_MS, () => setState((current) => current === "loading" ? "failed" : current));
  if (link && priority === "hero") prioritizeImage(link);

  useEffect(() => {
    if (state !== "loading") return;
    // A picture that finished before hydration attached onLoad is already complete.
    if (image.current?.complete && image.current.naturalWidth > 0) {
      setState("loaded");
      return;
    }
  }, [state]);

  const trimmedCaption = caption?.trim() ?? "";
  return <>
    <span ref={frameRef} className={`portia-image is-${state}${className ? ` ${className}` : ""}`} data-media-state={state} data-media-armed={String(visible && state === "loading")}>
      {state !== "failed" && <>
        <span className="portia-image-skeleton" aria-hidden="true" />
        <img
          ref={image}
          src={link}
          alt={alt}
          style={style}
          {...mediaLoadingAttrs(priority)}
          referrerPolicy="no-referrer"
          onLoad={() => setState("loaded")}
          onError={() => setState((current) => (current === "loaded" ? current : "failed"))}
        />
      </>}
      {state === "failed" && <span className="portia-image-placeholder" title={unavailableLabel}>
        {isIllustration(icon) ? <PortiaIllustration name={icon} /> : <PortiaIcon name={icon} />}
        <span className="portia-image-placeholder-label">{unavailableLabel}</span>
      </span>}
    </span>
    {trimmedCaption && <span className="portia-image-caption">{caption}</span>}
  </>;
}
