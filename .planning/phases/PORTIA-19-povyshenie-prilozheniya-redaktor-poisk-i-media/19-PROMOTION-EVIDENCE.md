# 19-06: доказательства «Повышения» (матрица STAB-PROM)

Дата: 2026-11-03. Статус документа: промежуточный, ждёт owner UAT (Task 3). Ни один BLOCKED не записан как PASS.

## Прогон

| Поле | Значение |
|------|----------|
| Commit прогонов | `66116036389ca50352da57e33026206ef0abc6d2` (поле `commit` во всех receipts этого прогона; код фазы 19 не менялся после `1f2d1b6`, дальше только evidence) |
| Цель | изолированный проект, refHash `01d085e7b9f0`, `attest` = ATTESTED перед прогонами |
| Node | 22.13.1 |
| Run приёмки | `mvz5fqgv_c40b449b` (манифест `evidence/19-ACCEPTANCE-RUN.json`); после обоих прогонов `acceptance-residual`: banks 4, authUsers 2, editors 2, buckets/attempts/answers 0, то есть данные приёмки не затронуты |
| Live | `npm run test:staging-live`: 770 tests, 5 suites, 770 pass, 0 fail, 0 cancelled, 0 skipped |
| Playwright | `npm run test:e2e:mutation`: 70 passed (5 проектов x 14), exit 0, 5.4 мин |
| scan-evidence | `{"files_with_findings":0,"findings":0}` по каталогу фазы |

### Состав live (770)

| Suite | Tests | Вердикт |
|-------|-------|---------|
| live Promotion concurrency, lease and RLS (promo reviewer vs anon/non-promo, parallel claim, atomic admission, answer CAS, client mode + heartbeat lease) | 5 | PASS |
| single-winner assertion (юнит судьи гонок) | 5 | PASS |
| staging live concurrency (8 гонок, N=6 x R=10) | 8 | PASS |
| outcome classifier (юнит) | 4 | PASS |
| staging live role matrix | 748 | PASS |

### Receipts (скопированы без изменений из `test-results/staging/`)

Несколько файлов вместо одного: по одному файлу на suite/проект.

| Файл в evidence/ | status | residual | suites |
|------------------|--------|----------|--------|
| `receipt-staging-live-roles.json` | PASS | authUsers/content/editors/promo/storage = 0 | roles |
| `receipt-staging-live-concurrency.json` | PASS | все 0 | admission-same-nickname, admission-split-device, answer-cas, claim, cleanup-vs-admission, heartbeat-vs-expire, release-reject-delete-vs-claim, start-test-client-mode (каждая n6-r10) |
| `receipt-playwright-run1.json` ... `run5.json` | PASS x5 | все 0 | roles-spec-ts, staging-authz-spec-ts (по одному run на проект Playwright) |

Пять suites live-прогона, кроме role matrix и concurrency, receipt собственного файла не пишут: их результат это сводка node:test (pass 770, fail 0).

Наблюдение: в логе webServer при Playwright-прогоне есть `PORTIA cache purge failed ... Netlify site ID was not found`. Это локальный запуск без Netlify; тесты не падают, на вердикт не влияет.

## Матрица требований

«Серверная часть» = граница сервера/БД, доказанная live receipt с residual 0. «UI/поток» = то, что доказывается только owner UAT; юнит-тесты (`lib/portia-promotion-*.test.ts`, `lib/app-state.test.ts`) перечислены как поддержка и вердикта не заменяют.

