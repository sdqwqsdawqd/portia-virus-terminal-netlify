---
phase: 01-ispravlenie-bagov
plan: 03
subsystem: ui
tags: [nextjs, metadata, dark-reader, gap-closure]
requires:
  - phase: 01-ispravlenie-bagov
    provides: "01-01 layout/fonts baseline; 01-VERIFICATION gap on darkreader-lock"
provides:
  - "darkreader-lock meta actually rendered in the built home page head"
affects: [app/layout.tsx]
tech-stack:
  added: []
  patterns: ["metadata.other entries need non-empty content or Next 16 drops them"]
key-files:
  created: []
  modified: [app/layout.tsx]
key-decisions:
  - "Value \"true\" for darkreader-lock; Dark Reader only checks tag existence"
requirements-completed: []
duration: 6min
completed: 2026-10-13
status: complete
commits: 1
plan_head_before: 85bce210ea952f337f678104eb1ca4941741e545
plan_head_after: a4df8520f922ff36c18eb47cfa8a20a489fa6521
actuals:
  tokens: 300
  tasks: 1
  commits: 1
---

# Phase 01 Plan 03: darkreader-lock meta fix Summary

**`metadata.other["darkreader-lock"]` changed from `""` to `"true"` so Next 16.3.4 emits the meta tag; verified in the production build head.**

## Accomplishments
- Closed CR-01 / the 01-VERIFICATION gap: Next drops `other` metas with empty content, so the committed lock never rendered.
- Built `.next/server/app/index.html` now has `<meta name="darkreader-lock" content="true"/>` at offset 2896, before `</head>` (3175).
- `npx tsc --noEmit`, `npm run lint` (0 errors, 13 existing warnings), `npm test` (13 pass), `npm run build` all exit 0.

## Task Commits
1. Task 1 (tracer): `a4df852` fix(layout): emit darkreader-lock meta (CR-01) — app/layout.tsx only, +2/-1.

## Deviations from Plan
None - plan executed exactly as written.

Notes (not deviations):
- The dev server on port 3123 did not answer curl (HTTP 000) during the run, so the optional dev-HTML check was skipped; the build-output check is the authoritative evidence.
- The on-disk plan commit ledger `gsd-plan-head-before-01-03` pre-existed with an older base (83d176b), which would count 5 docs commits; `plan_head_before` above uses the actual HEAD at plan start (85bce21), giving the measured 1 commit.

## Human check pending
With Dark Reader enabled, open the site and confirm the extension reports the site as locked/own-dark-theme (extension behaviour is not observable from build output).

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
- app/layout.tsx contains `"darkreader-lock": "true"`: FOUND
- Commit a4df852 is an ancestor of HEAD: FOUND
- Commit touches only app/layout.tsx: confirmed
