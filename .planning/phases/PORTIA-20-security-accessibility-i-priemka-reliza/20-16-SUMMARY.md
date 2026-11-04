---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 16
subsystem: ui
tags: [info, phone, navigation, a11y, keyboard, focus, playwright, tdd]
requires:
  - phase: PORTIA-20
    provides: 20-05 candidate conventions and production-build e2e on port 3100 (PORTIA_E2E_BASE_URL); 20-06 phone touch-target and back-button conventions
provides:
  - "lib/info-phone-nav.ts: infoNextTarget, toggleInfoExpanded, revealInfoForSearch, infoOverviewVisible (pure, 11 unit tests)"
  - "Phone-only «Информация»: vertical list, expandable sections with aria-expanded, article as its own screen with «←», «Далее: …» in the flow, search reveal"
  - "e2e spec (chromium-phone, webkit-phone, chromium-desktop) and candidate frames before/after with sha256 in 20-INFO-PHONE-EVIDENCE.md"
affects: [20-14, 20-11]
status: complete
key-files:
  created:
    - lib/info-phone-nav.ts
    - lib/info-phone-nav.test.ts
    - tests/e2e/specs/info-phone-nav.spec.ts
    - tests/e2e/visual-candidates/info-phone.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-INFO-PHONE-EVIDENCE.md
  modified:
    - components/portia-desktop.tsx
    - app/portia.css
key-decisions:
  - "The phone layout is switched by useSyncExternalStore over matchMedia(max-width: 900px) (server snapshot false), not by an effect with setState; PC markup stays identical (no data-info-screen, no «←», no «Далее»)."
  - "«←» stays in the document flow instead of position: sticky: .app-window clips on a phone (existing note at .editor-save-chip), so sticky cannot hold while the page scrolls; being the first row of the article it is still the only control above the text."
  - "The stale strip is rendered once per visible phone screen, as a sibling before .info-index on the list and inside the article on the article screen, so it never counts as a list record."
  - "A search hit is revealed from openSearchResult (event handler): the list screen is shown and revealInfoForSearch's section is added to the opened set, before the existing hit effect looks for [data-search-hit]."
requirements-completed: []
duration: ~2h30m
completed: 2026-11-04
actuals:
  tokens: 12500
  tasks: 3
  commits: 5
plan_head_before: 92123f32cafd38e888440a64c8de340f7705c6ea
plan_head_after: b51b914
---

# Phase 20 Plan 16: «Информация» on a phone as a list-navigation Summary

On a phone (max-width 900px) «Информация» is a top-to-bottom list of sections; a section with subsections opens its group (aria-expanded, an «Обзор раздела» row for its own text), an article opens as its own screen with a single «←» («Назад к разделам») that returns the list and the focus to the item, «Далее: [заголовок]» ends an article inside its section, and a global-search hit shows the list with its section opened. The PC view is unchanged.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Tracer: list, article screen, «←» with focus return (+ before frames) | 6168a23 |
| 2 | Expand/collapse, «Далее», search reveal (TDD) | RED 7261a0f, GREEN 18ff790, component 4219446 |
| 3 | After frames, PC unchanged, evidence log | b51b914 |

Before frames were taken at 8fdbf8d, before any source edit (the working tree for components and CSS was clean). PLAN_BASE for `search-click.spec.ts` is 92123f3; `git diff --stat 92123f3..HEAD -- tests/e2e/specs/search-click.spec.ts` is empty.

## TDD evidence

