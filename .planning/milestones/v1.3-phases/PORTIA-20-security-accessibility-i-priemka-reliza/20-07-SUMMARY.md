---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 07
subsystem: ui
tags: [a11y, keyboard, focus, axe, touch-targets, motion, playwright]
requires:
  - phase: PORTIA-20
    provides: 20-05/20-06 candidate conventions and the port 3100 production build; 20-16 phone «Информация» navigation (axe-scanned here, behaviour untouched); 20-17 editor-side accessibility work
provides:
  - "tests/e2e/specs/accessibility.spec.ts: axe + keyboard + touch + overflow + motion matrix (chromium-desktop, chromium-phone, webkit-phone, firefox-desktop)"
  - "Keyboard alternative for the drag-only actions: Alt+Arrow moves a desktop shortcut, Alt+Left/Right reorders a taskbar entry, polite status reads the result"
  - "Qualification window (aria-modal) now makes the rest of the desktop inert and restores the focus"
  - "Template draft confirmation is a real trap with focus restore; Escape closes the custom-accent picker from its button; the disabled gate button names its reason for AT"
  - "Phone tap areas of at least 44x44 (window controls, taskbar, start button, settings, search); nameless phone taskbar buttons fixed (axe button-name critical)"
affects: [20-10, 20-11, 20-14]
status: complete
key-files:
  created: []
  modified:
    - components/portia-desktop.tsx
    - components/portia-desktop-shortcuts.tsx
    - components/portia-promotion.tsx
    - components/portia-template-builder.tsx
    - app/portia.css
    - tests/e2e/specs/accessibility.spec.ts
key-decisions:
  - "The tap area is measured with elementFromPoint outward from the centre, not with getBoundingClientRect, so a pseudo-element hit area counts and a covered control does not. The start button grows only its hit area (the approved start-open frame keeps its drawn size); window controls are drawn at 44 with the old 30px square kept inside, because no approved phone frame shows a window."
  - "The taskbar entry label is hidden by sight only (sr-only clip) instead of display:none, so the text stays its accessible name. An aria-label was tried first and removed: it made getByLabel(name) match both the window and the taskbar button and broke DesktopPage.window()."
  - "The disabled gate button is described by an sr-only sentence only. A visible line would change the approved promotion-participant-lookup frame (passes today), so the visible cue stays the label and placeholder; if the owner wants a visible line that is a 20-11 baseline decision."
  - "Medium colour-contrast defects in Archive, Global search and Trash are pinned in the spec as the only allowed serious fingerprint, recorded in WINDOWS.md, and NOT fixed: changing those label colours would alter approved window frames. They are FAIL until the owner verdict D-10, not an owner disposition."
requirements-completed: []
duration: ~3h (start time not recorded)
completed: 2026-11-04
actuals:
  tokens: 17800
  tasks: 2
  commits: 2
plan_head_before: 9c345242a506b7787d4fc1c5942f4d80122e364d
plan_head_after: ad3151827000837f8735bfa5a7db065e2ac1e2b8
---

# Phase 20 Plan 07: Keyboard, focus, touch and motion accessibility Summary

The desktop, Promotion (gate, participant, template builder), Settings and the phone «Информация» screens are axe-clean for critical and serious violations on Chromium, Firefox and WebKit lanes; drag-only desktop actions got keyboard alternatives, the aria-modal qualification window now actually traps, and phone controls take 44x44 taps. Role-gated surfaces and every physical-device claim stay BLOCKED.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Keyboard, name and focus on PC (components) | 7efc510 |
| 2 | Touch, overflow, motion on phone (CSS) and the whole spec | ad31518 |

The spec covers both tasks and is one file, so it is committed with Task 2; Task 1's commit holds only the component changes.

## What was found and fixed (before = first run on the unchanged build)

