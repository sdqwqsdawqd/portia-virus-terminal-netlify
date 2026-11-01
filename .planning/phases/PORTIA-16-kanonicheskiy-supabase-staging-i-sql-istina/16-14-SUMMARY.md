---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 14
subsystem: database
tags: [production-postflight, fingerprint, drift, migration, rls-review, requirements]
requires: [16-11, 16-12, 16-13]
provides:
  - evidence/fingerprint-production.json (owner-run, read-only) и 16-PRODUCTION-POSTFLIGHT.md (итог DRIFT, 4 ключа классифицированы)
  - миграция 20261101000200_portia_drop_legacy_promo_overloads.sql (drop двух legacy RPC overloads)
  - итоговый 16-LIVE-RUN.md (Production postflight, Итог фазы)
  - диспозиции WR-01 (fixed) и IN-03 (partial) в 15-REVIEW-DISPOSITION.md
affects: [owner-run шаг применения миграций к production, supabase-rls-reviewer]
commits: 4
plan_head_before: 607e7907c9a7370f46b4d54db887d52fc7612ac5
plan_head_after: d79732e2f4d325bcbf97608a985d501ab1dd01e3
estimate:
  tokens: 50000
actuals:
  tokens: 21000
  tasks: 3
  commits: 4
key-files:
  created:
    - supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-production.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/16-PRODUCTION-POSTFLIGHT.md
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/fingerprint-postdrop.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/receipt-roles-postdrop.json
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/receipt-concurrency-postdrop.json
  modified:
    - lib/portia-canonical-parity.test.ts
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/16-LIVE-RUN.md
    - .planning/phases/PORTIA-15-baseline/15-REVIEW-DISPOSITION.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "Production DRIFT закрывается forward-only миграциями, а не правкой замороженных файлов; к production миграции НЕ применялись (решение владельца, D5)."
  - "Legacy overloads удаляются отдельной миграцией (вариант A владельца), golden не пересчитывается: на каноническом build drop no-op."
  - "STAB-SEC-04 остаётся Pending (production != golden); STAB-REL-04 Complete по receipts 16-10..16-13 и повторному прогону после drop."
requirements-completed: [STAB-REL-04]
status: complete
---

# Phase 16 Plan 14: production postflight, закрытие фазы Summary

Owner-run fingerprint production сравнён с canonical: DRIFT в 4 ключах (sequence ACL, два legacy RPC overload в production, платформенная `rls_auto_enable` как info), добавлена миграция `20261101000200`, изолированная цель после неё равна golden и живой suite 770/770.

## Что сделано

- **Задача 1 (чекпоинт владельца):** владелец сверил sha256 SQL (`80c01284...1851`) и сохранил результат production в `evidence/fingerprint-production.json` (PG major 17, UTF-8 BOM). Агент production не касался. Файл закоммитан (`eee182f`), компаратор научен снимать BOM (`607e790`, до этой сессии).
- **Задача 2 (postflight):** `evidence/16-PRODUCTION-POSTFLIGHT.md`, итог DRIFT. Сравнение golden vs production: exit 1, четыре ключа; сравнение с U0: те же плюс ожидаемая разница `search_path` у `portia_editor_is_approved` (production уже canonical, то есть признаков дрейфа A1 нет). Коммит `4075b7f`.
- **Исправление (решение владельца, вариант A):** миграция `supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql` с двумя `drop function if exists` (сигнатуры `(uuid, jsonb)` и `(uuid, jsonb, text)`, ничего больше). Вызовов старых сигнатур нет: `app/api/promotion/banks/route.ts` и live-тесты используют `(p_request_id, p_bank_id, p_bank_version, ...)`. Hash закреплён в `lib/portia-canonical-parity.test.ts` (`a77bff4`).
- **Проверка на изолированной цели через wrapper:** `push` (применена 20261101000200, журнал Local == Remote), `fingerprint postdrop`, comparator golden vs postdrop: **exit 0**; `npm run test:staging-live`: 770 tests, 770 PASS, 0 FAIL, 0 BLOCKED, residual 0 (receipts roles и concurrency скопированы в evidence как `*-postdrop.json`).
- **Задача 3:** `16-LIVE-RUN.md` (Production postflight и Итог фазы: SC1-3, таблица fingerprints, оставшиеся BLOCKED с владельцами), WR-01 -> fixed (16-05 `cac51e1`, lanes 16-13), IN-03 -> partial (безопасная часть fixed в 16-03 `3833224`/`e556a52`, косметическая deferred), `REQUIREMENTS.md`. Коммит `d79732e`. `scan-evidence`: 0 находок; `bash .claude/skills/portia-check/run.sh`: all checks passed.

