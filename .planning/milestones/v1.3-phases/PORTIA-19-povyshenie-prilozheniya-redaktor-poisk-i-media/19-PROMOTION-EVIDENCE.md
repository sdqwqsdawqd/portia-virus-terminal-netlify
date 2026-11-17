# 19-06: доказательства «Повышения» (матрица STAB-PROM)

Дата: 2026-11-03. Статус документа: итоговый для плана 19-06 (owner UAT завершён вариантом 2, см. «Вердикт владельца»). Ни один BLOCKED не записан как PASS. UI-часть требований НЕ подтверждена на staging.

## Вердикт владельца и его границы

Владелец выбрал вариант 2: принять без повторного прохождения шагов 1–9 на staging. Фактически:

- Шаги 2–8 чек-листа (PC и phone) пройдены владельцем на PRODUCTION `production-проект (ref начинается на wqiy…)`, а не на staging: dev-сервер владельца читал `.env.local` с production URL (инцидент, `19-PROMOTION-UAT.md`, дефекты, строка 2). Агенты production не трогали. Эти прохождения НЕ зачтены как доказательство на staging.
- На staging `изолированный staging (refHash 01d085e7b9f0)` владелец подтвердил только шаг 10 (editor без `promo`): PASS. Серверная часть этого же отказа доказана receipts (см. ниже).
- Шаги 1, 9, 11 на staging не проводились. Финальный read-only residual staging: promo 0, editors 2, storage 0, content 0, authUsers 2, banks 4, buckets 0, attempts 0, answers 0 (данные run нетронуты); в логе staging-сервера нет submit-ов.
- Вердикты PC и phone записаны в `19-PROMOTION-UAT.md` как принятые по production-прогону и явно НЕ закрывающие STAB-PROM-15.

Поэтому ячейки «ожидает 19-PROMOTION-UAT» ниже заменены на «не подтверждено на staging (вердикт владельца по production-прогону, вариант 2)». Это не PASS и не FAIL: доказательства на изолированном проекте нет.

## Прогон

| Поле | Значение |
|------|----------|
| Commit прогонов | `66116036389ca50352da57e33026206ef0abc6d2` (поле `commit` во всех receipts этого прогона; код фазы 19 не менялся после `1f2d1b6`, дальше только evidence) |
| Код после прогонов | `4d2a3e9` (дефект 1, столбец E листа = дата доступности); receipts выше сняты ДО этой правки, серверная часть (RPC/RLS/гонки) её не затрагивает, юнит-тесты после правки зелёные |
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

«Серверная часть» = граница сервера/БД, доказанная live receipt с residual 0 на staging. «UI/поток» = то, что доказывается только owner UAT на staging; юнит-тесты (`lib/portia-promotion-*.test.ts`, `lib/app-state.test.ts`) перечислены как поддержка и вердикта не заменяют. Формулировка «не подтверждено на staging» везде означает: «вердикт владельца по production-прогону, вариант 2», то есть не PASS.

