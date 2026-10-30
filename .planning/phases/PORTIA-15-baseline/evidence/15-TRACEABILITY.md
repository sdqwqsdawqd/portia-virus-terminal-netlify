# Phase 15 Requirement Traceability

**Status:** COMPLETE MAPPING / PHASE CLOSURE BLOCKED  
**Evidence commit:** `8493636b31083dc3a8af5cafb4ab3f35626482dd`  
**Clean-checkout date:** 2026-10-30  
**Owner/signing authority:** `Qloxz`

This matrix is the terminal Phase 15 link audit. `PASS` means the requirement is
fully supported by the named evidence. `BLOCKED` is not a pass: the link exists,
but an infrastructure, device, actor or visual state required by the canonical
requirement is still unavailable.

| Requirement | UI contract | Plan / task | Implementation and contract files | Deterministic / browser tests | Evidence | Owner status | Closure |
|---|---|---|---|---|---|---|---|
| `STAB-BASE-01` | `15-UI-SPEC.md` Preservation Principles and Requirement Traceability | `15-01-PLAN.md`, Tasks 1-3 | `15-CURRENT-STATE-LEDGER.md`; `15-DIRTY-OWNERSHIP.md`; `15-ACCEPTED-LIMITATIONS.md` | `lib/phase15-production-imports.test.ts`; current-state candidate journeys | `15-01-SUMMARY.md`; signed CURRENT ledger in `15-VISUAL-APPROVAL.md` | Owner dispositions recorded; CURRENT baseline signed by `Qloxz` | **PASS** |
| `STAB-BASE-02` | `15-UI-SPEC.md` Device/Actor/State Matrix and Viewport Matrix | `15-02-PLAN.md`, Tasks 1-3; `15-03-PLAN.md`, Tasks 1-3 | `playwright.config.ts`; `tests/e2e/fixtures/actors.ts`; `tests/e2e/fixtures/target-guard.ts`; semantic page objects under `tests/e2e/pages/` | `lib/e2e-actors.test.ts`; `lib/e2e-target-guard.test.ts`; `tests/e2e/specs/{visitor,roles,accessibility,tooling}.spec.ts` | `15-02-SUMMARY.md`; `15-03-SUMMARY.md`; clean run in `15-BASELINE-RESULTS.md` | Visitor lanes accepted; participant/editor/reviewer/owner lanes explicitly `BLOCKED` without isolated staging | **BLOCKED** |
| `STAB-BASE-03` | `15-UI-SPEC.md` Candidate/Promotion Protocol, Motion Matrix and Viewport Matrix | `15-04-PLAN.md`, Tasks 1-3; `15-05-PLAN.md`, Tasks 1-2 | `tests/e2e/visual/*.spec.ts`; 23 PNGs in `tests/e2e/visual/__screenshots__/`; `scripts/phase15-visual-manifest.mjs` | `node scripts/phase15-visual-manifest.mjs --verify-promotion`; 23 `toHaveScreenshot` assertions in 14 Chromium tests | `15-VISUAL-CANDIDATES.md`; `15-FRAME-TEST-MAP.md`; `15-VISUAL-APPROVAL.md`; `15-04-SUMMARY.md` | `Qloxz` approved exactly 23 hashes; 35 actor/device/spider/web/Vivian rows remain `BLOCKED` and were not promoted | **BLOCKED** |
| `STAB-BASE-04` | `15-UI-SPEC.md` Figma, Typography, Motion and Copywriting contracts | `15-04-PLAN.md`, Tasks 2-3; `15-05-PLAN.md`, Task 1 | `15-FIGMA-CONTRACT.md`; `15-FRAME-TEST-MAP.md`; repository UI-SPEC as normative authority | Figma structural validation; manifest frame-map verification; approved visual suite | Figma file `GEf7NB9v2GZN80cMzRvUVQ`; MCP session `77cd90e1-9022-4a59-8906-de90227ad904`; `15-VISUAL-APPROVAL.md` | Exact CURRENT revision and 23 candidates signed by `Qloxz`; 35 mapped states remain `BLOCKED` | **BLOCKED** |
| `STAB-BASE-05` | `15-UI-SPEC.md` Copy/Error, Accessibility and Security/Privacy contracts | `15-03-PLAN.md`, Tasks 2-3 | `tests/e2e/fixtures/diagnostics.ts`; `tests/e2e/specs/{diagnostics,accessibility}.spec.ts`; `next.config.ts` | Six diagnostic classes exercise the redacted failure path; Axe blocks all unapproved critical/serious fingerprints | `15-03-SUMMARY.md`; clean Playwright JSON summarized in `15-BASELINE-RESULTS.md` | Exact Promotion 404 allowance is owned by `promotion-api-contract` and expires 2027-01-31; no broad owner waiver | **PASS** |
| `STAB-BASE-06` | `15-UI-SPEC.md` Gate/Status Definitions and Owner Checkpoints | `15-01-PLAN.md`, Task 3; `15-05-PLAN.md`, Task 3 | `15-TRACEABILITY.md`; `15-BASELINE-RESULTS.md`; all five plan summaries | Unit, typecheck, build, lint, full Playwright, visual, Axe, diagnostics and secret scan are recorded from a clean checkout | This matrix; `15-BASELINE-RESULTS.md`; `15-VISUAL-APPROVAL.md` | Owner visual gate is signed, but staging role proof, remaining visual states, physical UAT and managed security evidence are unresolved | **BLOCKED** |

## Terminal Link Audit

- Every `STAB-BASE-01` through `STAB-BASE-06` row has a non-empty UI-SPEC,
  plan/task, file, test, evidence and owner-status link.
- No `PENDING` owner verdict exists among the 23 captured candidates.
- The 35 uncaptured rows remain `BLOCKED`; they are neither promoted nor described
  as passing.
- Because `STAB-BASE-02`, `STAB-BASE-03`, `STAB-BASE-04` and `STAB-BASE-06`
  remain blocked, Phase 15 must not be marked complete or auto-advance.

