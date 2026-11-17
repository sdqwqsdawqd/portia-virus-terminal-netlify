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

  // Owner 2026-11-18 (round 2): the assistant and the logo must keep their saturation under any pick and follow the picker smoothly.
  // Default-look zone: a very dark, very light or near-grey pick leaves the artwork as drawn (hue-rotate(0deg)); the old greying and the
  // multiplication by k, which drained the colour, are gone.
  // A tinted pick is solved from a fixed table, not by a search (T-10-02: the cost does not depend on the input). CSS hue-rotate is not an OKLCH
  // rotation, so for 72 rotations (every 5 deg) the table holds the saturate() that restores each reference's own chroma (never below 1, at most 2)
  // and the hue the references reach (their circular midpoint). The hue is unwrapped along the rotation into one running sequence that closes
  // after a full turn, so neighbouring picks land between neighbouring samples; the target hue is interpolated linearly between its bracketing samples.
  const filterFor = (refs: string[]) => {
    if (lch[0] < 0.25 || lch[0] > 0.93 || lch[1] < 0.03) return "hue-rotate(0deg)";
    const rgbs = refs.map((r) => [1, 3, 5].map((i) => parseInt(r.slice(i, i + 2), 16)));
    const own = rgbs.map((rgb) => oklch(rgb)[1]);
    const signed = (from: number, to: number) => ((to - from + 540) % 360) - 180;
    const STEP = 5, COUNT = 72;
    const ds: number[] = [], ss: number[] = [], hs: number[] = [];
    for (let i = 0; i <= COUNT; i++) {
      const d = -180 + i * STEP;
      let need = 0;
      for (let j = 0; j < rgbs.length; j++) need += clamp(own[j] / Math.max(oklch(hueRotate(rgbs[j], d))[1], 1e-4), 1, 2);
      const s = need / rgbs.length;
      let sx = 0, sy = 0;
      for (let j = 0; j < rgbs.length; j++) {
        const h = (oklch(saturate(hueRotate(rgbs[j], d), s))[2] * Math.PI) / 180;
        sx += Math.cos(h); sy += Math.sin(h);
      }
      let hue = (Math.atan2(sy, sx) * 180) / Math.PI;
      if (hue < 0) hue += 360;
      ds.push(d); ss.push(s);
      hs.push(i === 0 ? hue : hs[i - 1] + signed(hs[i - 1], hue));
    }
    // The last sample repeats the first one a full turn later, so the unwrapped hues cover the whole circle.
    const target = hs[0] + (((accentHue - hs[0]) % 360) + 360) % 360;
    let d = 0, s = 1;
    for (let i = 0; i < COUNT; i++) {
      const lo = Math.min(hs[i], hs[i + 1]), hi = Math.max(hs[i], hs[i + 1]);
      if (target >= lo && target <= hi) {
        const w = hi > lo ? (target - hs[i]) / (hs[i + 1] - hs[i]) : 0;
        d = ds[i] + w * (ds[i + 1] - ds[i]);
        s = ss[i] + w * (ss[i + 1] - ss[i]);
        break;
      }
    }
    const turn = ((Math.round(d) + 180) % 360 + 360) % 360 - 180;
    return "hue-rotate(" + (turn || 0) + "deg) saturate(" + Number(clamp(s, 1, 2).toFixed(2)) + ")";
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
