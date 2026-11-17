---
phase: PORTIA-26-edinyy-stil-sayta
plan: 04
subsystem: ui
tags: [css, window-controls, corner-close, phone, guard-test]

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: блок ui-unify и каскадный хелпер lastDeclaration (26-03), роль radius-control (26-01)
provides:
  - крестик окна в самом правом верхнем углу на ПК и телефоне, кнопки управления 46x46 над рёбрами ресайза
  - общий класс .corner-close (44x44, top 0 / right 0) у карточки заявки, двух уведомлений, пикера цвета и панели оформления
  - lib/ui-unify.test.ts: проверки угла окна ПК/телефон, разметки контролов и пяти мест крестика (cornerCrossSites)
affects: [26-05, 26-06, 26-09, планы фазы 26, трогающие окно, уведомления, пикер цвета и панель оформления]

plan_head_before: 077a69d131820537cd808b6dcf5ef2e08256291c
plan_head_after: 8146fbecd9866a39bfcffb033d63d8169e68629c

actuals:
  tokens: 8300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "геометрия общего класса — в блоке ui-unify, его цвета — отдельным правилом вне блока (блок по контракту 26-03 цветов не задаёт)"
    - "конкурирующие правила кнопок с большей специфичностью перебиваются названными селекторами в том же списке (.custom-color-picker-head .corner-close, .floating-text-format > header .corner-close)"

key-files:
  created: []
  modified:
    - app/portia.css
    - lib/ui-unify.test.ts
    - lib/access-gate.test.ts
    - components/portia-access-gate.tsx
    - components/portia-desktop.tsx
    - components/custom-color-picker.tsx
    - components/portia-editor-rich-text.tsx

key-decisions:
  - "Цвета .corner-close (прозрачный фон, цвет текста, наведение #5d2d29) записаны вне блока ui-unify: контракт 26-03 запрещает в блоке цвета и hex; размеры и место — в блоке"
  - "Уведомление и плавающая панель оформления уже position: fixed — им не ставится relative (это сломало бы их), тест требует позиционированный слой; relative добавлен только пикеру цвета, карточка заявки была relative"
  - "Строка заголовка уведомления и пикера цвета прижата к верху слоя (padding-top: 0) и имеет высоту 44px, чтобы крестик 44px в углу не заходил на следующую строку (T-26-07)"
  - "У заблокированного окна (is-modal-locked, без кнопок) полоса сохраняет правый отступ 15px, чтобы название не упиралось в край"

requirements-completed: [UI-05]

coverage:
  - id: D1
    description: "Крестик окна в самом углу: полоса без правого отступа, контролы gap 0, position relative, z-index 10 > 9 у рёбер, кнопки 46x46, прозрачные, острые, левый разделитель 1px var(--line), глиф закрытия 18px, прежние цвета наведения"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-05: the window controls sit flush in the top-right corner of the title bar, 46x46, above the resize edges"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-22: на телефоне кнопки окна 46x46, без подложки ::before, без правого отступа, полоса 48px, «Развернуть» скрыта, наведение как на ПК"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-05 / D-22: on a phone the window controls are 46x46 too, flush in the corner, without a drawn frame"
        status: pass
    human_judgment: false
  - id: D3
    description: "Разметка контролов окна не менялась: три кнопки, «Закрыть» последней, у заблокированного окна кнопок нет (T-26-08)"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-05: the window markup keeps three controls with close last and none on a locked window"
        status: pass
      - kind: unit
        ref: "lib/window-open.test.ts#a locked qualification window cannot be dragged, resized, maximised, closed or minimised (STAB-DESK-03, T-18-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Общий .corner-close у пяти крестиков (заявка, два уведомления, пикер цвета, панель оформления), прежние классы и подписи сохранены, строки заголовков оставляют 44px"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-05: the shared corner cross is 44x44, flush in the corner, sharp, with a 20px glyph"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-05 / T-26-07: the cross is anchored to its layer and the heading row leaves it 44px"
        status: pass
      - kind: unit
        ref: "lib/ui-unify.test.ts#UI-05: the five crosses carry corner-close and keep their old classes and labels"
        status: pass
      - kind: unit
        ref: "lib/access-gate.test.ts#approved notice looks like the quest notice, never takes focus and closes on × or Escape outside inputs and dialogs (G-PORTIA-23-3-r2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Видимый результат (крестик в углу, отсутствие перекрытий, вид на телефоне) на экранах и устройствах не рендерился"
    requirement: UI-05
    verification: []
    human_judgment: true
    rationale: "Визуальные/e2e линии не запускались (BLOCKED (ENV)/(DATA)); ПК и телефон физически не проверялись — BLOCKED (DEVICE) до Phase 27; проверены только значения в исходниках"

