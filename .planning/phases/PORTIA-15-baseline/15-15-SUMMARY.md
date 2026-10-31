---
phase: 15-baseline
plan: 15
subsystem: verification
tags: [clean-checkout, goal-backward-verification, traceability, lifecycle]
requires:
  - phase: 15-14
    provides: local security gate PASS, green unit suite, lockfile-only audit fix
provides:
  - clean-checkout (disposable clone, Node 22.13.1) result set with typed BLOCKED lanes
  - refreshed 15-VERIFICATION.md, 15-TRACEABILITY.md, 15-BASELINE-RESULTS.md without obsolete external blockers
  - explicit Phase 15 lifecycle decision (gaps_found)
affects: [phase-16, phase-18, phase-19, phase-21, phase-22]
tech-stack:
  added: []
  patterns: [disposable-clone-verification, typed-blocked-data-lane]
key-files:
  created: []
  modified:
    - .planning/phases/PORTIA-15-baseline/15-VERIFICATION.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-TRACEABILITY.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-BASELINE-RESULTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - "Phase 15 lifecycle: all 15 plans executed, phase stays gaps_found, not marked complete; only STAB-BASE-01 and STAB-BASE-05 are complete."
  - "No real Supabase project was contacted: .env.local was not copied, placeholder public values satisfied the shape-only preflight, so 15 data-backed Playwright tests are recorded as BLOCKED (DATA), not as passes or regressions."
requirements-completed: []
requirements-addressed: [STAB-BASE-01, STAB-BASE-02, STAB-BASE-03, STAB-BASE-04, STAB-BASE-05, STAB-BASE-06]
status: complete
commits: 1
plan_head_before: 348684a5f408bf664b05b2395e57b84072c14291
plan_head_after: 02ed12c6bf2162407bcdc2c42e0ddecb67aa0df6
actuals:
  tasks: 1
  commits: 1
duration: 35min
completed: 2026-11-01
---

# Phase 15 Plan 15: Clean-Checkout Terminal Verification Summary

**A disposable Node 22.13.1 clone at `348684a` passes install, 636 unit tests, typecheck, build, lint, both audits, the secret scan and `--verify-promotion` (33 exact approved bytes); the browser lane gives 63 pass / 15 blocked-data / 77 skip (20 blocked actor) / 0 flaky, so Phase 15 stays `gaps_found` with only concrete role, data, visual and device gaps.**

## Task Commits

1. **Task 1: Repeat clean-checkout and terminal verification** — `02ed12c` (verification, traceability and results documents). Roadmap/state/summary close-out is a separate docs commit.

## Verification (actual results)

| Command | Clean checkout | Main tree |
|---|---|---|
| `npm ci` | PASS, 373 packages | n/a (existing install) |
| `npm test` | PASS: 636 tests, 635 pass, 0 fail, 1 skip | PASS: identical |
| `npm exec tsc -- --noEmit` | PASS | PASS |
| `npm run build` | PASS | not run (loads `.env.local`) |
| `npm run lint` | PASS: 0 errors, 18 warnings | PASS: identical |
| `npm run test:e2e:preflight` | PASS (placeholder public shape) | FAIL-CLOSED `missing-environment: NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| manifest test (`--experimental-strip-types --test`) | PASS 24/24 | PASS 24/24 |
| `--verify-promotion` | PASS: 33 approved bytes, 18 excluded | PASS: identical |
| `--verify-ui-map` | BLOCKED: `PORTIA_CANDIDATE_SET_MISSING` (gitignored `.runs/`) | PASS: 84 rows (51 captured, 33 blocked) |
| `--verify-approval` | BLOCKED: same | PASS: 51 verdicts, 33 blocked excluded |
| `npm audit --omit=dev` | PASS: 0 | PASS: 0 |
| `npm audit` | 16 moderate dev-only, 0 high/critical | identical |
| secret scan (tracked files) | PASS: 0 matches in every class | n/a |
| `playwright test tests/e2e/specs tests/e2e/visual --retries=0` | 155 tests: 63 pass, 15 fail (blocked-data), 77 skip, 0 flaky | not run (preflight fails closed) |

Skip breakdown (77): 20 BLOCKED actor lanes, 52 pixel authority pinned to another project, 2 no row for project, 3 phone-only smoke. The 15 failures are all `ENOTFOUND` consequences of the withheld read backing (5 visitor reload tests, 7 public-application pixel comparisons, 2 shell comparisons, 1 Vivian motion comparison); they are neither passes nor regressions. The clone stayed free of tracked/untracked changes and was removed afterwards.

## Requirement matrix (unchanged by this plan)

| Requirement | Status |
|---|---|
| STAB-BASE-01 | Complete |
| STAB-BASE-02 | Open: actor lanes BLOCKED (20), data-backed visitor lane needs read backing |
| STAB-BASE-03 | Open: 33 BLOCKED rows, 18 rejected motion rows, pixel lanes need read backing |
| STAB-BASE-04 | Open: contract signed for 33 approved states only |
| STAB-BASE-05 | Complete |
| STAB-BASE-06 | Open: staging role proof, data-backed lanes, physical UAT |

`REQUIREMENTS.md` is intentionally unchanged: no evidence newly proves a requirement.

## Lifecycle decision

Phase 15 remains `gaps_found`. All 15 plans are executed; the phase checkbox is not ticked and the phase does not auto-advance. Remaining gaps: G1 isolated Supabase and authenticated roles (Phases 16/19), G2 read backing for 15 data-dependent lanes (Phase 16 or an owner-supplied read-only public configuration), G3 33 BLOCKED visual rows (Phases 16/18/19/22), G4 18 rejected motion candidates (Phase 18), G5 physical PC/phone UAT (Phase 22), G6 UI-map/approval verification not reproducible from tracked files alone (owner decision). No external design service or managed scanner is a prerequisite.

## Deviations from Plan

**1. [Rule 3 - Blocking] `--verify` replaced by read-only verbs.** The plan's verify chain runs `node scripts/phase15-visual-manifest.mjs --verify`, which rewrites signed evidence markdown (owner prohibition) and needs the same untracked `.runs/` data. `--verify-promotion` (and on the main tree `--verify-ui-map`, `--verify-approval`) were run instead.

**2. [Rule 3 - Blocking] Read backing withheld.** The tracked preflight demands a Supabase-shaped URL and key. Following the owner's no-production-Supabase / no-`.env.local`-copy constraints, placeholder values were injected in-process only; nothing real was contacted. Consequence: 15 data-backed tests are BLOCKED (DATA). The main tree's own `.env.local` is also incomplete (no anon key), so the main-tree browser lane could not run either.

**3. Plan verify uses `npm.cmd`.** Run with `npm` from Git Bash under the same Node 22.13.1.

**4. Clean-checkout reproducibility gap found (G6), not fixed.** `--verify-ui-map` and `--verify-approval` depend on the gitignored capture directory. Fixing the verifier is tooling work outside this plan; recorded for an owner decision.

## Issues / Notes

- `package-lock.json` from 15-14 installs cleanly with `npm ci`.
- The five owner-dirty paths were not touched or staged.
- No product-source changes; Figma and Codex Security not reintroduced.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

`02ed12c` is an ancestor of HEAD; the three modified evidence files exist.
