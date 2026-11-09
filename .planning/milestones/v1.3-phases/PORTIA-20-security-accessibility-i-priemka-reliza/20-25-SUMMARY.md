---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 25
subsystem: e2e-and-lint-release-gate
tags: [eslint, playwright, retries-0, diagnostics, fake-clock, gap-closure, owner-waiver]
requires: []
provides:
  - eslint.config.mjs ignores the untracked local agent dirs .agents, .claude, .codex; npm run lint exits 0 (0 errors, 14 warnings)
  - DiagnosticLedger.expectFault(rule) and applyExpectedFaults in tests/e2e/fixtures/diagnostics.ts (per-test, kind + resource type/console source + error text, judged in assertDiagnosticsClean; allowlist unchanged at 11 rows)
  - parkClock helper in tests/e2e/fixtures/determinism.ts
  - order-independent webkit-phone [STAB-MEDIA-03] 15 s test; real-time runFor budget (test.slow) for the 15 s and roster-wait tests
  - 20-PLAYWRIGHT-WAIVERS.md registry PW-01..PW-09 (5 fixed, 3 expected-fault, 1 waiver awaiting the owner)
affects: [20-26, 20-27, 20-30, 20-13]
actuals:
  tokens: 12000
  tasks: 3
  commits: 4
plan_head_before: f227255ce6d0fa5f003c6e74740772718986e841
plan_head_after: 03be5e3b836d26fe1a075bdbc1f44ed954edde57
tech-stack:
  added: []
  patterns: [expected faults registered per test before the action and applied at assertion time, park the fake clock for limits counted in fake seconds, test.slow for steps that spend real time]
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-PLAYWRIGHT-WAIVERS.md
  modified:
    - eslint.config.mjs
    - tests/e2e/fixtures/diagnostics.ts
    - tests/e2e/fixtures/determinism.ts
    - tests/e2e/fixtures/test.ts
    - tests/e2e/specs/media-states.spec.ts
    - tests/e2e/specs/app-states.spec.ts
    - tests/e2e/specs/media-offscreen.spec.ts
    - lib/e2e-diagnostics.test.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
key-decisions:
  - "The webkit-phone [STAB-MEDIA-03] failure was a test defect, not a product defect: page.clock.install() leaves the clock running, so the 15 s PortiaImage timer ticked while the test waited (1 s of slack). components/portia-desktop-media.tsx was NOT touched."
  - "Expected faults are judged at assertion time per test, never through the global allowlist (11 rows, checked by unit test and node command). csp, pageerror and hydration kinds can never be expected."
  - "PW-07 (firefox-desktop page.goto never reached load, once, not reproducible, cause unproven) is a waiver awaiting the owner. The GIF-preload hypothesis was tested and rejected, so no speculative code change was kept."
  - "Production build was served on port 3100 (PORTIA_E2E_BASE_URL) because port 3000 is held by the owner's next dev (PID 3016, untouched)."
requirements-completed: []  # plan requirements: STAB-REL-01, STAB-REL-02, STAB-REL-03, STAB-MEDIA-07. Left open on purpose: PW-07 waiver has no owner verdict and 20-30/20-13 still prove the clean-checkout lint and the release-commit run.
duration: ~77 min
completed: 2026-11-04
status: complete
coverage:
  - id: D1
    description: "npm run lint exits 0 with local untracked tool dirs ignored; tracked code still linted (portia-desktop.tsx warnings visible)"
    requirement: STAB-REL-01
    verification:
      - kind: other
        ref: "npm.cmd run lint -> 14 problems (0 errors, 14 warnings), exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "webkit-phone [STAB-MEDIA-03] 15 s limit test passes in the full file with --retries=0, assertions unchanged"
    requirement: STAB-REL-02
    verification:
      - kind: e2e
        ref: "npm.cmd run test:e2e -- --retries=0 --repeat-each=3 --project=webkit-phone tests/e2e/specs/media-states.spec.ts -> 21 passed, 3 skipped"
        status: pass
    human_judgment: false
  - id: D3
    description: "Diagnostics noise classified without widening the allowlist; final triple run has no [PORTIA_E2E_DIAGNOSTICS]"
    requirement: STAB-REL-03
    verification:
      - kind: e2e
        ref: "triple run 6 on five projects, --retries=0 -> 0 failed, 0 flaky, 67 skipped (BLOCKED (DATA)), 178 passed"
        status: pass
      - kind: unit
        ref: "lib/e2e-diagnostics.test.ts (applyExpectedFaults, expectFault guards, allowlist 11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Waiver PW-07 needs an owner verdict; until then the release gate is FAIL"
    requirement: STAB-REL-02
    verification: []
    human_judgment: true
    rationale: "A waiver is accepted only by the owner with a date; the executor cannot grant it."
---

