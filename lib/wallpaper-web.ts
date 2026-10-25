// Pure geometry and walking maths for the spider on the «Паутина» wallpaper (RED stub: behaviour comes with the tests).

export type Point = [number, number];
export type Edge = { a: number; b: number; kind: "spoke" | "ring"; length: number };
export type WalkPose = { x: number; y: number; heading: number; done: boolean; edge: number; at: number; forward: boolean; distance: number };

export function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

export const webGeometry = { center: [1180, 170] as Point, angles: [] as number[], spokeEnds: [] as Point[], nodes: [] as Point[], sags: [] as Point[] };
export const webEdges: Edge[] = [];
export const REST_NODE = 0;

export function edgesAt(_node: number): number[] {
  return [];
}

export function pointOnEdge(_edge: Edge, _t: number): Point {
  return [0, 0];
}

export function walkPose(_path: number[], _elapsed: number): WalkPose {
  return { x: 0, y: 0, heading: 0, done: true, edge: 0, at: 0, forward: true, distance: 0 };
}
