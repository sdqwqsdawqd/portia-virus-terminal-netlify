---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 42
subsystem: ui
tags: [wallpaper, flasks, animation, clock, flame, playwright, d-54]

requires:
  - phase: PORTIA-20
    provides: "20-36 (фон «Лабораторные колбы», 12 сосудов, бюджет 96), 20-37 (вердикт владельца D-54), 20-41 (паук; поправка спека не затронута)"
provides:
  - "Мерцающее пламя: горелка, спиртовка на столе и новая спиртовка на полке, у каждой внешний слой и ядро со своим неровным циклом (1.1-2.3 s, opacity и scale от основания)"
  - "Переливы 14 сосудов задней полки: наклон и смена яркости жидкости, таблица циклов shelfCycles (5.4-10.6 s, пары различны, первые пики разнесены не меньше чем на 380 ms)"
  - "Тикающие часы: секундная стрелка 60 s шагами steps(60, end), минутная 3600 s, обе вокруг центра циферблата, покоящиеся углы в Уменьшены/Выключены"
  - "Плотнее: таблица элементов, столбчатая диаграмма, манометр, бюретка, доска с инструментами, осциллограф, планки на дверцах шкафа; пустых клеток 48 px на PC 78 -> 35"
  - "Спек: тесты D-54 (пламя, часы, полка, покрытие, бюджет, контраст в пик на трёх акцентах), предел анимаций 140 и 80 для phone"
affects: [20-47, 20-14]

actuals:
  tokens: 15100
  tasks: 2
  commits: 4
plan_head_before: 204d7e7437c5d6eda7b07d1a3237d9f035906c62
plan_head_after: 4f7237605bd7a4aa746572471322cb02d3549af4
commits: 4
flask_fix_commit: 859a493fb295cd6a7a879b0f0ae12b25efeac45f

tech-stack:
  added: []
  patterns:
    - "Покоящееся значение в базовом правиле элемента, анимация только под html[data-motion=full]: в reduced/off работает общий animation: none для .desktop-wallpaper *"
    - "Поворот стрелок вокруг центра через transform-origin: var(--clock-x) var(--clock-y), углы покоя в CSS, keyframes только transform"
    - "Измерение пика: каждая анимация рисунка ставится на время своего максимума opacity, время приводится в пределы одного цикла (отрицательное currentTime браузер не принимает)"

key-files:
  created: []
  modified:
    - components/portia-wallpaper.tsx
    - app/portia.css
    - tests/e2e/visual-candidates/phase20-art.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
    - .planning/todos/pending/2026-11-06-flasks-wallpaper-redo.md

key-decisions:
  - "D-54: предел бесконечных анимаций в рисунке 100 -> 140 (на phone отдельно 80 с отображаемой целью); не слияние переливов в общие группы"
  - "Часы стоят под полкой справа (x 1258, y 414), а не над ней: рисунок остаётся 55.8% высоты экрана (предел 62%), телефон видит циферблат целиком"
  - "Третье пламя - спиртовка на полке (x 1102) вместо пустой банки: её видит телефон; сосуды полки без жидкости не появляются, жидкостей по-прежнему 14"
  - "Двенадцать анимированных сосудов, их циклы, FLASK_COUNT, PHONE_FLASKS и wantedCycles не менялись"

requirements-completed: [STAB-VIS-02, STAB-A11Y-04]

