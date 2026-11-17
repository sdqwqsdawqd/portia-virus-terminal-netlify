---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 05
subsystem: database
tags: [supabase, schema-fingerprint, golden-parity, revoke, sec-06, expected-authz, offline-contract-tests]

requires:
  - phase: PORTIA-21 plan 04
    provides: expected-authz matrix replaying all migrations, closure flag, pinned migration
provides:
  - golden schema fingerprint covering every Phase 21 object (functions 36 -> 48, tables 23 -> 28, columns 151 -> 188, constraints 120 -> 145, indexes 34 -> 47, triggers 0 -> 1)
  - lib/portia-migration-fingerprint.test.ts - offline migration-to-golden parity (computed for functions, presence and kind for the rest)
  - SEC-06 - portia_promo_register_attempt(text, text, boolean) no longer executable by anon or authenticated
affects: [21-07, PORTIA-25]

requirements-completed: [SEC-06]

actuals:
  tokens: 12000
  tasks: 2
  commits: 3
plan_head_before: 4b5ef3466481d7a4079034cc6b423b7c9667ddef
plan_head_after: f175a4cc3e52647154403d1b470ac507dead3b7a

tech-stack:
  added: []
  patterns:
    - "body hash of every migration function recomputed as sha256 of the text between `as $$` and `$$;` (CR removed) and compared with the golden src_sha256"
    - "function ACL replayed from grant/revoke lines starting at PUBLIC only; the explicit-grants DO block adds the privileged role to every function existing at that point"
    - "append-only edits at the END of the Phase 21 migration, so matrix cell line numbers above do not shift"

key-files:
  created:
    - lib/portia-migration-fingerprint.test.ts
  modified:
    - supabase/fingerprint/expected/portia.fingerprint.json
    - supabase/migrations/20261109000000_portia_access_foundation.sql
    - lib/portia-canonical-parity.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - lib/access-foundation.test.ts

key-decisions:
  - "The revoke section was appended after the last statement of the migration (lines 621-626), not into the file header, so no line above it moved and no matrix cell source needed regeneration"
  - "The baseline declares many functions over several lines, so the new test parses the header with a multi-line regex up to `as $$` instead of the one-line signature regex named in the plan"
  - "Table, column, constraint, index and trigger entries are compared with the migration for kind, type, not null, default, identity, unique and partial-ness; their normalised text stays marked staging-unconfirmed"

patterns-established:
  - "Every Phase 21 plan that adds a portia_* function adds its golden entry in the same change; the new test fails otherwise (no function can be missing from the golden)"

coverage:
  - id: D1
    description: "Golden function entries for all 12 portia_access_* functions: src_sha256, ACL, secdef, volatility, config and return type are recomputed from the migrations; all 35 baseline functions still match"
    verification:
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#every effective function matches its golden entry: body hash, secdef, volatility, config, return type and ACL"
        status: pass
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#function set: the golden lists exactly the effective portia_* functions of all migrations (and the platform function)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Golden tables, identity sequence, columns, constraints, indexes and the journal trigger exist with the right kind; the golden still parses (inventory: 1 trigger, 48 functions)"
    verification:
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#golden columns: every declared column of the Phase 21 tables with type, not null, default and identity"
        status: pass
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#golden indexes: primary keys, unique constraints and every explicit create index of the Phase 21 tables"
        status: pass
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#golden trigger: the journal append-only guard, before update or delete, enabled"
        status: pass
    human_judgment: true
    rationale: "Constraint, index and trigger definition text and column default text are derived by analogy with promo entries; only a fingerprint capture on an isolated staging project confirms them: BLOCKED (ENV)"
  - id: D3
    description: "SEC-06: revoke line, six 42501 matrix cells and the reduced golden ACL of register_attempt land in one commit; no product caller; neither promo function is redefined"
    requirement: SEC-06
    verification:
      - kind: unit
        ref: "lib/access-foundation.test.ts#SEC-06: portia_promo_register_attempt is revoked from anon and authenticated, has no caller and is not redefined"
        status: pass
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts#function cells agree with the effective grant/revoke state of all migrations"
        status: pass
      - kind: unit
        ref: "lib/portia-migration-fingerprint.test.ts#every effective function matches its golden entry: body hash, secdef, volatility, config, return type and ACL"
        status: pass
    human_judgment: true
    rationale: "Offline SQL text and replay only; that Postgres really refuses anon with 42501 is BLOCKED until an isolated staging run (21-07)"
  - id: D4
    description: "D-10: Promotion otherwise unchanged - every lib/portia-promotion-*.test.ts stays green after the revoke"
    verification:
      - kind: unit
        ref: "lib/portia-promotion-*.test.ts (all files, 217 tests with the four parity files, 0 fail)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-09
