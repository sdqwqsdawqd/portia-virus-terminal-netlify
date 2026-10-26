---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/accent-theme.test.ts
  - lib/editor-history.test.ts
  - lib/editor-history.ts
  - lib/format-fragments.test.ts
  - lib/format-fragments.ts
  - lib/panel-position.test.ts
  - lib/panel-position.ts
  - lib/portia-content-normalize.test.ts
  - lib/portia-content-normalize.ts
  - lib/portia-content.ts
  - lib/portia-desktop.test.ts
  - lib/rich-text-style.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-26
**Depth:** standard (diff e29b943..HEAD)
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the diff of the editor rework: collapsible cards and TOC, save chip, fixed-position format panel, multi-fragment selection (Ctrl), column swap, and table row ids. The pure helpers (`format-fragments`, `panel-position`, `editor-history`, row-id normalization) are sound and well tested. The defects are in how the multi-field format target (`peers` and `fragments`) is kept in step with the draft. The target now outlives structural edits that the old single-target code explicitly guarded against.

No structural findings (fallow) were supplied.

## Critical Issues

### CR-01: Multi-field format target is not invalidated when a peer field is deleted, shifted or edited, so a style click writes into deleted or wrong fields

**File:** `components/portia-editor.tsx:873-877` (`closeFormatterFor`), `components/portia-editor.tsx:2366-2382` (`applyOp`), `components/portia-editor.tsx:244-262` (`joinFormatTarget`)
**Issue:** `closeFormatterFor(key)` only closes the panel when `formatTarget.key === key`. With the new fragments, a field can be held only as a peer: `target.peers[key]` is a snapshot with its own `value`, `document` and `onCommit`. Every delete handler calls `closeFormatterFor` for the item it deletes (sections, subsections, blocks, broadcasts), but the deleted field may be a peer. The peer's fragment stays in `set`, because `set` is filtered only by `peers[key] !== undefined`.

The next panel click then runs `peer.onCommit(peer.value, next)`, which is `changeFormattedText`. That sets `next.formattedText[key] = document` for an item that no longer exists. The `updateById` text write is a no-op, so the result is an orphan entry. `lib/editor-items.ts:14` states the invariant that "no orphan text stays in formattedText". The entry is also saved and marks the draft dirty.

The same stale snapshot causes wrong writes elsewhere:
- `removeMutation` (`editor-items.ts:59-61`) shifts `formattedText` keys by position. A peer on `virus:id:mutation:N` then formats and rewrites the wrong mutation's text, using the snapshot's old `value`.
- `peer.value` and `peer.document` are the text at the time the peer was captured. `applyOp` commits them wholesale, so any text change to that field since then is overwritten.

Undo and redo are safe, because `step()` clears the target. Delete and structural edits are not.

**Fix:** Treat peers like the target. Invalidate or prune them centrally rather than per handler:
```tsx
// in closeFormatterFor: drop the key from peers/fragments as well as closing when it is the target
const closeFormatterFor = (key: string) => {
  setFormatTarget((prev) => {
    if (!prev) return prev;
    if (prev.key === key) { setFormatterOpen(false); return null; }
    if (!prev.peers[key]) return prev;
    const { [key]: _gone, ...peers } = prev.peers;
    return { ...prev, peers, fragments: prev.fragments.filter((f) => f.key !== key) };
  });
};
```
Also clear the target in `removeMutation` and in any handler that already calls `setFormatTarget(null)` for the single-target case. In `applyOp`, do not take the plain text from `peer.value`. Read the current text from the draft, or only commit the document when `peer.value` still equals the current text.

## Warnings

### WR-01: Ctrl/Cmd editing keys do not end an additive gesture, so fragments keep stale offsets after Ctrl+X, Ctrl+V, Ctrl+Backspace or Ctrl+Delete

**File:** `components/portia-editor.tsx:2194-2195` (`onKeyDown`), `components/portia-editor.tsx:244-248` (`joinFormatTarget`)
**Issue:** `startGesture(false)` runs only when `!event.ctrlKey && !event.metaKey`. After a Ctrl+click selection, `gestureRef` stays `additive` with the same id. Ctrl+X, Ctrl+V and Ctrl+Backspace change the text. The next `activate` then sees the same gesture id and keeps `prev.fragments`, whose offsets are now wrong. The following style click formats shifted ranges; `applyRichTextStyle` clamps but does not relocate them. The plain-typing path is correct, because it calls `startGesture(false)`.
**Fix:** Reset on text-changing keys regardless of the modifier. For example, treat `ctrlKey` or `metaKey` combined with a key in `x`, `v`, `Backspace` or `Delete` as a gesture end. Alternatively, clear `fragments` and `peers` whenever the field's own `onChange` fires with a different value.

### WR-02: Folding a card or the whole list does not drop peers inside it, so the panel can format text the user can no longer see

**File:** `components/portia-editor.tsx:301-309` (`toggleCard`), `components/portia-editor.tsx:351-354` (`setAllOpen`)
**Issue:** Both guards test only `formatTarget.key` against the collapsed body. A peer or fragment that lives in a collapsed body stays selected. The panel still shows "ВЫБРАНО: n" and applies styles to hidden fields. `findFormatField` still finds the hidden field, so the highlight is painted on an invisible range.
**Fix:** In both places, also drop peers whose field lies in the collapsed body, using the same `body?.contains(findFormatField(key))` test. Prune `peers` and `fragments` for those keys with the same helper as CR-01.

### WR-03: `key={formatTarget.key}` remounts the panel on every field change, which defeats the phone collapsed state and the multi-field flow

**File:** `components/portia-editor.tsx:630` (`FloatingTextFormatPanel key=...`), `components/portia-editor.tsx:2280-2281` (`collapsed`)
**Issue:** The comment says "the panel remounts on every opening", but the key also changes on every move to another field. On a phone the user folds the sheet to 44px to see the text, taps another field, and the sheet remounts expanded and covers the text again. The same remount resets `colorPicker`, `tab` and `lastBatch` (the batch id) mid-session, and re-runs the layout and position effect.
**Fix:** Drop the `key`, or key it on a counter that changes only when the panel is opened. Re-sync `documentRef` in the existing `useEffect` and reset `colorPicker` when `target.key` changes.

## Info

### IN-01: Fallback row id can collide with a later explicit id

**File:** `lib/portia-content-normalize.ts:170-174`
**Issue:** Explicit ids are checked against `seen`, but the positional fallback `${id}-row-${rowIndex}` is not. Rows `[{id: "tb-row-1"}, {}]` give two rows with id `tb-row-1`. That means duplicate React keys and a wrong ≡ move. This needs hand-crafted stored content, so it is unlikely.
**Fix:** Loop until the candidate is not in `seen`, for example append `-${n}`. Add a test case next to "a missing or repeated row id gets its position".

### IN-02: Save chip points at an element that is not rendered and declares a dialog without managing focus

**File:** `components/portia-editor.tsx:646-648`
**Issue:** `aria-controls={popoverId}` and `aria-haspopup="dialog"` are set while the popover is closed, so `aria-controls` is dangling. The popover is `role="dialog"` but focus is not moved into it on open. Escape does return focus to the chip.
**Fix:** Set `aria-controls` only while `popoverOpen`. Move focus to the first control on open, or use `aria-haspopup="true"` with a non-dialog role.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
