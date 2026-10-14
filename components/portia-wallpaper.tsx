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
  // Dew on a few crossings of spoke and spiral; it twinkles once the web is spun.
  const rand = seeded(23);
  const dew = Array.from({ length: 16 }, () => {
    const ring = 3 + Math.floor(rand() * 12), angle = angles[Math.floor(rand() * spokes)], radius = 34 * ring ** 1.18;
    return { x: round(center[0] + Math.cos(angle) * radius), y: round(center[1] + Math.sin(angle) * radius), r: round(1.4 + rand() * 1.4) };
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

// «Гель»: an electrophoresis gel photographed under UV, anchored top right like the other wallpapers.
// No hard lane walls: soft lane columns, wells, a marker ladder with sizes, and "smiling" bands that glow
// and fade at their ends. Replicate lanes repeat the same fragments, as real samples would.
function gelLanes() {
  const lanes = 9, left = 812, pitch = 66, width = 46, top = 74, bottom = 820;
  const ladder = ["10 000", "6000", "4000", "3000", "2000", "1500", "1000", "750", "500", "250"];
  const ladderY = ladder.map((_, step) => round(top + 34 + (bottom - top - 120) * Math.log(1 + step * 0.9) / Math.log(1 + (ladder.length - 1) * 0.9)));
  const pickFragments = seeded(11);
  // One fragment per slice of the gel, so bands spread over its whole length.
  const fragments = Array.from({ length: 12 }, (_, slice) => round(top + 60 + ((slice + pickFragments() * 0.8) / 12) * (bottom - top - 160)));
  const columns: number[] = [];
  const bands: { d: string; weight: number; opacity: number }[] = [];
  const band = (x: number, y: number, weight: number, opacity: number) => bands.push({
    d: `M${x + 4} ${y}Q${x + width / 2} ${round(y + 2.6)} ${x + width - 4} ${y}`, weight: round(weight), opacity: Math.round(opacity * 100) / 100,
  });
  for (let lane = 0; lane < lanes; lane += 1) {
    const x = left + lane * pitch;
    columns.push(x);
    if (lane === 0) { ladderY.forEach((y, step) => band(x, y, step === 6 ? 5 : 3, step === 6 ? 0.9 : 0.6)); continue; }
    // Lanes 3 and 4 are replicates of lane 2; the rest pick their own fragments.
    const pick = seeded((lane === 3 || lane === 4 ? 2 : lane) * 31 + 3);
    fragments.filter(() => pick() < 0.38).forEach((y) => band(x, y, 3 + pick() * 7, 0.45 + pick() * 0.55));
  }
  return { columns, width, top, bottom, left, ladder, ladderY, bands };
}

const gel = gelLanes();

// «Клетки»: tissue seen through an eyepiece in the top-right corner. The cells are a Voronoi tessellation
// with rounded walls and a gap between neighbours; a few are infected, with virions at their walls.
function cellField() {
  const rand = seeded(5);
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
  let walls = "", sick = "", nuclei = "", sickNuclei = "";
  const particles: { x: number; y: number; spikes: string }[] = [];
  sites.forEach((site) => {
    const nucleus = `M${round(site[0] + 9)} ${round(site[1] - 3)}a9 7 0 1 0-18 0a9 7 0 1 0 18 0Z`;
    if (rand() >= 0.1) { walls += cellOf(site); nuclei += nucleus; return; }
    sick += cellOf(site); sickNuclei += nucleus;
    for (let count = 0; count < 2; count += 1) {
      const angle = rand() * Math.PI * 2, distance = 24 + rand() * 10;
      const x = round(site[0] + Math.cos(angle) * distance), y = round(site[1] + Math.sin(angle) * distance);
      particles.push({ x, y, spikes: Array.from({ length: 8 }, (_, spike) => {
        const turn = (spike / 8) * Math.PI * 2;
        return `M${round(x + Math.cos(turn) * 5)} ${round(y + Math.sin(turn) * 5)}L${round(x + Math.cos(turn) * 9)} ${round(y + Math.sin(turn) * 9)}`;
      }).join("") });
    }
  });
  return { cx, cy, radius, walls, sick, nuclei, sickNuclei, particles };
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
          <defs>
            <linearGradient id="wp-gel-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <mask id="wp-gel-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900"><rect width="1440" height="900" fill="url(#wp-gel-fade)" /></mask>
            <linearGradient id="wp-gel-band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset=".22" stopColor="currentColor" /><stop offset=".78" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
          </defs>
          <g mask="url(#wp-gel-mask)">
            {gel.columns.map((x) => <rect key={x} x={x} y={gel.top} width={gel.width} height={gel.bottom - gel.top} rx={3} className="wallpaper-gel-lane" />)}
            {gel.columns.map((x) => <rect key={`w${x}`} x={x + 3} y={gel.top - 22} width={gel.width - 6} height={10} rx={2} className="wallpaper-gel-well" />)}
            <g className="wallpaper-gel-bands">
              {gel.bands.map((band, index) => <path key={`g${index}`} d={band.d} stroke="url(#wp-gel-band)" style={{ strokeWidth: band.weight * 2.6, opacity: band.opacity * 0.08 }} />)}
              {gel.bands.map((band, index) => <path key={index} d={band.d} stroke="url(#wp-gel-band)" style={{ strokeWidth: band.weight, opacity: band.opacity * 0.42 }} />)}
              {/* The size labels run with the bands, so each stays beside its ladder band. */}
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
            <path d={cells.walls} className="wallpaper-cells-wall" />
            <path d={cells.nuclei} className="wallpaper-cells-nucleus" />
            <path d={cells.sick} className="wallpaper-cells-wall is-infected" />
            <path d={cells.sickNuclei} className="wallpaper-cells-nucleus is-infected" />
            <g className="wallpaper-cells-particles">
              {cells.particles.map((particle, index) => <g key={index} className="wallpaper-particle" style={{ animationDelay: `${-((index * 3.7) % 20)}s` }}>
                <circle cx={particle.x} cy={particle.y} r={5} /><path d={particle.spikes} />
              </g>)}
            </g>
          </g>
          <circle cx={cells.cx} cy={cells.cy} r={cells.radius} className="wallpaper-cells-edge" />
        </g>
      : <g className="wallpaper-web">
          {web.spokePaths.map((d, index) => <path key={`s${index}`} d={d} pathLength={1} style={{ animationDelay: `${index * 40}ms` }} />)}
          {web.rings.map((d, index) => <path key={`r${index}`} d={d} pathLength={1} className="wallpaper-web-ring" style={{ animationDelay: `${600 + index * 70}ms` }} />)}
          {/* After the web is spun, glints run out along the spokes and round the spiral, each on its own beat. */}
          <g className="wallpaper-web-pulses">
            {web.spokePaths.map((d, index) => <path key={`p${index}`} d={d} pathLength={1} style={{ animationDelay: `${round(4 + ((index * 2.3) % 9))}s` }} />)}
            {[4, 7, 10, 13].map((ring, index) => <path key={`q${ring}`} d={web.rings[ring]} pathLength={1} className="wallpaper-web-orbit" style={{ animationDelay: `${5 + index * 3.1}s` }} />)}
          </g>
          <g className="wallpaper-web-dew">
            {web.dew.map((drop, index) => <circle key={index} cx={drop.x} cy={drop.y} r={drop.r} style={{ animationDelay: `${round((index * 1.7) % 7)}s` }} />)}
          </g>
        </g>}
  </svg>;
}
