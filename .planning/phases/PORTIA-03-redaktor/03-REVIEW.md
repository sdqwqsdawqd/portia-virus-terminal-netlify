---
phase: PORTIA-03-redaktor
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - lib/editor-history.ts
  - lib/editor-history.test.ts
  - lib/editor-changes.ts
  - lib/editor-changes.test.ts
  - lib/editor-shortcuts.ts
  - lib/editor-shortcuts.test.ts
  - components/portia-editor.tsx
  - components/portia-desktop.tsx
  - app/portia.css
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** standard (diff `fa134b7..HEAD`, plus callers read in context)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The pure reducer, change detection and shortcut mapping are sound. I traced them against the editor and desktop callers and found no logic errors in the three `lib/` modules. `npm test` passes (72 of 72), `tsc --noEmit` is clean, and eslint reports 0 errors (only the pre-existing `<img>` warnings).

The defects are all in the editor component's glue code:
- Selection repair after undo, redo or discard moves the Recycle selection to the wrong record.
- Save-then-close can discard edits typed while the request is in flight.
- The global drag marker can get stuck and swallow later edits into one undo step.

None of these corrupts saved data on the server. WR-02 can silently lose local edits.

## The `::highlight(portia-format)` build warning

**Verdict: cosmetic. The rule works, but the build cannot minify or optimize it.** See IN-01.

## Warnings

### WR-01: undo, redo and discard re-point the Recycle selection at the wrong record

**File:** `components/portia-editor.tsx:528-532` (`repairSelections`), called from `step` (~580) and the discard dialog (~1120)

**Issue:** The Recycle tab holds a selection as two ids, and the UI assumes exactly one is non-empty. The record click handlers set the other to `""`. `repairSelections` treats `""` as "selected record is gone" and replaces it with the first record of its kind:

```ts
setSelectedRecycleFileId((current) => (next.recycleFiles.some((file) => file.id === current) ? current : next.recycleFiles[0]?.id ?? ""));
setSelectedRecycledVirusId((current) => (next.recycledViruses?.some((virus) => virus.id === current) ? current : next.recycledViruses?.[0]?.id ?? ""));
```

Default content has three recycle files (`createVirusRecycleFiles`), so any Ctrl+Z, Redo, the ↶ button or the discard dialog triggers this.

Consequences, traced from the render code:
- **A file is selected.** `selectedRecycledVirusId` becomes the first archived virus. The pane then renders `ArchivedVirusEditor` (`selectedRecycledVirus ? … : selectedRecycleFile ? …`) and the file editor disappears.
- **An archived virus is selected.** `selectedRecycleFileId` becomes the first file. The virus row loses its `active` class (`&& !selectedRecycleFileId`) and the first file row lights up while the virus editor is still shown.

The same code ran before on post-save sync, but phase 3 makes it reachable on every undo.

**Fix:** Only repair an id that is non-empty and missing, and keep the two ids exclusive.
```ts
const keep = (current: string, exists: boolean, first: string | undefined) => (current === "" || exists ? current : first ?? "");
setSelectedRecycleFileId((c) => keep(c, next.recycleFiles.some((f) => f.id === c), next.recycleFiles[0]?.id));
setSelectedRecycledVirusId((c) => keep(c, !!next.recycledViruses?.some((v) => v.id === c), next.recycledViruses?.[0]?.id));
```
The initial `useState` values at lines 513-514 set both ids non-empty, so initialise one of them to `""` too.

### WR-02: "СОХРАНИТЬ" in the close dialog can close the window over newer unsaved edits, or do nothing visible

**File:** `components/portia-editor.tsx:1149` (close dialog action), `save` at ~656; `components/portia-desktop.tsx:753` (`requestExit`)

**Issue:** The dialog action runs `setHandledCloseRequest(...)` and then `save().then((ok) => { if (ok) onCloseApproved(); })`.

1. The dialog disappears at once, but the editor stays fully editable while the PUT runs (a `fetchWithTimeout`, so it may take seconds). If the owner types after clicking, `saved` correctly keeps that draft (`present !== savedFrom`) and `dirty` stays true. `ok === true` still fires `onCloseApproved()`, which calls `requestExit(..., force=true)` and unmounts the editor. Those edits are lost with no prompt, which defeats the guard.
2. `save()` returns `false` immediately when `saveState === "saving"` (an earlier Ctrl+S still running). The dialog is already dismissed (`handledCloseRequest` set), so the click silently does nothing.
3. `onCloseApproved` is the closure from the render when the button was clicked. After the awaited request, `requestExit` runs with that stale `windows` and `activeApp`. If the user focused another window meanwhile, `activeApp === appId` is stale and `setActiveApp(fallback)` steals focus back.

**Fix:** Keep the dialog open, or disable the editor, until the save settles. Close only if nothing newer is dirty. For example, have `save` resolve to `"saved-clean"` when `state.present === savedFrom` (read it through a ref), and call `onCloseApproved()` only for that value. Otherwise re-raise the close dialog. Treat the `saveState === "saving"` early return as a pending state rather than `false`.

