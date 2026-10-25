---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/portia.css
  - components/custom-color-picker.tsx
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/accent-boot.ts
  - lib/accent-custom.ts
  - lib/accent-theme.test.ts
  - lib/portia-desktop.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-26
**Depth:** standard (diff 342b3f2..HEAD)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the custom accent feature (picker extraction, `deriveAccentTokens`, boot-script embedding), the desktop robustness changes (topZ ref, assistant tip handling, sandboxed frames, zoom modifier handling) and the a11y changes. No security or data-loss defects found. Checks that passed:

- `npx tsc --noEmit` is clean.
- `npm test`: 302 of 302 pass.
- `next build` succeeds. I extracted the boot script from the built `.next/server/app/index.html` and ran it against a stored `#ff3366` custom accent. It is self-contained after minification and sets all 10 tokens, so `Function.prototype.toString` embedding survives the production build.
- Hostile `customAccent` values are rejected by the hex regex both in the boot script and on restore.
- The hue-rotate/saturate matrices match the CSS Filter Effects spec.
- The `fit` loop always terminates.

The defects are one CSS regression in the moved picker, an incomplete ARIA pattern, and a keyboard-inaccessible picker board.

## Warnings

### WR-01: Picker close button is distorted inside the settings grid (CSS selector leak)

**File:** `app/portia.css:294` (leaks into `app/portia.css:678`), rendered from `components/portia-desktop.tsx:1405-1411`
**Issue:** The picker is now a descendant of `.setting-options`. The rule `.setting-options button { min-height: 54px; display:flex; padding:10px; ... }` therefore also matches the picker's "x" close button (`.custom-color-picker-head button`). Both selectors have specificity (0,1,1). The later rule only sets `width/height:24px`, so `min-height:54px` wins and the button becomes 24x54. With `box-sizing:border-box` and 10px padding, the content box is about 2px wide, so the glyph is clipped or overflows. `.setting-options button:hover` (0,2,1) also overrides the picker button's hover colours. The picker only worked in the editor before, where this rule does not apply.
**Fix:** Scope the settings rule to direct children, or reset the picker button:
```css
.setting-options > button { /* was: .setting-options button */ ... }
.setting-options > button:hover, .setting-options > button.selected { ... }
.setting-options > button.selected { ... }
```
Alternatively add `min-height:0; padding:0; display:block` to `.custom-color-picker-head button`. Check that `.color-options > button` (line 296) still wins.

### WR-02: Virus rows declare `role="option"` but have no listbox keyboard model

**File:** `components/portia-desktop.tsx:1244-1247`
**Issue:** `role="listbox"` plus `role="option"` and `aria-selected` promise the listbox interaction pattern (one tab stop, Up/Down/Home/End moving selection). The rows are plain `<button>`s, so each is a separate tab stop and arrow keys do nothing. Screen-reader users are told to use arrows and nothing happens. The `aria-selected` is accurate, but the pattern is half-implemented. The test in `lib/portia-desktop.test.ts` only greps for the attributes.
**Fix:** Either implement roving tabindex and arrow handling on the container (`tabIndex={0}` on the active row, -1 on the others, `onKeyDown` for ArrowUp/ArrowDown/Home/End), or drop `role=listbox/option` and use `aria-current="true"` on the active row.

### WR-03: Colour board in the custom picker is pointer-only

**File:** `components/custom-color-picker.tsx:66-73`
**Issue:** The saturation/value board is a non-focusable `<div>` with only pointer handlers. Keyboard users can change hue (range) and type a hex, but cannot adjust saturation or brightness on the board. This phase is about accessibility, and the picker is now exposed in the always-visible settings window, not only the editor. The board also has no accessible name or role, and the thumb `<i>` is unlabelled.
**Fix:** Make the board `role="slider"` (or two sliders), give it `tabIndex={0}`, an `aria-label`, and `aria-valuetext`, and handle arrow keys in `choose(hue, saturation ± 0.02, value ± 0.02)`. Alternatively document that the hex field is the keyboard path and add `aria-hidden` to the board.

## Info

### IN-01: Clicking "Свой" immediately converts the current preset into a persisted custom accent

**File:** `components/portia-desktop.tsx:758-763`
**Issue:** `chooseCustomAccent` writes `accent:"custom"` and `customAccent:<current preset --teal>` and shows "saved" before the user picks anything. Opening and closing the picker permanently replaces, for example, "Янтарный" with an equivalent custom swatch. The visual change is nil (the custom derivation shifts the amber slightly), but the preset selection is lost. It also silently returns, with no feedback, if the computed `--teal` is not a 6-digit hex. That is fine today, but fragile if a preset ever uses a non-hex token.
**Fix:** Keep the seed in the draft only (`previewAccent(seed)`) and commit on the first real change, or at least fall back to a constant seed such as `#00bca6` when `deriveAccentTokens(seed)` fails.

### IN-02: Blur-commit fires prematurely when focus moves to a non-focusable area

**File:** `components/portia-desktop.tsx:1409`
**Issue:** `onBlur` commits when `relatedTarget` is null. Clicking the non-focusable board (and clicking buttons in Safari/Firefox on macOS, which do not take focus) gives `relatedTarget === null`. That commits the draft and flashes "saved" mid-interaction. This is harmless, since the `pointerup` commit already behaves the same way, but it produces duplicate save flashes.
**Fix:** Ignore the blur commit while a pointer is down in the picker, or commit only on `pointerup`, Escape, close and focus leaving to an element outside.

### IN-03: Embedded-frame sandbox relies on every `src` staying cross-origin; Sheets compatibility unverified

**File:** `components/portia-desktop.tsx:31`
**Issue:** `allow-scripts allow-same-origin` together neutralises the sandbox for any same-origin document. This is safe for the current docs.google.com, github.io and youtube-nocookie sources only. The Google Sheets `htmlview` and charter frames have no automated or visible check that the restricted flags (no `allow-modals`, `allow-presentation`, or top-navigation-by-user-activation) do not break them. The new test only greps the string.
**Fix:** Add a comment or assertion that `src` must never be same-origin, and manually verify the Sheets and charter embeds in a built bundle.

### IN-04: Source-grep tests are brittle

**File:** `lib/portia-desktop.test.ts`, `lib/accent-theme.test.ts:350-358`
**Issue:** Many new tests assert regexes over the component source (exact attribute order, `const virusListbox = ...;` literal, one-line `<button ...>` matches, `source.slice(... indexOf("\nfunction "))`). Cosmetic refactors will fail them, while behavioural regressions (for example WR-01 and WR-02) are not caught. `navigator.platform` (used by `zoomModifier`) is deprecated; `navigator.userAgentData?.platform ?? navigator.platform` is more future-proof.
**Fix:** Keep the pure-function behaviour tests (`deriveAccentTokens`, boot execution). Move DOM-behaviour checks to a component-level test, or accept the brittleness explicitly.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
