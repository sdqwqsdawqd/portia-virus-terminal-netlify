// Phase 26 UI-11b (todo 2026-10-28, item 10): a shortcut must not change its scale, position or sharpness when an animation ends.
// Source-level check on the current CSS: the last frame of every shortcut animation equals the resting frame, and will-change never toggles.
// A green run here is a check of the stylesheet, not of a device: sharpness on DPR 1.25 and on a phone stays BLOCKED (DEVICE) until Phase 27.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const shortcuts = readFileSync(new URL("../components/portia-desktop-shortcuts.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

type Declarations = Map<string, string>;

function declarations(body: string): Declarations {
  const map: Declarations = new Map();
  for (const item of body.split(";")) {
    const colon = item.indexOf(":");
    if (colon < 0) continue;
    map.set(item.slice(0, colon).trim(), item.slice(colon + 1).trim().replace(/\s+/g, " "));
  }
  return map;
}

/** Body of `@keyframes name { … }`, read with brace balancing. */
function keyframesBody(name: string): string {
  const start = stripped.indexOf(`@keyframes ${name} {`);
  assert.ok(start >= 0, `@keyframes ${name} is missing`);
  let depth = 0;
  for (let index = stripped.indexOf("{", start); index < stripped.length; index += 1) {
    if (stripped[index] === "{") depth += 1;
    if (stripped[index] === "}") depth -= 1;
    if (depth === 0) return stripped.slice(stripped.indexOf("{", start) + 1, index);
  }
  throw new Error(`@keyframes ${name} is not closed`);
}

/** The frame that holds 100% (`to` or a selector list containing 100%), or undefined when the end is implied by the element's own value. */
function lastFrame(name: string): Declarations | undefined {
  let last: Declarations | undefined;
  for (const match of keyframesBody(name).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const offsets = match[1].split(",").map((offset) => offset.trim());
    if (offsets.includes("to") || offsets.includes("100%")) last = declarations(match[2]);
  }
  return last;
}

function firstFrame(name: string): Declarations | undefined {
  for (const match of keyframesBody(name).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const offsets = match[1].split(",").map((offset) => offset.trim());
    if (offsets.includes("from") || offsets.includes("0%")) return declarations(match[2]);
  }
  return undefined;
}

/** All style rules (selector text + declarations), keyframe frames excluded, @media bodies included. */
function styleRules(): Array<{ selector: string; body: Declarations }> {
  const withoutKeyframes = stripped.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...withoutKeyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1].trim().replace(/\s+/g, " "), body: declarations(match[2]) }));
}

const geometry = ["scale", "translate", "rotate", "transform"] as const;

/** Identity values compare equal whatever their spelling: the browser paints them the same. */
function normal(property: string, value: string | undefined): string {
  const v = (value ?? "none").trim().replace(/\s+/g, " ");
  if (property === "scale" && /^(none|1|1 1|1 1 1)$/.test(v)) return "identity";
  if (property === "translate" && /^(none|0|0 0|0px|0px 0px|0 0 0)$/.test(v)) return "identity";
  if (property === "rotate" && /^(none|0|0deg)$/.test(v)) return "identity";
  if (property === "transform" && v === "none") return "identity";
  return v;
}

/** Is the subject of this selector the shortcut container itself (not a descendant such as `.desktop-icon-symbol`)? */
function targetsContainer(selector: string): boolean {
  return selector.split(",").some((part) => /\.desktop-icon(?![-\w])[^\s>+~]*$/.test(part.trim()));
}

test("UI-11b: the resting shortcut container has no scale, translate, rotate, transform or will-change", () => {
  const resting = styleRules().filter(({ selector }) => targetsContainer(selector) && !/is-(dragging|dropping)/.test(selector));
  assert.ok(resting.length >= 5, "the container rules were not found");
  for (const { selector, body } of resting) {
    for (const property of geometry) assert.equal(normal(property, body.get(property)), "identity", `${selector}: ${property} at rest`);
    assert.equal(body.get("will-change"), undefined, `${selector}: the resting container must not keep will-change`);
  }
});

test("UI-11b: will-change on the container never follows is-dragging / is-dropping (no toggle, no residual will-change: transform)", () => {
  for (const { selector, body } of styleRules()) {
    if (targetsContainer(selector) && /is-(dragging|dropping)/.test(selector)) assert.equal(body.get("will-change"), undefined, selector);
  }
  assert.doesNotMatch(stripped, /\.desktop-icon(?![-\w])[^{]*\{[^}]*will-change\s*:\s*[^;}]*transform/, "no will-change: transform on the container");
});

