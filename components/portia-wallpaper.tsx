"use client";

// Desktop wallpapers drawn as SVG in currentColor, so they follow the interface accent.

import { useEffect, useState, type CSSProperties } from "react";
import { seeded, webGeometry } from "@/lib/wallpaper-web";
import { WallpaperSpider } from "./portia-wallpaper-spider";

type Point = [number, number];

const round = (value: number) => Math.round(value * 10) / 10;

// An orb web anchored in the top-right corner: radial spokes plus a sagging capture spiral.
// Every number comes from lib/wallpaper-web, the module the spider walks on, so drawing and walking cannot drift apart.
function webPaths() {
  const { center, angles, spokeEnds, nodes, sags } = webGeometry;
  const spokes = angles.length;
  const spokePaths = spokeEnds.map((end) => `M${center[0]} ${center[1]}L${round(end[0])} ${round(end[1])}`);
  const rings = Array.from({ length: nodes.length / spokes }, (_, ring) => {
    const first = ring * spokes;
    const segments = angles.map((_, spoke) => {
      const sag = sags[first + spoke], next = nodes[first + ((spoke + 1) % spokes)];
      return `Q${round(sag[0])} ${round(sag[1])} ${round(next[0])} ${round(next[1])}`;
    });
    return `M${round(nodes[first][0])} ${round(nodes[first][1])}${segments.join("")}`;
  });
  // Dew on a few crossings of spoke and spiral; it twinkles once the web is spun.
  const rand = seeded(23);
  const dew = Array.from({ length: 16 }, () => {
    const ring = 3 + Math.floor(rand() * 12), spoke = Math.floor(rand() * spokes), node = nodes[(ring - 1) * spokes + spoke];
    return { x: round(node[0]), y: round(node[1]), r: round(1.4 + rand() * 1.4) };
  });
  return { spokePaths, rings, dew };
}

const web = webPaths();

function helixColumn(x: number, top: number, height: number, amplitude: number, period: number) {
  const steps = Math.ceil(height / 12);
  const strand = (phase: number) => Array.from({ length: steps + 1 }, (_, step) => {
    const y = top + step * 12;
    return `${step ? "L" : "M"}${round(x + amplitude * Math.sin((y / period) * Math.PI * 2 + phase))} ${y}`;
  }).join("");
  const rungs = Array.from({ length: Math.floor(height / (period / 6)) }, (_, index) => {
    const y = top + index * (period / 6);
    const a = x + amplitude * Math.sin((y / period) * Math.PI * 2);
    const b = x + amplitude * Math.sin((y / period) * Math.PI * 2 + Math.PI);
    return Math.abs(a - b) > amplitude * 0.5 ? `M${round(a)} ${y}L${round(b)} ${y}` : "";
  }).join("");
  return { a: strand(0), b: strand(Math.PI), rungs };
}

// Every period, the 12-unit sample step and the rung spacing divide 720, so a shift by it redraws the same picture.
// The layer holds three loops; moving it by one loop (a third of its own height) shows the same picture again,
// and two loops always cover the screen because one loop is at least 0.8 of the screen height (D-09).
const HELIX_LOOP = 720;

const helices = [
  { x: 1040, amplitude: 34, period: 240, opacity: 0.32 },
  { x: 1240, amplitude: 22, period: 180, opacity: 0.22 },
  { x: 1380, amplitude: 46, period: 360, opacity: 0.16 },
  { x: 880, amplitude: 18, period: 144, opacity: 0.12 },
].map((column) => ({ ...column, ...helixColumn(column.x, 0, HELIX_LOOP * 3, column.amplitude, column.period) }));

// Owner 2026-11-18: more helices, some lying at ±45°. Each tilted one is drawn along its own axis (five loops long, centred on its point, so its ends stay off screen while it drifts) and
// drifts along that axis by one loop, half of them the other way; the vertical columns keep scrolling together as before.
// Only transform animates; reduced and off motion stop it through the global `.desktop-wallpaper *` rule.
const tiltedHelices = [
  { x: 1180, y: 520, angle: 45, amplitude: 26, period: 240, opacity: 0.18, seconds: 70, reverse: false },
  { x: 760, y: 300, angle: -45, amplitude: 18, period: 180, opacity: 0.11, seconds: 54, reverse: true },
  { x: 1320, y: 140, angle: -45, amplitude: 14, period: 144, opacity: 0.12, seconds: 46, reverse: false },
  { x: 960, y: 780, angle: 45, amplitude: 20, period: 360, opacity: 0.1, seconds: 84, reverse: true },
].map((helix) => ({ ...helix, ...helixColumn(0, -HELIX_LOOP * 2.5, HELIX_LOOP * 5, helix.amplitude, helix.period) }));

function WallpaperTiltedHelices() {
  return <svg className="desktop-wallpaper desktop-wallpaper-tilted" viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice">
    {tiltedHelices.map((helix) => <g key={`${helix.x}-${helix.y}`} transform={`translate(${helix.x} ${helix.y}) rotate(${helix.angle})`}>
      <g className={`wallpaper-helix wallpaper-helix-drift${helix.reverse ? " is-reverse" : ""}`} style={{ opacity: helix.opacity, animationDuration: `${helix.seconds}s` }}>
        <path d={helix.a} /><path d={helix.b} /><path d={helix.rungs} className="wallpaper-rungs" />
      </g>
    </g>)}
  </svg>;
}

// Sample bands creep down their lanes at 6 units/s: visible within 3 s, still calm enough to read text on top (D-10).
const GEL_SPEED = 6;

// «Гель»: an electrophoresis gel photographed under UV, anchored top right like the other wallpapers.
// No hard lane walls: soft lane columns, wells, a marker ladder with sizes, and even "smiling" bands that fade at
// their ends under a breathing glow. Sample bands creep down their lanes and come back in at the top (the drift data
// per band); the ladder stays still. Replicate lanes repeat the same fragments, as real samples would.
function gelLanes() {
  const lanes = 9, left = 812, pitch = 66, width = 46, top = 74, bottom = 820;
  const ladder = ["10 000", "6000", "4000", "3000", "2000", "1500", "1000", "750", "500", "250"];
  const ladderY = ladder.map((_, step) => round(top + 34 + (bottom - top - 120) * Math.log(1 + step * 0.9) / Math.log(1 + (ladder.length - 1) * 0.9)));
  const pickFragments = seeded(11);
  // One fragment per slice of the gel, so bands spread over its whole length.
  const fragments = Array.from({ length: 12 }, (_, slice) => round(top + 60 + ((slice + pickFragments() * 0.8) / 12) * (bottom - top - 160)));
  const columns: number[] = [];
  const bands: { d: string; weight: number; opacity: number; moving: boolean }[] = [];
  // Sample bands run, as in a real gel, all together: they come in at the entry line and fade out at the exit line.
  const entry = top + 20, exit = bottom - 10, period = exit - entry, duration = period / GEL_SPEED;
  const band = (x: number, y: number, weight: number, opacity: number, lane: number) => bands.push({
    d: `M${x + 4} ${y}Q${x + width / 2} ${round(y + 2.6)} ${x + width - 4} ${y}`, weight: round(weight), opacity: Math.round(opacity * 100) / 100, moving: lane !== 0,
  });
  for (let lane = 0; lane < lanes; lane += 1) {
    const x = left + lane * pitch;
    columns.push(x);
    if (lane === 0) { ladderY.forEach((y, step) => band(x, y, step === 6 ? 5 : 3, step === 6 ? 0.9 : 0.6, 0)); continue; }
    // Lanes 3 and 4 are replicates of lane 2; the rest pick their own fragments.
    const pick = seeded((lane === 3 || lane === 4 ? 2 : lane) * 31 + 3);
    fragments.filter(() => pick() < 0.38).forEach((y) => band(x, y, 3 + pick() * 3, 0.5 + pick() * 0.4, lane));
  }
  return { columns, width, top, bottom, left, ladder, ladderY, bands, entry, exit, period, duration };
}

