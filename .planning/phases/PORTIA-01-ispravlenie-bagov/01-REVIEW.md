---
phase: PORTIA-01-ispravlenie-bagov
reviewed: 2026-10-13T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - app/layout.tsx
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase PORTIA-01: Code Review Report

**Reviewed:** 2026-10-13
**Depth:** standard (diff 39c56f8..HEAD)
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The diff covers Plex Serif font wiring, a Dark Reader opt-out, a zoomable embedded-document viewer, a Roblox-link-on-portrait change, drag-handle relocation in the editor, and trash-viewer layout tweaks. The drag-handle and grid changes are consistent: every `OrderDragHandle` call site was moved to the first DOM position and the `:first-child` to `:last-child` selectors were updated. Two problems matter. The Dark Reader fix does nothing, and the Ctrl+wheel zoom does not work once the iframe has focus.

## Critical Issues

### CR-01: `darkreader-lock` meta is never rendered, so the Dark Reader fix is a no-op

**File:** `app/layout.tsx:21`
**Issue:** `other: { "darkreader-lock": "" }` relies on Next emitting `<meta name="darkreader-lock" content="">`. In this repo's Next 16.3.4, `node_modules/next/dist/lib/metadata/metadata.js:411` only pushes a `<meta>` when `content != null && content !== ''`, so an empty string is silently skipped. No tag reaches the HTML and Dark Reader still rewrites the page. `suppressHydrationWarning` only hides the resulting mismatch warnings; it does not stop the rewrite. This was the stated purpose of the change.
**Fix:** Emit the tag directly, or give it a non-empty content value. Dark Reader only checks that the tag exists.
```tsx
<html lang="ru" className={...} suppressHydrationWarning>
  <head><meta name="darkreader-lock" /></head>
  <body>{children}</body>
</html>
```
or `other: { "darkreader-lock": "true" }`. Confirm the tag is present in the rendered HTML.

## Warnings

### WR-01: Ctrl+wheel zoom is lost whenever the iframe has keyboard focus

**File:** `components/portia-desktop.tsx:1109-1119`
**Issue:** `ctrlHeld` is set only from `keydown`/`keyup` on the parent `window`. After the user clicks inside the embedded document, which is the normal state while reading it, key events go to the iframe's own document and never reach `window`. The clear overlay does not appear, so the wheel event goes into the iframe. The parent's non-passive wheel handler never runs, and the browser zooms the whole tab. The feature works only while PORTIA itself has focus. The `blur` handler also clears `ctrlHeld` when focus moves into the iframe, which confirms the gap.
**Fix:** Don't depend on keyboard state. Keep the overlay always mounted but `pointer-events: none`, and switch it to `auto` on `pointermove` with `event.ctrlKey`. Alternatively, accept the limitation and say so in a `shortcut:` comment. The +/- buttons already cover the main case.

### WR-02: `metaKey` is treated as the zoom modifier

**File:** `components/portia-desktop.tsx:1110, 1128`
**Issue:** On Windows, `metaKey` is the Win key. On macOS, Cmd+wheel is not a browser zoom gesture. Holding Win or Cmd therefore raises the overlay, which blocks clicks and scrolling in the document, and hijacks the wheel. Only `ctrlKey` should count, because pinch-zoom on trackpads is also reported as `ctrlKey`.
**Fix:** Use `event.ctrlKey` only in both places.

### WR-03: Overlay can get stuck, and it intercepts all clicks while Ctrl is held

**File:** `components/portia-desktop.tsx:1110-1117, 1143`
**Issue:** The overlay is visible whenever `ctrlHeld` is true and covers the whole document. Ctrl+click in the document, for example to open a link in a new tab, hits the overlay instead. If `keyup` is lost (a Ctrl+key browser shortcut that moves focus, or a context menu), the overlay stays up until the next key event or window blur. The document is then unscrollable. The listeners are also registered once per `EmbeddedDocument` instance, so both document windows run them.
**Fix:** Apply the same fix as WR-01 (overlay driven by pointer events). Also clear `ctrlHeld` on `pointerleave` of the frame or on any `keydown` without `ctrlKey`.

## Info

### IN-01: Roblox profile link is now an unlabelled portrait

**File:** `components/portia-desktop.tsx:873`
**Issue:** The visible "Профиль Roblox" text link was removed and replaced by a link wrapped around the portrait. Sighted users get only a hover and focus ring, with no `title` or visible hint. The `robloxUserId` is a `number | null` (`lib/portia-employees.ts:12`), so the URL interpolation is safe.
**Fix:** Add `title="Профиль Roblox"` to the anchor.

### IN-02: Drag handle no longer explains the 170 ms long-press

**File:** `components/portia-editor.tsx:131-152`
**Issue:** Both the `title` tooltip ("Удерживайте и перетащите") and the "ТЯНИТЕ" caption were removed, but dragging still only starts after a 170 ms hold. A quick click does nothing, with no feedback. There is also no keyboard alternative, though that was already the case.
**Fix:** Restore a `title`, or start the drag on the first pointer move. The 170 ms hold may exist only to protect scrolling on touch, so check before changing it.

### IN-03: Zoom percentage button hides its value from assistive tech

**File:** `components/portia-desktop.tsx:1148`
**Issue:** `aria-label="Сбросить масштаб"` overrides the visible text, so a screen reader never announces the current zoom level (for example "100%").
**Fix:** Use `aria-label={`Сбросить масштаб, сейчас ${Math.round(zoom * 100)}%`}`, or drop the `aria-label` and use `title`.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
