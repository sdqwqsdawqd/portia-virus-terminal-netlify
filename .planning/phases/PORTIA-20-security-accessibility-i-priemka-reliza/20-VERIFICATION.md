---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
verified: 2026-11-04T18:45:00Z
status: gaps_found
score: 2/12 roadmap success criteria fully verified (7 partial: code present, live/owner/device proof missing; 3 not delivered)
covered_files:
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-01-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-01-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-02-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-02-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-03-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-03-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-04-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-04-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-05-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-05-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-06-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-06-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-07-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-07-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-08-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-08-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-09-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-09-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-10-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-10-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-11-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-12-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-13-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-14-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-15-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-16-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-16-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-17-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-17-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-18-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-18-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-19-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-19-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-20-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-20-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-21-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-21-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-22-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-22-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-23-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-23-SUMMARY.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-24-PLAN.md"
  - ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-24-SUMMARY.md"
  - "app/api/content/notes/route.ts"
  - "app/portia.css"
  - "components/portia-promotion.tsx"
  - "components/portia-template-builder.tsx"
  - "components/portia-wallpaper-spider.tsx"
  - "components/portia-wallpaper.tsx"
  - "lib/phase20-visual-approval.test.ts"
  - "lib/portia-template-export.ts"
  - "next.config.ts"
  - "scripts/phase20-audit-check.mjs"
  - "supabase/migrations/20261104000000_portia_rename_virus_classes.sql"
  - "supabase/migrations/20261104000100_portia_editor_notes.sql"
