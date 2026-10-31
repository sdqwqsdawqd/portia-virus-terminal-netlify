---
phase: 15-baseline
verified: 2026-11-01T00:00:00Z
status: gaps_found
score: 1/4 must-haves verified
requirements_satisfied: [STAB-BASE-01, STAB-BASE-05]
requirements_blocked: [STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
verified_commit: 348684a5f408bf664b05b2395e57b84072c14291
supersedes: 2026-10-30 report (Figma / managed-scan wording, 23-image baseline)
deferred:
  - item: Physical owner PC and phone UAT
    phase: 22
  - item: Isolated Supabase, authenticated role proof, RLS/RPC execution
    phase: 16 / 19
  - item: Motion replacement for 18 rejected candidates
    phase: 18
---

# Phase 15: Baseline Verification Report

**Phase Goal:** Текущий PORTIA OS зафиксирован как воспроизводимый и одобренный контракт до любых рефакторингов или точечных исправлений.  
**Verified:** 2026-11-01 at `348684a`, disposable clean checkout, Node 22.13.1  
**Status:** `gaps_found` — only for concrete unproven role, data, visual and physical-device evidence.

No external design service or managed scanner is a prerequisite of this phase.
The 2026-10-30 report (Figma, managed-scan blockers) is superseded; its provenance
stays in git history. Full numbers: `evidence/15-BASELINE-RESULTS.md`.

## Goal Achievement

The ROADMAP success criteria are the controlling must-haves.

| # | Truth | Status | Evidence |
|---:|---|---|---|
| 1 | Owner can compare repository-owned desktop and phone captures with the current site and explicitly approve the UI/motion contract; proposed changes are marked separately | ✗ **PARTIAL / GAP** | `Qloxz` issued a verdict for all 51 captured hashes: 33 APPROVED, 18 REJECTED (shortcut, spider and web-wave motion, owned by Phase 18). 33 further states (privileged actors, representative phone/DPR, semantic states) are typed BLOCKED. Contract digest, candidate set and source commit agree across all four ledgers (Plan 15-13). |
| 2 | A clean checkout runs the committed Playwright/Axe suite for visitor, participant, editor, promo reviewer and owner on PC/phone, with fixed data/time/DPR/fonts/randomness and no production mutation | ✗ **PARTIAL / GAP** | Clean checkout installs and runs: 63 pass, 77 explicit skips, 0 flaky; accessibility 10/10, diagnostics 15/15. 20 participant/editor/reviewer/owner tests are `BLOCKED` (no isolated target). 15 data-backed tests fail only because no read backing was supplied (`ENOTFOUND`); recorded as BLOCKED (DATA), not as passes. No production mutation. |
| 3 | Approved visual baselines reproduce desktop, windows, Promotion, editor, spider, web, Vivian and phone layout | ✗ **PARTIAL / GAP** | 33 exact approved bytes verified (`--verify-promotion`, both trees); 11 approved comparisons pass in the clean checkout, 10 pixel comparisons need a read backing and were not reproduced there; spider/web motion rejected; phone/DPR/privileged rows BLOCKED. |
| 4 | Unexpected browser/console/network/CSP failures block the gate, expected refusals show a safe Russian state, and every next phase has a full GSD evidence chain | ✓ **VERIFIED** | Six diagnostic classes fail through the redacted path (15/15); 0 critical/serious Axe findings; exact owned/expiring Promotion 404 allowance; local security review `15-SECURITY.md` PASS for repository-local scope (0 critical, 0 high unresolved); `evidence/15-TRACEABILITY.md` maps all six requirement IDs. |

**Score:** 1/4 truths verified

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `evidence/15-CURRENT-STATE-LEDGER.md`, `15-DIRTY-OWNERSHIP.md`, `15-ENVIRONMENT.md` | Immutable control baseline | ✓ VERIFIED | Plan 15-01 artifacts present. |
| `playwright.config.ts`, fixtures, preflight | Bounded deterministic runner | ✓ VERIFIED | Fail-closed preflight runs in the clean checkout; target guard keeps mutation lanes blocked. |
| `tests/e2e/visual/__screenshots__/` | Approved exact bytes | ✓ VERIFIED | 33 PNGs; all hashes match the signed ledger; 0 unapproved PNGs. |
| `evidence/15-VISUAL-APPROVAL.md`, `15-LOCAL-UI-CONTRACT.md`, `15-FRAME-TEST-MAP.md`, `15-STABLE-ROW-INVENTORY.json` | Per-hash verdicts and bound authority | ✓ VERIFIED | Candidate set `phase15-current-efbc1401080d`, source `efbc1401...`, contract digest `3bad50d0...3d40` agree (Plan 15-13, 24/24 tests). |
| `15-SECURITY.md` | Local security disposition | ✓ VERIFIED | PASS for repository-local scope; three lanes BLOCKED and not passed. |
| `evidence/15-TRACEABILITY.md`, `15-BASELINE-RESULTS.md` | Terminal evidence chain | ✓ VERIFIED | Refreshed by Plan 15-15. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Candidate rows | approved screenshot directory | signed hash + exact-byte promotion | ✓ WIRED | `--verify-promotion` passes on a clean checkout. |
| Approval ledger | local UI contract | candidate-set + source-commit + digest equality | ✓ WIRED | Fails closed on any mismatch (8 disposable-fixture tests). |
| Actor declaration | real server-authorized browser context | role fixture | ✗ NOT WIRED | No disposable identities exist; lanes are typed BLOCKED, owner declined isolated staging. |
| UI map / approval verification | clean checkout | tracked inputs only | ⚠ PARTIAL | `--verify-ui-map` and `--verify-approval` need the gitignored `.runs/` capture directory and fail with `PORTIA_CANDIDATE_SET_MISSING` in a clean checkout. |
| Browser page | diagnostic gate | automatic listeners + assertion | ✓ WIRED | Clean-checkout diagnostics 15/15. |
| Traceability | `STAB-BASE-01..06` | terminal matrix | ✓ WIRED | All six rows linked. |

## Requirements Coverage

| Requirement | Status | Blocking issue |
|---|---|---|
| `STAB-BASE-01` | ✓ SATISFIED | Current screens/contracts recorded without product redesign. |
| `STAB-BASE-02` | ✗ BLOCKED | Participant/editor/reviewer/owner sessions absent (20 skips); owner declined isolated staging → Phase 16/19. |
| `STAB-BASE-03` | ✗ BLOCKED | 33 BLOCKED rows, 18 rejected motion rows, and pixel lanes that need a read backing. |
| `STAB-BASE-04` | ✗ BLOCKED | Contract signed only for the 33 approved states; rejected/blocked states remain. |
| `STAB-BASE-05` | ✓ SATISFIED | Unexpected diagnostics fail; 0 critical/serious Axe; local security review PASS. |
| `STAB-BASE-06` | ✗ BLOCKED | Chain complete for local scope, but staging role proof, data-backed lanes and physical UAT remain. |

**Coverage:** 2/6 requirements satisfied. Plan 15-15 advances none; the evidence does not fully prove any additional requirement.

## Behavioral Verification (disposable clean checkout, Node 22.13.1)

| Check | Result |
|---|---|
| `npm ci` | ✓ PASS (373 packages) |
| `npm test` | ✓ PASS — 636 tests, 635 pass, 0 fail, 1 skip |
| `tsc --noEmit`, `npm run build` | ✓ PASS |
| `npm run lint` | ✓ PASS — 0 errors, 18 pre-existing warnings |
| Manifest tests | ✓ PASS — 24/24 |
| `--verify-promotion` | ✓ PASS — 33 exact bytes, 18 excluded |
| `--verify-ui-map` / `--verify-approval` | ⚠ BLOCKED in clean checkout (untracked `.runs/`); ✓ PASS on main tree (84 rows; 51 captured verdicts) |
| `npm audit --omit=dev` | ✓ PASS — 0 vulnerabilities |
| `npm audit` | ✓ ACCEPTED — 16 moderate dev-only, 0 high/critical |
| Secret scan (tracked) | ✓ PASS — 0 matches |
| Playwright specs + visual | ⚠ 63 pass / 15 fail (BLOCKED DATA) / 77 skip (20 BLOCKED actor) / 0 flaky |

## Test Quality Audit

| Test area | Linked requirement | Active | Skipped | Verdict |
|---|---|---:|---:|---|
| Accessibility / diagnostics / tooling | `STAB-BASE-02/05` | 30 | 0 | ✓ STRONG |
| Visitor flows | `STAB-BASE-02` | 17 (12 pass, 5 need read backing) | 3 phone-only | ⚠ data-dependent |
| Privileged actors | `STAB-BASE-02` | 0 | 20 | 🛑 BLOCKED (not a pass) |
| Approved visual comparisons | `STAB-BASE-03` | 21 on authority projects (11 pass, 10 need read backing) | 54 non-authority/no-row | ⚠ data-dependent; bounded pixel allowance |

## Anti-Patterns Found

None new. No product-source change was made in Phase 15 (Plan 15-14 changed one test file and the lockfile only).

## Human Verification Required

Physical owner PC (including DPR 1.25) and phone UAT remains the Phase 22 gate. Owner
decision needed on read backing for the data-dependent lanes (see Gaps).

## Gaps Summary

| # | Gap | Evidence class | Owner phase |
|---|---|---|---|
| G1 | Disposable authenticated roles and isolated Supabase | role / staging | 16, 19 |
| G2 | Read backing for 15 data-dependent Playwright lanes in a clean checkout | data | 16 (or owner-supplied read-only public configuration) |
| G3 | 33 BLOCKED visual rows | visual / device | 16, 18, 19, 22 |
| G4 | 18 rejected motion candidates | visual | 18 |
| G5 | Physical PC/phone UAT | physical device | 22 |
| G6 | UI-map/approval verification not reproducible from tracked files alone | tooling | owner decision (not fixed in Phase 15) |

## Lifecycle Decision

**Phase 15 stays `gaps_found`.** All 15 plans are executed. The phase is not
marked complete and does not auto-advance. Only STAB-BASE-01 and STAB-BASE-05 are
complete. Every remaining gap above is a concrete role, data, visual or
physical-device item with a named owner phase; no obsolete external blocker
(design service, managed scanner) remains.

---
*Verified: 2026-11-01*  
*Verifier: Plan 15-15 executor (inline); the separate phase verifier runs afterwards under the orchestrator.*
