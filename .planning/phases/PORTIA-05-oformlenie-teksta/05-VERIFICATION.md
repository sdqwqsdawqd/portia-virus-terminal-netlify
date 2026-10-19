---
phase: PORTIA-05-oformlenie-teksta
verified: 2026-10-19T12:00:00Z
status: gaps_found
score: 13/15 must-haves verified
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
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/panel-position.ts
  - lib/rich-text-style.ts
covered_digest: "v3:sha256:7ac713c83271e56414d3eedf398a92936c1a6dce96a926aeb1e66177b21764af"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "On a phone, a real touch in the field always replaces the stored selection, and a lost selection never leaves the panel acting on stale text (D-05, 05-02 truths 1-2); the owner's bottom «Толщина» buttons therefore act on the text the user sees selected"
    status: failed
    reason: "CR-01 (critical, disposition still open): nextFieldSelection is driven by a one-shot touchedRef consumed by whichever of onFocus/onSelect/onMouseUp fires first. The first activate after a tap (onFocus, which can still read the old DOM selection) spends the flag; the later onSelect with the real collapsed caret then arrives with touched=false and the stored non-collapsed range wins, so the panel and highlight keep the previously selected text. The !incoming branch ignores touchedField and resurrects a range from an earlier visit (selectionRef is never cleared on blur). A pointerdown with no following activate (scroll gesture, pointercancel) leaves the flag true, so the original phone drop of the selection is accepted again. This is the mechanism family behind the owner's «толщина не срабатывает» bug."
    artifacts:
      - path: "components/portia-editor.tsx"
        issue: "lines 1746-1759, 1801: touchedRef set on pointerdown, cleared inside activate(); no pointerup/cancel/blur reset; selectionRef never cleared on blur"
      - path: "lib/rich-text-style.ts"
        issue: "lines 129-133: nextFieldSelection returns stored for any !incoming and for collapsed-untouched; tests only exercise a hand-set boolean, not the event order"
    missing:
      - "Replace the consume-on-first-event flag: set on pointerdown, clear on a timeout after pointerup/pointercancel/blur, never inside activate (review CR-01 fix)"
      - "Clear selectionRef on blur so re-entry cannot resurrect an old range"
      - "Treat !incoming with touchedField as 'nothing known' instead of returning the old range"
      - "A test (jsdom or Playwright/CDP touch harness) for tap, tap-elsewhere and scroll sequences"
  - truth: "ROADMAP SC1: основные стили применяются в один клик и одинаково на ПК и телефоне"
    status: partial
    reason: "PC leg is implemented and unit-tested. The phone leg depends on the D-05 selection survival above and on unverified assumptions (WR-04: pointerdown preventDefault may not keep focus/selection; RESEARCH §4 recommended onMouseDown and a forced DOM-selection restore, neither was built). Nothing on a phone was run by any plan."
    artifacts:
      - path: "components/portia-editor.tsx"
        issue: "panel section uses onPointerDown preventDefault only (line ~1985); restoreSelection still returns when the field is not focused (line 444)"
    missing:
      - "Fix CR-01, add onMouseDown preventDefault next to the pointer handler (WR-04), then run the phone human checks below"
human_verification:
  - test: "Phone (real device or the headless-Edge touch harness from .planning/debug/resolved/format-panel-select-closes.md), editor → «Информация» → text. Select a word, tap ✎, then tap «Важно», «Заголовок», and bottom «Толщина» ЖИРНЫЙ / СРЕДНИЙ / ОБЫЧНЫЙ in a row. Then tap a DIFFERENT word (first touch after ✎, then a second tap elsewhere) and tap a weight button. Do not press СОХРАНИТЬ."
    expected: "The highlight stays on the same word after each tap and every style lands only on it; tapping another word moves the highlight and the next style lands on that new word; the whole field is never restyled. This is the owner's reported «Толщина не срабатывает» bug, so it must be confirmed on the phone that showed it."
    why_human: "Touch event order (focus vs selectionchange vs mouseup) cannot be reproduced in node tests; CR-01 predicts a failure in exactly the second half of this scenario."
  - test: "PC, editor → «Вирусы» → любой вирус → «Внешние характеристики». Select a word, ✎, press «Заголовок» twice, then Ctrl+Z; put the caret in a word with no selection and press «Важно»; caret between two spaces; paint a word and press «Обычный»; use bottom «Толщина» on a selection and on a bare caret in a word."
    expected: "Row styles apply, un-apply on the second press and highlight while applied; Ctrl+Z restores; a bare caret styles the word only; between spaces the header says «ВЫДЕЛИТЕ ТЕКСТ» and controls are disabled; weights work on selection and on the word under the caret; no «СБРОСИТЬ», «ГОТОВО» present."
    why_human: "Visual state of buttons and the feel of the Word-like toggle (D-01, D-02, D-03, D-04)."
  - test: "Colour palette: first swatch «Основной», no Графит/Светлый; paint a word blue then press «Основной»."
    expected: "Colour property removed, word returns to the area colour, readout «ОСНОВНОЙ»; previously stored graphite/light text keeps its colour."
    why_human: "Visual (D-08, D-18)."
  - test: "Phone 375x667: panel layout with tabs «Цвет / Размер / Фон», custom colour picker, ГОТОВО then tap the field; keyboard must be absent while the panel is open and return after ГОТОВО; assistant field with its hint reaches the last setting in every tab."
    expected: "Style row always on top, one tab open, controls reachable by scrolling inside the panel (D-12, D-13, D-19)."
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
**Status:** gaps_found
**Re-verification:** No - initial verification

