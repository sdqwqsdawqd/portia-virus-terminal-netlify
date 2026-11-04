---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 22
subsystem: editor-layout
tags: [editor, columns, d-40, d-41, d-42, d-47, drag, keyboard, sticky, private-notes, blocked-env, blocked-owner]
requires:
  - phase: PORTIA-20
    provides: 20-07 keyboard alternatives and touch targets; 20-20 class rename (editor source); 20-24 private notes route and helpers (store NOT applied anywhere)
provides:
  - "lib/editor-columns.ts: EDITOR_COLUMN_SIZE = 5 and columnMajor (pure column-major layout, source index kept)"
  - "«Информация» and «Справочник» editor sections as .editor-section-columns > .editor-section-column cards of five; phone one column"
  - "Keyboard ArrowUp/ArrowDown move across a column border and keep focus on the moved card's handle"
  - "OrderDragHandle: pointer drag between columns of one [data-sort-columns] as one gesture and one undo step (dragHandoff)"
  - "«Справочник»: pinned «+ ДОБАВИТЬ РАЗДЕЛ» bar with a title and editor-note form; per-section «Заметка для редактора» stored only through /api/content/notes"
  - "lib/editor-notes.ts rebaseNotes; D-47 guard tests; D-42 passesTarget tests"
  - "tests/e2e/specs/editor-layout.spec.ts: 7 staging scenarios (all BLOCKED (ENV) here)"
affects: [20-23, 20-14]
status: complete
key-files:
  created:
    - lib/editor-columns.ts
    - lib/editor-columns.test.ts
    - tests/e2e/specs/editor-layout.spec.ts
  modified:
    - components/portia-editor.tsx
    - components/portia-editor-dossier.tsx
    - app/portia.css
    - lib/editor-notes.ts
    - lib/editor-notes.test.ts
    - lib/portia-content-normalize.test.ts
    - lib/sort-order.test.ts
    - lib/portia-desktop.test.ts
key-decisions:
  - "No flow parameter was added to passesTarget: the four column cases (same column, neighbouring column at one height, column border both ways) already hold with the existing rule, so the D-42 tests are guards."
  - "The form of a tab with section columns is one grid track wide (.editor-card-columns:has(> .editor-section-columns)), because the old fixed 340px tracks would cap the column container at three columns' width. The existing D-15 test (class kept on three forms) still holds."
  - "Pinned bar: PC uses sticky top -28px (the pane has 28px padding and sticky measures from inside it); phone uses sticky under the 48px system bar with overflow: clip on .app-window and .content-editor (clip is no scroll container, so sticky holds against the page). The fixed-like fallback of the plan was not needed."
  - "Notes are not in the content undo history: Ctrl+Z in a note field is the browser's own undo, and restoring a deleted section by undo does not bring its note back (the note is dropped when the section is deleted)."
  - "A 409 on the notes PUT shows the Russian conflict text; «Загрузить заметки» reloads the server's notes and puts this editor's own unsaved changes over them (rebaseNotes), so typed text is not lost."
requirements-completed: []
duration: not recorded
completed: 2026-11-04
actuals:
  tokens: 12000
  tasks: 3
  commits: 11
plan_head_before: b1d24996b750013dc17b66da4192515293f3a3c8
plan_head_after: 5df2966766c745ce79aba888bd54a23748f4ffa7
---

# Phase 20 Plan 22: Editor section columns, pinned add bar, private notes Summary

«Информация» and «Справочник» sections in the editor now run top to bottom in columns of five that share the window width, ordering works across column borders by keyboard and by pointer, and «Справочник» has a pinned «+ ДОБАВИТЬ РАЗДЕЛ» bar with a title and an editor note that is stored only in the private notes store. All authenticated, staging-dependent proof is BLOCKED (ENV); the notes steps are additionally BLOCKED (OWNER).

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | D-40 columnMajor, columns in «Информация», CSS, keyboard across the border, layout spec | RED 4615678, GREEN c36d8aa, UI 6cf4956 |
| 2 | D-41/D-47 pinned add bar, private note field, notes save/conflict, dense columns in «Справочник» | guard tests 690dfd9, RED 80f1ba2, GREEN bc031cd, UI d49d93d |
| 3 | D-42 pointer drag between columns, spec for drag, bar and notes | tests 33c506b, drag 1da702f, spec c933cc3, 5df2966 |

Single-repo commits for this plan: 11 (measured from the persisted ledger). The final `docs(20-22)` commit follows this SUMMARY.

## TDD evidence

