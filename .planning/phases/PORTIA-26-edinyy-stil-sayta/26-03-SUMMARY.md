---
phase: PORTIA-26-edinyy-stil-sayta
plan: 03
subsystem: ui
tags: [css, shared-families, buttons, plaques, tabs, fields, guard-test]

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: роли радиуса и размерные токены (26-01), охрана знает маркер ui-unify
provides:
  - блок ui-unify в конце app/portia.css: общие семейства кнопок, плашек, полей, вкладок и строк списков
  - lib/ui-unify.test.ts: каскадный хелпер lastDeclaration и контракт семейств, запрет растяжения кнопок
  - кнопки рабочего стола, приложений, редактора и Promotion больше не растягиваются (D-02)
affects: [26-04, 26-05, 26-06, 26-07, 26-09, все планы фазы 26, читающие семейства]

plan_head_before: 7d183e0a7d295ea5d7cd8b6fb07ec289bbd38282
plan_head_after: f4202095d0028286d08a4b3f4592d516b04da590

actuals:
  tokens: 8500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "общие семейства — списки селекторов в одном блоке в конце файла; конфликтующие правила с большей специфичностью переписаны на месте"
    - "контракт читается каскадом: последнее правило, чей список селекторов содержит селектор (lastDeclaration), с контекстом медиа max-width: 900px"

key-files:
  created:
    - lib/ui-unify.test.ts
  modified:
    - app/portia.css
    - app/portia-promotion-editor.css
    - lib/style-tokens.test.ts
    - lib/users-component.test.ts

key-decisions:
  - "Шрифтовые семейства не переопределяются семействами: вместо font-шорткатa задаются font-size, font-weight, line-height (запрет менять шрифты сильнее текста плана)"
  - "Стрелка .info-phone-back остаётся 20px (глиф значка, не текст ярлыка); остальные члены семейства кнопок 11px"
  - "Исключение A3: две стопки кнопок в диалоге действий (.users-action-dialog-body, диалог не шире 420px) перечислены в тесте поимённо"

requirements-completed: [UI-03]

coverage:
  - id: D1
    description: "Семейство кнопок: 40px (44px на ≤900px), padding 0 16px, роль radius-control, ширина по содержимому, цвета вариантов не тронуты"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: every button of the family has one geometry and one corner role"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: button variants keep their own colours (T-26-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-02: ни одна кнопка семейства и проверенные кнопки поиска, настроек и Promotion не растягиваются; исключение A3 названо"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03 / D-02: no button of the family is stretched, in either stylesheet"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03 / D-02: the narrow-stack exceptions are named, real and only inside the 420px dialog"
        status: pass
    human_judgment: false
  - id: D3
    description: "Семейства плашек, полей, вкладок (линия 3px у текущей, ошибка сильнее) и строк списков"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: every plaque is one pill box"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: single-line fields share one box and a phone touch target"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: tabs share one box and the active tab carries a 3px line at every width"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: the save-error line of a tab outranks the active line"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: list rows share one card box, one title size and one caption size"
        status: pass
    human_judgment: false
  - id: D4
    description: "Блок ui-unify последний в файле, без цветов, шрифтовых семейств, анимаций; users-tab и access-levels без border-radius; роли через каскад"
    requirement: UI-03
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-03: the ui-unify block is the last block of portia.css, after users-tab"
        status: pass
      - kind: unit
        ref: "lib/style-tokens.test.ts#UI-03: shared families read their roles through the cascade"
        status: pass
      - kind: unit
        ref: "lib/users-component.test.ts#users CSS is one sharp marked block right before the ui-unify block"
        status: pass
    human_judgment: false
  - id: D5
    description: "Видимый вид семейств (высота, пилюли, линия 3px, строки 7px) на экранах не рендерился; суждение о том, нравится ли он, принадлежит владельцу"
    requirement: UI-03
    verification: []
    human_judgment: true
    rationale: "Линии визуальной проверки BLOCKED (ENV)/(DATA): исполнитель не открывал экраны в браузере и не на устройстве; проверены только значения в исходниках"

