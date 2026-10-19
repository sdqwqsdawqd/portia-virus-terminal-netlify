---
phase: PORTIA-05-oformlenie-teksta
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/editor-field-look.test.ts
  - lib/panel-position.test.ts
  - lib/panel-position.ts
  - lib/rich-text-style.test.ts
  - lib/rich-text-style.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase PORTIA-05: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard (diff `3ab8124..HEAD` plus surrounding context)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

I read the diff for the portia-editor.tsx selection flow, the new lib modules and the CSS/desktop changes. The 38 unit tests in `lib/*.test.ts` pass. The pure helpers (`resolveRange`, `wordRangeAt`, `togglePreset`, `clampPanelOffset`, `parsePanelOffset`) look correct. The risk is in the glue between the DOM events and `nextFieldSelection`, which no test covers. The phone fix for the owner's weight-button bug depends on a one-shot `touchedRef` flag. That flag is consumed too early and can also go stale, so the old failure mode can return on a phone and a control can act on an old range. The `assistant` area still has enabled controls that do nothing.

## Structural Findings (fallow)

None provided.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `touchedRef` is a one-shot flag; phone selection can stay stale or be dropped

**File:** `components/portia-editor.tsx:1757-1759` (also `1806`, `selectionOffsets` at `385`) and `lib/rich-text-style.ts:627-631`
**Issue:** On a phone, `nextFieldSelection` keeps the stored non-collapsed range whenever a collapsed incoming selection arrives with `touchedField === false`. `touchedField` comes from `touchedRef`. That ref is set on `pointerdown` and cleared by the first `activate()` call, whichever event triggers it (`onFocus`, `onSelect` or `onMouseUp`). Three paths follow from this.

1. **Flag consumed by the wrong event.** A tap in the field fires `pointerdown`, then `onFocus` or an early `onSelect`. Those events can still carry the old selection, or null. The flag is spent there. The later `onSelect` or `onMouseUp` with the real new caret arrives with `touchedRef === false`, is collapsed, and `stored` is the old range. So `nextFieldSelection` returns the old range, and the panel keeps formatting and highlighting text the user just deselected.
2. **Stale range on re-entry.** `selectionRef` is never cleared on blur or when another field becomes active. When the user returns to a field they had selected in, `selectionOffsets` is null at `onFocus` (the selection is still in the other field). The `!incoming` branch then returns the old `stored` range regardless of `touchedField`. That range is followed by the same rejection as in path 1. The panel therefore acts on a selection from an earlier visit.
3. **Flag never cleared.** If the flag is set but no `activate` follows, it stays `true`. This happens when the user drags the field to scroll and the browser fires `pointercancel`. A later phone drop of the selection after a panel tap then passes `touchedField === true`, so the collapsed selection is accepted. `resolveRange` then picks a word or null, and the controls hit the wrong word or are disabled. This is the original owner bug again.

The tests (`nextFieldSelection keeps...`) only exercise the pure function with a hand-set boolean, not this event ordering.

**Fix:** Do not use a consume-on-first-event flag.
```tsx
// onPointerDown: touchedRef.current = true;
// onPointerUp / onPointerCancel / onBlur: window.setTimeout(() => { touchedRef.current = false; }, 400);
// Do NOT clear it inside activate().
// onBlur: selectionRef.current = null;   // no resurrected range on re-entry
```
In `nextFieldSelection`, also treat a `!incoming` result with `touchedField` as "nothing known" rather than returning an old range. Add a jsdom or Playwright test for tap, tap-elsewhere and scroll sequences.

## Warnings

### WR-01: Enabled controls that do nothing for the `assistant` area

**File:** `components/portia-editor.tsx:2007-2013`; `app/portia.css:626`
**Issue:** For `area === "assistant"` the site ignores colour, size and weight. The CSS forces `color/font-size/font-weight: inherit !important` on the field's spans. The colour, size and weight buttons stay enabled (`disabled={!range}` only), apply styles, and the field looks unchanged. That is the "manual control silently does nothing" pattern the owner reported. A one-line note is the only signal, and on a phone it sits in every tab.
**Fix:** Disable the controls the area ignores, for example `const ignoresLook = target.area === "assistant"`, and use `disabled={!range || ignoresLook}` for the colour, size and weight groups. Keep the note.

### WR-02: Readout and "selected" state disagree with what is rendered (defaults 17 / 400)

