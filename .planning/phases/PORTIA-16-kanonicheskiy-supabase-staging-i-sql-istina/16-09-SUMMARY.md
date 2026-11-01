---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 09
subsystem: testing
tags: [supabase, concurrency, claim, admission, cas, lease, cleanup, live-suite]
requires: [16-06]
provides:
  - lib/portia-staging-concurrency-live.test.ts (offline assertSingleWinner + 8 live N x R гонок; skip вне live-скрипта)
  - lib/portia-promotion-live.test.ts (существующий live-тест на едином guard и harness)
affects: [16-10, 16-12]
actuals:
  tokens: 11700
  tasks: 2
  commits: 3
plan_head_before: 650843580cd7c40a75fc1731d8c3c64248a513a6
plan_head_after: 519dc50e85c9fc870225d1d77c37e41ff45a263b
commits: 3
tech-stack:
  added: []
  patterns: ["N контендеров x R раундов, каждый раунд на своих namespaced fixtures", "ответы ролей/anon плюс admin-чтение итогового состояния", "42501 у admin-клиента -> BLOCKED со ссылкой на D9, не pass"]
key-files:
  created: []
  modified:
    - lib/portia-staging-concurrency-live.test.ts
    - lib/portia-promotion-live.test.ts
    - package.json
key-decisions:
  - "Победитель определяется по типу ответа RPC: boolean (claim), code created (admission), code accepted без idempotent (CAS). Повторный nonce (idempotent) в гонке с разными nonce считается неожиданным ответом, а не проигрышем; проверка idempotent вынесена в отдельный шаг после гонки."
  - "OwnerFixtureForeignError (чужой аккаунт владельца на target) и 42501 admin-клиента превращают гонку в BLOCKED через t.skip, статус BLOCKED пишется в receipt."
  - "В promotion-live вместо собственной проверки confirm одна точка отказа requireStagingLiveTarget; идентичности, префикс, cleanup и residual берутся из harness (run.createIdentity, run.cleanup, run.residual). READ_ONLY_PREFLIGHT не менялся."
  - "test:staging-live запускается с --test-concurrency=1: оба live-файла делят owner fixture и лимиты Auth, параллельные файлы конфликтовали бы."
requirements-completed: [STAB-REL-04]
status: complete
---

# Phase 16 Plan 09: Конкурентные live-раунды и единый guard Summary

Файл с чистой функцией `assertSingleWinner` (работает offline) и восемью live-гонками N x R (по умолчанию N=6, R=10, переопределяются `PORTIA_STAGING_RACE_N`/`PORTIA_STAGING_RACE_R`, значения попадают в ключ статуса receipt), плюс перевод существующего `lib/portia-promotion-live.test.ts` на единый guard. Живой запуск не выполнялся: он принадлежит плану 16-12, до него все live-утверждения остаются BLOCKED (не pass).

## Commits
- 7fd21df test(16-09): assertSingleWinner и гонка claim N x R (задача 1, tracer-срез: guard -> fixtures раунда -> Promise.all -> admin-чтение -> cleanup/residual -> receipt)
- 519dc50 test(16-09): остальные гонки и единый guard promotion-live (задача 2; в этот же коммит вошла правка `package.json`, см. отклонения)
- 12c8da0 (docs 16-07) попал в измеренный диапазон `plan_head_before..plan_head_after`, потому что лёг между двумя задачами; к плану 16-09 не относится. Коммитов именно этого плана 2.

