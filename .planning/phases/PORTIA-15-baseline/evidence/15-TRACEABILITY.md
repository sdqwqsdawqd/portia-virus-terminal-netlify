# Phase 15 Requirement Traceability

**Status:** COMPLETE MAPPING / PHASE CLOSURE BLOCKED (`gaps_found`)  
**Evidence commit:** `348684a5f408bf664b05b2395e57b84072c14291`  
**Clean-checkout date:** 2026-11-01 (Node 22.13.1, disposable clone)  
**Owner/signing authority:** `Qloxz`

This matrix is the terminal Phase 15 link audit. `PASS` means the requirement is
fully supported by the named evidence. `BLOCKED` is not a pass: the link exists,
but an actor, data, visual or physical-device lane required by the canonical
requirement is still unavailable. Results come from `15-BASELINE-RESULTS.md`;
security evidence from `15-SECURITY.md`. No external design service or managed
scanner is referenced as evidence or as a prerequisite.

| Requirement | UI contract | Plan / task | Implementation and contract files | Deterministic / browser tests | Evidence | Owner status | Closure |
|---|---|---|---|---|---|---|---|
| `STAB-BASE-01` | `15-UI-SPEC.md` Preservation Principles; `evidence/15-LOCAL-UI-CONTRACT.md` | `15-01-PLAN.md`, Tasks 1-3; `15-11-PLAN.md` | `15-CURRENT-STATE-LEDGER.md`; `15-DIRTY-OWNERSHIP.md`; `15-ACCEPTED-LIMITATIONS.md` | `lib/phase15-production-imports.test.ts`; unit suite 636 tests / 0 fail (clean checkout and main tree) | `15-01-SUMMARY.md`; signed ledger in `15-VISUAL-APPROVAL.md` | Owner dispositions recorded; baseline signed by `Qloxz` | **PASS** |
| `STAB-BASE-02` | `15-UI-SPEC.md` Device/Actor/State Matrix and Viewport Matrix | `15-02-PLAN.md`, `15-03-PLAN.md`, `15-06-PLAN.md`, `15-07-PLAN.md`, `15-10-PLAN.md` | `playwright.config.ts`; `tests/e2e/fixtures/{actors,target-guard}.ts`; page objects under `tests/e2e/pages/` | `lib/e2e-actors.test.ts`; `lib/e2e-target-guard.test.ts`; specs `visitor/roles/accessibility/diagnostics/tooling` — clean checkout: 63 pass, 15 fail (no read backing), 20 role skips BLOCKED | `15-BASELINE-RESULTS.md`; `15-ROLE-GATE.md` | Visitor lanes accepted; participant/editor/reviewer/owner lanes `BLOCKED` (owner declined isolated staging) | **BLOCKED** |
| `STAB-BASE-03` | `15-UI-SPEC.md` Candidate/Promotion Protocol, Motion and Viewport Matrix | `15-04-PLAN.md`, `15-05-PLAN.md`, `15-09-PLAN.md`, `15-11-PLAN.md`, `15-12-PLAN.md`, `15-13-PLAN.md` | `tests/e2e/visual/*.spec.ts`; 33 PNGs in `tests/e2e/visual/__screenshots__/`; `scripts/phase15-visual-manifest.mjs` | `--verify-promotion` PASS on both trees (33 exact bytes); `--verify-ui-map` / `--verify-approval` PASS on main tree, BLOCKED in clean checkout (untracked `.runs/`); manifest tests 24/24; pixel comparisons need a read backing | `15-VISUAL-CANDIDATES.md`; `15-FRAME-TEST-MAP.md`; `15-VISUAL-APPROVAL.md`; `15-12-SUMMARY.md`; `15-13-SUMMARY.md` | `Qloxz`: 33 APPROVED, 18 REJECTED (motion, Phase 18), 33 BLOCKED (not promoted) | **BLOCKED** |
| `STAB-BASE-04` | `15-UI-SPEC.md` Typography, Motion and Copywriting contracts; `evidence/15-LOCAL-UI-CONTRACT.md` | `15-04-PLAN.md`, `15-05-PLAN.md`, `15-11-PLAN.md` | `15-LOCAL-UI-CONTRACT.md` (digest `3bad50d0...3d40`); `15-FRAME-TEST-MAP.md`; `15-UI-REVIEW.md` | candidate-set / source-commit / contract-digest equality gate (Plan 15-13); approved visual suite | `15-VISUAL-APPROVAL.md`; `15-UI-REVIEW.md` | Contract signed for the 33 approved states; rejected motion and 33 blocked states outstanding | **BLOCKED** |
| `STAB-BASE-05` | `15-UI-SPEC.md` Copy/Error, Accessibility and Security/Privacy contracts | `15-03-PLAN.md`, `15-08-PLAN.md` | `tests/e2e/fixtures/diagnostics.ts`; `tests/e2e/specs/{diagnostics,accessibility}.spec.ts`; `next.config.ts` | Clean checkout: diagnostics 15/15, accessibility 10/10, 0 critical/serious Axe | `15-BASELINE-RESULTS.md`; `15-SECURITY.md` | Exact Promotion 404 allowance owned by `promotion-api-contract`, expires 2027-01-31 | **PASS** |
| `STAB-BASE-06` | `15-UI-SPEC.md` Gate/Status Definitions and Owner Checkpoints | `15-01-PLAN.md`, `15-05-PLAN.md`, `15-13-PLAN.md`, `15-14-PLAN.md`, `15-15-PLAN.md` | This matrix; `15-BASELINE-RESULTS.md`; `15-SECURITY.md`; `15-VERIFICATION.md` | Clean-checkout chain: install, unit, typecheck, build, lint, audit, secret scan, manifest verification, Playwright/Axe/diagnostics all recorded with typed BLOCKED lanes | `15-SECURITY.md` (local scope PASS: 0 critical, 0 high); `15-BASELINE-RESULTS.md` | Staging role proof, data-backed visual lanes, remaining visual states and physical UAT outstanding | **BLOCKED** |

## Terminal Link Audit

- Every `STAB-BASE-01` through `STAB-BASE-06` row has a non-empty UI-SPEC,
  plan/task, file, test, evidence and owner-status link.
- No `PENDING` owner verdict exists among the 51 captured candidates (33 APPROVED,
  18 REJECTED). The 33 uncaptured rows remain `BLOCKED`; they are neither promoted
  nor described as passing.
- Requirement closure changes in Plan 15-15: none. `STAB-BASE-01` and
  `STAB-BASE-05` stay complete; `STAB-BASE-02`, `-03`, `-04` and `-06` stay open.
- Remaining gaps are concrete and owned: isolated-staging role proof (Phase 16/19),
  read backing for data-dependent lanes (Phase 16), rejected motion (Phase 18),
  blocked visual states (Phases 16/18/19/22) and physical PC/phone UAT (Phase 22).
- Phase 15 must not be marked complete or auto-advance.
