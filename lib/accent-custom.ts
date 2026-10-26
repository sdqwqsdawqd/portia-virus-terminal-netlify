// Why: «Свой» drives the same tokens as a preset (D-04) and is quietly made readable (D-23: lightness only).
// deriveAccentTokens is self-contained because accentBootScript embeds its source with Function.prototype.toString,
// so it may not reference imports or anything outside its own body (no module-level names, no spread/destructuring helpers).
export const accentTokenNames = ["--teal", "--teal-dim", "--teal-soft", "--desktop-glow", "--desktop-grid", "--desktop-base", "--desktop-deep", "--accent-hue", "--accent-chroma", "--mark-filter", "--assistant-filter"] as const;

export function deriveAccentTokens(picked: unknown): Record<string, string> | null {
  if (typeof picked !== "string" || !/^#[0-9a-f]{6}$/i.test(picked)) return null;

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const toLinear = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
  const oklch = (rgb: number[]) => {
    const R = toLinear(rgb[0]), G = toLinear(rgb[1]), B = toLinear(rgb[2]);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const h = (Math.atan2(b, a) * 180) / Math.PI;
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, Math.hypot(a, b), h < 0 ? h + 360 : h];
  };
  // Gamma sRGB 0..255, unclamped so out-of-gamut colours show up.
  const oklchToRgb = (L: number, C: number, hue: number) => {
    const a = C * Math.cos((hue * Math.PI) / 180), b = C * Math.sin((hue * Math.PI) / 180);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(toGamma);
  };
  // Lowers chroma until the colour fits sRGB (or reaches the floor), then rounds to 0..255.
  const fit = (L: number, C: number, H: number, floor: number) => {
    let rgb = oklchToRgb(L, C, H);
    while (C > floor && rgb.some((v) => !(v >= -0.5 && v <= 255.5))) { C = Math.max(floor, C - 0.005); rgb = oklchToRgb(L, C, H); }
    return rgb.map((v) => Math.round(clamp(v, 0, 255)));
  };
  const hex = (rgb: number[]) => "#" + rgb.map((v) => (v < 16 ? "0" : "") + v.toString(16)).join("");
  const hueDistance = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  // CSS Filter Effects Level 1 matrices on gamma sRGB, with the per-channel clamp.
  const applyMatrix = (m: number[][], rgb: number[]) => m.map((row) => clamp((row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]) / 255, 0, 1) * 255);
  const hueRotate = (rgb: number[], deg: number) => {
    const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
    return applyMatrix([
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
    ], rgb);
  };
  const saturate = (rgb: number[], s: number) => applyMatrix([
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ], rgb);

  const rgb0 = [1, 3, 5].map((i) => parseInt((picked as string).slice(i, i + 2), 16));
  const lch = oklch(rgb0);
  // Exact greys measure chroma <= 4e-8 and the nearest non-grey hex >= 1e-3, so 1e-4 catches only float noise (D-23).
  const neutral = lch[1] < 1e-4;
  // The pick keeps its own hue and chroma (cap 0.17); only lightness is corrected for readability, and gamut fitting only lowers chroma.
  const H = neutral ? 0 : lch[2];
  const L = clamp(lch[0], 0.62, 0.80);
  const C = neutral ? 0 : Math.min(lch[1], 0.17);
  const teal = fit(L, C, H, 0);
  const tealLch = oklch(teal);
  // --accent-chroma scales every accent tint in the stylesheet: 1 from preset strength (about 0.08) up, 0 for a neutral pick.
  const k = neutral ? 0 : Number(Math.min(1, tealLch[1] / 0.08).toFixed(2));
  // Below chroma 0.02 the 8-bit rounded --teal has no usable hue, so the pick's own hue stands in.
  const accentHue = Number((tealLch[1] >= 0.02 ? tealLch[2] : H).toFixed(1));
  const dim = fit(Math.max(0.49, L - 0.15), C * 0.78, H, 0);
  const grid = fit(L - 0.10, C * 0.8, H, 0);
  const base = fit(0.14, 0.02 * k, H, 0);
  const deep = fit(0.18, 0.03 * k, H, 0);

  // A search, not a rotation: CSS hue-rotate is not an OKLCH rotation (amber preset is -131 deg for an OKLCH change of -117 deg).
  // Fixed iteration counts, independent of the input (T-10-02). A tiny pull towards saturate(1) breaks near-ties.
  const filterFor = (refs: string[]) => {
    if (k === 0) return "hue-rotate(0deg) saturate(0)";
    const rgbs = refs.map((r) => [1, 3, 5].map((i) => parseInt(r.slice(i, i + 2), 16)));
    const score = (d: number, s: number) => {
      let worst = 0;
      for (let i = 0; i < rgbs.length; i++) worst = Math.max(worst, hueDistance(oklch(saturate(hueRotate(rgbs[i], d), s * k))[2], accentHue));
      return worst + 0.02 * Math.abs(s - 1);
    };
    let bestD = 0, bestS = 1, best = Infinity;
    for (let d = -180; d < 180; d += 4) {
      for (let k = 3; k <= 25; k++) {
        const sc = score(d, k / 10);
        if (sc < best) { best = sc; bestD = d; bestS = k / 10; }
      }
    }
    const d0 = bestD, s0 = bestS;
    for (let dd = -4; dd <= 4; dd++) {
      for (let ks = -2; ks <= 2; ks++) {
        const s = s0 + ks * 0.05;
        if (s <= 0) continue;
        const sc = score(d0 + dd, s);
        if (sc < best) { best = sc; bestD = d0 + dd; bestS = s; }
      }
    }
    return "hue-rotate(" + (bestD || 0) + "deg) saturate(" + Number((bestS * k).toFixed(2)) + ")";
  };

  return {
    "--teal": hex(teal),
    "--teal-dim": hex(dim),
    "--teal-soft": "rgba(" + teal.join(",") + ",.13)",
    "--desktop-glow": teal.join(", "),
    "--desktop-grid": grid.join(", "),
    "--desktop-base": hex(base),
    "--desktop-deep": hex(deep),
    "--accent-hue": String(accentHue),
    "--accent-chroma": String(k),
    "--mark-filter": filterFor(["#00b396"]),
    "--assistant-filter": filterFor(["#008e89", "#034e4c"]),
  };
}
