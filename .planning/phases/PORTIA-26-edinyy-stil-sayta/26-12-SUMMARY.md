---
phase: PORTIA-26-edinyy-stil-sayta
plan: 12
subsystem: ui
tags: [icons, classification, svg, currentColor, owner-decision, byte-guard]
status: complete

requires:
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-02 — решение владельца по иконкам (26-ICON-DECISION.md: раунд 5, геометрия 18 знаков и поправка к 26-12)"
  - phase: PORTIA-26-edinyy-stil-sayta
    provides: "26-11 — предыдущий план волны"
provides:
  - "components/portia-icons.tsx: 18 записей class-* (6 осей × 3 уровня) — дословный перенос <symbol> раунда 5 в JSX; линия 1.5, только currentColor, залитые части stroke=\"none\""
  - "lib/virus-classes.test.ts: сверка 18 знаков с геометрией из 26-ICON-DECISION.md (разбор svg-блока), условие запуска «одна строка Выбрано: », охрана ICON_SAMPLE_COMMIT для route-*, lock-*, прочих иконок, типа, карты classificationIcon, classificationIconFor и PortiaIcon"
affects: [26-13, 26-14, 27]

plan_head_before: cc2cd85c1dd159ec53267144a4dd54b8ef0795bb
plan_head_after: 7cb6bb92b4abc149ae9767c303bae68ae1ebc137

actuals:
  tokens: 6150
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "источник рисунка — файл решения владельца; тест разбирает его svg-блок и сравнивает каждую запись иконки строка в строку (тот же перевод атрибутов в JSX), поэтому любая «доработка» рисунка роняет тест"
    - "залитая группа знака внутри PortiaIcon получает stroke=\"none\": корневой <svg> задаёт stroke, а в символе страницы его не было"

key-files:
  created: []
  modified:
    - components/portia-icons.tsx
    - lib/virus-classes.test.ts

key-decisions:
  - "Рисунок 18 знаков взят дословно из 26-ICON-DECISION.md (раунд 5); буквы А/Б/В и общей метки уровня D-08 нет — уровень показывает сам рисунок (поправка владельца к 26-12)"
  - "Залитые части знаков получили stroke=\"none\": иначе корневая обводка PortiaIcon (1.75) раздувала бы точки и ядра на 0.875 с каждой стороны против одобренного рисунка"
  - "Линия знаков классификации 1.5 задана на группе внутри записи; PortiaIcon (strokeWidth 1.75 для остальных иконок) не менялся и охраняется побайтно"
  - "Побайтная охрана по cf8038f снята для class-stabilar/impulsar/infernar и оставлена для route-*, lock-*, всех прочих иконок, их помощников drop/lockBody, типа PortiaIconName, карты classificationIcon, classificationIconFor и PortiaIcon"

patterns-established:
  - "решение владельца с геометрией — исполняемый источник: тест читает .planning/…/26-ICON-DECISION.md"

requirements-completed: [UI-07]

coverage:
  - id: D1
    description: "Трассер: три знака опасности (Гефест, Протей, Апейрон) равны геометрии раунда 5"
    requirement: UI-07
    verification:
      - kind: unit
        ref: "lib/virus-classes.test.ts#26-12 all 18 class signs are the owner's round-5 drawing, verbatim, and the decision records exactly these 18"
        status: pass
    human_judgment: false
  - id: D2
    description: "Все 18 знаков шести осей равны геометрии раунда 5; в решении ровно эти 18; тип PortiaIconName содержит те же 18 ключей"
    requirement: UI-07
    verification:
      - kind: unit
        ref: "lib/virus-classes.test.ts#26-12 all 18 class signs are the owner's round-5 drawing, verbatim, and the decision records exactly these 18"
        status: pass
      - kind: unit
        ref: "lib/virus-classes.test.ts#26-12 every class sign: line 1.5 with round caps, currentColor only, no dashes, no fading and no separate level mark"
        status: pass
      - kind: unit
        ref: "lib/virus-classes.test.ts#26-12 mind levels read from one head profile: a circle, then a pupil in it, then a spiral; nothing is dashed"
        status: pass
    human_judgment: false
  - id: D3
    description: "route-*, lock-* и прочие иконки, тип, карта терминов, classificationIconFor и PortiaIcon побайтно равны образцу cf8038f; рисование только при записанном выборе"
    requirement: UI-07
    verification:
      - kind: unit
        ref: "lib/virus-classes.test.ts#26-12 route-*, lock-* and all non-class icons, their helpers, the type, the class map and PortiaIcon equal ICON_SAMPLE_COMMIT byte for byte"
        status: pass
      - kind: unit
        ref: "lib/virus-classes.test.ts#26-12 the drawing starts only from the owner's recorded choice: one «Выбрано: » line in 26-ICON-DECISION.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Вид знаков в браузере и различимость уровней в 16/18/24px на физическом экране"
    requirement: UI-07
    verification: []
    human_judgment: true
    rationale: "Рендер в браузере не запускался — BLOCKED (ENV), физический экран — BLOCKED (DEVICE) до Phase 27. Не засчитано как пройденное (записано в .planning/WINDOWS.md, запись 14, unrun-verify)"

