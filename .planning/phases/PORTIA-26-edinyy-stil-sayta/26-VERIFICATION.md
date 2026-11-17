---
phase: PORTIA-26-edinyy-stil-sayta
verified: 2026-11-17T04:00:00Z
status: human_needed
score: 14/21 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-01-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-01-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-02-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-02-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-03-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-03-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-04-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-04-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-05-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-05-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-06-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-06-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-07-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-07-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-08-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-08-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-09-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-09-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-10-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-10-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-11-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-11-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-12-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-12-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-13-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-13-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-14-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-14-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-15-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-15-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-16-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-16-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-17-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-17-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-18-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-18-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-19-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-19-SUMMARY.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-20-PLAN.md"
  - ".planning/phases/PORTIA-26-edinyy-stil-sayta/26-20-SUMMARY.md"
  - "app/portia.css"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "components/portia-level-picker.tsx"
  - "lib/classification-fit.test.ts"
  - "lib/editor-tab-layout.test.ts"
  - "lib/format-launch.test.ts"
  - "lib/level-copy.ts"
  - "lib/level-editor.test.ts"
  - "lib/search-index.ts"
  - "lib/start-menu.test.ts"
  - "lib/start-menu.ts"
  - "lib/ui-unify.test.ts"
covered_digest: "v4:sha256:7f2f37ea51ed058128fe945b8539cfe1e6d2897c96c765de04ee40438b1534ae"
behavior_unverified: 7
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 7/10
  gaps_closed:
    - "UAT gap 1: меню PORTIA закрывается вне меню (код, поведение не снималось)"
    - "UAT gap 2: крестик в самом углу окна (код, hit-test не снимался)"
    - "UAT gap 3: развёрнутые окна используют площадь (код, вид не снимался)"
    - "UAT gap 4: Справочник/Информация — активный раздел на всю ширину"
    - "UAT gap 5: вкладки разделов с ручкой перетаскивания (код; ручка в карточке раздела — см. WR-01)"
    - "UAT gap 6: компактный выбор уровня допуска"
    - "UAT gap 7: панель черновика не сжимается в «Повышении» редактора"
    - "UAT gap 8: абзацы входа «Повышения» на всю ширину"
    - "UAT gap 9: диалог подтверждения по центру"
    - "UAT gap 10: «ПЕРЕМЕСТИТЬ В КОРЗИНУ» в верхней строке записи"
    - "UAT gap 11: названия классификаций целыми словами"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "UI-06: развёрнутое окно использует площадь без растянутых кнопок и пустых полос"
    test: "Развернуть каждое из 12 окон на 1366×768, 1920×1080 и 2560×1440"
    expected: "Нет горизонтальной прокрутки и пустых полос; кнопки по ширине надписи; сетки 2–4 колонки"
    why_human: "Правила R1–R5 и правки 26-15/26-17 проверены чтением CSS (lib/ui-unify.test.ts); пиксельный вид не снимался (BLOCKED ENV)"
  - truth: "UI-08: «Информация» на телефоне — РАЗДЕЛЫ ▾, фокус, Escape, поиск"
    test: "На телефоне открыть «Информацию»: список кнопкой и Escape, выбрать статью, выполнить поиск"
    expected: "Фокус возвращается на кнопку, статья не перекрыта, подсветка строк работает"
    why_human: "Поведение во времени; UAT-пункт 4 BLOCKED (DATA): GET /api/content 503"
  - truth: "UI-09: ярлыки 521–900px одним правилом с JS без блокировки прокрутки"
    test: "На планшете/узком окне 521–900px перетащить ярлык мышью, пером, пальцем; прокрутить; повернуть экран"
    expected: "Ярлыки не перекрываются, прокрутка работает, позиция сохраняется"
    why_human: "Касание и прокрутка только на устройстве (BLOCKED DEVICE); UAT-пункт 5 pending"
  - truth: "UAT gap 1: меню PORTIA закрывается кликом вне, потерей фокуса и Escape; с клавиатуры фокус уходит на первую кнопку меню"
    test: "Открыть меню PORTIA: нажать в пустое место рабочего стола, на окно, на ярлык; переключить вкладку браузера; Tab за пределы меню; Escape; открыть с клавиатуры (Enter)"
    expected: "Меню закрывается во всех случаях; Escape возвращает фокус на кнопку PORTIA; повторный клик по кнопке только переключает"
    why_human: "Состояние и порядок событий (pointerdown/focusin/blur в браузере); тестами покрыто чистое правило lib/start-menu.ts и подключение слушателей по исходнику, но e2e/браузер не запускались"
  - truth: "UAT gap 2: крестик занимает сам угол окна, мёртвой зоны нет"
    test: "Навести и нажимать мышью в самый правый верхний пиксель окна (обычного и развёрнутого), на ПК и телефоне"
    expected: "Нажатие в крайний пиксель закрывает окно; рамка окна по-прежнему видна; ресайз по краям N/E работает"
    why_human: "Hit-test слоя `.app-window::after` (pointer-events: none) и обрезка скруглением видны только в браузере"
  - truth: "UAT gap 3: Настройки, Глобальный поиск, Повышение, Справочник, База вирусов используют площадь развёрнутого окна"
    test: "Развернуть эти пять окон на 1366×768 и 1920×1080"
    expected: "Нет пустой трети Настроек, пустого низа поиска, карточки 680px по центру в Повышении, узкой статьи Справочника"
    why_human: "Раскладка видна только на экране; владелец — единственный судья «пустого места» (BLOCKED ENV)"
  - truth: "UAT gap 5: разделы Справочника/Информации переупорядочиваются перетаскиванием вкладок"
    test: "Перетащить вкладку раздела мышью и пальцем по строке вкладок, затем ArrowUp/ArrowDown на ручке, Ctrl+Z"
    expected: "Вкладка меняется местами при пересечении середины соседней; одно перетаскивание = один шаг отмены; при длинной полосе вкладок можно дотащить до края"
    why_human: "Жест указателем; код `moveTo`/`passesTarget` читает горизонтальный порядок (одна строка), но поведение не исполнялось; см. WR-02 (автопрокрутка только вертикальная)"
