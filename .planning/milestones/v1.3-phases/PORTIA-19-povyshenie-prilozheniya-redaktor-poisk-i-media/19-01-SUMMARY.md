---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 01
subsystem: ui
tags: [app-state, stale-banner, content-sync, owner-decisions, nextjs]
requires:
  - phase: 18
    provides: desktop windows, motion tokens (--motion-fast, --ease-out), fade-in keyframes
provides:
  - lib/app-state.ts pure contract (AppFailure, AppViewState, failureFromResponse, staleBannerText, appViewState, failureCopy, contentSyncFailed, contentSyncSucceeded)
  - AppStaleBanner in components/portia-desktop-states.tsx, wired into the База вирусов dossier area
  - contentSync state and retryContent in portia-desktop.tsx
  - 19-OWNER-DECISIONS.md with 11 owner verdicts
affects: [19-03, 19-04, 19-05, 19-06, 19-08, 19-11, 19-12, 19-13]
status: complete
actuals:
  tokens: 6000
  tasks: 3
  commits: 4
plan_head_before: 0cd849c8d168e8990d51c0ff327de90a333ca272
plan_head_after: a8411f305b098efbc0a9578fbcc286616132ffbe
tech-stack:
  added: []
  patterns:
    - "Pure state module with table-driven node:test; transitions return the same object when nothing changed"
    - "lastGoodRef moves on every good poll without a redraw; state copies it only when a failure starts"
key-files:
  created:
    - lib/app-state.ts
    - lib/app-state.test.ts
    - components/portia-desktop-states.tsx
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-OWNER-DECISIONS.md
  modified:
    - components/portia-desktop.tsx
    - app/portia.css
key-decisions:
  - "Owner approved all 11 agent recommendations on 2026-11-02: staging roster via PORTIA_PROMOTION_STAGING_ROSTER (isolated staging only), local npm run dev over LAN, search keyboard model, fail-closed permission text, Заменить своей without a dialog, PromotionConfirmDialog, draft kept on section revoke, Устав by app name only, Корзина search unchanged, current server texts for promotion participants, qualification warning texts."
  - "appViewState is used for the stale decision; lastGoodAt !== null replaces the separate hasData ref the plan mentioned."
requirements-completed: []
requirements-advanced: [STAB-DESK-08, STAB-APP-10]
---

# Phase 19 Plan 01: Stale contract tracer and owner decisions Summary

When /api/content fails and last-good data exists, База вирусов keeps the data and the selected record and shows a sticky "Не удалось обновить — показаны данные на {время}" strip with a retry that never clears anything; the owner has recorded verdicts for all 11 [PROPOSED] items and phase assumptions.

## Performance

- **Duration:** not measured (single session, includes an owner checkpoint)
- **Tasks:** 3 of 3 (task 3 was the owner decision checkpoint, resolved: approve all recommendations)
- **Files:** 4 created, 2 modified

## Accomplishments

- `lib/app-state.ts` with a 7-test node:test table: failure classes (null/timeout, 5xx, 4xx), fixed failureCopy, stale text (today clock, earlier day plus month, no "Invalid Date" for a tampered savedAt), view-state priority denied > loading > fatal > stale > empty > populated with the 0/1 record boundary, and idempotent sync transitions.
- `fetchContent` now classifies every non-authoritative answer (non-2xx, timeout, reject, missing payload, failed normalize) as a failure and every good answer, including an unchanged revision, as a success. `acceptFetchedContent`, `savesStarted`, `setContentReady` and the editor `saveState` are untouched.
- `retryContent` ignores a second click while running; the button reads "Обновляем…" and is disabled; a failed retry keeps the data and the banner time.
- 11 owner verdicts recorded in 19-OWNER-DECISIONS.md, unblocking 19-03, 19-04, 19-05, 19-06, 19-11, 19-12, 19-13.

## Task Commits

1. Task 1 RED: `c5ec067` test(19-01): pin app view states, failure classes and stale banner text
2. Task 1 GREEN: `67e4df4` feat(19-01): keep last-good data and show a stale strip when /api/content fails
3. Task 2: `7bc63eb` docs(19-01): collect owner decisions
4. Task 3: `a8411f3` docs(19-01): record owner verdicts on the 11 decision items

## Verification

- `node --experimental-strip-types --test lib/app-state.test.ts`: 7 pass, 0 fail.
- `npm test`: 903 tests, 900 pass, 0 fail. `npm exec tsc -- --noEmit` clean. `npm run lint`: 0 errors, 18 pre-existing `<img>` warnings. `npm run build` passes.
- Acceptance greps: `failureFromResponse(` x2, `<AppStaleBanner` x1, "Повторить обновление" x1, `.app-stale-banner` in CSS, no `prefers-reduced-motion` added; `grep -cE "^Вердикт: .+"` prints 11.
- `phase16-staging.mjs scan-evidence` on the phase directory: 0 findings.
- Not verified in a real browser: the 320px wrapping truth (backstop) is CSS-only (`flex-wrap`, `overflow-wrap: anywhere`); visual check belongs to 19-14.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Opaque stale-banner background**
- **Found during:** Task 1
- **Issue:** the plan said to copy the translucent `.promotion-stale` fill, but the banner sits in `.record-view` whose paper is light (`--paper: #f3f0e6`); pale amber text on a translucent dark fill would be unreadable and a sticky strip must hide content under it.
- **Fix:** `background: oklch(.27 .035 80)`; border and text colours as in `.promotion-stale`.
- **Files modified:** app/portia.css
- **Commit:** 67e4df4

**2. [Plan wording] Added sync transition helpers, dropped the separate ref**
- `contentSyncFailed` and `contentSyncSucceeded` (plus `ContentSync` type) live in `lib/app-state.ts` so the idempotency truth is testable; no separate "data really loaded" ref, `contentSync.lastGoodAt !== null` serves as `hasData`.
- **Commit:** 67e4df4

## Requirements

STAB-DESK-08 and STAB-APP-10 are NOT marked complete in REQUIREMENTS.md: this plan proves the stale contract on one app (База вирусов) only. Both close in 19-08 (all 8 apps) and 19-14 (acceptance matrix). The requirements tool marked them on request and that change was reverted.

## Authentication Gates

None.

## Known Stubs

None. The banner is wired only into База вирусов; the other seven apps, fatal, denied and skeleton states are planned for 19-08.

## Threat Flags

None. T-19-01 (tampered savedAt gives no time and no "Invalid Date") and T-19-02 (only a fixed phrase and a time are shown) are mitigated and covered by tests.

## Self-Check: PASSED

- Files found: lib/app-state.ts, lib/app-state.test.ts, components/portia-desktop-states.tsx, 19-OWNER-DECISIONS.md.
- Commits found: c5ec067, 67e4df4, 7bc63eb, a8411f3.
