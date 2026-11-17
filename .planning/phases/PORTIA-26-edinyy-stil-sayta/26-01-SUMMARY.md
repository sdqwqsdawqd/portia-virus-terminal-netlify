---
phase: PORTIA-26-edinyy-stil-sayta
plan: 01
subsystem: ui
tags: [css, design-tokens, border-radius, guard-test, playwright]

requires:
  - phase: PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya
    provides: направление C (22-STYLE-DIRECTION.md), каркас токенов style-tokens:start/end
provides:
  - роли радиуса направления C в первом :root (window/dialog/card/control/field/tab/plaque/round) и размеры общих семейств
  - все радиусы трёх таблиц стилей читают роли; грамматическая охрана с файлом и строкой
  - исключения D-18 перечислены поимённо
  - визуальная линия v1.3 переведена в историю (D-17)
affects: [26-02, 26-03, 26-04, 26-05, все дальнейшие планы фазы 26]

plan_head_before: 312033d6bb2a863c4cf7ccc2fe6e6750f5c792e6
plan_head_after: 4b4edbabeb7d62343754558cee93086b3635de35

actuals:
  tokens: 20200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "единственный источник радиусов — токены ролей в первом :root; правило читает var(--radius-<роль>)"
    - "охрана по грамматике (роль | 0 | композиция ролей), а не по закреплённому счётчику/хешу"

key-files:
  created: []
  modified:
    - app/portia.css
    - app/portia-promotion-editor.css
    - lib/style-tokens.test.ts
    - playwright.config.ts
    - lib/e2e-visual-policy.test.ts

key-decisions:
  - "Роль выбирается по назначению элемента, а не по старому значению (UI-SPEC «Assignment rule»)"
  - "Хеш PRE_PHASE_PORTIA_CSS_SHA256 и счётчик 131/6 упразднены в одном коммите с появлением грамматики (перескоуп охраны, не отключение)"
  - "Снимки v1.3 по умолчанию не обнаруживаются Playwright; явный путь tests/e2e/visual остаётся историческим сравнением (D-17)"

patterns-established:
  - "Новый радиус нельзя добавить молча: lib/style-tokens.test.ts падает с «файл:строка border-radius: значение»"

requirements-completed: [UI-02]

coverage:
  - id: D1
    description: "Токены ролей направления C в первом :root (13 имён, значения таблицы C), три правила читают токены"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "lib/style-tokens.test.ts#UI-02: role tokens hold direction C values and the three tracer consumers read them"
        status: pass
    human_judgment: false
  - id: D2
    description: "Все border-radius в portia.css, portia-promotion-editor.css, globals.css — роль, 0 или композиция; единственный !important у select; исключения D-18; селекторы экспорта level-1..3"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "lib/style-tokens.test.ts#UI-02: every border-radius is a role token, 0 or a composition of them"
        status: pass
      - kind: unit
        ref: "lib/style-tokens.test.ts#UI-02: swatches are round and setting options use the card role (D-18)"
        status: pass
      - kind: unit
        ref: "lib/style-tokens.test.ts#UI-02: the Promotion template export keeps its level classes apart from access-level ones"
        status: pass
    human_judgment: false
  - id: D3
    description: "Визуальная линия v1.3 по умолчанию не обнаруживается Playwright; явный путь — историческое сравнение"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "lib/e2e-visual-policy.test.ts#v1.3 visual line is history (D-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Роли спорных элементов (таскбар, «Пуск», «ОФОРМЛЕНИЕ», зум документа, строки меню «Пуск») выбраны по правилу назначения — видимый вид решает владелец"
    requirement: UI-02
    verification: []
    human_judgment: true
    rationale: "Внешний вид углов на экранах не рендерился (линии визуальной проверки BLOCKED без устройства/данных); суждение о том, нравится ли острая кнопка таскбара, принадлежит владельцу (D-10)"

duration: 5min
completed: 2026-11-16
status: complete
---

# Phase 26 Plan 01: Единое правило углов Summary

**Токены ролей радиуса направления C стали единственным источником углов во всех трёх таблицах стилей (132 объявления переписаны), охрана перешла со счётчика и хеша на грамматику с «файл:строка», а снимки v1.3 переведены в историю.**

## Performance

- **Duration:** около 5 мин
- **Started:** 2026-11-16T06:23:51Z
- **Completed:** 2026-11-16T06:29Z
- **Tasks:** 3 из 3
- **Files modified:** 5 (`app/portia.css`, `app/portia-promotion-editor.css`, `lib/style-tokens.test.ts`, `playwright.config.ts`, `lib/e2e-visual-policy.test.ts`)

## Accomplishments

