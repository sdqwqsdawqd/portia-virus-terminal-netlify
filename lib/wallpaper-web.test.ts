import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as web from "./wallpaper-web.ts";
import { REST_NODE, SPIDER_MOTION_RATE, SPIDER_WALK_SPEED, createPulsePool, edgesAt, besideThread, emitPulse, followStep, footfallThreads, gaitPhase, laneSideFor, laneTarget, legPose, planSpawn, planWalk, pointOnEdge, pulseShape, seeded, selectSpawn, stepPulses, turnGate, turnStep, visibleNodes, walkPose, webEdges, webGeometry, type Point } from "./wallpaper-web.ts";

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
const pointOnEdgeAt = (index: number, at: number): Point => {
  // The point `at` units along a thread, found by a fine polyline walk (independent of the module's arc table).
  let travelled = 0, last = pointOnEdge(webEdges[index], 0);
  if (at <= 0) return last;
  for (let sample = 1; sample <= 2000; sample += 1) {
    const point = pointOnEdge(webEdges[index], sample / 2000);
    travelled += Math.hypot(point[0] - last[0], point[1] - last[1]);
    if (travelled >= at) return point;
    last = point;
  }
  return last;
};
const edgeBetween = (u: number, v: number) => webEdges.findIndex((edge) => (edge.a === u && edge.b === v) || (edge.a === v && edge.b === u));

