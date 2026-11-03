import test from "node:test";
import assert from "node:assert/strict";
import { cacheMatchesSource, deviceCacheSource, stampCacheSource } from "./device-cache.ts";

test("the device cache source is the public Supabase URL, normalized", () => {
  assert.equal(deviceCacheSource({ NEXT_PUBLIC_SUPABASE_URL: " https://ABC.supabase.co/ " }), "https://abc.supabase.co");
  assert.equal(deviceCacheSource({}), "");
});

test("a copy saved from another data source is never shown (owner UAT 19-14: production copy hid staging content)", () => {
  const staging = "https://staging.supabase.co";
  assert.equal(cacheMatchesSource({ source: staging, revision: 3 }, staging), true);
  assert.equal(cacheMatchesSource({ source: "https://production.supabase.co", revision: 9000 }, staging), false);
  // A copy written before the source stamp existed cannot prove where it came from.
  assert.equal(cacheMatchesSource({ revision: 9000 }, staging), false);
  assert.equal(cacheMatchesSource(null, staging), false);
  assert.equal(cacheMatchesSource("junk", staging), false);
  // Without a configured source nothing is trusted.
  assert.equal(cacheMatchesSource({ source: "" }, ""), false);
});

test("stampCacheSource adds the source to what is written", () => {
  assert.deepEqual(stampCacheSource({ revision: 4 }, "https://s.supabase.co"), { revision: 4, source: "https://s.supabase.co" });
});
