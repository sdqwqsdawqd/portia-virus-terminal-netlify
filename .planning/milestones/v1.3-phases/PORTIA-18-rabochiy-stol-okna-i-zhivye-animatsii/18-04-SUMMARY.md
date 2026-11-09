---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 04
subsystem: desktop-windows
tags: [windows, geometry, motion, web-animations, e2e]
requires: [18-01, 18-02]
provides:
  - "nodWindow(app): «кивок» уже открытого окна через Web Animations (translate 0 -2px 0, 240ms, --ease-out), только в «Включены», не при квалификации; WindowState не меняется"
  - "dragGeometry: вертикаль с отступом 8px сверху и снизу (вариант A владельца, п. 7); окно выше области подгоняется"
  - "Тесты геометрии: 8 краёв resize, граница 8px ±1px, дробные bounds 1535.2 × 763.2, нулевые bounds"
  - "tests/e2e/specs/desktop-windows.spec.ts: [STAB-DESK-02/03/04]"
affects: [18-06, 18-07]
tech-stack:
  added: []
  patterns: ["Web Animations вместо класса: CSS-анимация открытия не перезапускается", "структурные тесты через componentFamily + bodyAfter"]
key-files:
  created:
    - tests/e2e/specs/desktop-windows.spec.ts
  modified:
    - components/portia-desktop-window.tsx
    - components/portia-desktop.tsx
    - lib/window-geometry.ts
    - lib/window-geometry.test.ts
    - lib/window-open.test.ts
key-decisions:
  - "п. 7 = вариант A: dragGeometry считает вертикаль так же, как горизонталь; Math.round не добавлялся"
  - "WINDOW_NOD_MS = 240 (верхняя граница п. 2); амплитуда 2px, пик на offset 0.4"
requirements-completed: []
requirements-pending: [STAB-DESK-02, STAB-DESK-03, STAB-DESK-04]
duration: not measured
completed: 2026-11-02
status: complete
actuals:
  tokens: 6300
  tasks: 3
  commits: 3
plan_head_before: 56541c5f25c786ba5f09a3f57507d9432f64e97e
plan_head_after: d5f4f47fa21160123017f345185e3d3e54e3dd97
---

# Phase 18 Plan 04: Надёжность окон Summary

Повторное открытие видимого окна даёт короткий кивок (translate по Y, 240ms) без изменения состояния, drag окна держит 8px со всех сторон, а геометрия и контракт phone доказаны unit-тестами и браузерным spec на PC, DPR 1.25 и phone.

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 (tracer) | 703e99b | `data-window-app`, `WINDOW_NOD_MS`, `nodWindow`; `else if (!qualificationLocked) nodWindow(appId);` в `openApp`; структурный тест (красный до кода) |
| 2 | b947fa0 | `dragGeometry` вариант A; тесты 8 краёв, границы ±1px, DPR 1.25, tiny bounds; структурные тесты блокировок квалификации и refit |
| 3 | d5f4f47 | `desktop-windows.spec.ts` ([STAB-DESK-02], [-03], [-04]) |

## Верификация (Node 22.13.1)

- `npm test`: 861 тест, 858 pass, 0 fail, 3 skipped (ранее существовавшие). `tsc --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (ранее существовавшие). `npm run build`: успешно.
- `window-geometry.test.ts`: 22 теста, 0 fail; `Math.round` в `lib/window-geometry.ts` = 0.
- Visual manifest: 37/37; `--verify-promotion`: «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» (`--verify` не запускался).
- `playwright test --list`: 215 tests in 13 files; три теста с тегами STAB-DESK-02/03/04.
- Playwright `desktop-windows.spec.ts` на chromium-desktop, chromium-dpr125, chromium-phone, webkit-phone, `--retries=0`: **6 passed, 6 skipped** (PC-тесты пропущены на phone-проектах, phone-тест на PC-проектах). Preflight `visitor`, данные не нужны.
- `git diff --name-only 56541c5..HEAD -- app/portia.css tests/e2e/visual`: пусто.
- TDD: структурный тест Задачи 1 был красным до кода; тесты геометрии писались до правки `dragGeometry` (красные ожидания y = 8 и y = desk.height − height − 8 отдельно не снимались, правка одной функции).

## Deviations from Plan

**1. [Rule 1 - Bug] Ошибки в собственных тестах при первом прогоне**
- Тест resize с `frame.y = 300` упирался в нижний inset (592 вместо 600) — `frame.y` изменён на 200; тест дробных bounds сравнивал insets у окна меньше области — стартовые размеры увеличены до подгонки (5000) / добавлен отдельный `narrow`-кейс для нецелого x. Код не менялся.

**2. [Rule 3 - Blocking] Ярлыки закрыты окнами в e2e**
- В spec «Настройки» и повторное открытие поиска идут через start panel (как в `window-reopen.spec.ts`), потому что каскадные окна перекрывают ярлыки; перед «Свернуть Глобальный поиск» поиск выводится вперёд через таскбар, иначе «Настройки» перехватывают клик.

Прочее: план выполнен как написан. Duration не измерялась.

## Не проверено / BLOCKED

- Браузерное поведение кивка (визуально, реальная амплитуда) и его отсутствие при активной квалификации: кивок покрыт структурными тестами и проверкой «возврат в покой за 400ms» в spec; сам кадр и matrix on/reduced/off в браузере не снимались (18-07).
- Активная квалификация в браузере (запрет drag/resize/maximize/close/minimize фона): нужен аутентифицированный сценарий и data source — BLOCKED, не pass. Закреплено структурными тестами и существующим `lib/portia-qualification-ui.test.ts`.
- В браузере resize проверен за `w` и `se`; остальные 6 краёв — только unit-тесты `resizeGeometry`.
- STAB-DESK-02 «reflow содержимого без обрезки», STAB-DESK-04 «не перекрываются fixed/sticky controls и клавиатурой»: перекрытие Вивьян — 18-06 (вариант A: скрыть на phone при открытом окне); виртуальная клавиатура — физическое устройство, BLOCKED.
- CSS-дефектов phone этот прогон не выявил (нет горизонтального overflow, окно между system bar и таскбаром).

## Requirements

STAB-DESK-02, STAB-DESK-03, STAB-DESK-04 остаются **Pending**: часть текста (reflow содержимого, поведение квалификации в браузере, fixed/sticky и клавиатура на phone) не проверена. STAB-MOTION-08 и STAB-MEDIA-06 — Pending до 18-07.

## Known Stubs

None.

## Threat Flags

None. T-18-07 закрыт: кивок под `!qualificationLocked`, структурные тесты блокировок. T-18-08 закрыт: тесты нулевых/малых/дробных bounds.

## Self-Check: PASSED

- Файлы существуют: tests/e2e/specs/desktop-windows.spec.ts, lib/window-geometry.ts, lib/window-geometry.test.ts, lib/window-open.test.ts, components/portia-desktop-window.tsx, components/portia-desktop.tsx.
- Коммиты 703e99b, b947fa0, d5f4f47 в истории; `git rev-list --count 56541c5..HEAD` = 3 до коммита SUMMARY.
