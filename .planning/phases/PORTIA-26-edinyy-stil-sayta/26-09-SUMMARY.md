---
phase: PORTIA-26-edinyy-stil-sayta
plan: 09
subsystem: ui
tags: [editor, users, sticky-bar, aria-current, list-detail, access-card, owner-login, css]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "шов portia-editor-tab-shell.tsx (EditorActionBar с nav-слотом, EditorTabBody, EditorEmptyDetail), классы etab-* (26-06, 26-07); семейства кнопок, полей, вкладок, строк ui-unify (26-03); угловой крестик .corner-close у карточки заявки (26-04); образец вызова шва вне семейства portia-editor (26-08)"
provides:
  - "«Пользователи» на ПК: EditorActionBar — разделы «Заявки · N», «Люди · N», «Отклонённые и отозванные · N» (aria-current), статус «Ожидают: N», у владельца «ОДОБРИТЬ ИЗ ТАБЛИЦЫ» (primary); EditorTabBody — строки активного раздела слева, деталь справа"
  - "UsersActionBody — одно тело для окна действий телефона и детали ПК (ник, ТИП, В ТАБЛИЦЕ, ПРОФИЛЬ, подпись, история, действия из visibleControls)"
  - "nextUsersSelection(rows, decidedKey) в lib/users-view.ts — следующая строка после решения"
  - "карточка заявки и вход владельца: угол диалога, поля field 44px, мягкий primary вместо сплошной заливки, secondary у «СОЗДАТЬ АККАУНТ»"
affects: [26-13, 26-14]

plan_head_before: 9f1416adb1ab7fa20826090aafef93a70765917a
plan_head_after: eeccc94d844b3c24fc639e63df8ca8ef96c7b132

actuals:
  tokens: 17850
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "ПК и телефон — две ветки разметки одного компонента по isPhone: на ПК панель и «список — деталь», на телефоне прежние секции Phase 22 и окно действий"
    - "одно тело (UsersActionBody) для окна телефона и детали ПК; права только из visibleControls в RowActions"
    - "после решения: выбор пересчитывается по свежему ответу сервера (load возвращает список), фокус — строке или кнопке раздела"
    - "геометрия экранов доступа — в блоке ui-unify, цвета — в базовых правилах начала файла"

key-files:
  created: []
  modified:
    - components/portia-users-tab.tsx
    - lib/users-copy.ts
    - lib/users-view.ts
    - lib/users-view.test.ts
    - lib/users-component.test.ts
    - lib/editor-tab-layout.test.ts
    - lib/ui-unify.test.ts
    - tests/e2e/specs/users-tab.spec.ts
    - app/portia.css

key-decisions:
  - "Панель и «список — деталь» только на ПК (isPhone=false); телефон оставлен на прежних секциях, details «Отклонённые и отозванные» и окне действий, как требует план"
  - "После решения на ПК решённая строка остаётся выбранной, если она ещё в разделе (смена уровня, отказ сервера вроде self/stale); иначе выбирается nextUsersSelection по порядку строк до решения; если такой строки нет в свежем списке — фокус на кнопку раздела в панели"
  - "nextUsersSelection возвращает null и для ключа, которого нет в списке: выбор не привязывается к неизвестной строке"
  - "Цвета мягкого primary для карточки заявки — в базовых правилах (блок ui-unify по контракту 26-03 не задаёт цветов); в блок ушла только геометрия: углы, высота 44px"
  - "Плавающая «ПОДАТЬ ЗАЯВКУ» получила мягкий фон поверх непрозрачной var(--panel): полупрозрачный --teal-soft прямо над обоями читался бы хуже"
  - "Счётчики разделов — total из ответа сервера (list[kind].total), «Ожидают: N» — pendingTotalAll (то же число, что у плашки вкладки)"

patterns-established:
  - "Вкладка вне семейства portia-editor с липкой панелью внутри своего корня: .content-editor:has(> .users-tab > .etab-bar) снимает верхний отступ на ПК, как у прямого .etab-bar"

requirements-completed: [UI-04, UI-03]

