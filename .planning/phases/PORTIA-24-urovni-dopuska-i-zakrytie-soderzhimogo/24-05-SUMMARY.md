---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
plan: 05
subsystem: access
tags: [redaction, canary-tests, recycle-bin, embedded-documents, sec-07]
requires:
  - phase: PORTIA-24-01
    provides: redactContentForViewer (вирусы), slotKeyFactory, contentBodyFor, типы фазы
  - phase: PORTIA-24-03
    provides: effectiveLevel, level разделов/подразделов/карточек, appLevels, lockedLevel, withheld
provides:
  - полная очистка по зрителю - корзина, разделы и подразделы, разделы и карточки, записи учёных (D-12), рекомендации, formattedText, «Устав»
  - lib/embedded-documents.ts (ссылка «Устава» только на сервере) и documents в ответе по зрителю
  - приманки уровней 1-5 по всем поверхностям на одной чистой функции
  - честная запись SEC-07, расширенного D-11 и решения D-19 (PROJECT.md, 24-RELEASE-NOTES.md, lib/level-docs.test.ts)
affects: [PORTIA-24-09, PORTIA-24-10, PORTIA-24-11]
requirements-completed: [SEC-07]
actuals:
  tokens: 16000
  tasks: 3
  commits: 3
plan_head_before: 6b63ade7af84d6b1dea9c172f236535f1c7a6d45
plan_head_after: 8166c817df3bdf68d30e6876a48bfc32cc420c3c
tech-stack:
  added: []
  patterns: [ответ собирается поле за полем без спреда верхнего уровня, formattedText - список разрешённого по точному id владельца, один узел на закрытый раздел]
key-files:
  created:
    - lib/embedded-documents.ts
    - lib/level-docs.test.ts
    - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-RELEASE-NOTES.md
  modified:
    - lib/level-redact.ts
    - lib/level-redact.test.ts
    - lib/content-response.ts
    - lib/content-response.test.ts
    - .planning/PROJECT.md
key-decisions:
  - "Ответ посетителю строится явно по полям PortiaContent (новое поле контента не утечёт молча); broadcastSections и searchRecommendationSections приходят пустыми, appLevels не включается."
  - "formattedText: ключ разбирается регэкспом и проверяется по точному id открытой записи (а не по startsWith), поэтому id вида `a:b` не путается с закрытым `a`; assistant:* всегда, search:recommendations только если ни одна строка не удалена."
  - "Узел закрытого подраздела/карточки создаётся только для открытых разделов, ключ в infoSubsections/guideCards появляется только при наличии закрытого ребёнка."
  - "Файл корзины вида virus следует уровню вируса по virusId среди живых и корзинных (не найден - 1); запись корзины, которой нет ни в recycleFiles, ни в recycledViruses, из порядка отбрасывается."
  - "documents у посетителя без маркера redaction пустой (fail closed)."
  - "O-1, O-3/A-4 остаются допущениями, не решениями владельца; «Таблица» в embeddedDocuments не добавлена."
duration: 35min
completed: 2026-11-15
status: complete
---

# Phase 24 Plan 05: полная очистка по всем поверхностям, ссылка «Устава» на сервере и честные ограничения Summary

`redactContentForViewer` теперь закрывает каждую поверхность LVL-05, а не только живые вирусы. Доказано приманками уровней 1-5 на одной чистой функции: на каждом уровне посетителя ни одна приманка выше его уровня не встречается ни в JSON ответа, ни в ключах `formattedText`, а все приманки не выше уровня на месте (в фикстуре больше 150 приманок). Ссылка «Устава» переехала в серверный модуль и приходит только при достаточном уровне.

## Что сделано

