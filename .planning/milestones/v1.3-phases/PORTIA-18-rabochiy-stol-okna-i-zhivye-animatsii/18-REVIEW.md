---
phase: PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii
reviewed: 2026-11-02T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/layout.tsx
  - app/portia.css
  - components/portia-desktop-shortcuts.tsx
  - components/portia-desktop-window.tsx
  - components/portia-desktop.tsx
  - components/portia-editor-dossier.tsx
  - components/portia-editor.tsx
  - components/portia-wallpaper-spider.tsx
  - lib/accent-boot.ts
  - lib/accent-theme.test.ts
  - lib/portia-desktop.test.ts
  - lib/portia-promotion-ui.test.ts
  - lib/portia-qualification-ui.test.ts
  - lib/shortcut-layout.test.ts
  - lib/shortcut-layout.ts
  - lib/sort-order.test.ts
  - lib/sort-order.ts
  - lib/wallpaper-web.test.ts
  - lib/wallpaper-web.ts
  - lib/window-geometry.test.ts
  - lib/window-geometry.ts
  - lib/window-open.test.ts
  - tests/e2e/specs/desktop-windows.spec.ts
  - tests/e2e/specs/visitor.spec.ts
  - tests/e2e/visual-candidates/desktop.spec.ts
  - tests/e2e/visual-candidates/motion.spec.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-11-02
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the diff `78c24e1..HEAD` for the listed files. No blockers found.

The inline boot script is safe. `accentBootScript` is built only from `JSON.stringify` of build-time constants and `deriveAccentTokens.toString()`. The stored `customAccent` reaches it only as a call argument, and it is validated by `/^#[0-9a-f]{6}$/i` before use. `motion` and `spider` are mapped through strict equality to fixed literals. No stored value is interpolated into the script or a style string, so there is no injection or XSS path. The `data-motion="full"` SSR default in `layout.tsx` is consistent with the head script and with the `useEffect` in `portia-desktop.tsx`.

The three-mode motion switch is consistent across CSS, boot script, desktop and spider. No stray `data-motion="reduce"` or `prefers-reduced-motion` selectors remain. The cascade for the reduced-mode window fade holds: specificity (0,3,1) beats the (0,2,2) blanket rule, so the window fade is not cut to .01ms. Shortcut cycle timing is also consistent: 560 + 90 = 650 ms, under the 700 ms timer.

The findings are in shortcut layout consistency, the tablet range, the drag-sort hit test, and one accessibility default.

## Warnings

### WR-01: Shortcut CSS clamp (118/128px) disagrees with the JS clamp, so large drags and obstacle avoidance are not honoured

**File:** `components/portia-desktop-shortcuts.tsx:43-50` (with `lib/shortcut-layout.ts:12-13` and the drag handler at `:133-140`)
**Issue:** `savedShortcutLayout` renders the position through `max(8px, min(x, calc(100% - 118px)))` and `max(8px, min(y, calc(100% - 128px)))`. These constants are sized for the *large* icon (110 px wide, about 120 px tall). `clampShortcutPosition` allows `area - size - 8` using the real `offsetWidth/offsetHeight`.

For the default 94x86 icon, JS permits x up to W-102 and y up to about H-94. CSS caps the rendered position at W-118 and H-128, so 16 px horizontally and about 30 px vertically are lost. Effects:
- During a drag the icon stops following the pointer before it reaches the JS limit.
- The saved position is not where the icon is drawn.
- The obstacle avoidance on drop (`desktop-assistant`, `global-format-launch`, usually bottom-right) is computed in unclamped JS coordinates. The icon can be drawn up to about 30 px away from the position that was checked, so it can still overlap the assistant.

The same mismatch existed before with 100/110, but it grew with 118/128 for compact and standard sizes.
**Fix:** Do not hard-code a size in CSS. Let the CSS clamp use the real icon size:
```css
--shortcut-left: max(8px, min(Xpx, calc(100% - var(--shortcut-w, 94px) - 8px)));
```
Alternatively, clamp in JS only and drop the CSS `min()`, re-clamping on resize with `clampShortcutPosition`. Add a test that compares JS and CSS limits per `data-icon-size`.

### WR-02: Free shortcut drag disabled at <=900px, but the 521-900px CSS still lays icons out absolutely with `touch-action: none`

**File:** `components/portia-desktop-shortcuts.tsx:105-106`, `app/portia.css:1340-1349` (the grid at `:1146-1160` is overridden for 521-900px)
**Issue:** `handlePointerDown` now bails out when `matchMedia("(max-width: 900px)")` matches, with the comment "Same breakpoint as windows: the phone grid has no free drag". The phone grid applies only up to 520 px. The block `@media (min-width: 521px) and (max-width: 900px)` was left unchanged and still sets `.desktop-icons { position: absolute }`, `.desktop-icon { position: absolute; left: var(--shortcut-left); ... touch-action: none }`.

