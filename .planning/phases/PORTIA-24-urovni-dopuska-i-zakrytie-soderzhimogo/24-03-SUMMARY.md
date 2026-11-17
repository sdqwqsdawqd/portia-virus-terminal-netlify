---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 03
subsystem: access
tags: [access-levels, normalizer, hierarchy, editor-sections]
requires:
  - phase: PORTIA-24-01
    provides: requiredLevelOf, levelEntry, типы level/withheld/appLevels, LEVELED_APP_IDS
provides:
  - нормализатор сохраняет и зажимает level у разделов и подразделов «Информации», разделов и карточек «Справочника»
  - appLevels (только LEVELED_APP_IDS) и lockedLevel по D-13, маркер withheld записи учёного
  - lib/level-hierarchy.ts с effectiveLevel, raiseChildren, raiseChildLevels (D-17)
  - sectionOfKey("appLevels") = "info" (O-2)
affects: [PORTIA-24-05, PORTIA-24-06, PORTIA-24-07, PORTIA-24-08]
requirements-completed: []
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: f8a8e4430102a13ec5a8a365dd7bcf0f9d9758fe
plan_head_after: 649c52fb66f7d548c04afb4e33f30112f5ec8d73
tech-stack:
  added: []
  patterns: [no field stays no field, damaged value is the highest level, one pure hierarchy rule shared by editor, PUT and redaction]
key-files:
  created:
    - lib/level-hierarchy.ts
    - lib/level-hierarchy.test.ts
  modified:
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - lib/editor-changes.ts
    - lib/editor-changes.test.ts
key-decisions:
  - "levelEntry ставится сразу после title у подраздела, раздела «Информации», карточки и раздела «Справочника»; без поля ключа нет, снимки контента без уровней не меняются."
  - "lockedLevel записи учёного: нет поля = 1, целое 1–5 как есть (старые 2/3/4 на той же шкале), всё остальное = 5; маркер withheld сохраняется как true при любом значении ключа."
  - "appLevels хранит только ключи LEVELED_APP_IDS (сейчас charter); пустой результат = нет ключа."
  - "raiseChildren мутирует переданный черновик (для changeDraft редактора), raiseChildLevels работает с глубокой копией; повреждённый уровень ребёнка не трогается (читается как 5, зажмёт нормализатор)."
  - "O-2 (допущение, не решение владельца): appLevels принадлежит разделу info; смена места = одна строка в sectionOfKey."
duration: 15min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 03: уровни всех записей фазы в нормализаторе и правило иерархии Summary

Уровень теперь переживает нормализацию у каждой записи фазы (разделы и подразделы «Информации», разделы и карточки «Справочника», `appLevels.charter`, `lockedLevel` и маркер `withheld` записей учёных), а правило «ребёнок не доступнее раздела» выражено одной чистой функцией `lib/level-hierarchy.ts`. Уровень «Устава» подчиняется правам вкладки «Информация».

## Что сделано

**Задача 1, коммит `76d6677`.** Нормализатор (`lib/portia-content-normalize.ts`):
- `...levelEntry(value.level)` в `normalizeInfoSubsection`, `normalizeInfoSections`, `normalizeGuideCard`, `normalizeGuideSections` (вместе с вирусом из 24-01 — пять вызовов).
- `normalizeAppLevels`: не объект или массив → нет ключа; только `LEVELED_APP_IDS`, значение через `requiredLevelOf`; пустой результат → нет ключа.
- Записи учёных: `lockedLevel` по D-13 (нет поля = 1, мусор = 5), `withheld` из спреда убран и ставится заново как `true`, если ключ был.
- Тест «wrong-typed virus fields…» теперь ожидает `lockedLevel === 5` для `"high"` (D-03/D-13). Новые тесты «LVL-02 / D-03 …», «LVL-07 / D-13 …», «EDGE LVL-02/…», «EDGE LVL-06/…», «EDGE LVL-07/…»: границы 1/5 и 0/6, мусор (2.5, `"3"`, null, `{}`), контент без уровней не получает новых ключей, `appLevels` с чужими ключами, `withheld` при `"yes"`/false/null/true, порядок и id записей, идемпотентность.

