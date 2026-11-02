import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedMediaUrl, isLocalMediaPath } from "./media-url.ts";

const local = ["/", "/a/b.png", "/%2F/x", "/assets/portia-logo.png"];
const notLocal = ["//host/x.png", "/\\host/x.png", "/\t/host", "/a\nb", "/a\u007fb", "/a\u0000b", "", "x.png", "https://x/y.png"];

test("isLocalMediaPath accepts one-slash paths", () => {
  for (const url of local) assert.equal(isLocalMediaPath(url), true, url);
});

test("isLocalMediaPath rejects protocol-relative, backslash and control-character paths (CONT-09)", () => {
  for (const url of notLocal) assert.equal(isLocalMediaPath(url), false, JSON.stringify(url));
});

test("isAllowedMediaUrl takes https and local paths only", () => {
  for (const url of ["https://x/y.png", ...local]) assert.equal(isAllowedMediaUrl(url), true, url);
  for (const url of ["http://x/y.png", "javascript:alert(1)", "//host/x.png", "/\\host/x.png", ""]) {
    assert.equal(isAllowedMediaUrl(url), false, url);
  }
});

test("isAllowedMediaUrl rejects control characters anywhere, https included (STAB-MEDIA-02)", () => {
  for (const url of ["https://\n/x", "https://x/\ty.png", "https://x/y\u0000", "https://x/y\u007f"]) {
    assert.equal(isAllowedMediaUrl(url), false, JSON.stringify(url));
  }
  assert.equal(isAllowedMediaUrl("https://cdn.example/x.png"), true);
  assert.equal(isAllowedMediaUrl("http://x"), false);
  assert.equal(isAllowedMediaUrl("//host/x"), false);
});

// The photo_url rule of the baseline migration, quoted verbatim: the test fails if the migration changes it.
const sqlRule = "photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\\\[:cntrl:]][^[:cntrl:]]*)?$'";

// JS translation of sqlRule, kept by hand next to it.
const sqlAccepts = (url: string) => url === "" || url.startsWith("https://") || /^\/([^/\\\x00-\x1f\x7f][^\x00-\x1f\x7f]*)?$/.test(url);

test("photo_url SQL rule is still the one this file translates", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261101000000_portia_baseline.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(sql.includes(`check (${sqlRule}) not valid;`));
});

test("isAllowedMediaUrl answers like the SQL rule, except where it is stricter", () => {
  const shared = ["", "https://cdn.example/x.png", "http://x/y.png", "javascript:alert(1)", "/", "/a/b.png", "//host/x.png", "/\host/x.png", "/a\nb", "x.png"];
  // An empty photo_url means "no photo": the SQL accepts it, isAllowedMediaUrl does not, normalisation falls back.
  for (const url of shared) assert.equal(isAllowedMediaUrl(url) || url === "", sqlAccepts(url), JSON.stringify(url));
  // Stricter than SQL: control characters after https://. Browsers drop them anyway; the gap only ever refuses more.
  for (const url of ["https://\n/x", "https://x/\ty", "https://x/y\u0000"]) {
    assert.equal(sqlAccepts(url), true, JSON.stringify(url));
    assert.equal(isAllowedMediaUrl(url), false, JSON.stringify(url));
  }
});