covered_digest: "v4:sha256:3cc8babd744db6b32673079e89f8837f14a8ce90d36960e8faf291fd9caaab9e"
behavior_unverified: 2
overrides_applied: 0
re_verification: false
gaps:
  - truth: "SC6 / STAB-REL-01, REL-02, REL-03: from a clean checkout on the release commit tests, typecheck, build, full lint, production audit, Playwright (retries=0), approved visuals, axe, keyboard journeys and zero-unexpected-console pass reproducibly (plan 20-13)"
    status: failed
    reason: "Plan 20-13 was never executed. scripts/phase20-release-gate.mjs, lib/phase20-release-gate.test.ts and 20-RELEASE-EVIDENCE.md do not exist (verified by ls). No commit-bound gate ledger exists."
    artifacts:
      - path: "scripts/phase20-release-gate.mjs"
        issue: "missing"
      - path: "lib/phase20-release-gate.test.ts"
        issue: "missing"
      - path: ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-EVIDENCE.md"
        issue: "missing"
    missing:
      - "Write the fail-closed release-gate runner and its unit test (skip/retry-pass/BLOCKED/high-blocker accounting) - closable by code work now, independent of the owner"
      - "Run it from a clean checkout of the final release commit LAST (after 20-12 and fixes), record commit, Node version, target attestation, exit codes"
      - "Include the D-35..D-47 rows (class migration receipt or BLOCKED, editor-notes receipt or BLOCKED, production rows 'ОЖИДАЕТ ВЛАДЕЛЬЦА')"
  - truth: "SC6 / STAB-REL-02: Playwright suite passes with retries=0 without masking flaky results"
    status: failed
    reason: "deferred-items.md records a pre-existing flaky failure: media-states.spec.ts '[STAB-MEDIA-03] a portrait that never answers gives up after 15s' fails on webkit-phone in a full-file run (passes alone). It also records diagnostics noise in app-states.spec.ts:227/:204 and media-offscreen.spec.ts:54 (zero-unexpected-console policy). No fix or waiver exists."
    artifacts:
      - path: "tests/e2e/specs/media-states.spec.ts"
        issue: "webkit-phone order-dependent failure"
      - path: "tests/e2e/specs/app-states.spec.ts"
        issue: "unexpected requestfailed/console diagnostics on intentionally broken external requests"
    missing:
      - "Fix the order dependence or record an owner-accepted waiver; classify the three diagnostics-noise cases (expected-failure allowlist vs fix) before the release gate can be strict"
  - truth: "SC10 / STAB-VIS-01..03, STAB-REL-03, REL-08: approved visual baselines for spider/web, flask wallpaper, two empty-state SVGs, class icons, Promotion participant/reviewer exist as tracked PC/phone baselines (plan 20-12)"
    status: failed
    reason: "Plan 20-12 not executed: tests/e2e/visual/phase20.spec.ts and all twelve phase20-*--chromium-*.png baselines are absent (ls tests/e2e/visual/__screenshots__ shows none). This is correct fail-closed behaviour while the owner has not approved the candidates (20-VISUAL-APPROVAL.md status: awaiting-owner-verdict, no row approved) - but the success criterion is unmet."
    artifacts:
      - path: "tests/e2e/visual/phase20.spec.ts"
        issue: "missing"
      - path: "tests/e2e/visual/__screenshots__/phase20-*"
        issue: "missing (12 files)"
    missing:
      - "Owner verdict per row in 20-VISUAL-APPROVAL.md (see human_verification #1) - OWNER-GATED"
      - "Then execute 20-12 promoting only exact approved hashes; rejected rows go back to 20-03/04/05/06/20 for redraw"
  - truth: "SC7 / SC8 / STAB-REL-05, REL-06, REL-07: physical PC/phone owner UAT with per-device commit binding (plan 20-14)"
    status: failed
    reason: "Plan 20-14 not executed: 20-UAT.md and lib/phase20-uat.test.ts do not exist. The checklist ledger and fail-closed validator are code/doc work that does not need the owner; the verdicts do."
    artifacts:
      - path: ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md"
        issue: "missing"
      - path: "lib/phase20-uat.test.ts"
        issue: "missing"
    missing:
      - "Build 20-UAT.md checklist (INFO-PHONE-01..05, INFO-PC-01, SPIDER-01..03, CLASS-01..03, SEARCH-01/02, EDITOR-01/02, REG-01..07, template PNG/HTML, media/CSP) with per-step device and commit columns, plus the validator test - closable now"
      - "Owner executes it on physical PC then phone - OWNER-GATED, must stay BLOCKED until then"
  - truth: "SC8 / SC9 / STAB-SEC-06, REL-07, REL-08: release notes, reconciliation, release summary/verification and deployed evidence describe one final release commit and honestly list accepted risks, waivers, spoofable initial mode and device binding without hardware attestation (plan 20-15)"
    status: failed
    reason: "Plan 20-15 not executed: 20-RECONCILIATION.md, 20-RELEASE-NOTES.md, 20-RELEASE-SUMMARY.md, 20-RELEASE-VERIFICATION.md, 20-DEPLOYED-EVIDENCE.md and the verify-reconciliation mode of the gate script do not exist. STAB-SEC-06 therefore has no artifact at all. 20-SECURITY-MATRIX.md lines 54+ already hold the medium/accepted-risk text intended as input."
    artifacts:
      - path: ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-NOTES.md"
        issue: "missing"
      - path: ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RECONCILIATION.md"
        issue: "missing"
    missing:
      - "Draft 20-RELEASE-NOTES.md now from 20-SECURITY-MATRIX.md, 20-DEPENDENCY-AUDIT.md, 20-CLASS-MIGRATION-EVIDENCE.md, 20-EDITOR-NOTES-EVIDENCE.md (STAB-SEC-06) - closable by doc work"
      - "Reconciliation/crosswalk/deployed evidence must wait for the final commit and owner UAT"
  - truth: "SC5 / STAB-SEC-05: local security matrix covers auth/API/RLS/headers/CSP/uploads/secrets/dependencies of the release"
    status: partial
    reason: "20-SECURITY-MATRIX.md was built at commit f25b885 (HEAD before 20-10) and covers 10 routes. Later work added app/api/content/notes/route.ts, table portia_editor_notes with RLS (20-24), the class-rename migration (20-21), new outline/content models (20-22/23), and out-of-plan quick-task commits (97d7abb removed the insufficient-pool 409 checks from app/api/promotion/banks/route.ts; 23c1c85 changed Promotion editor/desktop). grep of the matrix for 'notes|editor_notes|20-24' finds nothing relevant. 20-24 has only its own static review (PASS-WITH-NOTES, LOW findings accepted). REQUIREMENTS.md nevertheless marks STAB-SEC-05 Complete."
    artifacts:
      - path: ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-SECURITY-MATRIX.md"
        issue: "stale: no row for /api/content/notes, portia_editor_notes, class migration, banks-route change"
    missing:
      - "Refresh the matrix and its structure test against the release commit (add the 11th route and the new table/policies); re-run scripts/phase20-audit-check.mjs --capture if lockfile moved"
      - "Re-open STAB-SEC-05 in REQUIREMENTS.md until the refreshed matrix lands"
  - truth: "Requirements ledger honesty: STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07 are marked Complete in REQUIREMENTS.md"
    status: partial
    reason: "20-07-SUMMARY says the A11Y-01/03 mark set by 20-17 is 'partially evidenced': role-gated surfaces, content-editor dialogs, drag handles, live qualification dialog trap/focus restore are BLOCKED (ENV); screen-reader output and serious axe color-contrast defects (ledger q-contrast-d10) are unproven. 20-22/23 say A11Y-01 needs live editor proof. For STAB-MEDIA-07, 20-08 records zero-report-only result for YouTube blocks, GIF hosts and Roblox avatars as BLOCKED (DATA) and Phase 19 CR-01 as open; the requirement text demands approved images/YouTube keep working."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "lines 88/92/94 ([x]) and traceability rows say Complete where SUMMARYs say partial/BLOCKED"
    missing:
      - "Downgrade to Pending (or annotate with explicit BLOCKED sub-items) until 20-14 / staging proof; do not let the final reconciliation (20-15) inherit the over-marking"
  - truth: "Evidence freshness: candidate frames, 20-07 axe/touch results and the 20-11 ledger hashes describe the Promotion reviewer/participant surface"
    status: partial
    reason: "After 20-06/20-07 evidence and after the 20-11 ledger commit (b1d2499, 15:07), out-of-plan commits changed Promotion code: 97d7abb + 2f54ba9 (reorganized reviewer workspace, +125 CSS lines, banks route), 23c1c85 (mobile viewport, Promotion editor controls, portia-desktop.tsx, qualification editor), 7e5e17a. Candidate PNGs, E4/E5 BLOCKED rows and axe results recorded earlier may no longer match HEAD 40dbf9b; owner would approve stale hashes."
    artifacts:
      - path: ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md"
        issue: "Promotion participant/reviewer rows predate commits 97d7abb/23c1c85"
    missing:
      - "Re-capture Promotion candidates (and re-run accessibility.spec.ts Promotion lanes) on the current HEAD and refresh ledger hashes BEFORE asking the owner for verdicts"
  - truth: "STAB-REL-01 full lint passes"
    status: partial
    reason: "Verifier ran `npm run lint`: exit 1, 62 problems (32 errors, 30 warnings). Every error is in git-ignored local tooling (.agents/skills, .claude/skills, .claude/worktrees/read-notes-memory-297453); zero errors in tracked product code (warnings only: no-img-element, one unused var, one exhaustive-deps). eslint.config.mjs ignores only .next, out and .planning, so a workstation with these folders cannot get a green `npm run lint`. A clean checkout would not contain them, but the gate must prove that rather than assume it."
    artifacts:
      - path: "eslint.config.mjs"
        issue: "does not ignore .agents/**, .claude/** (untracked tooling)"
    missing:
      - "Either add those paths to globalIgnores in a separate small change or make the 20-13 runner execute lint only inside the clean checkout and record that in the evidence"
