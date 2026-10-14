---
phase: PORTIA-03-redaktor
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - components/portia-editor.tsx
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 3: Code Review Report (re-review after fix iteration 1)

**Reviewed:** 2026-10-14
**Depth:** standard (diff `e43fc5e..HEAD`: 27deb85 WR-01, 9e845c0 WR-02, 616e707 WR-03; callers read in context, including `components/portia-desktop.tsx` `requestExit` and `saveContent`)
**Files Reviewed:** 1
**Status:** issues_found

## Summary

All three fixes resolve the defects they targeted. `npx tsc --noEmit` is clean, `npm test` passes 72 of 72, and eslint on the file reports 0 errors (3 existing warnings).

How each fix holds up:
- **Old WR-01 (Recycle selection re-pointed):** resolved. Every click, add and move-to-recycle path now keeps exactly one of the two ids set, and `repairSelections` no longer fills an empty id. Side effect: an empty id now stays empty for good, so the pane can show "Корзина пуста" next to a list full of records. See WR-01.
- **Old WR-02 (close over unsaved edits):**
  - Point 1 is resolved. The native modal makes the page inert, and `clean` compares the latest draft to `savedFrom`.
  - Point 2 is resolved. СОХРАНИТЬ is disabled while `saveState === "saving"`.
  - Point 3 is resolved. The close goes through `latest.current.onCloseApproved`, so `requestExit` sees fresh `windows` and `activeApp`.
  - Two gaps remain: НЕ СОХРАНЯТЬ during an in-flight save (WR-02), and a narrow race with asynchronous draft changes (WR-03).
- **Old WR-03 (stuck drag marker):** resolved. A primary `pointerup` or `pointercancel` anywhere, or a window `blur`, now calls `stop()`. `onPointerDown` ignores non-primary pointers and non-left buttons, and clears a previous timer and frame loop first. One unverified tracking gap remains (IN-05).

IN-01 to IN-03 are carried over from the previous review. They were out of the fix scope and are still present.

## Warnings

### WR-01: the Recycle pane can say "Корзина пуста" while the list shows records, and now it never recovers on its own

**File:** `components/portia-editor.tsx:547-551` (`repairSelections`); also `:614-620` (`deleteSelectedRecycledVirus`), `:995-1004` (`onRestore`), `:1045-1048` (delete file), `:1051` (empty state)

**Issue:** The pair invariant is "exactly one id set", but several paths leave both ids `""` while records of the other kind exist:
- Deleting the last file while archived viruses exist: `nextId` is `""` and the virus id is already `""`.
- Deleting the last archived virus while files exist (`deleteSelectedRecycledVirus`).
- Restoring an archived virus (`onRestore`): the virus id becomes `""`, and the file id was already `""` from the row click. Returning to the tab shows the empty state.
- Undo, redo, discard, or a remote sync that removes the selected record when no record of its kind is left. The fixer already noted this case.

The render then falls through to `<div className="editor-empty">Корзина пуста…</div>` next to a non-empty list.

Before the fix, the next undo or the post-save `sync` refilled `""` with the first record, which hid the problem. Now `current === "" ? current` keeps both ids empty permanently. The pane stays wrong until the owner clicks a row.

**Fix:** Repair the pair as a unit. Fall back to the first record in `recycleKeys` order only when neither id resolves. With two `useState`s, do it in one place after computing both:
```ts
const repairRecycle = (next: PortiaContent, fileId: string, virusId: string) => {
  if (next.recycleFiles.some((f) => f.id === fileId)) return { fileId, virusId: "" };
  if ((next.recycledViruses ?? []).some((v) => v.id === virusId)) return { fileId: "", virusId };
  const [kind, id = ""] = (recycleKeys(next)[0] ?? "").split(":");
  return kind === "file" ? { fileId: id, virusId: "" } : { fileId: "", virusId: id };
};
```
The cleaner option is to replace the two ids with one `recycleSelection: { kind: "file" | "virus"; id } | null` state, which removes the invariant altogether. Call the repair from `repairSelections` and from the three delete and restore paths.

### WR-02: НЕ СОХРАНЯТЬ stays enabled during the dialog's save, and the save still lands

**File:** `components/portia-editor.tsx:1176-1187`

**Issue:** After СОХРАНИТЬ is clicked, only that button is disabled. НЕ СОХРАНЯТЬ is still active. Clicking it calls `onCloseApproved()` and closes the window at once, but the PUT from `saveContent` keeps running and commits the draft to the shared database. The button label promises the opposite of what happens.

If that PUT then fails (ОШИБКА or conflict), the editor is already unmounted. No error is shown, and the edits are gone.

