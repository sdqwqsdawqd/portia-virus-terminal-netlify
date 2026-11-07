"use client";

import { useId, useState } from "react";
import { defaultImageFraming, imageFramingLimits, imageFramingStep, imageFramingStyles, normalizeImageFraming, type ImageFraming } from "@/lib/image-framing";

// D-63 (20-53): the block «Видимая часть» under a picture field of the editor. The preview is the picture of the site (the same `.portia-image` frame
// and `.portia-image img` styles, the same imageFramingStyles), in a frame of the same kind as the site's, so what the editor sees here is what a visitor gets.
// It does not import PortiaImage: the template builder shares the editor's picture field, and its import graph may hold no desktop module (portia-template-builder.test). Three sliders (keyboard steps of 5, touch targets
// of 44 px on a phone) replace dragging; «Сбросить» removes the frame. Every value goes through normalizeImageFraming: the default frame is never stored.
// The captions are short (D-56) and live here, not in the editor file (D-58).

/** The frame of the site surface: a band across a «Справочник» section, a 4:3 card cover, or the picture as it lies (dossier, mutation, «Информация», «Корзина»). */
export type ImageFramingBox = "natural" | "band" | "tile";

const sliders = [
  { key: "x", label: "По горизонтали", ...imageFramingLimits.position },
  { key: "y", label: "По вертикали", ...imageFramingLimits.position },
  { key: "zoom", label: "Масштаб", ...imageFramingLimits.zoom },
] as const;

export function ImageFramingEditor({ src, framing, box, label, onChange }: {
  src: string;
  framing: ImageFraming | undefined;
  box: ImageFramingBox;
  /** The label of the picture field: read after the caption, so that several blocks on one page differ for a screen reader. */
  label: string;
  onChange: (framing: ImageFraming | undefined) => void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const idBase = useId();
  const current = normalizeImageFraming(framing) ?? defaultImageFraming;
  const change = (key: "x" | "y" | "zoom", value: number) => onChange(normalizeImageFraming({ ...current, [key]: value }));

  return <div className={`image-framing image-framing-${box}`} role="group" aria-labelledby={`${titleId} ${fieldId}`}>
    <strong id={titleId} className="image-framing-title">Видимая часть</strong>
    <span id={fieldId} className="sr-only">{label}</span>
    <div className={`image-framing-frame ${box}`}>
      <FramedPreview key={src} src={src} framing={framing} fill={box !== "natural"} />
    </div>
    <div className="image-framing-controls">
      {sliders.map(({ key, label: name, min, max }) => {
        const id = `${idBase}-${key}`;
        return <div className="image-framing-row" key={key}>
          <label htmlFor={id}>{name}</label>
          <input id={id} type="range" min={min} max={max} step={imageFramingStep} value={current[key]} aria-valuetext={`${current[key]} %`} onChange={(event) => change(key, Number(event.target.value))} />
          <output htmlFor={id} aria-hidden="true">{current[key]} %</output>
        </div>;
      })}
      <button type="button" className="secondary-control image-framing-reset" onClick={() => onChange(undefined)}>Сбросить</button>
    </div>
  </div>;
}

/** The picture as the site draws it: a quiet skeleton until it loads, then the frame clips it and the numbers of the frame place it. Remounted per address. */
function FramedPreview({ src, framing, fill }: { src: string; framing: ImageFraming | undefined; fill: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const styles = imageFramingStyles(normalizeImageFraming(framing));
  return <span className={`portia-image ${loaded ? "is-loaded" : "is-loading"}${fill ? " is-fill" : ""}`} data-framing={styles.frame ? "true" : undefined} style={styles.frame}>
    {!loaded && <span className="portia-image-skeleton" aria-hidden="true" />}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt="" style={styles.image} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} />
  </span>;
}
