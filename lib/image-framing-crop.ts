// D-66/D-67 (20-56): the geometry of the window «Видимая часть» of the editor. Pure functions, no DOM, no React; the only import is the frame format of lib/image-framing.ts.
//
// What the site does with a frame (lib/image-framing.ts, components/portia-desktop-media.tsx): the picture covers its frame box (object-fit: cover; a picture that lies whole
// is a cover of a frame with its own proportions, so the same rule), object-position x% y% places it, then transform: scale(zoom/100) around the same point x% y%
// of the picture box. With the frame box W x H and the covering picture drawn at dw x dh, `fw = W / dw` and `fh = H / dh` are the shares of the picture the frame
// sees at 100% (one of them is 1). At zoom z the frame sees fw / z of the width, and its left edge lies at x * (1 - fw / z) of the picture (the same for the height).
// The window of the editor draws exactly that: the frame keeps its size, the picture takes the size that makes the frame cover that share, and sits where the left edge says.
import { defaultImageFraming, imageFramingLimits, imageFramingStep, type ImageFraming } from "./image-framing.ts";

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
/** The part of the picture inside the frame, in fractions of the whole picture (0..1). */
export type VisibleWindow = { left: number; top: number; width: number; height: number };
/** The kind of place a picture is shown in (ImageFramingBox of the component): a band across a «Справочник» section, a 16:10 cover (owner 2026-11-20; was 4:3), or the picture as it lies. */
export type FrameKind = "natural" | "band" | "tile" | "free";
/** The share of the picture, per axis, that the frame sees at 100%. */
export type Cover = { fw: number; fh: number };
export type StageLayout = {
  stage: Size;
  /** The frame, in pixels of the stage. Its size does not depend on the zoom. */
  frame: Rect;
  /** The whole picture, in pixels of the stage, at the zoom of the framing. It may leave the stage when zoomed. */
  image: Rect;
  cover: Cover;
  /** The zoom as a factor (1 .. 3). */
  zoom: number;
  /** Whether the picture leaves the frame on this axis, so a position means something there. */
  canMoveX: boolean;
  canMoveY: boolean;
};

// The band of a «Справочник» section, measured on the site (20-53, checked again by 20-56 on chromium 1440 / Pixel 7 and webkit iPhone 13): the window of the app opens 820 px wide
// (components/portia-desktop.tsx createWindowGeometry: guide [820, 650], not wider than the work area minus 32 px, so always 820 above 900 px), the band is 754 px wide in it (66 px
// of window and section margins); from 900 px down the window takes the whole screen and the band is 50 px narrower than the screen (412 -> 362, 390 -> 340).
// Its height is the strip's min-height 64 px (.guide-section-head.has-photo) minus the 1 px border under the strip: the band fills the padding box. lib/image-framing-crop.test.ts guards the sources.
const guideWindowWidth = 820;
const workAreaMargin = 32;
const windowBandInset = 66;
const phoneBandInset = 50;
const phoneMaxWidth = 900;
export const bandFrameHeight = 63;
const tileAspect = 16 / 10; // owner 2026-11-20: the card cover is 16:10, the same as .guide-tile-cover
const skeletonAspect = 4 / 3; // a natural picture not loaded yet

const epsilon = 1e-6;
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampPosition = (value: number) => clamp(Math.round(value), imageFramingLimits.position.min, imageFramingLimits.position.max);
const clampZoom = (value: number) => clamp(Math.round(value), imageFramingLimits.zoom.min, imageFramingLimits.zoom.max);
const framingOf = (framing: ImageFraming | undefined): ImageFraming => (framing ? { x: framing.x, y: framing.y, zoom: framing.zoom } : { ...defaultImageFraming });

/** The width of the band of a «Справочник» section on a device whose screen is `viewportWidth` px wide. */
export function bandFrameWidth(viewportWidth: number): number {
  if (viewportWidth <= phoneMaxWidth) return viewportWidth - phoneBandInset;
  return Math.min(guideWindowWidth, viewportWidth - workAreaMargin) - windowBandInset;
}

/** The proportions (width / height) of the place the picture of this kind is shown in. A natural picture not loaded yet gets the 4:3 of its skeleton (skeletonAspect). */
export function frameAspectFor(box: FrameKind, { image, viewportWidth, ratio }: { image: Size | undefined; viewportWidth: number; ratio?: number }): number {
  if (box === "tile") return tileAspect;
  // A free frame (owner 2026-11-18) has the proportions it was dragged to; before that, the picture's own.
  if (box === "free" && ratio && Number.isFinite(ratio) && ratio > 0) return ratio / 1000;
  if (box === "band") return bandFrameWidth(viewportWidth) / bandFrameHeight;
  return image && image.width > 0 && image.height > 0 ? image.width / image.height : skeletonAspect;
}

