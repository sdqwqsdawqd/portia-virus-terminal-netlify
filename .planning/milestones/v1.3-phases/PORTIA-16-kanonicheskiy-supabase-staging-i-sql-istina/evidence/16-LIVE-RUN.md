# Phase 16: журнал live-запусков

Журнал накапливается планами 16-12 (DB), 16-13 (Browser) и 16-14 (Production postflight). BLOCKED нигде не записан как pass.

## DB live suites (план 16-12)

| Поле | Значение |
|------|----------|
| Дата | 2026-11-01 |
| Commit прогона (HEAD) | `e2c93fe` (совпадает с `commit` в обоих receipts) |
| Цель | изолированный проект, refHash `01d085e7b9f0`, `attest` = ATTESTED перед запуском |
| Node / Supabase CLI / pg_major | 22.13.1 / 2.122.0 (repo-pinned) / 17 |
| База перед прогоном | final canonical == golden (16-11, `fingerprint-final.json`) |
| Команда | `npm run test:staging-live` (`node --experimental-strip-types --test --test-concurrency=1 lib/portia-*-live.test.ts`) |
| Tracer | `npm run test:staging-live:tracer`: PASS (1/1), `scan-evidence test-results/staging`: 0 findings |

### Счёт по suites (последний зелёный прогон: 770 tests, 5 suites)

| Suite | PASS | FAIL | BLOCKED | SKIP |
|-------|------|------|---------|------|
| live Promotion concurrency, lease and RLS (существующий live-тест Повышения) | 5 | 0 | 0 | 0 |
| single-winner assertion (юнит-проверка судьи гонок) | 5 | 0 | 0 | 0 |
| staging live concurrency (N x R = 6 x 10) | 8 | 0 | 0 | 0 |
| outcome classifier (юнит) | 4 | 0 | 0 | 0 |
| staging live role matrix | 748 | 0 | 0 | 0 |
| **Итого** | **770** | **0** | **0** | **0** |

Role matrix: 216 проверок функций (RPC), 491 проверка таблиц, 36 проверок Storage, catalog-проверка (golden == матрица), tracer и три revoke-теста; остальное до 748 это ячейки по ролям и вариантам.

Конкурентные раунды (8 гонок, каждая N=6 контендеров x R=10 раундов на собственных namespaced fixtures): claim, admission-same-nickname, admission-split-device, answer-cas, start-test-client-mode, heartbeat-vs-expire, release-reject-delete-vs-claim, cleanup-vs-admission. Все PASS.

Revoke-тесты (на одной и той же сессии после отзыва, все PASS):
1. удаление строки `portia_editors` останавливает доступ к таблицам, RPC и Storage;
2. удаление `promo` из `granted_tabs` делает ту же сессию forbidden;
3. удаление auth-пользователя останавливает доступ ещё не истёкшего JWT.

### Receipts

| Файл | status | residual | sha256 (поле receipt) |
|------|--------|----------|-----------------------|
| `evidence/receipt-roles.json` | PASS | authUsers 0, content 0, editors 0, promo 0, storage 0 | `1f77777aea7686fc613de5a261c0fa8416f998beec3378fafc1b9c9ba5b2e52c` |
| `evidence/receipt-concurrency.json` | PASS | authUsers 0, content 0, editors 0, promo 0, storage 0 | `b338b9d5cb5d9efaafc21bb6a28a2a2c23db9d169e00eb413bf7c71f6846091c` |

Receipts скопированы из `test-results/staging/` без изменений, содержат refHash вместо ref, прошли `assertRedacted` в harness и `scan-evidence`.

### Ответы на допущения RESEARCH

- **A2 (домен `@example.invalid` в GoTrue):** подтверждено, GoTrue принимает домен; идентичности создаются и входят (tracer и полный прогон, константа harness не менялась).
- **A9 (перекрытие HTTP-гонок при N=6, R=10):** инвариант "ровно один победитель, остальные чистый проигрыш, итоговая строка совпадает с победителем" выдержал 80 раундов по 8 гонкам, значения N и R не поднимались. Само перекрытие запросов тест напрямую не измеряет (нет тайминга и индекса победителя в receipt), поэтому утверждение "гонка заведомо перекрылась" не делается; это известное ограничение калибровки.
- **A13 (лимиты Auth):** на 7-8 пользователях за прогон с переиспользованием сессий rate-limit и 429 не встречались; два полных прогона и tracer подряд прошли без повторов.
- **A15 (формат `iss`):** косвенно подтверждено: guard извлекает host из JWT `iss` и сверяет с attested target; `attest` ATTESTED (refHash `01d085e7b9f0`) и все live-суиты стартовали. Значение `iss` не печаталось.

