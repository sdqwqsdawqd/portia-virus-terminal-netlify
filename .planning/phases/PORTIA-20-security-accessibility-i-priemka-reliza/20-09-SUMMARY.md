---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 09
subsystem: security
tags: [promotion, projection, no-store, authz, playwright, staging]
requires:
  - phase: PORTIA-19
    provides: promotion status/test/reviewer routes and role contract
provides:
  - "Юнит-контракт: ключевой allowlist и отсутствие privileged-маркеров в participant JSON статуса, включая повтор, параллель и denied-исходы"
  - "Проверка, что каждый Response.json в status/test/reviewer маршрутах несёт noStoreHeaders"
  - "Поведенческий тест safeProjection маршрута /api/promotion/test"
  - "Staging-проверки тел ответов: прямой отказ visitor/participant, no-store, отказ после revoke"
  - "20-PROJECTION-EVIDENCE.md: вердикт по актёрам и поверхностям"
affects: [20-final-acceptance, STAB-SEC-02]
status: complete
actuals:
  tokens: 34000
  tasks: 2
  commits: 2
plan_head_before: a313bca81e93e49199fe62c76e4b974eb4b896b2
plan_head_after: be0d9302502b27c3b7627f97d141a2d6e51a8133
tech-stack:
  added: []
  patterns:
    - "safeProjection извлекается из исходника маршрута и исполняется через module.stripTypeScriptTypes, без выноса кода из route"
    - "Сканер сбалансированных скобок для Response.json( гарантирует no-store на всех ветках"
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-PROJECTION-EVIDENCE.md
  modified:
    - lib/portia-promotion-api.test.ts
    - tests/e2e/specs/staging-authz.spec.ts
key-decisions:
  - "Маршруты status и test не менялись: утечки не подтверждено, оба уже отдают allowlist и noStoreHeaders (план разрешает правку только при подтверждённой утечке)."
  - "Кейс с реальным ником и попыткой квалификации на staging честно записан BLOCKED(DATA), а не PASS."
requirements-completed: [STAB-SEC-02]
---

# Phase 20 Plan 09: Серверная проекция и no-store Summary

Участнику отдаётся закрытый allowlist полей, а все ветки status/test/reviewer маршрутов закреплены тестами как no-store; на изолированном staging прямой отказ и revoke проверены по телам ответов.

## Что сделано

**Задача 1 (afcb6fe).** В `lib/portia-promotion-api.test.ts` добавлено 6 тестов (25 в файле, `npm test`: 1121 pass, 0 fail):
- рекурсивный allowlist ключей и сканирование маркеров (answerKey, futureQuestions, questions, bank, internalNote, notes, reviewerId/Name, linkedNickname, tokenHash, riskBucket, ipBucket) на враждебной RPC-проекции;
- идемпотентность повторного запроса и отсутствие расширения проекции с device token;
- 8 параллельных запросов Alice/Bob без смешения вывода;
- denied/failed исходы (423/503/404/404) без privileged payload и без cookie;
- сканер: каждый `Response.json(` в status, test, reviewer содержит `noStoreHeaders`;
- `safeProjection` маршрута test исполняется напрямую: закрытый набор ключей, отброшены нестроковые options и неизвестный terminalReason.

**Задача 2 (be0d930).** В `tests/e2e/specs/staging-authz.spec.ts`: прямой отказ visitor и participant (reviewer GET/POST, test без токена, status без ника) с проверкой `no-store` и тела `["error"]`; усилена проверка отказа после revoke; кейс статуса для ника из ростера пропускается как `BLOCKED(DATA)` без `PORTIA_E2E_PROMO_NICKNAME`. Запуск `npm.cmd run test:e2e:mutation -- --retries=0 ...`: exit 0, 80 passed, 5 skipped (только BLOCKED(DATA)); квитанция `mw1n7zca_83beb303`, остатки 0. Подробности в `20-PROJECTION-EVIDENCE.md`.

## Deviations from Plan

None - plan executed exactly as written. Маршруты не менялись по условию плана (утечка не подтверждена).

## Known Stubs

Нет.

## Deferred / BLOCKED

- BLOCKED(DATA): статус-тело для реального ника ростера и тело попытки квалификации на staging. Закрывается заданием `PORTIA_E2E_PROMO_NICKNAME` и сидом попытки в изолированном проекте. На уровне юнит-тестов покрыто.

## Threat Flags

Нет новой сетевой поверхности.

## Self-Check: PASSED

- lib/portia-promotion-api.test.ts, tests/e2e/specs/staging-authz.spec.ts, 20-PROJECTION-EVIDENCE.md существуют.
- Коммиты afcb6fe, be0d930 найдены в истории.
