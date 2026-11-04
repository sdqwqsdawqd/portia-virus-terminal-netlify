---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 23
subsystem: editor-outline-sections
tags: [editor, broadcasts, search-recommendations, sections, d-41, d-42, d-47, tab-permissions, private-notes, blocked-env, blocked-owner]
requires:
  - phase: PORTIA-20
    provides: 20-22 columns, pinned add bar, EditorNoteField and notes state; 20-24 private notes route and tabs broadcasts/search (store NOT applied anywhere)
provides:
  - "lib/editor-outline.ts: normalization and operations for sections and subsections of «Сводка» and «Рекомендации»; flat-list invariant with per-line formatting"
  - "Content form: optional broadcastSections, Broadcast.sectionId, optional searchRecommendationSections (no note field); normalizePortiaContent emits them; sectionOfKey assigns them to the broadcasts and search tabs"
  - "«Рекомендации» tab: pinned «+ ДОБАВИТЬ РАЗДЕЛ», dense columns, sections and subsections with title, private note, lines with formatting and per-group line order"
  - "«Сводка» tab: pinned bar with the new-entry button, sections and subsections that only label entries, «Раздел» select on every entry, delete keeps entries in «Без раздела»"
  - "tests/e2e/specs/editor-layout.spec.ts: 5 more staging scenarios (all BLOCKED (ENV) here)"
affects: [20-14]
status: complete
key-files:
  created:
    - lib/editor-outline.ts
    - lib/editor-outline.test.ts
  modified:
    - lib/portia-content.ts
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - lib/editor-changes.ts
    - lib/editor-save-status.ts
    - components/portia-editor.tsx
    - app/portia.css
    - tests/e2e/specs/editor-layout.spec.ts
key-decisions:
  - "One tree model for «Рекомендации»: every operation reads the flat list and its formatting into lines (text plus per-character styles), changes the tree and commits it, so searchRecommendations always equals the expansion of the sections and every line keeps its own styles (move, delete, write)."
  - "The old flat list is shown as a synthetic section «Рекомендации» (id search-recommendations-all) and becomes a real section with the same id only on the first edit; its note key is therefore stable."
  - "Sections of «Сводка» are shared by «Новости» and «Квесты»; an entry's sectionId is only a label. broadcasts is never reordered or cut; removing a group sends its entries to sectionId \"\"."
  - "A section that disagrees with the flat list is dropped by the normalizer (flat list wins), so a stale editor tab can lose sections but never lines or entries."
  - "Delete of a section asks for confirmation (ConfirmDialog): «Записи раздела останутся в «Без раздела»» for «Сводка», lines-and-formatting warning for «Рекомендации»."
  - "The recommendation form does not carry editor-card-columns: the D-15 test pins that class to exactly three forms and says the recommendation list stays one column; the section columns divide the width themselves."
requirements-completed: []
duration: not recorded
completed: 2026-11-04
actuals:
  tokens: 28000
  tasks: 3
  commits: 10
plan_head_before: a77c8aeb53748b55a939103d5792a11a6a945948
plan_head_after: 397597c4deef213ec5672773235e58c7415c141b
---

# Phase 20 Plan 23: Sections and subsections in Сводка and Рекомендации Summary

«Сводка» and «Рекомендации» in the editor now have a pinned «+ ДОБАВИТЬ РАЗДЕЛ» bar, sections and subsections with a title and a private editor note, dense columns of five and the D-42 ordering by handle and ArrowUp/ArrowDown, on a new backward-compatible content form that leaves the site's public contract (`broadcasts` and the flat `searchRecommendations` with the `search:recommendations` formatting) unchanged. Every authenticated staging check is BLOCKED (ENV); the note steps are additionally BLOCKED (OWNER).

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | D-41 data path: JSON, normalization, tab permissions, flat list | RED dda602c, GREEN 4b3d833 |
| 2 | D-41/D-42 «Рекомендации» UI, labels | 31276a0 (the same commit holds the «Сводка» UI, see Deviations) |
| 3 | D-41/D-42 «Сводка» UI; staging scenarios for both tabs | 31276a0 (UI), 6aaf62a (spec) |