---

# Phase 26: Единый стиль сайта — отчёт проверки

**Цель фазы:** Весь сайт выглядит как одна PORTIA OS: одно правило углов, одни кнопки и плашки, единый формат вкладок редактора и приложений, правильные окна, новые иконки классов, «Информация» на телефоне, ярлыки 521–900px и исправленная доступность — в направлении C, выбранном владельцем в Phase 22.
**Проверено:** 2026-11-17
**Статус:** human_needed
**Повторная проверка:** Да — после владельческого UAT 2026-11-16 (11 пробелов, закрыты планами 26-15…26-20)

Расхождений между SUMMARY и кодом не найдено, провальных истин нет, блокеров нет. Все 11 пробелов UAT реализованы в коде и подключены, 10 ранее проверенных истин регрессий не дали. Но владелец сам решает визуальный результат (его UAT — авторитет), а браузер, Playwright, axe, данные, staging и физические устройства не запускались и остаются BLOCKED. Они не записаны как пройденные. Поэтому статус `human_needed`.

## Достижение цели

### Наблюдаемые истины — критерии ROADMAP (регресс-проверка)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | UI-02: одно правило углов, токены, тест не даёт добавить произвольный радиус | ✓ VERIFIED | Токены `--radius-window/dialog/card/…` в `app/portia.css:65-72`; новый слой `.app-window::after` берёт `var(--radius-window)`; `lib/style-tokens.test.ts` зелёный |
| 2 | UI-03: кнопки, плашки, поля, вкладки одинаковы | ✓ VERIFIED (код) | Блок `ui-unify` не тронут; 26-19 добавил кнопку выбора уровня в то же семейство (32px ПК / 44px телефон); `lib/ui-unify.test.ts` зелёный |
| 3 | UI-04: единая раскладка вкладок редактора | ✓ VERIFIED | `EditorActionBar` по-прежнему в `portia-editor.tsx` (3), `portia-users-tab.tsx` (2), `portia-promotion-editor-main.tsx` (2) |
| 4 | UI-05: крестик закрытия в самом углу | ✓ VERIFIED (код); hit-test — человек | `.window-controls` 46×46 вплотную; новая рамка-слой убрала 1px, лежавший между кнопкой и краем (gap 2, ниже) |
| 5 | UI-06: развёрнутое окно без растянутых кнопок и пустых полос | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Правила R1–R5 плюс правки 26-15/26-17 в `@media (width > 900px)`; пиксели BLOCKED (ENV) |
| 6 | UI-07: иконки классификации после согласования с владельцем | ✓ VERIFIED | 18 `<symbol>` в `portia-icons.tsx`, решение `26-ICON-DECISION.md` не менялось; названия классов теперь целыми словами (gap 11) |
| 7 | UI-08: «Информация» на телефоне — РАЗДЕЛЫ ▾ | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `.info-sections-bar`, `onInfoSectionsKeyDown`, `aria-expanded`/`aria-controls` на месте (`portia-desktop.tsx:2051-2055`); поведение не исполнялось, UAT-пункт 4 BLOCKED (DATA) |
| 8 | UI-09: ярлыки 521–900px одним правилом с JS | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `useShortcutPlacement` подключён (`portia-desktop.tsx:464`); устройство BLOCKED (DEVICE); UAT-пункт 5 pending |
| 9 | UI-10: находки axe исправлены, контраст на всех акцентах | ✓ VERIFIED (расчёт) | `cardToggleName` подключён (`portia-editor.tsx:247`); `lib/ui-contrast.test.ts` зелёный; axe в браузере не запускался |
| 10 | UI-11: регрессии 2026-10-28 | ✓ VERIFIED (код) | `lib/window-geometry.ts` с `312033d` не менялся (git diff пуст); `lib/phase26-regressions.test.ts` зелёный; устройство DPR 1.25 BLOCKED (DEVICE) |