**Задача 1, коммит `be510e0`: очистка (lib/level-redact.ts).**
- Корзина: закрытый вирус корзины и файл вида virus закрытого вируса (живого или корзинного) опускаются вместе с `recycle:<id>:content`; на их позиции в `recycleOrder` - узел `redaction.recycle` с индексом в полном порядке (O-3/A-4). Текстовые и графические файлы - уровень 1.
- «Информация»/«Справочник»: закрытый раздел - ровно один узел, ключа в `infoSubsections`/`guideCards` нет (D-10); уровень ребёнка - `effectiveLevel(own, раздел)`; закрытый подраздел/карточка - узел в списке своего раздела.
- Записи учёных (D-12): закрытая запись открытого вируса пересобирается как `{ id, title, scientist, lockedLevel, content: [], withheld: true }`, без `richContent` и неизвестных ключей; для вируса, разделов, подразделов и карточек исключение не действует.
- Рекомендации поиска: строка удаляется, если её нормализованный текст содержит закрытое название/код/заголовок/имя файла или содержится в нём (оба не короче 2 символов); при любом удалении удаляется и ключ `search:recommendations`.
- `formattedText` - список разрешённого по точному id (virus, info body, info-block, guide-block, recycle, broadcast, assistant:*); неизвестный префикс, несуществующее объявление и чужие ключи отбрасываются на всех уровнях.
- «Устав»: `appLevels.charter` выше уровня даёт `redaction.apps.charter = { requiredLevel }`.
- Тесты `lib/level-redact.test.ts`: цикл 1-5 по фикстуре из вирусов, вирусов корзины, файлов корзины (оба вида), разделов, подразделов (три вида уровня), карточек, записей учёных, «Устава», рекомендаций; D-12, D-10, корзина с соседними открытыми и закрытым файлом между ними, порядок открытых во всех списках, рекомендации, allow-list `formattedText`, явная сборка ответа (незнакомое поле верхнего уровня не уходит).

**Задача 2, коммит `e8749f3`: «Устав» (lib/embedded-documents.ts, lib/content-response.ts).** `embeddedDocuments.charter` - значения дословно из `components/portia-desktop.tsx:41`. `documents` в ответе: редактору все, посетителю - только приложения без узла в `redaction.apps`. Тест обхода `components/` и `app/` (вне `app/api`) подтверждает, что `embedded-documents` никто не импортирует; «Таблицы» в `documents` нет (O-1). Клиентская копия ссылки остаётся до плана 24-10.

**Задача 3, коммит `8166c81`: честные записи.** В `.planning/PROJECT.md` (Known Limitations) - фраза SEC-07 дословно, расширение D-11 (уровни защищены только сервером; до Phase 25/SEC-01 аноним читает `portia_content` напрямую), свободный текст объявлений и фраз помощника; в Key Decisions - D-19 (отложено, без повторного вопроса). `24-RELEASE-NOTES.md` создан. `lib/level-docs.test.ts`: фраза посимвольно в обоих документах и в нужных разделах, детектор утверждений о закрытии ссылок (по предложениям) для PROJECT.md, заметки и `lib/level-copy.ts`, слова PASS в заметке нет, D-19 в Key Decisions, пункт в Future Requirements на месте.

## Проверка

