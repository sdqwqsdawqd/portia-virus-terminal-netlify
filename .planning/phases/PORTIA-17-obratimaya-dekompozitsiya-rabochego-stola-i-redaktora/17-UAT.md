---
status: testing
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
source: [17-VERIFICATION.md]
started: 2026-11-01T00:00:00Z
updated: 2026-11-01T00:00:00Z
---

## Current Test

number: 1
name: Браузерный прогон window-reopen (STAB-DESK-01, CR-01)
expected: |
  `npm exec playwright -- test tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop --retries=0` печатает `1 passed`.
  Нужен безопасный источник чтения для NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY (сейчас BLOCKED (ENV)).
awaiting: user response

## Tests

### 1. Браузерный прогон window-reopen (STAB-DESK-01, CR-01)
expected: `npm exec playwright -- test tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop --retries=0` → `1 passed`. Сейчас BLOCKED (ENV): preflight не видит NEXT_PUBLIC_SUPABASE_ANON_KEY.
result: [pending]

### 2. Визуальный паритет (tests/e2e/visual, 5 проектов)
expected: прогон с `--update-snapshots=none` на всех 5 проектах совпадает с 17-PARITY-BASELINE.md, ни один baseline PNG не изменён. Сейчас BLOCKED (ENV).
result: [pending]

### 3. Ручной обход PORTIA OS на ПК и телефоне
expected: все 12 приложений открываются с ярлыка, start panel, taskbar и поиска; редактор и карточка досье выглядят и работают как до декомпозиции. Тело редактора для роли owner остаётся BLOCKED (ROLE) с Phase 15.
result: [pending]

### 4. Решение владельца по приёмке
expected: владелец решает, принять ли фазу без браузерного паритета, и куда уходят WR-01..03 и IN-01..03 (по 17-VERIFICATION.md — кандидат Phase 21).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
