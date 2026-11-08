---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 57
subsystem: editor-image-framing
tags: [D-66, D-67, image-framing, dialog, a11y, touch, e2e, gap-closure]
requires:
  - phase: PORTIA-20
    provides: "20-56 dialog «Видимая часть» (native dialog, geometry in lib/image-framing-crop.ts), 20-55 D-66/D-67 in 20-CONTEXT.md"
provides:
  - "e2e: finger (phones) and mouse (PC) drag the picture under the frame, through «Применить», the PUT body and the site"
  - "e2e: names, values, focus order, Tab ring, Esc and «Отмена», phone layout and 44 px targets, axe of the block and the open dialog, motion off"
  - "components/portia-image-framing.tsx: Tab and Shift+Tab go round the five stops of the dialog"
  - "candidate frames with the dialog open, UI-SPEC section, UAT EDITOR-FRAMING-01, todo"
  - "framing_fix_commit for 20-58"
affects: [20-58]
tech-stack:
  added: []
  patterns:
    - "Touch in e2e: CDP Input.dispatchTouchEvent on chromium, PointerEvent pointerType touch through dispatchEvent on WebKit; method written to the run annotations"
    - "Expected drag result computed from the rectangles of the picture and the frame in the dialog, not from lib/image-framing-crop.ts"
    - "Position read after it stops changing (a dispatched drag ends before React paints the last move)"
key-files:
  created: []
  modified:
    - components/portia-image-framing.tsx
    - tests/e2e/specs/editor-ui-contract.spec.ts
    - tests/e2e/visual-candidates/phase20-editor-images.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md
    - .planning/todos/pending/2026-11-08-image-framing-crop-preview.md
key-decisions:
  - "The dialog keeps the Tab ring itself (keepFocusInside): past «Применить» the native modal dialog handed the focus to the browser interface (chromium, WebKit) or left it in place (Firefox)"
  - "Drag behaviour of 20-56 needed no product change: the new tests were green on its build and were proven able to fail by throwaway mutations"
requirements-completed: [STAB-A11Y-01, STAB-A11Y-02, STAB-A11Y-03, STAB-REL-08]
duration: about 2 h
completed: 2026-11-08
status: complete
outcome: fixed-awaiting-owner-gallery
commits: 5
plan_head_before: 964fa764d8ae14a1aeea66804963f2e018658632
plan_head_after: 83ba50b3f6438a332fcc7090b23e1688587b0e9a
actuals:
  tokens: 30000
  tasks: 3
  commits: 5
---

# Phase 20 Plan 57: Dialog «Видимая часть» accepted: drag, keyboard, phone, axe (D-66, D-67) Summary

The dialog is dragged by mouse and by finger down to the site, keyboard and screen-reader names and the Tab ring are proven on four engines, the phone layout and axe are clean, and the candidate frames now show the open dialog. One product fix: Tab and Shift+Tab go round inside the dialog.

PLAN_BASE: 964fa764d8ae14a1aeea66804963f2e018658632

framing_fix_commit: 98af38704317b5ec3059c0d81867d4983bd03670

`framing_fix_commit` is the last commit of 20-56 or 20-57 that changes `app`, `components` or `lib` product code: `98af387` (`components/portia-image-framing.tsx`, Tab ring). `2bbdafb` (20-56) is the one before it. 20-58 refers to `98af387`. This SUMMARY's own commit and the docs commit change no product code.

## Accomplishments

- Drag: chromium-phone (real touch events through CDP), webkit-phone (touch PointerEvents), chromium-desktop (mouse). Right 40 px / down 20 px moves «Положение картинки» opposite by the rectangle rule (±1); page and editor window do not scroll; `touch-action: none`; a drag released outside the stage and the dialog, over the dialog head, or cancelled (pointercancel) keeps the dialog open and the frame of the last move and leaves nothing holding the pointer; «Применить» -> intercepted PUT body -> the site shows the same part (max difference 0.0000 on all three).
- Keyboard and names: «Изменить» `aria-haspopup="dialog"`; dialog and closed block have the same name «Видимая часть <метка поля>»; focus on «Положение картинки» at open; «Масштаб» min 100, max 300, step 5, valuetext in percent; Tab and Shift+Tab over the five stops (10 presses each way) stay inside the dialog; Esc and «Отмена» keep the draft, leave the editor window open and return the focus to «Изменить».
- Phone: dialog inside the screen, no horizontal scroll of the page or dialog, every target at least 44x44, stage at least 280 px, closed block over neither the address field nor the upload zone.
- axe (no tolerance) on the closed block and on the open dialog in «Справочник», «База вирусов», «Информация», «Корзина», chromium-desktop and chromium-phone; whole tab only with the known nodes. Motion «Выключены»: no running animation and no animation or transition duration in the dialog.
- Candidates: editor-image-framing-guide and -dossier with the open dialog at 30 / 60 / 150; guide-framed and dossier-framed state the same frame as the dialog. UI-SPEC section rewritten (D-66, D-67, limits), Copywriting row, E9 rows; UAT EDITOR-FRAMING-01 (PC and phone) describes the dialog, status ОЖИДАЕТ; todo updated.