duration: 4 min
completed: 2026-11-16
---

# Phase 26 Plan 12: Знаки классификации по рисунку владельца (раунд 5) Summary

**Все 18 знаков классификации (6 осей × 3 уровня, включая Стабилар, Импульсар и Инфернар) перенесены в `components/portia-icons.tsx` дословно из геометрии раунда 5 в `26-ICON-DECISION.md`: линия 1.5, только `currentColor`, уровень показывает сам рисунок без отдельной метки; тест сверяет каждую запись с файлом решения, а `route-*`, `lock-*` и прочие иконки охраняются побайтно по образцу `cf8038f`.**

## Performance

- **Duration:** ~4 мин
- **Started:** 2026-11-16T13:00:09Z
- **Completed:** 2026-11-16T13:04:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `components/portia-icons.tsx`: 18 записей `class-*` переписаны из `<symbol id="s-<имя>">` файла решения. Перевод только синтаксический: `stroke-width` → `strokeWidth`, `stroke-linecap` → `strokeLinecap`, `stroke-linejoin` → `strokeLinejoin`, `"/>` → `" />`; у залитой группы добавлено `stroke="none"`. Координаты, команды путей и порядок элементов не тронуты. Записи сгенерированы скриптом из файла решения, а не набраны вручную.
- Удалены больше не используемые помощники старого рисунка: `dangerCore`, `spreadCore`, `escapeGate`, `brainHalf`, `brainFolds`, `brainSpine`, `mirrored`, `helixHalf`. Комментарий над знаками ссылается на файл решения.
- `lib/virus-classes.test.ts`:
  - разбор svg-блока из раздела «Геометрия (источник для 26-12)»: каждая строка — один символ 24×24, без повторов;
  - сверка всех 18 записей с файлом решения строка в строку; в решении ровно эти 18 знаков, в типе `PortiaIconName` те же 18 ключей;
  - у каждого знака группа линии 1.5 с круглыми концами, нет hex/rgb/hsl, штриховки, прозрачности, `levelMark` и общих JSX-помощников;
  - проверка G2 (штриховой мозг) перенацелена на раунд 5: один профиль головы у трёх знаков разума, у Люцидиума пустой круг, у Транзитиума зрачок, у Обливиума спираль вместо круга;
  - `ICON_SAMPLE_COMMIT = cf8038f…`: 20 записей без префикса `class-` (обычные иконки, `route-*`, `lock-*`), помощники `drop`/`lockBody`, тип, карта `classificationIcon`, `classificationIconFor` и `PortiaIcon` побайтно равны образцу из `git show`; при shallow-клоне или без git тест падает с понятным сообщением;
  - условие запуска: в файле решения ровно одна строка, начинающаяся с `Выбрано: `.

## Task Commits

1. **Task 1 RED: знаки опасности по рисунку владельца, охрана по образцу** — `d2a70eb` (test)
2. **Task 1 GREEN: трассер — Гефест, Протей, Апейрон** — `0e86eca` (feat)
3. **Task 2 RED: все 18 знаков, уровни разума без штриховки** — `2870c00` (test)
4. **Task 2 GREEN: остальные 15 знаков, старые помощники удалены** — `7cb6bb9` (feat)

## Files Created/Modified

- `components/portia-icons.tsx` — 18 знаков классификации раунда 5, удалены старые помощники.
- `lib/virus-classes.test.ts` — 5 новых тестов 26-12 и перенацеленная проверка разума; общий помощник `entryIn(block, key)`.

## TDD

План типа `execute`, у обеих задач `tdd="true"`; RED и GREEN — отдельными коммитами.

