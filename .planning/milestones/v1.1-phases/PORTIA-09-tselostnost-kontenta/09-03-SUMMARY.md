---
phase: PORTIA-09-tselostnost-kontenta
plan: 03
subsystem: api
tags: [normalizer, content-integrity, netlify, revision-gate, node-test]

requires:
  - phase: PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh
    provides: owner content export and the read-only backup check style
provides:
  - lib/content-limits.ts shared limit constants and utf8Bytes
  - non-cutting coercing normalizer with textOf and stable derived ids
  - byte-measured PUT /api/content body guard at 5 MB
  - strict revision gate for the 10 s poll
  - old-cache-safe changedDossierTabs
affects: [09-04, 09-05, 09-06, 09-07]

actuals:
  tokens: 8250
  tasks: 3
  commits: 6

plan_head_before: a812352b5ebd2ea10ed177a68ce6bc048584f7f5
plan_head_after: e7b8c5a292f4f2aee169bcf6b9a1c8a91544e2f1
commits: 6

tech-stack:
  added: []
  patterns:
    - "normalization coerces shape and never cuts user content; limits only drive editor warnings"
    - "derived ids are position based, use '-' only and are unique per list"

key-files:
  created:
    - lib/content-limits.ts
    - .planning/phases/PORTIA-09-tselostnost-kontenta/09-check-normalize-backup.mjs
  modified:
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - app/api/content/route.ts
    - lib/editor-changes.ts
    - lib/editor-changes.test.ts
    - lib/content-sync.ts
    - lib/content-sync.test.ts

key-decisions:
  - "Derived ids index the list after non-object entries are dropped, so a second normalization keeps them"
  - "Broadcast conditions stay string-only (a number becomes \"\") to keep the existing test; only title, body and virus text use textOf"
  - "The backup check compares scientist logs capped at MAX_SCIENTIST_LOGS per virus because that cap is intentional (D-25)"

requirements-completed: [SYNC-01, CONT-01, CONT-02, CONT-04, CONT-08]

duration: 25min
completed: 2026-10-25
status: complete

coverage:
  - id: D1
    description: "Normalizer keeps runs, run text, formatted keys, conditions, text blocks, table rows, blocks and subsections whole"
    requirement: CONT-01
    verification:
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#runs, run text and formatted keys beyond the old caps are kept whole"
        status: pass
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#tables, blocks and rows beyond the old caps are kept whole"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner's 2026-10-19 export passes the normalizer with no loss, idempotent, 161242 bytes against the 5 MB limit"
    requirement: CONT-01
    verification:
      - kind: other
        ref: "node --experimental-strip-types 09-check-normalize-backup.mjs <export> (exit 0, idempotent true)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PUT /api/content measures UTF-8 bytes and answers 413 only above 5 MB"
    requirement: CONT-01
    verification: []
    human_judgment: true
    rationale: "No route test exists and the plan forbids calling PUT /api/content; verified by grep of the guard line only"
  - id: D4
    description: "Wrong-typed text fields become text, blank ids get stable position ids, quests and tasks are never important"
    requirement: CONT-02
    verification:
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#wrong-typed virus fields are coerced and missing records are filled"
        status: pass
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#a broadcast with a missing or blank id gets a stable position id"
        status: pass
      - kind: unit
        ref: "lib/portia-content-normalize.test.ts#only news can be important"
        status: pass
    human_judgment: false
  - id: D5
    description: "changedDossierTabs does not throw when recycledViruses is missing"
    requirement: CONT-08
    verification:
      - kind: unit
        ref: "lib/editor-changes.test.ts#changedDossierTabs treats a missing recycledViruses as empty"
        status: pass
    human_judgment: false
  - id: D6
    description: "An equal revision from the poll is dropped so undo history survives; a newer one and a 409 reset are still taken"
    requirement: SYNC-01
    verification:
      - kind: unit
        ref: "lib/content-sync.test.ts#the same revision is dropped so a poll never replaces the content and undo survives"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 03: Server-side content integrity Summary

**Non-cutting coercing content normalizer with shared raised limits, a 5 MB byte-measured save guard and a strict-newer poll gate**

