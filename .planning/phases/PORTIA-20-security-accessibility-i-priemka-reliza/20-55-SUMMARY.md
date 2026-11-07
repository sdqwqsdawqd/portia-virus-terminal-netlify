---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 55
subsystem: template-builder-card-layout
tags: [D-65, D-66, D-67, template-card, css, e2e, gap-closure]
requires:
  - phase: PORTIA-20
    provides: "20-54 verdict stopped-for-fixes (8 rows template-builder-*), 20-49 D-60 rule, 20-44 export of the card"
provides:
  - "Card of the template laid out like the archive's record: classes 3 / method of spread / 3, two columns on a PC, as the archive on a phone"
  - "Class values whole (no break, no hyphen), size by cell width, not below 12 px"
  - "Decisions D-65, D-66, D-67 in 20-CONTEXT.md (owner's words verbatim)"
  - "template_fix_commit for 20-58"
affects: [20-56, 20-57, 20-58]
tech-stack:
  added: []
  patterns:
    - "Cell as an inline-size container, value font-size = clamp(12px, (100cqw - 24px) / 8.6, 15px) (13px cap on <= 900px)"
    - "Container range @container (min-width: 584px) and (max-width: 840px) for two columns below the archive's 840px threshold"
    - "In-page probe (window.__cardProbe) shared by preview, export frame, files and archive; frame measured through a pass-through spy on XMLSerializer.serializeToString"
key-files:
  created: []
  modified:
    - app/portia.css
    - tests/e2e/specs/template-builder.spec.ts
    - tests/e2e/visual-candidates/template-builder.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-CONTEXT.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
key-decisions:
  - "D-65: the classification of the template card is the archive's grid; the 20-49 columns-by-value rule is removed; whole values by font size and by moving the word under the badge"
  - "Two-column threshold: from 584 px of the document's content width (photo 170 + gap 24 + classification 390), measured; the card of the normal window has 616 px"
  - "D-66, D-67 recorded in CONTEXT only; implemented by 20-56 and later"
requirements-completed: [STAB-TMPL-01, STAB-REL-08, STAB-A11Y-02, STAB-VIS-04]
duration: about 2 h
completed: 2026-11-08
status: complete
outcome: fixed-awaiting-owner-gallery
commits: 5
plan_head_before: be939809872668c82216e1e332f06bc2d4adac4f
plan_head_after: 99f7fd13d93b89ab07f406acfc02934f2a2a1a02
actuals:
  tokens: 15000
  tasks: 2
  commits: 5
---

# Phase 20 Plan 55: Template card laid out like the archive's record (D-65) Summary

The classification of the template card is the public archive's grid again (three cells, the method of spread across the whole width, three cells); on a PC the card is always two columns in the Promotion window of the normal size and maximized; «Предупреждение» and the other values are whole (one line, no break, no hyphen, not below 12 px). The public «База вирусов» is byte-identical; decisions D-65..D-67 are in 20-CONTEXT.md.

PLAN_BASE: be939809872668c82216e1e332f06bc2d4adac4f

template_fix_commit: d1d7b0f177522a14303171621398ed12ecd7ded5

`template_fix_commit` is the last commit of this plan that changes `app`, `components` or `lib` (only `app/portia.css` changed). 20-58 refers to it for the row `template-builder-preview:pc` of round 16. Later commits of the plan are tests and documents only.

## Accomplishments

- D-65, D-66, D-67 written to 20-CONTEXT.md verbatim (subsection «Вердикт владельца по пересъёмке 20-54», line about q-template-framing in `<deferred>`).
- CSS only under `.template-card-preview` (acceptance by diff: 0 foreign rules): the columns-by-value grid rule of 20-49 is gone; the cell is an inline-size container and the value's size follows its width; the value is a wrapping flex line so the whole word moves under the badge when both do not fit; two columns from 584 px of content.
- Tests: `measureCardLayout`/`cardProbe` (one in-page source), the PC test (normal window, export frame, file 1060, minimum 620, maximized), the phone test against the archive on the same phone (a fixture for GET /api/content only) and file at 412; D-55 compact and D-60 brought to D-65.
- Candidate frame `template-builder-preview` on a PC is taken in the window of the normal size, set `phase20-dev-template-d65` (8 frames).
- 20-UI-SPEC.md: item «[ВЛАДЕЛЕЦ, D-65, обновление 2026-11-08; 20-55]» and the E7 rows.

## TDD

