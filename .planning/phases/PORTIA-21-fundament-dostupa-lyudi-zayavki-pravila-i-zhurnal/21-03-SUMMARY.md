---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 03
subsystem: database
tags: [supabase, security-definer, decision-rules, append-only-journal, cooldown, offline-contract-tests]

requires:
  - phase: PORTIA-21 plan 01
    provides: access tables, submit/resolve/decide RPCs, caller_level, store wrappers, pinned migration
provides:
  - SQL-enforced decision rules (self-decision, level-above-own, owner-protected) for decide, set_level, revoke
  - optimistic level change and full-person revoke with one journal row per decision
  - append-only journal trigger (journal-append-only)
  - repeat-request rules: daily caps, 1-hour pause, owner-only cooldown clear
  - setAccessLevel, revokeAccess, clearAccessCooldown wrappers and ACCESS_REQUEST_LIMITS
affects: [21-04, 21-05, 21-07, PORTIA-22, PORTIA-23]

requirements-completed: [USR-05]

actuals:
  tokens: 12000
  tasks: 2
  commits: 4
plan_head_before: eddb4accb4e98606ff6af24c2bf337f8e9af3e67
plan_head_after: 7bdb5173446cd2dd6ade2f10420233af6bb6a295

tech-stack:
  added: []
  patterns:
    - "internal non-definer guard helper called only from definer functions, executable by the privileged API role only"
    - "SQL literals pinned to TS constants by extracting them from the comment-stripped migration text"
    - "advisory lock first, then row lock (same order in decide, set_level, revoke) to avoid deadlock"

key-files:
  created:
    - lib/access-decisions.test.ts
    - lib/access-requests.test.ts
  modified:
    - supabase/migrations/20261109000000_portia_access_foundation.sql
    - lib/access-store.ts
    - lib/access-foundation.test.ts
    - lib/portia-canonical-parity.test.ts

key-decisions:
  - "Pause check prefers the requesting device's own paused request (order by token match first), so a person revoked on several devices still shows each device its own cooldown and retryAt"
  - "level-above-own in decide sits after the new level is validated, inside the branch that can grant a level; a further device of an active person keeps the stored level and needs no ceiling check"
  - "set_level and revoke read the person without a lock, take the nick advisory lock, then re-select for update (same lock order as decide)"

patterns-established:
  - "Each Phase 21 plan that edits the migration re-pins its hash line and updates the function-name list in lib/access-foundation.test.ts"

coverage:
  - id: D1
    description: "USR-05: the database refuses self-decision, level above the decider's own and owner-protected rows inside decide, set_level and revoke"
    requirement: USR-05
    verification:
      - kind: unit
        ref: "lib/access-decisions.test.ts#USR-05 decide, set_level and revoke call the target guard before they change anything"
        status: pass
      - kind: unit
        ref: "lib/access-decisions.test.ts#USR-05 no level above the decider's own, in decide and in set_level"
        status: pass
    human_judgment: true
    rationale: "Offline SQL text checks only; Postgres/RLS execution is BLOCKED until an isolated staging run (21-07)"
  - id: D2
    description: "D-02: optimistic set_level (stale/unchanged) and revoke covering the person and all approved device requests"
    verification:
      - kind: unit
        ref: "lib/access-decisions.test.ts#D-02 set_level is optimistic: stale when the expected level differs, no journal row when unchanged"
        status: pass
      - kind: unit
        ref: "lib/access-decisions.test.ts#D-02 revoke flips the person and every approved request in one function body"
        status: pass
    human_judgment: true
    rationale: "Offline text contract; runtime BLOCKED until staging"
  - id: D3
    description: "D-07: one journal row per decision branch and an append-only trigger"
    verification:
      - kind: unit
        ref: "lib/access-decisions.test.ts#D-07 every decision branch appends exactly one journal row with its event type"
        status: pass
      - kind: unit
        ref: "lib/access-decisions.test.ts#D-07 the journal cannot be updated or deleted: BEFORE UPDATE OR DELETE trigger raises journal-append-only"
        status: pass
    human_judgment: true
    rationale: "Trigger behaviour is proven as text only; BLOCKED until Postgres execution"
  - id: D4
    description: "D-06: one pending per nick, 1-hour pause, owner clear, 3/10/200 caps, TS constants equal SQL literals, neutral replies"
    verification:
      - kind: unit
        ref: "lib/access-requests.test.ts#D-06 the SQL literals in submit equal ACCESS_REQUEST_LIMITS"
        status: pass
      - kind: unit
        ref: "lib/access-requests.test.ts#D-06 submit checks run in order: own device, caps, pending elsewhere, pause, insert"
        status: pass
      - kind: unit
        ref: "lib/access-requests.test.ts#T-21-18 clear_cooldown: owner-only first statement, journaled once, not reachable by anon"
        status: pass
    human_judgment: true
    rationale: "Offline text contract; runtime BLOCKED until staging"
  - id: D5
    description: "D-09: re-approval after revocation starts at the type default (re-asserted)"
    verification:
      - kind: unit
        ref: "lib/access-decisions.test.ts#D-09 re-approval after revocation starts at the type default, not at the old level"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-09