coverage:
  - id: D1
    description: "Трассер: «Пользователи» на ПК — EditorActionBar с тремя разделами (aria-current, подписи «{раздел} · N»), статус «Ожидают: N», у владельца «ОДОБРИТЬ ИЗ ТАБЛИЦЫ» (primary, прежние условия видимости и disabled); EditorTabBody со строками активного раздела и деталью; пустая деталь «Выберите заявку или человека» / «Действия появятся справа.»"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-13b: «Пользователи» on a PC renders the shared action bar: three sections in the nav slot, «Ожидают: N», the owner's bulk approval"
        status: pass
      - kind: unit
        ref: "lib/editor-tab-layout.test.ts#D-12: «Пользователи» on a PC is a list/detail body: the rows of the active section, the detail or the empty detail"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#the empty detail and the section labels are short texts in users-copy"
        status: pass
    human_judgment: false
  - id: D2
    description: "Деталь ПК и окно телефона — один UsersActionBody; действия только из visibleControls (одно место вызова), тело не читает canDecide/canSetLevel/canRevoke/retryAt (T-26-18); новых полей ответа нет (T-26-19)"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/users-component.test.ts#the PC detail pane and the phone action window share one UsersActionBody with server-driven controls"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#users component keeps access internals behind its API route"
        status: pass
    human_judgment: false
  - id: D3
    description: "После решения на ПК — следующая строка выбрана и в фокусе, строк нет — фокус на кнопку раздела; nextUsersSelection — чистая функция; выбор сам ничего не выполняет (T-26-20); телефон — прежний возврат фокуса"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/users-view.test.ts#nextUsersSelection picks the row after the decided one, the previous one at the end, null when none is left"
        status: pass
      - kind: unit
        ref: "lib/users-view.test.ts#nextUsersSelection returns null for zero rows, a single decided row or a key that is not in the list"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#after a PC decision the next row is picked and focused; none left focuses the section nav"
        status: pass
    human_judgment: false
  - id: D4
    description: "Встроенные действия и переключатель истории убраны из строк ПК; история в детали всегда раскрыта и перезагружается по nicknameKey; тесты Phase 22 перенацелены, правила подтверждений, already-decided, массового одобрения не менялись"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "lib/users-component.test.ts#person and cooldown actions are available in the PC detail pane and in the phone action window"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#history is always open in the PC detail pane and in the phone action window"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#history stays open across list refresh and reloads by nicknameKey"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#owner bulk approval is sequential, safe by default and keeps the three-number result"
        status: pass
    human_judgment: false
  - id: D5
    description: "Карточка заявки и вход владельца: угол var(--radius-dialog), поля var(--radius-field) 44px, мягкий primary 44px вместо сплошной заливки, secondary у «СОЗДАТЬ АККАУНТ»; ширина 440px и радиокнопки прежние"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03 (D-11 step 4): the request card and the owner login have the dialog corner and the field box"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03 (D-11 step 4): the submit buttons are the soft primary, 44px; the second owner action is the secondary"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: the block changes no colour, font family or animation; the access screens take only geometry from it"
        status: pass
    human_judgment: false
  - id: D6
    description: "Вид двух экранов в браузере (D-10: «Пользователи» на ПК и «Карточка заявки / вход владельца»): ширина колонок, липкость панели, читаемость мягкой кнопки над обоями; живой /api/users с авторизованными ролями; e2e-шаги ПК в users-tab.spec.ts"
    requirement: UI-04
    verification: []
    human_judgment: true
    rationale: "Playwright, устройства, авторизованные роли и живой /api/users — BLOCKED (ENV)/(DATA); e2e-спека обновлена, но не запускалась; вид оценивает владелец"

duration: 10 min
completed: 2026-11-16
---

# Phase 26 Plan 09: «Пользователи» в общей раскладке, карточка заявки и вход владельца в общих семействах Summary

