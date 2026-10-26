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
