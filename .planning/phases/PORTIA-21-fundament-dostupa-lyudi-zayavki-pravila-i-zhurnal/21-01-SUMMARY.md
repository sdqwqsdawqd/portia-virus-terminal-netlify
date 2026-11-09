---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 01
subsystem: database
tags: [supabase, security-definer, rls, nickname, access-levels, hmac, offline-contract-tests]

requires:
  - phase: PORTIA-20
    provides: portia_can_edit / portia_can_edit_tab / portia_is_owner helpers, device-binding HMAC pattern, explicit-grants pattern
provides:
  - one nickname rule in TS and SQL (ACC-04) with a TS<->SQL parity test
  - opaque portia_access device token with an access:-labelled HMAC digest
  - tables portia_access_people / _requests / _journal (RLS on, RPC only) and RPCs submit / resolve / decide
  - levels 1..5 module with the editor/owner = 5 rule pinned to SQL (LVL-01)
affects: [21-03, 21-04, 21-05, 21-07, PORTIA-22, PORTIA-23]

actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: c8cd3cfeed5763eb0842e16b601b29c629a0db7f
plan_head_after: bfa4a3429b1dfd621c4fd6de6f6b9961008c7162

tech-stack:
  added: []
  patterns:
    - "opaque cookie token -> server-side HMAC digest (label access:) -> definer RPC keyed by digest -> RPC-only tables -> journal"
    - "TS<->SQL parity by extracting the SQL literal/defaults from the migration text and comparing with the TS constants"
    - "fail-closed typed RPC wrappers: any error or unknown reply becomes AccessStoreError"

key-files:
  created:
    - lib/nickname.ts
    - lib/access-session.ts
    - lib/access-store.ts
    - lib/access-levels.ts
    - lib/access-foundation.test.ts
    - lib/access-levels.test.ts
    - supabase/migrations/20261109000000_portia_access_foundation.sql
  modified:
    - lib/portia-canonical-parity.test.ts

key-decisions:
  - "decide treats a request from an already-active person as an added device: the level stays, an explicit different level raises level-change-separate"
  - "submit answers unavailable (no detail) when another device already waits for the nick, so the reply never reveals approval of someone else"
  - "resolve returns state revoked with retryAt null for an approved request whose person was revoked (no cooldown shown until 21-03 adds revoke)"

patterns-established:
  - "Every access function: one-line signature, security definer where needed, set search_path = '', revoke all from public, anon, authenticated before any grant, separate grant to service_role"
  - "Migration pinned in lib/portia-canonical-parity.test.ts; re-pinned by each Phase 21 plan that edits it, frozen by 21-07"

requirements-completed: [ACC-04, LVL-01]

coverage:
  - id: D1
    description: "Nickname rule ^[A-Za-z0-9_]{3,20}$ identical in TS and SQL (collate C); Qloxz and qloxz give one key"
    requirement: ACC-04
    verification:
      - kind: unit
        ref: "lib/access-foundation.test.ts#ACC-04 parity: the SQL nickname rule carries the identical regex literal under collate C"
        status: pass
    human_judgment: false
  - id: D2
    description: "Levels 1..5 named Уровень N from one module; editor/owner resolve to 5; SQL caller_level and defaults pinned"
    requirement: LVL-01
    verification:
      - kind: unit
        ref: "lib/access-levels.test.ts#LVL-01 editors and the owner resolve to level 5 whatever person row exists"
        status: pass
      - kind: unit
        ref: "lib/access-levels.test.ts#LVL-01 SQL parity: caller_level is 5 from portia_can_edit() and reads no person row"
        status: pass
    human_judgment: false
  - id: D3
    description: "Request -> editor decision (default level 2/1, journaled, conditional on pending) -> own state: SQL text contract and TS path"
    verification:
      - kind: unit
        ref: "lib/access-foundation.test.ts#SQL contract: decide is gated, conditional, journaled and applies the type defaults"
        status: pass
      - kind: unit
        ref: "lib/access-foundation.test.ts#tracer: nickname -> token -> digest -> submit -> editor approves without level -> own state"
        status: pass
    human_judgment: true
    rationale: "Offline text/stub checks only; Postgres/RLS execution of the SQL is BLOCKED until an isolated staging run (plan 21-07)"
  - id: D4
    description: "Tables closed to API roles; visitor-facing code unchanged"
    verification:
      - kind: unit
        ref: "lib/access-foundation.test.ts#SQL contract: the three tables and the journal sequence are closed to API roles"
        status: pass
      - kind: unit
        ref: "lib/access-foundation.test.ts#visitor behaviour is unchanged: nothing under app/ or components/ uses the access modules or RPCs"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-11-09
status: complete
---

# Phase 21 Plan 01: Access foundation tracer Summary

**Digest-keyed submit/resolve/decide definer RPCs over RPC-only people/requests/journal tables, one shared nickname rule with TS<->SQL parity, and levels 1..5 with editors/owner fixed at 5 - all proven offline**

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-11-09
- **Tasks:** 2
- **Files modified:** 8 (7 created, 1 edited)

## Accomplishments

- Tracer path exists end to end in SQL and TS: a visitor request (nickname, origin, token digest) is stored by `portia_access_submit_request`; an editor approves or rejects through `portia_access_decide` (conditional on `pending`, type-default level 2 for `sheet` and 1 for `outside`, one journal row per decision, repeat decision answers `already-decided`); the device reads back only its own state through `portia_access_resolve`.
- ACC-04: `NICKNAME_PATTERN` and the regex literal in `portia_access_nickname_key` are the same string; the SQL side evaluates it under `collate "C"`. A sample list (including a zero-width joiner, Cyrillic letter, trailing newline) gets identical answers from both.
- LVL-01: `lib/access-levels.ts` is the only place with level names; `effectiveAccessLevel` returns 5 for an editor or the owner whatever person row exists; `portia_access_caller_level()` returns 5 from `portia_can_edit()` without reading a person row.
- No file under `app/` or `components/` touches the new modules or RPCs: visitor behaviour is unchanged (guard test).

