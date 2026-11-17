---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 41
subsystem: ui
tags: [spider, wallpaper, gait, waves, playwright, d-53]

requires:
  - phase: PORTIA-20
    provides: "20-40 (паук без канта, spider_art_commit f7a1faf), 20-37 (вердикт владельца, D-53 и уточнение 2026-11-07)"
provides:
  - "Размах каждой из восьми ног считается из её длины (legSwingDegrees, LEG_REACH): ход стопы за опору 0.8-1.2 пути тела, около 9-10° у всех пар"
  - "emitStepWaves: каждая постановка группы ног даёт волну на каждой стороне тела, где найдена нить; слоты освобождаются в порядке свободный, самое старое эхо, самая старая волна шага после 0.75 жизни"
  - "Повторный замер LEG_REACH по путям, симуляция 40 маршрутов и трасса ходьбы в браузере на двух проектах"
affects: [20-47, 20-12]

actuals:
  tokens: 26000
  tasks: 2
  commits: 3
plan_head_before: 0b4d91943d5169e32547eb5f5c72832a03bf1e66
plan_head_after: 798e30b62a684586a8def02d1de0af985c536ed3
commits: 3
spider_art_commit: f7a1faf172a9adbe029f066027e3890a0b18a598
spider_fix_commit: db151677cf01d45f852b32e14d73725dd515dc70

tech-stack:
  added: []
  patterns:
    - "Размах ноги из её длины и пути тела за опору (чистая функция в lib), а не таблица по парам"
    - "Пул волн с видом волны (step/echo) и выделением слота с приоритетом шага над эхом"
    - "Повторный замер константы рисунка по путям из исходника компонента в unit-тесте (LEG_REACH, допуск 3 единицы)"

key-files:
  created: []
  modified:
    - lib/wallpaper-web.ts
    - components/portia-wallpaper-spider.tsx
    - lib/wallpaper-web.test.ts
    - tests/e2e/visual-candidates/phase20-art.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
    - .planning/todos/pending/2026-11-06-spider-match-logo.md

key-decisions:
  - "D-53: размах ноги берётся из её длины; таблица LEG_SWING_BY_PAIR [0, 2.4, 4.8, 7.4, 14] и таблица подгиба по парам удалены, подгиб LEG_TUCK 0.05 одинаков у всех"
  - "Одна волна на сторону тела на постановку (не две): спрос 6.48 x 2 x 1 x 0.9 = 11.7 слотов при 16 слотах; группа A пускает волну по ходу, группа B против хода"
  - "Скорость SPIDER_MOTION_RATE 1.8 и GAIT_STRIDE 20, группы GAIT_A/B, legLag, legPose, охотничий жест передней пары, BODY_BOB не менялись"

requirements-completed: [STAB-VIS-01, STAB-A11Y-04]

coverage:
  - id: D1
    description: "Шагают все восемь ног: ход стопы каждой пары 0.8-1.2 пути тела за опору, размахи пар отличаются не больше чем в 1.5 раза"
    requirement: STAB-VIS-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#D-53 (20-37) every leg's foot travels 0.8-1.2 of the body's path in one stance"
        status: pass
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#D-53 (20-37) LEG_REACH is the measured length of each leg"
        status: pass
      - kind: e2e
        ref: "phase20-art.spec.ts#D-01..D-04 full walks: диапазон поворота каждой ноги не меньше 8°, chromium-desktop и chromium-phone"
        status: pass
    human_judgment: false
  - id: D2
    description: "Паутина отвечает волной на каждую постановку: ноль отказов в симуляции 40 маршрутов, волны видны в 100% замеров ходьбы"
    requirement: STAB-VIS-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#D-53 (20-37) every footfall with a thread beside it waves every side where the thread was found"
        status: pass
      - kind: e2e
        ref: "spider-gait-trace--{chromium-desktop,chromium-phone}.json, waveShare 1"
        status: pass
    human_judgment: true
    rationale: "Синхронность волны и шага на глаз оценивает владелец по пересъёмке 20-47; числа показывают наличие волны на каждой постановке, а не её красоту"
  - id: D3
    description: "Стоимость и режимы прежние: слотов 16, жизнь 0.9 s, ноль чтений layout, «Выключены»/«Уменьшены»/«Паук: Скрыть», резкость в покое не ниже 0.9"
    requirement: STAB-A11Y-04
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#D-53 (20-37) the wave budget: at most 16 slots, a wave lives at most 0.9 s"
        status: pass
      - kind: e2e
        ref: "phase20-art.spec.ts: D-27, D-01..D-04, D-45; layoutReadsWhileWalking 0 на обоих проектах"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 41: ходьба всех восьми ног и волна на каждую постановку Summary

