---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 06
subsystem: ui
tags: [promotion, participant, reviewer, css, a11y, playwright-candidates]
requires:
  - phase: PORTIA-20
    provides: 20-01 template builder inside portia-promotion.tsx (kept working); 20-04 and 20-19 candidate conventions and the port 3100 production-build approach
provides:
  - "Participant cards with a written state badge, one highlighted next step, a reason label and a stale note beside the action"
  - "Gate loading/error notes that keep the typed nickname; zero-results line in history"
  - "Reviewer 409 with both alternatives, queue retry button, 44px touch targets on phone"
  - "E4 candidate frames (empty/loading/error/refused gate, PC and phone) and BLOCKED rows for every state that needs data or a reviewer role"
affects: [20-10, 20-11, 20-14]
status: complete
key-files:
  created: []
  modified:
    - components/portia-promotion.tsx
    - components/portia-promotion-editor-main.tsx
    - app/portia.css
    - tests/e2e/visual-candidates/promotion.spec.ts
key-decisions:
  - "New styles are two appended blocks (participant, reviewer) placed before the existing media blocks; existing rules stay because lib tests pin them (11px labels, 40px editor buttons)."
  - "The request button keeps the exact shape canRequest && <button (a source test pins it); the stale reason is a separate paragraph, not a wrapper."
  - "409 alternatives reuse the editor's wording: 'Загрузить их версию' reloads queue/banks, 'Оставить мой ввод' dismisses; forms own their drafts, so input is never cleared on error."
  - "E4 evidence uses only holds/aborts of the real request plus the target's own 404 for an unlisted nickname; no own /api route is fulfilled with invented data."
requirements-completed: []
duration: ~1h45m
completed: 2026-11-04
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 17215b3a8bae286e537c56f656048ff280a7884e
plan_head_after: 937e8eb93b9118171dfcc6ececf87df78cd42bbb
---

# Phase 20 Plan 06: Promotion participant and reviewer redesign Summary

Participant cards now say in words whether the step is available, running or blocked and why, highlight a single next action on the dark palette (12/14/18/28px, 4px spacing), and the reviewer editor gets a 409 panel with both alternatives, a queue retry and 44px phone targets; order, tabs, the manual verdict, confirmations and the API are untouched.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Participant clear next step and safe states | 7a857dd |
| 2 | Reviewer queues and editors on PC/phone | 937e8eb |

CSS and the candidate spec are shared by both tasks; they were committed with Task 1 (the reviewer CSS block and BLOCKED rows are in 7a857dd), Task 2 commit holds `portia-promotion-editor-main.tsx`.

## What changed

- `components/portia-promotion.tsx`: badge «ДОСТУПНО СЕЙЧАС / ПОКА НЕДОСТУПНО / В ПРОЦЕССЕ», label «Почему сейчас нельзя» above the reason, `data-next` on the first card that can request (`nextKind`), note «Отправка недоступна, пока состояние не обновится» when the action is disabled by stale, gate notes («Проверяем ник. Введённый ник сохранён.», «Введённый ник сохранён. Нажмите «Проверить ник»…»), «Результатов пока нет» line. Date formatting, eligibility texts, API calls, D-23 builder entry unchanged.
- `components/portia-promotion-editor-main.tsx`: `conflict` state set on a 409 from reviewer/bank commands, panel with «Загрузить их версию» and «Оставить мой ввод»; «Повторить загрузку» on a failed queue load.
- `app/portia.css`: participant block (card grid, badge, next-step border, wrapping, task list scroll) and reviewer block (44px tabs/filters, conflict panel, wrapping), 900px media gets 44px targets for list rows, actions, back button, inputs.

## Evidence

Production build served on 3100 (`PORTIA_E2E_ALLOW_HTTP=1`, stopped afterwards).

- `npx playwright test tests/e2e/visual-candidates/promotion.spec.ts --project=chromium-desktop --project=chromium-phone --retries=0`: 16 passed. Frames under `tests/e2e/visual-candidates/.runs/phase15-current-17215b3a8bae/promotion-e4-gate-{empty,loading,error,refused}--*.png`. Checks: nickname kept (64 chars), «ПРОВЕРЯЕМ…» while the lookup is held, aborted request gives the temporary-unavailable alert plus repeat note, the target's own 404 for an unlisted nickname shows its reason, touch targets at least 44x44, no page or window horizontal scroll. A source contract test pins order, one request button, no private reviewer fields, tab order, 409 alternatives, fonts 12/14/18/28 and 4px spacing in the new blocks.
- `npx playwright test tests/e2e/specs/template-builder.spec.ts --retries=0` (regression, all projects): 35 passed.
- `node --experimental-strip-types --test lib/portia-promotion.test.ts lib/portia-promotion-ui.test.ts`: 59 pass, 0 fail (date without «..» and reason texts unchanged); `lib/portia-promotion-editor.test.ts`: 37 pass; `npm test`: 1232 tests, 1229 pass, 0 fail, 3 skipped; `tsc --noEmit` clean; eslint on touched files clean; visual-manifest test and `--verify-promotion` pass (33 approved snapshots untouched).

## Deviations from Plan

**1. [Rule 3 - Process] Throwaway layout look, not evidence.** To see populated participant cards (long task, three results, eligible state) I ran a scratch script in the scratchpad that stubbed the status GET locally. Nothing from it is committed or recorded as evidence; it only showed no overflow, one `data-next`, 44px buttons on PC and phone. The committed spec fulfills no own /api route.

**2. [Scope note] Reviewer 409.** The Promotion editor has no revision-based save conflict; its 409s are claim-conflict, stale-preview and insufficient-pool. The two alternatives panel was added for any 409 and keeps input (forms own drafts, cleared only on success). Not exercised live (BLOCKED ENV).

**3. Files.** `portia-promotion-ordinary-editor.tsx` / `qualification-editor.tsx` were not touched (not in `files_modified`); bank count, add task/question and «Сохранить банк» behave as before, covered only by the existing unit tests.

**Total deviations:** 1 process note, 2 scope notes.

## BLOCKED / not proven

- BLOCKED (DATA): E4 populated, partial (no promotion row), stale/denied, history 0/1/3, long task text inside a card. Recorded as `promotion-e4-*.blocked.json`; need the isolated roster.
- BLOCKED (ENV): all E5 live frames (queue empty/loading/error, PC and phone detail, 409, denied, bank count/add/save). Recorded as `promotion-e5-*.blocked.json`; need the reviewer identity (19-21). Not replaced by mocks.
- Keyboard/sticky overlap on a physical phone, owner visual verdict (STAB-VIS-04) and physical keyboard/phone checks (STAB-A11Y-02/03, REG-01..REG-04 in 20-14) are not proven here.

## Known Stubs

None.

## Threat Flags

None. T-20-06 held: no reviewer data reaches the participant component (source test), the percent still does not decide, order and tabs unchanged. T-20-SC: no packages installed.

## Requirements

STAB-VIS-04, STAB-A11Y-02, STAB-A11Y-03 stay open (data/role frames BLOCKED, owner verdict and physical-device checks pending).

## Self-Check: PASSED

Files present: the four modified files and this SUMMARY. Commits 7a857dd and 937e8eb are ancestors of HEAD.
