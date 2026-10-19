---
phase: 02-vneshniy-vid
plan: 05
subsystem: ui
tags: [motion, boot-screen, character-animation, css-animations]

requires:
  - phase: 02-04
    provides: "html[data-motion] gate, motion tokens, fade-in keyframes"
provides:
  - "Boot spider gated on its PNG (markReady), four typed terminal lines instead of the progress bar"
  - "Vivian: hop on automatic phrases, escalating click squash with head-shake, sulk and recovery, hover perk-up"
affects: [02-06]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Restart a CSS animation per click by alternating two identical keyframes (data-squish a/b), never by remounting"
    - "Character motion with individual translate/scale/rotate from transform-origin 50% 100%, composing with hover transform"

key-files:
  created: []
  modified: [components/portia-desktop.tsx, app/portia.css]

key-decisions:
  - "Diagnosis (D-10): the spider never descended because the user's OS requests reduced motion; the image gate removes the late-PNG risk as well"
  - "User chose the upgraded Vivian: bigger squash-and-stretch hop, head-shake at annoyance 3, glance back on recovery, hover perk-up"
  - "No idle animation for Vivian (D-14)"
  - "Motion gated by html[data-motion] instead of the plan's prefers-reduced-motion blocks (02-04 revision)"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Boot: spider descends once its PNG is ready; four terminal lines type under it within the 1650 ms boot"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "browser: .boot-core.is-ready, spider-descend running, four boot-type lines at 200/480/760/1040 ms; prerendered HTML has the lines and no boot-progress"
        status: pass
    human_judgment: true
    rationale: "Look of the boot sequence approved by the user"
  - id: D2
    description: "Vivian reactions: hop, escalating squash, sulk, recovery, hover"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "browser: 21-click streak → data-mood 1→2, vivian-squish a/b alternating, same img element, vivian-offended, then is-recovering with vivian-recover and colour restored"
        status: pass
    human_judgment: true
    rationale: "Character feel approved by the user; the automatic-phrase hop was left to the user's check (timer 45-120 s)"

duration: 40 min
completed: 2026-10-13
---

# Phase 2 Plan 05: Boot spider and Vivian Summary

**The boot spider now waits for its image and descends while four terminal lines type under it, and Vivian became a character: she leaps on her own phrases, squashes harder (and finally shakes her head) as clicks annoy her, sulks turned away and grey, glances back before turning round, and perks up when hovered.**

## Diagnosis (D-10)

`matchMedia("(prefers-reduced-motion: reduce)")` is `true` on the user's PC: the static spider was the OS setting, not a bug. With «Анимации: Включены» (added in 02-04) the descent plays. The new image gate (`markReady`: onLoad / onError / `img.complete` before hydration, `fetchPriority="high"`) also removes the late-PNG cause.

## Accomplishments

- **Boot (`7837ca7`):** spider and thread `animation-play-state: paused` until `.boot-core.is-ready`; `bootLines` (4 lines) typed at 200 + n·280 ms with `steps(18)` clip; done by 1.3 s, boot still 1650 ms, failsafe unchanged; `.boot-progress`, `boot-load`, `boot-pulse` removed. Reduced motion: lines and spider fade in place.
- **Vivian (`9248c3c`):** `assistantMood` (1–3 by streak time vs patience), `assistantSquish` parity, `assistantRecovering` (780 ms after the 10 s sulk); `data-mood` / `data-squish` / `data-auto` on the container, her `<img>` untouched. CSS: `vivian-hop` (620 ms crouch–leap 14 px–land), `vivian-squish-a/b`, `vivian-huff-a/b` (mood 3), `vivian-offended` (shudder then mirror + crouch), `vivian-recover` (glance back, turn round), `vivian-bubble` spring; static sulk pose and mood variables apply in both modes; hover / focus lean toward the cursor.

## Task Commits

1. Task 1 — `7837ca7` feat(02-05): boot spider descends once its PNG is ready; terminal lines type under it
2. Tasks 2–3 — `9248c3c` feat(02-05): Vivian reworked: hop, escalating squash, sulk and recovery, hover perk-up

## Deviations from Plan

- **[User revision] Upgraded Vivian** — larger hop, head-shake, glance back, hover perk-up (chosen at review).
- **[Revision 02-04] Motion gate** — `html[data-motion]` selectors instead of `prefers-reduced-motion` blocks; reduced motion fades the bubble and boot lines rather than cutting them.
- **Tasks 2 and 3 in one commit** — the click, sulk and recovery rules share selectors and keyframe ordering.

**Total deviations:** 3. **Impact:** none beyond the user-requested richness.

## Verification

- npm test 25/25, tsc clean, lint 0 errors, build OK, Impeccable detector 0 findings
- Browser checks listed in coverage; user approved

## Next

Ready for 02-06.

## Self-Check: PASSED
