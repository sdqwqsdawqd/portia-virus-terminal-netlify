---
status: resolved
trigger: "Почему всегда в 12 ночи, и hydration mismatch на body с cz-shortcut-listen"
created: 2026-10-28T00:00:00Z
updated: 2026-10-28T17:00:00Z
goal: find_and_fix
---

## Symptoms

- expected: календарный срок показывается без выдуманного времени; расширение браузера не создаёт dev-overlay
- actual: срок всегда подписан `00:00 МСК`; React сообщает о внешнем атрибуте `cz-shortcut-listen` на body
- reproduction: открыть «Повышение» для записи на cooldown; открыть сайт с расширением, добавляющим `cz-shortcut-listen`

## Current Focus

hypothesis: CONFIRMED. Таблица даёт только дату, но общий formatter добавлял время; suppressHydrationWarning стоял на html, а расширение изменяло непосредственно body.
test: Разделить календарный и точный formatter, добавить suppression на body и регрессионные проверки исходника.
expecting: cooldown не содержит `00:00`, точные retake-сроки сохраняют время, внешний атрибут body не вызывает overlay.
next_action: none

## Evidence

- 2026-10-28: Для Ablivion_2503 таблица хранит 04.11.2026; срок Академика 7 дней, поэтому календарная доступность начинается 11.11.2026.
- 2026-10-28: `cz-shortcut-listen` отсутствует в приложении и добавлен расширением браузера до hydration.
- 2026-10-28: Целевые тесты прошли; полный набор — 548 passed, 1 skipped; production build успешен.

## Eliminated

## Resolution

root_cause:
  Общий datetime-formatter показывал полночь для даты без временной точности. React сравнивал изменённый расширением body без локального suppression.
fix:
  Календарный cooldown отображает только дату через `formatCalendarDate`; точные retake-сроки сохраняют время. На body добавлен `suppressHydrationWarning`.
verification:
  10 целевых тестов, полный набор из 549 тестов и production build прошли.
files_changed:
  - components/portia-promotion.tsx
  - app/layout.tsx
  - lib/portia-promotion-ui.test.ts
  - lib/layout-hydration.test.ts
