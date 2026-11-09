---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 19
subsystem: testing
tags: [staging, playwright, matrix, search, media, restore]
requires:
  - phase: 19-15
    provides: CR-01 visibility fix and browser spec
  - phase: 19-18
    provides: guarded content matrix with snapshot restoration and owner verdict B
provides:
  - three browser runs across base, populated and empty content on isolated staging
  - 48-row app-state matrix and search/media browser evidence
  - review disposition and requirement statuses preserving employee BLOCKED data
affects: [19-20, 19-21, PORTIA-20, STAB-DESK-08, STAB-APP-02, STAB-APP-10]
actuals:
  tokens: 8268
  tasks: 3
  commits: 3
commits: 3
plan_head_before: e482ef2878d0690f5f8b77383b8742041ceded7c
plan_head_after: 7d2eefafaa41b5e5452284635f8ad3a19d67fb60
tech-stack:
  added: []
  patterns: [guarded staging variants, explicit snapshot residual, data-dependent browser skips]
key-files:
  created: [.planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/evidence/19-MATRIX-DATA-RUN.json]
  modified: [tests/e2e/specs/search.spec.ts, tests/e2e/specs/app-states.spec.ts, tests/e2e/specs/media-offscreen.spec.ts, scripts/phase19-matrix-data.mjs, lib/phase19-matrix-data.test.ts, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-REVIEW-DISPOSITION.md, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-REVIEW.md, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/deferred-items.md, .planning/REQUIREMENTS.md]
key-decisions:
  - "Владелец выбрал B: источник «Сотрудников» не менять; empty на двух проектах и desktop stale остаются BLOCKED (DATA)."
  - "Успех живого ростера в отдельном тесте не заменяет воспроизводимое свидетельство для STAB-DESK-08, STAB-APP-02 и STAB-APP-10."
requirements-completed: [STAB-APP-01, STAB-APP-03, STAB-APP-04, STAB-APP-05, STAB-APP-06, STAB-SEARCH-01, STAB-SEARCH-02, STAB-MEDIA-02, STAB-MEDIA-03, STAB-MEDIA-05]
duration: 31min
completed: 2026-11-04
status: complete
---

# Phase 19 Plan 19: Gap closure матрицы приложений, поиска и медиа

**На изолированном staging доказаны состояния контента, семь переходов из поиска и CR-01 на обоих Chromium; исходный снимок восстановлен после каждого варианта.**

## Accomplishments

- `base`: 85 passed, 0 failed, 29 skipped; `populated`: 101 passed, 0 failed, 13 skipped; `empty`: 70 passed, 0 failed, 44 skipped. Каждый `matrix-run` вернул `restored:true`; `matrix-residual` после каждого — `open:false`, `contentMatchesSnapshot:true`. Последний манифест — `variant=empty`, `restoredAt` заполнен.
- 48 строк матрицы, семь типов search click-through, media-states и CR-01 записаны в `19-EVIDENCE.md` с метками прогонов. 18 из прежних 21 `BLOCKED (DATA)` закрыты; три ячейки «Сотрудников» остались BLOCKED по вердикту B. Два CR-01 пропуска из 19-15 закрыты отдельно.
- `search.spec.ts` проверяет ненулевое и равное число результатов «ЁЖ/ёж/еж», на пустом источнике даёт `BLOCKED (DATA)` и использует `page.clock.runFor(450)`. Пустой источник в вирусных тестах не приводит к timeout.
- CR-01, WR-01, WR-02, WR-04, WR-06 и WR-07 отмечены `fixed` с коммитами и проверками; WR-03 и WR-05 перенесены в Phase 20 с причиной.

## Task Commits

1. Task 1 — `57a25c8`: ненулевой поиск, предстоящий тестовый квест, корректное ожидание свёрнутой обложки; populated 101/0/13 и restore.
2. Task 2 — `2f01a18`: безопасный пропуск сценариев с отсутствующим вирусом и отказом внешнего ростера; base 85/0/29, empty 70/0/44 и restore.
3. Task 3 — `7d2eefa`: матрица, disposition, статусы требований и чистый evidence scan.

## Verification