`commits: 10` in the frontmatter is the measured `rev-list` count from the persisted ledger; 6 of them are commits of another Claude session that works on this branch (quick tasks 261104-lkn and the mobile viewport fix). This plan's own commits are 4 (dda602c, 4b3d833, 31276a0, 6aaf62a); the final `docs(20-23)` commit follows this SUMMARY.

## Tracer gate

`⚡ Tracer verified end-to-end — expanding`: after GREEN `node --experimental-strip-types --test lib/editor-outline.test.ts lib/editor-changes.test.ts lib/portia-content-normalize.test.ts` (109 tests, 0 fail), `npm test` (0 fail) and `tsc --noEmit` (clean) were re-run before the UI tasks started.

## TDD evidence

- **RED (dda602c):** `node --no-warnings --experimental-strip-types --test --test-reporter=tap lib/editor-outline.test.ts` exit 1, 34 tests, 28 failed on their assertions against a stub that returns empty answers, 6 passed. `gsd check tdd-red-evidence` on the target «D-41 the old flat list shows as one synthetic section called Рекомендации»: `RED_EVIDENCE_OK`. Semantic assessment: valid, the target ran and failed on the planned assertion (no synthetic section from the stub). The 6 passing tests are legitimate guards (empty list gives no synthetic section, non-array gives `[]`, differing sections are dropped by a stub that returns `[]`, out-of-range line move, no-sections trim, and `sectionId` survival, which the existing spread in `normalizeBroadcasts` already provided). The first RED capture was rejected as `invalid_record` because the record held the Node warning banner; the report was re-captured as TAP-only stdout and then validated.
- **GREEN (4b3d833):** 34 pass. Two existing tests in `lib/portia-content-normalize.test.ts` (broadcast shape before 03.2 and quest idempotence) now expect `sectionId: ""` on a normalized broadcast; this is the deliberate new shape.
- Tasks 2 and 3 are `type="auto"`; helpers added there (`renameRecommendationGroup`, `recommendationGroupIds`, `broadcastGroupIds`, `broadcastGroupPath`) came with 4 tests and 2 source-guard tests in the same commit.

## Verification

- `node --experimental-strip-types --test lib/editor-outline.test.ts lib/editor-changes.test.ts lib/portia-content-normalize.test.ts`: 115 pass, 0 fail. `lib/editor-changes.test.ts` is unchanged and its «every content key belongs to a section» test now guards the two new keys.
- `npm.cmd test`: 1332 tests, 1328 pass, 0 fail, 4 skipped (the same 4 skips as 20-22).
- `npm.cmd exec tsc -- --noEmit`: clean. ESLint on the files this plan touched: 0 errors (2 pre-existing `<img>` warnings in portia-editor.tsx). Full `npm.cmd run lint`: 62 problems (32 errors), all outside this plan's files, identical to 20-22.
- Acceptance greps: `broadcastSections` in editor-changes.ts 1, `searchRecommendationSections` there 1, `broadcastSections` in portia-content-normalize.ts 1 (all baseline 0); `note?:` in portia-content.ts and editor-outline.ts 0; `writeRecommendationGroup` in portia-editor.tsx 2, `trimRecommendationSections` 2, `broadcastGroupsView` 2, `setBroadcastSection` 3 (baselines 0); `searchRecommendationSections` in editor-save-status.ts 1; `editor-section-addbar` lines in portia-editor.tsx 3 (the literal appears in the shared bar, its row wrapper and a focus selector; the real intent is `<SectionAddBar` used 3 times, one per tab, pinned by a source-guard test).
- Production build with `PORTIA_E2E_ALLOW_HTTP=1` (needed at build time: without it WebKit upgrades subresources to https and every webkit-phone page renders unstyled; a first run without it showed exactly that on webkit-phone only, 18 failures, and was discarded), `next start` on 127.0.0.1:3100, server stopped afterwards (port 3000 of the other session untouched): `accessibility.spec.ts` regression on chromium-desktop, chromium-phone, webkit-phone, firefox-desktop: 76 passed, 28 skipped, 0 failed (same count as 20-22).
- `playwright test tests/e2e/specs/editor-layout.spec.ts --list`: 55 tests (11 scenarios across 5 projects).
- No file under `tests/e2e/visual/__screenshots__`, `20-VISUAL-APPROVAL.md` or `lib/phase20-visual-approval.test.ts` changed. `components/portia-desktop.tsx` is not touched by this plan (a commit of the other session changed it in the same range); a source-guard test pins that it never mentions `broadcastSections`, `searchRecommendationSections` or `sectionId`.

