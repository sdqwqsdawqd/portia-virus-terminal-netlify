---
status: complete
phase: PORTIA-01-ispravlenie-bagov
source: [01-VERIFICATION.md]
started: 2026-10-13T00:00:00Z
updated: 2026-10-13T07:08:20.931Z
---

## Current Test

[testing complete]

## Tests

### 1. «Устав» и «Таблица» на всё окно при любом масштабе, Ctrl+колесо
test: Открыть «Устав» и «Таблицу»; 50/100/200 % кнопками − / + и Ctrl+колесом; в окне, развёрнутым, на ширине 375px. Отдельно: сначала кликнуть внутрь документа, потом Ctrl+колесо.
expected: Документ закрывает всю область под заголовком окна на каждом шаге; полоса масштаба — «таблетка» справа внизу; Ctrl+колесо масштабирует документ, а не вкладку, даже при фокусе внутри документа.
result: pass

### 2. Ручка перетаскивания в редакторе
test: Войти через /owner-login; список вирусов, разделы «Информации», «Корзина», «Рекомендации» на ПК и на 375px; удерживать ≡ около 0,2 с и перетащить.
expected: В начале строки только ≡, целиком внутри строки, без подписи и подсказки; порядок меняется.
result: pass

### 3. Файл из «Корзины» на всё окно
test: В «Корзине» открыть текстовый файл, картинку и вирус из корзины; в окне, развёрнутым, на 375px; нажать ×.
expected: Шапка Корзины скрыта, просмотр доходит до заголовка окна и краёв; у вируса своя шапка записи остаётся; × возвращает список.
result: pass

### 4. Профиль Roblox по клику на портрет
test: «Сотрудники»: сотрудник с Roblox id и без; навести, Tab, кликнуть маленький портрет.
expected: Текста «Профиль Roblox» нет; при наведении рамка и курсор-рука; клик открывает roblox.com/users/{id}/profile в новой вкладке; без id ссылки нет.
result: pass

### 5. Шрифт IBM Plex Serif в документах
test: DevTools → Computed / Rendered Fonts на поле редактора, записи учёного, абзаце архива; сравнить «ЖИРНЫЙ» и «СРЕДНИЙ».
expected: IBM Plex Serif с кириллицей, шрифт не меняется при фокусе, разница в насыщенности видна.
result: issue
reported: "Да шрифт до сих пор остался таким как есть"
severity: major

### 6. Dark Reader не перекрашивает сайт
test: Включить расширение Dark Reader и открыть сайт.
expected: Расширение показывает, что у сайта своя тёмная тема (заблокировано), и не перекрашивает страницу.
result: pass
note: "Пользователь при закрытии фазы: Все исправлено"

### 7. Незавершённая работа закоммичена отдельным коммитом
expected: Незавершённая работа закоммичена отдельным коммитом до исправлений, ровно три файла
result: pass
source: automated
coverage_id: D1

### 8. Шрифт поля = шрифт области сайта (повтор теста 5)
expected: Каждое текстовое поле редактора выглядит тем же шрифтом, размером и интервалом, что и этот текст на сайте (10 областей; запись учёного с засечками, остальные без); БЕЛЫЙ/ЧЁРНЫЙ меняет только цвет и фон.
result: pass

### 9. Мелкие поля поиска и Вивьян устраивают
expected: Поле «Рекомендации» (11px) и поля реплик Вивьян (10px жирный, Segoe UI) выглядят как на сайте, и редактировать их вам удобно.
result: pass

### 10. Текст рассылок в «Сводке»
expected: Текст рассылки на сайте теперь обычный серый 15px, а не мелкий жирный бирюзовый; подпись типа сверху осталась прежней.
result: pass

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-PORTIA-01-5
  truth: "Каждое текстовое поле редактора показывает текст тем же шрифтом, каким этот текст выводится в соответствующей области сайта (WYSIWYG)"
  clarification: "Пользователь уточнил ожидание: шрифт поля = «такой как в области сайта которую я редактирую». Live-проверка на localhost:3123: IBM Plex Serif загружен (400/600/700) и применён к .archive-document-section p, .scientist-rich-text, .formatted-rich-input; Georgia нет. Т.е. фикс FIX-03 технически применён, но не совпадает с ожиданием WYSIWYG."
  status: resolved
  resolved_by: 01-04-PLAN.md
  resolved_at: 2026-10-13
  reason: "User reported: Да шрифт до сих пор остался таким как есть"
  severity: major
  test: 5
  root_cause: "Single hard-coded font on every editor field: .formatted-rich-input uses font: 17px/1.65 var(--serif) (app/portia.css:467) for all 15 field types, while on the public site only the scientist log (.scientist-rich-text, portia.css:521) is serif; the other 14 display areas inherit Golos/--sans (body, portia.css:55) or set sans explicitly. FIX-03 swapped Georgia for IBM Plex Serif (serif for serif, commit 2be1417), so the user sees no change. Additionally the preview-light/dark toggle picks the font family by background (portia.css:470-471: light=serif, dark=--sans) instead of by area."
  artifacts:
    - path: "app/portia.css"
      issue: "line 467: one var(--serif) for all .formatted-rich-input; lines 470-471: font family tied to preview surface colour"
    - path: "components/portia-editor.tsx"
      issue: "FormattedTextarea (1027-1080) has no area/surface variant; only class formatted-rich-input + preview-*; default size 17px (1130)"
    - path: "app/portia.css"
      issue: "line 375: .broadcast-card > span (0,1,1; 700 11px teal) overrides .broadcast-card-copy (380) so broadcast bodies render 11px bold teal — must be resolved before mirroring broadcasts"
  missing:
    - "Per-area font on each editor field (data-surface or prop, derivable from formatKey prefix: virus/scientist/info/broadcast/recycle/search/assistant) that mirrors the display selector of that area (.lead-copy, .metric-grid .formatted-content, .mutation-copy, .scientist-rich-text, .info-document-copy, .broadcast-card-copy, .trash-formatted-text / .trash-image-document figcaption, .search-recommendations button, .assistant-formatted-text)"
    - "Share the area font through one token/selector list so the field follows the display area after phase 2 font changes (D-05..D-07), not a copied value"
    - "Preview БЕЛЫЙ/ЧЁРНЫЙ toggle changes only colour/background, not font-family (drop font-family: var(--sans) at portia.css:471)"
    - "Fix .broadcast-card > span overriding .broadcast-card-copy (portia.css:375)"
  debug_session: .planning/debug/editor-field-font-wysiwyg.md
