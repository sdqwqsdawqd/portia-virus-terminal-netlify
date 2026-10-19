---
phase: 03-redaktor
plan: 08
subsystem: editor
tags: [editor, sync, revision, optimistic-concurrency, broadcasts, gap-closure]
status: complete

requires:
  - phase: 03-redaktor
    provides: "plan 03-07: format panel and editor state this plan builds on"
provides:
  - "GET /api/content answers older than the tab's known revision, or sent before a save started, are dropped"
  - "PUT carries the revision of the editor draft's baseline, so a stale draft gets 409 (D-07 conflict text)"
  - "Broadcasts and info sections are edited and deleted by id; a delete drops its formattedText entry and closes the format panel on that item"
affects: []

plan_head_before: ffa08bb68b15858bcd91dec25c084fa75337ac51
plan_head_after: 7c50bf00c3526966399055f426e49980c90b99ea

actuals:
  tokens: 6000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Monotonic revision gate on GET: knownRevision + savesStarted refs, decision in lib/content-sync.ts"
    - "Draft-owned base revision: baseRevision ref follows the clean-draft sync and each successful save"
    - "Id-addressed draft edits via updateById; FormatTarget.onCommit (the field's onChange) inherits the id addressing"

key-files:
  created:
    - lib/content-sync.ts
    - lib/content-sync.test.ts
    - lib/editor-items.ts
    - lib/editor-items.test.ts
  modified:
    - components/portia-desktop.tsx
    - components/portia-editor.tsx

key-decisions:
  - "03-08: GET answers older than the tab's known revision, or sent before a save started, are dropped (lib/content-sync.ts); the PUT carries the revision of the draft's baseline"
  - "03-08: broadcasts and info sections are edited by id (lib/editor-items.ts); deleting one drops its formattedText"

requirements-completed: [EDIT-02]

metrics:
  duration: ~15 min
  completed: 2026-10-14
---

# Phase 03 Plan 08: Broadcast vanish and duplicate fixes Summary

A saved post can no longer be reverted by a late poll or a stale CDN copy (monotonic revision gate in `acceptFetchedContent`), a stale draft on a second device now gets the existing 409 conflict text instead of overwriting, and every post or info-section edit, including the format panel's stored commit, finds its item by id.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Revision gate on GET, base revision owned by the draft (tracer) | 382b8b6 | lib/content-sync.ts, lib/content-sync.test.ts, components/portia-desktop.tsx, components/portia-editor.tsx |
| 2 | Posts and info sections edited by id; delete drops formatting | 7c50bf0 | lib/editor-items.ts, lib/editor-items.test.ts, components/portia-editor.tsx |

## What changed

- `lib/content-sync.ts`: `acceptFetchedContent(revision, knownRevision, savesAtSend, savesNow)` = `savesAtSend === savesNow && revision >= knownRevision`.
- `components/portia-desktop.tsx`: `knownRevision` / `savesStarted` refs; `fetchContent` records `savesAtSend` before the request and drops rejected answers before any `setContent` / `setRevision` / localStorage write (the `finally` still ends the loader); the cache branch seeds `knownRevision`; `saveContent(next, baseRevision)` counts the save before the PUT, sends `baseRevision`, sets `knownRevision` and state to the saved revision and returns it. The 409 branch and catch are unchanged. `PortiaEditor` gets `revision={revision}`.
- `components/portia-editor.tsx`: `revision` prop, `onSave(content, baseRevision) => Promise<number>`, `baseRevision` ref that moves only in the clean-draft sync effect (deps `[content, dirty, revision]`) and after each successful save.
- `lib/editor-items.ts`: `updateById`, `removeBroadcast`, `removeInfoSection`. The Информация (title, body, delete) and Сообщения (type, title, body, published, delete) handlers use them. `closeFormatterFor(key)` closes the panel when it targets the deleted item. Reorder, push add and unshift add are unchanged.

## TDD

- Task 1 RED: `lib/content-sync.test.ts` failed (module missing, 72 pass / 1 fail). GREEN: 78 pass.
- Task 2 RED: `lib/editor-items.test.ts` failed (module missing, 78 pass / 1 fail). GREEN: 82 pass.

## Verification

- `npx tsc --noEmit`: exit 0 (both tasks)
- `npm run lint` run alone: exit 0 (both tasks)
- `npm test`: 82 pass, 0 fail
- `npm run build`: exit 0 (Task 2)
- `git diff --quiet HEAD -- app/api/content/route.ts lib/portia-cdn.ts netlify.toml next.config.ts`: exit 0
- Node source checks: "revision sync OK" (re-run after Task 2 too) and "id-based posts OK". No check needed changes; the code matched the plan's exact text.

## Human check: PENDING

Task 2 human-check (owner login, two devices, real 30 s polls, writes to the production row) has not been run. Steps and expected results are in 03-08-PLAN.md Task 2 `<human-check>`:
(1) a saved «ТЕСТ 1» news post survives >30 s and a reload, exactly once; (2) with ✎ open on «ТЕСТ 1», adding two posts and then styling changes only the selected word in «ТЕСТ 1»; (3) deleting removes exactly the clicked post, the panel stays on «ТЕСТ 1» after an empty post is deleted and closes when «ТЕСТ 1» is deleted; (4) PC saves «ТЕСТ ПК», the phone's older unsaved draft then shows «КТО-ТО СОХРАНИЛ РАНЬШЕ — СКОПИРУЙТЕ ПРАВКИ И ОБНОВИТЕ СТРАНИЦУ» and does not overwrite.

## Warning for the owner: next dev and the CDN

- Local `next dev` (PC on localhost, phone over LAN) and the live site read and write the same production Supabase row (portia_content, id main). Every save from `next dev` is a production save.
- A save from `next dev` cannot purge the Netlify CDN (no NETLIFY_PURGE_API_TOKEN locally; purgeCacheTag swallows the error). /api/content is cached with s-maxage=300 and stale-while-revalidate=86400, so the live site can serve the pre-save copy for minutes. A tab that already knows a newer revision now ignores that copy, but a fresh visitor still sees it, and an editor opened on it gets the conflict message when saving (no overwrite). CDN/cache settings were left as they are.
- «Правки из `next dev` сразу записываются в рабочую базу сайта, но кэш CDN они не сбрасывают: живой сайт может ещё несколько минут показывать старую копию. Проверяйте на тестовых сообщениях и удаляйте их после проверки.»

## Deviations from Plan

None. The plan was executed as written. The Task 1 node check was run from a scratch file with the same text instead of inline `node -e`. The result is the same.

## Known limits (from the plan, unchanged)

- Same-revision answers are accepted. A hand-reset DB row with a lower revision is ignored by tabs whose cache is higher, until site data is cleared (T-03-26, accepted).
- Viruses, mutations and recycle files are still index-addressed (outside these gaps). The orphan formatting entries already in the live DB stay, because this plan makes no DB writes.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/content-sync.ts, lib/content-sync.test.ts, lib/editor-items.ts, lib/editor-items.test.ts
- FOUND: 382b8b6, 7c50bf0 (ancestors of HEAD)
