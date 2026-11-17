---
phase: 15-baseline
plan: 02
subsystem: testing
tags: [playwright, axe, node-22, browser-matrix, target-guard]

requires:
  - phase: 15-baseline
    provides: immutable package baseline and explicit owner release from plan 15-01
provides:
  - exact Playwright 1.64.1 and axe 4.14.0 browser-test toolchain
  - bounded five-project browser matrix with production Next.js server
  - fail-closed isolated Supabase mutation guard with redacted errors
  - clean-checkout npm and browser-install reproducibility proof
affects: [15-03-role-contracts, 15-04-candidates, 15-05-visual-approval]

tech-stack:
  added: ["@playwright/test@1.64.1", "@axe-core/playwright@4.14.0"]
  patterns: [portable supported runtime, visitor-versus-mutation lanes, exact-version browser evidence]

key-files:
  created:
    - playwright.config.ts
    - tests/e2e/README.md
    - tests/e2e/fixtures/target-guard.ts
    - tests/e2e/specs/tooling.spec.ts
    - lib/e2e-target-guard.test.ts
  modified:
    - package.json
    - package-lock.json
    - .gitignore
    - .planning/phases/PORTIA-15-baseline/evidence/15-DIRTY-OWNERSHIP.md

key-decisions:
  - "Use official portable Node 22.13.1 for evidence rather than changing the owner's system Node installation."
  - "Keep visitor lanes local/read-only and block every role or mutation lane until an isolated Supabase identity is confirmed."
  - "Separate candidate capture from approved visual comparison; never auto-update snapshots."

patterns-established:
  - "Browser axes are five bounded projects; actor roles are fixtures rather than a cartesian project matrix."
  - "Mutation setup validates confirmation, environment, project ref, production denylist and HTTPS host before navigation."

requirements-completed: [STAB-BASE-02]

duration: 8min
completed: 2026-10-30
---

# Phase 15 Plan 02: Browser Toolchain Summary

**Pinned Playwright/axe tooling, a five-project PORTIA OS browser matrix and a fail-closed mutation target boundary now reproduce from a clean checkout.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-30T10:53:00+05:00
- **Completed:** 2026-10-30T11:01:13+05:00
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Installed exact devDependencies `@playwright/test@1.64.1` and `@axe-core/playwright@4.14.0` without Motion or unrelated lockfile churn.
- Defined `chromium-desktop`, `chromium-dpr125`, `firefox-desktop`, `webkit-phone` and `chromium-phone` with Russian locale, Moscow timezone, dark scheme and production server startup.
- Added a tested mutation guard that refuses missing, unconfirmed, production-listed and identity-mismatched Supabase targets without reflecting sensitive values.
- Proved `npm ci`, pinned browser installation and five-project listing from detached clean commit `7a33160a59554de2773085a5d31ac17788a85235`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Establish the approved Node and package starting point** - `4619d36`
2. **Task 2: Install exact browser-test dependencies and define bounded projects** - `bd8e5b5`
3. **Task 3: Add the fail-closed target guard and prove clean installation** - `7a33160`

**Plan metadata:** included in the plan completion commit.

## Files Created/Modified

- `package.json`, `package-lock.json` - exact Playwright/axe devDependencies and four browser commands.
- `playwright.config.ts` - five bounded projects, production web server, artifact retention and reporters.
- `.gitignore` - private auth state and run artifacts ignored while approved snapshots/evidence remain trackable.
- `tests/e2e/README.md` - runtime, projects, commands, artifact and staging safety contract.
- `tests/e2e/fixtures/target-guard.ts` - redacted fail-closed mutation target validation.
- `lib/e2e-target-guard.test.ts` - deterministic guard rejection and acceptance coverage.
- `tests/e2e/specs/tooling.spec.ts` - non-browser smoke contract proving each configured project loads.
- `.planning/phases/PORTIA-15-baseline/evidence/15-DIRTY-OWNERSHIP.md` - released package hashes and supported runtime proof.

## Decisions Made

