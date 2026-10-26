import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { accentBootScript, accentIds, bootSeenStorageKey, desktopSettingsStorageKey, motionModes } from "./accent-boot.ts";
import { accentTokenNames, deriveAccentTokens } from "./accent-custom.ts";

type Rgb = [number, number, number];

const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const desktopSource = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");

// Median opaque (alpha >= 200) pixels with RGB chroma >= 40; the assistant split at its median OKLCH lightness.
const LOGO_TEAL = "#00b396";
const ASSISTANT_TEAL_LIGHT = "#008e89";
const ASSISTANT_TEAL_DARK = "#034e4c";

const hex = (value: string): Rgb => {
  let h = value.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
const toLinear = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;

function oklab([r, g, b]: Rgb): Rgb {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklch(rgb: Rgb): Rgb {
  const [L, a, b] = oklab(rgb);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}
/** Gamma sRGB 0..255, unclamped so out-of-gamut colours show up. */
function oklchToRgb(L: number, C: number, hue: number): Rgb {
  const a = C * Math.cos((hue * Math.PI) / 180), b = C * Math.sin((hue * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(toGamma) as Rgb;
}
const hueDistance = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const hueOf = (value: string) => oklch(hex(value))[2];
const luminance = (rgb: Rgb) => 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
const contrast = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const applyMatrix = (m: number[][], rgb: Rgb) => m.map((row) => clamp01((row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]) / 255) * 255) as Rgb;
// CSS Filter Effects Level 1 matrices, applied to gamma-encoded sRGB.
function hueRotate(rgb: Rgb, deg: number): Rgb {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return applyMatrix([
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ], rgb);
}
function saturate(rgb: Rgb, s: number): Rgb {
  return applyMatrix([
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ], rgb);
}
function parseFilter(value: string): (rgb: Rgb) => Rgb {
  const match = value.match(/^hue-rotate\((-?\d+)deg\)(?:\s+saturate\(([\d.]+)\))?$/);
  assert.ok(match, `unsupported filter token: ${value}`);
  const deg = Number(match[1]), sat = match[2] === undefined ? 1 : Number(match[2]);
  return (rgb) => saturate(hueRotate(rgb, deg), sat);
}

function declarations(body: string) {
  const tokens = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(name, value.trim());
  return tokens;
}
const root = declarations(css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "");
const themeBlock = (id: string) => declarations(css.match(new RegExp(`html\\[data-accent="${id}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "");
const themes = Object.fromEntries(["ice", "amber", "red"].map((id) => [id, themeBlock(id)]));
const swatch = (id: string) => css.match(new RegExp(`\\.swatch\\.${id}\\s*\\{[^}]*background:\\s*(#[0-9a-f]+)`, "i"))?.[1];

// A literal is turquoise when its RGB chroma reaches MIN_CHROMA and its HSL hue is 150-195 deg.
const MIN_CHROMA = 6;
const LITERAL = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/g;
// Tokens, theme blocks, swatches, canon classification colours, the success message and the rainbow picker keep their literals.
const ROOT_KEEP = new Set(["--teal", "--teal-dim", "--teal-soft", "--desktop-glow", "--desktop-grid", "--desktop-base", "--desktop-deep", "--accent-hue", "--mark-filter", "--assistant-filter"]);
const SKIP_SELECTORS = ["html[data-accent=", ".swatch.", ".class-cell.level-", ".class-cell.transmission strong", ".classification-select-wrap > strong", ".classification-select-wrap.level-", ".owner-login-success", ".custom-hue input"];

function hslHue([r, g, b]: Rgb) {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
  return h < 0 ? h + 360 : h;
}
function turquoiseLiterals(text: string, minChroma = MIN_CHROMA) {
  const found: string[] = [];
  for (const m of text.matchAll(LITERAL)) {
    const rgb = m[1] ? hex(m[1].length === 4 ? m[1].slice(0, 3) : m[1].slice(0, 6)) : ([+m[2], +m[3], +m[4]] as Rgb);
    const hue = hslHue(rgb);
    if (Math.max(...rgb) - Math.min(...rgb) >= minChroma && hue >= 150 && hue <= 195) found.push(m[0]);
  }
  return found;
}

test("every theme defines the accent tokens and both PNG filters", () => {
  for (const [id, tokens] of Object.entries(themes)) {
    for (const name of ["--teal", "--teal-dim", "--teal-soft", "--desktop-glow", "--desktop-grid", "--accent-hue", "--mark-filter", "--assistant-filter"]) {
      assert.ok(tokens.has(name), `${id} lacks ${name}`);
    }
  }
  assert.ok(root.has("--accent-hue"));
  assert.equal(root.get("--accent-chroma"), "1");
  assert.equal(root.get("--mark-filter"), "hue-rotate(0deg)");
  assert.equal(root.get("--assistant-filter"), "hue-rotate(0deg)");
});

test("accent hue tokens match their accents", () => {
  for (const [id, tokens] of [["root", root], ...Object.entries(themes)] as const) {
    const distance = hueDistance(Number(tokens.get("--accent-hue")), hueOf(tokens.get("--teal")!));
    assert.ok(distance <= 0.5, `${id}: --accent-hue is ${distance.toFixed(2)} deg off its --teal`);
  }
});

test("amber and red accents stay distinct from warning and danger", () => {
  assert.ok(hueDistance(hueOf(themes.amber.get("--teal")!), hueOf(root.get("--warning")!)) >= 15);
  assert.ok(hueDistance(hueOf(themes.red.get("--teal")!), hueOf(root.get("--danger")!)) >= 15);
});

test("spider and Vivian land on the accent hue", () => {
  for (const [id, tokens] of Object.entries(themes)) {
    const target = hueOf(tokens.get("--teal")!);
    const mark = parseFilter(tokens.get("--mark-filter")!);
    const assistant = parseFilter(tokens.get("--assistant-filter")!);
    for (const [label, rgb] of [["logo", mark(hex(LOGO_TEAL))], ["assistant light", assistant(hex(ASSISTANT_TEAL_LIGHT))], ["assistant dark", assistant(hex(ASSISTANT_TEAL_DARK))]] as const) {
      const distance = hueDistance(oklch(rgb)[2], target);
      assert.ok(distance <= 10, `${id} ${label} ends ${distance.toFixed(1)} deg from the accent`);
    }
  }
});

test("black, white and grey survive every filter", () => {
  for (const tokens of [root, ...Object.values(themes)]) {
    for (const name of ["--mark-filter", "--assistant-filter"]) {
      const filter = parseFilter(tokens.get(name)!);
      for (const grey of ["#000000", "#ffffff", "#808080"]) {
        const out = filter(hex(grey));
        hex(grey).forEach((channel, i) => assert.ok(Math.abs(out[i] - channel) <= 1, `${name} ${tokens.get(name)} moves ${grey}`));
      }
    }
  }
});

test("theme swatches match their themes", () => {
  assert.equal(swatch("teal"), root.get("--teal"));
  for (const [id, tokens] of Object.entries(themes)) assert.equal(swatch(id), tokens.get("--teal"));
});

test("no turquoise literal left in the stylesheet", () => {
  const left: string[] = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (SKIP_SELECTORS.some((s) => selector.includes(s))) continue;
    const isRoot = /(^|[\s,]):root\s*$/.test(selector);
    for (const [, name, value] of body.matchAll(/(--[\w-]+|[\w-]+)\s*:\s*([^;]*)/g)) {
      if (isRoot && ROOT_KEEP.has(name)) continue;
      for (const literal of turquoiseLiterals(value)) left.push(`${selector.trim()}: ${literal}`);
    }
  }
  assert.deepEqual(left, []);
});

test("no turquoise literal in the components", () => {
  const sources = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(new URL(`${e.name}/`, dir)) : /\.tsx?$/.test(e.name) ? [new URL(e.name, dir)] : []);
  const components = readdirSync(new URL("../components/", import.meta.url)).filter((f) => f.endsWith(".tsx")).map((f) => new URL(`../components/${f}`, import.meta.url));
  const left: string[] = [];
  for (const file of [...components, ...sources(new URL("../app/", import.meta.url))]) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      // Text colour presets in the editor are stored content colours, not interface.
      if (file.pathname.endsWith("portia-editor.tsx") && /value: "#[0-9a-f]{6}", label:/i.test(line)) return;
      // Components keep the saturated threshold: near-neutral greys in TSX are content colours, not tints.
      for (const literal of turquoiseLiterals(line, 20)) left.push(`${file.pathname.split("/").slice(-2).join("/")}:${i + 1}: ${literal}`);
    });
  }
  assert.deepEqual(left, []);
});

test("Portia tints stay in gamut and in the teal family", () => {
  for (const [whole, l, c] of css.matchAll(/oklch\(([\d.]+) calc\(([\d.]+) \* var\(--accent-chroma\)\) var\(--accent-hue\)/g)) {
    const rgb = oklchToRgb(Number(l), Number(c), 180.4);
    assert.ok(rgb.every((v) => v >= -1 && v <= 256), `${whole} leaves sRGB at the Portia hue`);
    if (Number(c) >= 0.02) {
      const hue = hslHue(rgb.map((v) => Math.min(255, Math.max(0, v))) as Rgb);
      assert.ok(hue >= 150 && hue <= 195, `${whole} renders at HSL hue ${hue.toFixed(1)}`);
    }
  }
});

test("every accent tint follows --accent-chroma", () => {
  const sources = (dir: URL): URL[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(new URL(`${e.name}/`, dir)) : /\.tsx?$/.test(e.name) ? [new URL(e.name, dir)] : []);
  const components = readdirSync(new URL("../components/", import.meta.url)).filter((f) => f.endsWith(".tsx")).map((f) => new URL(`../components/${f}`, import.meta.url));
  const files: [string, string][] = [["app/portia.css", css]];
  for (const file of [...components, ...sources(new URL("../app/", import.meta.url))]) files.push([file.pathname.split("/").slice(-2).join("/"), readFileSync(file, "utf8")]);
  for (const [name, text] of files) {
    const all = (text.match(/var\(--accent-hue\)/g) ?? []).length;
    const scaled = (text.match(/calc\([\d.]+ \* var\(--accent-chroma\)\) var\(--accent-hue\)/g) ?? []).length;
    assert.equal(scaled, all, `${name}: ${all - scaled} var(--accent-hue) tint(s) are not scaled by --accent-chroma`);
  }
});

test("no relative colour syntax", () => {
  assert.doesNotMatch(css, /oklch\(\s*from\b/);
});

const runBoot = (getItem: (key: string) => string | null, systemReduce = false, sessionGetItem: (key: string) => string | null = () => null) => {
  const dataset: { accent?: string; motion?: string; boot?: string } = {};
  const props: Record<string, string> = {};
  const style = { setProperty: (name: string, value: string) => { props[name] = value; } };
  const matchMedia = (query: string) => ({ matches: systemReduce && query === "(prefers-reduced-motion: reduce)" });
  new Function("localStorage", "sessionStorage", "document", "matchMedia", accentBootScript)({ getItem }, { getItem: sessionGetItem }, { documentElement: { dataset, style } }, matchMedia);
  return { ...dataset, props };
};

test("the boot script applies a saved custom accent exactly as deriveAccentTokens computes it", () => {
  const out = runBoot(() => JSON.stringify({ accent: "custom", customAccent: "#ff3366" }));
  const expected = deriveAccentTokens("#ff3366");
  assert.ok(expected);
  assert.deepEqual(Object.keys(expected).sort(), [...accentTokenNames].sort());
  assert.equal(out.accent, "custom");
  assert.deepEqual(out.props, expected);
});

test("a preset stays a preset when a custom colour is remembered", () => {
  const out = runBoot(() => JSON.stringify({ accent: "ice", customAccent: "#ff3366" }));
  assert.equal(out.accent, "ice");
  assert.deepEqual(out.props, {});
});

test("the boot animation plays once per browser session", () => {
  const saved = () => JSON.stringify({ accent: "ice", motion: "off" });
  const seen = runBoot(saved, false, (key) => key === bootSeenStorageKey ? "1" : null);
  assert.equal(seen.boot, "seen");
  assert.equal(runBoot(saved, false, () => null).boot, undefined);
  const blocked = runBoot(saved, false, () => { throw new Error("storage blocked"); });
  assert.equal(blocked.boot, undefined);
  assert.equal(blocked.motion, "reduce");
  assert.equal(blocked.accent, "ice");
  assert.ok(/(^|,)\s*html\[data-boot="seen"\] \.boot-screen\s*(,[^{]*)?\{[^}]*display:\s*none/m.test(css), "no html[data-boot=\"seen\"] .boot-screen { display: none }");
  assert.match(desktopSource, /sessionStorage\.setItem\(bootSeenStorageKey,/);
});

test("the boot script applies only a whitelisted saved accent", () => {
  const run = (getItem: () => string | null) => runBoot(getItem).accent;
  assert.equal(run(() => JSON.stringify({ accent: "ice" })), "ice");
  assert.equal(run(() => JSON.stringify({ accent: "\"><script>alert(1)</script>" })), undefined);
  assert.equal(run(() => "{not json"), undefined);
  assert.equal(run(() => "null"), undefined);
  assert.equal(run(() => { throw new Error("storage blocked"); }), undefined);
  assert.equal(run(() => null), undefined);

  const group = desktopSource.match(/title="Цвет интерфейса" values=\{(\[\[.*?\]\])\}/)?.[1];
  assert.ok(group, "«Цвет интерфейса» SettingGroup not found");
  assert.deepEqual([...accentIds], [...group.matchAll(/\['(\w+)',/g)].map((m) => m[1]));
  for (const id of ["ice", "amber", "red"]) assert.ok(themes[id].size > 0, `no html[data-accent="${id}"] block`);
});

test("animations are on by default and off only by the setting, whatever the system says", () => {
  const saved = (motion?: string) => () => JSON.stringify({ accent: "teal", motion });
  assert.equal(runBoot(saved(), true).motion, "full");
  assert.equal(runBoot(saved(), false).motion, "full");
  assert.equal(runBoot(saved("system"), true).motion, "full");
  assert.equal(runBoot(saved("on"), true).motion, "full");
  assert.equal(runBoot(saved("off"), false).motion, "reduce");
  assert.equal(runBoot(() => { throw new Error("storage blocked"); }, true).motion, "full");
  // The attribute is the switch. The media query may only hold the fallback for a page where the head
  // script never ran, so every selector inside it must be scoped to html:not([data-motion]).
  for (const [, body] of css.matchAll(/@media\s*\(prefers-reduced-motion[^)]*\)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
    for (const [, selectors] of body.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const selector of selectors.split(",")) assert.match(selector.trim(), /^html:not\(\[data-motion\]\)/, `unscoped motion rule: ${selector.trim()}`);
    }
  }
  const group = desktopSource.match(/title="Анимации" values=\{(\[\[.*?\]\])\}/)?.[1];
  assert.ok(group, "«Анимации» SettingGroup not found");
  assert.deepEqual([...motionModes], [...group.matchAll(/\['(\w+)',/g)].map((m) => m[1]));
});

const rgbToHex = (rgb: Rgb) => "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

test("custom accents derive every preset token in the preset formats", () => {
  for (const pick of ["#ff3366", "#3366ff", "#808080"]) {
    const t = deriveAccentTokens(pick)!;
    assert.deepEqual(Object.keys(t).sort(), [...accentTokenNames].sort());
    for (const name of ["--teal", "--teal-dim", "--desktop-base", "--desktop-deep"]) assert.match(t[name], /^#[0-9a-f]{6}$/, `${pick} ${name}`);
    assert.match(t["--teal-soft"], /^rgba\(\d{1,3},\d{1,3},\d{1,3},\.13\)$/);
    for (const name of ["--desktop-glow", "--desktop-grid"]) assert.match(t[name], /^\d{1,3}, \d{1,3}, \d{1,3}$/, `${pick} ${name}`);
    assert.match(t["--accent-hue"], /^\d{1,3}(\.\d)?$/);
    assert.match(t["--accent-chroma"], /^(0|1|0\.\d{1,2})$/, `${pick} --accent-chroma`);
    parseFilter(t["--mark-filter"]);
    parseFilter(t["--assistant-filter"]);
  }
});

test("every custom hue stays readable and keeps the spider and Vivian on the accent", () => {
  const picks = [
    ...Array.from({ length: 36 }, (_, i) => rgbToHex(oklchToRgb(0.7, 0.15, i * 10))),
    "#000000", "#ffffff", "#808080", "#0a0a0a", "#fafafa", "#ff0000", "#00ff00", "#0000ff", "#ffff00",
  ];
  for (const pick of picks) {
    const t = deriveAccentTokens(pick)!;
    const teal = hex(t["--teal"]);
    const scale = Number(t["--accent-chroma"]);
    const tealChroma = oklch(teal)[1];
    const bg = oklchToRgb(0.163, 0.014 * scale, Number(t["--accent-hue"])).map((v) => Math.min(255, Math.max(0, v))) as Rgb;
    assert.ok(contrast(teal, bg) >= 4.5, `${pick}: contrast ${contrast(teal, bg).toFixed(2)}`);
    const mark = parseFilter(t["--mark-filter"]);
    const assistant = parseFilter(t["--assistant-filter"]);
    for (const [label, rgb] of [["logo", mark(hex(LOGO_TEAL))], ["assistant light", assistant(hex(ASSISTANT_TEAL_LIGHT))], ["assistant dark", assistant(hex(ASSISTANT_TEAL_DARK))]] as const) {
      if (scale === 0) assert.ok(oklch(rgb)[1] <= 0.005, `${pick} ${label} keeps chroma ${oklch(rgb)[1].toFixed(4)}`);
      else if (tealChroma >= 0.02) assert.ok(hueDistance(oklch(rgb)[2], hueOf(t["--teal"])) <= 10, `${pick} ${label} ends ${hueDistance(oklch(rgb)[2], hueOf(t["--teal"])).toFixed(1)} deg from the accent`);
    }
    // Below chroma 0.02 the 8-bit rounded --teal has no usable hue.
    if (tealChroma >= 0.02) assert.ok(hueDistance(Number(t["--accent-hue"]), hueOf(t["--teal"])) <= 0.5, `${pick}: --accent-hue off its --teal`);
    const tealL = oklch(teal)[0];
    assert.ok(tealL >= 0.6 && tealL <= 0.82, `${pick}: --teal L ${tealL.toFixed(3)}`);
    assert.ok(oklch(hex(t["--teal-dim"]))[0] < tealL, `${pick}: --teal-dim is not darker`);
    assert.ok(oklch(hex(t["--desktop-base"]))[0] <= 0.17, `${pick}: --desktop-base too light`);
    for (const name of ["--mark-filter", "--assistant-filter"]) {
      for (const grey of ["#000000", "#ffffff", "#808080"]) {
        const out = parseFilter(t[name])(hex(grey));
        hex(grey).forEach((channel, i) => assert.ok(Math.abs(out[i] - channel) <= 1, `${pick} ${name} moves ${grey}`));
      }
    }
  }
});

test("an achromatic pick gives a neutral grey theme", () => {
  const equal3 = (parts: string[]) => parts.length === 3 && parts.every((p) => Number(p) === Number(parts[0]));
  for (const pick of ["#000000", "#0d0d0d", "#808080", "#ffffff"]) {
    const t = deriveAccentTokens(pick)!;
    assert.equal(t["--accent-chroma"], "0", pick);
    assert.equal(t["--accent-hue"], "0", pick);
    for (const name of ["--teal", "--teal-dim", "--desktop-base", "--desktop-deep"]) {
      assert.match(t[name], /^#([0-9a-f]{2})\1\1$/, `${pick} ${name} ${t[name]}`);
    }
    assert.ok(equal3(t["--teal-soft"].match(/\d+/g)!.slice(0, 3)), `${pick} --teal-soft ${t["--teal-soft"]}`);
    for (const name of ["--desktop-glow", "--desktop-grid"]) assert.ok(equal3(t[name].split(", ")), `${pick} ${name} ${t[name]}`);
    assert.equal(t["--mark-filter"], "hue-rotate(0deg) saturate(0)");
    assert.equal(t["--assistant-filter"], "hue-rotate(0deg) saturate(0)");
  }
  const t = deriveAccentTokens("#0d0d0d")!;
  assert.equal(t["--teal"], "#868686");
  for (const surface of [oklchToRgb(0.163, 0, 0), oklchToRgb(0.229, 0, 0)]) {
    const bg = surface.map((v) => Math.min(255, Math.max(0, v))) as Rgb;
    assert.ok(contrast(hex(t["--teal"]), bg) >= 4.5, `contrast ${contrast(hex(t["--teal"]), bg).toFixed(2)}`);
  }
});

const hsvToHex = (h: number, s: number, v: number) => {
  const channel = (n: number) => { const k = (n + h / 60) % 6; return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255; };
  return rgbToHex([channel(5), channel(3), channel(1)]);
};

test("a dark or muted pick keeps its hue and strength", () => {
  const derive = (pick: string) => { const t = deriveAccentTokens(pick)!; return { t, lch: oklch(hex(t["--teal"])) }; };
  const portiaHue = Number(root.get("--accent-hue"));
  const dusky = ["#180d0d", "#1c0d0d"].map((pick) => ({ pick, ...derive(pick) }));
  for (const { pick, lch } of dusky) {
    assert.ok(hueDistance(lch[2], oklch(hex(pick))[2]) <= 5, `${pick}: hue ${lch[2].toFixed(1)}`);
    assert.ok(hueDistance(lch[2], portiaHue) > 90, `${pick}: jumped to the Portia hue`);
  }
  assert.ok(Math.abs(dusky[0].lch[1] - dusky[1].lch[1]) <= 0.012, "no cliff between #180d0d and #1c0d0d");

  const bluish = derive("#3a3a42");
  assert.ok(hueDistance(Number(bluish.t["--accent-hue"]), 286) <= 3, `#3a3a42 hue ${bluish.t["--accent-hue"]}`);
  assert.ok(Number(bluish.t["--accent-chroma"]) >= 0.1 && Number(bluish.t["--accent-chroma"]) <= 0.3, `#3a3a42 chroma scale ${bluish.t["--accent-chroma"]}`);
  assert.ok(oklch(parseFilter(bluish.t["--mark-filter"])(hex(LOGO_TEAL)))[1] <= 0.03, "#3a3a42 spider is as faint as the accent");

  const muted = derive("#6b4a4a");
  assert.ok(muted.lch[1] <= 0.05, `#6b4a4a chroma ${muted.lch[1].toFixed(3)}`);
  assert.ok(hueDistance(muted.lch[2], 19) <= 5, `#6b4a4a hue ${muted.lch[2].toFixed(1)}`);

  let checked = 0;
  for (let h = 0; h <= 330; h += 30) {
    for (let s = 0; s <= 1.0001; s += 0.2) {
      for (let v = 0; v <= 1.0001; v += 0.2) {
        const pick = hsvToHex(h, s, v), pickLch = oklch(hex(pick)), { t, lch } = derive(pick);
        const note = `${pick} (h${h} s${s.toFixed(1)} v${v.toFixed(1)})`;
        assert.ok(lch[1] <= Math.min(pickLch[1], 0.17) + 0.003, `${note}: teal chroma ${lch[1].toFixed(4)} above the pick's ${pickLch[1].toFixed(4)}`);
        const scale = Number(t["--accent-chroma"]);
        const bg = oklchToRgb(0.163, 0.014 * scale, Number(t["--accent-hue"])).map((x) => Math.min(255, Math.max(0, x))) as Rgb;
        assert.ok(contrast(hex(t["--teal"]), bg) >= 4.5, `${note}: contrast ${contrast(hex(t["--teal"]), bg).toFixed(2)}`);
        for (const name of ["--mark-filter", "--assistant-filter"]) {
          for (const grey of ["#000000", "#ffffff", "#808080"]) {
            const out = parseFilter(t[name])(hex(grey));
            hex(grey).forEach((channel, i) => assert.ok(Math.abs(out[i] - channel) <= 1, `${note} ${name} moves ${grey}`));
          }
        }
        if (lch[1] >= 0.02) {
          assert.ok(hueDistance(lch[2], pickLch[2]) <= 5, `${note}: teal hue ${lch[2].toFixed(1)} vs pick ${pickLch[2].toFixed(1)}`);
          const mark = parseFilter(t["--mark-filter"]), assistant = parseFilter(t["--assistant-filter"]);
          for (const [label, rgb] of [["logo", mark(hex(LOGO_TEAL))], ["assistant light", assistant(hex(ASSISTANT_TEAL_LIGHT))], ["assistant dark", assistant(hex(ASSISTANT_TEAL_DARK))]] as const) {
            assert.ok(hueDistance(oklch(rgb)[2], lch[2]) <= 10, `${note} ${label} ends ${hueDistance(oklch(rgb)[2], lch[2]).toFixed(1)} deg from the accent`);
          }
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 432);
  assert.equal(deriveAccentTokens("#ff3366")!["--accent-chroma"], "1");
});

test("tampered custom colours never reach the page", () => {
  const hostile: unknown[] = ["\"><script>alert(1)</script>", "#12345", "#1234567", "#gggggg", "ff3366", 123, null, ["#ff3366"], {}];
  for (const customAccent of hostile) {
    assert.equal(deriveAccentTokens(customAccent), null);
    const out = runBoot(() => JSON.stringify({ accent: "custom", customAccent }));
    assert.deepEqual(out.props, {});
    assert.equal(out.accent, undefined);
  }
  const bare = runBoot(() => JSON.stringify({ accent: "custom" }));
  assert.deepEqual(bare.props, {});
  assert.equal(bare.accent, undefined);
});

test("the boot script passes the stored colour only as an argument", () => {
  assert.match(accentBootScript, /\)\(s\.customAccent\)/);
  assert.doesNotMatch(accentBootScript, /eval\(|new Function|innerHTML|document\.write/);
});

test("the boot script reads the one settings key", () => {
  const asked: string[] = [];
  runBoot((key) => { asked.push(key); return null; });
  assert.deepEqual(asked, [desktopSettingsStorageKey]);
  assert.equal(desktopSettingsStorageKey, "portia-desktop-settings-v1");
});

test("the desktop reads and writes settings through the one key constant", () => {
  assert.doesNotMatch(desktopSource, /portia-desktop-settings-v1/);
  assert.match(desktopSource, /localStorage\.getItem\(desktopSettingsStorageKey\)/);
  assert.match(desktopSource, /localStorage\.setItem\(desktopSettingsStorageKey,/);
});

test("the format mark is an underline with no fill and keeps 3:1 on every preview field", () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
  const marks = rules.filter((r) => r.selector.includes("::highlight(portia-format)"));
  assert.equal(marks.length, 1, "exactly one ::highlight(portia-format) rule");
  const body = marks[0].body;
  assert.match(body, /underline/);
  assert.doesNotMatch(body, /background/i);
  const m = body.match(/oklch\(([\d.]+) calc\(([\d.]+) \* var\(--accent-chroma\)\) var\(--accent-hue\) \/ ([\d.]+)\)/);
  assert.ok(m, "the mark colour is an accent-following oklch with alpha");
  const [markL, markC, alpha] = [Number(m[1]), Number(m[2]), Number(m[3])];

  const paper = css.match(/--paper:\s*(#[0-9a-fA-F]{3,6})/)?.[1];
  assert.ok(paper, "--paper is declared");
  const lights = new Set<string>();
  for (const r of rules.filter((x) => x.selector.includes("preview-light"))) {
    const v = r.body.match(/--field-bg:\s*([^;]+);/)?.[1].trim();
    if (v) lights.add(v === "var(--paper)" ? paper : v);
  }
  assert.ok(lights.size >= 5, `at least 5 light fields, found ${lights.size}`);
  const darks: Array<[number, number]> = [];
  for (const r of rules.filter((x) => x.selector.includes("formatted-rich-input"))) {
    const d = r.body.match(/--field-bg:\s*oklch\(([\d.]+) calc\(([\d.]+) \* var\(--accent-chroma\)\) var\(--accent-hue\)\)/);
    if (d) darks.push([Number(d[1]), Number(d[2])]);
  }
  assert.ok(darks.length >= 2, `at least 2 dark fields, found ${darks.length}`);

  const clamp = (rgb: Rgb) => rgb.map((c) => Math.min(255, Math.max(0, c))) as Rgb;
  const over = (mark: Rgb, field: Rgb) => mark.map((c, i) => alpha * c + (1 - alpha) * field[i]) as Rgb;
  for (let h = 0; h < 360; h += 15) {
    for (const k of [0, 0.5, 1]) {
      const mark = clamp(oklchToRgb(markL, markC * k, h));
      for (const light of lights) {
        const field = hex(light);
        assert.ok(contrast(over(mark, field), field) >= 3, `mark over ${light} at hue ${h}, strength ${k}`);
      }
      for (const [L, C] of darks) {
        const field = clamp(oklchToRgb(L, C * k, h));
        assert.ok(contrast(over(mark, field), field) >= 3, `mark over dark L${L} at hue ${h}, strength ${k}`);
      }
    }
  }
});
