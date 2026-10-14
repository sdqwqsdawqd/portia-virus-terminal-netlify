---
phase: 02-vneshniy-vid
plan: 01
subsystem: ui
tags: [css, oklch, theming, accent, filters, nextjs]

requires: []
provides:
  - "--accent-hue per theme (180.4 / 223.3 / 63.1 / 10.1) driving every converted tint"
  - "--mark-filter / --assistant-filter per theme; spider and Vivian follow the accent"
  - "pre-paint accent script (lib/accent-boot.ts) in <head>"
  - "lib/accent-theme.test.ts guarding tokens, filters, literals, boot script"
affects: [02-03, 02-04, 02-05, 02-06]

actuals:
  tokens: 37569
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Accent tint = oklch(L C var(--accent-hue) [/ A]); exact teal glow = rgba(var(--desktop-glow), A)"
    - "PNG recolour = hue-rotate(Ndeg) saturate(S) token selected by img src"

key-files:
  created: [lib/accent-boot.ts, lib/accent-theme.test.ts]
  modified: [app/portia.css, app/layout.tsx]

key-decisions:
  - "Light green-tinted text greys keep the faint accent tint (user, human-check Q1)"
  - "Ice spider filter hue-rotate(20deg) saturate(1.8) is good enough; no SVG feColorMatrix (user, human-check Q2)"
  - "Rainbow picker exclusion scoped to .custom-hue input (its gradient); the .custom-hue > span label is converted"
  - "Component scan (test h) stays at chroma >= 20 while the stylesheet scan (g) uses 6"

patterns-established:
  - "New interface colours must use var(--teal*), rgba(var(--desktop-glow), A) or oklch(L C var(--accent-hue)); test (g) fails on a turquoise literal"

requirements-completed: [LOOK-01]

coverage:
  - id: D1
    description: "Theme tokens, retuned amber/red distinct from warning/danger, swatches match"
    requirement: LOOK-01
    verification:
      - kind: unit
        ref: "lib/accent-theme.test.ts#every theme defines the accent tokens and both PNG filters"
        status: pass
      - kind: unit
        ref: "lib/accent-theme.test.ts#amber and red accents stay distinct from warning and danger"
        status: pass
    human_judgment: false
  - id: D2
    description: "Spider and Vivian recolour only their teal parts"
    requirement: LOOK-01
    verification:
      - kind: unit
        ref: "lib/accent-theme.test.ts#spider and Vivian land on the accent hue"
        status: pass
      - kind: unit
        ref: "lib/accent-theme.test.ts#black, white and grey survive every filter"
        status: pass
    human_judgment: true
    rationale: "Perceived colour of the PNGs on the live site; user approved"
  - id: D3
    description: "Saved accent applies before first paint, only whitelisted ids"
    requirement: LOOK-01
    verification:
      - kind: unit
        ref: "lib/accent-theme.test.ts#the boot script applies only a whitelisted saved accent"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every turquoise literal (chroma >= 6) outside exclusions follows the accent; near-black panels tinted by theme"
    requirement: LOOK-01
    verification:
      - kind: unit
        ref: "lib/accent-theme.test.ts#no turquoise literal left in the stylesheet"
        status: pass
      - kind: unit
        ref: "lib/accent-theme.test.ts#Portia tints stay in gamut and in the teal family"
        status: pass
    human_judgment: true
    rationale: "Whole-UI look across four themes; user approved the human-check"

duration: 58 min
completed: 2026-10-13
---

# Phase 2 Plan 01: Accent recolours the whole interface Summary

**One `--accent-hue` number per theme now drives 391 OKLCH tints and 27 glows in `app/portia.css`, CSS filter tokens recolour the spider and Vivian, and a whitelisted head script applies the saved accent before first paint.**

- Started 2026-10-13T14:12Z, finished 2026-10-13T15:11Z (resumed after an interrupted executor left Task 1 uncommitted; finished inline)
- 3 tasks, 4 files

## Accomplishments

