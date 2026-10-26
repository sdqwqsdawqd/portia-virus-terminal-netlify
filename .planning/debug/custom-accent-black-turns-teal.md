---
status: diagnosed
trigger: "UAT G-10-2b: Settings -> Цвет интерфейса -> «Свой», HEX #0D0D0D renders a teal accent; owner wants black -> dark grey, never teal; full colour freedom, adjustments only nudge toward the pick"
created: 2026-10-26T00:00:00Z
updated: 2026-10-26T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED. deriveAccentTokens (lib/accent-custom.ts:57-59) replaces the hue of any pick with OKLCH chroma < 0.02 by the Portia teal hue 180.4, then clamps chroma UP to a floor of 0.08, so every achromatic / near-achromatic pick is rebuilt as a saturated teal. The 0.62 lightness floor then lifts it from "black" to mid-tone.
test: ran deriveAccentTokens on #0d0d0d and a grid of picks (scratchpad probe, no source edits)
expecting: n/a (diagnosis done)
next_action: return ROOT CAUSE FOUND to the caller; plan-phase --gaps owns the fix

## Symptoms

expected: Settings -> Цвет интерфейса -> «Свой», HEX #0D0D0D -> accent becomes a dark/neutral grey resembling black
actual: accent, «Свой» swatch and (per tokens) desktop glow/background/spider/Vivian are teal (#489688 etc.)
errors: none
reproduction: 10-UAT.md Test 2 / gap G-10-2b; node probe of deriveAccentTokens("#0d0d0d")
started: since commit 589358b (feat(10-01), «Свой» accent) - designed behaviour, not a regression

## Eliminated

- hypothesis: the picker UI (hexToHsv / hue slider at far left) corrupts the colour
  evidence: hexToHsv returns hue 0 when delta === 0 (an achromatic pick), which is exactly why the slider sits at the red end in the owner's screenshot; the emitted value is still the typed #0D0D0D. The colour reaches deriveAccentTokens unchanged. UI is cosmetic here.
  timestamp: 2026-10-26
- hypothesis: a runtime fallback swaps in the Portia/teal preset (customTokens null -> removeProperty)
  evidence: portia-desktop.tsx:703-714 only removes tokens when deriveAccentTokens returns null (invalid hex). #0d0d0d is valid, returns 10 tokens, and they are applied verbatim (:709). The teal comes from inside deriveAccentTokens.
  timestamp: 2026-10-26
- hypothesis: the lightness clamp (0.62) is what makes it teal
  evidence: L is hue-agnostic. A neutral grey at L 0.62 is #868686 (contrast 5.29 vs --bg, 4.62 vs --panel-2). The L floor makes black into mid-grey, not into teal. The teal comes from hue + chroma.
  timestamp: 2026-10-26

## Evidence

- timestamp: 2026-10-26
  checked: lib/accent-custom.ts lines 55-65
  found: |
    const lch = oklch(rgb0);
    const H = lch[1] < 0.02 ? 180.4 : lch[2];   // :57  grey -> Portia hue
    const L = clamp(lch[0], 0.62, 0.80);        // :58
    const C = clamp(lch[1], 0.08, 0.17);        // :59  chroma FLOOR 0.08
    const teal = fit(L, C, H, 0.08);            // :60  fit() also refuses to go below 0.08
    dim = fit(max(0.49, L-0.15), C*0.78, H, 0); grid = fit(L-0.10, C*0.8, H, 0); base = fit(0.14, 0.02, H, 0); deep = fit(0.18, 0.03, H, 0)
  implication: H is forced to teal for C < 0.02, and C is forced up to >= 0.08, so no neutral can come out of this function.

- timestamp: 2026-10-26
  checked: OKLCH of #0d0d0d computed with the same maths
  found: L 0.1591, C 0.0000, h 89.9 (hue is float noise for an exact grey; #000000 reports 0). C 0.0000 < 0.02 -> H = 180.4. L 0.159 -> 0.62. C 0 -> 0.08.
  implication: output = oklch(0.62 0.08 180.4)

- timestamp: 2026-10-26
  checked: deriveAccentTokens("#0d0d0d") output
  found: |
    --teal #489688, --teal-dim #336c62, --teal-soft rgba(72,150,136,.13), --desktop-glow 72,150,136, --desktop-grid 59,117,107,
    --desktop-base #020c09, --desktop-deep #011612, --accent-hue 180.2,
    --mark-filter hue-rotate(0deg) saturate(0.6), --assistant-filter hue-rotate(-8deg) saturate(0.7)
    (#000000 and #808080 produce the identical set; #ffffff gives #82cfc0 at L 0.80; #aaaaaa gives #6ebbac)
  implication: every one of the 10 tokens is teal-tinted, not just --teal: glow, grid, base/deep backgrounds, --accent-hue (drives ~315 oklch(L C var(--accent-hue)) sites in app/portia.css), and both PNG filters.

- timestamp: 2026-10-26
  checked: behaviour just around the 0.02 cliff and for low-chroma picks
  found: |
    #180d0d (C 0.019, hue 19) -> teal #489688 (hue 180); #1c0d0d (C 0.026, hue 20) -> #b17272 (hue 19.6). Discontinuous.
    #3a3a42 (C 0.014, hue 286, bluish grey) -> teal; #141a1a / #101018 / #1a1414 -> teal.
    Picks that keep their hue still get chroma inflated to 0.08: #6b4a4a (C 0.045) -> #b17273 (C 0.080); #7a6a5a (C 0.032) -> #a77d50 (C 0.080).
    Sampling the picker's HSV board (10 584 points): 22.5% have C < 0.02 (collapse to teal), 57.6% have C < 0.08 (chroma lifted), 67.3% have L < 0.62 (lightened).
  implication: not just black. Any dark, grey or desaturated pick loses its hue family (teal) or its vividness (C floor). Matches the owner's "full freedom / resembles the pick" ask being violated across a large part of the board.

- timestamp: 2026-10-26
  checked: readability maths (WCAG ratio vs the real surfaces in app/portia.css :3-7)
  found: |
    Neutral grey (C = 0) needs L >= 0.58 for 4.5:1 on --bg (oklch .163 .014), >= 0.612 on --panel-2 (.229 .021); L >= 0.48-0.52 for 3:1 frames. The result is hue-independent (hue 0/90/180/270 within 0.005).
    L 0.62 grey = #868686: 5.29:1 on bg, 4.62:1 on panel-2. L 0.50 = #636363: 3.21:1 bg / 2.80:1 panel-2. #0d0d0d itself would be ~1.0:1 (invisible).
  implication: |
    The L floor (0.62) is a legitimate readability constraint and already works for greys, so black cannot literally stay black as an accent (text/frames on a near-black UI). The darkest legal neutral for text is ~#808080-#868686; --teal-dim (floor L 0.49, ~#5d5d5d) already provides the "dark grey" for secondary/frames. The two things that are NOT forced by readability are the hue override and the chroma floor.

- timestamp: 2026-10-26
  checked: spider/Vivian filter (filterFor, :69-93)
  found: Search is over hue-rotate d in [-180,180) step 4 and saturate s in [0.3, 2.5], scoring only hueDistance of the filtered PNG hues to accentHue (+0.02*|s-1|). `s <= 0` is skipped; minimum reachable saturation is 0.3-0.05*... ~0.3. The filter never touches lightness, so it imposes no L/C constraint on the accent, it only needs a hue target.
  implication: for a neutral accent the hue-only target is meaningless (grey hue is noise) and saturate(0.3+) can never fully neutralise the teal PNGs. A neutral branch (saturate(0), still matching the test's parseFilter regex) or a chroma-aware score is needed. Greys survive any hue-rotate/saturate chain (existing test "black, white and grey survive every filter").

- timestamp: 2026-10-26
  checked: app/portia.css chrome
  found: 315 `oklch(L C var(--accent-hue))` uses with literal chroma 0.007-0.049 (e.g. --bg .163 .014, --panel .201 .018, --line .33 .027, --line-bright .445 .038). Only `--accent-hue` can move; chroma is hard-coded per site. No `--accent-chroma` scale token exists.
  implication: even with a neutral --teal, the whole chrome keeps a faint tint at whichever --accent-hue is emitted. Making a neutral accent fully neutral needs either a chroma-scale custom property (calc inside oklch at these sites or at least the :root surface tokens, lines 3-14) or acceptance of a faint tint.

- timestamp: 2026-10-26
  checked: tests/spec encode the behaviour
  found: |
    lib/accent-theme.test.ts:321-327 "a grey pick still gets the Portia hue": asserts accent-hue within 1 deg of 180.4 AND oklch(teal) chroma >= 0.07 for #808080/#000000/#ffffff. This test IS the bug as a requirement.
    :291-319 sweep includes #000000 #ffffff #808080 #0a0a0a #fafafa and asserts hueDistance(--accent-hue, hue(--teal)) <= 0.5 and spider/Vivian hue within 10 deg of the accent: both meaningless for achromatic output.
    :278-289 includes #808080 and checks token formats (still fine if formats hold: --accent-hue numeric, filters match the parseFilter regex).
    :189-198 "Portia tints stay in gamut" matches only literal `oklch(L C var(--accent-hue))`: would miss calc-wrapped chroma if option (c) below is chosen.
    The full lib/accent-theme.test.ts currently passes 22/22.
    10-CONTEXT.md D-05: "keep the picked hue, clamp lightness and saturation into the range the presets live in ... A grey (no hue) pick still gets a usable accent."
    10-UI-SPEC.md :92 (--teal L 0.62-0.80, C 0.08-0.17), :101 ("A grey pick ... uses hue 180.4 (Portia teal hue) at the clamped chroma floor"), :103 (contrast target / "L clamp guarantees this for all hues"), :188 (grey, near-black, near-white edge row).
    10-boot-check.mjs:38 asserts the 10 derived props are all distinct for its pick (fine for a coloured pick; keep the pick chromatic or relax if reused for greys).
  implication: the current behaviour is deliberate spec (D-05 + UI-SPEC clamp table) plus a test that pins it; the owner's UAT feedback supersedes D-05's "grey gets Portia hue / chroma floor".

## Resolution

root_cause: |
  Design decision D-05 / UI-SPEC "derived-token contract" implemented in lib/accent-custom.ts deriveAccentTokens:
  (1) :57 hue fallback - any pick with OKLCH chroma < 0.02 (all greys, plus many dark or desaturated colours) has its hue replaced by the Portia teal hue 180.4; an exact grey has no hue (float noise: #0d0d0d reads 89.9), so it is "rescued" with teal;
  (2) :59/:60 chroma FLOOR 0.08 (also fit(...,floor 0.08)) lifts chroma from 0 to a clearly visible 0.08 at that teal hue, so the result is saturated teal, not neutral;
  (3) :58 lightness floor 0.62 lifts L 0.159 to mid-tone (legitimate: readability vs the dark UI, 4.5:1), and every companion token (dim/grid/base/deep, --accent-hue, both PNG filters) is built from the same teal H, so the whole theme goes teal.
  Readability does not require (1) or (2): a neutral at L >= 0.62 (#868686) has 5.29:1 on --bg and 4.62:1 on --panel-2. Only the L floor (and, for the spider, a desaturating filter) is a real constraint.
fix: (not applied - diagnose-only)
verification: (n/a)
files_changed: []
