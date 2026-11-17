---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 03
subsystem: desktop-shortcuts
tags: [motion, css, shortcuts, drag, layout]
requires: [18-01, 18-02]
provides:
  - "12 ярлыков на одной системе цикла: 560ms на часть, сдвиг ≤ 90ms, весь цикл ≤ 650ms (≤ 700), --ease-out действие / --ease-in возврат, последний кадр = покой"
  - "Правила цикла вне @media (hover: hover) под html:not([data-motion=\"off\"]): играют на hover, focus и касании, в «Включены» и «Уменьшены», не в «Выключены»"
  - "lib/shortcut-layout.ts: чистая clampShortcutPosition (зажим в зону с отступом 8px, обход препятствий)"
  - "Drag ярлыка: зажим при движении, при отпускании — вне .desktop-assistant и .global-format-launch; свободный drag выключен на ≤ 900px"
affects: [18-07]
tech-stack:
  added: []
  patterns: ["таймер 700ms вместо animationend (скрытая вкладка)", "тест-помощник iconCycles/keyframesBody разбирает app/portia.css по имени иконки"]
key-files:
  created:
    - lib/shortcut-layout.ts
    - lib/shortcut-layout.test.ts
  modified:
    - app/portia.css
    - components/portia-desktop-shortcuts.tsx
    - lib/portia-desktop.test.ts
key-decisions:
  - "Ease-in на возврат стоит на ключевом кадре пика (сегмент пик → покой); keyframes без промежуточных кадров (write-16, info-line) возврата не имеют"
  - "StartPanelButton также стартует цикл по pointerdown (касание), как DraggableDesktopIcon"
  - "Стрелка «Повышения» убрана из правила «оба» (animation: none): её анимирует только цикл ярлыка, поэтому в «Уменьшены» она играет, в «Выключены» не играет (через префикс)"
requirements-completed: []
requirements-pending: [STAB-MOTION-05, STAB-DESK-06]
duration: not measured
completed: 2026-11-02
status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: 5d4c939f62d48263e7b68552a886ee42b159879b
plan_head_after: 4c2c59ef8e17552382f87bfa469d5637a8a76740
---

# Phase 18 Plan 03: Единая система ярлыков и безопасный drag Summary

Все 12 ярлыков играют один утверждённый цикл (560ms, сдвиг частей до 90ms) без перерисовки artwork, а drag двигает только выбранный ярлык и оставляет его в видимой зоне вне Вивьян и кнопки форматирования.

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 (tracer) | 85af8c3 | «Настройки» по новой системе; глобальное правило «Уменьшены» не трогает svg ярлыков (`*:not(:is(.desktop-icon-symbol, .start-panel-icon) svg, … svg *)`, то же для `::before/::after`); `shortcutAnimationMs = 700`; start-panel кнопки стартуют и по pointerdown; тест-помощник и тесты |
| 2 | e4decec | Остальные 11 ярлыков: обёртка hover убрана, префикс `html:not([data-motion="off"])`, длительность 560ms, задержки приведены (110/135/140 → 90ms, остальные пропорционально), cubic-bezier заменены на `var(--ease-out)`, ease-in на возврате в 21 keyframes; `components/portia-icons.tsx` не менялся |
| 3 | 4c2c59e | `clampShortcutPosition` + 9 тестов; handlePointerMove и finishDrag используют её; гейт `matchMedia("(max-width: 900px)")`; `savedShortcutLayout` с отступом 8px и запасом 118/128px |

## Верификация (Node 22.13.1)

- `npm test`: 845 тестов, 842 pass, 0 fail, 3 skipped (ранее существовавшие). `tsc --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (ранее существовавшие `<img>`). `npm run build`: успешно.
- `lib/phase15-visual-manifest.test.ts`: 37/37; `--verify-promotion`: «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (`--verify` не запускался); `playwright test --list`: 200 tests in 12 files (только перечисление).
- `git diff --name-only 5d4c939..HEAD -- components/portia-icons.tsx tests/e2e/visual .planning/phases/PORTIA-15-baseline`: пусто.
- Acceptance: `cubic-bezier(.2,.72,.25,1)` / `(.2,.85,.25,1)` = 0; `@media (hover: hover)` остался один (карточки «Справочника»); `window.innerWidth <= 520` = 0.
- TDD: тесты Задач 1 и 3 писались до кода; красный прогон Задачи 1 снят (3 падения до CSS). Для Задачи 2 тест 12 иконок был расширен вместе с CSS (красный прогон отдельно не снимался).

## Deviations from Plan

**1. [Rule 3 - Blocking] Номера строк и префикс в plan устарели**
- В plan ожидался двухпробельный префикс и `@media` ≈1552; фактически это `  html[data-motion="full"] …` внутри media. Тесты ≈236–298 обновлены под новый префикс; сохранены список жестов и проверка `both;`.

**2. [Rule 1 - Bug] Тест `savedShortcutLayout` ожидал старые константы (`max(0px … 100px)`)**
- Обновлён под `max(8px, … calc(100% - 118px))` / `128px` (коммит 4c2c59e).

Прочее: план выполнен как написан. Комментарий-шапка системы цикла лежит над блоком «Настройки» (после остальных иконок, перед `@keyframes`) — только порядок в файле.

## Не проверено / BLOCKED

- Браузер/visual: фактическое воспроизведение цикла (hover, focus, касание), совпадение последнего кадра с покоем по пикселям, поведение в «Уменьшены»/«Выключены», touch-открытие приложения и drag по реальным Вивьян/кнопке форматирования — Playwright e2e и кадры кандидатов: нет read data source и preflight env, BLOCKED, не pass. Кадры кандидатов снимаются в 18-07.
- `sheet`/`editor` используют `stroke-dasharray: 16` только на время цикла (прежнее поведение, не менялось); совпадение с покоем по dash-геометрии проверяется глазом в 18-07.
- Wallpaper jank / perf-traces — 18-07.

## Requirements

STAB-MOTION-05 и STAB-DESK-06 остаются **Pending**: часть текста (кадры/geometry/viewBox/filter, открытие мышью, клавиатурой и touch, поведение drag в браузере) не проверена в браузере. STAB-MOTION-08 и STAB-MEDIA-06 — Pending до 18-07.

## Known Stubs

None.

## Threat Flags

None. T-18-05 и T-18-06 закрыты: CSS-зажим 8px/118px/128px и `clampShortcutPosition` с препятствиями при drop; тесты пересечения в `lib/shortcut-layout.test.ts`.

## Self-Check: PASSED

- Файлы существуют: lib/shortcut-layout.ts, lib/shortcut-layout.test.ts, app/portia.css, components/portia-desktop-shortcuts.tsx, lib/portia-desktop.test.ts.
- Коммиты 85af8c3, e4decec, 4c2c59e в истории; `git rev-list --count 5d4c939..HEAD` = 3 до коммита SUMMARY.
