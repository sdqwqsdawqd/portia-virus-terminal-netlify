---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 02
subsystem: infra
tags: [next, eslint-config-next, netlify, security-advisory, exact-pin, SEC-08]

requires:
  - phase: PORTIA-20
    provides: exact-pin rule, dependency audit evidence (hash-bound to package.json / package-lock.json)
provides:
  - next and eslint-config-next exact-pinned at 16.4.5 (package.json, package-lock.json)
  - 21-SEC08-ADVISORY.md: Netlify advisory 2026-11-03 read record, CVE list, registry facts
affects: [21-07, PORTIA-22, PORTIA-23, PORTIA-24, PORTIA-25]

requirements-completed: [SEC-08]
status: complete

actuals:
  tokens: 40000
  tasks: 3
  commits: 3
plan_head_before: a1cd491d8196a37ce51f72538410cfdccbaed24f
plan_head_after: 255ec54

tech-stack:
  added: []
  patterns:
    - "package-legitimacy gate: advisory + registry facts recorded, owner confirms at blocking-human checkpoint, only then install, lockfile integrity compared after"

key-files:
  created:
    - .planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/21-SEC08-ADVISORY.md
    - .planning/phases/PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal/deferred-items.md
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "The bump commit stays standalone (package.json + package-lock.json only); regenerating the Phase 20 dependency-audit evidence is deferred, not folded in"

duration: 1 session (continuation after the Task 2 checkpoint)
completed: 2026-11-09
---

# Phase 21 Plan 02: Подъём next и eslint-config-next до 16.4.5 Summary

`next` и `eslint-config-next` закреплены точными версиями 16.4.5 (SEC-08, Netlify advisory 2026-11-03) отдельным коммитом; tsc, lint и production build зелёные, но подписанное доказательство аудита Phase 20 устарело и один unit-тест красный сверх двух документированных.

## Выполнено

| Задача | Результат | Коммит |
|--------|-----------|--------|
| 1. Перечитать advisory, записать факты реестра | Страница Netlify прочитана целиком (HTTP 200, 2026-11-09), 7 уязвимостей Medium, исправление 16.4.5; факты npm записаны | c8cd3cf |
| 2. Подтверждение владельца (blocking-human) | Владелец 2026-11-09 написал «подтверждаю»: обе релизные страницы npmjs.com (next@16.4.5, eslint-config-next@16.4.5) легитимны | - (чекпоинт) |
| 3. Точные пины 16.4.5, проверки | Установка выполнена, lockfile совпал с записанной integrity, проверки ниже | 255ec54 |

Коммит подъёма: `git show --name-only --format= 255ec54` перечисляет ровно `package.json` и `package-lock.json`.

## Установка и lockfile

- npm CLI: машинный `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`, версия 11.19.0 (встроенный npm Node 22.13.1 не использовался, подмена по плану D-69). Node 22.13.1 на PATH.
- Команда: `install --save-exact next@16.4.5 eslint-config-next@16.4.5`. `npm audit fix` не запускался.
- `package.json`: `"next": "16.4.5"` (dependencies), `"eslint-config-next": "16.4.5"` (devDependencies), без `^`/`~`. Других зависимостей в package.json не менялось.
- `package-lock.json`: `node_modules/next` и `node_modules/eslint-config-next` = 16.4.5; integrity обоих совпала с записью в 21-SEC08-ADVISORY.md (`next` sha512-rmdfsWos...ABw==, `eslint-config-next` sha512-mvh39zYL...Ijg==); `resolved` указывает на registry.npmjs.org.
- Остальные изменения lockfile: пакеты `@next/*` (env, eslint-plugin-next, swc-* для платформ) 16.4.2 -> 16.4.5 и добавленные npm метаданные `libc` у линукс-swc пакетов. Других версий не двигалось.
- npm при установке заодно "нормализовал" пробел в строке скрипта `test:e2e:preflight` в package.json; эта правка откатана вручную, чтобы коммит содержал только подъём версий.

## Результаты проверок (после подъёма)

