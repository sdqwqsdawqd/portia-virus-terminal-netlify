---
phase: 14-prilozhenie-povyshenie
plan: 01
subsystem: api
tags: [promotion, eligibility, google-sheets, csv, node-test]

requires:
  - phase: PORTIA-07
    provides: existing Google CSV parser and fail-closed employee loading pattern
provides:
  - canonical eight-title ladder with server-time cooldown and qualification decisions
  - strict read-only Portia A61:E85 roster loader with unavailable/not-found separation
  - safe promotion eligibility DTO contracts for public and reviewer APIs
affects: [14-03, 14-04, 14-05, 14-07]

tech-stack:
  added: []
  patterns: [pure server-time eligibility, discriminated external-source result, strict boundary normalization]

key-files:
  created: [lib/portia-promotion.ts, lib/portia-promotion.test.ts, lib/portia-promotion-sheet.ts, lib/portia-promotion-sheet.test.ts]
  modified: []

key-decisions:
  - "Column E is normalized as the date the current title was received; availability is that server-parsed date plus the title cooldown."
  - "Unknown titles, wrong successors, invalid dates and duplicate nicknames make the roster unavailable instead of partially authoritative."

patterns-established:
  - "Promotion decisions always receive an explicit server timestamp and never read Date.now internally."
  - "Sheet integration returns ok or unavailable; nickname absence is checked only inside a healthy roster."

requirements-completed: [PROM-02, PROM-03, PROM-06, COOL-01, COOL-02, COOL-03, COOL-04, COOL-05, DATA-01]

duration: 12 min
completed: 2026-10-27
---

# Phase 14 Plan 01: Promotion Rules and Roster Summary

**Eight-title promotion rules with exact server-time cooldowns and a strict, read-only A61:E85 roster boundary that never disguises outages as missing nicknames.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-27T10:15:00Z
- **Completed:** 2026-10-27T10:27:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Encoded the complete title ladder, 7/3/4/6/8/10/18-day waits, qualification gates at levels 2/4/6, sheet-change lock and Expert special task.
- Added a dedicated `A61:E85` CSV loader with no-store caching, eight-second timeout, bounded input and strict headers, dates, title order and duplicate checks.
- Added 13 promotion-focused tests while preserving the employee loader and its 34-slot boundary.

## Task Commits

1. **Task 1 RED: promotion eligibility contracts** — `54315cc` (test)
2. **Task 1 GREEN: promotion eligibility rules** — `0bf1952` (feat)
3. **Task 2: isolated promotion roster loader** — `6ef06d4` (feat)

## Files Created/Modified

- `lib/portia-promotion.ts` — canonical titles, public states and pure eligibility decisions.
- `lib/portia-promotion.test.ts` — table-driven cooldown, qualification and state tests.
- `lib/portia-promotion-sheet.ts` — strict read-only roster loader and nickname lookup.
- `lib/portia-promotion-sheet.test.ts` — CSV, outage, invalid-input and title-spelling fixtures.

## Decisions Made

- The sheet date is converted to UTC midnight and title cooldown days are added using server-supplied time.
- The formula text in «Анти-Спидран» is retained for safe status display, while the server recomputes the actual boundary from the normalized date.
- A malformed single populated row invalidates the complete roster; partial authorization from damaged external data is unsafe.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Repository-wide lint remains blocked by three pre-existing errors outside this plan: two archived CommonJS scripts and an existing ref access during render in `components/portia-desktop.tsx`. All four plan files pass ESLint directly; the full test suite and TypeScript check pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 14-03 and 14-04 can consume one normalized roster contract and the pure eligibility function.
- No production request, Google Sheet write or Supabase write was performed.

## Self-Check: PASSED

- All four key files exist and all three task commits are present.
- `npm test`: 436/436 passed.
- `npx tsc --noEmit`: passed.
- Scoped ESLint for all Plan 14-01 files: passed; unrelated repository lint debt recorded above.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-27*
