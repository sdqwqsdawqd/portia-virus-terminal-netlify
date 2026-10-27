---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 08
subsystem: ui
tags: [react, rich-text, multi-selection, cdp-harness, gap-closure]
status: complete
gap_closure: true
gap_ids: [CR-01, WR-01, WR-02]

requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: 11-06 multi-field format target (peers, fragments) and the 11-07 harness
provides:
  - dropFields pruning helper with 3 unit tests
  - dropFormatFields in the editor, used by delete, fold and fold-all
  - every text change ends an additive gesture
  - harness check peers (a)-(d), part of --check all
  - disposition ledger with CR-01, WR-01, WR-02 fixed
affects: [phase 11 verification, ship gate]

actuals:
  tokens: 6400
  tasks: 3
  commits: 4
plan_head_before: 6db33b6114586c716b4fc85bea9144110095f083
plan_head_after: 0c5f21786fb3f5c602fec58c2d00b271a4a007bb

tech-stack:
  added: []
  patterns:
    - "A gone field leaves the multi-selection through one functional updater (setFormatTarget(prev => prev && dropFields(prev, gone)))"
    - "The one text-change funnel (commitEditorValue) ends the additive gesture instead of a key list"

key-files:
  created: []
  modified:
    - lib/format-fragments.ts
    - lib/format-fragments.test.ts
    - components/portia-editor.tsx
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-REVIEW-DISPOSITION.md

key-decisions:
  - "dropFields is a pure generic helper with no imports; dropFormatFields in PortiaEditor closes the panel when the main target is gone and prunes peers otherwise"
  - "WR-01 is fixed at the commitEditorValue funnel with startGesture(false), not with a key list, so Ctrl+X/V, context-menu cut and paste, and non-Latin layouts are all covered"
  - "The archived-virus mutation delete clears the target defensively; no harness step can hold a target there because the archived Описание is a plain textarea"

requirements-completed: [EDIT-06, EDIT-03, TEST-02]

coverage:
  - id: D1
    description: "Deleting an item whose field is held only as a peer removes it from the multi-selection; the next style click writes nothing for it"
    requirement: EDIT-06
    verification:
      - kind: unit
        ref: "lib/format-fragments.test.ts#a gone peer leaves with its fragments"
        status: pass
      - kind: e2e
        ref: "node 11-editor-check.mjs --check peers --url http://localhost:3124 (steps a, b)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every text change in a rich field, with or without Ctrl/Cmd, clears the stored fragments"
    requirement: EDIT-06
    verification:
      - kind: e2e
        ref: "node 11-editor-check.mjs --check peers --url http://localhost:3124 (step c)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Folding a card or СВЕРНУТЬ ВСЕ releases the fragments whose field is inside the folded body"
    requirement: EDIT-03
    verification:
      - kind: e2e
        ref: "node 11-editor-check.mjs --check peers --url http://localhost:3124 (step d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Archived-virus mutation delete clears the format target and closes the panel"
    requirement: EDIT-06
    verification:
      - kind: other
        ref: "grep onRemoveMutation= components/portia-editor.tsx | grep -c setFormatTarget(null) prints 1"
        status: pass
    human_judgment: false
    rationale: "Source-grep only: no format target can be held on an archived mutation (plain textarea)"
  - id: D5
    description: "Disposition ledger records CR-01, WR-01, WR-02 fixed; WR-03, IN-01, IN-02 stay open"
    requirement: TEST-02
    verification:
      - kind: other
        ref: "grep -c '| fixed | fixed in ' 11-REVIEW-DISPOSITION.md prints 3"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-10-26
---

# Phase 11 Plan 08: Peers lifecycle gap closure Summary

**A deleted, edited-with-Ctrl or folded field now leaves the multi-field format target through `dropFields`/`dropFormatFields` and the `commitEditorValue` gesture reset, proven red-then-green by a unit test and a four-step CDP harness check.**

## Performance

- **Duration:** 12 min (2026-10-26T09:21:50Z to 09:34:13Z)
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `dropFields(target, gone)` in `lib/format-fragments.ts`: null when the target's own field is gone, the same object when nothing is gone, otherwise a copy without the gone peers and their fragments. Three unit tests; the file reports 17 pass.
- `dropFormatFields(gone)` in `PortiaEditor`. `closeFormatterFor(...keys)` is now variadic and goes through it, `toggleCard` and `setAllOpen` prune peers inside the folded body, and the section delete names every block key that `removeInfoSection` deletes.
- `commitEditorValue` starts with `startGesture(false)`, so Enter, paste and input always end an additive gesture (Ctrl+Backspace, cut, paste, any keyboard layout).
- The archived `onRemoveMutation` clears the target and closes the panel, like the live delete.
- Harness `--check peers` steps (a) section delete, (b) section delete with blocks, (c) Ctrl+Backspace, (d) fold. The fake save now keeps its PUT body (`savedBody`), so an orphan `formattedText` key is visible.
- Ledger: CR-01, WR-01, WR-02 `fixed` with commits, test and harness command; `open: 3`.

