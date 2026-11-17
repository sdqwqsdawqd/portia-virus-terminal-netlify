---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 13
subsystem: release-gate
tags: [D-68, release-rehearsal, offline-harness, STAB-REL-01, STAB-REL-02, STAB-REL-03]
requires:
  - phase: PORTIA-20
    provides: "20-58 owner verdict accepted (D-68), 20-12 baselines and register, 20-30 runner"
provides:
  - "scripts/phase20-release-gate.mjs: 17 gates, ui-contract-offline, offline data mode, owner-verdict section in --verify-evidence"
  - "20-RELEASE-EVIDENCE.md: commit-bound ledger for c11adf6, verdict FAIL"
affects: [20-14, 20-15]
key-files:
  modified:
    - scripts/phase20-release-gate.mjs
    - lib/phase20-release-gate.test.ts
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-EVIDENCE.md
key-decisions:
  - "Offline gates (ui-contract-offline, visual-approved, visual-phase20) are run by the runner itself: production build of the checkout, next start on 127.0.0.1:3100 under offline-supabase.cjs, Playwright CLI directly; labelled offline D-68"
  - "A skip by project condition is accepted only for ui-contract-offline and only when the same test passed on another project (projectSkips); BLOCKED skips never"
  - "The rehearsal verdict is FAIL and is recorded as such: no baseline and no policy was changed"
status: complete
outcome: complete-with-red-gates
plan_head_before: faa30a4fe2cd7035e0e600a9f8770aab133c8194
plan_head_after: 46d9704aeadc850b821d8194f15a2f23abcb39c0
actuals:
  tasks: 2
  commits: 3
---

# Phase 20 Plan 13: Release rehearsal under D-68 Summary

Runner reworked for D-68 and rehearsed on release commit `c11adf6cd1e3f93f32800f91f8c70189d2e10682` in a clean temporary checkout. Verdict `FAIL`: the open blockers of 20-12 appear as FAIL/BLOCKED rows, never as PASS. `--verify-evidence` accepts the protocol; a forged `Итог: PASS` is rejected (4 errors). Release is not signed as ready.

PLAN_BASE: faa30a4fe2cd7035e0e600a9f8770aab133c8194

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 RED | 3bf72f7 | RED for the D-68 release gate (31 of 85 tests failed) |
| 1 GREEN | c11adf6 | release gate under D-68 (85 of 85 pass); this is the release commit rehearsed |
| 2 | 46d9704 | rehearsal evidence, deferred items |

## Gate table (release commit c11adf6, Node 22.13.1)

| Gate | Data mode | Result |
|------|-----------|--------|
| node-version, tree-clean | - | PASS |
| npm-ci | - | PASS (npm 11.19.0 under Node 22.13.1, see Deviations) |
| unit | - | PASS 1606/0/9 skipped (guard-boundary tests skip as BLOCKED (ENV) on a clean checkout) |
| typecheck, build, lint | - | PASS |
| audit-prod | - | PASS (found 0 vulnerabilities) |
| audit-evidence | - | PASS |
| visual-manifest | - | PASS 49/0/0 (`--verify-promotion` only) |
| e2e-full | цель | BLOCKED (ENV): no public values / target |
| ui-contract-offline | offline D-68 | FAIL 139/11/14 |
| visual-approved | offline D-68 | FAIL 19/2/54 |
| visual-phase20 | offline D-68 | BLOCKED (ENV) 32/0/2 (reviewer pair) |
| mutation-attest, e2e-mutation, staging-live | staging | BLOCKED (ENV): no attested isolated staging |

## What is red or BLOCKED and why

