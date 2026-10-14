---
phase: 03-redaktor
plan: 01
subsystem: ui
tags: [react, useReducer, undo-history, native-dialog, node-test]

requires:
  - phase: 02
    provides: "editor window, saveContent state machine and 409 revision check that the bar reuses"
provides:
  - "lib/editor-history.ts: pure generic history reducer (change, undo, redo, discard, saved, sync)"
  - "lib/editor-changes.ts: changedSections and the section/label map shared by tabs and bar"
  - "Save bar at the bottom of the editor window replacing the header save zone"
  - "ConfirmDialog (native modal dialog) reusable by the close guard of plan 03-02"
  - "Amber unsaved dot on section tabs"
affects: [03-02, 03-03, 03-04]

plan_head_before: fa134b7aa781c831ae78b72c5569e244d13024c1
plan_head_after: a4a784289c9b5f65a0d067ab7c2fed6624cf85dd

actuals:
  tokens: 9400
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Draft held in useReducer(historyReducer) with baseline; dirty is derived from changedSections, never a boolean"
    - "Coalescing key computed in the event handler (editKeyFor(document.activeElement)), reducer stays pure"
    - "Modal prompts use a native dialog opened with showModal() instead of window.confirm"

key-files:
  created:
    - lib/editor-history.ts
    - lib/editor-history.test.ts
    - lib/editor-changes.ts
    - lib/editor-changes.test.ts
  modified:
    - components/portia-editor.tsx
    - app/portia.css

key-decisions:
  - "Native dialog + showModal() for ConfirmDialog (top layer) instead of createPortal"
  - "History ends at a successful save; edits typed during the request keep draft and history"
  - "Default focus of the discard dialog is forced onto the safe button after showModal()"

requirements-completed: [EDIT-02]

coverage:
  - id: D1
    description: "Reducer: change/undo/redo/discard/saved/sync with coalescing, 50-step cap, race-safe save"
    requirement: EDIT-02
    verification:
      - kind: unit
        ref: "lib/editor-history.test.ts (22 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "changedSections / sectionOfKey section mapping (move-to-bin, formattedText prefixes, unknown keys)"
    requirement: EDIT-02
    verification:
      - kind: unit
        ref: "lib/editor-changes.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Save bar placement and look on PC (sticky) and at 900px and below (fixed above taskbar), ✎ and format panel clearance"
    requirement: EDIT-02
    verification:
      - kind: other
        ref: "node structural check 'save bar tracer OK' + tsc + lint + build"
        status: pass
    human_judgment: true
    rationale: "Bar position, scroll behaviour and overlap with the taskbar and ✎ are visual; editor login is owner-only (D-07, D-08)"
  - id: D4
    description: "ОТМЕНИТЬ confirm dialog, step undo feel, amber tab dots, СОХРАНЕНИЕ…/СОХРАНЕНО cycle"
    requirement: EDIT-02
    verification:
      - kind: other
        ref: "node structural checks 'step undo OK', 'discard and dots OK'"
        status: pass
    human_judgment: true
    rationale: "Dialog appearance, default focus, and the feel of word-sized undo steps need a human in the logged-in editor (D-09, D-11)"

duration: 15min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 01: Save bar, history reducer and confirmed discard Summary

**Editor draft now lives in a pure undo-history reducer; a bottom bar names the unsaved sections, offers step undo, a confirmed discard in a native PORTIA dialog and the save, and tabs with unsaved edits carry an amber dot.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-13T22:55:00Z (approximate, start time was not captured in a variable)
- **Completed:** 2026-10-13T23:10:00Z
- **Tasks:** 3 (1 tracer, 2 auto, all TDD)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `lib/editor-history.ts`: generic reducer with typing coalescing (0.7 s pause, 1.5 s span, `drag:` keys unlimited), 50-step cap, `saved` that keeps edits typed during the request, idempotent `sync`, `undo`/`redo`, `discard` as one undoable step.
- `lib/editor-changes.ts`: `changedSections` maps top-level keys and `formattedText` prefixes to the six tab sections; employees and access are outside the draft by construction.
- Bar (`.editor-savebar`): sticky inside the window on PC, fixed above the 44px taskbar at 900px and below, hidden under the open format panel on phones; shows `Не сохранено: …`, СОХРАНЕНИЕ…, СОХРАНЕНО (existing 1.8 s cycle), ОШИБКА, and the unchanged 409 conflict text.
- `save()` returns `Promise<boolean>`, no-ops when clean or saving, dispatches `saved` with `savedFrom`.
- `ConfirmDialog` (native `<dialog>`, `showModal()`), ОТМЕНИТЬ → «ВЕРНУТЬ СОХРАНЁННОЕ» / «НЕ ОТМЕНЯТЬ»; Escape and backdrop click cancel.
- Header save zone and its three CSS rules removed; tab labels now come from one shared map.

## Task Commits

