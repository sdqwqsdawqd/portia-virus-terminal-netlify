import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const upload = readFileSync(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");

test("every response receives baseline browser hardening without blocking approved embeds and HTTPS media", () => {
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(source.includes(`key: "${header}"`), header);
  }
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /object-src 'none'/);
  assert.match(source, /img-src 'self' data: blob: https:/);
  assert.match(source, /frame-src https:\/\/docs\.google\.com https:\/\/sdqwqsdawqd\.github\.io/);
});

test("public UUID uploads are immutable-cached and verified by file signature", () => {
  assert.match(upload, /imageExtensionFromSignature/);
  assert.match(upload, /cacheControl: "31536000"/);
  assert.match(upload, /detectedExtension !== declaredExtension/);
});
