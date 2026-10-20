import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));

// Value of `property` in the FIRST rule whose whole selector list is exactly `selector` and which declares it.
function rule(selector: string, property: string): string | undefined {
  for (const r of rules) {
    if (r.selector !== selector) continue;
    const m = r.body.match(new RegExp(`(?:^|[;\\s])${property.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+)`));
    if (m) return m[1].trim();
  }
  return undefined;
}

const field = (area: string, surface: "light" | "dark") => `.formatted-rich-input[data-area="${area}"].preview-${surface}`;

test("generic dark field uses the D-06 ink and reads the field variables", () => {
  assert.equal(rule(".formatted-rich-input", "--field-ink"), "oklch(.79 .02 var(--accent-hue))");
  assert.equal(rule(".formatted-rich-input", "color"), "var(--field-ink)");
  assert.equal(rule(".formatted-rich-input", "background"), "var(--field-bg)");
});

test("generic light field uses the classification-cell ink (D-07)", () => {
  const ink = rule(".formatted-rich-input.preview-light", "--field-ink");
  assert.ok(ink);
  assert.equal(ink, rule(".class-cell strong", "color"));
});

test("focus and active rules never set colour or background (no jump on focus)", () => {
  for (const r of rules) {
    if (!r.selector.includes(".formatted-rich-input")) continue;
    if (!/:focus|\.is-editor-active/.test(r.selector)) continue;
    assert.doesNotMatch(r.body, /(?:^|[;\s])(?:color|background)\s*:/, r.selector);
  }
});

test("lead field ink and background equal the dossier rules", () => {
  assert.equal(rule(field("lead", "light"), "--field-ink"), rule(".lead-copy", "color"));
  assert.equal(rule(field("lead", "light"), "--field-bg"), rule(".record-view", "background"));
});

// area, native surface, site rule whose colour is the ink, optional site rule whose background is the field's.
const pairs: [string, "light" | "dark", string, string?][] = [
  ["metric", "light", ".metric-grid > div > .formatted-content", ".record-view"],
  ["mutation", "light", ".mutation-copy > .formatted-content"],
  ["scientist", "light", ".scientist-rich-text", ".archive-document-paper"],
  ["trash", "light", ".trash-formatted-text", ".trash-text-document"],
  ["info", "dark", ".info-document-copy"],
  ["broadcast", "dark", ".broadcast-card-copy"],
  ["caption", "dark", ".trash-image-document figcaption", ".trash-image-document"],
  ["search", "dark", ".search-recommendations button"],
];

for (const [area, surface, site, siteBg] of pairs) {
  test(`${area} field ink${siteBg ? " and background" : ""} equal the site rule on its ${surface} surface`, () => {
    const ink = rule(site, "color");
    assert.ok(ink, site);
    assert.equal(rule(field(area, surface), "--field-ink"), ink);
    if (siteBg) {
      const bg = rule(siteBg, "background");
      assert.ok(bg, siteBg);
      assert.equal(rule(field(area, surface), "--field-bg"), bg);
    }
  });
}

test("every other area has a native-surface rule with both variables", () => {
  for (const [area, surface] of [...pairs.map(([a, s]) => [a, s] as const), ["lead", "light"] as const, ["assistant", "dark"] as const]) {
    assert.ok(rule(field(area, surface), "--field-ink"), `${area} ink`);
    assert.ok(rule(field(area, surface), "--field-bg"), `${area} bg`);
  }
});

test("assistant field ignores run colour, size and weight like the bubble, and matches its spacing", () => {
  const span = '.formatted-rich-input[data-area="assistant"] span';
  for (const property of ["color", "font-size", "font-weight"]) assert.equal(rule(span, property), "inherit !important", property);
  const bubble = ".assistant-bubble > .assistant-formatted-text, .assistant-bubble > .assistant-formatted-text *";
  const own = '.formatted-rich-input[data-area="assistant"]';
  assert.equal(rule(own, "letter-spacing"), rule(bubble, "letter-spacing"));
  assert.match(rule(own, "font") ?? "", /^700 10px\/1\.4 /);
  assert.match(rule(bubble, "line-height") ?? "", /^1\.4$/);
});
