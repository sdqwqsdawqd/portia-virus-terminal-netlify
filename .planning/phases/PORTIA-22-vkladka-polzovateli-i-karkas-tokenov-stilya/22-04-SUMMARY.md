---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: "04"
subsystem: editor-access-decisions
tags: [nextjs, react, supabase-rpc, accessibility, responsive-ui, tdd]
dependency-graph:
  requires:
    - 22-03 full users read model and server permission flags
    - 21 Phase 21 decision, level, revoke and cooldown RPC wrappers
  provides:
    - guarded POST /api/users mutation dispatcher
    - approve, reject, level-change, revoke and owner cooldown controls
    - concurrent-decision and stale-result feedback without automatic retries
  affects: [PORTIA-22-05, PORTIA-22-06, users-management, security-matrix]
tech-stack:
  added: []
  patterns:
    - database result codes remain authoritative over UI state
    - server permission flags determine which row controls exist
    - destructive phone actions close the detail window before opening one confirmation dialog
key-files:
  created:
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-04-task1-red-evidence.json
    - .planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-04-task2-red-evidence.json
  modified:
    - lib/users-api.ts
    - app/api/users/route.ts
    - lib/users-view.ts
    - lib/users-copy.ts
    - components/portia-users-tab.tsx
    - app/portia.css
decisions:
  - Mutation controls are rendered only from server permission flags; database result codes remain authoritative and are never retried automatically.
  - Clearing a cooldown is owner-only in both the UI and POST handler before the Phase 21 RPC is called.
requirements-completed: [USR-03, USR-04, USR-07]
coverage:
  - id: D1
    description: Editors approve or reject requests with the correct default or fixed level and honest concurrent-decision feedback.
    requirement: USR-03
    verification:
      - kind: unit
        ref: lib/users-api.test.ts, lib/users-view.test.ts and lib/users-component.test.ts
        status: pass
    human_judgment: true
    rationale: Live authenticated editor races and PostgreSQL execution remain BLOCKED (ENV).
  - id: D2
    description: Editors change levels with expectedLevel, revoke access through a safe confirmation, and owners alone clear cooldowns.
    requirement: USR-04
    verification:
      - kind: unit
        ref: handler, view and component contract suites
        status: pass
    human_judgment: true
    rationale: Physical phone behavior and applied database grants remain BLOCKED until their designated phases.
  - id: D3
    description: Already-decided, stale, not-active and already-revoked results are displayed and refetched without client retry.
    requirement: USR-07
    verification:
      - kind: unit
        ref: USR-07 already-decided test and result-note contracts
        status: pass
    human_judgment: true
    rationale: A real two-editor PostgreSQL race remains BLOCKED (ENV), never PASS.
duration: 32m
completed: 2026-11-10
status: complete
actuals:
  tokens: 15217
  tasks: 2
  commits: 4
plan_head_before: a0a8d4569020fb7d3735df08f2137f578fbf4682
plan_head_after: 68bbfb30f6641142ccd59391dfd22eae11bae45d
---

# Phase PORTIA-22 Plan 04: Guarded users decisions Summary

**Server-validated access decisions now work on PC and phone with safe confirmations, honest race/stale notices, and owner-only cooldown clearing over the existing Phase 21 RPCs.**

## Performance

- **Duration:** 32m
- **Completed:** 2026-11-10
- **Tasks:** 2
- **Files changed:** 11

## Accomplishments

- Added `POST /api/users` with JSON-only request parsing, UUID/level/action validation, the users-tab gate, fail-closed error mapping and no-store responses.
- Wired approve, reject, change-level, revoke and clear-cooldown to the existing Phase 21 wrappers without changing SQL or applying a migration.
- Added server-driven row controls, default and fixed approval levels, disabled/busy states, safe destructive confirmations, row notices, status announcements and focus recovery after refresh.
- Reused the native phone action dialog while keeping destructive actions one modal at a time and mobile controls at least 44px high.

## Task Commits

1. **Task 1 RED: request-decision contracts** — `11ffc6b`
2. **Task 1 GREEN: approve/reject workflow** — `4143031`
3. **Task 2 RED: access-management contracts** — `fab9b63`
4. **Task 2 GREEN: level/revoke/cooldown workflow** — `68bbfb3`

## Files Created/Modified