| Требование | Доказательство (suite/test или шаг UAT) | Вердикт |
|------------|------------------------------------------|---------|
| STAB-PROM-01 | live role matrix (anon/outsider: таблицы, RPC, Storage закрыты); promotion-live `promo reviewers succeed while anon and non-promo users cannot read or invoke reviewer state`; юнит `portia-promotion-api` (safe projection, sheet outage отличается от «не найден»), `portia-promotion-staging-roster`. Шаг UAT: participant | Серверная часть PASS; поток и закрытие доступа удалением строки таблицы: ожидает 19-PROMOTION-UAT |
| STAB-PROM-02 | юнит `portia-promotion-ui` (матрица eligibility, cooldown в device time). Шаги UAT: participant, ordinary, qualification, retake (сдвиг `cooldown`) | ожидает 19-PROMOTION-UAT |
| STAB-PROM-03 | concurrency `admission-same-nickname-n6-r10`, `admission-split-device-n6-r10`; promotion-live `atomic admission creates one request and cannot split one device across two nicknames`; юнит `portia-promotion-api` (rejected submit не сохраняет токен). Шаг UAT: participant (reload, чужой ник, повторный submit) | Серверная часть (один binding и один request, отклонённый submit без следов) PASS; UI: ожидает 19-PROMOTION-UAT |
| STAB-PROM-04 | те же admission-гонки (не более одного активного запроса на ник, partial unique); юнит `portia-promotion-db` (уникальные частичные индексы), `portia-promotion-api` (порядок device, throttle, active request; нейтральный отказ без раскрытия ника). Шаги UAT: сдвиг `penalty`, границы 5/15/60 минут | Серверная часть PASS; границы ожидания и нейтральный текст: ожидает 19-PROMOTION-UAT |
| STAB-PROM-05 | юнит `portia-promotion-reviewer` (active-only, без дублей, порядок, блокировка при нехватке банка), `portia-promotion-security` (stale/tampered preview). Шаг UAT: bank CRUD, ordinary | ожидает 19-PROMOTION-UAT |
| STAB-PROM-06 | promotion-live `deployed Promotion RPC inventory matches participant, reviewer and bank routes`; юнит `portia-promotion-security` (текущий вопрос публичен, ключи нет). Шаг UAT: qualification (3, 5, 7 по ролям p-qual3/5/7) | Инвентарь RPC PASS; поток: ожидает 19-PROMOTION-UAT |
| STAB-PROM-07 | concurrency `answer-cas-n6-r10`, `heartbeat-vs-expire-n6-r10`, `start-test-client-mode-n6-r10`; promotion-live `answer CAS advances once...` и `client mode is immutable and an expired heartbeat lease fails the attempt`. Шаги UAT: reload во время попытки, сдвиг `deadline` | Серверная часть PASS; видимое поведение: ожидает 19-PROMOTION-UAT |
| STAB-PROM-08 | concurrency `start-test-client-mode-n6-r10` (режим фиксируется сервером, неизменяем); юнит `portia-promotion-ui` (тексты предупреждений PC/phone, не «hardware attestation»). Шаги UAT: потеря focus на PC, переключение вкладки на phone | Серверная часть PASS; поведение на устройствах: ожидает 19-PROMOTION-UAT |
| STAB-PROM-09 | Playwright `staging-authz`: API-матрица `/api/promotion/reviewer` x 5 ролей, revoke `promo` на открытой сессии (70 PASS, receipts run1..run5); concurrency `claim-n6-r10`, `release-reject-delete-vs-claim-n6-r10`; promotion-live `parallel claim produces exactly one assignee`; role matrix (promo-reviewer, editor-full/restricted) | Серверная часть PASS; badges и видимая очередь: ожидает 19-PROMOTION-UAT |
| STAB-PROM-10 | юнит `portia-promotion-editor` (drafts, правильные ответы рядом с вариантами, инвалидация preview). Шаг UAT: bank CRUD на PC и phone | ожидает 19-PROMOTION-UAT |
| STAB-PROM-11 | юнит `portia-promotion-editor`, `portia-promotion-reviewer` (оценка по ответам, итог вручную), `portia-promotion-api` (участник без keys, notes, reviewer). Шаг UAT: reviewer | ожидает 19-PROMOTION-UAT |
| STAB-PROM-12 | юнит `portia-promotion-notifications` (одно тихое уведомление), `portia-promotion-editor` (2 дня, изменить/продлить/снять). Шаги UAT: retake (сдвиг `retake`) | ожидает 19-PROMOTION-UAT |
| STAB-PROM-13 | concurrency `cleanup-vs-admission-n6-r10`; юнит `portia-promotion-security` (close prunes history, cleanup не трогает непроверенный flow). Шаги UAT: cleanup (сдвиг `cleanup`), активный flow другого участника run остаётся | Серверная часть (гонка очистки и допуска) PASS; payload закрытых попыток, три результата, подсказка: ожидает 19-PROMOTION-UAT |
| STAB-PROM-14 | promotion-live `deployed Promotion RPC inventory matches...`; юнит `portia-promotion-api` (missing RPC, database failure, sheet outage дают разные коды), `portia-promotion-ui` (текст «принята» только после создания). Шаг UAT: participant | Серверная часть PASS; UI-состояния: ожидает 19-PROMOTION-UAT |

## Edge-истины плана 19-06

| Истина | Чем доказана сейчас | Статус |
|--------|---------------------|--------|
| Edge STAB-PROM-03 idempotency / concurrency | admission-same-nickname и admission-split-device (receipt concurrency PASS), promotion-live atomic admission | серверная часть PASS; шаг UAT participant ожидает |
| Edge STAB-PROM-04 concurrency / idempotency | те же admission-гонки, partial unique индексы (юнит `portia-promotion-db`) | серверная часть PASS |
| Edge STAB-PROM-04 adjacency (граница blocked_until) | acceptance-shift `penalty` + UAT | ожидает 19-PROMOTION-UAT |
| Edge STAB-PROM-04 empty (ник без попыток, нейтральный текст) | юнит `portia-promotion-api` (нейтральный отказ); UAT | ожидает 19-PROMOTION-UAT |
| Edge STAB-PROM-04 ordering (ordinary и qualification независимы; device, throttle, active request) | юнит `portia-promotion-api` (порядок проверок); UAT | ожидает 19-PROMOTION-UAT |
| Edge STAB-PROM-13 concurrency | concurrency `cleanup-vs-admission-n6-r10` PASS; cleanup на живом run: UAT | серверная часть PASS; UAT ожидает |

## STAB-PROM-15

Статус: **BLOCKED**. Нужен записанный вердикт владельца для физического PC и физического phone (`19-PROMOTION-UAT.md`, строки «Вердикт PC:» и «Вердикт phone:»). Частичный прогон gate не закрывает. До вердикта PASS не записывается.

## Что не доказано этим документом

- Authenticated roles на физических устройствах, UI на PC и phone, deadline и cooldown на реальных часах: только через owner UAT.
- Удаление строки живой Google-таблицы не проверяется (мутация production-источника запрещена CLAUDE.md); ростер приёмки берётся из временного файла.
