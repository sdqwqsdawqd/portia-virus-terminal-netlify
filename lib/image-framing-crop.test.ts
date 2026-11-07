import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultImageFraming, imageFramingLimits, normalizeImageFraming, type ImageFraming } from "./image-framing.ts";
import {
  bandFrameWidth, bandFrameHeight, coverFractions, frameAspectFor, framingFromDrag, framingFromKey, framingWithZoom, settleFraming, stageLayout, visibleWindow,
  type Size,
} from "./image-framing-crop.ts";

// D-66/D-67 (20-56): the geometry of the window «Видимая часть». The reference below is NOT the formula of the module: it draws the picture as the browser does
// (object-fit: cover, object-position, then transform: scale(z) around the point x% y% of the picture box) and maps the corners of the frame back onto the picture.

const near = (actual: number, expected: number, tolerance: number, message: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected} (tolerance ${tolerance})`);

/** CSS model: a frame W x 100 px holds the picture with object-fit: cover; returns the visible part as fractions of the whole picture. */
function cssVisible(image: Size, frameAspect: number, framing: ImageFraming) {
  const H = 100;
  const W = frameAspect * H;
  const scale = Math.max(W / image.width, H / image.height);
  const drawnW = image.width * scale;
  const drawnH = image.height * scale;
  const offsetX = (W - drawnW) * (framing.x / 100);
  const offsetY = (H - drawnH) * (framing.y / 100);
  const zoom = framing.zoom / 100;
  const originX = W * (framing.x / 100);
  const originY = H * (framing.y / 100);
  const toPicture = (qx: number, qy: number) => [(originX + (qx - originX) / zoom - offsetX) / drawnW, (originY + (qy - originY) / zoom - offsetY) / drawnH];
  const [left, top] = toPicture(0, 0);
  const [right, bottom] = toPicture(W, H);
  return { left, top, width: right - left, height: bottom - top };
}

const pictures: { name: string; image: Size }[] = [
  { name: "landscape 3:2", image: { width: 1536, height: 1024 } },
  { name: "portrait", image: { width: 650, height: 768 } },
  { name: "square", image: { width: 1000, height: 1000 } },
  { name: "wide panorama", image: { width: 3000, height: 1000 } },
];
const aspectsOf = (image: Size) => [
  { name: "band PC", aspect: 754 / 63 },
  { name: "band phone", aspect: 362 / 63 },
  { name: "tile", aspect: 4 / 3 },
  { name: "natural", aspect: image.width / image.height },
];
const positions = [0, 20, 50, 80, 100];
const zooms = [100, 150, 300];

test("D-67 visibleWindow equals the CSS model for every picture, frame kind, position and zoom", () => {
  let checked = 0;
  for (const { name, image } of pictures) {
    for (const { name: kind, aspect } of aspectsOf(image)) {
      for (const x of positions) for (const y of positions) for (const zoom of zooms) {
        const framing = { x, y, zoom };
        const got = visibleWindow({ image, frameAspect: aspect, framing });
        const want = cssVisible(image, aspect, framing);
        const where = `${name} / ${kind} / ${x},${y},${zoom}`;
        near(got.left, want.left, 1e-9, `left ${where}`);
        near(got.top, want.top, 1e-9, `top ${where}`);
        near(got.width, want.width, 1e-9, `width ${where}`);
        near(got.height, want.height, 1e-9, `height ${where}`);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 4 * 4 * 5 * 5 * 3);
});

test("D-67 a picture that lies whole (frame of its own proportions) shows everything at 100% and nothing more than 1/zoom when zoomed", () => {
  for (const { image } of pictures) {
    const aspect = image.width / image.height;
    const whole = visibleWindow({ image, frameAspect: aspect, framing: undefined });
    assert.deepEqual(whole, { left: 0, top: 0, width: 1, height: 1 });
    const zoomed = visibleWindow({ image, frameAspect: aspect, framing: { x: 100, y: 0, zoom: 200 } });
    near(zoomed.width, 0.5, 1e-9, "half of the width");
    near(zoomed.left, 0.5, 1e-9, "the right half (x = 100)");
    near(zoomed.top, 0, 1e-9, "the top half (y = 0)");
  }
});

test("D-67 coverFractions: one of the two fractions is 1, the other is the share the frame takes of the covering picture", () => {
  assert.deepEqual(coverFractions({ width: 1000, height: 1000 }, 1), { fw: 1, fh: 1 });
  const wide = coverFractions({ width: 3000, height: 1000 }, 1);
  near(wide.fw, 1 / 3, 1e-12, "a square frame sees a third of a 3:1 picture");
  assert.equal(wide.fh, 1);
  const flat = coverFractions({ width: 1000, height: 1000 }, 12);
  assert.equal(flat.fw, 1);
  near(flat.fh, 1 / 12, 1e-12, "a 12:1 band sees a twelfth of the height of a square");
});

test("D-66 stageLayout: the whole picture fits in the stage at 100%, the frame lies inside the picture, fractions by rectangles equal visibleWindow", () => {
  const stage = { width: 528, height: 340 };
  for (const { name, image } of pictures) {
    for (const { name: kind, aspect } of aspectsOf(image)) {
      const flat = stageLayout({ image, frameAspect: aspect, framing: undefined, stage });
      const where = `${name} / ${kind}`;
      assert.ok(flat.image.width <= stage.width + 1e-6 && flat.image.height <= stage.height + 1e-6, `the picture fits the stage at 100%: ${where}`);
      assert.ok(flat.frame.x >= flat.image.x - 1e-6 && flat.frame.y >= flat.image.y - 1e-6 && flat.frame.x + flat.frame.width <= flat.image.x + flat.image.width + 1e-6 && flat.frame.y + flat.frame.height <= flat.image.y + flat.image.height + 1e-6, `the frame lies inside the picture: ${where}`);
      near(flat.frame.width / flat.frame.height, aspect, 1e-6, `the frame keeps the proportions of the place: ${where}`);
      near(flat.image.width / flat.image.height, image.width / image.height, 1e-6, `the picture keeps its proportions: ${where}`);
      for (const [x, y, zoom] of [[20, 80, 160], [0, 0, 300], [100, 100, 250], [50, 30, 200]]) {
        const framing = { x, y, zoom };
        const layout = stageLayout({ image, frameAspect: aspect, framing, stage });
        const fromRects = { left: (layout.frame.x - layout.image.x) / layout.image.width, top: (layout.frame.y - layout.image.y) / layout.image.height, width: layout.frame.width / layout.image.width, height: layout.frame.height / layout.image.height };
        const want = visibleWindow({ image, frameAspect: aspect, framing });
        near(fromRects.left, want.left, 0.001, `left ${where} ${x},${y},${zoom}`);
        near(fromRects.top, want.top, 0.001, `top ${where} ${x},${y},${zoom}`);
        near(fromRects.width, want.width, 0.001, `width ${where} ${x},${y},${zoom}`);
        near(fromRects.height, want.height, 0.001, `height ${where} ${x},${y},${zoom}`);
        const css = cssVisible(image, aspect, framing);
        near(fromRects.left, css.left, 0.001, `left against the CSS model ${where}`);
        near(fromRects.top, css.top, 0.001, `top against the CSS model ${where}`);
      }
    }
  }
});

test("D-67 natural at 100%: the frame IS the picture (rectangles equal to 1 px) and neither axis can move", () => {
  const stage = { width: 528, height: 340 };
  const image = { width: 1536, height: 1024 };
  const layout = stageLayout({ image, frameAspect: image.width / image.height, framing: undefined, stage });
  for (const key of ["x", "y", "width", "height"] as const) near(layout.frame[key], layout.image[key], 1, `frame.${key} = image.${key}`);
  assert.equal(layout.canMoveX, false);
  assert.equal(layout.canMoveY, false);
  const zoomed = stageLayout({ image, frameAspect: image.width / image.height, framing: { x: 50, y: 50, zoom: 150 }, stage });
  assert.equal(zoomed.canMoveX, true);
  assert.equal(zoomed.canMoveY, true);
  assert.ok(zoomed.image.width > zoomed.frame.width && zoomed.image.height > zoomed.frame.height, "the zoomed picture leaves the frame");
});

test("D-66 framingFromDrag: the picture moves with the pointer, x and y go the other way by dx / (picture width - frame width) * 100, whole numbers in range", () => {
  const stage = { width: 528, height: 340 };
  const image = { width: 1536, height: 1024 };
  const aspect = 4 / 3;
  const start = { x: 50, y: 50, zoom: 200 };
  const layout = stageLayout({ image, frameAspect: aspect, framing: start, stage });
  const spanX = layout.image.width - layout.frame.width;
  const spanY = layout.image.height - layout.frame.height;
  const moved = framingFromDrag(start, { dx: 20, dy: -10 }, layout);
  assert.equal(moved.x, Math.round(50 - (20 / spanX) * 100));
  assert.equal(moved.y, Math.round(50 + (10 / spanY) * 100));
  assert.equal(moved.zoom, 200);
  assert.ok(Number.isInteger(moved.x) && Number.isInteger(moved.y));
  const right = framingFromDrag(start, { dx: 1e6, dy: -1e6 }, layout);
  assert.deepEqual(right, { x: 0, y: 100, zoom: 200 }, "the picture dragged far right and up: the left-top part is not reachable beyond 0 / 100");
  const left = framingFromDrag(start, { dx: -1e6, dy: 1e6 }, layout);
  assert.deepEqual(left, { x: 100, y: 0, zoom: 200 });
  // After the picture moved, the frame of the stage shows the same part the numbers promise.
  const after = stageLayout({ image, frameAspect: aspect, framing: moved, stage });
  near(after.image.x - layout.image.x, 20, 1.01, "the picture moved by the pointer distance");
});

test("D-67 an axis the picture does not leave stays at 50 whatever the pointer or the keys do", () => {
  const stage = { width: 528, height: 340 };
  const image = { width: 1000, height: 1000 };
  const aspect = 1000 / 1000;
  const layout = stageLayout({ image, frameAspect: aspect, framing: undefined, stage });
  assert.deepEqual(framingFromDrag(undefined, { dx: 80, dy: 80 }, layout), { x: 50, y: 50, zoom: 100 });
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]) assert.deepEqual(framingFromKey(undefined, key, layout), { x: 50, y: 50, zoom: 100 }, key);
  // A band over a square picture: x cannot move at 100% (the picture is as wide as the frame), y can.
  const band = stageLayout({ image, frameAspect: 12, framing: undefined, stage });
  assert.equal(band.canMoveX, false);
  assert.equal(band.canMoveY, true);
  assert.deepEqual(framingFromKey(undefined, "ArrowRight", band), { x: 50, y: 50, zoom: 100 });
  assert.deepEqual(framingFromKey(undefined, "ArrowDown", band), { x: 50, y: 55, zoom: 100 });
  assert.deepEqual(framingFromDrag(undefined, { dx: 30, dy: 0 }, band), { x: 50, y: 50, zoom: 100 });
});

test("D-66 framingFromKey: ArrowRight/Down +5, ArrowLeft/Up -5 on x/y within 0..100; other keys change nothing", () => {
  const stage = { width: 528, height: 340 };
  const image = { width: 1536, height: 1024 };
  const framing = { x: 20, y: 80, zoom: 160 };
  const layout = stageLayout({ image, frameAspect: 4 / 3, framing, stage });
  assert.deepEqual(framingFromKey(framing, "ArrowRight", layout), { x: 25, y: 80, zoom: 160 });
  assert.deepEqual(framingFromKey(framing, "ArrowLeft", layout), { x: 15, y: 80, zoom: 160 });
  assert.deepEqual(framingFromKey(framing, "ArrowDown", layout), { x: 20, y: 85, zoom: 160 });
  assert.deepEqual(framingFromKey(framing, "ArrowUp", layout), { x: 20, y: 75, zoom: 160 });
  for (const key of ["a", "Enter", "Tab", "Home", " "]) assert.deepEqual(framingFromKey(framing, key, layout), framing, key);
  assert.deepEqual(framingFromKey({ x: 0, y: 100, zoom: 160 }, "ArrowLeft", layout), { x: 0, y: 100, zoom: 160 });
  assert.deepEqual(framingFromKey({ x: 0, y: 100, zoom: 160 }, "ArrowDown", layout), { x: 0, y: 100, zoom: 160 });
  assert.deepEqual(framingFromKey({ x: 100, y: 0, zoom: 160 }, "ArrowRight", layout), { x: 100, y: 0, zoom: 160 });
});

test("D-67 a zoom that leaves an axis without room puts that axis at 50; the frame 50/50/100 is the same as no frame", () => {
  const cover = coverFractions({ width: 1536, height: 1024 }, 1536 / 1024);
  assert.deepEqual(framingWithZoom({ x: 20, y: 80, zoom: 160 }, 100, cover), { x: 50, y: 50, zoom: 100 });
  assert.deepEqual(framingWithZoom({ x: 20, y: 80, zoom: 100 }, 160, cover), { x: 20, y: 80, zoom: 160 });
  assert.deepEqual(framingWithZoom({ x: 20, y: 80, zoom: 160 }, 150, cover), { x: 20, y: 80, zoom: 150 });
  assert.equal(normalizeImageFraming(framingWithZoom({ x: 20, y: 80, zoom: 160 }, 100, cover)), undefined);
  // A band over a landscape picture: y has room at 100% (the picture is taller than the band), x has none.
  const band = coverFractions({ width: 1536, height: 1024 }, 754 / 63);
  assert.deepEqual(settleFraming({ x: 20, y: 80, zoom: 100 }, band), { x: 50, y: 80, zoom: 100 });
  assert.deepEqual(settleFraming({ x: 20, y: 80, zoom: 150 }, band), { x: 20, y: 80, zoom: 150 });
});

test("D-67 results never leave imageFramingLimits and are whole numbers", () => {
  const stage = { width: 300, height: 200 };
  const image = { width: 1234, height: 987 };
  const layout = stageLayout({ image, frameAspect: 3, framing: { x: 33, y: 66, zoom: 175 }, stage });
  for (const [dx, dy] of [[0.4, 0.4], [7.3, -3.9], [1e9, 1e9], [-1e9, -1e9], [Number.NaN, 5]]) {
    const result = framingFromDrag({ x: 33, y: 66, zoom: 175 }, { dx, dy }, layout);
    assert.ok(Number.isInteger(result.x) && result.x >= imageFramingLimits.position.min && result.x <= imageFramingLimits.position.max, `x ${result.x}`);
    assert.ok(Number.isInteger(result.y) && result.y >= imageFramingLimits.position.min && result.y <= imageFramingLimits.position.max, `y ${result.y}`);
    assert.equal(result.zoom, 175);
  }
  assert.equal(framingFromDrag({ x: 33, y: 66, zoom: 175 }, { dx: 1e9, dy: 1e9 }, layout).x, 0, "dragged far right: the left edge of the picture");
  assert.equal(framingFromDrag({ x: 33, y: 66, zoom: 175 }, { dx: -1e9, dy: -1e9 }, layout).y, 100, "dragged far up: the bottom edge of the picture");
  assert.equal(framingFromDrag({ x: 33, y: 66, zoom: 175 }, { dx: Number.NaN, dy: 5 }, layout).x, 33, "a pointer without a distance moves nothing");
});

test("D-67 frameAspectFor: tile 4:3, natural by the picture, band by the «Справочник» window of the device (PC 754:63 at 1440, phone 362:63 at 412)", () => {
  const image = { width: 1536, height: 1024 };
  near(frameAspectFor("tile", { image, viewportWidth: 1440 }), 4 / 3, 1e-12, "tile");
  near(frameAspectFor("natural", { image, viewportWidth: 1440 }), 1.5, 1e-12, "natural");
  assert.equal(frameAspectFor("natural", { image: undefined, viewportWidth: 1440 }), 4 / 3, "a picture not loaded yet: the 4:3 of the skeleton");
  near(frameAspectFor("band", { image, viewportWidth: 1440 }), 754 / 63, 1e-9, "band on PC");
  near(frameAspectFor("band", { image, viewportWidth: 412 }), 362 / 63, 1e-9, "band on Pixel 7");
  near(frameAspectFor("band", { image, viewportWidth: 390 }), 340 / 63, 1e-9, "band on iPhone 13");
  // A narrow PC screen: the window is not wider than the work area minus 32 px.
  near(bandFrameWidth(1000), 1000 - 32 - 66, 1e-9, "1000 px wide screen");
  near(bandFrameWidth(901), 901 - 32 - 66, 1e-9, "901 px is still a window");
  near(bandFrameWidth(900), 900 - 50, 1e-9, "900 px is a phone: the window takes the whole screen");
  assert.equal(bandFrameHeight, 63);
});

test("D-67 guard: the band constants come from the sources (window «Справочник» 820 px, strip min-height 64 px with a 1 px border)", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const desktop = read("components/portia-desktop.tsx");
  assert.match(desktop, /guide: \[820, 650\]/, "the «Справочник» window opens 820 px wide");
  assert.match(desktop, /Math\.min\(preferred\[0\], workspaceWidth - 32\)/, "and not wider than the work area minus 32 px");
  assert.match(desktop, /window\.innerWidth <= 900\) return undefined/, "windows are full screen from 900 px down");
  const css = read("app/portia.css");
  assert.match(css, /\.guide-section-head\.has-photo \{[^}]*min-height: 64px/, "the strip is 64 px high");
  assert.match(css, /\.guide-section-head \{[^}]*border-bottom: 1px solid/, "with a 1 px border under it, which the band (inset 0, padding box) does not cover");
  assert.match(css, /\.guide-section-band \{[^}]*inset: 0/, "the band fills the padding box of the strip");
  assert.match(css, /\.guide-tile-cover \{[^}]*aspect-ratio: 4 \/ 3/, "the cover is 4:3");
  assert.equal(bandFrameHeight, 64 - 1);
  assert.deepEqual(defaultImageFraming, { x: 50, y: 50, zoom: 100 });
});
