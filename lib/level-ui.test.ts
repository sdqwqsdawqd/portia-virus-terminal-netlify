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

// The CSS block of the placeholder. app/portia.css is one file; the block is cut out by its markers.
const portiaCss = lf(readFileSync(new URL("../app/portia.css", import.meta.url), "utf8"));
const accessBlock = portiaCss.match(/^\/\* access-levels:start[\s\S]*?^\/\* access-levels:end \*\/$/m)?.[0] ?? "";

type CssRule = { selector: string; body: string; media: string | null };

// Rules of the block with the media query they stand in; the block has no deeper nesting than one media query.
function blockRules(block: string): CssRule[] {
  const rules: CssRule[] = [];
  const text = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const media of text.matchAll(/@media\s*([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    for (const rule of media[2].matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ selector: rule[1].trim(), body: rule[2], media: media[1].trim() });
  }
  const withoutMedia = text.replace(/@media\s*[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
  for (const rule of withoutMedia.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ selector: rule[1].trim(), body: rule[2], media: null });
  return rules;
}

const rules = blockRules(accessBlock);
const ruleFor = (selector: string, media: string | null = null) => rules.find((rule) => rule.selector === selector && rule.media === media);
const declaration = (rule: CssRule | undefined, property: string) => rule?.body.match(new RegExp(String.raw`(?:^|[;\s])${property}\s*:\s*([^;]+)`))?.[1].trim();

test("the access-levels block exists once and the placeholder is styled only inside it", () => {
  assert.ok(accessBlock.startsWith("/* access-levels:start"), "the block is missing");
  assert.equal(portiaCss.match(/^\/\* access-levels:start/gm)?.length, 1);
  assert.equal(portiaCss.match(/^\/\* access-levels:end \*\/$/gm)?.length, 1);
  const outside = portiaCss.replace(accessBlock, "");
  assert.doesNotMatch(outside, /\.access-redacted/, "the placeholder is styled outside the block");
  assert.ok(portiaCss.indexOf("/* access-levels:end */") < portiaCss.indexOf("/* users-tab:start"), "users-tab must stay last");
  for (const variant of ["row", "index", "tile", "bar", "block"]) assert.ok(ruleFor(`.access-redacted-${variant}`), `.access-redacted-${variant} is not styled`);
});

test("S2 long-text: the two segments never break, the wrapper wraps anywhere, so a 320px line breaks only at the middle point", () => {
  assert.equal(declaration(ruleFor(".access-redacted-word"), "white-space"), "nowrap");
  assert.equal(declaration(ruleFor(".access-redacted-need"), "white-space"), "nowrap");
  assert.equal(declaration(ruleFor(".access-redacted"), "overflow-wrap"), "anywhere");
  assert.equal(declaration(ruleFor(".access-redacted"), "max-width"), "100%");
});

test("D-09 the placeholder is static: no hover, no pointer, no animation in any rule that names it", () => {
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.doesNotMatch(rule.selector, /:hover|:active|:focus/, rule.selector);
  }
  assert.equal(declaration(ruleFor(".access-redacted"), "cursor"), "default");
  assert.doesNotMatch(accessBlock, /cursor\s*:\s*pointer/);
});

test("S1 populated: a placeholder row has the height of a virus row, on the phone too", () => {
  assert.equal(declaration(ruleFor(".access-redacted-row"), "min-height"), "65px");
  const phone = ruleFor(".virus-list > .access-redacted-row", "(max-width: 900px)");
  assert.ok(phone, "the phone rule is missing");
  assert.equal(declaration(phone, "min-height"), "62px");
  assert.equal(declaration(phone, "min-width"), "210px");
  assert.equal(declaration(phone, "scroll-snap-align"), "start");
});

test("S1 overflow: no placeholder rule is wider than the 210px of a phone row or scrolls sideways", () => {
  for (const rule of rules.filter((entry) => entry.selector.includes(".access-redacted"))) {
    for (const property of ["width", "min-width"]) {
      const value = declaration(rule, property);
      if (value?.endsWith("px")) assert.ok(Number.parseFloat(value) <= 210, `${rule.selector} ${property}: ${value}`);
    }
    assert.doesNotMatch(rule.body, /overflow-x|white-space\s*:\s*pre\b/, rule.selector);
  }
});

test("D-08 the block keeps sharp corners and uses no token of the site that is not declared", () => {
  assert.doesNotMatch(accessBlock, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted|#[0-9a-fA-F]{3,8}\b/);
});
