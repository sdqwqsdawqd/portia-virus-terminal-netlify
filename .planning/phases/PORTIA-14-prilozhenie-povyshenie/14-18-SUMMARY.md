---
phase: 14-prilozhenie-povyshenie
plan: 18
subsystem: desktop-motion-and-geometry
tags: [spider, animation, window-geometry, shortcuts, svg]
requires:
  - phase: 14-17
    provides: completed promotion bank remediation
provides:
  - explicit-toggle-only spider relocation
  - symmetric fully-visible horizontal window dragging
  - exact vector shortcut animation resting frames
affects: [14-19, 14-14]
tech-stack:
  added: []
  patterns: [explicit-toggle-lifecycle, live-width-clamp, persistent-svg-animation]
key-files:
  created: []
  modified: [components/portia-wallpaper-spider.tsx, lib/wallpaper-web.ts, lib/window-geometry.ts, app/portia.css, lib/wallpaper-web.test.ts, lib/window-geometry.test.ts, lib/portia-desktop.test.ts]
key-decisions:
  - "Route completion only starts a rest; it never hides or relocates an enabled spider."
  - "Window dragging uses the current rendered width and the same eight-pixel left/right inset."
  - "Refreshed shortcuts animate semantic SVG parts without scaling the whole SVG and retain an explicit exact terminal frame."
requirements-completed: [EDIT-01]
duration: 20 min active
completed: 2026-10-29
---

# Phase 14 Plan 18: Desktop Motion and Geometry Summary

**The spider now stays present until the user hides it, windows remain fully visible at both horizontal edges, and animated shortcuts settle without a quality or geometry snap.**

## Accomplishments

- Removed tour-count fade, hidden and automatic relocation stages from the wallpaper spider.
- Page visibility and motion changes now pause/resume the current route without changing position.
- Explicit `Скрыть → Показать` chooses a different visible spawn and pre-plans route-derived heading and gait phase.
- Replaced the title-bar-only right drag allowance with an equal eight-pixel left/right clamp based on live window width.
- Oversized window widths are fitted before dragging; resize-then-drag preserves the resized width.
- Kept one persistent 24×24 SVG per shortcut, removed whole-SVG hover scaling, enabled geometric precision and non-scaling strokes, and added exact 100% keyframes with retained terminal state.

## Task Commits

1. **Spider RED:** `07a5e2a`.
2. **Spider GREEN:** `c44f29c`.
3. **Geometry RED:** `f51fb8c`.
4. **Geometry GREEN:** `7fa9ad7`.
5. **Shortcut RED:** `0cdea34`.
6. **Shortcut GREEN:** `bfef47d`.

## Browser Evidence

- Local in-app browser reported the spider as `display: block`, `opacity: 1` immediately after reload and again five seconds later while its transform advanced along the web.
- Promotion opened in the sequential narrow layout with its frame inside the viewport.
- Promotion shortcut retained `viewBox="0 0 24 24"`, computed `scale: none` and `shape-rendering: geometricprecision`.
- The current in-app browser surface was phone-width; desktop edge dragging remains covered by mirrored geometry tests and awaits final owner PC observation.

## Verification

- Wallpaper, window geometry, desktop and accent suites: 71/71 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Browser smoke: no runtime overlay; spider remained continuously visible; vector shortcut source/scale verified.

## Deviations from Plan

- Device-pixel-ratio 1.25 and physical desktop drag observation were unavailable in the current narrow in-app browser surface. Exact SVG geometry and mirrored drag limits are executable regressions; final visual confirmation remains in 14-14.

## Next Phase Readiness

- All remediation plans 14-15 through 14-18 are complete. Plan 14-19 can run the integrated matrix and prepare the final owner UAT ledger.

## Self-Check: PASSED

Targeted motion, geometry, desktop and accent tests, TypeScript and production build pass.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-29*
