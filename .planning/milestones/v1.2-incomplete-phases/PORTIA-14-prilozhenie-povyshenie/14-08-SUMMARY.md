---
phase: 14-prilozhenie-povyshenie
plan: 08
subsystem: ui
tags: [qualification, participant, reviewer, anti-cheat, responsive]
requires:
  - phase: 14-06
    provides: trusted reviewer workspace and immutable bank previews
  - phase: 14-07
    provides: protected qualification lifecycle APIs
provides:
  - server-derived participant countdown and one-question runner
  - desktop focus and connectivity terminal handling with phone-specific protection
  - reviewer grading, explicit final decision, override and retake controls
affects: [14-09, 14-10]
tech-stack:
  added: []
  patterns: [deadline-derived-countdown, terminal-ui-replacement, independent-final-decision]
key-files:
  created: [lib/portia-qualification-ui.test.ts]
  modified: [components/portia-promotion.tsx, components/portia-promotion-editor.tsx, app/portia.css, lib/portia-promotion-api.ts, lib/portia-promotion-ui.test.ts, supabase/portia_setup.sql, supabase/phase14_apply.sql]
key-decisions:
  - "The participant reload path reads the existing attempt and never mutates or resets its deadline."
  - "Desktop focus, visibility and page-exit events immediately replace editable controls; phone omits those listeners but keeps offline failure handling."
  - "Reviewer marks derive a percentage, while pass/fail remains a separate confirmed action."
requirements-completed: [QUAL-05, QUAL-06, QUAL-07, QUAL-08, QUAL-09, QUAL-10, QUAL-11, QUAL-12, QUAL-13, RETRY-02, RETRY-03, RETRY-04]
duration: 20 min
completed: 2026-10-28
---

# Phase 14 Plan 08: Qualification Interfaces Summary

Participants now receive a single protected question with a server-derived 15-minute countdown, while reviewers grade answers and make a separate explicit final decision.

## Accomplishments

- Added the participant warning, sticky countdown, radio/checkbox/free-text answer controls and forward-only submission.
- Added desktop visibility, blur, page-exit and offline terminal handling; phone retains connection-loss handling without focus protection.
- Added participant submitted, terminal and result states that never disclose per-answer diagnostics.
- Added reviewer answer grading, technical-failure override, independent pass/fail confirmation, configurable retake days and early release.
- Extended the safe public projection with only the attempt handle and optional final percentage required by the UI.

## Commits

| Commit | Description |
|--------|-------------|
| `40a037a` | Add failing qualification interface contracts |
| `1bce519` | Add qualification participant and reviewer interfaces |

## Deviations from Plan

- The public status projection required a safe `attemptId` and optional final percentage so the participant UI could load the existing test and show its result. No question keys, future questions or reviewer data were added.
- The participant reload uses the read-only current-test request rather than a second start command because confirmation already starts the deadline.

## Verification

- `npm test`: 493 tests passed.
- `npx tsc --noEmit`: passed.
- Scoped lint for all modified Phase 14 TypeScript files: passed.
- Production build: passed.
- Full repository lint retains the same three known pre-existing errors in archived scripts and the Guide ref initializer.

## Setup Required

The synchronized SQL additions remain recorded only. Owner rollout is the explicit checkpoint in Plan 14-09.

## Self-Check: PASSED

The runner, terminal states, grading workspace and responsive styles exist; tests, typecheck and production build pass.
