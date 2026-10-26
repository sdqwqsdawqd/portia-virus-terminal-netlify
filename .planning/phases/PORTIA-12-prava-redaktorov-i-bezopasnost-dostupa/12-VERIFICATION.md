---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
verified: 2026-10-26T12:00:00Z
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
covered_digest: "v3:sha256:14cfe14b1d53c699ccd26792e7a52b5ce2f9fc0c2e1f6f895274683027f5437c"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Live tab toggle end to end on project wqiyghssdulzsbshjtur: as owner open «Доступ», switch off one tab (e.g. «Сводка») for the real editor, reload and reopen «Доступ» (state kept); then in the editor's session confirm the tab disappears within ~10 s and a hand-made PUT /api/content (or a save) touching that section answers 403; switch it back on."
    expected: "Chip state persists after reload; the editor strip no longer shows the closed tab; the closed-section write is refused with 403 «section-closed»; re-enabling restores it."
    why_human: "PATCH /api/editors under the real UPDATE policy and grant (column grant, 'Owner can change editor tabs') has never run against the live database: 12-07 and 12-06 checks used a stubbed API in a browser harness, and 12-08 only recorded login + save for owner and editor. STEP 3 proves the policy and columns exist, not that the PATCH succeeds under RLS."
  - test: "(Minor, optional) Chips with keyboard/screen reader (Tab, Space; pressed/not pressed announced) and the list at phone width; grant a new test email and confirm all seven chips are on."
    expected: "Chips are reachable and announce state; chips wrap and ОТОЗВАТЬ stays visible; new editor has all seven tabs."
    why_human: "Accessibility and phone-width layout cannot be proven by grep or the harness; carried from 12-07 and 12-08, not reported by the owner."
---

# Phase PORTIA-12: Права редакторов и безопасность доступа — Verification Report

**Phase Goal:** Владелец решает, какие вкладки доступны каждому редактору, а в редактор пускает только подтверждённая почта; код работает и до, и после SQL, который владелец применяет сам, без риска блокировки
**Verified:** 2026-10-26
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner grants access by email and toggles each of 7 tabs per editor; new/approved editor has all tabs by default | VERIFIED (code); live toggle in human_verification | `tabRegistry` = 6 editorSections + `employees` (lib/editor-tabs.ts); `openTabIds` regular tabs open unless in `closed_tabs`; SQL columns default `'{}'` (phase12_apply.sql:53-54) so existing and new rows are fully open; `/api/editors` GET/PATCH with `parseTabLists`, owner-only (`requireOwner`), owner self-edit refused; `EditorAccessManager` renders 7 `access-tab-chip` buttons per editor with per-row PATCH queue. Harness `chips` check ok (12-07). Live PATCH under RLS not run. |
| 2 | Editor does not see closed tabs; server refuses edits to closed sections (content, employees) sent outside the UI | VERIFIED | UI: `stripTabs` filters `tabRegistry` by `openTabs` from `/api/access`, polled every 10 s, no-tab screen (portia-editor.tsx:682-694, 1194). Server: `PUT /api/content` reads stored copy and calls `contentRefusal` for restricted editors (403 `section-closed` / 400 unclassified key / 409 revision); `/api/employees` PATCH/POST/DELETE and `/api/employees/editor` refuse with 403 when `employees` not in `openTabs`; uploads need at least one open tab; RLS on employee tables via `portia_can_edit_tab('employees')`. `info-block:` prefix closes the previous bypass. Tests 405/405 incl. contentRefusal/deniedSections property tests. Accepted risk D-11 (approved editor writing `portia_content` directly through Supabase) is documented in PROJECT.md Known Limitations and 03.1 disposition. |
| 3 | Only confirmed email enters the editor (code works before SQL); owner confirmed «Confirm email», ran preflight, applied SQL in begin/commit, then logged in as owner and editor, saving works | VERIFIED | Code: `getEditorAccess` returns `noAccess` with no rpc when `email_confirmed_at` is missing, owner included; owner-login shows `?error=unconfirmed`. SQL: `phase12_apply.sql` STEP 2 `begin;` with owner-confirmed guard raising an exception before any change, `portia_email_confirmed()` used in `portia_is_owner`/`portia_can_edit`, `commit;`; setup file has the same end state with guard. Live (12-08, owner-reported): STEP 1 preflight, STEP 3 all 9 checks matched, owner `/api/access` returned `tabsEnforced:true` with 7 tabs, owner and editor each saved and undid a change. The accidental STEP 4 run was recovered by re-applying STEP 2/2b; final state is the applied one (confirmed by STEP 3). |
| 4 | `//host/x.png` is not local in code or SQL; CHECK added `not valid`, validated after checking existing rows | VERIFIED | `isLocalMediaPath` (lib/media-url.ts) rejects second `/`, `\`, control chars; used by normalizer, employee sanitize/profile read, editor media field. SQL: constraint `portia_employee_profiles_photo_url_local` `check (... ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') not valid` inside commit, then separate `validate constraint` (STEP 2b) after STEP 1(b) listed offending rows (0). STEP 3 showed constraint validated = true. |
| 5 | Without the SQL all editors have all tabs and the site works as before | VERIFIED | `getEditorAccess` treats only 42703/PGRST204 on the `closed_tabs` select as "not applied": all tabs open, `tabsEnforced:false`; other errors fail closed (503). `/api/editors` GET falls back to a column-less select; PATCH maps 42501/missing column to 503 `pending-database`; chips disabled with one line while `!tabsEnforced`. Anonymous `/api/access` returned 200 `tabsEnforced:false` before SQL (12-08 Task 1). |

**Score:** 5/5 truths verified in code and tests; one live path (owner toggling a real editor's tab under RLS) is not covered by any recorded evidence.

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
| Whole test suite | `npm test` | 405 pass, 0 fail | PASS |
| Types | `npx tsc --noEmit` | no output | PASS |
| Browser harness (tabs, revert, chips) | 12-editor-check.mjs --check all | Not re-run by verifier (needs server); recorded `ok: true` in 12-08 Task 1 | SKIP (owner/executor evidence) |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SEC-01 | SATISFIED | getEditorAccess gate before any rpc; test "unconfirmed email gets noAccess and makes zero rpc calls" |
| SEC-02 | SATISFIED | phase12_apply.sql guard + begin/commit + `portia_email_confirmed`; owner applied, STEP 3 9/9 |
| CONT-09 | SATISFIED | isLocalMediaPath in code; SQL CHECK not valid then validated |
| PERM-01 | SATISFIED in code; live toggle in human_verification | chips + PATCH route |
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

### Human Verification Required

1. **Live tab toggle end to end** (PERM-01/03/04 on the live DB): see frontmatter. Reason: PATCH under the real RLS UPDATE policy and column grant has no live evidence.
2. **Chip accessibility and phone-width layout** (optional): Tab/Space with screen reader, list at phone width, new test email shows all seven on.

### Gaps Summary

No gaps. All five success criteria are implemented, wired and tested; the SQL was applied by the owner and verified by STEP 3. Status is `human_needed` only because the central owner feature (toggling a real editor's tabs against the live database) has not been exercised outside a stubbed harness.

---

_Verified: 2026-10-26_
_Verifier: Claude (gsd-verifier)_
