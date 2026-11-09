---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 02
subsystem: desktop-motion
tags: [motion, css, boot-screen, settings, spider]
requires: [18-01]
provides:
  - "Заставка только в режиме «Включены», один раз за вкладку; в «Уменьшены» и «Выключены» не рендерится (CSS display:none + таймер 0)"
  - "Подсказка под «Анимации» (текст п. 4 из 18-MOTION-APPROVAL.md), переносится внутри окна"
  - "Каждое правило app/portia.css классифицировано reduced / оба; устаревшего значения режима и media-блока системной настройки нет"
  - "Паук и FLIP редактора смотрят только на html[data-motion]"
affects: [18-03, 18-04, 18-05, 18-06, 18-07]
tech-stack:
  added: []
  patterns: ["reduced = var(--motion-fast) fade; off = глобальное правило 18-01", "тест-скан: ни один нетестовый файл не читает системную настройку движения"]
key-files:
  created: []
  modified:
    - components/portia-desktop.tsx
    - app/portia.css
    - components/portia-wallpaper-spider.tsx
    - components/portia-editor-dossier.tsx
    - lib/accent-theme.test.ts
    - lib/portia-qualification-ui.test.ts
    - lib/portia-promotion-ui.test.ts
    - lib/wallpaper-web.test.ts
key-decisions:
  - "П. 6 (заставки нет в «Уменьшены») реализован: селектор html:is([data-motion=reduced],[data-motion=off]) .boot-screen; правила reduced для .boot-lines p, .boot-core > .portia-mark, .boot-thread удалены как мёртвые"
  - "Подсказка получает grid-column: 1 / -1, потому что children SettingGroup лежат внутри сетки .setting-options"
requirements-completed: []
requirements-pending: [STAB-MOTION-02, STAB-MOTION-06, STAB-MOTION-07]
requirements-already-complete: [STAB-MOTION-01]
duration: not measured
completed: 2026-11-02
status: complete
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: 86e78723540cd4949fe51ab9b1d729bacb21bd34
plan_head_after: bb61f83b2cc5f0ae95e457c6574176bc02c09747
---

# Phase 18 Plan 02: Режимы анимаций на каждой поверхности Summary

Заставка, окна, документы, контент, Вивьян, «Повышение» и смена обоев следуют матрице on / reduced / off; системная настройка движения не читается ни в CSS, ни в TS.

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 (tracer) | 4bda1f6 | `bootSkipped` (нет заставки вне full или при повторе в вкладке), sessionStorage пишется только после доигранной заставки; CSS скрывает `.boot-screen` в reduced/off; `.setting-hint` с утверждённым текстом |
| 2 | b7b1c6b | Тосты, «Повышение», раннер, стрелка: reduced+off без анимации. Окна: reduced = fade `--motion-fast`, выход fade 120ms `--ease-in`. Документы, контент, пузырь Вивьян, soft-анимации Вивьян: reduced `--motion-fast`. Новое `html[data-motion="reduced"] .assistant-button img { transition-duration }`. Обои: reduced 300ms, off — глобальное правило (нет пустого слоя). Удалён media-блок системной настройки |
| 3 | bb61f83 | Паук: `motionOn` = не reduced и не off, matchMedia и слушатель удалены. FLIP: выход при reduced/off. Тест-скан файлов components/lib/app |

## Верификация (Node 22.13.1)

- `npm test`: 830 тестов, 827 pass, 0 fail, 3 skipped (ранее существовавшие).
- `tsc --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (ранее существовавшие `<img>`).
- `npm run build`: успешно.
- `lib/phase15-visual-manifest.test.ts`: 37/37; `--verify-promotion`: «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (`--verify` не запускался); `playwright test --list`: 200 tests in 12 files (только перечисление).
- `git diff --name-only 86e7872..HEAD -- tests/e2e/visual .planning/phases/PORTIA-15-baseline components/portia-icons.tsx`: пусто.
- Acceptance greps: `data-motion="reduce"` = 0, `prefers-reduced-motion` в app/components/lib нетестовых = 0, `reduceQuery` = 0.
- TDD: тесты писались до кода; для Задачи 3 красный прогон подтверждён (падали скан файлов и проверка паука). Для Задач 1 и 2 красный прогон отдельно не снимался (тесты и код вносились до первого запуска) — зелёный результат после кода.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `.setting-hint` без `grid-column` попал бы в одну ячейку сетки**
- **Found during:** Задача 1
- **Issue:** children SettingGroup рендерятся внутри `.setting-options` (grid 3/2 колонки); подсказка заняла бы одну колонку и была бы узкой.
- **Fix:** добавлено `grid-column: 1 / -1` к `.setting-hint`.
- **Files modified:** app/portia.css
- **Commit:** 4bda1f6

Прочее: план выполнен как написан. Правило 18-01 по Вивьян offended: правило `.desktop-assistant.is-offended .assistant-button img` (строка ≈895) уже было статичным без префикса data-motion; добавлен только тест.

## Не проверено / BLOCKED

- Браузерная проверка (Playwright e2e, визуальные кадры): нет read data source и preflight env — BLOCKED, не pass. Заставка в живом браузере, перенос подсказки в окне «Настройки», поведение пузыря Вивьян у края (E7 overflow/long-text) и заголовка boot на узком phone (E5 overflow) — backstop-проверки владельца/18-07.
- Jank обоев и perf-traces — 18-07 (STAB-MEDIA-06 остаётся Pending).
- Видимое сравнение Вивьян с accent (saturate ≤ 1.08, brightness ≤ 1.1): значения фильтров в этом плане не менялись, визуально не сверялось.

## Requirements

- STAB-MOTION-01 уже отмечен выполненным в 18-01; этот план закрыл оставшиеся поверхности (CSS, паук, редактор).
- STAB-MOTION-02, -06, -07 остаются Pending: часть текста (reload в браузере, визуальная проверка Вивьян/accent, отсутствие jank и flash) не проверена в браузере. STAB-MOTION-08 и STAB-MEDIA-06 — Pending до 18-07.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Файлы существуют: components/portia-desktop.tsx, app/portia.css, components/portia-wallpaper-spider.tsx, components/portia-editor-dossier.tsx, четыре тестовых файла.
- Коммиты 4bda1f6, b7b1c6b, bb61f83 в истории; `git rev-list --count 86e7872..HEAD` = 3 до коммита SUMMARY.
