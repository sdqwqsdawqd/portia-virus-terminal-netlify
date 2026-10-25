import test from "node:test";
import assert from "node:assert/strict";
import { REST_NODE, edgesAt, pointOnEdge, seeded, walkPose, webEdges, webGeometry, type Point } from "./wallpaper-web.ts";

const near = (a: Point, b: Point, tolerance: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
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
    const edge = webEdges[pose.edge];
    let best = Infinity;
    let from = pointOnEdge(edge, 0);
    for (let sample = 1; sample <= 400; sample += 1) {
      const to = pointOnEdge(edge, sample / 400);
      const dx = to[0] - from[0], dy = to[1] - from[1];
      const along = Math.max(0, Math.min(1, ((pose.x - from[0]) * dx + (pose.y - from[1]) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(pose.x - (from[0] + dx * along), pose.y - (from[1] + dy * along)));
      from = to;
    }
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
