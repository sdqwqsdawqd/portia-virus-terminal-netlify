---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 05
subsystem: ui
tags: [svg, illustrations, empty-states, a11y, playwright-candidates]
requires:
  - phase: PORTIA-20
    provides: 20-04 candidate conventions and production-build e2e on port 3100; 20-20 icons file (class icons untouched)
provides:
  - "flaskEmpty and microscopeGuide: two new 96x96 named drawings in PortiaIllustration"
  - "Only three call sites switched: «Информация» empty, «Сводка» → «Новости» empty, «Справочник» empty"
  - "data-illustration attribute on every PortiaIllustration svg (test hook, no visual change)"
  - "Candidate frames, crops and contrast numbers for the empty/loading/error/populated states, PC and phone"
affects: [20-10, 20-11, 20-14]
status: complete
key-files:
  created:
    - tests/e2e/visual-candidates/phase20-empty-art.spec.ts
  modified:
    - components/portia-icons.tsx
    - components/portia-desktop.tsx
    - components/portia-desktop-documents.tsx
key-decisions:
  - "Variants are additive names in the union; flask, microscope and dish are byte-identical (sha256 pinned in the spec from 8c05499)."
  - "The «Новости»/«Квесты» call site is shared, so it picks flaskEmpty only when broadcastTab is news; quests keep flask."
  - "Error panels (AppFatalPanel) of the three apps keep the old drawing: D-21 names only the empty states, and the error must not read as an empty list."
  - "Own /api answers are never fulfilled with invented data: loading uses a held request, error an aborted one; states the target cannot show are recorded BLOCKED (DATA)."
requirements-completed: []
duration: ~1h45m
completed: 2026-11-04
actuals:
  tokens: 16000
  tasks: 2
  commits: 2
plan_head_before: 8c05499c6e18f5add88ad8930a42342169aca675
plan_head_after: cb1d38ea6131e5015b1ca566339866446eb0e14c
---

# Phase 20 Plan 05: Targeted flask and microscope empty-state drawings Summary

A new 96x96 lab flask (graduated neck, tinted liquid with a wave line, bubbles, ground line) appears only in the empty «Информация» and «Новостей пока нет»; a new 96x96 microscope (tilted tube, arm, stage with slide, lamp, focus knob) appears only in the empty «Справочник». Quests, archive, global search, the iframe error, trash, employees and every error panel keep their old drawings.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Targeted flask and microscope variants, three call sites | 6e995e6 |
| 2 | States and visual candidates (spec, 22 tests per lane) | cb1d38e |

## Evidence (production build on port 3100, `PORTIA_E2E_ALLOW_HTTP=1`, stopped afterwards)

`npx playwright test --retries=0 --project=chromium-desktop --project=chromium-phone tests/e2e/visual-candidates/phase20-empty-art.spec.ts`: 44 passed, 14 skipped (every skip has a BLOCKED (DATA) record or points to one). `tsc --noEmit` clean, eslint clean on touched files, `npm test` 1229 pass / 0 fail. `tests/e2e/visual/__screenshots__` has no changes.

- Source: old flask/microscope/dish sha256 equal the pre-plan values; new drawings differ and use only currentColor; exactly three call sites name a new variant (info, news, guide).
- Real target data: no news, no quests, no guide cards, 4 info sections, 3 viruses. So these states ran on real data: «Новости» empty, «Квесты» empty (old flask, same window), «Справочник» empty, global search no-match (old microscope).
- Loading (held request): skeleton, no `svg[data-illustration]`, no empty box, for all three apps.
- Error (aborted request): reason «Нет связи с сервером», retry enabled, old drawing (`flask` for info/news, `microscope` for guide), the empty heading is absent.
- Populated: «Информация» populated, no drawing in the window.
- Empty drawing: right `data-illustration`, `aria-hidden`, viewBox 96, 96x96 CSS px, Russian heading and body equal `emptyCopy`, inside the window, no page-level horizontal scroll; default, `#1a1a1a`, `#f2f2f2` accents and motion off, PC and phone.
- Contrast of the drawing against its background (farthest pixel vs corners): default 5.7, dark custom 3.9, light custom 7.3 (threshold 3, decorative graphic).
- Long text: heading and body replaced by long phrases on the live element wrap beside the drawing, drawing stays 96 px, no overlap, no horizontal scroll (news and guide, PC and phone).
- Unchanged surfaces: «Квесты» empty = flask, search = microscope (markup differs from the guide one), archive error = microscope, «Таблица» iframe error = microscope.
- Candidate frames and crops: `tests/e2e/visual-candidates/.runs/phase15-current-6e995e6e2112/empty-art-*` (gitignored).

## Deviations from Plan

**1. [Rule 3 - Blocking] Verify command.** The plan's `npm run test:e2e:candidates -- <file>` also runs the whole `visual-candidates` directory and the shared port 3000 was held; ran the file alone against a production build on 3100 (`PORTIA_E2E_BASE_URL`) as in 20-19/20-04.

**2. [Rule 2 - test hook] `data-illustration` attribute** added to `PortiaIllustration` so the spec can prove which drawing a surface uses. No visual change. Included in the Task 2 commit.

**3. [Rule 1 - Bug in own test, fixed before commit]** the window scales in on open, so a bounding box measured 95 px; the spec now waits for finite animations and reads layout size.

**Total deviations:** 1 blocking (environment), 1 added test hook, 1 self-fix.

## BLOCKED / not proven

- «Информация» empty (all accents, PC and phone, long text): BLOCKED (DATA), the target serves 4 info sections. No API answer was invented; the new flask is seen in context in «Сводка» → «Новости».
- Populated «Сводка» and «Справочник», archive empty (old microscope): BLOCKED (DATA), no records / viruses present. Archive old drawing is proven by source hash and its error panel.
- Staging: nothing here is staging evidence; the target is the local production build reading the configured data source.
- Owner verdict on both drawings (STAB-VIS-03) and new baselines: pending (20-11); no baseline touched. Physical phone check: 20-14.

## Known Stubs

None.

## Threat Flags

None. T-20-05 held: only the named variants were added and the three call sites switched; no package installed (T-20-SC).

## Requirements

STAB-VIS-03 stays open: it needs the owner verdict on both drawings and on the other redrawn SVGs (20-04, 20-20 class icons), and the BLOCKED (DATA) states above.

## Self-Check: PASSED

Created and modified files exist; commits 6e995e6 and cb1d38e are ancestors of HEAD; `<verify>` tsc exit 0 and the spec file re-ran green (44 passed).