**Размах каждой ноги теперь считается из её длины и пути тела за опору (около 9-10° у всех восьми ног вместо 2.4-14°), а выделение волн шага отдаёт слот шагу раньше эха, так что каждая постановка группы ног даёт волну на каждой стороне тела; подтверждено симуляцией 40 маршрутов и трассой ходьбы на chromium-desktop и chromium-phone.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-07T07:01:04Z
- **Completed:** 2026-11-07T07:10:53Z
- **Tasks:** 2 (Task 1 типа tracer)
- **Files modified:** 6
- **PLAN_BASE:** `0b4d91943d5169e32547eb5f5c72832a03bf1e66`

## Найденная причина (подтверждена RED на HEAD 0b4d919)

1. **Размах ног.** `LEG_SWING_BY_PAIR = [0, 2.4, 4.8, 7.4, 14]` поворачивал пары на ±2.4°, ±4.8°, ±7.4° и ±14°, хотя длины ног почти равны (304-343 единицы рисунка, замер по путям: L1 320.7, L2 317.7, L3 304.5, L4 341.5, R1 320.3, R2 317.6, R3 305.5, R4 343.2). Ход стопы от пика до пика при 72 px, веб-единицы: пара 1 — 2.98 (0.25 пути тела за опору 12), пара 2 — 5.89 (0.49), пара 3 — 8.71 (0.73), пара 4 — 18.37 (1.53). Задние пары скользили вместе с телом и выглядели неподвижными, передняя перешагивала в 1.5 раза.
2. **Волны.** Пул из 8 слотов и четыре волны на постановку (две стороны, два направления) переполнялись. Повторная симуляция на HEAD (те же функции `planWalk`, `walkPose`, `gaitPhase`, `footfallThreads`, `emitPulse`, `stepPulses`, 40 маршрутов seeded(12345), кадр 1/60 s, пауза 6 s): 874 постановки, у всех найдена нить, **607 (69%) не получили ни одной волны**; сторон с нитью 1748, получили волну 486; запрошено 3496 волн, выдано 924. В плане при планировании стояло 544 из 720: другие числа из-за иной выборки лейна и пауз в повторной симуляции, вывод тот же (больше половины отказов), тест держит порог «больше половины».

RED записан отдельным коммитом `8d69d3b`: на HEAD падали 11 тестов (три прежних закрепления массива размахов переписаны на правило D-53, плюс восемь новых; самопроверка «старая схема голодала» проходила и на HEAD).

## Выбранные числа и расчёт спроса

| величина | значение | почему |
|---|---|---|
| размах ноги | `legSwingDegrees(LEG_REACH)`: 9.71, 9.80, 10.26, 9.11, 9.74, 9.80, 10.22, 9.08° (L1..R4) | `asin(0.6 x 20 x 9.02 / (2 x reach))`, коэффициент посадки 1; ход стопы 12.00 у каждой ноги (отношение 1.00), разброс размахов 1.13 |
| подгиб | `LEG_TUCK = 0.05` у всех | одинаковая доля, как требует план (среднее прежних 0.02-0.09) |
| слотов | `PULSE_SLOTS = 16` | потолок плана; было 8 |
| жизнь волны | `PULSE_LIFE = 0.9 s` | потолок 18-UI-SPEC, не менялась |
| волн на постановку | 1 на сторону, 2 всего (`STEP_WAVES_PER_SIDE = 1`) | было 4 |
| постановок в секунду | 64.8 / (20 / 2) = 6.48 | скорость 64.8 ед/с, постановка каждые 10 единиц |
| спрос шага | 6.48 x 2 x 1 x 0.9 = **11.7 слота** из 16 | остаётся 4.3 слота под эхо; защищённых волн (младше 0.75 жизни) не больше 6.48 x 2 x 0.675 = 8.75 |

Две волны на сторону (обе стороны бегущих) дали бы 23.3 слота при жизни 0.9 s, больше потолка 16, поэтому выбрана одна волна на сторону; направление чередуется по группе ног (A по ходу, B против хода). Симуляция GREEN (16 слотов): 874 постановки, найдено сторон 1748, волной обслужено 1748, **отказов 0**, одновременно живых не больше 16 (из них волн шага не больше 12), ни одна волна шага не вытеснена раньше 0.75 жизни.

## Accomplishments

