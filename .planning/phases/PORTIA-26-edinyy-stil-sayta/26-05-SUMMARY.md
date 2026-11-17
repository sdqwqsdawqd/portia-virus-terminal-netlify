---
phase: PORTIA-26-edinyy-stil-sayta
plan: 05
subsystem: ui
tags: [css, maximized-window, grid, audit, guard-test]

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: блок ui-unify и каскадный хелпер lastDeclaration (26-03), токены --field-max / --card-min (26-01), угол окна (26-04)
provides:
  - правила развёрнутого окна под единственным хуком .app-window.is-maximized (только ПК): R1-сетки, R2-потолок, R3 у плоских форм, R4-колонка чтения, R5 для закрытого «Устава»
  - D-19 в развёрнутом редакторе: карточки форм — больше колонок по var(--editor-card-width), без 1fr
  - lib/ui-unify.test.ts: MAXIMIZED_WINDOWS (12 окон) с проверкой на окно, охрана хука (нет container-type, все правила с .app-window.is-maximized и в desktop-медиа), D-19, потолки 640/820/1320
  - 26-MAXIMIZED-AUDIT.md — таблица исходов по 12 окнам + строка пикселей BLOCKED (ENV)
affects: [26-06, 26-07, 26-08, 26-09, планы фазы 26, трогающие окна, редактор и «Повышение»]

plan_head_before: 25beb728fd40d7ae294471e70c9ceb99d63fe4fa
plan_head_after: fb8af9d5bc5f12e3f311b59d03b43cc8f15be467

actuals:
  tokens: 8300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "все правила развёрнутого окна — `.app-window.is-maximized …` внутри `@media (min-width: 901px)` (R3 — `min-width: 1281px`), поэтому телефон с оставшимся флагом maximized не меняется"
    - "сетка R3 у панели с фоном («Настройки») задаётся колонками `repeat(2, minmax(0, 648px))`, а не max-width на панели: фон и полоса прокрутки остаются у края окна"
    - "правило заглушки закрытой записи (.access-redacted-block) живёт только в блоке access-levels — туда же положено правило развёрнутого «Устава»"

key-files:
  created:
    - .planning/phases/PORTIA-26-edinyy-stil-sayta/26-MAXIMIZED-AUDIT.md
  modified:
    - app/portia.css
    - app/portia-promotion-editor.css
    - lib/ui-unify.test.ts
    - lib/portia-desktop.test.ts

key-decisions:
  - "Правила развёрнутого окна только в @media (min-width: 901px): флаг maximized сохраняется в состоянии окна и на телефоне, а D-03/UI-SPEC требуют, чтобы телефон не менялся"
  - "R3 по D-19 — только плоские формы: профиль сотрудника («Сотрудники»), форма вируса в редакторе, группы «Настроек»; форма сотрудника в редакторе (одна группа, поля уже в 2 колонки) получает только потолок 1320px; формы проверяющего в «Повышении» R3 не получают"
  - "Запись вируса (общий лист 1060px, D-55) и документ учёного (820px) не трогаются: это меры, окно их не меняет; мутации внутри листа не переводятся в R1"
  - "Корзина остаётся таблицей со столбцами fr (уже заполняет ширину), «Таблица» уже заполняет окно (iframe масштабируется из кода) — already conformant"
  - "Строка «Устав»: закрытый блок растянут на окно под полосой (height: calc(100% - 46px)), содержимое по центру; правило в блоке access-levels"

requirements-completed: [UI-06]

coverage:
  - id: D1
    description: "Трассер: «Доступные записи» и результаты поиска в развёрнутом окне — сетка R1 (до 4 колонок, 360px), шапка и строка поиска до 640px, «Совпадений нет» на всю ширину по центру, стрелки только Вверх/Вниз по DOM; в обычном окне одна колонка"
    requirement: UI-06
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-01: «Доступные записи» are a card grid in a maximized search window and one column otherwise"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-02 (R2): the search box and the header of a maximized search window stop at 640px"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06: keyboard order over the result grid stays the DOM order (Up/Down only, no Left/Right)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03: хук .app-window.is-maximized не изменён (inset 8px, радиус окна), container-type нет на окне и .workspace, каждое правило под хуком начинается с него и стоит в desktop-медиа"
    requirement: UI-06
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-03: the maximized hook is unchanged, the only one, and never a container"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-04: двенадцать окон проверены по рецептам UI-SPEC (10 fixed, 2 already conformant), перечень сверен с appMeta"
    requirement: UI-06
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-04: the audit list names every window of the desktop once"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-04: maximized <app> follows the UI-SPEC recipe (12 тестов)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-19 и D-02: R3 только у двух плоских форм (+ «Настройки» колонками 648px), карточки редактора без 1fr, --editor-card-width: 340px на месте, ни одно правило под хуком не растягивает контрол, потолки только 640/820/1320; тесты D-43/D-15 сохранены и дополнены"
    requirement: UI-06
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-19: two columns only for flat forms; editor cards keep their 340px width and never stretch"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-06 / D-02: no maximized rule stretches a control and the caps are 640/820/1320px"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#window tiles keep their own size and the search shows the picked recommendations (D-43)"
        status: pass
      - kind: unit
        ref: "lib/portia-desktop.test.ts#editor form cards keep one fixed width set by a single variable and fill columns on desktop only (D-15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Отсутствие горизонтальной прокрутки и пустых полос на 1366×768, 1920×1080, 2560×1440 (backstop E7) и видимое впечатление владельца от сеток"
    requirement: UI-06
    verification: []
    human_judgment: true
    rationale: "Пиксельная линия Playwright без препфлайта не запускалась — BLOCKED (ENV); физический ПК — Phase 27; проверены только значения в исходниках"