## Что сделано
- `assertSingleWinner(responses, finalRow?)`: ровно один win, остальные lose; неожиданный ответ (null, throttled, idempotent) и 0 или 2 победителя падают; сохранённый `reviewer_id` обязан совпасть с победителем. 5 offline-подтестов, включая статическую проверку, что в именах подтестов нет слова `tracer` (его фильтрует `test:staging-live:tracer`).
- Гонки (каждая в `race: <имя>`, по R раундов, статус `concurrency-<имя>-n<N>-r<R>` в receipt):
  - claim: N ревьюеров на одну заявку, ordinary и qualification чередуются; один `true`, остальные `false`, `status=claimed`, `reviewer_id` победителя.
  - admission-same-nickname: N anon-submit с одним nickname и token -> один `created`, остальные `active-request`, одна строка заявки, один binding.
  - admission-split-device: два nickname на одном token -> одна `created`, тот же nickname получает `active-request`, другой `device-denied`; в БД одна заявка и один binding на победителя.
  - answer-cas: N разных nonce -> один `accepted`, остальные `conflict`, одна строка ответа, индекс вопроса 1; повторный nonce победителя дважды параллельно -> `idempotent`, состояние не меняется.
  - start-test-client-mode: desktop и phone одновременно -> один `client_mode`, проигравший режим получает null, одно значение deadline, поздний вызов другого режима и `current_test` его отклоняют, `client_mode` не меняется.
  - heartbeat-vs-expire: раунды циклом по истёкшей, валидной и почти истёкшей lease; heartbeat и `current_test` параллельно; итог либо продлено, либо failed/connection-lost, не оба; повторный heartbeat не воскрешает.
  - release-reject-delete-vs-claim: держатель (release, reject), владелец (delete) и остальные ревьюеры (claim) на одной заявке; не более одного claim-победителя, не оба reject+delete, итог согласован (удалена, либо pending и свободна, либо claimed победителем).
  - cleanup-vs-admission: bucket состарен на 4 дня, `portia_promo_cleanup()` параллельно с N submit; обновлённый submit bucket не удалён, контрольный состаренный bucket удалён (иначе cleanup не отработал и гонка ничего не доказывает), активная заявка одна; 42501 admin-клиента -> BLOCKED со ссылкой на D9.
- `lib/portia-promotion-live.test.ts`: мутирующая ветка вызывает `requireStagingLiveTarget(process.env)` (при отказе явный fail с именами переменных), файл активен под `test:promotion-live` и `test:staging-live*`, cleanup идёт через `run.cleanup()` с проверкой residual (раньше ошибки удаления игнорировались). Утверждения существующих тестов не менялись.

## Верификация (Node 22.13.1)
- `npm test`: 811 tests, 808 pass, 0 fail, 3 skipped (live-файлы регистрируют skip вне live-скрипта, мутаций нет).
- `npm exec tsc -- --noEmit`: чисто. `npm run lint`: 0 errors, 18 warnings (прежние, вне `lib/`).
- Коды ответов и имена колонок сверены с baseline-миграцией (`device-denied`/`active-request` в submit, `inactive`/`active` в heartbeat, возврат `portia_promo_cleanup`, revoke/grant функций).
- Живой прогон не выполнялся (16-12). Не проверено: реальное поведение гонок на Postgres, лимиты Auth при N=6, пригодность admin-grant на `portia_promo_cleanup` (калибруется в 16-10, D9).

## Отклонения от плана

**1. [Rule 3 - Blocking] `test:staging-live` запускается с `--test-concurrency=1`**
- **Найдено в:** задача 2
- **Проблема:** glob `lib/portia-*-live.test.ts` теперь включает три live-файла; Node запускает файлы параллельными процессами, а они делят owner fixture (канонический email владельца) и лимиты Auth. Параллельный запуск делал бы результат недетерминированным.
- **Исправление:** флаг в скрипте `test:staging-live` в `package.json` (это единственное изменение вне двух файлов плана).
- **Коммит:** 519dc50

**2. [Процесс]** Часть правок задачи 2 (promotion-live, `package.json`) появилась в рабочем дереве и была закоммичена (519dc50) во время исполнения, не моей командой `git commit`. Содержимое я проверил: diff соответствует плану, `npm test`, `tsc`, `lint` проходят.

## Known Stubs
Нет.

## Threat Flags
Нет новой поверхности. Митигации реестра: T-16-26 (проверка ответов и итогового состояния, N x R, `assertSingleWinner`), T-16-27 (один вход на identity, N 2..12 и R 1..50 с валидацией), T-16-28 (единый `requireStagingLiveTarget` в promotion-live).

## Self-Check: PASSED
- lib/portia-staging-concurrency-live.test.ts, lib/portia-promotion-live.test.ts: найдены.
- Коммиты 7fd21df, 519dc50: предки HEAD.