### Классификация расхождений первого полного прогона

Первый полный прогон: 765 PASS, 5 FAIL (роли), конкурентные раунды и Promotion зелёные; receipt ролей получил status FAIL (в `test-results/`, не в evidence). После правок повторён дважды, оба раза 770/770.

| Тест | Наблюдение | Класс | Действие |
|------|-----------|-------|----------|
| catalog: golden fingerprint function set equals the matrix | в golden есть `public.rls_auto_enable()` без строки матрицы | (a) дефект теста | функция платформенная (event trigger Supabase, не из SQL репозитория, returns `event_trigger`); проверка теперь сравнивает только `public.portia_*` и дополнительно закрепляет, что внешняя функция ровно одна и это она; любая новая чужая функция по-прежнему роняет тест |
| anon storage insert-oversize | ожидали rls-deny, получили http-413 | (b) ошибка вывода | baseline 1639 (`file_size_limit` 4194304): лимит бакета Storage API проверяет до insert-политики (baseline 1655); объект не записан; ячейка = http-413, `verify_live` снят |
| outsider storage insert-oversize | то же | (b) | то же |
| anon storage insert-bad-mime | ожидали rls-deny, получили http-415 | (b) ошибка вывода | baseline 1640 (`allowed_mime_types`): http-415 до политики; ячейка = http-415, `verify_live` снят |
| outsider storage insert-bad-mime | то же | (b) | то же |

Класс (c) (реальная security/race-находка в SQL): не обнаружено, миграций не добавлялось, `supabase/*.sql` не менялся, golden не пересчитывался. Обычный `insert` для anon и outsider остаётся rls-deny (PASS), то есть запись без прав по-прежнему закрыта RLS. Ассерты не ослаблялись: сравнение осталось строгим равенством, поменялись только ожидаемые исходы с источником в SQL. Принятые риски D-11 и SEC-M1 не затрагивались.

## Browser (план 16-13)

Статус: PASS для привилегированных lanes, API-матрицы, revoke и HTTP CAS; G1 закрыт; G2 разблокирован с честной классификацией (7 пиксельных application-сравнений остаются BLOCKED по D6, search-restored BLOCKED (DATA-SEED)). Ни один BLOCKED не записан как pass.

| Поле | Значение |
|------|----------|
| Дата | 2026-11-01 |
| Цель | изолированный проект, refHash `01d085e7b9f0`, `attest` = ATTESTED перед прогонами; preflight `mutation` = ready |
| Node | 22.13.1 |
| Commit прогонов | `504cefa` (первый полный mutation), `4f3dd87` (visitor-прогон и receipt в evidence) |
| Сервер под тестом | `npm run build` + `npm run start` против изолированной цели (app binding 16-03); `webServer.env` обнуляет admin-ключ и `PORTIA_STAGING_DB_URL` (T-16-40) |
| Mutation-прогон | `npm run test:e2e:mutation` (теперь `playwright test --workers=1` по `roles.spec.ts` и `staging-authz.spec.ts`), все 5 проектов: 70 PASS, 0 FAIL, 0 BLOCKED, 0 SKIP |
| Visitor/полный прогон | `npm run test:e2e -- --workers=1`, все 5 проектов: 136 PASS, 5 FAIL (классифицированы ниже, D6/DATA-SEED), 59 SKIP |
| Проекты | chromium-desktop, chromium-dpr125, firefox-desktop, webkit-phone, chromium-phone |
| Receipt | `evidence/receipt-playwright.json`: `status: PASS`, residual 0 по всем пяти категориям, created authUsers 7 / editors 5, deleted authUsers 7 / editors 4 (одна строка editor снята самим revoke-тестом) |

`--workers=1` нужен, потому что owner-фикстура использует единственный канонический email (D4): два воркера удалили бы друг у друга пользователя. Каждый воркер создаёт свой run, identities и receipt; в mutation-прогоне 5 receipts `PASS`, в visitor-прогоне ещё 5, все с residual 0.

