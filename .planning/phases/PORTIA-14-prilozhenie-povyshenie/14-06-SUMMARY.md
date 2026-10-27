---
phase: 14-prilozhenie-povyshenie
plan: 06
subsystem: ui
tags: [promotion, reviewer, queues, banks, preview]
requires:
  - phase: 14-04
    provides: trusted reviewer and bank APIs
  - phase: 14-05
    provides: participant application and ordinary flow
provides:
  - trusted promotion editor tab with live split queues and atomic claim feedback
  - ordinary and qualification bank workspaces with exact immutable previews
  - reviewer task approval, release, reject and owner recovery controls
affects: [14-07, 14-08, 14-09, 14-10]
tech-stack:
  added: []
  patterns: [trusted-tab mount, server-owned claim state, signed preview replacement]
key-files:
  created: [components/portia-promotion-editor.tsx, lib/portia-promotion-editor.test.ts]
  modified: [components/portia-editor.tsx, app/portia.css, app/api/promotion/banks/route.ts]
key-decisions:
  - "The editor shell only mounts the workspace when the server-projected openTabs contains promo."
  - "Selection survives queue refresh; a lost claim race refreshes state and leaves the occupied request open."
  - "Per-item preview replacement is re-signed by the server and preserves qualification question type."
requirements-completed: [TASK-01, TASK-02, TASK-03, TASK-04, TASK-06, TASK-07, QUAL-01, QUAL-02, QUAL-03, QUAL-04, EDIT-01, EDIT-02, EDIT-03]
duration: 18 min
completed: 2026-10-27
---

# Phase 14 Plan 06: Trusted Reviewer Workspace Summary

**A separate trusted editor workspace for live request ownership, task/question banks and exact immutable issue previews.**

## Accomplishments

- Added access-aware `promo` editor mounting with branches «ЗАПРОСЫ», «ЗАДАНИЯ» and «КВАЛИФИКАЦИЯ».
- Added visible-tab queue polling, separate counters and filters, stable selected detail and explicit occupied state after a claim conflict.
- Added reviewer release, neutral reject, ordinary approval, owner force-release and device-reset controls.
- Added task and question bank lists, three question types, active/manual selection and accessible ordering controls.
- Added signed random/manual preview, whole-set rebuild, true per-item replacement and named immutable confirmation.
- Added desktop workbench and sequential phone layout plus the quiet three-day cleanup hint.

## Task Commits

1. **RED: reviewer workspace contracts** — `37202e6` (test)
2. **Tasks 1–2: queues, banks and previews** — `394cd1c` (feat)

## Deviations from Plan

- Extended the bank preview endpoint to support secure per-item replacement because the existing Plan 14-04 endpoint supported only full rebuilds.

## Issues Encountered

- Repository-wide lint retains the same three pre-existing errors outside this plan. Plan 14-06 files pass scoped ESLint.

## User Setup Required

- None now. Database migration remains owner-run in Plan 14-09.

## Self-Check: PASSED

- `npm test`: 480/480 passed.
- `npx tsc --noEmit`: passed.
- Scoped ESLint: passed.
- `npm run build`: passed.

---
*Phase: 14-prilozhenie-povyshenie*
*Completed: 2026-10-27*
