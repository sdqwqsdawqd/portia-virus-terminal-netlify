---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 01
subsystem: access
tags: [react, supabase, access-gate]
requires:
  - phase: PORTIA-21
    provides: access token, signed submit and access RPC wrappers
provides:
  - neutral initial shell and authoritative status gate
  - access request form and server-signed submit route
affects: [PORTIA-23-02, PORTIA-23-03, PORTIA-23-04]
actuals:
  tokens: 4500
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [injectable gate decision, no-store access routes]
key-files:
  created: [lib/access-gate.ts, lib/access-gate.test.ts, components/portia-access-gate.tsx, app/api/access/status/route.ts, app/api/access/request/route.ts]
  modified: [app/page.tsx, app/portia.css]
key-decisions:
  - "The OFF mode opens the desktop even if optional token resolution fails after closure status is confirmed."
  - "Network errors after a confirmed approval preserve the displayed desktop until a newer authoritative status arrives."
requirements-completed: [ACC-01, ACC-02, ACC-03, ACC-08]
duration: 30min
completed: 2026-11-12
status: complete
---

# Phase 23 Plan 01 Summary

The home route now renders a neutral gate; a server-confirmed OFF mode, approved current-device token, or verified editor opens the desktop. Visitors can submit a nickname request and inspect their current-device status.

## Verification

- PASS: `node --experimental-strip-types --test lib/access-gate.test.ts lib/access-requests.test.ts lib/access-closure.test.ts` (29 tests).
- PASS: TypeScript, scoped ESLint, Next.js production build, and `git diff --check`.
- PASS: Generated initial HTML contains the neutral checking message; the desktop component is not rendered by `app/page.tsx`.
- BLOCKED: Live Postgres/RLS and concurrent request behavior require an isolated test project. No production database was contacted.
- BLOCKED: 320/390/900px browser and keyboard assertions have not been run; they remain a separate evidence lane for plan 23-07.

## Commit

- `c2e6cf7` — gate and request/status routes.

## Limits

The offline tests exercise injected RPC-shaped responses and gate decisions. They do not prove deployed cookie delivery, editor authentication, physical devices, or live RLS behavior.
