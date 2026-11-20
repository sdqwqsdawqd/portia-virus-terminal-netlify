import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// OWN-05: the PC format panel is compact and resizable, «Без фона» is an ordinary swatch variant, the size is remembered with the place.
const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const component = readFileSync(new URL("../components/portia-editor-rich-text.tsx", import.meta.url), "utf8");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const bodies = (selector: string) => rules.filter((r) => r.selector === selector).map((r) => r.body);
const declares = (body: string, declaration: string) => body.split(";").some((part) => part.trim().replace(/\s+/g, " ") === declaration);

test("the PC panel is compact, resizable by its corner and has a minimum size", () => {
  const [base] = bodies(".floating-text-format");
  for (const declaration of ["resize: both", "overflow: auto", "min-width: 320px", "min-height: 220px", "width: min(440px, calc(100vw - 28px))"]) {
    assert.ok(declares(base, declaration), declaration);
  }
});

test("the phone sheet is docked and not resizable", () => {
  assert.ok(bodies(".floating-text-format").some((body) => declares(body, "resize: none") && declares(body, "width: auto") && declares(body, "bottom: 44px")));
});

test("a size given by the user may reach the screen, not only the default height cap", () => {
  const [sized] = bodies(".floating-text-format[data-sized]");
  assert.ok(declares(sized, "max-height: calc(100svh - 16px)"));
  assert.ok(declares(sized, "max-width: calc(100vw - 16px)"));
});

test("the PC header is 32px and the controls are compact", () => {
  assert.ok(bodies(".floating-text-format > header").some((body) => declares(body, "min-height: 32px")));
  assert.ok(bodies(".format-swatches > button, .custom-color").some((body) => declares(body, "height: 22px")));
  assert.ok(bodies(".format-choice-row > button").some((body) => declares(body, "min-height: 28px")));
});

test("the size is read and written with the place under the one existing key", () => {
  assert.match(component, /clampPanelSize\(/);
  assert.match(component, /new ResizeObserver\(/);
  assert.match(component, /parsePanelPlacement\(/);
  assert.equal([...component.matchAll(/"portia-format-panel-v1"/g)].length, 1);
  assert.equal(/portia-format-panel-size|portia-format-size/.test(component), false);
});

test("the size is saved after the user's resize only, never from the first placement or on the phone", () => {
  const observer = component.slice(component.indexOf("new ResizeObserver("), component.indexOf("observer.observe(panel)"));
  assert.match(observer, /matchMedia\("\(max-width: 900px\)"\)\.matches\) return/);
  assert.match(observer, /panel\.style\.width === applied\.width && panel\.style\.height === applied\.height\) return/);
  assert.match(observer, /setTimeout\(/);
});

test("a move keeps the saved size", () => {
  const writer = component.slice(component.indexOf("function writePanelOffset("), component.indexOf("// Writes the clamped right/bottom"));
  assert.match(writer, /saved\.width/);
  assert.match(writer, /saved\.height/);
});