1. **Task 1 (tracer): save bar naming changed sections, save confirmed** - `4278029` (test, RED), `1bed636` (feat, GREEN)
2. **Task 2: step undo, typing coalescing, selection/format-panel follow** - `d0d020a` (test, RED), `fab0e28` (feat, GREEN)
3. **Task 3: confirmed discard dialog, amber tab dots** - `8155d35` (test, RED), `a4a7842` (feat, GREEN)

**Plan metadata:** committed separately (docs: complete plan)

Tracer gate: Task 1 `<verify>` is automated-only and `HUMAN_VERIFY_MODE` is `end-of-phase`, so it was re-run end to end (unit tests, tsc, lint 0 errors, build, structural check "save bar tracer OK"); it passed and expansion continued.

## Files Created/Modified

- `lib/editor-history.ts` - pure history reducer and constants
- `lib/editor-history.test.ts` - 22 node:test cases
- `lib/editor-changes.ts` - section map, labels, `changedSections`
- `lib/editor-changes.test.ts` - 7 node:test cases
- `components/portia-editor.tsx` - reducer wiring, `editKeyFor`, `step`, `repairSelections`, bar, `ConfirmDialog`, tab dots
- `app/portia.css` - flex-column editor, bar, undo button, dots, dialog, phone/PC placement; dead save-zone rules removed

## Decisions Made

- Native `<dialog>` with `showModal()` rather than `createPortal` (top layer clears the transformed window, taskbar z-index 960 and boot screen without z-index games).
- History ends at a successful save (RESEARCH Open Question 1); edits made during the request keep draft and history.
- Dirty is structural per section, so typing then deleting back can leave the bar up; saving then is harmless (plan assumption).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Default focus of the discard dialog would have landed on the danger button**
- **Found during:** Task 3
- **Issue:** React's `autoFocus` calls `focus()` while the dialog is still closed, and `showModal()` then focuses the first focusable element, which is «ВЕРНУТЬ СОХРАНЁННОЕ». That breaks T-03-05 (default focus on «НЕ ОТМЕНЯТЬ»).
- **Fix:** Keep `autoFocus` per plan, also mark the button `data-autofocus` and focus it right after `showModal()` in the mount effect. The effect skips `showModal()` if the dialog is already open (StrictMode double effect).
- **Files modified:** components/portia-editor.tsx
- **Committed in:** a4a7842

**2. [Process] RED commits carry stub modules / stub reducer cases**
- **Found during:** Tasks 1-3
- **Issue:** Without stubs the new tests would fail on a missing import or an undefined return (INVALID_RED), not on the planned assertions.
- **Fix:** Stubs returning the unchanged state (and empty/`null` for the section helpers) went into each RED commit; all targeted failures were `AssertionError`s.
- **Committed in:** 4278029, d0d020a, 8155d35

---

**Total deviations:** 1 auto-fixed bug, 1 process note. **Impact on plan:** none on scope; the focus fix is needed for the stated mitigation.

## TDD Gate Compliance

All three tasks have a `test(03-01)` commit before the `feat(03-01)` commit. Gate classifier (`check tdd-red-evidence`) was not run: `workflow.tdd_mode` is not enabled in this project and the runner prints the spec reporter, not TAP.

- RED 1: 17 of 21 tests failed with `AssertionError` (stub reducer/section helpers); the 4 that passed were trivially true on a stub (clean-state no-ops).
- RED 2: 3 of 19 failed on assertions (undo/redo stubbed); no-op and future-clearing cases pass trivially.
- RED 3: 2 of 22 failed on assertions (discard stubbed).
- Semantic assessment: each failing test executed and failed on the planned expectation, not on import, syntax or fixture errors.
- No REFACTOR commits.

## Issues Encountered

- Human-check for Task 3 (bar placement on PC and 375px, dialog look, dots, undo feel) was not run: the editor needs the owner login. It is left for the phase UAT (`human_judgment: true` in the coverage block above).
- `.planning/STATE.md` carried uncommitted edits from before this run; they ride along in the STATE commit.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Reducer, `save(): Promise<boolean>`, `dialog` state and `ConfirmDialog` are in place for 03-02 (keyboard shortcuts, close guard, timer race fix).
- Open for 03-02: `saveContent` still resets `saveState` to idle on an uncancelled timer; the bar can show a long conflict text taller than 56 px on a phone (accepted in the plan).

## Self-Check: PASSED

- Created files exist: lib/editor-history.ts, lib/editor-history.test.ts, lib/editor-changes.ts, lib/editor-changes.test.ts (FOUND); modified: components/portia-editor.tsx, app/portia.css (FOUND).
- Commits 4278029, 1bed636, d0d020a, fab0e28, 8155d35, a4a7842 are ancestors of HEAD; 3 `test(03-01)` and 3 `feat(03-01)` commits.
- Plan verification: unit tests 54/54, `tsc --noEmit` 0, lint 0 errors (13 pre-existing warnings), build 0, structural checks "save bar tracer OK", "step undo OK", "discard and dots OK"; `window.confirm(` count still 2.

---
*Phase: 03-redaktor*
*Completed: 2026-10-14*