# Phase 20 Plan 25: Strict lint and Playwright retries=0 readiness Summary

**Full lint is green (0 errors), the webkit-phone 15 s portrait test no longer depends on test order (fake clock was running at real speed), and diagnostics noise is handled by per-test expected faults judged at assertion time with the 11-row allowlist untouched; one unexplained firefox hang stays a waiver awaiting the owner.**

## Performance

- **Duration:** ~77 min (14:12Z to 15:29Z)
- **Tasks:** 3 of 3 (Task 3 produced two commits: code, then registry)
- **Files:** 10 changed (9 modified, 1 created)

## Accomplishments

- **Task 1 (tracer).** Added `.agents/**`, `.claude/**`, `.codex/**` to `globalIgnores` in `eslint.config.mjs` with a comment. Precondition held: `git ls-files .agents .claude .codex` prints nothing, exit 0. Lint before: `62 problems (32 errors, 30 warnings)`, exit 1 (reproduced on this working copy). After: `14 problems (0 errors, 14 warnings)`, exit 0. `portia-desktop.tsx` still appears in the output, so tracked code is still checked. Tracer verify re-run end to end before expansion (commit f7c19d7).
- **Task 2.** Reproduced: full file on webkit-phone `--retries=0` gave 1 failed, 1 skipped, 6 passed; single test passed twice; the pair "404 test then never answers" failed every time at the `loading` assertion after `runFor(14_000)`. Hypotheses: H1 (WebKit errors a held request) rejected, the trace shows both portrait requests held with status -1 and no failure text; H3 (cache between tests) rejected, both requests reached the route handler; H2 confirmed. `page.clock.install()` leaves the clock running, and a probe showed `performance.now()` 3080 ms before `runFor` and 17101 ms after, so the timer armed while the test waited for the window (1.3 s "not stable" after the 404 test against 0.64 s alone) had already used the 1 s of slack. Fix is in the test only: park the clock after the desktop mounts (`parkClock`), prove the request is held (`onHold` from the route handler) and that the 15 s timer is armed, keep every assertion (14 s loading, 15.5 s failed). `components/portia-desktop-media.tsx` was not changed. Results: `--repeat-each=3 --project=webkit-phone` of the file 21 passed, 3 skipped; five projects 33 passed, 7 skipped; later `--repeat-each=4 --workers=1` on webkit-phone 4 passed (commit b704629).
- **Task 3.** `DiagnosticLedger.expectFault(rule)`: rules per test with kind, resource type or console source, text, reason; `assertDiagnosticsClean` removes matches before looking for unexpected entries and attaches `portia-diagnostics-expected-faults` with match counts. `csp`, `pageerror`, `hydration` are refused. Specs register rules before the action; host-name matching on redacted text was removed (a response entry keeps a host, so third-party 404 rules for the charter page stay). Classified and fixed all cases in `20-PLAYWRIGHT-WAIVERS.md` (PW-01..PW-09). Final triple run (media-states, app-states, media-offscreen, five projects, `--retries=0`): 0 failed, 0 flaky, 178 passed, 67 skipped (all BLOCKED (DATA) or the Phase 19 CR-01 inherited gap), no `[PORTIA_E2E_DIAGNOSTICS]` (commit 9830b6c, registry 03be5e3).

## Task Commits

1. Task 1: `f7c19d7` fix(20-25): ignore untracked local agent tooling in eslint
2. Task 2: `b704629` fix(20-25): park the fake clock so the 15s portrait limit no longer depends on test order
3. Task 3: `9830b6c` fix(20-25): per-test expected faults judged at assertion time; real-time runFor budget
4. Task 3 registry: `03be5e3` docs(20-25): PW-01..PW-09 registry

## Registry result (details in 20-PLAYWRIGHT-WAIVERS.md)

| ID | Class | Gist |
|----|-------|------|
| PW-01 | fixed | webkit-phone never-answers: running clock, 1 s slack |
| PW-02 | expected-fault | chromium late events of the aborted own API (identity of the baseline events not captured, indirect evidence, caveat recorded) |
| PW-03 | expected-fault | page.reload cancels images; Firefox "Image corrupt or truncated" with the same reload (evidence in run 4 attachment) |
| PW-04 | expected-fault | remounted charter frame cancels its subresources |
| PW-05 | fixed | charter test timeout: runFor spends real time |
| PW-06 | fixed | portrait minimized test timeout on webkit-phone, same cause; 6 of 6 passed after the fix |
| PW-07 | **waiver, ОЖИДАЕТ ВЛАДЕЛЬЦА** | firefox-desktop page.goto no `load` in 30 s, once, not reproducible |
| PW-08 | fixed | 5 s expect shorter than the real sheet read; BLOCKED (DATA) if it stays degraded |
| PW-09 | fixed | roster waits by design exceed 30 s; test.slow |