**На ПК вкладка «Пользователи» получила липкую панель из шва (три раздела с `aria-current`, «Ожидают: N», «ОДОБРИТЬ ИЗ ТАБЛИЦЫ» у владельца) и раскладку «строки слева — деталь справа», где деталь — то же тело, что окно действий на телефоне; после решения выбор сам переходит к следующей строке. Карточка заявки и вход владельца перешли на угол диалога, поля field и мягкий primary вместо сплошной бирюзовой заливки.**

## Performance

- **Duration:** ~10 мин
- **Started:** 2026-11-16T12:11:29Z
- **Completed:** 2026-11-16T12:21:38Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `UsersTab` на ПК: `<EditorActionBar label={usersCopy.sectionsLabel}>` — nav `.users-sections` из `USERS_SECTIONS` (`data-users-tab`, `aria-current`, подпись `usersCopy.sectionTab(title, list[kind].total)`), `statusText={usersCopy.pendingStatus(list.pendingTotalAll)}`, в actions — `primary-control` массового одобрения при прежних `callerIsOwner && ownerBulk.visible` и `disabled={ownerBulk.disabled || bulkLoading}`.
- Под панелью — поиск, «Время указано по Москве», подпись массового одобрения (если есть) и `EditorTabBody`: список `.users-pane[data-users-section]` со строками-кнопками `.users-pick-row` (ник, плашка статуса, подпись; `aria-current` у выбранной), деталь — `UsersActionBody` или `EditorEmptyDetail` со строками из `users-copy`.
- `UsersActionBody` вынесен из окна телефона: заголовок-ник, `dl` ТИП / В ТАБЛИЦЕ / ПРОФИЛЬ, подпись последнего решения, история (кроме «Заявок», всегда раскрыта), `RowActions` (единственный вызов `visibleControls`).
- После решения на ПК (`postAction(..., fromPhone=false)`): `load()` возвращает свежий список; решённая строка остаётся выбранной, если она ещё в разделе, иначе `nextUsersSelection(rowsBefore, decidedKey)`; фокус — на строку (`focusPcSelection`), при пустом выборе — на кнопку раздела. Телефон — прежний `focusAfterRefresh`.
- Из строк ПК убраны встроенные действия и переключатель истории (`toggleHistory`, `.users-history-toggle`); история детали живёт в `openHistoryKeys` и перезагружается с каждым обновлением списка.
- CSS: `.users-sections button` в семействе вкладок (40/44px, линия 3px у `aria-current`), выбранная строка — `--teal-dim`/`--teal-soft` как у `.editor-record-list`, правила `dl`/`dt`/`dd` перенесены на `.users-action-body`, панель прилегает к верху на ПК (`.content-editor:has(> .users-tab > .etab-bar)`).
- Экраны доступа: `.access-card`, `.owner-login-card` — `var(--radius-dialog)`; поля — `var(--radius-field)`, 44px; кнопки карточки и «ПОДАТЬ ЗАЯВКУ» — рамка `--teal-dim`, фон `--teal-soft`, текст `--teal`, наведение — рамка `--teal`; кнопки входа 44px (было 42px); «СОЗДАТЬ АККАУНТ» — цвет `.secondary-control`.

## Task Commits

1. **Task 1: Трассер — разделы в панели, строки слева, деталь с телом окна действий** — `1de182b` (feat)
2. **Task 2: Следующая строка после решения; встроенные действия ПК убраны; тесты и e2e перенацелены** — `04cdbd3` (feat)
3. **Task 3: Карточка заявки и вход владельца в общих семействах** — `eeccc94` (feat)

## Files Created/Modified