- **Task 1 RED** (`d2a70eb`): целевой тест «26-12 tracer: the three danger signs…» упал на утверждении `class-hephaestus` (старый рисунок `dangerCore` вместо символа `s-hephaestus`). Классификатор: `RED_EVIDENCE_OK` (target_test_failed, 13 тестов, 1 fail). Семантическая оценка: цель выполнилась и упала на запланированном сравнении с геометрией. Охрана по образцу и тест условия запуска были зелёными сразу — это охранные тесты текущего состояния, не RED-цели.
- **Task 1 GREEN** (`0e86eca`): verify (virus-classes + level-ui + portia-desktop + portia-template-builder) 147/0, tsc без ошибок, ESLint 0.
- **Tracer gate:** авто-режим выключен, `human_verify_mode` — end-of-phase, `<verify>` трассера только автоматический; повторный прогон — 0 fail; расширение продолжено.
- **Task 2 RED** (`2870c00`): целевой тест «26-12 all 18 class signs…» упал на `class-nomos` (первая ещё не перерисованная запись; проверки числа символов в решении и ключей типа прошли). Вместе с ним упали тест «every class sign…» и тест разума. `RED_EVIDENCE_OK` (14 тестов, 3 fail). Тест трассера при этом заменён общим тестом 18 знаков.
- **Task 2 GREEN** (`7cb6bb9`): verify 148/0; полный набор 2339 тестов, 2336 pass, 0 fail, 3 skipped (прежние opt-in live-наборы).

## Decisions Made

См. `key-decisions` во frontmatter. Главное: рисунок не правился ни в одной координате; единственная добавка к нему — `stroke="none"` у залитой группы, чтобы знак в `PortiaIcon` выглядел так же, как на одобренной странице.

## Deviations from Plan

Объём и правила плана изменены решением владельца: `26-ICON-DECISION.md`, разделы «Геометрия (источник для 26-12)» и «Поправка к 26-12». Все отличия ниже следуют из него.

### Отличия по решению владельца

1. **Условие запуска.** Вместо `^Выбрано: [АБВ]$` проверяется «ровно одна строка, начинающаяся с `Выбрано: `» (в файле: `Выбрано: раунд 5 …`). Тест «the drawing starts only from the owner's recorded choice» закрепляет это.
2. **Объём: 18 знаков вместо 15.** Перерисованы и `class-stabilar`, `class-impulsar`, `class-infernar` (ось «Поведение и агрессия»), которые план требовал не трогать.
3. **Нет стиля А/Б/В и нет D-08.** Вместо общих баз групп (`dangerBase`, `spreadBase`, `escapeBase`, `mindBase`, `appearanceBase`) и `levelMark(n)` — дословная геометрия раунда 5, где уровень показывает сам рисунок. Поэтому критерии приёмки плана `grep -c "dangerBase" ≥ 4`, `grep -c "levelMark(" ≥ 4/16` и `grep -cE "spreadBase|…" ≥ 16` не применимы (фактически 0) и заменены тестом сверки всех 18 знаков с файлом решения и тестом «no separate level mark». Правило «одна база на ось» выполнено самим рисунком владельца; тест проверяет его там, где база буквально общая (профиль головы у разума).
4. **Линия 1.5, а не 1.75** (стиль А плана); задана на группе внутри каждой записи, `PortiaIcon` не менялся.
5. **Побайтная охрана по `cf8038f`** снята для трёх знаков поведения и оставлена для `route-*`, `lock-*`, всех остальных иконок, типа, карты терминов, `classificationIconFor` и `PortiaIcon`.
6. **Показ результата.** План просил обновить приватную страницу-артефакт разделом «Итог: стиль <буква>». Файл решения («Что дальше») говорит: результат сообщается владельцу текстом, второй показ только при явной ошибке (D-09, 8а); галерей и страниц в репозитории нет (решение 2026-11-08). Страница не обновлялась; результат — в разделе «Для владельца» ниже.
7. **Проверка G2** («Lucidium remains solid / Oblivium remains dashed») перенацелена, а не удалена: теперь она закрепляет уровни разума раунда 5 (круг → зрачок → спираль на одном профиле головы).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Корневая обводка PortiaIcon раздувала залитые части знаков**
- **Found during:** Task 1
- **Issue:** `PortiaIcon` ставит `stroke="currentColor" strokeWidth={1.75}` на корневой `<svg>`. Группа `<g fill="currentColor">` символа унаследовала бы эту обводку, и точки, ядра и зрачок стали бы больше одобренного рисунка (на 0.875 с каждой стороны). На странице владельца у символа этой обводки не было.
- **Fix:** у залитой группы `stroke="none"`; тест переводит символ в JSX тем же правилом, так что других отличий от рисунка нет.
- **Files modified:** components/portia-icons.tsx, lib/virus-classes.test.ts
- **Commit:** 0e86eca, 7cb6bb9

