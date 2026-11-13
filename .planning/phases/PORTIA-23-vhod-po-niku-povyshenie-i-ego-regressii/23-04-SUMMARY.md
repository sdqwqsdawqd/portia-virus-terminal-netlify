---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 04
subsystem: promotion
tags: [participant, editor, qualification, ui]
requires:
  - phase: PORTIA-23-03
    provides: secure promotion RPCs and editor-owned access requests
provides:
  - promotion routes using approved current-device or editor-owned identity
  - participant screen without manual nickname selection
  - editor's own request form and access-state explanation
affects: [PORTIA-23-07]
actuals:
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [server-derived participant, roster-before-test, independent promotion card feedback]
key-files:
  created: [lib/promotion-participant.ts]
  modified: [lib/portia-promotion-api.ts, app/api/promotion/status/route.ts, app/api/promotion/requests/route.ts, app/api/promotion/test/route.ts, components/portia-promotion.tsx]
key-decisions:
  - "Authenticated editors participate only through their own approved sheet request; a guest access cookie cannot be adopted by editor session."
  - "Promotion status and submit ignore browser nickname and use secure RPCs with the approved access digest."
  - "Qualification actions check the current promotion roster before calling signed secure RPCs."
requirements-completed: [PROM-03]
completed: 2026-11-13
status: complete
---

# Phase 23 Plan 04 Summary

Promotion routes now resolve the participant from the current approved sheet request. The editor route offers a separate own-request flow. The participant screen shows pending, rejected, and revoked access states, while promotion cards retain independent submit feedback. Qualification actions use the secured RPC wrappers and check the current roster before each action.

## Verification

- PASS: 51 targeted promotion and access security tests, TypeScript, scoped ESLint, and Next.js build.
- PASS: Source contract test confirms status and request routes ignore browser nickname and use secure RPCs.
- BLOCKED: Authenticated role behavior, live Postgres/RLS execution, concurrent revocation, and browser/physical-device acceptance need an isolated test project and real test identities.
- OPEN: Full unit suite has 15 failures, including baseline style contract checks and route/migration evidence checks. These are tracked for 23-07; they are not counted as passes.

## Commit

- `d42184e` — server-derived promotion identity and participant UI.
