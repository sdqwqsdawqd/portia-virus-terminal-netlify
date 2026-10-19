---
phase: PORTIA-05-oformlenie-teksta
plan: 04
subsystem: ui
tags: [react, editor, drag, localStorage, node-test]
status: complete

requires:
  - phase: PORTIA-05 plan 03
    provides: field looks (same files), panel section pointerdown preventDefault from 05-02
provides:
  - lib/panel-position.ts: PanelOffset, clampPanelOffset(offset, panel, bounds), parsePanelOffset(raw)
  - PC format panel dragged by its header, clamped inside the editor window
  - place remembered in localStorage portia-format-panel-v1 and re-clamped on window size changes
affects: [05-05]

actuals:
  tokens: 4200
  tasks: 2
  commits: 4
plan_head_before: f373ca51ec6a49f3f0daa6c83a7d914174e196c3
plan_head_after: fb0122e9ef0454a558fe685552d7b578d9a261f2

tech-stack:
  added: []
  patterns:
    - "panel position lives on the DOM element (inline right/bottom), not in React state; painted in handlers and a layout effect"
    - "position model is { right, bottom } from the editor window's bottom-right, so resize and maximise keep it anchored"

key-files:
  created: [lib/panel-position.ts, lib/panel-position.test.ts]
  modified: [components/portia-editor.tsx, app/portia.css]

key-decisions:
  - "05-04: the PC format panel position is { right, bottom } from the editor window's bottom-right in localStorage portia-format-panel-v1, clamped below the title bar and above the save bar (D-10, D-11)"

requirements-completed: []
---

# Phase 5 Plan 4: Draggable format panel Summary

On PC the format panel is moved by its «РЕДАКТОР ОФОРМЛЕНИЯ» header like a desktop window, never leaves the editor window, and reopens where it was left.

## Accomplishments

- `clampPanelOffset`: 8px from the sides, bottom not below 72 (save bar stays visible, phase 3 D-01), top inset 54 (46px title bar + 8); a window smaller than the panel gives `{ right: 8, bottom: 72 }`; results rounded to whole pixels.
- `parsePanelOffset`: JSON in try/catch, only an object with two finite numbers; junk, strings, `1e999`, `[]`, `null` give null; extra keys dropped.
- Header drag in `FloatingTextFormatPanel`: skips the phone layout (max-width 900px) and the × button, pointer capture, start offset read from the panel against its offsetParent, move paints clamped `style.right/bottom` with no React render. It coexists with the 05-02 section `pointerdown` preventDefault (capture and pointermove are unaffected; the default also stops text selection while dragging).
- Memory: `formatPanelStorageKey = "portia-format-panel-v1"`, written only on drag end (and only if the pointer moved), every storage access in try/catch. A layout effect restores on mount and re-presses to the edge on each offsetParent size change (ResizeObserver, disconnected on unmount); at phone width it clears the inline right/bottom so the dock CSS applies.
- CSS (desktop block): grab / grabbing cursor, `touch-action: none`, `user-select: none` on the header.

## Task Commits

| Task | Commit | Note |
|------|--------|------|
| 1 RED | 8fc2d34 | failing clampPanelOffset cases |
| 1 GREEN (tracer) | a36e773 | clamp, header drag, grab cursor |
| 2 RED | 38d81a5 | failing parsePanelOffset cases |
| 2 GREEN | fb0122e | parse, storage, restore, ResizeObserver |

## Deviations from Plan

None - plan executed as written. The `paintPanelOffset` helper sits between `FloatingTextFormatPanel` and `CustomColorPicker` so the plan's node check (which slices that span) finds `style.right`.

Tracer gate note: the tracer `<verify>` has a `<human-check>` (mouse drag in a logged-in editor), so it was not run here; the automated verify was re-run end-to-end after the tracer commit (tests, tsc, lint, build, node check) and passed before expansion, as in 05-02 and 05-03.

## Verification

- `npm test` 192 pass, `npx tsc --noEmit`, `npm run lint` (0 errors, 14 pre-existing warnings), `npm run build` pass.
- Node checks print "panel drag tracer OK" and "panel position memory OK" (the second run from a script file; the inline one-liner loses its regex backslashes in this shell).
- `components/portia-editor.tsx` and `app/portia.css` keep CRLF (0 bare LF).
- NOT run: both human checks (drag to all corners; remember / refresh / smaller window / junk entry). The editor needs login; SAVE was never pressed and no content was written.

## Known limit

If the editor opens at phone width and is widened to PC width without remounting the panel, the panel has no offsetParent at mount, so no ResizeObserver runs until it is reopened (it remounts per field). Drag works regardless.

## Known Stubs

None.

## Threat Flags

None. T-05-06 and T-05-07 mitigated as planned (validated parse, clamp, try/catch).

## Self-Check: PASSED

- FOUND: lib/panel-position.ts, lib/panel-position.test.ts, components/portia-editor.tsx, app/portia.css
- FOUND commits: 8fc2d34, a36e773, 38d81a5, fb0122e