Owner amendment to D-01 honoured: the style row is «Обычный / Заголовок / Важно» (no «Жирный»); weight changes only through the bottom «Толщина» buttons.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Style row «Обычный / Заголовок / Важно», no «Жирный»; Заголовок = 22 + 800, Важно = #b43632 + 600, Обычный clears (D-01) | ✓ VERIFIED | `stylePresets` in lib/rich-text-style.ts:66-69; row at portia-editor.tsx ~1980; tests pass |
| 2  | Repeat press removes only that style's keys; button marked only when every character carries it (D-02) | ✓ VERIFIED | `togglePreset`, `rangeHasStyle`, `rangeIsPlain`; aria-pressed bound to them; tests "heading ... second press removes only size and weight" |
| 3  | Caret without selection styles the word under it; between words nothing; never the whole field; «ВЫДЕЛИТЕ ТЕКСТ» label (D-04) | ✓ VERIFIED (caveat WR-03) | `resolveRange`/`wordRangeAt`, all controls `disabled={!range}`; WR-03: a null first selection becomes {0,0} and targets word 1 |
| 4  | All manual controls remain and go through the one resolved range, incl. weights ОБЫЧНЫЙ/СРЕДНИЙ/ЖИРНЫЙ 400/600/800 on selection and word under caret (D-03) | ✓ VERIFIED | portia-editor.tsx 2002-2006 `applyStyle` uses `range`; test "weights 400/600/800 apply through the resolved range for a selection and for a caret in a word"; fonts support 400/600/700 (800 maps to 700 in Plex faces, Golos variable) |
| 5  | «Основной» first swatch removes the colour property; Графит/Светлый gone; stored colours untouched (D-08, D-18) | ✓ VERIFIED | `removeRichTextStyleKeys(... ["color"])`; no migration code in diff |
| 6  | Every change goes through target.onCommit so Ctrl+Z undoes it | ✓ VERIFIED | `commit()` calls `target.onCommit` |
| 7  | Phone: after a style tap the same text stays selected/highlighted; a real touch always replaces the stored selection; a lost selection never replaces it (D-05) | ✗ FAILED | CR-01 open, see gaps. Static trace of `activate`/`nextFieldSelection` shows stale-range and stuck-flag paths; no test covers event order |
| 8  | Phone panel: style row on top, tabs Цвет/Размер/Фон, one open; PC shows all groups (D-12) | ✓ VERIFIED (layout is human) | `data-tab-group` + `.format-tabs` CSS at max-width 900px (portia.css 656, 1159-1163) |
| 9  | Phone rule «keyboard or panel» unchanged (D-13) | ✓ VERIFIED | `inputMode={phonePanelOpen ? "none" : undefined}` (1796); blur-once launcher untouched |
| 10 | Editor field mirrors the site place: ink, bg, surface per area, generic #AEBFBA / classification oklch, native surface per tab, no colour change on focus (D-06, D-07, D-09, D-17) | ✓ VERIFIED | `--field-ink/--field-bg` rules portia.css 597-626, `nativeSurface` map, `setPreviewSurface(null)` on tab switch (713); editor-field-look.test.ts passes |
| 11 | Assistant field mirrors the site, hint shown, buttons kept (D-19) | ✓ VERIFIED (caveat WR-01) | CSS 626 override, `format-area-note`; controls stay enabled by design but silently do nothing for colour/size/weight |
| 12 | PC panel drags by header, clamped to the editor window, place remembered under portia-format-panel-v1, pressed to edge, junk-safe (D-10, D-11) | ✓ VERIFIED (feel is human) | lib/panel-position.ts + tests, drag handlers, ResizeObserver restore |
| 13 | Window open/close gentle fade+settle in place; minimise/restore unchanged (D-14) | ✓ VERIFIED (feel is human) | portia.css 1383-1391, `transformOrigin = ""` reset in portia-desktop.tsx:1646 |
| 14 | Subsection entries, editor nested cards compact; Settings «Содержимое сайта» no empty band (D-15, D-16, D-20) | ✓ VERIFIED (density is human) | portia.css 329-348, 1120, 1174-1176 |
| 15 | ROADMAP SC1: основные стили в один клик и одинаково на ПК и телефоне | ✗ FAILED (partial) | PC leg verified; phone leg blocked by truth 7 and unproven WR-04 assumption; nothing run on a device |

