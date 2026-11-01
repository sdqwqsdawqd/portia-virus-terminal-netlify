---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 13
subsystem: testing
tags: [playwright, roles, api-matrix, revoke, cas, g1, g2, d6]
requires: [16-05, 16-12]
provides:
  - worker-фикстура stagingRun (identity, настоящий вход через /owner-login, iss, probeSession, cleanup receipt)
  - staging-authz.spec.ts (API-матрица 7 маршрутов x 5 ролей, revoke editor и promo, HTTP CAS 6 x 10)
  - секция api в expected-authz.json (источники file:line из кода маршрутов)
  - evidence/receipt-playwright.json (PASS, residual 0) и раздел Browser в 16-LIVE-RUN.md
affects: [16-14]
commits: 4
plan_head_before: ed2b0a8098312383a2d8419b6852878b5311e633
plan_head_after: 0155e6e64aa47af10e369fed29b1fbe8675d6fc0
estimate:
  tokens: 100000
actuals:
  tokens: 14100
  tasks: 3
  commits: 4
key-files:
  created:
    - tests/e2e/specs/staging-authz.spec.ts
    - lib/portia-promotion-preview-token.ts
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/receipt-playwright.json
  modified:
    - tests/e2e/fixtures/test.ts
    - tests/e2e/fixtures/staging-harness.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - tests/e2e/specs/roles.spec.ts
    - playwright.config.ts
    - package.json
    - lib/portia-promotion-reviewer.ts
    - app/api/promotion/banks/route.ts
    - lib/phase16-expected-authz.test.ts
    - .planning/phases/PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/evidence/16-LIVE-RUN.md
key-decisions:
  - "Proof привилегированной lane выдаёт только probeSession после настоящего входа через форму /owner-login и проверки iss; без безопасного env lane BLOCKED, skip не считается pass."
  - "Participant: /owner-login по коду выходит из сессии не-редактора, поэтому cookie строится сериализатором supabase/ssr из входа harness; proof тот же (/api/access + /api/promotion/status)."
  - "test:e2e:mutation запускается с --workers=1: owner-фикстура использует единственный канонический email, два воркера удаляли бы пользователя друг у друга."
  - "Seed для data-lanes не создавался: изолированный backend отдаёт собственные дефолты приложения; production-данные не использовались."
requirements-completed: [STAB-SEC-01]
status: complete
---

# Phase 16 Plan 13: роли на UI и API, revoke без re-login и HTTP CAS Summary

Четыре привилегированные Playwright lanes (participant, editor, promo-reviewer, owner) проходят на изолированной цели через настоящий вход и server-derived proof; API-матрица, оба revoke на открытой сессии и HTTP revision CAS (6 параллельных PUT x 10 раундов) PASS во всех 5 проектах; G1 закрыт, G2 разблокирован с честной классификацией по D6.

## Что сделано

- **Задача 1 (tracer):** фикстура `stagingRun` (worker scope): run harness, identity нужной роли (owner через `createOwnerFixture`, D4), вход через UI `/owner-login` в отдельном context, cookie `sb-<ref>-auth-token` -> access token -> `probeSession` (`iss` + `/api/access`) -> `actorAvailability`; teardown: `cleanup()`, `residual()`, `writeReceipt("playwright")`. `webServer.env` обнуляет admin-ключ и `PORTIA_STAGING_DB_URL` (T-16-40). Tracer editor lane PASS, receipt PASS, residual 0. Коммиты `a90edf0` (fix клиентского бандла, см. ниже) и `504cefa`.
- **Задача 2:** секция `api` в `expected-authz.json`, `staging-authz.spec.ts`, `test:e2e:mutation` по двум файлам. `npm run test:e2e:mutation` на всех 5 проектах: 70 PASS, 0 FAIL, 0 SKIP. Коммит `4f3dd87`.
- **Задача 3:** `npm run test:e2e -- --workers=1`: 136 PASS, 5 FAIL (классифицированы: 4 application-pixel D6 и Firefox `search-restored` DATA-SEED), 59 SKIP (ожидаемые). `--verify-promotion`: 33 approved снимка, `scan-evidence` по evidence 0 findings. Коммит `0155e6e`.

## Классификация расхождений