- Tokens: `--accent-hue`, `--mark-filter`, `--assistant-filter` in `:root` and the ice/amber/red blocks; amber `#e8953f` and red `#d94f6e` retuned (≥ 15° OKLCH from `--warning` / `--danger`).
- `img[src$="/portia-logo.png"]` and the three `.assistant-button img` filters use the tokens; `.media-empty` placeholder unchanged; `public/assets` untouched.
- `lib/accent-boot.ts` + `<head>` script in `app/layout.tsx`.
- Task 2 (chroma ≥ 20): 210 oklch tints, 25 glows, 0 `var(--teal)` / `var(--teal-dim)` (those literals lived only in excluded tokens/swatches). Largest Portia round-trip OKLab dE 0.0047 (`.taskbar-note: #61776f`).
- Task 3 (chroma 6–19, D-16): 181 more oklch tints incl. `--bg`, `--panel`, `--panel-2`, `--ink`, `--ink-soft`. Largest dE 0.0038 (`.subject-media figcaption: #59645f`). Total 391 tints.

## Sampled colours and filters

| Source | Value |
|---|---|
| LOGO_TEAL | #00b396 |
| ASSISTANT_TEAL_LIGHT | #008e89 |
| ASSISTANT_TEAL_DARK | #034e4c |

| Theme | --accent-hue | --mark-filter | --assistant-filter |
|---|---|---|---|
| teal | 180.4 | hue-rotate(0deg) | hue-rotate(0deg) |
| ice | 223.3 | hue-rotate(20deg) saturate(1.8) | hue-rotate(20deg) saturate(.6) |
| amber | 63.1 | hue-rotate(-131deg) saturate(.75) | hue-rotate(-142deg) saturate(.5) |
| red | 10.1 | hue-rotate(178deg) saturate(1) | hue-rotate(165deg) saturate(1.3) |

Real-pixel check: 99.8–100 % of teal pixels land within 10° of the theme hue.

## Human-check answers

1. Light grey-green text greys keep the faint theme tint — **keep**.
2. Ice spider hue-matched, L .76 vs accent .79 — **keep** (no feColorMatrix).

## Task Commits

1. Task 1 — `e321786` feat(02-01): saved accent paints from the first frame, spider and Vivian follow it
2. Task 2 — `f964ad7` feat(02-01): every turquoise tint in the stylesheet follows the accent
3. Task 3 — `09cd765` feat(02-01): near-black panels and green-tinted greys take the accent hue (D-16)

## Deviations from Plan

**[Rule 1 - Bug] Test (h) used the lowered stylesheet threshold** — Found during: Task 3 | Lowering MIN_CHROMA to 6 made the component scan flag near-neutral TSX colours, but the plan defines (h) at chroma ≥ 20 | Fix: `turquoiseLiterals(text, minChroma)` and (h) passes 20 | Files: lib/accent-theme.test.ts | Verification: 24/24 tests | Commit: 09cd765

**[Rule 3 - Blocker] Plan verify one-liners lose doubled backslashes on Windows** — Found during: Task 3 | The `node -e '…new RegExp("\\s…")'` check reported `--bg does not follow` because the shell path halves `\\` | Fix: ran the identical check from a file: `D-16 OK 391` | No code change

**Exclusion scope:** "the .custom-hue rule" implemented as selectors containing `.custom-hue input` (rainbow gradient and thumb); the `.custom-hue > span` label is converted. Same skip list in converter and test (g).

**Total deviations:** 2 auto-fixed (1 bug, 1 blocker). **Impact:** none on behaviour.

## Issues Encountered

None.

## Verification

- npm test 24/24 (13 existing + 11 accent-theme), tsc clean, lint 0 errors (13 pre-existing warnings), build OK
- Tracer check `tracer OK`; Task 2 check `recolor OK 210/27`; Task 3 check `D-16 OK 391`
- Mutation probe: a re-added turquoise literal fails test (g)
- Human-check approved by user

## Next

Ready for 02-02.

## Self-Check: PASSED