human_verification:
  - test: "Owner verdict on every candidate row of 20-VISUAL-APPROVAL.md (spider on 3 accents, spider-off, spider-rest-sharp, flask wallpaper, flask/microscope SVGs, 9 class icons, Promotion participant/reviewer) plus the owner questions (q-contrast-d10, q-rel-08, others)"
    expected: "Each row 'принято' with date and exact SHA256, or 'исправить: ...'; then `PORTIA_REQUIRE_APPROVAL=1 node --experimental-strip-types --test lib/phase20-visual-approval.test.ts` passes"
    why_human: "Aesthetic approval (STAB-VIS-01..04, STAB-REL-08, D-19); automation cannot substitute. Plan 20-11 Task 2 (checkpoint) is not done."
  - test: "Full physical-device UAT on real PC then real phone after clean reload (Promotion, window bounds, qualification lock, PNG spider, web, shortcuts, Vivian, search, editor layout, template PNG/HTML, media/CSP, Информация on phone)"
    expected: "Per-step PASS/FAIL/BLOCKED with device and the exact commit tested; PC and phone commits recorded separately (D-15/D-16)"
    why_human: "STAB-REL-05/06/07, STAB-A11Y-02/04 and the phone/touch/keyboard-overlap claims have only emulated-device evidence"
  - test: "Isolated staging: owner confirms staging is free, then apply supabase/migrations/20261104000100_portia_editor_notes.sql (and the class rename 20261104000000 receipt is already in 20-CLASS-MIGRATION-EVIDENCE.md) and run editor-layout.spec.ts, editor-notes.spec.ts in the mutation lane"
    expected: "Notes save/read no-store, visitor and public key see nothing, closed tab refused, stale revision 409; columns of five, pinned add bar, one-column phone with no overflow, cross-column ArrowUp/ArrowDown and pointer drag as one undo step"
    why_human: "BLOCKED (OWNER)/(ENV): owner answered 'not sure / busy' (20-24), so STAB-EDIT-01..04 have offline proof only. Not closable by code work"
  - test: "Reviewer role and real roster data on staging (19-21 prerequisite): Promotion reviewer queue/detail/409/denied/bank frames and real-nickname status body"
    expected: "E4/E5 frames captured, not mocked; staging-authz cases for real nickname recorded"
    why_human: "BLOCKED (ENV)/(DATA): needs reviewer identity and seeded roster (Phase 19 gap-closure 19-21/19-22)"
  - test: "Production application of both migrations by the owner and CSP enforcement decision (D-05) with published HTTPS/HSTS check"
    expected: "Owner-recorded date and method for each migration (status stays 'ОЖИДАЕТ ВЛАДЕЛЬЦА' until then); decision whether the report-only candidate may become enforced; read-only deployed-header metadata or explicit BLOCKED"
    why_human: "Production actions are owner-only (CLAUDE.md hard rules); LAN HTTP cannot prove published HTTPS/HSTS (D-14)"