const gel = gelLanes();

// The sample bands of «Гель» on their own HTML layer, so the compositor moves them at sub-pixel steps: inside the
// wallpaper svg every frame was a main-thread repaint that rounds to whole pixels, which read as stop-go on a PC.
// The track holds each band twice, one period apart, and slides down by one period (half its height) per loop.
// A static mask on the frame makes the entry and exit fades (3% and 4% of the run) and the lower gel fade.
const gelMoving = gel.bands.filter((band) => band.moving);
const gelMask = (() => {
  const at = (y: number) => `${round((y / 900) * 100)}%`;
  const fadeStart = 0.55 * 900, below = (y: number) => round(1 - (y - fadeStart) / (900 - fadeStart));
  const holdEnd = gel.exit - 0.04 * gel.period;
  return `linear-gradient(to bottom, transparent ${at(gel.entry)}, #000 ${at(gel.entry + 0.03 * gel.period)}, #000 55%, rgb(0 0 0 / ${below(holdEnd)}) ${at(holdEnd)}, transparent ${at(gel.exit)})`;
})();

// Soft top and bottom edges (a vertical blur, drawn once into the static layer) keep a slow band from crawling row by row:
// a hard-edged line moved by a fraction of a pixel dwells, then jumps, on a DPR-1 screen.
function GelBands({ id, scale, alpha, blur }: { id: string; scale: number; alpha: number; blur: number }) {
  return <svg className={`desktop-wallpaper wallpaper-gel-strip-${id}`} viewBox={`0 ${gel.entry - gel.period} 1440 ${2 * gel.period}`} preserveAspectRatio="none">
    <defs><linearGradient id={`wp-gel-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset=".22" stopColor="currentColor" /><stop offset=".78" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
      <filter id={`wp-gel-soft-${id}`} filterUnits="userSpaceOnUse" x="0" y={gel.entry - gel.period} width="1440" height={2 * gel.period}><feGaussianBlur stdDeviation={`0 ${blur}`} /></filter></defs>
    {[0, -gel.period].map((shift) => <g key={shift} transform={shift ? `translate(0 ${shift})` : undefined} filter={`url(#wp-gel-soft-${id})`}>
      {gelMoving.map((band, index) => <path key={index} d={band.d} stroke={`url(#wp-gel-${id})`} style={{ strokeWidth: band.weight * scale, opacity: band.opacity * alpha }} />)}
    </g>)}
  </svg>;
}

function WallpaperGelStrip() {
  const unit = (value: number) => `calc(${value} * max(100cqw / 1440, 100cqh / 900))`;
  return <div className="wallpaper-gel-strip" style={{ maskImage: gelMask, WebkitMaskImage: gelMask }}>
    <div className="wallpaper-gel-strip-track" style={{ top: unit(gel.entry - gel.period), height: unit(2 * gel.period), animationDuration: `${round(gel.duration)}s` }}>
      <GelBands id="glow" scale={3} alpha={0.16} blur={4} />
      <GelBands id="core" scale={1} alpha={0.5} blur={1.6} />
    </div>
  </div>;
}

// Only the sharp zone moves, the rim is masked to .12. If a device cannot hold 60 fps, lower this first, never the amplitude.
const CELL_SHARP_ZONE = 0.8;

