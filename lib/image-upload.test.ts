import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as imageUpload from "./image-upload.ts";
import { imageExtensionFromSignature, MAX_UPLOAD_BYTES, uploadRefusal } from "./image-upload.ts";

const route = readFileSync(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");

test("uploaded images are identified by bytes rather than the browser supplied MIME type", () => {
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(imageExtensionFromSignature(new TextEncoder().encode("GIF89a")), "gif");
  assert.equal(imageExtensionFromSignature(new TextEncoder().encode("GIF87a")), "gif");
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "webp");
  assert.equal(imageExtensionFromSignature(new TextEncoder().encode("<script>alert(1)</script>")), null);
});

test("short or truncated buffers are refused (T-19-03)", () => {
  assert.equal(imageExtensionFromSignature(new Uint8Array()), null);
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0x89, 0x50, 0x4e])), null);
  // RIFF without the WEBP tag at offset 8 (11 bytes and a WAVE container).
  assert.equal(imageExtensionFromSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42])), null);
  assert.equal(imageExtensionFromSignature(new TextEncoder().encode("RIFF\0\0\0\0WAVE")), null);
});

test("refusal texts are the fixed Russian catalogue and the limit is unchanged (D-16)", () => {
  assert.equal(MAX_UPLOAD_BYTES, 4194304);
  assert.deepEqual(uploadRefusal, {
    forbidden: "У вас нет доступа к загрузке.",
    missing: "Файл не выбран.",
    format: "Поддерживаются PNG, JPG, WEBP и GIF.",
    size: "Файл должен быть меньше 4 МБ.",
    signature: "Содержимое файла не соответствует формату изображения.",
    server: "Не удалось загрузить изображение.",
    network: "Нет связи с сервером. Файл не загружен, текущая ссылка сохранена.",
  });
});

test("every /api/uploads response is no-store and the gate runs before the body is parsed (T-19-04, WR-03)", () => {
  const responses = route.match(/Response\.json\(/g)?.length ?? 0;
  assert.equal(responses, 7);
  assert.equal(route.match(/headers: noStoreHeaders/g)?.length, responses);
  assert.ok((route.match(/uploadRefusal\./g)?.length ?? 0) >= 5);
  assert.ok(route.includes("file.size > MAX_UPLOAD_BYTES"));
  assert.ok(!route.includes("4 * 1024 * 1024"));
  assert.ok(route.includes("isAuthRetryableFetchError"));
  const gate = route.indexOf("uploadGate(");
  const parse = route.indexOf("request.formData()");
  assert.ok(gate > -1 && parse > -1 && gate < parse, "uploadGate decides before request.formData()");
  assert.ok(route.indexOf("getEditorAccess(") < gate);
});

const editorAccess = { canEdit: true, openTabs: ["viruses"] };
const gate = (input: Partial<{ authRetryable: boolean; user: unknown; access: unknown; contentLength: string | null }> = {}) =>
  (imageUpload as unknown as { uploadGate: (args: unknown) => { status: number; error: string } | null }).uploadGate({
    authRetryable: false,
    user: { id: "u" },
    access: editorAccess,
    contentLength: null,
    ...input,
  });

test("uploadGate: a retryable auth failure is 503 server, not a false 403 (WR-03)", () => {
  assert.deepEqual(gate({ authRetryable: true, user: null, access: null }), { status: 503, error: uploadRefusal.server });
});

test("uploadGate: unavailable or missing access is 503 server (WR-03)", () => {
  assert.deepEqual(gate({ access: { ...editorAccess, unavailable: true } }), { status: 503, error: uploadRefusal.server });
  assert.deepEqual(gate({ access: null }), { status: 503, error: uploadRefusal.server });
});

test("uploadGate: no user, no canEdit or no open tab is still 403 forbidden (WR-03)", () => {
  const forbidden = { status: 403, error: uploadRefusal.forbidden };
  assert.deepEqual(gate({ user: null }), forbidden);
  assert.deepEqual(gate({ access: { canEdit: false, openTabs: ["viruses"] } }), forbidden);
  assert.deepEqual(gate({ access: { canEdit: true, openTabs: [] } }), forbidden);
});

test("uploadGate: a declared Content-Length above the limit plus the multipart envelope is 413 before parsing (WR-03)", () => {
  assert.deepEqual(gate({ contentLength: "5000000" }), { status: 413, error: uploadRefusal.size });
  assert.equal(gate({ contentLength: String(MAX_UPLOAD_BYTES) }), null);
  assert.equal(gate({ contentLength: String(MAX_UPLOAD_BYTES + 64 * 1024) }), null);
  assert.deepEqual(gate({ contentLength: String(MAX_UPLOAD_BYTES + 64 * 1024 + 1) }), { status: 413, error: uploadRefusal.size });
});

test("uploadGate: a missing or non-numeric Content-Length passes to the file.size check (WR-03)", () => {
  assert.equal(gate({ contentLength: null }), null);
  assert.equal(gate({ contentLength: "abc" }), null);
  assert.equal(gate({ contentLength: "" }), null);
});

test("uploadGate: order is auth failure, then permission, then size (WR-03)", () => {
  assert.equal(gate({ authRetryable: true, contentLength: "999999999" })?.status, 503);
  assert.equal(gate({ user: null, contentLength: "999999999" })?.status, 403);
});

test("uploads get a fresh immutable path and never read the content revision (STAB-MEDIA-01/04)", () => {
  assert.match(route, /`recycle\/\$\{crypto\.randomUUID\(\)\}\.\$\{detectedExtension\}`/);
  assert.ok(route.includes("upsert: false"));
  assert.ok(route.includes('cacheControl: "31536000"'));
  assert.ok(route.includes("getPublicUrl(path)"));
  assert.ok(!/revision/i.test(route));
});
