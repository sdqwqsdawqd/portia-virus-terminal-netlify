---
status: complete
phase: PORTIA-05-oformlenie-teksta
source: [05-VERIFICATION.md]
started: 2026-10-19T08:17:54Z
updated: 2026-10-19T08:32:08.650Z
---

## Current Test

[testing complete]

## Tests

### 1. Phone, editor → «Информация» → text. Touch inside a field so the keyboard opens, do NOT select anything, press ✎ then immediately ГОТОВО (if the panel shows «ВЫДЕЛИТЕ ТЕКСТ»), then ✎ again.
expected: Panel does not silently point at the first word of the field from a selection the user never made; if it does show «СЛОВО: …» for word 1, decide whether to accept (visible caret at start) or schedule the WR-01 two-line fix.
result: pass

### 2. PC, editor → «Вирусы» → любой вирус → «Внешние характеристики». Select a word, ✎, press «Заголовок» twice, then Ctrl+Z; put the caret in a word with no selection and press «Важно»; caret between two spaces; paint a word and press «Обычный»; use bottom «Толщина» on a selection and on a bare caret in a word.
expected: Row styles apply, un-apply on the second press and highlight while applied; Ctrl+Z restores; a bare caret styles the word only; between spaces the header says «ВЫДЕЛИТЕ ТЕКСТ» and controls are disabled; weights work on selection and on the word under the caret; no «СБРОСИТЬ», «ГОТОВО» on PC.
result: issue
reported: "the background of text is green but i didnt activate it (screenshot: whole field text shows teal background while panel says БЕЗ ФОНА)"
severity: minor

### 3. Colour palette: first swatch «Основной», no Графит/Светлый; paint a word blue then press «Основной».
expected: Colour property removed, word returns to the area colour, readout «ОСНОВНОЙ»; previously stored graphite/light text keeps its colour.
result: pass

### 4. Phone 375x667: panel layout with tabs «Цвет / Размер / Фон», custom colour picker, ГОТОВО then tap the field; keyboard must be absent while the panel is open and return after ГОТОВО; assistant field with its hint reaches the last setting in every tab.
expected: Style row always on top, one tab open, controls reachable by scrolling inside the panel (D-12, D-13, D-19). Owner step 5 confirmed ГОТОВО returns the keyboard after a field touch; tab layout and assistant field were not itemised.
result: pass

### 5. Field look vs site for every area (dossier, metrics, mutation, scientist, info, broadcast, summary/quests, trash text and caption, search recommendations, assistant), focus/blur, ЧЁРНЫЙ/БЕЛЫЙ, switching editor tabs. Owner signs off the four background differences listed in 05-03 (search pills, «важная» teal, single mid tone for gradients, assistant 30 % dim).
expected: Unformatted text matches the site's ink, font, size and background; no colour change on focus; caption in Корзина dark; assistant ignores colour/size/weight like the site.
result: pass

### 6. PC: drag the panel by «РЕДАКТОР ОФОРМЛЕНИЯ» into all corners and past the edges; × closes without dragging; reopen, reload, shrink window, set portia-format-panel-v1 to «abc».
expected: Stays inside the editor window below the title bar and above the save bar; place remembered and pressed to the edge; junk value falls back with no console error (D-10, D-11).
result: pass

### 7. Windows open/close from icon, Start, search; minimise and restore from the taskbar; «Информация» subsection entries (one line, ellipsis, hover title), editor «Информация» nested cards, Настройки → «Содержимое сайта» on phone and narrow PC.
expected: Gentle in-place fade, no stretch or slide; minimise/restore unchanged; compact entries; no empty band in Settings (D-14, D-15, D-16, D-20).
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-05-2
  truth: "Row styles apply, un-apply on the second press and highlight while applied; Ctrl+Z restores; a bare caret styles the word only; between spaces the header says «ВЫДЕЛИТЕ ТЕКСТ» and controls are disabled; weights work on selection and on the word under the caret; no «СБРОСИТЬ», «ГОТОВО» on PC."
  status: failed
  reason: "User reported: the background of text is green but i didnt activate it (screenshot: whole field text shows teal background while panel says БЕЗ ФОНА)"
  severity: minor
  test: 2
  artifacts: []
  missing: []
