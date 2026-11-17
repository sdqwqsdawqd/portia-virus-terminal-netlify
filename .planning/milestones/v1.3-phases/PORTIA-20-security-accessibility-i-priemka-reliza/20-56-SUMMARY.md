---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 56
subsystem: editor-image-framing
tags: [D-66, D-67, image-framing, dialog, geometry, e2e, gap-closure]
requires:
  - phase: PORTIA-20
    provides: "20-53 block with three sliders (replaced), 20-51 ImageFraming format and site display, 20-55 D-66/D-67 recorded in 20-CONTEXT.md"
provides:
  - "lib/image-framing-crop.ts: pure geometry of the window (visible part by frame, stage layout, drag and key to frame, frame proportions of the place)"
  - "components/portia-image-framing.tsx: compact block (preview in the frame of its place + «Изменить») and the native dialog «Видимая часть»"
  - "e2e: D-66 chain on eight surfaces, D-67 frame = place of the site, natural at 100%, compact block"
  - "dialog_fix_commit for 20-57 and 20-58"
affects: [20-57, 20-58]
tech-stack:
  added: []
  patterns:
    - "Frame of the window = cover of a frame with the proportions of the place; a picture shown whole is the same rule with the proportions of the picture (fw = fh = 1)"
    - "Visible part at zoom z: left = x * (1 - fw / z), width = fw / z; stage keeps the frame's pixel size and grows the picture by z"
    - "Dialog state is its own (draft), the editor draft changes only on «Применить»; Esc/cancel is handled in the dialog so desktop Esc handlers do not hear it"
    - "Site model in e2e (siteWindow): independent DOM model (img layout box, object-fit, object-position, matrix scale, inline transform-origin)"
key-files:
  created:
    - lib/image-framing-crop.ts
    - lib/image-framing-crop.test.ts
  modified:
    - components/portia-image-framing.tsx
    - app/portia.css
    - lib/editor-image-framing.test.ts
    - tests/e2e/specs/editor-ui-contract.spec.ts
key-decisions:
  - "Band frame is 754:63 on PC (window 820 - 66) and (screen - 50):63 on a phone: the height is 63, not 64 (min-height 64 px minus the 1 px border under the strip; the band fills the padding box), measured on chromium 1440 / Pixel 7 / iPhone 13 and guarded by a unit test over the sources"
  - "Axis the picture does not leave is forced to 50 (arrows, drag, zoom change), so 50/50/100 stays 'no frame'"
  - "Pictures the site draws smaller or clipped against their frame are compared against the drawn picture, with the difference measured and capped at 25% (known limit, plan assumption 2)"
  - "Dialog gets margin: auto (the Tailwind reset removes the native centering of a modal dialog)"
requirements-completed: [STAB-A11Y-01, STAB-REL-06, STAB-REL-08]
duration: about 3 h
completed: 2026-11-08
status: complete
outcome: fixed-awaiting-owner-gallery
commits: 3
plan_head_before: 9d3e6074e246dd7b1b6669e2278fa13c814435e5
plan_head_after: 3b4705b925d3b2ba37cc75c79988cd47fbce5d39
actuals:
  tokens: 28000
  tasks: 2
  commits: 3
---

# Phase 20 Plan 56: Dialog «Видимая часть» instead of three sliders (D-66, D-67) Summary

Under every picture field with a frame there is now a compact block (preview in a frame of the proportions of its place and «Изменить»); the button opens a native dialog with the whole picture dimmed, a light frame of the real place, one «Масштаб» slider, «Положение картинки» (arrows, pointer), «Сбросить», «Отмена», «Применить». The data format, the server and the editor file are byte-identical to PLAN_BASE.

PLAN_BASE: 9d3e6074e246dd7b1b6669e2278fa13c814435e5

dialog_fix_commit: 2bbdafb48af37408a41b2e4fd47cfc87c25ae881

