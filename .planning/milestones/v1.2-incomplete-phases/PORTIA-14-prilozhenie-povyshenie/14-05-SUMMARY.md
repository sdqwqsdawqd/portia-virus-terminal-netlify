---
phase: 14-prilozhenie-povyshenie
plan: 05
subsystem: ui
tags: [promotion, participant, desktop-window, responsive, safe-dto]

requires:
  - phase: 14-03
    provides: safe public status and request endpoints with device binding
provides:
  - standalone Повышение desktop shortcut and window
  - participant nickname gate, ordinary and qualification state cards
  - immutable assigned-task projection, recent results and stale-safe polling
affects: [14-07, 14-08, 14-09, 14-10]

tech-stack:
  added: []
  patterns: [visible-window polling, preserve-last-safe-state, explicit participant DTO, read-only snapshot list]

key-files:
  created: [components/portia-promotion.tsx, lib/portia-promotion-ui.test.ts]
  modified: [components/portia-desktop.tsx, components/portia-icons.tsx, app/portia.css, lib/portia-promotion-api.ts, supabase/portia_setup.sql, supabase/phase14_apply.sql]

key-decisions:
  - "The participant nickname remains React session state only; the opaque device identity remains HttpOnly."
  - "A 503 or connection failure preserves the last safe projection, marks it stale and disables request actions."
  - "Assigned ordinary tasks are projected as id, text and sortOrder only; reviewer and answer fields never enter the public DTO."

patterns-established:
  - "Participant polling runs only while the promotion window and browser document are visible."
  - "Ordinary promotion and qualification always use separate cards, labels, nouns and actions."

requirements-completed: [PROM-01, TASK-05, COOL-01, COOL-02, COOL-03, COOL-04, RETRY-01, DATA-04]

duration: 15 min
completed: 2026-10-27
---

# Phase 14 Plan 05: Participant Promotion Application Summary

**A standalone PORTIA OS application that gives a participant one safe next action, keeps ordinary assignments separate from qualification and renders immutable assigned tasks.**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-10-27
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Registered «Повышение» as an independent draggable shortcut, window, taskbar item and start-menu entry with its own icon and geometry.
- Added the nickname gate, first-request device-binding notice and explicit neutral errors without storing the nickname in browser storage.
- Rendered ordinary promotion and qualification as distinct cards with cooldown, required qualification, special-task, pending, claimed, assigned, review, pass and retake states.
- Added visible-window polling that pauses with the document and preserves the last safe projection on temporary service failure.
- Added responsive single-column styling, 44px actions, focus transfer, reduced-motion handling and a compact maximum-three result history.
- Exposed only immutable assigned-task text and order from the public status RPC.

## Task Commits

1. **RED: participant application contracts** — `9a6112a` (test)
2. **Tasks 1–2: participant application and ordinary flow** — `f90ac85` (feat)

## Decisions Made

- The application does not offer nickname switching after lookup; device reset remains a trusted reviewer action.
- A stale state is readable but cannot submit a request, so a delayed client can never authorize an irreversible action.
- Qualification test controls are intentionally deferred to Plans 14-07/14-08; Plan 14-05 shows only the safe current status.

## Deviations from Plan

- Extended the existing public-status RPC and DTO with the already-confirmed ordinary assignment items. This was necessary for the planned immutable task list; the projection is restricted to `id`, `text` and `sortOrder` and mirrored in both SQL files.

## Issues Encountered

- Repository-wide lint retains the same three pre-existing errors outside Plan 14-05: two archived CommonJS scripts and the existing guide ref read during render. All new phase files pass scoped ESLint.

## User Setup Required

- None now. SQL changes were recorded only and remain for the owner-run rollout in Plan 14-09.

## Next Phase Readiness

- The participant shell is ready for the protected qualification runner in Plans 14-07/14-08.
- The next planned work is the trusted reviewer workspace and bank management in Plan 14-06.

## Self-Check: PASSED

- `npm test`: 474/474 passed.
- `npx tsc --noEmit`: passed.
- Scoped ESLint: passed.
- `npm run build`: passed.
- SQL recorded, not applied.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-27*