behavior_unverified_items:
  - truth: "Qualification dialog traps focus, sets the rest of the desktop inert and restores focus to the opener (STAB-A11Y-01)"
    test: "Start a qualification run as a staging participant, Tab through and close/finish"
    expected: "Focus stays inside; shortcuts/taskbar not tabbable; focus returns to the opener or Promotion heading"
    why_human: "Offline source test shows the wiring of `inert`; no browser run (needs a participant session, BLOCKED (ENV))"
  - truth: "Keyboard move of a section card across a column border keeps focus on the handle and is one undo step (STAB-EDIT-03)"
    test: "In the real editor press ArrowDown on a handle at a column border; then undo"
    expected: "Card lands in the next column, focus stays on the handle, one undo restores it"
    why_human: "Only layout/pure functions are tested; the React remount/focus behaviour was never run (20-22/20-23 'Not exercised in a browser at all')"
---

# Phase 20: Security, accessibility и приёмка релиза - Verification Report

**Phase Goal:** owner-approved redesign (spider/web, wallpaper, SVG, editor tab, Promotion) with a local template builder; accessibility/security/dependency risks closed or honestly recorded; release commit passes a clean rehearsal; per-device owner PC/phone acceptance bound to the tested commit.
**Verified:** 2026-11-04 (HEAD 40dbf9b)
**Status:** gaps_found
**Re-verification:** No - initial verification, requested ahead of phase completion as a gap source for `/gsd-plan-phase 20 --gaps`.

## Summary

19 of 24 plans were executed and the code they deliver exists and is wired. Plans 20-11 (Task 2 only), 20-12, 20-13, 20-14 and 20-15 - the owner-approval, baseline, clean-rehearsal, physical-UAT and reconciliation chain - are not delivered, and their artifacts are absent from the tree. The missing 20-13/20-14/20-15 artifacts (release-gate runner, UAT ledger and validator, release notes) are partly closable by code/doc work now; the verdicts and device runs are owner-gated. The goal is not achieved yet, and cannot be achieved without the owner.

Verifier-run checks (not taken from SUMMARY):
- `npm test`: 1332 tests, 1328 pass, 0 fail, 4 skipped.
- `tsc --noEmit`: exit 0.
- `npm audit --omit=dev`: 0 vulnerabilities. `node scripts/phase20-audit-check.mjs --verify`: "dependency audit evidence verified".
- `node --experimental-strip-types --test lib/phase20-visual-approval.test.ts`: structure passes; owner-verdict suite skipped (no verdicts).
- `npm run lint`: exit 1, 32 errors, all in git-ignored tooling folders; see gap above.
- Playwright and `npm run build` were NOT re-run by the verifier (need a built server / staging env; the release gate in 20-13 is the right place).

