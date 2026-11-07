// D-63 (20-51): the visible part of a content picture, chosen by the editor and shown to every visitor.
// A frame is three whole numbers: the point of the picture that stays in view (x, y in percent) and the zoom around it (percent).
// It is untrusted input (it arrives in PUT /api/content): only finite numbers are read, rounded and clamped, and the styles are made from
// those numbers alone, so no text of a user ever reaches a style. No dependencies on purpose: the server (normalizePortiaContent),
// the site (PortiaImage) and the editor preview use this one module.

export type ImageFraming = { x: number; y: number; zoom: number };

export const defaultImageFraming: Readonly<ImageFraming> = Object.freeze({ x: 50, y: 50, zoom: 100 });

/** The editor moves a frame in steps of this many percent. */
export const imageFramingStep = 5;

export const imageFramingLimits = Object.freeze({ position: Object.freeze({ min: 0, max: 100 }), zoom: Object.freeze({ min: 100, max: 300 }) });

const own = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

function readNumber(record: object, key: string, min: number, max: number): number | undefined {
  if (!own(record, key)) return undefined;
  const value = (record as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  // Math.max with +0 also turns a negative zero into 0.
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** A fresh, clamped frame from unknown input, or undefined: not an object of three finite numbers, or the same as no frame (the default). */
export function normalizeImageFraming(value: unknown): ImageFraming | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const x = readNumber(value, "x", imageFramingLimits.position.min, imageFramingLimits.position.max);
  const y = readNumber(value, "y", imageFramingLimits.position.min, imageFramingLimits.position.max);
  const zoom = readNumber(value, "zoom", imageFramingLimits.zoom.min, imageFramingLimits.zoom.max);
  if (x === undefined || y === undefined || zoom === undefined) return undefined;
  if (x === defaultImageFraming.x && y === defaultImageFraming.y && zoom === defaultImageFraming.zoom) return undefined;
  return { x, y, zoom };
}

/** Inline styles of a framed picture: the frame clips, the picture is placed by x/y and scaled from the same point. Nothing for no frame. */
export function imageFramingStyles(framing: ImageFraming | undefined): { frame?: Record<string, string>; image?: Record<string, string> } {
  const safe = normalizeImageFraming(framing);
  if (!safe) return {};
  const origin = `${safe.x}% ${safe.y}%`;
  return {
    frame: { overflow: "hidden" },
    image: { objectPosition: origin, transform: `scale(${safe.zoom / 100})`, transformOrigin: origin },
  };
}