- RED (commit 2000570): `D-65 the card is laid out like the archive's record` on chromium-desktop against the build of HEAD before the CSS change. Failed on the planned assertion `window of the normal size: two columns` (received 1). Measured before the fix, window of the normal size: card 718 px, `.record-document` 716 px (content 616 px), photo 540 px, panel 616 px, cell 205 px, hero one column. `gsd_run check tdd-red-evidence` (JUnit report): `RED_EVIDENCE_OK`, reason `target_test_failed`. Semantic assessment: the target ran (1 test, 1 failure) and failed for the planned reason; no setup, syntax or fixture fault. D-55 compact (now expecting two columns) was red for the same reason.
- GREEN (commit d1d7b0f): the CSS below; D-65, D-55 compact, D-60 passed (3/3).
- REFACTOR: none.

## Measured layout (value «Предупреждение», all seven axes at their longest value)

| Place | Hero columns | Grid columns | Cell width | Font of «Предупреждение» |
|---|---|---|---|---|
| PC, window of the normal size (760 px; card 718, content 616) | 2 (photo 202, panel 390) | 3 | 130 px | 12 px (badge above the word) |
| PC, window maximized (card 1200, document 1060) | 2 (photo 391, panel 519) | 3 | 173 px | 14.4 px |
| PC, window at its 620 px minimum (card 578, content 476) | 1 (photo on top) | 3 | 158 px | 12.7 px |
| Export frame (source of PNG, 1060 px) | 2 (photo 390, panel 518) | 3 | 172 px | 14.3 px |
| Downloaded HTML at 1060 px | 2 (photo 400, panel 531) | 3 | 177 px | 14.8 px |
| chromium-phone (Pixel 7), preview | 1 | 1 | 331 px | 13 px |
| webkit-phone (iPhone 13), preview | 1 | 1 | 309 px | 13 px |
| Downloaded HTML at 412 px | 1 | 1 | 377 px | 13 px |
| Archive on the same phone (chromium-phone / webkit-phone) | 1 | 1 | 350 / 331 px | 13 px (archive's own) |

firefox-desktop gave the same numbers as chromium-desktop (±0.1 px).

**Threshold of one column:** the card is two columns while the document's content width is at least 584 px (photo >= 170, gap 24, classification >= 390: three cells that hold «Предупреждение» at 12 px). The card of the window of the normal size has 616 px of content (card 718 px), so the threshold card width is about 686 px, not above the card of the normal window. Above 840 px the archive's own columns apply unchanged.

**For the owner's question q-template-phone (20-58):** in the window at its 620 px minimum the card is one column (photo on top, three-column classes below); the card needs a window of about 690 px or wider for two columns. On a phone the card is laid out like the archive on the same phone (photo on top, one column of cells at <= 430 px). Note for the same question: the archive itself shows one column (photo on top) in its default window of 820 px; the two-column PC layout of the card in the window of the normal size is the planner's reading of «Всегда как в «Базе вирусов»», not what the archive does at that width.

## Public archive before and after (T-20-120)

Script outside the repository (scratchpad `archive-dump.mjs`, Playwright from the project's node_modules, 1440x900 and Pixel 7, GET /api/content answered by a fixture, two records: default and one with the longest value of all seven axes). Directory of the dumps: `C:/Users/User/AppData/Local/Temp/claude/281999b507a4367f/a191288b-f58f-4848-917c-6d0420d81d22/scratchpad/dumps` (`record-{pc,phone}-{default,longest}-{before,after}.*`).

| Dump (each of 4 combinations: pc/phone x default/longest) | Result |
|---|---|
| outerHTML of `.record-view .record-body` before vs after | `cmp` code 0 (4 of 4) |
| computed style `.record-hero` (properties sorted by name) | `cmp` code 0 (4 of 4) |
| computed style `.classification-grid` | `cmp` code 0 (4 of 4) |
| computed style `.class-cell strong` | `cmp` code 0 (4 of 4) |
| geometry of hero, grid and labels | `cmp` code 0 (4 of 4) |

A repeated `after` run equal to the first (deterministic). The archive's layout in the default window: PC hero one column (668 px), grid 3 x 222 px; phone grid one column (361 px). Caveat as in 20-43/20-49: one fixture virus without mutations and photos.

CSS diff check: `git diff be93980..HEAD -- app/portia.css` (saved in scratchpad `20-55-css.diff`) has 0 added rules outside `.template-card-preview` other than `@container`/`@media` wrappers.

## Verification

| Command | Result |
|---|---|
| chromium-desktop + chromium-phone, template-builder + accessibility, `-g "STAB-TMPL-01\|template builder"` | 37 passed, 2 skipped (D-65 PC/phone, by project), 3 failed on the first run and 4 on repeat: see BLOCKED(ENV) below; all STAB-TMPL-01 layout, export, D-60, D-61, D-65 tests passed on both projects |
| firefox-desktop + webkit-phone, `-g "D-65\|D-60\|D-61"` | 8 passed, 2 skipped (by project), 0 failed |
| candidate set `phase20-dev-template-d65`, chromium-desktop + chromium-phone | 8 passed (frames main, text, mutations, preview on both projects, in `tests/e2e/visual-candidates/.runs/phase20-dev-template-d65/`, ignored by git) |
| `node --experimental-strip-types --test lib/*.test.ts` | 1591 tests, 1587 pass, 0 fail, 4 skipped |
| `tsc --noEmit` | exit 0 |
| eslint | exit 0, 0 errors, 17 warnings (all in untracked `.runs` scripts, pre-existing) |
| `git diff --exit-code --stat be93980 -- tests/e2e/visual/__screenshots__` | exit 0 |
| port 3100 | not listening after the run |

### BLOCKED (ENV), not a pass

Two tests fail in this isolated environment and are NOT recorded as passed: `[STAB-A11Y-01] ... template builder (UI-contract stub): axe and accessible names ...` (accessibility.spec.ts, both projects) and `[STAB-TMPL-01] a local image and long text reach the preview ...` (template-builder.spec.ts). The diagnostics ledger shows one unexpected event: `GET /api/promotion/status -> 404` (a poll the test does not stub) answered by the isolated server, whose public environment values are invented (no real backend). The same four tests fail identically on the base commit be93980 built the same way (control run), so the failures are not caused by this plan; they need an environment with a read data source. The axe findings printed for these tests (region on `.assistant-label`, heading order of `h4` in the preview) are the tolerated, pre-existing ones.

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 3 - Blocking] Build and server in an isolated worktree, not in the main folder**
- **Found during:** Task 1 (precondition and build)
- **Issue:** the plan says build and `next start` in the working folder, but the phase's blocking constraints (and CLAUDE.md: `.env*` are never read) forbid a browser/visual build in the main tree because it holds a real `.env.local`.
- **Fix:** a throwaway worktree `C:/Users/User/AppData/Local/Temp/portia-20-55-verify` checked out at the commit under test, its own physical `node_modules` (robocopy), no `.env.local`, production `next build` + `next start` on 3100 with invented public values (made-up Supabase project ref, dummy publishable key and device secret, no service role, no production). Playwright ran from that worktree; the candidate frames were copied back into the ignored `.runs` of the main tree. The worktree was removed and the server stopped at the end. Node 22.13.1 from the temp folder was used.
- **Consequence:** the BLOCKED(ENV) tests above (no real read source).

**2. [Rule 1 - Bug in own test] Export frame cannot be observed from outside**
- **Found during:** Task 2
- **Issue:** the frame is mounted, read and unmounted inside one synchronous step (`flushSync` then `captureCard`), so a MutationObserver sees nothing; the first probe also started the running maximum at 0 for a frame at a negative x.
- **Fix:** a pass-through spy on `XMLSerializer.serializeToString` measures the card while the frame still holds it; the maximum starts at -1e9. Files: `tests/e2e/specs/template-builder.spec.ts` (commit 81e66a3).

**Total deviations:** 2 (1 blocking-environment, 1 test bug). **Impact:** none on the product code.

## Task Commits

1. docs: aef32c0f471fe709278df2ac23a04e9860555fdb (D-65..D-67 in CONTEXT)
2. test RED: 2000570861decf53b4809d0dd823d8143d2f1365
3. feat GREEN: d1d7b0f177522a14303171621398ed12ecd7ded5 (template_fix_commit)
4. test: 81e66a3 (full D-65 tests, candidate spec)
5. docs: 99f7fd13d93b89ab07f406acfc02934f2a2a1a02 (UI-SPEC)

## Open for later plans / owner

- 20-58 gallery: show the planner's reading of D-65 (two columns on a PC in the window of the normal size, one column below about 690 px of window, the archive differs at that width) and ask q-template-phone.
- Photo is 202 px wide in the window of the normal size (the classification takes 390 px); a smaller card padding for the template card would widen it if the owner asks.
- Requirements not marked complete here on purpose (STAB-A11Y-*, STAB-REL-08 wait for acceptance; STAB-TMPL-01 already Complete).

## Known Stubs

None.

## Threat Flags

None. Only styles under `.template-card-preview` were added; no endpoint, auth path or storage was touched; the phone test only reads a fixture through GET /api/content and every write tracker stayed empty.

## Self-Check: PASSED

Files exist (`app/portia.css`, both specs, 20-CONTEXT.md, 20-UI-SPEC.md); commits aef32c0, 2000570, d1d7b0f, 81e66a3, 99f7fd1 are ancestors of HEAD; `git cat-file -e d1d7b0f177522a14303171621398ed12ecd7ded5^{commit}` succeeds; acceptance greps (D-65/D-66/D-67 count 3, owner quotes present, `minmax(min(100%, 200px)` count 0, CSS diff 0 foreign rules, `__screenshots__` unchanged, 3100 free) pass.