coverage:
  - id: D1
    description: "Пламя горелки и двух спиртовок мерцает: у внешнего слоя и ядра по одной бесконечной анимации, неровный цикл (9 и 7 keyframes), длительности всех шести слоёв различны, только opacity и transform"
    requirement: STAB-VIS-02
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts#D-54 the flame flickers, chromium-desktop и chromium-phone"
        status: pass
    human_judgment: true
    rationale: "Похоже ли мерцание на живой огонь, решает владелец по пересъёмке 20-47; тест доказывает наличие и независимость циклов"
  - id: D2
    description: "Сосуды задней полки движутся: 14 сосудов с жидкостью, у каждого один перелив со своей длительностью и фазой по таблице, первые пики разнесены больше чем на 300 ms"
    requirement: STAB-VIS-02
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts#D-54 the shelf vessels move, chromium-desktop и chromium-phone"
        status: pass
    human_judgment: true
    rationale: "Заметность и красота перелива оценивает владелец; длительности отложены владельцем до 20-14 (q-flasks-durations)"
  - id: D3
    description: "Часы тикают: секундная стрелка 60 s и steps(60, end) (шаг 6 градусов, нет ползучести между ударами), минутная 3600 s, обе вращаются вокруг центра циферблата; на phone циферблат целиком в кадре"
    requirement: STAB-VIS-02
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts#D-54 the clock ticks, chromium-desktop и chromium-phone"
        status: pass
    human_judgment: false
  - id: D4
    description: "Меньше пустого места: пустых клеток 48 px на PC 35 против 78 на HEAD (0.449, предел 0.6), высота рисунка 0.558 экрана (предел 0.62)"
    requirement: STAB-VIS-02
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts#D-54 coverage, chromium-desktop (flasks-coverage-chromium-desktop.json)"
        status: pass
    human_judgment: true
    rationale: "Плотность по порогу клеток доказана числом, хватит ли «лишнего пространства» владельцу, решает он"
  - id: D5
    description: "Подпись ярлыка читается над любой частью рисунка в покое и в пик всех анимаций, на трёх акцентах, PC и phone, не ниже 4.5:1"
    requirement: STAB-A11Y-04
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts#D-51 the flasks on the ... label contrast (6 файлов) и D-54 peak (6 файлов)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Режимы движения прежние: в Уменьшены и Выключены ни одной анимации в рисунке, законченный кадр; Выключены посреди цикла останавливает сразу; системный prefers-reduced-motion не переключает; в keyframes рисунка только opacity и transform; бюджет 140 на PC и 80 на phone"
    requirement: STAB-A11Y-04
    verification:
      - kind: e2e
        ref: "phase20-art.spec.ts#D-02, D-01, D-03/D-04, D-54 budget; accessibility.spec.ts#full -> off in the middle of an animation и off and reduced leave no looping UI motion"
        status: pass
    human_judgment: false

duration: 25 min
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 42: фон «Лабораторные колбы» по D-54 Summary

**Пламя горелки и двух спиртовок мерцает двумя слоями на своих неровных циклах, 14 сосудов задней полки переливаются каждый на своём цикле, настенные часы тикают (секундная стрелка 60 шагов в минуту), сцена плотнее (пустых клеток 48 px на PC 35 вместо 78, высота 55.8% экрана), предел анимаций пересмотрен до 140 (phone 80), подписи читаются и в пик (не ниже 4.74).**

## Performance

- **Duration:** 25 min
- **Started:** 2026-11-07T07:13:40Z
- **Completed:** 2026-11-07T07:39:06Z
- **Tasks:** 2 (Task 1 типа tracer)
- **Files modified:** 5 (3 продуктовых и спек, UI-SPEC, задача)
- **PLAN_BASE:** `204d7e7437c5d6eda7b07d1a3237d9f035906c62` (HEAD перед Task 1; «HEAD» плана для замеров пустых клеток - рисунок 33552db, он не менялся до 20-42)

## Замер на HEAD (до правок рисунка)

| величина | PC (chromium-desktop) | phone (chromium-phone) |
|---|---|---|
| пустых клеток 48 px, «Выключены» (порог 0.01 относительной яркости над медианой тёмных 10%) | **78 из 330** | **25 из 90** |
| высота рисунка / высота экрана | 0.558 (270-772 px при 900) | 0.558 |
| контраст в пик (замер `flasks-contrast-peak-*`, см. оговорку ниже) | 4.99-5.08 | 10.17-10.64 |
| бесконечных анимаций в рисунке | 96 | 96 (33 с отображаемой целью) |