// «Клетки»: tissue seen through an eyepiece in the top-right corner. The cells are a Voronoi tessellation
// with rounded walls and a gap between neighbours; a few are infected, with virions at their walls.
// Each cell is its own record so it can drift, change shape and push against its neighbours (D-11).
function cellField() {
  const rand = seeded(5);
  // A separate stream for motion, so the drawn picture keeps the sequence of `rand` and stays as approved.
  const motion = seeded(17);
  const cx = 1214, cy = 176, radius = 610;
  const sites: Point[] = [];
  for (let guard = 0; sites.length < 150 && guard < 6000; guard += 1) {
    const x = cx - radius + rand() * 2 * radius, y = cy - radius + rand() * 2 * radius;
    if (x > 1500 || y < -60 || y > 860 || Math.hypot(x - cx, y - cy) > radius + 20) continue;
    if (sites.every(([a, b]) => Math.hypot(a - x, b - y) > 64)) sites.push([x, y]);
  }
  // Each cell is a square clipped by the bisector with every near neighbour.
  const cellOf = ([x, y]: Point) => {
    let poly: Point[] = [[x - 90, y - 90], [x + 90, y - 90], [x + 90, y + 90], [x - 90, y + 90]];
    for (const [ox, oy] of sites) {
      if ((ox === x && oy === y) || Math.hypot(ox - x, oy - y) > 180) continue;
      const nx = ox - x, ny = oy - y, limit = (nx * (x + ox) + ny * (y + oy)) / 2;
      const inside = ([px, py]: Point) => nx * px + ny * py <= limit;
      const next: Point[] = [];
      poly.forEach((point, index) => {
        const following = poly[(index + 1) % poly.length];
        if (inside(point)) next.push(point);
        if (inside(point) !== inside(following)) {
          const t = (limit - nx * point[0] - ny * point[1]) / (nx * (following[0] - point[0]) + ny * (following[1] - point[1]));
          next.push([point[0] + t * (following[0] - point[0]), point[1] + t * (following[1] - point[1])]);
        }
      });
      poly = next;
    }
    // Shrink toward the centre for the gap between walls, then round every corner through the edge midpoints.
    const shrunk = poly.map(([px, py]): Point => [x + (px - x) * 0.84, y + (py - y) * 0.84]);
    const mid = (index: number): Point => {
      const p = shrunk[index % shrunk.length], q = shrunk[(index + 1) % shrunk.length];
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    const start = mid(0);
    return `M${round(start[0])} ${round(start[1])}` + shrunk.map((_, index) => {
      const corner = shrunk[(index + 1) % shrunk.length], end = mid(index + 1);
      return `Q${round(corner[0])} ${round(corner[1])} ${round(end[0])} ${round(end[1])}`;
    }).join("") + "Z";
  };
  const list: { wall: string; nucleus: string; infected: boolean; animated: boolean; dx: number; dy: number; delay: string }[] = [];
  const particles: { x: number; y: number; spikes: string; vx: number; vy: number }[] = [];
  sites.forEach((site) => {
    const nucleus = `M${round(site[0] + 9)} ${round(site[1] - 3)}a9 7 0 1 0-18 0a9 7 0 1 0 18 0Z`;
    const infected = rand() < 0.1;
    const angle = motion() * Math.PI * 2;
    // Neighbours sit on a polar checkerboard; one parity starts half a period later, so they move in anti-phase and read as pushing.
    const parity = (((Math.floor(Math.atan2(site[1] - cy, site[0] - cx) / (Math.PI / 8)) + Math.floor(Math.hypot(site[0] - cx, site[1] - cy) / 90)) % 2) + 2) % 2;
    list.push({
      wall: cellOf(site), nucleus, infected, animated: Math.hypot(site[0] - cx, site[1] - cy) < CELL_SHARP_ZONE * radius,
      dx: round(Math.cos(angle) * 12), dy: round(Math.sin(angle) * 12), delay: parity ? "-14s, -8s" : "0s, 0s",
    });
    if (!infected) return;
    for (let count = 0; count < 2; count += 1) {
      const turnAway = rand() * Math.PI * 2, distance = 24 + rand() * 10, float = motion() * Math.PI * 2;
      const x = round(site[0] + Math.cos(turnAway) * distance), y = round(site[1] + Math.sin(turnAway) * distance);
      particles.push({ x, y, vx: round(Math.cos(float) * 18), vy: round(Math.sin(float) * 18), spikes: Array.from({ length: 8 }, (_, spike) => {
        const turn = (spike / 8) * Math.PI * 2;
        return `M${round(x + Math.cos(turn) * 5)} ${round(y + Math.sin(turn) * 5)}L${round(x + Math.cos(turn) * 9)} ${round(y + Math.sin(turn) * 9)}`;
      }).join("") });
    }
  });
  return { cx, cy, radius, cells: list, particles };
}

const cells = cellField();

const WALLPAPER_FADE_MS = 500;

// «Лабораторные колбы» (D-22, redrawn in 20-33 and again in 20-36 by D-51): the whole lower half of the screen is a busy lab —
// a long bench with a cabinet, a wall shelf of reagent bottles and jars, a poster, a tripod with a burner, a condenser coil, a test-tube
// rack and twelve vessels that bubble each on its own cycle. Thin line art (glass wall, scale, label, cork, shine); the liquids are deep
// hues that never reach the brightness of a shortcut label (phase20-art.spec.ts: label contrast over the brightest 8 px square of the
// whole drawing at least 4.5:1 on three accents). The scene is original: no character or artwork is copied from the owner's mood reference.
// Units are the 1440×900 wallpaper frame; the right ~405 units stay in view on a phone, so the four vessels there carry no `far` flag
// and everything left of them is hidden by a container query. The cycle lengths and phases are authored: the first four are the D-22
// pairs, the others differ (6–12 s) and their first glow peaks are at least 0.7 s apart (the spec table repeats these numbers).
// D-54 (20-37, plan 20-42): the owner asked for more motion and less empty space. The burner and the lamps flicker (an outer flame and a core, each on its
// own irregular cycle), the vessels of the back shelf overflow (one cycle each, `shelfCycles`), the wall clock ticks (the second hand steps 60 times a minute,
// the minute hand turns in an hour) and the wall is fuller (charts, a burette, a pegboard, an oscilloscope, a louvered cabinet). Only opacity and transform move.
const FLASK_BENCH_Y = 660;
type FlaskShape = { outline: string; lip: string; shine: string; marks: string; label: string; cork: string; level: number; floor: number; span: number; height: number; half: number; radius: [number, number] };
const flaskShapes = {
  // Graduated cylinder on a foot, with a pouring spout.
  cylinder: { outline: "M-19-205h38v197q0 8-8 8h-22q-8 0-8-8Z", lip: "M-24-206h48M-19-206l-6-7", shine: "M-10-192v176", cork: "",
    marks: "M7-180h12M11-160h8M7-140h12M11-120h8M7-100h12M11-80h8M7-60h12M11-40h8M-34 0h68", label: "", level: -118, floor: -6, span: 11, height: 205, half: 34, radius: [1.6, 2.4] },
  // Conical (Erlenmeyer) flask with a stopper and a label.
  conical: { outline: "M-10-172h20v58l45 103q5 11-7 11h-96q-12 0-7-11l45-103Z", lip: "M-14-173h28M-12-166h24", shine: "M-4-160v46L-28-46", cork: "M-11-174h22l-3-12h-16Z",
    marks: "M-17-96h7M-22-80h10M-27-64h7", label: "M-26-38h52v20h-52ZM-18-31h36M-18-25h22", level: -64, floor: -7, span: 28, height: 173, half: 55, radius: [1.6, 2.4] },
  // Round-bottom flask (it hangs on a clamp over a tripod).
  round: { outline: "M-9-190h18v85a46 46 0 1 1-18 0Z", lip: "M-13-191h26M-11-184h22", shine: "M-29-80q-9 22 1 42", cork: "",
    marks: "M-9-150h18", label: "", level: -70, floor: -19, span: 27, height: 190, half: 46, radius: [1.6, 2.4] },
  // Beaker with a spout, a scale and a label.
  beaker: { outline: "M-33-128h66v120q0 8-8 8h-50q-8 0-8-8Z", lip: "M-38-129h74M-33-129l-6-6", shine: "M-23-116v102", cork: "",
    marks: "M19-104h10M23-88h6M19-72h10M23-56h6M19-40h10", label: "M-26-34h30v16h-30Z", level: -52, floor: -7, span: 22, height: 128, half: 33, radius: [1.6, 2.4] },
  // Flat-bottom (Florence) flask with a long neck, a stopper and a label.
  florence: { outline: "M-8-190h16v90.6a50 50 0 1 1-16 0Z", lip: "M-12-191h24M-10-184h20", shine: "M-40-70q-4 22 4 40", cork: "M-9-192h18l-3-12h-12Z",
    marks: "M-8-150h16M-8-130h10", label: "M-22-44h44v16h-44ZM-14-39h28", level: -58, floor: -6, span: 22, height: 190, half: 50, radius: [1.6, 2.4] },
  // Test tube.
  tube: { outline: "M-9-95h18v82a9 9 0 0 1-18 0Z", lip: "M-12-96h24", shine: "M-5-86v58", cork: "",
    marks: "M3-80h5M3-64h5M3-48h5", label: "", level: -62, floor: -6, span: 3, height: 95, half: 11, radius: [1.1, 1.2] },
  // Wide-mouth jar with a lid (shelf only).
  jar: { outline: "M-26-72h52v8l4 6v50q0 8-8 8h-44q-8 0-8-8v-50l4-6Z", lip: "M-28-72h56v-10h-56Z", shine: "M-22-52v36", cork: "",
    marks: "", label: "M-20-40h40v22h-40ZM-12-33h24M-12-27h16", level: -40, floor: -6, span: 18, height: 82, half: 30, radius: [1.6, 2.4] },
  // Reagent bottle with a stopper (shelf only).
  bottle: { outline: "M-7-112h14v18l22 18v68q0 8-8 8h-42q-8 0-8-8v-68l22-18Z", lip: "M-10-113h20", shine: "M-22-72v56", cork: "M-6-114h12l-1-9h-10Z",
    marks: "", label: "M-24-62h48v30h-48ZM-16-52h32M-16-44h20", level: -50, floor: -6, span: 20, height: 112, half: 29, radius: [1.6, 2.4] },
} satisfies Record<string, FlaskShape>;
type ShapeKey = keyof typeof flaskShapes;

// The animated vessels: `hue` is the resting liquid, `alt` the one it slowly turns into (a second fill that fades in and out on its own, longer cycle).
// Index 0-3 keep the D-22 durations and phases. `far` vessels stand left of the phone's view and are hidden there.
type FlaskSpec = { shape: ShapeKey; x: number; y: number; scale: number; hue: string; alt: string; duration: number; delay: number; bubbles: number; far?: boolean };
const flaskSpecs: FlaskSpec[] = [
  { shape: "cylinder", x: 118, y: FLASK_BENCH_Y, scale: 1, hue: "teal", alt: "violet", duration: 6.8, delay: -1.9, bubbles: 5, far: true },
  { shape: "conical", x: 222, y: FLASK_BENCH_Y, scale: 1, hue: "violet", alt: "rose", duration: 8.9, delay: -5.2, bubbles: 7, far: true },
  { shape: "round", x: 395, y: 585, scale: 1, hue: "amber", alt: "green", duration: 11.3, delay: -3.4, bubbles: 7, far: true },
  { shape: "beaker", x: 568, y: FLASK_BENCH_Y, scale: 1, hue: "rose", alt: "amber", duration: 7.7, delay: -6.1, bubbles: 6, far: true },
  { shape: "florence", x: 668, y: FLASK_BENCH_Y, scale: 1, hue: "green", alt: "teal", duration: 9.7, delay: -1.0, bubbles: 5, far: true },
  { shape: "tube", x: 766, y: 652, scale: 1, hue: "amber", alt: "rose", duration: 6.3, delay: -3.0, bubbles: 3, far: true },
  { shape: "tube", x: 794, y: 652, scale: 1, hue: "violet", alt: "teal", duration: 10.4, delay: -5.3, bubbles: 3, far: true },
  { shape: "tube", x: 822, y: 652, scale: 1, hue: "rose", alt: "green", duration: 7.2, delay: -4.0, bubbles: 3, far: true },
  { shape: "conical", x: 1105, y: FLASK_BENCH_Y, scale: 1.1, hue: "green", alt: "violet", duration: 8.3, delay: -7.8, bubbles: 7 },
  { shape: "beaker", x: 1210, y: FLASK_BENCH_Y, scale: 1.15, hue: "teal", alt: "rose", duration: 11.8, delay: -6.0, bubbles: 5 },
  { shape: "florence", x: 1307, y: FLASK_BENCH_Y, scale: 1.1, hue: "amber", alt: "rose", duration: 6.6, delay: -2.5, bubbles: 5 },
  { shape: "cylinder", x: 1400, y: FLASK_BENCH_Y, scale: 1.05, hue: "violet", alt: "teal", duration: 9.1, delay: -4.6, bubbles: 4 },
];
// A sine-like surface, 200 wide with a 20-unit period: sliding it by one period shows the same picture again.
const flaskWave = (level: number) => `M-100 ${level}q5 -2.5 10 0${"t10 0".repeat(19)}`;
const flasks = flaskSpecs.map((spec, index) => {
  const shape = flaskShapes[spec.shape];
  const rand = seeded(53 + index * 11);
  const bubbles = Array.from({ length: spec.bubbles }, () => {
    const radius = round(shape.radius[0] + rand() * shape.radius[1]);
    // The centre travels from just above the floor to just under the surface, so a bubble never leaves the liquid.
    const bottom = shape.floor - radius, top = shape.level + radius + 3;
    const rest = bottom + (top - bottom) * rand();
    return { cx: round((rand() * 2 - 1) * shape.span), cy: round(rest), r: radius,
      below: round(bottom - rest), above: round(top - rest), duration: round(2.8 + rand() * 2.6), delay: round(-rand() * 5) };
  });
  return { ...spec, ...shape, index, key: spec.shape, bubbles };
});

// Still vessels on the wall shelf: the same glass, a flat liquid (or none), no animation.
const shelfY = 372;
// D-54 (20-37): the overflow cycle of each shelf vessel that holds liquid, in the order of `shelfItems` — milliseconds, so the spec compares exact numbers.
// Durations 5.4–10.6 s, every duration and every phase different, the first glow peaks (at half a cycle) at least 380 ms apart.
// phase20-art.spec.ts repeats this table as SHELF_CYCLES: the two change only together.
const shelfCycles = [
  { duration: 7300, delay: -3250 }, { duration: 5600, delay: -2020 }, { duration: 9400, delay: -3540 }, { duration: 6200, delay: -1560 },
  { duration: 10600, delay: -3380 }, { duration: 8100, delay: -1750 }, { duration: 5900, delay: -270 }, { duration: 9000, delay: -1440 },
  { duration: 6800, delay: -6760 }, { duration: 10100, delay: -1230 }, { duration: 7700, delay: -7350 }, { duration: 5400, delay: -3520 },
  { duration: 8600, delay: -7940 }, { duration: 6500, delay: -4410 },
];
// D-59 (20-47): the cycle of each moving part of the boards — milliseconds, every duration and every phase different. phase20-art.spec.ts repeats this table as BOARD_CYCLES: the two change only together.
// Every duration and every phase differs from all the others (durations 2.3–8.3 s). The first block is the oscilloscope wave (a linear shift, so its duration is the speed), then the line over the chart, six bars, four table
// cells and six swaying tools, in the order of the elements above.
const boardCycles = {
  scope: [{ duration: 2600, delay: -900 }],
  line: [{ duration: 3700, delay: -1300 }],
  bars: [{ duration: 3100, delay: -700 }, { duration: 4300, delay: -1800 }, { duration: 3500, delay: -2600 }, { duration: 5100, delay: -2100 }, { duration: 4700, delay: -3300 }, { duration: 3900, delay: -1500 }],
  cells: [{ duration: 6100, delay: -2300 }, { duration: 7300, delay: -4100 }, { duration: 5300, delay: -1100 }, { duration: 8300, delay: -5700 }],
  tools: [{ duration: 2300, delay: -400 }, { duration: 2700, delay: -1600 }, { duration: 3300, delay: -2000 }, { duration: 2900, delay: -800 }, { duration: 3400, delay: -2700 }, { duration: 2500, delay: -1900 }],
};
const shelfItems: Array<{ shape: ShapeKey; x: number; scale: number; hue: string | null }> = [
  { shape: "bottle", x: 420, scale: 0.62, hue: "amber" }, { shape: "jar", x: 490, scale: 0.7, hue: "violet" }, { shape: "conical", x: 562, scale: 0.5, hue: "rose" },
  { shape: "bottle", x: 628, scale: 0.58, hue: "green" }, { shape: "beaker", x: 694, scale: 0.55, hue: "teal" }, { shape: "florence", x: 768, scale: 0.5, hue: "violet" },
  { shape: "jar", x: 842, scale: 0.7, hue: "amber" }, { shape: "bottle", x: 908, scale: 0.65, hue: "rose" }, { shape: "cylinder", x: 962, scale: 0.45, hue: "teal" },
  { shape: "conical", x: 1034, scale: 0.5, hue: "green" }, { shape: "bottle", x: 1170, scale: 0.6, hue: "violet" },
  { shape: "beaker", x: 1236, scale: 0.55, hue: "amber" }, { shape: "florence", x: 1306, scale: 0.5, hue: "rose" }, { shape: "bottle", x: 1376, scale: 0.62, hue: "green" },
];

// Bench: the top and its edge, a cabinet of four doors, a skirting line, then the tripod and burner under the round-bottom flask, the clamp rod,
// the test-tube rack, an alcohol lamp and a mortar. Shelf and poster are the wall behind it.
// D-54 (20-37): the doors carry louvres (eight upright slats), so the cabinet is a drawing and not four empty frames.
const cabinetDoors = [64, 444, 824, 1204].map((left) => `M${left} 684h360v78h-360ZM${left + 166} 702h28${[36, 72, 108, 144, 216, 252, 288, 324].map((slat) => `M${left + slat} 696v54`).join("")}`).join("");
// D-54 (20-37): the middle of the wall is fuller: a table of elements and a bar chart under the shelf (both end left of a phone's view), a clock (a phone sees it), a burette on the clamp rod,
// a pegboard with hanging tools and an oscilloscope. Thin lines at the strength of the bench. D-59 (20-47, owner verdict of 2026-11-07): the manometer that hung beside the clock is gone (one dial
// only, the ticking clock), and the boards move: the wave of the oscilloscope runs, see `scopeTrace`; the other boards follow in `boardCycles`.
// D-59 (20-47): every board is a group `.wallpaper-flask-board` (all four end left of a phone's view, so the container query hides them there) with a still frame and moving parts, each part its own element and its own cycle in `boardCycles`.
// The table of elements: ten columns of 30 and three rows of 18 from (508, 394); four cells light up one after another (a dark highlight, opacity only).
const tableFrame = `M508 394h300v54h-300ZM508 412h300M508 430h300${Array.from({ length: 9 }, (_, step) => `M${538 + step * 30} 394v54`).join("")}`;
const tableCells = [{ col: 2, row: 0 }, { col: 6, row: 1 }, { col: 4, row: 2 }, { col: 8, row: 0 }].map((cell) => ({ x: 508 + cell.col * 30 + 1, y: 394 + cell.row * 18 + 1 }));
// The bar chart: a frame (868-994 x 394-452), six bars that grow from the base line y 446 (scaleY), and a line over them that breathes around its own middle (y 410).
const chartFrame = "M868 394h126v58h-126Z";
const chartBarHeights = [18, 32, 24, 40, 28, 36];
const chartBars = chartBarHeights.map((bar, step) => `M${880 + step * 19} 446v-${bar}h12v${bar}`);
const chartLine = "M876 420L896 412L914 418L934 404L954 410L972 400L988 408";
// The tool board (724-850 x 466-545): two rails, twelve tools hanging from them and two hooks; six of the tools sway from their hook (rotate about the top of the tool).
const toolHangs = [736, 752, 770, 788, 806, 824, 840].map((x, step) => ({ x, y: 492, length: 12 + (step % 3) * 8 })).concat([742, 764, 786, 810, 834].map((x, step) => ({ x, y: 522, length: 10 + (step % 2) * 8 })));
const swayingTools = [1, 2, 4, 5, 8, 10]; // indices in `toolHangs`: x 752, 770, 806, 824 on the upper rail, x 764, 810 on the lower one
const toolSway = [4, 3.5, 4.5, 3, 5, 3.5]; // degrees, each tool its own
const toolPath = (tool: { x: number; y: number; length: number }) => `M${tool.x} ${tool.y}v${tool.length}m-3 0h6`;
const toolBoard = `M724 466h126v79h-126ZM724 492h126M724 522h126M836 506a4 4 0 1 0 8 0a4 4 0 1 0-8 0M760 540a4 4 0 1 0 8 0a4 4 0 1 0-8 0`;
const stillTools = toolHangs.filter((_, index) => !swayingTools.includes(index)).map(toolPath).join("");
const boardStyle = (cycle: { duration: number; delay: number }, extra: Record<string, string> = {}) => ({ "--board-dur": `${cycle.duration}ms`, "--board-delay": `${cycle.delay}ms`, ...extra }) as CSSProperties;

// D-59 (20-47): the wave of the oscilloscope screen (x 918-996, y 466-546, centre line y 520). The same sine as before (half-waves of 12 units, period 24, crest 13), drawn from x 874
// — two periods left of the old start, a whole number of periods so the picture is the same — to x 1018, so that sliding it right by one period (24 units, the `flask-scope` animation)
// shows the same frame again and the left edge of the screen is never bare. The clip group (`#wp-scope-clip`, the rectangle of the screen) does not move; the trace does.
const SCOPE = { x: 918, y: 466, width: 78, height: 80, period: 24 };
const scopeTrace = `M${SCOPE.x + 4 - 2 * SCOPE.period} 520q6-26 12 0${"t12 0".repeat(11)}`;

const coilPoints = Array.from({ length: 11 }, (_, step) => `${step ? "L" : "M"}${step % 2 ? 882 : 898} ${492 + step * 14}`).join("");
const benchPaths = {
  top: `M40 ${FLASK_BENCH_Y}H1440M40 ${FLASK_BENCH_Y + 12}H1440`,
  cabinet: `M60 ${FLASK_BENCH_Y + 12}V772M40 772H1440${cabinetDoors}`,
  tripod: "M343 571L325 660M447 571L465 660M350 571h90",
  burner: "M388 660v-36h14v36M372 660q0-8 23-8t23 8",
  rod: "M480 660V425M445 660h72M480 432H404M404 424v16",
  rack: "M744 622h100v8H744ZM750 630v30M838 630v30M744 650h100",
  lamp: "M926 660q-6-24 6-38h32q12 14 6 38ZM942 622v-10h12v10M948 612v-8",
  mortar: "M988 625h48q-2 28-24 33q-22-5-24-33ZM1022 625l20-32",
  coil: `M872 470h36v190h-36ZM872 500h-14M908 630h14M866 560h48${coilPoints}`,
  burette: "M480 505h32M512 496v18M506 470v150M518 470v150M500 462l12 8 12-8M506 590h-9M518 590h9M509 620l3 14 3-14M506 490h6M506 510h6M506 530h6M506 550h6M506 570h6",
  scope: "M918 466h78v80h-78ZM918 493h78M918 520h78M944 466v80M970 466v80",
};
const posterPaths = {
  frame: "M92 290h206v146H92ZM108 306h110M236 312h50M236 324h36",
  ring: "M150 330L176 345V375L150 390L124 375V345ZM150 338L169 349M169 371L150 382M131 371V349",
  chain: "M176 345L200 331L224 345L248 331M176 375L200 389L224 375L248 389",
};

// The shelf vessels with their overflow cycle attached (a liquid takes the next row of `shelfCycles`).
let shelfLiquids = 0;
const shelfVessels = shelfItems.map((item) => {
  const cycle = item.hue ? shelfCycles[shelfLiquids] : undefined;
  if (item.hue) shelfLiquids += 1;
  return { ...item, cycle };
});
// D-54 (20-37): the flames. [outer layer, core] x [burner, bench lamp, shelf lamp]: a flicker is quick (0.8–3 s) and every layer has its own length.
const flameCycles = { burner: [{ duration: 1700, delay: -300 }, { duration: 1100, delay: -650 }], lamp: [{ duration: 2300, delay: -900 }, { duration: 1300, delay: -200 }], shelf: [{ duration: 1900, delay: -1200 }, { duration: 1500, delay: -450 }] };
const flameStyle = (cycle: { duration: number; delay: number }) => ({ "--flame-dur": `${cycle.duration}ms`, "--flame-delay": `${cycle.delay}ms` }) as CSSProperties;
// D-54 (20-37): the wall clock, under the shelf on the right part of the wall (a phone shows it; it sits low so the drawing does not grow taller): a dial, twelve marks, an hour hand that stands, a minute hand (3600 s) and a
// second hand (60 s in 60 steps). The hands are drawn pointing up and carry a resting angle in CSS; the dial centre is the pivot of both moving hands.
const CLOCK = { x: 1258, y: 414, r: 24 };
const clockMarks = Array.from({ length: 12 }, (_, hour) => {
  const angle = (hour / 12) * Math.PI * 2, from = CLOCK.r - (hour % 3 === 0 ? 7 : 4), to = CLOCK.r - 1.5;
  return `M${round(CLOCK.x + Math.sin(angle) * from)} ${round(CLOCK.y - Math.cos(angle) * from)}L${round(CLOCK.x + Math.sin(angle) * to)} ${round(CLOCK.y - Math.cos(angle) * to)}`;
}).join("");

function FlaskShelfItem({ item }: { item: typeof shelfVessels[number] }) {
  const shape = flaskShapes[item.shape];
  return <g className="wallpaper-flask-scene-vessel" transform={`translate(${item.x} ${shelfY}) scale(${item.scale})`}>
    <path className="wallpaper-flask-scene-depth" d={shape.outline} />
    {item.hue && <g clipPath={`url(#wp-flask-clip-${item.shape})`}>
      {/* Wider and taller than the glass, so the tilt of the overflow never shows an edge; the glass outline clips it. */}
      <rect className="wallpaper-flask-scene-liquid" x={-120} y={shape.level} width={240} height={14 - shape.level} fill={`url(#wp-liquid-${item.hue})`}
        style={item.cycle ? { "--shelf-dur": `${item.cycle.duration}ms`, "--shelf-delay": `${item.cycle.delay}ms` } as CSSProperties : undefined} />
    </g>}
    <path className="wallpaper-flask-scene-glass" d={shape.outline} />
    {shape.marks && <path className="wallpaper-flask-scene-line" d={shape.marks} />}
    {shape.label && <path className="wallpaper-flask-scene-line" d={shape.label} />}
    <path className="wallpaper-flask-scene-line" d={shape.lip} />
    {shape.cork && <path className="wallpaper-flask-scene-cork" d={shape.cork} />}
    <path className="wallpaper-flask-scene-shine" d={shape.shine} />
  </g>;
}

function WallpaperFlasks() {
  return <g className="wallpaper-flasks">
    <defs>
      {(Object.keys(flaskShapes) as ShapeKey[]).map((key) => <clipPath key={key} id={`wp-flask-clip-${key}`}><path d={flaskShapes[key].outline} /></clipPath>)}
      <clipPath id="wp-scope-clip"><rect x={SCOPE.x} y={SCOPE.y} width={SCOPE.width} height={SCOPE.height} /></clipPath>
      <linearGradient id="wp-liquid-teal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".7" /><stop offset="1" stopColor="currentColor" stopOpacity=".35" /></linearGradient>
      <linearGradient id="wp-liquid-violet" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#7462b8" /><stop offset="1" stopColor="#3b3170" /></linearGradient>
      <linearGradient id="wp-liquid-amber" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8e7036" /><stop offset="1" stopColor="#54401e" /></linearGradient>
      <linearGradient id="wp-liquid-rose" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a65a80" /><stop offset="1" stopColor="#5a2c48" /></linearGradient>
      <linearGradient id="wp-liquid-green" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4a8434" /><stop offset="1" stopColor="#2a5020" /></linearGradient>
    </defs>
    <g className="wallpaper-flask-scene">
      <g className="wallpaper-flask-scene-wall">
        {/* The shelf: a board with an edge and three brackets, then the poster of a ring molecule on the left wall. */}
        <path className="wallpaper-flask-scene-board" d={`M360 ${shelfY}H1440v9H360Z`} />
        <path d={`M450 ${shelfY + 9}v30l36-30M820 ${shelfY + 9}v30l36-30M1190 ${shelfY + 9}v30l36-30`} />
        <path d={posterPaths.frame} />
        <path d={posterPaths.ring} />
        <path d={posterPaths.chain} />
        <circle cx={200} cy={331} r={4} /><circle cx={248} cy={331} r={4} /><circle cx={200} cy={389} r={4} /><circle cx={248} cy={389} r={4} />
        {/* A wall thermometer between the poster and the shelf (the clock moved to the right of the wall, where a phone sees it). */}
        <path d="M326 304h8v36a9 9 0 1 1-8 0ZM330 314v26M334 312h5M334 322h5M334 332h5" />
      </g>
      {shelfVessels.map((item) => <FlaskShelfItem key={item.x} item={item} />)}
      {/* A spirit lamp on the shelf where a phone sees it: its flame flickers like the two on the bench. */}
      <g className="wallpaper-flask-scene-lamp" transform={`translate(1102 ${shelfY}) scale(.85)`}>
        <path d="M-22 0q-6-24 6-38h32q12 14 6 38ZM-6-38v-10h12v10M0-48v-8" />
        <path className="wallpaper-flask-flame" d="M0-56q-8-10 0-22q8 12 0 22Z" style={flameStyle(flameCycles.shelf[0])} />
        <path className="wallpaper-flask-flame-core" d="M0-56q-3-5 0-11q3 6 0 11Z" style={flameStyle(flameCycles.shelf[1])} />
      </g>
      <g className="wallpaper-flask-clock" style={{ "--clock-x": `${CLOCK.x}px`, "--clock-y": `${CLOCK.y}px` } as CSSProperties}>
        <circle className="wallpaper-flask-clock-face" cx={CLOCK.x} cy={CLOCK.y} r={CLOCK.r} />
        <path d={clockMarks} />
        <path className="wallpaper-flask-clock-hour" d={`M${CLOCK.x} ${CLOCK.y}V${CLOCK.y - 11}`} transform={`rotate(-60 ${CLOCK.x} ${CLOCK.y})`} />
        <path className="wallpaper-flask-clock-minute" d={`M${CLOCK.x} ${CLOCK.y}V${CLOCK.y - 18}`} />
        <path className="wallpaper-flask-clock-second" d={`M${CLOCK.x} ${CLOCK.y + 4}V${CLOCK.y - 22}`} />
        <circle className="wallpaper-flask-clock-pin" cx={CLOCK.x} cy={CLOCK.y} r={2} />
      </g>
    </g>
    <g className="wallpaper-flask-stand">
      {/* The bench first (its top edge is the widest line), then what stands on it. */}
      <path d={benchPaths.top} />
      <path d={benchPaths.cabinet} />
      <path d={benchPaths.tripod} />
      <path d={benchPaths.burner} />
      <path className="wallpaper-flask-flame" d="M395 622q-9-14 0-30q9 16 0 30Z" style={flameStyle(flameCycles.burner[0])} />
      <path className="wallpaper-flask-flame-core" d="M395 622q-4-7 0-15q4 8 0 15Z" style={flameStyle(flameCycles.burner[1])} />
      <path d={benchPaths.rod} />
      <circle cx="480" cy="432" r="5" />
      <path d={benchPaths.rack} />
      <path d={benchPaths.lamp} />
      <path className="wallpaper-flask-flame" d="M948 604q-8-10 0-22q8 12 0 22Z" style={flameStyle(flameCycles.lamp[0])} />
      <path className="wallpaper-flask-flame-core" d="M948 604q-3-5 0-11q3 6 0 11Z" style={flameStyle(flameCycles.lamp[1])} />
      <path d={benchPaths.mortar} />
      <path className="wallpaper-flask-coil" d={benchPaths.coil} />
      <g className="wallpaper-flask-board wallpaper-flask-board-table">
        <path d={tableFrame} />
        {tableCells.map((cell, index) => <rect key={index} className="wallpaper-flask-table-cell" x={cell.x} y={cell.y} width={28} height={16} style={boardStyle(boardCycles.cells[index])} />)}
      </g>
      <g className="wallpaper-flask-board wallpaper-flask-board-chart">
        <path d={chartFrame} />
        {chartBars.map((bar, index) => <path key={index} className="wallpaper-flask-chart-bar" d={bar} style={boardStyle(boardCycles.bars[index])} />)}
        <path className="wallpaper-flask-chart-line" d={chartLine} style={boardStyle(boardCycles.line[0])} />
      </g>
      <path d={benchPaths.burette} />
      <g className="wallpaper-flask-board wallpaper-flask-board-tools">
        <path d={toolBoard} />
        <path d={stillTools} />
        {swayingTools.map((hang, index) => <path key={hang} className="wallpaper-flask-tool" d={toolPath(toolHangs[hang])} style={boardStyle(boardCycles.tools[index], { "--tool-sway": `${toolSway[index]}deg` })} />)}
      </g>
      <g className="wallpaper-flask-board wallpaper-flask-board-scope">
        <path d={benchPaths.scope} />
        <g clipPath="url(#wp-scope-clip)"><path className="wallpaper-flask-scope-trace" d={scopeTrace} style={boardStyle(boardCycles.scope[0])} /></g>
      </g>
    </g>
    {flasks.map((flask) => <g key={flask.index} className={`wallpaper-flask${flask.far ? " wallpaper-flask-far" : ""}`} data-flask={flask.index}
      transform={`translate(${flask.x} ${flask.y})${flask.scale === 1 ? "" : ` scale(${flask.scale})`}`}
      style={{ "--flask-dur": `${flask.duration}s`, "--flask-delay": `${flask.delay}s` } as CSSProperties}>
      <path className="wallpaper-flask-shadow" d={`M${-flask.half} 1q${flask.half} 9 ${flask.half * 2} 0`} />
      <path className="wallpaper-flask-glass-depth" d={flask.outline} />
      <g className="wallpaper-flask-liquid" clipPath={`url(#wp-flask-clip-${flask.key})`}>
        <rect className="wallpaper-flask-fill" x={-100} y={flask.level} width={200} height={4 - flask.level} fill={`url(#wp-liquid-${flask.hue})`} />
        <rect className="wallpaper-flask-fill-alt" x={-100} y={flask.level} width={200} height={4 - flask.level} fill={`url(#wp-liquid-${flask.alt})`} />
        <path className="wallpaper-flask-surface" d={flaskWave(flask.level)} />
      </g>
      <g className="wallpaper-flask-bubbles" clipPath={`url(#wp-flask-clip-${flask.key})`}>
        {flask.bubbles.map((bubble, index) => <circle key={index} className="wallpaper-flask-bubble" cx={bubble.cx} cy={bubble.cy} r={bubble.r}
          style={{ "--bubble-below": `${bubble.below}px`, "--bubble-above": `${bubble.above}px`, "--bubble-dur": `${bubble.duration}s`, "--bubble-delay": `${bubble.delay}s` } as CSSProperties} />)}
      </g>
      <path className="wallpaper-flask-glass" d={flask.outline} />
      <path className="wallpaper-flask-wall" d={flask.outline} transform={`translate(0 ${round(-(1 - 0.92) * flask.height / 2)}) scale(.92)`} />
      {flask.marks && <path className="wallpaper-flask-marks" d={flask.marks} />}
      {flask.label && <path className="wallpaper-flask-label" d={flask.label} />}
      <path className="wallpaper-flask-lip" d={flask.lip} />
      {flask.cork && <path className="wallpaper-flask-cork" d={flask.cork} />}
      <path className="wallpaper-flask-shine" d={flask.shine} />
    </g>)}
  </g>;
}

export function DesktopWallpaper({ kind }: { kind: string }) {
  const [layers, setLayers] = useState({ current: kind, leaving: null as string | null });
  // Adjusted during render, so no frame is painted without the old layer.
  if (layers.current !== kind) setLayers({ current: kind, leaving: layers.current });
  useEffect(() => {
    if (!layers.leaving) return;
    // A timeout, not animationend: under «Выключены» the fade can be cut short.
    const timer = window.setTimeout(() => setLayers((value) => ({ ...value, leaving: null })), WALLPAPER_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [layers.leaving]);
  // One keyed list, so the outgoing drawing keeps its DOM (and its drawn state) while it fades.
  const shown = [layers.leaving, layers.current].filter((value): value is string => !!value && value !== "quiet");
  return <div className="desktop-wallpaper-frame" aria-hidden="true">
    {shown.map((value) => <div key={value} className={`wallpaper-layer${value === layers.leaving ? " is-leaving" : layers.leaving ? " is-entering" : ""}`}>
      <WallpaperArt kind={value} />
      {value === "radar" ? <WallpaperSpider /> : value === "gel" ? <WallpaperGelStrip /> : value === "grid" ? <WallpaperTiltedHelices /> : null}
    </div>)}
  </div>;
}

function WallpaperArt({ kind }: { kind: string }) {
  return <svg className={`desktop-wallpaper desktop-wallpaper-${kind}`} viewBox={`0 0 1440 ${kind === "grid" ? HELIX_LOOP * 3 : 900}`} preserveAspectRatio="xMaxYMin slice">
    {kind === "grid"
      ? helices.map((column) => <g key={column.x} className="wallpaper-helix" style={{ opacity: column.opacity }}>
          <path d={column.a} /><path d={column.b} /><path d={column.rungs} className="wallpaper-rungs" />
        </g>)
      : kind === "flasks"
      ? <WallpaperFlasks />
      : kind === "gel"
      ? <g className="wallpaper-gel">
          <defs>
            <linearGradient id="wp-gel-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <mask id="wp-gel-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900"><rect width="1440" height="900" fill="url(#wp-gel-fade)" /></mask>
            <linearGradient id="wp-gel-band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset=".22" stopColor="currentColor" /><stop offset=".78" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
          </defs>
          <g mask="url(#wp-gel-mask)">
            {gel.columns.map((x) => <rect key={x} x={x} y={gel.top} width={gel.width} height={gel.bottom - gel.top} rx={3} className="wallpaper-gel-lane" />)}
            {gel.columns.map((x) => <rect key={`w${x}`} x={x + 3} y={gel.top - 22} width={gel.width - 6} height={10} rx={2} className="wallpaper-gel-well" />)}
            <g className="wallpaper-gel-bands">
              {/* The still ladder; the moving sample bands are drawn by WallpaperGelStrip. */}
              {gel.bands.filter((band) => !band.moving).flatMap((band, index) => [
                <path key={`g${index}`} d={band.d} stroke="url(#wp-gel-band)" style={{ strokeWidth: band.weight * 3, opacity: band.opacity * 0.16 }} />,
                <path key={index} d={band.d} stroke="url(#wp-gel-band)" style={{ strokeWidth: band.weight, opacity: band.opacity * 0.42 }} />,
              ])}
              <g className="wallpaper-gel-labels">
                {gel.ladder.map((label, index) => <text key={label} x={gel.left - 12} y={gel.ladderY[index] + 4}>{label}</text>)}
              </g>
            </g>
          </g>
        </g>
      : kind === "cells"
      ? <g className="wallpaper-cells">
          <defs>
            <clipPath id="wp-cells-clip"><circle cx={cells.cx} cy={cells.cy} r={cells.radius} /></clipPath>
            <radialGradient id="wp-cells-focus" cx={cells.cx} cy={cells.cy} r={cells.radius} gradientUnits="userSpaceOnUse"><stop offset=".45" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity=".12" /></radialGradient>
            <mask id="wp-cells-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900"><rect width="1440" height="900" fill="url(#wp-cells-focus)" /></mask>
            <radialGradient id="wp-cells-rim" cx={cells.cx} cy={cells.cy} r={cells.radius} gradientUnits="userSpaceOnUse"><stop offset=".78" stopColor="currentColor" stopOpacity="0" /><stop offset="1" stopColor="currentColor" stopOpacity=".07" /></radialGradient>
          </defs>
          <circle cx={cells.cx} cy={cells.cy} r={cells.radius} fill="url(#wp-cells-rim)" stroke="none" />
          <g clipPath="url(#wp-cells-clip)" mask="url(#wp-cells-mask)">
            {cells.cells.map((cell, index) => <g key={index} className={`wallpaper-cell${cell.animated ? " is-alive" : ""}`}
              style={cell.animated ? { "--cell-dx": `${cell.dx}px`, "--cell-dy": `${cell.dy}px`, animationDelay: cell.delay } as CSSProperties : undefined}>
              <path d={cell.wall} className={`wallpaper-cells-wall${cell.infected ? " is-infected" : ""}`} />
              <path d={cell.nucleus} className={`wallpaper-cells-nucleus wallpaper-cell-nucleus${cell.infected ? " is-infected" : ""}`} />
            </g>)}
            <g className="wallpaper-cells-particles">
              {cells.particles.map((particle, index) => <g key={index} className="wallpaper-particle"
                style={{ "--particle-dx": `${particle.vx}px`, "--particle-dy": `${particle.vy}px`, animationDelay: `${-((index * 3.7) % 20)}s` } as CSSProperties}>
                <circle cx={particle.x} cy={particle.y} r={5} /><path d={particle.spikes} />
              </g>)}
            </g>
          </g>
          <circle cx={cells.cx} cy={cells.cy} r={cells.radius} className="wallpaper-cells-edge" />
        </g>
      : <g className="wallpaper-web">
          {web.spokePaths.map((d, index) => <path key={`s${index}`} d={d} pathLength={1} style={{ animationDelay: `${index * 30}ms` }} />)}
          {web.rings.map((d, index) => <path key={`r${index}`} d={d} pathLength={1} className="wallpaper-web-ring" style={{ animationDelay: `${450 + index * 60}ms` }} />)}
          <g className="wallpaper-web-dew">
            {web.dew.map((drop, index) => <circle key={index} cx={drop.x} cy={drop.y} r={drop.r} style={{ animationDelay: `${round((index * 1.7) % 7)}s` }} />)}
          </g>
        </g>}
  </svg>;
}
