---
phase: PORTIA-05-oformlenie-teksta
verified: 2026-10-19T14:00:00Z
status: human_needed
score: 15/15 must-haves verified
covered_files:
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-01-PLAN.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-01-SUMMARY.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-02-PLAN.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-02-SUMMARY.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-03-PLAN.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-03-SUMMARY.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-04-PLAN.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-04-SUMMARY.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-05-PLAN.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-05-SUMMARY.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-06-PLAN.md
  - .planning/phases/PORTIA-05-oformlenie-teksta/05-06-SUMMARY.md
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/editor-field-look.test.ts
  - lib/panel-position.test.ts
  - lib/panel-position.ts
  - lib/rich-text-style.test.ts
  - lib/rich-text-style.ts
covered_digest: "v3:sha256:8d0b6d21d872fd94b2a49bf1b2b5aa5ee0c255e3d7dff053faf25236712ef38d"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 13/15
  gaps_closed:
    - "Truth 7 / CR-01: phone selection follows own input in real event order (fieldSelectionStep, 9 event-order tests, owner device check steps 1-5 approved)"
    - "Truth 15 / ROADMAP SC1: phone leg now exercised on the owner's phone (steps 1-5) and PC > 900 px (step 6), owner answer: approved"
    - "WR-02 readout, WR-03 null-when-unknown, WR-04 mousedown + all-width highlight"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-01 (new, 05-REVIEW.md): ГОТОВО with a null selection calls field.focus() with phonePanelOpen already false, so the browser's default caret (offset 0) is read as own input and stored; the next ✎ then targets the first word"
    category: other
    reason: "Phone-only, needs a null selection when ГОТОВО is pressed (rare: first focus/own touch reported no range). The caret is real and visible after focus, the panel names the target word in its header («СЛОВО: «…»»), and nothing is styled until the user presses a control. Does not break SC1 or any must-have truth; weakens the spirit of D-04/WR-03 on one edge path. Fix is two lines (do not focus, or mark that focus read as not own)."
    evidence_status: "static trace of finish() (portia-editor.tsx 1908-1915) and activate(); not reproduced on a device"
human_verification:
  - test: "Phone, editor → «Информация» → text. Touch inside a field so the keyboard opens, do NOT select anything, press ✎ then immediately ГОТОВО (if the panel shows «ВЫДЕЛИТЕ ТЕКСТ»), then ✎ again."
    expected: "Panel does not silently point at the first word of the field from a selection the user never made; if it does show «СЛОВО: …» for word 1, decide whether to accept (visible caret at start) or schedule the WR-01 two-line fix."
    why_human: "WR-01 edge path depends on the browser's default caret after programmatic focus(); cannot be reproduced in node tests."
  - test: "PC, editor → «Вирусы» → любой вирус → «Внешние характеристики». Select a word, ✎, press «Заголовок» twice, then Ctrl+Z; put the caret in a word with no selection and press «Важно»; caret between two spaces; paint a word and press «Обычный»; use bottom «Толщина» on a selection and on a bare caret in a word."
    expected: "Row styles apply, un-apply on the second press and highlight while applied; Ctrl+Z restores; a bare caret styles the word only; between spaces the header says «ВЫДЕЛИТЕ ТЕКСТ» and controls are disabled; weights work on selection and on the word under the caret; no «СБРОСИТЬ», «ГОТОВО» on PC."
    why_human: "Visual state of buttons and the feel of the Word-like toggle (D-01, D-02, D-03, D-04). Owner step 6 covered only select + ✎ + Важно + ЖИРНЫЙ + HEX click."
  - test: "Colour palette: first swatch «Основной», no Графит/Светлый; paint a word blue then press «Основной»."
    expected: "Colour property removed, word returns to the area colour, readout «ОСНОВНОЙ»; previously stored graphite/light text keeps its colour."
    why_human: "Visual (D-08, D-18)."
  - test: "Phone 375x667: panel layout with tabs «Цвет / Размер / Фон», custom colour picker, ГОТОВО then tap the field; keyboard must be absent while the panel is open and return after ГОТОВО; assistant field with its hint reaches the last setting in every tab."
    expected: "Style row always on top, one tab open, controls reachable by scrolling inside the panel (D-12, D-13, D-19). Owner step 5 confirmed ГОТОВО returns the keyboard after a field touch; tab layout and assistant field were not itemised."
    why_human: "Layout and the keyboard-or-panel rule on a real phone."
  - test: "Field look vs site for every area (dossier, metrics, mutation, scientist, info, broadcast, summary/quests, trash text and caption, search recommendations, assistant), focus/blur, ЧЁРНЫЙ/БЕЛЫЙ, switching editor tabs. Owner signs off the four background differences listed in 05-03 (search pills, «важная» teal, single mid tone for gradients, assistant 30 % dim)."
    expected: "Unformatted text matches the site's ink, font, size and background; no colour change on focus; caption in Корзина dark; assistant ignores colour/size/weight like the site."
    why_human: "Eye comparison and owner sign-off (D-06, D-07, D-09, D-17, D-19)."
  - test: "PC: drag the panel by «РЕДАКТОР ОФОРМЛЕНИЯ» into all corners and past the edges; × closes without dragging; reopen, reload, shrink window, set portia-format-panel-v1 to «abc»."
    expected: "Stays inside the editor window below the title bar and above the save bar; place remembered and pressed to the edge; junk value falls back with no console error (D-10, D-11)."
    why_human: "Drag feel and real localStorage."
  - test: "Windows open/close from icon, Start, search; minimise and restore from the taskbar; «Информация» subsection entries (one line, ellipsis, hover title), editor «Информация» nested cards, Настройки → «Содержимое сайта» on phone and narrow PC."
    expected: "Gentle in-place fade, no stretch or slide; minimise/restore unchanged; compact entries; no empty band in Settings (D-14, D-15, D-16, D-20)."
    why_human: "Animation smoothness and density judgement."