duration: ~10 мин (09:01–09:11 UTC от записи старта до последнего коммита задачи)
completed: 2026-11-16
status: complete
---

# Phase 26 Plan 05: Развёрнутое окно использует площадь Summary

**Под единственным хуком `.app-window.is-maximized` (только ПК) списки стали сетками карточек до 4 колонок, поля и текст получили потолки 640/820/1320px, плоские формы — две колонки с 1281px, карточки редактора — больше колонок по 340px; двенадцать окон записаны в аудит с честными исходами.**

## Performance

- **Tasks:** 2 из 2 (Task 1 — трассер поиска, Task 2 — остальные окна, D-43/D-15, аудит)
- **Files:** 5 (`app/portia.css`, `app/portia-promotion-editor.css`, `lib/ui-unify.test.ts`, `lib/portia-desktop.test.ts`, `26-MAXIMIZED-AUDIT.md` создан); разметка компонентов не менялась
- **Duration:** ~10 мин от записи старта (09:01:24Z) до коммита Task 2 (09:11Z); чтение контекста до этого не учтено

## Accomplishments

- **Трассер (Task 1, `0d1f9c7`):** в блоке ui-unify `@media (min-width: 901px)`: `.app-window.is-maximized .global-search-results { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(max(var(--card-min), calc((100% - 24px) / 4)), 1fr)) }`, карточки `min-width: 0`, шапка и `.global-search-box` до `var(--field-max)`, пустое состояние `grid-column: 1 / -1`. Тесты: формула R1 только под хуком, вне хука колонок нет ни на ПК, ни на телефоне; обработчик клавиш поиска без ArrowLeft/ArrowRight; охрана хука (D-03).
- **Окна (Task 2, `fb8af9d`):** база вирусов и сотрудники — колонка списка `clamp(270px, 24%, 340px)`; сводка — R1; справочник — R1 от 220px; документ «Информации» — 820px; R3 (`min-width: 1281px`, 2 колонки, 24px, до 1320px) у `.personnel-profile-body` и `.virus-editor-form` с одноколоночными блоками на обе колонки; форма сотрудника в редакторе — до 1320px; «Настройки» — `repeat(2, minmax(0, 648px))`; `.editor-card-columns`/`.editor-section-columns` — по `var(--editor-card-width)` без `1fr`; закрытый «Устав» — на всё окно по центру (в блоке access-levels); «Повышение» (в `portia-promotion-editor.css`) — список банков 280px, карточки банка и сведения заявки R1.
- **Тесты:** `MAXIMIZED_WINDOWS` — 12 записей с исходом и проверкой; тест сверяет перечень с `appMeta`; D-19 (R3 ровно у двух плоских форм, карточки без `1fr`), D-02 под хуком (нет `width: 100%`/`flex: 1`, потолки только 640/820/1320). В `portia-desktop.test.ts` тест D-43 дополнен (растягивающий трек у плиток сводки/справочника — только под хуком), D-15 — развёрнутое правило карточек редактора без `1fr`.
- **Аудит:** `26-MAXIMIZED-AUDIT.md` — 10 `fixed`, 2 `already conformant` (корзина, таблица), строка пикселей `BLOCKED (ENV)`.

## TDD

План типа `execute`, задачи с `tdd="true"`; RED и GREEN в одном коммите на задачу (как в 26-03/26-04).

