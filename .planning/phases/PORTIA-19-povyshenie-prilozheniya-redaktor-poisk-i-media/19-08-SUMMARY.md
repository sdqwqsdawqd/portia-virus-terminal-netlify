---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 08
subsystem: ui
tags: [app-state, skeleton, fatal-panel, empty-state, stale-banner, iframe-timeout, nextjs]
requires:
  - phase: 19-01
    provides: lib/app-state.ts contract, AppStaleBanner, contentSync/retryContent on «База вирусов»
  - phase: 19-05
    provides: owner decision 4 (fail-closed «Доступ закрыт» text), the first inline denied panel
provides:
  - AppFatalPanel, AppSkeleton (7 shapes), AppDeniedPanel in components/portia-desktop-states.tsx
  - emptyCopy (7 keys), iframeFailureCopy, iframeLoadTimeoutMs in lib/app-state.ts
  - employeesSync/retryEmployees: roster keeps its last-good list and shows the stale strip
  - Таблица/Устав: skeleton until onLoad, fatal panel after 15s, retry remounts the frame
affects: [19-12, 19-14]
status: complete
actuals:
  tokens: 38000
  tasks: 3
  commits: 6
plan_head_before: a2e5996462a69180d669350dd281765238d4bdbf
plan_head_after: ea728b15a7e5dfe196e6cd0f58b099e80bce26d9
tech-stack:
  added: []
  patterns:
    - "One appViewState call per window; window bodies only choose what to draw (skeleton / fatal / empty / stale strip + content)"
    - "contentFatal(illustration) and contentStaleBanner are the two shared render helpers of the /api/content apps; the roster has its own sync state and literal components"
    - "A late onLoad beats the 15s timeout: the iframe stays mounted under the fatal panel"
key-files:
  created: []
  modified:
    - lib/app-state.ts
    - lib/app-state.test.ts
    - components/portia-desktop-states.tsx
    - components/portia-desktop.tsx
    - components/portia-desktop-documents.tsx
    - components/portia-editor.tsx
    - app/portia.css
    - lib/portia-desktop.test.ts
    - lib/window-open.test.ts
key-decisions:
  - "Device-cached data counts as loaded: the cache effects set contentSync/employeesSync lastGoodAt (the cache time, or \"\" when unknown) so a cached start never flashes a skeleton, and contentSyncFailed never discards a time the state already knows."
  - "Only the newest /api/content request may start a failure (contentRequestSeq): a late timeout cannot put a stale strip over data a newer request delivered."
  - "A degraded roster answer is still shown; it raises the stale strip with the snapshot time. Only degraded === false counts as a complete roster and moves lastGoodAt."
  - "Skeleton footprints follow the real elements (full-width news cards, 65px rows, 176px tiles) rather than the 340px card width written in the UI-SPEC table, so the layout does not shift."
requirements-completed: []
requirements-advanced: [STAB-DESK-08, STAB-APP-01, STAB-APP-02, STAB-APP-03, STAB-APP-04, STAB-APP-05, STAB-APP-06, STAB-APP-10]
---

# Phase 19 Plan 08: States for all eight apps Summary

Every data window of PORTIA OS now tells loading, empty, populated, stale and fatal apart through one `appViewState` rule: a skeleton with the footprint of the real rows, the shared `empty-state` copy, last-good data under a stale strip, and a fatal panel with the reason and «Повторить загрузку» when nothing can be shown; «Таблица» and «Устав» get a skeleton until the frame loads and a fatal panel with retry and the external link after 15 seconds.

## Performance

- **Duration:** not measured (single session)
- **Tasks:** 3 of 3, each as a red test commit followed by a green feature commit
- **Files:** 0 created, 9 modified

## Accomplishments

- `lib/app-state.ts`: `emptyCopy` (archive, employees, news, quests, info, guide, trash), `iframeFailureCopy`, `iframeLoadTimeoutMs = 15_000`; `contentSyncFailed` keeps a time that is already known. The test table walks all eight app ids through the same `appViewState`.
- `AppFatalPanel`: reason from `failureCopy` (or the iframe phrase), the alert role wraps only the reason so a retry never re-announces it, the button reads «Загружаем…» and is disabled while running. `AppSkeleton`: seven shapes, `aria-busy`, shown after 150 ms, shimmer only under `data-motion="full"`. `AppDeniedPanel`: «Доступ закрыт» plus one optional fixed line, no buttons.
- «База вирусов», «Сотрудники», «Информация», «Справочник», «Сводка», «Корзина» each have a skeleton, fatal, empty and stale branch; selection, search and scroll keys are untouched, so a poll or a stale strip does not reset them. «Сотрудники» keep the last-good roster when `/api/employees` fails or answers degraded, with `retryEmployees` ignoring a second click while running.
- «Таблица»/«Устав»: `frameState` + `frameKey`, timer cleared on load, retry and unmount, retry remounts the frame; `sandbox={embedSandbox}`, zoom and wheel handlers unchanged.
- The permanent delete of a recycled record (editor) says «Запись будет удалена навсегда, её не восстановить.» and refuses with «Не удалять».

## Task Commits