Оговорка: этот первый замер «в пик» шёл с переходом на время `delay + доля × длительность`; браузер не принимает отрицательное `currentTime`, поэтому у части колб (задержка длиннее времени пика) анимация стояла не в своём пике. После исправления спека (время приводится в пределы одного цикла) числа текущего рисунка 4.74-5.08 на PC, что согласуется с худшим случаем 20-36 (4.74-5.02). Отдельно «пик на HEAD» с исправленным замером не снимался: сборка HEAD уже заменена; число на HEAD в SUMMARY приведено как есть, с этой оговоркой, и ни на какой вывод не опирается.

## RED

Отдельный коммит `313f43fb4c79c63e4101690f01cfb8af022cc25f` (test): на неизменённом рисунке прогон `--grep "D-54"` на chromium-desktop дал **4 падения** - `D-54 coverage` (78 клеток против предела 46), `D-54 the flame` (нет `.wallpaper-flask-flame` в числе 3 и ядер), `D-54 the clock` (нет анимации секундной стрелки), `D-54 the shelf vessels` (14 жидкостей, анимаций 0) - и 4 прохода (`D-54 budget` и три `peak`, оговорка выше). Прежний предел 100 в этом коммите заменён на 140 и добавлен предел phone 80.

## Accomplishments

- **Пламя:** три источника - горелка и спиртовка на столе (x 395 и 948) и новая спиртовка на полке (x 1102, её видит телефон; заняла место пустой банки без жидкости). У каждого внешний слой (`.wallpaper-flask-flame`) и ядро (`.wallpaper-flask-flame-core`) со своим циклом: 1700/1100, 2300/1300, 1900/1500 ms; keyframes `flask-flicker` (9 кадров, opacity не выше прежних .4, scale и skewX от основания) и `flask-flicker-core` (7 кадров).
- **Полка:** `.wallpaper-flask-scene-liquid` стал широким прямоугольником внутри группы с клипом, анимация `flask-shelf` (opacity .6-1, поворот ±6 градусов и сдвиг ±1.5 px вокруг поверхности); таблица `shelfCycles` из 14 строк в компоненте и `SHELF_CYCLES` в спеке.
- **Часы:** циферблат r 24 в (1258, 414) под полкой, 12 меток, неподвижная часовая, минутная (`flask-clock-minute`, 3600 s, linear) и секундная (`flask-clock-second`, 60 s, `steps(60, end)`) со стартовыми углами 60 и 210 градусов в CSS; прежние часы слева заменены термометром.
- **Плотнее:** таблица элементов (x 508-808), столбчатая диаграмма (868-994), манометр (1112, 424; виден телефону), бюретка на стойке, доска с инструментами, осциллограф, по восемь планок на каждой из четырёх дверец шкафа.
- **Спек:** новые тесты и измерения (клетки 48 px, ряд пика), пересмотренный бюджет.

## Выбор места на phone (предположение плана: решает исполнитель)

В Playwright-эмуляции Pixel 7 `innerHeight` 839, масштаб рисунка 0.932, поэтому телефон видит правые около 442 единиц (x от 998), а не 405 (расчёт плана при высоте 915). Часы (x 1258), манометр (x 1112), спиртовка с мерцающим пламенем на полке (x 1102) и четыре анимированных сосуда стоят правее 1035 и видны целиком; таблица, диаграмма и осциллограф кончаются левее 998 и не показывают обрезанных фрагментов. Новая сцена левее кадра скрыта прежним `@container (max-aspect-ratio: 3/5)` только для `.wallpaper-flask-far`; остальное просто выходит за край.

## Числа результата

### Покрытие и высота (`flasks-coverage-*.json`)

