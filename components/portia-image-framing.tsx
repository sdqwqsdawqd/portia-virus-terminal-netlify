"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { defaultImageFraming, imageFramingLimits, imageFramingStep, imageFramingStyles, normalizeImageFraming, type ImageFraming } from "@/lib/image-framing";
import { coverFractions, frameAspectFor, framingFromDrag, framingFromKey, framingWithZoom, settleFraming, stageLayout, type FrameKind, type Size, type StageLayout } from "@/lib/image-framing-crop";

// D-66/D-67 (20-56, replaces the three sliders of D-63 / 20-53): under a picture field of the editor stands a compact block «Видимая часть»: a small preview of what the site
// shows, in a frame of the proportions of its place, and the button «Изменить». The button opens the dialog «Видимая часть» (a native <dialog> in the top layer, like ConfirmDialog):
// the whole picture dimmed, a light frame with the proportions of the place, the picture bright inside the frame, one slider «Масштаб», «Сбросить», «Отмена», «Применить».
// The picture is moved under the frame by the pointer or by the arrow keys of the element «Положение картинки» (steps of 5). The preview is the picture of the site (the same `.portia-image`
// frame and the same imageFramingStyles); it does not import PortiaImage: the template builder shares the editor's picture field, and its import graph may hold no desktop module
// (portia-template-builder.test). Geometry lives in lib/image-framing-crop.ts. Every value that leaves the dialog goes through normalizeImageFraming: the default frame is never stored.
// The captions are short (D-56) and live here, not in the editor file (D-58).

/** The place of the site the picture is shown in: a band across a «Справочник» section, a 4:3 card cover, or the picture as it lies (dossier, mutation, «Информация», «Корзина»). */
export type ImageFramingBox = FrameKind;

const subscribeResize = (notify: () => void) => {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
};
const readViewportWidth = () => window.innerWidth;
const serverViewportWidth = () => 1440;

// The preview of a picture that lies whole fits this box; a band takes the width of the block (up to the cap in the style sheet), a cover is 4:3.
const naturalPreviewBox: Size = { width: 200, height: 112 };

function previewStyle(box: ImageFramingBox, aspect: number, natural: Size | undefined): React.CSSProperties {
  if (box !== "natural") return { aspectRatio: String(aspect) };
  const fit = natural ? Math.min(naturalPreviewBox.width / natural.width, naturalPreviewBox.height / natural.height) : 0;
  return natural ? { width: natural.width * fit, height: natural.height * fit } : { width: naturalPreviewBox.height * (4 / 3), height: naturalPreviewBox.height };
}

export function ImageFramingEditor({ src, framing, box, label, onChange }: {
  src: string;
  framing: ImageFraming | undefined;
  box: ImageFramingBox;
  /** The label of the picture field: read after the caption, so that several blocks on one page differ for a screen reader. */
  label: string;
  onChange: (framing: ImageFraming | undefined) => void;
}) {
  // A new address is a new picture: the size, the open dialog and the preview start over.
  return <FramingBlock key={src} src={src} framing={framing} box={box} label={label} onChange={onChange} />;
}

function FramingBlock({ src, framing, box, label, onChange }: { src: string; framing: ImageFraming | undefined; box: ImageFramingBox; label: string; onChange: (framing: ImageFraming | undefined) => void }) {
  const titleId = useId();
  const fieldId = useId();
  const changeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [natural, setNatural] = useState<Size | undefined>();
  const viewportWidth = useSyncExternalStore(subscribeResize, readViewportWidth, serverViewportWidth);
  const current = normalizeImageFraming(framing);
  const aspect = frameAspectFor(box, { image: natural, viewportWidth });
  const reportSize = useCallback((size: Size) => setNatural((previous) => (previous && previous.width === size.width && previous.height === size.height ? previous : size)), []);

  // The focus goes back to «Изменить» once the dialog is gone (while it is open the page is inert).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) changeRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return <div className={`image-framing image-framing-${box}`} role="group" aria-labelledby={`${titleId} ${fieldId}`}>
    <div className="image-framing-head">
      <strong id={titleId} className="image-framing-title">Видимая часть</strong>
      <button ref={changeRef} type="button" className="secondary-control image-framing-change" aria-haspopup="dialog" onClick={() => setOpen(true)}>Изменить</button>
    </div>
    <span id={fieldId} className="sr-only">{label}</span>
    <div className={`image-framing-preview ${box}`} style={previewStyle(box, aspect, natural)}>
      <FramedPreview src={src} framing={current} fill onSize={reportSize} />
    </div>
    {open && <FramingDialog src={src} label={label} box={box} initial={current} natural={natural} onSize={reportSize} viewportWidth={viewportWidth}
      onApply={(next) => { onChange(next); setOpen(false); }} onCancel={() => setOpen(false)} />}
  </div>;
}