## Performance

- **Duration:** 25 min
- **Completed:** 2026-10-25T11:31:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `lib/content-limits.ts` holds the ten limit constants and `utf8Bytes`; the normalizer no longer cuts runs, run text, formatted keys, conditions, text blocks, table rows and cells, blocks, subsections or subsection titles. Media links (2048), formatted keys over 240 characters and scientist logs (5) are still cut on purpose.
- `textOf` coerces text slots of news, quests and viruses; viruses get complete `ppu` and `classification` records, non-object virus entries are dropped instead of throwing, blank ids become `broadcast-<i>` / `virus-<i>` / `recycled-<i>` (never containing ':'), and only news can be important.
- `PUT /api/content` guards `utf8Bytes(raw) > MAX_CONTENT_BODY_BYTES` (5 MB, 1 MB under Netlify's 6 MB buffered limit).
- `acceptFetchedContent` takes only a strictly newer revision, so the 10 s poll never swaps the content object.
- `09-check-normalize-backup.mjs` run on the owner's export: every count and text length equal before and after, `idempotent true`, 161242 bytes of 5 000 000, exit 0.

## Task Commits

1. **Task 1 (tracer): keep content whole, shared limits, byte guard** - RED `fa8b42c` (test), GREEN `cecae1e` (fix)
2. **Task 2: coercion, derived ids, no important quests, old-cache diff** - RED `16b2314` (test), GREEN `caa3dd7` (fix)
3. **Task 3: strict revision gate** - RED `ead02f2` (test), GREEN `e7b8c5a` (fix)

## TDD Gate Compliance

Each task has a `test(09-03)` commit before its `fix(09-03)` commit. RED evidence: Task 1 failed 5 target tests on the planned values (500 vs 600, 4000 vs 40100, 50 vs 62, 100 vs 105, 20000 vs 250000); Task 2 failed 5 target tests (title `{}` stayed `{}`, ids undefined, quests important, null mutation threw `Cannot read properties of null`, `recycledViruses is not iterable`); Task 3 failed the 2 gate tests (actual true, expected false). The virus and dossier RED entries fail by the crash the plan names as the bug, which is the intended reason. The `gsd_run check tdd-red-evidence` classifier was not run (`workflow.tdd_mode` is not enabled in config).

## Files Created/Modified
- `lib/content-limits.ts` - shared limit constants, `utf8Bytes`
- `lib/portia-content-normalize.ts` - non-cutting normalizer, `textOf`, derived ids, shape-checked virus normalization
- `lib/portia-content-normalize.test.ts` - rewritten cutting tests, new coercion/id/important tests
- `app/api/content/route.ts` - byte-measured body guard
- `lib/editor-changes.ts` / `.test.ts` - `recycledViruses ?? []`, old-cache test
- `lib/content-sync.ts` / `.test.ts` - strict revision gate
- `.planning/phases/PORTIA-09-tselostnost-kontenta/09-check-normalize-backup.mjs` - read-only export check, numbers only

## Decisions Made
See key-decisions. Derived ids use the post-filter position; a real duplicate id is left alone; scientist-log ids are coerced but not derived.

## Deviations from Plan

None - plan executed exactly as written. The RED tests were committed separately from the GREEN fix (two commits per task) as the TDD reference requires, where the plan named one commit per task.

## Issues Encountered
None.

## Known Stubs
None.

## Threat Flags
None. The route guard change only tightens an existing boundary (T-09-05); no new endpoints or file access.

## Next Phase Readiness
Server and lib halves of SYNC-01, CONT-01/02/04/08 are in place. The desktop render and cache path (09-04), editor warnings and «+» limits (09-05) and the editor type switch (09-06) can import `lib/content-limits.ts`. Branch note: the owner's browser check for the undo half is 09-07.

## Self-Check: PASSED

Files exist (`lib/content-limits.ts`, `09-check-normalize-backup.mjs`); commits `fa8b42c`, `cecae1e`, `16b2314`, `caa3dd7`, `ead02f2`, `e7b8c5a` are ancestors of HEAD; `npm test` pass 261 fail 0; `npx tsc --noEmit` clean; backup check exit 0.
