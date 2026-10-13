// Desktop wallpapers drawn as SVG in currentColor, so they follow the interface accent.

type Point = [number, number];

const round = (value: number) => Math.round(value * 10) / 10;

// An orb web anchored in the top-right corner: radial spokes plus a sagging capture spiral.
function webPaths() {
  const center: Point = [1180, 170];
  const spokes = 18;
  const angles = Array.from({ length: spokes }, (_, index) => (index / spokes) * Math.PI * 2 + 0.11 * Math.sin(index * 1.7));
  const reach = (angle: number) => 980 + 120 * Math.sin(angle * 3.1);
  const spokePaths = angles.map((angle) => {
    const end: Point = [center[0] + Math.cos(angle) * reach(angle), center[1] + Math.sin(angle) * reach(angle)];
    return `M${center[0]} ${center[1]}L${round(end[0])} ${round(end[1])}`;
  });
  const rings: string[] = [];
  for (let ring = 1; ring <= 15; ring += 1) {
    const radius = 34 * ring ** 1.18;
    const points = angles.map((angle): Point => [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
    // Each thread between two spokes sags toward the hub, like silk under its own weight.
    const segments = points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      const mid: Point = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
      const sag: Point = [mid[0] + (center[0] - mid[0]) * 0.08, mid[1] + (center[1] - mid[1]) * 0.08];
      return `Q${round(sag[0])} ${round(sag[1])} ${round(next[0])} ${round(next[1])}`;
    });
    rings.push(`M${round(points[0][0])} ${round(points[0][1])}${segments.join("")}`);
  }
  return { spokePaths, rings };
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

const helices = [
  { x: 1040, amplitude: 34, period: 260, opacity: 0.32, delay: "0s" },
  { x: 1240, amplitude: 22, period: 190, opacity: 0.22, delay: "-6s" },
  { x: 1380, amplitude: 46, period: 340, opacity: 0.16, delay: "-11s" },
  { x: 880, amplitude: 18, period: 170, opacity: 0.12, delay: "-3s" },
].map((column) => ({ ...column, ...helixColumn(column.x, -120, 1200, column.amplitude, column.period) }));

// Same seeded generator as the approved sketch (02-SKETCHES.html), so the shipped drawing matches the choice.
function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

// «Дорожки геля» (sketch #gel-a): eight electrophoresis lanes with wells, a marker ladder in the first lane,
// a side scale, and crisp bands. Bands are separate so only they drift, like a gel that is still running.
function gelLanes() {
  const rand = seeded(7);
  const lanes = 8, left = 720, width = 58, gap = 22, top = 92, bottom = 860;
  let wells = "", walls = "";
  const bands: { d: string; weight: number; opacity: number }[] = [];
  for (let lane = 0; lane < lanes; lane += 1) {
    const x = left + lane * (width + gap);
    wells += `M${x} ${top - 30}h${width}v16h${-width}Z`;
    walls += `M${x} ${top}V${bottom}M${x + width} ${top}V${bottom}`;
    // Lane 0 is the marker ladder: eleven bands spaced like a size standard.
    const positions = lane === 0
      ? Array.from({ length: 11 }, (_, step) => top + 40 + (bottom - top - 80) * (1 - 0.82 ** (step + 1)) / (1 - 0.82 ** 11))
      : Array.from({ length: 3 + Math.floor(rand() * 4) }, () => top + 50 + rand() * (bottom - top - 100));
    for (const y of positions) {
      const weight = lane === 0 ? 3 : 3 + rand() * 8;
      const opacity = lane === 0 ? 0.28 : 0.16 + rand() * 0.16;
      bands.push({ d: `M${x + 5} ${round(y + weight / 2)}h${width - 10}`, weight: round(weight), opacity: Math.round(opacity * 100) / 100 });
    }
  }
  const scaleX = left - 34;
  const ticks = Array.from({ length: 16 }, (_, tick) => `M${scaleX} ${round(top + (tick * (bottom - top)) / 15)}h${tick % 5 ? -8 : -18}`).join("");
  return { wells, walls, scale: `M${scaleX} ${top}V${bottom}${ticks}`, bands };
}

const gel = gelLanes();

// An irregular cell outline: a circle wobbled by two sine harmonics with random phase.
function blob(cx: number, cy: number, radius: number, rand: () => number) {
  const phaseA = rand() * 6, phaseB = rand() * 6, points = 28;
  return "M" + Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    const k = 1 + 0.13 * Math.sin(3 * angle + phaseA) + 0.07 * Math.sin(5 * angle + phaseB);
    return `${round(cx + Math.cos(angle) * radius * k)} ${round(cy + Math.sin(angle) * radius * k)}`;
  }).join("L") + "Z";
}

