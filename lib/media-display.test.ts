import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA_SLOW_MS, mediaLoadingAttrs, mediaSource, visibleTimerRunning } from "./media-display.ts";

test("visible media alone runs its pending timeout", () => {
  assert.equal(visibleTimerRunning("loading", true), true);
  assert.equal(visibleTimerRunning("loading", false), false);
  assert.equal(visibleTimerRunning("loaded", true), false);
  assert.equal(visibleTimerRunning("failed", true), false);
});

test("mediaSource sends empty and disallowed URLs straight to the placeholder (no request)", () => {
  for (const bad of ["", undefined, "   ", "javascript:alert(1)", "data:image/png;base64,AAAA", "//host/a.png", "/\\host/a.png", "http://a/b.png", "https://a/\nb.png", "/\t/host/a.png"]) {
    assert.deepEqual(mediaSource(bad), { kind: "placeholder" }, String(bad));
  }
});

test("mediaSource passes the exact trimmed string through, without re-encoding", () => {
  assert.deepEqual(mediaSource(" https://a/b.png "), { kind: "image", src: "https://a/b.png" });
  assert.deepEqual(mediaSource("/assets/portia-logo.png"), { kind: "image", src: "/assets/portia-logo.png" });
  const cyrillic = "https://example.org/изображение%20один.png?x=1&y=%D0%B0";
  assert.deepEqual(mediaSource(cyrillic), { kind: "image", src: cyrillic });
});

test("mediaLoadingAttrs separates the active hero from collections", () => {
  assert.deepEqual(mediaLoadingAttrs("hero"), { loading: "eager", decoding: "async", fetchPriority: "high" });
  assert.deepEqual(mediaLoadingAttrs("lazy"), { loading: "lazy", decoding: "async", fetchPriority: "auto" });
});

test("a slow image gives up after 15 seconds", () => {
  assert.equal(MEDIA_SLOW_MS, 15000);
});