- `lib/users-api.ts` — action parser, POST request parser, dispatcher and database-error mapping.
- `app/api/users/route.ts` — authenticated JSON mutation route with no-store responses.
- `lib/users-view.ts` — server-driven visible controls, result notes and success announcements.
- `lib/users-copy.ts` — frozen Russian action, dialog, busy, refusal and success copy.
- `components/portia-users-tab.tsx` — PC/phone controls, confirmations, async state, row notes and focus restoration.
- `app/portia.css` — sharp action layout, 8px gaps, refusal note and 44px phone controls inside the existing users block.
- `lib/users-api.test.ts`, `lib/users-view.test.ts`, `lib/users-component.test.ts` — API, view and component contracts.

## Decisions Made

- Permission flags decide whether a control exists, but the database remains the enforcement boundary; crafted forbidden mutations still map database refusals.
- Refusal and concurrency result codes are treated as authoritative state transitions: the list is refreshed and no mutation is retried automatically.
- The owner check for cooldown clearing happens before the RPC as defence in depth, while the Phase 21 SQL owner check remains authoritative for direct calls.

## TDD Gate Compliance

- **Task 1 RED:** `11ffc6b`; `22-04-task1-red-evidence.json` returned `RED_EVIDENCE_OK`. The named USR-07 test executed and failed on the planned missing POST-handler assertion, with no import, setup, fixture or discovery failure.
- **Task 1 GREEN:** `4143031`; 54 targeted tests passed, followed by TypeScript, focused ESLint and the three-failure red-window gate.
- **Task 2 RED:** `fab9b63`; `22-04-task2-red-evidence.json` returned `RED_EVIDENCE_OK`. The owner-only cooldown test executed and failed because the owner control was still absent.
- **Task 2 GREEN:** `68bbfb3`; 78 targeted tests passed, followed by TypeScript, focused ESLint and the three-failure red-window gate.
- **REFACTOR:** No separate refactor commit was needed; implementation stayed within the planned modules.

## Verification

- Task 1 handler/view/component/access suite — 54 passed, 0 failed.
- Task 2 handler/view/component/style/accent suite — 78 passed, 0 failed.
- Full `lib/*.test.ts` red-window gate — `red-window ok: 3 expected failures`; only the documented security-matrix freshness rows remain open through plan 22-09.
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- Focused ESLint — passed; full repository ESLint completed with 0 errors and 17 pre-existing warnings outside changed production files.
- Phase 15 visual manifest — 49 passed; `--verify-promotion` verified 65 exact approved bytes and excluded 18 non-approved rows.
- The `portia-check` wrapper could not start because `bash` and the referenced `.Codex/skills/portia-check/run.sh` are absent in this checkout; its safe no-build steps were executed directly with Node 22.13.1.
- Build was not run by explicit execution constraint. No `.env*` file was read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an unsupported regular-expression flag from the Task 2 static contract**

- **Found during:** Task 2 GREEN TypeScript verification
- **Issue:** The new CSS assertion used the `s` flag, which is unavailable under the repository's TypeScript target.
- **Fix:** Kept the same assertion without the unnecessary flag because the matched declaration is a single CSS rule.
- **Files modified:** `lib/users-component.test.ts`
- **Verification:** TypeScript and the full Task 2 suite pass.
- **Committed in:** `68bbfb3`

**Total deviations:** 1 auto-fixed Rule 1 bug. No architecture or scope change.

## Security Review

- No SQL, RLS, RPC or storage policy changed, so no Supabase security-review agent was required by `AGENTS.md`.
- The route requires `application/json`, validates action-specific fields before RPC dispatch, applies the editor/tab gate and checks owner-only cooldown clearing before the RPC.
- Database checks for self-decision, owner protection, level ceilings and concurrent state remain the authority and are mapped to explicit response codes.
- Live PostgreSQL/RLS, authenticated roles, a real two-editor race, staging, production and physical devices remain **BLOCKED (ENV)** and are not recorded as PASS.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The POST endpoint and access-decision boundary were explicitly planned and covered by T-22-12 through T-22-15.

## Requirements Status

- **USR-03:** complete by handler/view/component contracts; live authenticated execution remains BLOCKED (ENV).
- **USR-04:** complete by handler/view/component contracts; physical phone and applied database proof remain BLOCKED in later phases.
- **USR-07:** complete by result-code and refresh contracts; the real two-editor race remains BLOCKED (ENV).

## Next Phase Readiness

- Plan 22-05 can add history detail against the stable row action/refetch flow.
- Plan 22-06 can add roster marks and bulk approval using the same guarded POST contract.
- Plan 22-09 must close the documented three-test security-matrix red window.

## Self-Check: PASSED

All key artifacts exist, and task commits `11ffc6b`, `4143031`, `fab9b63` and `68bbfb3` are ancestors of HEAD.

