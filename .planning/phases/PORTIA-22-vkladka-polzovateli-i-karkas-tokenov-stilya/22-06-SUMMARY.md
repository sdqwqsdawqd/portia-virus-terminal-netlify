---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: "06"
subsystem: editor-access-bulk-approval
tags: [nextjs, react, postgres, supabase-rpc, google-sheet-roster, accessibility, tdd]
dependency-graph:
  requires:
    - 22-05 decision history, guarded row mutations and refreshed users list
    - Phase 19 staff-sheet roster loader with staging override
  provides:
    - server-computed tri-state staff-table marks on every users row
    - owner-only full pending sheet candidate RPC and fresh per-decision roster checks
    - confirmed sequential bulk approval with level 2, progress and three-number summary
  affects: [PORTIA-22-07, PORTIA-22-08, PORTIA-22-09, users-management, security-matrix]
tech-stack:
  added: []
  patterns:
    - cache only healthy roster reads and bypass cache at every decision boundary
    - enforce owner-only bulk eligibility in both HTTP and directly callable SQL boundaries
    - execute bulk work as sequential ordinary decisions with independent server re-checks
key-files:
  created:
    - lib/users-roster.ts
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-06-task1-red-evidence.json
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-06-task2-red-evidence.json
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-06-task3-red-evidence.json
  modified:
    - supabase/migrations/20261110000000_portia_users_tab.sql
    - lib/access-store.ts
    - lib/users-model.ts
    - lib/users-api.ts
    - lib/users-view.ts
    - lib/users-copy.ts
    - components/portia-users-tab.tsx
    - app/portia.css
key-decisions:
  - "Only successful roster reads enter the 20-second list cache; bulk and single approval always read the roster fresh."
  - "Bulk eligibility is owner-only at the route and SQL boundaries and covers every pending sheet request rather than the 50-row display slice."
  - "Bulk approval is a confirmed sequential client loop of ordinary level-2 POST decisions, each independently re-authorized and re-matched by the server."
requirements-completed: [USR-02, USR-08]
coverage:
  - id: D1
    description: "Every users row carries a server-computed yes/no/unknown staff-table mark without turning roster outages into false negatives."
    requirement: USR-02
    verification:
      - kind: unit
        ref: "lib/users-api.test.ts and lib/users-view.test.ts"
        status: pass
    human_judgment: true
    rationale: "The real Google Sheet and authenticated browser rendering remain BLOCKED (ENV); tests inject the roster source."
  - id: D2
    description: "Only the owner can list all pending sheet candidates and start the confirmed bulk flow."
    requirement: USR-08
    verification:
      - kind: integration
        ref: "lib/users-sql.test.ts, authz/fingerprint pins and static supabase-rls-reviewer verdict SECURED"
        status: pass
    human_judgment: true
    rationale: "Live PostgreSQL ACL/RLS and authenticated owner/editor execution remain BLOCKED (ENV)."
  - id: D3
    description: "Each bulk item is decided separately at level 2 after a fresh owner, pending-sheet-candidate and roster match check."
    requirement: USR-08
    verification:
      - kind: unit
        ref: "lib/users-api.test.ts D-11 and lib/users-component.test.ts sequential bulk contract"
        status: pass
    human_judgment: true
    rationale: "A real concurrent two-editor run remains BLOCKED (ENV), never PASS."
duration: 5h40m
completed: 2026-11-11
status: complete
actuals:
  tokens: 17226
  tasks: 3
  commits: 6
plan_head_before: b7be57241e6ff29405c366c8c21a77f2ce8e2386
plan_head_after: 6079251ab550e0b4b5c318c92dceae3588b7a6d5
---

# Phase PORTIA-22 Plan 06: Staff Roster Marks and Confirmed Bulk Approval Summary

**Honest tri-state staff-table marks now feed an owner-only, confirmed and sequential level-2 approval flow whose SQL and HTTP boundaries re-check every decision.**

## Performance

- **Duration:** 5h 40m wall time, including the interrupted executor session
- **Started:** 2026-11-11T16:49:42+05:00
- **Completed:** 2026-11-11T22:30:00+05:00
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Added `portia_access_bulk_candidates()` as an owner-gated security-definer RPC returning every pending `sheet` request, with revoke-before-grant ACLs and pinned canonical/authz/fingerprint evidence.
- Added strict candidate parsing and a healthy-only 20-second roster cache; degraded or thrown roster reads are never cached and render `НЕ ПРОВЕРЕНО` instead of a false negative.
- Added owner-only `view=bulk` and per-item bulk approval checks that freshly re-read both the roster and pending SQL candidates before an ordinary level-2 decision.
- Added desktop and phone roster plaques plus an owner-only native confirmation dialog with bounded lists, safe autofocus, sequential progress and the final approved/already-decided/error counts.

## Task Commits

1. **Task 1 RED: owner-only bulk candidate contracts** — `ab01a5f`
2. **Task 1 GREEN: gated bulk candidate RPC and pinned evidence** — `ddc3dc3`
3. **Task 2 RED: degraded roster and fresh bulk decision contracts** — `25c290b`
4. **Task 2 GREEN: healthy-only roster cache and server re-checks** — `f314423`
5. **Task 3 RED: roster plaque and sequential bulk UI contracts** — `088a588`
6. **Task 3 GREEN: confirmed bulk approval UI** — `6079251`

## Files Created/Modified