| проект | пустых клеток HEAD | после | отношение | предел | высота / экран | предел |
|---|---|---|---|---|---|---|
| chromium-desktop | 78 | **35** из 330 | 0.449 | 0.6 (46) | 0.558 | 0.62 |
| chromium-phone | 25 | 24 из 90 | 0.96 | (записывается, порога нет) | 0.558 | 0.62 |

На phone число пустых клеток почти не изменилось: новое содержимое (часы, манометр, пламя на полке) заполнило клетки среднего пояса, но нижние ряды клипа - область под шкафом у панели задач, там рисунка нет.

### Контраст подписи, `contrastOver8pxSquare` (порог 4.5)

| кадр | accent | chromium-desktop | chromium-phone |
|---|---|---|---|
| «Выключены» | default | 6.677 | 10.843 |
| «Выключены» | custom-dark #1a1a1a | 6.973 | 11.430 |
| «Выключены» | custom-light #f2f2f2 | 6.580 | 11.128 |
| в пик (118 анимаций на пике opacity) | default | 4.929 | 9.309 |
| в пик | custom-dark | 5.080 | 9.673 |
| в пик | custom-light | 4.742 | 9.490 |

### Бюджет анимаций (`flasks-animation-count--*.json`)

| проект | бесконечных в рисунке | предел | с отображаемой целью | предел phone |
|---|---|---|---|---|
| chromium-desktop | 118 (одноразовых 0) | 140 | 118 | - |
| chromium-phone | 118 | 140 | 55 | 80 |

Состав 118: прежние 96 (12 сосудов × 3 анимации и 60 пузырьков) + 14 переливов полки + 6 слоёв пламени + 2 стрелки. Свойства во всех keyframes рисунка: `["opacity","transform"]`.

### Обоснование предела 140

Предел 100 поставил план 20-36 (технический ориентир по числу пузырьков и сосудов), а не владелец. D-54 прямо просит больше движения: 14 переливов полки, шесть слоёв пламени и две стрелки добавляют 22 анимации (96 -> 118). Новые анимации - только opacity и transform (свойства композитора), ноль чтений layout из кода страницы (тест трассы: чтений не больше, чем у «Чистого»). Слить переливы сосудов полки в общие группы отвергнуто: владелец раньше жаловался на однообразие (D-51), а у каждого сосуда должен быть свой перелив (план). Запас до 140 - 22 анимации; на phone с отображаемой целью 55 при пределе 80 (раньше 33). Бюджет кадра на физическом устройстве остаётся BLOCKED до 20-14, где владелец оценит фон.

### Таблица «правило - было - стало» (phase20-art.spec.ts)

| правило | было | стало |
|---|---|---|
| `MAX_INFINITE_ANIMATIONS` | 100 (20-36) | 140, объявлено рядом с обоснованием «D-54 (20-37)» |
| предел phone для отображаемых анимаций | нет | `MAX_PHONE_ANIMATIONS = 80` |
| запись `flasks-animation-count--<project>.json` | в тесте D-51 (`infiniteAnimationsInDrawing`, `shownVessels`, `budget`) | в тесте `D-54 budget` (добавлены `shownInfiniteAnimations`, `finiteAnimations`, `shownShelfVessels`, `budgetPc`, `budgetPhoneShown`, `properties`); тест D-51 по-прежнему проверяет `<= MAX_INFINITE_ANIMATIONS` и `> показанных × 5` |
| только opacity и transform | не проверялось явно | проверяется по keyframes всех эффектов рисунка (`D-54 budget`) |
| покрытие рисунка | нет | `HEAD_EMPTY_CELLS` (78 и 25, замер 20-42 на 33552db), `MAX_EMPTY_SHARE_OF_HEAD = 0.6`, `MAX_DRAWING_HEIGHT_SHARE = 0.62` (F2 D-51) |
| движение пламени, часов, полки | нет | тесты `D-54 the flame`, `D-54 the clock`, `D-54 the shelf vessels`, таблица `SHELF_CYCLES` (14 строк) |
| контраст в пик | нет (худший случай 20-36 мерили вне спека) | три теста `D-54 (20-37) peak` по акцентам |
| `FLASK_COUNT` 12, `PHONE_FLASKS` 4, `wantedCycles` | 12 / 4 / 12 строк | не менялись |