duration: около 1ч (с перерывом на лимит)
completed: 2026-11-16
status: complete
---

# Phase 26 Plan 03: Общие семейства кнопок, плашек, полей, вкладок и строк Summary

**Один блок `ui-unify` в конце `app/portia.css` задаёт пять общих семейств (кнопки 40/44px без растягивания, плашки-пилюли, поля 40px, вкладки с линией 3px у текущей, строки списков 7px) и проверяется каскадным хелпером `lastDeclaration`; кнопки поиска, настроек и Promotion перестали растягиваться (D-02).**

## Performance

- **Tasks:** 2 из 2 (Task 1 — трассер, Task 2 — остальные семейства и аудит растягивания)
- **Files modified:** 5 (`app/portia.css`, `app/portia-promotion-editor.css`, `lib/ui-unify.test.ts` (новый), `lib/style-tokens.test.ts`, `lib/users-component.test.ts`); `lib/portia-desktop.test.ts` не менялся — закреплённые правила не сломаны

## Accomplishments

- **Трассер (Task 1, `3b44368`):** блок `/* ui-unify:start … */ … /* ui-unify:end */` после `users-tab`, первое правило — семейство кнопок для `.primary/.secondary/.danger-control`, `.app-state-action`, `.info-phone-back`, `.info-next button`, `.promotion-action` (позже и `.promotion-preview-actions > button`, `.promotion-device-reset button`): `min-height: var(--control-height)`, `padding: 0 16px`, `border-radius: var(--radius-control)`, `width: auto`, `flex: 0 0 auto`, на ≤900px `var(--tap-target)`. `lib/ui-unify.test.ts` с хелпером `lastDeclaration` (разбор правил, списки селекторов, медиа-контекст, порядок файла). Охрана «последний блок» в `lib/style-tokens.test.ts` и `lib/users-component.test.ts` перенацелена на `ui-unify`; блок users берётся от своего маркера до `users-tab:end`.
- **Остальные семейства (Task 2, `f420209`):** плашки (одиннадцать селекторов + три счётчика, `padding 4px 8px` / `0 8px; min-width: 24px`, роль `radius-plaque`, 11px 700, `.09em`, nowrap), поля (одиннадцать однострочных, 40px, `8px 16px`, `radius-field`, `max-width: var(--field-max)` у `.editor-field input/select`, 44px на ≤900px), вкладки (пять, 40px/44px, `0 16px`, `radius-tab`, линия `inset 0 -3px 0 var(--teal)` у текущей на любой ширине, линия ошибки `data-save-error` 2px `var(--danger)` объявлена после неё и с большей специфичностью), строки списков (`radius-card`, `8px 16px`, заголовок 13px 700, подпись 11px, зазор `.editor-record-list` 8px).
- **Аудит растягивания (D-02):** убраны `width: 100%` у `.archive-document-bar button` (телефон), `.promotion-action` (≤520px), `.promotion-preview li button`; `flex: 1…` у `.format-choice-row > button`, `.content-control-actions button, a` (≤900px), `.promotion-preview-actions > button`, `.promotion-device-reset button`, `.promotion-bank-workflow-tabs button`; `flex-basis: 100%` у `.users-pending-head button` (телефон). Тест проверяет оба файла стилей и называет исключение A3 поимённо: `.users-action-dialog-body .portia-dialog-actions button` и `.users-action-dialog-body .users-row-actions button` (диалог не шире 420px).
- **Исправления на месте из-за специфичности:** `.promotion-request-actions button, .promotion-bank-editor button, .promotion-preview button` — `padding 0 16px` (было 12); в `app/portia-promotion-editor.css` базовые `min-height`/`padding` вкладок банка, `min-height`/`padding` поля заголовка списка вопросов и их телефонные 44px (иначе поздний файл перебивал блок и на телефоне цель касания падала до 40px).

## TDD

План типа `execute`, задачи с `tdd="true"`; по тексту плана — один коммит на задачу, RED и GREEN в одном коммите.

