---
phase: PORTIA-05-oformlenie-teksta
plan: 02
subsystem: ui
tags: [react, rich-text, editor, phone, selection, node-test]
status: complete

requires:
  - phase: PORTIA-05 plan 01
    provides: resolveRange, style row, lib/rich-text-style.ts
provides:
  - nextFieldSelection(stored, incoming, touchedField) in lib/rich-text-style.ts
  - phone selection and its highlight stay on the same text after every panel tap
  - phone highlight paints the selection or the word under the caret
  - compact phone panel: style row on top, tabs Цвет / Размер / Фон
affects: [05-03, 05-04, 05-05]

actuals:
  tokens: 5200
  tasks: 2
  commits: 3
plan_head_before: 8fa6d20cfd2ad3e88c20efcd514a4f1444d8ec4b
plan_head_after: a8694ece39bc295100eae1ae5b4afb0f43ad2a00

tech-stack:
  added: []
  patterns:
    - "a lost or untouched collapsed selection never replaces the stored one; a field touch or a new non-empty selection does"
    - "phone tabs are pure CSS: data-tab on the toolbar, data-tab-group on each control"

key-files:
  created: []
  modified: [lib/rich-text-style.ts, lib/rich-text-style.test.ts, components/portia-editor.tsx, app/portia.css]

key-decisions:
  - "05-02: a missing or untouched collapsed selection never replaces the stored one (nextFieldSelection, D-05)"
  - "05-02: phone panel tabs Цвет / Размер (size + weight) / Фон (background, opacity, preview surface) (D-12)"

requirements-completed: []
---

# Phase 5 Plan 2: Phone selection and compact panel Summary

On a phone the selection and its highlight now stay on the same text after every panel tap (so the bottom weight buttons keep working), and the phone panel is compact: style row always on top, tabs «Цвет / Размер / Фон» with one open.

## Accomplishments

- `nextFieldSelection` in `lib/rich-text-style.ts`: missing incoming selection keeps the stored one (zero caret when nothing is stored); a collapsed incoming selection that no touch in the field caused keeps a stored non-empty one; everything else wins.
- `selectionOffsets` returns `null` for no range or a range outside the field (it used to report a caret at 0, which made a lost selection look real). Enter, paste and input fall back to `selectionRef.current`, then the end of the text.
- `FormattedTextarea`: `touchedRef` set by pointerdown on the field; `activate` stores `nextFieldSelection(selectionRef.current, selectionOffsets(editor), !phonePanelOpen || touchedRef.current)`. On PC behaviour is unchanged.
- Panel `<section>` `onPointerDown` calls `preventDefault` unless the target is inside an `input`, so tapping a style button keeps focus and the DOM selection in the field, like the ✎ launcher.
- Phone highlight paints `resolveRange(...)` (selection or word under the caret) and keeps it above the panel; falls back to the field rect when the range is null.
- Phone tabs: `div.format-tabs` (role tablist) between the style row and the toolbar; toolbar `data-tab`; every control carries `data-tab-group` (Цвет текста and the custom colour picker for text = color; Размер and Толщина = size; Фон текста, Плотность фона, Фон предпросмотра and the custom background picker = background). CSS shows one group at a time at max-width 900px, toolbar is one column (also at 430px); desktop hides the strip. Panel max-height and its page padding are untouched.
- Owner weight-button concern: the repeated-tap test applies weight 800, Заголовок, weight 400 and Важно in a row on one selection while every tap reports a lost then a collapsed selection, and the stored selection stays put. D-13 lines (blur once on ✎, inputMode none) are unchanged.

## Task Commits

| Task | Commit | Note |
|------|--------|------|
| 1 RED | 13f0a61 | failing nextFieldSelection + repeated-tap tests, inert stub |
| 1 GREEN (tracer) | 2dd5dd5 | policy, null selection, touch flag, panel pointerdown, highlight of the effective range |
| 2 | a8694ec | phone tabs, data-tab-group, CSS |

## Deviations from Plan

None - plan executed as written, with the owner amendment applied (no «Жирный»; the plan's human-check text already says bottom weight). The repeated-tap test was added on the owner's request.

## Verification

- `npm test` 170 pass, `npx tsc --noEmit`, `npm run lint` (0 errors, 14 pre-existing warnings), `npm run build` pass.
- Node checks print "phone selection tracer OK" and "phone tabs OK".
- The device checks (D-05 on a phone, D-12/D-13 layout and keyboard rule) were NOT run: the editor needs login and the touch event order cannot be reproduced here. Both human-check scripts in 05-02-PLAN.md remain for the owner. SAVE was never pressed; no content was written.
- Mechanism of the owner bug stays MEDIUM confidence (RESEARCH §4); the fix is layered (preventDefault on panel taps, stored selection policy, null-aware reads), so the device check is the proof.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: lib/rich-text-style.ts, lib/rich-text-style.test.ts, components/portia-editor.tsx, app/portia.css
- FOUND commits: 13f0a61, 2dd5dd5, a8694ec
