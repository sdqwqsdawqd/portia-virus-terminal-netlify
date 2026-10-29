---
phase: 14-prilozhenie-povyshenie
plan: 17
subsystem: promotion-reviewer-banks
tags: [react, supabase, reviewer, task-bank, qualification, preview]
requires:
  - phase: 14-16
    provides: stable participant eligibility and request feedback
provides:
  - authoritative required-count and qualification-quota settlement
  - reliable ordinary task and typed qualification question CRUD
  - version-bound preview, replacement and immutable confirmation flow
affects: [14-18, 14-19, 14-14]
tech-stack:
  added: []
  patterns: [authoritative-state-settlement, draft-preserving-mutation, version-bound-preview]
key-files:
  created: []
  modified: [components/portia-promotion-editor-main.tsx, components/portia-promotion-ordinary-editor.tsx, components/portia-promotion-qualification-editor.tsx, app/api/promotion/banks/route.ts, app/portia.css, lib/portia-promotion-reviewer.ts]
key-decisions:
  - "A bank mutation is successful in the UI only when the API returns the refreshed authoritative bank state."
  - "An existing bank cannot save counts or per-type quotas above its current active pool; initial bank creation remains possible."
  - "Every preview is tagged with the server-returned bank version and any successful bank mutation invalidates it."
requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-04, QUAL-01, QUAL-02, QUAL-03, QUAL-04, EDIT-01, EDIT-02]
duration: 25 min active
completed: 2026-10-29
---

# Phase 14 Plan 17: Reviewer Bank Workflow Summary

**Ordinary tasks and qualification questions now use authoritative saves, draft-safe CRUD and server-versioned previews instead of ambiguous fire-and-forget controls.**

## Accomplishments

- Required task count and all three qualification quotas are integer-bounded, checked against the authoritative active pool and restored from the refreshed server state after save.
- Failed saves leave the entered count, quota, task text and question fields intact; duplicate writes are blocked while a command is in flight.
- Added explicit saving, saved and error announcements and applied the established primary, secondary and destructive PORTIA control hierarchy.
- Added client and server validation for single-choice, multiple-choice and free-text answer shapes.
- All successful count, quota and item mutations invalidate any local preview.
- Preview responses now include their authoritative bank version; replacement preserves position, uniqueness and question type, while stale tokens fail closed.
- The command route refuses to report success when the refreshed authoritative state cannot be read.

## Command/State Matrix

| Operation | While pending | Success | Failure |
|---|---|---|---|
| Count / quotas | Controls blocked; saving status announced | Draft removed only after authoritative state reload | Draft remains visible with a specific reason |
| Add / edit | One request allowed; submitted values captured | Server state replaces the bank; untouched submitted draft clears | Typed draft remains in the form |
| Enable / reorder / delete | Stable item id sent | Preview invalidated and updated state rendered | Existing server item remains visible |
| Preview / replace | Server selects from active current-version pool | Token, order and server version stored together | Insufficient or stale reason shown |
| Confirm | Token checked against current version and active ids | Immutable assignment/test snapshot created | Stale, duplicate or changed sets rejected |

## Task Commits

1. **Task 1 RED:** `c33611f` — authoritative settings expectations.
2. **Task 1 GREEN:** `8fea76a` — active-pool validation and authoritative settlement.
3. **Task 2 RED:** `65741fc` — reliable CRUD expectations.
4. **Task 2 GREEN:** `64ea8fb` — duplicate protection, typed validation, status and controls.
5. **Task 3 RED:** `acf4227` — versioned preview lifecycle expectations.
6. **Task 3 GREEN:** `b44dec8` — server-versioned preview and type-preserving replacement.
7. **Regression fix:** `980dac0` — command status follows the selected accent theme.

## Browser Evidence

- Local public Promotion window loaded in the in-app browser without a Next.js runtime overlay.
- A fabricated missing nickname remained a read-only smoke case; no participant or bank data was written.
- The reviewer screen correctly remained behind `/owner-login`; no credentials or production mutations were fabricated.
- Responsive editor behavior is covered by the sequential phone-view source contract and production build. Final authenticated PC/phone interaction remains owner UAT.

## Verification

- `node --experimental-strip-types --test lib/portia-promotion-editor.test.ts lib/portia-promotion-reviewer.test.ts lib/portia-promotion-security.test.ts`: 43/43 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npm test`: 562 passed, 1 opt-in live test skipped, 0 failed.
- `npm run lint`: existing repository-wide failures remain in archived `.planning` CommonJS scripts and `components/portia-desktop.tsx:1782`; no Plan 14-17 file produced a lint error.

## Deviations from Plan

- Authenticated reviewer browser writes and physical-phone interaction were not performed because no owner-approved temporary editor/test bank was available. The workflow is covered by deterministic tests, TypeScript and production build; final owner UAT remains in 14-14.

## Next Phase Readiness

- Reviewer bank remediation is complete and Plan 14-18 can address spider lifecycle, symmetric window bounds and shortcut animation handoff.

## Self-Check: PASSED

All Plan 14-17 targeted tests, the full test suite, TypeScript and production build pass. The only skipped test is the explicitly opt-in live isolated-Supabase suite.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-29*