## Touch method per engine

| Project | How the finger is made |
|---|---|
| chromium-phone (Pixel 7) | CDP `Input.dispatchTouchEvent` (touchStart / touchMove / touchEnd / touchCancel): real touches, the browser makes the pointer events |
| webkit-phone (iPhone 13) | `PointerEvent` with `pointerType: "touch"`, `isPrimary`, one `pointerId`, through `locator.dispatchEvent` (pointerdown / pointermove / pointerup / pointercancel); `setPointerCapture` is refused for a synthetic pointer and the component's try/catch plus the window listeners carry the drag |
| chromium-desktop | `page.mouse` |

## Measurements (phone dialog, annotations of the run)

| Project | Screen | Dialog | Stage | «Изменить» | «Масштаб» | «Сбросить» | «Отмена» | «Применить» |
|---|---|---|---|---|---|---|---|---|
| chromium-phone | 412x839 | 374.0x559.6 at 19.0, 139.7 | 336.0x360.0 | 86.3x44.0 | 202.0x44.0 | 86.3x44.0 | 72.3x44.0 | 93.4x44.0 |
| webkit-phone | 390x664 | 352.0x559.6 at 19.0, 52.2 | 314.0x360.0 | 86.3x44.0 | 180.0x44.0 | 86.3x44.0 | 72.3x44.0 | 93.4x44.0 |

Tab order (identical on chromium-desktop, chromium-phone, firefox-desktop, webkit-phone, after the fix): «Положение картинки» > «Масштаб» > «Сбросить» > «Отмена» > «Применить» > «Положение картинки» > ...; Shift+Tab is the reverse.

## TDD

- Task 1 (tracer): the drag tests (commit `ee702f9`) were GREEN on the 20-56 build on the first run, so no RED and no product change (fail-fast rule «unexpected GREEN» investigated: the behaviour is implemented by 20-56, the test is not wrong). The tests were proven able to fail with two throwaway mutations built and run in the isolated worktree and reverted: (a) no `pointercancel` handler -> touch test fails on chromium-phone and webkit-phone at «a stray move after the drag ended: x 100 against 34/35»; (b) no `touch-action: none` -> fails at «the stage takes the touches itself». Tracer gate: verify re-run, 3 passed, 3 skipped, `⚡ Tracer verified end-to-end — expanding`. A first WebKit run read the position before React had painted the dispatched move (x 39 / 50 against 29): the test now reads it once it stops changing (a test-side timing fault, commit `ee702f9`).
- Task 2 RED (commit `8a9dc1f`): target «[STAB-A11Y-01] D-66 dialog: names, values, focus, Tab inside, Esc and «Отмена» keep the draft» on chromium-desktop (JUnit, `gsd check tdd-red-evidence`): `RED_EVIDENCE_OK`, reason `target_test_failed`. Semantic assessment: the target ran and failed on the planned assertion «Tab 5: the focus is inside the dialog (it is on «the page body»)»; every earlier assertion (names, focus on open, values) passed; no load, syntax or fixture fault. Same failure on chromium-phone and webkit-phone; on firefox-desktop the focus stayed on «Применить» (no ring). Phone, motion-off and axe tests were already green.
- Task 2 GREEN (commit `98af387`): `keepFocusInside` in the dialog's `onKeyDown`: Tab on the last stop goes to the first, Shift+Tab on the first goes to the last. Ten passed, two skipped on four engines. REFACTOR: none.
- Test fix `599d6e4`: Firefox writes an inline `transform-origin` with a third `0px`; the 20-56 chain test now drops it (product value unchanged).

## Verification

