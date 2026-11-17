---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: "05"
subsystem: editor-access-history
tags: [nextjs, react, postgres, supabase-rpc, trigger, accessibility, tdd]
requires:
  - phase: PORTIA-22-03
    provides: full users read model, masked actors and responsive action window
  - phase: PORTIA-22-04
    provides: guarded row mutations and refresh workflow
provides:
  - gated five-entry decision history with fail-closed reply parsing
  - bounded twenty-entry journal retention per nickname_key
  - accessible PC history panels and phone action-window history
affects: [PORTIA-22-06, PORTIA-22-08, PORTIA-22-09, users-management, security-matrix]
actuals:
  tokens: 14986
  tasks: 3
  commits: 6
plan_head_before: 9de904beef4fcee948a07ab5e64334210f48aae2
plan_head_after: ea73b530636e9817753e206565c6b917142bc01a
tech-stack:
  added: []
  patterns:
    - database-owned masking and detail whitelisting for direct RPC callers
    - per-key request epochs for stale-safe history refreshes
    - bounded trigger retention without widening journal table privileges
key-files:
  created:
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-05-task1-red-evidence.json
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-05-task2-red-evidence.json
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-05-task3-red-evidence.json
  modified:
    - supabase/migrations/20261110000000_portia_users_tab.sql
    - lib/users-model.ts
    - lib/users-api.ts
    - components/portia-users-tab.tsx
    - app/portia.css
key-decisions:
  - "History masking and detail-key whitelisting stay inside the security-definer RPC because editors may call it directly."
  - "Open history panels are keyed by nicknameKey and reload through per-key request epochs after every successful list refresh."
  - "D-07 retention deletes only rows older than the newest twenty for the same nickname_key; its irreversible loss risk remains explicitly accepted."
patterns-established:
  - "History reads: route gate plus direct-RPC gate, canonical nickname key, at most five strictly parsed entries."
  - "History UI: PC uses an aria-expanded inline ordered list; the phone action window always includes the same list."
requirements-completed: [USR-06]
coverage:
  - id: D1
    description: "The journal exposes the newest five entries and prunes only rows older than the newest twenty for the same nickname key."
    requirement: USR-06
    verification:
      - kind: integration
        ref: "lib/users-sql.test.ts, lib/portia-migration-fingerprint.test.ts and static supabase-rls-reviewer verdict SECURED"
        status: pass
    human_judgment: true
    rationale: "Live trigger execution, ACLs, RLS and authenticated roles remain BLOCKED (ENV); static evidence is not a live database pass."
  - id: D2
    description: "GET view=history validates the nickname key before RPC access and rejects malformed or oversized replies fail closed."
    requirement: USR-06
    verification:
      - kind: unit
        ref: "lib/users-api.test.ts#view=history returns five validated entries and sends the SQL signature argument"
        status: pass
      - kind: unit
        ref: "lib/users-api.test.ts#history parser rejects overflow, unknown keys and event-incompatible details"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editors can expand refreshed decision history on PC and see it inside the phone action window with masked actors and Moscow time."
    requirement: USR-06
    verification:
      - kind: unit
        ref: "lib/users-view.test.ts and lib/users-component.test.ts history contracts"
        status: pass
    human_judgment: true
    rationale: "Static component contracts pass, but browser rendering and physical phone behavior were not run and remain BLOCKED for their designated phases."
duration: 21h23m
completed: 2026-11-11
status: complete
---

# Phase PORTIA-22 Plan 05: Decision History and Bounded Retention Summary

**Masked five-entry decision history now flows from a gated RPC to refreshed PC and phone panels, while the journal retains only the newest twenty entries per nickname without widening API-role privileges.**

## Performance

- **Duration:** 21h 23m wall time, including the interrupted session and server restart
- **Started:** 2026-11-10T19:20:28+05:00
- **Completed:** 2026-11-11T16:43:16+05:00
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added `portia_access_history` with an independent users-tab gate, canonical-key validation, owner-only full actor email, editor masking and seven-key detail whitelisting.
- Amended the journal guard only for the settled D-07 prune path and added an after-insert trigger that retains the newest twenty rows per `nickname_key`; UPDATE, TRUNCATE and every other DELETE still fail.
- Added strict store/API parsing for at most five event-compatible entries and invalid-key rejection before database access.
- Added accessible inline PC history and always-expanded phone history with Moscow timestamps, empty/error states and stale-safe reloads that preserve open panels.
- Updated canonical hash, authz matrix, fingerprint functions and the three-trigger inventory in the same SQL implementation commit.

## Task Commits

1. **Task 1 RED: history RPC and bounded-retention contracts** — `86f72ce`
2. **Task 1 GREEN: gated history RPC and twenty-entry retention** — `274d9fa`
3. **Task 2 RED: history store/API contracts** — `04962bc`
4. **Task 2 GREEN: validated view=history API** — `88f7d8e`
5. **Task 3 RED: history formatter and responsive component contracts** — `aba47b4`
6. **Task 3 GREEN: refreshed PC and phone history panels** — `ea73b53`

## Files Created/Modified

- `supabase/migrations/20261110000000_portia_users_tab.sql` — history RPC, bounded DELETE guard, prune function and after-insert trigger.
- `supabase/fingerprint/expected/portia.fingerprint.json`, `tests/e2e/fixtures/data/expected-authz.json` and `lib/portia-canonical-parity.test.ts` — same-commit SQL evidence pins.
- `lib/portia-migration-fingerprint.test.ts` and `lib/users-sql.test.ts` — all-migration trigger inventory and security/retention contracts.
- `lib/access-store.ts`, `lib/users-model.ts`, `lib/users-api.ts` and `lib/users-api.test.ts` — strict history parsing and route dispatch.
- `lib/users-view.ts`, `lib/users-copy.ts`, `components/portia-users-tab.tsx` and `app/portia.css` — formatter, frozen Russian copy and responsive accessible history UI.
- Three `22-05-task*-red-evidence.json` files — preserved RED reports and semantic assessments.