duration: ~6 мин (от записи старта до последнего коммита задачи)
completed: 2026-11-16
status: complete
---

# Phase 26 Plan 04: Крестик закрытия в углу Summary

**Кнопки управления окна стали 46×46 вплотную к правому краю полосы (ПК и телефон, D-22) и выше рёбер ресайза, а пять крестиков слоёв (заявка, два уведомления, пикер цвета, панель оформления) получили общий класс `.corner-close` 44×44 в самом углу.**

## Performance

- **Tasks:** 2 из 2 (Task 1 — трассер окна, Task 2 — общий `.corner-close`)
- **Files modified:** 7 (`app/portia.css`, `lib/ui-unify.test.ts`, `lib/access-gate.test.ts`, четыре компонента); `components/portia-desktop-window.tsx` не менялся
- **Duration:** ~6 мин от записи старта (чтение контекста до этого не учтено)

## Accomplishments

- **Трассер (Task 1, `2623cc0`):** в блоке ui-unify — `.window-titlebar { padding-right: 0 }`, `.window-controls { position: relative; z-index: 10; align-self: stretch; align-items: flex-start; gap: 0 }`, `.window-controls button { 46×46; border: 0; border-left: 1px solid var(--line); border-radius: var(--radius-control) }`, глиф закрытия 18px. Базовое правило кнопок на месте стало прозрачным (без прежней рамки и фона 28×28). Телефон: из позднего блока 20-07 сняты кнопки 44×44 с подложкой `::before` (`inset: 7px`) и её hover-правила; из раннего блока — кнопки 30px и правый отступ 11px (теперь `padding: 0 0 0 11px`); полоса 48px и скрытие «Развернуть» сохранены. Наведение на телефоне теперь то же, что на ПК (нейтральное `oklch(.31 …)`, у крестика `#5d2d29` с рамкой `#a65750`).
- **Общий крестик (Task 2, `8146fbe`):** `.corner-close` (и названные `.custom-color-picker-head .corner-close`, `.floating-text-format > header .corner-close`) — `position: absolute; top: 0; right: 0`, 44×44, без рамки, острый, глиф 20px; цвета вне блока: прозрачный фон, `color: inherit`, наведение `#5d2d29`. Строки `.quest-toast-head`, `.custom-color-picker-head`, `.floating-text-format > header` — высота от 44px и `padding-right: 44px`. `className` добавлен пяти кнопкам: `access-close corner-close`, `quest-toast-close corner-close` (×3), `corner-close` у пикера и панели оформления. Сетка заголовка панели оформления потеряла пустую колонку ушедшего в угол крестика (ПК, телефон, свёрнутая, ≤430px).

## TDD

План типа `execute`, задачи с `tdd="true"`; RED и GREEN в одном коммите на задачу (как в 26-03).

- **Task 1 RED:** 2 из 15 тестов `ui-unify` упали до правки CSS (полоса с отступом, телефон 44px); проверка разметки контролов — охранная, прошла сразу. GREEN после правки; одна проверка (порядок `border` и `border-left` в одном правиле) уточнена до коммита.
- **Task 2 RED:** 3 новых теста упали (геометрия, якорь слоя, className). GREEN — CSS и className; упал закреплённый `access-gate.test.ts` (точная строка className) — обновлён.
- **Tracer gate:** `<verify>` трассера перезапущен после коммита — 119/119, 0 fail; расширение продолжено.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `position: relative` для `.quest-toast` и `.floating-text-format` сломал бы их**
- **Found during:** Task 2
- **Issue:** план требует `position: relative` у четырёх родителей, но уведомление и панель оформления — `position: fixed`; relative вырвал бы их из угла экрана.
- **Fix:** relative добавлен только `.custom-color-picker`; `.access-card` уже relative; тест требует позиционированный слой (relative/fixed/absolute) для всех четырёх на ПК и телефоне.
- **Files modified:** `app/portia.css`, `lib/ui-unify.test.ts`
- **Commit:** `8146fbe`

