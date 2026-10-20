---
phase: 03-redaktor
plan: 05
subsystem: ui
tags: [react, pointer-events, drag-and-drop, web-animations, flip, gap-closure]
status: complete

requires:
  - phase: 03-redaktor
    provides: "plan 03-04: OrderDragHandle with midpoint hysteresis, edge autoscroll, ArrowUp / ArrowDown, one undo step per drag, WR-03 window release listeners"
provides:
  - "OrderDragHandle tracks the drag through a window pointermove listener (onTrack), so a row follows the pointer up and down for the whole hold"
  - "Per-handle FLIP slide (160 ms, --ease-out) for every index change in all four lists, off under reduced motion"
affects: []

plan_head_before: 6dca21969d66e5ef9f77f1779b3f417a3273efa4
plan_head_after: 6d39c98dd32a6182ef77f7a8d33a545b2fc633f4

actuals:
  tokens: 1300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Window-level pointermove with an early return (primary pointer, this handle pressed) instead of relying on pointer capture, which keyed-list re-insertion drops"
    - "Per-row FLIP in a no-deps useLayoutEffect: measure offsetTop each commit, animate translateY(old - new) to none when the index changed"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx

key-decisions:
  - "No lostpointercapture handler: the window listener makes capture loss irrelevant, and ending the drag on it would end every downward drag"
  - "Script animations check html[data-motion] (and prefers-reduced-motion when it is absent) themselves, since the CSS motion switch cannot clamp Web Animations"

requirements-completed: [EDIT-03]

coverage:
  - id: D1
    description: "Window onTrack listener added and removed; button onPointerMove removed; capture, 170 ms hold, release/cancel/blur, arrow keys, aria unchanged; 4 call sites unchanged"
    requirement: EDIT-03
    verification:
      - kind: automated
        ref: "tsc + node check 'window drag tracking OK'"
        status: pass
  - id: D2
    description: "FLIP useLayoutEffect: closest [data-sort-index], offsetParent skip, offsetTop delta, row.animate 160 ms --ease-out, reduced-motion skip"
    requirement: EDIT-03
    verification:
      - kind: automated
        ref: "tsc + npm test (72/72) + npm run build + node check 'FLIP OK' + npm run lint (0 errors, 13 no-img-element warnings = baseline)"
        status: pass
  - id: D3
    description: "Live behaviour: up-then-down and down-then-up in one hold by mouse and real-phone touch, visible slide on drag / arrows / undo, one undo step per drag, release outside ≡ ends the drag, instant moves with «Анимации» off"
    requirement: EDIT-03
    verification:
      - kind: human
        ref: "Task 2 human-check (uat-03-t2-drag, uat-03-t9-drag, uat-03-t9-anim)"
        status: pending

duration: ~5min
completed: 2026-10-14
---

# Phase 03 Plan 05: Drag Tracking and Slide Animation Summary

**The ≡ reorder drag now tracks the pointer on window, not through pointer capture, so one hold can go up and back down. Every row move slides over 160 ms with a per-row FLIP, and is skipped under reduced motion.**

## What was done

- **Task 1 (tracer), 64531ef:** added `onTrack` to the existing WR-03 window listener effect. It returns at once unless the pointer is primary and `holdTimer.current !== null`, then updates `pointer.current` and calls `moveTo` while the drag is active. The listener is removed in the cleanup. The button's `onPointerMove` prop is gone. Pointer capture, the 170 ms hold, pointerup / pointercancel, arrow keys and the aria attributes are unchanged. Tracer gate: the automated verify was re-run and passed, so expansion continued.
- **Task 2, 6d39c98:** added a `placed` ref and a no-deps `useLayoutEffect` in OrderDragHandle. It finds the row with `closest("[data-sort-index]")` and skips hidden rows (`offsetParent === null`, measurement reset). It reads `offsetTop`, and when the index and the top both changed and motion is allowed, it runs `row.animate` from `translateY(previous - top px)` to `none` over 160 ms with the `--ease-out` easing (fallback `ease-out`). Motion counts as allowed when `data-motion` is `"full"`, or when it is absent and `prefers-reduced-motion: reduce` does not match.

## Verification results

| Check | Result |
|-------|--------|
| npx tsc --noEmit | exit 0 |
| npm test | exit 0, 72/72 pass |
| npm run build | exit 0 |
| npm run lint (run alone, exit code checked first) | exit 0; 0 errors, 13 warnings, all @next/next/no-img-element (baseline) |
| Task 1 node check | "window drag tracking OK" (re-run after Task 2 too) |
| Task 2 node check | "FLIP OK" |

## Pending human verification

These were NOT verified by the executor:

- On PC (mouse) and a real phone (touch): in База вирусов, Корзина, Информация and Рекомендации, hold ≡, drag up two places and then down three without releasing, and the other way round. The row should follow the pointer the whole time.
- Each step slides the row and its displaced neighbours (about 0.16 s). Arrow keys on a focused ≡ and ↶ are animated too.
- One ↶ undoes a whole drag. Releasing outside ≡ ends the drag, and the next edit is its own undo step.
- With «Анимации» off, rows move instantly. No new hints or buttons appear on screen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `moveTo` moved above the window listener effect**
- **Found during:** Task 2 (lint was in Task 2's verify, not Task 1's)
- **Issue:** `npm run lint` failed with "Cannot access variable before it is declared". Task 1's `onTrack` calls `moveTo`, which was declared after the effect.
- **Fix:** moved the `moveTo` declaration and its comment, unchanged, so they sit just above the effect. The function body was not edited.
- **Files modified:** components/portia-editor.tsx
- **Commit:** 6d39c98

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: components/portia-editor.tsx
- FOUND: 64531ef (ancestor of HEAD)
- FOUND: 6d39c98 (ancestor of HEAD)