test("the wallpaper spider starts randomly beside threads and relocates after an explicit off-to-on toggle", () => {
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  assert.match(source, /const LEG_SWING_BY_PAIR = \[0, 2\.4, 4\.8, 7\.4, 14\]/);
  assert.match(source, /const LEG_TUCK_BY_PAIR = \[0, 0\.02, 0\.035, 0\.052, 0\.09\]/);
  assert.match(source, /const PROBE_SWING = 8\.5;/);
  assert.match(source, /const FIRST_PROBE_MIN_DELAY = 3;/);
  assert.match(source, /const FIRST_PROBE_MAX_DELAY = 7;/);
  assert.match(source, /LEG_SWING_BY_PAIR\[pair\]/);
  assert.match(source, /const BODY_BOB = 0\.006;/);
  assert.doesNotMatch(source, /STEP_CYCLE/);
  assert.match(source, /const PROBE_SWING =/);
  assert.match(source, /const PROBE_MIN_DELAY = 12;/);
  assert.match(source, /const PROBE_MAX_DELAY = 24;/);
  assert.match(source, /id === "L4" \|\| id === "R4"/);
  assert.doesNotMatch(source, /const front = id === "L1" \|\| id === "R1"/);
  assert.doesNotMatch(source, /const probing = !walking/);
  assert.match(source, /probeRemaining > 0/);
  assert.doesNotMatch(source, /TravelStage|TOUR_WALKS|fading-out|relocateWhileHidden/);
  assert.match(source, /let wasSpiderOn = spiderOn\(\)/);
  assert.match(source, /const turnedOn = !wasSpiderOn && enabled/);
  assert.match(source, /window\.crypto\.getRandomValues\(seedWords\)/);
  assert.doesNotMatch(source, /seeded\(41\)/);
  assert.match(source, /const THREAD_LANE_OFFSET = 30/);
  assert.match(source, /visibleNodes\(layer\.clientWidth, layer\.clientHeight, 90\)/);
  assert.match(source, /visibleNodes\(width, height, 90\)/);
  assert.match(source, /const relocateVisible[\s\S]*planSpawn/);
  assert.match(source, /if \(wasSpiderOn\) \{[\s\S]*relocateVisible\(\)/);
  assert.match(source, /if \(turnedOn\) \{[\s\S]*relocateVisible\(\)/);
  assert.match(source, /document\.hidden[\s\S]*cancelAnimationFrame\(frame\)/);
  assert.match(source, /element\.style\.opacity = "0"/);
  assert.match(source, /rest = 6 \+ rand\(\) \* 4/g);
  assert.ok(source.includes('attributeFilter: ["data-motion", "data-spider"]'));
  // The mode comes only from html[data-motion]; a missing attribute means full (D-10).
  assert.ok(!source.includes("matchMedia("));
  assert.ok(source.includes('const motionOn = () => root.dataset.motion !== "reduced" && root.dataset.motion !== "off";'));
});

test("D-25/D-26: the spider body and legs are dense dark outlined parts and the accent lives only in small details", () => {
  const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return styles.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  };
  const bodyRules = [".wallpaper-spider-dark", ".wallpaper-spider-limb", ".wallpaper-spider-pale"].map((selector) => [selector, rule(selector)] as const);
  for (const [selector, text] of bodyRules) {
    assert.match(text, /fill:\s*var\(--panel/, `${selector} is filled from the dark palette`);
    assert.doesNotMatch(text, /var\(--teal\)|currentColor/, `${selector} does not follow the accent`);
    assert.doesNotMatch(text, /opacity/, `${selector} is opaque`);
    assert.doesNotMatch(text, /color-mix/, `${selector} has no translucent mix`);
  }
  const stroke = rule(".wallpaper-spider :is(path, circle)");
  assert.match(stroke, /stroke:\s*#020706/, "body and legs carry a contour darker than the background");
  assert.doesNotMatch(stroke, /stroke:\s*none|opacity/);
  assert.doesNotMatch(rule(".wallpaper-spider"), /color:\s*var\(--teal\)|opacity:\s*0?\.\d/, "the spider wrapper does not tint its parts with the accent");
  const accent = rule(".wallpaper-spider .wallpaper-spider-accent");
  assert.match(accent, /fill:\s*var\(--teal\)/);
  assert.match(source, /className="wallpaper-spider-accent"/);
  assert.doesNotMatch(source, /wallpaper-spider-teal/, "the old solid accent segment class is gone");
  assert.doesNotMatch(styles, /wallpaper-spider-teal/);
});

test("the web stands still in every mode, with the spider shown or hidden (owner recall of the D-09 sway, quick 261102-d7r)", () => {
  const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");
  const wallpaper = readFileSync(new URL("../components/portia-wallpaper.tsx", import.meta.url), "utf8");
  assert.match(styles, /html\[data-spider="off"\] \.wallpaper-web-dew\s*\{[^}]*animation:\s*none !important;[^}]*opacity:\s*0 !important/);
  assert.match(styles, /html\[data-spider="off"\] \.wallpaper-web-pulses\s*\{[^}]*opacity:\s*0/);
  assert.doesNotMatch(styles, /wallpaper-web-drift|web-idle-drift/, "no sway layer, rule or keyframes anywhere in the stylesheet");
  assert.doesNotMatch(styles, /\.wallpaper-web\s*\{[^}]*animation/, "the web itself carries no animation rule (only its threads and dew draw in)");
  assert.doesNotMatch(wallpaper, /wallpaper-web-drift/);
  assert.match(wallpaper, /<WallpaperArt kind=\{value\} \/>\s*\n\s*\{value === "radar" \? <WallpaperSpider \/> : value === "gel" \? <WallpaperGelStrip \/> : null\}/);
});

test("the spider stays where it is, without waves and in a neutral pose, once motion leaves «Включены»", () => {
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  const branch = source.match(/if \(!motionOn\(\)\) \{([\s\S]*?)\n      \}/)?.[1] ?? "";
  assert.match(branch, /clearPulses\(\)/);
  assert.match(branch, /style\.rotate = "0deg"/);
  assert.match(branch, /style\.scale = "1"/);
  assert.match(branch, /legsNeutral = true/);
  assert.match(branch, /clean = true/);
  assert.doesNotMatch(branch, /relocateVisible/);
  assert.match(source, /const MAX_DT = 0\.05;/);
});

test("explicit show plans a distinct spawn with a route-derived pose", () => {
  const visible = Array.from({ length: 30 }, (_, index) => REST_NODE + index);
  const planned = planSpawn(visible, REST_NODE, seeded(9));
  assert.notEqual(planned.node, REST_NODE);
  assert.equal(planned.path[0], planned.node);
  assert.ok(planned.path.length > 1);
  assert.ok(Number.isFinite(planned.heading));
  assert.ok(planned.phase >= 0 && planned.phase < 1);
  const next = planSpawn(visible, planned.node, seeded(10));
  assert.notEqual(next.node, planned.node);
  assert.notDeepEqual([next.heading, next.phase], [planned.heading, planned.phase]);
});

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
  const duration = total / SPIDER_WALK_SPEED + 0.4 / SPIDER_MOTION_RATE;
  assert.ok(near([walkPose(path, 0).x, walkPose(path, 0).y], webGeometry.nodes[REST_NODE], 1e-6));
  assert.equal(walkPose(path, 0).done, false);
  assert.equal(walkPose(path, duration - 0.01).done, false);
  const end = walkPose(path, duration + 0.01);
  assert.equal(end.done, true);
  assert.ok(near([end.x, end.y], webGeometry.nodes[path[3]], 0.01));
  assert.ok(walkPose(path, 0.4 / SPIDER_MOTION_RATE).distance < (0.4 / SPIDER_MOTION_RATE) * SPIDER_WALK_SPEED);
  let last = -1;
  for (let step = 0; step <= 100; step += 1) {
    const pose = walkPose(path, (duration * step) / 100);
    assert.ok(pose.distance >= last, "distance never goes back");
    last = pose.distance;
    // Rounded turns stay on or immediately adjacent to the named thread.
    const best = distanceToEdge([pose.x, pose.y], pose.edge);
    assert.ok(best < 14, `step ${step} is ${best} off its thread`);
  }
  assert.ok(Math.abs(last - total) < 1e-6);
  // The whole travel timeline is 1.8x faster while gait remains distance-linked.
  assert.equal(SPIDER_MOTION_RATE, 1.8);
  for (let step = 0; step < 100; step += 1) {
    const a = walkPose(path, (duration * step) / 100), b = walkPose(path, (duration * (step + 1)) / 100);
    assert.ok((b.distance - a.distance) / (duration / 100) <= SPIDER_WALK_SPEED + 1e-6);
  }
});