`dialog_fix_commit` is the last commit of this plan that changes `app`, `components` or `lib` product code (`components/portia-image-framing.tsx`, `lib/image-framing-crop.ts`, `app/portia.css`). Later commits of the plan are tests and documents only (`3b4705b` test, the docs commit). 20-57 and 20-58 refer to `2bbdafb`.

## Accomplishments

- Pure geometry `lib/image-framing-crop.ts` checked against an independent CSS model (object-fit cover, object-position, scale around x% y%) on 4 pictures x 4 frame kinds x 25 positions x 3 zooms.
- Closed block: no slider, preview in a frame of the place (band, 4:3 cover, picture as it lies), «Изменить» (44 px on a phone).
- Dialog: native `<dialog>` (top layer), draft of its own, pointer drag with window listeners and `touch-action: none`, arrows 5 %, «Масштаб» 100-300 step 5 between small/large picture icons, Esc and «Отмена» close without change and leave the editor window open, backdrop click does not close, focus returns to «Изменить».
- Picture shown whole: at 100 % the frame equals the picture (rectangles within 1 px) and arrows change nothing; zoomed, the picture leaves the frame and moves; a zoom that returns an axis inside the frame sets it to 50; 50/50/100 is not stored.
- e2e chain on all eight surfaces (PC and phone): dialog -> «Применить» -> preview -> PUT body (intercepted and aborted) -> site; second session reads the frame back; «Отмена», Esc, backdrop, «Сбросить» + «Применить» (no key in the body) and a new address (no key).

## Measurement «before» (block of 20-53, PLAN_BASE 9d3e607, same fixture and field)

| Surface | chromium-desktop 1440x900 | chromium-phone (Pixel 7) | webkit-phone (iPhone 13) |
|---|---|---|---|
| «Справочник» section photo (band) | 274 px | 358.95 px | 355.13 px |
| virus photo after infection (natural) | 550 px | 506.66 px | 492 px |

Site band on PLAN_BASE (layout size): 754x63 (PC), 362x63 (Pixel 7), 340x63 (iPhone 13); the strip is 64 px, 1 px is the border under it.

## Closed block «after» (ratio to «before», limit 0.5)

| Surface | chromium-desktop | chromium-phone |
|---|---|---|
| band | 91.4 px, 0.334 | 125.0 px, 0.348 |
| natural | 170.0 px, 0.309 | 182.0 px, 0.359 |

(webkit-phone: the same two tests pass; the ratio is below 0.5.)

## Surfaces: frame kind, proportions, visible part, e2e

Frames 20/80/160 and 50/30/200. Proportions: dialog frame against the place on the site (limit 2 %); visible part: maximum difference of the four fractions (limit 0.015). Values from chromium-desktop / chromium-phone annotations of the run.

| Surface | Frame kind | Ratio dialog / site | Max difference of the visible part (PC / phone) | e2e chromium-desktop / chromium-phone / webkit-phone |
|---|---|---|---|---|
| «Справочник» section photo | band | 11.969 / 11.968 (PC), 5.746 / 5.746 (phone) | 0.0000 / 0.0001 | pass / pass / pass |
| «Справочник» card cover | tile 4:3 | 1.333 / 1.328 (PC), 1.333 / 1.336 (phone) | 0.0021 / 0.0011 | pass / pass / pass |
| virus photo after infection | natural | 1.500 / 1.499 | 0.0006 / 0.0001 | pass / pass / pass |
| mutation image | natural | 1.500 / 1.492 | 0.0034 / 0.0001 | pass / pass / pass |
| «Информация» photo block | natural | 1.500 / 1.497 | 0.0013 / 0.0026 | pass / pass / pass |
| «Корзина» image file | natural | 1.500 / 1.501 | 0.0004 against the drawn picture (0.0265 against the clipping frame, see below) / 0.0001 | pass / pass / pass |
| «Корзина» virus photo | natural | 1.500 / 1.500 | 0.0000 / 0.0009 | pass / pass / pass |
| «Корзина» virus mutation image | natural | 1.500 / 1.497 | 0.0013 / 0.0009 | pass / pass / pass (webkit: against the drawn picture) |

## TDD

