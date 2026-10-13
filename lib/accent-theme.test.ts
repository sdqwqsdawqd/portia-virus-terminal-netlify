import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accentBootScript, accentIds } from "./accent-boot.ts";

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

test("every theme defines the accent tokens and both PNG filters", () => {
  for (const [id, tokens] of Object.entries(themes)) {
    for (const name of ["--teal", "--teal-dim", "--teal-soft", "--desktop-glow", "--desktop-grid", "--accent-hue", "--mark-filter", "--assistant-filter"]) {
      assert.ok(tokens.has(name), `${id} lacks ${name}`);
    }
  }
  assert.ok(root.has("--accent-hue"));
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

test("the boot script applies only a whitelisted saved accent", () => {
  const run = (getItem: () => string | null) => {
    const dataset: { accent?: string } = {};
    new Function("localStorage", "document", accentBootScript)({ getItem }, { documentElement: { dataset } });
    return dataset.accent;
  };
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