Таблицы циклов компонента (`flaskSpecs`, `shelfCycles`) и спека (`wantedCycles`, `SHELF_CYCLES`) изменены только вместе.

## Task Commits

1. **Task 1 RED:** `313f43fb4c79c63e4101690f01cfb8af022cc25f` (test) - тесты D-54, предел 140/80, число HEAD.
2. **Task 1 GREEN (срез):** `fbe992e3991c9ab2e452e52bc3a0b21f85730b72` (feat) - пламя, часы, перелив первого сосуда полки; в нём же правка теста часов (половина оборота).
3. **Task 2:** `859a493fb295cd6a7a879b0f0ae12b25efeac45f` (feat) - вся полка, плотная сцена, часы под полкой, исправленный замер пика.
4. **Task 2 docs:** `4f7237605bd7a4aa746572471322cb02d3549af4` (docs) - 20-UI-SPEC.md и задача.

**Plan metadata:** следующий коммит (docs: complete plan).

flask_fix_commit: 859a493fb295cd6a7a879b0f0ae12b25efeac45f

## Результаты проверок

- Tracer (Task 1): `--grep "D-54 the flame|D-54 the clock|D-54 budget|peak"` на chromium-desktop - 6 passed; `lib/accent-theme.test.ts` 33 pass, 0 fail; `⚡ Tracer verified end-to-end - expanding` (режим interactive, `<verify>` только автоматический, чекпоинт не нужен).
- Подмножество фона `--grep-invert "spider|Паук|full walks|gait"`, chromium-desktop + chromium-phone, `--retries=0`: **44 passed**, 0 failed, 0 skipped (записи BLOCKED бюджета кадра на устройстве проходят как записи, не как проход бюджета).
- Спек-паука (общий код спека): `--grep "spider|Паук|full walks|gait"` на обоих проектах - 16 passed (сломан не был).
- Accessibility `--project=chromium-desktop --grep "full → off in the middle of an animation|off and reduced leave no looping UI motion"`: 2 passed.
- Unit `node --experimental-strip-types --test lib/*.test.ts`: 1530 тестов, 1526 pass, 0 fail, 4 skipped.
- `node node_modules/typescript/bin/tsc --noEmit` - код 0.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` - 0 errors, 17 warnings (как на базе); изменённые файлы чистые.
- Сборка `next build` (Node 22.13.1, `PORTIA_E2E_ALLOW_HTTP=1`) - код 0; `next start --hostname 127.0.0.1 --port 3100` в фоне, остановлен по PID после последней команды verify (проверена командная строка `next start` этого проекта); LISTENING на 3100 нет.
- `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` - код 0.
- Acceptance Task 1: `grep -c 'D-54'` в спеке 21 (было 0); `MAX_INFINITE_ANIMATIONS.=.100` - 0; `wallpaper-flask-clock` в компоненте 6 строк; `@keyframes flask-flicker` в CSS 2; `flasks-coverage-chromium-desktop.json` и `flasks-contrast-peak-default--chromium-desktop.json` существуют.
- Acceptance Task 2: шесть `flasks-contrast-*` и шесть `flasks-contrast-peak-*` не ниже 4.5; `status: implemented` в задаче; `grep -c 'D-54'` в UI-SPEC 1; `git cat-file -e 859a493...^{commit}` - код 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Тест часов: «половина оборота» считалась с артефактом оборачивания**
- **Found during:** Task 1 (первый прогон verify)
- **Issue:** `wrap(180)` даёт -180, проверка `|wrap(x) - 180|` видела 360.
- **Fix:** сравнение `| |wrap(x)| - 180 |`.
- **Files modified:** tests/e2e/visual-candidates/phase20-art.spec.ts
- **Committed in:** fbe992e

**2. [Rule 1 - Bug] Замер «в пик» и первого пика полки: отрицательное currentTime не принимается**
- **Found during:** Task 2 (тест полки показал разнесение пиков 10 ms вместо 380, проверка скриптом)
- **Issue:** при `delay + доля × длительность < 0` браузер не ставит анимацию на нужное время; пик полки считался неверно и «пик» у части колб стоял не в максимуме.
- **Fix:** время приводится в пределы одного цикла (`((x % d) + d) % d`; анимации бесконечные, цикл равен следующему), в `cyclesOf` и в тесте пика; контраст в пик перемерян (4.74-5.08 на PC).
- **Files modified:** tests/e2e/visual-candidates/phase20-art.spec.ts
- **Committed in:** 859a493

**3. Расхождения с предположениями плана (не продуктовые отклонения):** (a) телефон в эмуляции видит около 442 единиц, а не 405 (описано выше), (b) часы поставлены под полкой, потому что над полкой высота рисунка вырастала до 0.6 и верхний ряд клеток оказывался пустым (+22 пустых клетки), (c) число пустых клеток на phone почти не изменилось (24 против 25): порога на phone в плане нет, записано честно.

**4. Окружение:** `npm run build/start/test/lint` на Node 22.13.1 падают на node-gyp; использованы прямые команды (`node node_modules/next/dist/bin/next build|start`, `node node_modules/@playwright/test/cli.js test`, tsc, eslint, `node --experimental-strip-types --test lib/*.test.ts`).

---

**Total deviations:** 2 auto-fixed (оба Rule 1, в тестах спека), 2 замечания (расхождения предположений, окружение)
**Impact on plan:** нет; продуктовый контракт плана выполнен целиком.

## Issues Encountered

- Исходный замер контраста «в пик» на HEAD был сделан с ошибочным переходом по времени (см. оговорку); корректные числа есть только для текущего рисунка (4.74-5.08 на PC), отдельный честный замер HEAD не снимался.
- Запас по контрасту в пик на PC небольшой (минимум 4.742 на «Свой» #f2f2f2 при пороге 4.5): новое яркое в рисунке не добавлять без повторного замера.

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых точек, путей аутентификации, доступа к файлам и изменений схемы не добавлено; изменён только клиентский рисунок, его стили и спек. Реальные `.env*` не читались и не печатались; сборка читала `.env.local` через Next.js (разрешено владельцем 2026-11-06).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `flask_fix_commit` назван выше для раздела 13 ledger в 20-47; кадры набора `phase20-dev-flasks-d54` (игнорируются git) рабочие, не для владельца, кадры для владельца снимает 20-47.
- Бюджет кадра на устройстве остаётся BLOCKED до 20-14; длительности остаются отложенными владельцем (q-flasks-durations).
- Красота и заметность мерцания, переливов и тиканья, а также достаточность плотности оцениваются владельцем по пересъёмке 20-47 (D1, D2, D4 помечены human_judgment).

## Self-Check: PASSED

- `components/portia-wallpaper.tsx`, `app/portia.css`, `tests/e2e/visual-candidates/phase20-art.spec.ts`, `20-UI-SPEC.md`, `.planning/todos/pending/2026-11-06-flasks-wallpaper-redo.md` - найдены.
- Коммиты 313f43f, fbe992e, 859a493, 4f72376 - предки HEAD; `git cat-file -e 859a493fb295cd6a7a879b0f0ae12b25efeac45f^{commit}` - код 0.
- Файлы набора `phase20-dev-flasks-d54`: шесть `flasks-contrast-*`, шесть `flasks-contrast-peak-*`, два `flasks-coverage-*`, два `flasks-animation-count--*` - существуют.
- `grep -q '^status: implemented'` по задаче - код 0; `grep -c D-54` по UI-SPEC - не меньше 1.
- `netstat` не показывает LISTENING на 3100; `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` - код 0.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