- `components/portia-users-tab.tsx` — импорт шва, `USERS_SECTIONS`, `ActionHandlers`, `UsersActionBody`, ветки ПК/телефон, выбор строки и раздела, `focusPcSelection`, `postAction` с `fromPhone`.
- `lib/users-copy.ts` — `sectionsLabel`, `sectionTitles`, `sectionTab`, `pendingStatus`, `detailEmptyTitle`, `detailEmptyHint`.
- `lib/users-view.ts` — `nextUsersSelection`.
- `lib/users-view.test.ts` — два теста `nextUsersSelection`.
- `lib/users-component.test.ts` — общий `UsersActionBody`, строки copy, выбор следующей строки; два теста Phase 22 перенацелены.
- `lib/editor-tab-layout.test.ts` — три проверки «Пользователей» (панель, тело, стили).
- `lib/ui-unify.test.ts` — `.users-sections` в семействе вкладок, снят мёртвый `aria-pressed`, два теста экранов доступа.
- `tests/e2e/specs/users-tab.spec.ts` — блок `[PORTIA-26]` для ПК 1280px (деталь `.etab-detail`, массовое одобрение в панели); не запускался.
- `app/portia.css` — блок users-tab (строки выбора, вкладки разделов, тело действий), ui-unify (вкладки, отступ панели, геометрия экранов доступа), базовые цвета карточки заявки и входа.

## TDD

План типа `execute`, у всех трёх задач `tdd="true"`. RED и GREEN в одном коммите на задачу, как в 26-03 … 26-08.