/** The picture as the site draws it: a quiet skeleton until it loads, then the frame clips it and the numbers of the frame place it. Remounted per address. */
function FramedPreview({ src, framing, fill, onSize }: { src: string; framing: ImageFraming | undefined; fill: boolean; onSize: (size: Size) => void }) {
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const styles = imageFramingStyles(framing);
  const settle = useCallback((image: HTMLImageElement) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    setLoaded(true);
    onSize({ width: image.naturalWidth, height: image.naturalHeight });
  }, [onSize]);
  // An image that finished loading before React attached `onLoad` (a cached one) reports itself here.
  useEffect(() => { if (imageRef.current?.complete) settle(imageRef.current); }, [settle]);
  return <span className={`portia-image ${loaded ? "is-loaded" : "is-loading"}${fill ? " is-fill" : ""}`} data-framing={styles.frame ? "true" : undefined} style={styles.frame}>
    {!loaded && <span className="portia-image-skeleton" aria-hidden="true" />}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={imageRef} src={src} alt="" style={styles.image} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={(event) => settle(event.currentTarget)} />
  </span>;
}

/** Tab and Shift+Tab go round the five stops of the dialog (D-66, STAB-A11Y-01): past the last one the browser would hand the focus to its own interface (or leave it where it is),
 *  so the dialog takes it to the first, and the other way round. The page behind a modal dialog is inert, so nothing outside can take the focus. */
