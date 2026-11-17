// D-43: the search shows a random 5-10 of the editor's non-empty recommendations, chosen once per page load.
// Pure and DOM-free: the random source is injected, so a fixed seed gives a fixed, testable choice.

const MIN_SHOWN = 5;
const MAX_SHOWN = 10;

// mulberry32: a small seedable generator over a uint32; values fall in [0, 1).
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A uint32 from the platform crypto; without it the clock stands in. Call it on the client after mount only, so the server and the first client render agree.
export function newRecommendationSeed(): number {
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.getRandomValues === "function") return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
  return Date.now() >>> 0;
}

// Original indexes of the chosen non-empty lines, ascending (the editor's order). Fewer than five non-empty lines: all of them.
export function pickSearchRecommendations(items: readonly string[], random: () => number): number[] {
  const filled = items.flatMap((item, index) => item.trim() ? [index] : []);
  if (filled.length < MIN_SHOWN) return filled;
  const cap = Math.min(MAX_SHOWN, filled.length);
  const count = MIN_SHOWN + Math.floor(random() * (cap - MIN_SHOWN + 1));
  // Partial Fisher-Yates: the first `count` slots end up a uniform sample.
  for (let slot = 0; slot < count; slot += 1) {
    const other = slot + Math.floor(random() * (filled.length - slot));
    [filled[slot], filled[other]] = [filled[other], filled[slot]];
  }
  return filled.slice(0, count).sort((a, b) => a - b);
}