### WR-03: the global `[data-dragging]` marker can stick, and then it swallows unrelated edits into one undo step

**File:** `components/portia-editor.tsx:97-101` (`editKeyFor`), `:149-243` (`OrderDragHandle`); reducer rule at `lib/editor-history.ts:35`

**Issue:** `editKeyFor` asks the DOM whether any handle has `data-dragging="true"`. If so, every `changeDraft` anywhere gets key `drag:<id>`, and the reducer coalesces `drag:` keys with no time limit. The marker is cleared only in `stop()`, which runs only on `pointerup`, `pointercancel` or unmount.

If neither event reaches the handle, the marker stays on:
- Pointer capture can be released when the dragged row's DOM node is moved or re-inserted by the keyed reorder.
- The window can lose focus mid-drag.
- A second `pointerdown` can arrive, for example multi-touch or a right-click, which also overwrites `holdTimer` and `frame` without clearing the previous ones. That leaks a timer or rAF loop that is never cancelled.

The effects are:
- The `autoscroll` rAF loop runs forever.
- Every later edit (typing, add or delete) is folded into a single undo step with that stale `drag:` key. One Ctrl+Z then wipes all of it.

I did not reproduce the capture-release case in a browser. The code has no defence if it happens, and the failure mode is bad enough to guard against.

**Fix:**
- Call `stop()` on `onLostPointerCapture`, on `window` `blur`, and on a window-level `pointerup` registered while dragging.
- Clear any existing `holdTimer`/`frame` at the top of `onPointerDown`, and ignore non-primary pointers and buttons (`if (!event.isPrimary || event.button !== 0) return`).
- Make the key come from the handle's own state (for example a module variable set and cleared by `stop`) rather than a document-wide selector.

## Info

### IN-01: `Parsing CSS source code failed` near `::highlight(portia-format)` is cosmetic, not a bug

**File:** `app/portia.css:427` (the `::highlight(portia-format)` rule)

**Issue:** The warning is real but harmless.
- The installed `lightningcss` 1.31.1 does not recognize `::highlight()`. It reports `'highlight' is not recognized as a valid pseudo-element` at that line (I ran it directly on the file).
- Next/Turbopack then passes that one rule through verbatim.
- In the existing `.next` output (`static/chunks/2i-_yifune9o6.css`) the rule is present as `::highlight(portia-format){background-color:rgba(var(--desktop-glow), .35)}`. It is un-minified (note the space before `.35`) while the neighbouring rules are minified.
- `--desktop-glow` is defined on `:root` and inherits into highlight pseudos, so the colour resolves.

What remains:
- The build prints a warning on every run.
- On browsers without the Custom Highlight API the guard `typeof Highlight !== "undefined" && "highlights" in CSS` skips painting. The selection is blurred away and nothing marks it on a phone. The code degrades safely but shows no selection.

**Fix:** Accept it. Add a one-line comment above the rule noting that the warning is expected, so nobody chases it. If a clean build log matters, inject the rule from the component through a `<style>` element, or upgrade `lightningcss` or Next once a version supports `::highlight`.

### IN-02: shortcut listener edge cases

**File:** `components/portia-editor.tsx:~700-725`

**Issue:** Minor behaviours of the window-level shortcut handler:
1. Ctrl+S is not intercepted while a dialog is open or a close is pending, because the listener is removed. The browser's "Save page" can open over the modal.
2. Ctrl+S on the Сотрудники and Доступ tabs saves the content draft, not the employee form the user is looking at. That is confusing, since the status bar there describes different data.
3. `event.repeat` is not filtered, so holding Ctrl+Z runs undo at key-repeat speed.

**Fix:**
- Always `preventDefault` for `action === "save"` when `active`, and make the dialog branch a no-op instead of removing the listener.
- Skip content save on the two separate-save tabs, or label it.
- Add `if (event.repeat && action !== "undo" && action !== "redo") return;`, or drop repeats for save only.

### IN-03: magic numbers and unguarded spread

**File:** `components/portia-editor.tsx:~197-210` (`autoscroll`); `lib/editor-changes.ts:76`

**Issue:**
- `autoscroll` hard-codes the phone chrome (`56` for the system bar, `44` for the taskbar, `48` for the edge band, `8` for the speed). If the chrome changes in `portia.css` the edges silently drift.
- `changedDossierTabs` spreads `content.recycledViruses` directly. The editor itself writes `draft.recycledViruses ?? []` and `next.recycledViruses ??= []` in many places. Normalization always supplies the array today, so this is safe, but it is inconsistent with the defensive pattern elsewhere in the file.

**Fix:** Hoist the autoscroll values into named constants next to the CSS values they mirror, and write `...(content.recycledViruses ?? [])`.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