// «Клетки под микроскопом» (sketch #cells-b): the eyepiece with a graduated crosshair, a dense field of cells
// with nuclei, virus particles and a scale bar. Particles are separate so only they drift and tumble.
function cellField() {
  const rand = seeded(5);
  const cx = 1060, cy = 430, radius = 380;
  const place = (count: number, margin: number) => {
    const found: Point[] = [];
    for (let guard = 0; found.length < count && guard < 2000; guard += 1) {
      const x = cx - radius + rand() * 2 * radius, y = cy - radius + rand() * 2 * radius;
      if (Math.hypot(x - cx, y - cy) < radius - margin && found.every(([a, b]) => Math.hypot(a - x, b - y) > margin * 1.6)) found.push([x, y]);
    }
    return found;
  };
  const cells = place(12, 48).map(([x, y]) => {
    const size = 34 + rand() * 18;
    return { wall: blob(x, y, size, rand), nucleus: blob(x + size * 0.15, y - size * 0.1, size * 0.32, rand) };
  });
  const particles = place(20, 22).map(([x, y]) => ({
    x: round(x), y: round(y),
    spikes: Array.from({ length: 8 }, (_, index) => {
      const angle = (index / 8) * Math.PI * 2;
      return `M${round(x + Math.cos(angle) * 9)} ${round(y + Math.sin(angle) * 9)}L${round(x + Math.cos(angle) * 15)} ${round(y + Math.sin(angle) * 15)}`;
    }).join(""),
  }));
  const ticks = Array.from({ length: 19 }, (_, index) => {
    const offset = (index - 9) * 40, major = index % 5 === 4, half = major ? 12 : 6;
    return `M${cx + offset} ${cy - half}v${half * 2}M${cx - half} ${cy + offset}h${half * 2}`;
  }).join("");
  return {
    centre: { cx, cy, radius },
    reticle: `M${cx - radius} ${cy}H${cx + radius}M${cx} ${cy - radius}V${cy + radius}${ticks}`,
    scaleBar: `M${cx + 120} ${cy + 300}h140M${cx + 120} ${cy + 292}v16M${cx + 260} ${cy + 292}v16`,
    cells,
    particles,
  };
}

const cells = cellField();

export function DesktopWallpaper({ kind }: { kind: string }) {
  if (kind === "quiet") return null;
  return <svg className={`desktop-wallpaper desktop-wallpaper-${kind}`} viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
    {kind === "grid"
      ? helices.map((column) => <g key={column.x} className="wallpaper-helix" style={{ opacity: column.opacity, animationDelay: column.delay }}>
          <path d={column.a} /><path d={column.b} /><path d={column.rungs} className="wallpaper-rungs" />
        </g>)
      : kind === "gel"
      ? <g className="wallpaper-gel">
          <path d={gel.wells} className="wallpaper-gel-wells" />
          <path d={gel.walls} className="wallpaper-gel-walls" />
          <path d={gel.scale} className="wallpaper-gel-scale" />
          <g className="wallpaper-gel-bands">
            {gel.bands.map((band, index) => <path key={index} d={band.d} style={{ strokeWidth: band.weight, opacity: band.opacity }} />)}
          </g>
        </g>
      : kind === "cells"
      ? <g className="wallpaper-cells">
          <circle cx={cells.centre.cx} cy={cells.centre.cy} r={cells.centre.radius} className="wallpaper-cells-eyepiece" />
          <circle cx={cells.centre.cx} cy={cells.centre.cy} r={cells.centre.radius + 14} className="wallpaper-cells-rim" />
          <path d={cells.reticle} className="wallpaper-cells-reticle" />
          {cells.cells.map((cell, index) => <g key={index} className="wallpaper-cell"><path d={cell.wall} /><path d={cell.nucleus} className="wallpaper-cell-nucleus" /></g>)}
          <g className="wallpaper-cells-particles">
            {cells.particles.map((particle, index) => <g key={index} className="wallpaper-particle" style={{ animationDelay: `${-((index * 3.7) % 20)}s` }}>
              <circle cx={particle.x} cy={particle.y} r={9} /><path d={particle.spikes} />
            </g>)}
          </g>
          <path d={cells.scaleBar} className="wallpaper-cells-scale" />
        </g>
      : <g className="wallpaper-web">
          {web.spokePaths.map((d, index) => <path key={`s${index}`} d={d} pathLength={1} style={{ animationDelay: `${index * 40}ms` }} />)}
          {web.rings.map((d, index) => <path key={`r${index}`} d={d} pathLength={1} className="wallpaper-web-ring" style={{ animationDelay: `${600 + index * 70}ms` }} />)}
          {/* After the web is spun, glints run out along the threads, each on its own beat. */}
          <g className="wallpaper-web-pulses">
            {web.spokePaths.map((d, index) => <path key={`p${index}`} d={d} pathLength={1} style={{ animationDelay: `${round(2 + ((index * 2.3) % 9))}s` }} />)}
          </g>
        </g>}
  </svg>;
}