status: complete
---

# Phase 21 Plan 03: Decision rules, journal and repeat requests Summary

**Self-decision, level-above-own and owner-protected refusals live in the SQL definer functions, every decision is journaled in an append-only table, and repeat requests follow a 1-hour pause with 3/10/200 daily caps - all pinned by offline contract tests**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-09
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files:** 2 created, 4 modified

## Accomplishments

- `portia_access_target_guard(text, uuid)`: not security definer, executable only by the privileged API role, raises `self-decision` (request filed by the caller's account, person linked to the caller, or nick key of such a person) and `owner-protected` (rows linked to the confirmed-email owner account, for any non-owner). `decide` calls it for both approve and reject after the already-decided check; `level-above-own` is enforced in `decide` and `set_level` against `portia_access_caller_level()`.
- `portia_access_set_level`: users-tab gate first, `not-found`/`not-active`, guard, `invalid-level`, `level-above-own`, `stale` with the stored level when `p_expected_level` differs, `unchanged` with no journal row, otherwise one `level-change` row (from/to). `portia_access_revoke`: person and every approved request of the person become `revoked` with `decided_at`/`decided_by` (decided_at starts the pause), one `revoke` row.
- Trigger `portia_access_journal_append_only` (BEFORE UPDATE OR DELETE FOR EACH ROW) raises `journal-append-only`.
- `portia_access_submit_request`: order is own-device, caps (`throttled`: 3 per nick, 10 per IP bucket in 24 hours, 200 pending, exact under the existing `access:queue` lock), pending elsewhere (`unavailable`), pause (own device `cooldown` with `retryAt = decided_at + 1 hour`, other device `unavailable`), insert. Replies never carry person data. `portia_access_clear_cooldown`: first statement raises `owner-required`, one `cooldown-clear` journal row, `no-cooldown` writes nothing.
- Store: `setAccessLevel`, `revokeAccess`, `clearAccessCooldown`, `ACCESS_REQUEST_LIMITS` (equals the SQL literals, test-pinned), `SubmitResult` with `cooldown { retryAt }` and `throttled`. Rule errors surface as `AccessStoreError` with the SQL message as `code`.
- Request cleanup policy recorded in the migration header: no automatic deletion, no new cron job; the 200-pending cap bounds the queue, journal rows are never deleted.

## Task Commits

1. **Task 1: decision rules, level change, revoke, journal (TDD)**
   - RED - `50e4d85` (test)
   - GREEN - `88c51a4` (feat)
2. **Task 2: repeat requests, pause, caps, cooldown clear (TDD)**
   - RED - `6ad3494` (test)
   - GREEN - `7bdb517` (feat)

REFACTOR was not needed. STATE.md and ROADMAP.md are left to the orchestrator.

## TDD Evidence

- **Task 1 RED:** `node --experimental-strip-types --test lib/access-decisions.test.ts` exited non-zero with `# tests 14 / # pass 1 / # fail 13`. SQL-contract tests failed on the planned assertions (guard function, set_level, revoke, trigger absent from the migration); wrapper tests failed with `Error: not implemented` from throwing stubs (needed so the import resolves and tsc stays clean). The one passing test is the D-09 re-assertion, which 21-01 already satisfied. Semantic assessment: failures are for the intended reason (behaviour absent), not import, syntax or fixture faults. The classifier `gsd_run check tdd-red-evidence` was not run (plan type is `execute`).
- **Task 1 GREEN:** 14/14, plus 44/44 across decisions, foundation, levels and canonical-parity files.
- **Task 2 RED:** `lib/access-requests.test.ts` `# tests 10 / # pass 1 / # fail 9` (SQL literals, check order, pause, clear_cooldown, cleanup policy, wrapper tests); same stub approach.
- **Task 2 GREEN:** 54/54 across the five relevant test files.

## Verification

- Full unit suite (Node 22.13.1, `node --experimental-strip-types --test lib/*.test.ts`): 1766 tests, 1761 pass, 2 fail, 3 skipped. The 2 failures are the documented red window in `lib/security-matrix.test.ts` ("migration coverage..." and "matrix freshness..."), closed by 21-07. No other failure.
- `node node_modules/typescript/bin/tsc --noEmit` clean; eslint on the touched TS files clean.
- Both plan acceptance node checks exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Function-name list in lib/access-foundation.test.ts**
- **Found during:** Task 1 GREEN
- **Issue:** the 21-01 test asserts the exact list of `portia_access_*` functions; the five new functions made it fail.
- **Fix:** extended the list (guard, set_level, revoke, journal_append_only in Task 1; clear_cooldown in Task 2). The file was not in the plan's `files_modified`.
- **Files modified:** lib/access-foundation.test.ts
- **Commits:** 88c51a4, 7bdb517

**2. Pause lookup refinement (within plan intent)**
- The plan reads "the latest request of this key" for the pause. The implementation orders by "token matches the caller" first, then latest `decided_at`, so each device of a person revoked on several devices sees its own cooldown and `retryAt`; a device with no paused request of its own gets `unavailable`. Replies stay neutral about other people.

Otherwise the plan was executed as written.

## Issues Encountered

- The project guard blocks the privileged-role keyword in Bash commands, so the SQL was appended through the Edit tool instead of a shell heredoc. No work-around of the guard was used.
- Known red window as in 21-01: only the two `lib/security-matrix.test.ts` subtests fail until 21-07.

## Accepted Risks / Owner Acknowledgement (for 21-07)

- Self-detection is by account link. A nickname filed from a signed-out browser carries no link, so an editor approving a request they filed while signed out is not recognised as self-decision. Mitigations: the journal and revocation. This residual case must be acknowledged by the owner in the 21-07 checkpoint.

## Known Stubs

None. (Throwing stubs existed only inside the RED commits `50e4d85` and `6ad3494`; the GREEN commits replaced them.)

## Threat Flags

None - the new surface (authenticated set_level, revoke, clear_cooldown; internal guard and trigger function) is the one described in the plan's threat model (T-21-11..T-21-18). anon reach is unchanged: submit and resolve only (contract test).

## User Setup Required

None. The migration is not applied anywhere. Postgres/RLS execution evidence for every rule above stays BLOCKED until an isolated staging run (21-07); nothing here is recorded as a pass for runtime behaviour.

## Next Phase Readiness

- Phase 22 can expose approve, reject, level change and revoke without any rule living in TypeScript; the owner-only cooldown clear is ready for an owner-facing control.
- 21-04, 21-05 and 21-07 keep re-pinning the migration hash line; 21-07 freezes it.

## Self-Check: PASSED

- Files exist: lib/access-decisions.test.ts, lib/access-requests.test.ts, lib/access-store.ts, supabase/migrations/20261109000000_portia_access_foundation.sql.
- Commits exist: 50e4d85, 88c51a4, 6ad3494, 7bdb517 (ancestors of HEAD).
- Verification: five relevant test files green (54/54), tsc clean, eslint clean, full suite only the 2 expected failures.

---
*Phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal*
*Completed: 2026-11-09*
