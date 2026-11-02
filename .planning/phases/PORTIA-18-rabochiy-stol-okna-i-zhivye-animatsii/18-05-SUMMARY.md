---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 05
subsystem: desktop-wallpaper-spider
tags: [spider, web, motion, pulses, css]
requires: [18-01, 18-02, 18-03]
provides:
  - "footfallThreads(x, y, heading, reach): ближайшая нить строго слева и строго справа от направления хода; волны на каждой постановке лап идут с обеих сторон тела"
  - "turnStep, besideThread, laneSideFor в lib/wallpaper-web.ts; MAX_TURN_RATE = 3.5 рад/с"
  - "PULSE_LIFE = 0.9 с (было 1.2)"
  - ".wallpaper-web-drift: общий слой покачивания паутины, волн и паука (<= 2px, только html[data-motion=full], одинаково при пауке on/off)"
  - "Обводка тела паука color-mix(in oklab, var(--teal) 38%, transparent), 1px non-scaling-stroke (18-MOTION-APPROVAL п. 3)"
  - "Паук виден и неподвижен в «Уменьшены»/«Выключены»; прячет его только переключатель data-spider=off"
affects: [18-07]
tech-stack:
  added: []
  patterns: ["чистые функции в lib + структурные тесты исходника компонента", "pose reset в sync при выходе из full"]
key-files:
  modified:
    - lib/wallpaper-web.ts
    - lib/wallpaper-web.test.ts
    - components/portia-wallpaper-spider.tsx
    - components/portia-wallpaper.tsx
    - app/portia.css
    - lib/accent-theme.test.ts
key-decisions:
  - "Обводка п. 3 применена; контраст D-07 выполнен тестом: обводка (accent при альфе .38 над --desktop-base) >= 1.5:1 к --desktop-base на teal, ice, amber, red"
  - "rand() в ветке выбора нового пути оставлен без использования результата, чтобы seeded-последовательность маршрутов не менялась"
  - "footfallThreads вызывается от позиции тела (x, y), а не от точки на нити маршрута"
requirements-completed: []
requirements-pending: [STAB-MOTION-03, STAB-MOTION-04]
duration: not measured
completed: 2026-11-02
status: complete
commits: 3
plan_head_before: f53e82ac784cd5b3cda246833530f852394be522
plan_head_after: d890daccbeb9bb07a1f67c3f5ed2e9654f927496
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase 18 Plan 05: Паук и паутина Summary

Волны идут по нитям с обеих сторон тела на каждой постановке лап и гаснут за 0.9s, тело разворачивается с ограничением 3.5 рад/с и не перескакивает на другую сторону нити, паутина, волны и паук качаются одним слоем, а вне «Включены» паук сидит неподвижно и виден.

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 (tracer) | aea93ba | `footfallThreads`, `PULSE_LIFE = 0.9`; на постановке лап `emitPulse` в обе стороны для каждой найденной стороны; прежний вызов по `pose.edge` удалён |
| 2 | 3173e73 | `turnStep`, `besideThread` (перенесён из компонента), `laneSideFor`, `MAX_TURN_RATE`; `relocateVisible()` по-прежнему ровно в двух местах (инициализация, `turnedOn`) |
| 3 | d890dac | `.wallpaper-web-drift` (обёртка в `DesktopWallpaper` для "radar"), `web-idle-drift` с кадрами `transform: none`, правило скрытия только по `data-spider="off"`, обводка тела, сброс позы и `clearPulses()` в `sync` вне full |

## Верификация (Node 22.13.1)

- `npm test`: 868 тестов, 0 fail. `tsc --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (прежние). `npm run build`: exit 0.
- `lib/wallpaper-web.test.ts` + `lib/accent-theme.test.ts`: 59 pass, 0 fail.
- Visual manifest: 37/37; `--verify-promotion`: «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (`--verify` не запускался).
- `playwright test --list`: 215 tests in 13 files.
- `git diff --name-only f53e82a..HEAD -- tests/e2e/visual .planning/phases/PORTIA-15-baseline`: пусто (подписанные PNG и baseline не тронуты).
- Незавершённая проверка (не засчитана как pass): в браузере паук в этом плане не запускался; плавность хода, отсутствие рывков и телепортаций, вид волн с обеих сторон, яркость паука относительно окон (E1 populated, запрет «слишком выделяется») требуют owner review и trace в 18-07. Контраст проверен только расчётом по токенам.

## Решения

- Обводка по п. 3 принята и применена (`.wallpaper-spider .wallpaper-spider-dark`, `paint-order: stroke`, чтобы видна была только внешняя половина). Заливка прежняя.
- Покачивание перенесено с `.wallpaper-web` (условие data-spider=off) на общий слой; прежние правила `html[data-motion="full"][data-spider="off"] .wallpaper-web` удалены, тест переписан.
- `html:is([data-motion="reduced"],[data-motion="off"]) .wallpaper-spider { display: none }` убран: в этих режимах паук виден, анимация CSS отключена общим правилом `animation: none`.
- `lib/wallpaper-web.ts` показывается в `git status` как изменённый только из-за окончаний строк (содержимое не отличается); он закоммичен в Task 1/2 и в Task 3 не стейджился.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Тесты, привязанные к прежним значениям, обновлены вместе с кодом**
- **Found during:** Task 1, Task 3
- **Issue:** Существующие тесты фиксировали `PULSE_LIFE = 1.2` (смерть пульса в 1.19/1.21 с, `pulseShape(…, 1.2)`), правило покачивания `.wallpaper-web` при `data-spider=off` и `display:none` для reduced/off, что прямо противоречит новому контракту плана.
- **Fix:** Значения переведены на 0.9 с, тест покачивания переписан под `.wallpaper-web-drift`, правило скрытия в `accent-theme.test.ts` оставлено только для `data-spider="off"` и добавлена проверка, что режимы движения паука не скрывают.
- **Files modified:** lib/wallpaper-web.test.ts, lib/accent-theme.test.ts
- **Commits:** aea93ba, d890dac

Прочее: план выполнен как написан.

## Known Stubs

None.

## Threat Flags

None. Новых сетевых путей, ввода пользователя или доступа к файлам нет. T-18-09: пул фиксирован (`PULSE_SLOTS = 8`), `footfallThreads` вызывается только на постановке группы лап (порядка нескольких раз в секунду при ходьбе), перебор нитей с отсечением по расстоянию; нагрузка по трассам остаётся на 18-07.

## Self-Check: PASSED

- Файлы существуют: lib/wallpaper-web.ts, lib/wallpaper-web.test.ts, components/portia-wallpaper-spider.tsx, components/portia-wallpaper.tsx, app/portia.css, lib/accent-theme.test.ts.
- Коммиты aea93ba, 3173e73, d890dac присутствуют в истории ветки.