- **Task 1 RED:** 5 из 44 упали (3 новых в editor-tab-layout, 2 новых в users-component) — на отсутствующем импорте шва, `UsersActionBody` и строках copy. GREEN: verify (5 файлов) 124/124.
- **Task 2 RED:** 5 из 90 (2 теста `nextUsersSelection` — функции нет; 2 перенацеленных теста компонента — встроенные действия и переключатель истории ещё в строках; новый тест фокуса). GREEN: 90/90, verify с ui-unify — 127/127.
- **Task 3 RED:** 3 из 102 (2 новых теста экранов доступа — сплошная заливка, нет углов; тест вкладок — мёртвый `aria-pressed`). GREEN: 102/102.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` трассера только автоматический; после коммита `1de182b` — 0 fail, расширение продолжено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Липкая панель внутри `.users-tab` на ПК**
- **Found during:** Task 1
- **Issue:** правило 26-06 `.content-editor:has(> .etab-bar)` снимает верхний отступ 28px только при панели прямым потомком; у «Пользователей» панель внутри `.users-tab`, и она липла бы с зазором 28px.
- **Fix:** селектор `.content-editor:has(> .users-tab > .etab-bar)` добавлен к обоим правилам ПК (отступ 0, у шапки 28px сверху).
- **Files modified:** app/portia.css, lib/editor-tab-layout.test.ts
- **Commit:** `1de182b`

**2. [Rule 1 - Bug] Выбор после решения, которое не убирает строку**
- **Found during:** Task 2
- **Issue:** «следующая строка после решения» для смены уровня, снятия паузы или отказа сервера (`self`, `stale`, `level-above-own`) увела бы выбор с человека, который остался в разделе.
- **Fix:** решённая строка остаётся выбранной, если она есть в свежем списке; иначе — `nextUsersSelection`. Для этого `load()` возвращает разобранный список вместо `true`.
- **Files modified:** components/portia-users-tab.tsx
- **Commit:** `04cdbd3`

**3. [Rule 1 - Bug] Мёртвые правила после переноса**
- **Found during:** Task 2, Task 3
- **Issue:** `.users-history-toggle`, `.users-row > a` и селектор `.editor-section-tabs nav button[aria-pressed="true"]` (с 26-07 вкладки разделов на `aria-current`) ничего не находят.
- **Fix:** удалены; тесты закрепляют отсутствие. Проблема из handoff 26-08 закрыта: оба файла входят в этот план.
- **Files modified:** app/portia.css, lib/users-component.test.ts, lib/ui-unify.test.ts
- **Commits:** `04cdbd3`, `eeccc94`

**4. [Контракт 26-03] Цвета экранов доступа вне блока ui-unify**
- **Found during:** Task 3
- **Issue:** план пишет «в блоке ui-unify перевести кнопку … на мягкий primary», но блок по контракту 26-03 не задаёт цветов (тест «the block changes no colour…»).
- **Fix:** цвета — в базовых правилах `.access-card button…`, `.access-reopen`, `.owner-login-*` в начале файла, в блоке — только углы и высота 44px. Строку теста «26-09 restyles…» (запрет `.access-card` в блоке) заменили новыми проверками.
- **Files modified:** app/portia.css, lib/ui-unify.test.ts
- **Commit:** `eeccc94`

**5. [Rule 2 - Читаемость] Фон плавающей «ПОДАТЬ ЗАЯВКУ»**
- **Found during:** Task 3
- **Issue:** `--teal-soft` — 13% прозрачности; кнопка стоит `position: fixed` прямо над обоями рабочего стола.
- **Fix:** `background: linear-gradient(var(--teal-soft), var(--teal-soft)), var(--panel)` — тот же мягкий оттенок поверх непрозрачной панели.
- **Files modified:** app/portia.css
- **Commit:** `eeccc94`

**6. [Уточнение плана] Порядок работ Task 1 / Task 2**
- В Task 1 строки ПК сразу стали кнопками выбора (ник, плашка, подпись), но `RowActions` и переключатель истории оставались рядом до Task 2. Табличная отметка и ссылка на профиль из строки ушли в деталь уже в Task 1 (они есть в теле). Итог после Task 2 совпадает с планом.

**Total deviations:** 6 (3 × Rule 1, 1 × Rule 2, 1 контракт 26-03, 1 уточнение порядка). **Impact:** в границах UI-04/UI-03; права, маскирование решающих, московское время, `already-decided`, подтверждения отклонения/отзыва, массовое одобрение с тремя числами и телефонное окно не менялись.

## Допущения, сообщаемые владельцу (edge-probe UI-04/UI-03: unclassified / unresolved)

- **A4 (UI-SPEC):** на ПК одиночное одобрение — теперь два клика (строка, затем «ОДОБРИТЬ» в детали). После решения следующая строка выбирается сама, поэтому разбор очереди — «клик + клик» на заявку. «ОДОБРИТЬ ИЗ ТАБЛИЦЫ» у владельца по-прежнему один клик.
- **Кнопка «ОДОБРИТЬ ИЗ ТАБЛИЦЫ»** видна в панели всегда при прежних условиях, а не только «когда ничего не выбрано» (UI-SPEC, таблица действий). Так требует план («прежние условия видимости»).
- **Счётчики разделов** считают всё, что вернул сервер для текущего поиска (`total`), а «Ожидают: N» — все ожидающие заявки без поиска (то же число, что на плашке вкладки). При поиске числа могут различаться.
- **Ник в детали** — 16px; на телефоне в окне действий заголовок прежний.
- **Кнопка «ПОВТОРИТЬ ПРОВЕРКУ»** на карточке заявки — тоже мягкий primary: другого действия в этом состоянии нет. Ширина кнопок карточки не менялась (по-прежнему во всю карточку): карточка шириной 440px, это меньше 480px, как у исключения A3.
- **Класс `.users-nickname`** в разметке больше не используется, но правило в ui-unify оставлено: его называет тест 26-03.

## Threat Model

- **T-26-18:** `visibleControls(` вызывается в одном месте (`RowActions`); `UsersActionBody` не читает флаги прав; тест закрепляет оба факта. Сервер перепроверяет каждое решение (Phase 22, не менялось).
- **T-26-19:** деталь показывает те же поля, что окно телефона; новых запросов и полей нет; `/api/users` — единственный адрес (тест «keeps access internals behind its API route» зелёный).
- **T-26-20:** выбор следующей строки только меняет выбор и фокус; `ConfirmDialog` отклонения/отзыва и обработка `already-decided` не менялись; тест проверяет, что в `postAction` нет вызовов действий.
- Новой поверхности (сеть, доступ, файлы) нет.

## Known Stubs

Нет.

## Для владельца

Два экрана изменились (правило одной переделки D-10 — для каждого отдельно). В браузере не открывалось — суждение по коду и тестам.

**1. «Пользователи» на компьютере.**
- Наверху вкладки теперь та же полоса, что в «Справочнике» и «Повышении», и она не уезжает при прокрутке. Слева в ней три раздела: «Заявки · 12», «Люди · 40», «Отклонённые и отозванные · 3». Текущий подсвечен и подчёркнут. Справа надпись «Ожидают: N». У владельца там же кнопка «ОДОБРИТЬ ИЗ ТАБЛИЦЫ», теперь яркая (основная).
- Ниже, как раньше, поиск по нику. Под ним слева список выбранного раздела: в строке только ник, плашка статуса и подпись. Справа — карточка выбранного человека: ник, тип, отметка «в таблице», ссылка на профиль Roblox, последняя запись, история (у «Людей» и «Отклонённых» она всегда открыта) и кнопки действий. Это то же самое, что на телефоне открывается в окне.
- Пока ничего не выбрано, справа написано «Выберите заявку или человека» и «Действия появятся справа.»
- Кнопок в самих строках больше нет. Одобрить одну заявку — значит нажать на строку, потом «ОДОБРИТЬ». После решения следующая заявка выбирается сама, так что дальше снова «ОДОБРИТЬ». Если заявок не осталось, курсор переходит на название раздела в полосе.
- Подтверждения «Отклонить заявку?» и «Отозвать доступ?», окно массового одобрения, «Уже решено…» и права работают как раньше: что можно делать, по-прежнему решает сервер.
- **Телефон не менялся:** три блока подряд, нажатие на строку открывает окно действий.

**2. Карточка заявки и вход для редактора.**
- У обеих карточек углы скруглены как у диалогов, у полей ввода — как у остальных полей сайта, высота прежняя.
- Кнопка «ОТПРАВИТЬ ЗАЯВКУ» и плавающая «ПОДАТЬ ЗАЯВКУ» больше не залиты сплошным бирюзовым. Теперь они как остальные основные кнопки: бирюзовая рамка, лёгкий бирюзовый фон, бирюзовый текст. При наведении рамка становится ярче.
- На входе для редактора кнопки стали 44px (были 42px). «СОЗДАТЬ АККАУНТ» осталась второстепенной: прозрачный фон, светлый текст.
- Ширина карточек, переключатели «Я из таблицы / Я не из таблицы», все тексты и поведение — прежние.

Проверки в браузере и на устройствах (Playwright, ПК, телефон, живой `/api/users` с ролями) не запускались. Они BLOCKED до окружения и данных и не считаются пройденными.

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts`: 2313 тестов, 2310 pass, 3 skipped, 0 fail (база 26-08: 2303/2300/3/0).
- `<verify>` Task 1 (5 файлов): 124/124. Task 2 (4 файла): 90/90. Task 3 (4 файла): 102/102.
- `node node_modules/typescript/bin/tsc --noEmit`: без ошибок.
- ESLint по компоненту, `users-*`, трём тестам раскладки/ui-unify и e2e-спеке: 0 ошибок, 0 предупреждений.
- Критерии приёмки (grep считает строки):
  - Task 1: `EditorActionBar` в компоненте — 2 (≥ 2); `UsersActionBody` — 3 (≥ 3); «Выберите заявку или человека» в `users-copy.ts` — 1.
  - Task 2: `export function nextUsersSelection` — 1; `nextUsersSelection` в `users-view.test.ts` — 10 (≥ 3); `etab-detail` в e2e-спеке — 2.
  - Task 3: `.owner-login-card … var(--radius-dialog)` — 1; `access-card` в `ui-unify.test.ts` — 7.
- E2E «Пользователей» (моки и живые данные) — **BLOCKED (ENV)/(DATA)**: спека обновлена, не запускалась, не записана как пройденная.

## Next

Ready for 26-10.
- «Пользователи» — четвёртое место, где вызывается `EditorActionBar` (после черновых вкладок, «Сотрудников» и «Повышения»), вне реестра D-21.
- `lib/editor-tab-layout.test.ts`: хелпер `usersSlice(from, to)` для JSX вкладки «Пользователи».

## Self-Check: PASSED

- FOUND: .planning/phases/PORTIA-26-edinyy-stil-sayta/26-09-SUMMARY.md, components/portia-users-tab.tsx, lib/users-view.ts, lib/users-copy.ts, app/portia.css
- FOUND: 1de182b, 04cdbd3, eeccc94 (предки HEAD)