For 521-900 px (tablets, narrow windows) the icons are therefore absolute at saved positions, can no longer be dragged, and `touch-action: none` blocks gestures over them. Saved positions from a wider viewport also still apply there.
**Fix:** Pick one contract for 521-900 px. Either revert the JS gate to `window.innerWidth <= 520` (or `matchMedia("(max-width: 520px)")`), or remove the 521-900 CSS block so the grid applies up to 900 px. Add a test that ties the JS media query to the CSS breakpoint.

### WR-03: Drag-sort hit test reads rects that include the running FLIP transform

**File:** `components/portia-editor-dossier.tsx:112-115` (`moveTo`), `:46-58` (FLIP `row.animate`)
**Issue:** `passesTarget` decides "same row" by `Math.abs(own.top - target.top) < 1`. It is fed `getBoundingClientRect()` of the dragged row and the target row. Both rows are the ones animated by the per-handle FLIP (`translate(dx, dy)` to `none`, 160 ms). For about 160 ms after each swap the rects include that transform. After a swap that crosses grid rows, the dragged row's `top` can differ from its layout `top` by a full row. Then:
- `sameRow` is misjudged.
- The vertical middle is used instead of the horizontal one.
- The next pointer event can swap too early or flip back, which is the flip-flop this function was meant to prevent.

Pointer events keep arriving during the animation, so this is reachable in normal use. It is more likely with the 340 px columns.
**Fix:** Use layout geometry that ignores transforms for the row test, for example `offsetLeft/offsetTop/offsetWidth/offsetHeight` of the rows (same `offsetParent`) for `own` and `target`. Keep `pointer` in client coordinates, or convert it with the parent rect. Add a `passesTarget` test with an offset own box.

### WR-04: The OS `prefers-reduced-motion` setting is no longer honoured anywhere, including the no-JS fallback

**File:** `app/portia.css` (removed `@media (prefers-reduced-motion: reduce)` safety net, around `:1388`), `lib/accent-boot.ts:11-12`, `app/layout.tsx:31`
**Issue:** By owner decision D-10, SSR and the boot script resolve to `full` and never read the OS setting. Tests assert that `prefers-reduced-motion` does not appear in the CSS at all. A first-time visitor with vestibular sensitivity and OS "reduce motion" on gets the full boot, spider, parallax and window zooms until they find the settings hint. If the head script is blocked, they still get full motion. This is a documented product decision, so no bug is claimed. It is still an accessibility regression against WCAG 2.3.3 / 2.2.2 and should be a conscious, recorded risk.
**Fix:** Either keep the decision and record it as an accepted accessibility risk. Or use the OS value only as the initial default when no saved `motion` exists: in the boot script, `s.motion===undefined&&matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : ...`. Explicit visitor choice still wins, which does not break D-10's "changed only by the visitor's choice". Update the tests that forbid `matchMedia`.

## Info

### IN-01: `dragGeometry` now silently shrinks window height, below the app minimum

**File:** `lib/window-geometry.ts:38-47`
**Issue:** The old function preserved `start.height`. The new one clamps height to `bounds.height - 16` on every drag. A tall window (restored from a larger screen) is permanently resized by a plain move, which can go below `minimumWindowSize` because the minimum is not passed in. The 8 px inset test does not cover this case.
**Fix:** Fit the window with `fitGeometry` (which has the minimum) when the window opens or the viewport changes, and let `dragGeometry` only clamp the position. Or pass `minimum` into `dragGeometry`.

### IN-02: Several tests assert source text instead of behaviour, and one e2e test cannot fail without the feature

**File:** `lib/shortcut-layout.test.ts:64-67`, `lib/window-open.test.ts` (nod test), `lib/portia-desktop.test.ts` (exact-string checks such as `calc(100% - 118px)`), `tests/e2e/specs/desktop-windows.spec.ts:119-124`
**Issue:**
- The source-grep tests lock in literal strings. They would have caught WR-01 only if someone had written down the wrong expectation, and they make refactors noisy.
- The e2e nod check waits 400 ms and asserts the box is unchanged. A missing or broken `nodWindow` passes just as well, so it proves "does not move", not "nods".
- `settledBox` returns the last box after 20 tries without failing, so a window that never settles passes.
**Fix:** In the e2e test, assert that `search.getAnimations()` contains an animation with `translate` keyframes right after the click (and none under `data-motion="reduced"`). Make `settledBox` throw when it does not settle. Prefer a behavioural unit test for the CSS/JS clamp contract over string equality.

### IN-03: Spider pause-state bookkeeping is partial

**File:** `components/portia-wallpaper-spider.tsx:256-262`
**Issue:** When motion leaves `full`, the code sets legs neutral, `legsNeutral = true` and `clean = true`, but leaves `path`, `gait`, `probeRemaining` and `walked` untouched, and the transform omits the body `scale(bob)`. It works, because the tick rewrites legs whenever `gait > 0`, but the invariant "legs neutral" is only true until the next tick, and the state is not reset on a switch back to full mid-route. It is fragile for future edits.
**Fix:** On leaving `full`, also reset `gait = 0; probeRemaining = 0; probing`-related state and drop the current `path` (settle at the current node). Or do not set `legsNeutral/clean` in this branch.

---

_Reviewed: 2026-11-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