/** The share of the picture that a frame of the given proportions sees when the picture covers it (zoom 100%). */
export function coverFractions(image: Size, frameAspect: number): Cover {
  const imageAspect = image.width / image.height;
  return { fw: Math.min(1, (frameAspect / imageAspect)), fh: Math.min(1, (imageAspect / frameAspect)) };
}

/** The part of the picture the frame shows, in fractions of the whole picture. No frame is the default 50 / 50 / 100. */
export function visibleWindow({ image, frameAspect, framing }: { image: Size; frameAspect: number; framing: ImageFraming | undefined }): VisibleWindow {
  const { x, y, zoom } = framingOf(framing);
  const { fw, fh } = coverFractions(image, frameAspect);
  const factor = zoom / 100;
  return { left: (x / 100) * (1 - fw / factor), top: (y / 100) * (1 - fh / factor), width: fw / factor, height: fh / factor };
}

/** Where the picture and the frame lie in a stage of the dialog: the frame is centred, the picture at 100% fits the stage whole, and the zoom grows the picture around the frame. */
export function stageLayout({ image, frameAspect, framing, stage }: { image: Size; frameAspect: number; framing: ImageFraming | undefined; stage: Size }): StageLayout {
  const { x, y, zoom } = framingOf(framing);
  const factor = zoom / 100;
  const cover = coverFractions(image, frameAspect);
  const fit = Math.min(stage.width / image.width, stage.height / image.height);
  const wholeWidth = image.width * fit;
  const wholeHeight = image.height * fit;
  const frameWidth = wholeWidth * cover.fw;
  const frameHeight = wholeHeight * cover.fh;
  const frame: Rect = { x: (stage.width - frameWidth) / 2, y: (stage.height - frameHeight) / 2, width: frameWidth, height: frameHeight };
  const imageWidth = wholeWidth * factor;
  const imageHeight = wholeHeight * factor;
  const left = (x / 100) * (1 - cover.fw / factor);
  const top = (y / 100) * (1 - cover.fh / factor);
  return {
    stage,
    frame,
    image: { x: frame.x - left * imageWidth, y: frame.y - top * imageHeight, width: imageWidth, height: imageHeight },
    cover,
    zoom: factor,
    canMoveX: factor - cover.fw > epsilon,
    canMoveY: factor - cover.fh > epsilon,
  };
}

/** An axis the picture does not leave has no position: it stays at the centre, so that 50 / 50 / 100 is the same as no frame. */
export function settleFraming(framing: ImageFraming, cover: Cover): ImageFraming {
  const factor = framing.zoom / 100;
  return {
    x: factor - cover.fw > epsilon ? framing.x : defaultImageFraming.x,
    y: factor - cover.fh > epsilon ? framing.y : defaultImageFraming.y,
    zoom: framing.zoom,
  };
}

/** The framing at another zoom (percent, clamped to the limits); an axis the picture stops leaving goes back to the centre. */
export function framingWithZoom(framing: ImageFraming, zoom: number, cover: Cover): ImageFraming {
  return settleFraming({ x: framing.x, y: framing.y, zoom: clampZoom(finite(zoom, framing.zoom)) }, cover);
}

/** The framing after the picture was dragged by `dx`, `dy` pixels from `start` (the layout is the one of `start`): the picture moves with the pointer, the visible part the other way. */
export function framingFromDrag(start: ImageFraming | undefined, delta: { dx: number; dy: number }, layout: StageLayout): ImageFraming {
  const from = framingOf(start);
  const spanX = layout.image.width - layout.frame.width;
  const spanY = layout.image.height - layout.frame.height;
  return {
    x: layout.canMoveX && spanX > 0 ? clampPosition(from.x - (finite(delta.dx, 0) / spanX) * 100) : defaultImageFraming.x,
    y: layout.canMoveY && spanY > 0 ? clampPosition(from.y - (finite(delta.dy, 0) / spanY) * 100) : defaultImageFraming.y,
    zoom: from.zoom,
  };
}

/** The framing after an arrow key: the visible part moves by one step (5%) right/down or left/up; other keys change nothing. */
export function framingFromKey(framing: ImageFraming | undefined, key: string, layout: StageLayout): ImageFraming {
  const from = framingOf(framing);
  const step = imageFramingStep;
  let { x, y } = from;
  if (key === "ArrowRight") x += step;
  else if (key === "ArrowLeft") x -= step;
  else if (key === "ArrowDown") y += step;
  else if (key === "ArrowUp") y -= step;
  else return from;
  return {
    x: layout.canMoveX ? clampPosition(x) : defaultImageFraming.x,
    y: layout.canMoveY ? clampPosition(y) : defaultImageFraming.y,
    zoom: from.zoom,
  };
}

