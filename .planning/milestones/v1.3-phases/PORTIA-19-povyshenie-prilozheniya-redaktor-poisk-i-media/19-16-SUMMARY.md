---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 16
subsystem: promotion
tags: [react, polling, reviewer, validation, tdd]
requires:
  - phase: PORTIA-19
    provides: Existing participant status flow, reviewer command parser, and roster normalization
provides:
  - Transient status poll refusals retain the participant projection and qualification runner
  - Reviewer device reset accepts normalized roster nicknames, including acceptance and Cyrillic keys
affects: [PORTIA-19 owner UAT, STAB-PROM-07, STAB-PROM-09, STAB-PROM-14]
actuals:
  tokens: 2343
  tasks: 2
  commits: 4
plan_head_before: 910c3d65c8e4ba6a59e75b5cce4c91e1f5fcfa6f
plan_head_after: f471ad56ce7795771a2cd26695bea1380de8afd8
tech-stack:
  added: []
  patterns: [Pure status poll decision, shared nickname normalization]
key-files:
  created: [lib/portia-promotion-poll.ts, lib/portia-promotion-poll.test.ts]
  modified: [components/portia-promotion.tsx, lib/portia-promotion-ui.test.ts, lib/portia-promotion-sheet.ts, lib/portia-promotion-reviewer.ts, lib/portia-promotion-reviewer.test.ts]
key-decisions:
  - Restore without a displayed status ignores all HTTP refusals, including 404 and 423, as the behavior contract requires.
  - Keep STAB-PROM-07, STAB-PROM-09, and STAB-PROM-14 Pending until live role and owner acceptance evidence exists.
requirements-completed: []
coverage:
  - id: WR-04
    description: Transient background status refusals preserve the visible runner and its qualification lock.
    requirement: STAB-PROM-07
    verification:
      - kind: unit
        ref: lib/portia-promotion-poll.test.ts
        status: pass
      - kind: unit
        ref: lib/portia-promotion-ui.test.ts
        status: pass
    human_judgment: true
    rationale: Owner reload and offline acceptance plus authenticated role proof remain for 19-21.
  - id: WR-06
    description: Reviewer reset-device validates the same normalized nickname key as the roster.
    requirement: STAB-PROM-09
    verification:
      - kind: unit
        ref: lib/portia-promotion-reviewer.test.ts
        status: pass
      - kind: unit
        ref: lib/portia-promotion-sheet.test.ts
        status: pass
    human_judgment: true
    rationale: Authenticated reviewer and RPC execution remain unproven in this plan.
duration: 8min
completed: 2026-11-04
status: complete
---

# Phase 19 Plan 16: Promotion poll and reviewer nickname gap closure

Transient background status refusals now retain the visible qualification attempt, while reviewer device reset accepts roster-equivalent Unicode and acceptance nicknames.

## Performance

- **Duration:** approximately 8 min
- **Tasks:** 2
- **Files changed:** 7 code files
- **Code commits:** 4, measured from `plan_head_before` to `plan_head_after`

## Accomplishments

- `statusPollOutcome` keeps displayed status stale for transient background refusals, resets on 404/423 or explicit checks, and ignores failed initial restore. `loadStatus` uses the decision, so a transient response does not unmount `QualificationRunner` or release its lock.
- Reviewer `reset-device` uses the roster's `normalizedNickname` and bounds the normalized key to 1..64 characters without control characters. Acceptance keys, Cyrillic names, spaces, and NFKC forms are covered.
- Existing server refusal text, reviewer authorization, RPC parameters, heartbeat, and server deadline remain in place. Live owner and role evidence is still pending.

## Task Commits

1. Task 1 RED: `23c939e` — poll and UI retention tests.
2. Task 1 GREEN: `b02ef1b` — status decision and UI wiring.
3. Task 2 RED: `0eaffbf` — reviewer nickname tests.
4. Task 2 GREEN: `f471ad5` — shared normalization and validation.

## TDD Evidence

- Task 1 RED: `19-16-task1-red.json`, `RED_EVIDENCE_OK`; the named background refusal test observed `reset` for HTTP 400 instead of `keep-stale`. The UI source test also failed because the decision call was absent. GREEN: all 23 targeted tests pass.
- Task 2 RED: `19-16-task2-red.json`, `RED_EVIDENCE_OK`; the named reset test observed `null` for `__portia_live_mw0rbyf6_72424cdc_p-ordinary`. GREEN: all 29 targeted tests pass.

## Verification

- `npm.cmd test`: 1079 tests, 1076 passed, 3 pre-existing skipped, 0 failed.
- `npm.cmd exec tsc -- --noEmit`: passed.
- `npm.cmd run build`: passed on Node 22.13.1.
- `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts`: 37 passed.
- `node scripts/phase15-visual-manifest.mjs --verify-promotion`: passed, 33 approved snapshots verified.
- ESLint on all changed code files: passed. ESLint on `app components lib scripts`: exit 0, 14 warnings.
- Full `npm.cmd run lint` and `portia-check`: **failed** on 32 pre-existing errors in `.agents/skills/` and `.claude/skills/` scripts and linked worktree. This is not recorded as a pass; see `deferred-items.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restore precedence in the plan's rule order**
- **Found during:** Task 1 GREEN.
- **Issue:** The proposed rule order reset 404/423 before checking a failed initial restore, contradicting the plan's explicit `restore=true, hasStatus=false, any code → ignore` test.
- **Fix:** Initial restore without displayed status is checked before definitive 404/423, while 404/423 with displayed status still resets.
- **Verification:** Targeted poll tests pass.
- **Committed in:** `b02ef1b`.

## Deferred Issues

- The full repository lint gate remains failed due to unrelated existing skill scripts. No 19-16 code file has an ESLint error.
- Authenticated reviewer, RPC, staging, production, and physical device acceptance remain BLOCKED/Pending for later plans. No live or owner UAT pass is claimed.

## Known Stubs

No stubs were introduced by this plan.

## Self-Check: PASSED

- All seven named code files and both RED evidence records exist.
- All four task commits are ancestors of HEAD; code commit count is 4.
