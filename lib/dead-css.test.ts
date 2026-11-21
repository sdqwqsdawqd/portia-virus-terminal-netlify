import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// Phase 26.1 (26.1-14): rules of the style file whose classes no component draws any more. A class stays on this list while the
// owner decision that removed it stands; the test fails if the rule comes back without a component to carry it.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = read("app/portia.css").replace(/\/\*[\s\S]*?\*\//g, "");
const components = readdirSync(new URL("../components/", import.meta.url))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => read(`components/${name}`))
  .join("\n");

// OWN-08 (owner 2026-11-20): the quotas of the qualification (single / multiple / free text) and their save strip are gone.
// Not on the list on purpose: `order-drag-handle` and `column-swap-handle` (OWN-09) - the button of the order stays in the markup,
// hidden until the keyboard focus, so its rules for the hidden state and the focus are alive.
const DEAD_CLASSES = ["promotion-quota-settings", "promotion-quota-summary"] as const;

function selectorsOf(sheet: string): string[] {
  return [...sheet.matchAll(/(?:^|[}\n])\s*([^{}@][^{}]*)\{/g)].map((match) => match[1]);
}

test("OWN-08: no component draws a class of the removed quotas", () => {
  for (const name of DEAD_CLASSES) assert.ok(!components.includes(name), `${name} came back into a component`);
});

test("OWN-08: no rule of the style file names a class of the removed quotas", () => {
  const selectors = selectorsOf(css);
  assert.ok(selectors.length > 500, "the selector scan must see the whole style file");
  for (const name of DEAD_CLASSES) {
    const pattern = new RegExp(`\\.${name}(?![\\w-])`);
    assert.deepEqual(selectors.filter((selector) => pattern.test(selector)), [], `${name} is a dead rule`);
  }
});

test("OWN-08: the scan sees a live rule, so an empty result means a clean file and not a broken scan", () => {
  assert.ok(selectorsOf(css).some((selector) => /\.promotion-rules-block(?![\w-])/.test(selector)));
  assert.ok(components.includes("promotion-rules-block"));
});
