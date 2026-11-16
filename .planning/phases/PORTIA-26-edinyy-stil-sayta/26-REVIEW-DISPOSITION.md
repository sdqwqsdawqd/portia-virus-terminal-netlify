---
phase: PORTIA-26
review: 26-REVIEW.md
critical: 0
warning: 6
info: 3
open: 3
fixed: 6
---

# Phase 26: судьба замечаний ревью кода

Ревью справочное, фазу не блокирует. WR-01…WR-06 исправлены (коммиты 16d2a05, edea8f9, 084a37a, b537777, cd4a0f4, d3848e7; см. 26-REVIEW-FIX.md). IN-01…IN-03 остаются `open`.

| ID | Важность | Файл | Суть | Судьба |
|----|----------|------|------|--------|
| WR-01 | warning | components/portia-editor.tsx:1215 | Без `editor-save-chip` на вкладках users/promo/access не видно несохранённых правок общего черновика, сохранить нельзя | fixed |
| WR-02 | warning | components/portia-desktop-shortcuts.tsx, app/portia.css | Дробная ширина 520–521px (масштаб 125%): CSS телефона и JS перетаскивания расходятся | fixed |
| WR-03 | warning | components/portia-users-tab.tsx:569 | `load()` не отличает вытесненный запрос от ошибки: после решения деталь пустеет, фокус теряется | fixed |
| WR-04 | warning | components/portia-promotion-editor-main.tsx:123, app/portia.css | Все сообщения «Повышения» с `tone="error"`; `.editor-save-status.error` ломает `nowrap` панели на телефоне | fixed |
| WR-05 | warning | components/portia-editor.tsx:1705, components/portia-editor-tab-shell.tsx:458 | Две живые области озвучивают один статус сохранения | fixed |
| WR-06 | warning | components/portia-users-tab.tsx:719, app/portia.css | Липкая плашка устаревших данных уходит под `.etab-bar` (вывод по CSS) | fixed |
| IN-01 | info | components/portia-users-tab.tsx | Двойной `.etab-detail` у пустой детали | open |
| IN-02 | info | components/portia-editor-tab-shell.tsx | Одинаковые `aria-label` у section и nav | open |
| IN-03 | info | lib/shortcut-layout.ts | Расстановка не учитывает помощника и кнопку формата; касание смешивает прокрутку и перетаскивание | open |