- **Task 1 RED:** 2 из 22 тестов `ui-unify` упали до CSS (сетка поиска, потолок строки поиска); тесты клавиш и хука — охранные, прошли сразу. GREEN — 106/106 на `<verify>`.
- **Task 2 RED:** 10 тестов `ui-unify` (9 окон + D-19) и 2 теста `portia-desktop` (D-43, D-15) упали; строки «корзина» и «таблица» прошли сразу — подтверждение исхода `already conformant`. GREEN — 151/151 на `<verify>`.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` по умолчанию `end-of-phase`, `<verify>` трассера только автоматический — перезапущен после коммита: 106/106, 0 fail; расширение продолжено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Правила развёрнутого окна только на ПК**
- **Found during:** Task 1
- **Issue:** флаг `maximized` остаётся в состоянии окна и на телефоне (кнопку «Развернуть» там лишь скрывают), а правила под голым хуком изменили бы раскладку телефона — нарушение D-03 и «телефон не затронут».
- **Fix:** все новые правила под хуком — в `@media (min-width: 901px)` (R3 — `min-width: 1281px`); тест требует desktop-медиа у каждого нового правила с `is-maximized`.
- **Commits:** `0d1f9c7`, `fb8af9d`

**2. [Rule 3 - Blocking] Заглушка закрытой записи стилизуется только в блоке access-levels**
- **Found during:** Task 2 (полный набор: `lib/level-ui.test.ts` — «the placeholder is styled outside the block»)
- **Fix:** правило `.app-window.is-maximized > .access-redacted-block` перенесено в конец блока access-levels (в той же desktop-медиа); блок ui-unify его не содержит.
- **Commit:** `fb8af9d`

**3. [Rule 1 - Bug] R3 через `max-width` на панели «Настроек» оставил бы полосу без фона**
- **Found during:** Task 2
- **Issue:** `.settings-app` — сама панель с фоном и прокруткой; `max-width: 1320px` на ней оставил бы справа полосу окна без фона и сдвинул бы полосу прокрутки — ровно та «пустая полоса», на которую жаловался владелец.
- **Fix:** две колонки `repeat(2, minmax(0, 648px))` с зазором 24px (= форма 1320px), панель остаётся на всё окно. У профиля сотрудника и формы вируса рецепт применён дословно (у них внутренние обёртки).
- **Commit:** `fb8af9d`

**4. [Rule 1 - Bug] Пустая половина строки в двухколоночных формах**
- **Found during:** Task 2
- **Issue:** вкладки досье «Мутации» и «Записи учёных» — одна группа, а при отсутствии оценок у сотрудника — один блок «Звание/Ранг»; в R3 они заняли бы одну колонку из двух.
- **Fix:** `.virus-editor-form > :not(.editor-group)` и `> .editor-group.stack`, `.personnel-stats:only-of-type`, шапка и биография профиля — `grid-column: 1 / -1`; вертикальные отступы групп внутри R3-сетки сняты (их даёт зазор 24px).
- **Commit:** `fb8af9d`

**5. [Rule 3 - Blocking] Проверка клавиш поиска ловила чужой обработчик**
- **Found during:** Task 1
- **Fix:** проверка «нет ArrowLeft/ArrowRight» ограничена телом `onSearchKeyDown` (в файле есть Alt+стрелки другого обработчика).
- **Commit:** `0d1f9c7`

**Total deviations:** 5 auto-fixed (2 × Rule 1, 1 × Rule 2, 2 × Rule 3). **Impact:** без выхода за границы плана; разметка, цвета, шрифты, анимации и гейты доступа не менялись.

## Допущения, сообщаемые владельцу (edge-probe UI-06: unclassified / unresolved)

- **A6 UI-SPEC:** колонка чтения 820px («Информация», статья «Справочника», документы корзины) и листы записи вируса (1060px / 820px) — мера строки, по краям широкого окна остаётся фон. Владелец может назвать это «пустым местом».
- **Корзина** остаётся таблицей со столбцами, а не карточками; столбцы и так тянутся на всю ширину.
- **«Повышение»:** окно соискателя — колонка теста 680px без изменений; сетки и список 280px — у рабочего места проверяющего во вкладке «Повышение» редактора. Формы проверяющего две колонки не получают (D-19).
- **Справочник:** при «не больше 4 колонок» плитки на широком экране крупные (на 2560px примерно 600px шириной с обложкой 4:3).

## Для владельца

Что станет иначе, когда окно развёрнуто на весь экран ПК (в браузере не рендерилось — суждение по коду; обычное окно и телефон не меняются; отступ окна 8px и скругление прежние):

- **Глобальный поиск:** «Доступные записи» и результаты идут сеткой карточек — 2 колонки на 1366px, 3–4 на 1920–2560px (не больше 4, карточка не уже 360px). Строка поиска и заголовок не шире 640px. «Совпадений нет» — по центру на всю ширину. Стрелки Вверх/Вниз ходят по карточкам по порядку чтения, как раньше.
- **База вирусов:** список слева 270–340px (раньше 24% без верхней границы). Сама запись — прежний лист 1060px по центру, документ учёного — 820px.
- **Сотрудники:** список слева 270–340px (раньше 32%). Профиль на широком экране (от 1281px): шапка с аватаром и биография на всю ширину, «Звание/Ранг» и оценки — рядом в две колонки; весь профиль не шире 1320px.
- **Информация:** список разделов как был; текст документа не шире 820px.
- **Справочник:** плитки сеткой, не больше 4 в ряд, не уже 220px, зазор 8px (в обычном окне по-прежнему плитки 176px). Открытая статья — как была, 820px.
- **Повышение:** окно прохождения теста — без изменений (колонка 680px). В редакторе, во вкладке «Повышение»: список банков 280px (был 180–230px), вопросы банка и сведения заявки — карточками до 4 в ряд.
- **Настройки:** группы («Цвет интерфейса», «Фон», «Размер ярлыков», «Анимации», «Паук») — в две колонки по 648px с промежутком 24px (всего 1320px); «Содержимое сайта» и кнопка сброса — на всю ширину под ними; кнопки по своему тексту.
- **Сводка:** объявления карточками до 4 в ряд (не уже 360px) вместо плиток 340px; в обычном окне плитки 340px как были.
- **Корзина:** без изменений — таблица со столбцами на всю ширину, просмотр файла 760–800px по центру.
- **Таблица:** без изменений — документ уже на всё окно.
- **Устав:** открытый — на всё окно, как «Таблица»; закрытый — сообщение о доступе теперь по центру всего окна, а не прижато к верху.
- **Редактор:** карточки форм «Информации», «Справочника» и «Сводки» — те же 340px, просто больше колонок в ряд. Форма вируса на широком экране — группы попарно («Основные данные» рядом с «Классификацией», «Описание» рядом с «Характеристиками PPU»), «Мутации» и «Записи учёных» — на всю ширину, не шире 1320px. Форма сотрудника — не шире 1320px. Раскладка вкладок редактора — следующий план 26-06.

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts` — 2275 тестов, 2272 pass, 3 skipped, 0 fail (база 26-04: 2256/2253/3/0).
- `<verify>` Task 1 (`ui-unify`, `portia-desktop`, `style-tokens`) — 106/106; `<verify>` Task 2 (+ `portia-promotion-editor`) — 151/151.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок; ESLint по `lib/ui-unify.test.ts` и `lib/portia-desktop.test.ts` — 0 ошибок.
- Acceptance Task 1: `is-maximized .global-search-results` — 1; `calc((100% - 24px) / 4)` — 1 после Task 1; сейчас 3 в `app/portia.css` (поиск, сводка, справочник) и 1 в `app/portia-promotion-editor.css`.
- Acceptance Task 2: `is-maximized` в `app/portia.css` — 21 строка (база 2); `max-width: 820px` — 5; `max-width: 1320px` — 2; `--editor-card-width: 340px` — 1; строк `^| ` в аудите — 14 (заголовок, 12 окон, строка пикселей; разделитель начинается с `|---`).
- Визуальные и e2e линии не запускались и не записаны как пройденные; пиксели на 1366/1920/2560 — BLOCKED (ENV), записано в `.planning/WINDOWS.md` (unrun-verify, фаза 26); физический ПК — Phase 27; `scripts/phase15-visual-manifest.mjs --verify` не запускался.
- Node 22.13.1 (эталон) на PATH; `npm`/`npx` не использовались.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности. T-26-09: правило «Устава» только раскладка (высота блока), гейт `charterClosed` и содержимое заглушки не менялись. T-26-10: исходы аудита — `fixed`/`already conformant` с именем теста или `BLOCKED (ENV)`; формулировок о пройденной визуальной проверке нет.

## Issues Encountered

- Строки аудита «База вирусов» и «Повышение» отмечены `fixed` по изменённой части (колонка списка, список банков и сетки); записи вируса и окно соискателя сознательно не тронуты (меры) — это описано в строке, а не скрыто.

## Next Phase Readiness

Блок ui-unify остаётся последним в `app/portia.css`, подраздел развёрнутого окна — в его конце. 26-06 (раскладка вкладок редактора) должен сохранить D-19-правило карточек и R3 у `.virus-editor-form` / `.employee-profile-editor` или осознанно заменить их, обновив `MAXIMIZED_WINDOWS` (строка `editor`). Видимая оценка сеток — за владельцем.

## Self-Check: PASSED

- Файлы: `app/portia.css`, `app/portia-promotion-editor.css`, `lib/ui-unify.test.ts`, `lib/portia-desktop.test.ts`, `.planning/phases/PORTIA-26-edinyy-stil-sayta/26-MAXIMIZED-AUDIT.md` существуют.
- Коммиты `0d1f9c7`, `fb8af9d` достижимы из HEAD; `git rev-list --count 25beb72..HEAD` = 2.
