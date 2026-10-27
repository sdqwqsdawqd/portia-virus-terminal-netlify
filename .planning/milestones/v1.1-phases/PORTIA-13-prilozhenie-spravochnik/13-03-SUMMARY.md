---
phase: PORTIA-13-prilozhenie-spravochnik
plan: 03
subsystem: editor-guide-tab
tags: [guide, editor, harness]
requires: [13-01, 13-02]
provides:
  - editor tab "guide" right after «Информация»: section -> card -> block lists, collapsed on entry, table of contents, ≡ at every level
  - six block kinds (heading, text, table, photo, video, callout) with adders and editors, section photo and card cover with «Убрать …»
  - TableBlockEditor shared by «Информация» and «Справочник»
  - harness checks editor-save, editor-blocks, editor-undo, closed-tab in 13-guide-check.mjs
affects: [13-04, 13-05]
tech-stack:
  added: []
  patterns: [id-based block lookup (findGuideBlock) for every write, onEdit(edit) wrapper so one table edit is one undo step]
key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - .planning/phases/PORTIA-13-prilozhenie-spravochnik/13-guide-check.mjs
decisions:
  - "Every guide write goes through findGuideBlock/findGuide by card id and block id inside changeDraft, so an upload that ends after a reorder or delete writes the right block or nothing"
  - "Deletes (section, card, block) call closeFormatterFor for all affected guide-block keys and then the 13-01 remove helpers; no dialog, undo through Ctrl+Z"
  - "Harness editor access is a separate editorAccess() (canEdit true); the desktop checks keep canEdit false"
metrics:
  duration: ~30 min
  completed: 2026-10-27
status: complete
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: c4ea79589752a8bd8aee7db1197a8559c0ad953c
plan_head_after: c7febfd52c9fa169b54176b509021aa803ba5557
commits: 2
requirements-completed: [P13-SC4]
---

# Phase 13 Plan 03: «Справочник» tab in the editor Summary

Editors get a «Справочник» tab built like «Информация» (section, card, block, all collapsed on entry, table of contents from 5 entries) with six block kinds, section photo and card cover, in-place reordering with ≡, and instant undoable deletes; a save shows the card on the desktop.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | new section, card, text block, save, card on the desktop | 5eda5c2 |
| 2 | all block kinds, section photo and cover, TOC, shared table editor, undo of every delete | c7febfd |

## What was built

- `components/portia-editor.tsx`: `EditorTab` "guide"; `findGuideBlock`, `editGuideTableRows`, `guideBlockHeads`, `guideBlockTitle`; `writeGuideBlock`, `addGuideBlock`, `guideTocItems`, `guideCardIds`, `jumpGuide` in `PortiaEditor`; the `tab === "guide"` panel; file-local `TableBlockEditor` replacing the inline Info table markup (Info behaviour and markup unchanged, `swapTableColumns` removed); `ImageEditorField` prop `removeLabel`.
- `13-guide-check.mjs`: editor helpers (openEditor, typeLabel, typeImage, typeInto, fakeSave, ctrlZ) and four checks; the tab list already held "guide" from 13-02.

## Verification

- Production build on port 3124: `13-guide-check.mjs --check all` prints ok for open-card, grid, card-blocks, poll-gone, search, editor-save, editor-blocks, editor-undo, closed-tab. Server stopped afterwards.
- `npm test` 418/418, `node --experimental-strip-types --test lib/portia-desktop.test.ts` 9/9, `npx tsc --noEmit` clean, `npm run build` passes.
- Tracer gate (auto mode): `editor-save` re-run end to end before expanding, passed.

## Deviations from Plan

None - plan executed as written. The editor window needed `canEdit: true`, so the harness got its own `editorAccess()` next to the desktop's `defaultAccess()`.

## Deferred Issues

- `npm run lint` still exits non-zero on the 2 pre-existing `no-require-imports` errors in `.planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-*.cjs` (recorded in 13-01 and 13-02). No new errors; the new `<img>` warnings follow the house pattern.
- Cross-section card moves and the blank-state drop target are 13-04.
- `package.json`, `package-lock.json`, `.planning/milestone.lock`, `.planning/state.json` and `.planning/ui-reviews/` carry unrelated uncommitted changes and were not staged.

## Known Stubs

None.

## Threat Flags

None. T-13-09 (wrong block after reorder/delete) mitigated by id lookup and `closeFormatterFor` before deletes; T-13-10 by the tab registry plus the 13-01 server refusal, harness `closed-tab`; T-13-11 by MAX_SUBSECTIONS, MAX_BLOCKS and MAX_TABLE_ROWS on the adders.

## Self-Check: PASSED

Commits 5eda5c2 and c7febfd present; `components/portia-editor.tsx` and `13-guide-check.mjs` present.