## Дельта production и решение по требованиям

| Ключ | Класс | Закрывается |
|------|-------|-------------|
| sequence `portia_promo_audit_events_id_seq` (anon/authenticated SELECT/UPDATE/USAGE) | ожидаемое (D9) | `20261101000100` |
| `portia_promo_confirm_assignment(uuid, jsonb)`, `portia_promo_confirm_test(uuid, jsonb, text)` | дрейф: legacy SECURITY DEFINER overloads, EXECUTE у authenticated, могут обходить bank/version-проверки | `20261101000200` |
| `rls_auto_enable()` (только в golden) | info: платформенная функция новых проектов Supabase | не требуется |

Обе миграции к production не применены. Нужен owner-run шаг: применить их и повторно снять fingerprint тем же SQL.

- **STAB-SEC-04: Pending.** Production не равен canonical, равенство не доказано; в `REQUIREMENTS.md` добавлена пометка со ссылкой на postflight.
- **STAB-REL-04: Complete.** Полный текст доказан receipts: свежая canonical-сборка (16-10/16-11: fresh == U == final == golden), role/RLS/RPC (748 проверок + revoke, 16-12), concurrency claim/admission/CAS/cleanup (8 гонок N=6 x R=10 и HTTP CAS, 16-12/16-13), всё на disposable fixtures с residual 0; повторно подтверждено после новой миграции.
- STAB-SEC-01 уже был Complete (16-13), не менялся.

## Deviations from Plan

**1. [Rule 2 - Security, решение владельца] Добавлена миграция `20261101000200`**
- **Found during:** Задача 2 (сравнение production)
- **Issue:** на production остались legacy SECURITY DEFINER overloads RPC, которые обходят bank/version-проверки.
- **Fix:** forward-only drop двух сигнатур, hash в parity-тесте, проверка на изолированной цели.
- **Files modified:** `supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql`, `lib/portia-canonical-parity.test.ts`
- **Commit:** `a77bff4`

Остальное выполнено по плану. Дополнительно в evidence добавлены `fingerprint-postdrop.json` и два `*-postdrop` receipts (повторная верификация).

## Для оркестратора

**В этом плане добавлен файл `supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql`: нужно запустить агента `supabase-rls-reviewer`** (CLAUDE.md: изменения `supabase/*.sql`, RLS, RPC).

**Ревью `supabase-rls-reviewer` выполнено:** critical/high по миграции нет; сигнатуры drop совпадают с production `(uuid, jsonb)` и `(uuid, jsonb, text)`, 4-аргументные версии не задеваются; CASCADE не нужен; вызывающих старые сигнатуры нет.

**Серьёзность находки на production — medium** (оркестратор прочитал тела из `4d527f6^:supabase/portia_setup.sql`). Обе старые функции проверяют `portia_has_tab_grant('promo')` и `status='claimed' and reviewer_id = auth.uid()`, но без банка и версии: ревьюер с вкладкой promo мог для своей взятой заявки передать собственные тексты заданий, вопросы и `answer_key`; старая `confirm_test` к тому же сразу ставила попытку в `active` с дедлайном, минуя `prepared`. Анонимного доступа и доступа к чужим заявкам нет. Дыра открыта на production, пока не применена `20261101000200`. Регрессионный тест против повторного создания этих сигнатур добавлен в `lib/portia-canonical-parity.test.ts`.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: миграция только убирает функции.

## Self-Check: PASSED

Файлы миграции, postflight, fingerprint-production/postdrop, receipts postdrop, parity-тест существуют; коммиты `eee182f`, `a77bff4`, `4075b7f`, `d79732e` найдены в истории; `git rev-list --count 607e790..HEAD` = 4.