**Задача 2, коммит `649c52f`.**
- `lib/level-hierarchy.ts`: `effectiveLevel(own, parent)` = max(requiredLevelOf(own), parent); `raiseChildren` (мутирует черновик, возвращает число поднятых); `raiseChildLevels(content)` (глубокая копия, вход не меняется).
- `lib/editor-changes.ts`: `sectionOfKey("appLevels") === "info"` с комментарием про O-2.
- Тесты: `lib/level-hierarchy.test.ts` (граница, смежность, пустые разделы, порядок, мусор, неизменность входа); в `lib/editor-changes.test.ts` — `changedSections`, `contentRefusal` (403 `section-closed`, sections `["info"]`) и `revertSections` для `appLevels`.

## Проверка

- PASS: `node --experimental-strip-types --test lib/portia-content-normalize.test.ts lib/content-response.test.ts lib/level-redact.test.ts` — 81 pass, 0 fail.
- PASS: `node --experimental-strip-types --test lib/level-hierarchy.test.ts lib/editor-changes.test.ts lib/editor-tabs.test.ts lib/editor-save-status.test.ts` — 117 pass, 0 fail.
- PASS: полный набор `lib/*.test.ts` с пропуском `matrix freshness: the real matrix commit` — 2006 тестов, 2003 pass, 0 fail, 3 skipped (база 24-01: 1944/0/3). Пропущенный тест красен до плана 24-11 и PASS не засчитан.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` — 0 ошибок; ESLint по репозиторию — 0 ошибок, 17 предупреждений (те же, новых нет).
- PASS (acceptance): `levelEntry(` — 5 вхождений (≥5), `normalizeAppLevels` — 2, `lockedLevel, 5` найден в тесте, `export function raiseChildLevels` и `effectiveLevel` по 1, `key === "appLevels"` — 1, тест неизменности входа есть.
- Ограничение: вирус хранит не больше `MAX_SCIENTIST_LOGS` записей, поэтому таблица `lockedLevel` проверяется группами по 4.
- BLOCKED (не доказано, не PASS): Postgres/RLS, живые роли редактора, браузер и физические устройства.

## Требования

`requirements-completed` пуст намеренно. LVL-02 уже отмечен выполненным в 24-01. LVL-03 (проводка `raiseChildLevels` в PUT и редактор — 24-06, 24-08, `effectiveLevel` в очистке — 24-05) и LVL-07 (очистка записей учёных — 24-05, форма — 24-07, UI вирусов — 24-04) остаются Pending: этот план даёт только чистые функции и нормализацию, сквозного поведения ещё нет.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug в тесте] Таблица `lockedLevel` из 11 записей обрезалась до `MAX_SCIENTIST_LOGS`**
- **Found during:** Task 1
- **Issue:** мой первый вариант теста подавал 11 записей в один вирус; нормализатор по D-01 держит не больше `MAX_SCIENTIST_LOGS`.
- **Fix:** случаи разбиты на группы по 4 записи.
- **Files modified:** lib/portia-content-normalize.test.ts
- **Commit:** 76d6677

### Отклонения по форме

- TDD: красная стадия Task 1 запускалась (9 падений до правки нормализатора), отдельным коммитом не фиксировалась — один коммит на задачу, как в 24-01. Task 2: тесты `appLevels` падали (4 красных) до правки `sectionOfKey`.
- `npm exec tsc` / `npm run lint` не запускались (temp Node), использованы прямые вызовы `tsc` и `eslint`.

**Total deviations:** 1 auto-fixed (Rule 1 в собственном тесте). **Impact:** нет.

## Known Stubs

Заглушек нет. Намеренно не сделано (следующие планы): вызов `raiseChildLevels` при сохранении (24-06) и в редакторе (24-08), `effectiveLevel` в серверной очистке (24-05), форма уровня и UI записей учёных (24-07), `redaction` для `appLevels` на клиенте. Записи в `.planning/WINDOWS.md` не добавлялись.

## Threat Flags

Новой сетевой поверхности нет. Закрыто по реестру плана: T-24-07 (мусор → 5, нет поля → 1, тесты границ и мусора), T-24-08 (`appLevels` → `info`, `contentRefusal` отказывает, тест), T-24-09 (правило иерархии готово как функции; проводка в PUT и очистку — 24-05/24-06).

## Self-Check: PASSED

- FOUND: lib/level-hierarchy.ts, lib/level-hierarchy.test.ts, lib/portia-content-normalize.ts, lib/portia-content-normalize.test.ts, lib/editor-changes.ts, lib/editor-changes.test.ts
- FOUND commits: 76d6677, 649c52f (`git rev-list --count f8a8e44..HEAD` = 2)