function keepFocusInside(event: React.KeyboardEvent<HTMLDialogElement>) {
  const dialog = event.currentTarget;
  const stops = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'));
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  const inside = !!active && dialog.contains(active);
  if (event.shiftKey ? !inside || active === first : !inside || active === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

type Drag = { pointerId: number; startX: number; startY: number; framing: ImageFraming; layout: StageLayout };

function FramingDialog({ src, label, box, initial, natural, onSize, viewportWidth, onApply, onCancel }: {
  src: string;
  label: string;
  box: ImageFramingBox;
  initial: ImageFraming | undefined;
  natural: Size | undefined;
  onSize: (size: Size) => void;
  viewportWidth: number;
  onApply: (framing: ImageFraming | undefined) => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const titleId = useId();
  const labelId = useId();
  // The state of the window is its own: the draft of the editor changes only on «Применить».
  const [draft, setDraft] = useState<ImageFraming>(initial ?? { ...defaultImageFraming });
  const [stage, setStage] = useState<Size | undefined>();

  const aspect = frameAspectFor(box, { image: natural, viewportWidth });
  const cover = natural ? coverFractions(natural, aspect) : undefined;
  const layout = natural && stage ? stageLayout({ image: natural, frameAspect: aspect, framing: draft, stage }) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    stageRef.current?.focus();
  }, []);

  // The stage is as big as the style sheet makes it; the layout follows its size (a window resize, a phone turned around).
  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const read = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setStage((previous) => (width <= 0 || height <= 0 ? previous : previous && previous.width === width && previous.height === height ? previous : { width, height }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (imageRef.current?.complete && imageRef.current.naturalWidth) onSize({ width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight }); }, [onSize]);
  useEffect(() => () => stopDragRef.current?.(), []);

  const setZoom = (zoom: number) => setDraft((previous) => (cover ? framingWithZoom(previous, zoom, cover) : { ...previous, zoom }));
  const apply = () => onApply(normalizeImageFraming(cover ? settleFraming(draft, cover) : draft));

  const onStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!event.key.startsWith("Arrow")) return;
    // The arrows belong to the picture here, not to the window of the editor or the desktop behind the dialog.
    event.preventDefault();
    event.stopPropagation();
    if (layout) setDraft(framingFromKey(draft, event.key, layout));
  };

  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!layout || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    stageRef.current?.focus();
    stopDragRef.current?.();
    const drag: Drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, framing: draft, layout };
    dragRef.current = drag;
    // Capture keeps the stream of events on the stage; where it is refused the listeners of the browser window carry the drag as well.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the window listeners below are enough */ }
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== drag.pointerId) return;
      setDraft(framingFromDrag(drag.framing, { dx: moveEvent.clientX - drag.startX, dy: moveEvent.clientY - drag.startY }, drag.layout));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      dragRef.current = null;
      stopDragRef.current = null;
    };
    const end = (endEvent: PointerEvent) => { if (endEvent.pointerId === drag.pointerId) stop(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    stopDragRef.current = stop;
  };

  return <dialog
    ref={dialogRef}
    className="portia-dialog image-framing-dialog"
    aria-modal="true"
    aria-labelledby={`${titleId} ${labelId}`}
    // Esc (and the back gesture of a phone) is «Отмена»: handled here, so that the shortcuts of the desktop behind the dialog do not hear it.
    onCancel={(event) => { event.preventDefault(); onCancel(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      else if (event.key === "Tab") keepFocusInside(event);
    }}
  >
    <div>
      <div className="image-framing-dialog-head">
        <h2 id={titleId}>Видимая часть</h2>
        <p id={labelId}>{label}</p>
      </div>
      <div
        ref={stageRef}
        className="image-framing-stage"
        role="slider"
        tabIndex={0}
        aria-label="Положение картинки"
        aria-valuemin={imageFramingLimits.position.min}
        aria-valuemax={imageFramingLimits.position.max}
        aria-valuenow={draft.x}
        aria-valuetext={`по горизонтали ${draft.x} %, по вертикали ${draft.y} %`}
        data-step={imageFramingStep}
        onKeyDown={onStageKeyDown}
        onPointerDown={onStagePointerDown}
      >
        {!layout && <span className="portia-image-skeleton" aria-hidden="true" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imageRef} className="image-framing-dim" src={src} alt="" draggable={false} decoding="async" referrerPolicy="no-referrer" onLoad={(event) => { if (event.currentTarget.naturalWidth) onSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); }}
          style={layout ? { left: layout.image.x, top: layout.image.y, width: layout.image.width, height: layout.image.height } : { visibility: "hidden" }} />
        {layout && <div className="image-framing-window" style={{ left: layout.frame.x, top: layout.frame.y, width: layout.frame.width, height: layout.frame.height }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="image-framing-lit" src={src} alt="" aria-hidden="true" draggable={false} decoding="async" referrerPolicy="no-referrer"
            style={{ left: layout.image.x - layout.frame.x, top: layout.image.y - layout.frame.y, width: layout.image.width, height: layout.image.height }} />
        </div>}
      </div>
      <div className="image-framing-zoom">
        <svg className="image-framing-zoom-icon small" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="7" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6.5 15l3.5-3.5 2.5 2.5 2-2 3 3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
        <input type="range" aria-label="Масштаб" min={imageFramingLimits.zoom.min} max={imageFramingLimits.zoom.max} step={imageFramingStep} value={draft.zoom} aria-valuetext={`${draft.zoom} %`} onChange={(event) => setZoom(Number(event.target.value))} />
        <svg className="image-framing-zoom-icon large" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 16.5l5-5 4 4 3-3 5 5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="16.5" cy="9" r="1.6" fill="currentColor" /></svg>
        <output className="image-framing-zoom-value" aria-hidden="true">{draft.zoom} %</output>
      </div>
      <div className="portia-dialog-actions image-framing-actions">
        <button type="button" className="secondary-control image-framing-reset" onClick={() => setDraft({ ...defaultImageFraming })}>Сбросить</button>
        <button type="button" className="secondary-control" onClick={onCancel}>Отмена</button>
        <button type="button" className="primary-control" onClick={apply}>Применить</button>
      </div>
    </div>
  </dialog>;
}
