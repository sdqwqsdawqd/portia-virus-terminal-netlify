---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 05
subsystem: testing
tags: [e2e, session-proof, wr-01, roster, d4]
requires: [16-03]
provides:
  - tests/e2e/fixtures/session-probe.ts (probeSession, isVerifiedSession, VerifiedSession)
  - actorAvailability/requireActor accept only proofs minted by probeSession
  - roster owner-fixture with isolated-target lifecycle (D4)
affects: [16-06, 16-13]
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: e92cc709fcc4d3e03089450ce466f76522b153c3
plan_head_after: fa1eb79b1e47af574db702185d1edb23fe026d3e
commits: 2
tech-stack:
  added: []
  patterns: ["private WeakSet registry + unique-symbol brand for unforgeable proofs", "injected fetch for offline probe tests"]
key-files:
  created:
    - tests/e2e/fixtures/session-probe.ts
  modified:
    - tests/e2e/fixtures/actors.ts
    - lib/e2e-actors.test.ts
    - tests/e2e/fixtures/data/roster.json
key-decisions:
  - "Proof is a frozen { role, projectId } registered in a module-private WeakSet; no constructor is exported, so a literal of the old { role, status, source } shape is rejected."
  - "Probe failures reuse MutationTargetBlockedError with codes session-probe-failed / session-role-mismatch (issuer-mismatch comes from assertIssuerMatchesTarget, before any request)."
  - "Participant proof requires /api/access with canEdit false plus a 200 from /api/promotion/status?nickname=... echoing the same nickname (case-insensitive)."
requirements-completed: [STAB-SEC-01]
status: complete
---

# Phase 16 Plan 05: Opaque session proof and D4 roster Summary

WR-01 closed: a session proof for a privileged role can only be produced by `probeSession`, which checks the token `iss` against the attested target and the role against the real `/api/access` answer (plus Promotion status for participant); the roster now describes the owner fixture as a disposable account on the isolated project (D4).

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (tracer) | Opaque proof from probeSession to actorAvailability | cac51e1 |
| 2 | Roster owner-fixture for the isolated target (D4) | fa1eb79 |

## Verification

- `node --experimental-strip-types --test lib/e2e-actors.test.ts lib/e2e-target-guard.test.ts`: 25 pass, 0 fail.
- `npm test`: 761 tests, 760 pass, 0 fail (1 skipped pre-existing).
- `npm exec tsc -- --noEmit`: clean.
- `npm run lint`: 0 errors, 18 pre-existing warnings (`<img>` etc., unrelated files).
- Node 22.13.1 (reference). `roles.spec.ts` untouched; privileged role inventory still BLOCKED without target and proof.

## Deviations from Plan

None - plan executed as written. `ActorSessionProof` had no other users (Grep over ts/tsx/mjs) and was removed.

## BLOCKED / not proven

- No live probe was run: authenticated roles, `/api/access` against a real server and the Promotion status route stay BLOCKED until 16-07 (keys) and 16-13 (Playwright wiring). All probe coverage here is offline with injected `fetch` and synthetic JWTs.
- Refusing owner-fixture creation without the run marker is implemented in 16-06, not here (T-16-15 roster part only).

## Known Stubs

None.

## Threat Flags

None. No new network endpoints or trust-boundary files.

## Self-Check: PASSED

- session-probe.ts, actors.ts, roster.json, lib/e2e-actors.test.ts exist; commits cac51e1 and fa1eb79 are ancestors of HEAD.