- `lib/wallpaper-web.ts`: `legSwingDegrees` (чистая функция размаха по длине ноги, пути тела за опору, масштабу 649.5 / 72 и коэффициенту посадки), `emitStepWaves` (приоритетное выделение слота: свободный, самое старое эхо, самая старая волна шага, прожившая не меньше 0.75 жизни), вид волны `kind: "step" | "echo"` (эхо создаёт `emitAtCrossing`), экспорт `PULSE_LIFE` и `STEP_WAVES_PER_SIDE`; `emitPulse` остался нижним приоритетом без вытеснения.
- `components/portia-wallpaper-spider.tsx`: `LEG_REACH` (замер по путям), `LEG_SWING` из функции, `LEG_TUCK`, `PULSE_SLOTS = 16`, вызов `emitStepWaves` в том же месте (переход фазы через 0 и 0.5 при ходьбе, при развороте на месте волн по-прежнему нет). `spiderTransform`, промоушен слоя, ветки reduced/off и `data-spider="off"` не тронуты.
- `lib/wallpaper-web.test.ts`: повторный замер `LEG_REACH` (разбор путей M, L, H, V, C, S, Q, T, Z, абсолютных и относительных, допуск 3 единицы), ход стопы каждой ноги, поведение `legSwingDegrees`, повторная симуляция 40 маршрутов (старая схема и новая), бюджет волн, приоритеты слотов, направление волны.
- `phase20-art.spec.ts`: проверки трассы ходьбы: диапазон поворота каждой из восьми ног не меньше 8°, доля замеров с волнами не меньше 90%, замеров ходьбы не меньше 12.
- `20-UI-SPEC.md` (пункт «Ходьба» D-53 с заменой правил 18-UI-SPEC) и задача `2026-11-06-spider-match-logo.md` (`status: implemented`).

## Task Commits

1. **Task 1 RED:** `8d69d3b56efec2931ff1189f5e64164f98f135a0` (test) — тесты D-53, прежние закрепления размахов заменены, проверки трассы в спеке.
2. **Task 1 GREEN:** `db151677cf01d45f852b32e14d73725dd515dc70` (fix) — функции и компонент.
3. **Task 2:** `798e30b62a684586a8def02d1de0af985c536ed3` (docs) — UI-SPEC и задача.

**Plan metadata:** следующий коммит (docs: complete plan).

spider_art_commit: f7a1faf172a9adbe029f066027e3890a0b18a598
spider_fix_commit: db151677cf01d45f852b32e14d73725dd515dc70

## Результаты проверок