## Decisions Made

- The direct SQL boundary owns masking and detail whitelisting; the client never receives raw journal details or another editor's full email.
- A successful list refresh does not close history panels. It reloads each open `nicknameKey`, and a monotonically increasing per-key epoch prevents an older response from replacing newer history.
- The accepted D-07 retention policy is implemented exactly as settled: five entries shown, twenty retained per nickname, no “show more,” and no claim that irreversible pruning has been exercised live.

## TDD Gate Compliance

- **Task 1 RED:** `86f72ce`; the named history-RPC contract failed because the function was absent. The stored report reclassified as `RED_EVIDENCE_OK`; semantic assessment confirms the planned assertion executed.
- **Task 1 GREEN:** `274d9fa`; SQL, canonical parity, expected-authz and fingerprint contracts pass.
- **Task 2 RED:** `04962bc`; the named `view=history` contract returned `invalid-view`. The stored report reclassified as `RED_EVIDENCE_OK` with no load/setup failure.
- **Task 2 GREEN:** `88f7d8e`; argument parity, fail-closed parser and closed-tab/invalid-key tests pass.
- **Task 3 RED:** `aba47b4`; the named formatter contract failed because `historyLine` was absent. The stored report reclassified as `RED_EVIDENCE_OK` with the intended assertion failure.
- **Task 3 GREEN:** `ea73b53`; formatter, responsive component, CSS, TypeScript and focused ESLint checks pass.
- **REFACTOR:** No separate refactor commit was needed.

## Verification

- SQL/API/parity/fingerprint/access suite — 140 passed, 0 failed.
- Task 3 view/component/style/accent/hints suite — 64 passed, 0 failed.
- Full `lib/*.test.ts` red-window gate — `red-window ok: 3 expected failures`; exactly the documented security-matrix window remains open through 22-09.
- `node node_modules/typescript/bin/tsc --noEmit` — passed on Node 22.13.1.
- Focused ESLint for Task 3 production files — passed; full repository ESLint completed with 0 errors and 17 pre-existing warnings outside changed production files.
- Phase 15 visual manifest — 49 passed; `--verify-promotion` verified 65 exact owner-approved snapshot bytes and excluded 18 non-approved rows.
- All three preserved RED records — `RED_EVIDENCE_OK`.
- Build was not run by explicit execution constraint. No `.env*` file was read.

## Security Review

Static `supabase-rls-reviewer` verdict: **SECURED**. No new critical, high, medium or low findings.

- The route and directly callable RPC independently enforce the users-tab gate.
- The history RPC has an empty `search_path`, uses no dynamic SQL, masks actor email outside the owner branch and constructs only the seven allowed detail keys.
- The bounded guard permits only DELETE rows older than the twentieth newest row for the same nickname; UPDATE, TRUNCATE and all other DELETE operations still raise `journal-append-only`.
- The security-definer prune function has an empty `search_path`; API roles received no DELETE, UPDATE or TRUNCATE table privilege, and the internal trigger function is executable only by the privileged role.
- The owner-accepted D-07 loss risk and residual RLS21-03 table-owner trigger-disable risk remain recorded.

Live PostgreSQL trigger execution, actual ACL ownership, RLS, authenticated editor/owner roles, staging and production remain **BLOCKED (ENV), not PASS**. The migration was not applied anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept refresh reads on the latest open-history set**

- **Found during:** Task 3 GREEN
- **Issue:** Reading the render-time `openHistoryKeys` value inside the async list loader could use a stale set after a rapid toggle and refresh.
- **Fix:** Mirrored the set in `openHistoryKeysRef`, updated it synchronously on toggle, reloaded from `.current`, and adjusted the static contract to accept the ref-backed form.
- **Files modified:** `components/portia-users-tab.tsx`, `lib/users-component.test.ts`
- **Verification:** Task 3 focused suite, TypeScript, ESLint and the full red-window gate pass.
- **Committed in:** `ea73b53`

**Total deviations:** 1 auto-fixed Rule 1 bug. No architecture or scope change.

## Authentication Gates

None. No external authentication, Supabase network access or live database operation was attempted.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The new RPC, trigger deletion boundary and history route were planned and reviewed statically.

## Requirements Status

- **USR-06 implementation:** complete by SQL/API/view/component contracts and pinned static evidence.
- **USR-06 live proof:** PostgreSQL/RLS execution, authenticated roles and physical device behavior remain BLOCKED in their designated phases and are not recorded as PASS.

## Next Phase Readiness

- Plan 22-06 can consume the stable history-aware row and refresh workflow.
- Plan 22-08 can include T-22-16 through T-22-19 in the broader static security review.
- Plan 22-09 must close the documented three-test security-matrix red window.
- Isolated live Postgres/Supabase evidence is still required before any runtime retention, ACL, RLS or role claim.

## Self-Check: PASSED

All key deliverable and metadata files exist, and task commits `86f72ce`, `274d9fa`, `04962bc`, `88f7d8e`, `aba47b4` and `ea73b53` are ancestors of HEAD.

---
*Phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya*
*Completed: 2026-11-11*