test("UI-11b: shortcut-drop ends on the resting frame, and shortcut-pickup hands over to shortcut-drop without a jump", () => {
  const drop = lastFrame("shortcut-drop");
  assert.ok(drop, "shortcut-drop has no 100% frame");
  for (const property of geometry) assert.equal(normal(property, drop.get(property)), "identity", `shortcut-drop 100%: ${property} must equal rest`);
  const pickupEnd = lastFrame("shortcut-pickup");
  const dropStart = firstFrame("shortcut-drop");
  assert.ok(pickupEnd && dropStart);
  for (const property of geometry) assert.equal(normal(property, pickupEnd.get(property)), normal(property, dropStart.get(property)), `pickup 100% and drop 0%: ${property}`);
  // The drop class is removed by a timer; it must not cut the animation short (a cut shows the mid-animation scale snapping to rest).
  const duration = Number(/\.desktop-icon\.is-dropping \{ animation: shortcut-drop (\d+)ms/.exec(css)?.[1]);
  assert.ok(duration > 0, "shortcut-drop duration not found");
  const timer = Number(/setDropping\(false\);[\s\S]{0,80}?\},\s*(\d+)\)/.exec(shortcuts)?.[1]);
  assert.ok(timer >= duration, `is-dropping is removed after ${timer}ms, the animation lasts ${duration}ms`);
  // shortcut-drop has no fill-mode: after its last frame the element falls back to the rest values, which the 100% frame already equals.
  assert.doesNotMatch(/\.desktop-icon\.is-dropping \{([^}]*)\}/.exec(css)?.[1] ?? "", /forwards|both/);
});

const cyclePrefix = 'html:not([data-motion="off"]) :is(.desktop-icon.is-icon-animating .desktop-icon-symbol, .start-panel > button.is-icon-animating .start-panel-icon)';
const restPrefix = ":is(.desktop-icon-symbol, .start-panel-icon)";

function cycles() {
  return css.split("\n").filter((line) => line.startsWith(cyclePrefix) && line.includes("[data-icon=")).map((line) => {
    const match = /^(.*?)\s*\{\s*animation:\s*([\w-]+)/.exec(line.slice(cyclePrefix.length));
    assert.ok(match, line.slice(0, 160));
    return { part: match[1], name: match[2] };
  });
}

function restOf(part: string): Declarations {
  const line = css.split("\n").find((candidate) => candidate.startsWith(`${restPrefix}${part} {`));
  assert.ok(line, `${part}: no resting rule outside the animating selector`);
  return declarations(/\{([^}]*)\}/.exec(line)?.[1] ?? "");
}

test("UI-11b: every shortcut symbol animation ends on its resting frame (scale, translate, rotate, transform)", () => {
  const all = cycles();
  assert.ok(all.length >= 30, `only ${all.length} symbol animations found`);
  for (const { part, name } of all) {
    const last = lastFrame(name);
    if (!last) continue; // no 100% frame: the animation ends on the element's own (resting) value by definition
    const rest = restOf(part);
    // The virus scan sweep is invisible at rest and on its last frame (opacity 0); its geometry is never painted.
    if (name === "icon-virus-scan") {
      assert.equal(last.get("opacity"), "0");
      assert.equal(rest.get("opacity"), "0");
      continue;
    }
    for (const property of geometry) {
      if (!last.has(property)) continue;
      assert.equal(normal(property, rest.get(property)), normal(property, last.get(property)), `${part} (${name}): rest ${property} must equal the last frame`);
    }
  }
});

test("UI-11b: symbol will-change is constant — declared in the resting rule, never in a rule with the animation class (Phase 19, D-17)", () => {
  for (const line of css.split("\n")) {
    if (/is-icon-animating|is-dragging|is-dropping/.test(line) && line.includes("{")) assert.doesNotMatch(line, /will-change/, line.slice(0, 160));
  }
  for (const { part, name } of cycles()) {
    const animated = [...keyframesBody(name).matchAll(/(?<![\w-])(translate|rotate|scale)\s*:/g)].map((match) => match[1]);
    if (!animated.length) continue;
    const willChange = (restOf(part).get("will-change") ?? "").split(",").map((item) => item.trim());
    for (const property of new Set(animated)) assert.ok(willChange.includes(property), `${part} (${name}): resting will-change must name ${property}`);
  }
});