| Проверка | Результат |
|----------|-----------|
| `next --version` | Next.js v16.4.5 (было v16.4.2), PASS |
| `tsc --noEmit` | exit 0, PASS |
| eslint | exit 0; предупреждений 17 до и 17 после (0 ошибок), новых нет; PASS |
| `next build` | exit 0, "Compiled successfully", 3/3 статических страниц, все маршруты на месте; PASS (читает .env.local через Next.js; содержимое не открывалось) |
| unit `lib/*.test.ts` | 1742 теста, pass 1736, fail 3, skipped 3; НЕ PASS (см. ниже) |

### Unit-тесты: три падения вместо ожидаемых двух

1. `migration coverage: the real matrix has exactly one row per tracked supabase migration` - ожидаемое красное окно Phase 21, закрывается в 21-07. Не связано с подъёмом.
2. `matrix freshness: the real matrix commit is an ancestor of HEAD and no covered file changed after it` - то же красное окно, 21-07.
3. **НОВОЕ, вызвано подъёмом:** `the real audit evidence verifies: both audits on one commit, production clean, one disposition per dev advisory`. Ошибка: `stale report: package-lock.json changed after the audit was captured` и то же для `package.json`. `20-DEPENDENCY-AUDIT.json` хранит sha256 обоих файлов, поэтому любое изменение зависимостей делает его устаревшим (`scripts/phase20-audit-check.mjs`, `verifyAuditReport`). Это не дефект кода сайта, а привязка подписанного доказательства Phase 20 к хешам.

Критерий плана "нет падений кроме двух документированных" по пункту 3 НЕ выполнен. Не исправлялось: пересъёмка (`phase20-audit-check.mjs --capture`) перезаписывает подписанные доказательства Phase 20, ходит в реестр и выходит за файлы плана и правило standalone-коммита. Записано в `deferred-items.md` (статус OPEN) с рекомендацией выполнить пересъёмку аудита отдельным шагом (например, в 21-07 или quick-таске). Решение за владельцем.

## Netlify-адаптер

`@netlify/plugin-nextjs` >= 5.16.6: BLOCKED (OWNER). Версию адаптера (и случай Middleware) можно подтвердить только в логе деплоя владельца; локально это не PASS. Staging/production не проверялись (BLOCKED, до собственной фазы).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Откат побочной нормализации package.json**
- **Found during:** Task 3
- **Issue:** npm изменил пробел в строке `test:e2e:preflight`, не относящейся к подъёму.
- **Fix:** строка возвращена к исходному виду, чтобы diff package.json содержал только две версии.
- **Files modified:** package.json
- **Commit:** 255ec54

### Deferred Issues

- Устаревшее доказательство аудита Phase 20 (тест `the real audit evidence verifies`): см. выше и `deferred-items.md`. Влияет на критерий "unit suite без неожиданных падений".

## Known Stubs

None.

## Threat Flags

None. Новой поверхности (эндпоинты, auth, файловый доступ) этот план не добавил; митигации T-21-08, T-21-09, T-21-10, T-21-SC выполнены (integrity сверена, подтверждение владельца получено до установки, пины точные, tsc/lint/build зелёные). T-21-10 частично: unit-набор показывает новое падение по привязке аудита (не поломка сборки).

## Учёт коммитов

`plan_head_before` = a1cd491 (база плана). С тех пор в ветку попали чужие для 21-02 коммиты плана 21-01 (e09b224, 1dfe52c, bfa4a34, 852825e) и оркестратора (627242f); механический `rev-list` их включил бы. Коммиты 21-02: c8cd3cf (advisory), 255ec54 (подъём версий) и docs-коммит с этим SUMMARY и deferred-items.md; `commits: 3`.

## Self-Check: PASSED

- 21-SEC08-ADVISORY.md, deferred-items.md, package.json, package-lock.json присутствуют; коммиты c8cd3cf и 255ec54 существуют в истории ветки.
- STATE.md и ROADMAP.md не менялись (ведёт оркестратор).