### Наблюдаемые истины — 11 пробелов UAT 2026-11-16 (планы 26-15…26-20)

| # | Пробел | Статус | Доказательство в коде |
|---|--------|--------|-----------------------|
| 11 | Gap 1 (26-15): меню PORTIA закрывается кликом вне, потерей фокуса, Escape | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `lib/start-menu.ts` — чистое правило `startMenuCloseReason` (pointerdown/focusin вне → `outside`, blur → `outside`, Escape → `escape`). Эффект `portia-desktop.tsx:1221-1246` вешает `pointerdown`(capture)/`focusin`/`keydown`(capture)/`blur` только при `startOpen`, кнопка PORTIA считается «внутри» (только переключает), Escape возвращает фокус на кнопку. Клавиатурное открытие (`event.detail === 0`) переносит фокус на первую кнопку меню (`:2209-2213`). Тест `lib/start-menu.test.ts` — матрица событий. DOM-поведение не исполнялось |
| 12 | Gap 2 (26-16): крестик в самом углу, мёртвой зоны нет | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `app/portia.css:2648-2650`: `.app-window { border: 0 }` и рамка слоем `.app-window::after` (`inset: 0; z-index: 11; pointer-events: none; border-radius: var(--radius-window)`), цвета и активная рамка прежние. Кнопка закрытия идёт до внешнего края (`overflow: hidden` окна режет скруглением). Углы NE под контролами неактивны (`z-index: 10`). Hit-test — браузер |
| 13 | Gap 3 (26-15, 26-17): развёрнутые окна используют площадь | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Поиск: `availableRecordsLimit(maximized)` → `Infinity` (`lib/search-index.ts:116`), подключён `portia-desktop.tsx:1737`; сетка R1 `.global-search-results`. Настройки: сетка до 3 колонок, шапка/подвал на все колонки (`portia.css` ~2697-2700). Повышение: `72px 1fr 1fr` (`:2679-2685`), `.promotion-flow-list` 2 колонки. Справочник: `.guide-page { max-width: none }`. База вирусов: `.archive-grid .record-document { width: auto }`, `.archive-document-paper`. Всё под `.app-window.is-maximized` в `@media (width > 900px)`; обычное окно и телефон не тронуты. Вид — человек |
| 14 | Gap 4 (26-18): активный раздел Справочника/Информации на всю ширину; форма добавления раздела — целая строка | ✓ VERIFIED | `portia-editor.tsx:1388, 1446` — `<div className="editor-section-single">` с одной активной карточкой; CSS `.editor-section-single { grid-column: 1 / -1; grid-template-columns: minmax(0,1fr) }`; форма добавления — `.etab-nav:has(...) { flex-wrap: wrap }` + `.editor-section-create .editor-field { max-width: var(--field-max) }`. `--editor-card-width` и D-19 для Сводки/Рекомендаций не тронуты |
| 15 | Gap 5 (26-18): разделы переупорядочиваются перетаскиванием вкладок | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `SectionTabs` (`portia-editor.tsx:272-290`): каждая вкладка `span.editor-section-tab[data-sort-index]` с `OrderDragHandle`; стрелки ←/→ убраны; `moveTo` ищет цель среди детей `nav`, `passesTarget` (`lib/sort-order.ts`) учитывает одну строку (по X). Жест не исполнялся. Ручка внутри карточки раздела при этом не работает — WR-01 |
| 16 | Gap 6 (26-19): уровень допуска — маленькая кнопка «кто видит» | ✓ VERIFIED | `components/portia-level-picker.tsx`: `<fieldset>` с `legend` первым ребёнком, кнопка `access-level-toggle` (`aria-expanded`, `aria-controls`), `levelCopy.pickerSummary` («Видят все» / «Видят с допуска N» / «Видят только допуск 5»), пластины в `hidden`-блоке, нативные радио `ACCESS_LEVELS` с общим `name`, `aria-label` «Допуск N», `disabled` ниже `min` + подсказка «Не ниже раздела: N», `notice` — единственный `role="status"`; выбор указателем (`event.detail > 0`) и уход фокуса закрывают пластины. Решения Phase 24 сохранены. Замечание WR-03 (blur в Safari/Firefox macOS) |
| 17 | Gap 7 (26-19): строка черновика не перекрывает фильтры «Повышения» в редакторе | ✓ VERIFIED | `portia.css:2706-2713`: `.etab-bar { flex-shrink: 0 }`, `.promotion-editor > (.etab-bar, .etab-message, .promotion-editor-conflict, .promotion-requests-toolbar, .promotion-cleanup-disclosure) { flex: none }`, `.promotion-editor { overflow-y: auto }`; контейнер `.promotion-editor` — колоночный flex (`:2258`), причина сжатия устранена |
| 18 | Gap 8 (26-17): «Заявка ожидает решения…» — обычный абзац на всю ширину | ✓ VERIFIED | `portia.css:2114` `.promotion-gate > p { grid-column: 1 / -1 }`; `portia-promotion.tsx:248` и `:483` — абзацы прямые дети `.promotion-gate`; в развёрнутом окне — колонки 3 или `2 / -1` (`:2683-2684`). Замечание IN-03 (пустая колонка 72px у абзаца загрузки) |
| 19 | Gap 9 (26-16): диалог подтверждения по центру | ✓ VERIFIED (код) | `portia.css:2653` `.portia-dialog { margin: auto }` (preflight Tailwind обнулял margin у `<dialog>`); ширина, радиус, цвета не менялись |
| 20 | Gap 10 (26-18): «ПЕРЕМЕСТИТЬ В КОРЗИНУ» на понятном месте | ✓ VERIFIED | `portia-editor.tsx:1316-1318` — кнопка в `.virus-editor-head` справа от `DossierTabs`, диалог `setDialog("recycle")` прежний; CSS `.virus-editor-head { display: flex; justify-content: space-between; flex-wrap: wrap }` |
| 21 | Gap 11 (26-20): названия классификаций целыми словами | ✓ VERIFIED | `portia.css:1164-1184`: `.class-cell { container-type: inline-size }`, `.class-cell strong { flex-wrap: wrap; overflow-wrap: normal; word-break: normal; hyphens: manual; font-size: clamp(12px, …, 15px) }` (13px потолок на телефоне), контейнерные пороги `.classification-panel`: 3→2 колонки (≤380px) → 1 (≤254px). `lib/classification-fit.test.ts` считает: самое длинное слово из `classificationOptions` помещается в ячейку при каждой раскладке (расчёт по модели, не пиксели) |