- RED (commit b4962ad): `lib/image-framing-crop.test.ts` against a stub module: 11 of 12 failed (the 12th was strengthened to fail). `gsd_run check tdd-red-evidence` (TAP): `RED_EVIDENCE_OK`, reason `target_test_failed`, target «D-67 visibleWindow equals the CSS model …» failed on the planned assertion. Semantic assessment: the target ran and failed because the stub returns the whole picture; no load, syntax or fixture fault. `lib/editor-image-framing.test.ts`: 2 failed (captions of the block, import of the geometry module). e2e on the base build (chromium-desktop, `-g "«Справочник» section photo"`): 4 of 4 failed, target «D-66 «Справочник» section photo (band): the dialog chooses the part, the preview is the site» on the planned assertion «the closed block holds no slider» (three sliders still there); JUnit evidence `RED_EVIDENCE_OK`, reason `target_test_failed`.
- GREEN (commit 2bbdafb): unit 12/12, then e2e on the new build: `⚡ Tracer verified end-to-end — expanding`.
- Task 2 RED: the surfaces and D-67 cases for all eight places were written in the Task 1 RED commit (the whole matrix was red against the base build for the same reason). The first run of the matrix on the new build gave 2 failures, both «Корзина» image file D-67 visible part on chromium-desktop: dialog 0.6250 against site 0.6515 (and 0.5000 / 0.5212). Cause: the site draws that picture 4.2 % narrower than its clipping frame (`.trash-image-document img` max-height min(720px, 55vh) at 900 px high), so the site shows a little more than the dialog promises. This is plan assumption 2 (pictures capped in height); it is not a defect of the dialog and not fixable without changing the site. The e2e now compares against the drawn picture where the clipping frame differs from it (measured, capped at 25 %, annotation in the report). WebKit on iPhone 13 had the same effect for «Корзина» virus mutation (height 0.5 against 0.422).
- REFACTOR: none.

## Verification

