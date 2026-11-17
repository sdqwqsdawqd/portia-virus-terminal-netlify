---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 02
subsystem: editor-permissions
tags: [permissions, content-diff, undo-history, tdd]
requires: []
provides:
  - "info-block: prefix in the section map"
  - "unclassifiedTextKeys, deniedSections, revertSections in lib/editor-changes.ts"
  - "history action restrict in lib/editor-history.ts"
affects: [12-05 (server check), 12-06 (editor wiring)]
tech-stack:
  added: []
  patterns: [pure functions with property test over all closed sets]
key-files:
  created: []
  modified:
    - lib/editor-changes.ts
    - lib/editor-changes.test.ts
    - lib/editor-history.ts
    - lib/editor-history.test.ts
key-decisions:
  - "A live-to-bin move survives a closed Корзина in revertSections (D-13), so the revert never undoes an allowed move"
  - "An id gone from both lists and absent from the draft is a deliberate delete in an open section and is not resurrected by the repair step"
status: complete
commits: 4
plan_head_before: beac13d3b3975b347f2f0eb78b2d4bbed69bfa9e
plan_head_after: ab23473c52fb0ba9aac4fbe5e49d63148896812e
actuals:
  tokens: 9000
  tasks: 2
  commits: 4
completed: 2026-10-26
---

# Phase 12 Plan 02: closed-section rules Summary

Pure, tested rules for what a closed tab means: `deniedSections` names the closed sections a save changes, `revertSections` puts closed sections back to the stored copy without losing a virus, and a history `restrict` action stops Ctrl+Z from bringing closed edits back.

## What was built

- `lib/editor-changes.ts`
  - `"info-block:": "info"` in the prefix map. Before this, `info-block:<id>:text` belonged to no section, so a closed «Информация» could be edited through it (T-12-06).
  - `unclassifiedTextKeys(baseline, draft)`: changed formatting keys that belong to no section (the server refuses these for a restricted editor, plan 12-05).
  - `deniedSections(baseline, incoming, closed)`: `changedSections` filtered to `closed`, run on a comparison copy where live-to-bin moves are stripped from `recycledViruses` and `recycleOrder` (D-13). A moved id is one that was live and not in the bin in the stored copy and is now only in the incoming bin. The comparison copy is never returned. The copy is built only when something moved, so an old cache shape with no bin lists does not throw or show a phantom difference.
  - `revertSections(baseline, content, sections)`: copies the stored value for every top-level key of a reverted section, keeps live-to-bin moves when only the bin is reverted, repairs ids that ended in two lists or none, then reverts formatting keys.
- `lib/editor-history.ts`: `{ type: "restrict"; project }`. Maps `present`, `past` and `future` through `project`, keeps the original object where the projection changes nothing, drops past entries equal to the entry after them (and future entries equal to the one before), keeps `baseline` and `source`, sets `key` to null, and returns the same state when nothing changed.

## Verification

- `npm test`: 356 pass, 0 fail.
- `node --experimental-strip-types --test lib/editor-changes.test.ts lib/editor-history.test.ts`: 63 pass.
- `npx tsc --noEmit` and eslint on the four files: clean.
- Property test «a stored virus id ends up in exactly one list for every closed set, and the result is never denied»: all 64 subsets of the six sections, draft changing every section including a move and a restore.
- Idempotence of `normalizePortiaContent` held on the default content and on a richer fixture (info photo and text blocks, a broadcast, a bin virus), so the normalizer was not changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repair step must not resurrect a deliberate delete**
- **Found during:** Task 2 design
- **Issue:** The plan's repair step re-inserts every stored id that is in neither result list. That also undoes a permanent delete of a bin virus made in an open «Корзина» while «База вирусов» is closed (the id is in neither list because the editor deleted it, not because of a cross-list move).
- **Fix:** Re-insert only when the draft still has the id in some list (a cross-list move or restore). An id absent from the draft was deleted in an open section and stays deleted. Test: «deleting a bin entry in an open bin survives a closed viruses section».
- **Files modified:** lib/editor-changes.ts, lib/editor-changes.test.ts
- **Commit:** ab23473

**2. [Rule 1 - Bug] Formatting keys revert by the draft's view and the result's view**
- **Found during:** Task 2 design
- **Issue:** With the bin closed and a bin virus restored in the draft, the restored virus is put back in the bin, but its `virus:<id>:*` keys are classified as «База вирусов» under the draft and as «Корзина» under the result. Reverting by one view only leaves a key that `deniedSections(baseline, result)` would flag.
- **Fix:** A formatting key is reverted when its section is reverted under either view. The property test covers it.
- **Commit:** ab23473

**3. [Plan note] `restrict` also drops future entries equal to the entry before them**
- A redo step that changes nothing is the same problem as an undo step that changes nothing. Small addition, not in the plan text.

Otherwise the plan was executed as written. The plan's wording of the repair step ("in neither list: insert") is narrowed by deviation 1.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema.

## Self-Check: PASSED

- lib/editor-changes.ts, lib/editor-history.ts and both test files exist and carry the new code.
- Commits 18ef392, 9de14b2, 2a0deba, ab23473 are on design/stage-1-desktop.