**Оценка:** 14/21 истин проверено; 7 присутствуют и подключены, но поведение или вид не исполнялись (UI-06, UI-08, UI-09, gap 1, gap 2, gap 3, gap 5).

### Отложенные элементы

Нет. Phase 27 (UAT-01) принимает на устройствах то, что BLOCKED, но не закрывает пробелы кода; пробелов кода нет.

### Обязательные артефакты

| Артефакт | Ожидается | Статус | Детали |
|----------|-----------|--------|--------|
| `lib/start-menu.ts` | `startMenuCloseReason` | ✓ VERIFIED | 18 строк, подключён в `portia-desktop.tsx:34, 1224` |
| `lib/search-index.ts` | `availableRecordsLimit` | ✓ VERIFIED | `:116`, подключён `portia-desktop.tsx:35, 1737` |
| `components/portia-level-picker.tsx`, `lib/level-copy.ts` | кнопка-сводка, `pickerSummary` | ✓ VERIFIED | используются во всех формах редактора через `LevelPicker` |
| `app/portia.css` | слой рамки, `margin: auto`, `.editor-section-single`, `flex-shrink`, правила окон, контейнерные пороги | ✓ VERIFIED | селекторы найдены по номерам строк выше |
| `components/portia-editor.tsx` | `SectionTabs` с ручками, `editor-section-single`, `virus-editor-head` | ✓ VERIFIED | `:272, 1316, 1388, 1446` |
| `lib/classification-fit.test.ts` | расчёт посадки слов | ✓ VERIFIED | 189 строк, зелёный |
| `lib/format-launch.test.ts` | правки `portia-editor.tsx` — побайтные вставки (D-21) | ✓ VERIFIED | зелёный; `SAMPLE_COMMIT` не перебазирован |
| `26-VISUAL-REPORT.md`, `26-MAXIMIZED-AUDIT.md` | раздел «Правки по UAT 2026-11-16», строки «UAT 2026-11-16» | ✓ VERIFIED | слова PASS нет; BLOCKED перечислены (стр. 165-172) |