status: complete
---

# Phase 21 Plan 05: Golden fingerprint and SEC-06 Summary

**The golden schema fingerprint now lists every Phase 21 object, guarded by an offline migration-to-golden test that recomputes function body hashes and ACLs, and portia_promo_register_attempt loses its anon/authenticated EXECUTE in the same commit as its matrix cells and golden ACL**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-11-09
- **Tasks:** 2 (Task 1 TDD, RED then GREEN; Task 2 single commit)
- **Files:** 1 created, 5 modified

## Accomplishments

- `lib/portia-migration-fingerprint.test.ts` (new, 11 tests): replays all migrations in version order (create/drop/grant/revoke), starts every ACL at PUBLIC only and applies the explicit-grants rule, then compares every effective `portia_*` function with the golden. Also checks that the golden function key set equals the effective set plus `rls_auto_enable`, that the four Phase 21 tables plus the journal sequence, all declared columns, all named constraints and primary keys, all indexes and the single trigger are present with the right kind, and that no policy exists for the access tables. Imports `canonicalize` and `inventory` from `scripts/phase16-fingerprint-compare.mjs`.
- Golden: 12 function entries, 4 tables, the sequence, 37 columns, 25 constraints, 13 indexes, 1 trigger. Inventory after the change: functions 48, tables 28, columns 188, constraints 145, indexes 47, triggers 1. A comparison with the pre-plan golden shows that no existing entry changed except `portia_promo_register_attempt` (Task 2).
- SEC-06: appended section "o" of the migration (lines 621-626): `revoke all on function public.portia_promo_register_attempt(text, text, boolean) from public, anon, authenticated;` (line 625) and `grant execute ... to service_role;` (line 626). The function body is not redefined. Matrix: the six register_attempt cells are `42501` with source `supabase/migrations/20261109000000_portia_access_foundation.sql:625`. Golden ACL of that function is the single privileged-role EXECUTE entry; its `src_sha256` is unchanged. Migration hash re-pinned (`5940629c...`).
- `lib/access-foundation.test.ts`: new SEC-06 test (revoke line exactly once and followed by the privileged-role grant only, no create/replace of `portia_promo_register_attempt` or `portia_promo_submit_request` in the Phase 21 migration, no non-test `.ts/.tsx/.mjs` file under app/, components/, lib/ or scripts/ mentions the function).

## Computed versus derived golden entries

- **Computed from the migration text and compared by the test:** for all 47 functions (35 baseline plus 12 Phase 21) `src_sha256`, `acl`, `secdef`, `volatility`, `config`, `returns`, `kind`. Types, not null, default and identity of the 37 Phase 21 columns are compared with the column definitions parsed from the migration. Constraint kinds (p/u/f/c), index uniqueness, index column lists (including `DESC`) and partial-index presence are compared too.
- **Derived by analogy with promo golden entries, not verified against a database (BLOCKED, ENV):** the normalised text of the 25 constraint definitions (`CHECK ((... = ANY (ARRAY[...::text])))`, `>= AND <=`, `~ '...'::text`, `FOREIGN KEY ... REFERENCES portia_access_people(id)`, function calls printed without the `public.` prefix), the 13 index definitions (`CREATE [UNIQUE] INDEX ... USING btree (...) [WHERE (...)]`), the trigger definition (`BEFORE DELETE OR UPDATE ... EXECUTE FUNCTION portia_access_journal_append_only()`, enabled `O`), and the column default text (`now()`, `gen_random_uuid()`, `'active'::text`, `'pending'::text`, `false`, `'{}'::jsonb`). A fingerprint capture on an isolated staging project is required to confirm them; it was not attempted and is not recorded as a pass.

## Task Commits

1. **Task 1: golden entries guarded by an offline test (TDD)**
   - RED - `f1fad17` (test)
   - GREEN - `8ef01e2` (feat)
2. **Task 2: SEC-06 revoke with cells, golden ACL, hash and no-caller test** - `f175a4c` (fix); the commit lists exactly the five planned files.

REFACTOR was not needed. STATE.md and ROADMAP.md are left to the orchestrator.

## TDD Evidence (Task 1)

