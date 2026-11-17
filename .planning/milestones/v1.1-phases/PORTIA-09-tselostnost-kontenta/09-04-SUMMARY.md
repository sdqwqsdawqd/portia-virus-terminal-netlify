---
phase: PORTIA-09-tselostnost-kontenta
plan: 04
subsystem: ui
tags: [react, normalizer, localstorage-cache, content-integrity, quest-status]

requires:
  - phase: PORTIA-09-tselostnost-kontenta
    provides: "09-03 normalizePortiaContent, strict revision gate (acceptFetchedContent), MAX_CONTENT_BODY_BYTES"
provides:
  - "desktop cache read and 10 s poll both go through normalizePortiaContent; null is ignored"
  - "poll checks the revision before normalizing; an equal revision is a no-op"
  - "ВАЖНО class and suffix on news only"
  - "visitor's local day known from the first render (lazy useState)"
affects: [09-05, 09-06, 09-07]

actuals:
  tokens: 1400
  tasks: 2
  commits: 2

plan_head_before: 31ae9f97f886ddfd5ed65fcbca3fcdd9f79c3265
plan_head_after: 0e772203994524672ab7e5197f5460c538a224ad
commits: 2

tech-stack:
  added: []
  patterns:
    - "one shared normalizer for network and device cache; null means ignore"
    - "revision gate runs before normalization so an unchanged poll does no work"

key-files:
  created: []
  modified:
    - components/portia-desktop.tsx

key-decisions:
  - "Lazy useState(() => localDateKey(new Date())) passes the React Compiler lint, so no module-level currentDayKey helper was needed"
  - "The stale comment mentioning normalizeInfoSections near the YouTube embed now names normalizePortiaContent, so the grep acceptance count is 0"

requirements-completed: [CONT-02, CONT-04, CONT-07, CONT-08, SYNC-01]

duration: 2min
completed: 2026-10-25
status: complete

coverage:
  - id: D1
    description: "Cache and poll both read through normalizePortiaContent; a cache the normalizer rejects is ignored; accept check precedes normalization in fetchContent"
    requirement: CONT-08
    verification:
      - kind: other
        ref: "grep normalizePortiaContent(parsed.content)=1, normalizePortiaContent(payload.content)=1, old helpers=0; npx tsc --noEmit clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "Quests and tasks never show the ВАЖНО class or suffix on the desktop"
    requirement: CONT-04
    verification:
      - kind: other
        ref: "grep 'item.type === \"news\" && item.important'=1, old suffix expression=0; npx eslint components/portia-desktop.tsx 0 errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dated quest badge shows its final text on the first painted frame"
    requirement: CONT-07
    verification: []
    human_judgment: true
    rationale: "No DOM render harness exists; today is lazily initialised and the code is lint/tsc/build clean, but the first-paint claim is confirmed by the owner in 09-07"
  - id: D4
    description: "An equal-revision poll returns before setContent, setRevision and the cache write"
    requirement: SYNC-01
    verification:
      - kind: unit
        ref: "lib/content-sync.test.ts#the same revision is dropped so a poll never replaces the content and undo survives"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 04: Desktop reads content through the shared normalizer Summary

**The desktop cache and 10 s poll now share normalizePortiaContent (revision gate first), ВАЖНО shows on news only, and the visitor's day is known from the first render**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-25T13:42:34Z
- **Completed:** 2026-10-25T13:44:21Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `fetchContent` computes the revision and runs `acceptFetchedContent` first, then `normalizePortiaContent(payload.content)`; a null result returns, and `finally` still marks content ready.
- The device cache read uses `normalizePortiaContent(parsed.content)`; an unusable cache is ignored and the network copy is used. The local `isUsableContent` shape check is deleted.
- Broadcast cards use one `important = item.type === "news" && item.important` for both the class and the «ВАЖНО» suffix.
- `today` starts from `useState(() => localDateKey(new Date()))`; the 1 s tick still rolls it over at midnight. The save comment names `MAX_CONTENT_BODY_BYTES` (5 MB).

## Task Commits

1. **Task 1 (tracer): shared normalizer for cache and poll, news-only ВАЖНО** - `ac744c2` (fix)
2. **Task 2: lazy today, save comment names the new guard** - `0e77220` (fix)

## Files Created/Modified
- `components/portia-desktop.tsx` - cache and poll through `normalizePortiaContent`, news-only «ВАЖНО», lazy `today`, updated save comment

## Decisions Made
See key-decisions. The tracer gate (`end-of-phase`, automated-only verify) was satisfied by re-running `npx tsc --noEmit` and eslint on the file after the commit-ready state; both passed before expansion.

## Deviations from Plan

None - plan executed exactly as written. One comment elsewhere in the file (the YouTube embed note) named `normalizeInfoSections`; it was reworded to `normalizePortiaContent` so the plan's grep for the old names prints 0.

## Issues Encountered
None. Gates: `npm test` pass 272 fail 0; `npx tsc --noEmit` clean; `npx eslint app lib components` 0 errors (14 existing img warnings); `npm run build` exit 0.

## Known Stubs
None.

## Threat Flags
None. The change only routes the existing cache and poll inputs (T-09-09) through the normalizer; no new endpoints or file access.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Desktop half of SYNC-01 and CONT-02/04/07/08 is in code. The editor limits and warnings (09-05), type switch (09-06) and the owner's browser check of first-paint quest status and undo (09-07) remain.

## Self-Check: PASSED

`components/portia-desktop.tsx` exists; commits `ac744c2` and `0e77220` are ancestors of HEAD; all task acceptance greps re-run (cache 1, poll 1, old helpers 0, accept before normalize, news-only 1, old suffix 0, lazy today, `Up to 2 MB` 0, `MAX_CONTENT_BODY_BYTES` 1); test/tsc/eslint/build green.
