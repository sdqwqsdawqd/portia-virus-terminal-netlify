---
phase: 14-prilozhenie-povyshenie
plan: 07
subsystem: api
tags: [qualification, deadline, forward-only, grading, retake]
requires:
  - phase: 14-03
    provides: device binding and roster-safe public boundary
  - phase: 14-04
    provides: immutable qualification snapshots and reviewer authorization
provides:
  - deterministic qualification state machine and safe current-question projection
  - server-authoritative 15-minute test RPCs and participant endpoint
  - reviewer grading, explicit final decision and configurable retake commands
affects: [14-08, 14-09, 14-10]
tech-stack:
  added: []
  patterns: [single-question projection, nonce idempotency, first-terminal-event, explicit-final-decision]
key-files:
  created: [lib/portia-qualification.ts, lib/portia-qualification.test.ts, app/api/promotion/test/route.ts]
  modified: [app/api/promotion/reviewer/route.ts, lib/portia-promotion-reviewer.ts, supabase/portia_setup.sql, supabase/phase14_apply.sql]
key-decisions:
  - "Confirming the immutable test starts its 15-minute server deadline immediately; start is an idempotent read and never resets time."
  - "Client mode is inferred from request headers and may change only before the first answer."
  - "Percentage is derived from reviewer marks but pass/fail remains a separate explicit command."
requirements-completed: [QUAL-05, QUAL-06, QUAL-07, QUAL-08, QUAL-09, QUAL-10, QUAL-11, QUAL-12, QUAL-13, RETRY-02, RETRY-03, RETRY-04]
duration: 20 min
completed: 2026-10-28
---

# Phase 14 Plan 07: Qualification Engine Summary

The qualification lifecycle now has a server-authoritative 15-minute deadline, forward-only answers, protected public projections, reviewer grading and an explicit final decision.

## Accomplishments

- Added a deterministic qualification state machine with nonce-idempotent answers and first-terminal-event handling.
- Added the participant test endpoint that exposes only the current question and never resets the deadline on reload.
- Added reviewer commands for per-answer grading, final pass/fail decisions and configurable retake periods.
- Updated both SQL artifacts with the same qualification lifecycle contracts; neither artifact has been applied to the live database.

## Commits

| Commit | Description |
|--------|-------------|
| `b0c87f1` | Add failing qualification engine contracts |
| `27ae7a3` | Add deterministic qualification state machine |
| `a5ea1ac` | Add protected qualification lifecycle APIs |

## State Model

`prepared → active → submitted → reviewed`

`active → auto-failed → reviewed`

The public DTO contains only the current question and safe status fields. Correct answers, future questions, technical failure details and reviewer-only metadata remain in the trusted reviewer boundary.

## Deviations from Plan

- Added an `answer_nonce` uniqueness boundary and a dedicated current-test RPC so repeated submissions and reloads remain safe across network retries.
- Confirmation starts the server deadline immediately; the participant start action is therefore an idempotent read instead of a second timer mutation.

## Verification

- `npm test`: 486 tests passed.
- `npx tsc --noEmit`: passed.
- Scoped lint for Phase 14 files: passed.
- Production build: passed.
- Full repository lint retains three known pre-existing findings outside this plan.

## Setup Required

The owner SQL rollout remains deferred to Plan 14-09. No live database changes were made.

## Self-Check: PASSED

All declared artifacts exist, qualification tests pass, and all implementation commits are present.