| Требование | Доказательство (suite/test или шаг UAT) | Вердикт |
|------------|------------------------------------------|---------|
| STAB-PROM-01 | live role matrix (anon/outsider: таблицы, RPC, Storage закрыты); promotion-live `promo reviewers succeed while anon and non-promo users cannot read or invoke reviewer state`; юнит `portia-promotion-api` (safe projection, sheet outage отличается от «не найден»), `portia-promotion-staging-roster`. Шаг UAT: participant | Серверная часть PASS; поток и закрытие доступа удалением строки таблицы: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-02 | юнит `portia-promotion-ui` (матрица eligibility, cooldown в device time; после 4d2a3e9 столбец E = дата доступности, cooldown звания не прибавляется). Шаги UAT: participant, ordinary, qualification, retake (сдвиг `cooldown`) | UI: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2); дефект 1 исправлен и покрыт тестами, повторного прохождения на staging нет |
| STAB-PROM-03 | concurrency `admission-same-nickname-n6-r10`, `admission-split-device-n6-r10`; promotion-live `atomic admission creates one request and cannot split one device across two nicknames`; юнит `portia-promotion-api` (rejected submit не сохраняет токен). Шаг UAT: participant (reload, чужой ник, повторный submit) | Серверная часть (один binding и один request, отклонённый submit без следов) PASS; UI: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-04 | те же admission-гонки (не более одного активного запроса на ник, partial unique); юнит `portia-promotion-db` (уникальные частичные индексы), `portia-promotion-api` (порядок device, throttle, active request; нейтральный отказ без раскрытия ника). Шаги UAT: сдвиг `penalty`, границы 5/15/60 минут | Серверная часть PASS; границы ожидания и нейтральный текст: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2); сдвиги `cooldown`/`penalty` через wrapper не запрашивались |
| STAB-PROM-05 | юнит `portia-promotion-reviewer` (active-only, без дублей, порядок, блокировка при нехватке банка), `portia-promotion-security` (stale/tampered preview). Шаг UAT: bank CRUD, ordinary | не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-06 | promotion-live `deployed Promotion RPC inventory matches participant, reviewer and bank routes`; юнит `portia-promotion-security` (текущий вопрос публичен, ключей нет). Шаг UAT: qualification (3, 5, 7 по ролям p-qual3/5/7) | Инвентарь RPC PASS; поток: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-07 | concurrency `answer-cas-n6-r10`, `heartbeat-vs-expire-n6-r10`, `start-test-client-mode-n6-r10`; promotion-live `answer CAS advances once...` и `client mode is immutable and an expired heartbeat lease fails the attempt`. Шаги UAT: reload во время попытки, сдвиг `deadline` | Серверная часть PASS; видимое поведение: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-08 | concurrency `start-test-client-mode-n6-r10` (режим фиксируется сервером, неизменяем); юнит `portia-promotion-ui` (тексты предупреждений PC/phone, не «hardware attestation»). Шаги UAT: потеря focus на PC, переключение вкладки на phone | Серверная часть PASS; поведение на устройствах: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-09 | Playwright `staging-authz`: API-матрица `/api/promotion/reviewer` x 5 ролей, revoke `promo` на открытой сессии (70 PASS, receipts run1..run5); concurrency `claim-n6-r10`, `release-reject-delete-vs-claim-n6-r10`; promotion-live `parallel claim produces exactly one assignee`; role matrix (promo-reviewer, editor-full/restricted). Шаг UAT 10 (direct denial): PASS владельцем на staging, editor без promo | Серверная часть PASS; direct denial (шаг 10) PASS на staging; badges и видимая очередь (шаг 3): не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-10 | юнит `portia-promotion-editor` (drafts, правильные ответы рядом с вариантами, инвалидация preview). Шаг UAT: bank CRUD на PC и phone | не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-11 | юнит `portia-promotion-editor`, `portia-promotion-reviewer` (оценка по ответам, итог вручную), `portia-promotion-api` (участник без keys, notes, reviewer). Шаг UAT: reviewer | не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-12 | юнит `portia-promotion-notifications` (одно тихое уведомление), `portia-promotion-editor` (2 дня, изменить/продлить/снять). Шаги UAT: retake (сдвиг `retake`) | не подтверждено на staging (вердикт владельца по production-прогону, вариант 2) |
| STAB-PROM-13 | concurrency `cleanup-vs-admission-n6-r10`; юнит `portia-promotion-security` (close prunes history, cleanup не трогает непроверенный flow). Шаги UAT: cleanup (сдвиг `cleanup`) | Серверная часть (гонка очистки и допуска) PASS; payload закрытых попыток, три результата, подсказка: не подтверждено на staging, шаг 9 не проводился нигде (даже на production) |
| STAB-PROM-14 | promotion-live `deployed Promotion RPC inventory matches...`; юнит `portia-promotion-api` (missing RPC, database failure, sheet outage дают разные коды), `portia-promotion-ui` (текст «принята» только после создания). Шаг UAT: participant, состояния ошибок (шаг 11) | Серверная часть PASS; UI-состояния: не подтверждено на staging (вердикт владельца по production-прогону, вариант 2); шаг 11 не проводился |

## Edge-истины плана 19-06