## Task Commits

1. **Task 1: tracer request -> editor decision -> own state** - `e09b224` (feat; tracer, single commit as the plan defines it)
2. **Task 2: levels 1..5 and editor=5 rule (TDD)**
   - RED - `1dfe52c` (test)
   - GREEN - `bfa4a34` (feat)
   - REFACTOR - not needed

**Plan metadata:** the docs commit that adds this SUMMARY (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Evidence (Task 2)

- **RED:** `lib/access-levels.test.ts` (8 tests) plus a deliberately wrong stub `lib/access-levels.ts` (empty level list, constants 0, `defaultApprovalLevel` returning 3, `effectiveAccessLevel` returning null). Command `node --experimental-strip-types --test lib/access-levels.test.ts` exited 1 with `# tests 8 / # pass 0 / # fail 8`; every failure was an assertion (for example `expected: 5 actual: 0` for `EDITOR_ACCESS_LEVEL`, `expected: 3 actual: 2` for the SQL default vs `defaultApprovalLevel`). Semantic assessment: the target tests executed and failed on the planned assertions for the intended reason (behaviour absent), not on import, syntax or fixture faults. The stub existed so the import resolved; the machine classifier `gsd_run check tdd-red-evidence` was not run (plan type is `execute`, not `tdd`).
- **GREEN:** real `lib/access-levels.ts`; `access-store.ts` switched to `AccessLevel`/`AccessOrigin`/`isAccessLevel`. 21/21 tests pass across `access-levels.test.ts` and `access-foundation.test.ts`.
- Task 1 is a `tracer` task and was committed once, as the plan defines it; its tests were written together with the code.

## Files Created/Modified

- `lib/nickname.ts` - canonical nickname rule (`NICKNAME_PATTERN`, `isValidNickname`, `nicknameKey`, `parseNicknameInput`, `sameNickname`)
- `lib/access-session.ts` - `portia_access` cookie, token creation, `access:`-labelled HMAC digest, IP bucket
- `lib/access-store.ts` - typed fail-closed wrappers `submitAccessRequest` / `resolveAccess` / `decideAccessRequest`
- `lib/access-levels.ts` - levels 1..5, labels, origins, approval defaults, `effectiveAccessLevel`
- `supabase/migrations/20261109000000_portia_access_foundation.sql` - tables, helper functions, submit/resolve/decide RPCs, grants
- `lib/access-foundation.test.ts`, `lib/access-levels.test.ts` - offline contract tests
- `lib/portia-canonical-parity.test.ts` - one pinned hash line for the new migration (`b21b0ac1...`)

## Decisions Made

- A request from an already-active person is treated as an added device: the level stays, and an explicit different level raises `level-change-separate` (as the plan specifies); a revoked person is reactivated at the fresh default and the previous level goes only to the journal (`previousLevel`).
- `resolve` returns `revoked` with `retryAt: null` for an approved request whose person is revoked; the cooldown display for that case belongs to the revoke work in 21-03.
- The journal and tables carry no foreign key to `auth.users`; `request_id` in the journal has no foreign key at all so the journal outlives request rows.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Known red window (documented in the plan): after `e09b224` two subtests of `lib/security-matrix.test.ts` fail by design ("migration coverage: the real matrix has exactly one row per tracked supabase migration" and "matrix freshness: ..."). The full unit suite is otherwise green (1737 pass, 2 fail, 3 skipped). Plan 21-07 moves both checks to a Phase 21 matrix.
- `gsd_run windows append` was not run for the red window (best-effort ledger; the window is already tracked in the plan and in 21-07).

## Known Stubs

None. (`lib/access-levels.ts` was a stub only inside the RED commit `1dfe52c`; the GREEN commit replaced it.)

## Threat Flags

None - the new RPC surface (anon submit/resolve, authenticated decide) is the surface described in the plan's threat model (T-21-01..T-21-07).

## User Setup Required

None. The migration is not applied anywhere; the owner applies it to production after the apply order written in its header. Postgres/RLS execution evidence stays BLOCKED until an isolated staging run.

## Next Phase Readiness

- Plans 21-03..21-05 extend the same migration and store (rules, attempt caps and cooldown checks, closure flag, fingerprint/authz artifacts); each must re-pin the hash line in `lib/portia-canonical-parity.test.ts`.
- Phase 22 registers the tab id `users` in `lib/editor-tabs.ts`; until then every editor passes the `portia_can_edit_tab('users')` gate (D-02).

## Self-Check: PASSED

- Files exist: `lib/nickname.ts`, `lib/access-session.ts`, `lib/access-store.ts`, `lib/access-levels.ts`, `lib/access-foundation.test.ts`, `lib/access-levels.test.ts`, `supabase/migrations/20261109000000_portia_access_foundation.sql`.
- Commits exist: `e09b224`, `1dfe52c`, `bfa4a34` (ancestors of HEAD).
- Verification: `node --experimental-strip-types --test lib/access-levels.test.ts lib/access-foundation.test.ts lib/portia-canonical-parity.test.ts lib/phase16-expected-authz.test.ts lib/portia-sql.test.ts lib/e2e-offline-supabase-harness.test.ts` green; `node node_modules/typescript/bin/tsc --noEmit` clean; eslint on the new files clean.

---
*Phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal*
*Completed: 2026-11-09*
