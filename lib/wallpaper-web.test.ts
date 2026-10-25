import test from "node:test";
import assert from "node:assert/strict";
import { REST_NODE, createPulsePool, edgesAt, emitPulse, planWalk, pointOnEdge, pulseShape, seeded, stepPulses, visibleNodes, walkPose, webEdges, webGeometry, type Point } from "./wallpaper-web.ts";

const near = (a: Point, b: Point, tolerance: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
// Distance from a point to the thread drawn as a 400-piece polyline.
const distanceToEdge = (point: Point, index: number) => {
  const edge = webEdges[index];
  let best = Infinity;
  let from = pointOnEdge(edge, 0);
  for (let sample = 1; sample <= 400; sample += 1) {
    const to = pointOnEdge(edge, sample / 400);
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const along = Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(point[0] - (from[0] + dx * along), point[1] - (from[1] + dy * along)));
    from = to;
  }
  return best;
};
const edgeBetween = (u: number, v: number) => webEdges.findIndex((edge) => (edge.a === u && edge.b === v) || (edge.a === v && edge.b === u));

test("web geometry has 270 crossings and 522 threads between them", () => {
  assert.equal(webGeometry.nodes.length, 270);
  assert.equal(webEdges.length, 522);
  assert.equal(webEdges.filter((edge) => edge.kind === "spoke").length, 252);
  assert.equal(webEdges.filter((edge) => edge.kind === "ring").length, 270);
  // Every crossing of a ring with a spoke touches 3 or 4 threads: two ring pieces and one or two spoke pieces.
  assert.ok(webGeometry.nodes.every((_, node) => edgesAt(node).length >= 3 && edgesAt(node).length <= 4));
});

test("a spoke crossing lies on its spoke line and a ring segment follows the drawn curve", () => {
  const { center, angles, nodes, sags } = webGeometry;
  nodes.forEach((node, id) => {
    const angle = angles[id % 18];
    const offLine = Math.abs((node[0] - center[0]) * Math.sin(angle) - (node[1] - center[1]) * Math.cos(angle));
    assert.ok(offLine < 0.01, `node ${id} is ${offLine} off its spoke`);
  });
  const ring = webEdges.findIndex((edge) => edge.kind === "ring");
  assert.ok(ring >= 0, "the web has ring threads");
  const edge = webEdges[ring];
  const p0 = nodes[edge.a], c = sags[edge.a], p1 = nodes[edge.b];
  const mid: Point = [0.25 * p0[0] + 0.5 * c[0] + 0.25 * p1[0], 0.25 * p0[1] + 0.5 * c[1] + 0.25 * p1[1]];
  assert.ok(near(pointOnEdge(edge, 0.5), mid, 0.001));
  // The control point is the chord midpoint pulled 8% toward the hub, as the web has always been drawn.
  const chord: Point = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  assert.ok(near(c, [chord[0] + (center[0] - chord[0]) * 0.08, chord[1] + (center[1] - chord[1]) * 0.08], 0.001));
  webEdges.forEach((each) => {
    assert.ok(near(pointOnEdge(each, 0), nodes[each.a], 1e-9));
    assert.ok(near(pointOnEdge(each, 1), nodes[each.b], 1e-9));
    assert.ok(each.length > 5);
  });
});

test("the rest crossing is ring 5, spoke 3", () => {
  assert.equal(REST_NODE, (5 - 1) * 18 + 3);
  assert.ok(near(webGeometry.nodes[REST_NODE], [1313, 354], 3));
});

test("walkPose stays on the threads and eases in and out", () => {
  // ring piece, spoke piece, ring piece
  const path = [REST_NODE, REST_NODE + 1, REST_NODE + 19, REST_NODE + 20];
  const edges = [0, 1, 2].map((hop) => edgeBetween(path[hop], path[hop + 1]));
  assert.ok(edges.every((edge) => edge >= 0));
  const total = edges.reduce((sum, edge) => sum + webEdges[edge].length, 0);
  const duration = total / 36 + 0.4;
  assert.ok(near([walkPose(path, 0).x, walkPose(path, 0).y], webGeometry.nodes[REST_NODE], 1e-6));
  assert.equal(walkPose(path, 0).done, false);
  assert.equal(walkPose(path, duration - 0.01).done, false);
  const end = walkPose(path, duration + 0.01);
  assert.equal(end.done, true);
  assert.ok(near([end.x, end.y], webGeometry.nodes[path[3]], 0.01));
  assert.ok(walkPose(path, 0.4).distance < 0.4 * 36);
  let last = -1;
  for (let step = 0; step <= 100; step += 1) {
    const pose = walkPose(path, (duration * step) / 100);
    assert.ok(pose.distance >= last, "distance never goes back");
    last = pose.distance;
    // The pose lies on the polyline of the edge it names.
    const best = distanceToEdge([pose.x, pose.y], pose.edge);
    assert.ok(best < 0.05, `step ${step} is ${best} off its thread`);
  }
  assert.ok(Math.abs(last - total) < 1e-6);
  // 36 units/s is the top speed.
  for (let step = 0; step < 100; step += 1) {
    const a = walkPose(path, (duration * step) / 100), b = walkPose(path, (duration * (step + 1)) / 100);
    assert.ok((b.distance - a.distance) / (duration / 100) <= 36 + 1e-6);
  }
});

test("seeded gives the same sequence for the same seed", () => {
  const one = seeded(23), two = seeded(23);
  for (let step = 0; step < 10; step += 1) assert.equal(one(), two());
});

