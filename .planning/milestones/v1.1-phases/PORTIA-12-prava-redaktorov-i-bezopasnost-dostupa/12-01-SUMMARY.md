---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 01
subsystem: editor-access
tags: [security, access, tabs, SEC-01, PERM-01, PERM-02]
requires: ["12-04"]
provides:
  - "lib/editor-tabs.ts: tabRegistry, openTabIds, closedSectionsOf, closedMessage, parseTabLists"
  - "getEditorAccess returns { canEdit, canManageEditors, openTabs, tabsEnforced, unavailable? }; exported noAccess"
  - "GET /api/access: 200 { canEdit, canManageEditors, openTabs, tabsEnforced } or 503 { error }"
  - "/owner-login?error=unconfirmed (D-19 sentence)"
affects: [12-05, 12-06, 12-07, 12-08]
tech-stack:
  added: []
  patterns: [column select on own portia_editors row detects "SQL not applied" (works for the owner too), fail closed on any other error]
key-files:
  created:
    - lib/editor-tabs.ts
    - lib/editor-tabs.test.ts
    - lib/editor-access.test.ts
  modified:
    - lib/editor-access.ts
    - app/api/access/route.ts
    - app/owner-login/actions.ts
    - app/owner-login/page.tsx
key-decisions:
  - "A user with no email_confirmed_at gets noAccess before any rpc, the owner included (D-18, D-22)"
  - "Only 42703 / PGRST204 on the closed_tabs select mean all tabs open with tabsEnforced false; any other error is unavailable (503 on /api/access)"
  - "isMissingColumnError is imported from ./portia-employees.ts, not copied"
  - "employees stays outside EditorSection; it is only a registry tab"
metrics:
  tasks: 2
status: complete
commits: 2
plan_head_before: 21433f055d2e1e8e12184a3e4058dd86999d1963
plan_head_after: d33c3956848f7b1324de52680836ae23d4c6e643
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
---

# Phase 12 Plan 01: Editor access and tab registry Summary

One shared `getEditorAccess` now answers both "may edit" and "which tabs are open": unconfirmed emails get nothing, a missing `closed_tabs` column keeps every tab open, and any other failure fails closed with a 503 on `/api/access`.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Tab registry, getEditorAccess gate and tabs, /api/access 503 (tracer) | 8445b2f |
| 2 | Unconfirmed login shows the D-19 sentence and keeps no session | d33c395 |

## Verification

- `node --experimental-strip-types --test lib/editor-tabs.test.ts lib/editor-access.test.ts`: 18 + 1 source test pass (red first: module not found, then green).
- `npm test`: 393 pass, 0 fail (run after Task 1). `npx tsc --noEmit`: clean. ESLint on the touched files: clean.
- Tracer feedback gate: automated-only verify re-run end to end, passed, expansion continued.
- Acceptance greps: `error=unconfirmed` in actions.ts = 2, `status: 503` in route = 2, `./portia-employees.ts` imported once.

## Deviations from Plan

None - plan executed as written. The 503 body is held in one constant shared by both 503 returns so the two `status: 503` literals still appear (grep count 2).

## Pending human check

The Task 2 human-check (real Supabase account with Confirm email on, log in without opening the letter, expect the D-19 sentence and no editor) was not run; it needs a mailbox. Plan 12-08 covers the live `tabsEnforced: false` / 200 check before any SQL (RESEARCH A1).

## Known Stubs

None.

## Threat Flags

None. No new endpoints; per-user access data stays on the no-store `/api/access` and is not added to `/api/content`.

## Self-Check: PASSED

Files exist, commits 8445b2f and d33c395 are in HEAD, `commits: 2` measured from the ledger.