### Привилегированные lanes и API (G1)

| Что | Результат |
|-----|-----------|
| Lanes participant / editor / promo-reviewer / owner | PASS во всех 5 проектах (4 x 5 = 20) |
| API-матрица `api` из `expected-authz.json`: `/api/access`, `PUT /api/content`, `/api/editors` GET/POST/DELETE, `/api/uploads`, `/api/promotion/reviewer` x 5 ролей | PASS во всех 5 проектах (5 x 5 = 25 прогонов) |
| Revoke editor-строки на открытой сессии без re-login | PASS: `/api/access` canEdit false, `PUT /api/content` 403, после reload кнопка открытия редактора disabled |
| Снятие `promo` у promo-reviewer на открытой сессии | PASS: openTabs без promo, reviewer-маршрут 403 |
| HTTP CAS: 6 параллельных `PUT /api/content` с одним `baseRevision`, 10 раундов | PASS: в каждом раунде ровно один 200 и пять 409, итоговая revision = base + 1; контент восстановлен до исходной revision (проверяется) |

Условия `15-ROLE-GATE.md` для G1:

1. Аттестация цели, исключающая production: `attest` = ATTESTED, mutation preflight (`requireSafeMutationTarget`, `assertAppBoundToTarget`), `PORTIA_E2E_BASE_URL` запрещён. ДОКАЗАНО.
2. Server-derived proof роли: каждый lane получает `VerifiedSession` только от `probeSession` после настоящего входа через форму `/owner-login` (editor, promo-reviewer, owner), проверки `iss` токена и совпадения роли с ответом `/api/access`. Participant: `/owner-login` по коду выходит из сессии не-редактора, поэтому cookie строится тем же сериализатором `supabase/ssr`, что и на сервере, из входа harness; proof тот же (`/api/access` + `/api/promotion/status` с ником из реального access-roster). Без безопасного env lane остаётся BLOCKED. ДОКАЗАНО.
3. Положительные и отрицательные решения реальной серверной границы: матрица 7 маршрутов x 5 ролей, оба revoke. ДОКАЗАНО.
4. Идемпотентный cleanup receipt: `status: PASS`, residual 0 (promo, editors, storage, content, authUsers). ДОКАЗАНО. `POST /api/uploads` пишет в `recycle/<uuid>`, вне run-префикса, поэтому спец удаляет каждый загруженный объект admin-клиентом сразу после проверки; storage residual 0.

### Расхождения и находки (классификация как в 16-12)

| Наблюдение | Класс | Действие |
|------------|-------|----------|
| Открытие редактора в production-сборке давало CSP-нарушение `script-src` eval (diagnostics fixture) | (c-код) реальная находка в клиентском бандле | клиентские редакторы Promotion импортировали `lib/portia-promotion-reviewer.ts`, а он `node:crypto`; Next подтягивал crypto-polyfill (asn1.js, vm с eval). HMAC-токены предпросмотра вынесены в серверный `lib/portia-promotion-preview-token.ts`; повторная проба: 0 нарушений. Allowlist диагностики не расширялся |
| visitor `GET /api/promotion/reviewer`: ожидали 403, получили 503 | (b) ошибка вывода | `lib/portia-promotion-reviewer.ts:21`: без сессии `auth.getUser()` возвращает ошибку, она отображается в `unavailable` (fail-closed 503); данные не отдаются. Ячейка матрицы = 503 с источником |
| phone-проекты: lane редактора не находит заголовок "Редактор PORTIA" | (a) дефект теста | в phone-раскладке показывается заголовок окна, а не заголовок страницы; для phone проверяется навигация "Разделы редактора" (есть везде), заголовок остаётся для desktop-проектов |
| `phase16-expected-authz.test.ts` утверждал `matrix.api === undefined` | (a) дефект теста | заменено проверкой секции `api`: ячейки по пяти ролям и существование строк-источников |

SQL не менялся, `supabase/*.sql`, parity-тест и golden не трогались: класс (c) в SQL не найден.

### Классификация 15 data-lanes (G2, D6)

Изолированный backend для чтения получает только собственные дефолты приложения (в нём нет строки контента, seed из production не использовался и не создавался).

