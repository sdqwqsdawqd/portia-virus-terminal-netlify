---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 11
subsystem: security-evidence
tags: [rls-review, security-matrix, browser-backstop, local-check, lvl-04, lvl-05, lvl-08, lvl-09, sec-01-transfer]
requires:
  - phase: PORTIA-24-01..24-10
    provides: серверная очистка по уровню, ответ GET по зрителю, PUT с отказом копии зрителя, заглушки, редактор, «Корзина», «Устав»
provides:
  - браузерные backstop-проверки S1, S3, S4, S6 на подменённых ответах /api/** (PASS-local, mocked API)
  - два раунда настоящего ревью supabase-rls-reviewer (раунд 1 на f331dff, раунд 2 на a9847aa), открытых critical 0, high 0, medium нет
  - матрица безопасности Phase 24 на проверенном коммите a9847aa, красное окно закрыто (lib/security-matrix.test.ts читает матрицу Phase 24)
  - lib/phase24-evidence.test.ts: ревью, матрица, браузерные и локальные доказательства согласованы, BLOCKED не записан как пройденный
  - 24-LOCAL-CHECK.md: прямые эквиваленты шагов run.sh с кодами выхода (сам run.sh не отработал)
affects: [PORTIA-25]
requirements-completed: []
actuals:
  tokens: 31000
  tasks: 3
  commits: 8
plan_head_before: 937926bfbd1379fa55836d9d9634797560888fc1
plan_head_after: ae9d7c7bf72c1365aa4de746f215ab6857bda009
tech-stack:
  added: []
  patterns: [ревью и матрица привязаны к одному «проверяемому коммиту», тест свежести падает при правке охваченного пути, поэтому отложенные low-находки не правятся после финального раунда]
key-files:
  created:
    - tests/e2e/specs/access-levels.spec.ts
    - lib/phase24-evidence.test.ts
    - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-BROWSER-EVIDENCE.md
    - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-RLS-REVIEW.md
    - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-SECURITY-MATRIX.md
    - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-LOCAL-CHECK.md
  modified:
    - lib/level-redact.ts
    - lib/content-save.ts
    - app/api/content/route.ts
    - proxy.ts
    - lib/security-matrix.test.ts
key-decisions:
  - "Проверяемый коммит ревью и матрицы — a9847aaf6f0fd869670d0b83fd78b3b48c56e54f. После раунда 2 охваченные пути не менялись: RLS24-08 (комментарий proxy.ts про Set-Cookie) отложен в release-ledger на Phase 25, чтобы не требовать третьего раунда и не делать матрицу устаревшей."
  - "Файл корзины kind virus с пустым или битым virusId закрыт на уровне 5 (fail-closed), а не 1; допущение O-3/A-4 уточнено, решения владельца D-03..D-12 не затронуты."
  - "Прямое анонимное чтение portia_content остаётся остаточным риском, переданным Phase 25 (SEC-01); записано как transfer, не PASS."
  - "LVL-09 остаётся Pending: S6 доказан только на подменённых ответах, живая часть BLOCKED."
status: complete
completed: 2026-11-15
---

# Phase 24 Plan 11: Доказательства фазы Summary

Фаза закрыта проверяемыми доказательствами: браузерный backstop на подменённых ответах, два раунда настоящего статического ревью без открытых critical/high/medium, свежая матрица безопасности на ревьюированном коммите и локальная проверка с кодами выхода. Всё живое (роли, Postgres/RLS, staging, production, Netlify CDN, устройства) остаётся BLOCKED.

## Что сделано

**Задача 1, коммит `f331dff`: браузерные backstop-проверки.** `tests/e2e/specs/access-levels.spec.ts`: `page.route("**/api/**")` отвечает известным путям подготовленным JSON, любой другой запрос прерывается; ответы `/api/content` строит тот же серверный код очистки. S1, S3, S4, S6 — 9 из 9 тестов, PASS-local (mocked API), код выхода 0 (`24-BROWSER-EVIDENCE.md`). Горизонтальное переполнение «Базы вирусов» на 320 px (35-52 px) есть и без заглушек, не внесено Phase 24, записано в `deferred-items.md` и в доказательствах как оговорка; строгое чтение S1/S4 там не заявлено.

**Задача 2: ревью, исправления, матрица.**
- Раунд 1 (f331dff, ревьюера запустил оркестратор): critical и high нет, одна medium и шесть low. Исправлено с падающим тестом в `e24dadf` (RLS24-01 файл корзины с битым `virusId` открывался на уровне 1; RLS24-05 черновики сводок уходили посетителю; RLS24-06 префикс `assistant:` пропускал любой ключ), `2cabb1b` (RLS24-04 PUT пропускал `redaction: null`), `043d33c` (RLS24-07 комментарий `proxy.ts`), `78514fd` (комментарий теста). RLS24-02 и RLS24-03 приняты и записаны для Phase 25. Раунд записан в `a9847aa`.
- Раунд 2 (a9847aa, ревьюера снова запустил оркестратор): подтверждено закрытие RLS24-01 и RLS24-04..07 (07 с оговоркой), согласие с принятием RLS24-02 и RLS24-03; новых critical, high, medium нет. Две новые low записаны без правок кода: RLS24-08 (комментарий `proxy.ts` о `Set-Cookie` на GET `/api/content`, release-ledger, Phase 25) и RLS24-09 (избыточная фильтрация рекомендаций, accepted). Честно записано, кто что выполнил: у ревьюера не было shell и он читал итоговое состояние файлов; построчный diff `f331dff..a9847aa` выполнил оркестратор (изменились route.ts, content-save.ts, level-redact.ts, proxy.ts; `proxy.ts` только комментарий, `matcher` прежний).
- Коммит `2961f32`: шапка и раздел раунда 2 в `24-RLS-REVIEW.md`, `24-SECURITY-MATRIX.md` на `a9847aa` (семь новых охваченных модулей, строка маршрута контента с GET по зрителю и PUT с 422 `viewer-copy`, раздел «Phase 24 security findings» с остаточным риском SEC-01 как transfer), `lib/security-matrix.test.ts` переключён на матрицу Phase 24 (красное окно закрыто, полный набор без `skip`-паттернов), `lib/phase24-evidence.test.ts`.

**Задача 3, коммит `ae9d7c7`: локальная проверка.** `24-LOCAL-CHECK.md` и ещё один тест в `lib/phase24-evidence.test.ts`. `bash .claude/skills/portia-check/run.sh` запускался и завершился кодом 1 на первом шаге: сломан `npm` временного Node 22.13.1 (`Cannot find module 'node-gyp/bin/node-gyp.js'`). Тот же набор шагов выполнен напрямую: unit 2103 теста, pass 2100, fail 0, skipped 3 (прежние opt-in живые наборы); tsc 0 ошибок; lint 0 errors, 17 прежних предупреждений; тест визуального манифеста 49/49; `--verify-promotion` код 0 (65 байтовых снимков). Режим `--verify` не запускался. Прогон самого `run.sh` не засчитан.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Файл корзины с битым `virusId` открывался на уровне 1 (RLS24-01, medium)**
- **Found during:** Task 2, ревью раунд 1
- **Fix:** `?? MAX_ACCESS_LEVEL` вместо `?? BASE_LEVEL`, сначала падающий тест
- **Files modified:** lib/level-redact.ts, lib/level-redact.test.ts
- **Commit:** `e24dadf`

**2. [Rule 1 - Bug] Черновики сводок и любой ключ `assistant:*` уходили посетителю (RLS24-05, RLS24-06)**
- **Fix:** только `published` сводки; точный набор из четырёх ключей ассистента
- **Files modified:** lib/level-redact.ts, lib/level-redact.test.ts
- **Commit:** `e24dadf`

**3. [Rule 1 - Bug] PUT пропускал копию зрителя с `redaction: null` (RLS24-04)**
- **Fix:** `prepareContentSave(normalized, body.content)` отказывает 422 по ключу `redaction` в присланном теле с любым значением
- **Files modified:** lib/content-save.ts, app/api/content/route.ts, lib/content-save.test.ts
- **Commit:** `2cabb1b`

**4. [Rule 1 - Bug] Устаревший комментарий `proxy.ts` про CDN (RLS24-07)**
- **Commit:** `043d33c` (и `78514fd`, комментарий теста)

### Отклонения от формулировки плана

- **Проверка до запроса ревьюеру (шаг 1).** План ожидал, что охват матрицы Phase 23 изменился только в `app/api/content/route.ts` и `lib/access-levels.ts`; в раунде 1 к ним добавился только комментарий `proxy.ts` (исправление RLS24-07), раунд 2 прочитал его. Новые модули Phase 24 лежат в новых строках охвата.
- **Ревьюера запускал оркестратор**, а не исполнитель (у исполнителя нет инструмента Agent/Task), как в 23-11 и 23-12; ревью исполнитель не писал.
- **`run.sh` не отработал** (сломан `npm` временного Node); вместо него записаны прямые эквиваленты. Критерий плана «`bash run.sh` завершается строкой `== all checks passed`» поэтому выполнен только по эквивалентам; это записано в `24-LOCAL-CHECK.md`.
- **Playwright и сборка** запускались напрямую (не через `npm run`) по той же причине, preflight не обходился (`24-BROWSER-EVIDENCE.md`).

## Auth gates

Нет.

## Known Stubs

Нет. В коде этого плана заглушек нет; заглушки «ЗАСЕКРЕЧЕНО» — продуктовая функция Phase 24, не недоделка.

## Deferred Issues

- Переполнение «Базы вирусов» на 320 px (35-52 px) не внесено Phase 24, решает владелец (`deferred-items.md`).
- RLS24-08 (комментарий `proxy.ts` о `Set-Cookie`), RLS24-09 (избыточная фильтрация рекомендаций), RLS24-02, RLS24-03 и остаточный риск SEC-01 переданы Phase 25.

## Threat Flags

Нет новой поверхности, не описанной в модели угроз плана (T-24-33..35 закрыты: статусы только PASS-local/BLOCKED, все `/api/**` подменены, SEC-01 записан как transfer).

## Requirements

- LVL-04, LVL-05, LVL-08 уже отмечены выполненными в предыдущих планах фазы; доказательства этого плана их поддерживают, статус не менялся.
- LVL-09 остаётся Pending: S6 пройден только на подменённых ответах, живая смена уровня и отзыв в таблице «Пользователи» BLOCKED.

## BLOCKED (ничего не засчитано)

Живые роли, Postgres/RLS и RPC шлюза, прямое anon-чтение `portia_content`, Netlify CDN и `Set-Cookie` на GET, staging, production и включение закрытия (Phase 25), физические устройства, скринридер, другие проекты Playwright (`chromium-dpr125`, `chromium-phone`), `npm run build` на итоговом HEAD с реальными данными.

## Self-Check: PASSED

Проверено: файлы плана на диске; коммиты `f331dff`, `e24dadf`, `2cabb1b`, `043d33c`, `78514fd`, `a9847aa`, `2961f32`, `ae9d7c7` являются предками HEAD; `lib/security-matrix.test.ts`, `lib/phase24-evidence.test.ts`, `lib/phase23-evidence.test.ts` проходят (61 тест, 0 fail); полный unit-набор 2103/2100/0/3.
