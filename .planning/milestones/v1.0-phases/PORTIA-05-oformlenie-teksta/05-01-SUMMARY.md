---
phase: PORTIA-05-oformlenie-teksta
plan: 01
subsystem: ui
tags: [react, rich-text, editor, node-test]
status: complete

requires:
  - phase: PORTIA-03
    provides: rich-text runs, FloatingTextFormatPanel, target.onCommit undo path
provides:
  - lib/rich-text-style.ts, a pure tested module of explicit-range style helpers
  - format panel row «Обычный / Заголовок / Важно» that toggles like Word
  - every panel control acts on one resolved range (selection, else the word under the caret)
  - «Основной» as the first text colour swatch (removes the colour property)
affects: [05-02, 05-03, 05-04, 05-05]

actuals:
  tokens: 6850
  tasks: 3
  commits: 6
plan_head_before: 3ab812497e53b21169177ece20cfc275a23db215
plan_head_after: a1766d7d6c9d116047febb8a33dc0b83a4f45659

tech-stack:
  added: []
  patterns:
    - "style math lives in lib/rich-text-style.ts with explicit [from, to) ranges; an empty range is a no-op"
    - "one resolveRange(text, selection) feeds every panel control; null disables them"

key-files:
  created: [lib/rich-text-style.ts, lib/rich-text-style.test.ts]
  modified: [components/portia-editor.tsx, app/portia.css]

key-decisions:
  - "05-01: style helpers live in lib/rich-text-style.ts with explicit ranges; an empty range is a no-op (D-04)"
  - "05-01: row styles toggle by removing only their own keys (D-02)"
  - "05-01: «Основной» removes the colour property (D-18)"
  - "05-01: «Жирный» is not in the style row (owner amendment to D-01); weight is changed only by the manual ОБЫЧНЫЙ / СРЕДНИЙ / ЖИРНЫЙ buttons"

requirements-completed: [TEXT-01]
---

# Phase 5 Plan 1: Style row, word target and «Основной» Summary

One-click style row «Обычный / Заголовок / Важно» that toggles like Word, with every panel control (weights included) acting on the selection or the word under the caret, built on a pure tested style module.

## Accomplishments

- `lib/rich-text-style.ts`: `compactRuns`, `expandStyles`, `richTextStyleAt`, `applyRichTextStyle`, `resetRichTextStyle` moved out of the editor with explicit-range semantics (the old caret-to-whole-field fallback is deleted). New: `rangeHasStyle`, `rangeIsPlain`, `removeRichTextStyleKeys`, `togglePreset`, `wordRangeAt`, `resolveRange`, `stylePresets` (`heading` 22/800, `important` #b43632/600).
- Panel row «Обычный / Заголовок / Важно» with `selected` + `aria-pressed` when every character of the range carries the style; a second press removes only that style's keys.
- Every manual control (colour, size, weight, background, opacity, custom-colour buttons) commits through one range-checked `applyStyle`; all are disabled only when the resolved range is null. The readout (including the selected weight) is read at the resolved range.
- Header now `N ЗНАК.` / `СЛОВО: «…»` / `ВЫДЕЛИТЕ ТЕКСТ`; footer says «Без выделения меняется слово под курсором.»; launcher hint reworded; the footer reset button is gone (its job is «Обычный»).
- «Основной» is the first text swatch, painted with the base ink for the preview surface; graphite and light-grey swatches removed (stored colours untouched, no migration).
- 168 tests pass (14 new in `lib/rich-text-style.test.ts`).

## Task Commits

| Task | Commit | Note |
|------|--------|------|
| 1 RED | e4ef018 | failing tests + inert scaffold |
| 1 GREEN (tracer) | ec7e8b6 | row with one «Жирный» button |
| plan amendment | 32af6e2 | drop «Жирный» per owner (CONTEXT D-01 + 05-01-PLAN) |
| 2 RED | 8d331c8 | word/range/plain/no-bold/weights tests |
| 2 GREEN | 6a6f434 | full row, resolved range everywhere, texts |
| 3 | a1766d7 | «Основной» swatch |

## Deviations from Plan

### Owner decision at the tracer checkpoint

**1. [Checkpoint resolution] «Жирный» dropped from the row.** The owner rejected the tracer as built: «Жирный» duplicates the manual «Толщина» (ЖИРНЫЙ = 800), and the owner reported the bottom weight buttons "do not work". CONTEXT D-01 and 05-01-PLAN were amended first (32af6e2), then `stylePresets.bold` and the button were removed in Task 2 and the Task 1 tests that used bold now use `stylePresets.heading`. Task 1's body in the plan is kept as history with a note.

**2. [Rule 1 - Bug] Weight buttons silently did nothing.** Diagnosed, not reproduced in a browser (the editor needs login). After Task 1 `applyRichTextStyle` is a no-op on a collapsed range, so with a bare caret every manual control did nothing while the footer still said the whole text changes. Fix: all controls go through `resolveRange` (selection, else word under the caret), are disabled only when it is null, and the footer text is corrected. Test `weights 400/600/800 apply through the resolved range ...` covers a selection and a caret inside a word. If the owner's failure was the phone losing the selection after a tap, that is D-05 in plan 05-02, not fixed here.

### For the orchestrator

- `05-02-PLAN.md` still names «Жирный» in the row: line 156 (human-check test steps «подряд «Жирный», «Важно», «Заголовок» и снова «Жирный»») and line 207 (expected «ряд «Обычный / Заголовок / Жирный / Важно»»). Not edited, per instructions; those lines should read «Обычный / Заголовок / Важно» before 05-02 is executed or verified. 05-03..05-05 have no such mentions.

## Verification

- `npm test`, `npx tsc --noEmit`, `npm run lint` (0 errors, 14 pre-existing warnings), `npm run build` all pass.
- Plan node checks print "bold tracer OK", "style row and word target OK", "base colour swatch OK"; `lib/portia-content.ts` and `lib/portia-content-normalize.ts` have no diff.
- The human checks (row toggling, caret word, weight buttons, «Основной» palette) are not run in a browser by this executor; SAVE was never pressed and no content was written.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: lib/rich-text-style.ts, lib/rich-text-style.test.ts, components/portia-editor.tsx, app/portia.css
- FOUND commits: e4ef018, ec7e8b6, 32af6e2, 8d331c8, 6a6f434, a1766d7