**Total deviations:** 1 auto-fixed (Rule 1) и 7 отличий по решению владельца. **Impact:** только два файла плана; прочие иконки и карта терминов не тронуты (охраняются тестом).

## Issues Encountered

- `npm test` в этой среде не работает (node-gyp), тесты запускались напрямую `node --experimental-strip-types --test lib/*.test.ts`.

## Known Stubs

Нет.

## Threat Flags

Нет новых поверхностей. T-26-25: тест условия запуска требует записанный выбор владельца, агент рисунок не выбирал и не менял. T-26-26: побайтная охрана по `cf8038f` для `route-*`, `lock-*` и прочих иконок.

## Verification

- `node --experimental-strip-types --test lib/*.test.ts` — 2339 тестов, 2336 pass, 0 fail, 3 skipped (прежние opt-in live-наборы).
- verify задач (virus-classes, level-ui, portia-desktop, portia-template-builder) — 148/0.
- `node node_modules/typescript/bin/tsc --noEmit` — без ошибок.
- ESLint `components/portia-icons.tsx lib/virus-classes.test.ts` — 0 ошибок, 0 предупреждений.
- Acceptance: `ICON_SAMPLE_COMMIT` в тесте — 5 (≥ 2); `strokeWidth="1.5"` в файле иконок — 18; `git status --porcelain -- public/ tests/e2e/visual/__screenshots__` — пусто. `dangerBase`/`levelMark(` — 0 (не применимы, см. отличие 3).
- **BLOCKED (не пройдено):** вид знаков в браузере и различимость уровней в 16/18/24px на физическом экране — BLOCKED (ENV)/(DEVICE) до Phase 27; записано в `.planning/WINDOWS.md` (запись 14, unrun-verify).

## Для владельца

Значки классификации на сайте теперь те, что вы одобрили в пятом раунде. Все 18 перенесены точно по рисунку, без упрощений.

- **Опасность (Гефест, Протей, Апейрон):** треугольник со спокойной точкой; у Протея из точки выходят три коротких шипа; у Апейрона шипы протыкают стенки, ядро крупнее.
- **Распространение (Номос, Тезей, Абраксас):** слева заражённый источник, справа два носителя-кольца; у Номоса линии к ним не доходят, у Тезея доходят, у Абраксаса носители залиты, а линии идут дальше.
- **Побег (Предупреждение, Риск, Эснов):** капсула с ровными стенками и образцом внутри; у Риска правая стенка выгнута наружу; у Эснова стенка лопнула и образец снаружи.
- **Разум (Люцидиум, Транзитиум, Обливиум):** профиль головы с кругом разума; у Транзитиума в круге появился зрачок; у Обливиума вместо круга спираль.
- **Поведение (Стабилар, Импульсар, Инфернар):** круглое лицо с ровными бровями и прямым ртом; у Импульсара брови опущены, рот напряжён дугой; у Инфернара контур ломается в зубцы, брови злые, рот зигзагом.
- **Внешний вид (Изоморф, Полиморф, Ксеноморф):** обычный силуэт «голова и плечи»; у Полиморфа голова вытянута и правое плечо вздуто; у Ксеноморфа голова вытянута сильнее и над плечом выросла вторая, малая голова.

Отдельных точек или насечек уровня нет: уровень виден по самому рисунку. Линия у этих значков 1.5, цвет берётся из темы. Значки «Способ распространения», замки и все остальные иконки не менялись.

Одна техническая поправка без изменения рисунка: залитые части (точки, ядра, зрачок) показываются без обводки, как на одобренной странице. Иначе общая обводка значков сделала бы их толще.

Страницу-артефакт заново не показываем. Второй показ будет только если в каком-то знаке найдётся явная ошибка (8а). Как значки выглядят в браузере и на настоящем экране в мелком размере (16–24px), пока не проверено: нет проверочного окружения и устройства. Проверка отложена до фазы 27 и не засчитана как пройденная.

## Self-Check: PASSED

- Файлы: components/portia-icons.tsx, lib/virus-classes.test.ts, 26-12-SUMMARY.md — на месте.
- Коммиты d2a70eb, 0e86eca, 2870c00, 7cb6bb9 — в истории HEAD.
