---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 08
subsystem: owner-apply-and-review-record
tags: [permissions, sql, owner-check, review-disposition, SEC-01, SEC-02, CONT-09]
requires: ["12-04", "12-07"]
provides:
  - "The owner applied supabase/phase12_apply.sql (STEP 2 and 2b) on the live project; STEP 3 as expected"
  - "03.1 review record: WR-11 and IN-02 fixed with evidence, D-11 accepted risk noted"
affects: []
tech-stack:
  added: []
  patterns: [owner-applied SQL with pasted STEP 3 evidence, review record closed only after the owner's output]
key-files:
  created: []
  modified:
    - .planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md
key-decisions:
  - "STEP 4 (rollback) ran once by accident and was superseded by re-applying STEP 2/2b; the applied state is final, so WR-11 is closed as fixed (G does not hold)"
  - "Pre-SQL owner JSON was not captured; pre-SQL evidence is the anonymous 200 with tabsEnforced false plus the 12-04 preflight"
status: complete
commits: 1
plan_head_before: fdd96a1
plan_head_after: 5bf9dc2718d6a27077dd2ea9680bfe4625b18d56
requirements-completed: [SEC-01, SEC-02, CONT-09, PERM-01, PERM-02, PERM-03, PERM-04]
actuals:
  tokens: 3000
  tasks: 3
  commits: 1
completed: 2026-10-26
---

# Phase 12 Plan 08: Owner applies the SQL and the review record closes Summary

The owner applied the phase-12 SQL to the live Supabase project, STEP 3 matched on all nine checks, the owner and an editor both log in and save, and 03.1 WR-11 and IN-02 are now `fixed` in the review record with their evidence.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Production build green and serving on localhost:3124 | none (verification only, by design) |
| 2 | Owner checks the site, applies the SQL, logs in as owner and editor (checkpoint:human-action) | none (owner action) |
| 3 | Close WR-11 and IN-02 in 03.1-REVIEW-DISPOSITION.md, stop the server | 5bf9dc2 |

## Task 1 results

HEAD fdd96a1. `npm test` 405/405; `tsc` 0; `npm run lint`: only the 2 known pre-existing `no-require-imports` errors in PORTIA-06 `06-check-backup.cjs` / `06-check-disposition.cjs` (plus 18 `<img>` warnings); `npm run build` 0. Server `next start -p 3124 -H 127.0.0.1`. `12-editor-check.mjs --check all` returned `ok: true` (tabs, revert, chips). Anonymous `GET /api/access` answered 200 `{"canEdit":false,"canManageEditors":false,"openTabs":[],"tabsEnforced":false}`.

## Task 2: owner results (project wqiyghssdulzsbshjtur)

- **A (before the SQL):** the owner's `/api/access` JSON was not pasted. Recorded as: owner JSON not captured; anonymous check 200 with `tabsEnforced:false` (Task 1) plus the 12-04 preflight.
- **B:** STEP 1 (a) owner row `confirmed = true` (both editors were confirmed in 12-04). STEP 1 (b): 0 rows, so STEP 2b was needed and ran.
- **C/D, first attempt:** the owner applied STEP 2 and 2b but ran the whole file, so STEP 4 (rollback) ran as well. STEP 3 query 1 then matched everywhere except `photo constraint validated` = NULL (the constraint was dropped by STEP 4, line 311; `portia_is_owner`/`portia_can_edit` and the five employee policies were reverted). Diagnosed from the exact match with STEP 4's effects. No data lost.
- **C/D, second attempt:** the owner selected only lines 37-200 (STEP 2), success; line 205 (STEP 2b), success.
- **E (STEP 3 query 1):** all 9 rows actual = expected: columns 2, functions 4, policy 1, photo constraint validated true, `must_be_false_1..3` false, `must_be_true_1..2` true. Query 2: owner `confirmed = true`. 2b ran, so the constraint is validated.
- **F (after the SQL):** owner `/api/access` = `{"canEdit":true,"canManageEditors":true,"openTabs":["viruses","info","broadcasts","recycle","search","assistant","employees"],"tabsEnforced":true}`. The editor opens after login. The owner and the editor each saved a change and undid it; «СОХРАНЕНО» showed (only when there is a change, as expected).
- **G:** STEP 4 ran once accidentally (see C/D) and was superseded by re-applying STEP 2/2b; the final state is the applied one. WR-11 is not left open for rollback reasons.

## Task 3: what changed in the review record

Edited with a scripted exact-match replace (CRLF kept), six lines changed:

- WR-11: `fixed` in frontmatter and table. Source: 8445b2f, d33c395 (12-01), 783a903, 41513ef (12-04); SEC-01, SEC-02; tests from `lib/editor-access.test.ts` (unconfirmed email) and `lib/portia-sql.test.ts` (STEP 2 guard, setup/apply function parity) with commands; the owner's apply on 2026-10-26, STEP 3 as expected, owner and editor saved; accepted risk D-11 and `portia_editor_is_approved` staying for sign-up.
- IN-02: `fixed`. Source: 68c95f2, cbb8a36 (12-03), 783a903 (12-04); CONT-09; the media-url, normalizer and employees test names with commands; `portia_employee_profiles_photo_url_local` validated (STEP 2b ran).
- IN-10: Source now also says Phase 12 applied 2026-10-26: confirmed email required in `portia_is_owner`/`portia_can_edit`.
- `open:` lowered from 3 to 1 (IN-10-storage remains open).

Verify: `grep -cE "^\| (WR-11|IN-02) \| [a-z]+ \| fixed \|"` prints 2; `grep -c D-11` prints 1 (nonzero).

Server stopped: PID 30152 on 127.0.0.1:3124 terminated; `curl http://localhost:3124/` returns 000 (no answer), no longer 200.

## Lessons for the next owner-applied SQL

- The owner instructions should say plainly: select the lines of one STEP and run only the selection, never the whole file. Running the whole file executed STEP 4 (rollback) after STEP 2/2b.
- `phase12_apply.sql` could put STEP 4 inside a commented-out block so a whole-file run cannot roll back. Not changed now (the SQL file was left as is by decision).
- The owner pasted nothing for A; ask for the JSON in the instructions as a required paste, or accept the anonymous check as the pre-SQL evidence.

## Pending human check (carried from 12-07)

After the SQL: in «Доступ» switch two chips of a real editor, reload and reopen (state kept); grant a new test email (all seven on); Tab and Space on the chips with a screen reader; look at the list at phone width. Not reported by the owner in this plan.

## Deviations from Plan

None in code. Process notes (not deviations): STEP 4 ran by accident and was recovered (above); the A JSON was not captured; the Task 1 server was restarted by the orchestrator with PID 30152 instead of 14104 from 12-07.

## Known Stubs

None.

## Threat Flags

None. No code was added in this plan.

## Self-Check: PASSED

- 03.1-REVIEW-DISPOSITION.md edited; commit 5bf9dc2 is in HEAD (`commits: 1` measured from fdd96a1).
- Acceptance greps: fixed rows 2, D-11 count 1, server down (curl 000).
