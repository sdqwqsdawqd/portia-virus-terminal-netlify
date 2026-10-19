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