| Command | Result |
|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` | 1604 tests, 1600 pass, 0 fail, 4 skipped |
| `node --experimental-strip-types --test lib/image-framing-crop.test.ts lib/image-framing.test.ts lib/editor-image-framing.test.ts lib/format-launch.test.ts lib/portia-template-builder.test.ts` | 61 tests, 61 pass, 0 fail |
| e2e `editor-ui-contract.spec.ts` + `image-framing.spec.ts`, chromium-desktop + chromium-phone, `--retries=0` | 80 passed, 0 failed, 0 skipped (40 + 40) |
| e2e `editor-ui-contract.spec.ts`, webkit-phone, `--retries=0` | 35 passed, 0 failed |
| e2e webkit-phone `-g "D-67 «Справочник» section photo"` | 2 passed |
| `tsc --noEmit` | exit 0 |
| eslint (component, lib, spec) | 0 errors, 1 pre-existing warning (`lib/portia-promotion.test.ts`, unused `day`) |
| `git diff --exit-code 9d3e607 -- components/portia-editor.tsx components/portia-editor-dossier.tsx lib/image-framing.ts lib/portia-content-normalize.ts` | exit 0 |
| `git diff --exit-code --stat 9d3e607 -- tests/e2e/visual/__screenshots__` | exit 0 |
| port 3100 after the run | not listening |

Build and server ran in a throwaway worktree (`C:/Users/User/AppData/Local/Temp/portia-20-56-verify`) at the commit under test, with its own physical `node_modules`, no `.env*` file, invented public values (made-up Supabase project ref, dummy publishable key and device secret, no service role, no production). Node 22.13.1 from the temp folder. The worktree was removed and the server stopped. The e2e specs of the worktree were copies of the files committed afterwards (identical bytes, `diff -q`).

## Deviations from Plan

**1. [Rule 3 - Blocking] Build and server in an isolated worktree, not in the main folder**
- Same reason and method as 20-55 (real `.env.local` in the main tree; CLAUDE.md and the blocking constraints of the phase). Consequence: no read data source; the e2e of this plan uses only substituted reads, so nothing here is BLOCKED by it.

**2. [Rule 1 - Bug in own plan] Band height 63 px, not 64 px**
- Found during: «before» measurement. The band element is 754x63 (strip min-height 64 px minus the 1 px border under it; the band is `inset: 0` in the padding box). A 64 px model gives 11.78 against the site's 11.97 (1.6 %, close to the 2 % limit). `bandFrameHeight = 63`; the unit guard checks the sources (min-height 64 px, border-bottom 1 px, band `inset: 0`, `guide: [820, 650]`, 900 px phone threshold). Window margins 66 px (PC) and 50 px (phone) are measured, not derivable from sources.

**3. [Rule 1 - Bug] Dialog was drawn in the top-left corner**
- Found in a screenshot after the first green run: the Tailwind reset removes the native `margin: auto` of a modal dialog. Fix: `margin: auto` on `.image-framing-dialog` (in `dialog_fix_commit`). Observation, not touched: `.portia-dialog` (ConfirmDialog) has no `margin: auto` either; I did not check how ConfirmDialog looks in the app.

**4. [Rule 1 - Bug in own test] WebKit diagnostics and lazy pictures**
- WebKit words an aborted request «Blocked by Web Inspector» and reports a cancelled load when the test leaves the page; pictures below the fold are lazy in WebKit. Declared as faults of the test (expectFault) and `scrollIntoViewIfNeeded` (commit 3b4705b).

**5. [Plan assumption 2 made measurable] Site draws a picture other than its frame**
- See TDD / Task 2 RED. Test-side only; no product change. The overshoot is recorded in annotations; «Корзина» image file on 1440x900: clipping frame 1.0417 x the drawn picture.

**Total deviations:** 5 (1 environment, 3 own-test or own-plan bugs, 1 limitation recorded). **Impact:** none on data, server or editor file.

## Known limitation for 20-57 (UI-SPEC)

Where the site caps a picture in height by its style sheet (`max-height` 55vh/72svh/620 px) or clips it with a frame of another size, the dialog (frame = picture as a whole) and the site differ by up to the overshoot: 4.2 % of width for the «Корзина» image file at 1440x900 and about 18 % of height for the «Корзина» virus mutation on a 664 px high screen. This is the plan's assumption 2; the number is a function of the visitor's window and cannot be known by the editor.

## Not proven here (by plan)

Dragging by finger and mouse, cyclic Tab, focus and axe of the dialog (20-57); real photos on a physical phone and screen reader (owner, STAB-A11Y-01/02, STAB-REL-08 stay open until acceptance). The existing `phase20-editor-images.spec.ts` candidate spec was not touched (not in this plan's files); its closed-block frames show the new block, the dialog is not in a candidate frame.

## Task Commits

1. `b4962ad49b576378cb209a58263c8859253e87ca` test RED (stub, unit tests, e2e) with `PLAN_BASE:` in the body
2. `2bbdafb48af37408a41b2e4fd47cfc87c25ae881` feat GREEN (module, component, styles) = `dialog_fix_commit`
3. `3b4705b925d3b2ba37cc75c79988cd47fbce5d39` test (WebKit, drawn-picture comparison)

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or storage touched; values leaving the dialog are integers within `imageFramingLimits` and pass `normalizeImageFraming` (T-20-122); editor file, picture field file, `lib/image-framing.ts` and `lib/portia-content-normalize.ts` are byte-identical to PLAN_BASE (T-20-123); every write other than the intercepted PUT /api/content fails the tests (T-20-124).

## Self-Check: PASSED

Files exist (`lib/image-framing-crop.ts`, `lib/image-framing-crop.test.ts`, `components/portia-image-framing.tsx`, `app/portia.css`, spec); commits b4962ad, 2bbdafb, 3b4705b are ancestors of HEAD; acceptance greps: `grep -c "image-framing-crop" components/portia-image-framing.tsx` >= 1, `D-66`/`D-67` in the spec >= 1, `getByRole("slider", { name: "По горизонтали" })` count 0, `__screenshots__` unchanged, 3100 free.
