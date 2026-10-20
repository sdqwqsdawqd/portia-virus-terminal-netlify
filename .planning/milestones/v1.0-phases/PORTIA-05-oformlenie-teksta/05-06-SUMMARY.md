---
phase: PORTIA-05-oformlenie-teksta
plan: 06
subsystem: ui
tags: [react, selection, touch, rich-text, gap-closure]
status: complete

requires:
  - phase: PORTIA-05 plans 01-05
    provides: rich-text style panel, nextFieldSelection / resolveRange, FormattedTextarea
provides:
  - fieldSelectionStep: pure own-input window and selection policy of one field (CR-01)
  - unknown selection is null; panel shows «ВЫДЕЛИТЕ ТЕКСТ» and disables every control, never targets the first word (WR-03)
  - panel taps prevent pointerdown and mousedown defaults; target text highlighted at every width (WR-04)
  - size and weight marks show explicit values only (WR-02)
  - 05-REVIEW-DISPOSITION.md with no open finding
affects: [PORTIA-05 end-of-phase verification]

actuals:
  tokens: 3800
  tasks: 3
  commits: 3
plan_head_before: 0185b02ec854527133a54ed1db4a96a579146c15
plan_head_after: 76436b84599e120fb33f35b4b12d8c7b157b4a4a

tech-stack:
  added: []
  patterns:
    - "Selection policy as a pure step function over events (down/up/blur/read), tested with node:test, wired by a thin track(event) in the component"

key-files:
  created: []
  modified:
    - lib/rich-text-style.ts
    - lib/rich-text-style.test.ts
    - components/portia-editor.tsx
    - .planning/phases/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md

key-decisions:
  - "05-06: a field's selection follows own input (pointerdown or keydown until 400 ms after release, closed on blur); a reading never ends it (fieldSelectionStep, CR-01)"
  - "05-06: an unknown selection is null and disables the panel controls (WR-03)"
  - "05-06: panel taps prevent the mousedown default too; the portia-format highlight paints at every width (WR-04)"

requirements-completed: [TEXT-01]
---

# Phase 5 Plan 6: Selection follows the real touch order (gap closure) Summary

The field's stored selection now follows the user's own input in real event order, so the phone's bottom «Толщина» buttons (and every other style control) act on the text the user sees highlighted; an unknown selection is null instead of the first word.

## Tasks

| Task | Commit | What |
|------|--------|------|
| 1 RED | d2d6a0c | Nine `event order:` tests for the selection policy (tap, tap elsewhere, scroll, blur re-entry, caret kept without own input). |
| 1 GREEN | f33d323 | `fieldSelectionStep(state, event)` with `FieldSelectionState {stored, ownUntil}`; own input opens on pointerdown/keydown, closes 400 ms after pointerup/keyup, at once on pointercancel and blur; `read` never ends it. `nextFieldSelection` returns null for nothing known and keeps a stored caret without own input; `resolveRange(text, null)` is null; `FormatTarget.selection` is nullable; FormattedTextarea `selectionRef` holds the state and `track(event)` feeds it; activate sends only `read`. |
| 2 | 76436b8 | `keepFieldFocus` on the panel's onPointerDown and onMouseDown (inputs excepted); `portia-format` highlight at every width with `paintFrom` / `paintTo` deps and keepVisible phone-only; size and weight marks from explicit style only; dispositions recorded for all nine findings. |
| 3 | (checkpoint) | Owner device check, see below. No code. |

## Task 3 device check (checkpoint:human-verify)

Owner answer: «approved». Per the owner, steps 0-6 all passed:

| Step | Scenario | Result |
|------|----------|--------|
| 0 | dev server on PC, phone opened the Network address and logged in | passed |
| 1 | select a word, ✎, Важно / Заголовок / Толщина ЖИРНЫЙ-СРЕДНИЙ-ОБЫЧНЫЙ | passed: same word stays highlighted, each style lands only on it |
| 2 | touch another word (first touch after ✎), then another, ЖИРНЫЙ then СРЕДНИЙ | passed: highlight moves to the last touched word, both styles land on it |
| 3 | scroll by swipe, then ОБЫЧНЫЙ | passed: style on the highlighted word, not the first word or whole field |
| 4 | touch another field, return and touch a word | passed: old selection does not come back, touched word styled |
| 5 | whole field never styled, first word never styled «by itself»; ГОТОВО returns the keyboard after a field touch | passed |
| 6 | PC wider than 900 px: select, ✎, Важно, ЖИРНЫЙ, click HEX field | passed: word stays visible as selected/highlighted; no size/weight button marked on unstyled text, ЖИРНЫЙ marked after ЖИРНЫЙ |

The per-step breakdown is the owner's single «approved» for steps 1-6, recorded per step as passed; no failure was reported, so no highlighted-text / landing-place report exists. СОХРАНИТЬ was not pressed; no automated step wrote content (no PUT to /api/content).

## Verification

- `npm test`: 202 pass; `npx tsc --noEmit`: clean; `npm run lint`: 0 errors; `npm run build`: OK (run at the end of Task 2).
- Plan node gates "selection event order OK" and "panel focus and dispositions OK" were part of the Task 1-2 verification.
- 05-REVIEW-DISPOSITION.md: `open: 0`.

## Deviations from Plan

None - plan executed as written.

## Deferred (recorded in 05-REVIEW-DISPOSITION.md)

WR-01 (assistant controls enabled but inert; D-19 is the owner's locked choice), WR-02 remainder («M» = 17 px jump on smaller areas, Phase 1 preset-size concern), WR-05 cleanup, IN-01..IN-03, and VERIFICATION human items 2-7 (stay with the end-of-phase verification).

## Known Stubs

None.

## Threat Flags

None. T-05-09 mitigated by the event-order tests and the null-when-unknown policy; T-05-10 held (no save, no PUT); T-05-SC held (no package installed).

## Self-Check: PASSED

- d2d6a0c, f33d323, 76436b8 are ancestors of HEAD; lib/rich-text-style.ts, lib/rich-text-style.test.ts, components/portia-editor.tsx and 05-REVIEW-DISPOSITION.md exist.
