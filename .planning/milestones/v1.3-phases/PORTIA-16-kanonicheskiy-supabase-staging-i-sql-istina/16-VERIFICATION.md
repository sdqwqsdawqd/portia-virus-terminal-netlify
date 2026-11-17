---
phase: PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina
verified: 2026-11-01T21:00:00Z
status: passed
score: 3/3 roadmap success criteria verified (STAB-SEC-04 production-часть вне score: ожидает владельца)
covered_files:
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-01-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-01-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-02-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-02-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-03-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-03-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-04-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-04-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-05-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-05-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-06-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-06-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-07-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-07-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-08-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-08-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-09-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-09-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-10-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-10-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-11-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-11-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-12-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-12-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-13-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-13-SUMMARY.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-14-PLAN.md
  - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-14-SUMMARY.md
  - scripts/phase16-fingerprint-compare.mjs
  - supabase/fingerprint/portia_schema_fingerprint.sql
  - supabase/migrations/20261101000000_portia_baseline.sql
  - supabase/migrations/20261101000100_portia_explicit_grants.sql
  - supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql
covered_digest: "v3:sha256:431e3803ad0f678bbdeeb7839da1488016ccf247bb238f6cae0704cacc79a2bc"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Владелец применяет миграции 20261101000100 и 20261101000200 к production, затем повторно снимает fingerprint тем же SQL (sha256 80c01284...1851) в Dashboard SQL Editor и кладёт результат в evidence/"
    expected: "Сравнение golden vs production показывает отсутствие отличий по sequence portia_promo_audit_events_id_seq и по двум legacy-overload; остаётся только rls_auto_enable() (см. предупреждение о компараторе)"
    why_human: "Агенту запрещено касаться production (CLAUDE.md, D5); применение миграций и снятие fingerprint на production делает только владелец"
  - test: "Решить, как считать закрытым STAB-SEC-04 при остаточной разнице rls_auto_enable(): добавить в компаратор явный allowlist платформенных функций либо принять exit 1 с задокументированным исключением"
    expected: "Записанное правило, по которому повторный production-postflight даёт однозначный PASS"
    why_human: "Postflight обещает 'exit 0 с учётом info rls_auto_enable', но компаратор не помечает функцию как info (см. Gaps Summary); выбор политики принадлежит владельцу"
---

# Фаза 16: отчёт верификации

**Цель фазы:** Канонические миграции и изолированный staging дают доказуемо одинаковую схему и безопасное поведение ролей, RLS/RPC и конкурентных операций.
**Проверено:** 2026-11-01
**Статус:** human_needed
**Повторная верификация:** нет, первичная

## Итог

Все три Success Criteria из ROADMAP подтверждены на изолированной цели и подкреплены моими собственными перепроверками офлайн (компаратор fingerprints, `npm test`, tsc, lint). Требование STAB-SEC-04 (production == canonical) честно остаётся не выполненным: production в состоянии DRIFT, миграции закрытия не применены. Это не дефект кода, а ожидающий шаг владельца; никакая более поздняя фаза ROADMAP его не забирает, поэтому он не "отложен", а требует решения человека. Live-прогоны на staging я не повторял (guard и ограничения верификации это запрещают); их результаты приняты по коммитным receipts и согласованы с независимо проверенными артефактами.

## Достижение цели

