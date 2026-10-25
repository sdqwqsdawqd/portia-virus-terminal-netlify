// Pure geometry and walking maths for the spider on the «Паутина» wallpaper (09-02).
// The web drawing and the spider both read this one module, so threads and footsteps cannot drift apart (D-05).

export type Point = [number, number];
// a and b are crossing ids; a ring piece curves through the control point webGeometry.sags[a].
export type Edge = { a: number; b: number; kind: "spoke" | "ring"; length: number };
// edge and at say where the spider stands: edge index and distance from the edge's a end; forward = walking a to b.
export type WalkPose = { x: number; y: number; heading: number; done: boolean; edge: number; at: number; forward: boolean; distance: number };

// Same generator as the approved sketch (02-SKETCHES.html), so the shipped drawing matches the choice.
export function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

const SPOKES = 18;
const RINGS = 15;
const HUB: Point = [1180, 170];
const ringRadius = (ring: number) => 34 * ring ** 1.18;
const reach = (angle: number) => 980 + 120 * Math.sin(angle * 3.1);
// Crossing id = (ring - 1) * 18 + spoke, rings counted from 1 at the hub.
const nodeId = (ring: number, spoke: number) => (ring - 1) * SPOKES + spoke;

const angles = Array.from({ length: SPOKES }, (_, index) => (index / SPOKES) * Math.PI * 2 + 0.11 * Math.sin(index * 1.7));
const spokeEnds = angles.map((angle): Point => [HUB[0] + Math.cos(angle) * reach(angle), HUB[1] + Math.sin(angle) * reach(angle)]);
const nodes: Point[] = [];
for (let ring = 1; ring <= RINGS; ring += 1) {
  angles.forEach((angle) => nodes.push([HUB[0] + Math.cos(angle) * ringRadius(ring), HUB[1] + Math.sin(angle) * ringRadius(ring)]));
}
// Each thread between two spokes sags toward the hub, like silk under its own weight: chord midpoint pulled 8% to the hub.
const sags = nodes.map((point, id): Point => {
  const next = nodes[nodeId(Math.floor(id / SPOKES) + 1, ((id % SPOKES) + 1) % SPOKES)];
  const mid: Point = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
  return [mid[0] + (HUB[0] - mid[0]) * 0.08, mid[1] + (HUB[1] - mid[1]) * 0.08];
});

export const webGeometry = { center: HUB, angles, spokeEnds, nodes, sags };

export const REST_NODE = nodeId(5, 3);

const quadratic = (p0: Point, c: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
};

// Arc length is sampled at 24 points per thread: finer than a pixel at this size, and one table per thread keeps frames cheap.
const ARC_SAMPLES = 24;

export function pointOnEdge(edge: Edge, t: number): Point {
  const p0 = nodes[edge.a], p1 = nodes[edge.b];
  return edge.kind === "spoke" ? [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t] : quadratic(p0, sags[edge.a], p1, t);
}

const arcTables: number[][] = [];
export const webEdges: Edge[] = [];
const addEdge = (a: number, b: number, kind: Edge["kind"]) => {
  const edge: Edge = { a, b, kind, length: 0 };
  const table = [0];
  let last = pointOnEdge(edge, 0);
  for (let step = 1; step <= ARC_SAMPLES; step += 1) {
    const point = pointOnEdge(edge, step / ARC_SAMPLES);
    table.push(table[step - 1] + Math.hypot(point[0] - last[0], point[1] - last[1]));
    last = point;
  }
  edge.length = table[ARC_SAMPLES];
  arcTables.push(table);
  webEdges.push(edge);
};
for (let ring = 1; ring <= RINGS; ring += 1) {
  for (let spoke = 0; spoke < SPOKES; spoke += 1) {
    addEdge(nodeId(ring, spoke), nodeId(ring, (spoke + 1) % SPOKES), "ring");
    if (ring < RINGS) addEdge(nodeId(ring, spoke), nodeId(ring + 1, spoke), "spoke");
  }
}

const touching: number[][] = nodes.map(() => []);
webEdges.forEach((edge, index) => { touching[edge.a].push(index); touching[edge.b].push(index); });

