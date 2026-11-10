---
phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
plan: 03
subsystem: editor-access
tags: [nextjs, react, postgres, supabase-rls, responsive-ui, accessibility, tdd]
requires:
  - phase: PORTIA-22-01
    provides: users-tab tracer, gated list route and pending badge
  - phase: PORTIA-22-02
    provides: declare-only style tokens and frozen CSS marker contract
provides:
  - full users read model for pending, active and closed sections
  - masked decision actors with device-independent Moscow timestamps
  - server-side nickname search, truncation and stale-data handling
  - responsive users rows with an accessible native action dialog
affects: [PORTIA-22-04, PORTIA-22-05, PORTIA-22-06, users-management, security-matrix]
actuals:
  tokens: 14145
  tasks: 2
  commits: 4
plan_head_before: f9cb3e58e29916ff4b391b3801f0bfcff2612c81
plan_head_after: 1150a16a17df952aadcd5b9c10f9374a1d26200d
tech-stack:
  added: []
  patterns: [database-owned masking, fail-closed reply parsing, request-epoch race protection, native dialog focus return]
key-files:
  created:
    - lib/users-time.ts
  modified:
    - supabase/migrations/20261110000000_portia_users_tab.sql
    - lib/users-model.ts
    - lib/users-view.ts
    - components/portia-users-tab.tsx
    - app/portia.css
key-decisions:
  - "Decision actors are masked inside portia_access_list; the client only renders the server value."
  - "Search responses use a monotonic request epoch so an older refresh cannot replace newer results."
  - "The phone action window reuses the native portia-dialog chrome and returns focus to its row."
patterns-established:
  - "Users read model: totals are authoritative while each returned section is capped at 50 rows."
  - "Users UI copy: repeated and long Russian strings stay centralized in lib/users-copy.ts."
requirements-completed: [USR-01, USR-02, USR-06]
coverage:
  - id: D1
    description: "The list RPC returns pending, active and closed sections with masked decision actors and server-owned permission flags."
    requirement: USR-01
    verification:
      - kind: integration
        ref: "lib/users-sql.test.ts, lib/users-api.test.ts and static supabase-rls-reviewer verdict SECURED"
        status: pass
    human_judgment: true
    rationale: "Live PostgreSQL grants, RLS and authenticated editor/owner behavior remain BLOCKED (ENV)."
  - id: D2
    description: "Rows expose nickname, chosen origin/type, Roblox profile link and decision metadata without client-side email reconstruction."
    requirement: USR-02
    verification:
      - kind: unit
        ref: "lib/users-view.test.ts and lib/users-component.test.ts"
        status: pass
    human_judgment: true
    rationale: "The table-membership mark is intentionally delivered by 22-06 and device/browser confirmation remains blocked."
  - id: D3
    description: "Every decided row formats actor and time in Europe/Moscow and the phone layout opens an accessible action dialog."
    requirement: USR-06
    verification:
      - kind: unit
        ref: "lib/users-view.test.ts#Europe/Moscow formatter and full users component contracts"
        status: pass
    human_judgment: true
    rationale: "Journal history is completed by 22-05; physical phone behavior is not claimed from static tests."
duration: 1h45m
completed: 2026-11-10
status: complete
---

# Phase PORTIA-22 Plan 03: Full users read model and responsive tab Summary

**A secure three-section users list with server-side search, masked decision metadata, Moscow timestamps and an accessible phone action window.**

## Performance

- **Duration:** 1h 45m
- **Started:** 2026-11-10T17:12:23+05:00
- **Completed:** 2026-11-10T18:57:04+05:00
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Expanded `portia_access_list` to return active people and closed decisions alongside pending requests, with true totals, server-side search and permission flags.
- Kept full actor email owner-only and masked editor-visible actors inside the SQL definer boundary; reply parsing rejects malformed levels, flags, events and oversized sections.
- Built pending, people and collapsed closed sections with Moscow captions, Roblox links, four empty-state paths, stale refresh preservation and truncation copy.
- Added 300 ms debounced search with stale-response protection, PC inline rows and phone rows that open a native modal and restore focus on close.
- Appended the sharp-corner users CSS block without changing existing selector bytes or consuming the Phase 22 style tokens.

## Task Commits

1. **Task 1 RED: full read-model contracts** — `db8b6a0`
2. **Task 1 GREEN: secure SQL read model and fail-closed parser** — `e1f8a04`
3. **Task 2 RED: full users-tab contracts** — `51f593b`
4. **Task 2 GREEN: full responsive users-tab experience** — `1150a16`

## Files Created/Modified