- Phone taskbar buttons had no accessible name (axe `button-name` critical, every window): label kept as text, hidden by clip.
- Drag-only actions (shortcut placement, taskbar order) had no keyboard route: Alt+Arrow / Alt+Left/Right, status «Ярлык «…» перемещён» / «Кнопка «…» перемещена: позиция N из M». Free window move/resize has no key route; maximize/minimize/close buttons remain. Recorded as LIMITATION, not a pass.
- `aria-modal` Promotion window during a qualification left shortcuts, taskbar and other windows tabbable: they are `inert` while it runs, focus returns to the opener (or the Promotion heading).
- Template «Черновик ещё не скачан» alertdialog let Tab leave it, and dismissing it dropped focus to `body`: Tab/Shift+Tab cycle over its two buttons, the grid is `inert`, Escape and «Остаться и скачать» refocus «Вернуться к повышению».
- Escape did nothing on «Свой» while the accent picker was open: handled on the button.
- Phone tap areas: window controls 30, start 36, settings/search/broadcast tabs 26-38; now at least 44 by hit-testing.

## Evidence (production build on port 3100, `PORTIA_E2E_ALLOW_HTTP=1`, stopped afterwards)

`npx playwright test --retries=0 --project=chromium-desktop --project=chromium-phone --project=webkit-phone --project=firefox-desktop tests/e2e/specs/accessibility.spec.ts`: 76 passed, 28 skipped, 0 failed. Skips: phone-only tests on desktop lanes, PC-only (Alt+Arrow) on phone lanes, and the 4 explicit BLOCKED (ENV) rows x 4 projects.

- Axe (critical + serious) on: home, Настройки, Повышение, Информация, Справочник, Сводка (PC and phone), Promotion gate empty and after an aborted lookup, participant (stub), template builder, phone «Информация» list and an article screen.
- Names/alt/svg sweep over the same windows: no empty, technical or duplicated control labels, every `img` has an `alt` that is not a file name, every visible SVG is aria-hidden or named.
- Focus: Tab walk over the participant window shows an outline or shadow on every stop; focus survives an accent change and a window resize; accent picker returns focus to «Свой».
- Gate: disabled button described by a spoken reason; aborted lookup gives exactly one alert, no duplicated status text, the 64-character Cyrillic value kept, no window widening.
- Template: every field has a visible label; trap, Escape and discard focus restore checked by keyboard.
- Phone (Pixel 7, iPhone 13): tap area of every control in 9 windows and the bottom bar at least 44x44, no page-level horizontal overflow, tap-only actions, focused gate field not under the bottom bar, no control covered at its centre.
- Motion (D-01..D-04): full to off switched in the same turn as a window opens: html `data-motion=off`, zero running animations within 3 s, the window is whole (opacity 1, no transform), the earlier wallpaper choice kept, «Настройки сохранены» written. Off and reduced on all five wallpapers: no running infinite animation, the spider's pose does not change over 300 ms. `emulateMedia({ reducedMotion: "reduce" })` leaves `data-motion=full` (also after reload). No `data-motion` rule targets video, audio, picture or gif; the only `img` motion rule is an opacity fade.
- Regression, explicit paths: `template-builder.spec.ts`, `info-phone-nav.spec.ts` and `visual-candidates/promotion.spec.ts` on chromium-desktop, chromium-phone, webkit-phone: 45 passed, 27 skipped (existing BLOCKED/phone-only), 0 failed. `npm test` 1258 pass, 0 fail, 3 skipped; `tsc --noEmit` clean; eslint on touched files 0 errors.
- Approved baselines: no file under `tests/e2e/visual/__screenshots__` changed. Running `tests/e2e/visual/desktop.spec.ts` on this target fails desktop-clean (294 px) and the phone frames (about 310 px chromium, 54k px webkit); with my phone rules neutralised by injected CSS the phone numbers stay the same (312/310 and 54248/54258), so they are not caused by this plan; desktop-clean was not isolated the same way (no visual CSS change reaches 1440 px), so that attribution is by reasoning, not by an A/B run. The participant lookup frame passes.