- visual-approved: `phone-webkit--webkit-phone` 58293 px (class (г), reproduced); `motion-vivian-activity` 3110 px (BLOCKED (CAPTURE); one of the two motion frames fails in each run).
- visual-phase20: reviewer baselines BLOCKED (ENV), no attested staging. The other 32 frames passed (including class icons and spider at rest, so D-39/D-45 row).
- Firefox teardown fault of 20-12 did not appear in this run; recorded as an intermittent environment fault, not as PASS.
- ui-contract-offline: 9 failures in step 1 and 2 in step 2 (template-builder, chromium-desktop/phone/dpr125), unexpected console event `Blocked script execution in 'about:srcdoc'`. Repeated on the same commit with `--only npm-ci,ui-contract-offline`: same 9 in step 1 (deterministic). 20-58 on H6 had 0 failed; cause not established (kept in deferred-items.md).
- Owner visual acceptance (D-68): «Общий вердикт» ПРИНЯТО ВЛАДЕЛЬЦЕМ 2026-11-08 (verbatim from 20-58-SUMMARY.md, matches frontmatter), register commit equals `owner_verdict_commit` 0c2a59d1d1a7, product code НЕ ИЗМЕНЁН (runner computed, `git diff` of non-test files empty). The red visual gates still keep the verdict at FAIL.
- Decisions D-35..D-45: D-36(б) production and D-47 production «ОЖИДАЕТ ВЛАДЕЛЬЦА»; D-47 staging BLOCKED (OWNER) because the notes feature was removed in 20-33; D-40..D-42 BLOCKED (ENV); T-20-31 PASS (40 tests).
- D-33: WR-03, WR-05, IN-01..IN-04 fixed, IN-05 disposition (D-09). Matrix: no unresolved high.

## Verification

Main tree, Node 22.13.1: `node --experimental-strip-types --test lib/*.test.ts` 1615 tests, 1612 pass, 0 fail, 3 skipped; `tsc --noEmit` exit 0; eslint 0 errors, 17 warnings (as before); `lib/phase20-release-gate.test.ts` 85/85; `--plan` lists 17 gates; `--verify-evidence` verified.

The known STATE item (guard.mjs untracked, unit and tsc failing on a clean checkout) is already resolved by 807ab9f: the boundary test skips as BLOCKED (ENV) when the hook is absent. On the clean checkout unit and typecheck were PASS. No hook file was committed or changed. The STATE blocker line is stale.

## Deviations from Plan

**1. [Rule 3 - Blocking] npm of Node 22.13.1** - its bundled npm 10.9.2 fails `npm ci` with MODULE_NOT_FOUND `node-gyp/bin/node-gyp.js`. First runner invocation (artifacts `c11adf6cd1e3-20261108T100427008Z`) had every npm gate FAIL/BLOCKED (DEP); not used as evidence. Second run used a PATH shim `npm.cmd` that drives npm 11.19.0 of the default install with Node 22.13.1 (shim is in the session scratchpad, not in the repo).

**2. [Rule 2 - Honesty] projectSkips** - added so ui-contract-offline can pass despite by-project `test.skip` (20-58 had 14 such skips); not extended to visual-approved/e2e-full (deferred, see below).

**3. Evidence assembled by script** - `20-RELEASE-EVIDENCE.md` was rendered by the runner's `renderEvidence` from `receipt.json` plus hand-carried D-33/D-35..D-45 rows and appendix; status, commit and product-code rows are measured by the runner, not written by hand.

## Deferred Issues

In `deferred-items.md`: visual-approved/e2e-full can never be PASS while project-condition skips count as SKIPPED; ui-contract-offline red cause unexplained.

## Known Stubs

None. Offline results are labelled «offline D-68» and are UI-contract/baseline results on starting content only.

## Threat Flags

None. The offline server runs only on 127.0.0.1:3100 from a throwaway checkout, with mutation/staging/privileged/real public variable names removed; it was stopped by the runner by PID and port 3100 verified empty; the worktree was removed.

## Self-Check: PASSED

- Commits 3bf72f7, c11adf6, 46d9704 are ancestors of HEAD.
- `20-RELEASE-EVIDENCE.md` exists; `--verify-evidence` exit 0; `tests/e2e/visual/__screenshots__` untouched; port 3100 not listening; no `portia-release-*` worktree left.
