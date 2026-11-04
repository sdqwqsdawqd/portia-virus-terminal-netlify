---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 19
subsystem: search
tags: [search, keyboard, recommendations, accent-insensitive, e2e, tdd]
requires: []
provides:
  - globalSearchKeyAction (Ctrl/Cmd+K only) for the document keydown handler
  - pickSearchRecommendations / seededRandom / newRecommendationSeed
  - normalizeSearch without U+0301
affects: [components/portia-desktop.tsx, lib/search-index.ts, lib/search-recommendations.ts]
tech-stack:
  added: []
  patterns: [seedable RNG injected into a pure picker, useSyncExternalStore for a client-only per-load value]
key-files:
  created:
    - lib/search-recommendations.ts
    - lib/search-recommendations.test.ts
    - tests/e2e/specs/search-global-keys.spec.ts
  modified:
    - lib/search-index.ts
    - lib/search-index.test.ts
    - components/portia-desktop.tsx
    - lib/portia-desktop.test.ts
key-decisions:
  - "Per-load recommendation seed is read through useSyncExternalStore (server snapshot null, client snapshot cached at module level) instead of setState in an effect, which the React lint rule rejects; the server and the first client render still match."
  - "Chosen recommendations keep the editor order; a changed list re-picks over the new list with the same seed."
requirements-completed: [STAB-SEARCH-07, STAB-SEARCH-05, STAB-SEARCH-06]
status: complete
duration: ~1h (includes waiting on a busy port 3000)
completed: 2026-11-04
actuals:
  tokens: 14000
  tasks: 3
  commits: 6
plan_head_before: ee7d56d7030b71c6748f5716c79ec22f3f198b04
plan_head_after: 45458aa
---

# Phase 20 Plan 19: Search keys, random recommendations, accent-insensitive search Summary

ArrowUp in fields and on the empty desktop no longer opens the global search (Ctrl/Cmd+K is the only global call), the search shows a random 5-10 of the editor's recommendations per page load, and the combining acute accent no longer affects matching.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | D-44/D-46 global key action (tracer) | RED edfb7e6, GREEN 64ed649 |
| 2 | D-43 random recommendations | RED fd4c3d4, GREEN b280a7c |
| 3 | D-37 accent-insensitive search | RED 2180ed6, GREEN 45458aa |

## TDD evidence

- **Task 1 RED:** `node --experimental-strip-types --test --test-reporter=tap lib/search-index.test.ts` exit 1; 3 D-44 tests failed (`globalSearchKeyAction is not a function`), 16 existing passed. `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK`. Semantic assessment: the target failed on the missing function (reached through a namespace import so the module still linked), not on an import or syntax fault.
- **Task 2 RED:** `lib/search-recommendations.test.ts` exit 1; all 7 D-43 tests failed (`seededRandom is not a function`) against an empty stub module. `RED_EVIDENCE_OK`. Semantic assessment: valid, the tests ran and failed on the absent API.
- **Task 3 RED:** 2 of 3 D-37 tests failed on the real assertions (accent not stripped); the third (only U+0301 removed) already passed and is a regression guard. `RED_EVIDENCE_OK`.
- No REFACTOR commits.

## Verification

- `npm test`: 1158 pass, 0 fail. `tsc --noEmit`: clean.
- ESLint on every file touched: no errors from this plan. Full `npm run lint` reports 62 problems (32 errors), all pre-existing in other files and unchanged by this plan.
- E2E (production build served on port 3100, `PORTIA_E2E_BASE_URL`), `search-global-keys.spec.ts` + `search.spec.ts` on chromium-desktop and chromium-phone: 16 passed, 4 skipped (all "A phone takes over Enter alone"). D-43 ran against real content (not skipped as BLOCKED (DATA)). `search.spec.ts` unchanged.
- Acceptance greps: `globalSearchKeyAction` in portia-desktop.tsx present; `inInput: false, query` 0; `pickSearchRecommendations` present; `content.searchRecommendations.map` 0; `dangerouslySetInnerHTML` 0; `u0301` in search-index.ts 1; D-44/D-37 in search-index.test.ts present. Existing searchKeyAction tests unchanged (diff vs plan base has no removed lines).

## Deviations from Plan

**1. [Rule 3 - Blocking] Source-text tests in lib/portia-desktop.test.ts**
- **Found during:** Task 2 (`npm test`)
- **Issue:** Two tests asserted the old shape: two `searchKeyAction(searchKeyContext(event, {` call sites (window handler + global shortcut) and `content.searchRecommendations.map(`. Both are directly superseded by D-46 and D-43 (the plan's own acceptance requires the `.map` count to be 0).
- **Fix:** Updated them to expect one `searchKeyAction` site, one `globalSearchKeyAction(event)`, and `shownRecommendations.map(`; renamed the second test.
- **Files modified:** lib/portia-desktop.test.ts (not in the plan's files_modified)
- **Commit:** b280a7c

**2. [Rule 1 - Bug] setState in effect rejected by lint**
- **Found during:** Task 2
- **Issue:** The planned "seed in useState set in an effect" triggers the React `set-state-in-effect` error.
- **Fix:** `useSyncExternalStore(subscribeNothing, pageRecommendationSeed, serverRecommendationSeed)`; behavior matches the plan (null on server and first render, one seed per page load).
- **Commit:** b280a7c

**3. Test technique (RED).** The D-44 RED used a namespace import so the missing export fails a test rather than module linking (which would be INVALID_RED); the GREEN commit switched it to a normal named import on its own import line, keeping the original import line untouched.

**4. Environment.** Port 3000 was held by another session's `next dev`, so Playwright could not start its own server. I built (`npm run build`) and served `next start` on port 3100 with `PORTIA_E2E_BASE_URL`, then stopped that server. The other session's dev server was left alone.

## Known Stubs

None.

## Threat Flags

None. T-20-22 (no innerHTML, recommendations rendered through FormattedText) and T-20-23 (global handler reacts to Ctrl/Cmd+K only; defaultPrevented, IME and qualification guards kept) are mitigated and covered by tests.

## Notes

Physical keyboard acceptance remains in 20-14 (SEARCH-01..03).

## Self-Check: PASSED

Files exist (lib/search-recommendations.ts, lib/search-recommendations.test.ts, tests/e2e/specs/search-global-keys.spec.ts, SUMMARY); commits edfb7e6, 64ed649, fd4c3d4, b280a7c, 2180ed6, 45458aa are ancestors of HEAD.
