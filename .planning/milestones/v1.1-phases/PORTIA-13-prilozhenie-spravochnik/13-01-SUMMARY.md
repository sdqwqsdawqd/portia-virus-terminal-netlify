---
phase: PORTIA-13-prilozhenie-spravochnik
plan: 01
subsystem: content-data-layer
tags: [guide, normalizer, editor-rights, tdd]
requires: []
provides:
  - GuideBlock / GuideCard / GuideSection types, findGuide, portiaTextKey.guideBlock
  - PortiaContent.guideSections (default [], old saves read as empty)
  - normalizeGuideSections, shared normalizeTableRows
  - EditorSection "guide" (label «Справочник», right after «Информация»)
  - removeGuideSection / removeGuideCard / removeGuideBlock / moveGuideCard
  - oversizeFields entry КАРТОЧКА «...»
affects: [13-02, 13-03, 13-04, 13-05]
tech-stack:
  added: []
  patterns: [Info normalizer pattern mirrored for guide, per-tab rights via editorSections]
key-files:
  created: []
  modified:
    - lib/portia-content.ts
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - lib/editor-changes.ts
    - lib/editor-changes.test.ts
    - lib/editor-tabs.test.ts
    - lib/editor-items.ts
    - lib/editor-items.test.ts
    - lib/content-limits.ts
    - lib/content-limits.test.ts
decisions:
  - "Guide starts empty (no sample card); shape guard in normalizePortiaContent untouched so old saves load"
  - "Oversize warning checks text and callout blocks only (as the plan says); heading text is not checked"
  - "Photo-heavy guide size: photos are links, existing contentBodyBytes check covers it"
metrics:
  duration: ~25 min
  completed: 2026-10-26
status: complete
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: da0c31d2649b523d1c611256417d4062ddad8a46
plan_head_after: 92bce7345163d1cf931771a5993d9b3cb1e1ecfa
commits: 4
requirements-completed: [P13-SC3, P13-SC4]
---

# Phase 13 Plan 01: Guide data layer and «Справочник» rights Summary

One `guideSections` list (section → cards → six block kinds) that the normalizer reads (old saves read as empty), the Phase 12 per-tab rules treat as the regular tab «Справочник», and draft helpers delete and move.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer, tdd) | guide card through normalize → classify → refuse/accept | e6e54ef (test), 3fbafef (feat) |
| 2 (auto, tdd) | delete/move helpers and oversize warning | 1de2e3a (test), 92bce73 (feat) |

## What was built

- `lib/portia-content.ts`: guide types, `findGuide`, `PortiaContent.guideSections`, `portiaTextKey.guideBlock` (`guide-block:<id>:text`), default `[]`.
- `lib/portia-content-normalize.ts`: `normalizeGuideSections` keeps every string whole; only media links failing the shared rule are blanked (section photo, card cover, photo url) and a non-11-char video id becomes `""`. Unknown block types are dropped. Info table rows moved into the shared `normalizeTableRows` with identical output.
- `lib/editor-changes.ts`: `"guide"` after `"info"` in the type, `editorSections`, `sectionLabels`, `sectionOfKey` (`guideSections`) and `prefixSections` (`guide-block:`). `tabRegistry` picks it up with no edit.
- `lib/editor-items.ts`: four helpers; `moveGuideCard` is one mutation so a cross-section move is one undo step.
- `lib/content-limits.ts`: `КАРТОЧКА «...»` warning for text or callout bodies over `MAX_BLOCK_TEXT` or with big formatting.

## Verification

- `node --test` on the five touched test files: pass; `npm test`: 418/418 pass.
- `npx tsc --noEmit`: clean.
- `npm run lint`: 0 errors in project code (see Deferred Issues).

## Deviations from Plan

None - plan executed as written. Test files and sources in `lib/` use CRLF line endings; edits kept them.

## Deferred Issues

- `npm run lint` exits non-zero on 2 pre-existing `no-require-imports` errors in `.planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-backup.cjs` and `06-check-disposition.cjs`. Unrelated to this plan; not fixed (scope boundary). The `<img>` warnings in `components/portia-editor.tsx` are also pre-existing.

## Known Stubs

None.

## Threat Flags

None. T-13-01..04 mitigated as planned: closed «Справочник» is refused 403 (test), `guide-block:` is classified so no 400 for restricted editors (test), cover/photo links go through `normalizeMediaUrl` (test with `//evil.example`), video ids are pattern-checked (test).

## Self-Check: PASSED

Files and commits e6e54ef, 3fbafef, 1de2e3a, 92bce73 verified present.