| Наблюдение | Класс | Действие |
|------------|-------|----------|
| CSP `script-src` eval при открытии редактора в production-сборке | реальная находка в клиентском коде | клиентские редакторы Promotion тянули `node:crypto` через `lib/portia-promotion-reviewer.ts` (polyfill asn1.js/vm с eval). HMAC-токены предпросмотра вынесены в серверный `lib/portia-promotion-preview-token.ts`, импорты в `banks/route.ts` и двух тестах обновлены; проба: 0 нарушений. Allowlist диагностики не расширялся |
| visitor reviewer GET: ожидали 403, получили 503 | ошибка вывода | `lib/portia-promotion-reviewer.ts:21`: без сессии `getUser()` даёт ошибку -> `unavailable` (fail-closed). Ячейка = 503 с источником |
| phone-проекты не находят заголовок "Редактор PORTIA" | дефект теста | в phone-раскладке заголовок окна; проверяется навигация "Разделы редактора", заголовок остался для desktop |
| `phase16-expected-authz.test.ts`: `matrix.api === undefined` | дефект теста | проверка секции `api` (ячейки по ролям, строки-источники существуют) |

SQL, миграции, parity-тест и golden не менялись: `supabase-rls-reviewer` не требуется.

## Data-lanes (D6)

settings persist x5: PASS. WebKit-phone shell diagnostics: PASS. chromium-desktop `vivian-activity`: PASS (совпал с утверждённым PNG). Firefox `search-restored`: 783 px отличий (Phase 15: 7061) -> BLOCKED (DATA-SEED), не регрессия, не pass. Семь пиксельных application-сравнений: наблюдение 6 совпали / 4 отличаются из 10 в chromium-desktop, BLOCKED по D6 независимо от исхода (поимённого списка семи в Phase 15 нет, поэтому весь класс учтён как BLOCKED). Утверждённые PNG не менялись, `--verify` не запускался.

## Проверки

`npm test`: 825 tests, 822 pass, 0 fail, 3 skip; `npm exec tsc -- --noEmit` чисто; `npm run lint`: 0 errors (18 прежних warnings); Node 22.13.1.

## Deviations from Plan

**1. [Rule 1 - Bug] Клиентский бандл редактора тянул node:crypto и нарушал CSP**
- **Found during:** задача 1 (diagnostics fixture на editor lane)
- **Fix:** вынос `createPreviewToken`/`verifyPreviewToken` в серверный модуль
- **Files:** `lib/portia-promotion-preview-token.ts`, `lib/portia-promotion-reviewer.ts`, `app/api/promotion/banks/route.ts`, два lib-теста
- **Commit:** `a90edf0`

**2. [Rule 3 - Blocking] `--workers=1` в `test:e2e:mutation` и в полном прогоне**
- Owner-фикстура с единственным каноническим email не терпит параллельных воркеров. Полный прогон делается как `npm run test:e2e -- --workers=1`.

**3. [Rule 3 - Blocking] Participant без UI-входа**
- `/owner-login` по коду выходит из сессии не-редактора (`ownerLogin` -> denied), поэтому cookie participant строится сериализатором supabase/ssr из входа harness; proof тот же. Для остальных ролей вход настоящий.

**4. [Rule 3] Дополнение staging-harness.ts**
- Добавлен `credentials(label)` (пароль нужен форме входа; значения уже в `secrets()` и не попадают в receipt).

**5. Uploads вне run-префикса**
- `POST /api/uploads` пишет в `recycle/<uuid>`, поэтому спец удаляет объект admin-клиентом сразу после проверки (storage residual 0). Это отличие от формулировки плана "под run-префиксом".

## Known limits

- Локальный сервер не имеет Netlify site ID: `purgeCacheTag` пишет ошибку в лог и не проваливает PUT; очистка CDN-кэша в этих прогонах не проверялась.
- `commit` в receipt первого mutation-прогона `504cefa`, receipt в evidence на HEAD `4f3dd87`.
- STAB-REL-04 и STAB-SEC-04 остаются Pending до production postflight (16-14); отмечен только STAB-SEC-01 (UI, API, таблицы, RPC и revoke доказаны live на изолированной цели в 16-12 и 16-13).

## Known Stubs

None.

## Threat Flags

None. Новых endpoints и trust-boundary файлов нет; admin-ключ не передаётся процессу Next-сервера.

## Self-Check: PASSED

- staging-authz.spec.ts, preview-token.ts, receipt-playwright.json, 16-LIVE-RUN.md присутствуют; коммиты `a90edf0`, `504cefa`, `4f3dd87`, `0155e6e` в истории HEAD.
