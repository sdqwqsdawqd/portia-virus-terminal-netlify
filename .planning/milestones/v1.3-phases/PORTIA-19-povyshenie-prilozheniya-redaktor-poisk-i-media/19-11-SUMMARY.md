---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 11
subsystem: ui
tags: [search, allowlist, privacy, keyboard, highlight, playwright]
requires:
  - phase: 19-01
    provides: 19-OWNER-DECISIONS.md verdicts 3 (search keyboard), 8 (Устав by name), 9 (Корзина kept)
  - phase: 19-10
    provides: PortiaImage baseline (6ac8603)
provides:
  - lib/search-index.ts (buildSearchIndex, matchSearch, normalizeSearch, searchKeyAction, searchKeyContext, rosterDegradedText, broadcastType, recycleFileType, recycleFileBody)
  - searchHit state, data-search-hit / aria-current / .search-hit in every owner app
  - tests/e2e/specs/search.spec.ts (5 tests x 5 projects)
affects: [19-14]
status: complete
actuals:
  tokens: 17000
  tasks: 3
  commits: 5
plan_head_before: 6ac86039cb2e9574368546375accaff90c270227
plan_head_after: ab7dd8fa9f12a14e4c1635c8459f9c980e9636a7
tech-stack:
  added: []
  patterns:
    - "Index = one pure function over typed allowlist inputs (SearchVirus, SearchEmployee, ...): a field that is not named in the input type or the function is unfindable; the SECRET-field test feeds extra fields through `as never` and proves it."
    - "Keyboard = pure searchKeyAction(ctx) + searchKeyContext(event, rest) adapter; the component only carries the action out (modifier reads stay in lib, which keeps the zoom test's single `metaKey` line true)."
    - "Highlight = state {appId,type,id} + one effect (rAF retry to find [data-search-hit], scrollIntoView center, 2400ms timer, pointerdown/focusin inside the owner window after a 400ms grace)."
key-files:
  created:
    - lib/search-index.ts
    - lib/search-index.test.ts
    - tests/e2e/specs/search.spec.ts
  modified:
    - components/portia-desktop.tsx
    - components/portia-desktop-documents.tsx
    - app/portia.css
    - lib/app-state.ts
    - lib/portia-desktop.test.ts
    - lib/window-open.test.ts
key-decisions:
  - "Keyboard per owner verdict 3 (approved table, option A): Ctrl/Cmd+K (also by physical KeyK on a Russian layout), Down/Up between field and results (Up from the field goes to the last result, Up from the first returns to the field), Enter opens (single result from the field), Escape clears then closes. Tab is never handled."
  - "A phone (max-width 900px) takes over Enter only and has no roving tabindex, so an external keyboard can still Tab through every result."
  - "The unavailable-record row keeps its position, shows «Запись недоступна» and is removed on the next input, on the next open, or after 3.2s. It is a safety branch for a click that lands between a poll and the re-render; results are derived from the current content, so a normal poll simply drops the row."
  - "Highlight of the guide card sits on its title (h1), not on the whole page: centering a long page as one block would scroll its top away. An application result marks its own window (data-search-hit on the .app-window, outline only)."
  - "Fade-out: the frame (outline) fades over the last --motion-fast of the 2400ms under motion full; the tint is a background-image layer (row keeps its own background) and leaves with the class at once."
requirements-completed: []
requirements-advanced: [STAB-SEARCH-01, STAB-SEARCH-02, STAB-SEARCH-03, STAB-SEARCH-04]
---

# Phase 19 Plan 11: Global search from an allowlist, exact open and keyboard Summary

Global search is now built by one pure allowlist function (`buildSearchIndex`) instead of inline in `portia-desktop.tsx`, finds nothing private, opens the exact record in its owner app with a 2400ms highlight while the search window stays open, shows honest loading / empty / roster-degraded / unavailable states, and is driven from the keyboard by the approved table (Ctrl/Cmd+K, arrows, Enter, Escape).

## Tasks

| Task | What | Commits |
|------|------|---------|
| 1 tracer | `lib/search-index.ts` + SECRET-field test; component builds results through it; virus result opens, scrolls to and marks the record | 13e59b7, 9b1458e |
| 2 | every type marks its record (virus, employee, info section and sub, guide card, broadcast, trash file and deleted virus, app window); «Запись недоступна»; roster line; 3 skeleton rows with aria-busy | c1b4538 |
| 3 | `searchKeyAction`, one window handler, one global Ctrl/Cmd+K listener, roving tabindex | c1b4538 |
| tests | unit tests (15 + roster), source contracts in `lib/portia-desktop.test.ts`, browser spec | 1698b8b, ab7dd8f |

(Tasks 2 and 3 edit the same JSX block of the search window, so their component code is one commit; their tests are separate.)

## Verification