The final run exited 0, but PW-07 has no owner verdict, so the release gate is FAIL until the owner decides. This is not recorded as PASS anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] runFor spends real time; parking the clock does not make it cheap**
- **Found during:** Task 3 (media-offscreen baseline 4 timeouts, webkit-phone portrait timeout)
- **Issue:** the plan assumed the flake class was only event races. `runFor` costs real time (probe: running clock `runFor(2000)` 2001 ms on webkit-phone; parked `runFor(14000)` 20.4 s on webkit-phone, 4.0 s on chromium-desktop), so the two 15 s steps of the CR-01 tests exceed the 30 s default.
- **Fix:** `test.slow()` on the CR-01 tests and on the roster tests that wait up to 20 s plus 25 s by design (PW-05, PW-06, PW-09); `parkClock` kept for determinism, called after the window minimize because the minimize finishes from a timer (parking earlier broke it, found in run 1).
- **Files modified:** tests/e2e/specs/media-offscreen.spec.ts, tests/e2e/specs/app-states.spec.ts
- **Commit:** 9830b6c

**2. [Rule 1 - Bug] roster reload test expected the stale strip to clear in 5 s**
- **Found during:** Task 3 (run 5, chromium-desktop and chromium-dpr125)
- **Fix:** wait up to 25 s like STAB-APP-03; if the roster stays degraded the test skips as `BLOCKED (DATA)` instead of failing or passing (PW-08).
- **Commit:** 9830b6c

**3. [Rule 3 - Blocking] shared helper outside the planned file list**
- `tests/e2e/fixtures/determinism.ts` (`parkClock`) and `tests/e2e/fixtures/test.ts` (passes the ledger's expected faults to `assertDiagnosticsClean`) and `lib/e2e-diagnostics.test.ts` (unit tests for the new rules) were touched; they were not in `files_modified` but are required by the planned `expectFault` design and the new helper. `diagnosticAllowlist` and `isAllowed` are unchanged.

**4. Plan acceptance wording**
- The plan says `grep -c "runFor(14000)"` prints 1 on HEAD; the file spells it `runFor(14_000)` (underscore), so the equivalent `grep -cF "runFor(14_000)"` was checked and prints 1.
- The plan expects a PW-02 row about "first failed run"; the baseline attachment was overwritten before the fixture changed, so the identity of the baseline events is not captured. This is stated in PW-02 as indirect evidence.

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3), plus 1 documentation note. **Impact:** all within the plan's goal; the plan's assertions in the tests were never weakened, and no test was skipped to hide a failure (the only new skip is the declared BLOCKED (DATA) path in PW-08).

## Known stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change. T-20-37 mitigations are in place: rules per test, narrow, registered before the action, attachment lists applied rules and match counts, allowlist still 11 rows (unit test plus `node --experimental-strip-types` check), waiver without owner verdict is FAIL. T-20-38: `git ls-files .agents .claude .codex` was empty, lint output still contains tracked files.

## Verification

- `npm.cmd run lint`: exit 0, 14 problems (0 errors, 14 warnings), output contains `portia-desktop.tsx`.
- `npm.cmd exec tsc -- --noEmit`: exit 0.
- `npm.cmd test` equivalent (`node --experimental-strip-types --test lib/*.test.ts`): 1335 tests, 1331 pass, 0 fail (rest skipped).
- allowlist check: `allowlist 11`.
- Playwright: webkit-phone `--repeat-each=3` media-states 21 passed 3 skipped; triple run 6 on five projects 0 failed, 0 flaky, 178 passed, 67 skipped, no `[PORTIA_E2E_DIAGNOSTICS]`.
- Skip counts: media-states baseline on webkit-phone 1 skipped (Phase 19 CR-01 covers), same after. The overall skip count varies 58 to 67 between runs because it depends on live roster data (all declared BLOCKED (DATA)).

## Environment notes

- Port 3000 was occupied by the owner's `next dev` (PID 3016), left running. A production build (`npm run build`, which rewrote `.next`) was served on port 3100 with `PORTIA_E2E_ALLOW_HTTP=1` and the admin variables blanked, and stopped afterwards. Node 22.13.1.
- The working tree still contains pre-existing owner changes (`.planning/milestone.lock`, `.planning/state.json`, untracked dirs); none were staged.

## Next

Ready for 20-26. 20-30 and 20-13 must read `20-PLAYWRIGHT-WAIVERS.md`: PW-07 is a waiver awaiting the owner (FAIL until «принято» and a date). 20-30 should also prove lint in a clean checkout (variant b) as the plan states.

## Self-Check: PASSED

Created files and the four task commits (f7c19d7, b704629, 9830b6c, 03be5e3) exist; no unexpected deletions; lint, tsc, unit tests and the final triple run re-verified above.
