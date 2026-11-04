---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 20
subsystem: content-classification
tags: [classification, rename, normalize, icons, svg, tdd, visual-candidates]
requires: [20-17]
provides:
  - classificationOptions with the nine new class names (D-35), no accent marks (D-37)
  - legacyClassificationNames (frozen nine pairs) and canonicalClassificationName (U+0301 stripped, Object.hasOwn lookup)
  - normalizeVirus maps class values for viruses and recycledViruses (D-36a)
  - starter "Классификация" text with the owner block verbatim (D-38, D-49)
  - nine redrawn class icons (D-39) and before/after candidate sets for 20-11
affects: [lib/portia-content.ts, lib/portia-content-normalize.ts, components/portia-icons.tsx, components/portia-editor.tsx]
tech-stack:
  added: []
  patterns: [read-time legacy-name mapping inside normalizePortiaContent, source-level SVG tests (argument counts per path command)]
key-files:
  created:
    - lib/virus-classes.test.ts
    - tests/e2e/visual-candidates/phase20-class-icons.spec.ts
  modified:
    - lib/portia-content.ts
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - components/portia-icons.tsx
    - components/portia-editor.tsx
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
key-decisions:
  - "Legacy names are mapped only in normalizePortiaContent, so display, search, editor lists and the server-side contentRefusal comparison (which already normalizes baseline and draft) all see the new names; the stored data stays as is until 20-21."
  - "classificationIconFor resolves through canonicalClassificationName, so an icon is found for an old or accented value as well."
  - "Candidate frames are the full window frame (captureCandidate) plus a panel crop PNG next to it; support.ts has no clip option and was not changed."
requirements-completed: [STAB-CLASS-01, STAB-CLASS-02, STAB-CLASS-04]
status: complete
duration: ~1h10m
completed: 2026-11-04
actuals:
  tokens: 11000
  tasks: 3
  commits: 5
plan_head_before: 9cad40d1b573c186398d8878a14d9e5ced6de34e
plan_head_after: ca585b8353bc2320a2a9c67b144aac3928f08c3e
---

# Phase 20 Plan 20: Class rename, legacy-name reading, owner texts, nine new icons Summary

The classes «Разум», «Поведение» and «Вид» use the owner's new names at the same levels, saved records with the old names read as the new ones everywhere (and are written back as new on the next save), the starter «Классификация» text carries the owner's block verbatim under the kept «ДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА» heading, and the nine class icons are redrawn with before/after candidates ready for the 20-11 approval.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 (tracer) | D-35/D-36a rename and legacy reading | RED dc2c6d2, GREEN f71c0de |
| 2 | D-38 owner text in «Классификация» | RED 98133b7, GREEN 0c207e8 |
| 3 | D-39 nine icons, candidates before/after, UI-SPEC | ca585b8 |

Single-repo commits for this plan: 5 (measured from the persisted ledger).

## TDD evidence

- **Task 1 RED:** `node --experimental-strip-types --test lib/portia-content-normalize.test.ts` exit 1, 4 of 6 new D-36 tests failed on their assertions (old names stayed, accent stayed, false refusal, option values); the idempotence and `__proto__` tests passed and are regression guards. `gsd check tdd-red-evidence`: `RED_EVIDENCE_OK` (target "D-36 old class names read as the new ones…", TAP). Semantic assessment: valid, the target executed and failed on the planned assertion (`Рубедо` vs `Люцидиум`).
- **Task 2 RED:** `lib/virus-classes.test.ts` exit 1, 4 of 5 D-38 tests failed (the intro test passed as a guard). `RED_EVIDENCE_OK`; semantic assessment valid (three old paragraphs present instead of the owner block).
- **Task 3:** not marked `tdd` in the plan; the D-39 tests were written with the drawings. One of them (path argument counts) failed on the first drawing and found a real defect, see Deviations.
- No REFACTOR commits.

## Verification