- The host Node `v24.21.0` was not used for Phase 15 package evidence. Official Node `v22.13.1` ran from a temporary portable directory after SHA-256 verification (`398a61e250a5584a62a5959e2f69f5d597fc83f1a5ebe3ed8fff29ba39d55f14`).
- Browser revisions tied to Playwright 1.64.1 are Chromium `1248` (`156.0.8078.4`), Firefox `1555` (`157.0`) and WebKit `2370` (`27.2`).
- Candidate capture and approved screenshot comparison use distinct scripts; no script or config contains `--update-snapshots`.
- Role/mutation lanes require explicit isolated staging. Their absence is `BLOCKED`, never proof by skip.

## Clean-Checkout Proof

Detached worktree: `7a33160a59554de2773085a5d31ac17788a85235`.

Commands executed under Node `v22.13.1`:

```text
npm ci
playwright install chromium firefox webkit
playwright test --list
```

Result: 371 packages installed; pinned browsers installed successfully; five tests/projects listed; clean worktree status remained empty. The disposable worktree was then safely removed. The original worktree retained only the previously recorded withheld paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Host runtime was outside the repository engine**

- **Found during:** Task 1
- **Issue:** System Node was `v24.21.0`, while evidence requires `22.13.x`.
- **Fix:** Downloaded the official portable Windows Node `v22.13.1` archive, verified its official SHA-256 and executed all package/test commands through it without changing system PATH permanently.
- **Files modified:** none in the repository.
- **Verification:** `node --version` reported `v22.13.1`; released package hashes matched the owner ledger.
- **Committed in:** `4619d36` (evidence record)

**2. [Rule 3 - Blocking] npm full install attempted unrelated lock metadata normalization**

- **Found during:** Task 2
- **Issue:** A Windows full install tried to remove existing cross-platform `libc` metadata from the lockfile.
- **Fix:** Restored the lockfile through `apply_patch` and generated dependency resolution with package-lock-only mode, retaining a minimal dependency-only diff.
- **Files modified:** `package-lock.json`
- **Verification:** Final diff contains only exact Playwright/axe entries and the required `axe-core` update.
- **Committed in:** `bd8e5b5`

**3. [Rule 3 - Blocking] Empty Playwright suite made `test --list` fail**

- **Found during:** Task 2
- **Issue:** Playwright returns non-zero when no tests are present.
- **Fix:** Added a non-browser `STAB-BASE-02` tooling smoke test, listed exactly once for each bounded project.
- **Files modified:** `tests/e2e/specs/tooling.spec.ts`
- **Verification:** `playwright test --list` reports five tests in one file.
- **Committed in:** `bd8e5b5`

**4. [Rule 1 - Bug] Unsupported config key and strip-only syntax**

- **Found during:** Task 3
- **Issue:** `passWithNoTests` was not a Playwright 1.64.1 config property, and a TypeScript parameter property failed Node 22 strip-only execution.
- **Fix:** Removed the obsolete config key and used an explicit readonly class field.
- **Files modified:** `playwright.config.ts`, `tests/e2e/fixtures/target-guard.ts`
- **Verification:** production build, guard tests and full unit suite pass under Node 22.13.1.
- **Committed in:** `7a33160`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug).
**Impact on plan:** All fixes were required for reproducibility and kept product behavior/source unchanged.

## Issues Encountered

- npm 11.19 reported an install-script approval warning for existing optional package `unrs-resolver`; installation and all checks still completed successfully. No approval or script execution policy was changed.
- Lint reports 18 pre-existing warnings and 0 errors; warnings are baseline evidence, not silently repaired in this tooling plan.

## User Setup Required

Mutation-capable role tests remain blocked until a dedicated non-production Supabase project and its safe environment values are supplied. Visitor/read-only lanes require no external setup.

## Next Phase Readiness

- Plan 15-03 can build diagnostics, fixtures and role contracts on the pinned runner.
- The target guard is ready to be called before navigation, auth-state creation or fixture mutation.
- Physical phone selection, isolated Supabase credentials and owner/Figma approvals remain honest later gates.

---
*Phase: 15-baseline*
*Completed: 2026-10-30*
