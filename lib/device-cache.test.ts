import test from "node:test";
import assert from "node:assert/strict";
import { CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY, cacheMatchesSource, cacheMatchesViewer, clearDeviceContentCaches, deviceCacheSource, stampCacheSource } from "./device-cache.ts";

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

test("LVL-05: a content copy is shown only when its viewer key equals the gate's key", () => {
  assert.equal(cacheMatchesViewer({ viewer: "level-2" }, "level-2"), true);
  assert.equal(cacheMatchesViewer({ viewer: "level-3" }, "level-2"), false);
  assert.equal(cacheMatchesViewer({ viewer: "editor" }, "level-5"), false);
  // A copy without a viewer key cannot prove whose level it is.
  assert.equal(cacheMatchesViewer({}, "level-2"), false);
  assert.equal(cacheMatchesViewer({ viewer: "" }, ""), false);
  assert.equal(cacheMatchesViewer({ viewer: "level-2" }, ""), false);
  assert.equal(cacheMatchesViewer(null, "level-2"), false);
  assert.equal(cacheMatchesViewer("junk", "level-2"), false);
});

test("D-21: clearing removes both device copies and survives a storage that throws", () => {
  const removed: string[] = [];
  clearDeviceContentCaches(() => ({ removeItem: (key: string) => void removed.push(key) }));
  assert.deepEqual(removed, [CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY]);
  assert.equal(CONTENT_CACHE_KEY, "portia-content-last-success-v1");
  assert.equal(EMPLOYEES_CACHE_KEY, "portia-employees-last-success-v1");

  const partial: string[] = [];
  clearDeviceContentCaches(() => ({
    removeItem: (key: string) => {
      if (key === CONTENT_CACHE_KEY) throw new Error("blocked");
      partial.push(key);
    },
  }));
  assert.deepEqual(partial, [EMPLOYEES_CACHE_KEY]);

  assert.doesNotThrow(() => clearDeviceContentCaches(() => { throw new Error("no storage"); }));
});
