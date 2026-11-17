---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 48
subsystem: ui
tags: [wallpaper, flasks, css-animation, gap-closure, owner-verdict, accessibility]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-42 колбы D-54 (пламя, полка, часы, плотнее; предел 140/80), 20-47 вердикт владельца 2026-11-07 (12 строк flasks-* «исправить»)"
provides:
  - "фон «Лабораторные колбы» с одним циферблатом (манометр убран) и четырьмя движущимися досками (синусоида осциллографа, линия и столбики диаграммы, ячейки таблицы, инструменты)"
  - "таблица boardCycles в components/portia-wallpaper.tsx и BOARD_CYCLES в phase20-art.spec.ts (меняются только вместе)"
  - "решения D-59..D-64 в 20-CONTEXT.md; пункт D-59 в 20-UI-SPEC.md; строка D-59 в todo колб"
  - "flask_fix_commit для пересъёмки 20-54"
affects: [20-49, 20-54, пересъёмка раздела 14 ledger]

outcome: complete
flask_fix_commit: b003476abe7f0774d99ebdfc00a27d0819b32b1f

actuals:
  tokens: 6900
  tasks: 2
  commits: 4

plan_head_before: 5b0e961f048d2773de4107fd1127fea05fa1cf1a
plan_head_after: d869d72d7899a71dd04b78c9424537df2c76f560
commits: 4

tech-stack:
  added: []
  patterns:
    - "движущаяся часть доски — отдельный элемент со своим циклом (--board-dur/--board-delay) и покоящимся значением в базовом правиле; анимация только под html[data-motion=full]"
    - "клип-группа не движется, движется только вложенный путь (трасса осциллографа под #wp-scope-clip)"
    - "таблица циклов в компоненте и такая же в спеке меняются только вместе (boardCycles / BOARD_CYCLES)"

key-files:
  created: []
  modified:
    - components/portia-wallpaper.tsx
    - app/portia.css
    - tests/e2e/visual-candidates/phase20-art.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UI-SPEC.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-CONTEXT.md
    - .planning/todos/pending/2026-11-06-flasks-wallpaper-redo.md

key-decisions:
  - "D-59 (прочтение планировщика, не слова владельца): «вторые часы» — круглый манометр под полкой, он убран, тикающие часы остались; «доски» — таблица элементов, диаграмма, доска с инструментами, экран осциллографа; «волны у доски» — синусоида осциллографа и линия диаграммы"
  - "Предел 140/80 не тронут: 136 бесконечных анимаций на PC, 55 отображаемых на chromium-phone (доски левее кадра телефона скрыты существующим @container-правилом)"
  - "Синусоида осциллографа вынесена из неподвижного пути в отдельный элемент: путь начинается на два периода левее прежнего старта (x 874), поэтому сдвиг на один период (24 единицы) даёт ту же картинку без шва; клип стоит на группе, а не на движущемся пути"
  - "Подсветка ячеек таблицы тёмная (fill-opacity .5 и opacity до .42), поэтому минимум контраста в пик на PC не изменился (4,742 на #f2f2f2)"

requirements-completed: [STAB-VIS-02, STAB-A11Y-04]

