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

// «Лабораторные колбы» (D-22, redrawn in 20-33): a small distillation set on one bench, right of centre — a graduated cylinder,
// a conical flask, a round-bottom flask held by a clamp over a ring and a beaker that takes the bent tube from it. Thin muted
// lines and deep liquids, so a shortcut label stays readable over any part of the drawing. The cylinder is the far vessel a
// phone hides. The cycle lengths and phases are the authored D-22 values; reduced/off motion keeps the same still frame.
const FLASK_BASE_Y = 650;
type FlaskSpec = { x: number; outline: string; lip: string; shine: string; marks: string; level: number; floor: number; span: number; duration: number; delay: number; bubbles: number; hue: string };
const flaskSpecs: FlaskSpec[] = [
  // Graduated cylinder on a foot, with a pouring spout.
  { x: 958, outline: "M-19-205h38v197q0 8-8 8h-22q-8 0-8-8Z", lip: "M-24-206h48M-19-206l-6-7", shine: "M-10-192v176",
    marks: "M7-180h12M11-160h8M7-140h12M11-120h8M7-100h12M11-80h8M7-60h12M11-40h8M-34 0h68", level: -118, floor: -6, span: 11, duration: 6.8, delay: -1.9, bubbles: 5, hue: "teal" },
  // Conical (Erlenmeyer) flask.
  { x: 1092, outline: "M-10-172h20v58l45 103q5 11-7 11h-96q-12 0-7-11l45-103Z", lip: "M-14-173h28M-12-166h24", shine: "M-4-160v46L-28-46",
    marks: "M-20-60h10M-25-40h12M-29-20h10", level: -64, floor: -7, span: 28, duration: 8.9, delay: -5.2, bubbles: 8, hue: "violet" },
  // Round-bottom flask in a clamp, sitting on a ring.
  { x: 1226, outline: "M-9-190h18v85a46 46 0 1 1-18 0Z", lip: "M-13-191h26M-11-184h22", shine: "M-29-80q-9 22 1 42",
    marks: "M-9-150h18", level: -70, floor: -19, span: 27, duration: 11.3, delay: -3.4, bubbles: 7, hue: "amber" },
  // Beaker with a spout and a scale.
  { x: 1370, outline: "M-33-128h66v120q0 8-8 8h-50q-8 0-8-8Z", lip: "M-38-129h74M-33-129l-6-6", shine: "M-23-116v102",
    marks: "M19-104h10M23-88h6M19-72h10M23-56h6M19-40h10", level: -52, floor: -7, span: 22, duration: 7.7, delay: -6.1, bubbles: 6, hue: "rose" },
];
// A sine-like surface, 200 wide with a 20-unit period: sliding it by one period shows the same picture again.
const flaskWave = (level: number) => `M-100 ${level}q5 -2.5 10 0${"t10 0".repeat(19)}`;
const flasks = flaskSpecs.map((spec, index) => {
  const rand = seeded(53 + index * 11);
  const bubbles = Array.from({ length: spec.bubbles }, () => {
    const radius = round(1.6 + rand() * 2.4);
    // The centre travels from just above the floor to just under the surface, so a bubble never leaves the liquid.
    const bottom = spec.floor - radius, top = spec.level + radius + 3;
    const rest = bottom + (top - bottom) * rand();
    return { cx: round((rand() * 2 - 1) * spec.span), cy: round(rest), r: radius,
      below: round(bottom - rest), above: round(top - rest), duration: round(2.8 + rand() * 2.6), delay: round(-rand() * 5) };
  });
  return { ...spec, index, bubbles };
});

function WallpaperFlasks() {
  return <g className="wallpaper-flasks">
    <defs>
      {flasks.map((flask) => <clipPath key={flask.index} id={`wp-flask-clip-${flask.index}`}><path d={flask.outline} /></clipPath>)}
      <linearGradient id="wp-liquid-teal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".7" /><stop offset="1" stopColor="currentColor" stopOpacity=".35" /></linearGradient>
      <linearGradient id="wp-liquid-violet" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#7462b8" /><stop offset="1" stopColor="#3b3170" /></linearGradient>
      <linearGradient id="wp-liquid-amber" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a8843e" /><stop offset="1" stopColor="#5c4420" /></linearGradient>
      <linearGradient id="wp-liquid-rose" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a65a80" /><stop offset="1" stopColor="#5a2c48" /></linearGradient>
    </defs>
    <g className="wallpaper-flask-stand">
      {/* The bench: a top with an edge, two legs and a shelf. */}
      <path d="M915 650H1440M915 657H1440M935 657v60M1420 657v60M935 700H1420" />
      {/* A rod with a clamp arm round the neck of the round-bottom flask, and a ring on three short legs under it. */}
      <path d="M1296 650V470M1296 488H1236M1232 482v12M1196 636h60M1202 636l-7 14M1250 636l7 14M1226 636v14" />
      {/* The bent tube from the round-bottom flask to the beaker. */}
      <path d="M1226 460V444q0-8 8-8h128q8 0 8 8v100" />
      <circle cx="1296" cy="470" r="4" />
    </g>
    {flasks.map((flask) => <g key={flask.index} className={`wallpaper-flask${flask.index === 0 ? " wallpaper-flask-far" : ""}`} data-flask={flask.index}
      transform={`translate(${flask.x} ${FLASK_BASE_Y})`}
      style={{ "--flask-dur": `${flask.duration}s`, "--flask-delay": `${flask.delay}s` } as CSSProperties}>
      <path className="wallpaper-flask-glass-depth" d={flask.outline} />
      <g className="wallpaper-flask-liquid" clipPath={`url(#wp-flask-clip-${flask.index})`}>
        <rect className="wallpaper-flask-fill" x={-100} y={flask.level} width={200} height={4 - flask.level} fill={`url(#wp-liquid-${flask.hue})`} />
        <path className="wallpaper-flask-surface" d={flaskWave(flask.level)} />
      </g>
      <g className="wallpaper-flask-bubbles" clipPath={`url(#wp-flask-clip-${flask.index})`}>
        {flask.bubbles.map((bubble, index) => <circle key={index} className="wallpaper-flask-bubble" cx={bubble.cx} cy={bubble.cy} r={bubble.r}
          style={{ "--bubble-below": `${bubble.below}px`, "--bubble-above": `${bubble.above}px`, "--bubble-dur": `${bubble.duration}s`, "--bubble-delay": `${bubble.delay}s` } as CSSProperties} />)}
      </g>
      <path className="wallpaper-flask-glass" d={flask.outline} />
      <path className="wallpaper-flask-marks" d={flask.marks} />
      <path className="wallpaper-flask-lip" d={flask.lip} />
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
      {value === "radar" ? <WallpaperSpider /> : value === "gel" ? <WallpaperGelStrip /> : null}
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