- `node --experimental-strip-types --test lib/portia-content-normalize.test.ts lib/virus-classes.test.ts`: all pass. `npm test`: 1224 tests, 1221 pass, 0 fail (3 skipped, as before). `npm exec tsc -- --noEmit`: clean.
- ESLint on every file this plan touched: 0 errors (2 existing `<img>` warnings in portia-editor.tsx). Full `npm run lint` reports 62 problems (32 errors), all in `.agents/`, `.claude/` and other files outside this plan, unchanged.
- Verbatim check of the owner block against 20-CONTEXT.md: `verbatim ok 1935`.
- Acceptance greps: «Люцидиум» in portia-content.ts 3 (>=2); `class-lucidium` in portia-icons.tsx 3 (>=3); `class-rubedo` 0; «Альбедо» in portia-editor.tsx 0; `canonicalClassificationName` in the normalizer 2 (>=1); non-comment «Рубедо» in portia-content.ts 1 (the legacy table only); «ДОПОЛНИТЕЛЬНАЯ ЛИНЕЙКА» 1; `portia-desktop-dossier.tsx` and `portia-editor-dossier.tsx` unchanged; `git status --porcelain -- tests/e2e/visual/__screenshots__` empty; «D-39» in virus-classes.test.ts 5 and in 20-UI-SPEC.md 2.
- Candidate sets (gitignored under `tests/e2e/visual-candidates/.runs/`): `phase20-class-icons-before` and `phase20-class-icons-after`, each 6 `.candidate.json` (3 viruses x chromium-desktop and chromium-phone) plus 12 PNGs (full frame and panel crop). The served target carries the three starter viruses, which together cover all nine new classes, so no frame is BLOCKED (DATA). The before set shows the old drawings (same shapes as before the plan); the after set shows the new ones.

## Deviations from Plan

**1. [Rule 1 - Bug] Incomplete SVG path in the first brain drawing**
- **Found during:** Task 3 (e2e capture)
- **Issue:** the brain outline ended with a `C` command that had only two coordinate pairs; Chromium logged `<path> attribute d: Unexpected end of attribute` and the diagnostics fixture failed the capture.
- **Fix:** completed the last segment; added a D-39 test that checks the argument count of every static path command in portia-icons.tsx (it fails on the old path and passes on the fixed one).
- **Files modified:** components/portia-icons.tsx, lib/virus-classes.test.ts
- **Commit:** ca585b8

**2. [Rule 3 - Blocking] e2e target and command**
- **Found during:** Task 3
- **Issue:** the plan's `npm run test:e2e:candidates -- <file>` also runs the whole `visual-candidates` directory (the script already names it), and the other session's dev server on port 3000 did not hydrate under Playwright.
- **Fix:** built with `PORTIA_E2E_ALLOW_HTTP=1`, served `next start` on 127.0.0.1:3100 (as in 20-19) with `PORTIA_E2E_BASE_URL`, and ran `npx playwright test --retries=0 --project=chromium-desktop --project=chromium-phone tests/e2e/visual-candidates/phase20-class-icons.spec.ts`. The first, mistaken run wrote unrelated candidate files into the before set; that directory was deleted and recaptured. The 3100 server was stopped after each capture; port 3000 was left alone. The production build goes into the shared `.next` (three builds), not checked against the other session's `next dev`; no breakage was reported.
- **Commit:** none (environment)

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact:** none on scope; the e2e frames are from a local production build against the target's served content.

## Notes for the owner and 20-11 / 20-14

- Icon approval is still the owner's (STAB-REL-08, STAB-VIS-03): no baseline was touched, `tests/e2e/visual/__screenshots__` has no changes. On the phone the panel crop of a long card is cut by the taskbar overlay (the full frame shows the same); the dimmed right half of «Транзитиум» is faint at 18px on the yellow level-2 colour, worth a look in 20-11.
- Live data: the SQL rewrite of old values is 20-21 (not run, no database touched). The live «Информация» text is not overwritten (D-38); the owner's text reaches live data only through the editor or the 20-21 option b.
- Requirements: STAB-CLASS-01, STAB-CLASS-02, STAB-CLASS-04 marked complete. STAB-VIS-03, STAB-REL-08 and STAB-A11Y-03 stay open (shared with other plans or awaiting owner approval of the new SVGs).

## Known Stubs

None.

## Threat Flags

None. T-20-24 (own-key lookups only; `__proto__`/`constructor`/`toString` pass through unchanged, tested) and T-20-25 (server compares normalized baseline and draft; D-36 test with openTabs without "viruses" returns null) are mitigated. No packages were installed.

## Self-Check: PASSED

All created files and the five task commits exist; RED commits precede their GREEN commits (dc2c6d2 before f71c0de, 98133b7 before 0c207e8).
