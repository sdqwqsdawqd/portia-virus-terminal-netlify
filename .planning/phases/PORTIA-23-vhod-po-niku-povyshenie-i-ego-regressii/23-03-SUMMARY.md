---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 03
subsystem: access-promotion
tags: [sql, rpc, identity, authorization]
requires:
  - phase: PORTIA-23-01
    provides: access request and status routes
  - phase: PORTIA-23-02
    provides: canonical device-bound nickname request
provides:
  - approved sheet access proof for promotion RPCs
  - editor's own sheet request route and status
  - revoked legacy participant RPC grants and updated authorization evidence
affects: [PORTIA-23-04, PORTIA-23-07]
actuals:
  tasks: 3
  commits: 1
tech-stack:
  added: []
  patterns: [current-device access digest, session-bound editor request, signed promotion RPC]
key-files:
  created: [supabase/migrations/20261113000000_portia_access_promotion.sql, lib/access-identity.ts, app/api/access/editor-request/route.ts]
  modified: [lib/access-store.ts, tests/e2e/fixtures/data/expected-authz.json, supabase/fingerprint/expected/portia.fingerprint.json]
key-decisions:
  - "Promotion participant resolution requires an active approved sheet request and person; editor participation also requires the editor's own request."
  - "Secure promotion RPCs bind a current access digest and signed request proof; legacy direct participant grants are revoked."
  - "Migration must be applied together with 23-04 route rewiring; no database was contacted during this plan."
requirements-completed: [PROM-01, PROM-02]
completed: 2026-11-13
status: complete
---

# Phase 23 Plan 03 Summary

The forward-only migration adds origin-aware access resolution, editor-owned request status, approved sheet participant resolution, and signed status, submit, and test RPC wrappers. The editor route verifies the authenticated editor and binds its sheet request to the current device token. Existing promotion bindings remain conflict checks. Expected authorization and schema fingerprint fixtures were regenerated with the committed script.

## Verification

- PASS: 64 targeted offline tests, TypeScript, scoped ESLint, and `git diff --check` during implementation.
- PASS: Mandatory `supabase-rls-reviewer` follow-up found no open critical or high findings after fixes to direct submit/test bypasses and request body bounds.
- REVIEW NOTE: Test action signatures do not bind every answer payload field. A signature is server-only and short-lived; this remains a medium defense-in-depth item for phase verification.
- BLOCKED: Live Postgres/RLS role execution, concurrent revocation, and database fingerprint comparison require an isolated test project. Offline SQL assertions do not count as live evidence.
- BLOCKED: Applying the migration before 23-04 route rewiring would break existing promotion routes. No migration was applied.

## Commit

- `465a1b9` — approved-access promotion RPC and editor request contract.