| Lane (15-BASELINE-RESULTS, "Failed - no read backing") | Результат сейчас | Класс | Причина |
|---------------------------------------------------------|------------------|-------|---------|
| visitor settings persist across reload, 5 проектов | 5 PASS | PASS | не-пиксельная lane, проходит на изолированном backend |
| WebKit-phone shell diagnostics | PASS (webkit-phone, диагностика чистая) | PASS | сетевая ошибка из Phase 15 ушла с read backing |
| Firefox `search-restored` | FAIL, 783 px отличий (в Phase 15: 7061) | BLOCKED (DATA-SEED) | изолированный backend не воспроизводит утверждённый контент; не регрессия и не pass |
| chromium-desktop `vivian-activity` | PASS (совпал с утверждённым PNG) | PASS | совпадение с утверждённым PNG |
| 7 пиксельных application-сравнений | наблюдение: из 10 application-сравнений chromium-desktop 6 совпали, 4 отличаются (База вирусов, Информация, Корзина, Глобальный поиск) | BLOCKED (D6) | D6: остаются BLOCKED независимо от исхода; наблюдение информационное. В Phase 15 поимённого списка семи нет, поэтому весь класс application-pixel учтён как BLOCKED |

Утверждённые PNG не менялись (`git status` по `tests/e2e/visual` пуст), `--verify` не запускался. `node scripts/phase15-visual-manifest.mjs --verify-promotion`: "Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded."

SKIP в visitor-прогоне (59): 52 пиксельный authority закреплён за chromium-desktop, 2 нет device-row, 3 phone-only touch smoke, 2 phone без каскадных окон. Актёрских BLOCKED-skip нет: все четыре привилегированные роли выполнялись.

### Статус гейтов

- G1 (disposable roles, изолированный Supabase): закрыт доказательствами условий 1-4 выше.
- G2 (read backing для data-lanes): разблокирован. Не-пиксельные lanes PASS; пиксельные application-сравнения BLOCKED (D6); `search-restored` BLOCKED (DATA-SEED).
- STAB-SEC-04 и STAB-REL-04 остаются Pending до production postflight (16-14).

## Production postflight (план 16-14)

Статус: **DRIFT** (production != golden), подробности и классификация в `evidence/16-PRODUCTION-POSTFLIGHT.md`. Production fingerprint снял владелец вручную (read-only SELECT, sha256 SQL `80c01284740fe1f2b25319e31f04dd1fd300c972f38524fb8209e5e976d71851`), агент production не касался. PG major 17 == golden.

| Сравнение | Exit | Результат |
|-----------|------|-----------|
| golden vs production | 1 | 4 ключа: sequence `portia_promo_audit_events_id_seq` (ACL: anon/authenticated SELECT/UPDATE/USAGE; ожидаемо, закрывает `20261101000100`), два legacy overload `portia_promo_confirm_assignment(uuid, jsonb)` и `portia_promo_confirm_test(uuid, jsonb, text)` (только production, SECURITY DEFINER, EXECUTE у authenticated; закрывает `20261101000200`), `rls_auto_enable()` (info: платформенная функция Supabase, есть только в golden) |
| golden vs `fingerprint-postdrop.json` (изолированная цель после push `20261101000200`) | 0 | равны; golden не менялся, на каноническом build drop no-op |

Находка плана 16-14 класса (c) в SQL: legacy overloads, оставшиеся от `43895f8` (14-02) и не удалённые `4d527f6`. Добавлена forward-only миграция `supabase/migrations/20261101000200_portia_drop_legacy_promo_overloads.sql` (ровно два `drop function if exists`; вызовов старых сигнатур в `lib/`, `app/`, `tests/` нет), hash закреплён в `lib/portia-canonical-parity.test.ts`. Применена только к изолированной цели; к production НЕ применена (решение владельца отдельно, D5).

Проверка на изолированной цели после миграции (commit `a77bff4`):

| Что | Результат |
|-----|-----------|
| `push` | применена `20261101000200`; журнал: Local == Remote для трёх версий |
| `fingerprint postdrop` | pg_major 17, 36 функций; comparator vs golden: exit 0 |
| `npm run test:staging-live` | 770 tests, 5 suites: 770 PASS, 0 FAIL, 0 BLOCKED, 0 SKIP |
| `evidence/receipt-roles-postdrop.json` | PASS, residual authUsers 0, content 0, editors 0, promo 0, storage 0; sha256 (поле) `5a9d44c6e143f863a38eac7e1f255f95c163e02d1d3536a14b5964a37facd367` |
| `evidence/receipt-concurrency-postdrop.json` | PASS, residual 0 по всем категориям; sha256 (поле) `6ebb1da352c55f6bf604b9184b1171d7cba5a16e5c67be2ead7e2f11acd12df8` |