---

# Phase PORTIA-05: Оформление текста - Verification Report

**Phase Goal:** Форматирование текста проще и предсказуемее
**Verified:** 2026-10-19
**Status:** human_needed
**Re-verification:** Yes - after gap closure plan 05-06

Owner amendment to D-01 honoured: the style row is «Обычный / Заголовок / Важно» (no «Жирный»); weight changes only through the bottom «Толщина» buttons.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Style row «Обычный / Заголовок / Важно», no «Жирный»; Заголовок = 22 + 800, Важно = #b43632 + 600, Обычный clears (D-01) | ✓ VERIFIED | `stylePresets` in lib/rich-text-style.ts; row in FloatingTextFormatPanel; tests pass (regression check) |
| 2  | Repeat press removes only that style's keys; button marked only when every character carries it (D-02) | ✓ VERIFIED | `togglePreset`, `rangeHasStyle`, `rangeIsPlain`; unit tests green |
| 3  | Caret without selection styles the word under it; between words nothing; never the whole field; «ВЫДЕЛИТЕ ТЕКСТ» label (D-04) | ✓ VERIFIED (caveat: advisory WR-01) | `resolveRange(text, null)` is null (WR-03 fixed); 8 controls `disabled={!range}`; unknown selection is null. Leak only via ГОТОВО edge path, see advisory |
| 4  | All manual controls remain and go through the one resolved range, incl. weights 400/600/800 on selection and word under caret (D-03) | ✓ VERIFIED | portia-editor.tsx 2008-2009 via `applyStyle` on `range`; unit test for 400/600/800 |
| 5  | «Основной» first swatch removes the colour property; Графит/Светлый gone; stored colours untouched (D-08, D-18) | ✓ VERIFIED | `removeRichTextStyleKeys(... ["color"])`; no content migration in diff |
| 6  | Every change goes through target.onCommit so Ctrl+Z undoes it | ✓ VERIFIED | `commit()` calls `target.onCommit` |
| 7  | Phone: after a style tap the same text stays selected/highlighted; a real touch always replaces the stored selection; a lost selection never replaces it (D-05) | ✓ VERIFIED | `fieldSelectionStep` (rich-text-style.ts 135-151) replaces the one-shot flag: own input from down/keydown (`ownUntil = Infinity`) to 400 ms after up, cancel closes, blur resets, `read` never ends it. 9 `event order:` tests (tap, tap elsewhere, scroll, blur re-entry, caret kept) pass in the single `npm test` run (202/202). Wiring checked: onPointerDown/Up/Cancel, onBlur, onKeyDown/Up -> `track`, `activate` sends only `read`. Behavior-dependent: pure policy exercised by tests; component wiring covered by owner's phone check steps 1-5 («approved») |
| 8  | Phone panel: style row on top, tabs Цвет/Размер/Фон, one open; PC shows all groups (D-12) | ✓ VERIFIED (layout is human) | `data-tab-group` + `.format-tabs` CSS at max-width 900px |
| 9  | Phone rule «keyboard or panel» unchanged (D-13) | ✓ VERIFIED | `inputMode={activeFormat.phonePanelOpen ? "none" : undefined}` (1796); plan prohibition held |
| 10 | Editor field mirrors the site place: ink, bg, surface per area, no colour change on focus (D-06, D-07, D-09, D-17) | ✓ VERIFIED (look is human) | `--field-ink/--field-bg` rules, `nativeSurface`, editor-field-look.test.ts passes |
| 11 | Assistant field mirrors the site, hint shown, buttons kept (D-19) | ✓ VERIFIED (WR-01 old: deferred by owner choice) | `format-area-note`; controls enabled by design (05-06 prohibition keeps D-19 unchanged) |
| 12 | PC panel drags by header, clamped, remembered under portia-format-panel-v1, junk-safe (D-10, D-11) | ✓ VERIFIED (feel is human) | lib/panel-position.ts + tests green |
| 13 | Window open/close gentle fade+settle in place; minimise/restore unchanged (D-14) | ✓ VERIFIED (feel is human) | portia.css animation rules, `transformOrigin` reset in portia-desktop.tsx |
| 14 | Subsection entries, editor nested cards compact; Settings «Содержимое сайта» no empty band (D-15, D-16, D-20) | ✓ VERIFIED (density is human) | portia.css rules present |
| 15 | ROADMAP SC1: основные стили применяются в один клик и одинаково на ПК и телефоне | ✓ VERIFIED | PC leg unit-tested; phone leg: CR-01 fixed in code, panel taps `preventDefault` on pointerdown AND mousedown (`keepFieldFocus`, lines 1989-1990, inputs excepted), highlight painted at every width (portia.css 516 global rule, deps `paintFrom/paintTo`). Owner device check (05-06 Task 3) steps 1-6 approved on the phone that showed the bug and on PC > 900 px. Owner-attested; I did not re-run it |

