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

// The crossings on screen. The wallpaper svg is «xMaxYMin slice»: scale = the larger of width/1440 and height/900,
// the right edge and the top stay put, so the visible viewBox is x from 1440 - width/scale to 1440, y from 0 to height/scale.
export function visibleNodes(width: number, height: number, margin = 40): number[] {
  const scale = Math.max(width / 1440, height / 900);
  const left = 1440 - width / scale + margin, right = 1440 - margin, bottom = height / scale - margin;
  const list: number[] = [];
  nodes.forEach(([x, y], id) => { if (x >= left && x <= right && y >= margin && y <= bottom) list.push(id); });
  return list;
}

const WALK_MIN_HOPS = 2;
const WALK_MAX_HOPS = 4;
// Below this many visible crossings (a narrow phone) the 2-4 hop rule is dropped and any visible crossing will do.
const FEW_VISIBLE = 6;

// A walk of 2-4 crossings over visible crossings only, never ending on the crossing just left; [] when nothing is reachable.
export function planWalk(from: number, previous: number, visible: number[], rand: () => number): number[] {
  const inside = new Set(visible);
  const hops = new Map<number, number>([[from, 0]]);
  const parent = new Map<number, number>();
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    for (const index of touching[node]) {
      const other = webEdges[index].a === node ? webEdges[index].b : webEdges[index].a;
      if (!inside.has(other) || hops.has(other)) continue;
      hops.set(other, (hops.get(node) as number) + 1);
      parent.set(other, node);
      queue.push(other);
    }
  }
  const reached = queue.slice(1);
  const inRange = reached.filter((node) => (hops.get(node) as number) >= WALK_MIN_HOPS && (hops.get(node) as number) <= WALK_MAX_HOPS && node !== previous);
  const others = reached.filter((node) => node !== previous);
  const pool = visible.length >= FEW_VISIBLE && inRange.length ? inRange : others.length ? others : reached;
  if (!pool.length) return [];
  const path = [pool[Math.floor(rand() * pool.length)]];
  while (path[0] !== from) path.unshift(parent.get(path[0]) as number);
  return path;
}

// Waves along the threads (D-05): a pulse is a 120-unit stretch of one thread that runs away from its start at 260 units/s
// and fades over 1.2 s. The pool has a fixed number of slots, so a step allocates nothing and the cost has a ceiling.
const PULSE_SPEED = 260;
const PULSE_LENGTH = 120;
const PULSE_LIFE = 1.2;
const PULSE_POINTS = 8;

// at = distance from the edge's a end; dir 1 runs toward b, -1 toward a; times are in seconds.
export type Pulse = { alive: boolean; edge: number; at: number; dir: 1 | -1; peak: number; born: number; spawned: boolean };
export type PulsePool = { slots: Pulse[] };

export function createPulsePool(size = 8): PulsePool {
  return { slots: Array.from({ length: size }, (): Pulse => ({ alive: false, edge: 0, at: 0, dir: 1, peak: 0, born: 0, spawned: false })) };
}

export function emitPulse(pool: PulsePool, edge: number, at: number, dir: 1 | -1, peak: number, now: number): boolean {
  const slot = pool.slots.find((candidate) => !candidate.alive);
  if (!slot) return false;
  slot.alive = true; slot.edge = edge; slot.at = at; slot.dir = dir; slot.peak = peak; slot.born = now; slot.spawned = false;
  return true;
}

// One pulse into every thread of a crossing, running away from it (except the thread it came along, when given).
export function emitAtCrossing(pool: PulsePool, node: number, peak: number, now: number, except = -1) {
  for (const index of touching[node]) {
    if (index === except) continue;
    const atStart = webEdges[index].a === node;
    emitPulse(pool, index, atStart ? 0 : webEdges[index].length, atStart ? 1 : -1, peak, now);
  }
}

export function stepPulses(pool: PulsePool, now: number): void {
  for (const pulse of pool.slots) {
    if (!pulse.alive) continue;
    const age = now - pulse.born;
    if (age >= PULSE_LIFE) { pulse.alive = false; continue; }
    if (pulse.spawned) continue;
    const head = pulse.at + pulse.dir * PULSE_SPEED * age;
    const thread = webEdges[pulse.edge];
    if (pulse.dir === 1 ? head < thread.length : head > 0) continue;
    pulse.spawned = true;
    emitAtCrossing(pool, pulse.dir === 1 ? thread.b : thread.a, pulse.peak / 2, now, pulse.edge);
  }
}

// What to draw for a pulse now: 8 points on the thread over the stretch behind its head, clipped to the thread.
export function pulseShape(pulse: Pulse, now: number): { points: Point[]; opacity: number; width: number } {
  const age = Math.max(0, now - pulse.born);
  const fade = Math.max(0, 1 - age / PULSE_LIFE);
  const head = pulse.at + pulse.dir * PULSE_SPEED * age;
  const tail = head - pulse.dir * PULSE_LENGTH;
  const length = webEdges[pulse.edge].length;
  const low = Math.max(0, Math.min(head, tail)), high = Math.min(length, Math.max(head, tail));
  const points: Point[] = [];
  if (high - low > 0.5) {
    for (let step = 0; step < PULSE_POINTS; step += 1) points.push(pointOnEdge(webEdges[pulse.edge], parameterAt(pulse.edge, low + ((high - low) * step) / (PULSE_POINTS - 1))));
  }
  return { points, opacity: pulse.peak * fade, width: 1 + 0.8 * fade };
}

const SWING_SHARE = 0.4; // part of the gait cycle a spider leg is in the air

const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

// One leg at gait phase p (0..1): stance sweeps from forward to back, swing returns with overshoot and a tuck.
export function legPose(p: number): { swing: number; tuck: number } {
  if (p < 1 - SWING_SHARE) return { swing: -1 + (2 * p) / (1 - SWING_SHARE), tuck: 0 };
  const s = (p - (1 - SWING_SHARE)) / SWING_SHARE;
  return { swing: 1 - 2 * easeOutBack(s), tuck: Math.sin(Math.PI * s) };
}
