---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 18
subsystem: security
tags: [rich-text, media-fallback, acceptance-script, d-33, in-01, in-02, in-04, in-05]
requires:
  - phase: PORTIA-19
    provides: review findings IN-01, IN-02, IN-04, IN-05 carried over by D-33
provides:
  - "splitEmbeddedMedia: text/media segments, trailing punctuation stays in text"
  - "EmbeddedImage: inline image falls back to «Изображение недоступно»"
  - "Object.hasOwn label check and dirty-teardown path in acceptance script"
affects: [20-10, STAB-MEDIA-07, STAB-A11Y-03, STAB-SEC-05]
status: complete
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: a10a768c0174c8ad1fb805d9d338f1d5e6d7c969
plan_head_after: a8a03950b17a1691fc442bd0ad133e99b9b99d45
tech-stack:
  added: []
  patterns:
    - "Pure lib module without React or @/ imports for rich-text media recognition"
    - "Source-tests on component text for fallback wiring"
key-files:
  created:
    - lib/rich-text-media.ts
    - lib/rich-text-media.test.ts
  modified:
    - components/portia-desktop-dossier.tsx
    - scripts/phase19-acceptance.mjs
    - lib/phase19-acceptance.test.ts
    - lib/portia-employees.ts
key-decisions:
  - "IN-05 is a disposition, not a fix: the rating-columns retry stays; only the comment changed."
requirements-completed: [STAB-MEDIA-07, STAB-A11Y-03, STAB-SEC-05]
---

# Phase 20 Plan 18: D-33 findings IN-01, IN-02, IN-04, IN-05 Summary

GIF links in rich text keep their trailing punctuation, a broken inline image shows «Изображение недоступно», the acceptance script rejects inherited object keys as labels and prints the leftover work directory, and the ratings fallback is documented with a removal condition.

## Commits

| Commit | Message |
|---|---|
| 2c29cad | test(PORTIA-20-18): add failing tests for GIF link punctuation and inline media fallback |
| 87d7769 | feat(PORTIA-20-18): keep punctuation around GIF links and show fallback for broken inline image |
| 3f7767a | test(PORTIA-20-18): add failing tests for inherited participant labels and dirty teardown path |
| a8a0395 | feat(PORTIA-20-18): reject inherited labels, report dirty teardown dir, point ratings fallback to baseline |

`PLAN_BASE` = a10a768 (commit before Task 1).

## TDD

**RED, Task 1** (`lib/rich-text-media.test.ts`): `embeddedMediaUrl` was moved into `lib/rich-text-media.ts` together with a `splitEmbeddedMedia` that kept the old behavior (media segment covers the whole regex match). Run with `--test-reporter=tap`: 7 tests, 4 pass, 3 fail. The failing tests were the trailing period, the closing parenthesis and the dossier source test, each on the planned assertion. `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target «IN-01: trailing period stays out of the GIF link»). Semantic assessment: the target ran and failed because the media segment included the punctuation. The RED commit includes the behavior-preserving extraction so the module loads; a missing module would have been INVALID_RED.

**RED, Task 2** (`lib/phase19-acceptance.test.ts`): 24 tests, 22 pass, 2 fail. IN-02 failed with `1 !== 2` for `acceptance-shift … cooldown constructor` (the `in` check accepts the inherited key). IN-04 failed because stderr had no residual path. `RED_EVIDENCE_OK`, target «IN-02: an inherited object key is an unknown participant label, not a late failure».

**GREEN:** both tasks, commits 87d7769 and a8a0395. REFACTOR: none.

## Verification

- `npm.cmd test`: 1148 tests, 1145 pass, 0 fail, 3 skipped.
- `npm.cmd exec tsc -- --noEmit`: clean.
- `eslint` on the changed files: 0 errors, 2 `no-img-element` warnings (same rule as before the change). `npm run lint` over the whole repo reports 32 errors in files this plan did not touch; they were left alone (scope boundary).
- `grep -c "function embeddedMediaUrl"` in the dossier: 0. `export function embeddedMediaUrl` in `lib/rich-text-media.ts`: 1. `alt="GIF"`: 0. `splitEmbeddedMedia` in the dossier: 2.
- `git diff a10a768..HEAD -- app/portia.css components/portia-desktop-media.tsx`: empty.
- `git diff a10a768..HEAD -- lib/portia-employees.ts`: comment lines only (3 added, 1 removed).
- `grep "in manifest.nicknames"` in the script: 0; `Object.hasOwn(manifest.nicknames`: 1.

## Findings disposition (for 20-10 Task 3)

| Finding | Status | Evidence |
|---|---|---|
| IN-01 | Fixed | 87d7769; tests in `lib/rich-text-media.test.ts`; fallback text, onError and Russian alt asserted by the source test |
| IN-02 | Fixed | a8a0395; test «IN-02: an inherited object key …» |
| IN-04 | Fixed | a8a0395; NTFS comment on `credentials.json` and `device-secret`, dirty teardown prints `[PORTIA_STAGING:residual] рабочий каталог не удалён: <path>` and nothing else; test «IN-04 …» |
| IN-05 | Disposition, not a fix | Production is unavailable by project rules, so the fallback cannot be removed. The comment in `lib/portia-employees.ts` points to `supabase/migrations/20261101000000_portia_baseline.sql` (add column if not exists). Removal condition: the owner confirms production applied the baseline; then drop the retry, `ratingsSaved` and `ratingsPending`. Production was not checked in phase 20. |

## Deviations from Plan

**1. [Rule 3 - Blocking] RED commit carries the extraction.** Writing the new module's test against a missing file would be a load failure, so `lib/rich-text-media.ts` came with the first commit in its old behavior. No behavior change.

**2. Note on IN-02 coverage.** `labelPattern` (`^[a-z0-9-]{1,24}$`) already filters `valueOf`, `toString` and `__proto__` as usage errors, so `constructor` is the one inherited key that reached the `in` check. The test covers `constructor` across cooldown, deadline, retake and rank. `valueOf`, `toString` and `__proto__` were not tested separately.

**3. Task 1 tracer gate.** After GREEN, the verify commands (`rich-text-media` and `dossier-parts` tests, `tsc`) passed, so expansion continued to Task 2.

The new `embedded-rich-media-unavailable` span has no CSS: `app/portia.css` belongs to 20-01/20-08 and was not touched. It renders as plain inline text.

## Known Stubs

None.

## Threat Flags

None.

## TDD Gate Compliance

RED (`test(PORTIA-20-18)`) precedes GREEN (`feat(PORTIA-20-18)`) for both tasks.

## Self-Check: PASSED

Files and commits were verified before this entry was appended.