- **Task 1 RED:** после написания тестов 7 из 27 упали (нет блока, нет роли `radius-control` у `.primary-control`, нет перенацеливания users) — запуск до правки CSS. GREEN: блок + правка `.promotion-action`; затем два теста `users-component` (читали блок до конца файла) перенацелены на `usersBlock()`.
- **Task 2 RED:** 8 новых проверок упали до правки CSS (плашки, поля, вкладки, ошибка вкладки, строки, растягивание, роли). GREEN — блок и правки на месте. Третий красный шаг (`.promotion-question-list-heading input`: телефонная высота) поймал настоящий дефект каскада и исправлен до коммита.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Шрифтовой шорткат из текста плана нарушал запрет менять шрифтовые семейства**
- **Found during:** Task 1
- **Issue:** действие плана предписывало `font: 700 11px var(--sans)` для семейства кнопок; у `.promotion-device-reset button` шрифт `--mono`, а must_haves запрещает менять шрифтовые семейства.
- **Fix:** вместо шортката заданы `font-size`, `font-weight`, `line-height`, `letter-spacing`; семейства остаются в правилах членов. Стрелка `.info-phone-back` оставлена 20px (глиф значка).
- **Files modified:** `app/portia.css`, `lib/ui-unify.test.ts`
- **Commit:** `3b44368`

**2. [Rule 1 - Bug] Поздний файл Promotion перебивал блок ui-unify**
- **Found during:** Task 2
- **Issue:** `app/portia-promotion-editor.css` подключается после `portia.css`; его правила `.promotion-bank-workflow-tabs button`, `.promotion-question-list-heading input` и `.promotion-preview-actions > button` с равной специфичностью побеждали блок (высота 44/40px, лишние `padding`/`flex`).
- **Fix:** правки на месте в том же файле, телефонные `min-height: var(--tap-target)`; тест читает оба файла в порядке подключения.
- **Files modified:** `app/portia-promotion-editor.css`
- **Commit:** `f420209`

**3. [Rule 3 - Blocking] `users-component` читал блок «до конца файла»**
- **Found during:** Task 1
- **Issue:** три теста брали `css.slice(lastIndexOf("/* users-tab:start"))`, что после добавления `ui-unify` захватывает `border-radius` блока ui-unify.
- **Fix:** общий помощник `usersBlock()` режет от начала до `users-tab:end`; проверки блока не ослаблены.
- **Files modified:** `lib/users-component.test.ts`
- **Commit:** `3b44368`

**4. [Rule 1 - Bug] `.users-pending-head button { flex-basis: 100% }` в блоке users-tab растягивал кнопку на телефоне**
- **Found during:** Task 2
- **Fix:** правило оставлено только для `h2`; блок остался без `border-radius`.
- **Files modified:** `app/portia.css`
- **Commit:** `f420209`

**Total deviations:** 4 auto-fixed (3 × Rule 1, 1 × Rule 3). **Impact:** без смены границ плана; палитра, семейства шрифтов и анимации не менялись, экран доступа и вход владельца не тронуты (шаг 4, план 26-09).

## Допущения, сообщаемые владельцу (флаги edge-probe UI-03)

UI-03 вернулся из edge-probe как unclassified; использованы допущения UI-SPEC, они не подтверждены владельцем:

- **A1:** единая бокс-модель семейств (отступы кнопок, плашек, полей, вкладок, строк) — часть «вида кнопок», а не смена отступов страниц.
- **A2:** поисковые чипы и метки типа результата — плашки-пилюли (`.search-recommendations button`, `.global-result-mark`).
- **A3:** стопка действий в контейнере уже 480px (диалог действий пользователя, до 420px) — не растяжение; кнопки там на телефоне заполняют диалог.
- **A9:** тексты вкладок 11px/700 (раньше 12px/600 у вкладок разделов), заголовки строк 13px (раньше 12px, у результатов поиска 15px), подписи 11px (у списка сотрудников раньше 10px).

## Для владельца

Что станет иначе на экранах (текстом, без галерей; в браузере и на устройствах не рендерилось — линии визуальной проверки BLOCKED, это суждение по коду):