- `supabase/migrations/20261110000000_portia_users_tab.sql` — owner-only pending sheet candidate RPC and ACL block.
- `lib/access-store.ts` — strict `bulkCandidates` adapter capped at 200 valid canonical candidates.
- `lib/users-roster.ts`, `lib/users-model.ts`, `lib/users-api.ts` — roster cache, tri-state marks, bulk reply parsing and fresh decision-time checks.
- `lib/users-view.ts`, `lib/users-copy.ts`, `components/portia-users-tab.tsx`, `app/portia.css` — explicit marks, owner button, bounded native dialog, sequential progress and sharp styling.
- SQL/API/view/component tests and three RED evidence records — TDD contracts and machine-classified failure evidence.
- Canonical parity, expected-authz and fingerprint files — same-commit evidence for the new RPC.

## Decisions Made

- A roster failure is its own `degraded` state. It never becomes an empty healthy roster, is never cached and never enables bulk approval.
- Bulk eligibility uses all pending `sheet` requests from the owner-only RPC; it is deliberately independent of the users list's 50-row display cap.
- The confirmation dialog does not mutate anything until `ОДОБРИТЬ`; it then awaits each ordinary POST in a loop so one refusal cannot roll back or stop unrelated requests.

## TDD Gate Compliance

- **Task 1 RED:** `ab01a5f`; `22-06-task1-red-evidence.json` reclassified as `RED_EVIDENCE_OK`. The named RPC contract executed and failed because the function was absent.
- **Task 1 GREEN:** `ddc3dc3`; 64 SQL/parity/authz/fingerprint tests pass.
- **Task 2 RED:** `25c290b`; `22-06-task2-red-evidence.json` reclassified as `RED_EVIDENCE_OK`. The named degraded-roster assertion executed and found no roster status.
- **Task 2 GREEN:** `f314423`; 65 API/roster/SQL/promotion tests pass.
- **Task 3 RED:** `088a588`; `22-06-task3-red-evidence.json` reclassified as `RED_EVIDENCE_OK`. The named view assertion executed and found no `markPlaque` implementation.
- **Task 3 GREEN:** `6079251`; 86 view/component/style/access tests pass.
- **REFACTOR:** No separate refactor commit was needed; the implementation stayed in the planned modules.

## Verification

- Task 1 SQL/parity/authz/fingerprint suite — 64 passed, 0 failed.
- Task 2 API/roster/SQL/promotion suite — 65 passed, 0 failed.
- Task 3 view/component/style/access suite — 86 passed, 0 failed.
- `node node_modules/typescript/bin/tsc --noEmit` — passed on Node 22.13.1.
- Focused ESLint for all Task 2/3 production modules and the route — passed.
- Full `lib/*.test.ts` red-window gate — `red-window ok: 3 expected failures`; no failure outside the documented security-matrix window through plan 22-09.
- Acceptance probes found the owner gate inside `portia_access_bulk_candidates`, D-10/D-11 API tests and the `Одобрить 1 заявку` UI contract.
- Build was not run by explicit constraint. No `.env*` file was read.

## Security Review

Static `supabase-rls-reviewer` verdict: **SECURED**. No new critical, high, medium or low findings.

- `portia_access_bulk_candidates()` is `security definer`, has `search_path = ''`, uses no dynamic SQL and starts with `portia_is_owner()`.
- EXECUTE is revoked from `public`, `anon` and `authenticated` before the narrow authenticated/service-role grants; authenticated non-owners still stop at `owner-required`.
- The RPC exposes only `id`, `nickname` and canonical `nicknameKey` for pending `sheet` requests; it does not expose email, token, IP or journal data.
- The route checks owner status before the RPC. Every bulk POST then requires owner, level 2, a fresh roster and a fresh candidate list before calling the existing decision boundary.
- T-22-20 through T-22-23 are covered by the planned mitigations. The inherited accepted SEC-M1 oracle was neither changed nor widened.

Live migration application, definer ownership, PostgreSQL ACL/RLS, real authenticated roles, concurrent races, staging and production remain **BLOCKED (ENV), not PASS**. No migration was applied and no Supabase network action occurred.

## Deviations from Plan

None — the continuation only re-ran the planned verification and mandatory static security review; product code was not changed after the six task commits.

## Authentication Gates

None. No external authentication, database connection or live roster request was attempted.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The RPC, roster boundary and bulk POST loop were all explicitly planned and statically reviewed.

## Requirements Status

- **USR-02 implementation:** complete by server/API/view contracts; the real sheet and physical/browser rendering remain BLOCKED in their designated proof phases.
- **USR-08 implementation:** complete by SQL/API/component contracts and static security review; live owner/editor/PostgreSQL execution remains BLOCKED (ENV).

## Next Phase Readiness

- Plan 22-07 can exercise the mocked browser lane against the stable row and bulk-dialog contracts.
- Plan 22-08 can perform the phase-wide static RLS review with this final SQL/server slice included.
- Plan 22-09 must close the documented three-test security-matrix red window and keep migration application BLOCKED until an authorized isolated target exists.

## Self-Check: PASSED

All 19 plan files exist, commits `ab01a5f`, `ddc3dc3`, `25c290b`, `f314423`, `088a588` and `6079251` are ancestors of HEAD, and the measured ledger records 6 task commits from `b7be572` to `6079251`.

---
*Phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya*
*Completed: 2026-11-11*