**Score:** 13/15 truths verified (0 present-but-behavior-unverified; the phone behaviours are recorded as FAILED/partial because the code defect is observable, not merely unexercised)

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| lib/rich-text-style.ts (+ test) | ✓ VERIFIED | all planned exports present; tests green |
| lib/panel-position.ts (+ test) | ✓ VERIFIED | clamp/parse exported, wired in editor |
| lib/editor-field-look.test.ts | ✓ VERIFIED (brittle, IN-03) | regex over portia.css |
| components/portia-editor.tsx | ⚠️ PARTIAL | everything present and wired; selection-flow glue defective (CR-01) |
| app/portia.css, components/portia-desktop.tsx | ✓ VERIFIED | planned rules present |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| preset row → togglePreset/resetRichTextStyle | ✓ WIRED | commit with resolved range |
| controls → resolveRange | ✓ WIRED | line 1853 |
| activate → nextFieldSelection | ⚠️ WIRED, defective | touched flag semantics wrong (CR-01) |
| panel section → focus/selection kept | ⚠️ UNPROVEN | pointerdown only (WR-04); RESEARCH advised mousedown |
| drag end → localStorage; mount → parse+clamp | ✓ WIRED | |
| nativeSurface → field class | ✓ WIRED | line 1794 |

### Data-Flow Trace (Level 4)

Panel readout derives from `target.document` committed state; field re-renders from the same document. Flowing.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole test suite (run once) | `npm test` | 192 pass, 0 fail | ✓ PASS |
| Types | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Phone event order / selection survival | - | cannot run without login and device | ? SKIP (human) |

### Probe Execution

No probes declared. N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TEXT-01 | 05-01..05-05 (all five declare it) | Упрощённое оформление текста в редакторе | ⚠️ PARTIAL | PC flow, style row, word target, WYSIWYG, drag, polish verified; phone leg open (CR-01). REQUIREMENTS.md already marks it Complete and the traceability row says Complete; that is premature until the gap closes. No orphaned IDs: TEXT-01 is the only ID mapped to Phase 5 and every plan claims it. |

### Prohibitions

| Prohibition | Tier | Result |
| ----------- | ---- | ------ |
| No migration/recolour of saved content (D-08) | judgment | Held: diff has no content rewrite, only panel clicks mutate runs (non-authoritative judge verdict, review recommended) |
| No D-03 manual setting removed; no keyboard shortcut added | judgment | Held: all controls present; no ctrlKey/metaKey handlers added (non-authoritative) |
| No automated step saves to production DB | judgment | Held by inspection: no supabase/lib content writes in the diff; no run evidence beyond SUMMARY claims (flag: unverified-prohibition, human review recommended) |
| Site rendering unchanged (editor moves toward the site) | judgment | Held: only editor-scoped selectors and window animation changed (non-authoritative) |

### Anti-Patterns Found

No TBD/FIXME/XXX/TODO added in this phase's diff. Open code-review items (05-REVIEW-DISPOSITION.md: all 9 `open`, untriaged):

| ID | Severity | Impact on must-haves |
| -- | -------- | -------------------- |
| CR-01 | 🛑 Blocker | Breaks truth 7/15, bears directly on the owner's bottom-weight-button bug |
| WR-04 | ⚠️ Warning | Phone focus/selection preservation after panel tap is an untested assumption; on PC the selection is not painted when focus is lost |
| WR-03 | ⚠️ Warning | Null first selection targets the first word of the field (violates the spirit of D-04) |
| WR-01 | ⚠️ Warning | Assistant: colour/size/weight buttons enabled but inert (D-19 accepts the note + enabled buttons, but this is the "does nothing" pattern the owner complained about) |
| WR-02 | ⚠️ Warning | "M"/"ОБЫЧНЫЙ" appear selected on unstyled text with area-specific rendered size; pressing M jumps 14px fields to 17px; explicit 400 flips «Обычный» off |
| WR-05, IN-01..03 | ℹ️ Info-level | Duplicated breakpoint, right-click drag, first-char readout, code-point edge cases, brittle CSS test |

### Human Verification Required

See `human_verification` in the frontmatter (7 items). Every plan deferred its browser/phone checks because the editor needs login; none has been executed, so none counts as passed. The first item is the one that matters most: the owner's phone bug.

### Gaps Summary

One blocker. Plans 05-01, 05-03, 05-04 and 05-05 achieved their goals as far as code, unit tests (192 green), types and CSS can show. Plan 05-02's central claim, that phone selection survives style taps and that bottom weight buttons now work, rests on the `touchedRef` mechanism, which the code review (CR-01) shows to be wrong in three concrete ways, still open in the disposition file. The owner reported precisely this class of failure on their phone, and no phone check has been run, so the owner bug cannot be called fixed. Recommended: triage and fix CR-01 (plus WR-03 and WR-04 which share the same code path), add an event-order test, then run the phone human check. WR-01/WR-02 are cheap follow-ups; the rest can be deferred.

No later roadmap phase covers this (Phase 5 is the last), so nothing is deferred.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
