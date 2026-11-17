import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveAccentTokens } from "./accent-custom.ts";

// Phase 26 (UI-10, D-20): text contrast is at least 4.5:1 on the --bg and --panel surfaces for every accent:
// the presets teal, ice, amber, red and the «Свой» accents that deriveAccentTokens makes (extreme hues and muted picks).
// --panel-2 is outside the contract (D-20); the preset palette is never changed to pass (the red preset stays as it is).
// The verdict reads only files of the repository; PORTIA_CONTRAST_REPORT=1 only prints the measured table.

type Rgb = [number, number, number];

const cssRaw = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, "");

// Helpers copied from lib/accent-theme.test.ts (a test file does not export).
const hex = (value: string): Rgb => {
  let h = value.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
const toLinear = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
/** Gamma sRGB 0..255, clamped (the browser maps out-of-gamut colours into sRGB). */
function oklchToRgb(L: number, C: number, hue: number): Rgb {
  const a = C * Math.cos((hue * Math.PI) / 180), b = C * Math.sin((hue * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map((v) => Math.min(255, Math.max(0, toGamma(v)))) as Rgb;
}
const luminance = (rgb: Rgb) => 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
const contrast = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function declarations(body: string) {
  const tokens = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(name, value.trim());
  return tokens;
}
const root = declarations(css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "");
const themeBlock = (id: string) => declarations(css.match(new RegExp(`html\\[data-accent="${id}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "");

/** Every plain rule of the stylesheet (inner rules of @media too): selector list and body. */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selectors: selector.trim().split(",").map((part) => part.trim()), body }));
/** The first rule whose selector list is exactly `selector` (the base rule, not a media override). */
function ruleOf(selector: string) {
  const found = rules.find((rule) => rule.selectors.length === 1 && rule.selectors[0] === selector);
  assert.ok(found, `the rule ${selector} is found in app/portia.css`);
  return found.body;
}
const colorOf = (body: string) => body.match(/(?:^|;)\s*color\s*:\s*([^;]+);/)?.[1].trim() ?? "";

// An accent as the stylesheet sees it: the --teal text, its hue and its chroma scale.
type Accent = { name: string; teal: string; tealDim: string; hue: number; chroma: number };

/** Resolves a text or surface colour of the stylesheet under an accent. */
function resolve(value: string, accent: Accent): Rgb {
  if (value === "var(--teal)") return hex(accent.teal);
  if (value === "var(--teal-dim)") return hex(accent.tealDim);
  const oklch = value.match(/^oklch\(\s*([\d.]+)\s+calc\(\s*([\d.]+)\s*\*\s*var\(--accent-chroma\)\s*\)\s+var\(--accent-hue\)\s*\)$/);
  if (oklch) return oklchToRgb(Number(oklch[1]), Number(oklch[2]) * accent.chroma, accent.hue);
  if (/^#[0-9a-f]{3,6}$/i.test(value)) return hex(value);
  return assert.fail(`unsupported colour form: ${value}`);
}

// The presets: teal is the root, the others are their html[data-accent] blocks (the chroma scale is the root's 1).
const presets: Accent[] = [
  { name: "teal", teal: root.get("--teal") ?? "", tealDim: root.get("--teal-dim") ?? "", hue: Number(root.get("--accent-hue")), chroma: Number(root.get("--accent-chroma")) },
  ...["ice", "amber", "red"].map((id) => {
    const block = themeBlock(id);
    return { name: id, teal: block.get("--teal") ?? "", tealDim: block.get("--teal-dim") ?? "", hue: Number(block.get("--accent-hue")), chroma: Number(block.get("--accent-chroma") ?? root.get("--accent-chroma")) };
  }),
];

// «Свой»: picks at the HSL hues 0, 60, 120, 180, 240, 300 (the extremes of the wheel), muted and grey picks, a very dark and a very light pick.
const customPicks: Record<string, string> = {
  "custom hue 0": "#ff0000",
  "custom hue 60": "#ffff00",
  "custom hue 120": "#00ff00",
  "custom hue 180": "#00ffff",
  "custom hue 240": "#0000ff",
  "custom hue 300": "#ff00ff",
  "custom muted 30": "#8a7f74",
  "custom muted 210": "#6f7a85",
  "custom muted dark": "#2a2622",
  "custom grey": "#808080",
  "custom near white": "#f4f6f8",
};
const customs: Accent[] = Object.entries(customPicks).map(([name, pick]) => {
  const tokens = deriveAccentTokens(pick);
  assert.ok(tokens, `deriveAccentTokens accepts ${pick}`);
  return { name: `${name} (${pick})`, teal: tokens["--teal"], tealDim: tokens["--teal-dim"], hue: Number(tokens["--accent-hue"]), chroma: Number(tokens["--accent-chroma"]) };
});
const accents = [...presets, ...customs];

// The text colours under contract, read from the stylesheet.
const PRIMARY_TEXT = "oklch(.918 calc(.013 * var(--accent-chroma)) var(--accent-hue))";
const SECONDARY_TEXT = "oklch(.658 calc(.026 * var(--accent-chroma)) var(--accent-hue))";
const texts: [string, string][] = [
  ["--teal text", "var(--teal)"],
  [".eyebrow", colorOf(ruleOf(".eyebrow"))],
  [".formatted-text-field-hint", colorOf(ruleOf(".formatted-text-field-hint"))],
  [".editor-record-list small", colorOf(ruleOf(".editor-record-list small"))],
  ["primary text (.918)", PRIMARY_TEXT],
  ["secondary text (.658)", SECONDARY_TEXT],
];
const surfaces: [string, string][] = [["--bg", root.get("--bg") ?? ""], ["--panel", root.get("--panel") ?? ""]];

const MIN = 4.5;
const measured = accents.flatMap((accent) => texts.flatMap(([text, value]) => surfaces.map(([surface, surfaceValue]) => ({
  accent: accent.name, text, surface, ratio: contrast(resolve(value, accent), resolve(surfaceValue, accent)),
}))));

if (process.env.PORTIA_CONTRAST_REPORT === "1") {
  const lines = measured.map((row) => `${row.accent.padEnd(28)} ${row.text.padEnd(28)} on ${row.surface.padEnd(8)} ${row.ratio.toFixed(2)}:1`);
  console.log(`UI-10 contrast report (D-20, --bg and --panel)\n${lines.join("\n")}`);
}

test("UI-10 D-20: the contract reads its colours and surfaces from app/portia.css", () => {
  assert.ok(cssRaw.includes(PRIMARY_TEXT), "the primary text colour (.918) is a colour of the stylesheet");
  assert.ok(cssRaw.includes(SECONDARY_TEXT), "the secondary text colour (.658) is a colour of the stylesheet");
  for (const [surface, value] of surfaces) assert.match(value, /^oklch\(/, `${surface} is an oklch surface of the root`);
  for (const accent of presets) {
    assert.match(accent.teal, /^#[0-9a-f]{6}$/i, `${accent.name}: --teal is read`);
    assert.ok(Number.isFinite(accent.hue) && Number.isFinite(accent.chroma), `${accent.name}: hue and chroma are read`);
  }
  assert.equal(accents.length, 15, "4 presets and 11 custom accents");
});

test("UI-10 D-20: every text under contract has at least 4.5:1 on --bg and --panel for every preset and custom accent", () => {
  const failing = measured.filter((row) => !(row.ratio >= MIN)).map((row) => `${row.text} on ${row.surface}, ${row.accent}: ${row.ratio.toFixed(2)}:1`);
  assert.deepEqual(failing, [], `pairs below ${MIN}:1`);
});

test("UI-10: .eyebrow is --teal text, the hint is 11px; no .559/.525 text in the three fixed rules or in the families", () => {
  assert.equal(colorOf(ruleOf(".eyebrow")), "var(--teal)", ".eyebrow uses --teal as text (--teal-dim is for borders and fills only)");
  assert.match(ruleOf(".formatted-text-field-hint"), /font-size:\s*11px;/, "the hint is 11px (the Label size)");
  const weak = /oklch\(\.(559|525)\b/;
  for (const selector of [".eyebrow", ".formatted-text-field-hint", ".editor-record-list small"]) {
    assert.doesNotMatch(colorOf(ruleOf(selector)), weak, `${selector} has no .559/.525 text`);
  }
  const unifyStart = cssRaw.indexOf("/* ui-unify:start");
  const unifyEnd = cssRaw.indexOf("/* ui-unify:end */");
  assert.ok(unifyStart > 0 && unifyEnd > unifyStart, "the ui-unify block is found");
  const unify = cssRaw.slice(unifyStart, unifyEnd).replace(/\/\*[\s\S]*?\*\//g, "");
  const families = new Set([...unify.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, selector]) => selector.split(",").map((part) => part.trim())));
  assert.ok(families.size > 20, `the family selectors are read (${families.size})`);
  const offenders = rules.filter((rule) => rule.selectors.some((selector) => families.has(selector)) && weak.test(colorOf(rule.body))).map((rule) => rule.selectors.join(", "));
  assert.deepEqual(offenders, [], "no rule of a shared family uses .559/.525 text");
});

test("UI-10 D-20: the preset palette is unchanged (contrast is never bought by a preset colour)", () => {
  const palette = Object.fromEntries(presets.map((accent) => [accent.name, [accent.teal, accent.tealDim, accent.hue]]));
  assert.deepEqual(palette, {
    teal: ["#00bca6", "#12897a", 180.4],
    ice: ["#7ec8e3", "#4b9ab8", 223.3],
    amber: ["#e8953f", "#a96d31", 63.1],
    red: ["#d94f6e", "#9d3a50", 10.1],
  });
  assert.equal(root.get("--bg"), "oklch(.163 calc(.014 * var(--accent-chroma)) var(--accent-hue))");
  assert.equal(root.get("--panel"), "oklch(.201 calc(.018 * var(--accent-chroma)) var(--accent-hue))");
});
