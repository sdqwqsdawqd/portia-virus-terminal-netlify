---
phase: 02-vneshniy-vid
plan: 06
subsystem: ui
tags: [svg, wallpapers, icons, classification-badges, editor]

requires:
  - phase: 02-02
    provides: "approved sketches (gel-a, cells-b, badges-b, locks-a)"
  - phase: 02-04
    provides: "html[data-motion] gate"
provides:
  - "Wallpapers «Гель» and «Клетки» (redrawn after the checkpoint), living spider web without the seam"
  - "Classification badges for all seven class lines, including every route of transmission; access locks"
  - "Editor restore from the trash works where confirm() is suppressed"
affects: []

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Looping wallpaper animations start from the drawn pose (0% = rest), so nothing jumps when the intro ends"
    - "Hover hit area fixed on the button box (img pointer-events: none) when the hovered image transforms"
    - "No window.confirm() for reversible draft-only actions: embedded browsers can answer it without showing it"

key-files:
  created: []
  modified: [components/portia-wallpaper.tsx, components/portia-icons.tsx, components/portia-desktop.tsx, components/portia-editor.tsx, app/portia.css]

key-decisions:
  - "User rejected the shipped gel-a / cells-b at the checkpoint: both redrawn in the web/DNA wallpaper language (anchored top right, faint, fading out)"
  - "Wallpaper labels shortened to «Гель» and «Клетки» so the setting buttons keep one height"
  - "Badges extended to Разум, Вид / внешность, Поведение and Способ распространения at the user's request (D-09 had limited them to three lines); archive rows keep the three main badges"
  - "Restore stays in the editor only; the desktop Корзина shows no restore button"

patterns-established: []

requirements-completed: [LOOK-03]

coverage:
  - id: D1
    description: "Wallpapers «Гель» and «Клетки» follow the accent, drift only with motion on"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "headless Edge 1440x900 and 390x844 screenshots: gel (teal, amber), cells (teal, red), motion off"
        status: pass
    human_judgment: true
    rationale: "Look approved by the user after the redraw"
  - id: D2
    description: "Badges beside the term for all seven classification lines; locks on scientist records"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "dossier screenshot with live data: seven cells with badges, terms unchanged; archive row with three badges"
        status: pass
    human_judgment: true
    rationale: "Approved by the user"
  - id: D3
    description: "Editor restore from the trash returns the virus to the draft's virus list"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "pane browser, real click on «ВОССТАНОВИТЬ В БАЗУ» → tab База вирусов, virus selected; draft discarded, not saved"
        status: pass
    human_judgment: false
    rationale: "Root cause reproduced: confirm() returned false in 1 ms without a dialog"

duration: 90 min
completed: 2026-10-14
---

# Phase 2 Plan 06: Wallpapers, badges and locks Summary

**Two lab wallpapers, a web that keeps living after it is spun, badges on every classification line and padlocks on scientist records; plus the checkpoint fixes: the restore that silently did nothing, and Vivian jittering under a cursor at her edge.**

## Accomplishments

- **Wallpapers (`2d55a4f`, `2b43b23`, redrawn in `34303ca`):** «Гель» is a gel under UV: soft lane columns, wells, a labelled size ladder, replicate lanes, "smiling" bands with glow that fade at their ends, the whole gel fading downward; bands drift with motion on. «Клетки» is tissue in an eyepiece: a Voronoi field with rounded walls and gaps, sharp at the centre and fading toward the rim, ~10 % infected cells brighter with tumbling virions.
- **Spider web (`34303ca`):** the sway began at −0.5° after the intro, so the web snapped; every loop now starts at the drawn pose. Glints also run round four spiral rings; dew twinkles on 16 crossings.
- **Badges and locks (`e8cd898`, extended in `34303ca`):** badges set B for danger / spread / escape, plus diamond (Разум), pentagon (Вид), rounded square (Поведение) with 1–3 marks, and six route pictures for Способ распространения; locks A on scientist records (II open, III–IV closed), access rule unchanged.
- **Restore (`4f51cd7`):** the editor's restore needed `window.confirm()`, which the embedded browser answered "no" without a dialog. It now restores straight into the unsaved draft and opens «База вирусов» on the virus.
- **Vivian (`34303ca`):** the image no longer takes hits and the button gets a 6 px hit margin, so her hover lean cannot toggle hover at her edge.

## Task Commits

1. `2d55a4f` feat(02-06): «Дорожки геля» wallpaper (sketch #gel-a)
2. `2b43b23` feat(02-06): «Клетки под микроскопом» wallpaper (sketch #cells-b)
3. `e8cd898` feat(02-06): classification badges (set B) and access locks (A) beside their texts
4. `5ac7991` fix(02): code review findings CR-01, WR-01..04
5. `34303ca` fix(02-06): checkpoint feedback — wallpapers, restore, badges, web, Vivian
6. `4f51cd7` fix(02-06): restore from the trash works in the editor only

## Deviations from Plan

- **[User revision] Wallpapers redrawn** — the approved sketches did not hold up on the real desktop.
- **[User revision] Badges on all seven lines** — beyond D-09's three.
- **[Rule 1 bug] Editor restore** and **web seam** and **Vivian hover jitter** fixed at the checkpoint.

**Total deviations:** 5. **Impact:** scope grew only where the user asked.

## Verification

- npm test 25/25, tsc clean, lint 0 errors
- Screenshots and browser checks listed in coverage; user approved

## Next

Phase 2 complete; ready for phase verification.

## Self-Check: PASSED