## Итог фазы

Статус: **staging доказан; production MATCH по правилу A** (после owner-run миграций, 2026-11-01). STAB-SEC-01, STAB-REL-04 и STAB-SEC-04 Complete.

### Success Criteria и acceptance gate

| Критерий | Статус | Доказательство |
|----------|--------|----------------|
| SC1: свежий изолированный проект только из canonical migrations даёт тот же fingerprint, что upgrade-путь | PASS | `fingerprint-fresh.json` (golden) == `fingerprint-upgrade.json` == `fingerprint-final.json` после teardown и повторного push (`16-UPGRADE-LADDER.md`, `16-FINGERPRINT-CALIBRATION.md`); `fingerprint-postdrop.json` == golden после третьей миграции |
| SC2: anon/authenticated/editor/reviewer/owner через UI, API, таблицы и RPC; revoke сразу; fail-closed | PASS | role matrix 748 проверок + 3 revoke-теста (`receipt-roles.json`, `receipt-roles-postdrop.json`); UI/API lanes 4 роли x 5 проектов и API-матрица 7 маршрутов x 5 ролей, оба revoke на открытой сессии (`receipt-playwright.json`, раздел Browser) |
| SC3: concurrent claim/admission/CAS/cleanup на disposable fixtures, один победитель, без production | PASS | 8 гонок N=6 x R=10 (`receipt-concurrency.json`, `receipt-concurrency-postdrop.json`) и HTTP CAS 6 x 10 (Browser); residual 0; `attest` ATTESTED перед запусками |
| Acceptance gate: live-run и fingerprints | PASS (изолированная цель; production MATCH по правилу A) | см. выше и `16-PRODUCTION-POSTFLIGHT.md` |
| STAB-SEC-04: staging и production fingerprints == canonical | PASS (правило A) | staging доказан; `fingerprint-production-after.json` vs golden: единственное отличие `public.rls_auto_enable()` (info), см. `16-PRODUCTION-POSTFLIGHT.md` |

### Сводка fingerprints

| Файл | Что | Сравнение |
|------|-----|-----------|
| `fingerprint-pristine.json` | чистая цель до миграций | базовая точка |
| `fingerprint-fresh.json` | golden: baseline + explicit grants на свежей базе | эталон |
| `fingerprint-upgrade-legacy.json` (U0) | legacy-цепочка до миграций | golden vs U0: exit 1, дельта `search_path` у `portia_editor_is_approved` и ACL sequence (объяснена) |
| `fingerprint-upgrade.json` (U) | legacy-цепочка + canonical | golden == U (exit 0) |
| `fingerprint-after-teardown.json` | после teardown | чистое состояние |
| `fingerprint-final.json` | пересборка после teardown | golden == final (exit 0) |
| `fingerprint-postdrop.json` | после `20261101000200` | golden == postdrop (exit 0) |
| `fingerprint-production.json` (P) | owner-run, production | golden vs P: exit 1 (DRIFT, 4 ключа) |
| `fingerprint-production-after.json` (P2) | owner-run, production после двух миграций | golden vs P2: exit 1, только `rls_auto_enable()` (info) = MATCH по правилу A |

### Остаются BLOCKED / вне фазы

| Что | Статус | Владелец |
|-----|--------|----------|
| 7 пиксельных application-сравнений и `search-restored` (DATA-SEED) | BLOCKED | D6, Phase 18-19 (визуальные эталоны владельца) |
| Физические устройства | BLOCKED | Phase 22 |
| Применение `20261101000100` и `20261101000200` к production и повторный fingerprint | выполнено владельцем 2026-11-01, MATCH по правилу A | владелец |
| Management API автоматизация | отложено | D10 |
| `supabase-rls-reviewer` для новой миграции `20261101000200` | выполнено: critical/high нет; находка на prod оценена как medium (см. 16-14-SUMMARY) | оркестратор |

Ни один BLOCKED или DRIFT не записан как pass.
