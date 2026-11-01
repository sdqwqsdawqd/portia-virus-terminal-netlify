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

Статус: PENDING

## Production postflight (план 16-14)

Статус: PENDING

## Итог фазы

Статус: PENDING
