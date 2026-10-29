import test from "node:test";
import assert from "node:assert/strict";
import { imageExtensionFromSignature } from "./image-upload.ts";

test("uploaded images are identified by bytes rather than the browser supplied MIME type", () => {
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(imageExtensionFromSignature(new TextEncoder().encode("GIF89a")), "gif");
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "webp");
  assert.equal(imageExtensionFromSignature(new TextEncoder().encode("<script>alert(1)</script>")), null);
});