### Проверка ключевых связей

| От | К | Через | Статус |
|----|---|-------|--------|
| `portia-desktop.tsx` | `lib/start-menu.ts` | `startMenuCloseReason(event)` в эффекте `[startOpen]` | WIRED |
| `portia-desktop.tsx` | `lib/search-index.ts` | `matchSearch(..., availableRecordsLimit(windows.search.maximized))` | WIRED |
| `portia-level-picker.tsx` | `lib/level-copy.ts` | `levelCopy.pickerSummary(shown)` | WIRED |
| `SectionTabs` | `OrderDragHandle` | `data-sort-index` у вкладки, общий родитель `nav` | WIRED |
| `.app-window::after` | `.window-controls` | `pointer-events: none` над кнопками (`z-index: 11 > 10`) | WIRED |
| `ConfirmDialog` | `.portia-dialog` | `showModal()` + `margin: auto` | WIRED |
| `portia-editor.tsx` (кнопка корзины) | `ConfirmDialog` | `setDialog("recycle")` | WIRED |
| `classification-fit.test.ts` | `portia-content.ts`, `portia.css` | `classificationOptions`, `@container` | WIRED |

### Трассировка данных (уровень 4)

Фаза — стиль и раскладка. Новый источник данных один: «Доступные записи» берутся из того же `searchIndex` (уже отфильтрованного по допуску Phase 24), только без обрезки до 8 в развёрнутом окне. Новых запросов, сети и RLS нет (подтверждено `git diff 28fdbce..HEAD`). Живые данные (`/api/content`, `/api/users`): BLOCKED (DATA).

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|-----------|---------|-----------|--------|
| Ключевые тесты gap-планов и регрессов | `node --experimental-strip-types --test lib/ui-unify.test.ts lib/editor-tab-layout.test.ts lib/level-editor.test.ts lib/classification-fit.test.ts lib/start-menu.test.ts lib/search-index.test.ts lib/format-launch.test.ts lib/style-tokens.test.ts lib/phase26-regressions.test.ts lib/portia-desktop.test.ts` (Node 22.13.1) | 257 тестов, 257 прошло, 0 упавших | ✓ PASS |
| Полный набор (данные оркестратора, мной не запускался) | `node --experimental-strip-types --test lib/*.test.ts` | 2387 тестов, 2384 прошло, 0 упавших, 3 пропущено | принято как факт шлюза |
| Типы (данные оркестратора) | `tsc --noEmit` | exit 0 | принято как факт шлюза |
| Маркеры TBD/FIXME/XXX/TODO/HACK в добавленных строках (`28fdbce..HEAD` и `312033d..HEAD`, без `.planning`) | `git diff … \| grep` | 0 | ✓ PASS |
| Браузер, e2e, axe, устройства | — | не запускались | ? SKIP → человек |