coverage:
  - id: D1
    description: "В рисунке «Лабораторные колбы» один циферблат: манометр (x 1112, y 424) убран, в области x 1084–1140, y 396–458 штрихов стола и стены нет, других круглых циферблатов нет"
    requirement: STAB-VIS-02
    verification:
      - kind: automated_ui
        ref: "tests/e2e/visual-candidates/phase20-art.spec.ts#D-59 one clock (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Синусоида осциллографа бежит: одна бесконечная линейная анимация transform на один период (24 единицы), обрезана рамкой экрана, в «Выключены» стоит на месте"
    requirement: STAB-VIS-02
    verification:
      - kind: automated_ui
        ref: "tests/e2e/visual-candidates/phase20-art.spec.ts#D-59 the oscilloscope wave moves (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Доски двигаются: шесть столбиков, линия диаграммы, четыре ячейки таблицы, шесть инструментов; у каждой анимации своя длительность и фаза, только opacity и transform, всё внутри рамок"
    requirement: STAB-VIS-02
    verification:
      - kind: automated_ui
        ref: "tests/e2e/visual-candidates/phase20-art.spec.ts#D-59 the boards move (chromium-desktop, chromium-phone)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Предел 140/80 и контраст подписи 4.5:1 (кадр «Выключены» и пик всех анимаций, три акцента, PC и phone) сохранены; «Уменьшены»/«Выключены» дают законченный кадр без запущенных анимаций на досках"
    requirement: STAB-A11Y-04
    verification:
      - kind: automated_ui
        ref: "tests/e2e/visual-candidates/phase20-art.spec.ts#D-54 budget, D-54 peak, D-54 coverage, D-59 «Уменьшены»/«Выключены», UI E1, UI E2"
        status: pass
      - kind: automated_ui
        ref: "tests/e2e/specs/accessibility.spec.ts#full → off in the middle of an animation; off and reduced leave no looping UI motion"
        status: pass
    human_judgment: false
  - id: D5
    description: "Прочтение владельца «доски» и «волны у доски» совпадает с задуманным: что именно должно двигаться и как заметно"
    requirement: STAB-VIS-02
    verification: []
    human_judgment: true
    rationale: "Слова владельца («доскам и волнам которые были показаны которые прекрепленные к доске») толкуются планировщиком; заметность и вкус движения оценивает только владелец в галерее 20-54"
  - id: D6
    description: "Решения D-59..D-64 записаны в 20-CONTEXT.md дословными цитатами владельца с пометками «прочтение планировщика/оркестратора»"
    verification: []
    human_judgment: false
    rationale: "Документальная запись; проверяется grep (шесть строк D-59..D-64)"

duration: 41 min
completed: 2026-11-07
status: complete
---

# Phase 20 Plan 48: Фон «Лабораторные колбы» — один циферблат и живые доски Summary

**Манометр убран (остались одни тикающие часы), на четырёх досках фона 18 новых бесконечных анимаций только opacity/transform (бегущая синусоида осциллографа, «дышащая» линия и растущие столбики диаграммы, подсветка ячеек таблицы, качающиеся инструменты) — 136 на PC при пределе 140, 55 на телефоне при пределе 80, контраст подписей в пик не ниже 4,74.**

## Performance