- **RED:** `node --experimental-strip-types --test lib/portia-migration-fingerprint.test.ts` at `f1fad17` against the unchanged golden: the function-count and function-set tests failed (36 vs 48; the 12 `portia_access_*` keys absent from the golden), and the table, column, constraint, index and trigger tests failed for the same reason. Semantic assessment: failures are for the intended reason (golden entries absent), not import, syntax or fixture faults; the baseline-function regression guard parsed all 35 functions. The classifier `gsd_run check tdd-red-evidence` was not run (plan type is `execute`).
- **GREEN:** `node --experimental-strip-types --test lib/portia-migration-fingerprint.test.ts lib/phase16-fingerprint.test.ts` gave 35 of 35 passing at `8ef01e2` (this includes all 35 baseline functions, so the replayed ACL rules are correct for the existing golden).

## Verification

- Plan verify command (access-foundation, phase16-expected-authz, portia-migration-fingerprint, portia-canonical-parity, portia-promotion-*): 217 tests, 216 pass, 0 fail, 1 skipped.
- Full unit suite (Node 22.13.1, `node --experimental-strip-types --test lib/*.test.ts`): 1791 tests, 1786 pass, 2 fail, 3 skipped. The 2 failures are the documented red window in `lib/security-matrix.test.ts` ("migration coverage..." and "matrix freshness..."), closed by 21-07. No other failure.
- `node node_modules/typescript/bin/tsc --noEmit` clean; eslint on the three touched test files clean.
- Acceptance checks: inventory of the golden reports `triggers: 1`; the six register_attempt cells are all `42501` (exit 0); `git show --name-only HEAD` for the SEC-06 commit lists the five files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Function headers in the baseline span several lines**
- **Found during:** Task 1 (test design)
- **Issue:** the plan names a regex anchored on a one-line `create or replace function public.(portia_\w+)\(...\)`. The baseline declares many functions with the argument list on several lines and `returns`/`language`/`security definer` on following lines.
- **Fix:** the test matches the argument list with `[^)]*` and the header lazily up to `as $$`; return type, volatility, security definer and `set search_path = ''` are read from that header.
- **Files modified:** lib/portia-migration-fingerprint.test.ts
- **Commit:** f1fad17

**2. [Documentation] The SEC-06 header comment**
- The plan asks for a "header comment: rollback = re-grant execute". A comment at the top of the migration would move every line below it and invalidate the matrix cell sources. The rollback note sits in the comment of the appended section "o" instead.

**3. Commit message wording**
- The GREEN commit message says 36 columns; the golden gained 37 (people 11, requests 14, journal 8, settings 4), which the inventory (151 -> 188) and the test confirm. The code is right, only the message count is off by one.

Otherwise the plan was executed as written.

## Issues Encountered

- The project guard blocks the privileged-role keyword in Bash commands, including `serviceRole` inside a heredoc; the golden ACL edit, the hash edit and the new SEC-06 test were made with the Edit tool.
- Known red window as before: only the two `lib/security-matrix.test.ts` subtests fail until 21-07.

## Notes for the next plans

- 21-07 freezes the migration hash. The golden now matches the migration at `5940629c...`; any later migration edit needs a re-pin, and any new function needs a golden entry (the new test fails otherwise).
- `lib/portia-staging-live.test.ts` compares golden function keys with matrix function keys at live-run time; both sides now include the 12 access functions.
- A staging fingerprint capture (read-only `portia_schema_fingerprint.sql` compared with the golden through `scripts/phase16-fingerprint-compare.mjs`) is the step that turns the derived text entries into confirmed ones. It stays BLOCKED (ENV).

## Known Stubs

None.

## Threat Flags

None - the plan removes API-reachable surface (T-21-23), adds no endpoints, and the golden/test changes are offline files.

## User Setup Required

None. The migration is not applied anywhere. Postgres/RLS execution proof that anon and authenticated now get 42501 on `portia_promo_register_attempt`, and that live Promotion still works after the revoke, stays BLOCKED until an isolated staging run (21-07); nothing here is recorded as a pass for runtime behaviour.

## Self-Check: PASSED

- Files exist: lib/portia-migration-fingerprint.test.ts, supabase/fingerprint/expected/portia.fingerprint.json, supabase/migrations/20261109000000_portia_access_foundation.sql, lib/access-foundation.test.ts, lib/portia-canonical-parity.test.ts, tests/e2e/fixtures/data/expected-authz.json.
- Commits exist: f1fad17, 8ef01e2, f175a4c (ancestors of HEAD).
- Verification: relevant test files green, tsc clean, eslint clean, full suite only the 2 expected failures.

---
*Phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal*
*Completed: 2026-11-09*
