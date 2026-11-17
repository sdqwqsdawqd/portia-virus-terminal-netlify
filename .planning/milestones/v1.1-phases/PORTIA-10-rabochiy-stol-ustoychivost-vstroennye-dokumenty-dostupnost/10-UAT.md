---
status: diagnosed
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
source: [10-VERIFICATION.md]
started: 2026-10-26T00:00:00Z
updated: 2026-10-25T19:53:32.968Z
---

## Current Test

[testing complete]

## Tests

### 1. YouTube video plays inside the shared sandbox
expected: The video plays inside the shared sandbox (allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox) on PC and phone; if not, add only the one allow-* flag it needs
result: pass

### 2. Picker close button looks right
expected: Settings → Цвет интерфейса → Свой: the × in the picker header is a clean 24×24 button with a visible × on PC and phone (code review WR-01 suspects it is stretched to ~24×54 with a clipped glyph)
result: issue
reported: "Плохо, потому что твоя система тоже, то, что мягко менять цвет, я думаю, все-таки сделать так, чтобы человек мог бы менять полностью цвет независимо от того, типа, черный, либо этот. Просто если и делать, типа, легкая смена цвета, то сделать его чтобы он напоминал на тот цвет. То есть, если это черный, то делать там темно-серым, но никак не бирюзовым, который сейчас показано." (owner screenshot: HEX #0D0D0D picked, «Свой» swatch and accent render teal; the × close button in the picker header is drawn as a tall narrow ~24×60 box)
severity: major

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-10-2
  truth: "The «Свой» picker's × close button is a clean 24×24 button with a visible × on PC and phone"
  status: failed
  reason: "User reported (screenshot): the × close button in the picker header is a tall narrow box, not 24×24 (code review WR-01: `.setting-options button` min-height 54px / padding 10px also matches the picker's close button)"
  severity: cosmetic
  test: 2
  root_cause: "`.setting-options button` (app/portia.css:294 — min-height 54px, padding 10px, flex) is a descendant selector; plan 10-03 placed the custom colour picker inside `.setting-options`, so the rule also styles the picker's header × button, stretching it to ~24×54 with the glyph squeezed (code review WR-01, confirmed by the owner's screenshot)"
  artifacts:
    - path: "app/portia.css"
      issue: "line 294 `.setting-options button` (and :297-298 hover/selected) match every descendant button, including the picker's close button"
    - path: "components/portia-desktop.tsx"
      issue: "the custom picker panel (with its × button) is rendered inside the `.setting-options` container"
  missing:
    - "Scope the option-button rules to direct children (`.setting-options > button`) or move the picker out of `.setting-options`, so the × keeps its own 24×24 styling"
  debug_session: ""

- gap_id: G-10-2b
  truth: "A custom accent follows the colour the owner picked: an achromatic pick (black, grey, white) gives a neutral grey accent, never teal; readability adjustments only shift lightness/chroma toward the picked colour and keep its hue family"
  status: failed
  reason: "User reported: Плохо ... сделать так, чтобы человек мог бы менять полностью цвет независимо от того, типа, черный, либо этот. ... если это черный, то делать там темно-серым, но никак не бирюзовым, который сейчас показано. (HEX #0D0D0D → teal accent)"
  severity: major
  test: 2
  root_cause: "deriveAccentTokens (lib/accent-custom.ts) implements the D-05 / UI-SPEC clamp contract: any pick with OKLCH chroma < 0.02 has its hue replaced by Portia teal 180.4 (:57), and chroma is floored at 0.08 (:59-60, also fit's floor), so black/grey/near-neutral picks (22.5% of the picker board) become saturated teal #489688 and 57.6% of picks get chroma lifted. All companion tokens (dim/grid/base/deep, --accent-hue, spider/Vivian filters) inherit that teal hue. Only the lightness clamp (0.62-0.80) is a real readability need — an L 0.62 neutral (#868686) passes 4.5:1 on --bg and --panel-2"
  artifacts:
    - path: "lib/accent-custom.ts"
      issue: ":57 hue fallback to 180.4 when C < 0.02; :59-60 chroma floor 0.08; :62-65 companion tokens use teal H and fixed chroma; :69-93 filterFor is hue-only with saturate >= ~0.3, so it cannot produce a neutral spider/Vivian"
    - path: "lib/accent-theme.test.ts"
      issue: ":321-327 asserts a grey pick gets hue 180.4 and chroma >= 0.07 (the bug pinned as a test); :291-319 sweep checks hue match / spider within 10° that are meaningless for neutral output"
    - path: ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-CONTEXT.md"
      issue: "D-05 'clamp lightness and saturation… a grey pick still gets a usable accent' must be superseded by the owner's fidelity rule"
    - path: ".planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-UI-SPEC.md"
      issue: ":92 C clamp 0.08-0.17, :101 grey pick uses hue 180.4, :188 grey/near-black edge row encode the current behaviour"
    - path: "app/portia.css"
      issue: "~315 `oklch(L C var(--accent-hue))` sites hard-code chroma 0.007-0.049, so a neutral accent still leaves a faint tint unless a chroma-scale token is added (planner decision)"
  missing:
    - "Keep the pick's own hue whenever measurable; treat only near-zero chroma (rounding noise) as neutral with C = 0 and a fixed numeric --accent-hue"
    - "Remove the 0.08 chroma floor (C = min(pick C, 0.17), gamut fit only reduces it); keep the L readability clamp so black → readable dark grey (#868686 text, --teal-dim ~#5d5d5d)"
    - "Companion tokens and glow/base/deep at the pick's own chroma (neutral → grey, not #020c09)"
    - "Chroma-aware filterFor: neutral accent → saturate(0) spider/Vivian; weak chroma scales saturation down"
    - "Decide chrome tint for neutrals (chroma-scale token vs. accept faint tint)"
    - "Invert the grey test; add #0d0d0d neutral + contrast, continuity across the old 0.02 cliff (#180d0d vs #1c0d0d), low-chroma hue fidelity (#3a3a42 keeps ~286); amend D-05 and the UI-SPEC clamp table"
  debug_session: ".planning/debug/custom-accent-black-turns-teal.md"
