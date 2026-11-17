---
phase: PORTIA-09-tselostnost-kontenta
plan: 05
subsystem: ui
tags: [editor, limits, content-integrity, node-test, a11y]

requires:
  - phase: PORTIA-09-tselostnost-kontenta
    provides: lib/content-limits.ts constants and the non-cutting normalizer (09-03)
provides:
  - limitStatus / limitText with LimitNote on table rows, blocks and subsections
  - oversizeFields / oversizeMessage savebar warning that never cuts text
  - contentBodyBytes / bodyTooLargeMessage and a blocked save above 5 MB
  - removeRecycledVirus / removeRecycleFile and a confirmed permanent delete from the Корзина
affects: [09-06, 09-07]

actuals:
  tokens: 9500
  tasks: 3
  commits: 6

plan_head_before: 47698319dd1e3f5f7c6511ada1fffb69d20d63f5
plan_head_after: 0089167b26d16b189dd2759acf0c63f2c856c1b1
commits: 6

tech-stack:
  added: []
  patterns:
    - "limit UI is derived from the draft: note text and disabled state come from limitStatus/limitText, so undo and delete update both at once"
    - "a shared always-in-DOM aria-live note referenced by aria-describedby on every limited add button"

key-files:
  created:
    - lib/content-limits.test.ts
  modified:
    - lib/content-limits.ts
    - lib/editor-items.ts
    - lib/editor-items.test.ts
    - components/portia-editor.tsx
    - app/portia.css

key-decisions:
  - "Bin file delete reuses the virus delete ConfirmDialog shape with a new dialog state delete-file"
  - "The format panel is closed before both permanent deletes, same as moveSelectedVirusToRecycle"
  - "Body-size check measures the draft with the longest possible revision, so it blocks slightly early rather than late"
  - ".limit-buttons got gap 8px (plan listed only flex/wrap/align) because the four buttons are now in one row"

requirements-completed: [CONT-01, CONT-03]

duration: 5min
completed: 2026-10-25
status: complete

coverage:
  - id: D1
    description: "limitStatus and limitText give free under 80%, n / max from 80% and МАКСИМУМ max at the limit"
    requirement: CONT-01
    verification:
      - kind: unit
        ref: "lib/content-limits.test.ts#limitStatus is free under 80%, counter from 80% and full at the limit"
        status: pass
      - kind: unit
        ref: "lib/content-limits.test.ts#limitText reads nothing, n / max, or МАКСИМУМ max"
        status: pass
    human_judgment: false
  - id: D2
    description: "oversizeFields names too-large fields in editor order; oversizeMessage and bodyTooLargeMessage wording; contentBodyBytes is an upper bound"
    requirement: CONT-01
    verification:
      - kind: unit
        ref: "lib/content-limits.test.ts#oversizeFields names fields in editor order"
        status: pass
      - kind: unit
        ref: "lib/content-limits.test.ts#bodyTooLargeMessage is empty within the limit and names megabytes above it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Permanent delete from the Корзина removes virus:<id>:* or recycle:<id>:content keys only; restore keeps formatting"
    requirement: CONT-03
    verification:
      - kind: unit
        ref: "lib/editor-items.test.ts#permanently deleting a recycled virus removes all of its formatting and nothing else"
        status: pass
      - kind: unit
        ref: "lib/editor-items.test.ts#permanently deleting a recycle file removes only its text formatting"
        status: pass
      - kind: unit
        ref: "lib/editor-items.test.ts#restoring from the bin keeps formatting"
        status: pass
    human_judgment: false
  - id: D4
    description: "Editor wiring: disabled add buttons with LimitNote, savebar warnings, blocked save, confirmed bin deletes"
    requirement: CONT-01
    verification: []
    human_judgment: true
    rationale: "No component test harness; wiring is pinned by tsc, eslint, build and greps, and the owner checks in 09-07"
---

# Phase 9 Plan 05: Editor limits and bin deletes Summary

**Editor stops «+» at 500 rows / 300 blocks / 150 subsections with an aria-live counter, warns without cutting on too-large text, blocks a save above 5 MB with its reason, and permanent bin deletes take their formatting after a confirm**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-25T13:46:15Z
- **Completed:** 2026-10-25T13:51:00Z
- **Tasks:** 3
- **Files modified:** 6 (1 new)

