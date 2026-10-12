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

export function DesktopWallpaper({ kind }: { kind: string }) {
  if (kind === "quiet") return null;
  return <svg className={`desktop-wallpaper desktop-wallpaper-${kind}`} viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
    {kind === "grid"
      ? helices.map((column) => <g key={column.x} className="wallpaper-helix" style={{ opacity: column.opacity, animationDelay: column.delay }}>
          <path d={column.a} /><path d={column.b} /><path d={column.rungs} className="wallpaper-rungs" />
        </g>)
      : <g className="wallpaper-web">
          {web.spokePaths.map((d, index) => <path key={`s${index}`} d={d} pathLength={1} style={{ animationDelay: `${index * 40}ms` }} />)}
          {web.rings.map((d, index) => <path key={`r${index}`} d={d} pathLength={1} className="wallpaper-web-ring" style={{ animationDelay: `${600 + index * 70}ms` }} />)}
        </g>}
  </svg>;
}
