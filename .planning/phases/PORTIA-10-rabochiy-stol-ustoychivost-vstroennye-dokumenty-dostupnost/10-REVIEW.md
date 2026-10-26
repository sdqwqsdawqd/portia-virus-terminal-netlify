---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - app/portia.css
  - components/portia-editor.tsx
  - lib/accent-custom.ts
  - lib/accent-theme.test.ts
  - lib/editor-field-look.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 10: Code Review Report (incremental, gap-closure plans 10-08 and 10-09)

**Reviewed:** 2026-10-26
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Prior review

This file replaces the earlier phase-10 review. Its findings and how each was resolved are tracked in `10-REVIEW-DISPOSITION.md` in this directory. This pass covers only the diff `305976d..HEAD` for the files listed above.

## Summary

The diff adds an `--accent-chroma` token. Every accent tint in `portia.css` and `baseInk` is now `calc(C * var(--accent-chroma))`. `deriveAccentTokens` keeps the pick's own hue and chroma and corrects only lightness. Exact greys give a neutral theme. The `.setting-options > button` selector no longer matches the buttons inside the colour picker. The unused `--assistant-glow` is removed.

I checked these points:
- `node --experimental-strip-types --test lib/accent-theme.test.ts lib/editor-field-look.test.ts` passes, 38 of 38. (Under `tsx` the boot-script test fails with `__name is not defined`. That comes from esbuild's name-keeping and the project's real runner is not affected.)
- Every `var(--accent-hue)` use in `app/`, `components/` and `lib/` is scaled. Only the five files above reference the token.
- `accentTokenNames` now includes `--accent-chroma`. The desktop effect clears it when the accent switches back to a preset, so no stale inline value survives.
- The boot script embeds `deriveAccentTokens` through `toString()`. The new code uses no outside names, so it stays self-contained.
- No security issues. The input is still validated by `/^#[0-9a-f]{6}$/i`, the iteration counts are fixed, and nothing user-controlled is interpolated into the boot script.

No blockers. There are two robustness and verification gaps and one cleanup.

## Warnings

### WR-01: Loop variable `k` shadows the new accent-strength `k` inside `filterFor`

**File:** `lib/accent-custom.ts:86` (outer `k` at line 66, used at lines 77, 81 and 100)
**Issue:** The new strength scalar `const k` (line 66) is shadowed by `for (let k = 3; k <= 25; k++)` in the coarse saturation search. The code is correct today. `score` closes over the outer `k`, the inner `k` is block-scoped, and `bestS * k` on line 100 sits outside the loops. Any edit that moves `score(...)` or the final return into that loop silently swaps "saturation step" for "accent strength". Nothing would throw. The hue-matching filters for the spider and Vivian would just be wrong, and the tests only check hue distance and grey invariance. Because the function body is serialised into the boot script, linters and reviewers cannot lean on a module-level view of it.
**Fix:** Rename the loop variable.
```ts
for (let step = 3; step <= 25; step++) {
  const sc = score(d, step / 10);
  if (sc < best) { best = sc; bestD = d; bestS = step / 10; }
}
```
The second loop already uses `ks`, so this is consistent.

### WR-02: Readability is only tested against `--bg`, but accent text also sits on `--panel` and `--panel-2`

**File:** `lib/accent-custom.ts:59-61` (the lightness clamp 0.62 to 0.80) and `lib/accent-theme.test.ts:311-340`
**Issue:** The test asserts WCAG contrast >= 4.5 of `--teal` only against `oklch(.163 ...)` (`--bg`). The stylesheet puts `--teal` text on `--panel` (.201) and `--panel-2` (.229) as well. The lightness floor of 0.62 leaves about 0.1 contrast ratio of margin against `--bg`. For some hues, where relative luminance at a given OKLCH L is lower, the lighter panels fall below 4.5. A brute-force sweep of hue (every 5 degrees) with saturation {.3,.6,1} and value {.3,.6,1] gave a minimum of 4.26 for the pick `#990040`, whose `--teal` is `#d65073`. The 432-pick grid test and the preset sweep do not catch this, so the "stays readable" claim is not verified for the surfaces that carry most of the text. This is not a regression from 10-08 or 10-09, since the clamp predates them. The new test restructuring does rewrite those assertions without widening them.
**Fix:** Either raise the lightness floor (for example 0.66) or extend the test to the three surfaces.
```ts
for (const [sl, sc] of [[0.163, 0.014], [0.201, 0.018], [0.229, 0.021]]) {
  const bg = oklchToRgb(sl, sc * scale, Number(t["--accent-hue"])).map((v) => Math.min(255, Math.max(0, v))) as Rgb;
  assert.ok(contrast(teal, bg) >= 4.5, `${pick}: contrast on L${sl} ${contrast(teal, bg).toFixed(2)}`);
}
```
If the floor stays at 0.62, the test should state 3:1 for large text, or lower the claim.

## Info

### IN-01: Test duplicates the regex literal and walks the filesystem for a one-line invariant

**File:** `lib/accent-theme.test.ts:201-212`
**Issue:** "every accent tint follows --accent-chroma" builds its own recursive `sources` walker and derives display names with `file.pathname.split("/").slice(-2)`. On Windows, `URL.pathname` still uses forward slashes, so it works. The same scaled-tint regex also appears in the gamut test (line 191) as a separate literal. If the tint syntax changes, the two copies can drift apart and one test would pass vacuously. The gamut test would match zero tints and loop over nothing.
**Fix:** Share one regex constant, and add `assert.ok(matches.length > 0)` to the gamut test so an empty match fails loudly.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