## Accomplishments
- «+ СТРОКА», the four block buttons and «+ ПОДРАЗДЕЛ» are disabled at their shared limits; a `LimitNote` (always in the DOM, `aria-live="polite"`, referenced by `aria-describedby`) shows `n / max` from 80% and `МАКСИМУМ max` at the limit.
- Invisible limits (runs, run characters, formatted keys, conditions, guide text block) show a savebar warning naming the first field; nothing is cut and «СОХРАНИТЬ» stays enabled.
- A draft whose upper-bound body exceeds 5 MB disables «СОХРАНИТЬ», makes `save()` return early (button, Ctrl+S, close dialog) and shows `СЛИШКОМ МНОГО ДАННЫХ: X МБ ИЗ 5.0…` in the savebar and the close dialog.
- Scientist-log cap uses `MAX_SCIENTIST_LOGS` in save() and both log editors.
- Permanent delete of a recycled virus or bin file removes its formatting keys (prefix with trailing colon, so `ab` never matches `abc`), closes the format panel first and confirms with «…навсегда вместе с оформлением?».

## Task Commits

1. **Task 1 (tracer): table rows limit** - RED `57f1f37` (test), GREEN `de54afc` (feat)
2. **Task 2: blocks, subsections, oversize warning, body block** - RED `eb86d29` (test), GREEN `8e1b849` (feat)
3. **Task 3: bin deletes take formatting** - RED `973b68b` (test), GREEN `0089167` (fix)

**Plan metadata:** docs commit follows this file.

## TDD Gate Compliance

Each task has a `test(09-05)` commit before its `feat`/`fix(09-05)` commit. RED for all three tasks failed at module load: the test imports named exports that did not exist yet (`does not provide an export named 'limitStatus'`, `'bodyTooLargeMessage'`, `'removeRecycleFile'`), so the target tests never ran an assertion. This is a load failure rather than an assertion failure; the new behavior is fully covered by GREEN (content-limits 6 of 6, editor-items 13 of 13 passing). `workflow.tdd_mode` is not enabled, so `gsd_run check tdd-red-evidence` was not run.

## Files Created/Modified
- `lib/content-limits.ts` - limitStatus, limitText, oversizeFields, oversizeMessage, contentBodyBytes, bodyTooLargeMessage
- `lib/content-limits.test.ts` - new, 6 tests
- `lib/editor-items.ts` / `.test.ts` - removeRecycledVirus, removeRecycleFile and 3 tests
- `components/portia-editor.tsx` - LimitNote, limited add buttons, savebar/close-dialog warnings, saveBlocked guard, delete-file dialog
- `app/portia.css` - `.limit-note.is-full`, `.limit-buttons`, phone wrap and `.limit-add` min-height

## Decisions Made
See key-decisions. `MAX_CONTENT_BODY_BYTES` is not imported into the editor (unused; the limit lives inside `bodyTooLargeMessage`).

## Deviations from Plan

None - plan executed exactly as written, with two small notes: the plan listed `MAX_CONTENT_BODY_BYTES` among editor imports but nothing in the editor uses it, so it was left out (eslint unused import); `.limit-buttons` also has `gap: 8px`.

**Total deviations:** 0 auto-fixed.

## Issues Encountered
None. `npx eslint app lib components` reports 0 errors, 14 pre-existing warnings (no-img-element and similar), none from this plan's changes.

## Known Stubs
None.

## Threat Flags
None. T-09-11 (bin file delete confirm with ОТМЕНА autofocus) and T-09-12 (body-size block shows its reason) are mitigated as planned.

## Next Phase Readiness
Editor halves of CONT-01 and CONT-03 are in place. Visible-limit states at 400 rows or 300 blocks are not reachable by hand, so they rest on the unit tests and greps; the owner checks the editor in 09-07. No content was saved and PUT /api/content was not called.

## Self-Check: PASSED

`lib/content-limits.test.ts` exists; commits `57f1f37`, `de54afc`, `eb86d29`, `8e1b849`, `973b68b`, `0089167` are ancestors of HEAD; `npm test` pass 281 fail 0; `npx tsc --noEmit` clean; `npx eslint app lib components` 0 errors; `npm run build` exit 0; all task acceptance greps pass.
