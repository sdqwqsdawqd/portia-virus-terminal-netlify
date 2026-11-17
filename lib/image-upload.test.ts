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
  // The upload branch alone had 7; rewrite and delete add theirs. Every one of them carries noStoreHeaders.
  assert.ok(responses >= 13, `upload, rewrite and delete answers are all counted (${responses})`);
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

// The text of one top-level function: from its declaration to the closing brace at column 0.
const functionBody = (declaration: string) => {
  const start = route.indexOf(declaration);
  assert.ok(start > -1, `${declaration} exists`);
  const end = route.indexOf("\n}\n", start);
  return route.slice(start, end === -1 ? undefined : end + 3);
};

test("T-25-08: POST and DELETE ask the shared editor gate before any body is read (rewrite, delete, upload)", () => {
  for (const declaration of ["export async function POST(", "export async function DELETE("]) {
    const body = functionBody(declaration);
    const gate = body.indexOf("editorGate(");
    assert.ok(gate > -1, `${declaration} asks the shared gate`);
    for (const read of ["request.formData()", "request.text()", "request.json()", "parseLimitedJsonObject(", "rewriteImage("]) {
      const at = body.indexOf(read);
      assert.ok(at === -1 || gate < at, `${declaration} the gate comes before ${read}`);
    }
  }
  assert.ok(!/request\.(text|json)\(\)/.test(route), "a body is read only through the bounded reader");
  const shared = functionBody("async function editorGate(");
  assert.ok(shared.indexOf("getEditorAccess(") > -1 && shared.indexOf("getEditorAccess(") < shared.indexOf("uploadGate("), "session first, then the size");
  assert.ok(!/service[_-]?role/i.test(route), "the session client does the copy and the delete (D-12)");
});

test("T-25-06: the address is parsed against the site host before copy or remove", () => {
  assert.ok((route.match(/parsePortiaMediaUrl\(/g)?.length ?? 0) >= 2);
  assert.ok(route.includes("process.env.NEXT_PUBLIC_SUPABASE_URL"));
  const rewrite = functionBody("async function rewriteImage(");
  assert.ok(rewrite.indexOf("parsePortiaMediaUrl(") > -1 && rewrite.indexOf("parsePortiaMediaUrl(") < rewrite.indexOf(".copy("), "parsed before .copy(");
  assert.match(rewrite, /`recycle\/\$\{crypto\.randomUUID\(\)\}\.\$\{parsed\.ext\}`/, "the copy gets a fresh random name with the source extension");
  assert.ok(rewrite.includes("mediaRewriteRefusal.url") && rewrite.includes("status: 400"));
  const remove = functionBody("export async function DELETE(");
  assert.ok(remove.indexOf("parsePortiaMediaUrl(") > -1 && remove.indexOf("parsePortiaMediaUrl(") < remove.indexOf(".remove("), "parsed before .remove(");
});

test("T-25-07 (D-13): DELETE reads the stored content and the employee photos before .remove(); 409 when referenced, 503 when unknown", () => {
  const body = functionBody("export async function DELETE(");
  const content = body.indexOf('from("portia_content")');
  const profiles = body.indexOf('from("portia_employee_profiles")');
  const remove = body.indexOf(".remove(");
  assert.ok(content > -1 && profiles > -1 && remove > -1);
  assert.ok(content < remove && profiles < remove, "references are read before the file is removed");
  assert.ok(body.includes("status: 409") && body.includes("mediaRewriteRefusal.inUse") && body.includes('"media-in-use"'));
  assert.ok(body.includes("status: 503"), "a failed read is 503");
  assert.ok(body.indexOf("status: 503") < remove && body.indexOf("status: 409") < remove, "both refusals come before .remove()");
  assert.ok(route.includes("D-13"), "the one-way reason is written next to the handler");
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
