---
phase: PORTIA-03-redaktor
fixed_at: 2026-10-14T00:00:00Z
review_path: .planning/phases/PORTIA-03-redaktor/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report (re-review round)

**Fixed at:** 2026-10-14
**Source review:** .planning/phases/PORTIA-03-redaktor/03-REVIEW.md (re-review after fix iteration 1)
**Iteration:** 1 (as passed by the orchestrator; this is the second fix round for the phase)

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03; Info IN-01 to IN-05 left alone)
- Fixed: 3
- Skipped: 0

All edits are in `components/portia-editor.tsx`. Each commit stages only that file.

## Fixed Issues

### WR-01: the Recycle pane can say "Корзина пуста" while the list shows records

**Files modified:** `components/portia-editor.tsx`
**Commit:** ba7f0eb
**Status:** fixed: requires human verification (selection logic)
**Applied fix:** The fallback runs at render time, not inside each state setter. `recycleKeyShown` resolves to the selected file if it still exists, otherwise the selected archived virus, otherwise the first key in `recycleKeys` order. `shownRecycleFileId` and `shownRecycledVirusId` are derived from it. The two index memos and the row highlight read these derived ids, so at most one is ever set. This one place covers every path the review listed: deleting the last file or the last archived virus, restoring a virus, and undo, redo, discard or sync. The delete, restore and `repairSelections` code is unchanged. I chose this over the suggested `repairRecycle` helper because the delete and restore paths only have the pre-change `draft`, so a setter-based repair would have to recompute the post-change content in three places.

### WR-02: НЕ СОХРАНЯТЬ stays enabled during the dialog's save

**Files modified:** `components/portia-editor.tsx`
**Commit:** 2562d28
**Applied fix:** Added `disabled: saveState === "saving"` to the НЕ СОХРАНЯТЬ action, with a one-line comment explaining why. `ConfirmDialog` already passes `action.disabled` to the button. ОТМЕНА stays enabled, and the existing `latest.current.closeAsked` check still drops the close if the owner cancels during the save.

### WR-03: `clean` reads a ref refreshed only after commit

**Files modified:** `components/portia-editor.tsx`
**Commit:** b1fc81c
**Status:** fixed: requires human verification (race-condition logic)
**Applied fix:** Added an `editCount` ref. `changeDraft` and `step` (undo/redo) increment it synchronously before they dispatch. `save()` records the count before the PUT and returns `clean = editCount.current === editsBefore`. `present` was removed from the `latest` ref, since nothing else read it. `savedFrom` stays because the reducer's `saved` action uses it. The other dispatches cannot change the draft during a dirty save: `discard` is blocked because ОТМЕНИТЬ is disabled while saving and the close dialog is modal, and `sync` runs only when the draft is not dirty.

## Verification

All gates ran in the **main checkout**. No worktree was used, as the orchestrator instructed (`git worktree add` fails on this machine because the path is too long). The results can be reproduced from the current tree.

- `npx tsc --noEmit`: clean. It also ran after each fix.
- `npm test`: 72 of 72 passed, 0 failed. These tests cover `lib/*.test.ts` only. No test exercises `components/portia-editor.tsx`, so none of the three fixes is covered by an automated test.
- `npm run lint`: 0 errors, 13 warnings. All 13 are `@next/next/no-img-element`. 3 are in `portia-editor.tsx` (the same 3 the review reported) and 10 are in another file this round did not touch.
- Not run: a browser check of the Recycle fallback, the disabled button, or the upload-during-save race.

---

_Fixed: 2026-10-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
