import test from "node:test";
import assert from "node:assert/strict";
import * as recommendations from "./search-recommendations.ts";

type Api = {
  seededRandom: (seed: number) => () => number;
  newRecommendationSeed: () => number;
  pickSearchRecommendations: (items: readonly string[], random: () => number) => number[];
};
// Reached through the namespace so a missing export fails a test, not the module link.
const api = recommendations as unknown as Api;

const lines = (count: number) => Array.from({ length: count }, (_, index) => `рекомендация ${index}`);
const pick = (items: readonly string[], seed: number) => api.pickSearchRecommendations(items, api.seededRandom(seed));

test("D-43 seededRandom gives one sequence per seed, inside [0, 1), and different seeds differ", () => {
  const a = api.seededRandom(7);
  const b = api.seededRandom(7);
  const first = Array.from({ length: 20 }, () => a());
  assert.deepEqual(first, Array.from({ length: 20 }, () => b()));
  for (const value of first) assert.ok(value >= 0 && value < 1, String(value));
  assert.notEqual(api.seededRandom(1)(), api.seededRandom(2)());
});

test("D-43 an empty list picks nothing; fewer than five non-empty lines are all shown; blank lines are not counted", () => {
  assert.deepEqual(pick([], 1), []);
  assert.deepEqual(pick(lines(3), 1), [0, 1, 2]);
  assert.deepEqual(pick(["а", "  ", "", "б", "в"], 9), [0, 3, 4]);
});

test("D-43 exactly five non-empty lines are all shown", () => {
  assert.deepEqual(pick(lines(5), 3), [0, 1, 2, 3, 4]);
});

test("D-43 seven lines give five to seven distinct indexes, twenty-five give five to ten", () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const seven = pick(lines(7), seed);
    assert.ok(seven.length >= 5 && seven.length <= 7, `${seed}: ${seven.length}`);
    assert.equal(new Set(seven).size, seven.length);
    const many = pick(lines(25), seed);
    assert.ok(many.length >= 5 && many.length <= 10, `${seed}: ${many.length}`);
    assert.equal(new Set(many).size, many.length);
  }
});

test("D-43 the result is the original indexes in ascending order (editor order), stable for one seed", () => {
  const items = ["", ...lines(24)];
  for (let seed = 1; seed <= 30; seed += 1) {
    const result = pick(items, seed);
    assert.deepEqual(result, [...result].sort((x, y) => x - y));
    assert.ok(!result.includes(0), "the blank line is never picked");
    assert.deepEqual(result, pick(items, seed));
  }
});

test("D-43 across 200 seeds on 25 lines both the smallest and the largest size, and many different sets, appear", () => {
  const sizes = new Set<number>();
  const sets = new Set<string>();
  for (let seed = 1; seed <= 200; seed += 1) {
    const result = pick(lines(25), seed);
    sizes.add(result.length);
    sets.add(result.join(","));
  }
  assert.ok(sizes.has(5), "size 5 appears");
  assert.ok(sizes.has(10), "size 10 appears");
  assert.ok(sets.size >= 20, `${sets.size} different sets`);
});

test("D-43 newRecommendationSeed returns an unsigned 32-bit integer", () => {
  const seed = api.newRecommendationSeed();
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, String(seed));
});