**Score:** 15/15 truths verified (0 present-but-behavior-unverified). Truth 7/15 rely on the owner's attestation for device behavior.

### Deferred Items

None. Phase 5 is the last roadmap phase.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | WR-01 (05-REVIEW): ГОТОВО with null selection -> `focus()` default caret {0,0} stored as own input -> next ✎ targets first word | other | Edge path, visible caret and labelled target, no silent restyle; no deterministic failing test; does not negate any truth |

Judgement on the question asked: WR-01 does **not** break a must-have or SC1. SC1 (one-click styles, same on PC and phone) is unaffected: the path needs a null selection at the moment ГОТОВО is pressed, which the owner's step 5 (field touch, ГОТОВО, keyboard returns) did not hit. The 05-06 prohibition («never applied to the whole field or the first word *only because the selection was lost or unknown*») is touched on that edge, but the caret that ends up stored is the real one the browser shows after focus, the header names the target («СЛОВО: «…»»), and nothing is styled without a user press. I classify it WARNING (advisory), recommended as a small follow-up (do not focus when `target.selection` is null, or pass that single focus read as not own). It is not a blocker and not a reason to hold the phase. The disposition file still lists WR-01 and IN-01..IN-04 as `open`.

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| lib/rich-text-style.ts (+ test) | ✓ VERIFIED | `fieldSelectionStep`, `nextFieldSelection`, nullable `resolveRange` exported; 202 tests green |
| lib/panel-position.ts (+ test) | ✓ VERIFIED | wired in editor |
| lib/editor-field-look.test.ts | ✓ VERIFIED (brittle, regex over CSS) | passes |
| components/portia-editor.tsx | ✓ VERIFIED | `selectionRef` holds `FieldSelectionState`, `track` wired to six handlers, `keepFieldFocus` on panel |
| app/portia.css, components/portia-desktop.tsx | ✓ VERIFIED | planned rules present |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| field events -> fieldSelectionStep via track | ✓ WIRED | lines 1802-1822, 1757 |
| activate -> read (guarded = phonePanelOpen) -> onActivate(selection: stored) | ✓ WIRED | line 1758-1760 |
| preset row / controls -> resolveRange -> commit -> onCommit | ✓ WIRED | |
| panel section -> keepFieldFocus (pointerdown + mousedown) | ✓ WIRED | line 1990 |
| range -> CSS.highlights "portia-format" | ✓ WIRED | lines 1875-1904, any width |
| drag end -> localStorage; mount -> parse+clamp | ✓ WIRED | |
| ГОТОВО -> finish -> focus + restoreSelection | ⚠️ WIRED, edge (WR-01 advisory) | null selection path |