## Staging results (separately per project)

Run: `playwright test --retries=0 --project=chromium-desktop --project=chromium-phone tests/e2e/specs/editor-layout.spec.ts` against the 3100 production build; 22 skipped, 0 failed. Skip reasons from the JSON report: `BLOCKED (ENV): safe target unavailable` (10 on desktop, 4 on phone); the rest are project-gated by design (PC-only or phone-only scenarios). The `test:e2e:mutation` npm script lists only roles and staging-authz specs, so the spec was run by explicit path.

| Scenario (new in this plan) | chromium-desktop | chromium-phone |
| --- | --- | --- |
| «Рекомендации»: old flat list shows as one section, section plus subsection plus line, flat list equals expansion, second line keeps its colour, search window reads only the flat list, ArrowDown reorders sections and lines | BLOCKED (ENV) | n/a (PC only) |
| «Рекомендации»: pinned bar in view after scrolling; phone one left edge, no horizontal overflow | BLOCKED (ENV) | BLOCKED (ENV) |
| «Сводка»: entries without sectionId in «Без раздела», subsection takes an entry via «Раздел», broadcasts keep order and members, public window shows the same news without section titles, delete keeps the entry | BLOCKED (ENV) | n/a (PC only) |
| «Сводка»: pinned bar in view; phone one column | BLOCKED (ENV) | BLOCKED (ENV) |
| D-47 «Сводка» note only in /api/content/notes, absent from /api/content | BLOCKED (ENV); would also be BLOCKED (OWNER): table not applied | skipped by design |

BLOCKED is not PASS. The spec was written without being run against a live editor.

## What was checked without staging, and what it is worth

- **Pure logic (proof, 38 tests):** compatibility of reading, positional ids, D-47 (no `note` key or note text after normalization, even from a payload that has them), flat-list invariant, per-character formatting through write, move, delete and trim, `broadcastGroupsView`, removal that keeps every entry, `sectionOfKey`, and `contentRefusal` returning 403 `section-closed` with sections `["search"]` / `["broadcasts"]` for a restricted editor.
- **Static:** tsc, ESLint and a production `next build` compile the new UI.
- **Not exercised in a browser at all:** the React behaviour of both tabs (focus after creating a section or subsection, the «Раздел» select moving a card between lists and returning focus, the drag and keyboard order in nested lists, the confirm dialog, the pinned bar in these tabs, note editing and the save sequence). The editor needs an authenticated session, so none of it has live proof; the BLOCKED scenarios above cover it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests pinned the old broadcast shape (outside `files_modified`)**
- **Found during:** Task 1 (GREEN)
- **Issue:** two tests in `lib/portia-content-normalize.test.ts` compared a normalized broadcast with an input that has no `sectionId`.
- **Fix:** the expected objects carry `sectionId: ""`.
- **Commit:** 4b3d833

**2. [Rule 3 - Blocking] Render-purity lint error after adding render helpers**
- **Found during:** Task 2
- **Issue:** with the new `renderBroadcastCard`/`renderRecommendationGroup` helpers called during render, `react-hooks/purity` flagged the `Date.now()` in `changeDraft` (it is only ever called from handlers). The file had 0 errors before.
- **Fix:** `Date.now()` moved behind a module-level `timestamp()` function; behaviour is unchanged. The old `reorderRichTextLines` helper became unused and was removed.
- **Commit:** 31276a0

