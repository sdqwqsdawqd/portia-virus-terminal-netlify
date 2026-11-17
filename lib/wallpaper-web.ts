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

const TURN_RADIUS = 12;

function directedSample(hop: Hop, along: number) {
  const thread = webEdges[hop.edge];
  const at = hop.forward ? along : thread.length - along;
  const t = parameterAt(hop.edge, at);
  const point = pointOnEdge(thread, t);
  const tangent = tangentAt(thread, t);
  const direction: Point = hop.forward ? tangent : [-tangent[0], -tangent[1]];
  const magnitude = Math.hypot(direction[0], direction[1]) || 1;
  return { point, direction: [direction[0] / magnitude, direction[1] / magnitude] as Point, at };
}

function roundedTurn(plan: { hops: Hop[] }, distance: number) {
  for (let index = 1; index < plan.hops.length; index += 1) {
    const incoming = plan.hops[index - 1], outgoing = plan.hops[index];
    const incomingLength = webEdges[incoming.edge].length;
    const outgoingLength = webEdges[outgoing.edge].length;
    const radius = Math.min(TURN_RADIUS, incomingLength * 0.25, outgoingLength * 0.25);
    const boundary = outgoing.start;
    if (distance < boundary - radius || distance > boundary + radius) continue;
    const start = directedSample(incoming, incomingLength - radius);
    const end = directedSample(outgoing, radius);
    const control = radius * 0.6;
    const c1: Point = [start.point[0] + start.direction[0] * control, start.point[1] + start.direction[1] * control];
    const c2: Point = [end.point[0] - end.direction[0] * control, end.point[1] - end.direction[1] * control];
    const t = (distance - (boundary - radius)) / (2 * radius);
    const u = 1 - t;
    const point: Point = [
      u ** 3 * start.point[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * end.point[0],
      u ** 3 * start.point[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * end.point[1],
    ];
    const derivative: Point = [
      3 * u * u * (c1[0] - start.point[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (end.point[0] - c2[0]),
      3 * u * u * (c1[1] - start.point[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (end.point[1] - c2[1]),
    ];
    return { point, heading: Math.atan2(derivative[1], derivative[0]) };
  }
  return null;
}

// One rate scales the whole walk timeline. Distance-linked gait then follows automatically without a second multiplier.
export const SPIDER_MOTION_RATE = 1.8;
export const SPIDER_WALK_SPEED = 36 * SPIDER_MOTION_RATE;
const WALK_SPEED = SPIDER_WALK_SPEED;
const WALK_EASE = 0.4 / SPIDER_MOTION_RATE;
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
  const rounded = roundedTurn(plan, distance);
  const [x, y] = rounded?.point ?? pointOnEdge(thread, t);
  const [dx, dy] = tangentAt(thread, t);
  return { x, y, heading: rounded?.heading ?? Math.atan2(forward ? dy : -dy, forward ? dx : -dx), done: elapsed >= plan.duration, edge, at, forward, distance };
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

export function selectSpawn(visible: number[], previous: number, rand: () => number): number {
  const alternatives = visible.filter((node) => node !== previous);
  const pool = alternatives.length ? alternatives : visible;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] : REST_NODE;
}

export type Footfall = { edge: number; at: number } | null;

export const GAIT_STRIDE = 20;
export function gaitPhase(distance: number) {
  const phase = (Math.max(0, distance) / GAIT_STRIDE) % 1;
  return phase < 0 ? phase + 1 : phase;
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

export function planSpawn(visible: number[], previous: number, rand: () => number) {
  const node = selectSpawn(visible, previous, rand);
  const path = planWalk(node, -1, visible, rand);
  const heading = path.length > 1 ? walkPose(path, 0).heading : Math.PI / 2;
  const routeKey = path.reduce((total, routeNode, index) => total + routeNode * (index + 3), 0);
  const phase = ((routeKey % 20) + 20) % 20 / 20;
  return { node, path, heading, phase };
}

// Waves along the threads (D-05): a pulse is a 120-unit stretch of one thread that runs away from its start at 260 units/s
// and fades over 0.9 s. The pool has a fixed number of slots, so a step allocates nothing and the cost has a ceiling.
const PULSE_SPEED = 260;
const PULSE_LENGTH = 120;
export const PULSE_LIFE = 0.9; // a wave dies out within 0.9s (UI-SPEC: at most 900ms)
const PULSE_POINTS = 8;
const PULSE_MIN_PEAK = 0.04;
const FOOTFALL_STEP = 8; // sampling step (units) when searching a thread for the point nearest the body

// D-53 (20-37, plan 20-41): a footfall wave is never refused for want of a slot. Waves per footfall: one on each side of the body where a thread
// was found (two at most). At full speed (SPIDER_WALK_SPEED 64.8 units/s, a footfall every GAIT_STRIDE / 2 = 10 units) that is 6.48 footfalls a second,
// so 6.48 x 2 x 1 wave x 0.9 s = 11.7 slots held by step waves; the spider's pool has 16 slots (the ceiling), the other 4.3 hold the echoes.
export const STEP_WAVES_PER_SIDE = 1;
// A step wave is safe from being pushed out for this share of its life.
const STEP_WAVE_SAFE = 0.75;

// at = distance from the edge's a end; dir 1 runs toward b, -1 toward a; times are in seconds.
// kind: "step" is the wave of a footfall; "echo" is what a wave leaves at a crossing and is pushed out first.
export type PulseKind = "step" | "echo";
export type Pulse = { alive: boolean; edge: number; at: number; dir: 1 | -1; peak: number; born: number; spawned: boolean; kind: PulseKind };
export type PulsePool = { slots: Pulse[] };

export function createPulsePool(size = 8): PulsePool {
  return { slots: Array.from({ length: size }, (): Pulse => ({ alive: false, edge: 0, at: 0, dir: 1, peak: 0, born: 0, spawned: false, kind: "step" })) };
}

const fill = (slot: Pulse, edge: number, at: number, dir: 1 | -1, peak: number, now: number, kind: PulseKind) => {
  slot.alive = true; slot.edge = edge; slot.at = at; slot.dir = dir; slot.peak = peak; slot.born = now; slot.spawned = false; slot.kind = kind;
};

// A busy pool refuses silently: this is the low-priority way in (echoes); a footfall uses emitStepWaves.
export function emitPulse(pool: PulsePool, edge: number, at: number, dir: 1 | -1, peak: number, now: number, kind: PulseKind = "step"): boolean {
  const slot = pool.slots.find((candidate) => !candidate.alive);
  if (!slot) return false;
  fill(slot, edge, at, dir, peak, now, kind);
  return true;
}

// The slot a step wave takes: a free one, else the oldest echo, else the oldest step wave that has lived at least 0.75 of its life; null when none.
function claimSlot(pool: PulsePool, now: number): Pulse | null {
  let echo: Pulse | null = null, step: Pulse | null = null;
  for (const slot of pool.slots) {
    const age = now - slot.born;
    if (!slot.alive || age >= PULSE_LIFE) return slot;
    if (slot.kind === "echo") { if (!echo || slot.born < echo.born) echo = slot; }
    else if (age >= STEP_WAVE_SAFE * PULSE_LIFE && (!step || slot.born < step.born)) step = slot;
  }
  return echo ?? step;
}

// How far a leg turns to carry its foot as far as the body moves in one stance (D-53): the foot of a leg of length `reach` (drawing units) swings
// 2 x reach x sin(angle) from one end of the stance to the other, and the body covers `stance` web units over the same time; a web unit is
// `unitsPerWeb` drawing units. `fit` (0.8-1.2) lengthens or shortens the foot's path against the body's. Degrees, half of the sweep.
export function legSwingDegrees(reach: number, stance = 0.6 * GAIT_STRIDE, unitsPerWeb = 649.5 / 72, fit = 1): number {
  if (!(reach > 0)) return 0;
  const ratio = Math.min(1, (stance * unitsPerWeb * fit) / (2 * reach));
  return (Math.asin(ratio) * 180) / Math.PI;
}

// One wave on each side of the body where a thread was found: a footfall that has a thread beside it always waves it. The wave runs along the
// heading or against it (`against`), so the two groups of legs send the waves opposite ways. Returns how many sides asked and how many were waved.
export function emitStepWaves(pool: PulsePool, sides: { left: Footfall; right: Footfall }, heading: number, peak: number, now: number, against: boolean): { found: number; emitted: number } {
  let found = 0, emitted = 0;
  for (const side of [sides.left, sides.right]) {
    if (!side) continue;
    found += 1;
    const slot = claimSlot(pool, now);
    if (!slot) continue;
    const thread = webEdges[side.edge];
    const [dx, dy] = tangentAt(thread, parameterAt(side.edge, side.at));
    const along = Math.cos(heading) * dx + Math.sin(heading) * dy >= 0;
    fill(slot, side.edge, side.at, along !== against ? 1 : -1, peak, now, "step");
    emitted += 1;
  }
  return { found, emitted };
}

// One pulse into every thread of a crossing, running away from it (except the thread it came along, when given).
export function emitAtCrossing(pool: PulsePool, node: number, peak: number, now: number, except = -1) {
  for (const index of touching[node]) {
    if (index === except) continue;
    const atStart = webEdges[index].a === node;
    emitPulse(pool, index, atStart ? 0 : webEdges[index].length, atStart ? 1 : -1, peak, now, "echo");
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
    // Each crossing halves the wave; below the floor it stops spreading, so invisible echoes never hold the pool.
    if (pulse.peak / 2 >= PULSE_MIN_PEAK) emitAtCrossing(pool, pulse.dir === 1 ? thread.b : thread.a, pulse.peak / 2, now, pulse.edge);
  }
}

// One frame of the body turn: eases toward target by the shortest way (through pi), never faster than maxRate rad/s, never past the target (D-06).
export function turnStep(angle: number, target: number, dt: number, turnTime: number, maxRate: number): number {
  const difference = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  const limit = maxRate * dt;
  return angle + Math.max(-limit, Math.min(limit, difference * (1 - Math.exp(-dt / turnTime))));
}

// Share of the route clock that runs while the body is `turn` radians off its heading: full speed within 60 degrees, none from 90 degrees on.
// A route therefore starts by curving into its direction with the legs stepping, never by sliding sideways or backwards on a frozen pose.
export function turnGate(turn: number): number {
  const x = Math.max(0, Math.min(1, Math.cos(turn) / 0.5));
  return x * x * (3 - 2 * x);
}

// The lane point `offset` units to the left (side 1) or right (side -1) of the travel direction at (px, py).
export function besideThread(px: number, py: number, direction: number, side: number, offset: number): Point {
  return [px + Math.cos(direction + Math.PI / 2) * offset * side, py + Math.sin(direction + Math.PI / 2) * offset * side];
}

// The body target on a route: the side shift is woven into the acceleration (smoothstep over `blend` units of distance) instead of jumping at the start (D-06).
export function laneTarget(pose: Pick<WalkPose, "x" | "y" | "heading" | "distance">, side: number, offset: number, start: Point, blend: number): Point {
  const raw = blend > 0 ? Math.max(0, Math.min(1, pose.distance / blend)) : 1;
  const s = raw * raw * (3 - 2 * raw);
  const lane = besideThread(0, 0, pose.heading, side, offset);
  return [pose.x + start[0] + (lane[0] - start[0]) * s, pose.y + start[1] + (lane[1] - start[1]) * s];
}

// One frame of the exponential follow of a target; frame-rate independent.
export function followStep(x: number, y: number, tx: number, ty: number, dt: number, settleTime: number): Point {
  const k = 1 - Math.exp(-dt / settleTime);
  return [x + (tx - x) * k, y + (ty - y) * k];
}

// Which side (1 or -1) of a thread point (px, py) walking along `direction` is nearer to the body at (x, y): a new route keeps the side
// the spider already stands on instead of throwing it across the thread.
export function laneSideFor(x: number, y: number, px: number, py: number, direction: number, offset: number): 1 | -1 {
  const left = besideThread(px, py, direction, 1, offset), right = besideThread(px, py, direction, -1, offset);
  return Math.hypot(left[0] - x, left[1] - y) <= Math.hypot(right[0] - x, right[1] - y) ? 1 : -1;
}

// Waves run along the threads on both sides of the body (D-08): the nearest thread point within reach strictly left (cross product > 0) and right (< 0) of the heading.
export function footfallThreads(x: number, y: number, heading: number, reach = 120): { left: Footfall; right: Footfall } {
  const found: { left: Footfall; right: Footfall } = { left: null, right: null };
  let bestLeft = Infinity, bestRight = Infinity;
  const cos = Math.cos(heading), sin = Math.sin(heading);
  webEdges.forEach((thread, index) => {
    const origin = nodes[thread.a];
    // Cheap reject: a thread whose start is farther than reach + length cannot have a point within reach.
    if (Math.hypot(origin[0] - x, origin[1] - y) > reach + thread.length) return;
    for (let at = 0; at < thread.length + FOOTFALL_STEP; at += FOOTFALL_STEP) {
      const along = Math.min(at, thread.length);
      const [px, py] = pointOnEdge(thread, parameterAt(index, along));
      const dx = px - x, dy = py - y, distance = Math.hypot(dx, dy);
      if (distance > reach) continue;
      const cross = cos * dy - sin * dx;
      if (cross > 0 && distance < bestLeft) { bestLeft = distance; found.left = { edge: index, at: along }; }
      else if (cross < 0 && distance < bestRight) { bestRight = distance; found.right = { edge: index, at: along }; }
    }
  });
  return found;
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

export type SpiderTransformInput = { dx: number; dy: number; angleDeg: number; bob: number; dpr: number; resting: boolean };

// The one place the spider's inline transform string is built (D-45). Walking keeps the smooth fractional form with the body bob.
// At rest the shift is snapped to the device-pixel grid (multiples of 1/dpr) and scale() is left out, so the artwork is rasterised
// on whole pixels instead of being resampled; an invalid ratio counts as 1.
export function spiderTransform({ dx, dy, angleDeg, bob, dpr, resting }: SpiderTransformInput): string {
  const rotate = `rotate(${angleDeg.toFixed(2)}deg)`;
  if (!resting) return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ${rotate} scale(${bob.toFixed(4)})`;
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const snap = (value: number) => Number((Math.round(value * ratio) / ratio).toFixed(4));
  return `translate(${snap(dx)}px, ${snap(dy)}px) ${rotate}`;
}
