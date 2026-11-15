---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 06
subsystem: access
tags: [put-content, viewer-copy, level-hierarchy, lvl-08, lvl-03]
requires:
  - phase: PORTIA-24-01
    provides: isViewerShapedContent, levelCopy.putRefused, GET по зрителю (редактор получает полное содержимое)
  - phase: PORTIA-24-03
    provides: raiseChildLevels
provides:
  - lib/content-save.ts - чистая prepareContentSave (refuse 422 viewer-copy | save с поднятым контентом и levelsRaised)
  - PUT /api/content отказывает копии «для зрителя» до чтения и записи строки и пишет контент с поднятыми уровнями детей
affects: [PORTIA-24-08, PORTIA-24-10, PORTIA-24-11]
requirements-completed: []
actuals:
  tokens: 2500
  tasks: 2
  commits: 2
plan_head_before: e9d7f6736c3feed420fc6867d6e7c510e97bea04
plan_head_after: 1cc6c3ac020a2ce2227321a581270b8381608245
tech-stack:
  added: []
  patterns: [решение «писать или отказать» вынесено в чистую функцию, маршрут проверяется тестом по исходнику без комментариев и с приведением CRLF к LF]
key-files:
  created:
    - lib/content-save.ts
    - lib/content-save.test.ts
  modified:
    - app/api/content/route.ts
key-decisions:
  - "Отказ копии зрителя - 422 с code viewer-copy и текстом levelCopy.putRefused, с noStoreHeaders, сразу после нормализации и до ветки закрытых разделов, чтения строки и сброса кэша."
  - "Ветка закрытых разделов по-прежнему сравнивает baseline с normalized (намерение редактора), а в базу пишется prepared.content (после подъёма уровней)."
  - "Успешный ответ PUT дополнен levelsRaised; остальной контракт (403, 413, 400, 409, 500, CAS по revision, purgeCacheTag) не менялся."
duration: 15min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 06: отказ копии «для зрителя» и нормализация иерархии в PUT Summary

PUT /api/content больше не принимает копию, собранную для зрителя (маркер `redaction` или запись учёного с `withheld`): ответ 422 `viewer-copy` без обращения к базе, и поднимает уровни подразделов «Информации» и карточек «Справочника» до уровня раздела перед записью, возвращая `levelsRaised`.

## Что сделано

**Задача 1, коммит `77ab953`: `prepareContentSave` (lib/content-save.ts).** Чистая функция: сначала `isViewerShapedContent` (отказ 422, `code: "viewer-copy"`, `error: levelCopy.putRefused`), затем `raiseChildLevels` (`save` с `content` и `levelsRaised`). Вход не мутируется, повторная отправка той же копии даёт тот же отказ. Тесты по `<behavior>`: `redaction`, `withheld` в recycledViruses, подъём подраздела 1 -> 3 с неизменным входом (deepEqual со снимком), контент без нарушений (`levelsRaised: 0`, содержимое равно входу).

**Задача 2, коммит `1cc6c3a`: проводка в PUT (app/api/content/route.ts).** `prepareContentSave(normalized)` стоит сразу после проверки `!normalized || baseRevision === null`; при `refuse` возвращается `prepared.body` со статусом `prepared.status` и `noStoreHeaders`. В `row.payload` идёт `prepared.content`, в ответе `levelsRaised`. Тест по исходнику маршрута закрепляет порядок (normalize < prepare < closedSectionsOf, prepare раньше любого `.from("portia_content")` и `purgeCacheTag(`), отсутствие `payload: normalized`, строку `code: refusal.code, sections: refusal.sections`, `contentRefusal(baseline, normalized, ...)`, `purgeCacheTag(contentCacheTag)`, CAS `.eq("revision", baseRevision)` и 409.

## Проверка

- `node --experimental-strip-types --test lib/content-save.test.ts lib/editor-save-status.test.ts lib/content-response.test.ts lib/level-ui.test.ts lib/access-foundation.test.ts` - 92 pass, 0 fail.
- Окно красного (`--test-skip-pattern="matrix freshness: the real matrix commit" lib/*.test.ts`) - 2053 tests, 2050 pass, 0 fail, 3 skipped. Пропуск именованного теста «matrix freshness» не считается PASS: он остаётся красным до плана 24-11.
- `node node_modules/typescript/bin/tsc --noEmit` - 0 ошибок (`npm exec tsc` под временным Node не используется).
- ESLint по всему проекту (прямой бинарь) - 0 ошибок, 17 предупреждений в файлах, которые этот план не трогал (tests/e2e/visual-candidates/...).
- Критерии приёмки: `grep` находит `export function prepareContentSave`, `prepareContentSave(normalized)`, `payload: prepared.content`, `code: refusal.code, sections: refusal.sections`.

## Не доказано (BLOCKED)

- Живая запись в базу и конкурентные сохранения по CAS - BLOCKED: нет изолированной базы. Проверено чистой функцией и исходником маршрута, а не выполнением запроса.
- Аутентифицированные роли и работа маршрута под реальной сессией редактора - BLOCKED до своих фаз.
- Проход `supabase-rls-reviewer` по изменению маршрута запланирован в плане 24-11 и здесь не заявляется.

## Требования

LVL-03 и LVL-08 не отмечены выполненными, остаются Pending: серверная часть готова (PUT), но сквозное выполнение приходит позже. LVL-03 ещё закрывают 24-08 (подъём уровней в редакторе, подсказки) и общая проверка; LVL-08 - 24-08, 24-10 и 24-11 (клиент редактора, сверка, матрица). Остаточный риск T-24-24 (изменённый клиент снимает маркеры и шлёт усечённую копию без `redaction`) принят и записывается в матрицу 24-11: сверка по id вне этой фазы.

## Deviations from Plan

None - plan executed exactly as written.

Организационно: тесты маршрута из Задачи 2 первоначально лежали в одном файле с тестами Задачи 1; чтобы коммит Задачи 1 не был красным, они добавлены в тот же файл коммитом Задачи 2.

## Known Stubs

None.

## Threat Flags

None - новых сетевых точек, путей авторизации или схемы не добавлено; PUT только строже.

## Self-Check: PASSED

- lib/content-save.ts, lib/content-save.test.ts, app/api/content/route.ts - найдены на диске.
- Коммиты 77ab953 и 1cc6c3a - предки HEAD.