### Наблюдаемые истины (Success Criteria из ROADMAP)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | Свежий изолированный Supabase только из canonical migrations даёт тот же fingerprint функций, grants, policies, RLS, что upgrade-путь | VERIFIED | Сам запустил `node scripts/phase16-fingerprint-compare.mjs`: golden (`fingerprint-fresh.json`) vs `fingerprint-upgrade.json` exit 0, diff `{}`; vs `fingerprint-final.json` (после teardown и повторного push) exit 0; vs `fingerprint-postdrop.json` exit 0. В migrations ровно три файла (baseline, explicit grants, drop legacy overloads); parity-тест baseline == `portia_setup.sql` входит в зелёный `npm test` |
| 2 | Anon, authenticated, editor, reviewer, owner через UI, API, таблицы и RPC видят и меняют только разрешённое; revoke действует сразу; fail-closed | VERIFIED (по receipts) | `receipt-roles.json` и `receipt-roles-postdrop.json`: status PASS, residual 0 по всем 5 категориям; 16-LIVE-RUN: 748 проверок матрицы ролей x поверхностей (RPC 216, таблицы 491, Storage 36), 3 revoke-теста на той же сессии; `receipt-playwright.json`: PASS, residual 0, 4 привилегированные lane x 5 проектов, API-матрица 7 маршрутов x 5 ролей, revoke без re-login. Файлы live-тестов и спеков присутствуют. Сам live не повторял |
| 3 | Guarded live suite на disposable fixtures доказывает concurrent claim/admission/CAS/cleanup, RLS и RPC без production и без повторного победителя | VERIFIED (по receipts) | `receipt-concurrency.json` и `-postdrop.json`: 8 гонок N=6 x R=10, все PASS, residual 0; HTTP CAS 6 x 10 в Playwright: в каждом раунде один 200 и пять 409. Аттестация цели ATTESTED (refHash `01d085e7b9f0`), production-ref блокируется (`self-test-production-block` blocked 1/1). Оговорка: само перекрытие запросов в гонке тестом напрямую не измеряется, об этом честно сказано в 16-LIVE-RUN (A9) |

**Оценка:** 3/3 критериев ROADMAP подтверждены. Behavior-dependent истины (CAS, revoke, гонки) опираются на ранее выполненные live-прогоны, а не на повторный запуск в этой верификации; расхождения с receipts не найдено.

### Acceptance gate

"Live mutating staging-run и schema fingerprints обязательны": выполнено для изолированной цели (receipts выше, fingerprints golden == U == final == postdrop). Для production снят fingerprint владельцем (результат DRIFT), это отдельно описано ниже.

### Покрытие требований

| Требование | Статус | Evidence |
|------------|--------|----------|
| STAB-SEC-01 | SATISFIED | Role matrix, revoke, UI/API lanes, receipts PASS; в REQUIREMENTS отмечено Complete, расхождения нет |
| STAB-REL-04 | SATISFIED | Fresh build только из migrations, fingerprints, 770/770 live, 8 гонок, residual 0; REQUIREMENTS Complete, расхождения нет |
| STAB-SEC-04 | BLOCKED, ожидает владельца | Staging доказан; production != golden (ниже). REQUIREMENTS корректно держит Pending |

Осиротевших требований Phase 16 в REQUIREMENTS нет.

### Production postflight (STAB-SEC-04)

Мой независимый прогон компаратора `fingerprint-fresh.json` vs `fingerprint-production.json`: exit 1, comparable true, diff:

- functions: `portia_promo_confirm_assignment(p_request_id uuid, p_items jsonb)`, `portia_promo_confirm_test(p_request_id uuid, p_questions jsonb, p_client_mode text)`, `rls_auto_enable()`;
- tables: `portia_promo_audit_events_id_seq` (ACL).

Это в точности совпадает с `evidence/16-PRODUCTION-POSTFLIGHT.md`. Два legacy overload остаются SECURITY DEFINER с EXECUTE у authenticated на production и в принципе вызываемы напрямую через PostgREST (severity medium, по классификации плана; приложение их не вызывает). Закрывают их миграции `20261101000200` и `20261101000100`: файлы существуют, `20261101000200` содержит ровно два `drop function if exists` нужных сигнатур, `20261101000100` отзывает права sequences у public/anon/authenticated. К production они не применялись, агент production не трогал (подтверждено: в evidence production-ref отсутствует, scan-evidence 0 находок, git status не содержит production-артефактов кроме собранного владельцем json).

### Артефакты