- **columnMajor RED (4615678):** `node --experimental-strip-types --test lib/editor-columns.test.ts` exit 1, 8 of 10 tests failed on their assertions against a stub that returns `[]` (target «D-40 the sixth card starts a new column on the right»: expected sizes [5,1], got no columns). `gsd check tdd-red-evidence`: `RED_EVIDENCE_OK`. Semantic assessment: valid, the target ran and failed on the planned assertion; the two passing tests (empty list, no mutation) are legitimate guards. GREEN c36d8aa: 10 pass.
- **rebaseNotes RED (80f1ba2):** exit 1, 2 of 20 failed on the assertion (stub returns `{}`); `RED_EVIDENCE_OK`; semantic assessment valid. GREEN bc031cd: 20 pass.
- **D-47 guard tests (690dfd9):** three tests in `lib/portia-content-normalize.test.ts`. They pass on the current normalizer by design (plan: "уже должны проходить"), so there is no RED run; they are regression guards that a section/card `note` never reaches `normalizeGuideSections`, the normalized content or the search index.
- **D-42 passesTarget tests (33c506b):** four tests, all pass on the existing rule; no `flow` parameter was needed.
- No REFACTOR commits.

## Verification

- `node --experimental-strip-types --test lib/editor-columns.test.ts lib/sort-order.test.ts lib/portia-content-normalize.test.ts lib/editor-notes.test.ts`: all pass. `npm.cmd test`: 1291 tests, 1287 pass, 0 fail, 4 skipped (20-24 reported 3; none of the tests added here is skipped, the extra skip was not traced).
- `npm.cmd exec tsc -- --noEmit`: clean. ESLint on the files this plan touched: 0 errors (2 pre-existing `<img>` warnings). Full `npm.cmd run lint`: 62 problems (32 errors), all outside this plan's files, unchanged since 20-20/20-24.
- Acceptance greps: `columnMajor` in portia-editor.tsx >= 1; `data-sort-columns` >= 1; `editor-section-columns` in portia.css 4 (>= 2); `editor-section-addbar` >= 1; «Заметка для редактора» in portia-editor.tsx 2 (>= 2); `api/content/notes` >= 1; `+ ДОБАВИТЬ РАЗДЕЛ` 4 (as planned); `note?:` in portia-content.ts and portia-content-normalize.ts 0; `.note` in search-index.ts 0; `data-sort-column` in portia-editor-dossier.tsx 3; `itemId=` in portia-editor.tsx 3.
- `playwright test tests/e2e/specs/editor-layout.spec.ts --list`: 30 tests (7 scenarios x 5 projects, project-gated).
- Production build (`PORTIA_E2E_ALLOW_HTTP=1`, `next start` on 127.0.0.1:3100, stopped afterwards): `accessibility.spec.ts` regression on chromium-desktop, chromium-phone, webkit-phone and firefox-desktop: 76 passed, 0 failed (the same count as 20-07); the editor-layout spec on the same lanes: all skipped, see below. The build went into `.next` (Next 16 keeps `next dev` in `.next/dev`, untouched); port 3000 (other session) was not touched.
- No file under `tests/e2e/visual/__screenshots__` changed; `20-VISUAL-APPROVAL.md` and `lib/phase20-visual-approval.test.ts` were not touched.

## Staging results (separately per project)

The mutation preflight is `ready`, but the staging harness answers `BLOCKED (ENV): safe target unavailable` in this environment, so no authenticated editor session exists. Recorded results of `playwright test --retries=0 --project=chromium-desktop --project=chromium-phone tests/e2e/specs/editor-layout.spec.ts`:

| Scenario | chromium-desktop | chromium-phone |
| --- | --- | --- |
| D-40 five per column, sixth at the same top, no strip on the right | BLOCKED (ENV) | n/a (PC only) |
| D-40/D-42 ArrowDown/ArrowUp across the border keeps focus on the handle | BLOCKED (ENV) | n/a (PC only) |
| A11Y-02 phone one column, no horizontal overflow | n/a (phone only) | BLOCKED (ENV) |
| D-42 pointer drag across columns, one undo step | BLOCKED (ENV) | n/a (PC only) |
| D-41 pinned bar, form focus flow, created section opens on its title, 44x44 on phone | BLOCKED (ENV) | BLOCKED (ENV) |
| D-47 note only in /api/content/notes, absent for visitors, window and search | BLOCKED (ENV); would also be BLOCKED (OWNER): table not applied (owner decision in 20-24) | skipped by design (same data path) |

BLOCKED is not PASS. The `test:e2e:mutation` npm script lists only roles and staging-authz specs, so the spec was run by explicit path (as the brief asked); the script's own server would also collide with port 3000.

## What was checked without staging, and what it is worth

