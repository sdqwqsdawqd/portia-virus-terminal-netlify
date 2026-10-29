---
phase: 14-prilozhenie-povyshenie
plan: 11
subsystem: promotion-api-qualification-runner
tags: [api, heartbeat, qualification, cas, device-mode]
requires:
  - phase: 14-10
    provides: atomic admission, answer CAS and server lease RPCs
provides:
  - atomic request-admission API adapter with stable neutral DTOs
  - participant-owned immutable mode selection at test activation
  - heartbeat-driven qualification runner with terminal reconciliation
  - expected-question conflict recovery and correctly typed answer payloads
affects: [14-12, 14-13, 14-14]
tech-stack:
  added: []
  patterns: [single-mutation-rpc, authoritative-conflict-refetch, bounded-heartbeat, fail-closed-local-lock]
key-files:
  modified: [lib/portia-qualification.ts, lib/portia-promotion-api.ts, app/api/promotion/test/route.ts, components/portia-promotion.tsx, supabase/portia_setup.sql, supabase/phase14_apply.sql]
key-decisions:
  - "A status lookup may issue the opaque device cookie, but only atomic request admission binds it to a nickname."
  - "The participant mode is fixed when a prepared attempt becomes active; ambiguous device evidence is desktop."
  - "Heartbeat runs every 15 seconds against a 45-second server lease; local input locks immediately on failure."
requirements-completed: [PROM-04, PROM-05, QUAL-06, QUAL-07, QUAL-08, QUAL-09, QUAL-10, RETRY-01]
duration: 30 min
completed: 2026-10-28
---

# Phase 14 Plan 11: Atomic API and Lease-Aware Runner Summary

The public API now consumes the concurrency-safe database contracts directly, and the qualification runner converges to a terminal server state after disconnects, stale answers or abandoned pages.

## Accomplishments

- Removed preliminary device binding and separate throttle mutations from request submission; one RPC now returns `created`, `active-request`, `device-denied` or `throttled`.
- Added stable no-store DTO handling for heartbeat failure, expired attempts and answer compare-and-set conflicts.
- Changed qualification confirmation to prepare an immutable question snapshot without guessing the participant device; activation fixes the conservative server-derived mode once.
- Added a 15-second heartbeat while the active runner is editable and a 5-second terminal reconciliation loop after local failure.
- Included `expectedQuestionIndex` with every answer and replace stale local state with the authoritative server projection on conflict.
- Corrected single/multiple answer payloads from option text to option indexes, matching the validator and database contract.
- Preserved the phone exception for focus/visibility signals while keeping offline, deadline and lease enforcement active.

## Commits

| Commit | Description |
|--------|-------------|
| `ea7f015` | Add failing atomic API contracts |
| `b8ba080` | Adopt atomic request, test transition and immutable-mode contracts |
| `13d6c0b` | Add failing qualification runner lease contracts |
| `8282664` | Add heartbeat lifecycle, conflict recovery and typed answer payloads |

## Deviations from Plan

- The plan listed API/client files, but the existing reviewer confirmation always created attempts as desktop. The mirrored SQL and bank confirmation route were updated so mode is selected once by the participant at activation; without this correction every phone attempt would be rejected by the immutable-mode check.
- The status lookup still creates the opaque HttpOnly token when absent, but no longer binds it. Binding happens only in the atomic submit transaction.

## Residual Risk

- Device mode is intentionally conservative, but user-agent/client-hint spoofing cannot be eliminated in a browser. Spoofing after activation is rejected because the stored mode is immutable; spoofing the initial activation remains a documented client-signal limitation.

## Verification

- `npm test`: 536 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- PostgreSQL parser: both mirrored SQL files parsed successfully after signature changes.

## Self-Check: PASSED

Atomic request results, answer conflicts, mode activation, heartbeat cleanup and terminal reconciliation are covered by regression tests; public responses contain no answer keys or future questions.
