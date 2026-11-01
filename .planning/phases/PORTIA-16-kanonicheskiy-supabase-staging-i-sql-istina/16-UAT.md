---
status: complete
phase: PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina
source: [16-VERIFICATION.md]
started: 2026-11-01T21:30:00Z
updated: 2026-11-01T15:58:47.745Z
---

## Current Test

[testing complete]

## Tests

### 1. Владелец применяет миграции 20261101000100 и 20261101000200 к production и повторно снимает fingerprint тем же SQL
expected: Сравнение golden vs production не показывает отличий по sequence portia_promo_audit_events_id_seq и по двум legacy overload; остаётся только rls_auto_enable()
result: pass
reported: "Оба success, fingerprint after сохранён"
evidence: "node scripts/phase16-fingerprint-compare.mjs supabase/fingerprint/expected/portia.fingerprint.json evidence/fingerprint-production-after.json -> exit 1, comparable true, diff только functions: public.rls_auto_enable(); см. evidence/16-PRODUCTION-POSTFLIGHT.md"

### 2. Правило закрытия STAB-SEC-04 при остаточной разнице rls_auto_enable()
expected: Записано правило, по которому повторный production postflight даёт однозначный PASS
result: pass
reported: "A"
evidence: "Вариант A: компаратор без allowlist; MATCH, если единственное отличие — functions: public.rls_auto_enable(). Записано в evidence/16-PRODUCTION-POSTFLIGHT.md, раздел «Правило закрытия»"

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