1. Task 1 RED: `0898ce5` test(19-08): pin empty copy, fatal panel, skeleton CSS and the guide state wiring
2. Task 1 GREEN: `84e18bf` feat(19-08): fatal panel and skeleton in Справочник, shared empty copy and iframe timeout constants
3. Task 2 RED: `144e4f2` test(19-08): pin state branches in all data windows, roster failure handling and the permanent-delete confirmation
4. Task 2 GREEN: `f168c76` feat(19-08): loading, empty, stale and fatal states in archive, roster, info, news and trash
5. Task 3 RED: `995cd8c` test(19-08): pin the iframe skeleton/timeout/retry contract and the denied panel
6. Task 3 GREEN: `ea728b1` feat(19-08): skeleton until onLoad, fatal panel after 15s and AppDeniedPanel for embedded documents

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` (= `npm test`): 975 tests, 972 pass, 0 fail (3 skipped, pre-existing). `lib/app-state.test.ts`, `lib/portia-desktop.test.ts`, `lib/broadcasts.test.ts`, `lib/portia-employees.test.ts`, `lib/window-open.test.ts` and `lib/accent-theme.test.ts` all green with no existing expectation changed except the `frameLoading` name pin.
- `npm exec tsc -- --noEmit` clean. `npm run lint`: 0 errors, 18 pre-existing warnings (no new ones). `npm run build` passes.
- `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts`: 37 pass; `node scripts/phase15-visual-manifest.mjs --verify-promotion`: 33 owner-approved snapshots verified (`--verify` was not run).
- Acceptance greps: `appViewState(` in portia-desktop.tsx = 6; the two old strings «В базе пока нет вирусов» and «Квестов и задач пока нет» = 0; `iframeLoadTimeoutMs` in documents >= 1; `sandbox={embedSandbox}` = 2 (document frame and YouTube frame, as before); `export function AppDeniedPanel` = 1.
- NOT verified in a real browser (BLOCKED for 19-14, not a pass): the 320px wrapping of the strip and the fatal panel, skeleton-to-data layout shift, the real 15 s iframe timeout against Google Sheets/GitHub Pages, shimmer in the three motion modes, PC and phone verdicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `lib/window-open.test.ts` pinned the old `frameLoading` state name**
- **Found during:** Task 3 (red commit)
- **Issue:** the D-06 test requires `frameLoading` to be state of `EmbeddedDocument`; the plan replaces it with `frameState`/`frameKey`.
- **Fix:** the name list is now `zoom`, `ctrlHeld`, `frameState`, `frameKey`; the intent (state lives in the window body, not in PortiaDesktop) is unchanged.
- **Files modified:** lib/window-open.test.ts
- **Commit:** 995cd8c

**2. [Rule 2 - Missing critical] Permanent-delete confirmation lives in `components/portia-editor.tsx`, which the plan's file list omits**
- **Found during:** Task 2
- **Issue:** the desktop «Корзина» window is read-only (no restore or delete control exists there); the irreversible delete is the editor's `УДАЛИТЬ НАВСЕГДА` dialog, which said «нельзя отменить» and offered the generic «ОТМЕНА».
- **Fix:** text now «Запись будет удалена навсегда, её не восстановить.», the refusal button is «Не удалять» (UI-SPEC bans a generic cancel in confirmations); the action label «УДАЛИТЬ НАВСЕГДА» is kept. No other editor dialog was touched.
- **Files modified:** components/portia-editor.tsx
- **Commit:** f168c76

**3. [Rule 1 - Bug] Cached data would have shown a skeleton, and a late failure could cover newer data**
- **Found during:** Task 1
- **Issue:** `appViewState` needs `hasData`; the 19-01 state only set `lastGoodAt` after a poll, so a cached start was "loading" until the first answer. A timed-out earlier request finishing after a successful newer one could raise a stale strip over fresh data.
- **Fix:** the cache effects mark data as loaded (`lastGoodAt` = cache time or ""), `contentSyncFailed` keeps a known time, and `contentRequestSeq` lets only the newest request start a failure.
- **Files modified:** components/portia-desktop.tsx, lib/app-state.ts
- **Commit:** 84e18bf

### Process note

A Python helper used for some edits wrote CRLF into LF source files, which broke an editor source test that matches `\n`. All touched files were normalized back to LF before the commits; the commits contain LF only.

## Gaps and assumptions

- **Requirements are advanced, not completed.** STAB-DESK-08 and STAB-APP-10 also need the permission-denied row proven per app and the browser matrix (19-14). Here `denied` is the constant `false` for the eight public apps: none of their data is permissioned, so `AppDeniedPanel` is built and tested but not wired into them (19-12 uses it). STAB-APP-01..06 keep their validated behavior (existing tests unchanged) and gain the new states; the browser evidence is 19-14.
- **STAB-APP-05:** the desktop «Корзина» has no restore or delete control at all, so "not rendered without editor" holds trivially; the editor (which only an editor can open) holds the actions and now carries the explicit confirmation.
- **«Сотрудники» skeleton** is 8 list rows plus a profile block; the window is a list and profile, not a 34-slot grid, so no 34-place layout was added or measured.
- **«Сводка»** treats empty per tab (news / quests) with `emptyCopy[broadcastTab]`; the fatal and stale states use the whole broadcast list.
- **Search window** still uses `LoadingState`; its states belong to the search plans.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-19-19 (no restore/delete control without editor) is covered by a source test; T-19-20 (`sandbox={embedSandbox}`, two frames) by a source test; T-19-SC: no package was installed.

## Self-Check: PASSED

- Files found: lib/app-state.ts, lib/app-state.test.ts, components/portia-desktop-states.tsx, components/portia-desktop-documents.tsx, components/portia-desktop.tsx, components/portia-editor.tsx, app/portia.css, lib/portia-desktop.test.ts, lib/window-open.test.ts.
- Commits found: 0898ce5, 84e18bf, 144e4f2, f168c76, 995cd8c, ea728b1.
