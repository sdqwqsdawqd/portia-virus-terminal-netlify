// Source-level tests of the access-level placeholder surfaces (Phase 24, plan 24-02): the component forms, the exact placeholder
// string and the CSS block. The browser, the live roles and the physical devices stay BLOCKED until plan 24-11 proves them;
// nothing here claims them. Plans 24-06, 24-09 and 24-10 append their own checks below.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { lf } from "./component-source.ts";
import { levelCopy } from "./level-copy.ts";

const componentsDir = new URL("../components/", import.meta.url);

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const componentSource = (name: string) => stripComments(lf(readFileSync(new URL(name, componentsDir), "utf8")));

const redacted = componentSource("portia-redacted.tsx");

test("D-08 the placeholder has five forms: row, index, tile, bar, block", () => {
  const match = redacted.match(/export type RedactedVariant = ([^;]+);/);
  assert.ok(match, "RedactedVariant is missing");
  assert.deepEqual([...match[1].matchAll(/"(\w+)"/g)].map((entry) => entry[1]), ["row", "index", "tile", "bar", "block"]);
  assert.ok(redacted.includes('variant === "block"'), "the block form is not drawn");
  assert.ok(redacted.includes('variant === "row" || variant === "index"'), "only row and index show a number");
});

test("D-09 the block form is a status region that can take focus by script only", () => {
  assert.equal((redacted.match(/role="status"/g) ?? []).length, 1);
  assert.equal((redacted.match(/tabIndex=\{-1\}/g) ?? []).length, 1);
  assert.ok(redacted.includes("levelCopy.redacted(level)"), "the block title is not the placeholder string");
  assert.ok(redacted.includes('aria-hidden="true"'), "the lock icon must be hidden from assistive technology");
});

test("D-09/T-24-36 no form has a handler, a link, a button, data attributes, a tab stop, aria-expanded or a second name", () => {
  assert.doesNotMatch(redacted, /\bon[A-Z][A-Za-z]*\s*=/, "event handler");
  assert.doesNotMatch(redacted, /\bhref\s*=|<a[\s>]|<button[\s>]|<input[\s>]|<img[\s>]/, "link, control or picture");
  assert.doesNotMatch(redacted, /\bdata-[a-z-]+\s*=/, "data attribute");
  assert.doesNotMatch(redacted, /tabIndex=\{(?!-1\})/, "a tab stop other than -1");
  assert.doesNotMatch(redacted, /aria-expanded|aria-label|aria-controls|title=/, "state or a second name");
});

test("T-24-36 the placeholder takes only level, variant, index, listItem and className", () => {
  const props = redacted.match(/RedactedPlaceholder\(\{([\s\S]*?)\}: \{([\s\S]*?)\n\}\)/);
  assert.ok(props, "props are missing");
  assert.deepEqual(props[1].split(",").map((name) => name.trim()).filter(Boolean), ["level", "variant", "index", "listItem", "className"]);
  assert.deepEqual([...props[2].matchAll(/^\s{2}(\w+)\??:/gm)].map((entry) => entry[1]), ["level", "variant", "index", "listItem", "className"]);
});

test("EDGE LVL-04/encoding: the placeholder string is ЗАСЕКРЕЧЕНО, U+0020 U+00B7 U+0020, «нужен допуск », an Arabic digit - compared by code points", () => {
  const word = [0x417, 0x410, 0x421, 0x415, 0x41a, 0x420, 0x415, 0x427, 0x415, 0x41d, 0x41e];
  const need = [0x43d, 0x443, 0x436, 0x435, 0x43d, 0x20, 0x434, 0x43e, 0x43f, 0x443, 0x441, 0x43a, 0x20];
  for (const level of [1, 2, 3, 4, 5]) {
    const expected = [...word, 0x20, 0xb7, 0x20, ...need, 0x30 + level];
    assert.deepEqual([...levelCopy.redacted(level)].map((char) => char.codePointAt(0)), expected, `level ${level}`);
  }
});

test("T-24-05 no component imports the server redaction or the response builder, so the interface never filters by itself", () => {
  const files = readdirSync(componentsDir).filter((name) => name.endsWith(".tsx"));
  assert.ok(files.length > 0);
  for (const name of files) {
    assert.doesNotMatch(componentSource(name), /(?:@\/lib\/|\.\.?\/(?:lib\/)?)(?:level-redact|content-response)\b/, `${name} imports redaction`);
  }
});

test("T-24-36 the placeholder file imports only the icons and the copy", () => {
  const imports = [...redacted.matchAll(/^import .* from "([^"]+)";$/gm)].map((entry) => entry[1]);
  assert.deepEqual(imports, ["@/components/portia-icons", "@/lib/level-copy"]);
});
