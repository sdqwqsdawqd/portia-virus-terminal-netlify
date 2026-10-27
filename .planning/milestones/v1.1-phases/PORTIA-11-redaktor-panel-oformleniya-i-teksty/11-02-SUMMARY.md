---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 02
subsystem: ui
tags: [react-portal, viewport-clamp, localstorage, edge-cdp, bottom-sheet]
requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: 11-editor-check.mjs harness with openEditor, clickText, wordBox, mouseSelect, phone, desktop
provides:
  - format panel portaled into #desktop at z-index 950, dragged by its header anywhere on screen
  - viewport clamp (64px on screen, top edge kept) and first placement beside the editor window, both unit-tested
  - panel hidden while the editor is minimized, arrow-key move, Esc back to the text
  - phone bottom sheet with a 44px fold strip
  - harness check panel, steps (a)-(p)
affects: [PORTIA-11 plan 03 (save chip stacks above the sheet), PORTIA-11 plan 07 (owner checks the feel)]
status: complete
actuals:
  tokens: 36000
  tasks: 3
  commits: 3
plan_head_before: 3cb2f05513adeee5e86a42e318b59fb7401721ba
plan_head_after: c3eca3abe02c7e9d4923a9b5e4eb68ee6cbc13c6
tech-stack:
  added: []
  patterns:
    - "Panel stays a React child of PortiaEditor but renders through createPortal into #desktop, so it unmounts with the editor and its events still bubble"
    - "Offsets are viewport right/bottom; a legacy editor-relative value is simply read as a viewport place and clamped"
key-files:
  created:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-02-SUMMARY.md
  modified:
    - lib/panel-position.ts
    - lib/panel-position.test.ts
    - components/portia-editor.tsx
    - components/portia-desktop.tsx
    - app/portia.css
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-UI-SPEC.md
key-decisions:
  - "z-index 950 (not UI-SPEC's 130) plus a focusApp guard that does not raise a window already on top"
  - "Panel not rendered while the editor window is minimized; its open state is kept so restore brings it back"
  - "Phone sheet has a fixed height min(34svh, 270px) so the 11-03 save chip can stack exactly above it"
requirements-completed: [EDIT-04]
duration: 55min
completed: 2026-10-26
---

# Phase 11 Plan 02: Floating format panel and phone sheet Summary

The format panel is now a layer of the PORTIA OS desktop: portaled into `#desktop`, dragged by its header over the whole screen, clamped so 64px always stay grabbable, and on a phone a bottom sheet that folds to a 44px strip.

## What was built

- **Task 1 (tracer), commit 89b3e25.** `clampPanelOffset` works against the viewport with one constant `visible = 64`: 64px of the panel stay on screen sideways, its top edge never leaves the screen, 64px of its header stay above the bottom edge. The unit tests pin this at 1920x1080 and 1280x720, a 200px-high screen, a legacy value and rounding. The panel renders through `createPortal(..., document.getElementById("desktop") ?? document.body)`, restores its stored place and re-clamps on window `resize` (the ResizeObserver on `offsetParent` is gone), and drags from `getBoundingClientRect`. CSS: z-index 950, right 16 / bottom 60, own colour and font (it no longer inherits the editor's), editor-scoped panel rules and the dead `:has(.floating-text-format)` rules removed.
- **Task 2 (TDD), commit 64068b5.** `initialPanelOffset` (tests written first, failed on the missing export, then green): 16px right of the editor window with its bottom on the window's when it fits, else the corner right 16 / bottom 60, always clamped. New `minimized` prop hides the panel with the editor. The header is focusable (`role="group"`, arrow keys move 8px, Shift 32px, stored in try/catch); Esc in the panel returns focus to the field with its selection, else to the pencil button; the × is labelled «Закрыть панель оформления». `focusApp` bumps z only when the window is not already on top (with the `shortcut:` comment the plan asked for).
- **Task 3, commit c3eca3a.** Phone: edge-to-edge sheet at `bottom: 44px`, fixed height `min(34svh, 270px)`; a `data-sheet-toggle` button (`▾` / `ОФОРМЛЕНИЕ ▴`) and a header tap fold it to a 44px strip, the toggle and × are 44px targets, no free drag and no inline place. Scroll room rule is now `.desktop:has(> .floating-text-format) .content-editor`. UI-SPEC section 2 amended (z-index 950 and why, 64px clamp, default corner, labels, fixed sheet height).

## Verification

- `npm test`: 313 pass, 0 fail (`lib/panel-position.test.ts`: 14 tests).
- `npx tsc --noEmit`: clean.
- `npm run lint`: 0 new problems; the 2 errors are the known `.cjs` files in phase 06 (see `deferred-items.md`).
- `npm run build` ok; on `next start -p 3124`, `11-editor-check.mjs --check panel` prints `"ok": true` with steps (a)-(p), and `--check mark` still passes, after each task.
- Acceptance greps all match the plan (one `createPortal(`, one `getElementById("desktop")`, one `offsetParent` left for the OrderDragHandle, `z-index: 950` once, `bottom: 108px` zero, `metaKey` still once in `portia-desktop.tsx`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CDP drops mouse events outside the viewport**
- **Found during:** Task 1, harness step (c)
- **Issue:** the plan's first choice (drag to -3000 / 5000) moved nothing, so a weak "rect.right >= 64" check passed vacuously.
- **Fix:** used the plan's own fallback (grab the header's outermost points, drag to the last pixel), walking the panel right first because its left end is off screen after the first clamp; added "the drag reached the clamp" assertions so the bounds cannot pass without moving.
- **Files modified:** 11-editor-check.mjs. **Commit:** 89b3e25.

**2. [Rule 1 - Bug, harness] Harness grab points and stale state**
- **Found during:** Tasks 1-2
- **Issue:** at the bottom clamp the header centre sits under the taskbar (960), so grabs and `elementFromPoint` at the centre hit the taskbar; a pressed mouse inside an already selected word starts a text drag instead of a new selection; the viewport size differs a little between loads; the page still carried the throwing storage of step (h) when step (i) wrote its legacy value.
- **Fix:** headerPoint grabs 8px below the header top; openPanel clears the selection and measures the word again after the scroll; sizes are re-read per step; step (i) reloads before writing the value.
- **Files modified:** 11-editor-check.mjs. **Commit:** 64068b5.

No product-code deviations.

## Known Stubs

None.

## Threat Flags

None. The panel is still a child of `PortiaEditor` (mounted only for `canEdit`); storage input only passes `parsePanelOffset` and `clampPanelOffset` into two px styles (T-11-03, T-11-04 mitigated and exercised by harness steps b, c, e, h, i, m).

## Notes

- Residual from the plan: windows still climb by one z per switch between windows; after about 930 switches in one page session they would pass the panel (marked with a `shortcut:` comment in `focusApp`).
- The clamp is viewport-based, not taskbar-aware (as planned): at the bottom limit the panel's top 64px can sit partly under the 44px taskbar; the header stays grabbable by its upper part.
- The old fixed save bar sits under the phone sheet until 11-03 replaces it (expected, per plan). The owner checks the feel of the drag on the PC and the phone in 11-07.

## Self-Check: PASSED

- FOUND: lib/panel-position.ts, lib/panel-position.test.ts, components/portia-editor.tsx, components/portia-desktop.tsx, app/portia.css, 11-editor-check.mjs, 11-UI-SPEC.md
- FOUND commits: 89b3e25, 64068b5, c3eca3a
