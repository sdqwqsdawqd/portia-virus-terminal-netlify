"use client";

import { useEffect, useRef, useState } from "react";
import { preconnect, preload } from "react-dom";
import { MEDIA_SLOW_MS, mediaLoadingAttrs, mediaSource } from "@/lib/media-display";
import { PortiaIcon, PortiaIllustration, type PortiaIconName, type PortiaIllustrationName } from "@/components/portia-icons";

export type PortiaImageIcon = PortiaIconName | PortiaIllustrationName;

const isIllustration = (name: PortiaImageIcon): name is PortiaIllustrationName => name === "dish" || name === "microscope" || name === "flask";

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

type PortiaImageProps = {
  src: string | undefined;
  alt: string;
  // The record the picture belongs to: a new record mounts a fresh frame, so the previous record's picture is never shown as the new one (D-15).
  recordId: string;
  priority: "hero" | "lazy";
  icon?: PortiaImageIcon;
  className?: string;
  caption?: string;
};

// Every record picture goes through here: link check before any request, a quiet skeleton, the PORTIA placeholder on error, block or 15 seconds.
export function PortiaImage({ src, recordId, ...rest }: PortiaImageProps) {
  const source = mediaSource(src);
  const link = source.kind === "image" ? source.src : "";
  return <PortiaImageFrame key={`${recordId}|${link}`} link={link} {...rest} />;
}

function PortiaImageFrame({ link, alt, priority, icon = "microscope", className, caption }: Omit<PortiaImageProps, "src" | "recordId"> & { link: string }) {
  const [state, setState] = useState<ImageState>(link ? "loading" : "failed");
  const image = useRef<HTMLImageElement>(null);
  if (link && priority === "hero") prioritizeImage(link);

  useEffect(() => {
    if (state !== "loading") return;
    // A picture that finished before hydration attached onLoad is already complete.
    if (image.current?.complete && image.current.naturalWidth > 0) {
      setState("loaded");
      return;
    }
    // The timer dies with the frame or with the first answer, so a late callback cannot flip a settled picture.
    const timer = window.setTimeout(() => setState((current) => (current === "loading" ? "failed" : current)), MEDIA_SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const trimmedCaption = caption?.trim() ?? "";
  return <>
    <span className={`portia-image is-${state}${className ? ` ${className}` : ""}`} data-media-state={state}>
      {state !== "failed" && <>
        <span className="portia-image-skeleton" aria-hidden="true" />
        <img
          ref={image}
          src={link}
          alt={alt}
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
