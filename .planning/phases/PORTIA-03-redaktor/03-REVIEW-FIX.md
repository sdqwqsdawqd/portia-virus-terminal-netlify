---
phase: PORTIA-03-redaktor
fixed_at: 2026-10-14T00:00:00Z
review_path: .planning/phases/PORTIA-03-redaktor/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase PORTIA-03: Code Review Fix Report

**Fixed at:** 2026-10-14
**Source review:** .planning/phases/PORTIA-03-redaktor/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03; Info findings IN-01..07 left alone by scope)
- Fixed: 4
- Skipped: 0

All four fixes change browser behaviour. Automated gates pass, but each fix is marked **fixed: requires human verification** for the in-browser part.

## Fixed Issues

### CR-01: Virus, mutation and recycled-virus edits still write by captured index

**Status:** fixed: requires human verification
**Files modified:** `components/portia-editor.tsx`, `lib/editor-items.ts`, `lib/editor-items.test.ts`
**Commit:** c487982
**Applied fix:**
- `updateVirus`, `updateRecycleFile` and a new `updateRecycledVirus` now resolve their record with the existing `updateById` helper. Each takes the id from the render that created the handler. So a format-panel commit (`FormatTarget.onCommit`) or a late `uploadImage` callback writes into the record it started on. If that record was reordered, it is still found by id. If it moved to Recycle, the write does nothing instead of landing on a neighbour.
- The rich fields (external, physiology, PPU, mutation description, recycle-file content) moved from `next.<list>[capturedIndex]` to `updateById`. The same applies to move-to-Recycle and restore-from-Recycle.
- The format panel now closes on a virus reorder (`onMove`), on move to Recycle, and on mutation delete. Closing is not a draft change, so each user action is still one undo step.
- New pure helper `removeMutation(content, virus, index)` in `lib/editor-items.ts`. It splices the mutation and moves each later `virus:<id>:mutation:<n>:description` formatting key down one place, dropping the last one. The deleted mutation's formatting can therefore never paint the next mutation's text. It is used by the live and the recycled dossier. Two new tests cover it in `lib/editor-items.test.ts`.
- Mutation index writes from upload callbacks and description commits now check that the mutation exists before writing. A missing index used to throw inside the reducer.
- **Known limit, left as a `shortcut:` comment.** Mutations have no stable id. Mutation delete is disabled while an upload runs, but an undo during an upload can still shift the index that upload will write to. Giving `Mutation` an id would remove this. That is a data-model change and was not made.
- **Side note:** the first version used shared helper functions (`closeFormatter`, `deleteMutation`). With them, the React Compiler lint (`react-hooks/purity`) reported `Date.now` in `changeDraft` as "called during render", which is a false positive. Inlining the setter calls in the handlers removed the error, so the committed code has no lint suppressions.

### WR-01: A cached revision ahead of the server locks the tab out permanently

**Status:** fixed: requires human verification
**Files modified:** `components/portia-desktop.tsx`, `lib/content-sync.test.ts`
**Commit:** 3ed5e1e
**Applied fix:** The 409 branch of `saveContent` now sets `knownRevision.current = -1`, so the next poll is accepted whatever its revision. An accepted poll also rewrites the localStorage cache, so a reload no longer re-seeds the stale gate. The gate logic stays in `acceptFetchedContent` (unchanged). A new test in `lib/content-sync.test.ts` records the contract: a revision below the cached one is dropped normally but taken once the gate is -1. Recovery still needs one conflicted save (or ОТМЕНИТЬ plus a poll) before polls are taken again. The review's optional "drop the cache revision when it is far ahead" was not done.

### WR-02: A save that times out after the server committed becomes a false conflict

**Status:** fixed: requires human verification
**Files modified:** `components/portia-desktop.tsx`
**Commit:** b1f348f
**Applied fix:** The content PUT now passes `30_000` as `fetchWithTimeout`'s existing third parameter. GET polls keep the 6 s default. The review's optional "adopt the polled revision when it equals the last attempted save" was not done. A save that still runs longer than 30 s and commits on the server will still come back as a conflict on retry.

### WR-03: The conflict banner cannot be cleared once the draft is clean

**Status:** fixed: requires human verification
**Files modified:** `components/portia-editor.tsx`
**Commit:** b80eea3
**Applied fix:** Added `const conflict = saveState === "conflict" && dirty`. The conflict text now shows only when `conflict` is true, and `saveState === "conflict"` was removed from `barVisible`. After ОТМЕНИТЬ or undo back to clean, the bar hides. **Remaining edge:** `saveState` itself stays `"conflict"` until the next save. If the owner starts typing again after the resync, the conflict text comes back, even though those new edits are based on the current revision and would save fine.

## Verification

All gates ran in the **main checkout**. No worktree was created, because the caller asked for none (the path is too long), so the results can be reproduced from the current tree. Nothing was written to the live Supabase API.

| Gate | Result |
|------|--------|
| `npm test` | exit 0, 85 of 85 pass (82 before, plus 2 `removeMutation` tests and 1 `content-sync` test) |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0, 0 errors, 13 warnings, all `@next/next/no-img-element` (same as the review baseline) |
| `npm run build` | exit 0. 1 Turbopack CSS warning on `::highlight(portia-format)` (`app/portia.css:435`), which is the known IN-01 |

**Requires human verification in a browser (not run):**
- CR-01: the review's repro. Open virus B, select text in «Внешние характеристики», open the format panel, then reorder B with ArrowDown or a drag. The panel should close and no other virus should change.
- CR-01: delete mutation 1 of 3 when mutation 2 has formatting. Mutation 2's formatting should now sit on the new mutation 1. Undo should restore all three with their formatting in one step.
- CR-01: start an image upload on a virus, reorder that virus or move it to Recycle before the upload ends, and check that no other virus gets the image.
- WR-01: needs a server whose revision is below the tab's cached revision. After one 409, the next poll should be accepted.
- WR-02: a large save over a slow link.
- WR-03: force a 409, press ОТМЕНИТЬ, and check that the save bar hides.

---

_Fixed: 2026-10-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
