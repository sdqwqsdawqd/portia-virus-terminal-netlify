import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMPRESS_MAX_SIDE, COMPRESS_SKIP_BYTES, compressImageForUpload, compressionPlan, pickEncoded } from "./image-compress.ts";

const MB = 1024 * 1024;

test("compressionPlan: GIF and unknown types are never touched", () => {
  assert.equal(compressionPlan({ type: "image/gif", size: 3 * MB }, { width: 4000, height: 3000 }), null);
  assert.equal(compressionPlan({ type: "image/svg+xml", size: 3 * MB }, { width: 4000, height: 3000 }), null);
});

test("compressionPlan: a small picture that already fits is sent as is", () => {
  assert.equal(compressionPlan({ type: "image/png", size: COMPRESS_SKIP_BYTES }, { width: 800, height: 600 }), null);
  assert.equal(compressionPlan({ type: "image/jpeg", size: 1000 }, { width: COMPRESS_MAX_SIDE, height: 10 }), null);
});

test("compressionPlan: a heavy picture that fits is re-encoded at its own size", () => {
  assert.deepEqual(compressionPlan({ type: "image/png", size: 2 * MB }, { width: 1200, height: 900 }), { width: 1200, height: 900 });
});

test("compressionPlan: the long side is cut to the limit and the proportions are kept", () => {
  assert.deepEqual(compressionPlan({ type: "image/jpeg", size: 3 * MB }, { width: 4032, height: 3024 }), { width: 2048, height: 1536 });
  assert.deepEqual(compressionPlan({ type: "image/jpeg", size: 100 }, { width: 3024, height: 4032 }), { width: 1536, height: 2048 });
  assert.deepEqual(compressionPlan({ type: "image/webp", size: 100 }, { width: 10000, height: 1 }), { width: 2048, height: 1 });
});

test("compressionPlan: a broken size sends the original", () => {
  assert.equal(compressionPlan({ type: "image/png", size: 3 * MB }, { width: 0, height: 100 }), null);
  assert.equal(compressionPlan({ type: "image/png", size: 3 * MB }, { width: Number.NaN, height: 100 }), null);
});

test("pickEncoded: only a smaller real WebP, or JPEG for a JPEG source, replaces the original", () => {
  const png = { type: "image/png", size: 2 * MB };
  const jpeg = { type: "image/jpeg", size: 2 * MB };
  assert.equal(pickEncoded(png, { type: "image/webp", size: 300_000 }), "encoded");
  assert.equal(pickEncoded(png, { type: "image/webp", size: 3 * MB }), "original");
  assert.equal(pickEncoded(png, { type: "image/png", size: 300_000 }), "original");
  assert.equal(pickEncoded(png, { type: "image/jpeg", size: 300_000 }), "original");
  assert.equal(pickEncoded(jpeg, { type: "image/jpeg", size: 300_000 }), "encoded");
  assert.equal(pickEncoded(jpeg, { type: "image/webp", size: 0 }), "original");
  assert.equal(pickEncoded(jpeg, null), "original");
});

test("compressImageForUpload: without a browser the original file comes back", async () => {
  const file = new File([new Uint8Array(10)], "a.png", { type: "image/png" });
  assert.equal(await compressImageForUpload(file), file);
});

test("the editor compresses before it builds the upload body", () => {
  const editor = readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8");
  const start = editor.indexOf("const uploadImage = async");
  const compress = editor.indexOf("compressImageForUpload(", start);
  const send = editor.indexOf('fetch("/api/uploads"', start);
  assert.ok(start > 0 && compress > start && compress < send, "compression runs inside uploadImage before the request");
});
