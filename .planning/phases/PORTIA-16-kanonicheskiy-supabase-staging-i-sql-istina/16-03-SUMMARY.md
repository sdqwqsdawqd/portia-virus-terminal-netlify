---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 03
subsystem: testing
tags: [supabase, target-guard, attestation, staging-wrapper, redaction]
requires: []
provides:
  - tests/e2e/fixtures/target-attestation.ts (assertAppBoundToTarget, issuerHost, assertIssuerMatchesTarget)
  - scripts/phase15-e2e-preflight.mjs mutation mode binds the app to the attested target and forbids PORTIA_E2E_BASE_URL
  - scripts/phase16-staging.mjs (resolveStagingTarget, redact, runCli, attest, selfTestProductionBlock, scanEvidence, main)
  - .env.example names for the live/staging variables (commented, shell-only)
affects: [16-05, 16-07, 16-10, 16-11]
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 80ebc267bbadc0715ee1372f5d0d025adbfe14da
plan_head_after: e556a5245b7d7ffa2eb52a6baf615b0de0e25902
commits: 2
tech-stack:
  added: []
  patterns: ["fail-closed resolver before any spawn/fetch", "injected env/fetch/spawn/fs for offline tests", "label-keyed redaction table"]
key-files:
  created:
    - tests/e2e/fixtures/target-attestation.ts
    - scripts/phase16-staging.mjs
    - lib/phase16-staging.test.ts
  modified:
    - scripts/phase15-e2e-preflight.mjs
    - lib/e2e-preflight.test.ts
    - lib/e2e-target-guard.test.ts
    - .env.example
key-decisions:
  - "IN-03 resolved fail-closed: PORTIA_E2E_BASE_URL is forbidden in mutation mode (external-base-url); visitor mode unchanged."
  - "Wrapper reads values only from process.env, never env files, never the Next env loader; empty/missing production list is production-list-missing from the target guard before any spawn/fetch."
  - "runCli runs the supabase JS entry (bin from node_modules/supabase/package.json) through process.execPath with shell:false and an allow-listed child env; caller-supplied link/reset/--linked/--project-ref/--db-url/bare --remote are rejected."
  - "self-test-production-block counts a ref as blocked only on production-project or list-overlap, so an unrelated early failure (e.g. missing confirmation) is exit 1, not a pass."
requirements-completed: [STAB-SEC-01, STAB-REL-04]
status: complete
---

# Phase 16 Plan 03: Target attestation and guarded staging wrapper Summary

Mutation preflight now proves that the app under test points at the attested isolated project (effective `NEXT_PUBLIC_SUPABASE_URL` host, optional `PORTIA_PROMO_LIVE_URL` host) and refuses an external base URL, and `scripts/phase16-staging.mjs` is the single guarded path for later mutating steps: every command goes through the target guard, app binding, DB URL binding to the target ref and a linked-project check before any fetch or spawn. Offline only: no Supabase contact, no MCP, no env files read.

## Commits
- 3833224 feat(16-03): target attestation and mutation preflight app binding
- e556a52 feat(16-03): guarded staging wrapper with attest, production self-test and evidence scan

## What was built
- `assertAppBoundToTarget(shell, effective)`: guard errors pass through unchanged, then `external-base-url`, `app-target-mismatch`, `live-target-mismatch`. `issuerHost` / `assertIssuerMatchesTarget` give `issuer-mismatch` for a foreign host and for a broken token (unsigned decode; the server verifies the signature on use).
- Preflight mutation branch: guard judges the shell env, app binding judges the effective env (`process.env` after the env-file load, shell wins), as `next build` will see it.
- Wrapper subcommands: `attest` (settings call with the publishable key, admin user list with `per_page=1`, prints `{status, refHash}` only), `self-test-production-block` (prints `{checked, blocked}`, exit 1 on empty list or any miss), `scan-evidence <dir>` (file + class only, exit 1 on findings). Unknown or missing subcommand: exit 2. No `link`/`reset` subcommand.
- DB URL accepted only as `postgres(ql)://`, port 5432, and either `db.<ref>.supabase.co` with user `postgres` or `aws-<n>-<region>.pooler.supabase.com` with user `postgres.<ref>`.

## Verification (Node 22.13.1)
- `lib/phase16-staging.test.ts`: 32/32 pass. `lib/e2e-target-guard.test.ts` + `lib/e2e-preflight.test.ts` + `lib/e2e-import-boundary.test.ts`: 24/24 pass (existing tests unchanged).
- `npm test`: 755 tests, 754 pass, 0 fail, 1 not run (pre-existing, not in this plan's files).
- `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 pre-existing warnings (none in this plan's files).
- CLI smoke without environment: `attest` exits 1 with `PORTIA_E2E_TARGET_BLOCKED:confirmation` and no values; unknown subcommand exits 2.
- Task 1 RED observed (module missing, 2 files failing) before implementation. Task 2 had no RED run: the module did not exist, tests were written against the behavior list and passed on first run.

## Deviations from Plan

**1. [Rule 3 - simplification] `attest` uses `deps.fetch` against the GoTrue REST endpoints instead of a supabase-js admin client.**
- Same two checks (settings with publishable key, admin user list `per_page=1`), same host restriction, fully injectable for offline tests, no extra client dependency. `redirect: "error"` keeps requests on the target host.
- Files: `scripts/phase16-staging.mjs`.

Otherwise the plan was executed as written.

## BLOCKED / not proven here
- Live `attest` against a real isolated project is BLOCKED until the owner supplies the shell environment in 16-07; the HTTP paths are proven only with fake `fetch`.
- `node_modules/supabase` is not installed (16-04); `runCli` is proven with fake `fs`/`spawn` only, the `cli-missing` path is tested.
- Completeness of `PORTIA_E2E_PRODUCTION_PROJECT_IDS` is not provable by code; it stays an owner confirmation in 16-07 (plan decision).

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model (the wrapper adds no network endpoint; it only calls the attested `https://<ref>.supabase.co`).

## Self-Check: PASSED
- Files exist: tests/e2e/fixtures/target-attestation.ts, scripts/phase16-staging.mjs, lib/phase16-staging.test.ts.
- Commits 3833224 and e556a52 are ancestors of HEAD.