| Command | Result |
|---|---|
| `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1) | 1604 tests, 1600 pass, 0 fail, 4 skipped |
| e2e `editor-ui-contract.spec.ts` + `image-framing.spec.ts`, chromium-desktop + chromium-phone, `--retries=0` | 87 passed, 0 failed, 3 skipped (touch on desktop, mouse on phone, phone dialog on desktop) |
| e2e `editor-ui-contract.spec.ts`, webkit-phone, `--retries=0` | 39 passed, 0 failed, 1 skipped (run before the test-only Firefox fix; the fix does not touch WebKit paths) |
| e2e firefox-desktop `-g "D-66 dialog|D-66 «Справочник» section photo|D-67 «Справочник» section photo"` (after the fix) | 4 passed, 0 failed (before the fix: 5 passed, 1 failed on the 0px) |
| e2e Task 1 verify (`D-66 touch|D-66 mouse`, three projects) | 3 passed, 3 skipped |
| e2e candidates `phase20-editor-images.spec.ts`, set `phase20-dev-editor-images-d66`, chromium-desktop + chromium-phone | 10 passed, 0 failed |
| `tsc --noEmit` | exit 0 |
| eslint (whole repo, as in verify) | 0 errors, 17 warnings (pre-existing, in `.runs` helper scripts and tests) |
| `git diff --exit-code 964fa76 -- components/portia-editor.tsx components/portia-editor-dossier.tsx lib/image-framing.ts lib/portia-content-normalize.ts` | exit 0 |
| `git diff --exit-code --stat 964fa76 -- tests/e2e/visual/__screenshots__` | exit 0 |
| port 3100 after the run | not listening |

Candidate frames in `tests/e2e/visual-candidates/.runs/phase20-dev-editor-images-d66/` (ignored by git; copied from the verify worktree): editor-info-add-section, editor-image-framing-guide, editor-image-framing-dossier, guide-framed, dossier-framed, each on chromium-desktop and chromium-phone (10 png plus 10 candidate.json). Opened and looked at: guide on desktop and dossier on the phone show the dimmed whole picture, the light frame and the dialog buttons.

Build and server ran in a throwaway worktree (`C:/Users/User/AppData/Local/Temp/portia-20-57-verify`) at the base commit with product and spec files copied in from the working tree (identical bytes), its own physical `node_modules` (hardlinked copy, no junction), no `.env*` file other than the tracked `.env.example`, invented public values (made-up Supabase project ref, dummy publishable key and device secret, no service role, no production), production `next build` and `next start` on 3100, Node 22.13.1. The worktree was removed and the server stopped.

## Deviations from Plan

**1. [Rule 3 - Blocking] Build and server in an isolated worktree** — same reason and method as 20-55 and 20-56 (real `.env.local` in the main tree).

**2. [TDD gate] Task 1 had no RED** — the drag tests passed on the 20-56 build. Recorded above with the mutation proof; no GREEN commit for Task 1 because no product change was needed.

**3. [Rule 1/2 - Bug, missing critical a11y] Tab did not go round inside the dialog** — Found during: Task 2 RED. Fix: `keepFocusInside` in `components/portia-image-framing.tsx`. Verification: four engines. Commit: `98af387`. The plan assumed the native modal dialog does this; it does not (chromium and WebKit hand the focus to the browser interface, Firefox leaves it on «Применить»).

**4. [Rule 1 - Bug in own test] Position read before React painted; Firefox transform-origin with 0px** — test-side only (`ee702f9`, `599d6e4`).

**5. [Plan wording] «Cancelled touch» test added** (pointercancel, and the mouse drag released over the dialog head) beyond the plan's drag-outside case; no cost, same helpers.

**Total deviations:** 5 (1 environment, 1 TDD-gate note, 1 product fix, 1 own-test fault, 1 addition). **Impact:** none on data format, server or the editor file.

## Findings reported, not changed

- `.portia-dialog` (ConfirmDialog) has `width` but no `margin: auto` rule of its own, the same cause as the 20-56 centring bug of `.image-framing-dialog` (Tailwind reset). Not in this plan's scope and not looked at in the app; reported for the owner or a later plan.
- Known limits documented in UI-SPEC (not fixable by the editor): site frame of capped pictures (4.2 % of width for the «Корзина» image file at 1440x900; about 18 % of height for the «Корзина» virus mutation on a 664 px screen) and the fixed band frame when the «Справочник» window is stretched.

## BLOCKED / not proven here

Real photos of the owner, physical phone (touch is emulated by CDP / synthetic PointerEvents) and screen reader (owner, 20-UAT EDITOR-FRAMING-01), live editor role and saving on the server (ENV; the UI contract substitutes reads only, PUT /api/content is intercepted and aborted). STAB-A11Y-01..03 and STAB-REL-08 stay open until the owner's acceptance; `requirements.mark-complete` was not run, by plan.

## Task Commits

1. `ee702f9fa64efc3c8ecf24e966ead1212dca9b02` test: drag by finger and mouse (tracer; PLAN_BASE in the body)
2. `8a9dc1fc00fc570c3aa67cdd36fe78d4c7f34ff5` test RED: dialog a11y, phone, motion off, axe, Tab ring
3. `98af38704317b5ec3059c0d81867d4983bd03670` feat GREEN: Tab ring = `framing_fix_commit`
4. `599d6e496c51775d0e7f07c873c1cae6a2e58b4b` test: Firefox transform-origin
5. `83ba50b3f6438a332fcc7090b23e1688587b0e9a` docs: candidates, UI-SPEC, UAT, todo

## Known Stubs

None.

## Threat Flags

None. No endpoint, route, table or permission added; `keepFocusInside` only moves focus inside the dialog (T-20-125 mitigated: Esc, «Отмена», «Применить» close it and return the focus, a cancelled or outside-released drag leaves nothing holding the pointer); candidates keep the UI-contract wording (T-20-126); editor file, picture field file, `lib/image-framing.ts` and `lib/portia-content-normalize.ts` byte-identical to PLAN_BASE (T-20-127).

## Self-Check: PASSED

Commits ee702f9, 8a9dc1f, 98af387, 599d6e4, 83ba50b are ancestors of HEAD; `grep -c 'D-66 touch'`, `'D-66 mouse'`, `'D-66 dialog'`, `'D-66 axe'` in the spec all >= 1; D-66 / D-67 counts in the candidate spec, UI-SPEC and UAT >= 1; `20-57` in the todo >= 1; `git cat-file -e 98af38704317b5ec3059c0d81867d4983bd03670^{commit}` ok; `__screenshots__` unchanged; 3100 free.