**2. [Rule 1 - Bug] Цвета в блоке ui-unify нарушали контракт 26-03**
- **Found during:** Task 1 и Task 2
- **Issue:** план ставит `background: transparent` и опасное наведение в блок ui-unify, а тест 26-03 запрещает в блоке `color`/`background` и hex.
- **Fix:** у кнопок окна `background: transparent` записан на месте в базовом правиле; цвета `.corner-close` — отдельным правилом после группы уведомлений. Контракт блока не ослаблен.
- **Files modified:** `app/portia.css`
- **Commits:** `2623cc0`, `8146fbe`

**3. [Rule 1 - Bug] Специфичность заголовков перебивала общий крестик**
- **Found during:** Task 2
- **Issue:** `.custom-color-picker-head button` (0,1,1) и `.floating-text-format > header button` (0,1,2) сильнее `.corner-close` (0,1,0) — крестик остался бы 24/28px с рамкой.
- **Fix:** селекторы с подъёмом специфичности в том же списке правила; тест проверяет их и то, что конкурирующие правила действительно есть.
- **Files modified:** `app/portia.css`, `lib/ui-unify.test.ts`
- **Commit:** `8146fbe`

**4. [Rule 2 - Missing critical] Крестик 44px перекрывал соседнюю строку (T-26-07)**
- **Found during:** Task 2
- **Issue:** заголовки пикера (~24px) и уведомления (после ухода крестика ~15px) ниже 44px; крестик в углу заходил бы на палитру и на заголовок квеста.
- **Fix:** строки заголовков от 44px; у уведомления и пикера верхний отступ слоя 0, так что строка 44px совпадает с крестиком 44px; сетка заголовка панели оформления без пустой колонки.
- **Files modified:** `app/portia.css`
- **Commit:** `8146fbe`

**5. [Rule 3 - Blocking] `lib/access-gate.test.ts` закреплял точный className**
- **Found during:** Task 2
- **Fix:** строка `'className="quest-toast-close"'` → `'className="quest-toast-close corner-close"'`; прежний класс остаётся в проверке. Файла не было в списке плана.
- **Commit:** `8146fbe`

**6. [Rule 2 - Missing critical] Правый отступ заблокированного окна**
- **Found during:** Task 1
- **Issue:** у `is-modal-locked` кнопок нет, и без правого отступа название упиралось бы в край полосы.
- **Fix:** `.app-window.is-modal-locked .window-titlebar { padding-right: 15px }` (прежнее значение).
- **Commit:** `2623cc0`

**Total deviations:** 6 auto-fixed (3 × Rule 1, 2 × Rule 2, 1 × Rule 3). **Impact:** без выхода за границы плана; палитра, шрифты, анимации и разметка окна не менялись.

## Допущения, сообщаемые владельцу (флаги edge-probe UI-05)

UI-05 вернулся из edge-probe как unclassified / unresolved; использованы допущения, которые владелец не подтверждал:

- **A10:** кнопки окна 46×46 — это высота полосы ПК; записано как исключение из правила «не меньше 44px», а не смена геометрии полосы.
- **D-22:** на телефоне кнопки тоже 46×46 в полосе 48px, крестик прижат к верхнему краю (снизу остаются 2px полосы).
- Угол ресайза NE (правый верхний) теперь под кнопками и не работает; рёбра N и E по-прежнему меняют размер.

## Для владельца

Что станет иначе на экранах (текстом; в браузере и на устройствах не рендерилось — суждение по коду):