| Истина | Чем доказана сейчас | Статус |
|--------|---------------------|--------|
| Edge STAB-PROM-03 idempotency / concurrency | admission-same-nickname и admission-split-device (receipt concurrency PASS), promotion-live atomic admission | серверная часть PASS; шаг UAT participant: не подтверждено на staging |
| Edge STAB-PROM-04 concurrency / idempotency | те же admission-гонки, partial unique индексы (юнит `portia-promotion-db`) | серверная часть PASS |
| Edge STAB-PROM-04 adjacency (граница blocked_until) | acceptance-shift `penalty` + UAT | не подтверждено на staging (сдвиг `penalty` не запрашивался) |
| Edge STAB-PROM-04 empty (ник без попыток, нейтральный текст) | юнит `portia-promotion-api` (нейтральный отказ); UAT | не подтверждено на staging |
| Edge STAB-PROM-04 ordering (ordinary и qualification независимы; device, throttle, active request) | юнит `portia-promotion-api` (порядок проверок); UAT | не подтверждено на staging |
| Edge STAB-PROM-13 concurrency | concurrency `cleanup-vs-admission-n6-r10` PASS; cleanup на живом run: шаг 9 не проводился | серверная часть PASS; UAT: не подтверждено |

## STAB-PROM-15

Статус: **BLOCKED / открыт**. Вердикты PC и phone записаны, но касаются production-прогона шагов 1–8 и единственного staging-шага 10. Полный сквозной прогон «participant → reviewer → bank CRUD → ordinary → qualification → retake → cleanup → direct denial» на изолированном staging с временными данными НЕ выполнен (шаги 1–9 и 11 на staging нет; шаг 9 не проводился нигде). Допущение плана «gate закрывает только полный прогон без unresolved failures» не выполнено. Долг: живая приёмка на staging переносится в 19-14 / Phase 20.

### Teardown данных приёмки (19-07, D-04)

| Требование | Результат | Доказательство |
|------------|-----------|----------------|
| STAB-PROM-15 / teardown | PASS (D-04 закрыт): по решению владельца «удалить» (2026-11-03) удалены только данные run `mvz5fqgv_c40b449b` на staging (refHash `01d085e7b9f0`): 2 editors, 2 authUsers, 4 банка; `acceptance-residual` после удаления: все 9 счётчиков = 0; scan-evidence по каталогу фазы: 0 находок | `evidence/19-ACCEPTANCE-TEARDOWN.json` |
| STAB-PROM-15 (сам gate) | BLOCKED / открыт: teardown НЕ означает PASS приёмки; живая приёмка на staging остаётся долгом (19-14 / Phase 20) | раздел STAB-PROM-15 выше |

Повторная приёмка на staging потребует нового seed (временные аккаунты и ростер удалены).

## Дефект 1 (шаг 6) и инцидент production

- Дефект 1: живая таблица содержит в столбце E дату окончания ожидания, а код прибавлял к ней cooldown звания. Исправлено в `4d2a3e9` (столбец E = дата доступности, cooldown не прибавляется), юнит-тесты зелёные; ростер run: `p-cooldown` E `2026-11-01` → `2026-11-08`. Владелец записал повтор шага 6 как PASS, но на production, поэтому для staging он не зачтён.
- Инцидент 2026-11-03: dev-сервер владельца брал `.env.local` с production `production-проект (ref начинается на wqiy…)`; шаги 2–8 изменяли production (заявки и привязки живых ников, claim, банки, итоги, штрафы), очистка шага 9 не запускалась. Агенты production не трогали (все wrapper-команды только на staging `изолированный staging (refHash 01d085e7b9f0)`, refHash `01d085e7b9f0`). Оценка и возможная правка изменений на production — решение владельца.

## Что не доказано этим документом

- Authenticated roles на физических устройствах на staging, UI на PC и phone на staging, deadline и cooldown на реальных часах на staging: не подтверждено.
- Удаление строки живой Google-таблицы не проверяется (мутация production-источника запрещена CLAUDE.md); ростер приёмки берётся из временного файла.

## Повторная приёмка на staging (gap closure, 19-21)

