---
phase: 02-vneshniy-vid
plan: 03
subsystem: ui
tags: [fonts, next-font, ibm-plex-mono, typography, css]

requires:
  - phase: 02-01
    provides: "accent tokens and Vivian filters (retuned here after user feedback)"
provides:
  - "Interface in IBM Plex Mono (latin + cyrillic, 400-700) via --sans/--display/--mono"
  - "--doc token (Golos Text) for long document text"
  - "Only Golos Text, IBM Plex Serif and IBM Plex Mono ship"
affects: [02-04, 02-05, 02-06]

actuals:
  tokens: 6000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Interface face = var(--sans) (Plex Mono); document text = var(--doc) (Golos) in the shared area rule"

key-files:
  created: []
  modified: [app/layout.tsx, app/portia.css]

key-decisions:
  - "--sans/--display/--mono all point to Plex Mono; token names kept (no churn over 160 uses)"
  - "Plain-text trash files (.trash-text-document pre) stay monospace on var(--mono), now Plex Mono"
  - "Vivian's name label and bubble heading: IBM Plex Mono 500 (user pick from a live comparison after rejecting Plex Serif)"
  - "Vivian's label centred under her; .desktop-assistant right offset keeps it 8px inside the screen at 901-1440px"
  - "Vivian amber/red filters retuned to ~0.78 relative saturation like Portia (user saw her go grey switching amber/red)"

patterns-established:
  - "No font weight above 700 (Plex Mono stops at 700)"

requirements-completed: [LOOK-02]

coverage:
  - id: D1
    description: "Interface in IBM Plex Mono with Cyrillic, self-hosted; document areas on --doc / --serif"
    requirement: LOOK-02
    verification:
      - kind: other
        ref: "plan 02-03 Task 1 check: font tracer OK (Cyrillic @font-face, tokens, shared area rules)"
        status: pass
      - kind: other
        ref: "plan 02-03 Task 2 check: font cleanup OK (no retired faces, no runtime Google Fonts URL, no 800)"
        status: pass
    human_judgment: true
    rationale: "Look of the font and layout fit judged by the user on PC and phone; approved"
  - id: D2
    description: "No label overflows at 375-1440px with the wider glyphs"
    requirement: LOOK-02
    verification:
      - kind: automated_ui
        ref: "browser overflow scan (scrollWidth > clientWidth without ellipsis) at 375/408/430/520/900/1440px: none"
        status: pass
    human_judgment: true
    rationale: "Visual fit approved by the user"

duration: 70 min
completed: 2026-10-13
---

# Phase 2 Plan 03: Interface font IBM Plex Mono Summary

**The interface now renders in self-hosted IBM Plex Mono with Cyrillic, long document texts keep Golos (new `--doc`) and scientist records Plex Serif, the two retired faces and weight 800 are gone, and Vivian got a centred Plex Mono 500 name label plus even saturation in every theme.**

## Accomplishments

- `app/layout.tsx`: `IBM_Plex_Mono` (latin + cyrillic, 400/500/600/700, `--font-plex-mono`); loads exactly Golos Text, IBM Plex Serif, IBM Plex Mono.
- `:root`: `--sans`, `--display`, `--mono` → `var(--font-plex-mono)`; new `--doc` (Golos).
- Shared area rules on `var(--doc)`: lead, metric, mutation, info, broadcast, trash, caption. Scientist `var(--serif)`, assistant `var(--assistant-font)`, search buttons `var(--sans)` unchanged; each field still shares its area's rule.
- 9 × `font: 800` → 700; 7 former display titles `letter-spacing -.045em/-.04em` → `-.02em` (`.global-search-header h1`, `.info-app h1, .settings-app h1, .trash-app h1`, `.info-document h1`, `.broadcasts-app header h1`, `.editor-header h1`, `.record-header h2`, `.archive-document-paper h1`).
- Fit audit: overflow scan at 375/408/430/520/900/1440 px found no clipped label; no layout rule needed changing.

## User feedback during the human check (fixed)

1. Vivian looked greyish switching amber ↔ red: amber `saturate(.5)` gave 0.54 of the accent chroma, red `saturate(1.3)` 1.29. Now amber `hue-rotate(218deg) saturate(.75)`, red `hue-rotate(166deg) saturate(.7)`, both ≈ 0.78 like Portia; 218° (≡ −142°) keeps the amber/red transition short. — `98c60f9`
2. Vivian's name font: Plex Serif tried (`7788030`), rejected; user picked IBM Plex Mono 500 from a live six-font comparison. — `7a8144b`
3. Label not centred on the spider: `align-self: flex-end` → `center`; `.desktop-assistant` `right: max(18px, calc(78px - clamp(38px, 4.2vw, 52px)))` keeps the 141 px label 8 px inside the screen (measured 901/1100/1280/1440 px). — `7a8144b`
4. Spider descent on the boot screen: already planned in 02-05 (D-10); deferred there by the user.

Glyphs ⌕ ✎ ✓ ≡ □ ―: user raised no objection.

## Task Commits

1. Task 1 — `f37592a` feat(02-03): interface in IBM Plex Mono, document text kept in Golos
2. Task 2 — `5ac1e96` feat(02-03): retired faces removed, weight 800 gone, titles tracked for monospace
3. Fixes — `98c60f9`, `7788030`, `7a8144b`

## Deviations from Plan

**[Rule 1 - Bug] Vivian amber/red saturation** (from plan 02-01) — fixed as above; accent-theme test (d) still passes.

**[User request] Vivian label font and centring** — outside the plan's task list, applied on user feedback during the checkpoint.

**Placeholder rule:** `.formatted-rich-input:empty::before` (the «Введите текст…» hint, pre-existing) sets its own font; it is a UI hint, not a field font, so the 01-04 shared-rule constraint does not apply. It now renders in Plex Mono.

**Total deviations:** 1 bug fix, 2 user-requested tweaks. **Impact:** Vivian sits 8–22 px further from the right edge on desktops.

## Issues Encountered

None.

## Verification

- tsc clean, lint 0 errors, npm test 24/24, clean build
- `font tracer OK`, `font cleanup OK` (run from files; Windows halves doubled backslashes in inline `node -e`)
- Human check approved by the user

## Next

Ready for 02-04.

## Self-Check: PASSED
