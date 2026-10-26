---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
verified: 2026-10-26T19:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-01-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-01-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-02-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-02-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-03-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-03-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-04-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-04-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-05-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-05-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-06-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-06-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-07-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-07-SUMMARY.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-08-PLAN.md"
  - ".planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-08-SUMMARY.md"
  - "app/api/access/route.ts"
  - "app/api/content/route.ts"
  - "app/api/editors/route.ts"
  - "app/api/employees/editor/route.ts"
  - "app/api/employees/route.ts"
  - "app/api/uploads/route.ts"
  - "app/owner-login/actions.ts"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "lib/editor-access.ts"
  - "lib/editor-changes.ts"
  - "lib/editor-history.ts"
  - "lib/editor-tabs.ts"
  - "lib/media-url.ts"
  - "supabase/phase12_apply.sql"
  - "supabase/portia_setup.sql"
covered_digest: "v3:sha256:7a306e7f95112240b0d492e1e005a5e23c8c8566e4a4513cc1886722a9546de3"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  reason: "Covered file app/api/access/route.ts changed in commit e0f89ef (CR-01: getUser() retryable auth error answers 503) after the first report; fingerprint went stale."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Live tab toggle end to end on project wqiyghssdulzsbshjtur (owner switches a real editor's tab off/on, reload, editor loses/regains the tab)."
    expected: "Chip state persists after reload; the editor strip drops the closed tab; re-enabling restores it."
    why_human: "PATCH /api/editors under the real RLS UPDATE policy had no live evidence."
    status: resolved
    resolution: "PASSED by the owner on localhost:3123 against the live project; recorded in 12-UAT.md test 1 (result: pass)."
  - test: "(Optional) Chips with keyboard/screen reader and the list at phone width; new editor shows all seven chips on."
    expected: "Chips reachable and announce state; chips wrap and ОТОЗВАТЬ stays visible; new editor has all seven tabs."
    why_human: "Accessibility and phone-width layout cannot be proven by grep or the harness."
    status: deferred
    resolution: "Skipped by the owner as optional; tracked in 12-UAT.md '## Deferred Follow-Ups'. Not a must-have of any success criterion."
---

# Phase PORTIA-12: Права редакторов и безопасность доступа — Verification Report

**Phase Goal:** Владелец решает, какие вкладки доступны каждому редактору, а в редактор пускает только подтверждённая почта; код работает и до, и после SQL, который владелец применяет сам, без риска блокировки
**Verified:** 2026-10-26
**Status:** passed
**Re-verification:** Yes — after commit e0f89ef (CR-01 fix in `app/api/access/route.ts` plus one new source test); human verification item 1 since passed by the owner (12-UAT.md), item 2 deferred; security audit 12-SECURITY.md threats_open 0.

## Re-verification of e0f89ef (CR-01)

Change: `app/api/access/route.ts` now destructures `{ data, error }` from `supabase.auth.getUser()` and returns 503 (`unavailableBody`, no-store) when `isAuthRetryableFetchError(error)`, before `getEditorAccess`. `lib/editor-tabs.test.ts` gains a source-order test (the guard precedes the `getEditorAccess(supabase` call).

- `isAuthRetryableFetchError` is `isAuthError(error) && error.name === 'AuthRetryableFetchError'`; run directly: `(null)`, `(undefined)` and `({name:'AuthSessionMissingError'})` all return `false`. So the anonymous / no-session path is unaffected and falls through to `getEditorAccess(supabase, null)`, which returns `noAccess` (`canEdit:false`, `tabsEnforced:false`) with 200. Truth 3 (unconfirmed/no-session stays noAccess) and truth 5 (anonymous 200 `tabsEnforced:false`) hold.
- `lib/editor-access.ts` is untouched by e0f89ef; its unconfirmed/no-session `noAccess` branch (line 23) and the pending-SQL fallback are unchanged, with tests in `lib/editor-access.test.ts` still green.
- The desktop's `fetchAccess` (`components/portia-desktop.tsx:411-421`) returns early on `!response.ok`, so a 503 keeps the last access state and the open editor/draft: the intended CR-01 behavior; truths 1-5 are untouched.
- Residual: the new test is a source-text order check, not a behavioral test of the 503 path; acceptable for a guard this small (no must-have depends on it).
- `npm test`: 406 pass, 0 fail (405 before + the new test). `npx tsc --noEmit`: clean (exit 0).
- Fingerprint recomputed with the same covered set (including `app/api/access/route.ts`); `covered_digest` copied verbatim from `verification.fingerprint`.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner grants access by email and toggles each of 7 tabs per editor; new/approved editor has all tabs by default | VERIFIED (code; live toggle passed by owner, 12-UAT.md test 1) | `tabRegistry` = 6 editorSections + `employees` (lib/editor-tabs.ts); `openTabIds` regular tabs open unless in `closed_tabs`; SQL columns default `'{}'` (phase12_apply.sql:53-54) so existing and new rows are fully open; `/api/editors` GET/PATCH with `parseTabLists`, owner-only (`requireOwner`), owner self-edit refused; `EditorAccessManager` renders 7 `access-tab-chip` buttons per editor with per-row PATCH queue. Harness `chips` check ok (12-07). Live PATCH under RLS exercised by the owner (12-UAT.md test 1: state kept after reload, editor lost and regained the tab). |
| 2 | Editor does not see closed tabs; server refuses edits to closed sections (content, employees) sent outside the UI | VERIFIED | UI: `stripTabs` filters `tabRegistry` by `openTabs` from `/api/access`, polled every 10 s, no-tab screen (portia-editor.tsx:682-694, 1194). Server: `PUT /api/content` reads stored copy and calls `contentRefusal` for restricted editors (403 `section-closed` / 400 unclassified key / 409 revision); `/api/employees` PATCH/POST/DELETE and `/api/employees/editor` refuse with 403 when `employees` not in `openTabs`; uploads need at least one open tab; RLS on employee tables via `portia_can_edit_tab('employees')`. `info-block:` prefix closes the previous bypass. Tests 405/405 incl. contentRefusal/deniedSections property tests. Accepted risk D-11 (approved editor writing `portia_content` directly through Supabase) is documented in PROJECT.md Known Limitations and 03.1 disposition. |
| 3 | Only confirmed email enters the editor (code works before SQL); owner confirmed «Confirm email», ran preflight, applied SQL in begin/commit, then logged in as owner and editor, saving works | VERIFIED | Code: `getEditorAccess` returns `noAccess` with no rpc when `email_confirmed_at` is missing, owner included; owner-login shows `?error=unconfirmed`. SQL: `phase12_apply.sql` STEP 2 `begin;` with owner-confirmed guard raising an exception before any change, `portia_email_confirmed()` used in `portia_is_owner`/`portia_can_edit`, `commit;`; setup file has the same end state with guard. Live (12-08, owner-reported): STEP 1 preflight, STEP 3 all 9 checks matched, owner `/api/access` returned `tabsEnforced:true` with 7 tabs, owner and editor each saved and undid a change. The accidental STEP 4 run was recovered by re-applying STEP 2/2b; final state is the applied one (confirmed by STEP 3). |
| 4 | `//host/x.png` is not local in code or SQL; CHECK added `not valid`, validated after checking existing rows | VERIFIED | `isLocalMediaPath` (lib/media-url.ts) rejects second `/`, `\`, control chars; used by normalizer, employee sanitize/profile read, editor media field. SQL: constraint `portia_employee_profiles_photo_url_local` `check (... ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') not valid` inside commit, then separate `validate constraint` (STEP 2b) after STEP 1(b) listed offending rows (0). STEP 3 showed constraint validated = true. |
| 5 | Without the SQL all editors have all tabs and the site works as before | VERIFIED | `getEditorAccess` treats only 42703/PGRST204 on the `closed_tabs` select as "not applied": all tabs open, `tabsEnforced:false`; other errors fail closed (503). `/api/editors` GET falls back to a column-less select; PATCH maps 42501/missing column to 503 `pending-database`; chips disabled with one line while `!tabsEnforced`. Anonymous `/api/access` returned 200 `tabsEnforced:false` before SQL (12-08 Task 1). |

**Score:** 5/5 truths verified in code and tests; the live owner-toggle path is now covered by the owner's UAT pass.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| lib/editor-tabs.ts, lib/editor-access.ts | VERIFIED | Substantive, imported by all editor-gated routes (access, content, editors, employees, employees/editor, uploads, owner-login). |
| lib/editor-changes.ts / editor-history.ts | VERIFIED | `deniedSections`, `revertSections`, `restrict` action; used by contentRefusal and editor closure effect. |
| lib/media-url.ts | VERIFIED | Wired into normalizer, employees, editor. |
| app/api/editors/route.ts (GET/PATCH) | VERIFIED | Real Supabase update with full lists, owner only. |
| supabase/phase12_apply.sql, portia_setup.sql | VERIFIED | Applied by owner on live project; STEP 3 matched. |
| components/portia-editor.tsx, portia-desktop.tsx | VERIFIED | Strip follows `openTabs`; chips wired to PATCH; desktop polls `/api/access`. |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| portia-desktop `fetchAccess` | `/api/access` -> `openTabs` prop -> editor strip | WIRED |
| EditorAccessManager chips | PATCH `/api/editors` -> `portia_editors.closed_tabs` | WIRED (live not exercised) |
| PUT `/api/content` | `contentRefusal(baseline, normalized, openTabs)` | WIRED |
| employees routes | `access.openTabs.includes("employees")` | WIRED |
| owner-login actions | `getEditorAccess` -> `?error=unconfirmed` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Whole test suite | `npm test` | 406 pass, 0 fail (re-run after e0f89ef) | PASS |
| Types | `npx tsc --noEmit` | no output | PASS |
| Browser harness (tabs, revert, chips) | 12-editor-check.mjs --check all | Not re-run by verifier (needs server); recorded `ok: true` in 12-08 Task 1 | SKIP (owner/executor evidence) |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SEC-01 | SATISFIED | getEditorAccess gate before any rpc; test "unconfirmed email gets noAccess and makes zero rpc calls" |
| SEC-02 | SATISFIED | phase12_apply.sql guard + begin/commit + `portia_email_confirmed`; owner applied, STEP 3 9/9 |
| CONT-09 | SATISFIED | isLocalMediaPath in code; SQL CHECK not valid then validated |
| PERM-01 | SATISFIED (live toggle passed, 12-UAT.md) | chips + PATCH route |
| PERM-02 | SATISFIED | column default `'{}'`, regular tabs open unless closed |
| PERM-03 | SATISFIED | strip filtered by openTabs, 10 s poll, closure reset |
| PERM-04 | SATISFIED | server refusal on content, employees, uploads; RLS on employee tables |

All 7 requirement IDs appear in 12-08-SUMMARY `requirements-completed` and in REQUIREMENTS.md mapped to Phase 12; no orphans. (REQUIREMENTS.md checkboxes and traceability table still read Pending/unchecked; the orchestrator should tick them on phase completion.)

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX introduced in the covered files. `npm run lint`: only the 2 pre-existing `no-require-imports` errors in PORTIA-06 scripts (unrelated).

### Notes / Residual Risks (not gaps)

- `phase12_apply.sql` STEP 4 (rollback) is runnable in a whole-file run; this already happened once and was recovered. Left as is by decision; any future owner-applied SQL should keep rollback commented out.
- D-11: direct Supabase writes of closed `portia_content` sections by an approved editor are not blocked by RLS; documented accepted risk.
- Pre-SQL owner `/api/access` JSON was not captured; anonymous 200 `tabsEnforced:false` plus the 12-04 preflight stands in.
- The 12-01 unconfirmed-login check with a real unconfirmed mailbox and the 12-06 two-account closure check were never run live; covered by unit tests and the harness, judged not must-have-blocking.

### Human Verification (resolved / deferred)

1. **Live tab toggle end to end** (PERM-01/03/04 on the live DB): RESOLVED, passed by the owner (12-UAT.md test 1).
2. **Chip accessibility and phone-width layout** (optional): DEFERRED follow-up, recorded in 12-UAT.md `## Deferred Follow-Ups`; not tied to any success criterion.

No pending human items. Security audit (12-SECURITY.md): threats_open 0. Code review (12-REVIEW.md / 12-REVIEW-DISPOSITION.md): CR-01 fixed (re-verified above), WR-01/WR-03 accepted, WR-02/WR-04/IN-01/IN-02 deferred, open 0.

### Gaps Summary

No gaps. All five success criteria are implemented, wired and tested; the SQL was applied by the owner and verified by STEP 3; the owner confirmed the live tab toggle; the CR-01 change leaves the anonymous and unconfirmed paths unchanged. Status: `passed`.

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