**3. [Rule 2 - Missing critical functionality] Helpers the UI needs (in `lib/editor-outline.ts`, not in the plan's artifact list)**
- `renameRecommendationGroup` (a title edit on the synthetic section must write the new form), `recommendationGroupIds` and `broadcastGroupIds` (notes of removed groups are pruned at save through `liveNoteIds`), `broadcastGroupPath` (an entry inside a folded section must be opened before the TOC or a reveal scrolls to it). Tested, commit 31276a0.

**4. [Rule 1 - Bug avoided] «Развернуть всё» and TOC jumps in «Сводка» must also open the sections** — otherwise entries inside a folded section stay hidden; `openBroadcast` and `broadcastCardIds` cover it.

**5. [Rule 3 - Structure] The «Сводка» and «Рекомендации» UI landed in one commit (31276a0)** — both tabs share the helpers and the `SectionAddBar` change in the same file, and `git add -p` is not available here, so Tasks 2 and 3 could not be committed separately. The spec scenarios are in their own commit (6aaf62a).

**6. [Rule 3 - Constraint] The recommendation tab form is `editor-form flat-editor-form`, not `editor-card-columns`** — `lib/portia-desktop.test.ts` pins that class to exactly three forms (and keeps the recommendation list one column, D-15). The section columns carry their own `grid-template-columns`, so the layout is the same. The «Без раздела» list in «Сводка» got its own class (`broadcast-entry-list--loose`) with the old card width so the old look is kept when there are no sections.

**7. [Rule 3 - Environment]** The first production build was made without `PORTIA_E2E_ALLOW_HTTP=1`; webkit-phone then rendered unstyled pages (`upgrade-insecure-requests` on http). Rebuilt with the variable; the 18 webkit-phone failures of that first run were an environment artefact, not a regression. Port 3000 is held by the other session; the server ran on 3100 and was stopped.

## BLOCKED / not proven

- **BLOCKED (ENV):** all new staging scenarios (table above): the real editor behaviour of both tabs, the stored result in `portia_content`, the public windows after a save, and the pinned bar and one-column layout on both projects.
- **BLOCKED (OWNER):** everything that needs `portia_editor_notes` on staging (migration 20261104000100, push not authorized in 20-24): live save and read of a «Сводка» or «Рекомендации» note, the 409 path, the 503 «Заметки временно недоступны.» state.
- **LIMITATION (carried risk):** an editor tab open in another browser that does not know the new keys saves content without them: its sections are lost, but never lines or entries (the site is unaffected); notes live in their own store and are not touched.
- **LIMITATION:** note edits are outside the content undo history, as in 20-22; undoing a section deletion does not bring its note back.
- **LIMITATION:** for «Сводка» the sections are shared by «Новости» and «Квесты» (executor's choice per the plan); a section shows only the entries of the open sub-tab.
- Physical verification is EDITOR-02..04 in 20-14.

## Known Stubs

None. (`lib/editor-outline.ts` was a RED stub only inside its RED commit dda602c.)

## Threat Flags

None beyond the plan's threat model. T-20-31: `sectionOfKey` plus the `contentRefusal` tests (403 `section-closed`) and the existing every-key-has-a-section test; live proof BLOCKED. T-20-32: types and normalizer carry no note field (test with notes in the input), notes only through `/api/content/notes`; live proof BLOCKED (OWNER/ENV). T-20-33: the normalizer drops sections that disagree with the flat list, removing a «Сводка» section never removes an entry (tests). T-20-SC: no package installed.

## Requirements

None marked complete. STAB-EDIT-02, STAB-EDIT-03, STAB-EDIT-04, STAB-A11Y-01, STAB-A11Y-02 and STAB-REL-06 need the live editor proof that is BLOCKED (ENV)/(OWNER) here; the offline logic is proven but does not close them. STAB-EDIT-04 also stays OPEN as in 20-24.

## Self-Check: PASSED

- Files exist: lib/editor-outline.ts, lib/editor-outline.test.ts, tests/e2e/specs/editor-layout.spec.ts and the modified files.
- Commits dda602c, 4b3d833, 31276a0 and 6aaf62a are ancestors of HEAD; the RED commit precedes the GREEN commit.