- **Трассер (Task 1, `6f92372`):** в первом `:root` между маркерами `style-tokens` объявлены ровно 13 токенов в заданном порядке (`--radius-window/dialog/card/control/field/tab/plaque/round`, `--tap-target`, `--control-height`, `--control-height-compact`, `--field-max`, `--card-min`); числовые примитивы радиуса и примитив-пилюля удалены. `.app-window`, `.portia-dialog`, `.editor-field input` читают роль. Тест проверяет значения ролей и потребителей; сквозной прогон — 2229 тестов, 0 fail, tsc чисто.
- **Все радиусы через роли (Task 2, `f1a0a4a`):** 132 значения `border-radius` в `app/portia.css` (128 строк с `var(--radius-` вместе с тремя из трассера) и 6 в `app/portia-promotion-editor.css`; остались только `0` у `.taskbar-app.active::after` и `.skeleton-fill` и `0 !important` у `.classification-select-wrap select`. Составные значения: пузырь ассистента `dialog dialog 0 dialog`, телефонная плавающая панель `dialog dialog 0 0`.
- **Охрана (Task 2):** тест «grammar» проверяет каждое объявление (комментарии заменяются пробелами, поэтому строка в сообщении верна), ровно один `!important` у радиуса, исключения D-18 (`.swatch` — round, `.setting-options > button` — card), селекторы экспорта `.class-cell.level-1..3` и `.classification-select-wrap.level-2/.level-3` рядом с `.access-level-*`; `stripMarkedBlocks` понимает маркер `ui-unify`.
- **D-17 (Task 3, `4b4edba`):** `testIgnore` по умолчанию содержит и `**/visual-candidates/**`, и `**/visual/**`; флаг `visualHistoryRequested` распознаёт `tests/e2e/visual` как отдельную папку (префикс `visual-candidates` его не включает). Скрипт `test:e2e:visual` по-прежнему передаёт `tests/e2e/visual`.

## TDD

План типа `execute`, задачи с `tdd="true"`; по тексту плана каждая задача — один коммит, поэтому отдельных `test(...)`-коммитов нет, RED и GREEN лежат в одном коммите задачи.

- **Task 1 RED:** сначала переписан тест; запуск показал `not ok` на «role tokens hold direction C values…» и «role tokens are read by the stylesheet…» (assertion-провалы по запланированному поведению, 3 прочих теста файла зелёные). Затем GREEN — правка CSS.
- **Task 2 RED:** на момент написания грамматики CSS уже был переписан скриптом; падение проверено обратным способом — регулярное выражение `GRAMMAR` проверено вручную: отвергает `7px`, `var(--radius-card) 5px`, `var(--radius-pill)`, `50%`, принимает роль, `0` и композиции. Честно: красного прогона самого теста против старого CSS не было.
- **Task 3 RED:** три из четырёх новых тестов упали до правки `playwright.config.ts` (четвёртый — про `package.json` — зелёный и должен оставаться зелёным); после правки 63 теста политики и манифеста зелёные.

## Deviations from Plan

### Auto-fixed Issues

Нет отклонений по правилам 1-4. Замечания по исполнению:

- Compound-команда с коммитом один раз заблокирована хук-стражем проекта (`guard.mjs`); не обходил, разбил на простые вызовы — коммит прошёл с теми же файлами и сообщением.
- Первая вставка теста через шаблонную строку Node испортила экранирование регулярных выражений; исправлено вручную до коммита (линтер и тест зелёные).

**Total deviations:** 0.

## Решения по спорным ролям

Правило назначения применено по UI-SPEC и 26-RESEARCH; места, где суждение не однозначно:

- `.start-button`, `.taskbar-app`, `.global-format-launch > button` («ОФОРМЛЕНИЕ»), `.document-app-external` — control (действие → острые).
- `.document-app-zoom` — control: это группа кнопок «+/−», а не плавающий слой; рамка группы становится острой.
- `.start-panel > button, .start-panel-link` и `.mini-app-icon`, `.start-panel-icon` — card (строки меню и значки как у списков; по 26-RESEARCH); сама панель `.start-panel` — window.
- `.promotion-flow-icon` базовый — card (9px → 7px); вариант `.promotion-qualification-card .promotion-flow-icon` — round, как и было. План относил `.promotion-flow-icon` к round целиком; взято различие из 26-RESEARCH (круглым был только вариант квалификации).
- `.custom-hue input` (дорожка ползунка) — plaque (пилюля), её бегунок `::-webkit-slider-thumb` — control; `.custom-color-value > i` — card; `.format-control-title > b > i` — control.
- `.editor-save-chip > button` — control (чип уйдёт позже в плане редактора), `.editor-save-popover` — dialog.
- `.promotion-gate form` и `.promotion-confirm`/`.template-confirm` — form как card, подтверждения как dialog; строки выбора ответа (`.promotion-question fieldset label`, `.promotion-answer-options label`, `.promotion-manual-pool label`) — card.