/** The smallest side of a frame dragged by its handles, in pixels of the stage. */
export const minFrameSide = 24;

export type FrameHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** The frame rectangle after a handle was dragged by `dx`, `dy` (owner 2026-11-18): it stays inside the picture, never smaller than minFrameSide,
 *  and never shows less than a third of the covered share (the zoom limit). With `keepAspect` the frame keeps the proportions of its place: a corner
 *  follows the larger move, an edge grows the other side around the middle. */
export function frameFromHandle(start: Rect, image: Rect, handle: FrameHandle, delta: { dx: number; dy: number }, keepAspect: boolean, minWidth: number, minHeight: number): Rect {
  const dx = finite(delta.dx, 0);
  const dy = finite(delta.dy, 0);
  const left0 = start.x, top0 = start.y, right0 = start.x + start.width, bottom0 = start.y + start.height;
  const imageRight = image.x + image.width, imageBottom = image.y + image.height;
  const minW = Math.max(minFrameSide, minWidth), minH = Math.max(minFrameSide, minHeight);
  if (!keepAspect) {
    let left = left0, top = top0, right = right0, bottom = bottom0;
    if (handle.includes("w")) left = clamp(left0 + dx, image.x, right0 - minW);
    if (handle.includes("e")) right = clamp(right0 + dx, left0 + minW, imageRight);
    if (handle.includes("n")) top = clamp(top0 + dy, image.y, bottom0 - minH);
    if (handle.includes("s")) bottom = clamp(bottom0 + dy, top0 + minH, imageBottom);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  const aspect = start.width / start.height;
  // The growth in width the pointer asks for; an edge handle on the other axis converts through the proportions.
  const grow = handle === "e" ? dx : handle === "w" ? -dx : handle === "s" ? dy * aspect : handle === "n" ? -dy * aspect
    : (() => {
      const gx = handle.includes("e") ? dx : -dx;
      const gy = (handle.includes("s") ? dy : -dy) * aspect;
      return Math.abs(gx) > Math.abs(gy) ? gx : gy;
    })();
  // The fixed point: the opposite corner, or the middle of the opposite edge.
  const anchorX = handle.includes("e") ? left0 : handle.includes("w") ? right0 : left0 + start.width / 2;
  const anchorY = handle.includes("s") ? top0 : handle.includes("n") ? bottom0 : top0 + start.height / 2;
  const roomX = handle.includes("e") ? imageRight - anchorX : handle.includes("w") ? anchorX - image.x : 2 * Math.min(anchorX - image.x, imageRight - anchorX);
  const roomY = handle.includes("s") ? imageBottom - anchorY : handle.includes("n") ? anchorY - image.y : 2 * Math.min(anchorY - image.y, imageBottom - anchorY);
  const maxWidth = Math.max(0, Math.min(roomX, roomY * aspect));
  const floor = Math.min(maxWidth, Math.max(minW, minH * aspect));
  const width = clamp(start.width + grow, floor, maxWidth);
  const height = width / aspect;
  const x = handle.includes("e") ? anchorX : handle.includes("w") ? anchorX - width : anchorX - width / 2;
  const y = handle.includes("s") ? anchorY : handle.includes("n") ? anchorY - height : anchorY - height / 2;
  return { x, y, width, height };
}

/** The framing that shows exactly `frame` of the picture drawn at `image` (both in pixels of the stage). A free frame also stores its proportions. */
export function framingFromWindow(image: Rect, frame: Rect, kind: FrameKind): ImageFraming {
  const widthShare = clamp(frame.width / image.width, epsilon, 1);
  const leftShare = clamp((frame.x - image.x) / image.width, 0, 1);
  const topShare = clamp((frame.y - image.y) / image.height, 0, 1);
  const imageAspect = image.width / image.height;
  const frameAspect = frame.width / frame.height;
  const cover = coverFractions({ width: imageAspect, height: 1 }, frameAspect);
  const zoom = clampZoom((cover.fw / widthShare) * 100);
  const factor = zoom / 100;
  const spanX = 1 - cover.fw / factor;
  const spanY = 1 - cover.fh / factor;
  const framing: ImageFraming = {
    x: spanX > epsilon ? clampPosition((leftShare / spanX) * 100) : defaultImageFraming.x,
    y: spanY > epsilon ? clampPosition((topShare / spanY) * 100) : defaultImageFraming.y,
    zoom,
  };
  if (kind === "free") framing.ratio = clamp(Math.round(frameAspect * 1000), imageFramingLimits.ratio.min, imageFramingLimits.ratio.max);
  return framing;
}