test("walkPose rounds a crossing with continuous position and heading", () => {
  const path = [REST_NODE, REST_NODE + 1, REST_NODE + 19];
  const boundary = webEdges[edgeBetween(path[0], path[1])].length;
  let low = 0, high = 10;
  while (walkPose(path, high).distance < boundary) high *= 2;
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2;
    if (walkPose(path, mid).distance < boundary) low = mid; else high = mid;
  }
  const before = walkPose(path, low - 0.01), at = walkPose(path, (low + high) / 2), after = walkPose(path, high + 0.01);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 1.5);
  const angleDelta = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  assert.ok(angleDelta(before.heading, at.heading) < 0.15, "incoming heading blends into the turn");
  assert.ok(angleDelta(at.heading, after.heading) < 0.15, "turn blends into outgoing heading");
  assert.ok(Math.hypot(at.x - webGeometry.nodes[path[1]][0], at.y - webGeometry.nodes[path[1]][1]) > 0.1, "turn does not pivot on the crossing");
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

test("spawn selection is deterministic and excludes the previous visible spawn", () => {
  const visible = [10, 20, 30];
  assert.equal(selectSpawn(visible, 20, () => 0), 10);
  assert.equal(selectSpawn(visible, 20, () => 0.999), 30);
  assert.equal(selectSpawn([20], 20, () => 0.5), 20);
  assert.equal(selectSpawn([], 20, () => 0.5), REST_NODE);
});