- **Duration:** 41 min (Node 22.13.1 из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`, как в 20-42/20-47)
- **Started:** 2026-11-07T16:24:00Z (ориентир по первой сборке)
- **Completed:** 2026-11-07T17:08:00Z
- **Tasks:** 2 (Task 1 — tracer, Task 2 — auto)
- **Files modified:** 6
- **PLAN_BASE:** `5b0e961f048d2773de4107fd1127fea05fa1cf1a` (HEAD перед Task 1; в плане упомянут a5b81f9, фактически к старту HEAD уже 5b0e961 с теми же файлами рисунка)

## Accomplishments

- Убран круглый манометр целиком (константа, путь шкалы со стрелкой, поле benchPaths, элемент в `.wallpaper-flask-stand`, упоминания в комментариях); `grep -ci gauge components/portia-wallpaper.tsx` = 0. Часы (x 1258, y 414) не тронуты и целиком видны на телефоне (тест D-54 clock проходит на chromium-phone).
- Синусоида экрана осциллографа — отдельный элемент `.wallpaper-flask-scope-trace` под неподвижной клип-группой (`#wp-scope-clip`, прямоугольник экрана 918–996 × 466–546): та же форма (полуволны по 12, период 24), начало на два периода левее прежнего (x 874), длина до x 1018; `flask-scope` — `translateX(0 → 24px)`, linear, 2600 мс, фаза −900 мс.
- Остальные доски (по группам `.wallpaper-flask-board`): шесть столбиков диаграммы `flask-bar` (scaleY .6 ↔ 1.14 от основания y 446), линия поверх диаграммы `flask-chart-line` (scaleY .8 ↔ 1.2 от своей середины), четыре тёмные подсветки ячеек таблицы `flask-cell` (opacity 0 ↔ .42), шесть инструментов `flask-tool` (rotate ±3…5° от крючка, у каждого свой размах). Покоящееся значение — в базовом правиле элемента, анимации только под `html[data-motion="full"]`.
- Таблица циклов `boardCycles` (компонент) и `BOARD_CYCLES` (спек): 18 пар (длительность, фаза), все длительности (2,3–8,3 с) и все фазы попарно различны.
- Телефон: `.wallpaper-flask-board` добавлен в существующий `@container (max-aspect-ratio: 3/5)` рядом с `.wallpaper-flask-far`; движущиеся части досок на телефоне не отображаются и не считаются.
- Решения D-59..D-64 записаны в 20-CONTEXT.md; пункт D-59 с числами добавлен в 20-UI-SPEC.md; в todo колб — строка о 20-48 с полным hash; строка `<deferred>` дополнена («открыт вопрос 1 о колонках карточки шаблона, D-60»).

## Числа (набор `phase20-dev-flasks-d59`, chromium-desktop / chromium-phone)

| Показатель | PC | Phone | Предел |
|---|---|---|---|
| Бесконечных анимаций в рисунке (`flasks-animation-count--*.json`) | 136 (было 118) | 136 всего, **отображаемых 55** (было 55) | 140 / 80 |
| Контраст «Выключены», стандартный акцент | 6,677 | 10,843 | 4,5 |
| Контраст «Выключены», #1a1a1a | 6,973 | 11,430 | 4,5 |
| Контраст «Выключены», #f2f2f2 | 6,580 | 11,128 | 4,5 |
| Контраст в пик, стандартный акцент | 4,929 | 9,309 | 4,5 |
| Контраст в пик, #1a1a1a | 5,080 | 9,673 | 4,5 |
| Контраст в пик, #f2f2f2 | 4,742 | 9,490 | 4,5 |
| Пустых клеток (D-54 coverage) | 36 (HEAD 33552db: 78; доля 0,462 ≤ 0,6) | 24 (запись, не проверяется) | ≤ 60% от HEAD |
| Высота рисунка к высоте экрана | 0,558 | 0,558 | ≤ 0,62 |

Минимум контраста в пик на PC прежний (4,742 у #f2f2f2, было 4,742–5,080): подсветки ячеек тёмные и яркость не подняли.

## Правила спека: было — стало

| Правило | Было | Стало |
|---|---|---|
| D-54 budget (`MAX_INFINITE_ANIMATIONS`, `MAX_PHONE_ANIMATIONS`) | 140 / 80 | 140 / 80, без изменений (закреплено acceptance-grep) |
| D-54 peak ×3, D-54 coverage, flame, clock, shelf vessels | как есть | без изменений; все проходят |
| D-59 one clock | нет | новый: одна `.wallpaper-flask-clock`; ни один штрих стола и стены (путь семплируется вдоль контура, а не по общему box) не попадает в x 1084–1140, y 396–458; кругов с радиусом ≥ 20 вне часов нет |
| D-59 the oscilloscope wave moves | нет | новый: одна бесконечная linear-анимация только transform; сдвиг 0 / 12 / ~24 в начале, середине, конце цикла; путь `M{x≡922 mod 24} 520q6-26 12 0(t12 0)+` покрывает x 894–996; клип на группе, не на трассе; прямоугольник клипа = экран; в «Выключены» трасса на месте без анимации |
| D-59 the boards move | нет | новый: у каждой части ровно одна бесконечная анимация, свойства «только свои» (opacity у ячеек, transform у остальных), пары равны `BOARD_CYCLES`, все 18 длительностей и фаз различны; столбики растут и стоят на основании, не выходят за рамку диаграммы; линия «дышит» внутри рамки; инструменты качаются в обе стороны на 3–5°; ячейки ≤ .42; на телефоне части скрыты |
| D-59 «Уменьшены»/«Выключены» | нет | новый: четыре доски нарисованы, анимаций на досках 0, transform покоя единичный, ячейки .15 |
| `BOARD_CYCLES` | нет | таблица из 18 пар, меняется только вместе с `boardCycles` в компоненте |

## Task Commits

1. **Task 1 (tracer): RED** — `b1f4a7ce320a57af6fb40366d8a45fd3108ea14b` (test). Два теста D-59 «one clock» и «the oscilloscope wave moves» упали на HEAD 5b0e961 по ожидаемым причинам: «one clock» — штрих `M1088 424a24 24 0 1 0 48 0…` (манометр) внутри области; «wave moves» — нет ни одной анимации на `.wallpaper-flask-scope-trace` (0 из 1). В теле коммита `PLAN_BASE: 5b0e961f048d2773de4107fd1127fea05fa1cf1a`.
2. **Task 1 (tracer): GREEN** — `b4e26a479aae195482d075f2ee5d37f2c3e008e8` (feat). Манометр убран, трасса осциллографа бежит; тракер проверен сквозным прогоном на собранном сервере: 6 из 6 (два D-59, budget, три peak) — `⚡ Tracer verified end-to-end — expanding`.
3. **Task 2: доски** — `b003476abe7f0774d99ebdfc00a27d0819b32b1f` (feat) — **flask_fix_commit**: последний коммит плана, меняющий app и components.
4. **Task 2: документы** — `d869d72d7899a71dd04b78c9424537df2c76f560` (docs): D-59..D-64, UI-SPEC, todo.

**Plan metadata:** отдельный коммит `docs(PORTIA-20-48): complete …` с этим SUMMARY, STATE.md и ROADMAP.md (его в `commits:` выше нет: измерение сделано до него).

## Проверки (все с `--retries=0`)

- `phase20-art.spec.ts`, chromium-desktop + chromium-phone, `--grep-invert "spider|Паук|full walks|gait"`: **54 passed**, пропусков нет (UI E1, UI E2, D-54 coverage, D-54 budget, peak, wave trace и все D-59 — в числе прошедших).
- `accessibility.spec.ts` («full → off in the middle of an animation», «off and reduced leave no looping UI motion»), chromium-desktop: **2 passed**.
- `node --experimental-strip-types --test lib/*.test.ts`: 1546 тестов, 1542 pass, **0 fail**, 4 skipped (в том числе `lib/accent-theme.test.ts` проходит: бирюзовых литералов и относительного синтаксиса цвета нет).
- `tsc --noEmit`: код 0, ошибок нет.
- Lint: `npm run lint` и `npm exec` / `npx` падают на `node-gyp` (та же причина, что в 20-42/20-47), поэтому запущен `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`: **0 errors**, 17 warnings — все в каталоге артефактов `tests/e2e/visual-candidates/.runs/phase20-refresh-*/_work/*.mjs` (уже существовавшие, вне плана); `eslint` по двум изменённым TS-файлам — 0 замечаний.
- `git diff --exit-code --stat 5b0e961 -- tests/e2e/visual/__screenshots__` — код 0 (эталоны не тронуты); `.env*` не читались; сервер на 3100 остановлен после каждой сборки и в конце (`netstat` пуст; PID проверялся по командной строке `next start` проекта).

## Deviations from Plan

None — план выполнен как написан. Замечания по ходу, не являющиеся отступлениями от плана:

- Две ошибки в моих же новых тестах найдены и исправлены в Task 1 до GREEN-коммита: (1) при отрицательной фазе (−900 мс) чтение сдвига на `currentTime = 0` даёт не 0, а часть цикла — вспомогательная функция теперь прибавляет фазу и сворачивает время в один цикл (тот же приём, что в тесте пика); (2) `(x − 922) % 24` даёт `-0`, сравнение через `Math.abs`. Проверки сводились к самому тесту, рисунок не менялся.
- В тесте D-59 оговорка плана про `getBBox` заменена семплированием вдоль контура: у пути-«суммы» (например, кронштейны полки) общий box накрывает область манометра случайно, а в D-59 проверяется именно «ни одного штриха».
- В тестах «D-59 the boards move» на телефоне геометрия досок не измеряется (скрытый элемент не имеет box), там проверяется, что движущиеся части не отображаются.

## Issues Encountered

- Два сбоя, не воспроизведшихся при повторе: (а) один раз упал тест D-59 «oscilloscope» сразу после правки `-0` (вывод не сохранён; в изоляции и в последующих ≥5 прогонах проходит); (б) один раз упал `D-54 the flame flickers` на chromium-desktop с `[PORTIA_E2E_DIAGNOSTICS] 1 unexpected runtime event(s)` (посторонний runtime-событие страницы, не проверка рисунка; три повтора в изоляции и два полных прохода подряд — зелёные). Окружение прогонов — сервер `next start` в той же рабочей папке, данные цели без чтения секретов; причина диагностического события не выяснена и вынесена как наблюдение, не как закрытая причина.
- Расхождение базы плана: в плане указан HEAD a5b81f9, к старту был 5b0e961 (два docs-коммита после него изменили только планы 20-48..20-54); файлы рисунка совпадают с описанными в плане.

## Authentication Gates

None.

## Known Stubs

None — заглушек и пустых источников данных в изменённых файлах нет.

## Threat Flags

None — клиентский фон и документы; новых сетевых точек, путей авторизации, обращений к файлам и схем на границах доверия нет.

## Next Phase Readiness

- Готов 20-49 (причина ошибки скачивания шаблона, D-61); для 20-54 передаётся `flask_fix_commit: b003476abe7f0774d99ebdfc00a27d0819b32b1f` — по нему перезаписываются 12 строк `flasks-*` раздела 14 ledger.
- Прочтения «доски» и «волны у доски» (D-59 (2), (3)) нужно показать владельцу в галерее 20-54; предел 140/80 по-прежнему BLOCKED на реальном устройстве до 20-14 (этим планом не доказывается и не записывается как pass).

## Self-Check: PASSED

- Файлы изменены и существуют: `components/portia-wallpaper.tsx`, `app/portia.css`, `tests/e2e/visual-candidates/phase20-art.spec.ts`, `20-UI-SPEC.md`, `20-CONTEXT.md`, `.planning/todos/pending/2026-11-06-flasks-wallpaper-redo.md` — FOUND.
- Коммиты — предки HEAD: b1f4a7c, b4e26a4, b003476, d869d72 — FOUND; `git cat-file -e b003476abe7f0774d99ebdfc00a27d0819b32b1f^{commit}` — код 0.
- Acceptance Task 1: `grep -ci gauge` = 0; `scope-trace` в компоненте ≥ 1; `@keyframes flask-scope` ≥ 1; `D-59` в спеке ≥ 2 (4); предел `140,.MAX_PHONE_ANIMATIONS.=.80` = 1; `git status` по `__screenshots__` пуст — PASS.
- Acceptance Task 2: `BOARD_CYCLES` в спеке ≥ 2; `wallpaper-flask-board` в portia.css ≥ 1; шесть строк `- **D-59…D-64:**` в 20-CONTEXT.md; `прекрепленные к доске` ≥ 1; `D-59` в UI-SPEC ≥ 1; `20-48` в todo ≥ 1; `flask_fix_commit` — 40 hex, коммит существует; числа анимаций (136 PC, 55 phone) и 12 контрастов (≥ 4,742) записаны выше; порт 3100 не слушается — PASS.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