- RED (7261a0f): `node --experimental-strip-types --test --test-reporter=tap lib/info-phone-nav.test.ts` exit 1, 11 of 11 failed on `nav.infoNextTarget is not a function` (namespace import against an empty stub, so the file links and the tests fail on the missing API). `gsd check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: valid RED, the tests ran and failed on the absent functions, not on an import or syntax fault.
- GREEN (18ff790): 11 pass, 0 fail. No REFACTOR commit.

## Evidence

Production build on port 3100 (`PORTIA_E2E_ALLOW_HTTP=1`, `PORTIA_E2E_BASE_URL`), server stopped afterwards; port 3000 (another session) untouched. Details, sha256 and the per-project table are in `20-INFO-PHONE-EVIDENCE.md`.

- `info-phone-nav.spec.ts` on chromium-phone, webkit-phone, chromium-desktop: 5 passed, 22 skipped (8 phone-only on desktop, 2 PC-only on phone lanes, 12 BLOCKED (DATA)).
- `search-click.spec.ts -g info` (3 projects): 3 passed; `app-states.spec.ts` «Информация» (chromium-phone, chromium-desktop): passed.
- `npm test` 1261 tests, 1258 pass, 0 fail, 3 skipped; `tsc --noEmit` clean; eslint on touched files 0 errors.
- `apps.spec.ts` before and after: 5 failed / 5 passed both times, the same five apps (including «Информация»); pixel diff of the saved `*-actual.png` shows the «Информация» window unchanged (200 px in the wallpaper corner, same magnitude as untouched apps).
- Candidate frames: open and article, before and after, chromium-phone and webkit-phone (CAPTURED); expanded and next (after) BLOCKED (DATA).

## Deviations from Plan

**1. [Rule 3 - Blocking] Verify command.** `npm run test:e2e:candidates -- <file>` runs the whole `visual-candidates` directory and port 3000 is held by another session; ran each spec file on its own against a production build on 3100 (as in 20-19/20-05).

**2. [Rule 1 - Bug in my own change, fixed before commit] Stale strip counted as a list record.** The first placement of the strip inside `.info-index` added a button to `.info-index button`, which `app-states.spec.ts` counts as records; the strip moved to a sibling before the `aside` (commit 4219446).

**3. [Design] «←» not sticky.** The plan said `position: sticky; top: 0`. `.app-window` clips its content on a phone, so sticky cannot hold; the button is the first row of the article in the flow (44x44, opaque panel), the heading starts below it at rest. It remains the only control above the text, but it scrolls away with a long article; the way back is then at the top.

**4. [Check wording] "after rows ≥ 8".** The plan's node check counts only `*.candidate.json`; BLOCKED rows are `*.blocked.json`. After has 4 candidate + 4 blocked = 8 rows; the literal command would print 4. Not worked around.

**5. [Local look, not evidence].** To see expansion, «Далее», keyboard and search, a throwaway copy of the spec stubbed three subsections into «Классификация» (deleted, not committed): 16 passed, 2 skipped on both phone projects. Nothing from it is recorded as evidence.

**Total deviations:** 1 blocking (environment), 1 self-fix, 1 design departure, 1 check-wording note, 1 local look.

## BLOCKED / not proven

- BLOCKED (DATA): the target serves 4 info sections and none has subsections, so D-29 (expand/collapse, marker column), D-31 («Далее» position, inside-section, absent in the last subsection, «Обзор раздела»), keyboard on subsections, D-32 (search reveal from list and from article) and the frames info-phone-expanded / info-phone-next are **not proven on target data**. The committed spec skips them with the BLOCKED (DATA) text and will run when a source with a section of two or more subsections is used.
- Physical phone (20-14, INFO-PHONE-*): not done here; no PASS claimed.
- Approved PC snapshot `application-information--chromium-desktop.png` fails on this target before and after (same as four other apps); 20-16 neither fixed nor worsened it.

## Known Stubs

None.

## Threat Flags

None. T-20-16 held: titles are rendered only as React text (`dangerouslySetInnerHTML` count 0), «Далее» is computed from the loaded content by a pure function that never leaves the section. T-20-SC: no packages installed.

## Requirements

STAB-A11Y-02 and STAB-A11Y-03 stay open: the data-dependent behavior is BLOCKED (DATA) and the physical keyboard/phone checks belong to 20-14.

## Self-Check: PASSED

Files exist: lib/info-phone-nav.ts, lib/info-phone-nav.test.ts, tests/e2e/specs/info-phone-nav.spec.ts, tests/e2e/visual-candidates/info-phone.spec.ts, 20-INFO-PHONE-EVIDENCE.md. Commits 6168a23, 7261a0f, 18ff790, 4219446, b51b914 are ancestors of HEAD. `tests/e2e/visual/__screenshots__` has no changes. (`rev-list` over the base counts 6: the extra one is another session's 19-22 docs commit.)
