---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 02
subsystem: access
tags: [nickname, device-token, rpc]
requires:
  - phase: PORTIA-23-01
    provides: access request and status routes
provides:
  - canonical nickname parsing at request boundary
  - offline device isolation and status transition checks
affects: [PORTIA-23-03, PORTIA-23-04]
actuals:
  tokens: 700
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [server-derived cooldown, current-token-only resolution]
key-files:
  created: []
  modified: [app/api/access/request/route.ts, lib/access-gate.test.ts]
key-decisions:
  - "Reuse the Phase 21 signed submit, server cooldown and per-device digest wrappers without duplicating them."
requirements-completed: [ACC-05, ACC-06, ACC-07]
duration: 15min
completed: 2026-11-12
status: complete
---

# Phase 23 Plan 02 Summary

The request route now uses the canonical nickname parser. The gate tests cover two devices with the same nickname, repeated reads, approval, and revocation. Existing Phase 21 RPC wrappers enforce the server-derived cooldown and neutral submit result codes.

## Verification

- PASS: `node --experimental-strip-types --test lib/access-gate.test.ts lib/access-requests.test.ts` (22 tests).
- PASS: TypeScript and scoped ESLint.
- BLOCKED: Live concurrent submit, cooldown boundary and Postgres lock behavior require an isolated test project.

## Commit

- `201ac48` — canonical request parsing and device isolation tests.