test("visibleNodes maps the viewBox through xMaxYMin slice with a 40-unit margin", () => {
  const phone = visibleNodes(390, 844);
  assert.ok(phone.includes(REST_NODE));
  assert.ok(phone.length >= 6);
  const scale = Math.max(390 / 1440, 844 / 900);
  for (const node of phone) {
    const [x, y] = webGeometry.nodes[node];
    assert.ok(x >= 1440 - 390 / scale + 40 - 1e-9 && x <= 1400 + 1e-9, `node ${node} x ${x}`);
    assert.ok(y >= 40 - 1e-9 && y <= 844 / scale - 40 + 1e-9, `node ${node} y ${y}`);
  }
  assert.ok(visibleNodes(1920, 1080).length > phone.length);
});

test("planWalk goes 2-4 crossings over visible nodes and never back to the one just left", () => {
  const visible = visibleNodes(1920, 1080);
  const inside = new Set(visible);
  const rand = seeded(7);
  let from = REST_NODE, previous = -1;
  for (let call = 0; call < 200; call += 1) {
    const path = planWalk(from, previous, visible, rand);
    assert.equal(path[0], from);
    assert.ok(path.length >= 3 && path.length <= 5, `${path.length - 1} edges`);
    assert.ok(path.every((node) => inside.has(node)));
    for (let hop = 0; hop + 1 < path.length; hop += 1) assert.ok(edgeBetween(path[hop], path[hop + 1]) >= 0, "consecutive nodes share a thread");
    assert.notEqual(path[path.length - 1], previous);
    previous = path[path.length - 2];
    from = path[path.length - 1];
  }
});

test("planWalk with fewer than 6 visible crossings uses any of them", () => {
  const few = [REST_NODE, REST_NODE + 1, REST_NODE + 19];
  const rand = seeded(5);
  const targets = new Set<number>();
  for (let call = 0; call < 60; call += 1) {
    const path = planWalk(REST_NODE, -1, few, rand);
    assert.ok(few.includes(path[path.length - 1]) && path[path.length - 1] !== REST_NODE);
    targets.add(path[path.length - 1]);
  }
  assert.deepEqual([...targets].sort(), [REST_NODE + 1, REST_NODE + 19]);
  for (let call = 0; call < 20; call += 1) assert.equal(planWalk(REST_NODE, REST_NODE + 1, few, rand).at(-1), REST_NODE + 19);
  assert.deepEqual(planWalk(REST_NODE, -1, [], rand), []);
});

test("the pulse pool never holds more than 8 and a pulse dies by 1.2 s", () => {
  const pool = createPulsePool();
  assert.equal(pool.slots.length, 8);
  const rand = seeded(3);
  let now = 0;
  for (let step = 0; step < 1000; step += 1) {
    now += rand() * 0.05;
    emitPulse(pool, Math.floor(rand() * webEdges.length), rand() * 50, rand() < 0.5 ? 1 : -1, 0.6, now);
    stepPulses(pool, now);
    assert.ok(pool.slots.filter((slot) => slot.alive).length <= 8);
  }
  const full = createPulsePool();
  for (let count = 0; count < 8; count += 1) assert.equal(emitPulse(full, 0, 1, 1, 0.6, 0), true);
  assert.equal(emitPulse(full, 0, 1, 1, 0.6, 0), false);
  const single = createPulsePool();
  emitPulse(single, 0, 1, 1, 0.6, 0);
  // The first pulse reaches a crossing and spawns half-strength children in other slots; it is slot 0 that must die on time.
  stepPulses(single, 1.19);
  assert.equal(single.slots[0].alive, true);
  stepPulses(single, 1.21);
  assert.equal(single.slots[0].alive, false);
});

test("a pulse that reaches a crossing continues into the other threads at half strength", () => {
  const edge = webEdges.findIndex((candidate) => candidate.kind === "spoke");
  const end = webEdges[edge].b;
  const pool = createPulsePool();
  emitPulse(pool, edge, webEdges[edge].length - 1, 1, 0.6, 0);
  stepPulses(pool, 0.1);
  const alive = pool.slots.filter((slot) => slot.alive);
  assert.equal(alive.length, 1 + edgesAt(end).length - 1);
  const children = alive.filter((slot) => slot.edge !== edge);
  assert.equal(children.length, edgesAt(end).length - 1);
  for (const child of children) {
    assert.ok(Math.abs(child.peak - 0.3) < 1e-9);
    assert.ok(edgesAt(end).includes(child.edge));
  }
});

test("pulseShape draws a 120-unit window on the thread with fading opacity and width", () => {
  const edge = webEdges.findIndex((candidate) => candidate.length > 200);
  assert.ok(edge >= 0);
  const pool = createPulsePool();
  emitPulse(pool, edge, 150, 1, 0.6, 0);
  const pulse = pool.slots[0];
  const start = pulseShape(pulse, 0);
  assert.equal(start.points.length, 8);
  assert.ok(start.points.every((point) => distanceToEdge(point, edge) < 0.05));
  let length = 0;
  for (let index = 1; index < start.points.length; index += 1) length += Math.hypot(start.points[index][0] - start.points[index - 1][0], start.points[index][1] - start.points[index - 1][1]);
  assert.ok(length > 118 && length <= 120.01, `window is ${length} long`);
  assert.ok(Math.abs(start.opacity - 0.6) < 1e-9);
  assert.ok(Math.abs(start.width - 1.8) < 1e-9);
  const end = pulseShape(pulse, 1.2);
  assert.ok(Math.abs(end.opacity) < 1e-9);
  assert.ok(Math.abs(end.width - 1) < 1e-9);
});