### Data-Flow Trace (Level 4)

Panel readout derives from `target.document` committed state; target.selection comes from the field's own `selectionRef.stored`; field re-renders from the same document. Flowing. No hardcoded-empty props at call sites.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole test suite (run once) | `npm test` | 202 pass, 0 fail | ✓ PASS |
| Types | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Phone event order on a device | - | not run by me; owner attested «approved», steps 1-6 | ? owner-attested |

### Probe Execution

No probes declared. N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| TEXT-01 | 05-01..05-06 (all six declare it) | Упрощённое оформление текста в редакторе | ✓ SATISFIED (human visual checks pending) | PC flow, style row, word target, selection-follows-input on phone, WYSIWYG, drag, polish. REQUIREMENTS.md already marks it Complete (line 43, traceability line 76); consistent once the human items below pass. No orphaned IDs: TEXT-01 is the only ID mapped to Phase 5 and every plan claims it |

### Prohibitions

| Prohibition | Tier | Result |
| ----------- | ---- | ------ |
| No migration/recolour of saved content (D-08) | judgment | Held: no content rewrite in the diff (non-authoritative judge verdict) |
| No D-03 manual setting removed; no keyboard shortcut added | judgment | Held: all controls present (non-authoritative) |
| No automated step saves to production DB | judgment | Held by inspection; owner never pressed СОХРАНИТЬ per SUMMARY (flag: unverified-prohibition, human review recommended) |
| Site rendering unchanged | judgment | Held (non-authoritative) |
| A style is never applied to the whole field or to the first word only because the selection was lost or unknown (D-04, D-05) | judgment | Held on all normal paths (null selection disables controls; owner step 3/5). Edge leak via ГОТОВО = advisory WR-01 (flag: unverified-prohibition on that one path, human review recommended) |
| D-13 lines and D-19 hint unchanged | judgment | Held: `inputMode` line and `format-area-note` present (non-authoritative) |

### Anti-Patterns Found

No TBD/FIXME/XXX/TODO added by the 05-06 diff (`git diff 435f010..HEAD`). Review of 05-06 (05-REVIEW.md): 0 critical, 1 warning (WR-01 above), 4 info (IN-01 handler wiring untested; IN-02 own-input window edge cases; IN-03 stale CSS comment and duplicate import; IN-04 disposition wording for WR-02). CR-01, WR-02 (readout), WR-03, WR-04 resolved; WR-05 deferred (cleanup). The "M" = 17 px jump on 13-14 px areas remains a Phase 1 preset-size concern, not a must-have.

### Human Verification Required

See `human_verification` in the frontmatter (7 items). The owner's phone bug check (previous item 1) is closed by the 05-06 Task 3 answer. The remaining six come from the earlier plans, were deferred to end-of-phase because the editor needs login, and have not been executed. Item 1 here is the WR-01 edge check. Only the owner's step 6 touched the PC panel, and only for select + ✎ + Важно + ЖИРНЫЙ + HEX.

### Gaps Summary

No gaps. The one previous blocker (CR-01) is closed in code, unit tests and an owner device check; the roadmap success criterion is met. Status is `human_needed` solely because visual/feel checks (field look sign-off, drag, window animation, phone tab layout, PC toggle feel) and the WR-01 edge check have never been run. Neither the new review warning nor the open info items block the phase.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
