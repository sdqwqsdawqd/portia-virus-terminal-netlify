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

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-14
**Source review:** .planning/phases/PORTIA-03-redaktor/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03; Info findings IN-01 to IN-03 were left alone, as scoped)
- Fixed: 3. All three are UI glue fixes. Each one needs a human check in the browser (see below).
- Skipped: 0

## Fixed Issues

### WR-01: undo, redo and discard re-point the Recycle selection at the wrong record

**Files modified:** `components/portia-editor.tsx`
**Commit:** 27deb85
**Status:** fixed: requires human verification (selection logic)
**Applied fix:**
- `repairSelections` now leaves an empty Recycle id empty. It only falls back to the first record when a non-empty id points at a record that is gone.
- The initial state selects only one Recycle id: the first file, or the first archived virus if there are no files.
- `moveSelectedVirusToRecycle` set the virus id without clearing the file id, which also broke the "only one is set" rule. It now clears the file id too.

### WR-02: "СОХРАНИТЬ" in the close dialog can close the window over newer unsaved edits, or do nothing visible

**Files modified:** `components/portia-editor.tsx`
**Commit:** 9e845c0
**Status:** fixed: requires human verification (async state handling)
**Applied fix:**
- The close dialog now stays open while the save runs. It is a native modal, so the page is inert and nothing can be typed that the close would lose. Its СОХРАНИТЬ button is disabled while `saveState === "saving"`. This covers both a save started from the dialog and an earlier Ctrl+S that is still running.
- `save()` now resolves `true` only when nothing is left unsaved. That means either the draft was already clean, or the save succeeded and the latest rendered draft is still the object that was sent (read through a `latest` ref). A save already in flight still returns `false`. The other callers (the bar button and Ctrl+S) ignore the return value.
- After the save settles:
  - If the owner cancelled the dialog or chose НЕ СОХРАНЯТЬ meanwhile, nothing more happens.
  - Otherwise the dialog is dismissed. The window closes only on `true`, and it calls the latest render's `onCloseApproved`, not the closure from the click, so `requestExit` sees current `windows` and `activeApp`.
  - On failure or leftover edits the window stays open, and the bar shows ОШИБКА, the conflict, or the unsaved state.
- `ConfirmAction` gained an optional `disabled` field, which `ConfirmDialog` passes to the button.

### WR-03: the global `[data-dragging]` marker can stick, and then it swallows unrelated edits into one undo step

**Files modified:** `components/portia-editor.tsx`
**Commit:** 616e707
**Status:** fixed: requires human verification (pointer handling, not reproduced in a browser)
**Applied fix:**
- `OrderDragHandle` now also calls `stop()` on window `blur` and on a primary `pointerup`/`pointercancel` anywhere in the window, not only on the handle. The listeners are added in the same effect that already ran `stop` on unmount.
- `onPointerDown` ignores non-primary pointers and non-left buttons (`!event.isPrimary || event.button !== 0`). It also calls `stop()` first, so an earlier `holdTimer`/`frame` can no longer leak.
- Deviation from the review: I did not use `onLostPointerCapture={stop}`. If the keyed reorder moving the dragged row releases capture (the reviewer's own hypothesis), that handler would end every downward drag after the first swap. A window-level release listener still ends the drag on release, wherever the pointer ends up.
- Not done: the reviewer's third bullet, moving the drag key from the DOM selector in `editKeyFor` to a module variable. With the marker now cleared on every exit path, the variable would fail in the same ways the DOM attribute does. The `drag:` coalescing rule in `lib/editor-history.ts` is unchanged.

## Verification

All gates ran in the **main checkout**, not in an isolated worktree (see the note below), after all three commits:
- `npm test`: 72 of 72 pass, 0 fail.
- `npx tsc --noEmit`: clean (exit 0).
- `npm run lint`: 0 errors and 13 warnings, all of them the existing `@next/next/no-img-element` warnings.
- After each fix I also ran `tsc --noEmit` and `eslint components/portia-editor.tsx` before committing.

No regression tests were added. None of the three fixes touch logic in `lib/`; all changes are in `components/portia-editor.tsx`, and the repo has no component test harness (the tests are `node --test lib/*.test.ts`).

**Worktree note:** `git worktree add` under `.claude/worktrees/` failed with `fatal: '$GIT_DIR' too big`, because the path is too long on Windows. I removed the empty temp branch `gsd-reviewfix/03-407` and the empty `.claude/worktrees` directory that the failed attempt left behind. No recovery sentinel was written. I then edited and committed in the main checkout and staged only `components/portia-editor.tsx` for each commit. The unrelated working-tree changes (`.planning/config.json`, `.planning/state.json`, `.planning/milestone.lock`, `&1`) were not touched.

## Human verification needed

1. **WR-01:**
   - On the Recycle tab, select a file, make an edit, then press Ctrl+Z. The file editor should stay and the same row should stay highlighted.
   - Repeat with an archived virus selected.
   - Repeat with the discard dialog.
2. **WR-02:**
   - Make an edit, press ×, then click СОХРАНИТЬ. The dialog should stay up with the button disabled until the save finishes, and then the window should close.
   - With a throttled network, press Esc during the save. The window should stay open.
   - Press Ctrl+S and then × right away. СОХРАНИТЬ should stay disabled until the first save settles.
3. **WR-03:** Reorder rows downward and upward with a mouse and on touch. The drag should keep working across several swaps. After the drag, typing in a field should produce normal word-sized undo steps.

Known remaining edge (WR-01): if an undo removes the selected Recycle record and none of its kind remain, both ids end up empty and the pane shows the empty state even if records of the other kind exist. Clicking a row recovers. Before this fix, the same case auto-selected the other kind.

---

_Fixed: 2026-10-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