## Task Commits

1. **Task 1 (tracer): deleted item leaves the selection** - `0bdf9b4` (fix)
2. **Task 2: section blocks, Ctrl edit, fold, archived mutation** - `7be2bba` (fix)
3. **Harness revisions fix (deviation)** - `494ef83` (test)
4. **Task 3: ledger** - `0c5f217` (docs)

## RED evidence (each step seen failing before its fix)

Task 1, `--check peers` on the unmodified editor (step a only existed then; the unit tests failed with `does not provide an export named 'dropFields'`):

```
"(a) the header still reads \"РЕДАКТОР ОФОРМЛЕНИЯТекстВЫБРАНО: 2СБРОСИТЬ▾×\" after the delete",
"(a) painted [\"\",\"раздела\"] after the delete, expected [\"раздела\"]",
"(a) the saved body still holds formatting for the deleted section 1"
```

The saved-body line only appeared after the harness save was fixed (first run showed "no formatting for section 2" because the save never fired). The orphan-key assertion was re-proved red by temporarily building HEAD's editor.

Task 2, `--check peers` against the Task 1 build, with (a) clean:

```
"(b) the header still reads ... ВЫБРАНО: 2 ... after the section delete",
"(b) painted [\"\",\"раздела\"] after the section delete, expected [\"раздела\"]",
"(b) the saved body still holds formatting for the deleted section's block",
"(c) «Текст» in section 1 was coloured after a Ctrl edit in section 2",
"(d) the header still reads ... ВЫБРАНО: 2 ... after the fold",
"(d) painted [\"Текст\",\"раздела\"] after the fold, expected [\"раздела\"]",
"(d) «Текст» in the folded section 1 was coloured"
```

## Verification (final, on `next start -p 3124`)

- `--check all`: `ok: true`, 8 results all `ok: true` (mark, panel, savechip, sections, table, multiselect, peers, phonefit).
- `npm test`: 335 pass, 0 fail. `npx tsc --noEmit`: clean.
- `npm run lint`: 2 errors (the known phase-06 `.cjs` `no-require-imports`), 17 warnings (`<img>`, pre-existing); none are new problems in the touched files.
- Plans and summaries 11-01..11-07: `git diff --stat 0e03632` prints nothing.

## Deviations from Plan

**1. [Rule 3 - Blocker] Harness revisions 70-73 broke `phonefit` in `--check all`**
- **Found during:** Task 3 (`--check all` run)
- **Issue:** the page keeps the highest revision it has read; `peers` served revisions 70-73, above phonefit's 60, so phonefit saw peers' 2-section content ("info tab did not show 6 section cards").
- **Fix:** peers uses revisions 47-50 (above multiselect 40-46, below phonefit 60), with a one-line comment.
- **Files modified:** `11-editor-check.mjs`
- **Commit:** `494ef83`

**2. [Rule 1 - Bug] Harness `save()` never fired**
- **Found during:** Task 1
- **Issue:** a real mouse click on the save chip hit the floating panel that covers it, so no PUT happened.
- **Fix:** open the chip as the `savechip` check does (focus, then a programmatic click).
- **Commit:** `0bdf9b4`

**3. Steps (b)-(d) pick order**
- The plan lists ensurePanel after both picks, then Ctrl+Backspace "while focus is still in s2's field". A real click on the launch button would move focus, so the steps pick plain, open the panel, then Ctrl-pick in section 2 (focus stays in the field). Same assertions.

**4. Literal acceptance count**
- `grep -c "dropFormatFields("` prints 3, not at least 4: the definition is `const dropFormatFields = (gone...`, which that pattern does not match. All four occurrences exist (definition, closeFormatterFor, toggleCard, setAllOpen).

**Total deviations:** 4 (1 Rule 3, 1 Rule 1, 2 procedural). **Impact:** none on behaviour or scope.

## Known Stubs

None.

## Threat Flags

None. T-11-17..T-11-21 mitigations are in place; the harness blocks every non-GET apart from its one answered fake save (no "write blocked" reason in any run).

## Next Phase Readiness

The verification gap (11-06 prohibition) is closed; phase 11 is ready for re-verification. WR-03, IN-01, IN-02 stay open by plan.

## Self-Check: PASSED

- Files exist: `lib/format-fragments.ts`, `lib/format-fragments.test.ts`, `components/portia-editor.tsx`, `11-editor-check.mjs`, `11-REVIEW-DISPOSITION.md`.
- Commits `0bdf9b4`, `7be2bba`, `494ef83`, `0c5f217` are ancestors of HEAD.
- Pre-existing user changes (`milestone.lock`, `state.json`, `package.json`, `package-lock.json`, `.planning/ui-reviews/`) were not staged or committed.