- Guard перед матричными запусками: `ATTESTED`, `refHash 01d085e7b9f0`; порт 3000 свободен. `matrix-residual` после финала: `open:false`, `contentMatchesSnapshot:true`.
- Browser: три итоговых прогона выше, 0 failed в каждом. CR-01 свёрнутого «Справочника», guide и broadcast click-through — passed на desktop и phone в populated. WR-07 — passed на обоих проектах с `counts[0] > 0` и равными счётчиками.
- `npm.cmd test`: 1106 passed, 0 failed, 3 прежних skipped. `npm.cmd exec tsc -- --noEmit`: passed. ESLint всех пяти изменённых source/test файлов: passed. Визуальный manifest: 37 passed, `--verify-promotion` проверил 33 точных approved snapshot и исключил 18 неутверждённых строк. `scan-evidence`: `findings:0`.
- Полный `npm.cmd run lint`: 32 прежние ошибки и 30 предупреждений в skill scripts, linked worktree и существующем UI; в изменённых файлах ошибок нет. Долг записан в `deferred-items.md`.

## Requirement Review

| Требование | Решение и доказательство |
|---|---|
| STAB-APP-01 | Complete: «База вирусов» loading/fatal base, empty empty, populated/stale populated; прежние функции подтверждены до 19-19. |
| STAB-APP-03 | Complete: «Сводка» loading/empty/fatal base/empty, populated/stale populated; прежняя сортировка и статусы подтверждены до 19-19. |
| STAB-APP-04 | Complete: «Информация» и «Справочник» имеют passed для всех применимых состояний; прежний порядок и блоки подтверждены до 19-19. |
| STAB-APP-05 | Complete: «Корзина» имеет passed для всех применимых состояний; права и destructive actions подтверждены до 19-19. |
| STAB-APP-06 | Complete: оба iframe имеют loading/populated/fatal passed, empty/stale N/A по дизайну; прежний zoom/sandbox подтверждён до 19-19. |
| STAB-SEARCH-01 | Complete: е/ё на ненулевых данных passed на обоих проектах; unit allowlist исключает unpublished/private поля. |
| STAB-SEARCH-02 | Complete: все семь типов click-through passed на обоих проектах в populated. |
| STAB-MEDIA-02/-03/-05 | Complete: media-states и три сценария media-offscreen, включая CR-01 свёрнутых обложек, passed на обоих проектах. |
| STAB-DESK-08, STAB-APP-02, STAB-APP-10 | Pending: empty «Сотрудники» на обоих проектах и desktop stale остаются BLOCKED (DATA) по вердикту B. |

## Deviations from Plan

- **[Rule 1 - Test bug]** Первая populated-попытка (91/9/14) выявила активный матричный квест, чьё штатное уведомление перекрывало элементы тестов. Перевели опубликованный квест в upcoming; поиск по опубликованной записи сохранился. Тест CR-01 теперь принимает `loading` или уже `loaded` в свёрнутом разделе, но по-прежнему запрещает `failed` и требует `loaded` после раскрытия.
- **[Rule 1 - Test bug]** Первая empty-попытка (65/7/42) выявила ожидание первой вирусной строки до проверки пустого ответа. Тесты теперь дожидаются завершения skeleton и честно пропускают зависящие от данных сценарии. Временный отказ внешнего ростера после retry помечается `BLOCKED (DATA)`.
- **[Rule 3 - Scan blocker]** Исторический `19-REVIEW.md` содержал демонстрационную строку, совпавшую с `postgres-url` scanner. Пример переформулирован без URL; `scan-evidence` после этого вернул 0 находок.

## Deferred Issues

- Полный lint не проходит из-за прежних ошибок вне файлов плана; изменённые файлы проходят ESLint.
- Три employee-ячейки остаются `BLOCKED (DATA)`; STAB-DESK-08, STAB-APP-02 и STAB-APP-10 не закрыты.
- Два открытых `unmet-truth` для employee empty и desktop stale внесены в `.planning/WINDOWS.md` (id 2 и 3).

## Auth Gates

Не возникали. Guard подтвердил изолированную цель; production и acceptance seed не затрагивались.

## Self-Check: PASSED

Все перечисленные созданные и изменённые файлы существуют. Коммиты `57a25c8`, `2f01a18`, `7d2eefa` являются предками HEAD. Последний `matrix-residual` подтвердил закрытый манифест и совпадение исходного снимка.
