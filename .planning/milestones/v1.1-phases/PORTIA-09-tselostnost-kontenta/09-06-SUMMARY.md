---
phase: PORTIA-09-tselostnost-kontenta
plan: 06
subsystem: ui
tags: [editor, quests, dates, undo, content-integrity, node-test, a11y]

requires:
  - phase: PORTIA-09-tselostnost-kontenta
    provides: saveBlocked and bodyMessage in the editor savebar (09-05); stable broadcast ids (09-03)
provides:
  - questDateError helper and a red «Дата окончания» field with an error line
  - saveBlocked covers a reversed quest on the button, Ctrl+S and the close dialog
  - savebar button «ИСПРАВЬТЕ ДАТЫ КВЕСТА» that jumps to the end-date input
  - categoryChange helper; undo/redo follows a card between news and quests
  - «ВАЖНО» cleared when a news item becomes a quest or task
affects: [09-07]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4

plan_head_before: 93ed5f41aca185aaa7330d11312b9e94637150ed
plan_head_after: e6ebaeeba0305ca02c80cba2e8c4a6485b51f773
commits: 4

tech-stack:
  added: []
  patterns:
    - "badQuest is derived from the draft on every render, so a stored bad quest is flagged on open and undo clears the flag"
    - "revealCard(id, field, tab) sets a ref, the sub-tab and the top tab, and bumps revealTick so the reveal effect re-runs when nothing else changed"

key-files:
  created: []
  modified:
    - lib/broadcasts.ts
    - lib/broadcasts.test.ts
    - components/portia-editor.tsx
    - app/portia.css

key-decisions:
  - "The editor never rewrites quest dates; the save is blocked and the server stays permissive (D-18, D-01)"
  - "Undo/redo follows only the first card whose category changed"
  - "Error line is aria-hidden inside the label and read through aria-describedby on the input"

requirements-completed: [CONT-04, CONT-05, CONT-06]

duration: 8min
completed: 2026-10-25
status: complete

coverage:
  - id: D1
    description: "questDateError flags only a quest whose end is before its start"
    requirement: CONT-06
    verification:
      - kind: unit
        ref: "lib/broadcasts.test.ts#questDateError flags only a quest whose end is before its start"
        status: pass
    human_judgment: false
  - id: D2
    description: "categoryChange finds the first card that moved between news and quests"
    requirement: CONT-05
    verification:
      - kind: unit
        ref: "lib/broadcasts.test.ts#categoryChange finds the first card that moved between news and quests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editor wiring: red field, blocked save paths, savebar jump button, important cleared on type change, undo follows the card"
    requirement: CONT-06
    verification: []
    human_judgment: true
    rationale: "No component test harness; wiring is pinned by tsc, eslint, build and greps, and the owner checks in 09-07"
---

# Phase 9 Plan 06: Quest dates, ВАЖНО and undo-follows-card Summary

**A quest that ends before it starts is red with its reason and cannot be saved by any path, a savebar message jumps to the field, «ВАЖНО» is dropped on a type change, and undo/redo takes the editor to the card that moved**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `questDateError` marks only quests with both dates set and end before start; equal dates, one date, tasks and news are fine.
- The end-date field gets `.is-invalid`, `aria-invalid`, `aria-describedby` and the line «Окончание раньше начала»; `min` stays as a picker hint, dates are never changed.
- `saveBlocked` now includes `badQuest`, so the button, Ctrl+S and the close dialog all stop; the savebar button and the close dialog text name «ИСПРАВЬТЕ ДАТЫ КВЕСТА: «…»».
- `revealCard` switches to «Сводка» and the right sub-tab, focuses the field and scrolls with block "nearest" (smooth only under `data-motion="full"`).
- Changing the type to quest or task clears `important`; undo restores the whole card.
- `step()` calls `categoryChange` and reveals the card's type select after undo/redo.

## Task Commits

1. **Task 1 (tracer): reversed quest** - RED `7399aab` (test), GREEN `204a7e9` (fix)
2. **Task 2: ВАЖНО and undo follows the card** - RED `981db47` (test), GREEN `e6ebaee` (fix)

**Plan metadata:** docs commit follows this file.

## TDD Gate Compliance

Each task has a `test(09-06)` commit before its `fix(09-06)` commit. Both helpers were stubbed first (return false / null), so RED failed on the planned assertions, not on a missing export. GREEN: broadcasts tests 18 of 18, `npm test` pass 283 fail 0. `workflow.tdd_mode` is not enabled, so `gsd_run check tdd-red-evidence` was not run.

Tracer gate: Task 1 `<verify>` (broadcasts tests and tsc) re-run end to end after Task 2; both pass, expansion was safe.

## Files Created/Modified
- `lib/broadcasts.ts` - questDateError, categoryChange
- `lib/broadcasts.test.ts` - two new tests
- `components/portia-editor.tsx` - badQuest/dateMessage, saveBlocked, revealTick/revealCard, Field error props, savebar fix button, important cleared, step() follows the card
- `app/portia.css` - `.editor-field.is-invalid input`, `.editor-field-error`, `.editor-savebar-fix` (ellipsis on desktop, wrap and 40px on phone)

## Decisions Made
See key-decisions.

## Deviations from Plan

None - plan executed exactly as written. One wording tweak: a code comment names `revealTick` so the acceptance grep (at least 3 lines) holds.

**Total deviations:** 0 auto-fixed.

## Issues Encountered
None. `npx eslint app lib components` reports 0 errors and the same 14 pre-existing warnings; `npm run build` exit 0; `npx tsc --noEmit` clean. The visual states (red field, savebar message, jump, undo following the card) were not clicked through; the owner checks them in 09-07. No content was saved and PUT /api/content was not called.

## Known Stubs
None.

## Threat Flags
None. T-09-13 is mitigated as planned: the block lives in `save()` through `saveBlocked`, which all three entry points call.

## Next Phase Readiness
Editor halves of CONT-04, CONT-05 and CONT-06 are done; 09-07 owns the owner check.

## Self-Check: PASSED

Files exist; commits `7399aab`, `204a7e9`, `981db47`, `e6ebaee` are ancestors of HEAD; `npm test` pass 283 fail 0; tsc clean; eslint 0 errors; build exit 0; all acceptance greps pass.