test("gait phase is linked to distance and accelerates with the spider", () => {
  assert.equal(gaitPhase(0), 0);
  assert.ok(Math.abs(gaitPhase(10) - 0.5) < 1e-9);
  assert.equal(gaitPhase(20), 0);
  assert.ok(Math.abs(20 / SPIDER_WALK_SPEED - (20 / 36) / 1.8) < 1e-9);
  assert.equal(gaitPhase(20), gaitPhase(40));
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

test("the pulse pool never holds more than 8 and a pulse dies by 0.9 s", () => {
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
  stepPulses(single, 0.89);
  assert.equal(single.slots[0].alive, true);
  stepPulses(single, 0.91);
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
  const end = pulseShape(pulse, 0.9);
  assert.ok(Math.abs(end.opacity) < 1e-9);
  assert.ok(Math.abs(end.width - 1) < 1e-9);
});

test("a leg sweeps back on the ground, then springs forward past neutral and lands where the next stance starts", () => {
  assert.equal(legPose(0).swing, -1);
  assert.equal(legPose(0).tuck, 0);
  assert.ok(Math.abs(legPose(0.6).swing - 1) < 1e-9, "stance ends fully back");
  assert.ok(legPose(0.8).tuck > 0.9, "mid-swing the leg is tucked");
  const swing = Array.from({ length: 41 }, (_, i) => legPose(0.6 + i * 0.01).swing);
  assert.ok(Math.min(...swing) < -1.05, "the swing overshoots forward");
  assert.ok(Math.abs(legPose(0.99999).swing - legPose(0).swing) < 1e-3, "the cycle closes without a jump");
});

test("waves die out: with no new footfalls every slot is free again within 10 s, from any thread", () => {
  for (let edge = 0; edge < webEdges.length; edge += 1) {
    const pool = createPulsePool(8);
    emitPulse(pool, edge, 0, 1, 0.6, 0);
    emitPulse(pool, edge, webEdges[edge].length, -1, 0.6, 0);
    for (let now = 0; now <= 10; now += 1 / 60) stepPulses(pool, now);
    assert.equal(pool.slots.filter((slot) => slot.alive).length, 0, `edge ${edge} still has live pulses`);
  }
});

test("footfallThreads finds the nearest thread on each side of the body, strictly left and right of the heading", () => {
  const spoke = edgesAt(REST_NODE).find((index) => webEdges[index].kind === "spoke") as number;
  const [x0, y0] = webGeometry.nodes[REST_NODE];
  const other = webEdges[spoke].a === REST_NODE ? webGeometry.nodes[webEdges[spoke].b] : webGeometry.nodes[webEdges[spoke].a];
  const heading = Math.atan2(other[1] - y0, other[0] - x0);
  const x = x0 + Math.cos(heading + Math.PI / 2) * 30, y = y0 + Math.sin(heading + Math.PI / 2) * 30;
  const { left, right } = footfallThreads(x, y, heading, 120);
  assert.ok(left && right, "both sides have a thread within reach");
  for (const [side, found] of [[1, left], [-1, right]] as const) {
    assert.ok(found.at >= 0 && found.at <= webEdges[found.edge].length);
    const onThread = pointOnEdgeAt(found.edge, found.at);
    const cross = Math.cos(heading) * (onThread[1] - y) - Math.sin(heading) * (onThread[0] - x);
    assert.ok(cross * side > 0, `side ${side} thread lies on the ${side > 0 ? "left" : "right"} (${cross})`);
  }
  assert.ok(left.edge !== right.edge || left.at !== right.at, "the two sides are different points");
});

test("footfallThreads finds nothing for a point far outside the web", () => {
  assert.deepEqual(footfallThreads(-5000, -5000, 1.2, 120), { left: null, right: null });
});

test("a footfall wave is gone 0.9 s after it was born", () => {
  const pool = createPulsePool();
  emitPulse(pool, 0, 5, 1, 0.34, 2);
  stepPulses(pool, 2.89);
  assert.equal(pool.slots[0].alive, true);
  assert.ok(pulseShape(pool.slots[0], 2.9).opacity < 1e-9, "fully transparent at +0.9 s");
  stepPulses(pool, 2.901);
  assert.equal(pool.slots[0].alive, false);
});

test("each footfall of the spider waves the nearest thread on both sides of the body", () => {
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  assert.match(source, /footfallThreads\(/);
  assert.match(source, /emitPulse\(pool, side\.edge, side\.at, 1, STEP_PEAK, time\)/);
  assert.match(source, /emitPulse\(pool, side\.edge, side\.at, -1, STEP_PEAK, time\)/);
  assert.doesNotMatch(source, /emitPulse\(pool, pose\.edge/);
});

test("turnStep turns the short way, never faster than maxRate, and never overshoots", () => {
  // From +170 deg to -170 deg the short way is +20 deg (through pi), not -340.
  const from = (170 * Math.PI) / 180, to = (-170 * Math.PI) / 180;
  const step = turnStep(from, to, 1 / 60, 0.22, 3.5);
  assert.ok(step > from, "turns through pi");
  assert.ok(step - from <= 3.5 / 60 + 1e-12, "step is capped by maxRate * dt");
  // A big instant error is capped to maxRate * dt; the cap, not the filter, governs it.
  assert.ok(Math.abs(turnStep(0, Math.PI, 0.05, 0.001, 3.5) - 3.5 * 0.05) < 1e-12);
  let angle = 0;
  const target = 1.3;
  for (let frame = 0; frame < 600; frame += 1) {
    const next = turnStep(angle, target, 1 / 60, 0.22, 3.5);
    assert.ok(next <= target + 1e-12 && next >= angle, "monotone and never past the target");
    angle = next;
  }
  assert.ok(Math.abs(angle - target) < 1e-3, "converges");
  // A half turn takes no less than pi / maxRate seconds.
  let seconds = 0;
  angle = 0;
  while (Math.abs(angle - Math.PI) > 0.05 && seconds < 10) { angle = turnStep(angle, Math.PI, 1 / 60, 0.22, 3.5); seconds += 1 / 60; }
  assert.ok(seconds >= (Math.PI - 0.05) / 3.5 - 0.02, `a 180 degree turn took ${seconds}s`);
});

test("besideThread puts the lane point to the left (1) or right (-1) of the direction", () => {
  const left = besideThread(100, 100, 0, 1, 30), right = besideThread(100, 100, 0, -1, 30);
  assert.ok(near(left, [100, 130], 1e-9));
  assert.ok(near(right, [100, 70], 1e-9));
});

test("laneSideFor keeps the physical side of the thread when the direction turns by pi", () => {
  const offset = 30;
  const start = besideThread(500, 400, 0.4, 1, offset);
  assert.equal(laneSideFor(start[0], start[1], 500, 400, 0.4, offset), 1);
  assert.equal(laneSideFor(start[0], start[1], 500, 400, 0.4 + Math.PI, offset), -1, "reversed direction flips the sign, the physical side stays");
  const other = besideThread(500, 400, 0.4, -1, offset);
  assert.equal(laneSideFor(other[0], other[1], 500, 400, 0.4, offset), -1);
});

test("speed and leg swing are unchanged, and the spider only relocates on load and on show", () => {
  assert.equal(SPIDER_MOTION_RATE, 1.8);
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  assert.match(source, /const LEG_SWING_BY_PAIR = \[0, 2\.4, 4\.8, 7\.4, 14\]/);
  assert.equal(source.match(/relocateVisible\(\)/g)?.length, 2, "initial load and the turnedOn branch only");
  assert.match(source, /const MAX_TURN_RATE = 3\.5;/);
  assert.match(source, /turnStep\(angle, /);
  assert.match(source, /laneSideFor\(x, y, /);
});

test("laneTarget starts exactly on the body, blends into the lane over `blend` units, and degenerates to the lane at blend <= 0", () => {
  const start: Point = [11, -17];
  const pose = (distance: number) => ({ x: 400, y: 300, heading: 0.7, distance });
  assert.ok(near(laneTarget(pose(0), 1, 30, start, 60), [411, 283], 1e-9), "distance 0 = pose + start offset");
  for (const side of [1, -1]) {
    const lane = besideThread(400, 300, 0.7, side, 30);
    assert.ok(near(laneTarget(pose(60), side, 30, start, 60), lane, 1e-9));
    assert.ok(near(laneTarget(pose(500), side, 30, start, 60), lane, 1e-9));
    assert.ok(near(laneTarget(pose(0), side, 30, start, 0), lane, 1e-9), "blend 0 = lane at once");
  }
  const mid = laneTarget(pose(30), 1, 30, start, 60), lane = besideThread(400, 300, 0.7, 1, 30);
  assert.ok(near(mid, [(411 + lane[0]) / 2, (283 + lane[1]) / 2], 1e-9), "smoothstep is half way at half the distance");
});

test("followStep is the exponential follow: 1 - exp(-dt / settle) per axis, nothing at dt = 0", () => {
  const [x, y] = followStep(10, -4, 110, 96, 1 / 60, 0.16);
  const k = 1 - Math.exp(-1 / 60 / 0.16);
  assert.ok(Math.abs(x - (10 + 100 * k)) < 1e-12 && Math.abs(y - (-4 + 100 * k)) < 1e-12);
  assert.deepEqual(followStep(3, 4, 50, 60, 0, 0.16), [3, 4]);
});

// The body of tick() in miniature: route, lane follow, rest. `next` is the fixed scheme (lane blended into the acceleration, body eases to
// the rest point after the route); `previous` is the 18-05 scheme (lane jumps to the new thread at once, the body is copied to the target on arrival).
function simulateSpider(seed: number, scheme: "next" | "previous") {
  // The start check covers the straight run before the first corner: a lane point swinging round a sharp corner moves fast under either scheme (route geometry); the stop check likewise skips frames still turning into the final heading.
  const dt = 1 / 60, limit = 2 * SPIDER_WALK_SPEED * dt, blend = 60, offset = 30, settle = 0.16;
  const rand = seeded(seed), visible = visibleNodes(1440, 900, 90);
  let node = REST_NODE, previous = -1, [x, y] = webGeometry.nodes[REST_NODE];
  const violations: string[] = [];
  for (let route = 0; route < 3; route += 1) {
    const path = planWalk(node, previous, visible, rand);
    if (path.length < 2) continue;
    const first = walkPose(path, 0), side = laneSideFor(x, y, first.x, first.y, first.heading, offset);
    const laneStart: Point = [x - first.x, y - first.y];
    const steps: { step: number; distance: number; done: boolean; straight: boolean; heading: number }[] = [];
    let rest: Point = [x, y], walked = 0;
    for (let frame = 0; frame < 2000; frame += 1) {
      walked += dt;
      const pose = walkPose(path, walked);
      const target = scheme === "next" ? laneTarget(pose, side, offset, laneStart, blend) : besideThread(pose.x, pose.y, pose.heading, side, offset);
      const [nx, ny] = followStep(x, y, target[0], target[1], dt, settle);
      const [px, py] = [x, y];
      [x, y] = [nx, ny];
      if (pose.done) {
        rest = target;
        if (scheme === "previous") [x, y] = target;
      }
      steps.push({ step: Math.hypot(x - px, y - py), distance: pose.distance, done: pose.done, straight: Math.abs(pose.heading - first.heading) < 0.05, heading: pose.heading });
      if (pose.done) break;
    }
    const doneAt = steps.findIndex((entry) => entry.done);
    // The last snap onto the rest point (under 0.01 units) is the only step allowed to exceed 1.05 x the one before it.
    // Settling after the route: the next scheme keeps easing to the rest point, the previous one has already snapped.
    for (let frame = 0; frame < 60; frame += 1) {
      const [px, py] = [x, y];
      if (scheme === "next") {
        [x, y] = followStep(x, y, rest[0], rest[1], dt, settle);
        if (Math.hypot(rest[0] - x, rest[1] - y) < 0.01) [x, y] = rest;
      }
      steps.push({ step: Math.hypot(x - px, y - py), distance: Infinity, done: true, straight: false, heading: NaN });
    }
    steps.forEach((entry, index) => {
      if (entry.distance < blend && entry.straight && entry.step > limit) violations.push(`seed ${seed} route ${route}: start step ${entry.step.toFixed(2)} > ${limit.toFixed(2)}`);
      if (index >= doneAt - 10 && (index >= doneAt || Math.abs(entry.heading - steps[doneAt].heading) < 0.01) && entry.step > limit) violations.push(`seed ${seed} route ${route}: stop step ${entry.step.toFixed(2)} > ${limit.toFixed(2)}`);
      if (index > doneAt && entry.step > steps[index - 1].step * 1.05 + 0.01 + 1e-6) violations.push(`seed ${seed} route ${route}: step grows after the stop (${index - doneAt}: ${steps[index - 1].step} -> ${entry.step})`);
    });
    previous = path[path.length - 2]; node = path[path.length - 1];
  }
  return violations;
}

test("the body never jumps at the start of a route or at the stop; the previous scheme did (quick 261102-d7r)", () => {
  const seeds = Array.from({ length: 24 }, (_, index) => 101 + index * 7);
  const bad = seeds.flatMap((seed) => simulateSpider(seed, "next"));
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} violations`);
  const before = seeds.flatMap((seed) => simulateSpider(seed, "previous"));
  assert.ok(before.length > 0, "the same check must fail on the previous scheme, otherwise it proves nothing");
});

test("the spider tick uses the blended lane target and eases to the rest point instead of copying it", () => {
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  assert.match(source, /laneTarget\(/);
  assert.ok((source.match(/followStep\(/g)?.length ?? 0) >= 2, "route follow and the settle after the route");
  assert.match(source, /const LANE_BLEND_DISTANCE = 2 \* THREAD_LANE_OFFSET/);
  const done = source.match(/if \(pose\.done\) \{([\s\S]*?)\n        \}/)?.[1] ?? "";
  assert.ok(done.length > 0 && !/\bx = |\by = /.test(done), "the stop branch does not assign the target to the body");
  assert.match(done, /path = null/);
  assert.match(source, /const settled = [^;\n]*settleX/);
  assert.equal(source.match(/relocateVisible\(\)/g)?.length, 2);
  assert.match(source, /rest = 6 \+ rand\(\) \* 4/g);
  assert.equal(source.match(/rand\(\)/g)?.length, 11, "no rand() call added or removed: the seeded route sequence stays");
});

test("turnGate holds the route clock while the body is far off its heading and releases it smoothly (owner-delegated start of a route)", () => {
  assert.ok(Math.abs(turnGate(0) - 1) < 1e-9);
  assert.ok(Math.abs(turnGate(Math.PI / 3) - 1) < 1e-9);
  assert.ok(turnGate(Math.PI / 2) < 1e-9);
  assert.equal(turnGate(Math.PI), 0);
  assert.equal(turnGate(-Math.PI), 0);
  assert.ok(Math.abs(turnGate(0.9) - turnGate(-0.9)) < 1e-12, "symmetric");
  let last = 1;
  for (let turn = 0; turn <= Math.PI; turn += 0.01) { const gate = turnGate(turn); assert.ok(gate <= last + 1e-12 && gate >= 0 && gate <= 1, `monotone at ${turn}`); last = gate; }
  // A 180 degree turn at the capped rate releases the clock after about (pi - pi/2) / 3.5 s, not after the whole turn.
  let angle = 0, seconds = 0;
  while (turnGate(Math.PI - angle) < 1 && seconds < 3) { angle = turnStep(angle, Math.PI, 1 / 60, 0.22, 3.5); seconds += 1 / 60; }
  assert.ok(seconds > 0.4 && seconds < 1, `the clock is fully released after ${seconds.toFixed(2)}s`);
});

test("the spider steps its legs while it turns, the route clock is gated by the turn, and the pauses stay 6-10 s", () => {
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  assert.match(source, /walked \+= dt \* turnGate\(turn\)/);
  assert.match(source, /gaitDistance \+= turnTravel/);
  assert.match(source, /\(walking \|\| Math\.abs\(turn\) > TURN_STEP_MIN \? 1 : 0\) - gait/);
  assert.match(source, /const turned = turnStep\(angle, /);
  assert.equal(source.match(/rest = 6 \+ rand\(\) \* 4/g)?.length, 2, "pauses between routes are unchanged");
});

// D-45: the spider at rest must not be blurred. A resting transform is a pure string: a shift on the device-pixel grid, the rotation, no scale().
type SpiderTransformInput = { dx: number; dy: number; angleDeg: number; bob: number; dpr: number; resting: boolean };
const spiderTransform = (input: SpiderTransformInput) => (web as unknown as { spiderTransform?: (input: SpiderTransformInput) => string }).spiderTransform?.(input);

test("D-45 spiderTransform snaps a resting shift to the device pixel grid and drops scale()", () => {
  assert.equal(spiderTransform({ dx: 10.37, dy: -3.21, angleDeg: 12.345, bob: 1, dpr: 2, resting: true }), "translate(10.5px, -3px) rotate(12.35deg)");
  assert.equal(spiderTransform({ dx: -381.53, dy: 404.37, angleDeg: -154.41, bob: 1.0123, dpr: 1, resting: true }), "translate(-382px, 404px) rotate(-154.41deg)");
  const snapped = spiderTransform({ dx: -165.05, dy: 89.17, angleDeg: -164.97, bob: 1, dpr: 2.625, resting: true })!;
  const [, x, y] = snapped.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!.map(Number);
  assert.ok(Math.abs(x * 2.625 - Math.round(x * 2.625)) < 1e-3 && Math.abs(y * 2.625 - Math.round(y * 2.625)) < 1e-3, `${snapped} is on the 1/2.625 grid`);
  assert.doesNotMatch(snapped, /scale/);
});

test("D-45 spiderTransform keeps the walking form: two-decimal shifts and a four-decimal scale", () => {
  assert.equal(spiderTransform({ dx: 10.37, dy: -3.21, angleDeg: 12.345, bob: 1.0123, dpr: 2, resting: false }), "translate(10.37px, -3.21px) rotate(12.35deg) scale(1.0123)");
});

test("D-45 spiderTransform counts a missing or non-positive device pixel ratio as 1 and is pure", () => {
  for (const dpr of [Number.NaN, 0, -2, Number.POSITIVE_INFINITY]) {
    assert.equal(spiderTransform({ dx: 10.37, dy: -3.21, angleDeg: 0, bob: 1, dpr, resting: true }), "translate(10px, -3px) rotate(0.00deg)", `dpr ${dpr}`);
  }
  const input = { dx: 5.55, dy: 6.66, angleDeg: 7.77, bob: 1.002, dpr: 1.25, resting: true };
  assert.equal(spiderTransform(input), spiderTransform({ ...input }));
});

test("D-45 the spider builds every transform through spiderTransform and promotes its layer only while it walks", () => {
  const source = readFileSync(new URL("../components/portia-wallpaper-spider.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok((source.match(/spiderTransform\(/g) ?? []).length >= 3, "relocate, the walking frame and the outside-«Включены» branch");
  assert.doesNotMatch(source, /style\.transform = `translate/, "no hand-built transform string is left");
  assert.match(source, /resting: true/);
  assert.match(source, /resting: false|resting: settled/);
  assert.match(source, /devicePixelRatio/);
  const tick = source.match(/const tick = \(now: number\) => \{([\s\S]*?)const motionOn/)?.[1] ?? "";
  assert.ok(tick.length > 500, "tick body found");
  assert.doesNotMatch(tick, /devicePixelRatio/, "the ratio is read on mount and in the resize observer, not on every frame");
  // The base rule carries no will-change; the compositor layer exists only while the spider walks (data-spider-walking).
  assert.doesNotMatch(styles.match(/(?:^|\n)\.wallpaper-spider \{([^}]*)\}/)?.[1] ?? "", /will-change/);
  assert.match(styles, /\.wallpaper-spider\[data-spider-walking\]\s*\{[^}]*will-change:\s*transform/);
  assert.match(source, /data-spider-walking|spiderWalking|dataset\.spiderWalking/);
  // A forwards fill of the fade-in keeps the element a composited, resampled layer for good: the fade only needs to hold the start while it waits.
  assert.doesNotMatch(styles, /html\[data-motion="full"\] \.wallpaper-spider \{ animation: fade-in 600ms ease-out 1\.8s both; \}/);
  assert.match(styles, /html\[data-motion="full"\] \.wallpaper-spider \{ animation: fade-in 600ms ease-out 1\.8s backwards; \}/);
});