- Unit: `node --experimental-strip-types --test lib/*.test.ts` — 1530 тестов, 1526 pass, 0 fail, 4 skipped. Прежние 1521 + 9 новых; `npm test` на Node 22.13.1 падает на node-gyp (окружение), использованы прямые команды.
- `node node_modules/typescript/bin/tsc --noEmit` — код 0.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` — 0 errors, 17 warnings (как на базе, новых нет; изменённые файлы чистые).
- `next build` (Node 22.13.1, `PORTIA_E2E_ALLOW_HTTP=1`, прямая команда) — код 0; `next start --hostname 127.0.0.1 --port 3100` в фоне.
- Playwright `--retries=0 --project=chromium-desktop --project=chromium-phone phase20-art.spec.ts --grep "spider|Паук|full walks"`: **14 passed**, ни одного skipped и failed. Отдельно `--grep "frame budget"`: 4 passed (записи BLOCKED бюджета кадра на устройстве, не проход).
- Сервер на 3100 остановлен (PID 21544, команда `next start` этого проекта, проверено); `netstat` LISTENING на 3100 не показывает.
- `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` — код 0 (эталоны не тронуты).

### Трасса ходьбы (`spider-gait-trace--<проект>.json`, 40 замеров по 100 ms, учтены замеры ходьбы)

Диапазон поворота = наибольший минус наименьший поворот ноги по замерам ходьбы (преобразование сдвинулось и нога отклонена); порог 8°.

| проект | замеров ходьбы | R4 | R3 | R2 | R1 | L4 | L3 | L2 | L1 | доля замеров с волной | чтений layout |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chromium-desktop | 39 | 19.0 | 18.8 | 20.5 | 20.3 | 19.1 | 21.0 | 19.3 | 20.2 | 100% | 0 |
| chromium-phone | 21 | 19.1 | 20.9 | 18.3 | 17.0 | 18.0 | 20.6 | 20.1 | 18.8 | 100% | 0 |

На HEAD у пары 1 диапазон был около 4.8°. Прогон отдельно «full walks» на desktop до общего набора дал 18 замеров ходьбы (маршрут закончился раньше 4 s), диапазоны 16.2-21.3°, волны 100%: число замеров ходьбы зависит от длины маршрута, поэтому проверка требует не меньше 12 замеров ходьбы, а не ровно 40.

Пути: `tests/e2e/visual-candidates/.runs/phase20-dev-spider-d53/spider-gait-trace--chromium-{desktop,phone}.json` (игнорируется git).

### Резкость в покое (D-45, `spider-rest-sharpness.json`, «как есть», порог 0.9 не менялся)

| проект | состояние | отношение | резкость | образец |
|---|---|---|---|---|
| chromium-desktop | off | 1.029 | 14.50 | 14.09 |
| chromium-desktop | full | 1.015 | 14.14 | 13.94 |
| chromium-phone | off | 1.306 | 7.45 | 5.71 |
| chromium-phone | full | 1.291 | 7.49 | 5.80 |

Все не ниже 0.9 (числа те же, что в 20-40: рисунок и покой не менялись).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Вызов функции волн под ожидаемым в тесте видом**
- **Found during:** Task 1 (GREEN, первый прогон unit)
- **Issue:** тест «each footfall waves…» ищет `emitStepWaves(pool, sides, heading, STEP_PEAK, time, `, а в компоненте поиск нитей был вложен в аргумент.
- **Fix:** `const sides = footfallThreads(x, y, heading)` отдельной строкой перед вызовом (поведение то же).
- **Files modified:** components/portia-wallpaper-spider.tsx
- **Committed in:** db15167

**2. Числа RED отличаются от планового анализа:** 874 постановки и 607 без волны (69%), а не 720 и 544 (76%); причина в параметрах повторной симуляции (лейн и паузы), вывод и порог «больше половины» те же. Не отклонение продукта.

**3. Окружение:** `npm run build/start/test/lint` на Node 22.13.1 падают на `node-gyp`; использованы прямые команды (`node node_modules/next/dist/bin/next build|start`, `node node_modules/@playwright/test/cli.js test`, tsc, eslint, `node --experimental-strip-types --test lib/*.test.ts`).

---

**Total deviations:** 1 auto-fixed (blocking, форма вызова в компоненте), 2 замечания (числа RED, окружение)
**Impact on plan:** нет; продуктовый контракт плана выполнен целиком.

## Issues Encountered

- Число замеров ходьбы в 4-секундной трассе меняется от запуска к запуску (маршрут может закончиться раньше), поэтому диапазон ног и доля волн считаются по замерам ходьбы, порог не меньше 12 замеров. Пороги 8° и 90% не менялись.
- Пул из 16 слотов в кадре почти полон (в трассе 13-16 непустых путей волн): это ожидаемо при 11.7 слотах под волны шага и остатке под эхо; эхо вытесняется первым.

## Known Stubs

Нет.

## Threat Flags

Нет: новых сетевых точек, путей аутентификации и доступа к файлам продукта не добавлено; изменён только клиентский цикл анимации и чистые функции.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Паук ходит всеми восемью ногами, паутина отвечает волной на каждую постановку; `spider_fix_commit` назван выше для раздела 13 ledger в 20-47.
- Кадры набора `phase20-dev-spider-d53` (игнорируются git) рабочие, не для владельца; кадры для владельца снимает 20-47. Бюджет кадра на устройстве остаётся BLOCKED до 20-14.
- Различимость и красоту хода владелец оценивает по пересъёмке 20-47 (D2 помечен как human_judgment).

## Self-Check: PASSED

- `lib/wallpaper-web.ts`, `components/portia-wallpaper-spider.tsx`, `lib/wallpaper-web.test.ts`, `tests/e2e/visual-candidates/phase20-art.spec.ts`, `20-UI-SPEC.md`, задача `2026-11-06-spider-match-logo.md` — найдены.
- Коммиты 8d69d3b, db15167, 798e30b — предки HEAD; `git cat-file -e db151677cf01d45f852b32e14d73725dd515dc70^{commit}` — код 0; `git merge-base --is-ancestor f7a1faf172a9adbe029f066027e3890a0b18a598 db151677cf01d45f852b32e14d73725dd515dc70` — код 0.
- `grep -cF 'LEG_SWING_BY_PAIR = [0, 2.4, 4.8, 7.4, 14]' components/portia-wallpaper-spider.tsx` — 0; `grep -c LEG_REACH` по компоненту — не меньше 2; `grep -c D-53 lib/wallpaper-web.test.ts` — не меньше 3.
- `grep -q '^status: implemented'` по задаче — код 0; `grep -c 18-UI-SPEC` по 20-UI-SPEC — 1.
- Оба `spider-gait-trace--*.json` существуют; у обоих проектов диапазон каждой ноги не меньше 8°, волны 100%.
- `netstat` не показывает LISTENING на 3100.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