- **Окна приложений (ПК):** три кнопки «свернуть / развернуть / закрыть» стоят вплотную друг к другу и к правому краю, каждая 46×46 — на всю высоту полосы заголовка. Квадратных рамок вокруг кнопок больше нет, между ними тонкая вертикальная линия. Крестик — в самом правом верхнем углу окна; он чуть крупнее (18px). При наведении: на «свернуть/развернуть» — прежняя подсветка, на крестик — прежний тёмно-красный фон. Правый верхний угол окна больше не тянется для изменения размера (верхний и правый края тянутся как раньше).
- **Окна на телефоне (D-22):** кнопки тоже 46×46 и прижаты к правому верхнему углу, без нарисованной рамки внутри (раньше 44×44 с маленьким квадратом 30px посередине); «Развернуть» на телефоне по-прежнему нет. Высота полосы 48px не менялась.
- **Карточка заявки:** крестик переехал из точки «12px от угла» в самый угол карточки, глиф стал меньше (20px вместо 28px).
- **Уведомления (новый квест, повторная проверка, «Доступ подтверждён»):** крестик в самом углу уведомления; строка с надписью «НОВЫЙ КВЕСТ» и т. п. стала на одной высоте с крестиком, текст уведомления поднялся примерно на 10px.
- **Пикер цвета:** крестик 44×44 в углу вместо маленькой кнопки 24×24 в рамке; заголовок пикера стал выше (44px), пикер — примерно на 11px выше.
- **Панель оформления текста:** крестик 44×44 в правом верхнем углу панели без рамки; остальные кнопки заголовка («СБРОСИТЬ», кнопка свернуть/развернуть на телефоне) не менялись.

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts` — 2256 тестов, 2253 pass, 3 skipped, 0 fail (база 26-03: 2250/2247/3/0).
- `<verify>` Task 1 (`ui-unify`, `window-open`, `style-tokens`, `portia-desktop`) — 119/119; `<verify>` Task 2 (шесть файлов) — 150/150.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок; ESLint по изменённым файлам — 0 ошибок (6 прежних предупреждений в `portia-desktop.tsx`, не в изменённых строках).
- Acceptance Task 1: `\.window-controls button[^{]*\{[^}]*width:\s*46px` — 1; `z-index: 10` — 4; `git diff --stat HEAD -- components/portia-desktop-window.tsx` — пусто.
- Acceptance Task 2: `corner-close` — 2 / 2 / 1 / 1 в четырёх компонентах (база 0); `\.corner-close` в `app/portia.css` — 4.
- Визуальные и e2e линии не запускались и не записаны как пройденные; ПК и телефон физически — BLOCKED (DEVICE) до Phase 27; `scripts/phase15-visual-manifest.mjs --verify` не запускался.
- Node 22.13.1 (эталон) на PATH; `npm`/`npx` не использовались.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности. T-26-07: строки заголовков резервируют 44px, контролы окна выше рёбер (`z-index: 10` > 9) — проверено тестами. T-26-08: разметка `{!locked && <div className="window-controls">` не менялась — проверено `window-open` и `ui-unify`.

## Issues Encountered

- Карточка заявки (`.access-card`) по контракту 26-03 не может упоминаться в блоке ui-unify (её перерисовывает 26-09); крестик там стоит на уже имевшемся `position: relative`, а строка заголовка карточки отдельно не сдвигалась — крестик теперь закрывает меньше места, чем раньше (0–44px вместо 12–56px).

## Next Phase Readiness

Блок ui-unify остаётся последним в `app/portia.css`. 26-09 при перерисовке карточки заявки сохраняет `corner-close` у её крестика. Видимая оценка угла и размеров — за владельцем; физическая проверка — Phase 27.

## Self-Check: PASSED

- Файлы: `app/portia.css`, `lib/ui-unify.test.ts`, `lib/access-gate.test.ts`, `components/portia-access-gate.tsx`, `components/portia-desktop.tsx`, `components/custom-color-picker.tsx`, `components/portia-editor-rich-text.tsx` существуют.
- Коммиты `2623cc0`, `8146fbe` достижимы из HEAD; `git rev-list --count 077a69d..HEAD` = 2.