export function edgesAt(node: number): number[] {
  return touching[node];
}

// Curve parameter for a distance walked along the thread, from the arc-length table.
function parameterAt(edge: number, distance: number) {
  const table = arcTables[edge];
  if (distance <= 0) return 0;
  if (distance >= table[ARC_SAMPLES]) return 1;
  let step = 1;
  while (table[step] < distance) step += 1;
  return (step - 1 + (distance - table[step - 1]) / (table[step] - table[step - 1])) / ARC_SAMPLES;
}

function tangentAt(edge: Edge, t: number): Point {
  const p0 = nodes[edge.a], p1 = nodes[edge.b];
  if (edge.kind === "spoke") return [p1[0] - p0[0], p1[1] - p0[1]];
  const c = sags[edge.a];
  return [(1 - t) * (c[0] - p0[0]) + t * (p1[0] - c[0]), (1 - t) * (c[1] - p0[1]) + t * (p1[1] - c[1])];
}

// 36 units/s is about one body length in 3 s; 0.4 s of easing at each end of a walk keeps starts and stops soft (D-05).
const WALK_SPEED = 36;
const WALK_EASE = 0.4;
const WALK_ACCEL = WALK_SPEED / WALK_EASE;

type Hop = { edge: number; forward: boolean; start: number };
const hopCache = new WeakMap<number[], { hops: Hop[]; length: number; duration: number }>();

function planOf(path: number[]) {
  const known = hopCache.get(path);
  if (known) return known;
  const hops: Hop[] = [];
  let length = 0;
  for (let index = 0; index + 1 < path.length; index += 1) {
    const edge = touching[path[index]].find((candidate) => webEdges[candidate].a === path[index + 1] || webEdges[candidate].b === path[index + 1]);
    if (edge === undefined) throw new Error(`crossings ${path[index]} and ${path[index + 1]} share no thread`);
    hops.push({ edge, forward: webEdges[edge].a === path[index], start: length });
    length += webEdges[edge].length;
  }
  // Full speed after the ease-in, or a triangle when the walk is too short to reach it.
  const duration = length >= WALK_SPEED * WALK_EASE ? (length - WALK_SPEED * WALK_EASE) / WALK_SPEED + 2 * WALK_EASE : 2 * Math.sqrt(length / WALK_ACCEL);
  const plan = { hops, length, duration };
  hopCache.set(path, plan);
  return plan;
}

function travelled(plan: { length: number; duration: number }, elapsed: number) {
  const { length, duration } = plan;
  if (elapsed <= 0) return 0;
  if (elapsed >= duration) return length;
  const ease = Math.min(WALK_EASE, duration / 2);
  if (elapsed <= ease) return 0.5 * WALK_ACCEL * elapsed * elapsed;
  if (elapsed > duration - ease) return length - 0.5 * WALK_ACCEL * (duration - elapsed) ** 2;
  return 0.5 * WALK_ACCEL * WALK_EASE * WALK_EASE + WALK_SPEED * (elapsed - WALK_EASE);
}

// Where the spider stands on a node path (consecutive crossings sharing a thread) after `elapsed` seconds of walking.
export function walkPose(path: number[], elapsed: number): WalkPose {
  const plan = planOf(path);
  if (!plan.hops.length) {
    const [x, y] = nodes[path[0]];
    return { x, y, heading: 0, done: true, edge: 0, at: 0, forward: true, distance: 0 };
  }
  const distance = travelled(plan, elapsed);
  let hop = plan.hops.length - 1;
  while (hop > 0 && plan.hops[hop].start > distance) hop -= 1;
  const { edge, forward, start } = plan.hops[hop];
  const thread = webEdges[edge];
  const along = Math.min(distance - start, thread.length);
  const at = forward ? along : thread.length - along;
  const t = parameterAt(edge, at);
  const [x, y] = pointOnEdge(thread, t);
  const [dx, dy] = tangentAt(thread, t);
  return { x, y, heading: Math.atan2(forward ? dy : -dy, forward ? dx : -dx), done: elapsed >= plan.duration, edge, at, forward, distance };
}
