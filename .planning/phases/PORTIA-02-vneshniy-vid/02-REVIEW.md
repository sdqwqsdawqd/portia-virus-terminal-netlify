---
phase: PORTIA-02-vneshniy-vid
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - components/portia-icons.tsx
  - components/portia-wallpaper.tsx
  - lib/accent-theme.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase PORTIA-02: Code Review Report

_Supersedes the 9cb6923 review for the changed range (9cb6923..HEAD: 5ac7991, 34303ca, 4f51cd7)._

**Reviewed:** 2026-10-14
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the diff since 9cb6923 plus the surrounding code. `npm test` passes (25/25), `tsc --noEmit` is clean, and eslint reports 0 errors (only the existing `no-img-element` warnings).

The review fixes (settings whitelist, taskbar drag, `requestExit` overtake) are sound. The Voronoi cell geometry, gel masks and gradients, icon path math (the `drop` helper closes back to its start point) and the static SVG ids all check out. No blockers. The warnings are one visual correctness defect in the gel wallpaper, one stale-state leak in the editor restore, and one behaviour regression from the early pointer capture.

## Warnings

### WR-01: Gel bands drift away from the ladder labels

**File:** `app/portia.css:1142-1143` (animation), `components/portia-wallpaper.tsx:175-181` (structure)
**Issue:** `html[data-motion="full"] .wallpaper-gel-bands { animation: gel-run ... }` translates the whole bands group by up to 26px. That group includes the ladder lane (lane 0). `.wallpaper-gel-labels` is a sibling group and stays put. The ladder rows are log-spaced, so near the bottom they are only about 30px apart (the 250 and 500 rows). The drift is almost one full row, so the size labels end up beside the wrong ladder band. The wallpaper is only correct with motion off or at the start of the animation.
**Fix:** Move the labels into the animated group so they travel with the ladder, or keep the ladder lane out of the drifting group:
```tsx
<g className="wallpaper-gel-bands">
  {/* bands ... */}
  <g className="wallpaper-gel-labels">{/* labels */}</g>
</g>
```
Alternatively, animate only the non-ladder bands.

### WR-02: Editor restore leaves a stale text-format target and panel

**File:** `components/portia-editor.tsx:750-759`
**Issue:** `onRestore` calls `setTab("viruses")` directly. The tab buttons (line 564) do more on a tab change: they also run `setFormatTarget(null)` and `setFormatterOpen(false)` and reset `previewSurface`. After a restore, `formatTarget` can still point at a field of the archived-virus editor that is no longer mounted. `formatterOpen && formatTarget` (line 868) keeps rendering `FloatingTextFormatPanel` for it, and the toolbar still shows the old field title. Applying formatting then writes to a field the user cannot see.
**Fix:** Run the same reset as the tab handler, ideally by extracting it:
```tsx
const switchTab = (id: EditorTab) => { setTab(id); setPreviewSurface(id === "viruses" || id === "recycle" ? "light" : "dark"); setFormatTarget(null); setFormatterOpen(false); };
// tab button: onClick={() => switchTab(id)}
// onRestore:  switchTab("viruses");
```

### WR-03: Early pointer capture makes a drag-out release click the taskbar button

**File:** `components/portia-desktop.tsx:642-646` (capture), `:1176` (handlers)
**Issue:** `setPointerCapture` now runs on pointerdown for every press. With capture held, the release always targets this button, and the `click` is dispatched to it even when the pointer was released away from it. Before, a press that slid off the button without moving 5px horizontally (for example, dragged up onto the desktop) produced no click. Now it still fires the `onClick` that minimises, focuses or reopens the window. A horizontal drag beyond 5px is covered by `suppressTaskbarClick`; a vertical drag is not.
**Fix:** In `endTaskbarDrag`, also suppress the click when `pointerup` lands outside the button, and compute this before the `!drag.moved` early return:
```tsx
const rect = button.getBoundingClientRect();
const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
if (event.type === "pointerup" && (drag.moved || !inside)) {
  suppressTaskbarClick.current = true;
  window.setTimeout(() => { suppressTaskbarClick.current = false; }, 0);
}
if (!drag.moved || event.type !== "pointerup") return;
```

## Info

### IN-01: The motion-fallback test can pass without checking anything

**File:** `lib/accent-theme.test.ts:231-237`
**Issue:** The new loop over `@media (prefers-reduced-motion ...)` blocks asserts nothing if the regex matches no block. That happens if the block is removed or reformatted, or contains a nested at-rule such as `@keyframes`, which the `[^{}]*\{[^{}]*\}` pattern cannot parse. The test then stays green while the "no unscoped motion rule" guarantee is gone.
**Fix:** Count the matches and assert the count is above 0. Fail on any media block the inner parser cannot fully consume.

### IN-02: The wallpaper and icon-size id lists are duplicated and unchecked

**File:** `components/portia-desktop.tsx:41-47` and `:1154`
**Issue:** `settingValues.wallpaper` and `iconSize` repeat the ids already written in the `SettingGroup` values, and `DesktopWallpaper` branches on them again. `accent` and `motion` are checked against the groups by the test, but `wallpaper` and `iconSize` are not. If an id is added in one place only, a saved value is silently dropped on load, or the setting is offered but rejected.
**Fix:** Extend the existing test to compare `settingValues.wallpaper` and `iconSize` with their `SettingGroup` ids, or derive the groups from one shared constant.

### IN-03: Cell clipping ignores neighbours between 180 and about 254 px away

**File:** `components/portia-wallpaper.tsx:112`
**Issue:** `cellOf` skips neighbours farther than 180. The starting square's corner is about 127px from its site, so a diagonal neighbour up to about 254px away could still clip it. Only sparse cells near the rim, which sit under the focus mask, are affected, and the effect is cosmetic. The 6000-attempt guard may also stop before the 150-site target, which only means fewer cells.
**Fix:** Cosmetic only. If it is ever noticeable, raise the distance threshold to 254 or drop it, since there are at most about 150 sites.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