Run `mw1loqa9_c9451c80`, refHash `01d085e7b9f0`; receipts 19-20: live 770/770 PASS, Playwright 70/70 PASS, 7 receipts PASS, residual suite = 0. Перед шагом 0 сервер `acceptance-serve` выдал `STAGING-BOUND` 2026-11-04T07:59:51Z (serverBound/clientBound = true). Владелец 2026-11-04 сообщил «19-21 pass» и подтвердил, что на физическом PC и phone пройдены шаг 0, шаги 1–11 и F9–F12 на этом staging run без FAIL. Подробные наблюдения по шагам не переданы; журнал сдвигов дат для этого run пуст. PASS ниже означает вердикт владельца на устройствах, а не машинный receipt конкретного шага.

| Требование | Шаги | PC | phone | Receipts 19-20 | Итог |
|---|---|---|---|---|---|
| STAB-PROM-01 | 1, 2; удаление строки источника | PASS 1–2; удаление не проверялось | PASS 1–2; удаление не проверялось | PASS | Pending: удаление строки не доказано |
| STAB-PROM-02 | 1, 2, 6–8 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: сдвиги дат не зафиксированы |
| STAB-PROM-03 | 1–2 | PASS | PASS | PASS | PASS |
| STAB-PROM-04 | 2, 8 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: границы 5/15/60 без shift receipts |
| STAB-PROM-05 | 4–5 | PASS | PASS | PASS | PASS |
| STAB-PROM-06 | 6 | PASS | PASS | PASS | PASS для ролей и типов; deadline отдельно в 07 |
| STAB-PROM-07 | 6, 11 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: deadline shift не зафиксирован |
| STAB-PROM-08 | 6, 11 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: phone offline/deadline не подтверждены shift receipt |
| STAB-PROM-09 | 3, 10 | PASS | PASS | PASS | PASS |
| STAB-PROM-10 | 4, F9–F12 | PASS | PASS | PASS | PASS |
| STAB-PROM-11 | 5 | PASS | PASS | PASS | PASS |
| STAB-PROM-12 | 7 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: retake shift не зафиксирован |
| STAB-PROM-13 | 9 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: cleanup shift и teardown 19-22 |
| STAB-PROM-14 | 1, 2, 11 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: missing RPC, БД и sheet outage не имеют отдельных наблюдений |
| STAB-PROM-15 | 0–11, F9–F12 | PASS по словам владельца | PASS по словам владельца | PASS | Pending: shift receipts отсутствуют; teardown 19-22 ещё не проведён |

Read-only `acceptance-residual mw1loqa9_c9451c80` перед teardown 2026-11-04: `promo=5, editors=2, storage=0, content=0, authUsers=2, banks=4, buckets=2, attempts=1, answers=5`, `legacyWindow=false`. Остаток ещё не удалён. Сводка выше не отменяет исторические выводы о прежнем production-прогоне.

### Teardown повторного run (19-22)

Владелец дословно разрешил «удалить временный staging» 2026-11-04. Перед удалением `attest` вернул refHash `01d085e7b9f0`, read-only residual повторил счётчики выше. Guarded `acceptance-teardown mw1loqa9_c9451c80` завершился без ошибок; отдельный `acceptance-residual` подтвердил нули в promo, editors, storage, content, authUsers, banks, buckets, attempts и answers. Receipt: `evidence/19-ACCEPTANCE-TEARDOWN-RERUN.json`. D-04 (удаление временных данных) PASS.

STAB-PROM-13 и STAB-PROM-15 остаются **Pending**, несмотря на нулевой остаток: владелец сообщил общий PASS шагов 9 и 0–11 на обоих устройствах, но журнал этого run не содержит сдвигов `cleanup`, `deadline`, `retake`, `cooldown`, `penalty`; подробные наблюдения временных границ не представлены. Часть сценариев требует ждать больше времени, чем длился зафиксированный сеанс. Доказательства не восстановлены задним числом. Новый прогон для этих проверок теперь потребует отдельного seed. Ранее записанный физический вердикт владельца сохраняется как его наблюдение, но не подменяет недостающие receipts.
