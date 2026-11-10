---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: 01
subsystem: editor-access
tags: [nextjs, react, postgres, supabase-rls, accessibility, tdd]
requires:
  - phase: PORTIA-21
    provides: access request foundation, tab authorization and editor access model
provides:
  - users editor tab with fail-closed pending-request reads
  - accessible pending badge with live count polling
  - forward-only portia_access_list migration and pinned authz evidence
affects: [PORTIA-22, users-management, editor-tabs, security-matrix]
actuals:
  tokens: 12141
  tasks: 2
  commits: 3
plan_head_before: dbf86758b8ee888dabd7f258350efe5f2e3fcd0a
plan_head_after: d465f1a89661d1fa647d508fb9f0eaa5a7250f35
tech-stack:
  added: []
  patterns: [thin no-store route, database re-authorization, fail-closed polling, editor visitor allow-list]
key-files:
  created:
    - supabase/migrations/20261110000000_portia_users_tab.sql
    - app/api/users/route.ts
    - components/portia-users-tab.tsx
    - lib/users-api.ts
    - lib/users-model.ts
    - lib/users-view.ts
    - lib/users-copy.ts
  modified:
    - components/portia-editor.tsx
    - lib/editor-tabs.ts
    - lib/access-foundation.test.ts
    - proxy.ts
key-decisions:
  - "The HTTP route and the directly callable SQL function both enforce the users-tab gate."
  - "Unknown, failed or stale badge counts render no badge; active-tab list responses remain authoritative."
  - "Long Russian UI copy stays in lib/users-copy.ts to preserve the frozen component copy inventory."
patterns-established:
  - "Editor-only surface: allow-listed component reaches access data only through /api/users."
  - "Accessible tab count: visual aria-hidden badge plus contextual sr-only suffix."
requirements-completed: [USR-01, USR-09]
coverage:
  - id: D1
    description: "Authorized editors can read pending users through a gated route and database function."
    requirement: USR-01
    verification:
      - kind: integration
        ref: "lib/users-api.test.ts and lib/users-sql.test.ts"
        status: pass
    human_judgment: true
    rationale: "Live Postgres ACL/RLS execution is intentionally deferred to an isolated test database."
  - id: D2
    description: "The users tab has a fail-closed accessible pending badge and correct zero/99+ behavior."
    requirement: USR-01
    verification:
      - kind: unit
        ref: "lib/users-view.test.ts and lib/users-component.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Closing the users tab removes access and produces the denied UI path."
    requirement: USR-09
    verification:
      - kind: integration
        ref: "lib/editor-tabs.test.ts and lib/users-api.test.ts"
        status: pass
    human_judgment: true
    rationale: "Authenticated-role behavior remains BLOCKED until the isolated database phase proves it."
duration: 18min
completed: 2026-11-10
status: complete
---

# Phase PORTIA-22 Plan 01: Users tab tracer and badge Summary

**Fail-closed users request tracer with a doubly gated SQL/API read path and an accessible live pending badge.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-11-10T07:20:10Z
- **Completed:** 2026-11-10T07:37:49Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- Added the regular «Пользователи» editor tab, thin `/api/users` route and `portia_access_list` RPC with independent tab authorization.
- Added fail-closed list/count parsing, accessible zero-to-99+ badge behavior and visibility-aware 10/30 second pollers.
- Pinned migration fingerprints, authz evidence, canonical editor parity and a visitor-surface allow-list without touching any database.

## Task Commits

1. **Task 1: Pending users tracer, gated RPC and editor tab** — `a4264a4` (feat)
2. **Task 2 RED: Failing badge and component contracts** — `f230c43` (test)
3. **Task 2 GREEN: Badge polling, copy, proxy and visitor guard** — `d465f1a` (feat)

## Files Created/Modified

- `supabase/migrations/20261110000000_portia_users_tab.sql` — forward-only gated pending-request list RPC.
- `lib/users-api.ts` and `app/api/users/route.ts` — dependency-injected API behavior and session-bound no-store route.
- `components/portia-users-tab.tsx` — tab body, denied/fatal/loading states and live badge hook.
- `lib/users-model.ts`, `lib/users-view.ts`, `lib/users-copy.ts` — fail-closed payload parsing, pure display helpers and centralized copy.
- `lib/users-sql.test.ts`, `lib/users-api.test.ts`, `lib/users-view.test.ts`, `lib/users-component.test.ts` — offline SQL/API/UI contracts.
- `lib/access-foundation.test.ts` — explicit Phase 22 editor allow-list for visitor isolation.

## Decisions Made

- Kept authorization at both trust boundaries: the route checks editor access before RPC, while the definer function re-checks `portia_can_edit_tab('users')` for direct calls.
- Treated every count error, malformed payload and non-200 response as unknown, hiding the badge instead of displaying stale data.
- Kept the client dependency closure free of access stores, server modules and `node:` imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript control-flow ambiguity in the new RPC argument test**
- **Found during:** Task 1 verification
- **Issue:** Assignment inside the async client callback narrowed the nullable captured call to `never` under `tsc`.
- **Fix:** Recorded calls in a typed array and asserted the single captured call.
- **Files modified:** `lib/users-sql.test.ts`
- **Verification:** targeted suite and `tsc --noEmit` pass.
- **Committed in:** `a4264a4`

**2. [Rule 1 - Bug] Removed React render-time ref access from the count hook**
- **Found during:** Task 2 GREEN lint
- **Issue:** The first stale-cycle implementation violated React 19 ref rules during render.
- **Fix:** Switched to cancelled async publications and an immediate disabled return; failures still clear the count fail-closed.
- **Files modified:** `components/portia-users-tab.tsx`
- **Verification:** 152 task tests, TypeScript and ESLint pass.
- **Committed in:** `d465f1a`

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both fixes were necessary for type and React correctness; no scope expansion.

## TDD Gate Compliance

- **RED:** `f230c43`; target `pending badge caps at 99+ and is hidden at 0` failed on the planned `pendingBadgeText` assertion.
- **Classifier:** `RED_EVIDENCE_OK` from the unchanged TAP report in `22-01-task2-red-evidence.json`.
- **Semantic assessment:** The target executed and failed on intended behavior; there was no syntax, import, fixture, setup or discovery failure.
- **GREEN:** `d465f1a`; all Task 2 contracts pass.

## Security Review

- Static Supabase/RLS review verdict: **SECURED** with no new findings.
- The inherited accepted SEC-M1 email-existence oracle was not introduced or changed by this plan.
- Live ACL/RLS, authenticated roles, schema drift and definer ownership remain **BLOCKED** until replay on an isolated Postgres/Supabase test project.

## Verification

- Task 1: 247 tests pass; TypeScript passes; ESLint has zero errors.
- Task 2: 152 tests pass; TypeScript and ESLint pass.
- Full-suite red-window gate: `red-window ok: 3 expected failures` (the documented security-matrix window through plan 22-09).
- No migration was applied and no Supabase network or production action occurred.

## Known Stubs

None.

## Issues Encountered

- Three pre-existing `no-img-element` warnings in `components/portia-editor.tsx` were left unchanged and recorded in `deferred-items.md`.

## User Setup Required

None — database application belongs to the later isolated staging plan.

## Next Phase Readiness

- Plans 22-02 onward can style and expand the users surface against the stable tab/API/view contracts.
- Plan 22-09 must close the documented three-test security-matrix red window.
- Live database evidence remains BLOCKED for the designated isolated replay phase.

## Self-Check: PASSED

All key artifacts exist and task commits `a4264a4`, `f230c43` and `d465f1a` are ancestors of HEAD.

---
*Phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya*
*Completed: 2026-11-10*