## Goal Achievement - Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | PC controls name/role/state/focus/trap; phone touch, no overlap/overflow | PRESENT_BEHAVIOR_UNVERIFIED | 20-07 axe-clean on Chromium/Firefox/WebKit emulated lanes for visitor-reachable surfaces; role-gated surfaces, live dialog trap and physical phone are BLOCKED (ENV)/pending 20-14 |
| 2 | Russian labels/announcements; alt; off/reduced stops looping motion everywhere | PRESENT_BEHAVIOR_UNVERIFIED | Static check: all 13 `infinite` animations in app/portia.css are under `html[data-motion="full"]`; spider rAF loop gated by `motionOn()` (components/portia-wallpaper-spider.tsx:251-282). Physical-device frames (SPIDER-03) and screen-reader output not proven |
| 3 | Participant network/UI free of answer keys, internal notes, reviewer identity; no-store | VERIFIED (with BLOCKED(DATA) sub-case) | 20-09 projection tests + staging-authz; unit suite green. Real-nickname status body and qualification attempt body on staging remain BLOCKED (DATA) |
| 4 | Media hosts inventoried; CSP report-only before enforcement; fallback | PARTIAL | next.config.ts has enforced CSP + stricter Report-Only candidate + frame/nosniff/referrer/permissions/COOP/HSTS headers. Zero-report for YouTube/GIF/Roblox hosts BLOCKED (DATA); CR-01 open; enforcement deliberately not turned on |
| 5 | Security matrix; high fixed/accepted; prod audit clean; dev disposition | PARTIAL | prod audit 0 findings (re-run), dev disposition table present, 0 unfixed high. Matrix stale vs later routes/tables (gap) |
| 6 | Clean-checkout reproducible gates, retries=0 | FAILED | 20-13 not executed; flaky webkit-phone case unresolved |
| 7 | Owner accepts on physical PC/phone | FAILED (OWNER) | 20-14 not executed |
| 8 | Docs/UAT bound to final commit; per-device commits | FAILED | 20-14/20-15 artifacts absent |
| 9 | Release notes list spoofable mode, device binding limits, waivers | FAILED | no release notes; STAB-SEC-06 without artifact |
| 10 | Dark palette kept; spider/web, 2 SVG, flask wallpaper owner-approved | PARTIAL (OWNER) | Spider (portia-wallpaper-spider.tsx), flask wallpaper (portia-wallpaper.tsx, flask keyframes in portia.css), SVGs and class icons exist; ledger lists candidates with hashes; no row approved; no baselines |
| 11 | Editor tab and Promotion redesigned, flow preserved, accepted | PARTIAL (OWNER) | 20-06 participant/reviewer redesign and 20-22/23 editor layout exist with offline tests; reviewer/live frames BLOCKED; no owner acceptance |
| 12 | "Создать шаблон" opens a standalone builder; PNG/HTML download; nothing written to DB/uploads | VERIFIED | components/portia-template-builder.tsx (260 lines) and lib/portia-template-export.ts (503 lines): grep for fetch/supabase//api//XMLHttpRequest/sendBeacon finds none; export via Blob + object URL, HTML carries `default-src 'none'` CSP and no scripts, PNG via canvas.toBlob with empty-blob rejection; entry button rendered in components/portia-promotion.tsx:313 and builder mounted at :493; unit tests pass |

## Plan Must-Haves for the Unexecuted Plans (checked against the tree)

| Plan | Must-have artifact | Present? |
|------|--------------------|----------|
| 20-11 | 20-VISUAL-APPROVAL.md ledger + lib/phase20-visual-approval.test.ts | Yes (Task 1 done: 9 class-icon rows, spider accent/off/rest rows, hashes); Task 2 owner verdict NOT done |
| 20-12 | tests/e2e/visual/phase20.spec.ts + 12 baselines | No |
| 20-13 | scripts/phase20-release-gate.mjs, lib/phase20-release-gate.test.ts, 20-RELEASE-EVIDENCE.md | No |
| 20-14 | 20-UAT.md, lib/phase20-uat.test.ts | No |
| 20-15 | 20-RECONCILIATION.md, 20-RELEASE-NOTES.md, 20-RELEASE-SUMMARY.md, 20-RELEASE-VERIFICATION.md, 20-DEPLOYED-EVIDENCE.md | No |

## Requirements Coverage (all 32 IDs from the phase header)

