---
phase: 02-vneshniy-vid
plan: 02
subsystem: ui
tags: [svg, sketches, wallpaper, icons, decision]

requires: []
provides:
  - "02-SKETCHES.html: sections #gel-a/b, #cells-a/b, #badges-a/b, #locks-a/b with data-variant svgs in production geometry"
  - "User SVG choice for plan 02-06"
affects: [02-06]

actuals:
  tokens: 62466
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Sketch board generated from a seeded scratch script; coordinates rounded to 0.1, currentColor only"

key-files:
  created: [.planning/phases/PORTIA-02-vneshniy-vid/02-SKETCHES.html]
  modified: []

key-decisions:
  - "Gel wallpaper: variant A (crisp bands, marker ladder, side scale; bands drift ~24 s)"
  - "Cells wallpaper: variant B (crosshair reticle, dense field; particles drift ~26 s, reticle still)"
  - "Classification badges: set B (shape per class line: hexagon danger, circle spread, triangle escape; 1-3 inner marks = level)"
  - "Access locks: variant A (classic padlock, open shackle swings aside)"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Sketch board with two variants of each new SVG item in all four accents"
    requirement: LOOK-03
    verification:
      - kind: other
        ref: "plan 02-02 Task 1 automated check: sketches OK 16 wallpapers, 136 icons"
        status: pass
    human_judgment: true
    rationale: "Choice of drawings is the user's; recorded below"

duration: 25 min
completed: 2026-10-13
---

# Phase 2 Plan 02: SVG sketches and user choice Summary

**A static sketch board (02-SKETCHES.html, no script, no network) showed two variants of each new SVG in production geometry and all four accents; the user chose gel A, cells B, badge set B and lock A for plan 02-06.**

## SVG choices

gel=a cells=b badges=b locks=a

## Accomplishments

- `#gel-a`, `#gel-b`, `#cells-a`, `#cells-b`: 16 wallpaper SVGs on viewBox 0 0 1440 900, `preserveAspectRatio="xMaxYMin slice"`, moving parts in their own groups (`.gel-bands`, `.cells-particles`), each with a planned-motion caption (D-12).
- `#badges-a`, `#badges-b`: 9 badges each at 24 px and 48 px next to the unchanged term text, in a paper dossier cell (canon level colours) and a dark list-row mock per accent.
- `#locks-a`, `#locks-b`: open (УРОВЕНЬ II) and closed (УРОВЕНЬ III / IV) on a scientist-log-row mock per accent.
- 136 icon SVGs, all viewBox 0 0 24 24, stroke-width 1.75, round caps and joins, currentColor only.

## Task Commits

1. Task 1 — `6954263` docs(02-02): SVG sketch board for gel, cells, badges and locks
2. Task 2 — decision checkpoint (no code); choice recorded here

## Deviations from Plan

**[Rule 3 - Blocker] Board viewed through the dev server** — the Browser pane could not open the file:// URL, so a temporary copy in `public/zz-sketches.html` was served for review and deleted after the choice (never committed). The user also has the file path.

**Board polish before showing:** set B escape-line chevrons narrowed and re-spaced (crowded at level 3); accent copies laid out two per row.

**Total deviations:** 1 (blocker workaround). **Impact:** none.

## Issues Encountered

None.

## Next

Ready for 02-03. Plan 02-06 ports `#gel-a`, `#cells-b`, `#badges-b` and `#locks-a`.

## Self-Check: PASSED