- **Кнопки:** одной высоты 40px на ПК и 44px на телефоне, острые углы, отступ 16px по бокам; ширина всегда по надписи. Кнопка-стрелка «назад» в «Информации» на телефоне чуть шире (отступ 16px), стрелка прежнего размера. «Далее» в «Информации» — 11px вместо 13px.
- **Где кнопки перестали растягиваться:** окно базы вирусов (панель документа на телефоне), поиск и настройки (кнопки управления контентом на телефоне в окне редактора, ряд кнопок панели оформления текста), Promotion (кнопки «Действие» на узком экране, кнопки предпросмотра, кнопка сброса устройства, вкладки банка вопросов), кнопка массового одобрения во вкладке «Пользователи» на телефоне. Остались заполняющими только стопки кнопок в диалоге действий пользователя (до 420px).
- **Плашки:** метки, статусы и счётчики — пилюли с отступом 4px 8px, 11px жирным; значок типа результата поиска — пилюля 38×34 с рамкой цвета акцента; счётчики на вкладках Promotion получили рамку и минимальную ширину 24px; точки по-прежнему круглые.
- **Поля:** однострочные поля и выпадающие списки 40px (44px на телефоне), отступ 8px 16px, острые; в редакторе поле не шире 640px; окно поиска и строка поиска 40px и выше.
- **Вкладки:** 40px (44px на телефоне), отступ 16px; у текущей вкладки внизу линия 3px акцентного цвета на любой ширине; если во вкладке ошибка сохранения — красная линия 2px вместо акцентной.
- **Строки списков:** углы 7px, отступ 8px 16px, зазор между строками редактора 8px; заголовок 13px жирным, подпись 11px. Поля отступа у строк сотрудников и результатов поиска стали чуть другими (раньше 10–14px).

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts` — 2250 тестов, 2247 pass, 3 skipped, 0 fail (база 26-01: 2237/2234/3/0).
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок; ESLint по изменённым `.ts` — без ошибок.
- Acceptance Task 1: `ui-unify:start` — 1; `/* ui-unify:end */` — 1; последняя строка файла `/* ui-unify:end */`; `lastDeclaration` в тесте — 17.
- Acceptance Task 2: `inset 0 -3px 0 var(--teal)` — 1 строка; `var(--radius-plaque)` — 11; `var(--field-max)` — 1; `flex: 1 1 (140|150|160)px` в `app/portia-promotion-editor.css` — 0 (база: 3).
- Ни одна визуальная/e2e линия не запускалась и не записана как пройденная; `scripts/phase15-visual-manifest.mjs --verify` не запускался.
- Node 22.13.1 (эталон) на PATH; `npm`/`npx` не использовались.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности (только оформление и тесты). T-26-05: цвета вариантов не переопределяются (тест); T-26-06: на ≤900px высота 44px у кнопок, вкладок и полей (тест).

## Issues Encountered

- Лимит сессии прервал выполнение после Task 1; продолжено с сохранённых правок без потерь.
- Одна составная команда заблокирована хуком проекта; разбита на простые вызовы, обхода нет.
- Специфичность не моделируется хелпером `lastDeclaration`; конфликтующие правила с большей специфичностью (`.promotion-request-actions button`, поздний файл Promotion) найдены чтением и переписаны на месте. Остаются плотные исключения вне семейств: `.info-subsection-list .secondary-control { padding: 6px 10px }` (компактная кнопка в документе).

## Next Phase Readiness

Блок `ui-unify` — последний блок `app/portia.css`; следующие планы (окно, развёрнутый режим, раскладка вкладок) добавляют свои блоки перед ним или переносят тесты «последний блок» на себя в том же коммите. Экран доступа и вход владельца ждут шага 4 (26-09). Видимая оценка пилюль, линии 3px и строк 7px — за владельцем (D-10).

## Self-Check: PASSED

- Файлы: `lib/ui-unify.test.ts`, `app/portia.css`, `app/portia-promotion-editor.css`, `lib/style-tokens.test.ts`, `lib/users-component.test.ts` существуют.
- Коммиты `3b44368`, `f420209` достижимы из HEAD; `git rev-list --count 7d183e0..HEAD` = 2.