## Deviations from Plan

**1. [Rule 2 - missing critical] Files outside `files_modified`.** `components/portia-desktop-shortcuts.tsx` (keyboard move, WCAG 2.5.7) and `components/portia-template-builder.tsx` (trap and focus restore) are where the defects live; `portia-promotion-editor.tsx` is a one-line re-export and needed no change.

**2. [Rule 3 - Blocking] Verify command.** `npm.cmd run test:e2e -- tests/e2e/specs/accessibility.spec.ts` starts its own server on 3000, held by another session. Ran the same file against a production build on 3100 (`PORTIA_E2E_BASE_URL`), the 20-19 approach.

**3. [Rule 1 - own regression, fixed before commit]** `aria-label` on the phone taskbar buttons made `getByLabel(window name)` ambiguous and broke the whole suite's page object; replaced by the clipped-label approach.

**4. [Process]** The test commit message first said `PORTIA-20-07`; the first commit was amended to the `20-07` scope before anything else was built on it.

**5. UI-contract stub.** The participant and template lane stubs ONE read (`GET /api/promotion/status?nickname=`) exactly as `template-builder.spec.ts` does. It proves local markup only, not an authenticated participant or server behaviour.

**Total deviations:** 1 scope addition, 1 environment, 1 own regression, 1 process note, 1 stub caveat.

## BLOCKED / not proven

- BLOCKED (ENV): Promotion reviewer queue and editors, content-editor dialogs and drag handles, owner access manager, and a live qualification run (dialog trap and focus restore in a browser). Offline only: a source test shows the desktop wires `inert` and focus restore. Four explicit skipped rows in the spec carry the BLOCKED text.
- BLOCKED (DATA): expansion, «Далее» and search reveal of the phone «Информация» stay in `info-phone-nav.spec.ts` (the target has no section with subsections); only the list and an article screen are scanned here.
- Not proven without a device (20-14): screen-reader output (the Promotion shell is `aria-live="polite"` and contains `role=alert` items; the DOM has no duplicated text, whether a reader announces twice is unverified), hardware keyboard and virtual-keyboard occlusion on a physical phone, the physical reduced/off verdict (STAB-A11Y-04), the visual verdict.
- Medium defect, FAIL until owner verdict D-10: axe `color-contrast` serious on small muted labels in Archive (`.browser-labels`, `.row-index`, `.row-main small`, `.browser-footer`, 2.2-4.4:1), Global search (`.global-result-mark` 4.46:1) and Trash (`.trash-list-head` 4.0:1). The sheet and charter iframes (third-party pages) are excluded from axe. Windows 4-6 in `.planning/WINDOWS.md` record these and the blocked items.
- LIMITATION: free window move/resize and the editor's drag handles have no new key route in this plan.

## Known Stubs

None. (The participant lane stub above lives only in the test.)

## Threat Flags

None. T-20-07 held: the system `prefers-reduced-motion` does not switch the mode (tested), state is written out in text next to colour, no new package (T-20-SC).

## Requirements

None marked by this plan. STAB-A11Y-02 and STAB-A11Y-04 stay open: phone behaviour is proven only on emulated devices, the physical verdicts are 20-14, and the data-dependent «Информация» parts are BLOCKED (DATA). STAB-A11Y-01 and STAB-A11Y-03 were marked by 20-17 and are left as they are; this plan's evidence supports them for the visitor-reachable PC surfaces after the fixes above, but it also shows that before 20-07 the dialog trap, the drag alternative and the nameless phone buttons were real gaps, and it leaves the role-gated surfaces, screen-reader output and the contrast defects unproven. Treat that mark as partially evidenced until 20-14 and the owner verdict.

## Self-Check: PASSED

Files exist: the six modified files and this SUMMARY. Commits 7efc510 and ad31518 are ancestors of HEAD. The spec file was re-run in full after the last edit (76 passed, 0 failed); the build served was made from the final source and CSS.