**File:** `components/portia-editor.tsx:1854-1862, 2010-2011`
**Issue:** `fontSize` defaults to 17 and `fontWeight` to 400 for unstyled text. The areas actually render at 16, 14, 11 or 10 px (`app/portia.css:600-613`), and the assistant at weight 700. So "M" and "ОБЫЧНЫЙ" show as selected on unstyled text. Pressing "M" then changes a 14 px trash field to 17 px, an unexpected jump. The comment at `1854` claims that a repeat click on a manual control is a no-op. `applyStyle` always commits and writes explicit `fontSize`/`fontWeight` runs, which also flips `rangeIsPlain` to false, so "Обычный" stops being marked.
**Fix:** Derive the "selected" state only from explicit style (`style.fontSize === size`, no default). Or skip the commit when the value is already the effective value.

### WR-03: `selectionOffsets` null path falls back to `{0,0}`, so the first word is targeted

**File:** `lib/rich-text-style.ts:628`; `components/portia-editor.tsx:1757`
**Issue:** If the first `activate()` call (for example `onFocus` before the browser has placed the caret) has `incoming === null` and nothing is stored, the result is `{start:0,end:0}`. `resolveRange` now turns this into the first word. The panel highlights it and offers to restyle it, although the user pointed at nothing. Before this change a caret at 0 meant "whole text". The comment on `selectionOffsets` says a lost selection "must not look like a caret at 0", but the fallback in `nextFieldSelection` does exactly that.
**Fix:** Allow `target.selection` to be null, or store `{start:-1,end:-1}` and make `resolveRange` return null for it. This gives "ВЫДЕЛИТЕ ТЕКСТ" and disabled controls until a real selection exists.

### WR-04: `preventDefault` on `pointerdown` may not keep focus or selection, and the editor no longer shows its selection on a PC

**File:** `components/portia-editor.tsx:1985` (panel `onPointerDown`)
**Issue:** The fix assumes `preventDefault()` on `pointerdown` stops the focus change and the selection clearing. In Chromium and WebKit, canceling `pointerdown` suppresses the compatibility mouse events but does not reliably stop the default focus move (the usual fix is `onMouseDown`). I could not verify this without running a real device, so please test it on iOS Safari and Chrome Android. If it fails, the editor loses focus on the first button tap. Then `restoreSelection` (`if (activeElement !== root) return`, line 444) does nothing after the re-render, and the visible selection in the field disappears. Only the state-held `target.selection` keeps working. No highlight is painted on a PC, since the effect returns early above 900 px. The user then sees no indication of which text will be changed.
**Fix:** Add `onMouseDown={(e) => { if (!(e.target as HTMLElement).closest("input")) e.preventDefault(); }}` next to the pointer handler. Also paint the Highlight on a PC, or make `restoreSelection` focus the field with `{preventScroll:true}`.

### WR-05: `matchMedia("(max-width: 900px)")` duplicated and the dragged place is not re-clamped when storage is blocked

**File:** `components/portia-editor.tsx:401, 873, 908, 1878, 1906, 1940, 1959`
**Issue:** The 900 px breakpoint is hard-coded in at least five places and must match the CSS. In `place()`, a drag that could not be saved (`localStorage` blocked) is not re-clamped when the parent resizes, because `saved` is null. The panel can then sit partly outside the window. `beginDrag` also starts a drag for any pointer button, including right-click.
**Fix:** Keep the last painted offset in a ref and re-clamp that when storage returns null. Add `if (event.button !== 0) return;` in `beginDrag`. Move the query into one `const phoneQuery = "(max-width: 900px)"`.

## Info

### IN-01: Readout and "selected" use only the first character of a range

**File:** `components/portia-editor.tsx:1856`
**Issue:** `richTextStyleAt(doc, range.from)` for a mixed range shows the first character's colour/size/weight as the current one, while the preset buttons use `rangeHasStyle` (every character). The two kinds of state can disagree for the same selection.
**Fix:** Show a "mixed" state, or use `rangeHasStyle` for the manual controls as well.

### IN-02: Rarely-hit input cases

**File:** `lib/rich-text-style.ts:600, 619`
**Issue:** Offsets are UTF-16 code units, so a selection that ends inside a surrogate pair can split an emoji style. `wordPattern` splits decimals ("3.5" becomes 3 and 5). The `togglePreset` call for "Важно" also removes an independently chosen `fontWeight`.
**Fix:** Acceptable for now. If wanted, snap offsets to code point boundaries and add `.` between digits to the word pattern.

### IN-03: `editor-field-look.test.ts` is a CSS text parser

**File:** `lib/editor-field-look.test.ts`
**Issue:** The test parses `app/portia.css` with regular expressions to keep the editor and site colour pairs equal. It passes today but will break on a harmless reformat of the CSS. Nothing tests the events or the DOM path (see CR-01).
**Fix:** Keep it, but add a component-level test for the selection flow.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
