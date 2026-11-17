---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 07
subsystem: editor-ui
tags: [permissions, editor, tabs, PERM-01, PERM-02, browser-harness]
requires: ["12-05", "12-06"]
provides:
  - "EditorAccessManager tab chips per editor row with per-row PATCH queue and rollback"
  - "12-editor-check.mjs --check chips and --check all (tabs, revert, chips)"
affects: [12-08]
tech-stack:
  added: []
  patterns: [per-row request queue in refs (wanted lists + busy set), harness fake PATCH answered inside the browser]
key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-editor-check.mjs
key-decisions:
  - "Queue state lives in refs (wanted lists, busy set, confirmed lists); only the displayed lists and row notes are React state"
  - "After an OK answer the loop resends only when the owner's wanted lists are a different object than what was sent, so a server that normalizes the answer cannot cause a resend loop"
  - "D-04 line is rendered once under the whole list (plan's reading), inside the list container"
status: complete
commits: 2
plan_head_before: 6cd769bc01f78c75e32ae2982e4fb003454390cc
plan_head_after: 6dbd44efbc520074c28b834773b81ab89873f73f
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
completed: 2026-10-26
---

# Phase 12 Plan 07: Owner tab chips Summary

The owner now switches an editor's tabs from the «Доступ» list: seven chips under each email, one click saves the full lists on its own, quick clicks never overlap, errors put the chip back, and before the SQL the chips wait disabled with one line.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Tracer: chips, one click saves the full lists, `chips` check (a) | 07c6d4b |
| 2 | Per-row queue, rollback, pre-SQL state, `chips` (b)-(e), `--check all` | 6dbd44e |

## What was built

- `components/portia-editor.tsx` `EditorAccessManager`: `EditorAccount` carries `closedTabs`/`grantedTabs`; `tabsEnforced` state from GET `/api/editors`. Under each email a `role="group"` of `access-tab-chip` buttons (registry order, `aria-pressed`, «✓ » prefix when open, disabled while `!tabsEnforced`). Open state comes from `openTabIds` (regular: not closed; trusted: granted, D-25). A click toggles the id, normalizes both lists to registry order, updates the row at once and calls `flushRow`. `flushRow` keeps one PATCH in flight per email, resends the latest wanted lists after an answer if the owner clicked meanwhile, shows «Сохранено» (1.8 s, timers cleared on unmount) or the server error / «Нет связи с сервером. Попробуйте ещё раз.» in the row's `role="status"`, and rolls the row back to the last confirmed lists on error. `loadEditors` keeps the local lists of any row with a request in flight. One line «Вкладки по редакторам заработают после применения SQL» under the list when `!tabsEnforced` and the list is not empty. A new grant reloads the list with empty lists, so every chip is on. No ВСЕ/НИЧЕГО, no «Доступ» chip.
- `app/portia.css`: `.access-tab-chips`, `.access-editor-list .access-tab-chip` (beats the red revoke rule; pressed accent, unpressed grey and struck through, disabled, focus-visible), `.access-tab-note`; row and its text column may wrap so ОТОЗВАТЬ stays visible on a phone.
- `12-editor-check.mjs`: stub answers GET `/api/editors` from `current.editors`/`current.tabsEnforced`; PATCH `/api/editors` is answered inside the browser only while `current.fakePatch` is set (delay/status/error/code), recorded in `patches` with send and answer times, never forwarded. Every other non-GET is still blocked and fails the check. `chips` covers (a) order, all on, instant flip, one PATCH body `{email, closedTabs:["broadcasts"], grantedTabs:[]}`, «Сохранено»; (b) two quick clicks; (c) 503 pending-database; (d) tabsEnforced false (14 of 14 disabled, line exactly once with two editors); (e) all seven off, row and ОТОЗВАТЬ remain (looked at, never clicked).

## Verification

- `npx tsc --noEmit` clean; `npm test` 405 pass, 0 fail; `npm run build` compiled.
- `npm run lint`: only the 2 known `no-require-imports` errors in the PORTIA-06 check scripts; no warnings from the new code.
- Production build, `--check all --url http://localhost:3124`: `ok: true` for tabs, revert and chips; no "write blocked" reasons.
- Check (b) PATCH times, ms after the first send (fake answer delay 800 ms): first sent 0, answered 808; second sent 809, answered 1616. The second request went out after the first was answered (no overlap), with `closedTabs: ["broadcasts","recycle"]`.
- Acceptance greps: `className="access-tab-chip"` 1; D-04 line 1; `.access-tab-chip` in portia.css 6.
- Production server left up for 12-08: `next start -p 3124 -H 127.0.0.1` (bound to localhost only), PID 14104 (the node process listening on 127.0.0.1:3124; it was restarted once to bind localhost only). http://localhost:3124/ answers 200.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale server after rebuild**
- **Found during:** Task 2. The server started for Task 1 kept serving the old build after `npm run build`.
- **Fix:** stopped and restarted it; the final one is started with `-H 127.0.0.1` so it listens on localhost only (the plan's bare `next start` binds all interfaces).

None otherwise - plan executed as written.

## Pending human check

After the owner's SQL (12-08): in «Доступ», switch two chips of a real editor, reload and reopen «Доступ» (state kept); grant a new test email (all seven on); Tab and Space on the chips with a screen reader (pressed / not pressed); look at the list at phone width (chips wrap, ОТОЗВАТЬ visible). The harness fakes the API, so this needs the applied SQL and a real editor row.

## Known Stubs

None.

## Threat Flags

None. T-12-27 (out-of-order answers): mitigated by one request in flight per row and full lists, proven by check (b). T-12-28: per-row «Сохранено» or error with rollback. T-12-29: PATCH answered in the browser, every other non-GET blocked.

## Self-Check: PASSED

- Files modified exist: components/portia-editor.tsx, app/portia.css, 12-editor-check.mjs.
- Commits 07c6d4b and 6dbd44e are on design/stage-1-desktop.
