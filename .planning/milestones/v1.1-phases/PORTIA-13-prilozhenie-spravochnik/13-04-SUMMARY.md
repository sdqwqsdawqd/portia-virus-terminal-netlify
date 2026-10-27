---
phase: PORTIA-13-prilozhenie-spravochnik
plan: 04
subsystem: editor-guide-reorder
tags: [guide, editor, drag, harness]
requires: [13-01, 13-03]
provides:
  - OrderDragHandle props itemId and onMoveAcross; module dragHandoff keeps one drag one gesture and one undo step across the remount
  - guide cards move between sections by pointer (row, empty line or section head under the pointer) and by keyboard (ArrowUp/ArrowDown at a section edge)
  - drop marker on a collapsed section that holds the dragged card
  - harness checks drag-across and drag-edges; helpers pointerDrag, cardOrder
affects: [13-05]
tech-stack:
  added: []
  patterns: [opt-in cross-list drag via data-sort-group/data-group-id/data-drop-group, module-level drag hand-over across a React remount]
key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-13-prilozhenie-spravochnik/13-guide-check.mjs
decisions:
  - "Cross-list moves are only for lists with a data-sort-group kind and a handle that passes onMoveAcross; section and block handles pass neither, so cards never change level"
  - "The hand-over (dragHandoff) is cleared only on pointer release or window blur, not on take-over, because Strict Mode runs the mount effect twice"
  - "The drop marker is pure CSS (:has on the hidden section body), no JS attribute"
metrics:
  duration: ~35 min
  completed: 2026-10-27
status: complete
actuals:
  tokens: 12000
  tasks: 2
  commits: 2
plan_head_before: aff41fff814723e2b90e69d5e4a4b7dd834dd121
plan_head_after: 0c1ef5321cdc9fa60930b42f8759051596150ecf
commits: 2
requirements-completed: [P13-SC4]
---

# Phase 13 Plan 04: Cards move between sections Summary

A card's ≡ now carries it into another section by mouse or finger (at the pointer's place, to the end on a section head, into an empty section) and by ArrowUp/ArrowDown at a section edge; the whole drag is one Ctrl+Z step.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | pointer drag of a card into another section, one undo step, saved in its new place | 9ed1f39 |
| 2 | keyboard across sections, collapsed and empty sections as targets, drop marker, level guards | 0c1ef53 |

## What was built

- `components/portia-editor.tsx`: `OrderDragHandle` gets `itemId` and `onMoveAcross`; `moveAcross` picks the target from `document.elementsFromPoint` (row of another list of the same kind, its empty line, or a section head); `dragHandoff` lets the remounted handle continue the drag with the same `drag:<id>` history key. Guide tab: `data-sort-group="guide-cards"` and `data-group-id` on card lists, `data-drop-group` on section cards, card handles wired to `moveGuideCard`; keyboard edges open the target section and refocus the card's ≡.
- `app/portia.css`: one rule marking the head of a collapsed section whose hidden body holds the dragged handle.
- `13-guide-check.mjs`: `pointerDrag`, `cardOrder` and friends, checks `drag-across` and `drag-edges` (keyboard both ways, collapsed head marker, empty section, section ≡ and block ≡ guards, no `[data-dragging]` left).

## Verification

- Production build on port 3124: `13-guide-check.mjs --check all` ok for all 11 checks (drag-across also ran green three times in a row). Server stopped afterwards.
- `npm test` 418/418, `node --experimental-strip-types --test lib/portia-desktop.test.ts lib/editor-history.test.ts` 38/38, `npx tsc --noEmit` clean, `npm run build` passes.
- Tracer gate (auto mode): `drag-across` passed end to end before expanding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lint "variable accessed before declared"**
- **Found during:** Task 2 lint
- **Issue:** the hand-over in the window-listeners effect calls `autoscroll`, which was declared after the effect.
- **Fix:** moved the `autoscroll` block above the effect (no logic change).
- **Files modified:** components/portia-editor.tsx
- **Commit:** 0c1ef53

**2. [Harness timing] pointerDrag settles on the target after the last step**
- **Issue:** a card inserted into the target list shifts the row under the pointer, so a drag that ends the moment the card crosses landed one place off (flaky). After the 12 steps and the 200 ms pause the helper now asks `targetFn()` once more and moves there before releasing, as a hand would.
- **Files modified:** 13-guide-check.mjs
- **Commit:** 9ed1f39

**3. [Harness expectation] block guard**
- The plan's guard allows b1 to swap with b2 on the way to c3 (same list); the check asserts b1 stays in c1 (sorted set) and c3 holds only b3.
- **Commit:** 0c1ef53

## Deferred Issues

- `npm run lint` still exits non-zero on the 2 pre-existing `no-require-imports` errors in `.planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-*.cjs` (see 13-01..13-03). No new errors.
- Finger drags use the same pointer events as the mouse; a real phone is checked in 13-05.
- `package.json`, `package-lock.json`, `.planning/milestone.lock`, `.planning/state.json` and `.planning/ui-reviews/` carry unrelated uncommitted changes and were not staged.

## Known Stubs

None.

## Threat Flags

None. T-13-12 (stuck drag marker) mitigated: hand-over cleared on release and blur, `stop()` still runs on unmount, harness asserts no `[data-dragging]` after every drag. T-13-13 (wrong level) mitigated: cross moves only between lists of the same `data-sort-group`; `drag-edges` guards pass.

## Self-Check: PASSED

Commits 9ed1f39 and 0c1ef53 present; `components/portia-editor.tsx`, `app/portia.css`, `13-guide-check.mjs` present.
