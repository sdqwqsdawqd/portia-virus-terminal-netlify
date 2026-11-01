# 16-TARGET-ATTESTATION: аттестация цели staging (план 16-07)

Дата: 2026-11-01. Commit (HEAD на момент проверки): 08473fe. Node: 22.13.1 (референсный, первый в PATH).

Итог: **ATTESTED** (повторный прогон 2026-11-01, HEAD 6508435, после перезапуска сессии владельцем). Первый прогон ниже был BLOCKED (401 на publishable-ключ) и оставлен как история.

## Повторный прогон (2026-11-01, HEAD 6508435, Node 22.13.1)

- `attest`: exit 0, `{"status":"ATTESTED","refHash":"01d085e7b9f0"}`.
- `self-test-production-block`: exit 0, `{"checked":1,"blocked":1}`.
- `node --test .claude/hooks/guard.test.mjs`: 7/7 pass. `lib/phase16-guard-boundary.test.ts`: 6/6 pass.
- sha256 guard-файлов совпадают с таблицей ниже (guard не менялся).
- `scan-evidence`: см. раздел scan-evidence.

## Первый прогон (BLOCKED, история)

## Подтверждение владельца (со слов владельца, агент это не проверял)

Владелец 2026-11-01: «guard сужен (не закоммичен), сессия перезапущена с переменными, production-ref в PORTIA_E2E_PRODUCTION_PROJECT_IDS подтверждён». Сам ref в этом файле не приводится. Агент `.env*` не читал и значения переменных не печатал.

## Версия guard (владельческая, не закоммичена: `.claude/` в `.git/info/exclude`)

| Файл | sha256 |
|------|--------|
| `.claude/hooks/guard.mjs` | `1d14106aeb122e3a8f5e9da6120e7be5520914133eba8cd1d430ba5e76adc9b6` |
| `.claude/hooks/guard.test.mjs` | `93b3d12da0385cfc337a8fdb9f2c8347021a1adbc21331edace6d9f286ad9aae` |

Агент guard не менял и не обходил.

## Свойства guard (граничный тест `lib/phase16-guard-boundary.test.ts`, настоящие `check()` и процесс hook)

| Свойство | Статус |
|----------|--------|
| 1. Текст привилегированной роли блокируется (с ключами и без) | PASS |
| 2. С ключами в env проходят только точные формы wrapper / `npm run test:staging-live[:tracer]` / `test:e2e[:mutation]`; `;`, `&&`, `\|\|`, `\|`, `>`, обратные кавычки, `$(` блокируются; обычные команды работают | PASS |
| 3. Прямой `supabase`, `env`/`printenv`, `$env:`, `process.env` в `node -e/-p`, `echo $...`, имена секретов, префикс секретного ключа, curl/iwr к `supabase.co` блокируются | PASS |
| 4. Текст с production-ref блокируется; цель из production-списка или вне изолированного списка блокируется (в т.ч. каждый настоящий ref списка, без печати, по индексу) | PASS |

Запуски: `node --experimental-strip-types --test lib/phase16-guard-boundary.test.ts` — 6 тестов, 6 pass; `node --test .claude/hooks/guard.test.mjs` — 7 тестов, 7 pass.

## Wrapper

- `attest`: **BLOCKED**, exit 1, код `rejected-publishable-401` (переменная для проверки: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Цель, привязка DB URL, список production и confirm-значения target-guard прошёл; живой запрос `/auth/v1/settings` с publishable-ключом отклонён с 401. Повтор дал тот же результат (детерминированно, не сеть и не пауза: сервер ответил). admin-ключ до проверки не дошёл.
  - Причина вне агента: значение `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` в окружении сессии не принято проектом (ключ от другого проекта, отозван/перевыпущен, обрезан или с лишними символами). Агент значение не смотрел (требование плана).
- `self-test-production-block`: PASS, exit 0, `{"checked":1,"blocked":1}` (checked == blocked >= 1).
- PG major и регион (из 16-04 SUMMARY): PG 17, eu-west-2 (London).

## Что нужно от владельца для снятия BLOCKED

Перевыпустить/перепроверить publishable-ключ в portia-staging -> Project Settings -> API Keys, задать `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` заново (и тот же ключ в `PORTIA_PROMO_LIVE_ANON_KEY`), убедиться, что проект не на паузе, перезапустить сессию. Затем повторить `attest` и `scan-evidence`; этот файл обновить результатом `ATTESTED`.

## scan-evidence

`scan-evidence` по каталогу evidence: exit 0, `{"files_with_findings":0,"findings":0}` (ключи, DB URL и ref в файлах отсутствуют).