**Fix:** While the dialog's save is in flight, disable НЕ СОХРАНЯТЬ too, or relabel it. The request cannot be cancelled after it is sent:
```ts
{ label: "НЕ СОХРАНЯТЬ", tone: "danger", disabled: saveState === "saving", onClick: … },
```

### WR-03: `clean` reads a ref that is refreshed only after commit, so an asynchronous draft change can still be lost on close

**File:** `components/portia-editor.tsx:675-676`, `:718-720`

**Issue:** `latest.current.present` is updated in a passive `useEffect`. Draft changes that do not come from typing still reach `changeDraft` while the modal is up, for example an image upload that finishes (`uploadImage`, then `onUploaded`, then `updateRecycleFile` / `onChange`). React applies such a dispatch in a later render. If the PUT resolves after that dispatch but before the render commits and the effect runs, `latest.current.present === savedFrom` is still true. `save()` then returns `clean = true` and the window closes. The reducer's own `saved` action would correctly keep the new draft dirty, but the editor is unmounted and the uploaded image is dropped.

The window is narrow, roughly one render. The loss is silent, and it is the same failure class the original WR-02 fixed.

**Fix:** Track changes synchronously at the dispatch site instead of via a post-commit effect:
```ts
const editCount = useRef(0);
const changeDraft = (updater) => { editCount.current++; dispatch({ type: "change", … }); };
// in step(): editCount.current++;
// in save(): const startedAt = editCount.current; … await onSave(normalized); const clean = editCount.current === startedAt;
```

## Info

### IN-01 (carried over, not in fix scope): `::highlight(portia-format)` build warning is cosmetic

**File:** `app/portia.css:426`

**Issue:** Still present. `lightningcss` does not recognize `::highlight()`. It passes the rule through un-minified, the rule works, and the build warns on every run. The comment above the rule does not mention the warning.

**Fix:** Add a one-line comment that the warning is expected, or inject the rule from the component, or upgrade once `lightningcss` supports it.

### IN-02 (carried over, not in fix scope): shortcut listener edge cases

**File:** `components/portia-editor.tsx:733-758`

**Issue:** Still present.
1. The listener is removed while any dialog is open or a close is pending, so Ctrl+S then opens the browser's "Save page" over the modal.
2. Ctrl+S on the Сотрудники and Доступ tabs saves the content draft, not the form on screen.
3. `event.repeat` is not filtered.

**Fix:** As in the previous review. Keep the listener and make the dialog case a `preventDefault`-only no-op for `save`, skip or label content save on the separate-save tabs, and filter repeats for save.

### IN-03 (carried over, not in fix scope): magic numbers and unguarded spread

**File:** `components/portia-editor.tsx:205-211` (`autoscroll`: `56`, `44`, `48`, `8`); `lib/editor-changes.ts:76` (`...content.recycledViruses`)

**Issue:** Still present.

**Fix:** Name the autoscroll constants next to the CSS values they mirror, and write `...(content.recycledViruses ?? [])`.

### IN-04: close-dialog rough edges after the WR-02 fix

**File:** `components/portia-editor.tsx:1167-1191`

**Issue:**
- Press Ctrl+S and then × while that save is running. The dialog waits with СОХРАНИТЬ disabled. If the save then succeeds, the dialog stays up with the text `Не сохранено: ` and an empty list, and the owner has to click again to close.
- Clicking СОХРАНИТЬ disables the button that has focus. Focus leaves the dialog's buttons, so keyboard users must Tab back in.

**Fix:** When `closeAsked && !dirty && saveState !== "saving"`, approve the close automatically, or hide the "Не сохранено" text when `changed` is empty. After disabling СОХРАНИТЬ, move focus to ОТМЕНА.

### IN-05: after a lost pointer capture, the drag ends correctly but stops following the pointer

**File:** `components/portia-editor.tsx:171-185`, `:236-239`

**Issue:** The fixer skipped `onLostPointerCapture` on the grounds that the keyed reorder may release capture when it moves the dragged row. On a downward swap, React's reconciler re-inserts the moved row's node. If capture really is lost then, `onPointerMove` stops firing on the handle and `pointer.current` freezes. The row and the autoscroll stop tracking the finger until release. The new window listeners guarantee only that the drag ends, not that it keeps tracking. Not reproduced in a browser. Either capture survives the move, in which case the deviation was unnecessary, or downward multi-swap drags are broken.

**Fix:** While `active`, also listen to `pointermove` on `window` in the same effect, and update `pointer.current` and call `moveTo` from there. Tracking then no longer depends on capture.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