- PASS: `node --experimental-strip-types --test lib/level-redact.test.ts lib/content-response.test.ts lib/level-hierarchy.test.ts lib/search-index.test.ts` - 59 pass, 0 fail (после задачи 1).
- PASS: `node --experimental-strip-types --test lib/level-docs.test.ts` - 5 pass, 0 fail.
- PASS: полный набор `lib/*.test.ts` с пропуском `matrix freshness: the real matrix commit` - 2045 тестов, 2042 pass, 0 fail, 3 skipped (база 24-03: 2006/2003/0/3). Пропущенный тест красен до плана 24-11 и PASS не засчитан.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` - 0 ошибок; ESLint по изменённым файлам - 0 ошибок и предупреждений.
- PASS (acceptance): `CANARY_L5` в тесте для каждого вида записей; `withheld: true` и `effectiveLevel(` в `lib/level-redact.ts`; `embeddedDocuments` в `lib/content-response.ts`; `grep -rln "embedded-documents" components app` вне `app/api` ничего не выводит; фраза SEC-07 найдена в PROJECT.md и заметке; `D-19` в Key Decisions; коммит задачи 3 не содержит путей владельца.
- Проверка мутациями: подмена условия открытости записи корзины, возврат `content` закрытой записи и сохранение `search:recommendations` при удалении строк роняют соответствующие тесты (5, 3 и 2 падения).
- BLOCKED (не доказано, не PASS): Postgres/RLS, живые роли редактора и сессия, анонимное чтение `portia_content` в обход очистки (Phase 25), браузер и физические устройства.

## Требования

- SEC-07 - отмечен выполненным: ограничение записано в PROJECT.md и заметке, тест держит фразу и запрет утверждений о закрытии ссылок.
- LVL-04 и LVL-05 уже отмечены выполненными в 24-01; этот план закрывает серверную часть LVL-05 для остальных поверхностей (корзина, разделы, карточки, рекомендации, formattedText). Клиентская часть (поиск, формы заглушек для остальных списков, пустые состояния, кэш устройства) - планы 24-02, 24-04, 24-09, 24-10; на фактическое состояние требований в REQUIREMENTS.md это не влияет.
- LVL-03 (проводка `raiseChildLevels` в PUT и редактор) и LVL-07 (форма записей учёных в редакторе) остаются Pending до планов 24-06...24-08.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug в тестах 24-01] Прежние тесты опирались на поведение до полной очистки**
- **Found during:** Task 1
- **Issue:** ключ `broadcast:keep:body` в фикстуре 24-01 теперь отбрасывается (нет объявления `keep`); `redaction.slots` теперь содержит id открытых разделов и карточек стандартного контента; тест «хранимые маркеры снимаются» ожидал отсутствие `withheld` у посетителя, а теперь сервер сам ставит `withheld` у закрытой записи учёного (D-12); тест `documents: {}` для пустой строки.
- **Fix:** в фикстуру добавлено объявление `keep`, фильтры по id вирусов в проверках `slots`, ожидание D-12 для подделанной записи, `documents.charter` для открытого уровня 1.
- **Files modified:** lib/level-redact.test.ts, lib/content-response.test.ts
- **Commit:** be510e0, e8749f3

### Отклонения по форме

- TDD: красная стадия отдельным коммитом не фиксировалась (одна фиксация на задачу, как в 24-01 и 24-03); вместо неё - проверка мутациями (см. выше).
- `effectiveLevel` не отличим от `requiredLevelOf` тестом: ребёнок с уровнем ниже раздела бывает только в открытом разделе (где он открыт при обоих способах) или в закрытом (где его нет в ответе). Правило использовано по плану, поведенчески ограничено уровнем самого раздела; отдельного теста-мутации у него нет.
- В коммите задачи 1 трейлер Co-Authored-By указан по ограничению оркестратора (Opus 5.5), в следующих двух - по системному напоминанию (Sonnet 5.5).
- `npm exec tsc` / `npm run lint` не запускались (временный Node), использованы прямые вызовы `tsc` и `eslint`.

**Total deviations:** 1 auto-fixed (Rule 1 в тестах предшествующего плана). **Impact:** нет.

## Known Stubs

Заглушек данных нет. Намеренно не сделано (следующие планы): клиентские формы заглушки `index/tile/bar/block` для остальных списков и CSS (24-02), клиентский разбор и показ узлов корзины, разделов, карточек, «Устава» (24-09, 24-10), удаление клиентской копии ссылки «Устава» из `components/portia-desktop.tsx` (24-10), проводка `raiseChildLevels` в PUT (24-06), форма уровня и записей учёных в редакторе (24-07, 24-08). Записи в `.planning/WINDOWS.md` не добавлялись.

## Threat Flags

Новой сетевой поверхности нет. Закрыто по реестру плана: T-24-14 (allow-list `formattedText` по точному id, приманки в ключах и значениях), T-24-15 (корзина), T-24-16 (рекомендации), T-24-17 (ссылка «Устава», тест обхода импортов), T-24-18 (один узел закрытого раздела), T-24-19 (фраза SEC-07 и запрет в `lib/level-docs.test.ts`), T-24-20 (запись учёного из пяти полей). T-24-21 принят и записан в PROJECT.md. Остаточное: охват `lib/content-response.ts`, `lib/level-redact.ts` в `23-SECURITY-MATRIX.md` - красное окно матрицы до плана 24-11.

## Self-Check: PASSED

- FOUND: lib/level-redact.ts, lib/level-redact.test.ts, lib/embedded-documents.ts, lib/content-response.ts, lib/content-response.test.ts, lib/level-docs.test.ts, 24-RELEASE-NOTES.md, .planning/PROJECT.md
- FOUND commits: be510e0, e8749f3, 8166c81 (`git rev-list --count 6b63ade..HEAD` = 3)
