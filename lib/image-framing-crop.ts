// D-66/D-67 (20-56): the geometry of the window «Видимая часть». Pure functions, no DOM; the only import is lib/image-framing.ts (the frame format).
// STUB of the RED step: every function returns a neutral value, the tests of lib/image-framing-crop.test.ts fail on their assertions.
import type { ImageFraming } from "./image-framing.ts";

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
/** The part of the picture inside the frame, in fractions of the whole picture (0..1). */
export type VisibleWindow = { left: number; top: number; width: number; height: number };
export type FrameKind = "natural" | "band" | "tile";
export type Cover = { fw: number; fh: number };
export type StageLayout = { stage: Size; frame: Rect; image: Rect; cover: Cover; zoom: number; canMoveX: boolean; canMoveY: boolean };

export const bandFrameHeight = 0;

export function bandFrameWidth(_viewportWidth: number): number {
  return 0;
}

export function coverFractions(_image: Size, _frameAspect: number): Cover {
  return { fw: 0, fh: 0 };
}

export function visibleWindow(_input: { image: Size; frameAspect: number; framing: ImageFraming | undefined }): VisibleWindow {
  return { left: 0, top: 0, width: 1, height: 1 };
}

export function stageLayout(input: { image: Size; frameAspect: number; framing: ImageFraming | undefined; stage: Size }): StageLayout {
  return { stage: input.stage, frame: { x: 0, y: 0, width: 0, height: 0 }, image: { x: 0, y: 0, width: 0, height: 0 }, cover: { fw: 0, fh: 0 }, zoom: 1, canMoveX: false, canMoveY: false };
}

export function settleFraming(framing: ImageFraming, _cover: Cover): ImageFraming {
  return framing;
}

export function framingWithZoom(framing: ImageFraming, _zoom: number, _cover: Cover): ImageFraming {
  return framing;
}

export function framingFromDrag(start: ImageFraming | undefined, _delta: { dx: number; dy: number }, _layout: StageLayout): ImageFraming {
  return start ?? { x: 50, y: 50, zoom: 100 };
}

export function framingFromKey(framing: ImageFraming | undefined, _key: string, _layout: StageLayout): ImageFraming {
  return framing ?? { x: 50, y: 50, zoom: 100 };
}

export function frameAspectFor(_box: FrameKind, _input: { image: Size | undefined; viewportWidth: number }): number {
  return 1;
}