| Артефакт | Статус | Детали |
|----------|--------|--------|
| `supabase/migrations/20261101000000_portia_baseline.sql`, `...0100_portia_explicit_grants.sql`, `...0200_portia_drop_legacy_promo_overloads.sql` | VERIFIED | Существуют, содержательные, хэши закреплены parity-тестом |
| `supabase/fingerprint/portia_schema_fingerprint.sql` + `expected/portia.fingerprint.json` | VERIFIED | Golden присутствует и равен fresh/upgrade/final/postdrop |
| `scripts/phase16-fingerprint-compare.mjs` | VERIFIED | Работает, использован мной, exit-коды корректны |
| `lib/portia-*-live.test.ts`, `lib/phase16-*.test.ts` | VERIFIED | Присутствуют; offline-часть зелёная |
| `evidence/*` receipts, fingerprints, LIVE-RUN, POSTFLIGHT, ATTESTATION, LADDER, CALIBRATION | VERIFIED | Согласованы между собой и с моими перепроверками |

### Behavioral spot-checks

| Проверка | Команда | Результат | Статус |
|----------|---------|-----------|--------|
| Unit-тесты | `npm test` | 826 tests, 823 pass, 0 fail, 3 skipped | PASS |
| Типы | `npm exec tsc -- --noEmit` | exit 0 | PASS |
| Lint | `npm run lint` | 0 errors, 18 warnings (`no-img-element`, не относится к фазе) | PASS |
| Fingerprints golden vs upgrade/final/postdrop | `node scripts/phase16-fingerprint-compare.mjs` | exit 0 x3 | PASS |
| Fingerprint golden vs production | то же | exit 1, 4 ключа | DRIFT (ожидаемо зафиксирован) |

Live staging, Playwright и visual manifest мной не запускались (запрещено условиями верификации).

### Probe execution

Проб-скриптов `scripts/*/tests/probe-*.sh` в фазе не объявлено. Не применимо.

### Anti-patterns

Маркеры TBD/FIXME/XXX в `supabase/migrations/*` и `scripts/phase16-fingerprint-compare.mjs` не искал построчно по всем файлам фазы за пределами перечисленных артефактов; в ключевых артефактах блокирующих находок нет.

### Что остаётся BLOCKED (не записано как pass)

| Что | Статус | Владелец |
|-----|--------|----------|
| 7 пиксельных application-сравнений и `search-restored` (DATA-SEED) | BLOCKED (D6) | Phase 18-19; к SC1-3 не относится, как pass не засчитывается |
| Физические устройства | BLOCKED | Phase 22 |
| Применение миграций к production и повторный fingerprint | не выполнено | владелец |

Заметка: в `16-LIVE-RUN.md` строка "`supabase-rls-reviewer` ... требуется" устарела, ревью записано в `16-14-SUMMARY.md` (critical/high нет); коммит `94d951d` дополнительно закрепляет запрет пересоздания bank-less overloads тестом. Рекомендую поправить строку, на статус не влияет.

## Gaps Summary

Кодовых пробелов, блокирующих цель фазы, нет. Остались два вопроса для человека:

1. **Применение миграций на production и повторный fingerprint (STAB-SEC-04).** Пока production в DRIFT, существует реальная экспозиция: два SECURITY DEFINER overload с EXECUTE у authenticated и лишние права на sequence. Приоритет: medium; решение и действие принадлежат владельцу.
2. **Предупреждение о критерии закрытия.** Постflight ожидает после применения миграций "exit 0 с учётом info `rls_auto_enable`", но компаратор помечает как info только различия по ACL привилегированной роли (`service_role:`). Функция `rls_auto_enable()`, присутствующая только в golden, лежит в `diff` и даёт exit 1 (проверено мной на текущих данных). Значит, даже после успешного применения миграций повторное сравнение вернёт exit 1, и закрытие STAB-SEC-04 по буквальному правилу "exit 0" невозможно без allowlist платформенных функций в компараторе или записанного исключения. Нужно заранее решить, иначе owner-run шаг даст неоднозначный результат.

---

_Проверено: 2026-11-01_
_Верификатор: Claude (gsd-verifier)_

## Human verification (16-UAT.md, 2026-11-01)

Оба пункта human_verification пройдены: владелец применил `20261101000100` и `20261101000200` к production и снял fingerprint повторно (`evidence/fingerprint-production-after.json`); golden vs production: единственное отличие `public.rls_auto_enable()`. Владелец выбрал правило A (без allowlist, задокументированное исключение). STAB-SEC-04: Complete. Статус отчёта переведён в `passed` по `phase uat-passed --uat-only`.