Режим `--verify` манифеста не запускался.

### Выполнение проб

Проб `scripts/*/tests/probe-*.sh`, объявленных планами, нет. Пропущено.

### Покрытие требований

Идентификаторы из frontmatter 20 планов: 26-01 UI-02; 26-02, 26-12, 26-20 UI-07; 26-03 UI-03; 26-04 UI-05; 26-05 UI-06; 26-06/07/08 UI-04; 26-09 UI-04, UI-03; 26-10 UI-08; 26-11 UI-09; 26-13 UI-10; 26-14 UI-11; 26-15 UI-03, UI-06; 26-16 UI-05, UI-03; 26-17 UI-06, UI-03; 26-18 UI-04, UI-06; 26-19 UI-03, UI-04. Все 10 ID фазы (UI-02…UI-11) учтены; ORPHANED нет (в `REQUIREMENTS.md` строки 150-159 фазе 26 соответствуют только эти 10 ID).

| Требование | Планы | Статус | Доказательство |
|------------|-------|--------|----------------|
| UI-02 | 26-01 | ✓ SATISFIED | истина 1 |
| UI-03 | 26-03, 26-09, 26-15, 26-16, 26-17, 26-19 | ✓ SATISFIED (код); вид — человек | истины 2, 16, 19 |
| UI-04 | 26-06…09, 26-18, 26-19 | ✓ SATISFIED (код); перетаскивание — человек | истины 3, 14, 15, 17 |
| UI-05 | 26-04, 26-16 | ✓ SATISFIED (код); hit-test — человек | истины 4, 12 |
| UI-06 | 26-05, 26-15, 26-17, 26-18 | ? NEEDS HUMAN | истины 5, 13 |
| UI-07 | 26-02, 26-12, 26-20 | ✓ SATISFIED (читаемость 16–24px — человек) | истины 6, 21 |
| UI-08 | 26-10 | ? NEEDS HUMAN | истина 7 |
| UI-09 | 26-11 | ? NEEDS HUMAN | истина 8 |
| UI-10 | 26-13 | ✓ SATISFIED (расчёт); axe — человек | истина 9 |
| UI-11 | 26-14 | ✓ SATISFIED (код); устройство — человек | истина 10 |

В `REQUIREMENTS.md` UI-02…UI-11 стоят `[x]`/«Complete». Для UI-06/08/09 это отметка по коду; приёмка на устройстве остаётся BLOCKED до Phase 27 и принята быть не может без владельца.

### Найденные антипаттерны и открытые замечания ревью

Блокеров нет. Три предупреждения инкрементального ревью (`26-REVIEW.md`, `26-REVIEW-DISPOSITION.md`: все `open`) мной перепроверены по коду.

