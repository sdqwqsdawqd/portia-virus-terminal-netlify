---
phase: PORTIA-26
review: 26-REVIEW.md
critical: 0
warning: 6
info: 3
open: 9
---

# Phase 26: судьба замечаний ревью кода

Ревью справочное, фазу не блокирует. Каждое замечание пока `open`, решение по нему не принято.

| ID | Важность | Файл | Суть | Судьба |
|----|----------|------|------|--------|
| WR-01 | warning | components/portia-editor.tsx:1215 | Без `editor-save-chip` на вкладках users/promo/access не видно несохранённых правок общего черновика, сохранить нельзя | open |
| WR-02 | warning | components/portia-desktop-shortcuts.tsx, app/portia.css | Дробная ширина 520–521px (масштаб 125%): CSS телефона и JS перетаскивания расходятся | open |
| WR-03 | warning | components/portia-users-tab.tsx:569 | `load()` не отличает вытесненный запрос от ошибки: после решения деталь пустеет, фокус теряется | open |
| WR-04 | warning | components/portia-promotion-editor-main.tsx:123, app/portia.css | Все сообщения «Повышения» с `tone="error"`; `.editor-save-status.error` ломает `nowrap` панели на телефоне | open |
| WR-05 | warning | components/portia-editor.tsx:1705, components/portia-editor-tab-shell.tsx:458 | Две живые области озвучивают один статус сохранения | open |
| WR-06 | warning | components/portia-users-tab.tsx:719, app/portia.css | Липкая плашка устаревших данных уходит под `.etab-bar` (вывод по CSS) | open |
| IN-01 | info | components/portia-users-tab.tsx | Двойной `.etab-detail` у пустой детали | open |
| IN-02 | info | components/portia-editor-tab-shell.tsx | Одинаковые `aria-label` у section и nav | open |
| IN-03 | info | lib/shortcut-layout.ts | Расстановка не учитывает помощника и кнопку формата; касание смешивает прокрутку и перетаскивание | open |