- **Pure logic (proof):** columnMajor, passesTarget in a column layout, rebaseNotes, the D-47 projection guards.
- **Exploratory geometry (not evidence of the real editor):** a throwaway script in the session scratchpad loaded the real `app/portia.css` with synthetic section markup. At 1440 px 11 cards gave columns 455/455/455 px wide filling the 1384 px pane (no strip on the right), an opened card did not stretch other columns, at 1000 px the third column wrapped below with scrollWidth 0, and at 700 and 412 px one column in source order. The same real CSS was applied to markup injected into a real window of the production build: on a PC the bar stuck flush with the pane top after scrolling (first measured 28 px low, fixed with `top: -28px`), on a phone (Pixel 7) it stuck at 48 px under the system bar with the page scrolled.
- **Not exercised in a browser at all:** the React behaviour of the editor itself (focus return after a keyboard move across columns, the drag handoff between remounted handles, the form flow, the notes save/conflict). It is covered only by the BLOCKED scenarios above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Column container capped by the old fixed-width tracks**
- **Found during:** Task 1 (exploratory geometry)
- **Issue:** `.editor-card-columns` (still required on the form by the D-15 test) made implicit 340 px tracks, so the container spanning `1 / -1` was only three columns wide (1040 of 1384 px).
- **Fix:** `.editor-card-columns:has(> .editor-section-columns) { grid-template-columns: minmax(0, 1fr) }` inside the existing 901 px media block.
- **Files modified:** app/portia.css
- **Commit:** 6cf4956

**2. [Rule 1 - Bug] Pinned bar sat 28 px low on a PC**
- **Found during:** Task 3 (exploratory check in the production build)
- **Issue:** sticky measures from inside the pane padding, leaving a strip above the bar where content scrolled.
- **Fix:** `top: -28px` for 901 px and wider.
- **Commit:** c933cc3

**3. [Rule 3 - Blocking] Existing tests pinned layer and endpoint lists (files outside `files_modified`)**
- **Issue:** `lib/portia-desktop.test.ts` asserted that `.editor-save-chip` is the only sticky editor layer and pinned the editor's `/api/` endpoint counts. The plan's own pinned bar and notes calls need both lists to change.
- **Fix:** the first assertion now expects `.editor-section-addbar` as the second sticky layer (and checks it is opaque, at top and above the TOC); the endpoint pin adds `"/api/content/notes": 2`.
- **Commit:** 6cf4956, d49d93d

**4. [Rule 2 - Missing critical functionality] `rebaseNotes` in lib/editor-notes.ts (not in `files_modified`)**
- **Issue:** the plan says a 409 «перезагружает заметки», but a plain reload would throw away the text the editor typed.
- **Fix:** pure `rebaseNotes(before, mine, server)` (TDD, RED 80f1ba2, GREEN bc031cd); the editor puts its own unsaved changes over the reloaded server notes.

**5. [Rule 3 - Blocking] E2E environment**
- Port 3000 is held by the other session; the production build was served on 3100 with `PORTIA_E2E_BASE_URL` (the 20-19 approach) and stopped afterwards.
- A build in a scratch copy of the tree was tried first and failed (Turbopack does not follow a junctioned `node_modules`, webpack fails on the existing `node:fs` client import); the copy was deleted.

**6. [Own regression, fixed before the final commit]** the first version of the D-47 scenario created the admin client before the BLOCKED check and failed instead of skipping; it now skips as `BLOCKED (ENV): safe target unavailable` first (commit 5df2966).

## BLOCKED / not proven

- **BLOCKED (ENV):** every editor-layout staging scenario (table above), including the physical effect of columns, keyboard and pointer moves, the pinned bar and the 44x44 button in the real editor.
- **BLOCKED (OWNER):** anything that needs `portia_editor_notes` on staging (migration 20261104000100, push not authorized in 20-24): the live save/read of a note, the 409 path, the 503 «Заметки временно недоступны.» state under an editor session, and the D-47 visitor/window/search check. Nothing was mocked.
- **LIMITATION:** note edits are outside the content undo history; undoing a section deletion does not restore its note.
- Physical verification is EDITOR-01..04 in 20-14.

## Known Stubs

None. (`lib/editor-columns.ts` and `rebaseNotes` were RED stubs only inside their RED commits.)

## Threat Flags

None beyond the plan's threat model. T-20-29: the guard tests and the code keep notes out of GuideSection, PortiaContent and the search index; live proof BLOCKED as above. T-20-30: drag targets are limited to rows of one `[data-sort-columns]`; nested lists never match (logic reviewed, no browser proof). T-20-SC: no package installed.

## Requirements

None marked complete. STAB-EDIT-01..04, STAB-A11Y-01/02 and STAB-REL-06 need the live editor proof that is BLOCKED (ENV)/(OWNER) here; the offline logic is proven but does not close them. STAB-EDIT-04 also stays OPEN as in 20-24.

## Self-Check: PASSED

- Files exist: lib/editor-columns.ts, lib/editor-columns.test.ts, tests/e2e/specs/editor-layout.spec.ts and the modified files.
- Commits 4615678, c36d8aa, 6cf4956, 690dfd9, 80f1ba2, bc031cd, d49d93d, 33c506b, 1da702f, c933cc3 and 5df2966 are ancestors of HEAD; RED commits precede their GREEN commits.