## Для владельца

Что станет иначе на экранах (текстом, без галерей; на устройствах и в браузере не рендерилось — линии визуальной проверки BLOCKED, это суждение по коду):

- Диалоги (`portia-dialog`, подтверждения Promotion и шаблона, карточка доступа, пузырь ассистента, панель оформления) — углы 10px вместо 7px.
- Окна, ярлыки рабочего стола и меню «Пуск» — единые 10px; ярлык-иконка 14px → 10px; на телефоне окно 7px → 10px.
- Поля ввода (общие поля редактора, поиск, поля Promotion, поле «Классификация», ввод цвета) — острые углы вместо 3-6px.
- Плашки и метки (рекомендации поиска, отметки результатов, шаги Promotion, счётчики на вкладках Promotion, ярлык ассистента) — пилюля; бегунок полосы прокрутки — пилюля.
- Кнопки действий — острые: кнопки управления окном, «Пуск», кнопки таскбара (раньше 10px), «ОФОРМЛЕНИЕ» (раньше пилюля), кнопки панели оформления, «Далее», кнопки Promotion, кнопки зума документа. Если острая кнопка таскбара или «ОФОРМЛЕНИЕ» не нравится — это одна строка в одном селекторе.
- Образцы цвета `.swatch` — круглые; выбор паутины/обоев и прочие `.setting-options > button` — 7px (исключения D-18).
- Вкладки (разделы редактора, ветки и фильтры Promotion, вкладки банка вопросов) — острые.
- Контейнеры с содержимым (результаты, списки, аватары, превью, карточки Promotion, зоны загрузки) — единые 7px вместо разброса 4-10px.
- Снимки v1.3 больше не текущий эталон: обычный прогон Playwright их не запускает; явный запуск по пути `tests/e2e/visual` — только историческое сравнение, красный результат там — ожидаемый дрейф, не PASS.

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts` — 2237 тестов, 2234 pass, 3 skipped, 0 fail (базовая линия 2229/2226/3/0; новые тесты — грамматика, исключения, экспорт, ui-unify, D-17).
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок; ESLint по изменённым `.ts` — чисто (вызов `node node_modules/eslint/bin/eslint.js`, т.к. `npx` в портативной Node ломается).
- Node 22.13.1 (эталон) оказалась на PATH, подмены на системную Node 24 не было.
- Acceptance criteria: `--radius-card: 7px`, `--radius-dialog: 10px`, `var(--radius-window|dialog|field)` в portia.css — по 1+; `PRE_PHASE_PORTIA_CSS_SHA256` — 0; `var(--radius-` в portia.css — 128 (≥120), в promotion-editor — 6 (≥6); `GRAMMAR` — 2, `PORTIA_RADIUS_DECLARATIONS` — 0; `.swatch … var(--radius-round)` — 1; `visual/**` — 1, `D-17` — 1, `visualHistoryRequested` — 2.
- Граница фазы: дифф в CSS — только значения `border-radius` и блок токенов (проверено по diff, 132 замены = 132 удаления; `lib/accent-theme.test.ts` зелёный).
- Ни одна визуальная/e2e линия не запускалась и не записана как пройденная; `scripts/phase15-visual-manifest.mjs --verify` не запускался; снимки, подписи и скрипт манифеста не тронуты.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности (только оформление и конфигурация тестов).

## Issues Encountered

Нет. Единственный кандидат во «внимание»: `npm`/`npx` из портативной Node 22.13.1 не работает (известно из 26-RESEARCH, Pitfall 9) — использованы прямые вызовы `node`.

## Next Phase Readiness

Токены ролей и размеры (`--control-height`, `--control-height-compact`, `--field-max`, `--card-min`) объявлены и готовы к чтению в 26-03; охрана принимает блок `/* ui-unify:start */ … /* ui-unify:end */`. Сами размерные токены пока нигде не читаются (так и задумано: потребители — 26-03/26-05).

## Self-Check: PASSED

- Файлы: `app/portia.css`, `app/portia-promotion-editor.css`, `lib/style-tokens.test.ts`, `playwright.config.ts`, `lib/e2e-visual-policy.test.ts` существуют.
- Коммиты `6f92372`, `f1a0a4a`, `4b4edba` достижимы из HEAD; `git rev-list --count 312033d..HEAD` = 3.
