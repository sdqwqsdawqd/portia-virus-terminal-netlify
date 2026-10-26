---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
reviewed: 2026-10-26T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - components/portia-editor.tsx
  - lib/format-fragments.ts
  - lib/format-fragments.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 11: Code Review Report (re-review after plan 11-08)

**Reviewed:** 2026-10-26
**Depth:** standard (diff 89eea5a..HEAD, surrounding code read as needed)
**Files Reviewed:** 3
**Status:** issues_found (info only)

## Summary

Incremental re-review of gap-closure plan 11-08. CR-01, WR-01 and WR-02 from the prior review are resolved. I found no new critical issues or warnings. `lib/format-fragments.test.ts` passes (17/17) and `tsc --noEmit` is clean.

### Prior findings

- **CR-01 resolved.**
  - `dropFields` (`lib/format-fragments.ts:33-42`) returns `null` when the main target is gone. Otherwise it removes the gone key from both `fragments` and `peers`, and it returns the same object when nothing is gone.
  - `closeFormatterFor` now takes `...keys` and goes through `dropFormatFields`, which uses a functional `setFormatTarget` updater, so several calls in one handler chain.
  - The section-delete handler (`portia-editor.tsx:1268`) passes the section key plus every block key in all its subsections. That covers every format key under a section: subsections have no format key of their own, only blocks do.
  - The subsection, block and broadcast deletes were already covered per key.
  - The archived `onRemoveMutation` (`:1431`) now clears the target, like the live list at `:1230`. Mutation keys are index-keyed and shift on delete, so clearing is correct.
  - The second half of the old fix suggestion, not trusting `peer.value` in `applyOp`, was not implemented. See IN-02.
- **WR-01 resolved.** `commitEditorValue` (`:2153`) calls `startGesture(false)` before the `onActivate` that reads `gestureRef.current`. Ctrl+X, Ctrl+V, Ctrl+Backspace, the context menu and IME input all arrive through `onInput` or `onPaste`, so the activation gets a fresh non-additive gesture id. `joinFormatTarget` returns the bare target and the fragments and peers are cleared.
  - The Enter path is covered too, and the panel's own commits do not go through this function.
- **WR-02 resolved.** `toggleCard` and `setAllOpen` now call `dropFormatFields`, so a fold removes peers and fragments inside the folded body as well as the main target. For `toggleCard` the predicate uses the captured `body` element.

## Info

### IN-01: Fold predicate reads the DOM inside a functional state updater

**File:** `components/portia-editor.tsx:713, 891, 871-874`
**Issue:** `dropFormatFields` passes `gone` into `setFormatTarget((prev) => dropFields(prev, gone))`. For folds, `gone` calls `findFormatField(key)`, which queries the live DOM. An updater should be pure.
- Today the updater runs in the render phase, before the commit, while the fields are still in the DOM. It works.
- If React ever rebases the updater after the fold has committed (concurrent re-render, or an earlier pending lane), the folded fields no longer exist. `findFormatField` then returns `null`, the peers are not considered gone, and they survive.

The `formatTarget.key` check on the line above is evaluated eagerly, so this affects peers only.

`setAllOpen`'s predicate (`.closest(".nested-editor-body")`) also drops peers in any open card, not only in the cards being folded. That behaviour was already there for the main target, and the cost is only a lost Ctrl-selection.

**Fix:** Compute the gone keys eagerly from the closure, then pass a pure predicate:
```tsx
const gone = formatTarget
  ? new Set([formatTarget.key, ...formatTarget.fragments.map((f) => f.key)].filter(isGone))
  : new Set<string>();
dropFormatFields((key) => gone.has(key));
```

### IN-02: A peer still commits its snapshot `value` and `document` wholesale

**File:** `components/portia-editor.tsx:2371-2382` (`applyOp`), `:732-737` (sync effect)
**Issue:** `peer.onCommit(peer.value, next)` writes the text captured when the peer joined. The plan-11-08 changes close every in-app route that changes a peer's text (edit, delete, fold, undo, tab switch). One route remains. The `sync` effect replaces the draft whenever `!dirty` and `content` or `revision` changes, for example right after a save, and it does not clear `formatTarget`. A peer or main target that is still open then writes its older text back. The main target has the same exposure from before 11-08. It is narrow, because the draft is not dirty and the target is stale only if the normalized or remote text differs.

**Fix:** Clear the format target when the `sync` dispatch actually changes the text, or commit the peer through the current draft text, for example by keeping the old `value` only if it still equals `draft`'s text for that key.

---

_Reviewed: 2026-10-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