- `node --experimental-strip-types --test lib/search-index.test.ts lib/window-open.test.ts`: 36 pass, 0 fail (`# fail 0` for search-index).
- `npm test`: 998 pass, 2 fail. Both are the known worktree-only noise: `lib/phase16-guard-boundary.test.ts` (untracked `.claude/hooks/guard.mjs`) and «editor form cards ... (D-15)». No new failures.
- `npm exec tsc -- --noEmit`: only the known `phase16-guard-boundary.test.ts(7,23) TS2307`.
- `npm run lint`: 0 errors (14 warnings, none from this plan's logic; `<img>` and exhaustive-deps warnings pre-exist).
- Build: `npm run build` (Turbopack) is not usable in the worktree (junctioned node_modules, as noted for earlier plans). Equivalent used: `next build --webpack --experimental-build-mode compile` - compiled with no errors, all routes listed.
- Browser lane (`next start -p 3100` from the worktree, stopped afterwards; 3000/3001 untouched), `tests/e2e/specs/search.spec.ts` against the real published content:
  - chromium-desktop 5/5, chromium-dpr125 5/5, firefox-desktop 5/5, chromium-phone 4 pass + 1 skip (Ctrl+K/arrows test is desktop-only by design).
  - webkit-phone: **BLOCKED (ENV)** - `DesktopPage.goto()` times out for every test incl. the existing smoke, as on the base build. Not recorded as a pass.
  - `tests/e2e/specs` on chromium-desktop: 22 passed, 16 skipped (role lanes), 0 failed.
- Not run here (goes to 19-14 with the owner): physical PC and phone verdicts on keyboard feel and highlight legibility; `tests/e2e/visual` (12 pre-existing failures on the base build, out of scope).

## Deviations from Plan

**1. [Rule 3 - Blocking] Existing source tests pinned the old inline index**
- **Found during:** Task 1
- **Issue:** `lib/portia-desktop.test.ts` ("global search covers ... `type: "employee" as const`") and `lib/window-open.test.ts` (`openSearchResult` signature and exactly 7 `openApp(`) asserted the removed inline code.
- **Fix:** rewrote the first around `buildSearchIndex({` / `matchSearch(searchIndex, globalQuery)` / the same collections; the second now pins the new signature and 8 `openApp(` (7 types + the vanished-record branch). Intent unchanged. `lib/window-open.test.ts` was not in the plan's file list.
- **Commit:** 9b1458e

**2. [Rule 3 - Blocking] Zoom test allows exactly one `metaKey` line**
- **Found during:** Task 3
- **Issue:** reading `event.metaKey` in the component for Cmd+K broke "zoom listens to Ctrl, Cmd only on a Mac" (ZOOM-01).
- **Fix:** `searchKeyContext(event, rest)` in `lib/search-index.ts` copies key and modifiers; the component never names `metaKey`.
- **Commit:** c1b4538

**3. [Rule 2 - Missing critical] Time formatting for the roster line**
- **Issue:** the line needs the same time text as the stale banner; it was inlined in `staleBannerText`.
- **Fix:** extracted `syncTimeText` in `lib/app-state.ts` (banner text unchanged, existing tests pass), used by `rosterDegradedText`. `lib/app-state.ts` was not in the plan's file list.
- **Commit:** c1b4538

**4. [Scope] Browser spec added**
- `tests/e2e/specs/search.spec.ts` was not in the plan's file list; added because the highlight, focus and Escape behaviour cannot be proven by source tests alone.

## Plan notes

- Roving tabindex follows the plan's action text; UI-SPEC says "Tab: поле → рекомендации → результаты (обычный порядок, ловушки нет)". With roving, Tab reaches one result and leaves the list, so there is no trap; on a phone the roving is off.
- "Loading" is `!contentReady`. The roster loads separately: until it arrives, results show without employees (no extra loading state for the roster alone).
- App access filter (D-07): `globalSearchApps` is the one list. Every listed app is open to every visitor; «Редактор» (gated by `canEdit`) and the search itself are not in it. «Устав» is found by name only, no iframe indexing (verdict 8). Корзина records stay (verdict 9).
- Info results mark the index button (section or subsection), not the document.

## Known Stubs

None.

## Threat Flags

None. T-19-24 mitigated (allowlist + SECRET test, public sources only); T-19-25 mitigated (access-filtered app list, `openApp` keeps `qualificationLocked`, and `openSearchResult` returns early when locked); T-19-SC: no packages installed.

## Self-Check: PASSED

- Created files present: `lib/search-index.ts`, `lib/search-index.test.ts`, `tests/e2e/specs/search.spec.ts`.
- Commits in history: 13e59b7, 9b1458e, c1b4538, 1698b8b, ab7dd8f.
- `commits: 5` measured with `git rev-list --count 6ac8603..HEAD` before this SUMMARY commit.