All 32 IDs are present in REQUIREMENTS.md with a traceability row to Phase 20; none are orphaned and none are missing from the roadmap. Status below is the verifier's, which differs from the ledger where noted.

| Requirement | Ledger | Verifier status | Evidence / blocker |
|---|---|---|---|
| STAB-TMPL-01 | Complete | SATISFIED | Builder verified above; e2e template-builder.spec.ts exists |
| STAB-SEC-02 | Complete | SATISFIED (BLOCKED(DATA) live sub-case noted) | 20-09 |
| STAB-SEARCH-05/06/07 | Complete | SATISFIED | 20-19, unit suite green, search-global-keys.spec.ts exists |
| STAB-CLASS-01/02/04 | Complete | SATISFIED (code); live text owner-checked in UAT CLASS-03 | 20-20, unit tests |
| STAB-CLASS-03 | Complete | SATISFIED as scoped (reviewed migration, staging receipt, production "ОЖИДАЕТ ВЛАДЕЛЬЦА") | 20-21, 20-CLASS-MIGRATION-EVIDENCE.md |
| STAB-MEDIA-07 | Complete | PARTIAL - over-marked | BLOCKED(DATA) hosts, CR-01 open |
| STAB-A11Y-01 | Complete | PARTIAL - over-marked | 20-07 says "partially evidenced" |
| STAB-A11Y-03 | Complete | PARTIAL - over-marked | contrast defects / screen reader unproven |
| STAB-SEC-05 | Complete | PARTIAL - over-marked | matrix stale (gap) |
| STAB-A11Y-02 | Pending | NOT SATISFIED | emulated only; physical + BLOCKED(DATA)/(ENV) |
| STAB-A11Y-04 | Pending | PARTIAL | static gating verified; physical evidence missing |
| STAB-SEC-03 | Pending | PARTIAL | headers present; D-05 owner acceptance and published HTTPS/HSTS missing |
| STAB-SEC-06 | Pending | NOT SATISFIED | no release notes |
| STAB-VIS-01..04 | Pending | NOT SATISFIED (OWNER) | candidates exist, no verdicts/baselines |
| STAB-REL-01/02/03 | Pending | NOT SATISFIED | 20-13/20-12 missing |
| STAB-REL-05/06/07/08 | Pending | NOT SATISFIED | 20-14/20-15/20-11 Task 2 missing |
| STAB-EDIT-01..04 | Pending | NOT SATISFIED (ENV/OWNER) | offline logic only; staging push not authorized |

## Anti-Patterns

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| tracked product code | No TBD/FIXME/XXX debt markers found in the files covered above | none | - |
| eslint.config.mjs | does not ignore untracked tooling dirs | Warning | local `npm run lint` exit 1 (see gap) |
| app/api/promotion/banks/route.ts (97d7abb) | pool-sufficiency 409 on save removed outside any Phase 20 plan | Warning | behaviour change not in matrix or evidence; sufficiency now enforced only at preview build |

## Honest Classification of BLOCKED Items

- Closable by code/doc work (in gaps): release-gate runner, UAT ledger+validator, release-notes draft, matrix refresh, requirement-ledger correction, evidence re-capture after drift, lint-ignore decision, flaky webkit-phone case.
- Needs owner or real device/environment (in human_verification): visual verdicts, physical UAT, staging free/push for editor notes, reviewer identity and roster, production migrations, CSP enforcement decision.
- Not to be counted as PASS anywhere: all `BLOCKED (ENV)`/`(DATA)`/`(OWNER)` rows in 20-05, 20-06, 20-07, 20-09, 20-16, 20-22, 20-23, 20-24.

## Gaps Summary

Suggested closure-plan grouping for `/gsd-plan-phase 20 --gaps`:
1. Doc/ledger corrections (no owner): re-open over-marked requirements; refresh 20-SECURITY-MATRIX.md; draft 20-RELEASE-NOTES.md.
2. Tooling: 20-13 runner + test, 20-14 UAT ledger + validator, lint-ignore decision, webkit-phone flake fix or waiver.
3. Evidence refresh: re-capture Promotion candidates/axe on current HEAD, update 20-VISUAL-APPROVAL.md hashes.
4. Owner-gated tail (keep plans 20-11 Task 2, 20-12, 20-14 run, 20-15 as is): owner verdicts, baselines, physical UAT, reconciliation, final-commit gates.

---

_Verified: 2026-11-04_
_Verifier: Claude (gsd-verifier)_