| Файл | Строка | Находка | Серьёзность | Влияние |
|------|--------|---------|-------------|---------|
| `components/portia-editor.tsx` / `portia-editor-dossier.tsx` | 1390, 1448 / 104-123 | WR-01 подтверждено: в `.editor-section-single` одна карточка, у `OrderDragHandle` в её шапке единственный кандидат `moveTo` — она сама (`target === indexRef.current`), перетаскивание мышью ничего не делает, работают только стрелки. Заметная ручка «≡» молчит — повторяет жалобу владельца «перетаскивание пропало», хотя истинная функция (вкладки) работает | ⚠️ Warning | Вид «сломанной» ручки у активного раздела |
| `components/portia-editor.tsx` | 288-291 | WR-02 подтверждено: ручка вкладки слушает только ArrowUp/ArrowDown на горизонтальной полосе, `autoscroll` прокручивает только вертикаль; два tab-стопа на раздел | ⚠️ Warning | Клавиатура и длинные полосы вкладок |
| `components/portia-level-picker.tsx` | 25-28 | WR-03: закрытие по `onBlur/relatedTarget`; в Safari/Firefox на macOS клик мышью не ставит фокус на кнопку/радио | ⚠️ Warning | Только macOS-браузеры; на Windows/Chrome работает |
| `app/portia.css` | 1169, 1367, 251, 2448-2451, 2688-2689 | IN-01 (`100cqw` вычитает padding второй раз), IN-02 (мёртвые/дублирующие объявления), IN-03 (пустая колонка 72px у абзаца загрузки «Повышения») | ℹ️ Info | косметика |

### Требуется проверка человеком

Все пункты — BLOCKED (ENV/DATA/DEVICE) или решение владельца; ни один не считается пройденным. UAT-пункты 5, 7, 8 остаются `pending`, пункт 4 — BLOCKED (DATA).

1. **Меню PORTIA (gap 1)** — **Тест:** см. `behavior_unverified_items`. **Почему человек:** порядок событий в браузере.
2. **Крестик в самом углу (gap 2, UI-05)** — **Тест:** нажимать в крайний верхний правый пиксель обычного и развёрнутого окна. **Почему человек:** hit-test слоя поверх окна.
3. **Развёрнутые окна (gap 3, UI-06)** — **Тест:** Настройки, Глобальный поиск, Повышение (вход и статус), Справочник, База вирусов на 1366×768 и 1920×1080. **Почему человек:** «пустое место» судит владелец.
4. **Справочник и Информация в редакторе (gaps 4, 5)** — **Тест:** создать раздел и подраздел, перетащить вкладку, открыть/закрыть «+ ДОБАВИТЬ РАЗДЕЛ». **Почему человек:** вид и жест.
5. **Выбор уровня допуска (gap 6)** — **Тест:** открыть/закрыть кнопку мышью и клавиатурой во всех формах; проверить подсказку «Не ниже раздела». **Почему человек:** вид; плюс WR-03 в Safari/Firefox, если владелец ими пользуется.
6. **«Повышение» в редакторе (gap 7) и участника (gap 8), диалог по центру (gap 9), кнопка в корзину (gap 10), названия классов (gap 11)** — **Тест:** открыть каждый экран, нажать закрыть окно с несохранённым. **Почему человек:** вид.
7. **UAT-пункты 4, 5, 7, 8** — «Информация» на телефоне, ярлыки 521–900px, axe/скринридер, DPR 1.25 — не закрыты правками фазы 26.
8. **Решение по WR-01** — убрать неработающую ручку из карточки активного раздела (одна правка) или оставить; решение владельца.

### Резюме

Провалов нет: каждый из 11 пробелов UAT реализован, подключён и закреплён тестами по исходникам и расчётам; 10 прежних истин регрессий не имеют (токены радиусов, шов вкладок, 18 знаков, `window-geometry.ts`, подключение РАЗДЕЛЫ и ярлыков на месте). Не доказаны поведение и вид в браузере и на устройстве: 7 истин остаются «присутствует, поведение не исполнялось», что честно отражено в `26-VISUAL-REPORT.md` («Не проверено», слова PASS нет). Из ревью я подтвердил WR-01 как реальный дефект вида (мёртвая ручка в карточке раздела), WR-02/WR-03 как краевые случаи; блокерами не считаю. Дальше решение за владельцем: повторный UAT этих экранов и выбор по WR-01.

---

_Проверено: 2026-11-17_
_Верификатор: Claude (gsd-verifier)_
