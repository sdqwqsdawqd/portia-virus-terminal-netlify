---
phase: 14-prilozhenie-povyshenie
plan: 16
subsystem: promotion-participant-ui
tags: [react, eligibility, request-feedback, accessibility, localization]
requires:
  - phase: 14-15
    provides: accepted-submit binding and typed RPC failure categories
provides:
  - single-punctuation Russian calendar cooldown copy
  - exhaustive participant action-or-reason eligibility cards
  - independent ordinary and qualification submit feedback with focus management
  - transport-only stale state and server-backed cookie restoration
affects: [14-17, 14-19, 14-14]
tech-stack:
  added: []
  patterns: [per-flow-submit-state, focused-inline-feedback, locale-punctuation-normalization]
key-files:
  created: []
  modified: [components/portia-promotion.tsx, app/portia.css, lib/portia-promotion-ui.test.ts]
key-decisions:
  - "Russian long dates have their formatter-owned terminal period stripped before the surrounding sentence adds exactly one period."
  - "Ordinary and qualification submission state is isolated per card; typed server refusals remain local while transport failures alone mark the shared projection stale."
requirements-completed: [PROM-01, PROM-03, COOL-01, COOL-02, COOL-03, COOL-04, COOL-05]
duration: 10 min active
completed: 2026-10-29
---

# Phase 14 Plan 16: Participant Eligibility and Request Feedback Summary

**Promotion cards now present one truthful action or reason, format Russian cooldown dates once, and keep request feedback local to the affected flow.**

## Performance

- **Duration:** 10 min active (continued after an overnight pause)
- **Started:** 2026-10-28T16:57:19Z
- **Completed:** 2026-10-29T03:14:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Normalized `ru-RU` long-date punctuation so `11 ноября 2026 г.` never becomes `г..`, while cooldown copy remains date-only.
- Codified the participant matrix for cooldown, qualification prerequisite/not-applicable, sheet wait, special task, eligible and active states.
- Replaced one global request busy/error state with independent ordinary and qualification feedback, duplicate-submit protection and focused status/alert messages.
- Kept typed API refusals beside the relevant card; only a transport failure switches the shared projection to stale and disables actions.
- Verified the exported window in the in-app browser with a fabricated missing nickname: busy transition and localized safe refusal rendered without runtime overlay or production mutation.

## Eligibility-State Matrix

| State | Participant result |
|---|---|
| `eligible` | One enabled request action |
| `cooldown` | Date-only «Доступно с …» reason |
| ordinary `qualification-required` | Qualification prerequisite reason |
| qualification `qualification-required` | Qualification-not-required reason |
| `awaiting-sheet-change` | Explicit sheet-wait reason |
| ordinary `special-task` | Special-task explanation plus request action |
| active request | Active lifecycle copy, no duplicate action |
| transport stale | Last safe data plus global connection warning; actions disabled |

## Task Commits

1. **Task 1 RED: expose date punctuation gap** — `1ed6bb1` (test)
2. **Task 1 GREEN: normalize calendar punctuation** — `2838756` (fix)
3. **Task 2 RED: expose coupled submit feedback** — `6c634ff` (test)
4. **Task 2 GREEN: isolate request feedback** — `3910044` (fix)

## Files Created/Modified

- `components/portia-promotion.tsx` — locale punctuation normalization and independent submit state/focus behavior.
- `app/portia.css` — established inline submitting, success and error feedback styles.
- `lib/portia-promotion-ui.test.ts` — eligibility matrix, punctuation and submit-state regressions.

## Decisions Made

- A response with an HTTP error is a valid typed server outcome and must not erase the last projection or make the other card inert.
- The HttpOnly device cookie remains the only identity restoration mechanism; no nickname is persisted in local or session storage.

## Deviations from Plan

- The automated matrix covers eligible and cooldown participants, but no owner-approved temporary roster participant was available for browser submission. Browser evidence therefore used a fabricated not-listed nickname and performed no write. Eligible submit/reload remains in final owner UAT.

**Total deviations:** 1 safe-data constraint. **Impact:** No production participant or request was mutated; objective UI and API behavior is covered by executable tests and production build.

## Issues Encountered

- The existing global `busy` state coupled both cards and the global `error` surface hid which request failed. Per-kind state removed the ambiguity.

## User Setup Required

None.

## Verification

- `node --experimental-strip-types --test lib/portia-promotion-ui.test.ts lib/portia-promotion.test.ts`: 19/19 passed.
- `node --experimental-strip-types --test lib/portia-promotion-ui.test.ts lib/portia-promotion-api.test.ts`: 27/27 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- In-app browser: window opened, busy state rendered, safe not-listed response appeared, no runtime overlay observed.

## Next Phase Readiness

- Participant flow is ready for integrated verification in 14-19.
- Bank count/CRUD/preview remediation can proceed in 14-17.

## Self-Check: PASSED

Both task test suites, TypeScript, production build and non-mutating browser smoke check passed; the real eligible submission is explicitly reserved for owner UAT.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-29*
