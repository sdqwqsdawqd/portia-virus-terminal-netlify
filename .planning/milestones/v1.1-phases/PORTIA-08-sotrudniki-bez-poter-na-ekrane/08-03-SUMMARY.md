---
phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
plan: 03
subsystem: ui
tags: [react, nextjs, employees, editor, save-race]
status: complete

requires:
  - phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
    provides: "08-02 changedFields/changedDetails, diff-only save body, derived dirty"
provides:
  - "settleDraft: field-wise reconcile of a save answer with the draft typed since sending"
  - "EmployeeProfilesEditor save with a sent snapshot, id-matched apply, queued employee switch, ref-held saved timer"
affects: [PORTIA-08-04]

actuals:
  tokens: 5000
  tasks: 2
  commits: 2
plan_head_before: 98c3e0c0322f012b711d6eea32321c61fbe0fbe6
plan_head_after: b11f59079138d08cdae9514890d85baebfc01b4c

tech-stack:
  added: []
  patterns:
    - "Update the baseline from a save answer; change the draft only field by field (dirty stays derived)"
    - "Async answers matched to their employee by id via a synced ref"

key-files:
  created: []
  modified:
    - lib/portia-employees.ts
    - lib/portia-employees.test.ts
    - components/portia-editor.tsx

key-decisions:
  - "Text typed during a save stays and keeps the draft dirty; the editor presses СОХРАНИТЬ again, no automatic second save"
  - "A click on another employee during a save is queued by id and resolved synchronously after the answer: opens when clean, asks via the usual dialog when typed meanwhile or the save failed"
  - "The СОХРАНЕНО timer is held in savedTimer, cleared before each save and on unmount"

requirements-completed: [EMP-05]

coverage:
  - id: D1
    description: "settleDraft keeps fields typed since sending and takes the stored copy for the rest (profile and details; missing equals null)"
    requirement: EMP-05
    verification:
      - kind: unit
        ref: "lib/portia-employees.test.ts#settleDraft: text typed during a save stays, untouched fields take the stored copy"
        status: pass
      - kind: unit
        ref: "lib/portia-employees.test.ts#settleDraft: a missing rating equals null"
        status: pass
      - kind: unit
        ref: "lib/portia-employees.test.ts#settleDraft: details typed during a save stay, the rest take the stored copy"
        status: pass
    human_judgment: false
  - id: D2
    description: "Answer applies only to the employee it was sent for; СОХРАНЕНО hidden over a dirty draft; switch during a save remembered; one ref-held timer"
    requirement: EMP-05
    verification:
      - kind: other
        ref: "grep acceptance criteria + tsc + eslint (0 errors) + npm run build"
        status: pass
    human_judgment: true
    rationale: "No component test harness; the browser check is plan 08-04"
---

# Phase 8 Plan 03: A save answer no longer eats what was typed meanwhile Summary

**A save answer now settles only the fields not typed since sending, lands only on the employee it was sent for, a switch clicked during a save is remembered, and the «СОХРАНЕНО» timer is held in a ref.**

## Accomplishments

- `settleDraft(sent, current, stored)` in `lib/portia-employees.ts`: per key, take the stored copy when the field is unchanged since sending (null equals missing), otherwise keep what the editor typed. Three unit tests (profile, missing rating, details).
- `save`: keeps `sentId`, `sentProfile`, `sentDetails`; the list entry and `onSaved` run by id always; draft, details and pending flags are settled only when `selectedIdRef.current === sentId`. `typedMeanwhile` makes save return false, so a draft typed during the save stays dirty, the leave guard still asks and the dialog flow does not continue.
- `saveStatus` hides «СОХРАНЕНО» over a dirty draft.
- `chooseEmployee` during a save queues the clicked id (clicking the open employee forgets it); `resolveQueued` runs synchronously after the answer: opens the employee when clean, otherwise `setPendingEmployeeId` so the usual dialog asks. It is skipped when a dialog is already open.
- `savedTimer` ref: cleared before each save and on unmount; the single 1.8 s timeout is assigned to it.

## Task Commits

1. Task 1 (tracer): `2b6e1d0` - settleDraft, sent snapshot, id-matched apply, saveStatus
2. Task 2: `b11f590` - queued employee switch and ref-held saved timer

Task 1 tests were written first and run red (missing export) before the implementation.

## Deviations from Plan

None - plan executed as written. The tracer gate (auto mode off, end-of-phase human verify) is satisfied by the automated verify (tests, tsc); browser confirmation is 08-04.

## Verification

- `npm test`: 253 pass, 0 fail
- `npx tsc --noEmit`: clean
- `npx eslint app lib components`: 0 errors, 14 warnings (img-element, same as baseline)
- `npm run build`: exit 0
- Acceptance greps: `setDraft(profileOf(merged))` 0, `settleDraft(sentProfile` 1, `typedMeanwhile` 2, `saveStatus` 2, `savedTimer.current = window.setTimeout` 1, `window.clearTimeout(savedTimer.current)` 2, `queuedEmployeeIdRef` 5, old `if (state !== "saving") setPendingEmployeeId` 0

## Known Stubs

None.

## Threat Flags

None. T-08-10 and T-08-11 are mitigated as planned.

## Issues Encountered

Accepted per plan: a photo upload finishing in the same tick as the answer could be missed by `typedMeanwhile` for one render; the derived dirty check still keeps the guard asking. A queued switch to an employee no longer in the list is dropped silently.

## Next Phase Readiness

Ready for 08-04 (browser check of typing during a save, switch during a save, failed save with a queued switch, two saves within 1.8 s).

## Self-Check: PASSED