- `supabase/migrations/20261110000000_portia_users_tab.sql` — masked actor helper and full list RPC.
- `lib/users-model.ts` — strict pending, people, closed and event reply parser.
- `lib/users-time.ts` — fixed-zone Moscow formatter and Russian request plural helper.
- `lib/users-view.ts` — section, plaque, caption, pause and profile-link view model.
- `lib/users-copy.ts` — centralized Russian search, section, empty and dialog copy.
- `components/portia-users-tab.tsx` — search, three sections, stale state and phone dialog.
- `app/portia.css` — one terminal marked block for the users tab.
- SQL/API/view/component tests and canonical authz/fingerprint pins — contract and parity evidence.

## Decisions Made

- Email masking remains a database responsibility because editors can call the RPC directly and must never receive another editor's full address.
- List totals are independent of the 50-row display cap; the UI reports truncation rather than treating returned row count as the total.
- Mobile detail uses native `<dialog>` semantics and explicit opener focus restoration; no new animation or radius was introduced.

## TDD Gate Compliance

- **Task 1 RED:** `db8b6a0`; stored evidence returned `RED_EVIDENCE_OK` and the intended parser/SQL contract assertions failed before implementation.
- **Task 1 GREEN:** `e1f8a04`; SQL, authz matrix, fingerprint and parser checks pass.
- **Task 2 RED:** `51f593b`; `22-03-task2-red-evidence.json` returned `RED_EVIDENCE_OK` (`target_test_failed`), and semantic inspection confirmed the Moscow helper was absent rather than a load/setup failure.
- **Task 2 GREEN:** `1150a16`; view, component, style, type and lint checks pass.
- **REFACTOR:** No separate refactor commit was needed; implementation stayed within the planned modules.

## Verification

- Task 1 SQL/API/parity/fingerprint suite — passed.
- Task 2 view/component/style/access suite — 84 passed, 0 failed.
- Full `lib/*.test.ts` red-window gate — `red-window ok: 3 expected failures`; only the documented security-matrix freshness rows remain open until 22-09.
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- Focused ESLint for the four Task 2 source modules — passed.
- Phase 15 visual manifest — 49 passed; `--verify-promotion` verified 65 exact approved bytes and excluded 18 non-approved rows.
- Build was not run by explicit execution constraint; no `.env*` file was read.

## Security Review

Static `supabase-rls-reviewer` verdict: **SECURED**. No new critical, high, medium or low findings.

- Route and direct RPC independently enforce the users-tab gate.
- Actor email is full only in the owner branch and masked in SQL for editors.
- The mask helper is not security definer and is executable only by the privileged role.
- Closed rows do not expose requester IDs, token hashes or IP buckets.
- Permission flags mirror database predicates but do not replace mutation enforcement.

Live PostgreSQL/RLS, actual authenticated editor/owner roles, applied grants and runtime masking remain **BLOCKED (ENV)** and are not recorded as PASS. The pre-existing accepted `portia_editor_is_approved(text)` email-existence oracle (SEC-M1) was not introduced or widened by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected mojibake expectations in the committed Task 2 RED test**

- **Found during:** Task 2 GREEN
- **Issue:** The previous executor wrote several Russian expected strings as double-encoded mojibake, while product source and the approved UI specification use proper UTF-8 Russian text.
- **Fix:** Replaced only the corrupted expected literals and kept the same behavioral contracts; added an encoded Roblox nickname case.
- **Files modified:** `lib/users-view.test.ts`
- **Verification:** The original RED evidence remains valid (`RED_EVIDENCE_OK`, helper absent); the corrected tests pass against proper UTF-8 output.
- **Committed in:** `1150a16`

**Total deviations:** 1 auto-fixed bug. No architectural or scope changes.

## Authentication Gates

None. No external authentication or live database access was attempted.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The new RPC/masking surface was planned and statically reviewed as SECURED.

## Requirements Status

- **USR-01:** this plan's full-list/search/read portion is complete; live authenticated database proof remains BLOCKED (ENV).
- **USR-02:** nickname, origin/type and Roblox link are complete; the table-membership mark remains assigned to 22-06.
- **USR-06:** actor/time captions are complete; full five-entry history remains assigned to 22-05.

## Next Phase Readiness

- Plans 22-04 through 22-06 can consume the server-owned permission flags and stable view-row contracts.
- No migration was applied anywhere; an isolated test database is still required before any live RLS claim.
- Physical phone and browser behavior remains deferred to the later owner/device phase.

## Self-Check: PASSED

All key deliverable files exist, and commits `db8b6a0`, `e1f8a04`, `51f593b` and `1150a16` are ancestors of HEAD.
